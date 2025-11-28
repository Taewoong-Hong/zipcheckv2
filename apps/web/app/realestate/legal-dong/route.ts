import { NextRequest, NextResponse } from 'next/server'
import { XMLParser } from 'fast-xml-parser'

export const runtime = 'nodejs'

// 행정표준코드관리시스템 법정동코드 조회 API - 가장 안정적인 조합
const BASE_URL = 'http://apis.data.go.kr/1741000/StanReginCd/getStanReginCdList'

function buildUrl(keyword: string, withFlag = true) {
  const serviceKey = process.env.DATA_GO_KR_API_KEY!
  
  const params = new URLSearchParams()
  params.set('serviceKey', serviceKey)  // 인증키 그대로 사용
  params.set('pageNo', '1')
  params.set('numOfRows', '50')
  params.set('_type', 'json')  // _type이 핵심
  if (withFlag) params.set('flag', 'Y')
  params.set('locatadd_nm', keyword)  // 예: '서울특별시 강남구 역삼동'
  
  // 공백을 %20으로 강제 치환
  const queryString = params.toString().replace(/\+/g, '%20')
  return `${BASE_URL}?${queryString}`
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { keyword } = body

    if (!keyword) {
      return NextResponse.json({
        header: { resultCode: '400', resultMsg: 'Bad Request' },
        body: { items: [], totalCount: 0, error: '검색어(keyword)는 필수입니다.' }
      }, { status: 400 })
    }

    // 환경변수에서 API 키 가져오기
    const serviceKey = process.env.DATA_GO_KR_API_KEY
    
    if (!serviceKey) {
      console.error('DATA_GO_KR_API_KEY가 설정되지 않았습니다.')
      return NextResponse.json({
        header: { resultCode: '500', resultMsg: 'Configuration Error' },
        body: { items: [], totalCount: 0, error: 'API 키가 설정되지 않았습니다.' }
      }, { status: 500 })
    }

    // serviceKey 상태 체크
    console.log('ServiceKey 상태:', {
      keyLength: serviceKey.length,
      hasPct: serviceKey.includes('%'),
      hasSpecialChars: /[+=/]/.test(serviceKey),
      firstChars: serviceKey.substring(0, 10) + '...'
    })

    let lastError: any = null

    // flag 옵션으로 두 번 시도 (Y 있음/없음)
    for (const withFlag of [true, false]) {
      try {
        const url = buildUrl(keyword, withFlag)
        console.log('[TRY] 법정동코드 API 호출:', {
          keyword: keyword,
          withFlag,
          url: url.replace(serviceKey, 'API_KEY_HIDDEN')
        })

        const response = await fetch(url, { 
          cache: 'no-store',
          signal: AbortSignal.timeout(10000)
        })
        const text = await response.text()

        console.log('[LEGAL-DONG STATUS]', response.status, 'len=', text.length)
        console.log('[LEGAL-DONG URL]', url)
        console.log('[LEGAL-DONG RES]', text.slice(0, 500))

        if (!response.ok) {
          // 원인을 그대로 노출
          lastError = {
            status: response.status,
            body: text.slice(0, 1000),
            url: url.replace(serviceKey, 'API_KEY_HIDDEN')
          }
          continue
        }

        // JSON/XML 자동 감지 및 파싱
        let payload: any
        const contentType = response.headers.get('content-type') || ''
        const looksXml = contentType.includes('xml') || text.trim().startsWith('<')

        if (looksXml) {
          console.log('[PARSING] XML 응답 감지')
          const parser = new XMLParser({
            ignoreAttributes: false,
            attributeNamePrefix: '',
            trimValues: true,
            parseTagValue: true
          })
          const xml = parser.parse(text)
          console.log('[PARSED XML]', JSON.stringify(xml).slice(0, 500))
          
          // XML 구조에서 rows 추출 (다양한 구조 지원)
          const rows = xml?.StanReginCd?.row || 
                      xml?.response?.body?.items?.item ||
                      xml?.items?.item ||
                      xml?.row ||
                      []
          
          // 배열이 아닌 경우 배열로 변환
          payload = { rows: Array.isArray(rows) ? rows : rows ? [rows] : [] }
        } else {
          console.log('[PARSING] JSON 응답 시도')
          try {
            payload = JSON.parse(text)
            console.log('[PARSED JSON]', JSON.stringify(payload).slice(0, 200))
          } catch (e) {
            console.error('[JSON PARSE ERROR]', e)
            lastError = { 
              parseError: (e as Error).message, 
              snippet: text.slice(0, 400),
              url: url.replace(serviceKey, 'API_KEY_HIDDEN')
            }
            continue
          }
        }

        // 파싱된 데이터에서 rows 추출
        const rows = payload?.rows || 
                    payload?.StanReginCd?.[1]?.row || 
                    payload?.StanReginCd?.row || 
                    payload?.row || 
                    payload?.items || 
                    []
        
        if (rows && rows.length > 0) {
          console.log(`[SUCCESS] 찾은 항목 수: ${rows.length}`)
          
          // 첫 번째 아이템 구조 확인 (디버깅)
          if (rows[0]) {
            console.log('[FIRST ITEM STRUCTURE]', JSON.stringify(rows[0]).slice(0, 300))
            console.log('[FIRST ITEM KEYS]', Object.keys(rows[0]))
          }
          
          // 안전한 문자열 변환 헬퍼
          const S = (v: unknown): string => (v == null ? '' : String(v))
          
          // 배열 변환 헬퍼
          const asArray = (v: any): any[] => (Array.isArray(v) ? v : v ? [v] : [])
          
          // 안전한 데이터 정규화
          const items = asArray(rows)
            .filter(Boolean)
            .map((item: any) => {
              // 다양한 필드명 후보
              const codeRaw = 
                item.locatjumin_cd ||  // 10자리 코드
                item.region_cd || 
                item.regionCd || 
                item.bdongCd || 
                item.umdCd || 
                item.emdCd ||
                item.code
              
              const nameRaw = 
                item.locatadd_nm || 
                item.locataddNm ||
                item.bdongNm || 
                item.bdong_name || 
                item.emdNm || 
                item.umdNm || 
                item.sggNm || 
                item.admNm || 
                item.name
              
              // 안전한 5자리 코드 추출
              const lawd5 = 
                S(codeRaw).slice(0, 5) || 
                S(item.locatjijuk_cd).slice(0, 5) || 
                ''
              
              return {
                // 기존 필드 (호환성)
                regionCd: S(codeRaw),
                sidoCd: S(item.sido_cd || item.sidoCd),
                sggCd: S(item.sgg_cd || item.sggCd),
                emdCd: S(item.umd_cd || item.emdCd || item.umdCd),
                riCd: S(item.ri_cd || item.riCd),
                locataddNm: S(nameRaw),
                locatOrder: S(item.locat_order || item.locatOrder),
                locatRm: S(item.locat_rm || item.locatRm),
                locatHighCd: S(item.locathigh_cd || item.locatHighCd),
                locatLowNm: S(item.locallow_nm || item.locatLowNm),
                // 추가 필드
                lawd5: lawd5,
                // 디버깅용 원본
                _raw: item
              }
            })
            .filter(item => item.regionCd || item.lawd5 || item.locataddNm)
          
          // FastAPI 형식으로 응답 (header + body)
          return NextResponse.json({
            header: {
              resultCode: '000',
              resultMsg: 'OK'
            },
            body: {
              items,
              totalCount: items.length,
              params: { keyword: keyword }
            }
          })
        }
      } catch (fetchError: any) {
        console.error('[FETCH ERROR]', fetchError.message)
        lastError = { fetchError: fetchError.message }
      }
    }

    // 모든 시도 실패 - FastAPI 형식으로 에러 응답
    console.error('법정동코드 조회 최종 실패:', lastError)
    return NextResponse.json({
      header: {
        resultCode: '500',
        resultMsg: 'Upstream error'
      },
      body: {
        items: [],
        totalCount: 0,
        error: lastError
      }
    }, { status: 500 })

  } catch (error) {
    console.error('법정동코드 API 오류:', error)
    return NextResponse.json({
      header: { resultCode: '500', resultMsg: 'Internal Server Error' },
      body: {
        items: [],
        totalCount: 0,
        error: '법정동코드 조회 중 오류가 발생했습니다.',
        details: error instanceof Error ? error.message : String(error)
      }
    }, { status: 500 })
  }
}