/**
 * 등기부 업로드 컴포넌트
 *
 * @description
 * 등기부등본 PDF 업로드 UI (MVP - 업로드만 지원)
 *
 * @author 집체크 개발팀
 * @version 2.0.0
 * @date 2025-01-28
 */

'use client';

import { useState } from 'react';
import { FileText, Upload, Info } from 'lucide-react';

export interface RegistryChoiceSelectorProps {
  onSelect: (file: File) => void;
  disabled?: boolean;
}

export default function RegistryChoiceSelector({
  onSelect,
  disabled = false,
}: RegistryChoiceSelectorProps) {
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // 파일 업로드 핸들러
  const handleFileChange = (file: File | null) => {
    if (!file) return;

    // PDF 파일만 허용
    if (file.type !== 'application/pdf') {
      alert('PDF 파일만 업로드 가능합니다.');
      return;
    }

    // 파일 크기 제한 (10MB)
    if (file.size > 10 * 1024 * 1024) {
      alert('파일 크기는 10MB 이하여야 합니다.');
      return;
    }

    setUploadedFile(file);
    onSelect(file);
  };

  // 드래그 앤 드롭 핸들러
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileChange(files[0]);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* 타이틀 */}
      <div className="mb-6 text-center">
        <h3 className="text-2xl font-bold text-neutral-900 mb-2">
          등기부등본 PDF를 업로드해주세요
        </h3>
        <p className="text-neutral-600">
          대법원 인터넷등기소에서 발급받은 등기부등본 PDF 파일을 업로드하세요.
        </p>
      </div>

      {/* PDF 업로드 영역 */}
      <div
        className={`
          relative p-8 rounded-2xl border-2 transition-all duration-200
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
          ${isDragging ? 'border-red-500 bg-red-50' : 'bg-white border-neutral-200 hover:border-red-300'}
          ${uploadedFile ? 'bg-green-50 border-green-300' : ''}
        `}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* 아이콘 */}
        <div className="mb-4 text-center">
          <div className={`inline-flex p-4 rounded-xl ${
            uploadedFile ? 'bg-green-100' : 'bg-purple-50'
          }`}>
            <Upload className={`w-10 h-10 ${
              uploadedFile ? 'text-green-600' : 'text-purple-600'
            }`} />
          </div>
        </div>

        {/* 파일 업로드 UI */}
        {uploadedFile ? (
          <div className="text-center">
            <div className="mb-4 p-4 bg-white rounded-lg border border-green-200">
              <div className="flex items-center justify-center gap-3">
                <FileText className="w-5 h-5 text-green-600" />
                <span className="text-sm font-medium text-green-800">
                  {uploadedFile.name}
                </span>
              </div>
              <p className="text-xs text-neutral-500 mt-2">
                {(uploadedFile.size / 1024 / 1024).toFixed(2)} MB
              </p>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setUploadedFile(null);
              }}
              className="text-sm text-neutral-600 hover:text-neutral-900 underline"
            >
              다른 파일 선택
            </button>
          </div>
        ) : (
          <label className="block cursor-pointer">
            <input
              type="file"
              accept=".pdf"
              onChange={(e) => handleFileChange(e.target.files?.[0] || null)}
              disabled={disabled}
              className="hidden"
            />
            <div className="text-center">
              <p className="text-lg font-medium text-neutral-900 mb-2">
                클릭하거나 파일을 드래그하세요
              </p>
              <p className="text-sm text-neutral-600 mb-4">
                PDF 파일 (최대 10MB)
              </p>

              {/* 장점 리스트 */}
              <div className="mt-6 space-y-2">
                <div className="flex items-center justify-center gap-2 text-sm text-neutral-600">
                  <span className="text-green-600">✓</span>
                  <span>크레딧 차감 없음 (무료)</span>
                </div>
                <div className="flex items-center justify-center gap-2 text-sm text-neutral-600">
                  <span className="text-green-600">✓</span>
                  <span>즉시 분석 시작</span>
                </div>
                <div className="flex items-center justify-center gap-2 text-sm text-neutral-600">
                  <span className="text-green-600">✓</span>
                  <span>안전한 암호화 처리</span>
                </div>
              </div>
            </div>
          </label>
        )}
      </div>

      {/* 주의사항 */}
      <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg flex gap-3">
        <Info className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="text-sm text-yellow-900 font-medium mb-2">
            ⚠️ 주의사항
          </p>
          <ul className="text-xs text-yellow-800 space-y-1">
            <li>• 등기부는 최신일수록 정확한 분석이 가능합니다 (발행일 3개월 이내 권장)</li>
            <li>• PDF 파일이 스캔본이어도 AI 모델이 자동으로 분석합니다</li>
            <li>• 업로드된 파일은 AES-256 암호화되어 안전하게 보관됩니다</li>
          </ul>
        </div>
      </div>

      {/* 등기부 발급 안내 */}
      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-sm text-blue-900 font-medium mb-2">
          📄 등기부등본 발급 방법
        </p>
        <p className="text-xs text-blue-800 mb-2">
          등기부등본이 없으신가요? 대법원 인터넷등기소에서 간편하게 발급받으세요.
        </p>
        <a
          href="https://www.iros.go.kr"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          인터넷등기소 바로가기 →
        </a>
      </div>
    </div>
  );
}
