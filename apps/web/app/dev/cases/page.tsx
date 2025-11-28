'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Case {
  id: string;
  property_address: string;
  contract_type: string;
  current_state: string;
  created_at: string;
}

export default function DevCasesPage() {
  const [cases, setCases] = useState<Case[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    loadCases();
  }, []);

  const loadCases = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch Lab cases from Supabase (environment=dev, source=lab)
      const response = await fetch('/api/cases?environment=dev&source=lab');

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      setCases(data.cases || []);
    } catch (err: any) {
      console.error('Failed to load cases:', err);
      setError(err.message || 'Failed to load cases');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (caseId: string) => {
    const confirmed = window.confirm('이 케이스를 삭제하시겠습니까?');
    if (!confirmed) {
      return;
    }

    try {
      setDeleteError(null);
      setDeletingId(caseId);

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

      setCases((prev) => prev.filter((c) => c.id !== caseId));
    } catch (err: any) {
      console.error('Delete case failed:', err);
      setDeleteError(err.message || '삭제 실패');
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-3xl font-bold mb-8">집체크 Analysis Lab</h1>
          <div className="text-gray-600">Loading cases...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-3xl font-bold mb-8">집체크 Analysis Lab</h1>
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800 font-medium">Error loading cases</p>
            <p className="text-red-600 text-sm mt-1">{error}</p>
            <button
              onClick={loadCases}
              className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">집체크 Analysis Lab</h1>
            <div className="text-sm text-gray-500 mt-1">
              환경: <span className="font-mono font-medium text-blue-600">dev</span> /
              소스: <span className="font-mono font-medium text-green-600">lab</span>
            </div>
          </div>
          <Link
            href="/dev/cases/upload"
            className="px-6 py-3 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            케이스 업로드
          </Link>
        </div>

        {deleteError && (
          <div className="mb-4 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-800">
            {deleteError}
          </div>
        )}

        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold">Cases ({cases.length})</h2>
            <p className="text-sm text-gray-600 mt-1">
              Analysis Lab에서 생성된 케이스 목록입니다. (source=lab)
            </p>
          </div>

          {cases.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              No cases found. Create a case in the main app first.
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {cases.map((c) => (
                <Link
                  key={c.id}
                  href={`/dev/cases/${c.id}`}
                  className="block px-6 py-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-medium text-gray-900">
                          {c.property_address || '주소 미정'}
                        </h3>
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          {c.contract_type || '계약 미정'}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-gray-500">
                        <div>
                          상태: <span className="font-mono">{c.current_state}</span>
                        </div>
                        <div>
                          생성일: {new Date(c.created_at).toLocaleString('ko-KR')}
                        </div>
                      </div>
                    </div>
                    <div className="ml-4 flex items-center gap-3">
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleDelete(c.id);
                        }}
                        disabled={deletingId === c.id}
                        className="px-3 py-1.5 bg-red-600 text-white text-sm font-medium rounded hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                      >
                        {deletingId === c.id ? '삭제 중...' : '삭제'}
                      </button>
                      <svg
                        className="w-5 h-5 text-gray-400"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 5l7 7-7 7"
                        />
                      </svg>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="mt-8 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-yellow-800 text-sm font-medium">⚠️ 개발 전용 페이지</p>
          <p className="text-yellow-700 text-sm mt-1">
            이 페이지는 개발자 디버깅 전용입니다. 프로덕션 환경에서는 접근할 수 없습니다.
          </p>
        </div>
      </div>
    </div>
  );
}
