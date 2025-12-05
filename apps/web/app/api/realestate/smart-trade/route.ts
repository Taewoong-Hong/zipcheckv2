/**
 * 스마트 실거래가 조회 API
 *
 * 동적 기간 확대 + 필터링을 서버에서 처리하여 단일 API 호출로 완결
 *
 * 로직:
 * 1. 3개월 조회 → 필터링 결과 < minCount → 6개월 확대
 * 2. 6개월 조회 → 필터링 결과 < minCount → 12개월 확대
 * 3. 필터링 기준: 동(umdNm) + 지번(jibun) + 전용면적(±areaTolerance㎡)
 *
 * 응답:
 * - items: 필터링된 거래 목록
 * - queryPeriod: 실제 조회된 기간 (예: "6개월")
 * - totalCount: 전체 거래 건수 (필터링 전)
 * - filteredCount: 필터링된 거래 건수
 * - averagePrice: 평균 거래금액 (만원)
 */
import { NextRequest, NextResponse } from 'next/server'
import { XMLParser } from 'fast-xml-parser'

export const runtime = 'nodejs'

// 국토교통부 실거래가 API
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

// 이전 월 계산 (YYYYMM 형식)
function getPreviousMonth(year: number, month: number, monthsBack: number): string {
  const date = new Date(year, month - 1 - monthsBack, 1)
  return `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}`
}

// 단일 월 실거래가 조회
async function fetchMonthData(
  serviceKey: string,
  lawdCd: string,
  dealYmd: string
): Promise<any[]> {
  for (const [version, baseUrl] of Object.entries(API_URLS)) {
    const qs = new URLSearchParams({
      serviceKey,
      LAWD_CD: String(lawdCd),
      DEAL_YMD: String(dealYmd),
      pageNo: '1',
      numOfRows: '1000'
    }).toString()

    const url = `${baseUrl}?${qs}`

    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 10000)

      const res = await fetch(url, {
        cache: 'no-store',
        signal: controller.signal
      })

      clearTimeout(timeoutId)

      if (!res.ok && res.status === 404) continue

      const text = (await res.text()).replace(/^\uFEFF/, '')

      if (!res.ok) continue

      // XML 파싱
      const parser = new XMLParser({ ignoreAttributes: false, trimValues: true })
      const xml = parser.parse(text)

      // 결과 코드 확인
      const resultCode = xml?.response?.header?.resultCode
      const successCodes = ['00', '0000', 'INFO-000', '03', 'INFO-003']

      if (resultCode && !successCodes.includes(resultCode)) {
        continue
      }

      // NO_DATA 처리
      if (resultCode === '03' || resultCode === 'INFO-003') {
        return []
      }

      // rows 추출
      const rows = xml?.response?.body?.items?.item ?? []
      const items = Array.isArray(rows) ? rows : (rows ? [rows] : [])

      // 디버그: 첫 번째 원본 아이템 필드명 확인
      if (items.length > 0) {
        console.log('[smart-trade] DEBUG RAW FIELDS:', Object.keys(items[0]))
        console.log('[smart-trade] DEBUG RAW ITEM (FULL):', JSON.stringify(items[0], null, 2))
        // 동 관련 필드 상세 확인
        const raw = items[0]
        console.log('[smart-trade] DEBUG DONG FIELDS:', {
          umdNm: raw.umdNm,
          dong: raw.dong,
          emdNm: raw.emdNm,
          '법정동': raw['법정동'],
          '읍면동': raw['읍면동'],
          sggCd: raw.sggCd,
        })
        // 지번 관련 모든 가능한 필드명 확인 (본번, 부번 포함)
        console.log('[smart-trade] DEBUG JIBUN FIELDS (ALL POSSIBLE):', {
          '지번': raw['지번'],
          jibun: raw.jibun,
          '본번': raw['본번'],
          '부번': raw['부번'],
          bonbeon: raw.bonbeon,
          bubeon: raw.bubeon,
          landCd: raw.landCd,
          // 국토부 API 공식 필드명 (2024년 스펙)
          lnbrMnnm: raw.lnbrMnnm,  // 지번 본번
          lnbrSlno: raw.lnbrSlno,  // 지번 부번
          // 숫자 필드들 모두 확인 (jibun이 다른 필드일 수 있음)
          aptSeq: raw.aptSeq,
          sggCd: raw.sggCd,
          dealDay: raw.dealDay,
        })
        console.log('[smart-trade] DEBUG AREA FIELDS:', {
          excluUseAr: raw.excluUseAr,
          '전용면적': raw['전용면적'],
          exclusiveArea: raw.exclusiveArea,
        })
        // 모든 필드와 값 출력 (10개 아이템 샘플)
        console.log('[smart-trade] DEBUG ALL FIELDS SAMPLE (3 items):')
        items.slice(0, 3).forEach((item: any, idx: number) => {
          console.log(`[smart-trade] Item ${idx}:`, JSON.stringify(item))
        })
      }

      return items

    } catch (error: any) {
      console.warn(`[smart-trade] ${version} API 오류 (${dealYmd}):`, error.message)
      continue
    }
  }

  return []
}

