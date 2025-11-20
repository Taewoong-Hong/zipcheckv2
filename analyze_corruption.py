#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Analyze the exact byte representation of corrupted Korean text
"""

import sys

# Force UTF-8 output
sys.stdout.reconfigure(encoding='utf-8')

# Target file
file_path = r"C:\dev\zipcheckv2\apps\web\components\chat\ChatInterface.tsx"

# Read file content as bytes
with open(file_path, 'rb') as f:
    content_bytes = f.read()

# Convert to string
content = content_bytes.decode('utf-8', errors='replace')

# Get specific lines
lines = content.split('\n')

print("Analyzing corruption patterns in specific lines:\n")

# Check lines with known corruption
for line_num in [397, 399, 401, 425, 584]:
    if line_num <= len(lines):
        line = lines[line_num - 1]  # 0-indexed
        print(f"Line {line_num}:")
        print(f"  Text: {line.strip()[:100]}...")

        # Find and display byte representation of corrupted parts
        if '留' in line:
            # Get the position and surrounding text
            pos = line.index('留')
            snippet = line[max(0, pos-5):min(len(line), pos+10)]
            snippet_bytes = snippet.encode('utf-8')
            print(f"  Found '留' at position {pos}")
            print(f"  Snippet: '{snippet}'")
            print(f"  Bytes: {snippet_bytes.hex()}")

            # Try to extract the full corrupted word
            import re
            # Match corrupted patterns
            matches = re.findall(r'留[^\s,.:;]+', line)
            if matches:
                for match in matches:
                    print(f"  Corrupted word: '{match}'")
                    print(f"  Bytes: {match.encode('utf-8').hex()}")

                    # Suggest replacements based on context
                    if '媛' in match:
                        print(f"  → Should be: '매매가'")
                    elif '썝' in match:
                        print(f"  → Should be: '만원'")
                    elif 'ㅻ' in match:
                        print(f"  → Should be: '매매'")

        if '遺' in line:
            pos = line.index('遺')
            snippet = line[max(0, pos-5):min(len(line), pos+30)]
            print(f"  Found '遺' at position {pos}")
            print(f"  Snippet: '{snippet}'")
            print(f"  → Should be: '분석 중 오류가 발생했습니다'")

        print()