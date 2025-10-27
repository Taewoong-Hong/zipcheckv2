/**
 * 채팅 상태머신 (State Machine)
 *
 * @description
 * 부동산 계약 분석 프로세스의 상태 전이를 관리하는 유틸리티
 * S0(init) → S1(address_pick) → S2(contract_type) → ... → S6(report)
 *
 * @author 집체크 개발팀
 * @version 1.0.0
 * @date 2025-01-27
 */

import { ChatState } from '@/types/analysis';

/**
 * 상태 전이 규칙
 *
 * @description
 * 각 상태에서 전이 가능한 다음 상태들을 정의
 */
const STATE_TRANSITIONS: Record<ChatState, ChatState[]> = {
  init: ['address_pick', 'error'],
  address_pick: ['contract_type', 'error'],
  contract_type: ['registry_choice', 'error'],
  registry_choice: ['registry_ready', 'error'],
  registry_ready: ['parse_enrich', 'error'],
  parse_enrich: ['report', 'error'],
  report: ['init', 'error'],  // 새로운 분석 시작 가능
  error: ['init'],            // 에러 상태에서는 처음부터 다시
};

/**
 * 상태별 프롬프트 메시지
 */
const STATE_PROMPTS: Record<ChatState, string> = {
  init: '집 주소를 입력해주세요. 📍',
  address_pick: '주소를 선택해주세요.',
  contract_type: '계약 유형을 선택해주세요.',
  registry_choice: '등기부등본을 발급하시겠습니까? (크레딧 차감)\n또는 등기부등본 PDF를 업로드해주세요.',
  registry_ready: '등기부등본을 확인하고 있습니다...',
  parse_enrich: '데이터를 분석하고 있습니다...',
  report: '분석이 완료되었습니다! 📊',
  error: '오류가 발생했습니다. 처음부터 다시 시작해주세요.',
};

/**
 * 상태 전이 검증
 *
 * @param currentState - 현재 상태
 * @param nextState - 다음 상태
 * @returns 전이 가능 여부
 */
export function canTransition(
  currentState: ChatState,
  nextState: ChatState
): boolean {
  const allowedTransitions = STATE_TRANSITIONS[currentState];
  return allowedTransitions.includes(nextState);
}

/**
 * 상태 전이 실행
 *
 * @param currentState - 현재 상태
 * @param nextState - 다음 상태
 * @returns 새로운 상태 (전이 실패 시 현재 상태)
 */
export function transition(
  currentState: ChatState,
  nextState: ChatState
): ChatState {
  if (canTransition(currentState, nextState)) {
    return nextState;
  }

  console.warn(`Invalid state transition: ${currentState} → ${nextState}`);
  return currentState;
}

/**
 * 다음 상태 조회
 *
 * @param currentState - 현재 상태
 * @returns 가능한 다음 상태들
 */
export function getNextStates(currentState: ChatState): ChatState[] {
  return STATE_TRANSITIONS[currentState];
}

/**
 * 상태별 프롬프트 메시지 조회
 *
 * @param state - 상태
 * @returns 프롬프트 메시지
 */
export function getStatePrompt(state: ChatState): string {
  return STATE_PROMPTS[state];
}

/**
 * 상태 진행률 계산
 *
 * @param state - 현재 상태
 * @returns 진행률 (0-100)
 */
export function getStateProgress(state: ChatState): number {
  const progressMap: Record<ChatState, number> = {
    init: 0,
    address_pick: 15,
    contract_type: 30,
    registry_choice: 45,
    registry_ready: 60,
    parse_enrich: 80,
    report: 100,
    error: 0,
  };

  return progressMap[state];
}

/**
 * 상태가 완료 상태인지 확인
 *
 * @param state - 상태
 * @returns 완료 여부
 */
export function isCompleteState(state: ChatState): boolean {
  return state === 'report';
}

/**
 * 상태가 에러 상태인지 확인
 *
 * @param state - 상태
 * @returns 에러 여부
 */
export function isErrorState(state: ChatState): boolean {
  return state === 'error';
}

/**
 * 상태가 사용자 입력 대기 상태인지 확인
 *
 * @param state - 상태
 * @returns 입력 대기 여부
 */
export function isWaitingForInput(state: ChatState): boolean {
  return ['init', 'address_pick', 'contract_type', 'registry_choice'].includes(state);
}

/**
 * 상태가 백엔드 처리 중 상태인지 확인
 *
 * @param state - 상태
 * @returns 처리 중 여부
 */
export function isProcessing(state: ChatState): boolean {
  return ['registry_ready', 'parse_enrich'].includes(state);
}

/**
 * 상태 검증
 *
 * @param state - 검증할 상태 문자열
 * @returns 유효한 ChatState 또는 null
 */
export function validateState(state: string): ChatState | null {
  const validStates: ChatState[] = [
    'init',
    'address_pick',
    'contract_type',
    'registry_choice',
    'registry_ready',
    'parse_enrich',
    'report',
    'error',
  ];

  if (validStates.includes(state as ChatState)) {
    return state as ChatState;
  }

  return null;
}

