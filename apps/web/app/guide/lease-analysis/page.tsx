"use client";

import React, { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Play,
  Pause,
  RotateCcw,
  Send
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";

// 메시지 타입 정의
type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  isTyping?: boolean;
  timestamp: Date;
};

// 타이핑 애니메이션 컴포넌트
const TypingMessage = ({ content, onComplete }: { content: string; onComplete?: () => void }) => {
  const [displayedContent, setDisplayedContent] = useState("");
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (currentIndex < content.length) {
      const timer = setTimeout(() => {
        setDisplayedContent(prev => prev + content[currentIndex]);
        setCurrentIndex(prev => prev + 1);
      }, 8); // 20ms에서 8ms로 변경 (2.5배 빠르게)
      return () => clearTimeout(timer);
    } else if (onComplete) {
      onComplete();
    }
  }, [currentIndex, content, onComplete]);

  return (
    <>
      {displayedContent}
      {currentIndex < content.length && (
        <span className="inline-block w-0.5 h-4 bg-neutral-800 ml-0.5 animate-pulse" />
      )}
    </>
  );
};

// 메시지 컴포넌트
const MessageBubble = ({ message, isTyping }: { message: Message; isTyping: boolean }) => {
  const isUser = message.role === "user";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`flex gap-3 ${isUser ? "flex-row-reverse" : ""}`}
    >
      {/* 프로필 아이콘 - 우리 채팅 서비스와 동일하게 */}
      <div className="flex-shrink-0">
        {isUser ? (
          <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-neutral-200 flex items-center justify-center">
            <span className="text-neutral-600 text-xs md:text-sm font-medium">나</span>
          </div>
        ) : (
          <div className="w-8 h-8 md:w-10 md:h-10 flex items-center justify-center">
            <Image
              src="/logo.png"
              alt="ZipCheck AI"
              width={32}
              height={32}
              className="object-contain"
            />
          </div>
        )}
      </div>

      {/* 메시지 내용 */}
      <div className={`flex flex-col gap-1 max-w-[80%] md:max-w-[70%] ${isUser ? "items-end" : ""}`}>
        <div className={`px-4 py-3 rounded-2xl ${
          isUser
            ? "bg-brand-primary text-white"
            : "bg-white border border-neutral-200"
        }`}>
          {isTyping && !isUser ? (
            <TypingMessage content={message.content} />
          ) : (
            <p className="text-sm md:text-base whitespace-pre-wrap leading-relaxed">
              {message.content}
            </p>
          )}
        </div>
        <span className="text-xs text-neutral-400 px-1">
          {message.timestamp.toLocaleTimeString('ko-KR', {
            hour: '2-digit',
            minute: '2-digit'
          })}
        </span>
      </div>
    </motion.div>
  );
};

