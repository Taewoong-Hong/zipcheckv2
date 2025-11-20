#!/usr/bin/env node
/**
 * Fix Korean text corruption in ChatInterface.tsx using Node.js
 * Node.js handles UTF-8 better for this specific case
 */

const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'apps', 'web', 'components', 'chat', 'ChatInterface.tsx');

console.log('Reading ChatInterface.tsx...');
let content = fs.readFileSync(filePath, 'utf8');

// Store original length for comparison
const originalLength = content.length;

// Define replacements with exact patterns
const replacements = [
  // 매매 (sale)
  {
    pattern: /留ㅻℓ/g,
    replacement: '매매',
    description: '매매 (sale)'
  },
  // 매매가 (sale price)
  {
    pattern: /留ㅻℓ媛/g,
    replacement: '매매가',
    description: '매매가 (sale price)'
  },
  // 만원 (10,000 won)
  {
    pattern: /留뚯썝/g,
    replacement: '만원',
    description: '만원 (10,000 won)'
  },
  // 분석 중 오류가 발생
  {
    pattern: /遺꾩꽍 以\??ㅻ쪟媛 諛쒖깮/g,
    replacement: '분석 중 오류가 발생',
    description: '분석 중 오류가 발생'
  },
  // 처리 (processing)
  {
    pattern: /泥섎━/g,
    replacement: '처리',
    description: '처리 (processing)'
  }
];

console.log('\nApplying replacements...');
let totalReplacements = 0;

replacements.forEach(({ pattern, replacement, description }) => {
  const matches = content.match(pattern);
  const count = matches ? matches.length : 0;

  if (count > 0) {
    content = content.replace(pattern, replacement);
    console.log(`✓ Replaced "${description}": ${count} occurrences`);
    totalReplacements += count;
  } else {
    console.log(`✗ Not found: "${description}"`);
  }
});

if (totalReplacements > 0) {
  // Write the fixed content back
  console.log(`\nWriting fixed content back to file...`);
  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`✅ Success! Fixed ${totalReplacements} corrupted text occurrences.`);

  // Verify specific lines
  console.log('\nVerifying specific lines...');
  const lines = content.split('\n');
  const checkLines = [395, 396, 398, 400, 424, 583, 1138]; // 0-indexed

  checkLines.forEach(lineNum => {
    if (lineNum < lines.length) {
      const line = lines[lineNum];
      if (line.includes('매매') || line.includes('만원') || line.includes('분석 중 오류가 발생') || line.includes('처리')) {
        console.log(`✓ Line ${lineNum + 1} fixed`);
      }
    }
  });
} else {
  console.log('\n⚠️ No corrupted patterns found. The file may already be fixed or uses different encoding.');

  // Debug: Check if the patterns exist in a different form
  console.log('\nDebug: Checking for patterns...');
  const debugPatterns = ['留', '遺', '泥'];
  debugPatterns.forEach(pattern => {
    if (content.includes(pattern)) {
      const index = content.indexOf(pattern);
      const snippet = content.substring(Math.max(0, index - 20), Math.min(content.length, index + 30));
      console.log(`Found "${pattern}" at position ${index}: ...${snippet}...`);
    }
  });
}

console.log(`\nFile size: ${originalLength} → ${content.length} bytes`);