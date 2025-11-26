'use client';

import { useEffect, useState } from 'react';
import { use } from 'react';

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

export default function DevCaseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const caseId = resolvedParams.id;

  const [case_data, setCaseData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Step results
  const [step1Result, setStep1Result] = useState<ParsedRegistryResult | null>(null);
  const [step2Result, setStep2Result] = useState<PublicDataResult | null>(null);
  const [step3Result, setStep3Result] = useState<SummaryResult | null>(null);

  // Loading states
  const [step1Loading, setStep1Loading] = useState(false);
  const [step2Loading, setStep2Loading] = useState(false);
  const [step3Loading, setStep3Loading] = useState(false);

  const [useLLM, setUseLLM] = useState(false);

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
          <div className="flex items-center gap-4 mb-4">
            <a
              href="/dev/cases"
              className="text-blue-600 hover:text-blue-800 text-sm font-medium"
            >
              ← Back to Cases
            </a>
          </div>
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
                  <div>
                    <div className="flex items-center gap-2 mb-4">
                      <span className="text-green-600 font-medium">✓ Success</span>
                      <span className="text-gray-500 text-sm">
                        ({step1Result.execution_time_ms}ms)
                      </span>
                    </div>
                    <pre className="bg-gray-50 p-4 rounded text-xs overflow-auto max-h-96">
                      {JSON.stringify(step1Result.registry_doc_masked, null, 2)}
                    </pre>
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
              <button
                onClick={runStep2}
                disabled={step2Loading}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {step2Loading ? 'Running...' : 'Run'}
              </button>
            </div>
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
