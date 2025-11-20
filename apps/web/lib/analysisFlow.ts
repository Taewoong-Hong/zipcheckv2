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
 *
 * 전략: 매우 보수적으로 감지 - 명확한 주소 형태만 감지
 * - "강남 부동산 알아보는 중" → ❌ 감지 안함 (단순 키워드)
 * - "서울시 강남구 테헤란로 123" → ✅ 감지 (명확한 주소)
 */
export function isAddressInput(input: string): boolean {
  const s = (input || '').trim();
  if (s.length < 3) return false;

  // 1. 명확한 주소 패턴 (도로명/지번)
  const roadPattern = /(로|길)\s*\d{1,4}/;  // "테헤란로 123"
  const lotPattern = /\d{1,4}번지/;          // "123번지"

  if (roadPattern.test(s) || lotPattern.test(s)) {
    return true;
  }

  // 2. 행정구역 + 숫자 조합 (최소한의 주소 형태)
  const adminPattern = /(특별시|광역시|시|도|군|구|읍|면|동|리)/;
  const hasAdmin = adminPattern.test(s);
  const hasNumber = /\d/.test(s);

  if (hasAdmin && hasNumber && s.length >= 8) {
    // "서울시 강남구 123" 같은 형태만 허용
    return true;
  }

  // 3. 건물명 + 행정구역 조합 (아파트/빌라는 반드시 행정구역과 함께)
  const buildingKeywords = ['아파트', '빌라', '오피스텔'];
  const hasBuildingKeyword = buildingKeywords.some(k => s.includes(k));

  if (hasBuildingKeyword && hasAdmin) {
    // "강남구 래미안아파트" 같은 형태만 허용
    // "강남 부동산"은 행정구역이 없으므로 제외됨
    return true;
  }

  // 4. 그 외는 모두 false (보수적 접근)
  return false;
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
export async function createCase(address: AddressInfo, accessToken?: string): Promise<string> {
  try {
    let token = accessToken;
    if (!token) {
      const supabase = getBrowserSupabase();
      const { data: { session } } = await supabase.auth.getSession();
      token = session?.access_token;
    }
    if (!token) throw new Error('NO_SESSION');
    const response = await fetch('/api/case', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
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
  updates: Partial<AnalysisContext>,
  accessToken?: string,
): Promise<void> {
  try {
    let token = accessToken;
    if (!token) {
      const supabase = getBrowserSupabase();
      const { data: { session } } = await supabase.auth.getSession();
      token = session?.access_token;
    }
    if (!token) throw new Error('NO_SESSION');
    const response = await fetch(`/api/case/${caseId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
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
 * 케이스 상태 업데이트 (상태 머신 전환 시 DB 동기화용)
 */
export async function updateCaseState(
  caseId: string,
  state: ChatState,
  accessToken?: string,
): Promise<void> {
  try {
    let token = accessToken;
    if (!token) {
      const supabase = getBrowserSupabase();
      const { data: { session } } = await supabase.auth.getSession();
      token = session?.access_token;
    }
    if (!token) throw new Error('NO_SESSION');

    const response = await fetch(`/api/case/${caseId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ current_state: state }),
    });

    if (!response.ok) {
      throw new Error(`Failed to update case state: ${response.status}`);
    }

    console.log(`✅ Case state updated in DB: ${caseId} → ${state}`);
  } catch (error) {
    console.error('Update case state error:', error);
    throw error;
  }
}

/**
 * 등기부 업로드 API 호출
 */
export async function uploadRegistry(caseId: string, file: File, accessToken?: string): Promise<void> {
  try {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('caseId', caseId);
    let token = accessToken;
    if (!token) {
      const supabase = getBrowserSupabase();
      const { data: { session } } = await supabase.auth.getSession();
      token = session?.access_token;
    }
    if (!token) throw new Error('NO_SESSION');

    const response = await fetch('/api/registry/upload', {
      method: 'POST',
      body: formData,
      headers: {
        'Authorization': `Bearer ${token}`,
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
 * 분석 스트리밍 이벤트
 */
export interface AnalysisStreamEvent {
  step?: number;           // 1~8
  message?: string;        // 진행 메시지 (한국어)
  progress?: number;       // 0.0 ~ 1.0
  report_id?: string;      // 완료 시 리포트 ID
  done?: boolean;          // 완료 여부
  error?: string;          // 에러 메시지
  partial_content?: string; // LLM 스트리밍 중 부분 컨텐츠 (step 6에서 사용)

  // 세부 데이터 (optional)
  address?: string;
  owner?: string;
  mortgages?: string;
  seizures?: string;
  lawd_cd?: string;
  avg_trade_price?: string;
  property_value?: string;
  risk_score?: string;
  risk_level?: string;
  jeonse_ratio?: string;
  mortgage_ratio?: string;
}

/**
 * 분석 실행 API 호출 (레거시, 폴링 방식)
 */
export async function runAnalysis(caseId: string, accessToken?: string): Promise<void> {
  try {
    let token = accessToken;
    if (!token) {
      const supabase = getBrowserSupabase();
      const { data: { session } } = await supabase.auth.getSession();
      token = session?.access_token;
    }
    if (!token) throw new Error('NO_SESSION');
    const response = await fetch(`/api/analysis/${caseId}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
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
 * 분석 실시간 스트리밍 (Server-Sent Events)
 *
 * @param caseId 케이스 ID
 * @param onEvent 이벤트 핸들러 (진행 상황 수신)
 * @param accessToken 인증 토큰 (optional)
 */
export async function streamAnalysis(
  caseId: string,
  onEvent: (event: AnalysisStreamEvent) => void,
  accessToken?: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      let token = accessToken;

      // 토큰 가져오기
      const getToken = async () => {
        if (!token) {
          const supabase = getBrowserSupabase();
          const { data: { session } } = await supabase.auth.getSession();
          token = session?.access_token;
        }
        if (!token) throw new Error('NO_SESSION');
        return token;
      };

      getToken().then((token) => {
        // SSE 연결 URL
        const url = `/api/analysis/stream?caseId=${caseId}&token=${encodeURIComponent(token)}`;
        const eventSource = new EventSource(url);

        // 이벤트 리스너 등록
        eventSource.onmessage = (event) => {
          try {
            const data: AnalysisStreamEvent = JSON.parse(event.data);

            // 에러 처리
            if (data.error) {
              console.error('❌ 스트리밍 에러:', data.error);
              onEvent(data);
              eventSource.close();
              reject(new Error(data.error));
              return;
            }

            // 정상 이벤트 전달
            onEvent(data);

            // 완료 시 연결 종료 및 Promise resolve
            if (data.done) {
              console.log('✅ 스트리밍 완료 - Promise resolve');
              eventSource.close();
              resolve(); // ⬅️ 완료 시 Promise를 resolve!
            }
          } catch (parseError) {
            console.error('이벤트 파싱 오류:', parseError);
            eventSource.close();
            reject(parseError);
          }
        };

        eventSource.onerror = (error) => {
          console.error('❌ SSE 연결 오류:', error);
          onEvent({ error: 'SSE 연결이 끊어졌습니다.' });
          eventSource.close();
          reject(new Error('SSE 연결 오류'));
        };

        // 연결 종료 핸들러 (브라우저가 페이지를 떠날 때)
        window.addEventListener('beforeunload', () => {
          eventSource.close();
        });
      }).catch(reject);

    } catch (error) {
      console.error('스트리밍 분석 오류:', error);
      reject(error);
    }
  });
}

/**
 * 리포트 데이터 조회 API 호출
 */
export async function getReport(caseId: string, accessToken?: string): Promise<{
  content: string;
  contractType: string;
  address: string;
}> {
  try {
    let token = accessToken;
    if (!token) {
      const supabase = getBrowserSupabase();
      const { data: { session } } = await supabase.auth.getSession();
      token = session?.access_token;
    }
    const headers: Record<string,string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
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
export async function getUserCredits(accessToken?: string): Promise<number> {
  try {
    let token = accessToken;
    if (!token) {
      const supabase = getBrowserSupabase();
      const { data: { session } } = await supabase.auth.getSession();
      token = session?.access_token;
    }
    const headers: HeadersInit = token ? { 'Authorization': `Bearer ${token}` } : {};
    const response = await fetch('/api/credits/balance', { headers });

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
