#!/usr/bin/env python3
"""
Phase 4.2 Cleanup: Remove old duplicate logic (lines 1400-1443)

This section duplicates what build_analysis_context() now handles:
- risk_result calculation
- market_data creation
- property_value_assessment (LLM web search)

All of this is now centralized in core/analysis_pipeline.py
"""
import sys


def main():
    # Read the file
    with open('routes/analysis.py', 'r', encoding='utf-8') as f:
        lines = f.readlines()

    print(f'Total lines: {len(lines)}')

    # Find the start and end of old logic section
    start_line = None
    end_line = None

    for i, line in enumerate(lines):
        # Start: "risk_result = None" before Phase 4.2 section
        if start_line is None and line.strip() == 'risk_result = None':
            # Check if next line is "market_data = None"
            if i + 1 < len(lines) and 'market_data = None' in lines[i + 1]:
                # Verify we're BEFORE the Phase 4.2 section
                context_after = ''.join(lines[i:min(i+60, len(lines))])
                if 'Phase 4.2: Use centralized build_analysis_context()' in context_after:
                    start_line = i
                    print(f'[Found] Old logic starts at line {start_line + 1}')

        # End: "# 5️⃣ 새 아키텍처: RegistryRiskFeatures 변환 + LLM 프롬프트 생성"
        if start_line is not None and end_line is None:
            if '# 5️⃣ 새 아키텍처: RegistryRiskFeatures 변환 + LLM 프롬프트 생성' in line:
                end_line = i
                print(f'[Found] Old logic ends at line {end_line}')
                break

    if start_line is None or end_line is None:
        print('ERROR: Could not find old logic section boundaries')
        print(f'  start_line={start_line}, end_line={end_line}')
        return 1

    # Calculate lines to remove
    lines_to_remove = end_line - start_line
    print(f'[Info] Removing {lines_to_remove} lines ({start_line + 1} to {end_line})')

    # Build new file without old logic
    new_lines = lines[:start_line]  # Keep everything before old logic
    new_lines.extend(lines[end_line:])  # Continue from "# 5️⃣ 새 아키텍처" comment

    # Write back
    with open('routes/analysis.py', 'w', encoding='utf-8') as f:
        f.writelines(new_lines)

    print(f'[OK] Removed old logic section')
    print(f'File reduced from {len(lines)} to {len(new_lines)} lines (Δ: -{len(lines) - len(new_lines)})')

    return 0


if __name__ == '__main__':
    sys.exit(main())
