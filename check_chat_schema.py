"""
채팅 관련 테이블 스키마 확인
"""
import psycopg
import os
from dotenv import load_dotenv

load_dotenv('services/ai/.env')
DATABASE_URL = os.getenv('DATABASE_URL')

def get_table_schema(table_name):
    """특정 테이블의 스키마 조회"""
    query = """
    SELECT
        column_name,
        data_type,
        character_maximum_length,
        is_nullable,
        column_default
    FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = %s
    ORDER BY ordinal_position;
    """

    with psycopg.connect(DATABASE_URL) as conn:
        with conn.cursor() as cur:
            cur.execute(query, (table_name,))
            return cur.fetchall()

# conversations 테이블
print("=== conversations 테이블 ===")
try:
    cols = get_table_schema('conversations')
    if cols:
        for col in cols:
            print(f"  - {col[0]}: {col[1]} (nullable: {col[3]})")
    else:
        print("  테이블이 존재하지 않습니다.")
except Exception as e:
    print(f"  조회 실패: {e}")

print()

# messages 테이블
print("=== messages 테이블 ===")
try:
    cols = get_table_schema('messages')
    if cols:
        for col in cols:
            print(f"  - {col[0]}: {col[1]} (nullable: {col[3]})")
    else:
        print("  테이블이 존재하지 않습니다.")
except Exception as e:
    print(f"  조회 실패: {e}")
