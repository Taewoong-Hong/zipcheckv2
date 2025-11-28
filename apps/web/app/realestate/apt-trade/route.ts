import { NextResponse } from 'next/server'
import { XMLParser } from 'fast-xml-parser' // npm i fast-xml-parser
import { saveAptTrades } from '@/lib/save-trades'

// 국토교통부 실거래가 API (이전 버전과 새 버전 모두 지원)
const API_URLS = {
  new: 'http://apis.data.go.kr/1613000/RTMSDataSvcAptTrade/getRTMSDataSvcAptTrade',
  old: 'http://apis.data.go.kr/1611000/RTMSObsvService/getRTMSDataSvcAptTradeDev'
}

export const runtime = 'nodejs'

export async function POST(req: Request) {
  try {
    const { lawdCd, dealYmd } = await req.json()

    // 1) 파라미터 검증
    if (!lawdCd || String(lawdCd).length !== 5 || !/^\d{6}$/.test(String(dealYmd || ''))) {
      return NextResponse.json({
        header: { resultCode: '400', resultMsg: 'Invalid parameters' },
        body: { items: [], totalCount: 0, error: { lawdCd, dealYmd } }
      }, { status: 400 })
    }

    // 2) URL 조립 (serviceKey는 .env의 "일반 인증키" 원문 그대로)
    const serviceKey = process.env.DATA_GO_KR_API_KEY!
    if (!serviceKey) {
      console.error('DATA_GO_KR_API_KEY가 설정되지 않았습니다.')
      return NextResponse.json({
        header: { resultCode: '500', resultMsg: 'Configuration Error' },
        body: { items: [], totalCount: 0, error: 'API 키가 설정되지 않았습니다.' }
      }, { status: 500 })
    }
    
    // API URL 시도 (새 버전 먼저, 실패하면 구 버전)
    let res: Response | null = null
    let text = ''
    let usedUrl = ''
    
    // 먼저 새 버전 API 시도
    for (const [version, baseUrl] of Object.entries(API_URLS)) {
      const qs = new URLSearchParams({
        serviceKey,
        LAWD_CD: String(lawdCd),
        DEAL_YMD: String(dealYmd),
        pageNo: '1',
        numOfRows: '100'
      }).toString()

      const url = `${baseUrl}?${qs}`
      console.log(`[APT-TRADE] Trying ${version} API:`, url.replace(serviceKey, 'API_KEY_HIDDEN'))

      try {
        res = await fetch(url, { 
          cache: 'no-store',
          signal: AbortSignal.timeout(10000) // 10초 타임아웃
        })
        text = (await res.text()).replace(/^\uFEFF/, '') // BOM 제거
        
        console.log(`[APT-TRADE] ${version} Response Status:`, res.status)
        console.log(`[APT-TRADE] ${version} Response Text (first 500):`, text.slice(0, 500))

        if (res.ok || res.status !== 404) {
          usedUrl = url
          break // 404가 아니면 이 버전 사용
        }
      } catch (error) {
        console.error(`[APT-TRADE] ${version} API 호출 실패:`, error)
        continue
      }
    }

    if (!res || !text) {
      return NextResponse.json({
        header: { resultCode: '502', resultMsg: 'API 호출 실패' },
        body: { items: [], totalCount: 0, error: '모든 API 엔드포인트 호출 실패' }
      }, { status: 502 })
    }

    if (!res.ok) {
      console.error('[APT-TRADE] Upstream error:', res.status, text.slice(0, 800))
      return NextResponse.json({
        header: { resultCode: String(res.status), resultMsg: 'Upstream error' },
        body: {
          items: [],
          totalCount: 0,
          error: text.slice(0, 800),
          url: usedUrl.replace(serviceKey, 'API_KEY_HIDDEN')
        }
      }, { status: 502 })
    }

    // 4) XML → JSON 파싱
    const parser = new XMLParser({ ignoreAttributes: false, trimValues: true })
    const xml = parser.parse(text)
    
    // API 에러 체크
    const resultCode = xml?.response?.header?.resultCode || xml?.OpenAPI_ServiceResponse?.cmmMsgHeader?.returnAuthMsg?.resultCode
    const resultMsg = xml?.response?.header?.resultMsg || xml?.OpenAPI_ServiceResponse?.cmmMsgHeader?.returnAuthMsg?.resultMessage
    
    // 정상 코드: 00, 0000, INFO-000, 03(NO_DATA)
    const successCodes = ['00', '0000', 'INFO-000', '03', 'INFO-003']
    const isNoData = resultCode === '03' || resultCode === 'INFO-003' || resultMsg?.includes('NO_DATA')
    
    if (resultCode && !successCodes.includes(resultCode) && !isNoData) {
      console.error('[APT-TRADE] API Error:', { resultCode, resultMsg })
      return NextResponse.json({
        header: { resultCode: resultCode || '400', resultMsg: resultMsg || 'Unknown error' },
        body: { items: [], totalCount: 0, params: { lawdCd, dealYmd } }
      }, { status: 400 })
    }
    
    // NO_DATA 처리
    if (isNoData) {
      console.log('[APT-TRADE] No data for:', { lawdCd, dealYmd })
      return NextResponse.json({
        header: { resultCode: '000', resultMsg: 'OK' },
        body: {
          items: [],
          totalCount: 0,
          params: { lawdCd, dealYmd },
          message: '해당 기간에 거래 내역이 없습니다.'
        }
      })
    }

    // 5) rows 추출 (단일/배열 모두 대응)
    const rows = xml?.response?.body?.items?.item ?? []
    const list = Array.isArray(rows) ? rows : (rows ? [rows] : [])

    // 디버깅: 첫 번째 아이템의 키 확인
    if (list.length > 0) {
      console.log('[APT-TRADE] Raw item keys:', Object.keys(list[0]))
      console.log('[APT-TRADE] First item sample:', JSON.stringify(list[0]).slice(0, 300))
    }

    // 6) (선택) 정규화: 한/영 키 혼재 대비
    const S = (v: unknown): string => (v == null ? '' : String(v).trim())
    const N = (v: unknown): number | null => {
      const s = S(v).replace(/[ ,]/g, '')
      const num = Number(s)
      return Number.isFinite(num) ? num : null
    }

    // 아파트명 후보 필드 확장
    const getAptName = (r: any): string =>
      S(
        r.aptNm ??
        r.aptName ??
        r.apartment ??
        r.apartmentName ??
        r.aptname ??
        r.아파트 ??
        r.아파트명 ??
        r.단지명 ??
        ''
      )

    // 법정동 후보 필드 확장
    const getDong = (r: any): string =>
      S(r.dong ?? r.emdNm ?? r.umdNm ?? r.법정동 ?? r.읍면동 ?? r.법정동명 ?? '')

    // DB 저장 옵션 (쿼리 파라미터로 제어)
    const saveToDb = req.url.includes('save=1');
    
    const normalized = list.map((r: any) => ({
      // 금액/일자
      dealAmount: N(r.거래금액 ?? r.dealAmount),
      dealYear:   N(r.년 ?? r.dealYear),
      dealMonth:  N(r.월 ?? r.dealMonth),
      dealDay:    N(r.일 ?? r.dealDay),
      // 물건 정보
      aptName:    getAptName(r),
      dong:       getDong(r),
      jibun:      S(r.지번 ?? r.jibun),
      exclusiveArea: N(r.전용면적 ?? r.exclusiveArea),
      floor:      N(r.층 ?? r.floor),
      buildYear:  N(r.건축년도 ?? r.buildYear),
      // 취소 정보
      cancelDealType: S(r.해제여부 ?? r.cancelDealType ?? r.cdealType),
      cancelDealDate: S(r.해제사유발생일 ?? r.cancelDealDate ?? r.cdealDay),
      // 기타 정보
      sggCd: S(r.지역코드 ?? r.sggCd),
      dealingGbn: S(r.거래유형 ?? r.dealingGbn),
      slerGbn: S(r.중개사소재지 ?? r.slerGbn),
      buyerGbn: S(r.buyerGbn),
      estateAgentSggNm: S(r.중개사소재지 ?? r.estateAgentSggNm),
      rgstDate: S(r.등기일자 ?? r.rgstDate),
      aptDong: S(r.아파트동 ?? r.aptDong),
      landLeaseholdGbn: S(r.토지임대부 ?? r.landLeaseholdGbn),
      // 원본 보존(디버깅용)
      _raw: r,
    }))

    // DB에 저장 (옵션)
    if (saveToDb && normalized.length > 0) {
      try {
        const saved = await saveAptTrades(lawdCd, normalized)
        console.log(`[APT-TRADE] Saved ${saved} trades to DB`)
      } catch (dbErr) {
        console.error('[APT-TRADE] DB save error:', dbErr)
        // DB 저장 실패해도 API 응답은 정상 반환
      }
    }

    // FastAPI 형식으로 응답 (header + body)
    return NextResponse.json({
      header: { resultCode: '000', resultMsg: 'OK' },
      body: {
        items: normalized,
        totalCount: list.length,
        params: { lawdCd, dealYmd }
      }
    })
  } catch (err: any) {
    console.error('apt-trade error', err)
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