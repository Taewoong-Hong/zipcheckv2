'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface UploadStatus {
  status: 'idle' | 'uploading' | 'success' | 'error';
  message: string;
  caseId?: string;
}

export default function UploadCasePage() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>({
    status: 'idle',
    message: '',
  });

  // 파일 드래그 핸들러
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  // 파일 드롭 핸들러
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  // 파일 선택 핸들러
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileChange(e.target.files[0]);
    }
  };

  // 파일 검증 및 설정
  const handleFileChange = (selectedFile: File) => {
    // 파일 타입 검증
    const validTypes = [
      'application/pdf',
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/heic',
      'image/heif',
    ];

    if (!validTypes.includes(selectedFile.type)) {
      setUploadStatus({
        status: 'error',
        message: '지원하지 않는 파일 형식입니다. (PDF, JPG, PNG, HEIC만 가능)',
      });
      return;
    }

    // 파일 크기 검증 (20MB 제한)
    const maxSize = 20 * 1024 * 1024;
    if (selectedFile.size > maxSize) {
      setUploadStatus({
        status: 'error',
        message: '파일 크기는 20MB 이하로 제한됩니다.',
      });
      return;
    }

    setFile(selectedFile);
    setUploadStatus({ status: 'idle', message: '' });
  };

  // 파일 업로드 및 케이스 생성
  const handleUpload = async () => {
    if (!file) {
      setUploadStatus({
        status: 'error',
        message: '파일을 선택해주세요.',
      });
      return;
    }

    try {
      setUploadStatus({
        status: 'uploading',
        message: '파일을 업로드하고 케이스를 생성하는 중...',
      });

      const formData = new FormData();
      formData.append('file', file);
      formData.append('environment', 'dev'); // dev 환경으로 생성

      const response = await fetch('/api/cases/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const result = await response.json();

      setUploadStatus({
        status: 'success',
        message: '케이스가 성공적으로 생성되었습니다!',
        caseId: result.caseId,
      });

      // 3초 후 케이스 목록으로 이동
      setTimeout(() => {
        router.push('/dev/cases');
      }, 3000);

    } catch (error: any) {
      console.error('Upload error:', error);
      setUploadStatus({
        status: 'error',
        message: error.message || '업로드 중 오류가 발생했습니다.',
      });
    }
  };

  // 파일 제거
  const handleRemoveFile = () => {
    setFile(null);
    setUploadStatus({ status: 'idle', message: '' });
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-3xl mx-auto">
        {/* 헤더 */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">케이스 업로드</h1>
            <p className="text-gray-600 mt-2">
              등기부등본 PDF 또는 이미지를 업로드하여 자동으로 케이스를 생성하세요
            </p>
          </div>
          <button
            onClick={() => router.push('/dev/cases')}
            className="px-4 py-2 text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg hover:bg-gray-100"
          >
            ← 목록으로
          </button>
        </div>

        {/* 업로드 영역 */}
        <div className="bg-white rounded-lg shadow p-8">
          {/* 드래그 앤 드롭 영역 */}
          <div
            className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
              dragActive
                ? 'border-red-500 bg-red-50'
                : 'border-gray-300 hover:border-gray-400'
            }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            {!file ? (
              <>
                <svg
                  className="mx-auto h-12 w-12 text-gray-400"
                  stroke="currentColor"
                  fill="none"
                  viewBox="0 0 48 48"
                >
                  <path
                    d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <div className="mt-4">
                  <label
                    htmlFor="file-upload"
                    className="cursor-pointer inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700"
                  >
                    <span>파일 선택</span>
                    <input
                      id="file-upload"
                      name="file-upload"
                      type="file"
                      className="sr-only"
                      accept=".pdf,.jpg,.jpeg,.png,.heic,.heif"
                      onChange={handleFileSelect}
                    />
                  </label>
                  <p className="text-sm text-gray-600 mt-2">
                    또는 파일을 여기에 드래그하세요
                  </p>
                </div>
                <p className="text-xs text-gray-500 mt-4">
                  PDF, JPG, PNG, HEIC (최대 20MB)
                </p>
              </>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-center space-x-2">
                  <svg
                    className="h-8 w-8 text-red-500"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                  <div className="text-left">
                    <p className="font-medium text-gray-900">{file.name}</p>
                    <p className="text-sm text-gray-500">
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleRemoveFile}
                  className="text-sm text-red-600 hover:text-red-800"
                >
                  파일 제거
                </button>
              </div>
            )}
          </div>

          {/* 상태 메시지 */}
          {uploadStatus.message && (
            <div
              className={`mt-6 p-4 rounded-lg ${
                uploadStatus.status === 'error'
                  ? 'bg-red-50 text-red-800 border border-red-200'
                  : uploadStatus.status === 'success'
                  ? 'bg-green-50 text-green-800 border border-green-200'
                  : 'bg-blue-50 text-blue-800 border border-blue-200'
              }`}
            >
              <div className="flex items-center">
                {uploadStatus.status === 'uploading' && (
                  <svg
                    className="animate-spin h-5 w-5 mr-3"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                      fill="none"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                )}
                <p className="font-medium">{uploadStatus.message}</p>
              </div>
              {uploadStatus.caseId && (
                <p className="text-sm mt-2">
                  케이스 ID: {uploadStatus.caseId}
                </p>
              )}
            </div>
          )}

          {/* 업로드 버튼 */}
          <div className="mt-8 flex justify-end">
            <button
              onClick={handleUpload}
              disabled={!file || uploadStatus.status === 'uploading'}
              className={`px-6 py-3 rounded-lg font-medium ${
                !file || uploadStatus.status === 'uploading'
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-red-600 text-white hover:bg-red-700'
              }`}
            >
              {uploadStatus.status === 'uploading' ? '업로드 중...' : '케이스 생성'}
            </button>
          </div>
        </div>

        {/* 안내 사항 */}
        <div className="mt-8 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-yellow-800 text-sm font-medium">ℹ️ 안내사항</p>
          <ul className="text-yellow-700 text-sm mt-2 space-y-1 list-disc list-inside">
            <li>등기부등본 PDF 또는 스캔 이미지를 업로드하세요</li>
            <li>파일 업로드 후 자동으로 케이스가 생성됩니다</li>
            <li>생성된 케이스는 개발 환경(dev)에 저장됩니다</li>
            <li>케이스 생성 후 자동으로 파싱이 진행됩니다</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
