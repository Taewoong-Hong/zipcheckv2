#!/usr/bin/env python3
"""
Phase 4.2: Refactor execute_analysis_pipeline() to use build_analysis_context()

전략:
1. execute_analysis_pipeline() 함수 찾기
2. Steps 1-6 (케이스 조회부터 LLM 프롬프트 생성까지)를 build_analysis_context() 호출로 교체
3. 나머지 로직(LLM 실행, 리포트 저장, 상태 전환)만 유지
"""
import sys
import re


def main():
    # Read the file
    with open('routes/analysis.py', 'r', encoding='utf-8') as f:
        lines = f.readlines()

    print(f'Total lines: {len(lines)}')

    # ===========================
    # Find execute_analysis_pipeline function
    # ===========================
    func_start = None
    for i, line in enumerate(lines):
        if line.strip().startswith('async def execute_analysis_pipeline(case_id: str):'):
            func_start = i
            break

    if func_start is None:
        print('ERROR: execute_analysis_pipeline function not found')
        return 1

    print(f'[Function Found] execute_analysis_pipeline at line {func_start + 1}')

    # ===========================
    # Find the end of step 5 (LLM 프롬프트 생성 완료)
    # Look for the line: "# 6️⃣ 리포트 저장 (v2_reports 테이블)"
    # OR: "# 5️⃣ 새 아키텍처: RegistryRiskFeatures 변환 + LLM 프롬프트 생성"
    # ===========================
    step6_start = None
    for i in range(func_start, len(lines)):
        line = lines[i]
        # 리포트 저장 단계 찾기
        if '# 6️⃣ 리포트 저장' in line or '# 6⃣ 리포트 저장' in line:
            step6_start = i
            break
        # Alternative: LLM 실행 단계 찾기
        if '# Step 3: LLM 호출' in line or '# 5⃣ 새 아키텍처' in line:
            step6_start = i
            break

    if step6_start is None:
        print('ERROR: Step 6 (리포트 저장) not found')
        return 1

    print(f'[Step 6 Found] 리포트 저장 at line {step6_start + 1}')

    # ===========================
    # Calculate lines to replace
    # ===========================
    # We want to replace from function start + docstring + try: to step6_start - 1
    # Find the "try:" line after docstring
    try_start = None
    for i in range(func_start, step6_start):
        if lines[i].strip() == 'try:':
            try_start = i
            break

    if try_start is None:
        print('ERROR: try: block not found')
        return 1

    print(f'[Try Block] Found at line {try_start + 1}')

    # Find the end of imports (last import line before data collection logic)
    last_import = None
    for i in range(try_start + 1, step6_start):
        if lines[i].strip().startswith('from ') or lines[i].strip().startswith('import '):
            last_import = i

    if last_import is None:
        # No imports, start right after try:
        last_import = try_start

    print(f'[Last Import] at line {last_import + 1}')

    # ===========================
    # Build replacement code
    # ===========================
    replacement_lines = []

    # Keep everything up to and including last_import
    replacement_lines.extend(lines[:last_import + 1])

    # Add blank line
    replacement_lines.append('\n')

    # Add new simplified code
    replacement_lines.append('        # ===========================\n')
    replacement_lines.append('        # Phase 4.2: Use centralized build_analysis_context()\n')
    replacement_lines.append('        # ===========================\n')
    replacement_lines.append('        logger.info(f"분석 파이프라인 시작: case_id={case_id}")\n')
    replacement_lines.append('\n')
    replacement_lines.append('        # Steps 1-6: 데이터 수집 및 준비 (build_analysis_context로 위임)\n')
    replacement_lines.append('        context = await build_analysis_context(case_id)\n')
    replacement_lines.append('\n')
    replacement_lines.append('        # 컨텍스트에서 필요한 변수 추출\n')
    replacement_lines.append('        case = context.case\n')
    replacement_lines.append('        registry_doc_masked = context.registry_doc_masked\n')
    replacement_lines.append('        risk_result = context.risk_result\n')
    replacement_lines.append('        llm_prompt = context.llm_prompt\n')
    replacement_lines.append('        property_value_estimate = context.property_value_estimate\n')
    replacement_lines.append('        jeonse_market_average = context.jeonse_market_average\n')
    replacement_lines.append('        recent_transactions = context.recent_transactions\n')
    replacement_lines.append('        contract_type = case.get(\'contract_type\', \'전세\')\n')
    replacement_lines.append('\n')
    replacement_lines.append('        logger.info(f"컨텍스트 준비 완료: 등기부={bool(context.registry_doc)}, 시장데이터={bool(property_value_estimate)}")\n')
    replacement_lines.append('\n')

    # Continue with the rest of the function (from step6_start onwards)
    replacement_lines.extend(lines[step6_start:])

    # ===========================
    # Write back
    # ===========================
    with open('routes/analysis.py', 'w', encoding='utf-8') as f:
        f.writelines(replacement_lines)

    lines_removed = step6_start - (last_import + 1)
    lines_added = 19  # Number of new lines added
    new_total = len(replacement_lines)

    print(f'[OK] Replaced {lines_removed} lines with {lines_added} lines')
    print(f'File reduced from {len(lines)} to {new_total} lines (Δ: {new_total - len(lines)})')

    return 0


if __name__ == '__main__':
    sys.exit(main())
