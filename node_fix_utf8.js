const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'apps', 'web', 'app', 'api', 'chat', 'route.ts');

// Read file with explicit UTF-8 encoding
let content = fs.readFileSync(filePath, 'utf-8');

// Fix critical syntax error at line 27
content = content.replace(
  /\{ error: '로그.*?니.*? \},/g,
  "{ error: '로그인이 필요합니다' },"
);

// Fix timeout comment at line 578
content = content.replace(
  /60000\s+\/\/\s+60.*?걸림\)/g,
  "60000  // 60초 타임아웃(듀얼 LLM은 시간이 오래 걸림)"
);

// Fix authentication check comment at line 24
content = content.replace(
  /\/\/\s+\?�증\s+\?�인/g,
  "// 인증 확인"
);

// Fix retry log messages
content = content.replace(
  /console\.log\(`\[api\/chat\]\s+\?�청.*?maxRetries\}`\);/g,
  "console.log(`[api/chat] 요청 성공 (재시도: ${attempt}/${maxRetries})`);"
);

// Fix console.error streaming messages
content = content.replace(
  /console\.error\(`\[api\/chat\]\s+\?�.*?LLM.*?\$\{text\}`\);/g,
  "console.error(`[api/chat] 듀얼 LLM 스트리밍 실패: ${streamResponse.status} ${text}`);"
);

// Fix 404 default answer
content = content.replace(
  /const defaultAnswer = '죄송.*?주.*?요\.';/g,
  "const defaultAnswer = '죄송합니다. 분석 결과를 찾을 수 없습니다. 주소와 계약 유형을 먼저 입력해주세요.';"
);

// Fix comment about saving user message
content = content.replace(
  /\/\/\s+1\.\s+\?�용.*?\?�시.*?\?�성.*?\?�시.*?\s+let currentConversationId/g,
  "// 1. 사용자 메시지 저장 (FastAPI /chat/message 호출) + 필요 시 대화 생성/재시도\n    let currentConversationId"
);

// Write back with UTF-8 BOM to ensure proper encoding
fs.writeFileSync(filePath, '\ufeff' + content, 'utf-8');

console.log('✅ UTF-8 fix applied to route.ts');
console.log('File written with UTF-8 BOM encoding');
