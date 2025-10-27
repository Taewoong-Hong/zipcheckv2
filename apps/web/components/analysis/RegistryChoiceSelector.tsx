/**
 * 등기부 선택 컴포넌트
 *
 * @description
 * 등기부등본 발급 (크레딧 차감) vs PDF 업로드 선택 UI
 *
 * @author 집체크 개발팀
 * @version 1.0.0
 * @date 2025-01-27
 */

'use client';

import { useState } from 'react';
import { FileText, Upload, Coins, Info } from 'lucide-react';
import type { RegistryMethod } from '@/types/analysis';

export interface RegistryChoiceSelectorProps {
  onSelect: (method: RegistryMethod, file?: File) => void;
  disabled?: boolean;
  userCredits?: number;         // 사용자 크레딧 잔액
  registryCost?: number;         // 등기부 발급 비용
}

export default function RegistryChoiceSelector({
  onSelect,
  disabled = false,
  userCredits = 0,
  registryCost = 10,
}: RegistryChoiceSelectorProps) {
  const [selectedMethod, setSelectedMethod] = useState<RegistryMethod | null>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const hasEnoughCredits = userCredits >= registryCost;

  // 발급 선택
  const handleIssueSelect = () => {
    if (!hasEnoughCredits) {
      alert(`크레딧이 부족합니다. (현재: ${userCredits}, 필요: ${registryCost})`);
      return;
    }

    setSelectedMethod('issue');
    onSelect('issue');
  };

  // 파일 업로드 선택
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
    setSelectedMethod('upload');
    onSelect('upload', file);
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
    <div className="w-full max-w-4xl mx-auto">
      {/* 타이틀 */}
      <div className="mb-6 text-center">
        <h3 className="text-2xl font-bold text-neutral-900 mb-2">
          등기부등본 준비 방법을 선택해주세요
        </h3>
        <p className="text-neutral-600">
          대법원 인터넷등기소에서 직접 발급하거나, 기존 PDF 파일을 업로드할 수 있습니다.
        </p>
      </div>

      {/* 크레딧 정보 */}
      <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-center gap-3">
        <Coins className="w-5 h-5 text-blue-600 flex-shrink-0" />
        <div className="flex-1">
          <p className="text-sm text-blue-900 font-medium">
            보유 크레딧: <span className="text-lg font-bold">{userCredits}</span> 크레딧
          </p>
          <p className="text-xs text-blue-700 mt-1">
            등기부 발급 시 {registryCost} 크레딧이 차감됩니다.
          </p>
        </div>
      </div>

      {/* 옵션 그리드 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 옵션 1: 발급 요청 */}
        <button
          onClick={handleIssueSelect}
          disabled={disabled || !hasEnoughCredits}
          className={`
            relative p-6 rounded-2xl border-2 transition-all duration-200 text-left
            ${disabled || !hasEnoughCredits ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
            ${
              selectedMethod === 'issue'
                ? 'bg-red-500 border-transparent text-white shadow-lg scale-[1.02]'
                : 'bg-white border-neutral-200 hover:border-red-300 hover:bg-red-50'
            }
          `}
        >
          {/* 체크마크 (선택 시) */}
          {selectedMethod === 'issue' && (
            <div className="absolute top-4 right-4">
              <div className="w-6 h-6 bg-white rounded-full flex items-center justify-center">
                <svg className="text-red-600" width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path
                    d="M13.3332 4L5.99984 11.3333L2.6665 8"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
            </div>
          )}

          {/* 크레딧 부족 배지 */}
          {!hasEnoughCredits && (
            <div className="absolute top-4 right-4">
              <span className="inline-block px-2 py-1 text-xs font-medium text-white bg-red-600 rounded">
                크레딧 부족
              </span>
            </div>
          )}

          {/* 아이콘 */}
          <div className="mb-4">
            <div className={`inline-flex p-3 rounded-xl ${
              selectedMethod === 'issue' ? 'bg-white/20' : 'bg-red-50'
            }`}>
              <FileText className={`w-8 h-8 ${
                selectedMethod === 'issue' ? 'text-white' : 'text-red-600'
              }`} />
            </div>
          </div>

          {/* 제목 */}
          <h4 className={`text-xl font-bold mb-2 ${
            selectedMethod === 'issue' ? 'text-white' : 'text-neutral-900'
          }`}>
            등기부 발급 요청
          </h4>

          {/* 설명 */}
          <p className={`text-sm mb-4 ${
            selectedMethod === 'issue' ? 'text-white/90' : 'text-neutral-600'
          }`}>
            대법원 인터넷등기소에서 자동으로 등기부등본을 발급받습니다.
          </p>

          {/* 장점 */}
          <ul className={`space-y-2 text-sm ${
            selectedMethod === 'issue' ? 'text-white/80' : 'text-neutral-600'
          }`}>
            <li className="flex items-start gap-2">
              <span className={`mt-1 ${selectedMethod === 'issue' ? 'text-white' : 'text-green-600'}`}>✓</span>
              <span>최신 등기부 자동 발급</span>
            </li>
            <li className="flex items-start gap-2">
              <span className={`mt-1 ${selectedMethod === 'issue' ? 'text-white' : 'text-green-600'}`}>✓</span>
              <span>PDF 파일로 저장 가능</span>
            </li>
            <li className="flex items-start gap-2">
              <span className={`mt-1 ${selectedMethod === 'issue' ? 'text-white' : 'text-green-600'}`}>✓</span>
              <span>약 1-2분 소요</span>
            </li>
          </ul>

          {/* 비용 */}
          <div className={`mt-4 pt-4 border-t ${
            selectedMethod === 'issue' ? 'border-white/20' : 'border-neutral-200'
          }`}>
            <div className="flex items-center justify-between">
              <span className={`text-sm font-medium ${
                selectedMethod === 'issue' ? 'text-white/80' : 'text-neutral-600'
              }`}>
                비용
              </span>
              <span className={`text-lg font-bold ${
                selectedMethod === 'issue' ? 'text-white' : 'text-red-600'
              }`}>
                {registryCost} 크레딧
              </span>
            </div>
          </div>
        </button>

        {/* 옵션 2: PDF 업로드 */}
        <div
          className={`
            relative p-6 rounded-2xl border-2 transition-all duration-200
            ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
            ${isDragging ? 'border-red-500 bg-red-50' : 'bg-white border-neutral-200 hover:border-red-300'}
            ${selectedMethod === 'upload' ? 'bg-red-500 border-transparent text-white shadow-lg scale-[1.02]' : ''}
          `}
          onDragEnter={handleDragEnter}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {/* 체크마크 (선택 시) */}
          {selectedMethod === 'upload' && (
            <div className="absolute top-4 right-4">
              <div className="w-6 h-6 bg-white rounded-full flex items-center justify-center">
                <svg className="text-red-600" width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path
                    d="M13.3332 4L5.99984 11.3333L2.6665 8"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
            </div>
          )}

          {/* 무료 배지 */}
          {!selectedMethod && (
            <div className="absolute top-4 right-4">
              <span className="inline-block px-2 py-1 text-xs font-medium text-green-700 bg-green-100 rounded">
                무료
              </span>
            </div>
          )}

          {/* 아이콘 */}
          <div className="mb-4">
            <div className={`inline-flex p-3 rounded-xl ${
              selectedMethod === 'upload' ? 'bg-white/20' : 'bg-purple-50'
            }`}>
              <Upload className={`w-8 h-8 ${
                selectedMethod === 'upload' ? 'text-white' : 'text-purple-600'
              }`} />
            </div>
          </div>

          {/* 제목 */}
          <h4 className={`text-xl font-bold mb-2 ${
            selectedMethod === 'upload' ? 'text-white' : 'text-neutral-900'
          }`}>
            등기부 PDF 업로드
          </h4>

          {/* 설명 */}
          <p className={`text-sm mb-4 ${
            selectedMethod === 'upload' ? 'text-white/90' : 'text-neutral-600'
          }`}>
            이미 보유하신 등기부등본 PDF 파일을 업로드합니다.
          </p>

          {/* 장점 */}
          <ul className={`space-y-2 text-sm ${
            selectedMethod === 'upload' ? 'text-white/80' : 'text-neutral-600'
          }`}>
            <li className="flex items-start gap-2">
              <span className={`mt-1 ${selectedMethod === 'upload' ? 'text-white' : 'text-green-600'}`}>✓</span>
              <span>크레딧 차감 없음</span>
            </li>
            <li className="flex items-start gap-2">
              <span className={`mt-1 ${selectedMethod === 'upload' ? 'text-white' : 'text-green-600'}`}>✓</span>
              <span>즉시 분석 시작</span>
            </li>
            <li className="flex items-start gap-2">
              <span className={`mt-1 ${selectedMethod === 'upload' ? 'text-white' : 'text-green-600'}`}>✓</span>
              <span>10MB 이하 PDF 파일</span>
            </li>
          </ul>

          {/* 파일 업로드 영역 */}
          <div className="mt-4">
            {uploadedFile ? (
              <div className={`p-3 rounded-lg ${
                selectedMethod === 'upload' ? 'bg-white/20' : 'bg-green-50 border border-green-200'
              }`}>
                <div className="flex items-center gap-2">
                  <FileText className={`w-4 h-4 ${
                    selectedMethod === 'upload' ? 'text-white' : 'text-green-600'
                  }`} />
                  <span className={`text-sm font-medium ${
                    selectedMethod === 'upload' ? 'text-white' : 'text-green-800'
                  }`}>
                    {uploadedFile.name}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setUploadedFile(null);
                      setSelectedMethod(null);
                    }}
                    className={`ml-auto text-xs ${
                      selectedMethod === 'upload' ? 'text-white/80 hover:text-white' : 'text-neutral-500 hover:text-neutral-700'
                    }`}
                  >
                    제거
                  </button>
                </div>
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
                <div className={`p-4 border-2 border-dashed rounded-lg text-center transition-colors ${
                  isDragging
                    ? 'border-red-500 bg-red-50'
                    : 'border-neutral-300 hover:border-red-400 hover:bg-neutral-50'
                }`}>
                  <Upload className="w-6 h-6 text-neutral-400 mx-auto mb-2" />
                  <p className="text-sm text-neutral-600">
                    클릭하거나 파일을 드래그하세요
                  </p>
                  <p className="text-xs text-neutral-500 mt-1">
                    PDF 파일 (최대 10MB)
                  </p>
                </div>
              </label>
            )}
          </div>
        </div>
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
            <li>• PDF 파일 업로드 시 파싱이 어려우면 AI 모델이 자동으로 보조합니다</li>
            <li>• 발급 실패 시 차감된 크레딧은 자동 환불됩니다</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
