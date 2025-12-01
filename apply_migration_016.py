"""
Apply Migration 016: Add environment field to v2_cases and v2_artifacts

This script applies the database migration to add the 'environment' column
to v2_cases and v2_artifacts tables in Supabase.
"""
import psycopg
import os
from dotenv import load_dotenv

# Load environment variables from services/ai/.env
load_dotenv('services/ai/.env')

def apply_migration():
    """Apply migration 016 to add environment column"""

    # Get database URL from environment
    database_url = os.getenv('DATABASE_URL')

    if not database_url:
        print("❌ ERROR: DATABASE_URL not found in environment variables")
        return False

    print("=" * 80)
    print("APPLYING MIGRATION 016: Add environment field")
    print("=" * 80)

    try:
        # Connect to database
        print("\n[*] Connecting to database...")
        conn = psycopg.connect(database_url)
        cur = conn.cursor()

        print("[OK] Connected successfully!")

        # Read migration file
        print("\n[*] Reading migration file...")
        with open('db/migrations/016_add_environment_field.sql', 'r', encoding='utf-8') as f:
            migration_sql = f.read()

        # Split by semicolon and filter for ALTER TABLE statements only
        statements = migration_sql.split(';')
        migration_commands = []
        for stmt in statements:
            stmt = stmt.strip()
            # Check if statement contains ALTER TABLE (handles multiline statements with comments)
            if 'ALTER TABLE' in stmt:
                # Filter out pure SELECT statements (verification queries)
                if 'SELECT' not in stmt.upper() or 'ALTER TABLE' in stmt.upper():
                    migration_commands.append(stmt)

        print(f"[OK] Migration file loaded ({len(migration_commands)} commands)")

        # Execute migration commands
        print("\n[*] Executing migration commands...")

        for i, command in enumerate(migration_commands, 1):
            print(f"\n[{i}/{len(migration_commands)}] Executing:")
            print(f"  {command[:100]}...")

            try:
                cur.execute(command)
                print(f"  [OK] Success!")
            except psycopg.errors.DuplicateColumn as e:
                print(f"  [WARN] Column already exists (skipping): {e}")
            except psycopg.errors.DuplicateObject as e:
                print(f"  [WARN] Constraint already exists (skipping): {e}")
            except Exception as e:
                print(f"  [ERROR] Error: {e}")
                raise

        # Commit transaction
        conn.commit()
        print("\n[OK] Migration committed successfully!")

        # Verify migration
        print("\n[*] Verifying migration...")

        # Check v2_cases.environment
        cur.execute("""
            SELECT column_name, is_nullable, data_type, column_default
            FROM information_schema.columns
            WHERE table_schema = 'public'
                AND table_name = 'v2_cases'
                AND column_name = 'environment'
        """)

        result = cur.fetchone()
        if result:
            print(f"\n[OK] v2_cases.environment column verified:")
            print(f"   Column: {result[0]}")
            print(f"   Nullable: {result[1]}")
            print(f"   Type: {result[2]}")
            print(f"   Default: {result[3]}")
        else:
            print("\n[ERROR] v2_cases.environment column NOT FOUND!")
            return False

        # Check v2_artifacts.environment
        cur.execute("""
            SELECT column_name, is_nullable, data_type, column_default
            FROM information_schema.columns
            WHERE table_schema = 'public'
                AND table_name = 'v2_artifacts'
                AND column_name = 'environment'
        """)

        result = cur.fetchone()
        if result:
            print(f"\n[OK] v2_artifacts.environment column verified:")
            print(f"   Column: {result[0]}")
            print(f"   Nullable: {result[1]}")
            print(f"   Type: {result[2]}")
            print(f"   Default: {result[3]}")
        else:
            print("\n[ERROR] v2_artifacts.environment column NOT FOUND!")
            return False

        # Close connection
        cur.close()
        conn.close()

        print("\n" + "=" * 80)
        print("[OK] MIGRATION 016 APPLIED SUCCESSFULLY!")
        print("=" * 80)

        return True

    except Exception as e:
        print(f"\n[ERROR] MIGRATION FAILED: {e}")
        if 'conn' in locals():
            conn.rollback()
            conn.close()
        return False


if __name__ == "__main__":
    success = apply_migration()

    if success:
        print("\n[*] Next steps:")
        print("   1. Restart the FastAPI server (uvicorn will auto-reload)")
        print("   2. Run integration tests: python test_case_endpoint.py")
        print("   3. Verify HTTP 201/200 responses (not 500)")
    else:
        print("[ERROR] Migration failed. Please check the errors above.")
        exit(1)
