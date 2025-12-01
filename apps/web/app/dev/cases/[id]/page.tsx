'use client';

import { useEffect, useState } from 'react';
import { use } from 'react';
import { useRouter } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface ParsedRegistryResult {
  success: boolean;
  registry_doc_masked?: any;
  registry_data?: any;
  error?: string;
  execution_time_ms: number;
}

interface PublicDataResult {
  success: boolean;
  legal_dong_code?: string;
  property_value_estimate?: number;
  jeonse_market_average?: number;
  recent_transactions?: any[];
  errors?: string[];
  execution_time_ms: number;
}

interface SummaryResult {
  success: boolean;
  summary?: string;
  risk_score?: any;
  error?: string;
  execution_time_ms: number;
  used_llm: boolean;
  metadata?: {
    use_llm?: boolean;
    has_registry?: boolean;
    has_market_data?: boolean;
    jeonse_market_average?: number;
    property_value_estimate?: number;
    price_comparison?: {
      user_value?: number;
      market_average?: number;
      difference?: number;
      difference_percent?: number;
    };
    step2_property_value_estimate?: number;
    step2_jeonse_market_average?: number;
    user_contract_type?: string;
    user_deposit?: number;
    user_price?: number;
    user_monthly_rent?: number;
  };
}

// API Tester Types
interface APITestResult {
  success: boolean;
  api_name: string;
  api_name_kr: string;
  execution_time_ms: number;
  total_count: number;
  sample_data?: any[];
  error?: string;
  request_params: Record<string, any>;
}

interface AllAPITestResult {
  total_apis: number;
  success_count: number;
  fail_count: number;
  total_execution_time_ms: number;
  results: APITestResult[];
}

