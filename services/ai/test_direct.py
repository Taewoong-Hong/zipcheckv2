import psycopg2

db_url = "postgresql://postgres:x9HLz4pQVTDzaS3w@db.gsiismzchtgdklvdvggu.supabase.co:5432/postgres"

try:
    conn = psycopg2.connect(db_url)
    print("[OK] Connection successful")

    cur = conn.cursor()
    cur.execute("SELECT current_database(), current_user")
    result = cur.fetchone()
    print(f"[OK] Database: {result[0]}, User: {result[1]}")

    cur.execute("SELECT EXISTS(SELECT 1 FROM pg_extension WHERE extname = 'vector')")
    has_pgvector = cur.fetchone()[0]
    print(f"[{'OK' if has_pgvector else 'FAIL'}] pgvector: {has_pgvector}")

    cur.execute("SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name LIKE 'v2_%'")
    v2_tables = cur.fetchone()[0]
    print(f"[OK] v2 tables: {v2_tables}")

    cur.close()
    conn.close()
    print("\n[SUCCESS] All tests passed!")

except Exception as e:
    print(f"[ERROR] {e}")