export default function LeaseAnalysisGuide() {
  // 첫 메시지를 초기값으로 설정
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "msg-0",
      role: "assistant",
      content: "안녕하세요! 집체크 AI 분석 시스템입니다. 🏠\n\n부동산 계약 리스크 분석을 도와드리겠습니다.\n검토하실 물건의 주소를 입력해주세요.",
      isTyping: false,
      timestamp: new Date()
    }
  ]);
  const [currentStep, setCurrentStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 시나리오 메시지들 (첫 메시지 제외)
  const scenario: { role: "user" | "assistant"; content: string }[] = [
    {
      role: "user",
      content: "경기도 수원시 영통구 영통로 123, ○○아파트 803동 1203호"
    },
    {
      role: "assistant",
      content: "경기도 수원시 영통구 영통로 123, ○○아파트 803동 1203호를 확인했습니다.\n\n계약 형태와 금액을 알려주시면 상세한 리스크 분석을 시작하겠습니다.\n예시: 전세 5억원, 월세 보증금 1억 월 50만원 등"
    },
    {
      role: "user",
      content: "전세 보증금 1억 5천만원, 월세 30만원으로 계약하려고 합니다."
    },
    {
      role: "assistant",
      content: "네, 알겠습니다. 보증금 1억 5천만원, 월세 30만원 조건으로 계약 리스크를 분석하겠습니다.\n\n지금부터 등기부등본, 건축물대장, 시세 정보를 순차적으로 검토하여 종합적인 리스크 평가를 진행하겠습니다."
    },
    {
      role: "assistant",
      content: "📋 **[1단계] 등기부등본 분석**\n\n권리관계를 확인한 결과입니다:\n\n• **1순위**: 근저당권 3.2억원 (○○은행)\n• **2순위**: 압류 (국세청) \n• **3순위**: 전세권 2억원 (기존 임차인)\n\n⚠️ **주의사항**\n선순위 채권 총액이 예상 매매가의 40%를 초과합니다. 경매 시 보증금 회수에 리스크가 있을 수 있습니다."
    },
    {
      role: "assistant",
      content: "🏢 **[2단계] 건축물대장 검토**\n\n건축물의 적법성을 확인했습니다:\n\n✅ 위반건축물 여부: **해당없음**\n✅ 사용승인일: 2007년 5월 12일\n✅ 건물 용도: 공동주택(아파트)\n✅ 전용면적: 84.92㎡\n✅ 용적률/건폐율: 정상 범위\n\n건축물 관련 법적 문제는 발견되지 않았습니다."
    },
    {
      role: "assistant",
      content: "📊 **[3단계] 시세 분석**\n\n주변 실거래가 및 전세 시세를 분석했습니다:\n\n• **최근 매매 실거래가**: 8.2억 ~ 8.5억원\n• **평균 전세가**: 5.5억 ~ 5.8억원\n• **전세가율**: 약 69%\n• **경매 낙찰가 평균**: 7.2억원 (낙찰률 87%)\n\n💡 현재 요청하신 보증금 1.5억원은 전세가 대비 낮은 편이나, 선순위 권리관계를 고려하면 주의가 필요합니다."
    },
    {
      role: "assistant",
      content: "⚠️ **[4단계] 종합 리스크 평가**\n\n분석 결과를 종합하면:\n\n**🔴 고위험 요소**\n• 선순위 근저당 3.2억 설정\n• 국세청 압류 존재\n• 기존 전세권자 있음\n\n**🟡 중간 위험**\n• 전세가율 69% (적정선 초과)\n• 다수의 권리관계 복잡\n\n**🟢 양호한 요소**\n• 건축물 적법성 확인\n• 시세 대비 낮은 보증금"
    },
    {
      role: "assistant",
      content: "✅ **[최종 권고사항]**\n\n안전한 계약을 위해 다음을 권장드립니다:\n\n**1. 보증금 조정**\n   • 현 조건에서는 1.2억 이하로 낮추기\n   • 또는 보증금↓ 월세↑ 전환 검토\n\n**2. 필수 안전장치**\n   • ✔️ 전세보증보험 가입 (HUG/SGI)\n   • ✔️ 확정일자 당일 받기\n   • ✔️ 전입신고 즉시 완료\n\n**3. 특약사항 명시**\n   • 근저당 추가 설정 금지\n   • 세금 완납 증명서 요구\n   • 보증금 반환 지연 시 지연이자\n\n**4. 추가 확인사항**\n   • 임대인 신분증과 등기 일치 확인\n   • 계약서 공증 권장\n   • 이사 당일 열쇠 인수 전 재확인\n\n궁금한 점이 있으시면 언제든 문의해주세요! 😊"
    }
  ];

  // 스크롤 자동 이동
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // 메시지 추가 함수 - useRef로 isPlaying 상태 추적
  const isPlayingRef = useRef(isPlaying);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  const addMessage = (step: number) => {
    if (step >= scenario.length) {
      setIsPlaying(false);
      return;
    }

    const messageData = scenario[step];
    const newMessage: Message = {
      id: `msg-${step + 1}`, // 첫 메시지가 0이므로 +1
      role: messageData.role,
      content: messageData.content,
      isTyping: messageData.role === "assistant",
      timestamp: new Date()
    };

    setMessages(prev => [...prev, newMessage]);

    // 현재 스텝 업데이트
    setCurrentStep(step);

    if (messageData.role === "assistant") {
      setIsTyping(true);
      // 타이핑 완료 시간 계산 (글자 수 * 8ms + 여유 시간)
      const typingDuration = Math.min(messageData.content.length * 8 + 300, 3500); // 최대 3.5초

      setTimeout(() => {
        setIsTyping(false);
        // 다음 메시지로 진행 - ref 사용으로 최신 상태 확인
        if (step < scenario.length - 1 && isPlayingRef.current) {
          setTimeout(() => {
            addMessage(step + 1);
          }, 600); // 0.6초 대기 후 다음
        } else if (step === scenario.length - 1) {
          setIsPlaying(false);
        }
      }, typingDuration);
    } else {
      // 사용자 메시지는 짧게 대기 후 다음으로 - ref 사용
      if (step < scenario.length - 1 && isPlayingRef.current) {
        setTimeout(() => {
          addMessage(step + 1);
        }, 800); // 0.8초로 늘려서 안정성 향상
      }
    }
  };

  // 시작/일시정지
  const handlePlayPause = () => {
    if (!isPlaying && messages.length === 1) {
      // 첫 메시지만 있을 때 - scenario의 첫 번째(사용자 메시지)부터 시작
      setIsPlaying(true);
      setCurrentStep(0);
      setTimeout(() => {
        addMessage(0);
      }, 100); // 짧은 딜레이로 state 업데이트 보장
    } else if (!isPlaying) {
      // 재시작 시
      setIsPlaying(true);
      if (messages.length <= scenario.length && !isTyping) {
        // 다음 메시지를 추가 (messages.length - 1이 scenario 인덱스)
        setTimeout(() => {
          addMessage(messages.length - 1);
        }, 100);
      }
    } else {
      // 일시정지
      setIsPlaying(false);
    }
  };

  // 리셋
  const handleReset = () => {
    // 첫 메시지만 남기고 리셋
    setMessages([
      {
        id: "msg-0",
        role: "assistant",
        content: "안녕하세요! 집체크 AI 분석 시스템입니다. 🏠\n\n부동산 계약 리스크 분석을 도와드리겠습니다.\n검토하실 물건의 주소를 입력해주세요.",
        isTyping: false,
        timestamp: new Date()
      }
    ]);
    setCurrentStep(0);
    setIsPlaying(false);
    setIsTyping(false);
  };

  return (
    <div className="flex flex-col h-screen bg-neutral-50">
      {/* 헤더 */}
      <header className="bg-white border-b px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="p-2 hover:bg-neutral-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="font-semibold text-neutral-800">임대차 계약 분석 가이드</h1>
            <p className="text-xs text-neutral-500">AI 자동 분석 데모</p>
          </div>
        </div>

        {/* 컨트롤 버튼 */}
        <div className="flex items-center gap-2">
          <button
            onClick={handlePlayPause}
            disabled={isTyping}
            className="p-2 rounded-lg bg-brand-primary text-white hover:bg-brand-secondary transition-colors disabled:opacity-50"
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </button>
          <button
            onClick={handleReset}
            className="p-2 rounded-lg border border-neutral-200 hover:bg-neutral-100 transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* 채팅 영역 */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto p-4 space-y-6">
          {messages.map((message, index) => (
            <MessageBubble
              key={message.id}
              message={message}
              isTyping={!!(message.isTyping && index === messages.length - 1 && isTyping)}
            />
          ))}
          <div ref={messagesEndRef} />
        </div>
      </div>

    </div>
  );
}