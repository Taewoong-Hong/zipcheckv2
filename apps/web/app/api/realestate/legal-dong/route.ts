/**
 * 법정동코드 조회 API (FastAPI 형식)
 *
 * 응답 형식: { header: { resultCode, resultMsg }, body: { items, totalCount } }
 * XML fallback 지원: 공공데이터 API가 JSON 대신 XML 반환 시 자동 파싱
 */
import { NextRequest, NextResponse } from 'next/server'
import { XMLParser } from 'fast-xml-parser'

export const runtime = 'nodejs'

const BASE_URL = 'http://apis.data.go.kr/1741000/StanReginCd/getStanReginCdList'

function buildUrl(keyword: string, serviceKey: string, withFlag = true) {
  const params = new URLSearchParams()
  params.set('serviceKey', serviceKey)
  params.set('pageNo', '1')
  params.set('numOfRows', '50')
  params.set('_type', 'json')
  if (withFlag) params.set('flag', 'Y')
  params.set('locatadd_nm', keyword)

  // 공백을 %20으로 강제 치환
  const queryString = params.toString().replace(/\+/g, '%20')
  return `${BASE_URL}?${queryString}`
}

// 안전한 문자열 변환
const S = (v: unknown): string => (v == null ? '' : String(v))

// 배열 변환
const asArray = (v: any): any[] => (Array.isArray(v) ? v : v ? [v] : [])

export async function POST(request: NextRequest) {
  console.log('[legal-dong] POST 요청 시작')
  try {
    const body = await request.json()
    console.log('[legal-dong] body:', body)
    const { keyword } = body

    if (!keyword) {
      return NextResponse.json({
        header: { resultCode: '400', resultMsg: 'Bad Request' },
        body: { items: [], totalCount: 0, error: '검색어(keyword)는 필수입니다.' }
      }, { status: 400 })
    }

    const serviceKey = process.env.DATA_GO_KR_API_KEY
    console.log('[legal-dong] serviceKey exists:', !!serviceKey)

    if (!serviceKey) {
      return NextResponse.json({
        header: { resultCode: '500', resultMsg: 'Internal Server Error' },
        body: { items: [], totalCount: 0, error: 'API 키가 설정되지 않았습니다.' }
      }, { status: 500 })
    }

    let lastError: any = null

    // flag 옵션으로 두 번 시도 (Y 있음/없음)
    for (const withFlag of [true, false]) {
      try {
        const url = buildUrl(keyword, serviceKey, withFlag)
        console.log('[legal-dong] URL:', url.replace(serviceKey, 'KEY_HIDDEN'))

        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 10000)

        console.log('[legal-dong] fetch 시작')
        const response = await fetch(url, {
          cache: 'no-store',
          signal: controller.signal
        })

        clearTimeout(timeoutId)
        console.log('[legal-dong] response.status:', response.status)
        const text = await response.text()
        console.log('[legal-dong] response text length:', text.length)

        if (!response.ok) {
          lastError = { status: response.status, body: text.slice(0, 500) }
          continue
        }

        // JSON/XML 자동 감지 및 파싱
        let payload: any
        const contentType = response.headers.get('content-type') || ''
        const looksXml = contentType.includes('xml') || text.trim().startsWith('<')

        if (looksXml) {
          // XML fallback 파싱
          const parser = new XMLParser({
            ignoreAttributes: false,
            attributeNamePrefix: '',
            trimValues: true,
            parseTagValue: true
          })
          const xml = parser.parse(text)

          const rows = xml?.StanReginCd?.row ||
                      xml?.response?.body?.items?.item ||
                      xml?.items?.item ||
                      xml?.row ||
                      []

          payload = { rows: asArray(rows) }
        } else {
          // JSON 파싱
          try {
            payload = JSON.parse(text)
          } catch (e) {
            lastError = { parseError: (e as Error).message, snippet: text.slice(0, 300) }
            continue
          }
        }

        // rows 추출
        const rows = payload?.rows ||
                    payload?.StanReginCd?.[1]?.row ||
                    payload?.StanReginCd?.row ||
                    payload?.row ||
                    payload?.items ||
                    []

        console.log('[legal-dong] rows count:', rows?.length || 0)

        if (rows && rows.length > 0) {
          // 데이터 정규화
          const items = asArray(rows)
            .filter(Boolean)
            .map((item: any) => {
              const codeRaw = item.locatjumin_cd || item.region_cd || item.regionCd || item.code
              const nameRaw = item.locatadd_nm || item.locataddNm || item.bdongNm || item.name
              const lawd5 = S(codeRaw).slice(0, 5) || S(item.locatjijuk_cd).slice(0, 5) || ''

              return {
                regionCd: S(codeRaw),
                sidoCd: S(item.sido_cd || item.sidoCd),
                sggCd: S(item.sgg_cd || item.sggCd),
                locataddNm: S(nameRaw),
                lawd5: lawd5,
              }
            })
            .filter(item => item.regionCd || item.lawd5 || item.locataddNm)

          // FastAPI 형식 응답
          return NextResponse.json({
            header: { resultCode: '000', resultMsg: 'OK' },
            body: {
              items,
              totalCount: items.length,
              params: { keyword }
            }
          })
        }
      } catch (fetchError: any) {
        console.error('[legal-dong] fetchError:', fetchError.message)
        lastError = { fetchError: fetchError.message }
      }
    }

    // 모든 시도 실패
    console.log('[legal-dong] 모든 시도 실패, lastError:', lastError)
    return NextResponse.json({
      header: { resultCode: '502', resultMsg: 'Upstream Error' },
      body: { items: [], totalCount: 0, error: lastError }
    }, { status: 502 })

  } catch (error) {
    console.error('[legal-dong] 최종 catch error:', error)
    return NextResponse.json({
      header: { resultCode: '500', resultMsg: 'Internal Server Error' },
      body: {
        items: [],
        totalCount: 0,
        error: error instanceof Error ? error.message : String(error)
      }
    }, { status: 500 })
  }
}
