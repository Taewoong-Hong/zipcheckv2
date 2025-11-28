import { NextRequest, NextResponse } from 'next/server'

// API URLs
const LEGAL_DONG_API_URL = 'http://apis.data.go.kr/1741000/StanReginCd/getStanReginCdList'
const APT_TRADE_API_URL = 'https://apis.data.go.kr/1613000/RTMSDataSvcAptTrade'

// 법정동코드 조회
async function fetchLegalDongCode(address: string, serviceKey: string) {
  // URLSearchParams를 사용한 안전한 쿼리스트링 생성
  const params = new URLSearchParams()
  params.set('serviceKey', serviceKey)
  params.set('pageNo', '1')
  params.set('numOfRows', '10')
  params.set('_type', 'json')
  params.set('locatadd_nm', address)

  // 공백을 %20으로 변경
  const queryString = params.toString().replace(/\+/g, '%20')
  const apiUrl = `${LEGAL_DONG_API_URL}?${queryString}`

  try {
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    })
    const data = await response.text()
    
    console.log('법정동코드 API 응답:', data.substring(0, 500)) // 응답 일부 로그
    
    let jsonData
    
    // JSON 파싱 시도
    try {
      jsonData = JSON.parse(data)
    } catch (parseError) {
      console.log('JSON 파싱 실패, XML로 시도합니다.')
      
      // XML 응답 처리
      const getValue = (data: string, tag: string) => {
        const match = data.match(new RegExp(`<${tag}>([\\s\\S]*?)<\/${tag}>`))
        return match ? match[1].trim() : ''
      }
      
      const resultCode = getValue(data, 'resultCode')
      const resultMsg = getValue(data, 'resultMsg')
      
      if (resultCode && resultCode !== 'INFO-0') {
        return { success: false, error: `API 오류: ${resultMsg} (코드: ${resultCode})` }
      }
      
      // XML에서 첫 번째 row 찾기
      const firstRow = data.match(/<row>[\s\S]*?<\/row>/)?.[0]
      if (firstRow) {
        const regionCd = getValue(firstRow, 'region_cd')
        const sidoCd = getValue(firstRow, 'sido_cd')
        const sggCd = getValue(firstRow, 'sgg_cd')
        const locataddNm = getValue(firstRow, 'locatadd_nm')
        
        if (regionCd && sidoCd && sggCd) {
          return {
            success: true,
            regionCd: regionCd,
            lawdCd: (sidoCd + sggCd).substring(0, 5),
            address: locataddNm
          }
        }
      }
      
      return { success: false, error: 'API 응답 파싱 오류' }
    }

    const head = jsonData.StanReginCd?.head?.[0] || jsonData.StanReginCd?.[0]?.head || {}
    const result = head.RESULT || jsonData.StanReginCd?.head?.[1]?.RESULT || {}
    const rows = jsonData.StanReginCd?.row || jsonData.StanReginCd?.[1]?.row || []

    if ((result.resultCode === 'INFO-0' || result.CODE === 'INFO-000') && rows.length > 0) {
      // 첫 번째 결과 사용
      const item = rows[0]
      return {
        success: true,
        regionCd: item.region_cd,
        lawdCd: (item.sido_cd + item.sgg_cd).substring(0, 5), // 5자리 법정동코드
        address: item.locatadd_nm
      }
    }
    
    return { success: false, error: '주소를 찾을 수 없습니다.' }
  } catch (error) {
    console.error('법정동코드 조회 오류:', error)
    return { success: false, error: '법정동코드 조회 중 오류가 발생했습니다.' }
  }
}

