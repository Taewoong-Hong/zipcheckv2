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
    const { conversation_id, content, session } = body;

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

    async function saveMessage(convId: string) {
      try {
        const res = await fetch(`${AI_API_URL}/chat/message`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ conversation_id: convId, content }),
        });
        return res;
      } catch (e: any) {
        console.error('[api/chat] saveMessage network error:', e?.message || e);
        throw new Error('BACKEND_UNREACHABLE');
      }
    }

  let saveResponse: Response;
  if (!currentConversationId) {
      // 대화 ID가 없으면 초기화
      const initRes = await fetch(`${AI_API_URL}/chat/init`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session.access_token}` },
      });
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
      // 소유권/유효성 문제 → 신규 대화 생성 후 재시도
      const initRes = await fetch(`${AI_API_URL}/chat/init`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session.access_token}` },
      });
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
  console.log('메시지 저장 완료:', saveResult);

  // 2. 단계 게이트: 주소/계약유형 수집 전에는 LLM 호출하지 않고 안내만 반환
  try {
    // Helper detectors to reduce race between message save and backend extraction
    const looksLikeAddress = (t: string) => {
      const s = (t || '').trim();
      if (s.length < 5) return false;
      return /(시|도|구|동|읍|면)\s*[^\s]*\s*\d{1,4}/.test(s) ||
             /(로|길)\s*\d{1,4}/.test(s) ||
             /\d{1,4}-\d{1,4}/.test(s) ||
             /^\d{5}$/.test(s); // 5자리 우편번호 또는 지번
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
    if (!addr && looksLikeAddress(content)) {
      const upd = await supabase
        .from('conversations')
        .update({ property_address: content.trim() })
        .eq('id', currentConversationId);
      if (upd.error) console.warn('[api/chat] heuristic addr update failed:', upd.error);
      else addr = content.trim();
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
      return '안녕하세요! 부동산 AI 서비스 집체크입니다. 검토하실 부동산 주소를 입력해주세요.';
    }

    function replyContractPrompt(): string {
      return '다음은 계약 형태를 선택해주세요. (전세/월세/반전세/매매)';
    }

    function getFixedReply(): string | undefined {
      // 비교분석/일반질문 의도는 모달 없이 바로 LLM 답변
      if (isComparisonOrGeneralQuestion(content)) {
        return undefined; // LLM 분석 단계로 진행
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

    const guided: string | undefined = getFixedReply();

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
      // GPT-4o-mini with Function Calling (v2)
      analyzeResponse = await fetch(`${AI_API_URL}/chat/v2/message`, {
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
          }
        }),
      });
    } else {
      // 기존 rule-based + simple LLM (v1)
      analyzeResponse = await fetch(`${AI_API_URL}/analyze/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          question: content,
        }),
      });
    }
  } catch (e: any) {
    console.error('[api/chat] analyze network error:', e?.message || e);
    return NextResponse.json({ error: 'BACKEND_UNREACHABLE' }, { status: 502 });
  }

    if (!analyzeResponse.ok) {
      const text = await analyzeResponse.text();
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
        // Send meta event first (e.g., newConversationId)
        if (newConversationId) {
          const meta = JSON.stringify({ newConversationId, done: false, meta: true });
          controller.enqueue(encoder.encode(`data: ${meta}\n\n`));
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
