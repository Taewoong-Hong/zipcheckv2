import os
from dotenv import load_dotenv

load_dotenv()

db_url = os.getenv("DATABASE_URL")
print("DB URL loaded:", "Yes" if db_url else "No")

if db_url:
    import psycopg2
    try:
        conn = psycopg2.connect(db_url)
        print("Connection: SUCCESS")

        cur = conn.cursor()
        cur.execute("SELECT 1")
        result = cur.fetchone()
        print(f"Query test: {result[0]}")

        cur.close()
        conn.close()
        print("All tests passed!")

    except Exception as e:
        print(f"Error: {type(e).__name__}")
        print(f"Message: {str(e)[:200]}")
