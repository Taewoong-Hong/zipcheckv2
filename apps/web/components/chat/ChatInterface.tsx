"use client";

import React, { useState, useRef, useEffect } from "react";
import { Upload, Send, Search, Loader2, ChevronRight, ChevronLeft } from "lucide-react";
import { Message as MessageType } from "@/types/chat";
import Message from "./Message";
import ChatInput from "./ChatInput";
import { chatStorage } from "@/lib/chatStorage";

interface ChatInterfaceProps {
  isSidebarExpanded: boolean;
  onToggleSidebar: () => void;
}

export default function ChatInterface({ isSidebarExpanded, onToggleSidebar }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<MessageType[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Reset chat function for new conversation
  const resetChat = () => {
    setMessages([]);
    setInputValue("");
    setIsLoading(false);
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    // Create new session
    chatStorage.createSession();
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

      try {
        // Create abort controller for cancellation
        abortControllerRef.current = new AbortController();

        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messages: [...messages, userMessage].map(m => ({
              role: m.role,
              content: m.content,
            })),
            stream: true,
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
              <h1 className="font-bold mb-2 md:mb-3 text-neutral-800">
                <span className="text-3xl md:text-[2.5rem] block mb-4">주소를 입력하시면</span>
                <span className="text-xl md:text-2xl block">부동산 계약을 분석해드릴게요</span>
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
                onClick={() => handleExampleClick("임대차 계약서에서 확인해야 할 중요한 포인트를 알려주세요")}
                className="text-left p-2 md:p-3 bg-white rounded-lg md:rounded-xl border border-neutral-200 hover:border-brand-primary hover:shadow-sm transition-all"
              >
                <h3 className="font-medium text-neutral-800 mb-0.5 text-xs md:text-sm">📄 임대차 계약서 분석</h3>
                <p className="text-xs text-neutral-600">특약사항과 보증금 보호 조건을 확인해드려요</p>
              </button>

              <button
                onClick={() => handleExampleClick("매매 계약서에서 주의해야 할 법적 리스크가 무엇인가요?")}
                className="text-left p-2 md:p-3 bg-white rounded-lg md:rounded-xl border border-neutral-200 hover:border-brand-primary hover:shadow-sm transition-all"
              >
                <h3 className="font-medium text-neutral-800 mb-0.5 text-xs md:text-sm">🏢 매매 계약서 검토</h3>
                <p className="text-xs text-neutral-600">권리관계와 하자담보책임을 분석해드려요</p>
              </button>

              <button
                onClick={() => handleExampleClick("전세 사기를 예방하는 방법을 알려주세요")}
                className="text-left p-2 md:p-3 bg-white rounded-lg md:rounded-xl border border-neutral-200 hover:border-brand-primary hover:shadow-sm transition-all"
              >
                <h3 className="font-medium text-neutral-800 mb-0.5 text-xs md:text-sm">⚖️ 법적 리스크 체크</h3>
                <p className="text-xs text-neutral-600">계약 조항의 법적 문제점을 찾아드려요</p>
              </button>

              <button
                onClick={() => handleExampleClick("보증금, 중도금, 잔금 일정을 정리해주세요")}
                className="text-left p-2 md:p-3 bg-white rounded-lg md:rounded-xl border border-neutral-200 hover:border-brand-primary hover:shadow-sm transition-all"
              >
                <h3 className="font-medium text-neutral-800 mb-0.5 text-xs md:text-sm">💰 금전 관련 조항</h3>
                <p className="text-xs text-neutral-600">보증금, 중도금, 잔금 일정을 정리해드려요</p>
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
              />
            ))}
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