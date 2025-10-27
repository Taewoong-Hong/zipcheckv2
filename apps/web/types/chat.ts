export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
  isError?: boolean;

  // 분석 플로우용 확장
  componentType?: 'address_search' | 'contract_selector' | 'registry_choice' | 'progress' | 'report';
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