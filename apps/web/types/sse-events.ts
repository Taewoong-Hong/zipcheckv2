/**
 * SSE (Server-Sent Events) 이벤트 타입 정의
 *
 * FastAPI 듀얼 LLM 스트리밍 엔드포인트에서 전송하는 이벤트 포맷
 * - /analyze/stream/{case_id}
 * - /chat/stream
 */

/**
 * SSE 이벤트 페이즈 (처리 단계)
 */
export type SSEPhase =
  | 'start'           // 시작 단계
  | 'case_loading'    // 케이스 데이터 조회
  | 'registry_parsing' // 등기부 파싱
  | 'public_data'     // 공공데이터 조회
  | 'risk_calculation' // 리스크 점수 계산
  | 'draft'           // GPT-4o-mini 초안 생성
  | 'validation'      // Claude Sonnet 검증
  | 'report_saving'   // 리포트 저장
  | 'state_transition' // 상태 전환
  | 'completion';     // 완료

/**
 * LLM 모델 타입
 */
export type LLMModel =
  | 'gpt-4o-mini'
  | 'claude-3-5-sonnet-latest'
  | 'claude-3-5-haiku-latest';

/**
 * 기본 SSE 이벤트 인터페이스
 */
export interface BaseSSEEvent {
  /** 이벤트 단계 (1~8 정수 또는 소수점) */
  step: number;
  /** 진행 메시지 (사용자에게 표시) */
  message: string;
  /** 진행률 (0.0~1.0) */
  progress: number;
  /** 현재 처리 페이즈 (선택) */
  phase?: SSEPhase;
  /** LLM 모델 이름 (선택) */
  model?: LLMModel;
}

/**
 * 에러 이벤트
 */
export interface SSEErrorEvent {
  error: string;
}

/**
 * 완료 이벤트
 */
export interface SSEDoneEvent extends BaseSSEEvent {
  /** 완료 플래그 (반드시 true) */
  done: true;
  /** 생성된 리포트 ID (분석 엔드포인트) */
  report_id?: string;
}

/**
 * 케이스 로딩 이벤트
 */
export interface SSECaseLoadingEvent extends BaseSSEEvent {
  phase: 'case_loading';
  /** 조회된 주소 */
  address?: string;
}

/**
 * 등기부 파싱 이벤트
 */
export interface SSERegistryParsingEvent extends BaseSSEEvent {
  phase: 'registry_parsing';
  /** 등기부 요약 정보 (마스킹됨) */
  registry_summary?: {
    property_address?: string;
    owner?: {
      name?: string;  // 마스킹됨 (예: 홍XX)
      share_ratio?: string;
    };
    mortgages?: Array<{
      creditor?: string;
      amount?: number;
    }>;
    seizures?: Array<{
      type?: string;
      creditor?: string;
    }>;
  };
}

/**
 * 공공데이터 조회 이벤트
 */
export interface SSEPublicDataEvent extends BaseSSEEvent {
  phase: 'public_data';
  /** 법정동코드 */
  lawd_cd?: string;
  /** 평균 실거래가 (만원) */
  avg_trade_price?: number;
  /** 분석 거래 건수 */
  trade_count?: number;
}

/**
 * 리스크 점수 이벤트
 */
export interface SSERiskScoreEvent extends BaseSSEEvent {
  phase: 'risk_calculation';
  /** 리스크 점수 상세 정보 */
  risk_score?: {
    total_score: number;
    risk_level: '안전' | '주의' | '위험' | '심각';
    jeonse_ratio?: number;
    mortgage_ratio?: number;
    risk_factors?: string[];
  };
}

/**
 * LLM 초안 생성 이벤트
 */
export interface SSEDraftEvent extends BaseSSEEvent {
  phase: 'draft';
  model: 'gpt-4o-mini';
  /** 생성된 초안 길이 (문자 수) */
  draft_length?: number;
  /** 현재까지 생성된 길이 (스트리밍 중) */
  partial_length?: number;
}

/**
 * LLM 검증 이벤트
 */
export interface SSEValidationEvent extends BaseSSEEvent {
  phase: 'validation';
  model: LLMModel;
  /** 검증 결과 길이 (문자 수) */
  validation_length?: number;
  /** 현재까지 생성된 길이 (스트리밍 중) */
  partial_length?: number;
}

/**
 * 리포트 저장 이벤트
 */
export interface SSEReportSavingEvent extends BaseSSEEvent {
  phase: 'report_saving';
}

