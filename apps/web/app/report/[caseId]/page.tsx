"use client";

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import ReactMarkdown from 'react-markdown';

interface ReportData {
  content: string;
  contract_type: string;
  address: string;
  risk_score: any;
  created_at: string;
}

export default function ReportPage() {
  const params = useParams();
  const router = useRouter();
  const caseId = params.caseId as string;

  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [streamProgress, setStreamProgress] = useState(0);
  const [streamMessage, setStreamMessage] = useState('분석 준비 중...');
  const [streamStep, setStreamStep] = useState(0);

  const loadReport = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Supabase 세션에서 인증 토큰 가져오기
      const { getBrowserSupabase } = await import('@/lib/supabaseBrowser');
      const supabase = getBrowserSupabase();
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      // Authorization 헤더 추가
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      // 🔍 디버그 로깅
      console.log('[DEBUG] loadReport - Token:', token ? 'present ✅' : 'missing ❌');
      console.log('[DEBUG] loadReport - Headers:', headers);
      console.log('[DEBUG] loadReport - Fetching:', `/api/report/${caseId}`);

      const response = await fetch(`/api/report/${caseId}`, {
        method: 'GET',
        headers,
        credentials: 'include',
      });

      if (!response.ok) {
        // 404 = 리포트가 아직 준비되지 않음 (분석 진행 중일 가능성)
        if (response.status === 404) {
          setIsAnalyzing(true);
          setError(null);
          return;
        }
        throw new Error(`리포트 조회 실패: ${response.status}`);
      }

      const data = await response.json();
      setReport(data);
      setIsAnalyzing(false);
    } catch (err) {
      console.error('Report load error:', err);
      setError(err instanceof Error ? err.message : '알 수 없는 오류');
      setIsAnalyzing(false);
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  // SSE 스트리밍 연결 (분석 진행 중일 때)
  useEffect(() => {
    if (!isAnalyzing) return;

    let eventSource: EventSource | null = null;
    let reconnectAttempts = 0;
    const maxReconnectAttempts = 3;

    const connectSSE = async () => {
      try {
        // Supabase 세션에서 인증 토큰 가져오기
        const { getBrowserSupabase } = await import('@/lib/supabaseBrowser');
        const supabase = getBrowserSupabase();
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;

        if (!token) {
          console.error('SSE 연결 실패: 인증 토큰 없음');
          setError('인증이 필요합니다. 다시 로그인해주세요.');
          return;
        }

        // EventSource 생성 (토큰을 쿼리 파라미터로 전달)
        eventSource = new EventSource(`/api/analysis/stream?caseId=${caseId}&token=${encodeURIComponent(token)}`);

        eventSource.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            console.log('SSE 메시지:', data);

            // 진행 상태 업데이트
            setStreamStep(data.step || 0);
            setStreamProgress(data.progress || 0);
            setStreamMessage(data.message || '처리 중...');

            // 완료 시 리포트 로드 (재시도 로직 강화 - SSE_REPORT_DEBUG.md 방안 2)
            if (data.done) {
              console.log('✅ [SSE] 분석 완료! 리포트 로딩 시작...');
              eventSource?.close();

              // 재시도 로직
              const retryLoadReport = async (attempt: number = 1, maxAttempts: number = 3) => {
                console.log(`📊 [리포트 로딩] 시도 ${attempt}/${maxAttempts}...`);

                try {
                  await loadReport();
                  console.log('✅ [리포트 로딩] 성공!');
                } catch (error: any) {
                  const status = error?.status || error?.response?.status;
                  console.error(`❌ [리포트 로딩 실패] 시도 ${attempt}, 상태코드=${status}:`, error);

                  // 404 또는 400 에러이고 재시도 가능한 경우
                  if (attempt < maxAttempts && (status === 404 || status === 400)) {
                    console.log(`⏳ [재시도 대기] ${2000}ms 후 재시도...`);
                    setTimeout(() => {
                      retryLoadReport(attempt + 1, maxAttempts);
                    }, 2000); // 2초 간격
                  } else {
                    // 최종 실패
                    console.error('❌ [리포트 로딩 최종 실패]:', error);
                    setError('리포트를 불러올 수 없습니다. 페이지를 새로고침해주세요.');
                  }
                }
              };

              // 첫 시도는 2초 후 (Supabase 리플리케이션 지연 고려)
              setTimeout(() => {
                retryLoadReport();
              }, 2000);
            }
          } catch (err) {
            console.error('SSE 메시지 파싱 실패:', err);
          }
        };

        eventSource.onerror = (err) => {
          console.error('SSE 연결 오류:', err);
          eventSource?.close();

          // 재연결 시도
          if (reconnectAttempts < maxReconnectAttempts) {
            reconnectAttempts++;
            console.log(`SSE 재연결 시도 ${reconnectAttempts}/${maxReconnectAttempts}...`);
            setTimeout(() => {
              connectSSE();
            }, 2000 * reconnectAttempts); // 2초, 4초, 6초 대기
          } else {
            console.error('SSE 재연결 실패. 폴링으로 전환합니다.');
            setError('실시간 연결에 실패했습니다. 페이지를 새로고침해주세요.');
          }
        };

        eventSource.onopen = () => {
          console.log('SSE 연결 성공');
          reconnectAttempts = 0; // 연결 성공 시 재시도 카운터 초기화
        };

      } catch (err) {
        console.error('EventSource 생성 실패:', err);
        setError('실시간 연결 생성에 실패했습니다.');
      }
    };

    // SSE 연결 시작
    connectSSE();

    // 클린업 함수
    return () => {
      if (eventSource) {
        console.log('SSE 연결 종료');
        eventSource.close();
      }
    };
  }, [isAnalyzing, caseId, loadReport]);

  // 분석 진행 중 UI
  if (isAnalyzing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50">
        <div className="max-w-md w-full mx-4">
          <div className="bg-white rounded-lg shadow-sm p-8">
            {/* 스피너 */}
            <div className="mb-6 flex justify-center">
              <div className="animate-spin rounded-full h-16 w-16 border-4 border-brand-primary border-t-transparent"></div>
            </div>

            {/* 제목 */}
            <h2 className="text-2xl font-bold text-neutral-900 mb-4 text-center">분석 진행 중</h2>

            {/* 현재 단계 메시지 */}
            <div className="mb-6 text-center">
              <p className="text-lg text-neutral-700 mb-2">{streamMessage}</p>
              <p className="text-sm text-neutral-500">Step {streamStep}/8</p>
            </div>

            {/* 프로그레스 바 */}
            <div className="mb-6">
              <div className="w-full bg-neutral-200 rounded-full h-3 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-brand-primary to-brand-secondary transition-all duration-500 ease-out"
                  style={{ width: `${streamProgress * 100}%` }}
                ></div>
              </div>
              <p className="text-sm text-neutral-600 text-center mt-2">
                {Math.round(streamProgress * 100)}% 완료
              </p>
            </div>

            {/* 안내 메시지 */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
              <p className="font-medium mb-1">⏱️ 예상 소요 시간: 약 1-2분</p>
              <p className="text-blue-600">실시간으로 분석 과정을 표시하고 있습니다</p>
            </div>

            {/* 에러 메시지 (연결 실패 시) */}
            {error && (
              <div className="mt-4 p-4 bg-orange-50 border border-orange-200 rounded-lg">
                <p className="text-sm text-orange-800">{error}</p>
                <button
                  onClick={() => {
                    setError(null);
                    loadReport();
                  }}
                  className="mt-2 px-4 py-2 bg-brand-primary text-white rounded-lg hover:bg-brand-secondary transition-colors text-sm"
                >
                  다시 시도
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary mx-auto"></div>
          <p className="mt-4 text-neutral-600">리포트를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">오류 발생</h1>
          <p className="text-neutral-600 mb-6">{error}</p>
          <button
            onClick={() => router.push('/')}
            className="px-6 py-3 bg-brand-primary text-white rounded-lg hover:bg-brand-secondary transition-colors"
          >
            홈으로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-neutral-800 mb-4">리포트를 찾을 수 없습니다</h1>
          <button
            onClick={() => router.push('/')}
            className="px-6 py-3 bg-brand-primary text-white rounded-lg hover:bg-brand-secondary transition-colors"
          >
            홈으로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Header */}
      <header className="bg-white border-b border-neutral-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <button
            onClick={() => router.push('/')}
            className="text-neutral-600 hover:text-neutral-900 transition-colors"
          >
            ← 돌아가기
          </button>
          <h1 className="text-lg font-semibold text-neutral-900">분석 리포트</h1>
          <div className="w-20"></div> {/* Spacer for centering */}
        </div>
      </header>

      {/* Report Content */}
      <main className="max-w-4xl mx-auto px-6 py-8">
        {/* Report Header */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-2xl font-bold text-neutral-900 mb-2">{report.address}</h2>
              <p className="text-neutral-600">{report.contract_type} 계약</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-neutral-500">
                {new Date(report.created_at).toLocaleDateString('ko-KR', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </p>
            </div>
          </div>

          {/* Risk Score Badge */}
          {report.risk_score && report.risk_score.risk_level && (
            <div className="inline-block">
              <span
                className={`px-3 py-1 rounded-full text-sm font-medium ${
                  report.risk_score.risk_level === '안전'
                    ? 'bg-green-100 text-green-800'
                    : report.risk_score.risk_level === '주의'
                    ? 'bg-yellow-100 text-yellow-800'
                    : report.risk_score.risk_level === '위험'
                    ? 'bg-orange-100 text-orange-800'
                    : 'bg-red-100 text-red-800'
                }`}
              >
                리스크: {report.risk_score.risk_level}
              </span>
            </div>
          )}
        </div>

        {/* Markdown Content */}
        <div className="bg-white rounded-lg shadow-sm p-8 prose prose-neutral max-w-none">
          <ReactMarkdown>{report.content}</ReactMarkdown>
        </div>
      </main>
    </div>
  );
}
