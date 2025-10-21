"use client";

import React, { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Play,
  Pause,
  RotateCcw,
  AlertTriangle,
  Shield,
  Home,
  DollarSign,
  Gavel,
  HeartHandshake
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

export default function FraudPreventionGuide() {
  // 첫 메시지를 초기값으로 설정
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "msg-0",
      role: "assistant",
      content: "안녕하세요! 집체크 전세사기 피해 대응 가이드입니다. 🛡️\n\n전세사기 피해를 예방하고 대응하는 방법을 단계별로 안내해드리겠습니다.\n어떤 상황이신가요?",
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
      content: "임대인이 보증금을 돌려주지 않고 연락이 안 돼요. 경매가 진행 중이라고 하는데 어떻게 해야 하나요?"
    },
    {
      role: "assistant",
      content: "🚨 **긴급 상황이시네요. 차근차근 대응하겠습니다.**\n\n우선 가장 중요한 것은 **대항력 유지**입니다.\n현재 상황을 확인해드릴게요:\n\n✅ 전입신고와 확정일자를 받으셨나요?\n✅ 계약이 만료되었나요?\n✅ 경매 사건번호를 아시나요?"
    },
    {
      role: "user",
      content: "네, 전입신고와 확정일자는 받았고, 계약은 2주 전에 만료됐어요. 경매 사건번호는 받았습니다."
    },
    {
      role: "assistant",
      content: "📋 **[1단계] 즉시 임차권등기 신청**\n\n계약 만료 후 보증금을 못 받으셨으니 **임차권등기**를 신청하셔야 합니다.\n\n**임차권등기의 효과:**\n• ✅ 대항력과 우선변제권 유지\n• ✅ 이사를 가도 권리 보호\n• ✅ 전세대출 연장 가능 (접수증만으로도 가능)\n\n**필요 서류:**\n• 임대차계약서\n• 등기부등본\n• 내용증명(보증금 반환 요구)\n\n💡 **Tip**: 법원에 신청 후 보통 2-3일이면 등기가 됩니다."
    },
    {
      role: "assistant",
      content: "⚖️ **[2단계] 전세사기피해자 결정 신청**\n\n특별법상 지원을 받으려면 **'전세사기피해자'로 결정**받아야 합니다.\n\n**신청 요건:**\n• ✅ 보증금 5억 이하 (지역별 상이)\n• ✅ 대항력 보유 (전입+확정일자 또는 임차권등기)\n• ✅ 경매 개시 또는 다수 피해 발생\n• ✅ 임대인의 고의적 미반환 정황\n\n**신청처:** 관할 시·군·구청 또는 전세피해지원센터\n**처리기간:** 접수 후 약 30일\n\n⚠️ 불인정되어도 상황 변경 시 재신청 가능합니다."
    },
    {
      role: "assistant",
      content: "🏛️ **[3단계] 경매 대응 전략**\n\n경매가 진행 중이시니 다음 옵션들을 검토하세요:\n\n**1. 경매 유예/정지 신청**\n• 피해자 결정 후 법원에 신청\n• 최대 6개월간 경매 진행 중단\n\n**2. 배당요구 신청**\n• 경매 개시 후 즉시 신청\n• 우선변제권 순위에 따라 배당\n\n**3. 조세채권 안분 신청**\n• 국세/지방세가 있다면 필수\n• 임차인 보호 위한 세금 분산\n\n💰 **예상 회수 금액 계산:**\n(경매 예상가 - 선순위 채권) × 귀하의 순위 = 예상 회수액"
    },
    {
      role: "assistant",
      content: "🏠 **[4단계] LH 매입 & 계속 거주**\n\n피해자로 결정되면 **LH 매입 프로그램**을 신청할 수 있습니다.\n\n**LH 매입의 장점:**\n• ✅ 현재 집에 계속 거주 가능\n• ✅ 공공임대로 전환 (최장 20년)\n• ✅ 경매차익을 임대료에서 차감\n• ✅ 시세의 30% 수준 임대료\n\n**신청 방법:**\n• LH 지역본부 방문 또는 온라인\n• 피해자 결정서 + 경매 서류 지참\n\n**우선매수권 양도:**\n본인이 낙찰받기 어려우면 LH에 우선매수권을 양도할 수 있습니다."
    },
    {
      role: "assistant",
      content: "💳 **[5단계] 긴급 금융 지원**\n\n**즉시 가능한 금융 지원:**\n\n**1. 버팀목 전세대출 대환**\n• 피해자 결정 시 만기 전 대환 가능\n• 연 1.8~2.7% 저금리\n• 최대 2.4억원 (수도권)\n\n**2. 디딤돌 경락자금 대출**\n• 본인이 낙찰받을 경우\n• 낙찰가의 100%까지 지원\n• 연 2.25~3.15%\n\n**3. 전세대출 연장**\n• 임차권등기 접수증으로 연장 가능\n• 묵시적 갱신 확약서로도 가능\n\n📞 **KB 전세피해 전담창구:** 1599-1771"
    },
    {
      role: "assistant",
      content: "🆘 **[6단계] 긴급 주거 지원**\n\n당장 거주가 어려우신 경우:\n\n**1. 긴급 주거 지원**\n• 최대 12개월 무료 거주\n• 시·군·구청 신청\n\n**2. 전세임대 주택**\n• 보증금의 5% 부담으로 입주\n• LH 또는 지자체 운영\n\n**3. 이주비 지원**\n• 4인 가구 기준 500만원\n• 피해자 결정 후 신청\n\n**4. 긴급 생계비**\n• 4인 가구 기준 월 183만원\n• 최대 6개월 지원"
    },
    {
      role: "assistant",
      content: "✅ **[최종 체크리스트 & 행동 요령]**\n\n**오늘 당장 하실 일:**\n☑️ 임차권등기 신청 (법원)\n☑️ 배당요구 신청 (경매법원)\n☑️ 전세사기피해자 신청 (구청)\n\n**이번 주 내 하실 일:**\n☑️ 내용증명 발송 (임대인에게)\n☑️ 법률구조공단 상담 예약\n☑️ 전세보증금 반환보증 확인\n\n**준비하실 서류:**\n☑️ 임대차계약서 원본\n☑️ 등기부등본 (최신)\n☑️ 확정일자 서류\n☑️ 계좌이체 내역\n\n**상담 핫라인:**\n• 📞 전세피해지원센터: 1533-5252\n• 📞 법률구조공단: 132\n• 📞 주거복지센터: 1600-0777\n\n💪 혼자가 아닙니다. 체계적으로 대응하면 보증금을 지킬 수 있습니다!"
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
        content: "안녕하세요! 집체크 전세사기 피해 대응 가이드입니다. 🛡️\n\n전세사기 피해를 예방하고 대응하는 방법을 단계별로 안내해드리겠습니다.\n어떤 상황이신가요?",
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
            <h1 className="font-semibold text-neutral-800">전세사기 피해 대응 가이드</h1>
            <p className="text-xs text-neutral-500">단계별 대응 방법 안내</p>
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