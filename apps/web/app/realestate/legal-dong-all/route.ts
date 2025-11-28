import { NextRequest, NextResponse } from 'next/server'
import { XMLParser } from 'fast-xml-parser'

export const runtime = 'nodejs'

// 시도 목록
const SIDO_LIST = [
  '서울특별시', '부산광역시', '대구광역시', '인천광역시', '광주광역시', '대전광역시',
  '울산광역시', '세종특별자치시', '경기도', '강원도', '충청북도', '충청남도',
  '전라북도', '전라남도', '경상북도', '경상남도', '제주특별자치도'
]

// 안전한 문자열 변환 헬퍼
const S = (v: unknown): string => (v == null ? '' : String(v).trim())

// 배열 보장 헬퍼
const asArray = (v: any): any[] => (Array.isArray(v) ? v : v ? [v] : [])

function normalizeServiceKey(rawKey: string) {
  if (!rawKey) throw new Error('DATA_GO_KR_API_KEY is missing')
  // 인코딩키면 그대로, 디코딩키면 인코딩
  return /%[0-9A-Fa-f]{2}/.test(rawKey) ? rawKey : encodeURIComponent(rawKey)
}

function buildUrl(keyword: string, serviceKey: string, withFlag = true) {
  const params = new URLSearchParams()
  params.set('serviceKey', serviceKey)
  params.set('pageNo', '1')
  params.set('numOfRows', '1000')
  params.set('type', 'json')  // type이 맞음 (_type 아님)
  if (withFlag) params.set('flag', 'Y')
  params.set('locatadd_nm', keyword)
  
  // 공백을 %20으로 강제 치환
  const queryString = params.toString().replace(/\+/g, '%20')
  return `http://apis.data.go.kr/1741000/StanReginCd/getStanReginCdList?${queryString}`
}

