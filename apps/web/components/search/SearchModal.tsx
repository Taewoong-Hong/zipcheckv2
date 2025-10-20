"use client";

import React, { useState, useEffect, useRef } from "react";
import { X, Search, Clock, FileText, MessageSquare, Calendar, ChevronRight } from "lucide-react";

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface SearchResult {
  id: string;
  title: string;
  preview: string;
  date: string;
  type: "today" | "yesterday" | "older";
  category: "chat" | "contract" | "analysis";
  messages?: number;
}

export default function SearchModal({ isOpen, onClose }: SearchModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<"all" | "chat" | "contract" | "analysis">("all");
  const modalRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Mock search results
  const mockResults: SearchResult[] = [
    {
      id: "1",
      title: "전세 계약서 검토",
      preview: "강남구 아파트 전세 계약서의 특약사항과 보증금 보호 조건을 분석했습니다",
      date: "2024-01-20",
      type: "today",
      category: "contract",
      messages: 12
    },
    {
      id: "2",
      title: "매매 계약 리스크 분석",
      preview: "서초구 오피스텔 매매 계약의 권리관계와 담보 설정 내용을 검토했습니다",
      date: "2024-01-19",
      type: "yesterday",
      category: "analysis",
      messages: 8
    },
    {
      id: "3",
      title: "등기부등본 해석",
      preview: "근저당권 설정과 전세권 관계에 대한 상세한 분석을 진행했습니다",
      date: "2024-01-15",
      type: "older",
      category: "chat",
      messages: 5
    },
    {
      id: "4",
      title: "임대차 계약서 특약사항",
      preview: "원상복구 비용과 관련된 특약사항의 법적 효력을 검토했습니다",
      date: "2024-01-14",
      type: "older",
      category: "contract",
      messages: 7
    },
    {
      id: "5",
      title: "보증금 보호 조건 확인",
      preview: "주택임대차보호법상 대항력과 우선변제권 취득 요건을 설명했습니다",
      date: "2024-01-13",
      type: "older",
      category: "chat",
      messages: 10
    }
  ];

  // Filter results
  const filteredResults = mockResults.filter(result => {
    const matchesQuery = result.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        result.preview.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === "all" || result.category === selectedCategory;
    return matchesQuery && matchesCategory;
  });

  // Group results by date
  const groupedResults = {
    today: filteredResults.filter(r => r.type === "today"),
    yesterday: filteredResults.filter(r => r.type === "yesterday"),
    older: filteredResults.filter(r => r.type === "older")
  };

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Handle ESC key
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "chat":
        return <MessageSquare className="w-4 h-4" />;
      case "contract":
        return <FileText className="w-4 h-4" />;
      case "analysis":
        return <Search className="w-4 h-4" />;
      default:
        return <Clock className="w-4 h-4" />;
    }
  };

  const getCategoryLabel = (category: string) => {
    switch (category) {
      case "chat":
        return "채팅";
      case "contract":
        return "계약서";
      case "analysis":
        return "분석";
      default:
        return "";
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 animate-fadeIn"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4">
        <div
          ref={modalRef}
          className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl animate-slideUp overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center gap-3 p-4 border-b border-neutral-200">
            <Search className="w-5 h-5 text-neutral-400" />
            <input
              ref={inputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="채팅 검색..."
              className="flex-1 text-lg outline-none placeholder-neutral-400"
            />
            <button
              onClick={onClose}
              className="p-2 hover:bg-neutral-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-neutral-500" />
            </button>
          </div>

          {/* Category Tabs */}
          <div className="flex items-center gap-2 px-4 py-3 border-b border-neutral-100">
            <span className="text-sm text-neutral-500 mr-2">필터:</span>
            <button
              onClick={() => setSelectedCategory("all")}
              className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                selectedCategory === "all"
                  ? "bg-brand-primary text-white"
                  : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
              }`}
            >
              전체
            </button>
            <button
              onClick={() => setSelectedCategory("chat")}
              className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                selectedCategory === "chat"
                  ? "bg-brand-primary text-white"
                  : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
              }`}
            >
              채팅
            </button>
            <button
              onClick={() => setSelectedCategory("contract")}
              className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                selectedCategory === "contract"
                  ? "bg-brand-primary text-white"
                  : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
              }`}
            >
              계약서
            </button>
            <button
              onClick={() => setSelectedCategory("analysis")}
              className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                selectedCategory === "analysis"
                  ? "bg-brand-primary text-white"
                  : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
              }`}
            >
              분석
            </button>
          </div>

          {/* Search Results */}
          <div className="max-h-[500px] overflow-y-auto">
            {filteredResults.length > 0 ? (
              <div className="p-2">
                {/* Today */}
                {groupedResults.today.length > 0 && (
                  <div className="mb-4">
                    <div className="px-3 py-2 text-xs font-medium text-neutral-500 uppercase">
                      오늘
                    </div>
                    {groupedResults.today.map((result) => (
                      <button
                        key={result.id}
                        className="w-full text-left px-3 py-3 hover:bg-neutral-50 rounded-lg transition-colors group"
                        onClick={() => {
                          console.log("Navigate to:", result.id);
                          onClose();
                        }}
                      >
                        <div className="flex items-start gap-3">
                          <div className="w-8 h-8 bg-neutral-100 rounded-lg flex items-center justify-center text-neutral-500 group-hover:bg-brand-primary/10 group-hover:text-brand-primary transition-colors">
                            {getCategoryIcon(result.category)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="font-medium text-neutral-800 truncate">
                                {result.title}
                              </h4>
                              <span className="text-xs px-1.5 py-0.5 bg-neutral-100 text-neutral-600 rounded">
                                {getCategoryLabel(result.category)}
                              </span>
                            </div>
                            <p className="text-sm text-neutral-500 line-clamp-1">
                              {result.preview}
                            </p>
                            {result.messages && (
                              <div className="flex items-center gap-3 mt-1.5 text-xs text-neutral-400">
                                <span className="flex items-center gap-1">
                                  <MessageSquare className="w-3 h-3" />
                                  {result.messages}개 메시지
                                </span>
                              </div>
                            )}
                          </div>
                          <ChevronRight className="w-4 h-4 text-neutral-300 group-hover:text-brand-primary transition-colors" />
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {/* Yesterday */}
                {groupedResults.yesterday.length > 0 && (
                  <div className="mb-4">
                    <div className="px-3 py-2 text-xs font-medium text-neutral-500 uppercase">
                      어제
                    </div>
                    {groupedResults.yesterday.map((result) => (
                      <button
                        key={result.id}
                        className="w-full text-left px-3 py-3 hover:bg-neutral-50 rounded-lg transition-colors group"
                        onClick={() => {
                          console.log("Navigate to:", result.id);
                          onClose();
                        }}
                      >
                        <div className="flex items-start gap-3">
                          <div className="w-8 h-8 bg-neutral-100 rounded-lg flex items-center justify-center text-neutral-500 group-hover:bg-brand-primary/10 group-hover:text-brand-primary transition-colors">
                            {getCategoryIcon(result.category)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="font-medium text-neutral-800 truncate">
                                {result.title}
                              </h4>
                              <span className="text-xs px-1.5 py-0.5 bg-neutral-100 text-neutral-600 rounded">
                                {getCategoryLabel(result.category)}
                              </span>
                            </div>
                            <p className="text-sm text-neutral-500 line-clamp-1">
                              {result.preview}
                            </p>
                            {result.messages && (
                              <div className="flex items-center gap-3 mt-1.5 text-xs text-neutral-400">
                                <span className="flex items-center gap-1">
                                  <MessageSquare className="w-3 h-3" />
                                  {result.messages}개 메시지
                                </span>
                              </div>
                            )}
                          </div>
                          <ChevronRight className="w-4 h-4 text-neutral-300 group-hover:text-brand-primary transition-colors" />
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {/* Older */}
                {groupedResults.older.length > 0 && (
                  <div className="mb-4">
                    <div className="px-3 py-2 text-xs font-medium text-neutral-500 uppercase">
                      이전
                    </div>
                    {groupedResults.older.map((result) => (
                      <button
                        key={result.id}
                        className="w-full text-left px-3 py-3 hover:bg-neutral-50 rounded-lg transition-colors group"
                        onClick={() => {
                          console.log("Navigate to:", result.id);
                          onClose();
                        }}
                      >
                        <div className="flex items-start gap-3">
                          <div className="w-8 h-8 bg-neutral-100 rounded-lg flex items-center justify-center text-neutral-500 group-hover:bg-brand-primary/10 group-hover:text-brand-primary transition-colors">
                            {getCategoryIcon(result.category)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="font-medium text-neutral-800 truncate">
                                {result.title}
                              </h4>
                              <span className="text-xs px-1.5 py-0.5 bg-neutral-100 text-neutral-600 rounded">
                                {getCategoryLabel(result.category)}
                              </span>
                            </div>
                            <p className="text-sm text-neutral-500 line-clamp-1">
                              {result.preview}
                            </p>
                            <div className="flex items-center gap-3 mt-1.5 text-xs text-neutral-400">
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {new Date(result.date).toLocaleDateString('ko-KR')}
                              </span>
                              {result.messages && (
                                <span className="flex items-center gap-1">
                                  <MessageSquare className="w-3 h-3" />
                                  {result.messages}개 메시지
                                </span>
                              )}
                            </div>
                          </div>
                          <ChevronRight className="w-4 h-4 text-neutral-300 group-hover:text-brand-primary transition-colors" />
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="p-12 text-center">
                <Search className="w-12 h-12 text-neutral-200 mx-auto mb-3" />
                <p className="text-neutral-500">
                  {searchQuery ? "검색 결과가 없습니다" : "검색어를 입력하세요"}
                </p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-3 border-t border-neutral-100 bg-neutral-50">
            <div className="flex items-center justify-between text-xs text-neutral-500">
              <div className="flex items-center gap-4">
                <span>
                  <kbd className="px-1.5 py-0.5 bg-white rounded border border-neutral-200">ESC</kbd> 닫기
                </span>
                <span>
                  <kbd className="px-1.5 py-0.5 bg-white rounded border border-neutral-200">↑↓</kbd> 탐색
                </span>
                <span>
                  <kbd className="px-1.5 py-0.5 bg-white rounded border border-neutral-200">Enter</kbd> 열기
                </span>
              </div>
              {filteredResults.length > 0 && (
                <span>{filteredResults.length}개 결과</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}