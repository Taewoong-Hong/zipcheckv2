"use client";

import React, { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Play,
  Pause,
  RotateCcw,
  Home,
  TrendingUp,
  Gavel,
  AlertTriangle,
  CheckCircle
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

export default function PurchaseReviewGuide() {
  // 첫 메시지를 초기값으로 설정
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "msg-0",
      role: "assistant",
      content: "안녕하세요! 집체크 매매 계약 검토 가이드입니다. 🏠\n\n부동산 매매 계약 시 꼭 확인해야 할 사항들을 단계별로 안내해드리겠습니다.\n어떤 물건을 검토하고 계신가요?",
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
      content: "서울시 강남구 논현동 빌라를 매수하려고 합니다. 매매가 8억 5천만원인데 어떤 것들을 확인해야 하나요?"
    },
    {
      role: "assistant",
      content: "강남구 논현동 빌라 매매 계약이시군요. 매매가 8억 5천만원은 상당한 금액이니 꼼꼼한 검토가 필요합니다.\n\n지금부터 필수 확인사항을 단계별로 안내해드리겠습니다."
    },
    {
      role: "assistant",
      content: "💰 **[1단계] 실거래가 및 시세 확인**\n\n해당 물건의 적정 가격인지 확인해보겠습니다.\n\n**확인 사항:**\n• ✅ 최근 3개월 실거래가: 7.8억~8.3억원\n• ✅ 주변 경매 낙찰가: 평균 7.2억원 (낙찰률 85%)\n• ✅ 평당 시세: 4,200만원/평\n• ✅ 전세가율: 68%\n\n💡 **평가**: 현재 호가 8.5억은 시세 상한선입니다.\n최소 3~5% 가격 협상 여지가 있습니다."
    },
    {
      role: "assistant",
      content: "📋 **[2단계] 등기부등본 정밀 분석**\n\n권리관계와 법적 이슈를 확인했습니다.\n\n**갑구(소유권):**\n• ✅ 소유자 확인 완료\n• ⚠️ 가압류 1건 (2천만원) - 잔금 전 해제 필수\n\n**을구(소유권 외 권리):**\n• ✅ 근저당 2.8억원 설정\n• ✅ 전세권 3.5억원\n\n**협상 포인트:**\n• 가압류 해제 비용을 매도인 부담으로 특약\n• 잔금일 전 말소 확인서 요구\n• 근저당+전세권 총 6.3억 → 실 수령액 2.2억 확인"
    },
    {
      role: "assistant",
      content: "🏢 **[3단계] 건물 상태 및 관리 점검**\n\n**필수 확인사항:**\n\n**1. 건축물대장**\n• 위반건축물 여부: 없음 ✅\n• 준공년도: 2018년 (6년차)\n• 구조: 철근콘크리트\n\n**2. 관리비 및 체납**\n• 월 관리비: 18만원\n• 체납액: 없음 ✅\n• 장기수선충당금: 850만원 (승계)\n\n**3. 주차 및 부대시설**\n• 주차 1대 포함 (등기 확인)\n• 엘리베이터 有\n• CCTV, 무인택배함 설치"
    },
    {
      role: "assistant",
      content: "🔨 **[4단계] 인테리어 및 하자 확인**\n\n**인테리어 상태:**\n• 전체 리모델링: 2년 전 (7천만원 투입)\n• 주방/욕실: 전면 교체 완료\n• 바닥/벽지: 양호한 상태\n\n**중점 확인 사항:**\n• ✅ 누수 흔적: 천장, 벽면 점검\n• ✅ 곰팡이: 욕실, 베란다 확인\n• ✅ 창호 상태: 결로, 단열 확인\n• ✅ 배관: 녹물, 수압 테스트\n\n💡 **Tip**: 우천 시 재방문하여 누수 여부 재확인 권장"
    },
    {
      role: "assistant",
      content: "⚠️ **[5단계] 빌라 특별 주의사항**\n\n**빌라 매매 필수 특약사항:**\n\n**1. 누수 하자 특약** (중요!)\n\"매매계약일로부터 6개월 내 누수 발생 시, 매수인은 계약 해제 또는 누수 공사비용 전액을 매도인에게 청구할 수 있다\"\n\n**2. 관리비 정산 특약**\n\"잔금일 기준 모든 관리비, 공과금은 매도인이 정산 완료한다\"\n\n**3. 하자 담보 책임**\n\"숨은 하자 발견 시 1년간 매도인이 책임진다\"\n\n**4. 명도 확인**\n\"잔금 지급과 동시에 완전한 명도 상태로 인도한다\""
    },
    {
      role: "assistant",
      content: "🏦 **[6단계] 대출 및 세금 계획**\n\n**대출 가능액 검토:**\n• LTV: 최대 70% (5.95억원)\n• DTI/DSR: 소득 대비 상환능력 체크\n• 금리: 연 4.5~5.5% (변동/고정 선택)\n\n**세금 계산:**\n• 취득세: 약 2,550만원 (3% 적용)\n• 중개수수료: 765만원 (0.9%)\n• 등기비용: 약 300만원\n• **총 부대비용: 약 3,615만원**\n\n💡 자금계획: 자기자금 최소 3.5억원 필요\n(계약금+중도금+잔금+부대비용)"
    },
    {
      role: "assistant",
      content: "📅 **[7단계] 계약 일정 및 절차**\n\n**표준 진행 일정:**\n\n**1. 계약금 (10%)**\n• 계약 당일: 8,500만원\n• 계좌이체 확인증 보관\n\n**2. 중도금 (필요시)**\n• 1차(20%): 계약 후 30일\n• 2차(20%): 계약 후 60일\n\n**3. 잔금 (50%)**\n• 계약 후 90일 내\n• 소유권이전 동시 진행\n\n**필수 준비서류:**\n• 신분증, 인감도장, 인감증명서\n• 주민등록등본, 초본\n• 소득증빙서류 (대출 시)"
    },
    {
      role: "assistant",
      content: "✅ **[최종 체크리스트]**\n\n**계약 전 필수 확인:**\n☑️ 실거래가 대비 적정 가격인지\n☑️ 등기부상 권리관계 깨끗한지\n☑️ 가압류/근저당 말소 가능한지\n☑️ 건축물대장 위반사항 없는지\n☑️ 누수/하자 특약 포함했는지\n☑️ 관리비 체납 없는지\n☑️ 인테리어 상태 만족스러운지\n☑️ 대출 승인 가능한지\n☑️ 부대비용 준비되었는지\n\n**전문가 조언:**\n• 📞 공인중개사와 충분히 상의\n• 📞 필요시 부동산 전문 변호사 검토\n• 📞 하자 점검 전문업체 활용 권장\n\n💪 안전한 매매 계약이 되시길 바랍니다!\n궁금한 점이 있으시면 언제든 문의해주세요."
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
        content: "안녕하세요! 집체크 매매 계약 검토 가이드입니다. 🏠\n\n부동산 매매 계약 시 꼭 확인해야 할 사항들을 단계별로 안내해드리겠습니다.\n어떤 물건을 검토하고 계신가요?",
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
            <h1 className="font-semibold text-neutral-800">매매 계약 검토 가이드</h1>
            <p className="text-xs text-neutral-500">안전한 매매를 위한 체크리스트</p>
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