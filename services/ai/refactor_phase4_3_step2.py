#!/usr/bin/env python3
"""
Phase 4.3 Step 2: Replace duplicate LLM retry logic with simple_llm_analysis() call

Target: routes/analysis.py lines 1435-1454 (20 lines) → 3 lines
Expected: 1528 → ~1511 lines (-17 net lines)
"""
import sys


def main():
    # Read the file
    with open('routes/analysis.py', 'r', encoding='utf-8') as f:
        lines = f.readlines()

    print(f'Total lines: {len(lines)}')

    # Find the target code block to replace
    start_line = None
    end_line = None

    for i, line in enumerate(lines):
        # Start: "# Step 3: LLM 호출 (해석만 수행, 파싱/계산 없음)"
        if start_line is None and '# Step 3: LLM 호출 (해석만 수행, 파싱/계산 없음)' in line:
            # Verify context: should be inside execute_analysis_pipeline()
            # Check previous lines for "logger.info(f\"컨텍스트 준비 완료"
            context_before = ''.join(lines[max(0, i-5):i])
            if '컨텍스트 준비 완료' in context_before:
                start_line = i
                print(f'[Found] Start at line {start_line + 1}')

        # End: line after "raise HTTPException(503, ..."
        if start_line is not None and end_line is None:
            if 'raise HTTPException(503, "분석이 지연됩니다' in line:
                end_line = i + 1  # Include this line
                print(f'[Found] End at line {end_line}')
                break

    if start_line is None or end_line is None:
        print('ERROR: Could not find target code block')
        print(f'  start_line={start_line}, end_line={end_line}')
        return 1

    # Calculate lines to remove
    lines_to_remove = end_line - start_line
    print(f'[Info] Replacing {lines_to_remove} lines ({start_line + 1} to {end_line})')

    # Build replacement lines
    replacement_lines = [
        '        # Step 3: LLM 호출 (해석만 수행, 파싱/계산 없음)\n',
        '        from core.llm_streaming import simple_llm_analysis\n',
        '        final_answer = await simple_llm_analysis(llm_prompt)\n',
    ]

    # Build new file
    new_lines = lines[:start_line]  # Keep everything before
    new_lines.extend(replacement_lines)  # Add replacement
    new_lines.extend(lines[end_line:])  # Keep everything after

    # Write back
    with open('routes/analysis.py', 'w', encoding='utf-8') as f:
        f.writelines(new_lines)

    print(f'[OK] Replaced {lines_to_remove} lines with {len(replacement_lines)} lines')
    print(f'File reduced from {len(lines)} to {len(new_lines)} lines (Δ: {len(new_lines) - len(lines)})')

    return 0


if __name__ == '__main__':
    sys.exit(main())
