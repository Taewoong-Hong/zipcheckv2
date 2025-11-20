"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import { User, Copy, Check, RefreshCw, AlertCircle } from "lucide-react";
import { Message as MessageType } from "@/types/chat";
import ContractTypeSelector from "@/components/analysis/ContractTypeSelector";
import RegistryChoiceSelector from "@/components/analysis/RegistryChoiceSelector";
import AddressSearchSelector from "@/components/chat/AddressSearchSelector";
import PriceInput, { PriceData } from "@/components/chat/PriceInput";
import AnalysisReport from "@/components/chat/AnalysisReport";
import type { ContractType, RegistryMethod } from "@/types/analysis";
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

interface AddressResult {
  roadAddr: string;
  jibunAddr: string;
  zipNo: string;
  bdNm: string;
  admCd: string;
  rnMgtSn: string;
  udrtYn: string;
  buldMnnm: string;
  buldSlno: string;
  detBdNmList: string;
}

interface MessageProps {
  message: MessageType;
  isTyping?: boolean;
  onContractTypeSelect?: (type: ContractType) => void;
  onPriceSubmit?: (data: PriceData) => void;
  onRegistryChoiceSelect?: (method: RegistryMethod, file?: File) => void;
  onAddressSelect?: (address: AddressResult, detailAddress: string) => void;
}

