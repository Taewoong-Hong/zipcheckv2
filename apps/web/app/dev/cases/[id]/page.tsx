'use client';

import { useEffect, useState } from 'react';
import { use } from 'react';
import { useRouter } from 'next/navigation';

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
  const [jibunFilter, setJibunFilter] = useState(false); // 지번 필터 활성화

  // 파싱된 주소 정보 (지번 포함)
  const [parsedAddress, setParsedAddress] = useState<{
    full: string;           // 전체 주소
    addressUntilDong: string; // 동까지의 주소 (법정동 검색용)
    dong: string;           // 동/읍/면/리
    jibun: string;          // 지번 (예: 123-45)
    building: string;       // 건물명/호수
  } | null>(null);

  const [useLLM, setUseLLM] = useState(false);

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

  const runStep3 = async () => {
    try {
      setStep3Loading(true);
      setStep3Result(null);

      const response = await fetch('/api/dev/prepare-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ case_id: caseId, use_llm: useLLM }),
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

  // PDF 파싱 결과 주소로 법정동 검색 업데이트 + 지번 추출
  useEffect(() => {
    if (step1Result?.success && step1Result.registry_doc_masked?.property_address) {
      const address = step1Result.registry_doc_masked.property_address;

      // 주소에서 지번 추출
      const parsed = parseAddressComponents(address);
      setParsedAddress(parsed);

      // 동까지만 잘라서 검색란에 입력
      setLegalDongKeyword(parsed?.addressUntilDong || address);

      if (parsed?.jibun) {
        console.log('[지번 추출]', parsed);
      }
    }
  }, [step1Result]);

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

          {/* Step 2: Collect Public Data */}
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">Step 2: 공공 데이터 수집</h2>
                <p className="text-sm text-gray-600 mt-1">
                  법정동코드 + 실거래가 조회 (전세/월세: 듀얼 API)
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={runAPITest}
                  disabled={apiTestLoading}
                  className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  {apiTestLoading ? 'Testing 15 APIs...' : 'Test All 15 APIs'}
                </button>
                <button
                  onClick={runStep2}
                  disabled={step2Loading}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  {step2Loading ? 'Running...' : 'Run'}
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
                {/* 지번 필터 토글 */}
                {parsedAddress?.jibun && aptTradeResults.length > 0 && (
                  <label className="flex items-center gap-2 ml-4 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={jibunFilter}
                      onChange={(e) => setJibunFilter(e.target.checked)}
                      className="w-4 h-4 text-orange-600 border-gray-300 rounded focus:ring-orange-500"
                    />
                    <span className="text-sm text-orange-700 font-medium">
                      지번 필터 ({parsedAddress.jibun})
                    </span>
                  </label>
                )}
              </div>

              {aptTradeResults.length > 0 && (() => {
                // 지번 필터 적용
                const filteredResults = jibunFilter && parsedAddress?.jibun
                  ? aptTradeResults.filter(item => {
                      const itemJibun = item.jibun?.toString().trim();
                      const targetJibun = parsedAddress.jibun.trim();
                      // 본번만 비교 (예: 123-45 → 123)
                      const itemBonbun = itemJibun?.split('-')[0];
                      const targetBonbun = targetJibun.split('-')[0];
                      return itemBonbun === targetBonbun;
                    })
                  : aptTradeResults;

                // 지번 일치 여부 확인 함수
                const isJibunMatch = (item: any) => {
                  if (!parsedAddress?.jibun) return false;
                  const itemJibun = item.jibun?.toString().trim();
                  const targetJibun = parsedAddress.jibun.trim();
                  const itemBonbun = itemJibun?.split('-')[0];
                  const targetBonbun = targetJibun.split('-')[0];
                  return itemBonbun === targetBonbun;
                };

                return (
                  <div className="border rounded-lg overflow-hidden">
                    <div className="bg-green-50 px-3 py-2 text-sm text-green-800 font-medium flex items-center justify-between">
                      <span>
                        {jibunFilter
                          ? `${filteredResults.length}개의 거래 (전체 ${aptTradeResults.length}개 중 지번 "${parsedAddress?.jibun}" 필터)`
                          : `${aptTradeResults.length}개의 거래를 찾았습니다.`}
                      </span>
                      {parsedAddress?.jibun && !jibunFilter && (
                        <span className="text-orange-600 text-xs">
                          💡 지번 일치 항목: {aptTradeResults.filter(isJibunMatch).length}개
                        </span>
                      )}
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
                            const matched = isJibunMatch(item);
                            return (
                              <tr
                                key={idx}
                                className={`border-t ${matched ? 'bg-orange-50 hover:bg-orange-100' : 'hover:bg-gray-50'}`}
                              >
                                <td className="px-3 py-2">
                                  {item.dealYear && item.dealMonth && item.dealDay
                                    ? `${item.dealYear}.${String(item.dealMonth).padStart(2, '0')}.${String(item.dealDay).padStart(2, '0')}`
                                    : 'N/A'}
                                </td>
                                <td className="px-3 py-2 font-medium">{item.aptName || item.aptNm || 'N/A'}</td>
                                <td className="px-3 py-2 text-right">{item.exclusiveArea || item.excluUseAr || 'N/A'}㎡</td>
                                <td className="px-3 py-2 text-center">{item.floor || 'N/A'}</td>
                                <td className="px-3 py-2 text-right font-semibold text-blue-600">
                                  {item.dealAmount ? `${item.dealAmount.toLocaleString()}만원` : 'N/A'}
                                </td>
                                <td className="px-3 py-2">{item.dong || item.umdNm || 'N/A'}</td>
                                <td className={`px-3 py-2 ${matched ? 'font-semibold text-orange-700' : ''}`}>
                                  {item.jibun || 'N/A'}
                                  {matched && <span className="ml-1 text-xs">✓</span>}
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

          {/* Step 3: Prepare Summary */}
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">Step 3: 요약 리포트 생성</h2>
                <p className="text-sm text-gray-600 mt-1">
                  리스크 점수 계산 + LLM/규칙 기반 요약
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
                  onClick={runStep3}
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
                  <div>
                    <div className="flex items-center gap-2 mb-4">
                      <span className="text-green-600 font-medium">✓ Success</span>
                      <span className="text-gray-500 text-sm">
                        ({step3Result.execution_time_ms}ms, {step3Result.used_llm ? 'LLM' : '규칙 기반'})
                      </span>
                    </div>
                    {step3Result.risk_score && (
                      <div className="mb-4 p-4 bg-gray-50 rounded">
                        <h3 className="font-medium mb-2">Risk Score</h3>
                        <pre className="text-xs overflow-auto">
                          {JSON.stringify(step3Result.risk_score, null, 2)}
                        </pre>
                      </div>
                    )}
                    {step3Result.summary && (
                      <div className="prose prose-sm max-w-none">
                        <h3 className="font-medium mb-2">Summary</h3>
                        <div className="whitespace-pre-wrap text-sm">{step3Result.summary}</div>
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