/**
 * 상태 히스토리 관리 클래스
 */
export class StateHistory {
  private history: ChatState[] = [];
  private maxHistory: number = 50;

  /**
   * 상태 추가
   */
  push(state: ChatState): void {
    this.history.push(state);

    // 최대 히스토리 크기 유지
    if (this.history.length > this.maxHistory) {
      this.history.shift();
    }
  }

  /**
   * 이전 상태 조회
   */
  getPrevious(): ChatState | null {
    if (this.history.length < 2) {
      return null;
    }
    return this.history[this.history.length - 2];
  }

  /**
   * 현재 상태 조회
   */
  getCurrent(): ChatState | null {
    if (this.history.length === 0) {
      return null;
    }
    return this.history[this.history.length - 1];
  }

  /**
   * 전체 히스토리 조회
   */
  getAll(): ChatState[] {
    return [...this.history];
  }

  /**
   * 히스토리 초기화
   */
  clear(): void {
    this.history = [];
  }

  /**
   * 특정 상태를 거쳤는지 확인
   */
  hasVisited(state: ChatState): boolean {
    return this.history.includes(state);
  }

  /**
   * 특정 상태 방문 횟수
   */
  visitCount(state: ChatState): number {
    return this.history.filter(s => s === state).length;
  }
}

/**
 * 상태머신 디버깅 정보
 */
export function getStateMachineDebugInfo(
  currentState: ChatState,
  history?: StateHistory
): string {
  const nextStates = getNextStates(currentState);
  const progress = getStateProgress(currentState);
  const prompt = getStatePrompt(currentState);

  let debug = `
Current State: ${currentState}
Progress: ${progress}%
Prompt: ${prompt}
Next States: ${nextStates.join(', ')}
Is Complete: ${isCompleteState(currentState)}
Is Error: ${isErrorState(currentState)}
Is Waiting for Input: ${isWaitingForInput(currentState)}
Is Processing: ${isProcessing(currentState)}
`;

  if (history) {
    debug += `
History: ${history.getAll().join(' → ')}
Previous State: ${history.getPrevious() || 'N/A'}
`;
  }

  return debug.trim();
}

/**
 * 상태 전이 이벤트 타입
 */
export interface StateTransitionEvent {
  from: ChatState;
  to: ChatState;
  timestamp: Date;
  metadata?: Record<string, any>;
}

/**
 * 상태 전이 리스너 타입
 */
export type StateTransitionListener = (event: StateTransitionEvent) => void;

/**
 * 상태머신 (이벤트 기반)
 */
export class StateMachine {
  private currentState: ChatState;
  private history: StateHistory;
  private listeners: StateTransitionListener[] = [];

  constructor(initialState: ChatState = 'init') {
    this.currentState = initialState;
    this.history = new StateHistory();
    this.history.push(initialState);
  }

  /**
   * 현재 상태 조회
   */
  getState(): ChatState {
    return this.currentState;
  }

  /**
   * 상태 전이
   */
  transition(nextState: ChatState, metadata?: Record<string, any>): boolean {
    if (!canTransition(this.currentState, nextState)) {
      console.error(`Invalid transition: ${this.currentState} → ${nextState}`);
      return false;
    }

    const from = this.currentState;
    this.currentState = nextState;
    this.history.push(nextState);

    // 이벤트 발생
    const event: StateTransitionEvent = {
      from,
      to: nextState,
      timestamp: new Date(),
      metadata,
    };

    this.notifyListeners(event);

    return true;
  }

  /**
   * 강제 상태 설정 (테스트/복구용)
   */
  forceState(state: ChatState, metadata?: Record<string, any>): void {
    const from = this.currentState;
    this.currentState = state;
    this.history.push(state);

    // 이벤트 발생
    const event: StateTransitionEvent = {
      from,
      to: state,
      timestamp: new Date(),
      metadata: { ...metadata, forced: true },
    };

    this.notifyListeners(event);
  }

  /**
   * 히스토리 조회
   */
  getHistory(): StateHistory {
    return this.history;
  }

  /**
   * 리스너 등록
   */
  addListener(listener: StateTransitionListener): void {
    this.listeners.push(listener);
  }

  /**
   * 리스너 제거
   */
  removeListener(listener: StateTransitionListener): void {
    this.listeners = this.listeners.filter(l => l !== listener);
  }

  /**
   * 리스너 알림
   */
  private notifyListeners(event: StateTransitionEvent): void {
    this.listeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.error('State transition listener error:', error);
      }
    });
  }

  /**
   * 디버그 정보
   */
  debug(): string {
    return getStateMachineDebugInfo(this.currentState, this.history);
  }

  /**
   * 초기화
   */
  reset(): void {
    this.currentState = 'init';
    this.history.clear();
    this.history.push('init');

    const event: StateTransitionEvent = {
      from: this.currentState,
      to: 'init',
      timestamp: new Date(),
      metadata: { reset: true },
    };

    this.notifyListeners(event);
  }
}
