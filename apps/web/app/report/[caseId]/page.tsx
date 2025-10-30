"use client";

import { useEffect, useState } from 'react';
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

  useEffect(() => {
    loadReport();
  }, [caseId]);

  const loadReport = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/reports/${caseId}`, {
        method: 'GET',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`리포트 조회 실패: ${response.status}`);
      }

      const data = await response.json();
      setReport(data);
    } catch (err) {
      console.error('Report load error:', err);
      setError(err instanceof Error ? err.message : '알 수 없는 오류');
    } finally {
      setLoading(false);
    }
  };

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