async function fetchLegalDongData(keyword: string, serviceKey: string) {
  console.log('[LEGAL-DONG-ALL] 조회 시작:', keyword)
  
  let lastError: any = null

  // flag 옵션으로 두 번 시도 (Y 있음/없음)
  for (const withFlag of [true, false]) {
    try {
      const url = buildUrl(keyword, serviceKey, withFlag)
      console.log('[LEGAL-DONG-ALL] Request URL:', url.replace(/serviceKey=[^&]+/, 'serviceKey=API_KEY_HIDDEN'))

      const response = await fetch(url, {
        method: 'GET',
        // headers 생략 (이 API는 필요 없음)
        cache: 'no-store',
        signal: AbortSignal.timeout(30000) // 30초 타임아웃
      })

      const text = (await response.text()).replace(/^\uFEFF/, '') // BOM 제거
      console.log('[LEGAL-DONG-ALL] Response status:', response.status)
      console.log('[LEGAL-DONG-ALL] Response preview:', text.slice(0, 200))

      if (!response.ok) {
        console.error('[LEGAL-DONG-ALL] HTTP Error:', response.status, response.statusText)
        lastError = {
          status: response.status,
          body: text.slice(0, 1000),
          url: url.replace(/serviceKey=[^&]+/, 'serviceKey=API_KEY_HIDDEN')
        }
        continue
      }

      // JSON/XML 자동 감지 및 파싱
      let payload: any
      const contentType = response.headers.get('content-type') || ''
      const looksXml = contentType.includes('xml') || text.trim().startsWith('<')

      if (looksXml) {
        console.log('[LEGAL-DONG-ALL] XML 응답 감지')
        const parser = new XMLParser({
          ignoreAttributes: false,
          attributeNamePrefix: '',
          trimValues: true,
          parseTagValue: true
        })
        const xml = parser.parse(text)
        
        // XML 에러 체크
        const errorResponse = xml?.OpenAPI_ServiceResponse?.cmmMsgHeader
        if (errorResponse) {
          console.error('[LEGAL-DONG-ALL] API Error:', {
            errMsg: errorResponse.errMsg,
            returnAuthMsg: errorResponse.returnAuthMsg,
            returnReasonCode: errorResponse.returnReasonCode
          })
          
          // HTTP ROUTING ERROR (04)인 경우 즉시 실패
          if (errorResponse.returnReasonCode == '04' || errorResponse.returnReasonCode == 4) {
            console.error('[LEGAL-DONG-ALL] ROUTING/KEY ERROR - Check serviceKey encoding')
            return { 
              success: false, 
              items: [], 
              error: 'Routing/Key error',
              hint: 'Check serviceKey encoding',
              detail: errorResponse
            }
          }
          
          lastError = errorResponse
          continue
        }

        // XML 구조에서 rows 추출
        const rows = xml?.StanReginCd?.row || 
                    xml?.response?.body?.items?.item ||
                    xml?.items?.item ||
                    xml?.row ||
                    []
        
        payload = { rows: Array.isArray(rows) ? rows : rows ? [rows] : [] }
      } else {
        console.log('[LEGAL-DONG-ALL] JSON 응답 시도')
        try {
          payload = JSON.parse(text)
        } catch (e) {
          console.error('[LEGAL-DONG-ALL] JSON parse error:', e)
          lastError = { parseError: (e as Error).message, snippet: text.slice(0, 400) }
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
        console.log(`[LEGAL-DONG-ALL] 찾은 항목 수: ${rows.length}`)
        
        // 안전한 데이터 정규화
        const items = asArray(rows)
          .filter(Boolean)
          .map((item: any) => {
            const codeRaw = 
              item.locatjumin_cd ||
              item.region_cd || 
              item.regionCd || 
              item.bdongCd || 
              item.umdCd || 
              item.emdCd ||
              item.code ||
              ''

            const regionCd = S(codeRaw)
            if (!regionCd || regionCd.length < 5) return null

            return {
              region_cd: regionCd,
              sido_cd: S(item.sido_cd || item.sidoCd || regionCd.substring(0, 2)),
              sgg_cd: S(item.sgg_cd || item.sggCd || regionCd.substring(2, 5)),
              umd_cd: S(item.umd_cd || item.emdCd || item.umdCd || regionCd.substring(5, 8)),
              ri_cd: S(item.ri_cd || item.riCd || regionCd.substring(8, 10)),
              locatadd_nm: S(
                item.locatadd_nm ||
                item.locataddNm ||
                item.locat_add_nm ||
                item.bdongNm || 
                item.bdong_name || 
                item.emdNm || 
                item.umdNm || 
                item.sggNm || 
                item.admNm || 
                item.fullAddr ||
                item.addr ||
                item.address ||
                item.주소 ||
                ''
              )
            }
          })
          .filter(Boolean)
        
        console.log(`[LEGAL-DONG-ALL] 유효한 항목 수: ${items.length}`)
        return { success: true, items }
      }
    } catch (error) {
      console.error(`[LEGAL-DONG-ALL] Fetch error:`, error)
      lastError = { fetchError: (error as Error).message }
    }
  }
  
  // 모든 시도 실패
  console.error(`[LEGAL-DONG-ALL] All attempts failed for ${keyword}:`, lastError)
  return { success: false, items: [] }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { type = 'sido', sido } = body

    // 파라미터 검증
    if (!type || !['sido', 'sgg'].includes(type)) {
      return NextResponse.json(
        { error: 'Invalid type parameter', detail: 'type must be "sido" or "sgg"' },
        { status: 400 }
      )
    }

    if (type === 'sgg' && !sido) {
      return NextResponse.json(
        { error: 'Missing sido parameter', detail: 'sido is required when type is "sgg"' },
        { status: 400 }
      )
    }

    // ✅ 핸들러 내부에서 serviceKey 선언 (스코프 에러 방지)
    const rawKey = process.env.DATA_GO_KR_API_KEY ?? ''
    const serviceKey = normalizeServiceKey(rawKey)
    
    console.log('[KEY DEBUG]', {
      hasPct: /%[0-9A-Fa-f]{2}/.test(rawKey),
      rawLen: rawKey.length,
      srvLen: serviceKey.length,
      srvHead: serviceKey.slice(0,10) + '...'
    })

    let allData: any[] = []

    if (type === 'sido') {
      // 시도 데이터만 수집
      console.log('[LEGAL-DONG-ALL] 시도 데이터 수집 시작...')
      
      for (const sido of SIDO_LIST) {
        const result = await fetchLegalDongData(sido, serviceKey)
        
        if (result.success) {
          // 시도 레벨 데이터만 필터링 (sgg_cd가 '000'인 것)
          const sidoData = result.items.filter((item: any) => 
            item.sgg_cd === '000' && item.umd_cd === '000'
          )
          allData = allData.concat(sidoData)
        }
        
        // API 호출 제한 고려하여 잠시 대기
        await new Promise(resolve => setTimeout(resolve, 100))
      }
    } else if (type === 'sgg') {
      // 시군구 데이터 수집 (특정 시도의)
      console.log(`[LEGAL-DONG-ALL] ${sido} 시군구 데이터 수집 시작...`)
      
      const result = await fetchLegalDongData(sido, serviceKey)
      
      if (result.success) {
        // 시군구 레벨 데이터 필터링 (umd_cd가 '000'인 것)
        allData = result.items.filter((item: any) => 
          item.sgg_cd !== '000' && item.umd_cd === '000'
        )
      }
    }

    // 중복 제거 (region_cd 기준)
    const uniqueItems = Array.from(
      new Map(allData.map(item => [item.region_cd, item])).values()
    )

    // 정렬 (코드 순)
    uniqueItems.sort((a, b) => a.region_cd.localeCompare(b.region_cd))

    // DataFrame 형식으로 정리
    const dataFrame = uniqueItems.map((item, index) => ({
      index: index + 1,
      sido_cd: item.sido_cd,
      sgg_cd: item.sgg_cd,
      umd_cd: item.umd_cd,
      ri_cd: item.ri_cd,
      locatadd_nm: item.locatadd_nm,
      // 아파트 실거래가 조회용 5자리 법정동코드 (sido_cd + sgg_cd)
      lawd_cd: item.sido_cd + item.sgg_cd,
      region_cd: item.region_cd  // 전체 법정동코드 (10자리)
    }))

    console.log(`[LEGAL-DONG-ALL] Returning ${dataFrame.length} items`)

    return NextResponse.json({
      success: true,
      data: {
        type,
        sido: sido || null,
        totalCount: dataFrame.length,
        items: dataFrame,
        columns: ['index', 'sido_cd', 'sgg_cd', 'umd_cd', 'ri_cd', 'locatadd_nm', 'lawd_cd', 'region_cd']
      }
    })

  } catch (error) {
    console.error('[LEGAL-DONG-ALL] Error:', error)
    return NextResponse.json({
      success: false,
      error: '데이터 수집 중 오류가 발생했습니다.',
      detail: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}