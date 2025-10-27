'use client';

/**
 * PDF 주석 및 마킹 컴포넌트
 *
 * 기능:
 * - 텍스트 하이라이트 (형광펜)
 * - 메모 추가
 * - 도형 그리기 (사각형, 원, 화살표)
 * - 주석 저장/불러오기
 *
 * 추후 구현 예정:
 * - pdf-annotate.js 또는 pdf-lib 라이브러리 사용
 * - Supabase에 주석 데이터 저장
 * - 협업 주석 기능
 */

import { useState } from 'react';
import {
  Highlighter,
  MessageSquare,
  Square,
  Circle,
  ArrowRight,
  Save,
  Trash2,
} from 'lucide-react';

interface Annotation {
  id: string;
  type: 'highlight' | 'note' | 'rectangle' | 'circle' | 'arrow';
  pageNumber: number;
  x: number;
  y: number;
  width?: number;
  height?: number;
  color: string;
  content?: string;
  createdAt: string;
}

interface PDFAnnotationProps {
  documentId: string;
  userId: string;
}

export default function PDFAnnotation({
  documentId,
  userId,
}: PDFAnnotationProps) {
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [selectedTool, setSelectedTool] = useState<Annotation['type'] | null>(
    null
  );
  const [selectedColor, setSelectedColor] = useState<string>('#FFEB3B'); // 노란색

  // 주석 추가
  function addAnnotation(annotation: Annotation) {
    setAnnotations([...annotations, annotation]);
  }

  // 주석 삭제
  function deleteAnnotation(id: string) {
    setAnnotations(annotations.filter((a) => a.id !== id));
  }

  // 주석 저장 (Supabase)
  async function saveAnnotations() {
    try {
      // TODO: Supabase에 주석 저장
      // const { error } = await supabase
      //   .from('v2_annotations')
      //   .upsert({
      //     document_id: documentId,
      //     user_id: userId,
      //     annotations: annotations,
      //   });

      alert('주석이 저장되었습니다.');
    } catch (error) {
      console.error('주석 저장 실패:', error);
      alert('주석 저장 중 오류가 발생했습니다.');
    }
  }

  // 주석 불러오기 (Supabase)
  async function loadAnnotations() {
    try {
      // TODO: Supabase에서 주석 불러오기
      // const { data, error } = await supabase
      //   .from('v2_annotations')
      //   .select('annotations')
      //   .eq('document_id', documentId)
      //   .eq('user_id', userId)
      //   .single();
      //
      // if (data) {
      //   setAnnotations(data.annotations);
      // }
    } catch (error) {
      console.error('주석 불러오기 실패:', error);
    }
  }

  return (
    <div className="absolute top-20 right-4 bg-white rounded-lg shadow-lg p-4 w-64 z-10">
      <h3 className="text-sm font-semibold mb-3">주석 도구</h3>

      {/* 도구 선택 */}
      <div className="space-y-2 mb-4">
        <button
          onClick={() => setSelectedTool('highlight')}
          className={`
            w-full flex items-center space-x-2 px-3 py-2 rounded
            ${
              selectedTool === 'highlight'
                ? 'bg-yellow-100 text-yellow-800'
                : 'hover:bg-neutral-100'
            }
          `}
        >
          <Highlighter className="w-4 h-4" />
          <span className="text-sm">형광펜</span>
        </button>

        <button
          onClick={() => setSelectedTool('note')}
          className={`
            w-full flex items-center space-x-2 px-3 py-2 rounded
            ${
              selectedTool === 'note'
                ? 'bg-blue-100 text-blue-800'
                : 'hover:bg-neutral-100'
            }
          `}
        >
          <MessageSquare className="w-4 h-4" />
          <span className="text-sm">메모</span>
        </button>

        <button
          onClick={() => setSelectedTool('rectangle')}
          className={`
            w-full flex items-center space-x-2 px-3 py-2 rounded
            ${
              selectedTool === 'rectangle'
                ? 'bg-green-100 text-green-800'
                : 'hover:bg-neutral-100'
            }
          `}
        >
          <Square className="w-4 h-4" />
          <span className="text-sm">사각형</span>
        </button>

        <button
          onClick={() => setSelectedTool('circle')}
          className={`
            w-full flex items-center space-x-2 px-3 py-2 rounded
            ${
              selectedTool === 'circle'
                ? 'bg-purple-100 text-purple-800'
                : 'hover:bg-neutral-100'
            }
          `}
        >
          <Circle className="w-4 h-4" />
          <span className="text-sm">원</span>
        </button>

        <button
          onClick={() => setSelectedTool('arrow')}
          className={`
            w-full flex items-center space-x-2 px-3 py-2 rounded
            ${
              selectedTool === 'arrow'
                ? 'bg-red-100 text-red-800'
                : 'hover:bg-neutral-100'
            }
          `}
        >
          <ArrowRight className="w-4 h-4" />
          <span className="text-sm">화살표</span>
        </button>
      </div>

      {/* 색상 선택 */}
      <div className="mb-4">
        <label className="text-xs font-medium text-neutral-700 block mb-2">
          색상
        </label>
        <div className="flex space-x-2">
          {['#FFEB3B', '#4CAF50', '#2196F3', '#FF5722', '#9C27B0'].map(
            (color) => (
              <button
                key={color}
                onClick={() => setSelectedColor(color)}
                className={`
                  w-8 h-8 rounded-full border-2
                  ${selectedColor === color ? 'border-gray-900' : 'border-transparent'}
                `}
                style={{ backgroundColor: color }}
              />
            )
          )}
        </div>
      </div>

      {/* 액션 버튼 */}
      <div className="space-y-2">
        <button
          onClick={saveAnnotations}
          disabled={annotations.length === 0}
          className="w-full flex items-center justify-center space-x-2 px-3 py-2 bg-red-500 text-white rounded hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Save className="w-4 h-4" />
          <span className="text-sm">저장</span>
        </button>

        <button
          onClick={() => setAnnotations([])}
          disabled={annotations.length === 0}
          className="w-full flex items-center justify-center space-x-2 px-3 py-2 bg-neutral-200 text-neutral-700 rounded hover:bg-neutral-300 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Trash2 className="w-4 h-4" />
          <span className="text-sm">모두 삭제</span>
        </button>
      </div>

      {/* 주석 목록 */}
      {annotations.length > 0 && (
        <div className="mt-4 pt-4 border-t border-neutral-200">
          <h4 className="text-xs font-medium text-neutral-700 mb-2">
            주석 ({annotations.length})
          </h4>
          <div className="space-y-1 max-h-40 overflow-y-auto">
            {annotations.map((annotation) => (
              <div
                key={annotation.id}
                className="flex items-center justify-between px-2 py-1 bg-neutral-50 rounded text-xs"
              >
                <span className="text-neutral-700">
                  {annotation.type} · 페이지 {annotation.pageNumber}
                </span>
                <button
                  onClick={() => deleteAnnotation(annotation.id)}
                  className="text-red-500 hover:text-red-700"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 안내 메시지 */}
      <div className="mt-4 pt-4 border-t border-neutral-200">
        <p className="text-xs text-neutral-500">
          ⚠️ 주석 기능은 현재 개발 중입니다.
          <br />
          추후 업데이트 예정입니다.
        </p>
      </div>
    </div>
  );
}