// 아파트 실거래가 조회
async function fetchAptTrades(lawdCd: string, dealYmd: string, serviceKey: string) {
  // URLSearchParams를 사용한 안전한 쿼리스트링 생성
  const params = new URLSearchParams()
  params.set('serviceKey', serviceKey)
  params.set('LAWD_CD', lawdCd)
  params.set('DEAL_YMD', dealYmd)
  params.set('pageNo', '1')
  params.set('numOfRows', '1000')
  params.set('_type', 'xml')

  // 공백을 %20으로 변경
  const queryString = params.toString().replace(/\+/g, '%20')
  const apiUrl = `${APT_TRADE_API_URL}?${queryString}`

  try {
    const response = await fetch(apiUrl)
    const xmlText = await response.text()
    
    console.log('실거래가 API 응답:', xmlText.substring(0, 500)) // 응답 일부 로그

    // XML 파싱
    const resultCode = xmlText.match(/<resultCode>(.*?)<\/resultCode>/)?.[1] || ''
    const resultMsg = xmlText.match(/<resultMsg>(.*?)<\/resultMsg>/)?.[1] || ''
    
    if (resultCode !== '000') {
      return { success: false, error: `API 오류: ${resultMsg}` }
    }

    const totalCount = xmlText.match(/<totalCount>(\d+)<\/totalCount>/)?.[1] || '0'
    const items = xmlText.match(/<item>[\s\S]*?<\/item>/g) || []
    
    const parsedItems = items.map(item => {
      const getValue = (tag: string) => {
        const match = item.match(new RegExp(`<${tag}>([\\s\\S]*?)<\/${tag}>`))
        return match ? match[1].trim() : ''
      }

      return {
        aptName: getValue('aptNm'),
        dealAmount: getValue('dealAmount'),
        dealYear: getValue('dealYear'),
        dealMonth: getValue('dealMonth'),
        dealDay: getValue('dealDay'),
        exclusiveArea: getValue('excluUseAr'),
        floor: getValue('floor'),
        buildYear: getValue('buildYear'),
        dong: getValue('umdNm'),
        jibun: getValue('jibun'),
        sggCd: getValue('sggCd'),
        dealingGbn: getValue('dealingGbn'),
        aptDong: getValue('aptDong'),
        cancelDealType: getValue('cdealType'),
        cancelDealDate: getValue('cdealDay')
      }
    })

    return {
      success: true,
      totalCount: parseInt(totalCount),
      items: parsedItems
    }
  } catch (error) {
    console.error('실거래가 조회 오류:', error)
    return { success: false, error: '실거래가 조회 중 오류가 발생했습니다.' }
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { 
      address,        // 검색할 주소
      dealYear,       // 거래년도
      dealMonth,      // 거래월
      aptName,        // 특정 아파트명 (옵션)
      aptDong,        // 특정 동 (옵션)
      exclusiveArea,  // 전용면적 (옵션)
      includeNearby = false  // 인근 지역 포함 여부
    } = body

    if (!address) {
      return NextResponse.json({
        success: false,
        error: '주소는 필수입니다.'
      }, { status: 400 })
    }

    // 환경변수에서 API 키 가져오기
    const serviceKey = process.env.DATA_GO_KR_API_KEY
    if (!serviceKey) {
      return NextResponse.json({
        success: false,
        error: 'API 키가 설정되지 않았습니다.'
      }, { status: 500 })
    }

    // 1. 주소 → 법정동코드 변환
    console.log('주소 검색:', address)
    const dongResult = await fetchLegalDongCode(address, serviceKey)
    
    if (!dongResult.success) {
      return NextResponse.json({
        success: false,
        error: dongResult.error
      }, { status: 400 })
    }

    const lawdCd = dongResult.lawdCd!
    console.log('법정동코드:', lawdCd, '주소:', dongResult.address)

    // 2. 거래년월 설정
    const dealYmd = dealYear + dealMonth

    // 3. 실거래가 조회
    const tradeResult = await fetchAptTrades(lawdCd, dealYmd, serviceKey)
    
    if (!tradeResult.success) {
      return NextResponse.json({
        success: false,
        error: tradeResult.error
      }, { status: 400 })
    }

    // 4. 필터링
    let filteredItems = tradeResult.items || []

    // 아파트명 필터
    if (aptName) {
      filteredItems = filteredItems.filter(item => 
        item.aptName.includes(aptName)
      )
    }

    // 동 필터
    if (aptDong) {
      filteredItems = filteredItems.filter(item => 
        item.aptDong === aptDong
      )
    }

    // 전용면적 필터 (±2㎡ 범위)
    if (exclusiveArea) {
      const areaNum = parseFloat(exclusiveArea)
      filteredItems = filteredItems.filter(item => {
        const itemArea = parseFloat(item.exclusiveArea)
        return Math.abs(itemArea - areaNum) <= 2
      })
    }

    // 5. 결과 정리
    const aptGroups = filteredItems.reduce((acc: any, item) => {
      const key = item.aptName
      if (!acc[key]) {
        acc[key] = {
          aptName: item.aptName,
          buildYear: item.buildYear,
          trades: []
        }
      }
      acc[key].trades.push({
        dealDate: `${item.dealYear}-${item.dealMonth}-${item.dealDay}`,
        dealAmount: item.dealAmount,
        exclusiveArea: item.exclusiveArea,
        floor: item.floor,
        aptDong: item.aptDong,
        cancelDealType: item.cancelDealType
      })
      return acc
    }, {})

    // 거래가격 기준 정렬
    Object.values(aptGroups).forEach((group: any) => {
      group.trades.sort((a: any, b: any) => {
        const priceA = parseInt(a.dealAmount.replace(/,/g, ''))
        const priceB = parseInt(b.dealAmount.replace(/,/g, ''))
        return priceB - priceA
      })
    })

    return NextResponse.json({
      success: true,
      data: {
        searchAddress: dongResult.address,
        lawdCd: lawdCd,
        dealYmd: dealYmd,
        totalCount: tradeResult.totalCount,
        filteredCount: filteredItems.length,
        aptGroups: Object.values(aptGroups)
      }
    })

  } catch (error) {
    console.error('인근 아파트 실거래가 조회 오류:', error)
    return NextResponse.json({
      success: false,
      error: '조회 중 오류가 발생했습니다.',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}