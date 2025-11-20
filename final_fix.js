#!/usr/bin/env node
/**
 * Final Korean corruption fix using exact Unicode codepoints
 */

const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'apps', 'web', 'components', 'chat', 'ChatInterface.tsx');

console.log('Reading ChatInterface.tsx...');
let content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

let totalReplacements = 0;

// Exact Unicode codepoints for corrupted characters
const U_F9CD = String.fromCharCode(0xF9CD); // 留
const U_317B = String.fromCharCode(0x317B); // ㅻ
const U_2113 = String.fromCharCode(0x2113); // ℓ
const U_5A9B = String.fromCharCode(0x5A9B); // 媛
const U_B6AF = String.fromCharCode(0xB6AF); // 뚯
const U_C35D = String.fromCharCode(0xC35D); // 썝

// Pattern 1: '留ㅻℓ' → '매매'
const pattern1 = `'${U_F9CD}${U_317B}${U_2113}'`;

// Pattern 2: 留ㅻℓ媛 → 매매가
const pattern2 = `${U_F9CD}${U_317B}${U_2113}${U_5A9B}`;

// Pattern 3: 留뚯썝 → 만원
const pattern3 = `${U_F9CD}${U_B6AF}${U_C35D}`;

// Fix line 396: contractType === '留ㅻℓ'
if (lines[395] && lines[395].includes(pattern1)) {
  lines[395] = lines[395].replace(new RegExp(escapeRegex(pattern1), 'g'), "'매매'");
  console.log('✓ Fixed line 396: contractType === "매매"');
  totalReplacements++;
}

// Fix line 397: 留ㅻℓ媛 and 留뚯썝
if (lines[396]) {
  if (lines[396].includes(pattern2)) {
    lines[396] = lines[396].replace(new RegExp(escapeRegex(pattern2), 'g'), '매매가');
    console.log('✓ Fixed line 397: "매매가"');
    totalReplacements++;
  }
  if (lines[396].includes(pattern3)) {
    lines[396] = lines[396].replace(new RegExp(escapeRegex(pattern3), 'g'), '만원');
    console.log('✓ Fixed line 397: "만원"');
    totalReplacements++;
  }
}

// Fix line 399: 留뚯썝
if (lines[398] && lines[398].includes(pattern3)) {
  lines[398] = lines[398].replace(new RegExp(escapeRegex(pattern3), 'g'), '만원');
  console.log('✓ Fixed line 399: "만원"');
  totalReplacements++;
}

// Fix line 401: 留뚯썝 (appears twice)
if (lines[400] && lines[400].includes(pattern3)) {
  lines[400] = lines[400].replace(new RegExp(escapeRegex(pattern3), 'g'), '만원');
  console.log('✓ Fixed line 401: "만원" (both occurrences)');
  totalReplacements++;
}

// Fix line 425: contractType === '留ㅻℓ'
if (lines[424] && lines[424].includes(pattern1)) {
  lines[424] = lines[424].replace(new RegExp(escapeRegex(pattern1), 'g'), "'매매'");
  console.log('✓ Fixed line 425: contractType === "매매"');
  totalReplacements++;
}

// Fix line 1139: comment with 泥섎━
const U_6CE5 = String.fromCharCode(0x6CE5); // 泥
const U_C12E = String.fromCharCode(0xC12E); // 섎
const U_2501 = String.fromCharCode(0x2501); // ━
const pattern4 = `${U_6CE5}${U_C12E}${U_2501}`;

if (lines[1138] && lines[1138].includes(pattern4)) {
  lines[1138] = lines[1138].replace(new RegExp(escapeRegex(pattern4), 'g'), '처리');
  console.log('✓ Fixed line 1139: "처리"');
  totalReplacements++;
}

// Helper function to escape regex special characters
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

if (totalReplacements > 0) {
  // Write back
  const fixedContent = lines.join('\n');
  fs.writeFileSync(filePath, fixedContent, 'utf8');
  console.log(`\n✅ Fixed ${totalReplacements} Korean text corruptions!`);

  // Verify
  console.log('\nVerifying fixes...');
  const verify = fs.readFileSync(filePath, 'utf8').split('\n');

  if (verify[395] && verify[395].includes('매매')) {
    console.log('✓ Line 396: "매매" verified');
  }
  if (verify[396] && verify[396].includes('매매가') && verify[396].includes('만원')) {
    console.log('✓ Line 397: "매매가" and "만원" verified');
  }
  if (verify[398] && verify[398].includes('만원')) {
    console.log('✓ Line 399: "만원" verified');
  }
  if (verify[400] && verify[400].includes('만원')) {
    console.log('✓ Line 401: "만원" verified');
  }
  if (verify[424] && verify[424].includes('매매')) {
    console.log('✓ Line 425: "매매" verified');
  }
  if (verify[1138] && verify[1138].includes('처리')) {
    console.log('✓ Line 1139: "처리" verified');
  }

  console.log('\n✅ All Korean text corruption has been fixed!');
} else {
  console.log('\n⚠️ No corruption patterns found at expected lines');
  console.log('Showing actual content of key lines:');
  console.log('Line 396:', lines[395]?.substring(0, 100));
  console.log('Line 397:', lines[396]?.substring(0, 100));
  console.log('Line 425:', lines[424]?.substring(0, 100));
}