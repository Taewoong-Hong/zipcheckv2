#!/usr/bin/env node
/**
 * Fix Korean text corruption using Buffer-based replacement
 */

const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'apps', 'web', 'components', 'chat', 'ChatInterface.tsx');

console.log('Reading file as buffer...');
let buffer = fs.readFileSync(filePath);
let content = buffer.toString('utf8');

// Define replacements with the exact corrupted sequences
const replacements = [
  // Line 584: 遺꾩꽍 以??ㅻ쪟媛 諛쒖깥 → 분석 중 오류가 발생
  {
    corrupted: '遺꾩꽍 以??ㅻ쪟媛 諛쒖깮',
    fixed: '분석 중 오류가 발생',
    description: 'Line 584 error message'
  },
  // The exact sequence with the ? characters
  {
    corrupted: '遺꾩꽍 以\ufffd?ㅻ쪟媛 諛쒖깮',
    fixed: '분석 중 오류가 발생',
    description: 'Line 584 with replacement char'
  },
  // Try without the middle part
  {
    corrupted: '遺꾩꽍',
    fixed: '분석',
    description: '분석'
  },
  {
    corrupted: '諛쒖깮',
    fixed: '발생',
    description: '발생'
  },
  // 留ㅻℓ → 매매
  {
    corrupted: '留ㅻℓ',
    fixed: '매매',
    description: '매매'
  },
  // 留ㅻℓ媛 → 매매가
  {
    corrupted: '留ㅻℓ媛',
    fixed: '매매가',
    description: '매매가'
  },
  // 留뚯썝 → 만원
  {
    corrupted: '留뚯썝',
    fixed: '만원',
    description: '만원'
  },
  // 泥섎━ → 처리
  {
    corrupted: '泥섎━',
    fixed: '처리',
    description: '처리'
  }
];

console.log('\nApplying replacements...');
let totalReplacements = 0;

replacements.forEach(({ corrupted, fixed, description }) => {
  let count = 0;
  let index = content.indexOf(corrupted);

  while (index !== -1) {
    content = content.substring(0, index) + fixed + content.substring(index + corrupted.length);
    count++;
    index = content.indexOf(corrupted, index + fixed.length);
  }

  if (count > 0) {
    console.log(`✓ Replaced "${description}": ${count} occurrences`);
    totalReplacements += count;
  } else {
    console.log(`✗ Not found: "${description}"`);
  }
});

if (totalReplacements > 0) {
  console.log(`\nWriting fixed content back to file...`);
  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`✅ Success! Fixed ${totalReplacements} corrupted text occurrences.`);

  // Verify the fix
  console.log('\nVerifying fixes...');
  const lines = content.split('\n');

  // Check line 396 (0-indexed: 395)
  if (lines[395] && lines[395].includes('매매')) {
    console.log('✓ Line 396: "매매" fixed');
  }

  // Check line 584 (0-indexed: 583)
  if (lines[583] && lines[583].includes('분석 중 오류가 발생')) {
    console.log('✓ Line 584: "분석 중 오류가 발생" fixed');
  }

  // Check for any remaining corruption
  const remainingCorrupted = ['留', '遺', '泥'].filter(char => content.includes(char));
  if (remainingCorrupted.length > 0) {
    console.log(`\n⚠️ Still contains: ${remainingCorrupted.join(', ')}`);
  } else {
    console.log('\n✅ All corruption cleaned!');
  }
} else {
  console.log('\n⚠️ No replacements made.');

  // Try to find the corruption with different approaches
  console.log('\nSearching for corruption patterns...');

  // Search for specific hex sequences
  const hexPatterns = [
    { hex: 'e981ba', desc: '遺' },
    { hex: 'e79599', desc: '留' },
    { hex: 'e6b3a5', desc: '泥' }
  ];

  const bufferContent = Buffer.from(content, 'utf8');
  hexPatterns.forEach(({ hex, desc }) => {
    const hexBuffer = Buffer.from(hex, 'hex');
    const index = bufferContent.indexOf(hexBuffer);
    if (index !== -1) {
      console.log(`Found ${desc} at byte position ${index}`);
      const start = Math.max(0, index - 20);
      const end = Math.min(bufferContent.length, index + 30);
      const snippet = bufferContent.slice(start, end).toString('utf8');
      console.log(`  Context: ...${snippet}...`);
    }
  });
}