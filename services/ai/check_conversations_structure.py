"""
기존 conversations/messages 테이블 구조 확인
"""
import os
from dotenv import load_dotenv
import psycopg

load_dotenv()

db_url = os.getenv("DATABASE_URL")

print("=" * 60)
print("Conversations & Messages Structure")
print("=" * 60)

try:
    conn = psycopg.connect(db_url)
    cur = conn.cursor()

    # conversations 테이블 구조
    print("\n[1] conversations 테이블 컬럼:")
    cur.execute("""
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_name = 'conversations'
        ORDER BY ordinal_position
    """)
    conv_cols = cur.fetchall()
    for col in conv_cols:
        nullable = "NULL" if col[2] == "YES" else "NOT NULL"
        default = f" DEFAULT {col[3]}" if col[3] else ""
        print(f"    {col[0]}: {col[1]} {nullable}{default}")

    # messages 테이블 구조
    print("\n[2] messages 테이블 컬럼:")
    cur.execute("""
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_name = 'messages'
        ORDER BY ordinal_position
    """)
    msg_cols = cur.fetchall()
    for col in msg_cols:
        nullable = "NULL" if col[2] == "YES" else "NOT NULL"
        default = f" DEFAULT {col[3]}" if col[3] else ""
        print(f"    {col[0]}: {col[1]} {nullable}{default}")

    # 인덱스 확인
    print("\n[3] conversations 인덱스:")
    cur.execute("""
        SELECT indexname, indexdef
        FROM pg_indexes
        WHERE tablename = 'conversations'
    """)
    conv_idx = cur.fetchall()
    for idx in conv_idx:
        print(f"    - {idx[0]}")

    print("\n[4] messages 인덱스:")
    cur.execute("""
        SELECT indexname, indexdef
        FROM pg_indexes
        WHERE tablename = 'messages'
    """)
    msg_idx = cur.fetchall()
    for idx in msg_idx:
        print(f"    - {idx[0]}")

    # RLS 정책 확인
    print("\n[5] conversations RLS 정책:")
    cur.execute("""
        SELECT policyname, cmd
        FROM pg_policies
        WHERE tablename = 'conversations'
    """)
    conv_pol = cur.fetchall()
    for pol in conv_pol:
        print(f"    - {pol[0]} ({pol[1]})")

    print("\n[6] messages RLS 정책:")
    cur.execute("""
        SELECT policyname, cmd
        FROM pg_policies
        WHERE tablename = 'messages'
    """)
    msg_pol = cur.fetchall()
    for pol in msg_pol:
        print(f"    - {pol[0]} ({pol[1]})")

    cur.close()
    conn.close()

    print("\n" + "=" * 60)

except Exception as e:
    print(f"\n[ERROR] {type(e).__name__}: {e}")
    import traceback
    traceback.print_exc()
