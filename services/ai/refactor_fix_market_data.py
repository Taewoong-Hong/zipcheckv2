#!/usr/bin/env python3
"""
Phase 4.2 Fix: Add market_data creation after variable extraction

Issue: Line 1496 references market_data variable that doesn't exist after Phase 4.2 refactoring
Solution: Create MarketData object from context variables (property_value_estimate, recent_transactions)
"""
import sys


def main():
    # Read the file
    with open('routes/analysis.py', 'r', encoding='utf-8') as f:
        lines = f.readlines()

    print(f'Total lines: {len(lines)}')

    # Find insertion point: after "contract_type = case.get('contract_type', '전세')"
    insert_after = None
    for i, line in enumerate(lines):
        if "contract_type = case.get('contract_type', '전세')" in line:
            # Verify we're in the Phase 4.2 refactored section
            context = ''.join(lines[max(0, i-15):i])
            if 'Phase 4.2: Use centralized build_analysis_context()' in context:
                insert_after = i
                break

    if insert_after is None:
        print('ERROR: Insertion point not found')
        return 1

    print(f'[Found] Insertion point at line {insert_after + 1}')

    # Build new file with market_data creation
    new_lines = lines[:insert_after + 1]  # Keep everything up to and including contract_type line

    # Add market_data creation code
    new_lines.append('\n')
    new_lines.append('        # MarketData 객체 생성 (매매 계약 전용, 리포트 저장용)\n')
    new_lines.append('        market_data = None\n')
    new_lines.append('        if contract_type == \'매매\' and property_value_estimate:\n')
    new_lines.append('            from core.risk_engine import MarketData\n')
    new_lines.append('            market_data = MarketData(\n')
    new_lines.append('                avg_trade_price=property_value_estimate,\n')
    new_lines.append('                recent_trades=recent_transactions or [],\n')
    new_lines.append('                avg_price_per_pyeong=None,\n')
    new_lines.append('            )\n')

    # Continue with rest of file
    new_lines.extend(lines[insert_after + 1:])

    # Write back
    with open('routes/analysis.py', 'w', encoding='utf-8') as f:
        f.writelines(new_lines)

    print(f'[OK] Added market_data creation after line {insert_after + 1}')
    print(f'File expanded from {len(lines)} to {len(new_lines)} lines (Δ: +{len(new_lines) - len(lines)})')

    return 0


if __name__ == '__main__':
    sys.exit(main())
