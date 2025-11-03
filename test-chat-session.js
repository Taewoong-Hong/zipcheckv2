/**
 * ZipCheck 채팅 기능 세션 테스트
 *
 * 이 스크립트는 브라우저 콘솔에서 실행하여
 * 세션 처리가 올바르게 작동하는지 확인합니다.
 */

console.log('=== ZipCheck 채팅 세션 테스트 시작 ===');

// 1. Supabase 세션 확인
async function checkSupabaseSession() {
  console.log('\n1️⃣ Supabase 세션 확인...');

  try {
    // window.supabase가 있는지 확인
    if (typeof window.supabase === 'undefined') {
      console.error('❌ window.supabase를 찾을 수 없습니다.');
      return null;
    }

    const { data: { session }, error } = await window.supabase.auth.getSession();

    if (error) {
      console.error('❌ 세션 가져오기 실패:', error.message);
      return null;
    }

    if (!session) {
      console.warn('⚠️ 로그인되지 않았습니다.');
      return null;
    }

    console.log('✅ 세션 확인 완료');
    console.log('   - User ID:', session.user.id);
    console.log('   - Email:', session.user.email);
    console.log('   - Access Token:', session.access_token?.substring(0, 20) + '...');

    return session;
  } catch (error) {
    console.error('❌ 예외 발생:', error);
    return null;
  }
}

// 2. Chat Init 테스트
async function testChatInit(session) {
  console.log('\n2️⃣ Chat Init 테스트...');

  if (!session) {
    console.error('❌ 세션이 없어서 테스트할 수 없습니다.');
    return null;
  }

  try {
    const response = await fetch('/api/chat/init', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      },
      body: JSON.stringify({
        session: {
          access_token: session.access_token
        }
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error(`❌ Chat Init 실패 (${response.status}):`, data);
      return null;
    }

    console.log('✅ Chat Init 성공');
    console.log('   - Conversation ID:', data.conversation_id);
    console.log('   - User ID:', data.user_id);

    return data.conversation_id;
  } catch (error) {
    console.error('❌ 예외 발생:', error);
    return null;
  }
}

// 3. 메시지 전송 테스트
async function testSendMessage(session, conversationId) {
  console.log('\n3️⃣ 메시지 전송 테스트...');

  if (!session || !conversationId) {
    console.error('❌ 세션 또는 대화 ID가 없어서 테스트할 수 없습니다.');
    return false;
  }

  const testMessage = '전세 계약 시 주의사항은 무엇인가요?';
  console.log('   테스트 메시지:', testMessage);

  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        conversation_id: conversationId,
        content: testMessage,
        session: session
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ 메시지 전송 실패 (${response.status}):`, errorText);
      return false;
    }

    console.log('✅ 메시지 전송 성공');
    console.log('   스트리밍 응답 수신 중...');

    // SSE 스트리밍 응답 처리
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let receivedContent = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6));
            if (data.content) {
              receivedContent += data.content;
            }
            if (data.done) {
              console.log('✅ 스트리밍 완료');
            }
          } catch (e) {
            // JSON 파싱 오류 무시
          }
        }
      }
    }

    console.log('   받은 응답 (일부):', receivedContent.substring(0, 100) + '...');
    return true;
  } catch (error) {
    console.error('❌ 예외 발생:', error);
    return false;
  }
}

// 4. localStorage 확인
function checkLocalStorage() {
  console.log('\n4️⃣ LocalStorage 확인...');

  const conversationId = localStorage.getItem('chat_conversation_id');
  const sessions = localStorage.getItem('chatSessions');

  console.log('   - Conversation ID:', conversationId || '없음');
  console.log('   - Chat Sessions:', sessions ? '있음' : '없음');

  if (sessions) {
    try {
      const parsed = JSON.parse(sessions);
      console.log('   - 저장된 세션 수:', parsed.sessions?.length || 0);
    } catch (e) {
      console.error('   - Sessions 파싱 실패:', e.message);
    }
  }
}

// 5. React 컴포넌트 상태 확인
function checkReactState() {
  console.log('\n5️⃣ React 컴포넌트 상태 확인...');

  // React DevTools가 설치되어 있는지 확인
  if (window.__REACT_DEVTOOLS_GLOBAL_HOOK__) {
    console.log('   ✅ React DevTools 감지됨');
    console.log('   React DevTools에서 ChatInterface 컴포넌트의 props를 확인하세요:');
    console.log('   - session prop이 전달되는지');
    console.log('   - conversationId state가 설정되는지');
  } else {
    console.log('   ⚠️ React DevTools가 설치되어 있지 않습니다.');
    console.log('   Chrome 확장 프로그램에서 React Developer Tools를 설치하세요.');
  }
}

// 메인 테스트 함수
async function runAllTests() {
  console.log('\n🚀 모든 테스트 실행 중...\n');

  // 1. Supabase 세션 확인
  const session = await checkSupabaseSession();

  // 2. Chat Init 테스트
  let conversationId = null;
  if (session) {
    conversationId = await testChatInit(session);
  }

  // 3. 메시지 전송 테스트
  if (session && conversationId) {
    await testSendMessage(session, conversationId);
  }

  // 4. LocalStorage 확인
  checkLocalStorage();

  // 5. React 상태 확인
  checkReactState();

  console.log('\n=== 테스트 완료 ===');

  if (session && conversationId) {
    console.log('\n✅ 모든 테스트 통과!');
    console.log('채팅 기능이 정상적으로 작동합니다.');
  } else {
    console.log('\n⚠️ 일부 테스트 실패');
    console.log('위의 에러 메시지를 확인하세요.');
  }
}

// 테스트 실행
runAllTests();