/**
 * 상태 전환 이벤트
 */
export interface SSEStateTransitionEvent extends BaseSSEEvent {
  phase: 'state_transition';
  /** 현재 상태 */
  current_state?: string;
  /** 다음 상태 */
  next_state?: string;
}

/**
 * 통합 SSE 이벤트 타입 (모든 이벤트의 유니온)
 */
export type SSEEvent =
  | SSEErrorEvent
  | SSEDoneEvent
  | SSECaseLoadingEvent
  | SSERegistryParsingEvent
  | SSEPublicDataEvent
  | SSERiskScoreEvent
  | SSEDraftEvent
  | SSEValidationEvent
  | SSEReportSavingEvent
  | SSEStateTransitionEvent
  | BaseSSEEvent;

/**
 * SSE 이벤트 타입 가드 함수들
 */
export const isSSEError = (event: SSEEvent): event is SSEErrorEvent =>
  'error' in event;

export const isSSEDone = (event: SSEEvent): event is SSEDoneEvent =>
  'done' in event && event.done === true;

export const isSSEDraft = (event: SSEEvent): event is SSEDraftEvent =>
  'phase' in event && event.phase === 'draft';

export const isSSEValidation = (event: SSEEvent): event is SSEValidationEvent =>
  'phase' in event && event.phase === 'validation';

export const isSSERiskScore = (event: SSEEvent): event is SSERiskScoreEvent =>
  'phase' in event && event.phase === 'risk_calculation';

/**
 * SSE 이벤트 파싱 헬퍼 함수
 */
export const parseSSEEvent = (data: string): SSEEvent | null => {
  try {
    return JSON.parse(data) as SSEEvent;
  } catch (error) {
    console.error('[parseSSEEvent] JSON 파싱 실패:', data, error);
    return null;
  }
};

/**
 * EventSource 메시지 핸들러 타입
 */
export type SSEMessageHandler = (event: SSEEvent) => void;

/**
 * EventSource 에러 핸들러 타입
 */
export type SSEErrorHandler = (error: Event) => void;

/**
 * SSE 스트림 설정 옵션
 */
export interface SSEStreamOptions {
  /** 메시지 이벤트 핸들러 */
  onMessage: SSEMessageHandler;
  /** 에러 이벤트 핸들러 */
  onError?: SSEErrorHandler;
  /** 자동 재연결 시도 횟수 (기본값: 3) */
  maxRetries?: number;
  /** 재연결 간격 (ms, 기본값: 2000) */
  retryInterval?: number;
}

/**
 * SSE 스트림 생성 헬퍼 함수
 *
 * @param url - SSE 엔드포인트 URL
 * @param options - 스트림 설정 옵션
 * @returns EventSource 인스턴스 (수동 close() 필요)
 *
 * @example
 * const eventSource = createSSEStream('/api/chat/stream', {
 *   onMessage: (event) => {
 *     if (isSSEDone(event)) {
 *       console.log('스트림 완료:', event.report_id);
 *     } else if (isSSEError(event)) {
 *       console.error('에러:', event.error);
 *     }
 *   },
 *   onError: (error) => {
 *     console.error('SSE 연결 에러:', error);
 *   }
 * });
 *
 * // 정리
 * return () => eventSource.close();
 */
export const createSSEStream = (
  url: string,
  options: SSEStreamOptions
): EventSource => {
  const {
    onMessage,
    onError,
    maxRetries = 3,
    retryInterval = 2000
  } = options;

  let retryCount = 0;

  const eventSource = new EventSource(url);

  eventSource.onmessage = (msgEvent: MessageEvent) => {
    const event = parseSSEEvent(msgEvent.data);
    if (event) {
      onMessage(event);

      // 완료 이벤트 받으면 자동 종료
      if (isSSEDone(event)) {
        eventSource.close();
      }
    }
  };

  eventSource.onerror = (error: Event) => {
    console.error('[SSE] 연결 에러:', error);

    if (retryCount < maxRetries) {
      retryCount++;
      console.log(`[SSE] 재연결 시도 ${retryCount}/${maxRetries}...`);

      setTimeout(() => {
        // EventSource는 자동 재연결을 시도하므로 별도 로직 불필요
      }, retryInterval * retryCount);
    } else {
      console.error('[SSE] 최대 재연결 시도 초과, 연결 종료');
      eventSource.close();
    }

    if (onError) {
      onError(error);
    }
  };

  return eventSource;
};