export default function DevCaseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const caseId = resolvedParams.id;
  const router = useRouter();

  const [case_data, setCaseData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Step results
  const [step1Result, setStep1Result] = useState<ParsedRegistryResult | null>(null);
  const [step2Result, setStep2Result] = useState<PublicDataResult | null>(null);
  const [step3Result, setStep3Result] = useState<SummaryResult | null>(null);

  // Loading states
  const [step1Loading, setStep1Loading] = useState(false);
  const [step2Loading, setStep2Loading] = useState(false);
  const [step3Loading, setStep3Loading] = useState(false);

  // API Tester state
  const [apiTestResult, setApiTestResult] = useState<AllAPITestResult | null>(null);
  const [apiTestLoading, setApiTestLoading] = useState(false);
  const [selectedApiResult, setSelectedApiResult] = useState<APITestResult | null>(null);

  // 법정동코드 검색 state
  const [legalDongKeyword, setLegalDongKeyword] = useState('');
  const [legalDongResults, setLegalDongResults] = useState<any[]>([]);
  const [legalDongLoading, setLegalDongLoading] = useState(false);
  const [selectedLegalDong, setSelectedLegalDong] = useState<any>(null);

  // 아파트 실거래가 조회 state
  const [aptTradeYear, setAptTradeYear] = useState(new Date().getFullYear());
  const [aptTradeMonth, setAptTradeMonth] = useState(new Date().getMonth() + 1);
  const [aptTradeResults, setAptTradeResults] = useState<any[]>([]);
  const [aptTradeLoading, setAptTradeLoading] = useState(false);
  const [jibunFilter, setJibunFilter] = useState<'none' | 'exact' | 'range100' | 'range200' | 'range300' | 'range400' | 'range500'>('none'); // 지번 필터 모드
  const [dongFilter, setDongFilter] = useState(false); // 동 필터 (파싱된 주소의 동과 일치하는 것만)
  const [areaFilter, setAreaFilter] = useState<'none' | 'exact' | 'range3' | 'range5' | 'range10'>('none'); // 전용면적 필터 모드

  // 자동 실거래가 조회 결과 (파싱된 주소 기반)
  const [autoTradeResult, setAutoTradeResult] = useState<{
    loading: boolean;
    error: string | null;
    lawdCd: string | null;           // 법정동코드 5자리
    lawdName: string | null;         // 법정동 이름
    totalCount: number;              // 전체 거래 수
    filteredCount: number;           // 필터링된 거래 수 (동+지번+면적)
    dongMatchCount: number;          // 동 일치 거래 수
    jibunMatchCount: number;         // 지번 일치 거래 수
    areaMatchCount: number;          // 면적 일치 거래 수
    dongJibunCount: number;          // 동+지번 일치 거래 수
    averagePrice: number | null;     // 필터링된 평균 거래가 (만원)
    minPrice: number | null;         // 최소 거래가
    maxPrice: number | null;         // 최대 거래가
    filteredTransactions: any[];     // 필터링된 거래 목록
  }>({
    loading: false,
    error: null,
    lawdCd: null,
    lawdName: null,
    totalCount: 0,
    filteredCount: 0,
    dongMatchCount: 0,
    jibunMatchCount: 0,
    areaMatchCount: 0,
    dongJibunCount: 0,
    averagePrice: null,
    minPrice: null,
    maxPrice: null,
    filteredTransactions: [],
  });

  // 파싱된 주소 정보 (지번 포함)
  const [parsedAddress, setParsedAddress] = useState<{
    full: string;           // 전체 주소
    addressUntilDong: string; // 동까지의 주소 (법정동 검색용)
    dong: string;           // 동/읍/면/리
    jibun: string;          // 지번 (예: 123-45)
    building: string;       // 건물명/호수
    area_m2: number | null; // 전용면적 (㎡)
  } | null>(null);

  const [useLLM, setUseLLM] = useState(false);

  // 계약 정보 입력 state
  const [contractType, setContractType] = useState<'전세' | '월세' | '매매'>('전세');
  const [depositAmount, setDepositAmount] = useState<string>(''); // 보증금 (만원)
  const [priceAmount, setPriceAmount] = useState<string>(''); // 매매가 (만원)
  const [monthlyRentAmount, setMonthlyRentAmount] = useState<string>(''); // 월세 (만원)

  // 건물 유형 state (Step 1 파싱 결과에서 자동 감지)
  const [buildingType, setBuildingType] = useState<'apt' | 'offi' | 'rh' | 'sh'>('apt');

  // Step 3 실거래가 조회 state
  const [step3TradeResult, setStep3TradeResult] = useState<{
    loading: boolean;
    error: string | null;
    items: any[];
    totalCount: number;
    buildingTypeKr: string;
    contractTypeKr: string;
    executionTimeMs: number;
  } | null>(null);

  // 주소에서 지번 추출하는 함수
  const parseAddressComponents = (address: string) => {
    if (!address) return null;

    // 동/읍/면/리/가 까지의 주소 추출 (법정동코드 검색용)
    // 예: "경기도 용인시 기흥구 신갈동 736 ..." → "경기도 용인시 기흥구 신갈동"
    const addressUntilDongMatch = address.match(/^(.+?(?:동|읍|면|리|가))(?:\s|$)/);
    const addressUntilDong = addressUntilDongMatch ? addressUntilDongMatch[1].trim() : address;

    // 지번 패턴: 숫자-숫자 또는 숫자 (동/리/가 뒤에 오는)
    const jibunMatch = address.match(/(?:동|읍|면|리|가)\s+(\d+(?:-\d+)?)/);
    const jibun = jibunMatch ? jibunMatch[1] : '';

    // 동/읍/면/리 추출 (마지막 것)
    const dongMatch = address.match(/([가-힣]+(?:동|읍|면|리|가))/g);
    const dong = dongMatch ? dongMatch[dongMatch.length - 1] : '';

    // 건물명/호수 추출 (지번 이후 부분)
    const buildingMatch = address.match(/\d+(?:-\d+)?\s+(.+)/);
    const building = buildingMatch ? buildingMatch[1] : '';

    return {
      full: address,
      addressUntilDong, // 동까지의 주소 (법정동 검색용)
      dong,
      jibun,
      building,
    };
  };

  useEffect(() => {
    loadCase();
  }, [caseId]);

  const loadCase = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/cases/${caseId}`);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      setCaseData(data.case);
    } catch (err: any) {
      console.error('Failed to load case:', err);
      setError(err.message || 'Failed to load case');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    const confirmed = window.confirm('이 케이스를 삭제하시겠습니까?');
    if (!confirmed) {
      return;
    }

    try {
      setDeleteError(null);
      setDeleting(true);

      const response = await fetch(`/api/cases/${caseId}?environment=dev`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        let message = `HTTP ${response.status}`;
        try {
          const data = await response.json();
          if (data?.error) {
            message = data.error;
          }
        } catch (_) {}
        throw new Error(message);
      }

      router.push('/dev/cases');
    } catch (err: any) {
      console.error('Delete case failed:', err);
      setDeleteError(err.message || 'Delete failed');
    } finally {
      setDeleting(false);
    }
  };

  const runStep1 = async () => {
    try {
      setStep1Loading(true);
      setStep1Result(null);

      const response = await fetch('/api/dev/parse-registry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ case_id: caseId }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      setStep1Result(data);
    } catch (err: any) {
      console.error('Step 1 failed:', err);
      setStep1Result({
        success: false,
        error: err.message,
        execution_time_ms: 0,
      });
    } finally {
      setStep1Loading(false);
    }
  };

  const runStep2 = async () => {
    try {
      setStep2Loading(true);
      setStep2Result(null);

      const response = await fetch('/api/dev/collect-public-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ case_id: caseId, force: false }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      setStep2Result(data);
    } catch (err: any) {
      console.error('Step 2 failed:', err);
      setStep2Result({
        success: false,
        errors: [err.message],
        execution_time_ms: 0,
      });
    } finally {
      setStep2Loading(false);
    }
  };

  const runAPITest = async () => {
    try {
      setApiTestLoading(true);
      setApiTestResult(null);
      setSelectedApiResult(null);

      // 케이스 ID를 전달하여 실제 주소 데이터로 API 테스트
      const response = await fetch(`/api/dev/api-tester?case_id=${caseId}`);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      setApiTestResult(data);
    } catch (err: any) {
      console.error('API Test failed:', err);
      setApiTestResult({
        total_apis: 15,
        success_count: 0,
        fail_count: 15,
        total_execution_time_ms: 0,
        results: [{
          success: false,
          api_name: 'AllAPIs',
          api_name_kr: 'API Test Error',
          execution_time_ms: 0,
          total_count: 0,
          error: err.message,
          request_params: {},
        }],
      });
    } finally {
      setApiTestLoading(false);
    }
  };

  // Step 3: 건물유형별 실거래가 조회 (매매 + 전세 모두 조회하여 전세가율 계산)
  const runStep3Trade = async () => {
    if (!selectedLegalDong?.lawd5) {
      alert('먼저 법정동코드를 선택해주세요.');
      return;
    }

    setStep3TradeResult({
      loading: true,
      error: null,
      items: [],
      totalCount: 0,
      buildingTypeKr: '',
      contractTypeKr: '',
      executionTimeMs: 0,
    });

    const startTime = Date.now();
    const lawdCd = selectedLegalDong.lawd5;
    const now = new Date();

    // 최근 3개월 조회 (YYYYMM 형식)
    const months = [];
    for (let i = 0; i < 3; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push(`${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}`);
    }

    try {
      // 매매 데이터와 전세 데이터 병렬 조회
      const [tradeResults, rentResults] = await Promise.all([
        // 매매 데이터 (3개월)
        Promise.all(months.map(async (dealYmd) => {
          const response = await fetch('/api/realestate/trade', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              lawdCd,
              dealYmd,
              buildingType,
              contractType: 'trade',
            }),
          });
          return response.json();
        })),
        // 전세 데이터 (3개월)
        Promise.all(months.map(async (dealYmd) => {
          const response = await fetch('/api/realestate/trade', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              lawdCd,
              dealYmd,
              buildingType,
              contractType: 'rent',
            }),
          });
          return response.json();
        })),
      ]);

      // 매매 데이터 취합
      const allTradeItems: any[] = [];
      for (const result of tradeResults) {
        if (result?.body?.items) {
          allTradeItems.push(...result.body.items);
        }
      }

      // 전세 데이터 취합
      const allRentItems: any[] = [];
      for (const result of rentResults) {
        if (result?.body?.items) {
          allRentItems.push(...result.body.items);
        }
      }

      // 평균 매매가 계산
      const tradeAmounts = allTradeItems
        .filter((item) => item.dealAmount)
        .map((item) => item.dealAmount);
      const avgTradePrice = tradeAmounts.length > 0
        ? Math.round(tradeAmounts.reduce((a, b) => a + b, 0) / tradeAmounts.length)
        : null;

      // 평균 전세가 계산 (전세 = deposit만 있고 monthlyRent가 없거나 0인 경우)
      const rentDeposits = allRentItems
        .filter((item) => item.deposit && (!item.monthlyRent || item.monthlyRent === 0))
        .map((item) => item.deposit);
      const avgRentDeposit = rentDeposits.length > 0
        ? Math.round(rentDeposits.reduce((a, b) => a + b, 0) / rentDeposits.length)
        : null;

      // 전세가율 계산
      const jeonseRatio = (avgTradePrice && avgRentDeposit)
        ? Math.round((avgRentDeposit / avgTradePrice) * 1000) / 10
        : null;

      const buildingTypeNames: Record<string, string> = {
        apt: '아파트',
        offi: '오피스텔',
        rh: '연립다세대',
        sh: '단독다가구',
      };

      setStep3TradeResult({
        loading: false,
        error: null,
        items: [
          ...allTradeItems.map((item) => ({ ...item, _dataType: 'trade' })),
          ...allRentItems.map((item) => ({ ...item, _dataType: 'rent' })),
        ],
        totalCount: allTradeItems.length + allRentItems.length,
        buildingTypeKr: buildingTypeNames[buildingType] || buildingType,
        contractTypeKr: '매매+전세',
        executionTimeMs: Date.now() - startTime,
        // 추가 통계
        tradeCount: allTradeItems.length,
        rentCount: allRentItems.length,
        avgTradePrice,
        avgRentDeposit,
        jeonseRatio,
      } as any);

      console.log('[Step 3 실거래가 조회 완료]', {
        buildingType,
        tradeCount: allTradeItems.length,
        rentCount: allRentItems.length,
        avgTradePrice,
        avgRentDeposit,
        jeonseRatio,
      });
    } catch (err: any) {
      console.error('Step 3 실거래가 조회 실패:', err);
      setStep3TradeResult({
        loading: false,
        error: err.message,
        items: [],
        totalCount: 0,
        buildingTypeKr: '',
        contractTypeKr: '',
        executionTimeMs: Date.now() - startTime,
      });
    }
  };

  // Step 4: 종합 분석 리포트 생성 (기존 Step 3)
  const runStep4 = async () => {
    try {
      setStep3Loading(true);
      setStep3Result(null);

      // Step 2 결과에서 실거래가 데이터 추출 (없으면 자동 조회 결과 사용)
      const propertyValueEstimate =
        step2Result?.property_value_estimate ||
        autoTradeResult?.averagePrice ||
        null;
      const jeonseMarketAverage =
        step2Result?.jeonse_market_average ||
        null;

      // 계약 정보 파싱
      const deposit = depositAmount ? parseInt(depositAmount, 10) : null;
      const price = priceAmount ? parseInt(priceAmount, 10) : null;
      const monthlyRent = monthlyRentAmount ? parseInt(monthlyRentAmount, 10) : null;

      const response = await fetch('/api/dev/prepare-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          case_id: caseId,
          use_llm: useLLM,
          // Step 2에서 수집한 실거래가 데이터 전달
          property_value_estimate: propertyValueEstimate,
          jeonse_market_average: jeonseMarketAverage,
          // 계약 정보 전달
          contract_type: contractType,
          deposit: deposit,         // 보증금 (전세/월세)
          price: price,             // 매매가 (매매)
          monthly_rent: monthlyRent, // 월세 (월세)
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      setStep3Result(data);
    } catch (err: any) {
      console.error('Step 3 failed:', err);
      setStep3Result({
        success: false,
        error: err.message,
        execution_time_ms: 0,
        used_llm: useLLM,
      });
    } finally {
      setStep3Loading(false);
    }
  };

  // 법정동코드 검색
  const searchLegalDong = async () => {
    if (!legalDongKeyword.trim()) {
      alert('검색어를 입력하세요.');
      return;
    }

    try {
      setLegalDongLoading(true);
      setLegalDongResults([]);
      setSelectedLegalDong(null);

      const response = await fetch('/api/realestate/legal-dong', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword: legalDongKeyword }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      // FastAPI 형식: { header: { resultCode, resultMsg }, body: { items, totalCount } }
      if (data.header?.resultCode === '000' && data.body?.items) {
        setLegalDongResults(data.body.items);
      } else {
        setLegalDongResults([]);
        if (data.body?.error) {
          console.warn('Legal dong error:', data.body.error);
        }
      }
    } catch (err: any) {
      console.error('Legal dong search failed:', err);
      alert(`검색 실패: ${err.message}`);
    } finally {
      setLegalDongLoading(false);
    }
  };

  // 아파트 실거래가 조회
  const searchAptTrade = async () => {
    if (!selectedLegalDong) {
      alert('먼저 법정동코드를 선택하세요.');
      return;
    }

    const lawdCd = selectedLegalDong.lawd5 || selectedLegalDong.regionCd?.slice(0, 5);
    if (!lawdCd || lawdCd.length !== 5) {
      alert('유효한 LAWD 코드가 없습니다.');
      return;
    }

    const dealYmd = `${aptTradeYear}${String(aptTradeMonth).padStart(2, '0')}`;

    try {
      setAptTradeLoading(true);
      setAptTradeResults([]);

      const response = await fetch('/api/realestate/apt-trade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lawdCd, dealYmd }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      // FastAPI 형식: { header: { resultCode, resultMsg }, body: { items, totalCount } }
      if (data.header?.resultCode === '000' && data.body?.items) {
        setAptTradeResults(data.body.items);
      } else {
        setAptTradeResults([]);
        if (data.body?.error || data.body?.message) {
          console.warn('Apt trade:', data.body.message || data.body.error);
        }
      }
    } catch (err: any) {
      console.error('Apt trade search failed:', err);
      alert(`조회 실패: ${err.message}`);
    } finally {
      setAptTradeLoading(false);
    }
  };

  // 케이스 주소로 법정동 검색 초기화 (동까지만)
  useEffect(() => {
    if (case_data?.property_address) {
      const parsed = parseAddressComponents(case_data.property_address);
      // 동까지만 잘라서 검색란에 입력
      setLegalDongKeyword(parsed?.addressUntilDong || case_data.property_address);
    }
  }, [case_data]);

  // 건물유형 한글 → API 코드 변환
  const detectBuildingTypeCode = (buildingTypeKr: string | undefined): 'apt' | 'offi' | 'rh' | 'sh' => {
    if (!buildingTypeKr) return 'apt';
    const normalized = buildingTypeKr.trim().toLowerCase();

    // 아파트
    if (normalized.includes('아파트') || normalized.includes('apt')) return 'apt';
    // 오피스텔
    if (normalized.includes('오피스텔') || normalized.includes('offi')) return 'offi';
    // 연립다세대 (연립, 다세대, 빌라)
    if (normalized.includes('연립') || normalized.includes('다세대') || normalized.includes('빌라')) return 'rh';
    // 단독다가구 (단독, 다가구)
    if (normalized.includes('단독') || normalized.includes('다가구')) return 'sh';

    // 기본값: 아파트
    return 'apt';
  };

  // PDF 파싱 결과 주소로 법정동 검색 업데이트 + 지번 추출 + 전용면적 추출 + 건물유형 감지
  useEffect(() => {
    if (step1Result?.success && step1Result.registry_doc_masked?.property_address) {
      const address = step1Result.registry_doc_masked.property_address;
      const area_m2 = step1Result.registry_doc_masked.area_m2 || null;

      // 주소에서 지번 추출
      const parsed = parseAddressComponents(address);
      setParsedAddress(parsed ? { ...parsed, area_m2 } : null);

      // 동까지만 잘라서 검색란에 입력
      setLegalDongKeyword(parsed?.addressUntilDong || address);

      // 건물유형 자동 감지 (Step 1 파싱 결과에서)
      const detectedType = detectBuildingTypeCode(step1Result.registry_doc_masked?.building_type);
      setBuildingType(detectedType);
      console.log('[건물유형 자동 감지]', step1Result.registry_doc_masked?.building_type, '→', detectedType);

      if (parsed?.jibun || area_m2) {
        console.log('[파싱 정보 추출]', { ...parsed, area_m2 });
      }
    }
  }, [step1Result]);

  // 자동 실거래가 조회 및 평균 계산 (parsedAddress가 있을 때)
  useEffect(() => {
    const fetchAutoTradeData = async () => {
      if (!parsedAddress?.addressUntilDong || !parsedAddress?.dong || !parsedAddress?.jibun) {
        return;
      }

      setAutoTradeResult(prev => ({ ...prev, loading: true, error: null }));

      try {
        // 1. 법정동코드 검색 (POST 메서드 사용)
        const legalDongRes = await fetch('/api/realestate/legal-dong', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ keyword: parsedAddress.addressUntilDong }),
        });
        const legalDongData = await legalDongRes.json();

        if (!legalDongData.body?.items?.length) {
          throw new Error('법정동코드를 찾을 수 없습니다');
        }

        const lawdCd = legalDongData.body.items[0].lawd5;
        const lawdName = legalDongData.body.items[0].locataddNm;

        // 2. 실거래가 조회 (최근 3개월)
        const now = new Date();
        const allTransactions: any[] = [];

        for (let i = 0; i < 3; i++) {
          const targetDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
          const dealYmd = `${targetDate.getFullYear()}${String(targetDate.getMonth() + 1).padStart(2, '0')}`;

          try {
            const aptTradeRes = await fetch('/api/realestate/apt-trade', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ lawdCd, dealYmd }),
            });
            const aptTradeData = await aptTradeRes.json();
            const items = aptTradeData.body?.items || [];
            allTransactions.push(...items);
            console.log(`[자동 조회] ${dealYmd}: ${items.length}건`);
          } catch (err) {
            console.warn(`[자동 조회] ${dealYmd} 실패:`, err);
          }
        }

        console.log(`[자동 조회] 최근 3개월 총: ${allTransactions.length}건`);

        // 3. 필터링 (동 + 지번 + 전용면적 정확히 일치)
        const targetDong = parsedAddress.dong.replace(/[동읍면리가]$/, '');
        const targetBonbun = parseInt(parsedAddress.jibun.split('-')[0], 10);
        const targetArea = parsedAddress.area_m2;

        const isDongMatch = (item: any) => {
          const itemDong = (item.umdNm || item.dong || '').toString().trim().replace(/[동읍면리가]$/, '');
          return itemDong === targetDong;
        };

        const isJibunMatch = (item: any) => {
          const itemJibun = item.jibun?.toString().trim();
          if (!itemJibun) return false;
          const itemBonbun = parseInt(itemJibun.split('-')[0], 10);
          return !isNaN(itemBonbun) && itemBonbun === targetBonbun;
        };

        const isAreaMatch = (item: any) => {
          if (!targetArea) return true; // 면적 정보가 없으면 필터링하지 않음
          const itemAreaStr = item.exclusiveArea || item.excluUseAr;
          if (!itemAreaStr) return false;
          const itemArea = parseFloat(itemAreaStr.toString().trim());
          if (isNaN(itemArea)) return false;
          // 전용면적 ±0.5㎡ 오차 허용
          return Math.abs(itemArea - targetArea) <= 0.5;
        };

        const dongMatchedItems = allTransactions.filter(isDongMatch);
        const jibunMatchedItems = allTransactions.filter(isJibunMatch);
        const areaMatchedItems = targetArea ? allTransactions.filter(isAreaMatch) : [];

        // 동 + 지번 일치 (기존 필터)
        const dongJibunFiltered = allTransactions.filter((item: any) => isDongMatch(item) && isJibunMatch(item));

        // 동 + 지번 + 전용면적 일치 (새 필터)
        const filteredItems = targetArea
          ? dongJibunFiltered.filter(isAreaMatch)
          : dongJibunFiltered;

        // 4. 평균/최소/최대 계산
        const prices = filteredItems
          .map((item: any) => item.dealAmount)
          .filter((p: any) => p && typeof p === 'number');

        let averagePrice = null;
        let minPrice = null;
        let maxPrice = null;

        if (prices.length > 0) {
          averagePrice = Math.round(prices.reduce((a: number, b: number) => a + b, 0) / prices.length);
          minPrice = Math.min(...prices);
          maxPrice = Math.max(...prices);
        }

        setAutoTradeResult({
          loading: false,
          error: null,
          lawdCd,
          lawdName,
          totalCount: allTransactions.length,
          filteredCount: filteredItems.length,
          dongMatchCount: dongMatchedItems.length,
          jibunMatchCount: jibunMatchedItems.length,
          areaMatchCount: areaMatchedItems.length,
          dongJibunCount: dongJibunFiltered.length,
          averagePrice,
          minPrice,
          maxPrice,
          filteredTransactions: filteredItems,
        });

        console.log('[자동 실거래가 조회]', {
          lawdCd,
          lawdName,
          total: allTransactions.length,
          dongMatch: dongMatchedItems.length,
          jibunMatch: jibunMatchedItems.length,
          areaMatch: areaMatchedItems.length,
          dongJibun: dongJibunFiltered.length,
          filtered: filteredItems.length,
          targetArea,
          averagePrice,
        });

      } catch (err: any) {
        console.error('[자동 실거래가 조회 실패]', err);
        setAutoTradeResult(prev => ({
          ...prev,
          loading: false,
          error: err.message || '조회 실패',
        }));
      }
    };

    fetchAutoTradeData();
  }, [parsedAddress]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-gray-600">Loading case...</div>
        </div>
      </div>
    );
  }

  if (error || !case_data) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800 font-medium">Error loading case</p>
            <p className="text-red-600 text-sm mt-1">{error || 'Case not found'}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <a
              href="/dev/cases"
              className="text-blue-600 hover:text-blue-800 text-sm font-medium"
            >
              ← 목록으로
            </a>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {deleting ? '삭제 중...' : '케이스 삭제'}
            </button>
          </div>
          {deleteError && (
            <div className="mb-4 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-800">
              {deleteError}
            </div>
          )}
          <h1 className="text-3xl font-bold mb-2">Analysis Lab: Case Detail</h1>
          <div className="flex items-center gap-4 text-sm text-gray-600">
            <div>
              <span className="font-medium">주소:</span> {case_data.property_address || 'N/A'}
            </div>
            <div>
              <span className="font-medium">계약:</span> {case_data.contract_type || 'N/A'}
            </div>
            <div>
              <span className="font-medium">상태:</span> <span className="font-mono">{case_data.current_state}</span>
            </div>
          </div>
        </div>

        {/* 3-Step Debugging Panel */}
        <div className="space-y-6">
          {/* Step 1: Parse Registry */}
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">Step 1: 등기부 파싱</h2>
                <p className="text-sm text-gray-600 mt-1">
                  등기부 PDF 파싱 (개인정보 마스킹 적용)
                </p>
              </div>
              <button
                onClick={runStep1}
                disabled={step1Loading}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {step1Loading ? 'Running...' : 'Run'}
              </button>
            </div>
            {step1Result && (
              <div className="px-6 py-4">
                {step1Result.success ? (
                  <div className="space-y-6">
                    <div className="flex items-center gap-2 mb-4">
                      <span className="text-green-600 font-medium">✓ Success</span>
                      <span className="text-gray-500 text-sm">
                        ({step1Result.execution_time_ms}ms)
                      </span>
                    </div>

                    {/* 기본 정보 카드 */}
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <h3 className="font-semibold text-blue-900 mb-3">📋 기본 정보</h3>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-gray-600">주소:</span>
                          <p className="font-medium">{step1Result.registry_doc_masked?.property_address || 'N/A'}</p>
                        </div>
                        <div>
                          <span className="text-gray-600">소유자:</span>
                          <p className="font-medium">{step1Result.registry_doc_masked?.owner?.name || 'N/A'}</p>
                        </div>
                        <div>
                          <span className="text-gray-600">건물 종류:</span>
                          <p className="font-medium">{step1Result.registry_doc_masked?.building_type || 'N/A'}</p>
                        </div>
                        <div>
                          <span className="text-gray-600">전용면적:</span>
                          <p className="font-medium">{step1Result.registry_doc_masked?.area_m2 ? `${step1Result.registry_doc_masked.area_m2}㎡` : 'N/A'}</p>
                        </div>
                      </div>
                    </div>

                    {/* 리스크 요약 카드 */}
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                      <h3 className="font-semibold text-amber-900 mb-3">⚠️ 리스크 요약</h3>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div className="text-center p-3 bg-white rounded-lg border">
                          <div className="text-2xl font-bold text-red-600">
                            {step1Result.registry_doc_masked?.mortgages?.filter((m: any) => !m.is_deleted).length || 0}
                          </div>
                          <div className="text-gray-600">유효 근저당</div>
                          <div className="text-xs text-gray-400">
                            (말소: {step1Result.registry_doc_masked?.mortgages?.filter((m: any) => m.is_deleted).length || 0}건)
                          </div>
                        </div>
                        <div className="text-center p-3 bg-white rounded-lg border">
                          <div className="text-2xl font-bold text-orange-600">
                            {step1Result.registry_doc_masked?.seizures?.filter((s: any) => !s.is_deleted).length || 0}
                          </div>
                          <div className="text-gray-600">유효 압류/가압류</div>
                          <div className="text-xs text-gray-400">
                            (말소: {step1Result.registry_doc_masked?.seizures?.filter((s: any) => s.is_deleted).length || 0}건)
                          </div>
                        </div>
                        <div className="text-center p-3 bg-white rounded-lg border">
                          <div className="text-2xl font-bold text-purple-600">
                            {step1Result.registry_doc_masked?.pledges?.filter((p: any) => !p.is_deleted).length || 0}
                          </div>
                          <div className="text-gray-600">유효 질권</div>
                          <div className="text-xs text-gray-400">
                            (말소: {step1Result.registry_doc_masked?.pledges?.filter((p: any) => p.is_deleted).length || 0}건)
                          </div>
                        </div>
                        <div className="text-center p-3 bg-white rounded-lg border">
                          <div className="text-2xl font-bold text-blue-600">
                            {step1Result.registry_doc_masked?.lease_rights?.filter((l: any) => !l.is_deleted).length || 0}
                          </div>
                          <div className="text-gray-600">유효 전세권</div>
                          <div className="text-xs text-gray-400">
                            (말소: {step1Result.registry_doc_masked?.lease_rights?.filter((l: any) => l.is_deleted).length || 0}건)
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* 근저당권 상세 테이블 */}
                    {step1Result.registry_doc_masked?.mortgages?.length > 0 && (
                      <div className="border rounded-lg overflow-hidden">
                        <div className="bg-gray-100 px-4 py-2 font-semibold text-gray-800">
                          🏦 근저당권 목록
                        </div>
                        <table className="w-full text-sm">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-4 py-2 text-left">상태</th>
                              <th className="px-4 py-2 text-left">채권자</th>
                              <th className="px-4 py-2 text-right">채권최고액</th>
                              <th className="px-4 py-2 text-left">채무자</th>
                            </tr>
                          </thead>
                          <tbody>
                            {step1Result.registry_doc_masked.mortgages.map((m: any, idx: number) => (
                              <tr key={idx} className={`border-t ${m.is_deleted ? 'bg-gray-100 text-gray-400' : ''}`}>
                                <td className="px-4 py-2">
                                  {m.is_deleted ? (
                                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-200 text-gray-600">
                                      ❌ 말소
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">
                                      ✅ 유효
                                    </span>
                                  )}
                                </td>
                                <td className={`px-4 py-2 ${m.is_deleted ? 'line-through' : ''}`}>{m.creditor || 'N/A'}</td>
                                <td className={`px-4 py-2 text-right ${m.is_deleted ? 'line-through' : ''}`}>
                                  {m.amount ? `${m.amount.toLocaleString()}만원` : 'N/A'}
                                </td>
                                <td className={`px-4 py-2 ${m.is_deleted ? 'line-through' : ''}`}>{m.debtor || 'N/A'}</td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot className="bg-gray-50 font-semibold">
                            <tr>
                              <td colSpan={2} className="px-4 py-2">유효 합계</td>
                              <td className="px-4 py-2 text-right text-red-600">
                                {step1Result.registry_doc_masked.mortgages
                                  .filter((m: any) => !m.is_deleted)
                                  .reduce((sum: number, m: any) => sum + (m.amount || 0), 0)
                                  .toLocaleString()}만원
                              </td>
                              <td></td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    )}

                    {/* 압류/가압류/가처분 테이블 */}
                    {step1Result.registry_doc_masked?.seizures?.length > 0 && (
                      <div className="border rounded-lg overflow-hidden">
                        <div className="bg-gray-100 px-4 py-2 font-semibold text-gray-800">
                          ⚡ 압류/가압류/가처분 목록
                        </div>
                        <table className="w-full text-sm">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-4 py-2 text-left">상태</th>
                              <th className="px-4 py-2 text-left">유형</th>
                              <th className="px-4 py-2 text-left">채권자</th>
                              <th className="px-4 py-2 text-right">채권액</th>
                            </tr>
                          </thead>
                          <tbody>
                            {step1Result.registry_doc_masked.seizures.map((s: any, idx: number) => (
                              <tr key={idx} className={`border-t ${s.is_deleted ? 'bg-gray-100 text-gray-400' : ''}`}>
                                <td className="px-4 py-2">
                                  {s.is_deleted ? (
                                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-200 text-gray-600">
                                      ❌ 말소
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-700">
                                      ✅ 유효
                                    </span>
                                  )}
                                </td>
                                <td className={`px-4 py-2 ${s.is_deleted ? 'line-through' : ''}`}>{s.type}</td>
                                <td className={`px-4 py-2 ${s.is_deleted ? 'line-through' : ''}`}>{s.creditor || 'N/A'}</td>
                                <td className={`px-4 py-2 text-right ${s.is_deleted ? 'line-through' : ''}`}>
                                  {s.amount ? `${s.amount.toLocaleString()}만원` : 'N/A'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {/* 전세권 테이블 */}
                    {step1Result.registry_doc_masked?.lease_rights?.length > 0 && (
                      <div className="border rounded-lg overflow-hidden">
                        <div className="bg-gray-100 px-4 py-2 font-semibold text-gray-800">
                          🏠 전세권 목록
                        </div>
                        <table className="w-full text-sm">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-4 py-2 text-left">상태</th>
                              <th className="px-4 py-2 text-left">전세권자</th>
                              <th className="px-4 py-2 text-right">전세금</th>
                              <th className="px-4 py-2 text-left">존속기간</th>
                            </tr>
                          </thead>
                          <tbody>
                            {step1Result.registry_doc_masked.lease_rights.map((l: any, idx: number) => (
                              <tr key={idx} className={`border-t ${l.is_deleted ? 'bg-gray-100 text-gray-400' : ''}`}>
                                <td className="px-4 py-2">
                                  {l.is_deleted ? (
                                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-200 text-gray-600">
                                      ❌ 말소
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                                      ✅ 유효
                                    </span>
                                  )}
                                </td>
                                <td className={`px-4 py-2 ${l.is_deleted ? 'line-through' : ''}`}>{l.lessee || 'N/A'}</td>
                                <td className={`px-4 py-2 text-right ${l.is_deleted ? 'line-through' : ''}`}>
                                  {l.amount ? `${l.amount.toLocaleString()}만원` : 'N/A'}
                                </td>
                                <td className={`px-4 py-2 ${l.is_deleted ? 'line-through' : ''}`}>
                                  {l.period_start && l.period_end ? `${l.period_start} ~ ${l.period_end}` : 'N/A'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {/* 원본 JSON 토글 */}
                    <details className="mt-4">
                      <summary className="cursor-pointer text-gray-500 text-sm hover:text-gray-700">
                        🔍 원본 JSON 보기 (디버깅용)
                      </summary>
                      <pre className="bg-gray-50 p-4 rounded text-xs overflow-auto max-h-96 mt-2">
                        {JSON.stringify(step1Result.registry_doc_masked, null, 2)}
                      </pre>
                    </details>
                  </div>
                ) : (
                  <div className="text-red-600">
                    <p className="font-medium">✗ Failed</p>
                    <p className="text-sm mt-1">{step1Result.error}</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Step 2: 계약 정보 입력 */}
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <div>
                <h2 className="text-lg font-semibold">Step 2: 계약 정보 입력</h2>
                <p className="text-sm text-gray-600 mt-1">
                  리스크 분석을 위한 계약 유형과 금액을 입력하세요
                </p>
              </div>
            </div>
            <div className="px-6 py-4 space-y-4">
              {/* 계약 유형 선택 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  계약 유형
                </label>
                <div className="flex gap-4">
                  {(['전세', '월세', '매매'] as const).map((type) => (
                    <label key={type} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="contractType"
                        value={type}
                        checked={contractType === type}
                        onChange={(e) => setContractType(e.target.value as '전세' | '월세' | '매매')}
                        className="w-4 h-4 text-blue-600"
                      />
                      <span className={`text-sm ${contractType === type ? 'font-semibold text-blue-600' : 'text-gray-700'}`}>
                        {type}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* 금액 입력 - 계약 유형별 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 전세/월세: 보증금 */}
                {(contractType === '전세' || contractType === '월세') && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      보증금 (만원)
                    </label>
                    <input
                      type="number"
                      value={depositAmount}
                      onChange={(e) => setDepositAmount(e.target.value)}
                      placeholder="예: 30000"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    {depositAmount && (
                      <p className="text-xs text-gray-500 mt-1">
                        = {(parseInt(depositAmount, 10) / 10000).toLocaleString()}억원
                      </p>
                    )}
                  </div>
                )}

                {/* 월세: 월세액 */}
                {contractType === '월세' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      월세 (만원)
                    </label>
                    <input
                      type="number"
                      value={monthlyRentAmount}
                      onChange={(e) => setMonthlyRentAmount(e.target.value)}
                      placeholder="예: 100"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                )}

                {/* 매매: 매매가 */}
                {contractType === '매매' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      매매가 (만원)
                    </label>
                    <input
                      type="number"
                      value={priceAmount}
                      onChange={(e) => setPriceAmount(e.target.value)}
                      placeholder="예: 80000"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    {priceAmount && (
                      <p className="text-xs text-gray-500 mt-1">
                        = {(parseInt(priceAmount, 10) / 10000).toLocaleString()}억원
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* 입력 요약 */}
              <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                <p className="text-sm font-medium text-blue-800">
                  📊 입력된 계약 정보:
                </p>
                <p className="text-sm text-blue-700 mt-1">
                  {contractType === '전세' && depositAmount && (
                    <>전세 계약 - 보증금 {parseInt(depositAmount, 10).toLocaleString()}만원</>
                  )}
                  {contractType === '월세' && depositAmount && (
                    <>월세 계약 - 보증금 {parseInt(depositAmount, 10).toLocaleString()}만원 / 월세 {monthlyRentAmount ? parseInt(monthlyRentAmount, 10).toLocaleString() : 0}만원</>
                  )}
                  {contractType === '매매' && priceAmount && (
                    <>매매 계약 - 매매가 {parseInt(priceAmount, 10).toLocaleString()}만원</>
                  )}
                  {!depositAmount && !priceAmount && (
                    <span className="text-gray-500">금액을 입력해주세요</span>
                  )}
                </p>
              </div>
            </div>
          </div>

          {/* Step 3: 공공 데이터 조회 (건물유형별 매매+전세 실거래가) */}
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">Step 3: 공공 데이터 조회</h2>
                <p className="text-sm text-gray-600 mt-1">
                  건물유형별 매매+전세 실거래가 3개월 평균 + 전세가율 계산
                </p>
              </div>
              <div className="flex items-center gap-4">
                {/* 건물 유형 선택 */}
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium text-gray-700">건물유형:</label>
                  <select
                    value={buildingType}
                    onChange={(e) => setBuildingType(e.target.value as 'apt' | 'offi' | 'rh' | 'sh')}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="apt">아파트</option>
                    <option value="offi">오피스텔</option>
                    <option value="rh">연립다세대</option>
                    <option value="sh">단독다가구</option>
                  </select>
                </div>
                <button
                  onClick={runStep3Trade}
                  disabled={step3TradeResult?.loading || !selectedLegalDong?.lawd5}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  {step3TradeResult?.loading ? '조회 중...' : '실거래가 조회'}
                </button>
              </div>
            </div>

            {/* Step 3 실거래가 결과 표시 */}
            {step3TradeResult && !step3TradeResult.loading && !step3TradeResult.error && (
              <div className="px-6 py-4 border-b border-gray-200 bg-green-50">
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-green-600 font-medium">✓ 조회 완료</span>
                  <span className="text-gray-500 text-sm">
                    ({step3TradeResult.executionTimeMs}ms, {step3TradeResult.buildingTypeKr})
                  </span>
                </div>

                {/* 핵심 지표 카드 */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-white p-4 rounded-lg border border-green-200 text-center">
                    <div className="text-2xl font-bold text-blue-600">
                      {(step3TradeResult as any).avgTradePrice
                        ? `${((step3TradeResult as any).avgTradePrice / 10000).toFixed(2)}억`
                        : 'N/A'}
                    </div>
                    <div className="text-sm text-gray-600">매매 평균가 (3개월)</div>
                    <div className="text-xs text-gray-400">
                      {(step3TradeResult as any).tradeCount || 0}건 분석
                    </div>
                  </div>

                  <div className="bg-white p-4 rounded-lg border border-green-200 text-center">
                    <div className="text-2xl font-bold text-purple-600">
                      {(step3TradeResult as any).avgRentDeposit
                        ? `${((step3TradeResult as any).avgRentDeposit / 10000).toFixed(2)}억`
                        : 'N/A'}
                    </div>
                    <div className="text-sm text-gray-600">전세 평균가 (3개월)</div>
                    <div className="text-xs text-gray-400">
                      {(step3TradeResult as any).rentCount || 0}건 분석
                    </div>
                  </div>

                  <div className="bg-white p-4 rounded-lg border border-green-200 text-center">
                    <div className={`text-2xl font-bold ${
                      (step3TradeResult as any).jeonseRatio >= 80 ? 'text-red-600' :
                      (step3TradeResult as any).jeonseRatio >= 70 ? 'text-orange-600' :
                      'text-green-600'
                    }`}>
                      {(step3TradeResult as any).jeonseRatio
                        ? `${(step3TradeResult as any).jeonseRatio}%`
                        : 'N/A'}
                    </div>
                    <div className="text-sm text-gray-600">전세가율</div>
                    <div className="text-xs text-gray-400">
                      {(step3TradeResult as any).jeonseRatio >= 80 ? '⚠️ 위험' :
                       (step3TradeResult as any).jeonseRatio >= 70 ? '⚡ 주의' :
                       '✅ 안전'}
                    </div>
                  </div>

                  <div className="bg-white p-4 rounded-lg border border-green-200 text-center">
                    <div className="text-2xl font-bold text-gray-600">
                      {step3TradeResult.totalCount}건
                    </div>
                    <div className="text-sm text-gray-600">총 거래 건수</div>
                    <div className="text-xs text-gray-400">
                      매매 {(step3TradeResult as any).tradeCount || 0} + 전세 {(step3TradeResult as any).rentCount || 0}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 에러 표시 */}
            {step3TradeResult?.error && (
              <div className="px-6 py-4 border-b border-gray-200 bg-red-50">
                <div className="text-red-600">
                  <p className="font-medium">✗ 조회 실패</p>
                  <p className="text-sm mt-1">{step3TradeResult.error}</p>
                </div>
              </div>
            )}

            {/* 법정동코드 미선택 안내 */}
            {!selectedLegalDong?.lawd5 && (
              <div className="px-6 py-4 border-b border-gray-200 bg-yellow-50">
                <p className="text-sm text-yellow-700">
                  ⚠️ 실거래가 조회를 위해 아래에서 법정동코드를 먼저 검색/선택해주세요.
                </p>
              </div>
            )}

            {/* 기존 공공데이터 수집 UI (법정동 검색 등) */}
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gray-50">
              <div>
                <h3 className="text-md font-semibold text-gray-700">법정동코드 + 상세 실거래가</h3>
                <p className="text-sm text-gray-500 mt-1">
                  법정동코드 검색 및 15개 API 테스트
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={runAPITest}
                  disabled={apiTestLoading}
                  className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-sm"
                >
                  {apiTestLoading ? 'Testing...' : 'Test 15 APIs'}
                </button>
                <button
                  onClick={runStep2}
                  disabled={step2Loading}
                  className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-sm"
                >
                  {step2Loading ? 'Running...' : 'Run (Legacy)'}
                </button>
              </div>
            </div>

            {/* API Tester Results */}
            {apiTestResult && (
              <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-gray-800">15개 공공데이터 API 테스트 결과</h3>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-green-600 font-medium">
                      ✓ 성공: {apiTestResult.success_count}
                    </span>
                    <span className="text-red-600 font-medium">
                      ✗ 실패: {apiTestResult.fail_count}
                    </span>
                    <span className="text-gray-500">
                      ({apiTestResult.total_execution_time_ms.toLocaleString()}ms)
                    </span>
                  </div>
                </div>

                {/* API Grid */}
                <div className="grid grid-cols-3 md:grid-cols-5 gap-2 mb-4">
                  {apiTestResult.results.map((result, idx) => (
                    <button
                      key={idx}
                      onClick={() => setSelectedApiResult(result)}
                      className={`p-3 rounded-lg border text-left transition-all ${
                        result.success
                          ? 'bg-green-50 border-green-200 hover:bg-green-100'
                          : 'bg-red-50 border-red-200 hover:bg-red-100'
                      } ${
                        selectedApiResult?.api_name === result.api_name
                          ? 'ring-2 ring-blue-500'
                          : ''
                      }`}
                    >
                      <div className="text-xs font-medium truncate">
                        {result.api_name_kr}
                      </div>
                      <div className="flex items-center justify-between mt-1">
                        <span className={`text-lg ${result.success ? 'text-green-600' : 'text-red-600'}`}>
                          {result.success ? '✓' : '✗'}
                        </span>
                        <span className="text-xs text-gray-500">
                          {result.total_count}건
                        </span>
                      </div>
                      <div className="text-xs text-gray-400 mt-1">
                        {result.execution_time_ms.toLocaleString()}ms
                      </div>
                    </button>
                  ))}
                </div>

                {/* Selected API Detail */}
                {selectedApiResult && (
                  <div className="mt-4 p-4 bg-white rounded-lg border">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-semibold">
                        {selectedApiResult.api_name_kr}
                        <span className="ml-2 text-sm font-mono text-gray-500">
                          ({selectedApiResult.api_name})
                        </span>
                      </h4>
                      <button
                        onClick={() => setSelectedApiResult(null)}
                        className="text-gray-400 hover:text-gray-600"
                      >
                        ✕
                      </button>
                    </div>

                    {/* Status */}
                    <div className="flex items-center gap-4 mb-3 text-sm">
                      <span className={selectedApiResult.success ? 'text-green-600' : 'text-red-600'}>
                        {selectedApiResult.success ? '✓ 성공' : '✗ 실패'}
                      </span>
                      <span className="text-gray-500">
                        조회 건수: {selectedApiResult.total_count}건
                      </span>
                      <span className="text-gray-500">
                        실행 시간: {selectedApiResult.execution_time_ms}ms
                      </span>
                    </div>

                    {/* Request Params */}
                    <div className="mb-3">
                      <div className="text-xs font-medium text-gray-600 mb-1">요청 파라미터:</div>
                      <div className="bg-gray-50 p-2 rounded text-xs font-mono">
                        {JSON.stringify(selectedApiResult.request_params, null, 2)}
                      </div>
                    </div>

                    {/* Error */}
                    {selectedApiResult.error && (
                      <div className="mb-3">
                        <div className="text-xs font-medium text-red-600 mb-1">에러:</div>
                        <div className="bg-red-50 p-2 rounded text-xs text-red-700">
                          {selectedApiResult.error}
                        </div>
                      </div>
                    )}

                    {/* Sample Data */}
                    {selectedApiResult.sample_data && selectedApiResult.sample_data.length > 0 && (
                      <div>
                        <div className="text-xs font-medium text-gray-600 mb-1">
                          샘플 데이터 ({selectedApiResult.sample_data.length}건):
                        </div>
                        <div className="bg-gray-50 p-2 rounded text-xs font-mono overflow-auto max-h-64">
                          <pre>{JSON.stringify(selectedApiResult.sample_data, null, 2)}</pre>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ===== 수동 검색 도구 섹션 ===== */}
            <div className="px-6 py-3 bg-gray-100 border-b border-gray-300">
              <h2 className="font-bold text-gray-700 text-lg flex items-center gap-2">
                🔍 수동 검색 도구
                <span className="text-sm font-normal text-gray-500">(직접 검색 및 필터링)</span>
              </h2>
            </div>

            {/* 법정동코드 검색 UI */}
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="font-semibold text-gray-800 mb-3">1. 법정동코드 검색</h3>
              <div className="flex gap-2 mb-4">
                <input
                  type="text"
                  value={legalDongKeyword}
                  onChange={(e) => setLegalDongKeyword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && searchLegalDong()}
                  placeholder="주소 검색 (예: 강남구 역삼동)"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={searchLegalDong}
                  disabled={legalDongLoading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  {legalDongLoading ? '검색 중...' : '검색'}
                </button>
              </div>

              {legalDongResults.length > 0 && (
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="px-3 py-2 text-left w-12">선택</th>
                        <th className="px-3 py-2 text-left">법정동코드</th>
                        <th className="px-3 py-2 text-left">LAWD코드(5자리)</th>
                        <th className="px-3 py-2 text-left">주소</th>
                        <th className="px-3 py-2 text-left">최하위지역명</th>
                      </tr>
                    </thead>
                    <tbody>
                      {legalDongResults.map((item, idx) => (
                        <tr
                          key={idx}
                          className={`border-t cursor-pointer hover:bg-blue-50 ${
                            selectedLegalDong?.regionCd === item.regionCd ? 'bg-blue-100' : ''
                          }`}
                          onClick={() => setSelectedLegalDong(item)}
                        >
                          <td className="px-3 py-2">
                            <input
                              type="radio"
                              name="legalDong"
                              checked={selectedLegalDong?.regionCd === item.regionCd}
                              onChange={() => setSelectedLegalDong(item)}
                              className="w-4 h-4 text-blue-600"
                            />
                          </td>
                          <td className="px-3 py-2 font-mono">{item.regionCd || 'N/A'}</td>
                          <td className="px-3 py-2 font-mono text-blue-600 font-semibold">{item.lawd5 || 'N/A'}</td>
                          <td className="px-3 py-2">{item.locataddNm || 'N/A'}</td>
                          <td className="px-3 py-2">{item.locatLowNm || 'N/A'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="bg-gray-50 px-3 py-2 text-sm text-gray-600">
                    총 {legalDongResults.length}개 결과
                    {selectedLegalDong && (
                      <span className="ml-4 text-blue-600 font-medium">
                        선택됨: {selectedLegalDong.locataddNm} ({selectedLegalDong.lawd5})
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* 아파트 실거래가 조회 UI */}
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="font-semibold text-gray-800 mb-3">2. 아파트 실거래가 조회</h3>

              {/* 파싱된 주소 정보 (지번 포함) */}
              {parsedAddress && (
                <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <div className="text-sm">
                    <span className="font-medium text-yellow-800">📍 파싱된 주소 정보</span>
                    <div className="mt-1 grid grid-cols-3 gap-2 text-yellow-700">
                      <div><span className="font-medium">동:</span> {parsedAddress.dong || '-'}</div>
                      <div><span className="font-medium">지번:</span> <span className="font-mono bg-yellow-100 px-1 rounded">{parsedAddress.jibun || '-'}</span></div>
                      <div><span className="font-medium">건물:</span> {parsedAddress.building || '-'}</div>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-4 mb-4">
                <div className="flex items-center gap-2">
                  <select
                    value={aptTradeYear}
                    onChange={(e) => setAptTradeYear(Number(e.target.value))}
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - i).map((year) => (
                      <option key={year} value={year}>{year}년</option>
                    ))}
                  </select>
                  <select
                    value={aptTradeMonth}
                    onChange={(e) => setAptTradeMonth(Number(e.target.value))}
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
                      <option key={month} value={month}>{month}월</option>
                    ))}
                  </select>
                </div>
                <button
                  onClick={searchAptTrade}
                  disabled={aptTradeLoading || !selectedLegalDong}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  {aptTradeLoading ? '조회 중...' : '실거래가 조회'}
                </button>
                {!selectedLegalDong && (
                  <span className="text-sm text-orange-600">
                    * 먼저 법정동코드를 선택하세요
                  </span>
                )}
                {/* 동 필터 체크박스 */}
                {parsedAddress?.dong && aptTradeResults.length > 0 && (
                  <label className="flex items-center gap-2 ml-4 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={dongFilter}
                      onChange={(e) => setDongFilter(e.target.checked)}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <span className="text-sm text-blue-700 font-medium">
                      동 필터 ({parsedAddress.dong})
                    </span>
                  </label>
                )}
                {/* 지번 필터 드롭다운 */}
                {parsedAddress?.jibun && aptTradeResults.length > 0 && (
                  <div className="flex items-center gap-2 ml-4">
                    <span className="text-sm text-orange-700 font-medium">
                      지번 필터 ({parsedAddress.jibun}):
                    </span>
                    <select
                      value={jibunFilter}
                      onChange={(e) => setJibunFilter(e.target.value as typeof jibunFilter)}
                      className="px-2 py-1 text-sm border border-orange-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    >
                      <option value="none">필터 없음</option>
                      <option value="exact">정확히 일치</option>
                      <option value="range100">±100 범위</option>
                      <option value="range200">±200 범위</option>
                      <option value="range300">±300 범위</option>
                      <option value="range400">±400 범위</option>
                      <option value="range500">±500 범위</option>
                    </select>
                  </div>
                )}
                {/* 전용면적 필터 드롭다운 */}
                {parsedAddress?.area_m2 && aptTradeResults.length > 0 && (
                  <div className="flex items-center gap-2 ml-4">
                    <span className="text-sm text-purple-700 font-medium">
                      전용면적 필터 ({parsedAddress.area_m2.toFixed(2)}㎡):
                    </span>
                    <select
                      value={areaFilter}
                      onChange={(e) => setAreaFilter(e.target.value as typeof areaFilter)}
                      className="px-2 py-1 text-sm border border-purple-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                    >
                      <option value="none">필터 없음</option>
                      <option value="exact">정확히 일치</option>
                      <option value="range3">±3㎡ 범위</option>
                      <option value="range5">±5㎡ 범위</option>
                      <option value="range10">±10㎡ 범위</option>
                    </select>
                  </div>
                )}
              </div>

              {aptTradeResults.length > 0 && (() => {
                // 지번에서 본번 추출 (예: 123-45 → 123)
                const getBonbun = (jibun: string | undefined): number | null => {
                  if (!jibun) return null;
                  const bonbun = jibun.toString().trim().split('-')[0];
                  const num = parseInt(bonbun, 10);
                  return isNaN(num) ? null : num;
                };

                // 전용면적 추출 (문자열 또는 숫자를 숫자로 변환)
                const getArea = (item: any): number | null => {
                  const areaStr = item.exclusiveArea || item.excluUseAr;
                  if (!areaStr) return null;
                  const num = parseFloat(areaStr.toString().trim());
                  return isNaN(num) ? null : num;
                };

                // 지번 필터 범위 추출 (예: 'range100' → 100, 'exact' → 0, 'none' → null)
                const getJibunFilterRange = (): number | null => {
                  if (jibunFilter === 'none') return null;
                  if (jibunFilter === 'exact') return 0;
                  const match = jibunFilter.match(/range(\d+)/);
                  return match ? parseInt(match[1], 10) : null;
                };

                // 전용면적 필터 범위 추출 (예: 'range3' → 3, 'exact' → 0, 'none' → null)
                const getAreaFilterRange = (): number | null => {
                  if (areaFilter === 'none') return null;
                  if (areaFilter === 'exact') return 0;
                  const match = areaFilter.match(/range(\d+)/);
                  return match ? parseInt(match[1], 10) : null;
                };

                const jibunFilterRange = getJibunFilterRange();
                const areaFilterRange = getAreaFilterRange();
                const targetBonbun = getBonbun(parsedAddress?.jibun);
                const targetDong = parsedAddress?.dong?.replace(/[동읍면리가]$/, ''); // "신갈동" → "신갈"
                const targetArea = parsedAddress?.area_m2;

                // 동 일치 여부 확인 함수
                const isDongMatch = (item: any) => {
                  if (!targetDong) return true;
                  const itemDong = (item.umdNm || item.dong || '').toString().trim().replace(/[동읍면리가]$/, '');
                  return itemDong === targetDong;
                };

                // 전용면적 일치 여부 확인 함수 (하이라이팅용 - 정확히 일치 ±0.5㎡)
                const isAreaMatch = (item: any) => {
                  if (!targetArea) return false;
                  const itemArea = getArea(item);
                  if (itemArea === null) return false;
                  return Math.abs(itemArea - targetArea) <= 0.5;
                };

                // 1단계: 동 필터 적용
                const dongFilteredResults = dongFilter && targetDong
                  ? aptTradeResults.filter(isDongMatch)
                  : aptTradeResults;

                // 2단계: 지번 필터 적용
                const jibunFilteredResults = jibunFilterRange !== null && targetBonbun !== null
                  ? dongFilteredResults.filter(item => {
                      const itemBonbun = getBonbun(item.jibun);
                      if (itemBonbun === null) return false;
                      if (jibunFilterRange === 0) {
                        // 정확히 일치
                        return itemBonbun === targetBonbun;
                      }
                      // 범위 필터 (±range)
                      return Math.abs(itemBonbun - targetBonbun) <= jibunFilterRange;
                    })
                  : dongFilteredResults;

                // 3단계: 전용면적 필터 적용
                const filteredResults = areaFilterRange !== null && targetArea !== null
                  ? jibunFilteredResults.filter(item => {
                      const itemArea = getArea(item);
                      if (itemArea === null) return false;
                      if (areaFilterRange === 0) {
                        // 정확히 일치 (±0.5㎡ 오차 허용)
                        return Math.abs(itemArea - targetArea) <= 0.5;
                      }
                      // 범위 필터 (±range㎡)
                      return Math.abs(itemArea - targetArea) <= areaFilterRange;
                    })
                  : jibunFilteredResults;

                // 지번 일치 여부 확인 함수 (하이라이팅용 - 정확히 일치만)
                const isJibunMatch = (item: any) => {
                  if (!parsedAddress?.jibun) return false;
                  const itemBonbun = getBonbun(item.jibun);
                  return itemBonbun === targetBonbun;
                };

                // 필터 설명 텍스트
                const getFilterDescription = () => {
                  const parts = [];
                  if (dongFilter && targetDong) {
                    parts.push(`동 "${parsedAddress?.dong}"`);
                  }
                  if (jibunFilter === 'exact') {
                    parts.push(`지번 "${parsedAddress?.jibun}" 정확히 일치`);
                  } else if (jibunFilter !== 'none' && jibunFilterRange) {
                    parts.push(`지번 ${targetBonbun}±${jibunFilterRange} 범위`);
                  }
                  if (areaFilter === 'exact') {
                    parts.push(`면적 ${targetArea?.toFixed(2)}㎡ 정확히 일치`);
                  } else if (areaFilter !== 'none' && areaFilterRange) {
                    parts.push(`면적 ${targetArea?.toFixed(2)}±${areaFilterRange}㎡ 범위`);
                  }
                  return parts.join(' + ');
                };

                const hasAnyFilter = dongFilter || jibunFilter !== 'none' || areaFilter !== 'none';

                return (
                  <div className="border rounded-lg overflow-hidden">
                    <div className="bg-green-50 px-3 py-2 text-sm text-green-800 font-medium flex items-center justify-between flex-wrap gap-1">
                      <span>
                        {hasAnyFilter
                          ? `${filteredResults.length}개의 거래 (전체 ${aptTradeResults.length}개 중 ${getFilterDescription()})`
                          : `${aptTradeResults.length}개의 거래를 찾았습니다.`}
                      </span>
                      <div className="flex items-center gap-2">
                        {!hasAnyFilter && parsedAddress?.dong && (
                          <span className="text-blue-600 text-xs">
                            💡 동 일치: {aptTradeResults.filter(isDongMatch).length}개
                          </span>
                        )}
                        {!hasAnyFilter && parsedAddress?.jibun && (
                          <span className="text-orange-600 text-xs">
                            💡 지번 일치: {aptTradeResults.filter(isJibunMatch).length}개
                          </span>
                        )}
                        {!hasAnyFilter && parsedAddress?.area_m2 && (
                          <span className="text-purple-600 text-xs">
                            💡 면적 일치: {aptTradeResults.filter(isAreaMatch).length}개
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="max-h-96 overflow-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-100 sticky top-0">
                          <tr>
                            <th className="px-3 py-2 text-left">거래일</th>
                            <th className="px-3 py-2 text-left">아파트명</th>
                            <th className="px-3 py-2 text-right">전용면적</th>
                            <th className="px-3 py-2 text-center">층</th>
                            <th className="px-3 py-2 text-right">거래금액</th>
                            <th className="px-3 py-2 text-left">법정동</th>
                            <th className="px-3 py-2 text-left">지번</th>
                            <th className="px-3 py-2 text-center">건축년도</th>
                            <th className="px-3 py-2 text-center">거래유형</th>
                            <th className="px-3 py-2 text-center">해제여부</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredResults.map((item, idx) => {
                            const jibunMatched = isJibunMatch(item);
                            const dongMatched = isDongMatch(item);
                            const areaMatched = isAreaMatch(item);
                            const allMatched = jibunMatched && dongMatched && areaMatched;
                            const twoMatched = (jibunMatched && dongMatched) || (dongMatched && areaMatched) || (jibunMatched && areaMatched);
                            return (
                              <tr
                                key={idx}
                                className={`border-t ${allMatched ? 'bg-emerald-100 hover:bg-emerald-200' : twoMatched ? 'bg-green-50 hover:bg-green-100' : areaMatched ? 'bg-purple-50 hover:bg-purple-100' : jibunMatched ? 'bg-orange-50 hover:bg-orange-100' : dongMatched ? 'bg-blue-50 hover:bg-blue-100' : 'hover:bg-gray-50'}`}
                              >
                                <td className="px-3 py-2">
                                  {item.dealYear && item.dealMonth && item.dealDay
                                    ? `${item.dealYear}.${String(item.dealMonth).padStart(2, '0')}.${String(item.dealDay).padStart(2, '0')}`
                                    : 'N/A'}
                                </td>
                                <td className="px-3 py-2 font-medium">{item.aptName || item.aptNm || 'N/A'}</td>
                                <td className={`px-3 py-2 text-right ${areaMatched ? 'font-semibold text-purple-700' : ''}`}>
                                  {item.exclusiveArea || item.excluUseAr || 'N/A'}㎡
                                  {areaMatched && <span className="ml-1 text-xs">✓</span>}
                                </td>
                                <td className="px-3 py-2 text-center">{item.floor || 'N/A'}</td>
                                <td className="px-3 py-2 text-right font-semibold text-blue-600">
                                  {item.dealAmount ? `${item.dealAmount.toLocaleString()}만원` : 'N/A'}
                                </td>
                                <td className={`px-3 py-2 ${dongMatched ? 'font-semibold text-blue-700' : ''}`}>
                                  {item.dong || item.umdNm || 'N/A'}
                                  {dongMatched && <span className="ml-1 text-xs">✓</span>}
                                </td>
                                <td className={`px-3 py-2 ${jibunMatched ? 'font-semibold text-orange-700' : ''}`}>
                                  {item.jibun || 'N/A'}
                                  {jibunMatched && <span className="ml-1 text-xs">✓</span>}
                                </td>
                                <td className="px-3 py-2 text-center">{item.buildYear || 'N/A'}</td>
                                <td className="px-3 py-2 text-center">{item.dealingGbn || '-'}</td>
                                <td className="px-3 py-2 text-center">
                                  {item.cancelDealType || item.cdealType ? (
                                    <span className="text-red-600">해제</span>
                                  ) : (
                                    <span className="text-green-600">-</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* ===== 자동 분석 결과 섹션 ===== */}
            {parsedAddress && (
              <>
                <div className="px-6 py-3 bg-blue-50 border-b border-blue-200">
                  <h2 className="font-bold text-blue-700 text-lg flex items-center gap-2">
                    🤖 자동 분석 결과
                    <span className="text-sm font-normal text-blue-500">(파싱된 주소 기반 자동 조회)</span>
                  </h2>
                </div>
                <div className="px-6 py-4 border-b border-gray-200">
                  <h3 className="font-semibold text-gray-800 mb-3">
                    📊 실거래가 분석
                    <span className="ml-2 text-sm font-normal text-gray-500">
                      (동 + 지번 정확히 일치 필터링)
                    </span>
                  </h3>

                {/* 로딩 상태 */}
                {autoTradeResult.loading && (
                  <div className="flex items-center gap-3 py-8 justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    <span className="text-gray-600">자동 분석 중...</span>
                  </div>
                )}

                {/* 에러 상태 */}
                {autoTradeResult.error && !autoTradeResult.loading && (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                    <div className="flex items-center gap-2 text-red-700">
                      <span className="text-lg">⚠️</span>
                      <span className="font-medium">분석 실패:</span>
                      <span>{autoTradeResult.error}</span>
                    </div>
                  </div>
                )}

                {/* 결과 표시 */}
                {!autoTradeResult.loading && !autoTradeResult.error && autoTradeResult.lawdCd && (
                  <div className="space-y-4">
                    {/* 요약 카드 */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {/* 법정동코드 */}
                      <div className="p-4 bg-gray-50 rounded-lg border">
                        <div className="text-sm text-gray-600 mb-1">법정동코드</div>
                        <div className="font-mono text-lg font-semibold text-gray-800">{autoTradeResult.lawdCd}</div>
                        <div className="text-xs text-gray-500 mt-1 truncate">{autoTradeResult.lawdName}</div>
                      </div>

                      {/* 전체/필터링 거래 수 */}
                      <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                        <div className="text-sm text-blue-600 mb-1">거래 건수</div>
                        <div className="text-lg font-semibold text-blue-800">
                          {autoTradeResult.filteredCount} / {autoTradeResult.totalCount}건
                        </div>
                        <div className="text-xs text-blue-600 mt-1">
                          동: {autoTradeResult.dongMatchCount}건 | 지번: {autoTradeResult.jibunMatchCount}건
                        </div>
                      </div>

                      {/* 평균 거래가 (핵심) */}
                      <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                        <div className="text-sm text-green-600 mb-1">평균 거래가</div>
                        <div className="text-2xl font-bold text-green-700">
                          {autoTradeResult.averagePrice
                            ? `${autoTradeResult.averagePrice.toLocaleString()}만원`
                            : '-'}
                        </div>
                        <div className="text-xs text-green-600 mt-1">
                          {autoTradeResult.filteredCount > 0
                            ? `${autoTradeResult.filteredCount}건 기준`
                            : '일치하는 거래 없음'}
                        </div>
                      </div>

                      {/* 최소/최대 거래가 */}
                      <div className="p-4 bg-orange-50 rounded-lg border border-orange-200">
                        <div className="text-sm text-orange-600 mb-1">최소 / 최대</div>
                        <div className="text-lg font-semibold text-orange-700">
                          {autoTradeResult.minPrice && autoTradeResult.maxPrice
                            ? `${autoTradeResult.minPrice.toLocaleString()} ~ ${autoTradeResult.maxPrice.toLocaleString()}`
                            : '-'}
                        </div>
                        <div className="text-xs text-orange-600 mt-1">
                          {autoTradeResult.minPrice && autoTradeResult.maxPrice
                            ? `차이: ${(autoTradeResult.maxPrice - autoTradeResult.minPrice).toLocaleString()}만원`
                            : '데이터 없음'}
                        </div>
                      </div>
                    </div>

                    {/* 필터 조건 표시 */}
                    <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm">
                      <span className="font-medium text-yellow-800">🎯 필터 조건:</span>
                      <span className="ml-2 text-yellow-700">
                        동 = &quot;{parsedAddress.dong}&quot; AND 지번 = &quot;{parsedAddress.jibun}&quot;
                        {parsedAddress.area_m2 && (
                          <> AND 전용면적 ≈ {parsedAddress.area_m2.toFixed(2)}㎡ (±0.5㎡)</>
                        )}
                      </span>
                    </div>

                    {/* 필터링된 거래 목록 */}
                    {autoTradeResult.filteredTransactions.length > 0 && (
                      <div className="border rounded-lg overflow-hidden">
                        <div className="bg-green-100 px-3 py-2 text-sm font-medium text-green-800 flex items-center gap-2">
                          <span>✅ 일치하는 거래 목록</span>
                          <span className="text-green-600">({autoTradeResult.filteredTransactions.length}건)</span>
                        </div>
                        <div className="max-h-64 overflow-auto">
                          <table className="w-full text-sm">
                            <thead className="bg-gray-100 sticky top-0">
                              <tr>
                                <th className="px-3 py-2 text-left">거래일</th>
                                <th className="px-3 py-2 text-left">아파트명</th>
                                <th className="px-3 py-2 text-right">전용면적</th>
                                <th className="px-3 py-2 text-center">층</th>
                                <th className="px-3 py-2 text-right">거래금액</th>
                                <th className="px-3 py-2 text-left">법정동</th>
                                <th className="px-3 py-2 text-left">지번</th>
                              </tr>
                            </thead>
                            <tbody>
                              {autoTradeResult.filteredTransactions.map((item, idx) => (
                                <tr key={idx} className="border-t bg-green-50 hover:bg-green-100">
                                  <td className="px-3 py-2">
                                    {item.dealYear && item.dealMonth && item.dealDay
                                      ? `${item.dealYear}.${String(item.dealMonth).padStart(2, '0')}.${String(item.dealDay).padStart(2, '0')}`
                                      : 'N/A'}
                                  </td>
                                  <td className="px-3 py-2 font-medium">{item.aptName || item.aptNm || 'N/A'}</td>
                                  <td className="px-3 py-2 text-right">{item.exclusiveArea || item.excluUseAr || 'N/A'}㎡</td>
                                  <td className="px-3 py-2 text-center">{item.floor || 'N/A'}</td>
                                  <td className="px-3 py-2 text-right font-bold text-green-700">
                                    {item.dealAmount ? `${item.dealAmount.toLocaleString()}만원` : 'N/A'}
                                  </td>
                                  <td className="px-3 py-2 text-blue-700 font-medium">
                                    {item.dong || item.umdNm || 'N/A'} ✓
                                  </td>
                                  <td className="px-3 py-2 text-orange-700 font-medium">
                                    {item.jibun || 'N/A'} ✓
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* 일치하는 거래가 없는 경우 */}
                    {autoTradeResult.filteredCount === 0 && (
                      <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg text-center">
                        <div className="text-gray-500 text-sm">
                          😔 동 + 지번이 정확히 일치하는 거래가 없습니다.
                        </div>
                        <div className="text-gray-400 text-xs mt-1">
                          동 일치: {autoTradeResult.dongMatchCount}건 | 지번 일치: {autoTradeResult.jibunMatchCount}건
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* 파싱된 주소가 없는 경우 */}
                {!autoTradeResult.loading && !autoTradeResult.error && !autoTradeResult.lawdCd && !parsedAddress?.jibun && (
                  <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg text-center text-sm text-gray-500">
                    먼저 Step 1에서 등기부를 파싱하여 주소 정보를 추출하세요.
                  </div>
                )}
                </div>
              </>
            )}

            {/* Original Step 2 Result */}
            {step2Result && (
              <div className="px-6 py-4">
                {step2Result.success ? (
                  <div>
                    <div className="flex items-center gap-2 mb-4">
                      <span className="text-green-600 font-medium">✓ Success</span>
                      <span className="text-gray-500 text-sm">
                        ({step2Result.execution_time_ms}ms)
                      </span>
                    </div>
                    <div className="space-y-2 text-sm">
                      <div>
                        <span className="font-medium">법정동코드:</span>{' '}
                        <span className="font-mono">{step2Result.legal_dong_code || 'N/A'}</span>
                      </div>
                      <div>
                        <span className="font-medium">매매 평균가:</span>{' '}
                        {step2Result.property_value_estimate
                          ? `${step2Result.property_value_estimate.toLocaleString()}만원`
                          : 'N/A'}
                      </div>
                      <div>
                        <span className="font-medium">전세 시장가:</span>{' '}
                        {step2Result.jeonse_market_average
                          ? `${step2Result.jeonse_market_average.toLocaleString()}만원`
                          : 'N/A'}
                      </div>
                      <div>
                        <span className="font-medium">최근 거래:</span>{' '}
                        {step2Result.recent_transactions?.length || 0}건
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-red-600">
                    <p className="font-medium">✗ Failed</p>
                    <ul className="text-sm mt-1 list-disc list-inside">
                      {step2Result.errors?.map((err, i) => (
                        <li key={i}>{err}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Step 4: 종합 분석 */}
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">Step 4: 종합 분석</h2>
                <p className="text-sm text-gray-600 mt-1">
                  계약정보 + 시장데이터 기반 리스크 점수 계산 및 요약
                </p>
              </div>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={useLLM}
                    onChange={(e) => setUseLLM(e.target.checked)}
                    className="rounded"
                  />
                  <span>LLM 사용</span>
                </label>
                <button
                  onClick={runStep4}
                  disabled={step3Loading}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  {step3Loading ? 'Running...' : 'Run'}
                </button>
              </div>
            </div>
            {step3Result && (
              <div className="px-6 py-4">
                {step3Result.success ? (
                  <div className="space-y-6">
                    {/* Header */}
                    <div className="flex items-center gap-2">
                      <span className="text-green-600 font-medium">✓ Success</span>
                      <span className="text-gray-500 text-sm">
                        ({step3Result.execution_time_ms}ms, {step3Result.metadata?.use_llm ? 'LLM' : '규칙 기반'})
                      </span>
                    </div>

                    {/* 입력 데이터 요약 (Metadata) */}
                    {step3Result.metadata && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* 유저 입력 계약 정보 */}
                        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                          <h4 className="font-medium text-blue-800 mb-3">📋 입력 계약 정보</h4>
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-gray-600">계약 유형:</span>
                              <span className="font-medium">{step3Result.metadata.user_contract_type || 'N/A'}</span>
                            </div>
                            {(step3Result.metadata.user_contract_type === '전세' || step3Result.metadata.user_contract_type === '월세') && (
                              <>
                                <div className="flex justify-between">
                                  <span className="text-gray-600">입력 보증금:</span>
                                  <span className="font-medium">
                                    {step3Result.metadata.user_deposit
                                      ? `${step3Result.metadata.user_deposit.toLocaleString()}만원`
                                      : '미입력'}
                                  </span>
                                </div>
                                {step3Result.metadata.user_contract_type === '월세' && (
                                  <div className="flex justify-between">
                                    <span className="text-gray-600">입력 월세:</span>
                                    <span className="font-medium">
                                      {step3Result.metadata.user_monthly_rent
                                        ? `${step3Result.metadata.user_monthly_rent.toLocaleString()}만원`
                                        : '미입력'}
                                    </span>
                                  </div>
                                )}
                              </>
                            )}
                            {step3Result.metadata.user_contract_type === '매매' && (
                              <div className="flex justify-between">
                                <span className="text-gray-600">입력 매매가:</span>
                                <span className="font-medium">
                                  {step3Result.metadata.user_price
                                    ? `${step3Result.metadata.user_price.toLocaleString()}만원`
                                    : '미입력'}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* 시장 데이터 (Step 2) */}
                        <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                          <h4 className="font-medium text-green-800 mb-3">📊 시장 데이터 (Step 2)</h4>
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-gray-600">매매 실거래가 평균:</span>
                              <span className="font-medium">
                                {step3Result.metadata.property_value_estimate
                                  ? `${step3Result.metadata.property_value_estimate.toLocaleString()}만원`
                                  : 'N/A'}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600">전세 실거래가 평균:</span>
                              <span className="font-medium">
                                {step3Result.metadata.jeonse_market_average
                                  ? `${step3Result.metadata.jeonse_market_average.toLocaleString()}만원`
                                  : 'N/A'}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600">등기부 데이터:</span>
                              <span className={`font-medium ${step3Result.metadata.has_registry ? 'text-green-600' : 'text-red-600'}`}>
                                {step3Result.metadata.has_registry ? '✓ 있음' : '✗ 없음'}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* 가격 비교 결과 */}
                    {step3Result.metadata?.price_comparison && step3Result.metadata.price_comparison.user_value && (
                      <div className={`p-4 rounded-lg border ${
                        (step3Result.metadata.price_comparison.difference_percent ?? 0) > 10
                          ? 'bg-red-50 border-red-200'
                          : (step3Result.metadata.price_comparison.difference_percent ?? 0) > 5
                            ? 'bg-yellow-50 border-yellow-200'
                            : 'bg-green-50 border-green-200'
                      }`}>
                        <h4 className="font-medium mb-3">💰 가격 비교 분석</h4>
                        <div className="grid grid-cols-3 gap-4 text-center">
                          <div>
                            <div className="text-sm text-gray-600">입력 금액</div>
                            <div className="text-lg font-bold text-blue-600">
                              {step3Result.metadata.price_comparison.user_value.toLocaleString()}만원
                            </div>
                          </div>
                          <div>
                            <div className="text-sm text-gray-600">시장 평균</div>
                            <div className="text-lg font-bold text-gray-700">
                              {step3Result.metadata.price_comparison.market_average?.toLocaleString()}만원
                            </div>
                          </div>
                          <div>
                            <div className="text-sm text-gray-600">차이</div>
                            <div className={`text-lg font-bold ${
                              (step3Result.metadata.price_comparison.difference ?? 0) > 0
                                ? 'text-red-600'
                                : 'text-green-600'
                            }`}>
                              {(step3Result.metadata.price_comparison.difference ?? 0) > 0 ? '+' : ''}
                              {step3Result.metadata.price_comparison.difference?.toLocaleString()}만원
                              <span className="text-sm ml-1">
                                ({(step3Result.metadata.price_comparison.difference_percent ?? 0) > 0 ? '+' : ''}
                                {step3Result.metadata.price_comparison.difference_percent?.toFixed(1)}%)
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Risk Score */}
                    {step3Result.risk_score && (
                      <div className="p-4 bg-gray-50 rounded-lg border">
                        <h4 className="font-medium mb-3">📊 리스크 점수</h4>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                          <div className="text-center p-3 bg-white rounded border">
                            <div className="text-sm text-gray-600">종합 점수</div>
                            <div className={`text-2xl font-bold ${
                              step3Result.risk_score.total_score >= 71 ? 'text-red-600' :
                              step3Result.risk_score.total_score >= 51 ? 'text-orange-500' :
                              step3Result.risk_score.total_score >= 31 ? 'text-yellow-600' : 'text-green-600'
                            }`}>
                              {step3Result.risk_score.total_score?.toFixed(0) ?? 'N/A'}
                            </div>
                          </div>
                          <div className="text-center p-3 bg-white rounded border">
                            <div className="text-sm text-gray-600">위험 등급</div>
                            <div className={`text-xl font-bold ${
                              step3Result.risk_score.risk_level === '심각' ? 'text-red-600' :
                              step3Result.risk_score.risk_level === '위험' ? 'text-orange-500' :
                              step3Result.risk_score.risk_level === '주의' ? 'text-yellow-600' : 'text-green-600'
                            }`}>
                              {step3Result.risk_score.risk_level ?? 'N/A'}
                            </div>
                          </div>
                          {step3Result.risk_score.jeonse_ratio != null && (
                            <div className="text-center p-3 bg-white rounded border">
                              <div className="text-sm text-gray-600">전세가율</div>
                              <div className="text-xl font-bold">
                                {step3Result.risk_score.jeonse_ratio?.toFixed(1)}%
                              </div>
                            </div>
                          )}
                          {step3Result.risk_score.mortgage_ratio != null && (
                            <div className="text-center p-3 bg-white rounded border">
                              <div className="text-sm text-gray-600">근저당 비율</div>
                              <div className="text-xl font-bold">
                                {step3Result.risk_score.mortgage_ratio?.toFixed(1)}%
                              </div>
                            </div>
                          )}
                        </div>

                        {/* 위험 요인 */}
                        {step3Result.risk_score.risk_factors && step3Result.risk_score.risk_factors.length > 0 && (
                          <div className="mt-3 p-3 bg-yellow-50 rounded border border-yellow-200">
                            <div className="text-sm font-medium text-yellow-800 mb-2">⚠️ 위험 요인</div>
                            <ul className="text-sm text-gray-700 space-y-1">
                              {step3Result.risk_score.risk_factors.map((factor: string, idx: number) => (
                                <li key={idx}>• {factor}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Summary (Markdown) */}
                    {step3Result.summary && (
                      <div>
                        <h4 className="font-medium mb-3">📝 종합 분석 리포트</h4>
                        <div className="prose prose-sm max-w-none bg-white p-6 rounded-lg border shadow-sm">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {step3Result.summary}
                          </ReactMarkdown>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-red-600">
                    <p className="font-medium">✗ Failed</p>
                    <p className="text-sm mt-1">{step3Result.error}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
