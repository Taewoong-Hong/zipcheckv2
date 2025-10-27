'use client';

/**
 * 집체크 PDF 뷰어 컴포넌트
 *
 * 기능:
 * - PDF 렌더링 (react-pdf 기반)
 * - 페이지 네비게이션 (이전/다음, 페이지 점프)
 * - 확대/축소 (50% ~ 200%)
 * - 전체화면 모드
 * - 다운로드 (인증된 사용자만)
 * - 회전 (90도 단위)
 * - 검색 기능 (추후 구현)
 *
 * 사용 예시:
 * <PDFViewer fileUrl="/api/pdf/view/doc123" fileName="등기부등본.pdf" />
 */

import { useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import {
  ZoomIn,
  ZoomOut,
  ChevronLeft,
  ChevronRight,
  Download,
  Maximize,
  RotateCw,
  X,
} from 'lucide-react';

// CSS imports commented out - may not exist in all react-pdf versions
// import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
// import 'react-pdf/dist/esm/Page/TextLayer.css';

// PDF.js worker 설정
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.js`;

interface PDFViewerProps {
  fileUrl: string;
  fileName?: string;
  allowDownload?: boolean;
  onClose?: () => void;
}

export default function PDFViewer({
  fileUrl,
  fileName = 'document.pdf',
  allowDownload = true,
  onClose,
}: PDFViewerProps) {
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.0);
  const [rotation, setRotation] = useState<number>(0);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // PDF 로드 성공
  function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
    setNumPages(numPages);
    setIsLoading(false);
  }

  // PDF 로드 실패
  function onDocumentLoadError(error: Error) {
    console.error('PDF 로드 실패:', error);
    setIsLoading(false);
  }

  // 페이지 변경
  function changePage(offset: number) {
    setPageNumber((prevPageNumber) => {
      const newPage = prevPageNumber + offset;
      if (newPage < 1 || newPage > numPages) return prevPageNumber;
      return newPage;
    });
  }

  // 확대/축소
  function changeScale(offset: number) {
    setScale((prevScale) => {
      const newScale = prevScale + offset;
      if (newScale < 0.5 || newScale > 2.0) return prevScale;
      return newScale;
    });
  }

  // 회전
  function rotate() {
    setRotation((prevRotation) => (prevRotation + 90) % 360);
  }

  // 전체화면 토글
  function toggleFullscreen() {
    setIsFullscreen(!isFullscreen);
  }

  // 다운로드
  async function handleDownload() {
    if (!allowDownload) {
      alert('다운로드 권한이 없습니다.');
      return;
    }

    try {
      const response = await fetch(fileUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('다운로드 실패:', error);
      alert('다운로드 중 오류가 발생했습니다.');
    }
  }

  return (
    <div
      className={`
        flex flex-col bg-neutral-100
        ${isFullscreen ? 'fixed inset-0 z-50' : 'relative h-full'}
      `}
    >
      {/* 툴바 */}
      <div className="bg-white border-b border-neutral-200 px-4 py-3 flex items-center justify-between shadow-sm">
        {/* 좌측: 파일명 */}
        <div className="flex items-center space-x-3">
          <h3 className="text-sm font-medium text-gray-900 truncate max-w-xs">
            {fileName}
          </h3>
          {isLoading && (
            <span className="text-xs text-neutral-500">로딩 중...</span>
          )}
        </div>

        {/* 중앙: 페이지 네비게이션 */}
        <div className="flex items-center space-x-2">
          <button
            onClick={() => changePage(-1)}
            disabled={pageNumber <= 1}
            className="p-2 rounded hover:bg-neutral-100 disabled:opacity-30 disabled:cursor-not-allowed"
            title="이전 페이지"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <div className="flex items-center space-x-2 text-sm">
            <input
              type="number"
              value={pageNumber}
              onChange={(e) => {
                const page = parseInt(e.target.value);
                if (page >= 1 && page <= numPages) {
                  setPageNumber(page);
                }
              }}
              className="w-12 px-2 py-1 text-center border border-neutral-300 rounded"
              min={1}
              max={numPages}
            />
            <span className="text-neutral-600">/ {numPages || '-'}</span>
          </div>

          <button
            onClick={() => changePage(1)}
            disabled={pageNumber >= numPages}
            className="p-2 rounded hover:bg-neutral-100 disabled:opacity-30 disabled:cursor-not-allowed"
            title="다음 페이지"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* 우측: 도구 */}
        <div className="flex items-center space-x-1">
          {/* 축소 */}
          <button
            onClick={() => changeScale(-0.1)}
            disabled={scale <= 0.5}
            className="p-2 rounded hover:bg-neutral-100 disabled:opacity-30 disabled:cursor-not-allowed"
            title="축소 (Ctrl + -)"
          >
            <ZoomOut className="w-4 h-4" />
          </button>

          {/* 배율 표시 */}
          <span className="text-sm text-neutral-600 px-2">
            {Math.round(scale * 100)}%
          </span>

          {/* 확대 */}
          <button
            onClick={() => changeScale(0.1)}
            disabled={scale >= 2.0}
            className="p-2 rounded hover:bg-neutral-100 disabled:opacity-30 disabled:cursor-not-allowed"
            title="확대 (Ctrl + +)"
          >
            <ZoomIn className="w-4 h-4" />
          </button>

          {/* 구분선 */}
          <div className="w-px h-6 bg-neutral-300 mx-2" />

          {/* 회전 */}
          <button
            onClick={rotate}
            className="p-2 rounded hover:bg-neutral-100"
            title="시계방향 회전"
          >
            <RotateCw className="w-4 h-4" />
          </button>

          {/* 전체화면 */}
          <button
            onClick={toggleFullscreen}
            className="p-2 rounded hover:bg-neutral-100"
            title="전체화면"
          >
            <Maximize className="w-4 h-4" />
          </button>

          {/* 다운로드 */}
          {allowDownload && (
            <button
              onClick={handleDownload}
              className="p-2 rounded hover:bg-neutral-100"
              title="다운로드"
            >
              <Download className="w-4 h-4" />
            </button>
          )}

          {/* 닫기 */}
          {onClose && (
            <>
              <div className="w-px h-6 bg-neutral-300 mx-2" />
              <button
                onClick={onClose}
                className="p-2 rounded hover:bg-neutral-100"
                title="닫기"
              >
                <X className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* PDF 뷰어 영역 */}
      <div className="flex-1 overflow-auto bg-neutral-200 p-4">
        <div className="flex justify-center">
          <Document
            file={fileUrl}
            onLoadSuccess={onDocumentLoadSuccess}
            onLoadError={onDocumentLoadError}
            loading={
              <div className="flex items-center justify-center h-96">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-500 mx-auto mb-4" />
                  <p className="text-neutral-600">PDF 로딩 중...</p>
                </div>
              </div>
            }
            error={
              <div className="flex items-center justify-center h-96">
                <div className="text-center">
                  <p className="text-red-600 font-medium mb-2">
                    PDF를 불러올 수 없습니다
                  </p>
                  <p className="text-sm text-neutral-600">
                    파일이 손상되었거나 권한이 없습니다.
                  </p>
                </div>
              </div>
            }
          >
            <Page
              pageNumber={pageNumber}
              scale={scale}
              rotate={rotation}
              loading={
                <div className="flex items-center justify-center h-96">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-500" />
                </div>
              }
              renderTextLayer={true}
              renderAnnotationLayer={true}
              className="shadow-lg"
            />
          </Document>
        </div>
      </div>

      {/* 하단 정보바 */}
      <div className="bg-white border-t border-neutral-200 px-4 py-2 text-xs text-neutral-600 flex items-center justify-between">
        <div>
          {numPages > 0 && (
            <span>
              총 {numPages}페이지 · 배율 {Math.round(scale * 100)}% · 회전{' '}
              {rotation}°
            </span>
          )}
        </div>
        <div className="text-neutral-500">
          <kbd className="px-1.5 py-0.5 bg-neutral-100 border border-neutral-300 rounded text-xs">
            Ctrl + ±
          </kbd>{' '}
          확대/축소
        </div>
      </div>
    </div>
  );
}
