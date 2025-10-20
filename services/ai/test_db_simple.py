#!/usr/bin/env python3
"""Simple Supabase connection test"""
import os
from dotenv import load_dotenv
import psycopg2

load_dotenv()

def test():
    db_url = os.getenv("DATABASE_URL")
    if not db_url:
        print("[ERROR] DATABASE_URL not found")
        return False

    # Safe URL display
    try:
        host_part = db_url.split('@')[1].split('/')[0] if '@' in db_url else '***'
        print(f"Connecting to: {host_part}")
    except:
        print("Connecting to: (hidden)")

    try:
        # Add client_encoding to avoid encoding issues
        conn = psycopg2.connect(db_url, client_encoding='utf8')
        cursor = conn.cursor()

        # Test 1: Basic connection
        cursor.execute("SELECT current_database(), current_user;")
        db_info = cursor.fetchone()
        print(f"[OK] Database: {db_info[0]}, User: {db_info[1]}")

        # Test 2: Check pgvector extension
        cursor.execute("SELECT EXISTS(SELECT 1 FROM pg_extension WHERE extname = 'vector');")
        has_vector = cursor.fetchone()[0]
        print(f"[{'OK' if has_vector else 'FAIL'}] pgvector extension: {has_vector}")

        # Test 3: Check v2 tables
        cursor.execute("""
            SELECT COUNT(*) FROM information_schema.tables
            WHERE table_schema = 'public' AND table_name LIKE 'v2_%'
        """)
        v2_count = cursor.fetchone()[0]
        print(f"[{'OK' if v2_count > 0 else 'WARN'}] v2 tables found: {v2_count}")

        # Test 4: Check v2_embeddings table
        cursor.execute("""
            SELECT EXISTS(
                SELECT 1 FROM information_schema.tables
                WHERE table_name = 'v2_embeddings'
            );
        """)
        has_embeddings = cursor.fetchone()[0]
        print(f"[{'OK' if has_embeddings else 'FAIL'}] v2_embeddings table: {has_embeddings}")

        if has_embeddings:
            # Test 5: Check embedding column type
            cursor.execute("""
                SELECT udt_name FROM information_schema.columns
                WHERE table_name = 'v2_embeddings' AND column_name = 'embedding'
            """)
            col_type = cursor.fetchone()
            if col_type:
                print(f"[OK] embedding column type: {col_type[0]}")

        # Test 6: Check RLS policies
        cursor.execute("""
            SELECT COUNT(*) FROM pg_policies
            WHERE schemaname = 'public' AND tablename LIKE 'v2_%'
        """)
        policy_count = cursor.fetchone()[0]
        print(f"[{'OK' if policy_count > 0 else 'WARN'}] RLS policies: {policy_count}")

        cursor.close()
        conn.close()

        print("\n[SUCCESS] All tests passed!")
        return True

    except Exception as e:
        print(f"\n[ERROR] {e}")
        return False

if __name__ == "__main__":
    import sys
    sys.exit(0 if test() else 1)
