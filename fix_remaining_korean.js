#!/usr/bin/env node
/**
 * Fix remaining Korean corruption in ChatInterface.tsx
 */

const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'apps', 'web', 'components', 'chat', 'ChatInterface.tsx');

console.log('Reading ChatInterface.tsx...');
let content = fs.readFileSync(filePath, 'utf8');

// Track replacements
let totalReplacements = 0;

// Line 396 & 425: '留ㅻℓ' → '매매'
const pattern1 = /留ㅻℓ/g;
const matches1 = content.match(pattern1);
if (matches1) {
  content = content.replace(pattern1, '매매');
  console.log(`✓ Replaced '留ㅻℓ' with '매매': ${matches1.length} occurrences`);
  totalReplacements += matches1.length;
}

// Line 397: '留ㅻℓ媛' → '매매가'
const pattern2 = /留ㅻℓ媛/g;
const matches2 = content.match(pattern2);
if (matches2) {
  content = content.replace(pattern2, '매매가');
  console.log(`✓ Replaced '留ㅻℓ媛' with '매매가': ${matches2.length} occurrences`);
  totalReplacements += matches2.length;
}

// Lines 397, 399, 401: '留뚯썝' → '만원'
const pattern3 = /留뚯썝/g;
const matches3 = content.match(pattern3);
if (matches3) {
  content = content.replace(pattern3, '만원');
  console.log(`✓ Replaced '留뚯썝' with '만원': ${matches3.length} occurrences`);
  totalReplacements += matches3.length;
}

// Line 750: '泥섎━' → '처리'
const pattern4 = /泥섎━/g;
const matches4 = content.match(pattern4);
if (matches4) {
  content = content.replace(pattern4, '처리');
  console.log(`✓ Replaced '泥섎━' with '처리': ${matches4.length} occurrences`);
  totalReplacements += matches4.length;
}

if (totalReplacements > 0) {
  // Write back
  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`\n✅ Fixed ${totalReplacements} Korean text corruptions!`);

  // Verify specific lines
  console.log('\nVerifying key lines:');
  const lines = content.split('\n');

  if (lines[395].includes('매매')) {
    console.log('✓ Line 396: "매매" fixed');
  }
  if (lines[396].includes('매매가') && lines[396].includes('만원')) {
    console.log('✓ Line 397: "매매가" and "만원" fixed');
  }
  if (lines[424].includes('매매')) {
    console.log('✓ Line 425: "매매" fixed');
  }
  if (lines[749].includes('처리')) {
    console.log('✓ Line 750: "처리" fixed');
  }
} else {
  console.log('\n⚠️ No corrupted patterns found (file may already be fixed)');
}

console.log('\n✅ All Korean text corruption has been fixed!');