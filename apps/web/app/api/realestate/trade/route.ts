/**
 * 부동산 매매/전월세 실거래가 조회 API (통합)
 *
 * 건물유형과 계약유형에 따라 적절한 공공데이터 API 호출
 *
 * POST /api/realestate/trade
 * Body: {
 *   lawdCd: string (법정동코드 5자리),
 *   dealYmd: string (거래년월 YYYYMM),
 *   buildingType: 'apt' | 'offi' | 'rh' | 'sh',
 *   contractType: 'trade' | 'rent'
 * }
 */
import { NextRequest, NextResponse } from 'next/server'
import { XMLParser } from 'fast-xml-parser'

export const runtime = 'nodejs'

// API URL 매핑 (건물유형 + 계약유형)
const API_URLS: Record<string, Record<string, string>> = {
  apt: {
    trade: 'http://apis.data.go.kr/1613000/RTMSDataSvcAptTrade/getRTMSDataSvcAptTrade',
    rent: 'http://apis.data.go.kr/1613000/RTMSDataSvcAptRent/getRTMSDataSvcAptRent',
  },
  offi: {
    trade: 'http://apis.data.go.kr/1613000/RTMSDataSvcOffiTrade/getRTMSDataSvcOffiTrade',
    rent: 'http://apis.data.go.kr/1613000/RTMSDataSvcOffiRent/getRTMSDataSvcOffiRent',
  },
  rh: {
    trade: 'http://apis.data.go.kr/1613000/RTMSDataSvcRHTrade/getRTMSDataSvcRHTrade',
    rent: 'http://apis.data.go.kr/1613000/RTMSDataSvcRHRent/getRTMSDataSvcRHRent',
  },
  sh: {
    trade: 'http://apis.data.go.kr/1613000/RTMSDataSvcSHTrade/getRTMSDataSvcSHTrade',
    rent: 'http://apis.data.go.kr/1613000/RTMSDataSvcSHRent/getRTMSDataSvcSHRent',
  },
}

// 건물유형 한글명
const BUILDING_TYPE_KR: Record<string, string> = {
  apt: '아파트',
  offi: '오피스텔',
  rh: '연립다세대',
  sh: '단독/다가구',
}

// 계약유형 한글명
const CONTRACT_TYPE_KR: Record<string, string> = {
  trade: '매매',
  rent: '전월세',
}

// 안전한 문자열/숫자 변환
const S = (v: unknown): string => (v == null ? '' : String(v).trim())
const N = (v: unknown): number | null => {
  const s = S(v).replace(/[ ,]/g, '')
  const num = Number(s)
  return Number.isFinite(num) ? num : null
}

// 건물명 추출 (건물유형별 필드명이 다름)
const getBuildingName = (r: any, buildingType: string): string => {
  switch (buildingType) {
    case 'apt':
      return S(r.aptNm ?? r.aptName ?? r.아파트 ?? r.아파트명 ?? r.단지명 ?? '')
    case 'offi':
      return S(r.offiNm ?? r.오피스텔 ?? r.단지명 ?? '')
    case 'rh':
      return S(r.mhouseNm ?? r.연립다세대 ?? r.단지명 ?? '')
    case 'sh':
      return S(r.houseType ?? r.주택유형 ?? r.단독주택 ?? '')
    default:
      return S(r.aptNm ?? r.offiNm ?? r.mhouseNm ?? r.houseType ?? '')
  }
}

// 법정동 추출
const getDong = (r: any): string =>
  S(r.dong ?? r.emdNm ?? r.umdNm ?? r.법정동 ?? r.읍면동 ?? '')

// 전용면적 추출
const getExclusiveArea = (r: any): number | null =>
  N(r.excluUseAr ?? r.전용면적 ?? r.exclusiveArea ?? r.대지면적)

// 거래금액 추출
const getDealAmount = (r: any): number | null =>
  N(r.거래금액 ?? r.dealAmount)

// 보증금/월세 추출 (전월세용)
const getDeposit = (r: any): number | null =>
  N(r.보증금 ?? r.deposit ?? r.보증금액)

const getMonthlyRent = (r: any): number | null =>
  N(r.월세 ?? r.monthlyRent ?? r.월세금액)

