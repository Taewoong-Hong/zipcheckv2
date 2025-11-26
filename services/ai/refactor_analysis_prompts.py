#!/usr/bin/env python3
"""
Phase 3.4: Replace two hardcoded prompts in routes/analysis.py with build_judge_prompt() calls

Location 1: Line ~656 in stream_claude_validation() function (inside /stream endpoint)
Location 2: Line ~1029 in /crosscheck endpoint
"""
import sys
import re

def main():
    # Read the file
    with open('routes/analysis.py', 'r', encoding='utf-8') as f:
        lines = f.readlines()

    print(f'Total lines: {len(lines)}')

    # ===========================
    # Location 1: stream_claude_validation() in /stream endpoint
    # ===========================

    # Find the line with "judge_prompt = f"""너는 부동산 계약" inside stream_claude_validation
    location1_start = None
    for i, line in enumerate(lines):
        if 'judge_prompt = f"""너는 부동산 계약 리스크 점검 검증자이다.' in line:
            # Verify we're inside stream_claude_validation by checking previous lines
            context = ''.join(lines[max(0, i-10):i])
            if 'stream_claude_validation' in context:
                location1_start = i
                break

    if location1_start is None:
        print('ERROR: Location 1 (stream_claude_validation) not found')
        return 1

    print(f'[Location 1] Found judge_prompt at line {location1_start + 1}')

    # Find the end of this prompt (closing triple quotes)
    location1_end = None
    for i in range(location1_start + 1, min(location1_start + 30, len(lines))):
        if '..."""' in lines[i] and 'judge_prompt' not in lines[i]:
            location1_end = i
            break

    if location1_end is None:
        print('ERROR: Location 1 end not found')
        return 1

    print(f'[Location 1] Found prompt end at line {location1_end + 1}')
    print(f'[Location 1] Replacing lines {location1_start + 1} to {location1_end + 1} (total: {location1_end - location1_start + 1} lines)')

    # ===========================
    # Location 2: /crosscheck endpoint
    # ===========================

    # Find the line with 'judge_prompt = """너는 부동산 계약' (without f-string)
    location2_start = None
    for i, line in enumerate(lines):
        if 'judge_prompt = """너는 부동산 계약 리스크 점검 검증자이다.' in line and 'f"""' not in line:
            location2_start = i
            break

    if location2_start is None:
        print('ERROR: Location 2 (/crosscheck) not found')
        return 1

    print(f'[Location 2] Found judge_prompt at line {location2_start + 1}')

    # Find the end of this prompt
    location2_end = None
    for i in range(location2_start + 1, min(location2_start + 30, len(lines))):
        if '"""' in lines[i] and 'judge_prompt' not in lines[i]:
            location2_end = i
            break

    if location2_end is None:
        print('ERROR: Location 2 end not found')
        return 1

    print(f'[Location 2] Found prompt end at line {location2_end + 1}')
    print(f'[Location 2] Replacing lines {location2_start + 1} to {location2_end + 1} (total: {location2_end - location2_start + 1} lines)')

    # ===========================
    # Build new file with replacements
    # ===========================

    new_lines = []
    i = 0
    while i < len(lines):
        if i == location1_start:
            # Replace location 1 with function call
            # Keep the same indentation (16 spaces based on context)
            new_lines.append('                judge_prompt = build_judge_prompt(draft_content)\n')
            # Skip to end of prompt
            i = location1_end + 1
        elif i == location2_start:
            # Replace location 2 with function call
            # Keep the same indentation (4 spaces based on context)
            new_lines.append('    judge_prompt = build_judge_prompt(request.draft)\n')
            # Skip to end of prompt
            i = location2_end + 1
        else:
            new_lines.append(lines[i])
            i += 1

    # Write back
    with open('routes/analysis.py', 'w', encoding='utf-8') as f:
        f.writelines(new_lines)

    lines_removed = (location1_end - location1_start) + (location2_end - location2_start)
    print(f'[OK] Replaced {lines_removed} lines with 2 lines')
    print(f'File reduced from {len(lines)} to {len(new_lines)} lines (Δ: {len(new_lines) - len(lines)})')

    return 0

if __name__ == '__main__':
    sys.exit(main())
