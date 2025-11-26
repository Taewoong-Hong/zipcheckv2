#!/usr/bin/env python3
"""
Phase 4.5: Remove unused helper function queue_analysis_task()

Target: routes/analysis.py lines 1098-1106 (9 lines)
Expected: 1528 → ~1519 lines (-9 lines)
"""
import sys


def main():
    # Read the file
    with open('routes/analysis.py', 'r', encoding='utf-8') as f:
        lines = f.readlines()

    print(f'Total lines: {len(lines)}')

    # Find the start and end of queue_analysis_task function
    start_line = None
    end_line = None

    for i, line in enumerate(lines):
        # Start: "async def queue_analysis_task(case_id: str):"
        if start_line is None and 'async def queue_analysis_task(case_id: str):' in line:
            # Verify this is the helper function section
            # Check previous lines for the header comment
            context_before = ''.join(lines[max(0, i-5):i])
            if '# 헬퍼 함수' in context_before or '# ===' in context_before:
                start_line = i
                print(f'[Found] Function starts at line {start_line + 1}')

        # End: line after "pass" (the function body end)
        if start_line is not None and end_line is None:
            # Look for the pass statement within the function
            if i > start_line and line.strip() == 'pass':
                # Include one blank line after if it exists
                end_line = i + 1
                if end_line < len(lines) and lines[end_line].strip() == '':
                    end_line += 1
                print(f'[Found] Function ends at line {end_line}')
                break

    if start_line is None or end_line is None:
        print('ERROR: Could not find queue_analysis_task function')
        print(f'  start_line={start_line}, end_line={end_line}')
        return 1

    # Calculate lines to remove
    lines_to_remove = end_line - start_line
    print(f'[Info] Removing {lines_to_remove} lines ({start_line + 1} to {end_line})')

    # Show what will be removed
    print('\n[Preview] Lines to be removed:')
    for i in range(start_line, end_line):
        print(f'  {i+1}: {lines[i].rstrip()}')

    # Build new file without the function
    new_lines = lines[:start_line]  # Keep everything before function
    new_lines.extend(lines[end_line:])  # Keep everything after function

    # Write back
    with open('routes/analysis.py', 'w', encoding='utf-8') as f:
        f.writelines(new_lines)

    print(f'\n[OK] Removed queue_analysis_task() function')
    print(f'File reduced from {len(lines)} to {len(new_lines)} lines (Δ: {len(new_lines) - len(lines)})')

    return 0


if __name__ == '__main__':
    sys.exit(main())
