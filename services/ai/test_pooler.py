"""
Test different Supabase connection methods
"""
import psycopg

# Test 1: Direct connection (old method - may not work)
print("=" * 60)
print("Test 1: Direct Connection (Port 5432)")
print("=" * 60)
try:
    conn = psycopg.connect(
        "postgresql://postgres:x9HLz4pQVTDzaS3w@db.gsiismzchtgdklvdvggu.supabase.co:5432/postgres",
        connect_timeout=5
    )
    print("[OK] Direct connection successful")
    conn.close()
except Exception as e:
    print(f"[FAIL] {type(e).__name__}: {e}")

print()

# Test 2: Connection Pooler (recommended method)
print("=" * 60)
print("Test 2: Connection Pooler (Port 6543) - Transaction Mode")
print("=" * 60)

# Common pooler hostnames by region
pooler_hosts = [
    "aws-0-ap-northeast-2.pooler.supabase.com",  # Seoul
    "aws-0-ap-northeast-1.pooler.supabase.com",  # Tokyo
    "aws-0-us-east-1.pooler.supabase.com",       # US East
    "aws-0-us-west-1.pooler.supabase.com",       # US West
]

project_ref = "gsiismzchtgdklvdvggu"
password = "x9HLz4pQVTDzaS3w"

for host in pooler_hosts:
    url = f"postgresql://postgres.{project_ref}:{password}@{host}:6543/postgres"
    print(f"\nTrying: {host}")
    try:
        conn = psycopg.connect(url, connect_timeout=3)
        print(f"[SUCCESS] Connected via {host}")

        cur = conn.cursor()
        cur.execute("SELECT current_database()")
        db = cur.fetchone()[0]
        print(f"[OK] Database: {db}")

        cur.close()
        conn.close()

        print("\n" + "=" * 60)
        print("WORKING CONNECTION STRING:")
        print(url)
        print("=" * 60)
        break
    except Exception as e:
        print(f"[FAIL] {type(e).__name__}")

print("\n" + "=" * 60)
print("NEXT STEPS:")
print("=" * 60)
print("1. Go to Supabase Dashboard")
print("2. Project Settings → Database → Connection String")
print("3. Enable 'Use connection pooling'")
print("4. Copy the URI and update .env files")
print("=" * 60)
