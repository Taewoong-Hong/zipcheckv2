/**
 * 주소 검색 모달 컴포넌트
 *
 * @description
 * 도로명/지번 주소 검색 및 선택 UI
 * juso-proxy API를 사용하여 주소를 검색하고 선택
 *
 * @author 집체크 개발팀
 * @version 1.0.0
 * @date 2025-01-27
 */

'use client';

import { useState, useEffect, useRef } from 'react';
import { Search, X, MapPin, Building } from 'lucide-react';
import type { JusoSearchResult, AddressInfo } from '@/types/analysis';

export interface AddressSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (address: AddressInfo) => void;
  initialQuery?: string;
}

export default function AddressSearchModal({
  isOpen,
  onClose,
  onSelect,
  initialQuery = '',
}: AddressSearchModalProps) {
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<JusoSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [error, setError] = useState<string>('');

  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  // 모달이 열릴 때 포커스
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // 주소 검색
  const searchAddress = async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([]);
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const response = await fetch(`/api/address/search?q=${encodeURIComponent(searchQuery)}`);

      if (!response.ok) {
        throw new Error('주소 검색에 실패했습니다.');
      }

      const data = await response.json();
      setResults(data.results || []);
      setSelectedIndex(0);

      if (data.results?.length === 0) {
        setError('검색 결과가 없습니다. 다른 키워드로 검색해주세요.');
      }
    } catch (err) {
      console.error('Address search error:', err);
      setError(err instanceof Error ? err.message : '주소 검색 중 오류가 발생했습니다.');
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  };

  // 디바운스 검색
  useEffect(() => {
    const timer = setTimeout(() => {
      if (query.length >= 2) {
        searchAddress(query);
      } else {
        setResults([]);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  // 주소 선택 처리
  const handleSelect = (result: JusoSearchResult) => {
    const addressInfo: AddressInfo = {
      road: result.roadAddr,
      lot: result.jibunAddr,
      zipCode: result.zipNo,
      buildingCode: result.bdMgtSn,
      jusoDetail: result,
    };

    onSelect(addressInfo);
    onClose();
  };

  // 키보드 네비게이션
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (results.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % results.length);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + results.length) % results.length);
        break;
      case 'Enter':
        e.preventDefault();
        if (results[selectedIndex]) {
          handleSelect(results[selectedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        onClose();
        break;
    }
  };

  // 선택된 항목 스크롤
  useEffect(() => {
    if (resultsRef.current) {
      const selectedElement = resultsRef.current.children[selectedIndex] as HTMLElement;
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }, [selectedIndex]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* 오버레이 */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* 모달 */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 max-h-[80vh] flex flex-col">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200">
          <h2 className="text-xl font-bold text-neutral-900">주소 검색</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-neutral-100 transition-colors"
            aria-label="닫기"
          >
            <X className="w-5 h-5 text-neutral-600" />
          </button>
        </div>

        {/* 검색 입력 */}
        <div className="px-6 py-4 border-b border-neutral-200">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="도로명, 지번 또는 건물명을 입력하세요 (예: 강남구 테헤란로 123)"
              className="w-full pl-12 pr-4 py-3 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-shadow"
            />
          </div>

          {/* 안내 메시지 */}
          <p className="mt-2 text-sm text-neutral-600">
            💡 팁: 최소 2자 이상 입력하면 자동으로 검색됩니다. ↑↓ 화살표로 선택, Enter로 확정
          </p>
        </div>

        {/* 검색 결과 */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {isLoading && (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-500" />
              <span className="ml-3 text-neutral-600">검색 중...</span>
            </div>
          )}

          {error && (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <p className="text-neutral-600 mb-2">{error}</p>
                <p className="text-sm text-neutral-500">
                  예: 서울특별시 강남구 테헤란로 123
                </p>
              </div>
            </div>
          )}

          {!isLoading && !error && results.length === 0 && query.length >= 2 && (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <MapPin className="w-12 h-12 text-neutral-300 mx-auto mb-3" />
                <p className="text-neutral-600 mb-2">검색 결과가 없습니다.</p>
                <p className="text-sm text-neutral-500">
                  다른 키워드로 다시 검색해주세요.
                </p>
              </div>
            </div>
          )}

          {!isLoading && results.length > 0 && (
            <div ref={resultsRef} className="space-y-2">
              {results.map((result, index) => (
                <button
                  key={index}
                  onClick={() => handleSelect(result)}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                    index === selectedIndex
                      ? 'border-red-500 bg-red-50'
                      : 'border-neutral-200 hover:border-red-300 hover:bg-neutral-50'
                  }`}
                >
                  {/* 도로명 주소 */}
                  <div className="flex items-start gap-2 mb-2">
                    <Building className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="font-semibold text-neutral-900">
                        {result.roadAddr}
                      </p>
                      {result.bdNm && (
                        <p className="text-sm text-neutral-600 mt-1">
                          건물명: {result.bdNm}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* 지번 주소 */}
                  <div className="flex items-start gap-2 ml-7">
                    <p className="text-sm text-neutral-600">
                      지번: {result.jibunAddr}
                    </p>
                  </div>

                  {/* 우편번호 */}
                  <div className="flex items-center gap-2 ml-7 mt-1">
                    <span className="inline-block px-2 py-0.5 text-xs font-medium text-red-700 bg-red-100 rounded">
                      {result.zipNo}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 푸터 */}
        <div className="px-6 py-4 border-t border-neutral-200 bg-neutral-50">
          <p className="text-xs text-neutral-500 text-center">
            주소 데이터는 행정안전부 도로명주소 API를 사용합니다.
          </p>
        </div>
      </div>
    </div>
  );
}
