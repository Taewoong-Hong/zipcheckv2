import os
import sys
import locale

# Set locale and encoding
os.environ['PYTHONUTF8'] = '1'
os.environ['PYTHONIOENCODING'] = 'utf-8'

import psycopg2

print(f"System encoding: {sys.getdefaultencoding()}")
print(f"Locale: {locale.getpreferredencoding()}")

try:
    conn = psycopg2.connect(
        host="db.gsiismzchtgdklvdvggu.supabase.co",
        port=5432,
        database="postgres",
        user="postgres",
        password="x9HLz4pQVTDzaS3w"
    )
    print("[OK] Connection successful")

    cur = conn.cursor()
    cur.execute("SELECT 1")
    print(f"[OK] Query successful: {cur.fetchone()[0]}")

    cur.execute("SELECT EXISTS(SELECT 1 FROM pg_extension WHERE extname = 'vector')")
    has_pgvector = cur.fetchone()[0]
    print(f"[OK] pgvector installed: {has_pgvector}")

    cur.close()
    conn.close()
    print("\n[SUCCESS] Connection test passed!")

except Exception as e:
    print(f"[ERROR] {type(e).__name__}")
    import traceback
    traceback.print_exc()