export async function POST(req: NextRequest) {
  const startTime = Date.now()

  try {
    const body = await req.json()
    const { lawdCd, dealYmd, buildingType = 'apt', contractType = 'trade' } = body

    const buildingTypeKr = BUILDING_TYPE_KR[buildingType] || buildingType
    const contractTypeKr = CONTRACT_TYPE_KR[contractType] || contractType

    console.log(`[realestate/trade] ${buildingTypeKr} ${contractTypeKr} 조회 시작`, { lawdCd, dealYmd })

    // 파라미터 검증
    if (!lawdCd || String(lawdCd).length !== 5) {
      return NextResponse.json({
        header: { resultCode: '400', resultMsg: 'Bad Request' },
        body: {
          items: [],
          totalCount: 0,
          error: 'lawdCd는 5자리 법정동코드가 필요합니다.',
          params: { lawdCd, dealYmd, buildingType, contractType }
        }
      }, { status: 400 })
    }

    if (!dealYmd || !/^\d{6}$/.test(String(dealYmd))) {
      return NextResponse.json({
        header: { resultCode: '400', resultMsg: 'Bad Request' },
        body: {
          items: [],
          totalCount: 0,
          error: 'dealYmd는 YYYYMM 형식의 6자리가 필요합니다.',
          params: { lawdCd, dealYmd, buildingType, contractType }
        }
      }, { status: 400 })
    }

    // API URL 가져오기
    const apiUrl = API_URLS[buildingType]?.[contractType]
    if (!apiUrl) {
      return NextResponse.json({
        header: { resultCode: '400', resultMsg: 'Bad Request' },
        body: {
          items: [],
          totalCount: 0,
          error: `지원하지 않는 조합입니다: buildingType=${buildingType}, contractType=${contractType}`,
          supportedBuildingTypes: Object.keys(API_URLS),
          supportedContractTypes: ['trade', 'rent']
        }
      }, { status: 400 })
    }

    const serviceKey = process.env.DATA_GO_KR_API_KEY
    if (!serviceKey) {
      return NextResponse.json({
        header: { resultCode: '500', resultMsg: 'Internal Server Error' },
        body: { items: [], totalCount: 0, error: 'API 키가 설정되지 않았습니다.' }
      }, { status: 500 })
    }

    // API 호출
    const qs = new URLSearchParams({
      serviceKey,
      LAWD_CD: String(lawdCd),
      DEAL_YMD: String(dealYmd),
      pageNo: '1',
      numOfRows: '1000'
    }).toString()

    const url = `${apiUrl}?${qs}`
    console.log(`[realestate/trade] API 호출:`, url.replace(serviceKey, 'KEY_HIDDEN'))

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 15000)

    const res = await fetch(url, {
      cache: 'no-store',
      signal: controller.signal
    })

    clearTimeout(timeoutId)

    const text = (await res.text()).replace(/^\uFEFF/, '') // BOM 제거

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

    const successCodes = ['00', '000', '0000', 'INFO-000', '03', 'INFO-003']
    const isNoData = resultCode === '03' || resultCode === 'INFO-003' ||
                     resultMsg?.includes('NO_DATA') || resultMsg?.includes('데이터 없음')

    if (resultCode && !successCodes.includes(resultCode) && !isNoData) {
      return NextResponse.json({
        header: { resultCode: String(resultCode), resultMsg: resultMsg || 'API Error' },
        body: {
          items: [],
          totalCount: 0,
          error: resultMsg,
          params: { lawdCd, dealYmd, buildingType, contractType }
        }
      }, { status: 400 })
    }

    // NO_DATA 처리
    if (isNoData) {
      return NextResponse.json({
        header: { resultCode: '000', resultMsg: 'NO_DATA' },
        body: {
          items: [],
          totalCount: 0,
          message: `${buildingTypeKr} ${contractTypeKr} - 해당 기간에 거래 내역이 없습니다.`,
          params: { lawdCd, dealYmd, buildingType, contractType },
          executionTimeMs: Date.now() - startTime
        }
      })
    }

    // rows 추출
    const rows = xml?.response?.body?.items?.item ?? []
    const list = Array.isArray(rows) ? rows : (rows ? [rows] : [])

    // 데이터 정규화
    const normalized = list.map((r: any) => {
      const baseFields = {
        // 공통 필드
        buildingName: getBuildingName(r, buildingType),
        dong: getDong(r),
        jibun: S(r.지번 ?? r.jibun),
        exclusiveArea: getExclusiveArea(r),
        floor: N(r.층 ?? r.floor),
        buildYear: N(r.건축년도 ?? r.buildYear),
        dealYear: N(r.년 ?? r.dealYear),
        dealMonth: N(r.월 ?? r.dealMonth),
        dealDay: N(r.일 ?? r.dealDay),
        sggCd: S(r.지역코드 ?? r.sggCd),
        // 메타 정보
        buildingType,
        contractType,
        buildingTypeKr,
        contractTypeKr,
      }

      if (contractType === 'trade') {
        // 매매
        return {
          ...baseFields,
          dealAmount: getDealAmount(r),
          cancelDealType: S(r.해제여부 ?? r.cancelDealType ?? r.cdealType),
          cancelDealDate: S(r.해제사유발생일 ?? r.cancelDealDate ?? r.cdealDay),
          dealingGbn: S(r.dealingGbn ?? r.거래유형 ?? r.거래구분 ?? r.중개구분),
          estateAgentSggNm: S(r.estateAgentSggNm ?? r.중개사소재지),
          rgstDate: S(r.rgstDate ?? r.등기일자),
        }
      } else {
        // 전월세
        return {
          ...baseFields,
          deposit: getDeposit(r),
          monthlyRent: getMonthlyRent(r),
          contractTerm: S(r.계약기간 ?? r.contractTerm),
          contractGbn: S(r.계약구분 ?? r.contractType ?? r.contractGbn),
          useRRRight: S(r.갱신요구권사용 ?? r.useRRRight),
          preDeposit: N(r.종전계약보증금 ?? r.preDeposit),
          preMonthlyRent: N(r.종전계약월세 ?? r.preMonthlyRent),
        }
      }
    })

    const executionTimeMs = Date.now() - startTime
    console.log(`[realestate/trade] ${buildingTypeKr} ${contractTypeKr} 완료: ${list.length}건, ${executionTimeMs}ms`)

    // FastAPI 형식 응답
    return NextResponse.json({
      header: { resultCode: '000', resultMsg: 'OK' },
      body: {
        items: normalized,
        totalCount: list.length,
        params: { lawdCd, dealYmd, buildingType, contractType },
        buildingTypeKr,
        contractTypeKr,
        executionTimeMs
      }
    })

  } catch (err: any) {
    console.error('[realestate/trade] 에러:', err)
    return NextResponse.json({
      header: { resultCode: '500', resultMsg: 'Internal Server Error' },
      body: {
        items: [],
        totalCount: 0,
        error: err?.message ?? String(err),
        executionTimeMs: Date.now() - startTime
      }
    }, { status: 500 })
  }
}