// 데이터 정규화
// NOTE: || 연산자 사용 - 빈 문자열("")도 falsy로 처리하여 다음 fallback으로 넘어감
function normalizeItem(r: any) {
  return {
    dealAmount: N(r.거래금액 || r.dealAmount),
    dealYear: N(r.년 || r.dealYear),
    dealMonth: N(r.월 || r.dealMonth),
    dealDay: N(r.일 || r.dealDay),
    aptName: S(r.aptNm || r.aptName || r.아파트 || r.아파트명 || r.단지명 || ''),
    // 국토부 API는 umdNm 필드 사용 - 우선순위 조정
    dong: S(r.umdNm || r.dong || r.emdNm || r.법정동 || r.읍면동 || ''),
    // 국토부 API 필드명: lnbrMnnm (지번 본번), lnbrSlno (지번 부번) - lnbrMnnm 우선
    jibun: S(r.lnbrMnnm || r.지번 || r.jibun || ''),
    exclusiveArea: N(r.excluUseAr || r.전용면적 || r.exclusiveArea),
    floor: N(r.층 || r.floor),
    buildYear: N(r.건축년도 || r.buildYear),
    cancelDealType: S(r.해제여부 || r.cancelDealType || r.cdealType),
    cancelDealDate: S(r.해제사유발생일 || r.cancelDealDate || r.cdealDay),
    sggCd: S(r.지역코드 || r.sggCd),
    dealingGbn: S(r.dealingGbn || r.거래유형 || r.거래구분 || r.중개구분),
    estateAgentSggNm: S(r.estateAgentSggNm || r.중개사소재지),
    rgstDate: S(r.rgstDate || r.등기일자),
  }
}

// 필터링 함수
function filterTransactions(
  items: any[],
  targetDong: string | null,
  targetJibun: string | null,
  targetArea: number | null,
  areaTolerance: number
): any[] {
  if (!targetDong && !targetJibun && !targetArea) {
    return items // 필터링 기준 없으면 전체 반환
  }

  return items.filter(item => {
    // 동 매칭
    if (targetDong) {
      const itemDong = S(item.dong).replace(/[동읍면리가]$/, '')
      const cleanTargetDong = targetDong.replace(/[동읍면리가]$/, '')
      if (itemDong !== cleanTargetDong) return false
    }

    // 지번 매칭 (본번만 비교)
    if (targetJibun) {
      const itemJibun = S(item.jibun)
      const itemJibunMatch = itemJibun.match(/^(\d+)/)
      const targetJibunMatch = targetJibun.match(/^(\d+)/)

      if (!itemJibunMatch || !targetJibunMatch) return false
      if (itemJibunMatch[1] !== targetJibunMatch[1]) return false
    }

    // 전용면적 매칭 (±tolerance㎡)
    if (targetArea !== null) {
      const itemArea = item.exclusiveArea
      if (itemArea === null) return false
      if (Math.abs(itemArea - targetArea) > areaTolerance) return false
    }

    return true
  })
}

