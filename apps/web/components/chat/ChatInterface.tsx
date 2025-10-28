"use client";

import React, { useState, useRef, useEffect } from "react";
import { Upload, Send, Search, Loader2, ChevronRight, ChevronLeft } from "lucide-react";
import { Message as MessageType } from "@/types/chat";
import type { ContractType, RegistryMethod, AddressInfo, ChatState } from "@/types/analysis";
import Message from "./Message";
import ChatInput from "./ChatInput";
import { chatStorage } from "@/lib/chatStorage";
import { simulateTestResponse } from "@/lib/testScenario";
import { ChatLoadingIndicator } from "@/components/common/LoadingSpinner";
import { StateMachine } from "@/lib/stateMachine";
import { supabase } from "@/lib/supabase";
import {
  isAddressInput,
  isAnalysisStartTrigger,
  getStateResponseMessage,
  createCase,
  updateCase,
  uploadRegistry,
  runAnalysis,
  getReport,
  getUserCredits,
  type AnalysisContext,
} from "@/lib/analysisFlow";

interface ChatInterfaceProps {
  isSidebarExpanded: boolean;
  onToggleSidebar: () => void;
  isLoggedIn?: boolean;
  onLoginRequired?: () => void;
}

export default function ChatInterface({
  isSidebarExpanded,
  onToggleSidebar,
  isLoggedIn = true,
  onLoginRequired
}: ChatInterfaceProps) {
  const [messages, setMessages] = useState<MessageType[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [conversationId, setConversationId] = useState<string | null>(() => {
    // Restore conversation ID from localStorage on mount
    if (typeof window !== 'undefined') {
      return localStorage.getItem('chat_conversation_id');
    }
    return null;
  });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Analysis flow state
  const [stateMachine] = useState(() => new StateMachine('init'));
  const [analysisContext, setAnalysisContext] = useState<AnalysisContext>({});

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
      if (!isLoggedIn || conversationId) return; // Skip if already have a conversation

      try {
        // Get Supabase session
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        // Create new conversation
        const response = await fetch('/api/chat/init', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ session }),
        });

        if (response.ok) {
          const data = await response.json();
          setConversationId(data.conversation_id);
          console.log('New conversation created:', data.conversation_id);
        }
      } catch (error) {
        console.error('Failed to initialize conversation:', error);
      }
    };

    initConversation();
  }, [isLoggedIn, conversationId]);

  // Reset chat function for new conversation
  const resetChat = async () => {
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
    if (isLoggedIn) {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          const response = await fetch('/api/chat/init', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ session }),
          });

          if (response.ok) {
            const data = await response.json();
            setConversationId(data.conversation_id);
          }
        }
      } catch (error) {
        console.error('Failed to create new conversation:', error);
      }
    }
  };

  // Handle address selection
  const handleAddressSelect = async (address: any) => {
    // Add user selection message
    const userMessage: MessageType = {
      id: Date.now().toString(),
      role: 'user',
      content: `선택한 주소: ${address.roadAddr}`,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMessage]);
    chatStorage.addMessage(userMessage);

    try {
      // Create case with selected address
      const addressInfo: AddressInfo = {
        road: address.roadAddr,
        lot: address.jibunAddr,
        zipCode: address.zipNo,
        buildingName: address.bdNm,
      };
      const caseId = await createCase(addressInfo);

      setAnalysisContext({ caseId, address: addressInfo });

      // Transition to contract_type state
      stateMachine.transition('contract_type');

      const aiMessage: MessageType = {
        id: (Date.now() + 1).toString(),
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
        id: (Date.now() + 1).toString(),
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
    } catch (error) {
      console.error('Failed to update contract type:', error);
    }

    // Add user selection message
    const userMessage: MessageType = {
      id: Date.now().toString(),
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
      id: (Date.now() + 1).toString(),
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
      content = `매매가: ${data.deposit?.toLocaleString('ko-KR')}만원`;
    } else if (contractType === '전세') {
      content = `보증금: ${data.deposit?.toLocaleString('ko-KR')}만원`;
    } else {
      content = `보증금: ${data.deposit?.toLocaleString('ko-KR')}만원, 월세: ${data.monthlyRent?.toLocaleString('ko-KR')}만원`;
    }

    // Add user selection message
    const userMessage: MessageType = {
      id: Date.now().toString(),
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
      id: (Date.now() + 1).toString(),
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
      id: Date.now().toString(),
      role: 'user',
      content: method === 'issue' ? '등기부등본 발급 요청' : '등기부등본 업로드',
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
          id: (Date.now() + 1).toString(),
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
          id: (Date.now() + 1).toString(),
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
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: '등기부 처리 중 오류가 발생했습니다. 다시 시도해주세요.',
        timestamp: new Date(),
        isError: true,
      };
      setMessages(prev => [...prev, aiMessage]);
      chatStorage.addMessage(aiMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // Start analysis
  const startAnalysis = async () => {
    if (!analysisContext.caseId) {
      console.error('No case ID found');
      return;
    }

    // Transition to parse_enrich
    stateMachine.transition('parse_enrich');

    const processingMessage: MessageType = {
      id: Date.now().toString(),
      role: 'assistant',
      content: getStateResponseMessage('parse_enrich'),
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, processingMessage]);
    chatStorage.addMessage(processingMessage);

    try {
      // Run analysis
      await runAnalysis(analysisContext.caseId);

      // Get report data
      const reportData = await getReport(analysisContext.caseId);

      // Transition to report
      stateMachine.transition('report');

      const reportMessage: MessageType = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: getStateResponseMessage('report'),
        timestamp: new Date(),
        componentType: 'report',
        componentData: {
          reportContent: reportData.content,
          contractType: reportData.contractType || analysisContext.contractType,
          address: reportData.address || analysisContext.address?.road,
        },
      };
      setMessages(prev => [...prev, reportMessage]);
      chatStorage.addMessage(reportMessage);
    } catch (error) {
      console.error('Analysis error:', error);
      stateMachine.transition('error');

      const errorMessage: MessageType = {
        id: (Date.now() + 1).toString(),
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
  const loadSession = (sessionId: string) => {
    const success = chatStorage.setCurrentSession(sessionId);
    if (success) {
      const session = chatStorage.getCurrentSession();
      if (session) {
        setMessages(session.messages);
      }
    }
  };

  // Save current chat function
  const saveCurrentChat = () => {
    // chatStorage already auto-saves messages, but we ensure it's saved
    const session = chatStorage.getCurrentSession();
    if (session && session.messages.length > 0) {
      // Session is already saved in localStorage through chatStorage
      console.log('Current chat saved:', session.id);
    }
  };

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
  }, []);

  // Auto scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    // 비로그인 상태일 때 로그인 유도
    if (!isLoggedIn) {
      onLoginRequired?.();
      return;
    }

    if (inputValue.trim() && !isLoading) {
      const content = inputValue.trim();
      setInputValue("");

      // Add user message
      const userMessage: MessageType = {
        id: Date.now().toString(),
        role: 'user',
        content,
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, userMessage]);
      chatStorage.addMessage(userMessage); // Save to storage
      setIsLoading(true);

      // Check current state and detect analysis triggers
      const currentState = stateMachine.getState();

      // Handle based on current state
      if (currentState === 'init' && isAddressInput(content)) {
        // User entered an address - show address search selector
        stateMachine.transition('address_pick');

        const aiMessage: MessageType = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: '주소를 검색해주세요. 정확한 주소를 선택하면 분석이 더 정확해집니다.',
          timestamp: new Date(),
          componentType: 'address_search',
          componentData: { initialAddress: content },
        };
        setMessages(prev => [...prev, aiMessage]);
        chatStorage.addMessage(aiMessage);
        setIsLoading(false);
        return;
      }

      // Prepare AI message placeholder
      const aiMessageId = (Date.now() + 1).toString();
      const aiMessage: MessageType = {
        id: aiMessageId,
        role: 'assistant',
        content: '',
        timestamp: new Date(),
        isStreaming: true,
      };

      setMessages(prev => [...prev, aiMessage]);

      // Check if input is "test" - run simulation
      if (content.toLowerCase() === 'test') {
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
                  content: '시뮬레이션 중 오류가 발생했습니다.',
                  isError: true,
                  isStreaming: false,
                }
              : msg
          ));
          setIsLoading(false);
        }
        return; // Exit early for test mode
      }

      try {
        // Ensure conversation ID exists
        if (!conversationId) {
          throw new Error('대화 세션이 없습니다. 페이지를 새로고침해주세요.');
        }

        // Get Supabase session
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          throw new Error('로그인 세션이 만료되었습니다.');
        }

        // Create abort controller for cancellation
        abortControllerRef.current = new AbortController();

        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            conversation_id: conversationId,
            content,
            session,
          }),
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        if (!response.body) {
          throw new Error('No response body');
        }

        // Handle streaming response
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let accumulatedContent = '';

        while (true) {
          const { done, value } = await reader.read();

          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));

                if (data.done) {
                  // Streaming complete
                  setMessages(prev => prev.map(msg =>
                    msg.id === aiMessageId
                      ? { ...msg, isStreaming: false }
                      : msg
                  ));
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
      } finally {
        setIsLoading(false);
        abortControllerRef.current = null;
      }
    }
  };

  const handleChatSubmit = (content: string, files?: File[]) => {
    setInputValue(content);
    // 즉시 submit 실행
    setTimeout(() => handleSubmit(), 0);
  };

  const handleExampleClick = (prompt: string) => {
    setInputValue(prompt);
    setTimeout(() => handleSubmit(), 0);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      // TODO: Handle file upload
      console.log("Files selected:", files);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {messages.length === 0 ? (
        // Original Welcome Screen
        <div className="flex-1 flex items-center justify-center p-8 md:p-12">
          <div className="max-w-2xl w-full">
            {/* Welcome Message */}
            <div className="text-center mb-12 md:mb-16">
              <h1 className="mb-2 md:mb-3 text-neutral-800">
                <span className="text-3xl md:text-[3.125rem] font-medium block mb-4 md:mb-10">주소를 입력하시면</span>
                <span className="text-xl md:text-[2.625rem] font-medium block">부동산 계약을 분석해드릴게요</span>
              </h1>
            </div>

            {/* Input Section */}
            <form onSubmit={handleSubmit} className="relative">
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
                    placeholder="부동산 계약과 관련된 무엇이든 물어보세요"
                    className="flex-1 outline-none text-neutral-800 placeholder-neutral-400 text-sm md:text-base pl-2"
                    disabled={isLoading}
                  />

                  {/* Action Buttons */}
                  <div className="flex items-center gap-2">
                    {/* Deep Search - Desktop Only */}
                    <button
                      type="button"
                      className="hidden md:block p-2 rounded-lg hover:bg-neutral-100 transition-colors group relative"
                      title="딥 서치"
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
                <h3 className="font-medium text-neutral-800 mb-0.5 text-xs md:text-sm">📄 임대차 계약 분석 가이드</h3>
                <p className="text-xs text-neutral-600">특약사항과 보증금 보호 조건을 확인해드려요</p>
              </button>

              <button
                onClick={() => window.location.href = '/guide/purchase-review'}
                className="text-left p-2 md:p-3 bg-white rounded-lg md:rounded-xl border border-neutral-200 hover:border-brand-primary hover:shadow-sm transition-all"
              >
                <h3 className="font-medium text-neutral-800 mb-0.5 text-xs md:text-sm">🏢 매매 계약 검토 가이드</h3>
                <p className="text-xs text-neutral-600">최적의 매매가와 협상 포지션, 특약사항을 검토해드려요</p>
              </button>

              <button
                onClick={() => window.location.href = '/guide/rental-checklist'}
                className="text-left p-2 md:p-3 bg-white rounded-lg md:rounded-xl border border-neutral-200 hover:border-brand-primary hover:shadow-sm transition-all"
              >
                <h3 className="font-medium text-neutral-800 mb-0.5 text-xs md:text-sm">✅ 전세 계약 체크리스트</h3>
                <p className="text-xs text-neutral-600">전세 계약 전 필수 확인사항을 단계별로 안내해드려요</p>
              </button>

              <button
                onClick={() => window.location.href = '/guide/fraud-prevention'}
                className="text-left p-2 md:p-3 bg-white rounded-lg md:rounded-xl border border-neutral-200 hover:border-brand-primary hover:shadow-sm transition-all"
              >
                <h3 className="font-medium text-neutral-800 mb-0.5 text-xs md:text-sm">🚨 전세사기 피해 가이드</h3>
                <p className="text-xs text-neutral-600">피해 대응을 위한 단계별 가이드, 양식을 제공해드려요</p>
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

            {/* AI 답변 생성 중 로딩 인디케이터 */}
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
              placeholder="메시지를 입력하세요..."
            />
          </div>
        </div>
      )}
    </div>
  );
}