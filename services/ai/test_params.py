import psycopg2

# Use separate parameters instead of URL
try:
    conn = psycopg2.connect(
        host="db.gsiismzchtgdklvdvggu.supabase.co",
        port=5432,
        database="postgres",
        user="postgres",
        password="x9HLz4pQVTDzaS3w",
        options="-c client_encoding=UTF8"
    )
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

    if v2_tables > 0:
        cur.execute("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name LIKE 'v2_%' ORDER BY table_name")
        tables = cur.fetchall()
        print("\nTables found:")
        for table in tables:
            print(f"  - {table[0]}")

    cur.close()
    conn.close()
    print("\n[SUCCESS] Supabase connection verified!")

except Exception as e:
    print(f"[ERROR] {type(e).__name__}: {e}")
