export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
  isError?: boolean;
  pending?: boolean; // ✨ 낙관적 업데이트: 서버 저장 대기 중

  // 분석 플로우용 확장
  componentType?: 'address_search' | 'contract_selector' | 'price_input' | 'registry_choice' | 'progress' | 'report';
  componentData?: Record<string, any>;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ChatFile {
  id: string;
  name: string;
  type: string;
  size: number;
  url?: string;
}