const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'apps', 'web', 'app', 'api', 'chat', 'route.ts');

console.log('📄 Reading route.ts...');
let content = fs.readFileSync(filePath, 'utf-8');

console.log('🔧 Applying String() conversion fix for 422 error...');

// Fix: Convert message_id to string for Pydantic validation (line 164)
const originalPattern = /const userMessageId = saveResult\.message_id;(\s*\/\/.*)?/g;
const replacement = "const userMessageId = String(saveResult.message_id); // 백엔드에서 반환한 message_id를 문자열로 변환 (Pydantic string type 요구사항)";

const beforeCount = (content.match(originalPattern) || []).length;
content = content.replace(originalPattern, replacement);
const afterCount = (content.match(/String\(saveResult\.message_id\)/) || []).length;

if (beforeCount > 0 && afterCount > 0) {
  console.log(`✅ Found and replaced ${beforeCount} occurrence(s)`);
} else if (afterCount > 0) {
  console.log('⚠️ String() conversion already exists - no changes needed');
} else {
  console.log('❌ Pattern not found - check file manually');
}

console.log('💾 Writing file with UTF-8 encoding...');
fs.writeFileSync(filePath, content, { encoding: 'utf-8', flag: 'w' });

console.log('✅ String() conversion fix applied!');
console.log('📊 Verification:');
console.log(`   - Original pattern matches: ${beforeCount}`);
console.log(`   - String() conversion present: ${afterCount > 0 ? 'Yes' : 'No'}`);
console.log('\n🔄 Next steps:');
console.log('   1. Restart Next.js dev server (npm run dev)');
console.log('   2. Test chat functionality to verify 422 error is resolved');
console.log('   3. Investigate first message session bug');
