"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Upload, Send, Search, Loader2, ChevronRight, ChevronLeft } from "lucide-react";
import { Message as MessageType } from "@/types/chat";
import type { ContractType, RegistryMethod, AddressInfo, ChatState } from "@/types/analysis";
import Message from "./Message";
import ChatInput from "./ChatInput";
import { chatStorage } from "@/lib/chatStorage";
import { simulateTestResponse } from "@/lib/testScenario";
import { ChatLoadingIndicator } from "@/components/common/LoadingSpinner";
import { StateMachine } from "@/lib/stateMachine";
import { getBrowserSupabase } from "@/lib/supabaseBrowser";
import {
  isAddressInput,
  isAnalysisStartTrigger,
  getStateResponseMessage,
  createCase,
  updateCase,
  updateCaseState,
  uploadRegistry,
  streamAnalysis,
  getUserCredits,
  type AnalysisContext,
  type AnalysisStreamEvent,
} from "@/lib/analysisFlow";

interface ChatInterfaceProps {
  isSidebarExpanded: boolean;
  onToggleSidebar: () => void;
  isLoggedIn?: boolean;
  session?: any; // 세션 prop 추가
  onLoginRequired?: () => void;
}

export default function ChatInterface({
  isSidebarExpanded,
  onToggleSidebar,
  isLoggedIn = true,
  session, // 세션 prop 받기
  onLoginRequired
}: ChatInterfaceProps) {
  const [messages, setMessages] = useState<MessageType[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false); // 중복 제출 방지 상태 추가
  const [inputValue, setInputValue] = useState("");
  // 채팅 화면에서 이전 대화 ID를 자동 복구하려 하는가  // (이전 세션의 상태가 남아 주소 선택을 건너뛰는 이슈 방지)
  const [conversationId, setConversationId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const initializingRef = useRef(false); // Race condition 방지용 ref 추가
  // Conversation init single-flight and abort control
  const conversationInitPromiseRef = useRef<Promise<string> | null>(null);
  const initAbortRef = useRef<AbortController | null>(null);

  // Analysis flow state
  const [stateMachine] = useState(() => new StateMachine('init'));
  const [analysisContext, setAnalysisContext] = useState<AnalysisContext>({});
  const router = useRouter();

  // Persist conversationId to localStorage when it changes
  useEffect(() => {
    if (conversationId) {
      localStorage.setItem('chat_conversation_id', conversationId);
      console.log('Conversation ID saved to localStorage:', conversationId);
    } else {
      localStorage.removeItem('chat_conversation_id');
      console.log('Conversation ID removed from localStorage');
    }
  }, [conversationId]);

  // Initialize conversation on first load (only if no existing conversationId)
  useEffect(() => {
    const initConversation = async () => {
      // Try to obtain a valid access token from props or Supabase (fallback)
      let accessToken: string | undefined = session?.access_token;
      if (!accessToken) {
        try {
          const sb = getBrowserSupabase();
          const { data } = await sb.auth.getSession();
          accessToken = data.session?.access_token;
        } catch (_) {}
      }

      if (!accessToken) {
        console.log('[ChatInterface] Skipping conversation init: no session');
        return;
      }

      if (conversationId) {
        console.log('[ChatInterface] Skipping conversation init: already have conversationId:', conversationId);
        return;
      }

      // Prevent duplicate initialization races
      if (initializingRef.current) {
        console.log('[ChatInterface] Already initializing conversation, skipping duplicate init');
        return;
      }

      initializingRef.current = true;

      try {
        console.log('[ChatInterface] Initializing new conversation ...');
        const response = await fetch('/api/chat/init', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + accessToken,
          },
          credentials: 'include',
          body: JSON.stringify({ session: { access_token: accessToken } }),
        });

        if (response.ok) {
          const data = await response.json();
          setConversationId(data.conversation_id);
          console.log('[ChatInterface] New conversation created:', data.conversation_id);
        } else {
          console.error('[ChatInterface] Failed to create conversation:', response.status, await response.text());
        }
      } catch (error) {
        console.error('[ChatInterface] Failed to initialize conversation:', error);
      } finally {
        initializingRef.current = false;
      }
    };

    initConversation();
  }, [session, conversationId]); // 세션 변경 모니터링

  // Abort any in-flight init on unmount
  useEffect(() => {
    return () => {
      initAbortRef.current?.abort();
    };
  }, []);

  // Reset conversation when user switches
  useEffect(() => {
    if (!session) {
      setConversationId(null);
    }
  }, [session]);

  // Ensure a conversation id exists (single-flight + latest token)
  const getOrCreateConversationId = async (): Promise<string> => {
    // 이미 존재하면 바로 반환
    if (conversationId) {
      console.log('[getOrCreateConversationId] ??Fast path: using existing conversationId=', conversationId);
      return conversationId;
    }

    // 최신 토큰 확보 (세션 prop이 오래되었을 수 있음)
    const supabase = getBrowserSupabase();
    const { data } = await supabase.auth.getSession();
    const latestToken = data.session?.access_token || session?.access_token;
    if (!latestToken) throw new Error('NO_SESSION');

      // 이미 init 중이면 기다림(single-flight)
    if (conversationInitPromiseRef.current) {
      console.log('[getOrCreateConversationId] Reusing existing init promise');
      return await conversationInitPromiseRef.current;
    }

    // cancel previous init
    initAbortRef.current?.abort();
    initAbortRef.current = new AbortController();

    // single-flight 시작
    conversationInitPromiseRef.current = (async () => {
      // 1) init API 호출
      const res = await fetch('/api/chat/init', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${latestToken}`,
        },
        body: JSON.stringify({ session: { access_token: latestToken } }),
        credentials: 'include',
        signal: initAbortRef.current!.signal,
      });
      if (!res.ok) throw new Error(`init failed: ${res.status}`);
      const payload = await res.json();
      const id: string = payload.conversation_id;

      // 2) DB 반영 확인 (최대 3번 시도, 150ms 간격)
      console.log('[getOrCreateConversationId] Verifying conversation in DB:', id);
      for (let i = 0; i < 3; i++) {
        const { data: convData, error } = await supabase
          .from('conversations')
          .select('id')
          .eq('id', id)
          .maybeSingle();

        if (convData && !error) {
          console.log(`[getOrCreateConversationId] DB verified (attempt ${i + 1}/3)`);
          break;
        }

        if (i < 2) {
          await new Promise((resolve) => setTimeout(resolve, 150));
        }
      }

      // 3) 상태에 반영
      setConversationId(id);
      console.log('[getOrCreateConversationId] Conversation initialized:', id);
      return id;
    })();

    try {
      const cid = await conversationInitPromiseRef.current;
      return cid;
    } finally {
      conversationInitPromiseRef.current = null;
    }
  };

  // Reset chat function for new conversation
  const resetChat = useCallback(async () => {
    setMessages([]);
    setInputValue("");
    setIsLoading(false);
    setConversationId(null);
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    // Reset analysis flow
    stateMachine.reset();
    setAnalysisContext({});
    // Create new session
    chatStorage.createSession();

    // Create new conversation
  // prop으로 받은 session 사용
    if (isLoggedIn && session && session.access_token) {
      try {
        const response = await fetch('/api/chat/init', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ session: { access_token: session.access_token } }),
        });

        if (response.ok) {
          const data = await response.json();
          setConversationId(data.conversation_id);
          console.log('[ChatInterface] ??New conversation created on reset:', data.conversation_id);
        } else {
          console.error('[ChatInterface] Failed to create new conversation on reset:', response.status);
        }
      } catch (error) {
        console.error('[ChatInterface] Failed to create new conversation on reset:', error);
      }
    }
  }, [isLoggedIn, session, stateMachine]);

  // Handle address selection
  const handleAddressSelect = async (address: any, detailAddress: string) => {
    // Add user selection message with detail address
    const fullAddress = detailAddress ? `${address.roadAddr} ${detailAddress}` : address.roadAddr;
    const userMessage: MessageType = {
      id: crypto.randomUUID(),
      role: 'user',
      content: `선택한 주소: ${fullAddress}`,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMessage]);
    chatStorage.addMessage(userMessage);

    try {
      // ??Ensure conversation exists BEFORE creating case
      const convId = await getOrCreateConversationId();

      // Create case with selected address
      const addressInfo: AddressInfo = {
        road: address.roadAddr,
        lot: address.jibunAddr,
        zipCode: address.zipNo,
        buildingName: address.bdNm,
      };
      const caseId = await createCase(addressInfo);

      setAnalysisContext({ caseId, address: addressInfo });

      // Update conversation's property_address for gating logic
      try {
        if (session?.access_token) {
          await fetch(`/api/chat/conversation/${convId}`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({ property_address: addressInfo.road }),
          });
          console.log('[handleAddressSelect] Conversation updated with address:', addressInfo.road);
        }
      } catch (e) {
        console.warn('[ChatInterface] conversation address update failed:', e);
      }

      // Transition to contract_type state
      stateMachine.transition('contract_type');

      const aiMessage: MessageType = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: getStateResponseMessage('contract_type', { address: addressInfo }),
        timestamp: new Date(),
        componentType: 'contract_selector',
      };
      setMessages(prev => [...prev, aiMessage]);
      chatStorage.addMessage(aiMessage);
    } catch (error) {
      console.error('Case creation error:', error);
      const errorMessage: MessageType = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: '케이스 생성 중 오류가 발생했습니다. 다시 시도해주세요.',
        timestamp: new Date(),
        isError: true,
      };
      setMessages(prev => [...prev, errorMessage]);
      chatStorage.addMessage(errorMessage);
    }
  };

  // Handle contract type selection
  const handleContractTypeSelect = async (contractType: ContractType) => {
    if (!analysisContext.caseId) {
      console.error('No case ID found');
      return;
    }

    // Update context
    setAnalysisContext(prev => ({ ...prev, contractType }));

    // Update case in database
    try {
      await updateCase(analysisContext.caseId, { contractType });
      // Also reflect into conversation for gating
      if (conversationId && session?.access_token) {
        await fetch(`/api/chat/conversation/${conversationId}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ contract_type: contractType }),
        });
      }
    } catch (error) {
      console.error('Failed to update contract type:', error);
    }

    // Add user selection message
    const userMessage: MessageType = {
      id: crypto.randomUUID(),
      role: 'user',
      content: `계약 유형: ${contractType}`,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMessage]);
    chatStorage.addMessage(userMessage);

    // Transition to price_input state
    stateMachine.transition('price_input');

    // Add AI response with price input component
    const aiMessage: MessageType = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: getStateResponseMessage('price_input', { contractType }),
      timestamp: new Date(),
      componentType: 'price_input',
      componentData: { contractType },
    };
    setMessages(prev => [...prev, aiMessage]);
    chatStorage.addMessage(aiMessage);
  };

  // Handle price submit
  const handlePriceSubmit = async (data: { deposit?: number; monthlyRent?: number }) => {
    if (!analysisContext.caseId || !analysisContext.contractType) {
      console.error('Missing case ID or contract type');
      return;
    }

    const contractType = analysisContext.contractType;

    // Format message based on contract type
    let content = '';
    if (contractType === '매매') {
      content = `매매가: ${data.deposit?.toLocaleString('ko-KR')}만원`;
    } else if (contractType === '전세') {
      content = `보증금: ${data.deposit?.toLocaleString('ko-KR')}만원`;
    } else {
      content = `보증금: ${data.deposit?.toLocaleString('ko-KR')}만원, 월세: ${data.monthlyRent?.toLocaleString('ko-KR')}만원`;
    }

    // Add user selection message
    const userMessage: MessageType = {
      id: crypto.randomUUID(),
      role: 'user',
      content,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMessage]);
    chatStorage.addMessage(userMessage);

    // Update context with price data
    setAnalysisContext(prev => ({ ...prev, deposit: data.deposit, monthlyRent: data.monthlyRent }));

    // Update case metadata in database
    try {
      const updates: any = {
        deposit: data.deposit,
        monthlyRent: data.monthlyRent,
      };

      // For sale contracts, also set price field
      if (contractType === '매매') {
        updates.price = data.deposit;
      }

      await updateCase(analysisContext.caseId, updates);
    } catch (error) {
      console.error('Failed to update price:', error);
    }

    // Transition to registry_choice state
    stateMachine.transition('registry_choice');

    // Get user credits
    const credits = await getUserCredits();
    setAnalysisContext(prev => ({ ...prev, userCredits: credits }));

    // Add AI response with registry choice component
    const aiMessage: MessageType = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: getStateResponseMessage('registry_choice', { ...analysisContext, contractType, userCredits: credits }),
      timestamp: new Date(),
      componentType: 'registry_choice',
      componentData: { userCredits: credits, registryCost: 10 },
    };
    setMessages(prev => [...prev, aiMessage]);
    chatStorage.addMessage(aiMessage);
  };

  // Handle registry choice selection
  const handleRegistryChoiceSelect = async (method: RegistryMethod, file?: File) => {
    if (!analysisContext.caseId) {
      console.error('No case ID found');
      return;
    }

    setAnalysisContext(prev => ({ ...prev, registryMethod: method, registryFile: file }));

    // Add user selection message
    const userMessage: MessageType = {
      id: crypto.randomUUID(),
      role: 'user',
      content: method === 'issue' ? '등기부등본 발급 선택' : '등기부등본 업로드',
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMessage]);
    chatStorage.addMessage(userMessage);

    setIsLoading(true);

    try {
      if (method === 'upload' && file) {
        // Upload file
        await uploadRegistry(analysisContext.caseId, file);

        // Transition to registry_ready
        stateMachine.transition('registry_ready');

        const aiMessage: MessageType = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: getStateResponseMessage('registry_ready'),
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, aiMessage]);
        chatStorage.addMessage(aiMessage);

        // Start analysis
        await startAnalysis();
      } else {
        // Issue registry (not implemented yet)
        const aiMessage: MessageType = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: '등기부등본 발급 기능은 아직 구현되지 않았습니다. PDF 파일을 업로드해주세요.',
          timestamp: new Date(),
          isError: true,
        };
        setMessages(prev => [...prev, aiMessage]);
        chatStorage.addMessage(aiMessage);
      }
    } catch (error) {
      console.error('Registry handling error:', error);
      const aiMessage: MessageType = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: '등기부 처리 중 오류가 발생했습니다. 다시 시도해주세요.',
        timestamp: new Date(),
        isError: true,
      };
      setMessages(prev => [...prev, aiMessage]);
      chatStorage.addMessage(aiMessage);

      // Show the upload component again to allow retry
      const retryMessage: MessageType = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: 'PDF를 다시 업로드해 주세요',
        timestamp: new Date(),
        componentType: 'registry_choice',
        componentData: { userCredits: analysisContext.userCredits ?? 0, registryCost: 10 },
      };
      setMessages(prev => [...prev, retryMessage]);
      chatStorage.addMessage(retryMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // Start analysis with streaming
  const startAnalysis = async () => {
    if (!analysisContext.caseId) {
      console.error('No case ID found');
      return;
    }

    // Transition to parse_enrich
    stateMachine.transition('parse_enrich');

    // Create streaming progress message
    const progressMessageId = crypto.randomUUID();
    const processingMessage: MessageType = {
      id: progressMessageId,
      role: 'assistant',
      content: '분석을 시작합니다...',
      timestamp: new Date(),
      isStreaming: true,
    };
    setMessages(prev => [...prev, processingMessage]);
    chatStorage.addMessage(processingMessage);

    try {
      // Update database state BEFORE calling FastAPI
      console.log('🔄 Updating case state to parse_enrich in DB...');
      await updateCaseState(analysisContext.caseId, 'parse_enrich');

      // Run streaming analysis
      let reportId: string | undefined;

      await streamAnalysis(
        analysisContext.caseId,
        (event: AnalysisStreamEvent) => {
          // Handle streaming events
          console.log('📊 Analysis event:', event);

          // Handle error
          if (event.error) {
            setMessages(prev => prev.map(msg =>
              msg.id === progressMessageId
                ? {
                    ...msg,
                    content: `분석 중 오류가 발생했습니다: ${event.error}`,
                    isError: true,
                    isStreaming: false,
                  }
                : msg
            ));
            return;
          }

          // Update progress message with real-time events
          if (event.message) {
            const progressText = `${event.message}${event.progress ? ` (${Math.round(event.progress * 100)}%)` : ''}`;
            setMessages(prev => prev.map(msg =>
              msg.id === progressMessageId
                ? { ...msg, content: progressText }
                : msg
            ));
          }

          // Store report ID when analysis completes
          if (event.done && event.report_id) {
            reportId = event.report_id;
          }
        }
      );

      // Navigate to report page where SSE will show real-time progress
      router.push(`/report/${analysisContext.caseId}`);

    } catch (error) {
      console.error('Analysis error:', error);
      stateMachine.transition('error');

      // Remove progress message
      setMessages(prev => prev.filter(msg => msg.id !== progressMessageId));

      const errorMessage: MessageType = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: '분석 중 오류가 발생했습니다. 다시 시도해주세요.',
        timestamp: new Date(),
        isError: true,
      };
      setMessages(prev => [...prev, errorMessage]);
      chatStorage.addMessage(errorMessage);
    }
  };

  // Load session function
  const loadSession = useCallback(async (sessionId: string) => {
    const success = await chatStorage.setCurrentSession(sessionId);
    if (success) {
      const session = await chatStorage.getCurrentSession();
      if (session) {
        setMessages(session.messages);
      }
    }
  }, []);

  // Save current chat function
  const saveCurrentChat = useCallback(async () => {
    // chatStorage already auto-saves messages, but we ensure it's saved
    const session = await chatStorage.getCurrentSession();
    if (session && session.messages.length > 0) {
      // Session is already saved in localStorage through chatStorage
      console.log('Current chat saved:', session.id);
    }
  }, []);

  // Expose functions globally for sidebar to call
  useEffect(() => {
    (window as any).resetChat = resetChat;
    (window as any).loadChatSession = loadSession;
    (window as any).getRecentSessions = () => chatStorage.getRecentSessions();
    (window as any).saveCurrentChat = saveCurrentChat;

    return () => {
      delete (window as any).resetChat;
      delete (window as any).loadChatSession;
      delete (window as any).getRecentSessions;
      delete (window as any).saveCurrentChat;
    };
  }, [resetChat, loadSession, saveCurrentChat]);

  // Auto scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSubmit = async (content?: string, e?: React.FormEvent): Promise<boolean> => {
    if (e) e.preventDefault();

    console.log('[handleSubmit] isSubmitting=', isSubmitting, 'isLoading=', isLoading, 'text=', (content ?? inputValue).trim());
    // 중복 제출 방지 (디바운싱)
    if (isSubmitting) {
      console.log('[ChatInterface] Already submitting, ignoring duplicate');
      return false;
    }

    // 비로그인 상태에서 로그인 시도
    if (!isLoggedIn) {
      onLoginRequired?.();
      return false;
    }

    // content를 직접 인자로 받거나 inputValue 사용
    const text = (content ?? inputValue).trim();
    if (!text || isLoading) {
      return false; // 빈 입력이거나 로딩 중이면 early return
    }

    setInputValue(""); // 입력창 즉시 클리어
    // 제출 중 상태 설정 (500ms 동안 추가 제출 차단)
    setIsSubmitting(true);

    setIsLoading(true);

    // ??Declare variables at function scope (accessible in try, catch, and subsequent code)
    let tempId: string;
    let userMessage: MessageType;
    let accepted = false;

    try {
      // ??Strategy 3: Ensure session + conversation FIRST (BEFORE any message operations)
      const sb = getBrowserSupabase();
      const { data: sbData } = await sb.auth.getSession();
      const accessToken = sbData.session?.access_token || session?.access_token;
      if (!accessToken) {
        throw new Error('Session expired. Please refresh the page.');
      }

      // Ensure conversation exists (awaits init if needed)
      const convId = await getOrCreateConversationId();
      console.log('[handleSubmit] ??Strategy 3: convId=', convId, 'state conversationId=', conversationId, 'input=', text.substring(0, 30));

      // ??Update chatStorage session with conversation ID (if not already set)
      // THIS MUST HAPPEN BEFORE addMessage() to prevent sync failures
      const currentSession = await chatStorage.getCurrentSession();
      if (!currentSession?.conversationId && convId) {
        console.log('[handleSubmit] Updating chatStorage session with conversationId:' , convId);
        // Create or update session with conversation ID
        if (!currentSession) {
          await chatStorage.createSession(text, convId);
        } else {
          // Update existing session with conversationId
          const updated = await chatStorage.updateSessionConversationId(convId);
          if (updated) {
            console.log('[handleSubmit] ??Session updated with conversationId:', convId);
          } else {
            console.warn('[handleSubmit] Failed to update session with conversationId');
          }
        }
      } else if (currentSession?.conversationId) {
        console.log('[handleSubmit] ??Session already has conversationId:', currentSession.conversationId);
      }

      // NOW add user message with optimistic update (임시 ID)
      // Session is guaranteed to have conversationId at this point
      tempId = crypto.randomUUID();
      userMessage = {
        id: tempId,
        role: 'user',
        content: text,
        timestamp: new Date(),
        pending: true, // 서버 확인 대기 중
      };

      setMessages(prev => [...prev, userMessage]);
      // 임시 ID로 즉시 추가 (tool_call로 동기화된 메시지 중단 방지)
      // This will now succeed because session has conversationId
      chatStorage.addMessage(userMessage);
      accepted = true;

      // ??Strategy 1: Frontend controls address modal (no LLM call)
      const currentState = stateMachine.getState();
      if (currentState === 'init' && isAddressInput(text)) {
        // Frontend directly opens modal - bypasses LLM completely
        stateMachine.transition('address_pick');

        const aiMessage: MessageType = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: '주소를 검색해 주세요. 정확한 주소를 선택하면 분석이 더 정확합니다.',
          timestamp: new Date(),
          componentType: 'address_search',
          componentData: { initialAddress: text },
        };
        // Add address search message (no processing message to remove)
        setMessages(prev => [...prev, aiMessage]);
        chatStorage.addMessage(aiMessage);
        setIsLoading(false);
        // allow next submit
        setTimeout(() => setIsSubmitting(false), 0);
        return true; // 주소 선택 안내 메시지만 표시 (No LLM call)
      }
    } catch (error: any) {
      // Handle session/conversation initialization failures
      console.error('[handleSubmit] Session/Conversation error:', error);

      const errorMessage: MessageType = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: error.message === 'NO_SESSION'
          ? '세션이 만료되었습니다. 페이지를 새로고침해주세요.'
          : '세션 초기화 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
        timestamp: new Date(),
        isError: true,
      };
      setMessages(prev => [...prev, errorMessage]);
      setIsLoading(false);
      setTimeout(() => setIsSubmitting(false), 0);
      return false;
    }

    // AI 응답 메시지 생성 (로딩 인디케이터가 표시됨)
    const aiMessageId = crypto.randomUUID();

    // 새로운 AI 스트리밍 메시지 추가
    const aiMessage: MessageType = {
      id: aiMessageId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      isStreaming: true,
    };
    setMessages(prev => [...prev, aiMessage]);

    // Check if input is "test" - run simulation
    if (text.toLowerCase() === 'test') {
      try {
        let accumulatedContent = '';

        await simulateTestResponse(
          // onChunk callback
          (chunk: string) => {
            accumulatedContent += chunk;
            setMessages(prev => prev.map(msg =>
              msg.id === aiMessageId
                ? { ...msg, content: accumulatedContent }
                : msg
            ));
          },
          // onComplete callback
          () => {
            setMessages(prev => prev.map(msg =>
              msg.id === aiMessageId
                ? { ...msg, isStreaming: false }
                : msg
            ));
            // Save final message
            const finalMsg = {
              id: aiMessageId,
              role: 'assistant' as const,
              content: accumulatedContent,
              timestamp: new Date(),
              isStreaming: false,
            };
            chatStorage.addMessage(finalMsg);
            setIsLoading(false);
          }
        );
      } catch (error) {
        console.error('Test simulation error:', error);
        setMessages(prev => prev.map(msg =>
          msg.id === aiMessageId
            ? {
                ...msg,
                content: '테스트 시뮬레이션 중 오류가 발생했습니다.',
                isError: true,
                isStreaming: false,
              }
            : msg
        ));
        setIsLoading(false);
      }
      return true; // Exit early for test mode
    }

    try {
      // ??Re-fetch session for LLM call path (separate from Strategy 3 early return)
      const sb = getBrowserSupabase();
      const { data: sbData } = await sb.auth.getSession();
      const accessToken = sbData.session?.access_token || session?.access_token;
      if (!accessToken) {
        throw new Error('Session expired. Please refresh the page.');
      }

      // ??Reuse the convId from Strategy 3 block (same instance, not state)
      // Strategy 3 already called getOrCreateConversationId() above (line 691)
      const convId = await getOrCreateConversationId();
      console.log('[handleSubmit] ?? LLM call: convId=', convId, 'state conversationId=', conversationId);

      // Create abort controller for cancellation
      abortControllerRef.current = new AbortController();

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + accessToken },
        body: JSON.stringify({
          conversation_id: convId,
          content: text,
          session: { access_token: accessToken },
          // Include case_id when available for downstream processing
          case_id: (analysisContext as any)?.caseId,
          // Enable GPT v2 mode for better conversational experience
          useGPTv2: true,
          property_address: analysisContext?.address?.road,
          contract_type: analysisContext?.contractType,
        }),
        credentials: 'include',
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      if (!response.body) {
        throw new Error('No response body');
      }

      // 응답 헤더에서 conversation_id 확인
      const newConvId = response.headers.get('X-New-Conversation-Id');
      if (newConvId && newConvId !== conversationId) {
        console.log('[ChatInterface] Received new conversation ID from server:', newConvId);
        setConversationId(newConvId);
      }

      // 서버에서 반환된 message_id를 받을 변수
      let serverMessageId: string | undefined;

      // Handle streaming response
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulatedContent = '';

      while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));

              // ??Extract user_message_id from metadata event
              if (data.meta && data.user_message_id) {
                serverMessageId = data.user_message_id;
                console.log('[ChatInterface] Received server message_id:', serverMessageId);
              }

              if (data.done) {
                // Streaming complete
                setMessages(prev => prev.map(msg =>
                  msg.id === aiMessageId
                    ? { ...msg, isStreaming: false }
                    : msg
                ));

                // ??Replace temp ID with server ID after stream completes
                if (serverMessageId) {
                  const confirmedId = serverMessageId; // Type narrowing
                  setMessages(prev =>
                    prev.map(m =>
                      m.id === tempId
                        ? { ...m, id: confirmedId, pending: false }
                        : m
                    )
                  );

                  // ??Now save to localStorage with real ID
                  const finalUserMessage: MessageType = {
                    ...userMessage,
                    id: confirmedId,
                    pending: false
                  };
                  chatStorage.addMessage(finalUserMessage);
                  console.log('[ChatInterface] User message saved with server ID:', confirmedId);
                }
              } else if (data.toolCall) {
                // Handle tool call from GPT-4o-mini
                console.log('[ChatInterface] Tool call received:', data.toolCall);

                // Parse the tool call
                const toolName = data.toolCall.function?.name;
                const toolArgs = data.toolCall.function?.arguments ?
                  JSON.parse(data.toolCall.function.arguments) : {};

                // Handle different tool calls to trigger UI modals
                if (toolName === 'search_address') {
                  // Trigger address search modal
                  const addressQuery = toolArgs.query || '';
                  stateMachine.transition('address_pick');

                  const modalMessage: MessageType = {
                    id: crypto.randomUUID(),
                    role: 'assistant',
                    content: toolArgs.message || '주소를 검색해 주세요. 정확한 주소를 선택하면 분석이 더 정확합니다.',
                    timestamp: new Date(),
                    componentType: 'address_search',
                    componentData: { initialAddress: addressQuery },
                  };

                  setMessages(prev => {
                    // Remove the current streaming message and add modal message
                    const filtered = prev.filter(msg => msg.id !== aiMessageId);
                    return [...filtered, modalMessage];
                  });
                  chatStorage.addMessage(modalMessage);
                  setIsLoading(false);

                } else if (toolName === 'select_contract_type') {
                  // Trigger contract type selector
                  stateMachine.transition('contract_type');

                  const modalMessage: MessageType = {
                    id: crypto.randomUUID(),
                    role: 'assistant',
                    content: toolArgs.message || getStateResponseMessage('contract_type', { address: analysisContext?.address }),
                    timestamp: new Date(),
                    componentType: 'contract_selector',
                  };

                  setMessages(prev => {
                    const filtered = prev.filter(msg => msg.id !== aiMessageId);
                    return [...filtered, modalMessage];
                  });
                  chatStorage.addMessage(modalMessage);
                  setIsLoading(false);

                } else if (toolName === 'input_price') {
                  // Trigger price input modal
                  stateMachine.transition('price_input');

                  const modalMessage: MessageType = {
                    id: crypto.randomUUID(),
                    role: 'assistant',
                    content: toolArgs.message || getStateResponseMessage('price_input', { contractType: analysisContext?.contractType }),
                    timestamp: new Date(),
                    componentType: 'price_input',
                    componentData: { contractType: analysisContext?.contractType },
                  };

                  setMessages(prev => {
                    const filtered = prev.filter(msg => msg.id !== aiMessageId);
                    return [...filtered, modalMessage];
                  });
                  chatStorage.addMessage(modalMessage);
                  setIsLoading(false);

                } else if (toolName === 'upload_registry') {
                  // Trigger registry upload modal
                  stateMachine.transition('registry_choice');

                  const modalMessage: MessageType = {
                    id: crypto.randomUUID(),
                    role: 'assistant',
                    content: toolArgs.message || getStateResponseMessage('registry_choice', analysisContext),
                    timestamp: new Date(),
                    componentType: 'registry_choice',
                    componentData: {
                      userCredits: analysisContext?.userCredits ?? 0,
                      registryCost: 10
                    },
                  };

                  setMessages(prev => {
                    const filtered = prev.filter(msg => msg.id !== aiMessageId);
                    return [...filtered, modalMessage];
                  });
                  chatStorage.addMessage(modalMessage);
                  setIsLoading(false);

                } else if (toolName === 'start_analysis') {
                  // Start the analysis process
                  await startAnalysis();

                } else {
                  // Unknown tool call - show as regular message
                  console.warn('[ChatInterface] Unknown tool call:', toolName);
                  accumulatedContent = `시스템 ${toolName} 기능을 실행하려 했으나 아직 구현되지 않았습니다.`;
                }

                // Exit the streaming loop after handling tool call
                if (toolName && toolName !== 'start_analysis') {
                  break;
                }

              } else if (data.content) {
                // Accumulate content
                accumulatedContent += data.content;

                // Update message with accumulated content
                setMessages(prev => {
                  const updated = prev.map(msg =>
                    msg.id === aiMessageId
                      ? { ...msg, content: accumulatedContent }
                      : msg
                  );
                  // Save to storage when content updates
                  const aiMsg = updated.find(m => m.id === aiMessageId);
                  if (aiMsg) {
                    chatStorage.addMessage(aiMsg);
                  }
                  return updated;
                });
              }
            } catch (e) {
              // Ignore parsing errors for incomplete chunks
            }
          }
        }
      }
    } catch (error: any) {
        if (error.name === 'AbortError') {
          console.log('Request was cancelled');
        } else {
          console.error('Chat error:', error);

          // Add error message
          setMessages(prev => prev.map(msg =>
            msg.id === aiMessageId
              ? {
                  ...msg,
                  content: '죄송합니다. 응답을 생성하는 중 오류가 발생했습니다. 다시 시도해 주세요.',
                  isError: true,
                  isStreaming: false,
                }
              : msg
          ));
        }
        accepted = false;
      } finally {
        setIsLoading(false);
        abortControllerRef.current = null;

        // 500ms 후 제출 가능 상태로 변경(디바운싱)
        setTimeout(() => {
          setIsSubmitting(false);
        }, 500);
      }

    return accepted;
  };

  const handleChatSubmit = async (content: string, files?: File[]) => {
    return await handleSubmit(content);
  };

  const handleExampleClick = (prompt: string) => {
    handleSubmit(prompt);
  };

  // 파일 업로드 상태 추가
  const [uploadingFiles, setUploadingFiles] = useState<File[]>([]);
  const [uploadedFiles, setUploadedFiles] = useState<Array<{name: string, size: number, id: string}>>([]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      await handleFileUpload(Array.from(files));
    }
  };

  // 파일 업로드泥섎━ ?⑥닔
  const handleFileUpload = async (files: File[]) => {
    if (files.length === 0) return;

    // 비로그인 상태에서 로그인 시도
    if (!isLoggedIn) {
      onLoginRequired?.();
      return false;
    }

    setUploadingFiles(files);

    // 파일 업로드 상태 메시지 표시
    const uploadMessage: MessageType = {
      id: crypto.randomUUID(),
      role: 'system',
      content: `파일 ${files.length}개를 업로드하고 있습니다...`,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, uploadMessage]);

    try {
      // 여기에 실제 파일 업로드 API 호출
      // TODO: 실제 업로드 엔드포인트 구현 필요
      const uploadedFileInfo = files.map(file => ({
        name: file.name,
        size: file.size,
        id: crypto.randomUUID(),
      }));

      // 업로드 완료 후 파일 목록 업데이트
      setUploadedFiles(prev => [...prev, ...uploadedFileInfo]);
      setUploadingFiles([]);

      // 업로드 완료 메시지로 교체
      setMessages(prev => prev.map(msg =>
        msg.id === uploadMessage.id
          ? {
              ...msg,
              content: `파일 ${files.length}개가 업로드되었습니다:${files.map(f => `- ${f.name} (${(f.size / 1024).toFixed(1)}KB)`).join('')}`,
              role: 'system' as const,
            }
          : msg
      ));

      // 파일 정보를 채팅 컨텍스트에 추가
      const fileContext = `업로드된 파일: ${files.map(f => f.name).join(', ')}`;
      setInputValue(prev => prev ? `${prev}${fileContext}` : fileContext);

    } catch (error) {
      console.error('파일 업로드 실패:', error);
      setUploadingFiles([]);

      // 오류 메시지로 교체
      setMessages(prev => prev.map(msg =>
        msg.id === uploadMessage.id
          ? {
              ...msg,
              content: '파일 업로드에 실패했습니다. 다시 시도해주세요.',
              role: 'system' as const,
              isError: true,
            }
          : msg
      ));
    }
  };

  // 드래그앤드롭 상태 추가
  const [isDragging, setIsDragging] = useState(false);

  // 드래그앤드롭 이벤트 핸들러
  const handleDragEnter = (e: React.DragEvent) => {
    // 파일 드래그가 아닌 텍스트 드래그 선택 등에는 반응하지 않도록 가드
    const hasFiles = Array.from(e.dataTransfer?.types || []).includes('Files');
    if (!hasFiles) return;
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget === e.target) {
      setIsDragging(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    const hasFiles = Array.from(e.dataTransfer?.types || []).includes('Files');
    if (!hasFiles) return;
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = async (e: React.DragEvent) => {
    const hasFiles = Array.from(e.dataTransfer?.types || []).includes('Files');
    if (!hasFiles) return;
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      // PDF 및 문서 파일만 필터링
      const validFiles = files.filter(file => {
        const ext = file.name.split('.').pop()?.toLowerCase();
        return ['pdf', 'doc', 'docx', 'hwp', 'txt'].includes(ext || '');
      });

      if (validFiles.length > 0) {
        await handleFileUpload(validFiles);
      } else {
        alert('지원되지 않는 파일 형식입니다. PDF, DOC, DOCX, HWP, TXT 파일만 업로드 가능합니다.');
      }
    }
  };

  return (
    <div
      className="flex flex-col h-full relative"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* 드래그앤드롭 오버레이 */}
      {isDragging && (
        <div className="absolute inset-0 z-50 bg-brand-primary/10 border-2 border-dashed border-brand-primary flex items-center justify-center">
          <div className="bg-white rounded-xl p-8 shadow-lg">
            <Upload className="w-16 h-16 text-brand-primary mx-auto mb-4" />
            <p className="text-lg font-medium text-neutral-800">파일을 여기에 놓으세요</p>
            <p className="text-sm text-neutral-600 mt-2">PDF, DOC, DOCX, HWP, TXT 파일 지원</p>
          </div>
        </div>
      )}
      {messages.length === 0 ? (
        // Original Welcome Screen
        <div className="flex-1 flex items-center justify-center p-8 md:p-12">
          <div className="max-w-2xl w-full">
            {/* Welcome Message */}
            <div className="text-center mb-12 md:mb-16">
              <h1 className="mb-2 md:mb-3 text-neutral-800">
                <span className="text-3xl md:text-[3.125rem] font-medium block mb-4 md:mb-10">주소를 입력하시면</span>
                <span className="text-xl md:text-[2.625rem] font-medium block">부동산 계약을 분석해드리겠어요</span>
              </h1>
            </div>

            {/* Input Section */}
            <form onSubmit={(e) => { e.preventDefault(); void handleSubmit(); }} className="relative">
              <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 overflow-hidden md:rounded-3xl">
                {/* Input Field */}
                <div className="flex items-center p-2 md:p-3 gap-2">
                  <input
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onClick={() => {
                      if (!isLoggedIn) {
                        onLoginRequired?.();
                      }
                    }}
                    placeholder="부동산 계약과 관련된 무엇이든 물어보세요."
                    className="flex-1 outline-none text-neutral-800 placeholder-neutral-400 text-sm md:text-base pl-2"
                    disabled={isLoading}
                  />

                  {/* Action Buttons */}
                  <div className="flex items-center gap-2">
                    {/* Deep Search - Desktop Only */}
                    <button
                      type="button"
                      className="hidden md:block p-2 rounded-lg hover:bg-neutral-100 transition-colors group relative"
                      title="검색"
                    >
                      <Search className="w-4 h-4 text-neutral-600 group-hover:text-brand-primary" />
                    </button>

                    {/* File Upload */}
                    <input
                      ref={fileInputRef}
                      type="file"
                      onChange={handleFileSelect}
                      multiple
                      accept=".pdf,.doc,.docx,.hwp,.txt"
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="p-2 rounded-lg hover:bg-neutral-100 transition-colors group"
                      title="파일 업로드"
                    >
                      <Upload className="w-4 h-4 text-neutral-600 group-hover:text-brand-primary" />
                    </button>

                    {/* Submit Button */}
                    <button
                      type="submit"
                      disabled={!inputValue.trim() || isLoading}
                      className="p-2 rounded-lg bg-brand-primary text-white hover:bg-brand-secondary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Send className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </form>

            {/* Example Prompts */}
            <div className="mt-8 md:mt-12 grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
              <button
                onClick={() => window.location.href = '/guide/lease-analysis'}
                className="text-left p-2 md:p-3 bg-white rounded-lg md:rounded-xl border border-neutral-200 hover:border-brand-primary hover:shadow-sm transition-all"
              >
                <h3 className="font-medium text-neutral-800 mb-0.5 text-xs md:text-sm">전세 계약 분석 가이드</h3>
                <p className="text-xs text-neutral-600">특약사항과 보증금 보호 조건을 확인해드려요</p>
              </button>

              <button
                onClick={() => window.location.href = '/guide/purchase-review'}
                className="text-left p-2 md:p-3 bg-white rounded-lg md:rounded-xl border border-neutral-200 hover:border-brand-primary hover:shadow-sm transition-all"
              >
                <h3 className="font-medium text-neutral-800 mb-0.5 text-xs md:text-sm">매매 계약 검토 가이드</h3>
                <p className="text-xs text-neutral-600">최적의 매매가 협상 시점과 특약사항을 검토해드려요</p>
              </button>

              <button
                onClick={() => window.location.href = '/guide/rental-checklist'}
                className="text-left p-2 md:p-3 bg-white rounded-lg md:rounded-xl border border-neutral-200 hover:border-brand-primary hover:shadow-sm transition-all"
              >
                <h3 className="font-medium text-neutral-800 mb-0.5 text-xs md:text-sm">월세 계약 체크리스트</h3>
                <p className="text-xs text-neutral-600">월세 계약 시 필수 확인사항을 단계별로 안내해드려요</p>
              </button>

              <button
                onClick={() => window.location.href = '/guide/fraud-prevention'}
                className="text-left p-2 md:p-3 bg-white rounded-lg md:rounded-xl border border-neutral-200 hover:border-brand-primary hover:shadow-sm transition-all"
              >
                <h3 className="font-medium text-neutral-800 mb-0.5 text-xs md:text-sm">전세사기 예방 가이드</h3>
                <p className="text-xs text-neutral-600">피해 예방을 위한 단계별 가이드, 지원책을 소개해드려요</p>
              </button>
            </div>
          </div>
        </div>
      ) : (
        // Chat Messages Area
        <div className="flex-1 overflow-y-auto px-4 pt-12 pb-6 md:px-6 md:pt-16">
          <div className="max-w-3xl mx-auto">
            {messages.map((message, index) => (
              <Message
                key={message.id}
                message={message}
                isTyping={index === messages.length - 1 && message.role === 'assistant'}
                onContractTypeSelect={handleContractTypeSelect}
                onPriceSubmit={handlePriceSubmit}
                onRegistryChoiceSelect={handleRegistryChoiceSelect}
                onAddressSelect={handleAddressSelect}
              />
            ))}

            {/* AI 응답 생성 중 로딩 인디케이터 */}
            {isLoading && messages.length > 0 && messages[messages.length - 1]?.role === 'user' && (
              <div className="mb-6">
                <ChatLoadingIndicator />
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>
      )}

      {/* Chat Input - Only show after conversation starts */}
      {messages.length > 0 && (
        <div>
          <div className="max-w-3xl mx-auto">
            <ChatInput
              onSubmit={handleChatSubmit}
              isLoading={isLoading}
              isSubmitting={isSubmitting}
              placeholder="메시지를 입력하세요..."
            />
          </div>
        </div>
      )}
    </div>
  );
}























