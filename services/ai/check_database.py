"""
Complete Supabase database check
"""
import os
from dotenv import load_dotenv
import psycopg

load_dotenv()

db_url = os.getenv("DATABASE_URL")

print("=" * 60)
print("Supabase Database Check")
print("=" * 60)

try:
    conn = psycopg.connect(db_url)
    cur = conn.cursor()

    # 1. Basic info
    print("\n[1] Connection Info:")
    cur.execute("SELECT current_database(), current_user")
    db, user = cur.fetchone()
    print(f"    Database: {db}")
    print(f"    User: {user}")

    # 2. Check pgvector extension
    print("\n[2] pgvector Extension:")
    cur.execute("""
        SELECT EXISTS(SELECT 1 FROM pg_extension WHERE extname = 'vector')
    """)
    has_pgvector = cur.fetchone()[0]

    if has_pgvector:
        cur.execute("""
            SELECT extversion FROM pg_extension WHERE extname = 'vector'
        """)
        version = cur.fetchone()[0]
        print(f"    Status: INSTALLED")
        print(f"    Version: {version}")
    else:
        print(f"    Status: NOT INSTALLED")
        print(f"    Action: Run this SQL in Supabase Dashboard:")
        print(f"            CREATE EXTENSION IF NOT EXISTS vector;")

    # 3. Check v2 tables
    print("\n[3] v2 Schema Tables:")
    cur.execute("""
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name LIKE 'v2_%'
        ORDER BY table_name
    """)
    tables = cur.fetchall()

    if tables:
        print(f"    Found: {len(tables)} tables")
        for table in tables:
            print(f"      - {table[0]}")
    else:
        print(f"    Found: 0 tables")
        print(f"    Action: Run schema_v2.sql in Supabase Dashboard SQL Editor")

    # 4. Check RLS policies
    print("\n[4] RLS Policies:")
    cur.execute("""
        SELECT tablename, COUNT(*) as policy_count
        FROM pg_policies
        WHERE schemaname = 'public'
        AND tablename LIKE 'v2_%'
        GROUP BY tablename
        ORDER BY tablename
    """)
    policies = cur.fetchall()

    if policies:
        print(f"    Found: {sum(p[1] for p in policies)} policies")
        for table, count in policies:
            print(f"      - {table}: {count} policies")
    else:
        print(f"    Found: 0 policies")
        if tables:
            print(f"    Warning: Tables exist but no RLS policies!")

    # 5. Check embeddings table specifically
    if any('v2_embeddings' in t[0] for t in tables):
        print("\n[5] v2_embeddings Table Details:")
        cur.execute("""
            SELECT column_name, udt_name
            FROM information_schema.columns
            WHERE table_name = 'v2_embeddings'
            AND column_name = 'embedding'
        """)
        emb_col = cur.fetchone()
        if emb_col:
            print(f"    Embedding column: {emb_col[0]}")
            print(f"    Type: {emb_col[1]}")

        # Check index
        cur.execute("""
            SELECT indexname
            FROM pg_indexes
            WHERE tablename = 'v2_embeddings'
            AND indexname LIKE '%vector%'
        """)
        idx = cur.fetchone()
        if idx:
            print(f"    Vector index: {idx[0]}")

    cur.close()
    conn.close()

    print("\n" + "=" * 60)
    print("Database check completed!")
    print("=" * 60)

except Exception as e:
    print(f"\n[ERROR] {type(e).__name__}: {e}")
    import traceback
    traceback.print_exc()
