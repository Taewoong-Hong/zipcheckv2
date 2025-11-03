/**
 * 분석 플로우 핸들러
 *
 * @description
 * 채팅 기반 부동산 계약 분석 플로우를 관리하는 유틸리티
 * 사용자 입력을 감지하고 상태머신 전이를 처리
 *
 * @author 집체크 개발팀
 * @version 1.0.0
 * @date 2025-01-27
 */

import type { ChatState, ContractType, AddressInfo } from '@/types/analysis';
import { getStatePrompt } from './stateMachine';
import { getBrowserSupabase } from '@/lib/supabaseBrowser';

/**
 * 분석 플로우 컨텍스트
 */
export interface AnalysisContext {
  caseId?: string;
  address?: AddressInfo;
  contractType?: ContractType;
  deposit?: number;           // 보증금 (만원) 또는 매매가 (매매 계약)
  monthlyRent?: number;       // 월세 (만원, 월세/전월세만)
  registryMethod?: 'issue' | 'upload';
  registryFile?: File;
  userCredits?: number;
}

/**
 * 사용자 입력이 주소 입력인지 감지
 */
export function isAddressInput(input: string): boolean {
  const addressKeywords = ['주소', '위치', '아파트', '빌라', '오피스텔', '동', '구', '시', '도'];
  const hasKeyword = addressKeywords.some(keyword => input.includes(keyword));

  // 또는 도로명/지번 패턴 감지 (예: "서울시", "강남구", "123번지")
  const addressPattern = /(시|구|동|로|길|번지)/;
  const hasPattern = addressPattern.test(input);

  return hasKeyword || hasPattern;
}

/**
 * 분석 시작 트리거 감지
 */
export function isAnalysisStartTrigger(input: string): boolean {
  const triggers = [
    '분석',
    '검토',
    '체크',
    '확인',
    '계약',
    '전세',
    '월세',
    '매매',
    '부동산',
    '등기부',
  ];

  return triggers.some(trigger => input.includes(trigger));
}

/**
 * 상태별 AI 응답 메시지 생성
 */
export function getStateResponseMessage(state: ChatState, context?: AnalysisContext): string {
  switch (state) {
    case 'init':
      return '안녕하세요! 집체크 AI입니다. 🏠\n\n부동산 계약 분석을 도와드리겠습니다.\n계약하실 부동산의 **주소**를 알려주세요.\n\n예시: 서울특별시 강남구 테헤란로 123';

    case 'address_pick':
      return '주소를 검색하고 있습니다...\n정확한 주소를 선택해주세요.';

    case 'contract_type':
      return `주소가 확인되었습니다! 📍\n**${context?.address?.road || '주소'}**\n\n이제 계약 유형을 선택해주세요.`;

    case 'price_input':
      const contractType = context?.contractType;
      if (contractType === '매매') {
        return `계약 유형: **${contractType}** ✅\n\n매매가를 입력해주세요.`;
      } else if (contractType === '전세') {
        return `계약 유형: **${contractType}** ✅\n\n보증금을 입력해주세요.`;
      } else {
        return `계약 유형: **${contractType}** ✅\n\n보증금과 월세를 입력해주세요.`;
      }

    case 'registry_choice':
      return `가격 정보가 입력되었습니다! 💰\n\n등기부등본을 준비해야 합니다.\n발급하시거나 기존 PDF를 업로드해주세요.`;

    case 'registry_ready':
      return '등기부등본을 확인하고 있습니다...';

    case 'parse_enrich':
      return '데이터를 분석하고 있습니다...\n잠시만 기다려주세요. ⏳';

    case 'report':
      return '분석이 완료되었습니다! 📊';

    case 'error':
      return '오류가 발생했습니다.\n처음부터 다시 시작해주세요.';

    default:
      return '';
  }
}

/**
 * 케이스 생성 API 호출
 */
export async function createCase(address: AddressInfo): Promise<string> {
  try {
    const supabase = getBrowserSupabase();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error('NO_SESSION');
    const response = await fetch('/api/case', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        address_road: address.road,
        address_lot: address.lot,
        address_detail: address,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to create case: ${response.status}`);
    }

    const data = await response.json();
    return data.caseId;
  } catch (error) {
    console.error('Create case error:', error);
    throw error;
  }
}

/**
 * 케이스 업데이트 API 호출
 */
export async function updateCase(
  caseId: string,
  updates: Partial<AnalysisContext>
): Promise<void> {
  try {
    const supabase = getBrowserSupabase();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error('NO_SESSION');
    const response = await fetch(`/api/case/${caseId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(updates),
    });

    if (!response.ok) {
      throw new Error(`Failed to update case: ${response.status}`);
    }
  } catch (error) {
    console.error('Update case error:', error);
    throw error;
  }
}

/**
 * 등기부 업로드 API 호출
 */
export async function uploadRegistry(caseId: string, file: File): Promise<void> {
  try {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('caseId', caseId);
    const supabase = getBrowserSupabase();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error('NO_SESSION');

    const response = await fetch('/api/registry/upload', {
      method: 'POST',
      body: formData,
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to upload registry: ${response.status}`);
    }
  } catch (error) {
    console.error('Upload registry error:', error);
    throw error;
  }
}


/**
 * 분석 실행 API 호출
 */
export async function runAnalysis(caseId: string): Promise<void> {
  try {
    const supabase = getBrowserSupabase();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error('NO_SESSION');
    const response = await fetch(`/api/analysis/${caseId}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to run analysis: ${response.status}`);
    }
  } catch (error) {
    console.error('Run analysis error:', error);
    throw error;
  }
}

/**
 * 리포트 데이터 조회 API 호출
 */
export async function getReport(caseId: string): Promise<{
  content: string;
  contractType: string;
  address: string;
}> {
  try {
    const supabase = getBrowserSupabase();
    const { data: { session } } = await supabase.auth.getSession();
    const headers: Record<string,string> = {};
    if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`;
    const response = await fetch(`/api/report/${caseId}`, { headers });

    if (!response.ok) {
      throw new Error(`Failed to get report: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Get report error:', error);
    throw error;
  }
}

/**
 * 사용자 크레딧 조회
 */
export async function getUserCredits(): Promise<number> {
  try {
    const response = await fetch('/api/credits/balance');

    if (!response.ok) {
      throw new Error(`Failed to get credits: ${response.status}`);
    }

    const data = await response.json();
    return data.balance;
  } catch (error) {
    console.error('Get credits error:', error);
    return 0;
  }
}
