import os
import sys
from pathlib import Path

project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from dotenv import load_dotenv
import psycopg
import json

env_path = project_root / ".env"
load_dotenv(env_path)

DATABASE_URL = os.getenv("DATABASE_URL")

conn = psycopg.connect(DATABASE_URL)
cur = conn.cursor()

print("=" * 80)
print("[1] V2 TABLES")
print("=" * 80)
cur.execute("""
    SELECT tablename, hasindexes, hasrules, hastriggers
    FROM pg_tables
    WHERE schemaname = 'public' AND tablename LIKE 'v2_%'
    ORDER BY tablename;
""")
for row in cur.fetchall():
    print(f"  {row[0]:40} idx={row[1]} rules={row[2]} trig={row[3]}")

print("\n" + "=" * 80)
print("[2] CHAT TABLES")
print("=" * 80)
cur.execute("""
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public'
    AND (tablename LIKE '%conversation%' OR tablename LIKE '%message%')
    ORDER BY tablename;
""")
for row in cur.fetchall():
    print(f"  {row[0]}")

print("\n" + "=" * 80)
print("[3] RLS STATUS")
print("=" * 80)
cur.execute("""
    SELECT tablename, rowsecurity FROM pg_tables
    WHERE schemaname = 'public'
    AND (tablename LIKE 'v2_%' OR tablename IN ('conversations', 'messages'))
    ORDER BY tablename;
""")
for row in cur.fetchall():
    status = "[ON]" if row[1] else "[OFF]"
    print(f"  {row[0]:40} {status}")

print("\n" + "=" * 80)
print("[4] FOREIGN KEYS")
print("=" * 80)
cur.execute("""
    SELECT
        tc.table_name,
        kcu.column_name,
        ccu.table_name,
        ccu.column_name,
        rc.delete_rule
    FROM information_schema.table_constraints AS tc
    JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
    JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
    JOIN information_schema.referential_constraints AS rc
        ON rc.constraint_name = tc.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_schema = 'public'
        AND (tc.table_name LIKE 'v2_%' OR tc.table_name IN ('conversations', 'messages'))
    ORDER BY tc.table_name, ccu.table_name;
""")
current = None
for row in cur.fetchall():
    if row[0] != current:
        print(f"\n  {row[0]}")
        current = row[0]
    print(f"    {row[1]} -> {row[2]}.{row[3]} ({row[4]})")

print("\n" + "=" * 80)
print("[5] V2_CASES COLUMNS")
print("=" * 80)
cur.execute("""
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'v2_cases'
    ORDER BY ordinal_position;
""")
for row in cur.fetchall():
    null_str = "NULL" if row[2] == "YES" else "NOT NULL"
    print(f"  {row[0]:30} {row[1]:20} {null_str}")

print("\n" + "=" * 80)
print("[6] V2_ARTIFACTS COLUMNS")
print("=" * 80)
cur.execute("""
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'v2_artifacts'
    ORDER BY ordinal_position;
""")
for row in cur.fetchall():
    null_str = "NULL" if row[2] == "YES" else "NOT NULL"
    print(f"  {row[0]:30} {row[1]:20} {null_str}")

print("\n" + "=" * 80)
print("[7] V2_REPORTS COLUMNS")
print("=" * 80)
cur.execute("""
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'v2_reports'
    ORDER BY ordinal_position;
""")
for row in cur.fetchall():
    null_str = "NULL" if row[2] == "YES" else "NOT NULL"
    print(f"  {row[0]:30} {row[1]:20} {null_str}")

print("\n" + "=" * 80)
print("[8] STORAGE BUCKETS")
print("=" * 80)
cur.execute("""
    SELECT id, name, public, file_size_limit
    FROM storage.buckets
    ORDER BY name;
""")
for row in cur.fetchall():
    pub = "[PUBLIC]" if row[2] else "[PRIVATE]"
    size = f"{row[3]/(1024*1024):.1f}MB" if row[3] else "unlimited"
    print(f"  {row[1]:20} {pub:12} {size}")

print("\n" + "=" * 80)
print("[9] STORAGE RLS POLICIES")
print("=" * 80)
cur.execute("""
    SELECT bucket_id, name FROM storage.policies
    ORDER BY bucket_id, name;
""")
current = None
for row in cur.fetchall():
    if row[0] != current:
        print(f"\n  Bucket: {row[0]}")
        current = row[0]
    print(f"    - {row[1]}")

print("\n" + "=" * 80)
print("[10] ROW COUNTS")
print("=" * 80)
for table in ['v2_cases', 'v2_artifacts', 'v2_reports', 'conversations', 'messages']:
    try:
        cur.execute(f"SELECT COUNT(*) FROM {table};")
        count = cur.fetchone()[0]
        print(f"  {table:30} {count:>10,} rows")
    except Exception as e:
        print(f"  {table:30} (error: {e})")

cur.close()
conn.close()

print("\n" + "=" * 80)
print("[DONE]")
print("=" * 80)
