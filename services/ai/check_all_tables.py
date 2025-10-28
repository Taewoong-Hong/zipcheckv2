"""
모든 테이블 확인 (v2_ 접두사 없이도)
"""
import os
from dotenv import load_dotenv
import psycopg

load_dotenv()

db_url = os.getenv("DATABASE_URL")

print("=" * 60)
print("All Tables Check")
print("=" * 60)

try:
    conn = psycopg.connect(db_url)
    cur = conn.cursor()

    # 모든 public 테이블 조회
    print("\n[1] All public schema tables:")
    cur.execute("""
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
        ORDER BY table_name
    """)
    tables = cur.fetchall()

    if tables:
        print(f"    Found: {len(tables)} tables")
        for table in tables:
            print(f"      - {table[0]}")
    else:
        print(f"    Found: 0 tables")

    # cases로 끝나는 테이블 찾기
    print("\n[2] Tables ending with 'cases':")
    cur.execute("""
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name LIKE '%cases%'
        ORDER BY table_name
    """)
    cases_tables = cur.fetchall()

    if cases_tables:
        print(f"    Found: {len(cases_tables)} tables")
        for table in cases_tables:
            print(f"      - {table[0]}")

            # 테이블 구조 확인
            cur.execute(f"""
                SELECT column_name, data_type
                FROM information_schema.columns
                WHERE table_name = '{table[0]}'
                ORDER BY ordinal_position
                LIMIT 5
            """)
            columns = cur.fetchall()
            for col in columns:
                print(f"          └─ {col[0]}: {col[1]}")
    else:
        print(f"    Found: 0 tables")

    cur.close()
    conn.close()

    print("\n" + "=" * 60)

except Exception as e:
    print(f"\n[ERROR] {type(e).__name__}: {e}")
    import traceback
    traceback.print_exc()
