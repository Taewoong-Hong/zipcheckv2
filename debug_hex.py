#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Debug script to show exact hex values of corrupted text
"""

import sys

# Force UTF-8 output
sys.stdout.reconfigure(encoding='utf-8')

# Target file
file_path = r"C:\dev\zipcheckv2\apps\web\components\chat\ChatInterface.tsx"

# Read file content
with open(file_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Check specific lines
target_lines = [397, 399, 401, 425, 584]

for line_num in target_lines:
    if line_num <= len(lines):
        line = lines[line_num - 1]

        # Look for corrupted patterns
        if '留' in line or '遺' in line:
            print(f"\n=== Line {line_num} ===")
            print(f"Text (first 120 chars): {line[:120]}")

            # Find the corrupted part and show its hex
            import re

            # Find Korean-looking corrupted text
            corrupted_patterns = re.findall(r'[留遺][^\s,.:;(){}[\]"\'`]+', line)

            for pattern in corrupted_patterns:
                hex_bytes = pattern.encode('utf-8').hex()
                print(f"\nCorrupted pattern: '{pattern}'")
                print(f"UTF-8 Hex: {hex_bytes}")
                print(f"Hex with spaces: {' '.join([hex_bytes[i:i+2] for i in range(0, len(hex_bytes), 2)])}")

                # Try to guess what it should be
                if '留' in pattern and '媛' in pattern:
                    print("→ Should be: '매매가'")
                elif '留' in pattern and '썝' in pattern:
                    print("→ Should be: '만원'")
                elif '留' in pattern:
                    print("→ Should be: '매매'")
                elif '遺' in pattern:
                    print("→ Should be: '분석 중 오류가 발생했습니다'")