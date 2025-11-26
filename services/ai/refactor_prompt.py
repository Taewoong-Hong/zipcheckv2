#!/usr/bin/env python3
"""
Phase 3.3: Replace hardcoded prompt with build_judge_prompt() call
"""
import sys

def main():
    # Read the file
    with open('core/llm_streaming.py', 'r', encoding='utf-8') as f:
        lines = f.readlines()

    # Find the TODO comment line
    todo_idx = None
    for i, line in enumerate(lines):
        if 'TODO: Phase 3.2에서 이 프롬프트를' in line:
            todo_idx = i
            break

    if todo_idx is None:
        print('ERROR: TODO comment not found')
        return 1

    print(f'Found TODO at line {todo_idx + 1}')

    # Find the end of the prompt (line with closing triple quotes)
    end_idx = None
    for i in range(todo_idx + 1, min(todo_idx + 30, len(lines))):
        if '..."""' in lines[i]:
            end_idx = i
            break

    if end_idx is None:
        print('ERROR: End of prompt not found')
        return 1

    print(f'Found prompt end at line {end_idx + 1}')
    print(f'Replacing lines {todo_idx + 1} to {end_idx + 1} (total: {end_idx - todo_idx + 1} lines)')

    # Replace the hardcoded prompt with function call
    new_lines = lines[:todo_idx]
    new_lines.append('    judge_prompt = build_judge_prompt(draft_content)\n')
    new_lines.extend(lines[end_idx + 1:])

    # Write back
    with open('core/llm_streaming.py', 'w', encoding='utf-8') as f:
        f.writelines(new_lines)

    print(f'[OK] Replaced {end_idx - todo_idx + 1} lines with 1 line')
    print(f'File reduced from {len(lines)} to {len(new_lines)} lines')
    return 0

if __name__ == '__main__':
    sys.exit(main())
