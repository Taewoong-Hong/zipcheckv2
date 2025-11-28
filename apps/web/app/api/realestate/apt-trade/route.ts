/**
 * 아파트 실거래가 조회 API (FastAPI 형식)
 *
 * 응답 형식: { header: { resultCode, resultMsg }, body: { items, totalCount } }
 * XML 파싱 지원: 국토교통부 API는 XML 응답
 */
import { NextRequest, NextResponse } from 'next/server'
import { XMLParser } from 'fast-xml-parser'

export const runtime = 'nodejs'

// 국토교통부 실거래가 API (새 버전/구 버전)
const API_URLS = {
  new: 'http://apis.data.go.kr/1613000/RTMSDataSvcAptTrade/getRTMSDataSvcAptTrade',
  old: 'http://apis.data.go.kr/1611000/RTMSObsvService/getRTMSDataSvcAptTradeDev'
}

// 안전한 문자열/숫자 변환
const S = (v: unknown): string => (v == null ? '' : String(v).trim())
const N = (v: unknown): number | null => {
  const s = S(v).replace(/[ ,]/g, '')
  const num = Number(s)
  return Number.isFinite(num) ? num : null
}

export async function POST(req: NextRequest) {
  console.log('[apt-trade] POST 요청 시작')
  try {
    const { lawdCd, dealYmd } = await req.json()
    console.log('[apt-trade] params:', { lawdCd, dealYmd })

    // 파라미터 검증
    if (!lawdCd || String(lawdCd).length !== 5 || !/^\d{6}$/.test(String(dealYmd || ''))) {
      console.log('[apt-trade] 파라미터 검증 실패')
      return NextResponse.json({
        header: { resultCode: '400', resultMsg: 'Bad Request' },
        body: { items: [], totalCount: 0, error: 'Invalid parameters', params: { lawdCd, dealYmd } }
      }, { status: 400 })
    }

    const serviceKey = process.env.DATA_GO_KR_API_KEY
    console.log('[apt-trade] serviceKey exists:', !!serviceKey)
    if (!serviceKey) {
      return NextResponse.json({
        header: { resultCode: '500', resultMsg: 'Internal Server Error' },
        body: { items: [], totalCount: 0, error: 'API 키가 설정되지 않았습니다.' }
      }, { status: 500 })
    }

    // API 호출 (새 버전 먼저, 실패 시 구 버전)
    let res: Response | null = null
    let text = ''

    for (const [version, baseUrl] of Object.entries(API_URLS)) {
      const qs = new URLSearchParams({
        serviceKey,
        LAWD_CD: String(lawdCd),
        DEAL_YMD: String(dealYmd),
        pageNo: '1',
        numOfRows: '100'
      }).toString()

      const url = `${baseUrl}?${qs}`
      console.log('[apt-trade] 시도:', version, url.replace(serviceKey, 'KEY_HIDDEN'))

      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 10000)

        res = await fetch(url, {
          cache: 'no-store',
          signal: controller.signal
        })

        clearTimeout(timeoutId)
        console.log('[apt-trade] response.status:', res.status)
        text = (await res.text()).replace(/^\uFEFF/, '') // BOM 제거
        console.log('[apt-trade] response text length:', text.length)

        if (res.ok || res.status !== 404) {
          break
        }
      } catch (error: any) {
        console.error('[apt-trade] fetch error:', error.message)
        continue
      }
    }

    if (!res || !text) {
      return NextResponse.json({
        header: { resultCode: '502', resultMsg: 'Bad Gateway' },
        body: { items: [], totalCount: 0, error: '모든 API 엔드포인트 호출 실패' }
      }, { status: 502 })
    }

    if (!res.ok) {
      return NextResponse.json({
        header: { resultCode: '502', resultMsg: 'Upstream Error' },
        body: { items: [], totalCount: 0, error: text.slice(0, 500) }
      }, { status: 502 })
    }

    // XML 파싱
    const parser = new XMLParser({ ignoreAttributes: false, trimValues: true })
    const xml = parser.parse(text)

    // API 에러 체크
    const resultCode = xml?.response?.header?.resultCode ||
                       xml?.OpenAPI_ServiceResponse?.cmmMsgHeader?.returnAuthMsg?.resultCode
    const resultMsg = xml?.response?.header?.resultMsg ||
                      xml?.OpenAPI_ServiceResponse?.cmmMsgHeader?.returnAuthMsg?.resultMessage

    const successCodes = ['00', '0000', 'INFO-000', '03', 'INFO-003']
    const isNoData = resultCode === '03' || resultCode === 'INFO-003' || resultMsg?.includes('NO_DATA')

    if (resultCode && !successCodes.includes(resultCode) && !isNoData) {
      return NextResponse.json({
        header: { resultCode: String(resultCode), resultMsg: resultMsg || 'API Error' },
        body: { items: [], totalCount: 0, error: resultMsg, params: { lawdCd, dealYmd } }
      }, { status: 400 })
    }

    // NO_DATA 처리
    if (isNoData) {
      return NextResponse.json({
        header: { resultCode: '000', resultMsg: 'NO_DATA' },
        body: {
          items: [],
          totalCount: 0,
          message: '해당 기간에 거래 내역이 없습니다.',
          params: { lawdCd, dealYmd }
        }
      })
    }

    // rows 추출
    const rows = xml?.response?.body?.items?.item ?? []
    const list = Array.isArray(rows) ? rows : (rows ? [rows] : [])

    // 데이터 정규화
    const getAptName = (r: any): string =>
      S(r.aptNm ?? r.aptName ?? r.아파트 ?? r.아파트명 ?? r.단지명 ?? '')

    const getDong = (r: any): string =>
      S(r.dong ?? r.emdNm ?? r.umdNm ?? r.법정동 ?? r.읍면동 ?? '')

    const normalized = list.map((r: any) => ({
      dealAmount: N(r.거래금액 ?? r.dealAmount),
      dealYear: N(r.년 ?? r.dealYear),
      dealMonth: N(r.월 ?? r.dealMonth),
      dealDay: N(r.일 ?? r.dealDay),
      aptName: getAptName(r),
      dong: getDong(r),
      jibun: S(r.지번 ?? r.jibun),
      exclusiveArea: N(r.전용면적 ?? r.exclusiveArea),
      floor: N(r.층 ?? r.floor),
      buildYear: N(r.건축년도 ?? r.buildYear),
      cancelDealType: S(r.해제여부 ?? r.cancelDealType ?? r.cdealType),
      cancelDealDate: S(r.해제사유발생일 ?? r.cancelDealDate ?? r.cdealDay),
      sggCd: S(r.지역코드 ?? r.sggCd),
    }))

    // FastAPI 형식 응답
    return NextResponse.json({
      header: { resultCode: '000', resultMsg: 'OK' },
      body: {
        items: normalized,
        totalCount: list.length,
        params: { lawdCd, dealYmd }
      }
    })

  } catch (err: any) {
    console.error('[apt-trade] 최종 catch error:', err)
    return NextResponse.json({
      header: { resultCode: '500', resultMsg: 'Internal Server Error' },
      body: {
        items: [],
        totalCount: 0,
        error: err?.message ?? String(err)
      }
    }, { status: 500 })
  }
}
