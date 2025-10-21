"use client";

import React, { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Play,
  Pause,
  RotateCcw,
  CheckSquare,
  FileText,
  Home,
  AlertTriangle,
  Shield
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
      }, 8);
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
      {/* 프로필 아이콘 */}
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

export default function RentalChecklistGuide() {
  // 첫 메시지를 초기값으로 설정
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "msg-0",
      role: "assistant",
      content: "안녕하세요! 집체크 전세 계약 체크리스트입니다. ✅\n\n안전한 전세 계약을 위해 반드시 확인해야 할 사항들을 단계별로 안내해드리겠습니다.\n계약 전에 꼭 체크해보세요!",
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
      content: "전세 계약을 앞두고 있는데, 어떤 것들을 확인해야 하나요? 체크리스트를 알려주세요."
    },
    {
      role: "assistant",
      content: "네, 전세 계약 전 필수 체크리스트를 준비했습니다.\n\n총 7단계로 구성되어 있으며, 각 단계별로 꼼꼼히 확인하셔야 합니다.\n지금부터 하나씩 안내해드릴게요."
    },
    {
      role: "assistant",
      content: "📋 **[체크리스트 1단계] 임대인 신분 확인**\n\n**필수 확인사항:**\n\n☑️ **등기부등본상 소유자와 계약자 일치 여부**\n• 신분증과 등기부등본 대조\n• 대리인 계약 시 위임장 + 인감증명서 확인\n\n☑️ **임대인 연락처 2개 이상 확보**\n• 휴대전화 + 집전화/직장전화\n• 비상연락처 포함\n\n☑️ **다가구/다세대 실소유주 확인**\n• 건물주와 세대주가 다를 수 있음\n• 전대차 계약 여부 확인\n\n⚠️ **주의**: 신분증 사진 촬영 보관 필수!"
    },
    {
      role: "assistant",
      content: "🏠 **[체크리스트 2단계] 등기부등본 확인**\n\n**갑구(소유권) 확인:**\n☑️ 소유권 이전 이력\n☑️ 가압류, 가처분, 예고등기 여부\n☑️ 신탁등기 여부\n\n**을구(소유권 외 권리) 확인:**\n☑️ 근저당권 설정액 (매매가의 60% 이하 안전)\n☑️ 전세권/임차권 설정 현황\n☑️ 지상권, 지역권 등 확인\n\n**계산식:**\n선순위보증금 + 근저당 설정액 ≤ 매매시세 × 70%\n\n💡 **Tip**: 계약 당일 최신 등기부등본으로 재확인!"
    },
    {
      role: "assistant",
      content: "💰 **[체크리스트 3단계] 선순위 보증금 확인**\n\n**확인 방법:**\n\n☑️ **임대차 현황 확인서 요청**\n• 임대인에게 직접 요구\n• 동/호수별 임차인 현황 파악\n\n☑️ **현장 확인**\n• 전입세대 열람 (동사무소)\n• 우편함/가스계량기 확인\n• 이웃 탐문\n\n☑️ **최우선변제금 계산**\n• 서울: 5천만원\n• 수도권 과밀억제권역: 4천3백만원\n• 광역시: 2천3백만원\n• 기타: 2천만원\n\n⚠️ 선순위 + 나의 보증금 ≤ 매매가 × 70%"
    },
    {
      role: "assistant",
      content: "🔍 **[체크리스트 4단계] 건물 및 시설 점검**\n\n**필수 점검 항목:**\n\n☑️ **누수 및 곰팡이**\n• 천장, 벽면 누수 흔적\n• 욕실, 베란다 곰팡이\n• 장마철 후 재방문 권장\n\n☑️ **난방 및 수도**\n• 보일러 작동 상태\n• 수압 및 온수 확인\n• 가스/전기 검침 확인\n\n☑️ **방범 및 안전**\n• 현관문 잠금장치\n• CCTV 설치 여부\n• 소방시설 확인\n\n☑️ **옵션 및 시설물**\n• 포함/불포함 품목 명시\n• 고장 시 책임 소재 확인"
    },
    {
      role: "assistant",
      content: "📄 **[체크리스트 5단계] 계약서 작성**\n\n**필수 기재사항:**\n\n☑️ **기본 정보**\n• 정확한 주소 (등기부등본과 일치)\n• 면적 (전용/공급면적)\n• 계약기간 (시작일~종료일)\n\n☑️ **금액 및 지급일**\n• 계약금: 10% (계약 당일)\n• 중도금: 필요시\n• 잔금: 입주 당일\n• 계좌번호 명시 (임대인 명의)\n\n☑️ **특약사항** (중요!)\n• 보증금 반환 지연 시 지연이자\n• 계약 해지 조건\n• 수리비 부담 주체\n• 중개수수료 부담"
    },
    {
      role: "assistant",
      content: "🛡️ **[체크리스트 6단계] 보증금 보호 장치**\n\n**대항력 확보 (3가지 동시 충족):**\n\n☑️ **주택 인도** (입주)\n• 이사 당일 확인\n\n☑️ **전입신고**\n• 입주 당일 즉시\n• 주민센터 또는 온라인\n\n☑️ **확정일자**\n• 계약서에 날인\n• 동사무소/등기소/공증사무소\n\n**추가 안전장치:**\n☑️ 전세보증보험 가입 (HUG/SGI)\n☑️ 전세권 설정 (등기부 을구)\n☑️ 임차권등기명령 (보증금 미반환 시)\n\n⚠️ 전입신고 + 확정일자 = 다음날 0시부터 효력!"
    },
    {
      role: "assistant",
      content: "⚠️ **[체크리스트 7단계] 위험 신호 체크**\n\n**이런 경우 계약 재고려:**\n\n🚨 **즉시 포기 신호**\n• 시세보다 현저히 낮은 전세가\n• 등기부등본 제공 거부\n• 계약 서두르기/압박\n• 현금 요구 (계좌이체 거부)\n\n⚠️ **주의 신호**\n• 깡통전세 위험 (전세가율 80% 초과)\n• 다수 가압류/근저당\n• 경매 진행 이력\n• 임대인 연락 어려움\n• 건물 노후화 심각\n\n💡 **안전 기준**\n• 전세가율 70% 이하\n• 갭 투자 아닌 실거주 임대인\n• 1년 이상 소유"
    },
    {
      role: "assistant",
      content: "✅ **[최종 점검] 전세 계약 마스터 체크리스트**\n\n**계약 당일 최종 확인:**\n\n**서류 체크:**\n☑️ 등기부등본 (당일 발급)\n☑️ 신분증 대조\n☑️ 계약서 3부 작성\n☑️ 확정일자 날인\n\n**금액 체크:**\n☑️ 계좌이체 (현금 X)\n☑️ 임대인 명의 확인\n☑️ 이체 확인증 보관\n\n**현장 체크:**\n☑️ 열쇠 인수\n☑️ 시설물 최종 점검\n☑️ 검침기 수치 기록\n\n**보호장치:**\n☑️ 전입신고 준비\n☑️ 보증보험 가입\n\n📞 **도움 받을 곳:**\n• 전세피해지원센터: 1533-5252\n• 주거복지센터: 1600-0777\n• 한국부동산원: 1644-2828\n\n💪 체크리스트를 모두 확인하셨다면 안전한 계약이 될 거예요!"
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
      id: `msg-${step + 1}`,
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
      // 타이핑 완료 시간 계산
      const typingDuration = Math.min(messageData.content.length * 8 + 300, 3500);

      setTimeout(() => {
        setIsTyping(false);
        // 다음 메시지로 진행
        if (step < scenario.length - 1 && isPlayingRef.current) {
          setTimeout(() => {
            addMessage(step + 1);
          }, 600);
        } else if (step === scenario.length - 1) {
          setIsPlaying(false);
        }
      }, typingDuration);
    } else {
      // 사용자 메시지는 짧게 대기 후 다음으로
      if (step < scenario.length - 1 && isPlayingRef.current) {
        setTimeout(() => {
          addMessage(step + 1);
        }, 800);
      }
    }
  };

  // 시작/일시정지
  const handlePlayPause = () => {
    if (!isPlaying && messages.length === 1) {
      setIsPlaying(true);
      setCurrentStep(0);
      setTimeout(() => {
        addMessage(0);
      }, 100);
    } else if (!isPlaying) {
      setIsPlaying(true);
      if (messages.length <= scenario.length && !isTyping) {
        setTimeout(() => {
          addMessage(messages.length - 1);
        }, 100);
      }
    } else {
      setIsPlaying(false);
    }
  };

  // 리셋
  const handleReset = () => {
    setMessages([
      {
        id: "msg-0",
        role: "assistant",
        content: "안녕하세요! 집체크 전세 계약 체크리스트입니다. ✅\n\n안전한 전세 계약을 위해 반드시 확인해야 할 사항들을 단계별로 안내해드리겠습니다.\n계약 전에 꼭 체크해보세요!",
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
            <h1 className="font-semibold text-neutral-800">전세 계약 체크리스트</h1>
            <p className="text-xs text-neutral-500">계약 전 필수 확인사항</p>
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