export async function POST(req: NextRequest) {
  console.log('[smart-trade] POST 요청 시작')

  try {
    const body = await req.json()
    const {
      lawdCd,
      dong = null,
      jibun = null,
      area = null,
      minCount = 3,
      maxMonths = 12,
      areaTolerance = 0.5
    } = body

    console.log('[smart-trade] params:', { lawdCd, dong, jibun, area, minCount, maxMonths })

    // 파라미터 검증
    if (!lawdCd || String(lawdCd).length !== 5) {
      return NextResponse.json({
        header: { resultCode: '400', resultMsg: 'Bad Request' },
        body: {
          items: [],
          totalCount: 0,
          filteredCount: 0,
          queryPeriod: '0개월',
          error: 'Invalid lawdCd (must be 5 digits)'
        }
      }, { status: 400 })
    }

    const serviceKey = process.env.DATA_GO_KR_API_KEY
    if (!serviceKey) {
      return NextResponse.json({
        header: { resultCode: '500', resultMsg: 'Internal Server Error' },
        body: {
          items: [],
          totalCount: 0,
          filteredCount: 0,
          queryPeriod: '0개월',
          error: 'API 키가 설정되지 않았습니다.'
        }
      }, { status: 500 })
    }

    const now = new Date()
    const year = now.getFullYear()
    const month = now.getMonth() + 1

    // 기간 확대 단계: 3개월 → 6개월 → 12개월
    const periodSteps = [3, 6, Math.min(maxMonths, 12)]

    let allRawItems: any[] = []
    let queriedMonths = 0
    let filteredItems: any[] = []
    let queryPeriod = '3개월'

    for (const targetMonths of periodSteps) {
      // 이전 단계에서 이미 조회한 월 이후부터 추가 조회
      for (let i = queriedMonths; i < targetMonths; i++) {
        const dealYmd = getPreviousMonth(year, month, i)
        console.log(`[smart-trade] 조회: ${dealYmd} (${i + 1}/${targetMonths}개월)`)

        const monthData = await fetchMonthData(serviceKey, lawdCd, dealYmd)

        // 정규화하여 추가
        const normalizedData = monthData.map(normalizeItem)
        allRawItems.push(...normalizedData)
      }

      queriedMonths = targetMonths
      queryPeriod = `${targetMonths}개월`

      // 디버그: 첫 번째 아이템의 실제 필드 값 확인 (정규화 후)
      if (allRawItems.length > 0 && targetMonths === 3) {
        const sample = allRawItems[0]
        console.log('[smart-trade] DEBUG NORMALIZED SAMPLE:', JSON.stringify(sample))
        console.log('[smart-trade] DEBUG FILTER CRITERIA:', { targetDong: dong, targetJibun: jibun, targetArea: area })

        // 지번 773이 있는 아이템 찾기
        if (jibun) {
          const targetMain = jibun.match(/^(\d+)/)?.[1]
          const matchingJibunItems = allRawItems.filter(item => {
            const itemJibun = String(item.jibun || '')
            const itemMain = itemJibun.match(/^(\d+)/)?.[1]
            return itemMain === targetMain
          })
          console.log(`[smart-trade] DEBUG JIBUN SEARCH: 지번 ${targetMain} 검색 결과 ${matchingJibunItems.length}건`)
          if (matchingJibunItems.length > 0) {
            console.log('[smart-trade] DEBUG JIBUN MATCH SAMPLE:', JSON.stringify(matchingJibunItems[0]))
          }

          // 전체 유니크 지번 목록 (처음 20개만)
          const uniqueJibuns = [...new Set(allRawItems.map(item => String(item.jibun || '').match(/^(\d+)/)?.[1]).filter(Boolean))]
          console.log('[smart-trade] DEBUG UNIQUE JIBUNS (first 20):', uniqueJibuns.slice(0, 20))
        }

        // 수동 필터링 테스트
        if (dong) {
          const itemDong = String(sample.dong || '').trim()
          const cleanItemDong = itemDong.replace(/[동읍면리가]$/, '')
          const cleanTargetDong = dong.replace(/[동읍면리가]$/, '')
          console.log('[smart-trade] DEBUG DONG COMPARE:', { itemDong, cleanItemDong, cleanTargetDong, match: cleanItemDong === cleanTargetDong })
        }
        if (jibun) {
          const itemJibun = String(sample.jibun || '').trim()
          const itemJibunMatch = itemJibun.match(/^(\d+)/)
          const targetJibunMatch = jibun.match(/^(\d+)/)
          console.log('[smart-trade] DEBUG JIBUN COMPARE:', {
            itemJibun,
            targetJibun: jibun,
            itemMain: itemJibunMatch ? itemJibunMatch[1] : null,
            targetMain: targetJibunMatch ? targetJibunMatch[1] : null,
          })
        }
        if (area) {
          console.log('[smart-trade] DEBUG AREA COMPARE:', {
            itemArea: sample.exclusiveArea,
            targetArea: area,
            diff: sample.exclusiveArea ? Math.abs(sample.exclusiveArea - area) : 'N/A'
          })
        }
      }

      // 필터링 수행
      filteredItems = filterTransactions(
        allRawItems,
        dong,
        jibun,
        area,
        areaTolerance
      )

      console.log(`[smart-trade] ${queryPeriod} 결과: 전체 ${allRawItems.length}건, 필터링 ${filteredItems.length}건`)

      // 충분한 데이터가 있으면 종료
      if (filteredItems.length >= minCount) {
        console.log(`[smart-trade] 충분한 데이터 확보 (${filteredItems.length} >= ${minCount})`)
        break
      }

      // 다음 단계로 확대 필요 여부 로깅
      if (targetMonths < periodSteps[periodSteps.length - 1]) {
        console.log(`[smart-trade] 데이터 부족 (${filteredItems.length} < ${minCount}), 기간 확대 필요`)
      }
    }

    // 평균 거래금액 계산
    const validAmounts = filteredItems
      .map(item => item.dealAmount)
      .filter((amount): amount is number => amount !== null && amount > 0)

    const averagePrice = validAmounts.length > 0
      ? Math.round(validAmounts.reduce((a, b) => a + b, 0) / validAmounts.length)
      : null

    // 응답
    return NextResponse.json({
      header: { resultCode: '000', resultMsg: 'OK' },
      body: {
        items: filteredItems,
        totalCount: allRawItems.length,
        filteredCount: filteredItems.length,
        queryPeriod,
        averagePrice,
        filterCriteria: {
          dong: dong || null,
          jibun: jibun || null,
          area: area || null,
          areaTolerance
        },
        params: { lawdCd, minCount, maxMonths }
      }
    })

  } catch (err: any) {
    console.error('[smart-trade] 오류:', err)
    return NextResponse.json({
      header: { resultCode: '500', resultMsg: 'Internal Server Error' },
      body: {
        items: [],
        totalCount: 0,
        filteredCount: 0,
        queryPeriod: '0개월',
        error: err?.message ?? String(err)
      }
    }, { status: 500 })
  }
}
