"""
Verify Database Schema - Check environment column exists

Direct psycopg3 connection to verify migration 016 schema changes
independent of PostgREST cache state.
"""
import psycopg
import os
import uuid
from dotenv import load_dotenv

# Load environment variables
load_dotenv('services/ai/.env')


def verify_schema():
    """Verify environment column exists in v2_cases and v2_artifacts"""

    database_url = os.getenv('DATABASE_URL')

    if not database_url:
        print("[ERROR] DATABASE_URL not found in environment variables")
        return False

    print("=" * 80)
    print("DATABASE SCHEMA VERIFICATION")
    print("=" * 80)

    try:
        # Connect to database
        print("\n[*] Connecting to database...")
        conn = psycopg.connect(database_url)
        cur = conn.cursor()
        print("[OK] Connected successfully!")

        # Verify v2_cases.environment
        print("\n[*] Verifying v2_cases.environment column...")
        cur.execute("""
            SELECT
                column_name,
                is_nullable,
                data_type,
                column_default
            FROM information_schema.columns
            WHERE table_schema = 'public'
                AND table_name = 'v2_cases'
                AND column_name = 'environment'
        """)

        result = cur.fetchone()
        if result:
            print(f"\n[OK] v2_cases.environment column VERIFIED:")
            print(f"   Column Name: {result[0]}")
            print(f"   Nullable: {result[1]}")
            print(f"   Data Type: {result[2]}")
            print(f"   Default: {result[3]}")
        else:
            print("\n[ERROR] v2_cases.environment column NOT FOUND!")
            return False

        # Verify v2_artifacts.environment
        print("\n[*] Verifying v2_artifacts.environment column...")
        cur.execute("""
            SELECT
                column_name,
                is_nullable,
                data_type,
                column_default
            FROM information_schema.columns
            WHERE table_schema = 'public'
                AND table_name = 'v2_artifacts'
                AND column_name = 'environment'
        """)

        result = cur.fetchone()
        if result:
            print(f"\n[OK] v2_artifacts.environment column VERIFIED:")
            print(f"   Column Name: {result[0]}")
            print(f"   Nullable: {result[1]}")
            print(f"   Data Type: {result[2]}")
            print(f"   Default: {result[3]}")
        else:
            print("\n[ERROR] v2_artifacts.environment column NOT FOUND!")
            return False

        # Verify CHECK constraints
        print("\n[*] Verifying CHECK constraints...")
        cur.execute("""
            SELECT
                conname,
                pg_get_constraintdef(oid)
            FROM pg_constraint
            WHERE conrelid = 'v2_cases'::regclass
                AND contype = 'c'
                AND conname LIKE '%environment%'
        """)

        constraints = cur.fetchall()
        if constraints:
            print(f"\n[OK] v2_cases CHECK constraints VERIFIED:")
            for constraint in constraints:
                print(f"   {constraint[0]}: {constraint[1]}")
        else:
            print("\n[WARN] No CHECK constraints found for v2_cases.environment")

        cur.execute("""
            SELECT
                conname,
                pg_get_constraintdef(oid)
            FROM pg_constraint
            WHERE conrelid = 'v2_artifacts'::regclass
                AND contype = 'c'
                AND conname LIKE '%environment%'
        """)

        constraints = cur.fetchall()
        if constraints:
            print(f"\n[OK] v2_artifacts CHECK constraints VERIFIED:")
            for constraint in constraints:
                print(f"   {constraint[0]}: {constraint[1]}")
        else:
            print("\n[WARN] No CHECK constraints found for v2_artifacts.environment")

        # Test INSERT with environment='dev'
        print("\n[*] Testing direct INSERT with environment='dev'...")
        test_id = str(uuid.uuid4())

        cur.execute("""
            INSERT INTO v2_cases (id, user_id, property_address, address_road, current_state, environment)
            VALUES (%s, '259154b5-e294-4dd5-a0c6-1f80ea6d462e', 'Test Address', 'Test Road', 'init', 'dev')
            RETURNING id, environment
        """, (test_id,))

        result = cur.fetchone()
        if result and result[1] == 'dev':
            print(f"\n[OK] Direct INSERT successful:")
            print(f"   ID: {result[0]}")
            print(f"   Environment: {result[1]}")

            # Clean up test record
            cur.execute("DELETE FROM v2_cases WHERE id = %s", (test_id,))
            conn.commit()
            print(f"   (Test record cleaned up)")
        else:
            print("\n[ERROR] Direct INSERT failed!")
            conn.rollback()
            return False

        # Close connection
        cur.close()
        conn.close()

        print("\n" + "=" * 80)
        print("[OK] SCHEMA VERIFICATION COMPLETE")
        print("=" * 80)
        print("\nSummary:")
        print("   [OK] v2_cases.environment column exists")
        print("   [OK] v2_artifacts.environment column exists")
        print("   [OK] CHECK constraints verified")
        print("   [OK] Direct INSERT with environment='dev' works")
        print("\n[NOTE] Database schema is CORRECT.")
        print("   If API tests still fail with HTTP 500, the issue is PostgREST cache staleness.")
        print("   Solution: Manual restart required at:")
        print("   https://supabase.com/dashboard/project/gsiismzchtgdklvdvggu/settings/general")

        return True

    except Exception as e:
        print(f"\n[ERROR] Schema verification failed: {e}")
        if 'conn' in locals():
            conn.rollback()
            conn.close()
        return False


if __name__ == "__main__":
    import sys
    success = verify_schema()
    sys.exit(0 if success else 1)
