/**
 * 도로명주소 검색 API (행정안전부 Juso API)
 *
 * 지번까지 상세 검색 가능
 * 응답 형식: { header: { resultCode, resultMsg }, body: { items, totalCount } }
 */
import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

const BASE_URL = 'https://www.juso.go.kr/addrlink/addrLinkApi.do'

export async function POST(request: NextRequest) {
  console.log('[juso] POST 요청 시작')

  try {
    const body = await request.json()
    console.log('[juso] body:', body)
    const { keyword, currentPage = 1, countPerPage = 20 } = body

    if (!keyword) {
      return NextResponse.json({
        header: { resultCode: '400', resultMsg: 'Bad Request' },
        body: { items: [], totalCount: 0, error: '검색어(keyword)는 필수입니다.' }
      }, { status: 400 })
    }

    const confmKey = process.env.JUSO_API_KEY
    console.log('[juso] confmKey exists:', !!confmKey)

    if (!confmKey) {
      return NextResponse.json({
        header: { resultCode: '500', resultMsg: 'Internal Server Error' },
        body: { items: [], totalCount: 0, error: 'JUSO_API_KEY가 설정되지 않았습니다.' }
      }, { status: 500 })
    }

    // Form data 구성
    const formData = new URLSearchParams()
    formData.set('confmKey', confmKey)
    formData.set('currentPage', String(currentPage))
    formData.set('countPerPage', String(countPerPage))
    formData.set('keyword', keyword)
    formData.set('resultType', 'json')

    console.log('[juso] fetch 시작')

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 15000)

    const response = await fetch(BASE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      body: formData.toString(),
      cache: 'no-store',
      signal: controller.signal
    })

    clearTimeout(timeoutId)
    console.log('[juso] response.status:', response.status)

    if (!response.ok) {
      const text = await response.text()
      console.error('[juso] response error:', text.slice(0, 500))
      return NextResponse.json({
        header: { resultCode: String(response.status), resultMsg: 'Upstream Error' },
        body: { items: [], totalCount: 0, error: text.slice(0, 200) }
      }, { status: response.status })
    }

    const data = await response.json()
    console.log('[juso] response data keys:', Object.keys(data))

    // Juso API 응답 구조: { results: { common: {...}, juso: [...] } }
    const results = data?.results || {}
    const common = results?.common || {}
    const jusoList = results?.juso || []

    const errorCode = common?.errorCode
    const errorMessage = common?.errorMessage
    const totalCount = parseInt(common?.totalCount || '0', 10)

    console.log('[juso] errorCode:', errorCode, 'totalCount:', totalCount)

    if (errorCode !== '0') {
      console.error('[juso] API 오류:', errorCode, errorMessage)
      return NextResponse.json({
        header: { resultCode: errorCode, resultMsg: errorMessage || 'API Error' },
        body: { items: [], totalCount: 0, error: errorMessage }
      }, { status: 200 }) // API 자체는 200이지만 데이터 오류
    }

    // 데이터 정규화
    const items = jusoList.map((item: any) => ({
      // 도로명주소
      roadAddr: item.roadAddr || '',          // 전체 도로명주소
      roadAddrPart1: item.roadAddrPart1 || '', // 도로명주소 (참고항목 제외)
      roadAddrPart2: item.roadAddrPart2 || '', // 도로명주소 참고항목

      // 지번주소
      jibunAddr: item.jibunAddr || '',        // 지번주소

      // 영문주소
      engAddr: item.engAddr || '',

      // 우편번호
      zipNo: item.zipNo || '',

      // 행정구역 코드
      admCd: item.admCd || '',                // 행정구역코드
      rnMgtSn: item.rnMgtSn || '',            // 도로명코드
      bdMgtSn: item.bdMgtSn || '',            // 건물관리번호

      // 상세 정보
      siNm: item.siNm || '',                  // 시도명
      sggNm: item.sggNm || '',                // 시군구명
      emdNm: item.emdNm || '',                // 읍면동명
      liNm: item.liNm || '',                  // 리명
      rn: item.rn || '',                      // 도로명

      // 지번
      lnbrMnnm: item.lnbrMnnm || '',          // 지번 본번
      lnbrSlno: item.lnbrSlno || '',          // 지번 부번

      // 건물정보
      bdNm: item.bdNm || '',                  // 건물명
      bdKdcd: item.bdKdcd || '',              // 건물종류코드 (0: 비주거, 1: 주거)
      buldMnnm: item.buldMnnm || '',          // 건물본번
      buldSlno: item.buldSlno || '',          // 건물부번

      // 공동주택 정보
      detBdNmList: item.detBdNmList || '',    // 상세건물명 (동/호)

      // 법정동코드 (5자리)
      lawd5: item.admCd ? item.admCd.slice(0, 5) : '',

      // 원본 데이터 유지
      _raw: item
    }))

    console.log('[juso] 정규화된 items 수:', items.length)

    return NextResponse.json({
      header: { resultCode: '000', resultMsg: 'OK' },
      body: {
        items,
        totalCount,
        currentPage: parseInt(common?.currentPage || '1', 10),
        countPerPage: parseInt(common?.countPerPage || '20', 10),
        params: { keyword }
      }
    })

  } catch (error) {
    console.error('[juso] 최종 catch error:', error)
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
