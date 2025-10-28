'use client';

import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Copy, Check, Download } from 'lucide-react';

interface AnalysisReportProps {
  content: string;
  contractType?: string;
  address?: string;
}

export default function AnalysisReport({ content, contractType, address }: AnalysisReportProps) {
  const [isCopied, setIsCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  const handleDownload = () => {
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `집체크_분석리포트_${contractType || ''}_${new Date().toISOString().split('T')[0]}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-red-500 to-pink-500 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-white">📊 부동산 계약 분석 리포트</h3>
            {address && (
              <p className="text-sm text-white/90 mt-1">{address}</p>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleCopy}
              className="p-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors"
              title="복사"
            >
              {isCopied ? (
                <Check className="w-4 h-4 text-white" />
              ) : (
                <Copy className="w-4 h-4 text-white" />
              )}
            </button>
            <button
              onClick={handleDownload}
              className="p-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors"
              title="다운로드"
            >
              <Download className="w-4 h-4 text-white" />
            </button>
          </div>
        </div>
      </div>

      {/* Markdown Content */}
      <div className="px-6 py-6">
        <div className="prose prose-sm max-w-none
          prose-headings:text-gray-900 prose-headings:font-bold
          prose-h1:text-2xl prose-h1:mb-4 prose-h1:pb-2 prose-h1:border-b prose-h1:border-gray-200
          prose-h2:text-xl prose-h2:mt-6 prose-h2:mb-3
          prose-h3:text-lg prose-h3:mt-4 prose-h3:mb-2
          prose-p:text-gray-700 prose-p:leading-relaxed prose-p:my-2
          prose-strong:text-gray-900 prose-strong:font-semibold
          prose-ul:my-2 prose-ul:list-disc prose-ul:pl-6
          prose-ol:my-2 prose-ol:list-decimal prose-ol:pl-6
          prose-li:text-gray-700 prose-li:my-1
          prose-blockquote:border-l-4 prose-blockquote:border-red-500 prose-blockquote:pl-4 prose-blockquote:italic prose-blockquote:text-gray-600
          prose-code:bg-gray-100 prose-code:text-red-600 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-sm
          prose-pre:bg-gray-900 prose-pre:text-gray-100 prose-pre:p-4 prose-pre:rounded-lg prose-pre:overflow-x-auto
          prose-table:w-full prose-table:border-collapse
          prose-th:bg-gray-50 prose-th:border prose-th:border-gray-300 prose-th:px-4 prose-th:py-2 prose-th:text-left prose-th:font-semibold
          prose-td:border prose-td:border-gray-300 prose-td:px-4 prose-td:py-2
          prose-a:text-red-600 prose-a:no-underline hover:prose-a:underline
          prose-hr:border-gray-300 prose-hr:my-6
        ">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {content}
          </ReactMarkdown>
        </div>
      </div>

      {/* Footer */}
      <div className="bg-gray-50 px-6 py-4 border-t border-gray-200">
        <div className="flex items-center justify-between text-sm text-gray-500">
          <p>
            💡 <strong>중요:</strong> 이 리포트는 참고용입니다. 최종 계약 전 반드시 법무사 상담을 받으세요.
          </p>
          <p className="text-xs">
            생성일: {new Date().toLocaleString('ko-KR')}
          </p>
        </div>
      </div>
    </div>
  );
}