export default function Message({ message, isTyping, onContractTypeSelect, onPriceSubmit, onRegistryChoiceSelect, onAddressSelect }: MessageProps) {
  // 🔍 DEBUG: 메시지 렌더링 시작
  console.log('🔍 [DEBUG Message.tsx] Message 컴포넌트 렌더링:', {
    messageId: message.id,
    role: message.role,
    componentType: message.componentType,
    hasContent: !!message.content,
    contentPreview: message.content?.substring(0, 100),
    isStreaming: message.isStreaming,
    isError: message.isError,
  });
  const [displayedContent, setDisplayedContent] = useState("");
  const [isCopied, setIsCopied] = useState(false);

  // Typing animation effect
  useEffect(() => {
    if (message.isStreaming && message.role === 'assistant') {
      setDisplayedContent(message.content);
    } else if (isTyping && message.role === 'assistant') {
      let index = 0;
      const intervalId = setInterval(() => {
        if (index < message.content.length) {
          setDisplayedContent(message.content.slice(0, index + 1));
          index++;
        } else {
          clearInterval(intervalId);
        }
      }, 10); // Adjust typing speed here
      return () => clearInterval(intervalId);
    } else {
      setDisplayedContent(message.content);
    }
  }, [message.content, message.isStreaming, message.role, isTyping]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (error) {
      console.error("Failed to copy:", error);
    }
  };

  const formatTime = (date: Date) => {
    return new Intl.DateTimeFormat('ko-KR', {
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(date));
  };

  if (message.role === 'user') {
    return (
      <div className="flex justify-end mb-6 animate-fadeIn">
        <div className="flex items-start gap-3 max-w-[70%]">
          <div className="flex flex-col items-end">
            <div className="bg-neutral-100 text-neutral-800 rounded-2xl rounded-tr-sm px-4 py-3">
              <p className="text-base md:text-lg whitespace-pre-wrap break-words">
                {message.content}
              </p>
            </div>
            <span className="text-xs text-neutral-400 mt-1">
              {formatTime(message.timestamp)}
            </span>
          </div>
          <div className="w-8 h-8 rounded-full bg-neutral-200 flex items-center justify-center shrink-0">
            <User className="w-4 h-4 text-neutral-600" />
          </div>
        </div>
      </div>
    );
  }

  // 특수 컴포넌트 렌더링
  const renderSpecialComponent = () => {
    if (!message.componentType) {
      return null;
    }

    console.log('🔍 [DEBUG Message.tsx] renderSpecialComponent 호출:', {
      componentType: message.componentType,
      messageId: message.id,
      hasComponentData: !!message.componentData,
    });

    switch (message.componentType) {
      case 'contract_selector':
        return (
          <div className="mt-4">
            <ContractTypeSelector
              onSelect={(type) => {
                onContractTypeSelect?.(type);
              }}
            />
          </div>
        );

      case 'registry_choice':
        return (
          <div className="mt-4">
            <RegistryChoiceSelector
              onSelect={(file: File) => {
                onRegistryChoiceSelect?.('upload', file);
              }}
            />
          </div>
        );

      case 'address_search':
        return (
          <div className="mt-4">
            <AddressSearchSelector
              initialAddress={message.componentData?.initialAddress}
              onAddressSelect={(address, detailAddress) => {
                onAddressSelect?.(address, detailAddress);
              }}
            />
          </div>
        );

      case 'price_input':
        return (
          <div className="mt-4">
            <PriceInput
              contractType={message.componentData?.contractType || '전세'}
              onPriceSubmit={(data) => {
                onPriceSubmit?.(data);
              }}
            />
          </div>
        );

      case 'report':
        console.log('🔍 [DEBUG Message.tsx] report 케이스 진입:', {
          address: message.componentData?.address,
          contractType: message.componentData?.contract_type,
          hasRiskScore: !!message.componentData?.risk_score,
          contentLength: message.content?.length,
        });

        return (
          <div className="mt-4">
            <div className="bg-white rounded-lg shadow-sm border border-neutral-200 overflow-hidden">
              {/* 리포트 헤더 */}
              <div className="bg-gradient-to-r from-brand-primary to-brand-secondary px-6 py-4">
                <div className="flex items-start justify-between text-white">
                  <div className="flex-1">
                    <h3 className="text-lg font-bold mb-1">
                      {message.componentData?.address || '부동산 분석 리포트'}
                    </h3>
                    <p className="text-sm opacity-90">
                      {message.componentData?.contract_type || '전세'} 계약 분석
                    </p>
                  </div>
                  {/* 리스크 배지 */}
                  {message.componentData?.risk_score?.risk_level && (
                    <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                      message.componentData.risk_score.risk_level === '안전'
                        ? 'bg-green-100 text-green-800'
                        : message.componentData.risk_score.risk_level === '주의'
                        ? 'bg-yellow-100 text-yellow-800'
                        : message.componentData.risk_score.risk_level === '위험'
                        ? 'bg-orange-100 text-orange-800'
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {message.componentData.risk_score.risk_level}
                    </div>
                  )}
                </div>
              </div>

              {/* 리포트 본문 (마크다운) */}
              <div className="px-6 py-6 prose prose-neutral max-w-none">
                <ReactMarkdown
                  remarkPlugins={[remarkMath]}
                  rehypePlugins={[rehypeKatex]}
                >
                  {message.content}
                </ReactMarkdown>
              </div>

              {/* 리포트 푸터 */}
              <div className="px-6 py-4 bg-neutral-50 border-t border-neutral-200">
                <div className="flex items-center justify-between text-sm text-neutral-600">
                  <span>
                    작성일: {message.componentData?.created_at
                      ? new Date(message.componentData.created_at).toLocaleDateString('ko-KR')
                      : formatTime(message.timestamp)}
                  </span>
                  <button
                    onClick={handleCopy}
                    className="flex items-center gap-1 text-brand-primary hover:text-brand-secondary transition-colors"
                  >
                    {isCopied ? (
                      <>
                        <Check className="w-4 h-4" />
                        <span>복사됨</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        <span>리포트 복사</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="flex justify-start mb-6 animate-fadeIn">
      <div className="flex items-start gap-3 w-full max-w-full">
        <div className="w-8 h-8 flex items-center justify-center shrink-0">
          <Image
            src="/logo.png"
            alt="ZipCheck AI"
            width={32}
            height={32}
            className="object-contain"
          />
        </div>
        <div className="flex flex-col flex-1 min-w-0">
          {/* 로딩 중 (content 없고 streaming 중) → 회전 스피너 */}
          {!message.content && message.isStreaming ? (
            <div className="bg-white rounded-2xl rounded-tl-sm px-4 py-3">
              <div className="flex items-center gap-2">
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-neutral-400 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                  <span className="w-2 h-2 bg-neutral-400 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                  <span className="w-2 h-2 bg-neutral-400 rounded-full animate-bounce"></span>
                </div>
                <span className="text-sm text-neutral-600">답변 생성 중</span>
              </div>
            </div>
          ) : message.content ? (
            <div className={`bg-white rounded-2xl rounded-tl-sm px-4 py-3 ${
              message.isError ? 'border border-red-300 bg-red-50' : ''
            }`}>
              {message.isError ? (
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
                  <p className="text-base md:text-lg text-red-700">
                    {message.content}
                  </p>
                </div>
              ) : (
                <div className="prose prose-sm md:prose-base prose-neutral max-w-none
                  prose-headings:text-neutral-900 prose-headings:font-semibold
                  prose-p:text-neutral-800 prose-p:leading-relaxed
                  prose-strong:text-neutral-900 prose-strong:font-semibold
                  prose-a:text-red-600 prose-a:no-underline hover:prose-a:underline
                  prose-code:bg-neutral-100 prose-code:text-red-600 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-sm
                ">
                  <ReactMarkdown
                    remarkPlugins={[remarkMath]}
                    rehypePlugins={[rehypeKatex]}
                  >
                    {displayedContent}
                  </ReactMarkdown>
                  {message.isStreaming && (
                    <span className="inline-block w-1 h-4 ml-1 bg-neutral-400 animate-pulse" />
                  )}
                </div>
              )}
            </div>
          ) : null}

          {/* 특수 컴포넌트 렌더링 */}
          {renderSpecialComponent()}
          <div className="flex items-center gap-2 mt-2">
            <span className="text-xs text-neutral-400">
              {formatTime(message.timestamp)}
            </span>
            {!message.isError && !message.isStreaming && (
              <div className="flex items-center gap-1">
                <button
                  onClick={handleCopy}
                  className="p-1 rounded hover:bg-neutral-100 transition-colors group"
                  title="복사"
                >
                  {isCopied ? (
                    <Check className="w-3.5 h-3.5 text-green-500" />
                  ) : (
                    <Copy className="w-3.5 h-3.5 text-neutral-400 group-hover:text-neutral-600" />
                  )}
                </button>
                <button
                  className="p-1 rounded hover:bg-neutral-100 transition-colors group"
                  title="다시 생성"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-neutral-400 group-hover:text-neutral-600" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}