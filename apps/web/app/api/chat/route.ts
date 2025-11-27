import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

// Google Cloud Run AI 서비스 URL
const AI_API_URL = process.env.AI_API_URL;

if (!AI_API_URL) {
  throw new Error('AI_API_URL 환경변수가 설정되어 있지 않습니다');
}

// Supabase 클라이언트
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { conversation_id, content, session, recent_context } = body;

    // 인증 확인
    if (!session?.access_token) {
      return NextResponse.json(
        { error: '로그인이 필요합니다' },
        { status: 401 }
      );
    }

    // 1. 사용자 메시지 저장 (FastAPI /chat/message 호출) + 필요 시 대화 생성/재시도
    let currentConversationId = conversation_id as string | undefined;
    let newConversationId: string | undefined;

    // 재시도 래퍼 함수 (콜드 스타트 대응)
    async function fetchWithRetry(
      url: string,
      options: RequestInit,
      maxRetries: number = 3,
      timeout: number = 30000
    ): Promise<Response> {
      const delays = [2000, 4000, 6000]; // 재시도 간격 (2초, 4초, 6초)

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          // AbortController로 타임아웃 구현
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), timeout);

          const response = await fetch(url, {
            ...options,
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          // 성공 또는 재시도 불가 에러 (400번대)
          if (response.ok || (response.status >= 400 && response.status < 500)) {
            if (attempt > 1) {
              console.log(`[api/chat] 요청 성공 (재시도 후: ${attempt}/${maxRetries})`);
            }
            return response;
          }

          // 500번대 에러 → 재시도
          if (response.status >= 500 && attempt < maxRetries) {
            const delay = delays[attempt - 1] || 2000;
            if (attempt === 1) {
              console.warn(`[api/chat] 500 에러 감지 → 재시도 시작 (최대 ${maxRetries}회)`);
            }
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          }

          return response;
        } catch (e: any) {
          // 마지막 시도가 아니면 재시도
          if (attempt < maxRetries) {
            if (attempt === 1) {
              console.warn(`[api/chat] 네트워크 에러 감지 → 재시도 시작`);
            }
            const delay = delays[attempt - 1] || 2000;
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          }

          // 마지막 시도 실패
          console.error(`[api/chat] 최종 실패 (${maxRetries}회 시도 후): ${e?.message || e}`);
          throw new Error('BACKEND_UNREACHABLE');
        }
      }

      throw new Error('BACKEND_UNREACHABLE');
    }

    async function saveMessage(convId: string) {
      try {
        const res = await fetchWithRetry(
          `${AI_API_URL}/chat/message`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({ conversation_id: convId, content }),
          }
        );
        return res;
      } catch (e: any) {
        console.error('[api/chat] saveMessage 최종 실패:', e?.message || e);
        throw new Error('BACKEND_UNREACHABLE');
      }
    }

  let saveResponse: Response;
  if (!currentConversationId) {
      // 대화 ID가 없으면 초기화 (재시도 로직 적용)
      const initRes = await fetchWithRetry(
        `${AI_API_URL}/chat/init`,
        {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${session.access_token}` },
        }
      );
      if (!initRes.ok) throw new Error(`대화 초기화 실패: ${initRes.status}`);
      const initData = await initRes.json();
      currentConversationId = initData.conversation_id;
      newConversationId = currentConversationId;
    }

    // TypeScript 타입 체크: currentConversationId가 undefined가 아님을 보장
    if (!currentConversationId) {
      throw new Error('대화 ID를 생성할 수 없습니다');
    }

  saveResponse = await saveMessage(currentConversationId);
    if (saveResponse.status === 404) {
      // 소유권/유효성 문제 → 신규 대화 생성 후 재시도 (재시도 로직 적용)
      const initRes = await fetchWithRetry(
        `${AI_API_URL}/chat/init`,
        {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${session.access_token}` },
        }
      );
      if (!initRes.ok) throw new Error(`대화 재초기화 실패: ${initRes.status}`);
      const initData = await initRes.json();
      currentConversationId = initData.conversation_id;
      newConversationId = currentConversationId;
      if (!currentConversationId) {
        throw new Error('대화 재초기화 후에도 ID를 받지 못했습니다');
      }
      saveResponse = await saveMessage(currentConversationId);
    }

  if (!saveResponse.ok) {
    const text = await saveResponse.text();
    throw new Error(`메시지 저장 실패: ${saveResponse.status} ${text}`);
  }

  const saveResult = await saveResponse.json();
  const userMessageId = saveResult.message_id; // ✨ 백엔드에서 반환된 message_id
  console.log('메시지 저장 완료:', saveResult, 'message_id:', userMessageId);

  // 2. 단계 게이트: 주소/계약유형 수집 전에는 LLM 호출하지 않고 안내만 반환
  try {
    // Helper detectors to reduce race between message save and backend extraction
    const looksLikeAddress = (t: string) => {
      const s = (t || '').trim();
      if (s.length < 4) return false;

      // 패턴 1: 완전한 주소 (번지수 포함)
      const hasCompleteAddress =
        /(시|도|구|동|읍|면)\s*[^\s]*\s*\d{1,4}/.test(s) ||  // "강남구 테헤란로 123"
        /(로|길)\s*\d{1,4}/.test(s) ||                        // "테헤란로 123"
        /\d{1,4}-\d{1,4}/.test(s) ||                          // "123-45"
        /^\d{5}$/.test(s);                                    // "06234"

      // 패턴 2: 행정구역만 있는 주소 (번지수 없음) - "서울시 사당동", "강남구 역삼동" 등
      const hasAdminRegion =
        /[가-힣]+(시|도)\s+[가-힣]+(구|군)\s+[가-힣]+(동|읍|면|리|가)/u.test(s) ||  // "서울시 관악구 사당동"
        /[가-힣]+(시|도)\s+[가-힣]+(동|읍|면|리|가)/u.test(s) ||                    // "서울시 사당동"
        /[가-힣]+(구|군)\s+[가-힣]+(동|읍|면|리|가)/u.test(s) ||                    // "강남구 역삼동"
        /(서울|부산|대구|인천|광주|대전|울산|세종|경기|강원|충북|충남|전북|전남|경북|경남|제주).*(구|동|읍|면|리)/u.test(s);  // 광역시/도 포함

      // 패턴 3: 도로명만 있는 경우도 허용 - "테헤란로", "강남대로"
      const hasRoadName = /(로|길)$/u.test(s) && s.length >= 4;

      return hasCompleteAddress || hasAdminRegion || hasRoadName;
    };

    // 부동산 분석 요청 감지 (registry_choice 모달 트리거)
    const isRealEstateAnalysisRequest = (t: string) => {
      const s = t.toLowerCase();

      // 분석 요청 키워드 (핵심)
      const analysisKeywords = [
        '분석', '검토', '체크', '확인', '점검', '리스크', '위험',
        '살펴', '알아', '조사', '평가', '검사', '진단', '감정'
      ];

      // 부동산 관련 키워드
      const realEstateKeywords = [
        '아파트', '빌라', '오피스텔', '주택', '부동산', '집',
        '전세', '월세', '매매', '계약', '등기', '등기부'
      ];

      // 의도 표현 키워드
      const intentKeywords = [
        '하려고', '할려고', '하고싶', '하고 싶', '예정', '계획',
        '할건데', '할 건데', '하는데', '할까', '해줘', '해주',
        '보고싶', '보고 싶', '봐줘', '봐주'
      ];

      // 1. 명시적 분석 요청: "~를 분석해줘", "~를 검토해줘"
      const hasAnalysisKeyword = analysisKeywords.some(k => s.includes(k));
      const hasRealEstateKeyword = realEstateKeywords.some(k => s.includes(k));

      if (hasAnalysisKeyword && (hasRealEstateKeyword || looksLikeAddress(t))) {
        console.log('[분석 요청 감지] 분석 키워드 + 부동산/주소');
        return true;
      }

      // 2. 계약 의도: "전세 계약하려고", "매매하려는데"
      const hasIntentKeyword = intentKeywords.some(k => s.includes(k));
      const contractTypes = ['전세', '월세', '매매', '계약'];
      const hasContractType = contractTypes.some(c => s.includes(c));

      if (hasIntentKeyword && hasContractType) {
        console.log('[분석 요청 감지] 계약 의도 표현');
        return true;
      }

      // 3. 등기부 관련: "등기부 확인", "등기 떼고싶어"
      if (s.includes('등기') && (hasAnalysisKeyword || hasIntentKeyword || s.includes('확인') || s.includes('떼'))) {
        console.log('[분석 요청 감지] 등기부 관련 요청');
        return true;
      }

      // 4. 주소만 입력한 경우 (기존 로직과 호환)
      // 주소가 있고, 비교/일반 질문이 아닌 경우
      if (looksLikeAddress(t)) {
        // 비교분석/일반질문이 명백한 경우에만 제외
        if (isComparisonOrGeneralQuestion(t)) {
          console.log('[분석 요청 감지 실패] 비교분석/일반질문으로 판단');
          return false;
        }
        console.log('[분석 요청 감지] 주소 입력 (비교/일반 아님)');
        return true;
      }

      return false;
    };

    // 비교분석 또는 일반 질문 의도 감지
    const isComparisonOrGeneralQuestion = (t: string) => {
      const s = t.toLowerCase();

      // 비교 키워드
      if (/(비교|vs|대|versus|차이|어디가|어느|둘 중|어떤 게|중에|어디|골라)/.test(s)) return true;

      // 복수 주소 감지 (2개 이상의 부동산)
      const addressMarkers = (s.match(/(시|구|동|로|길|아파트|빌라|오피스텔)/g) || []).length;
      if (addressMarkers >= 6) return true; // "강남구 역삼동 XX아파트" = 3, 2개 = 6

      // "~와 ~" 패턴
      if (/(와|과|랑|하고)\s*[^\s]*\s*(비교|어때|괜찮|추천)/.test(s)) return true;

      // 간단한 인사말/감사 표현 (주소 없어도 LLM 응답)
      if (/^(안녕|안녕하세요|하이|hello|hi|고마워|감사|thanks|thx)$/i.test(s.trim())) return true;

      // 일반 질문 패턴 (주소 특정 없이 일반 정보 요청)
      const generalQuestions = [
        /(어때|어떤지|괜찮|좋|나쁨|추천|방법|팁|조언)/,
        /(뭐|무엇|왜|어떻게|어디서|언제|얼마)/,
        /(설명|알려|가르쳐|궁금|질문|물어)/,
        /(시세|가격|동향|전망|트렌드)/,
        /(전세가율|월세|매매|부동산).*\?/
      ];

      const hasGeneralQuestionPattern = generalQuestions.some(re => re.test(s));
      const hasSpecificAddress = looksLikeAddress(t);

      // 일반 질문 패턴은 있지만 구체적인 주소는 없는 경우
      if (hasGeneralQuestionPattern && !hasSpecificAddress) return true;

      return false;
    };
    const detectContract = (t: string): string | undefined => {
      const s = (t || '').trim();
      const types = ['전세','월세','반전세','전월세','매매'];
      return types.find(x => s.includes(x));
    };

    // First fetch conversation
    const fetchConv = async () => {
      const r = await supabase
        .from('conversations')
        .select('property_address, contract_type')
        .eq('id', currentConversationId)
        .single();
      if (r.error) console.warn('[api/chat] conversation fetch failed:', r.error);
      return r.data || {} as any;
    };

    let convRow: any = await fetchConv();
    let addr: string | undefined = convRow?.property_address?.trim();
    let ctype: string | undefined = convRow?.contract_type?.trim();

    // If backend hasn't updated yet, try heuristics and update directly to avoid extra user turn
    // BUT: 행정구역만 있는 경우는 확인 질문을 먼저 해야 하므로 즉시 업데이트하지 않음
    if (!addr && looksLikeAddress(content)) {
      // 구체적인 주소인지 체크 (번지수/아파트명 포함)
      const hasSpecificDetails = /\d{1,4}(-\d{1,4})?/.test(content) || // 번지수
                                /(아파트|빌라|오피스텔|주택|단지|타워|캐슬|파크|자이|푸르지오|래미안|힐스테이트|e편한세상|더샵)/i.test(content); // 아파트명

      // 구체적인 주소만 즉시 업데이트
      if (hasSpecificDetails) {
        const upd = await supabase
          .from('conversations')
          .update({ property_address: content.trim() })
          .eq('id', currentConversationId);
        if (upd.error) console.warn('[api/chat] heuristic addr update failed:', upd.error);
        else addr = content.trim();
      }
      // 행정구역만 있는 경우는 확인 질문 후 업데이트 (긍정 응답 시)
    }
    if (!ctype) {
      const d = detectContract(content);
      if (d) {
        const upd = await supabase
          .from('conversations')
          .update({ contract_type: d })
          .eq('id', currentConversationId);
        if (upd.error) console.warn('[api/chat] heuristic contract update failed:', upd.error);
        else ctype = d;
      }
    }

    // If still missing (race), poll briefly for backend extraction (3 tries ~540ms)
    if (!addr || !ctype) {
      for (let i = 0; i < 3 && (!addr || !ctype); i++) {
        await new Promise(res => setTimeout(res, 180));
        convRow = await fetchConv();
        addr = addr || convRow?.property_address?.trim();
        ctype = ctype || convRow?.contract_type?.trim();
      }
    }

    // Fixed-response intent rules (no LLM)
    const text = String(content || '').trim();
    const norm = text.toLowerCase().replace(/\s+/g, '');

    function replyAddressPrompt(): string {
      return '안녕하세요! 부동산 AI 서비스 집체크입니다.\n\n검토하실 부동산의 **상세한 주소**를 입력해주세요.\n\n✅ 좋은 예시:\n- "경기도 파주시 야당동 62-24"\n- "서울 강남구 역삼동 테헤란로 123"\n- "부산 해운대구 우동 센텀파크"\n\n❌ 부족한 예시:\n- "파주시 야당" (동/번지 누락)\n- "강남구" (구체적 위치 없음)';
    }

    function replyContractPrompt(): string {
      return '다음은 계약 형태를 선택해주세요. (전세/월세/반전세/매매)';
    }

    function getFixedReply(): string | undefined {
      // 비교분석/일반질문 의도는 모달 없이 바로 LLM 답변
      if (isComparisonOrGeneralQuestion(content)) {
        return undefined; // LLM 분석 단계로 진행 (로그 없음)
      }

      if (!addr) {
        const rules: Array<[RegExp, string]> = [
          [/^(안녕|안녕하세요|하이|hello|hi)$/i, '안녕하세요! 집체크입니다. 검토하실 부동산 주소를 입력해주세요.'],
          [/^(너(는)?(뭐|뭔)야\?|누구야|정체가뭐야|뭐하는서비스|whatareyou\??)$/i, '저는 집체크 AI 서비스입니다. 검토하실 부동산 주소를 입력해주세요.'],
          [/(고마워|감사|thanks|thx)/i, '도움이 되었다니 다행이에요! 검토하실 부동산 주소가 있다면 입력해주세요.'],
          [/(사용법|어떻게|도와줘|help|시작|뭐부터)/i, replyAddressPrompt()],
          [/(뭐할수|무엇을할수|가능한기능|기능|할수있는)/i, '주소를 알려주시면 등기 리스크 점검과 안내를 도와드려요. 먼저 주소를 입력해주세요.'],
          [/(가격|비용|요금)/i, '우선 주소를 알려주시면 필요한 절차와 안내를 도와드릴게요. 상세 이용 안내는 주소 입력 후 제공합니다.'],
          [/^[!?\.]{1,}$/i, replyAddressPrompt()],
          [/^(ㅇ?ㅋ+|ㅎㅎ+|ㅋㅋ+|zz+)$|^.$/i, replyAddressPrompt()],
        ];
        for (const [re, ans] of rules) if (re.test(text) || re.test(norm)) return typeof ans === 'function' ? (ans as any)() : ans;
        return replyAddressPrompt();
      }
      if (!ctype) {
        const typeRules: Array<[RegExp, string]> = [
          [/^(전세|월세|반전세|매매)$/i, '계약 유형을 인지했습니다. 화면의 계약 형태 선택을 완료해주세요.'],
          [/(유형|타입|계약.*선택|contracttype)/i, replyContractPrompt()],
        ];
        for (const [re, ans] of typeRules) if (re.test(text) || re.test(norm)) return typeof ans === 'function' ? (ans as any)() : ans;
        return replyContractPrompt();
      }
      return undefined;
    }

    // 긍정 응답 감지 (하이브리드: 규칙 기반 + 패턴 매칭)
    const isPositiveResponse = (t: string) => {
      const s = t.toLowerCase().trim();

      // 1차: 명시적 긍정 응답 (빠른 감지)
      const explicitPositive = [
        'ㅇ', 'ㅇㅇ', 'ㅇㅋ', 'ㅇㅇㅋ', // 한글 초성
        '네', '예', '응', '어', '그래', '좋아', '좋', '오케이', 'ok', 'okay', 'yes', 'y',
        '맞아', '맞음', '맞', '맞네', '맞습니다',
        '해줘', '해주', '해', '부탁', '해봐', '알아봐', '찾아줘', '찾아', '조회',
        '검색', '찾아봐', '알려줘', '알려', '보여줘', '보여',
        '고고', 'ㄱㄱ', 'ㄱㄱㄱ', 'go', '시작'
      ];

      if (explicitPositive.includes(s)) return true;

      // 2차: 접두사/접미사 패턴 (유연한 매칭)
      const positivePatterns = [
        /^(네|예|응|어|그래|좋|ㅇ+|ok|yes)/, // "네요", "응응", "좋아요"
        /(해줘|해주세요|부탁|알려줘|찾아줘|검색|조회)$/, // "해줘요", "부탁해"
        /^(맞|그래|좋).*/, // "맞아요", "그래요", "좋습니다"
      ];

      return positivePatterns.some(pattern => pattern.test(s));
    };

    const guided: string | undefined = getFixedReply();

    // 부동산 분석 요청이 감지되거나 긍정 응답이면 분석 플로우 시작
    if ((isRealEstateAnalysisRequest(content) || isPositiveResponse(content)) && (!addr || !ctype)) {
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller) {
          // 메시지와 함께 적절한 모달 트리거
          if (!addr) {
            // 주소 구체성 체크: 번지수/아파트명이 있는지 확인
            const hasSpecificDetails = /\d{1,4}(-\d{1,4})?/.test(content) || // 번지수
                                      /(아파트|빌라|오피스텔|주택|단지|타워|캐슬|파크|자이|푸르지오|래미안|힐스테이트|e편한세상|더샵)/i.test(content); // 아파트명

            // 1. 긍정 응답이면 즉시 모달 오픈
            if (isPositiveResponse(content)) {
              const msg = '상세 주소를 검색해드리겠습니다. 아파트명이나 번지수를 입력해주세요.';
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: msg, done: false })}\n\n`));

              // ✅ 주소 모달 트리거
              const metaAddr = JSON.stringify({
                meta: true,
                component: 'address_search',
                initialQuery: '',
                options: []
              });
              controller.enqueue(encoder.encode(`data: ${metaAddr}\n\n`));

              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`));
            }
            // 2. 행정구역만 있고 구체적 주소 없음 → 더 구체적인 주소 요청
            else if (looksLikeAddress(content) && !hasSpecificDetails) {
              const msg = `${content.trim()} 지역이시군요! 더 정확한 분석을 위해 **상세한 주소**를 입력해주세요.\n\n예시:\n- "파주시 야당동 62-24"\n- "파주시 야당동 이편한세상"\n- "경기도 파주시 야당동 123번지"`;
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: msg, done: false })}\n\n`));

              // ✅ 확인 후 모달 트리거 (사용자가 "네" 또는 주소 입력 시 재진입)
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`));
            }
            // 3. 구체적 주소 또는 일반 분석 요청 → 바로 모달 오픈
            else {
              const msg = '부동산 분석을 시작하겠습니다. 먼저 검토하실 부동산 주소를 입력해주세요.';
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: msg, done: false })}\n\n`));

              // ✅ 주소 모달 트리거
              const metaAddr = JSON.stringify({
                meta: true,
                component: 'address_search',
                initialQuery: looksLikeAddress(content) && hasSpecificDetails ? content.trim() : '',
                options: []
              });
              controller.enqueue(encoder.encode(`data: ${metaAddr}\n\n`));

              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`));
            }
          } else if (!ctype) {
            // 주소는 있지만 계약 타입이 없으면
            const msg = '주소가 확인되었습니다. 계약 형태를 선택해주세요.';
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: msg, done: false })}\n\n`));

            const meta = JSON.stringify({
              meta: true,
              component: 'contract_selector',
              options: ['전세','월세','반전세','매매']
            });
            controller.enqueue(encoder.encode(`data: ${meta}\n\n`));

            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`));
          }

          controller.close();
        },
      });

      const headers: Record<string, string> = {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      };
      if (newConversationId) headers['X-New-Conversation-Id'] = newConversationId;
      return new NextResponse(stream, { headers });
    }

    // If address + contract_type are both present, prompt registry choice in-chat
    if (addr && ctype) {
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller) {
          const prompt = '등기부등본을 업로드 해주시겠습니까? 또는 등기부등본을 조회할까요? (크레딧 1회 차감)';
          const data = JSON.stringify({ content: prompt, done: false });
          controller.enqueue(encoder.encode(`data: ${data}\n\n`));
          const meta = JSON.stringify({ meta: true, component: 'registry_choice' });
          controller.enqueue(encoder.encode(`data: ${meta}\n\n`));
          const done = JSON.stringify({ done: true });
          controller.enqueue(encoder.encode(`data: ${done}\n\n`));
          controller.close();
        },
      });
      const headers: Record<string, string> = {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      };
      if (newConversationId) headers['X-New-Conversation-Id'] = newConversationId;
      return new NextResponse(stream, { headers });
    }

    if (guided) {
      // 스트리밍으로 간단 안내만 전달하고 종료 (DB에는 이미 백엔드에서 가이드 메시지를 기록함)
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller) {
          const data = JSON.stringify({ content: guided, done: false });
          controller.enqueue(encoder.encode(`data: ${data}\n\n`));
          // server-side gating: only open address modal when input looks like an address
          if (!addr && !looksLikeAddress(content)) {
            const doneData = JSON.stringify({ done: true });
            controller.enqueue(encoder.encode(`data: ${doneData}\n\n`));
            controller.close();
            return;
          }
          // (선택) 주소 선택 지원 메타 이벤트
          if (!addr) {
            const metaAddr = JSON.stringify({
              meta: true,
              component: 'address_search',
              initialQuery: content.trim(),
              options: []
            });
            controller.enqueue(encoder.encode(`data: ${metaAddr}\n\n`));
          }
          // 계약 유형 셀렉트 힌트
          if (addr && !ctype) {
            const meta = JSON.stringify({ meta: true, component: 'contract_selector', options: ['전세','월세','반전세','매매'] });
            controller.enqueue(encoder.encode(`data: ${meta}\n\n`));
          }
          const doneData = JSON.stringify({ done: true });
          controller.enqueue(encoder.encode(`data: ${doneData}\n\n`));
          controller.close();
        },
      });
      const headers: Record<string, string> = {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      };
      if (newConversationId) headers['X-New-Conversation-Id'] = newConversationId;
      return new NextResponse(stream, { headers });
    }
  } catch (e) {
    console.warn('[api/chat] gating check failed (proceeding to analyze):', e);
  }

  // 3. LLM 분석 - GPT-4o-mini 또는 기존 시스템 선택
  let analyzeResponse: Response;
  const useGPTv2 = process.env.USE_GPT_V2 === 'true' || body.useGPTv2;

  try {
    if (useGPTv2) {
      // GPT-4o-mini with Function Calling (v2) - 재시도 로직 적용
      analyzeResponse = await fetchWithRetry(
        `${AI_API_URL}/chat/v2/message`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            conversation_id: currentConversationId,
            content,
            context: {
              property_address: body.property_address,
              contract_type: body.contract_type,
              case_id: body.case_id
            },
            // ✅ 최근 대화 히스토리 포함 (Claude-like integrated answer)
            recent_context: recent_context
          }),
        }
      );
    } else {
      // 기존 rule-based + simple LLM (v1) - 재시도 로직 적용
      analyzeResponse = await fetchWithRetry(
        `${AI_API_URL}/analyze/`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            question: content,
            // ✅ 최근 대화 히스토리 포함 (Claude-like integrated answer)
            recent_context: recent_context
          }),
        }
      );
    }
  } catch (e: any) {
    console.error('[api/chat] analyze network error:', e?.message || e);
    return NextResponse.json({ error: 'BACKEND_UNREACHABLE' }, { status: 502 });
  }

    // ✅ 404는 정상 흐름으로 처리 (아직 분석 대상이 없음)
    if (!analyzeResponse.ok) {
      const text = await analyzeResponse.text();

      // 404 에러는 "아직 케이스/분석 대상이 없음"이므로 조기 종료
      if (analyzeResponse.status === 404) {
        console.warn('[api/chat] 404 - 분석 대상 없음 (정상 흐름):', text);

        // 기본 안내 메시지 반환
        const defaultAnswer = '죄송합니다. 분석 대상을 찾을 수 없습니다. 주소와 계약 유형을 먼저 입력해주세요.';

        // 스트리밍 응답으로 기본 메시지 전달
        const encoder = new TextEncoder();
        const stream = new ReadableStream({
          start(controller) {
            const data = JSON.stringify({ content: defaultAnswer, done: false });
            controller.enqueue(encoder.encode(`data: ${data}\n\n`));
            const doneData = JSON.stringify({ done: true });
            controller.enqueue(encoder.encode(`data: ${doneData}\n\n`));
            controller.close();
          },
        });

        const headers: Record<string, string> = {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        };
        if (newConversationId) headers['X-New-Conversation-Id'] = newConversationId;

        return new NextResponse(stream, { headers });
      }

      // 404 외 에러는 예외 발생
      throw new Error(`분석 실패: ${analyzeResponse.status} ${text}`);
    }

  const analyzeData = await analyzeResponse.json();

  // v2 response has 'reply' field, v1 has 'answer' field
  const answer = analyzeData.reply || analyzeData.answer || '응답을 생성할 수 없습니다.';
  const toolCalls = analyzeData.tool_calls || analyzeData.toolCalls || []; // Handle both naming conventions

  // Log tool calls for debugging
  if (toolCalls.length > 0) {
    console.log('[chat/route] Tool calls received from backend:', JSON.stringify(toolCalls, null, 2));
  }

  // 4. AI 응답 메시지 저장
  const { error: insertErr } = await supabase.from('messages').insert({
    conversation_id: currentConversationId,
    role: 'assistant',
    content: answer,
    meta: {
      topic: 'contract_analysis',
      extension: 'chat',
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined
    },
  });
  if (insertErr) {
    console.warn('[api/chat] assistant message insert failed:', insertErr);
  }

  // 5. 스트리밍 응답 반환
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        // Send meta event first (e.g., newConversationId, userMessageId)
        const metaEvent: any = { done: false, meta: true };
        if (newConversationId) metaEvent.newConversationId = newConversationId;
        if (userMessageId) metaEvent.user_message_id = userMessageId; // ✨ 사용자 메시지 ID 포함
        if (newConversationId || userMessageId) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(metaEvent)}\n\n`));
        }

        // Send tool calls if any (for v2)
        if (toolCalls.length > 0) {
          toolCalls.forEach((toolCall: any) => {
            const toolData = JSON.stringify({
              meta: true,
              toolCall: toolCall,
              done: false
            });
            controller.enqueue(encoder.encode(`data: ${toolData}\n\n`));
          });
        }

        const chunks = answer.split(' ');
        chunks.forEach((chunk: string, index: number) => {
          setTimeout(() => {
            const content = index === 0 ? chunk : ' ' + chunk;
            const data = JSON.stringify({ content, done: false });
            controller.enqueue(encoder.encode(`data: ${data}\n\n`));

            if (index === chunks.length - 1) {
              setTimeout(() => {
                const doneData = JSON.stringify({ done: true });
                controller.enqueue(encoder.encode(`data: ${doneData}\n\n`));
                controller.close();
              }, 50);
            }
          }, index * 50);
        });
      },
    });

    const headers: Record<string, string> = {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    };
    if (newConversationId) {
      headers['X-New-Conversation-Id'] = newConversationId;
    }

    return new NextResponse(stream, {
      headers: {
        ...headers,
      },
    });
  } catch (error) {
    console.error('Chat API error:', error);
    const message = error instanceof Error ? error.message : String(error);
    const status = message.includes('BACKEND_UNREACHABLE') ? 502 : 500;
    return NextResponse.json(
      {
        error: 'CHAT_SERVER_ERROR',
        details: message,
      },
      { status }
    );
  }
}

// Health check endpoint
export async function GET(request: NextRequest) {
  try {
    // Backend health check
    const response = await fetch(`${AI_API_URL}/health`, {
      method: 'GET',
    });

    if (response.ok) {
      return NextResponse.json({
        status: 'healthy',
        backend: 'connected',
        timestamp: new Date().toISOString()
      });
    } else {
      return NextResponse.json({
        status: 'unhealthy',
        backend: 'disconnected',
        timestamp: new Date().toISOString()
      }, { status: 503 });
    }
  } catch (error) {
    return NextResponse.json({
      status: 'error',
      backend: 'unreachable',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 503 });
  }
}
