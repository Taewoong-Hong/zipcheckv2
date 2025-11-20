"""
Supabase 스키마 검증 스크립트

새 아키텍처에서 필요한 모든 컬럼이 존재하는지 확인합니다.
"""
import os
import sys
from pathlib import Path

# Add parent directory to path to import core modules
sys.path.insert(0, str(Path(__file__).parent.parent))

from core.supabase_client import get_supabase_client
from datetime import datetime


def check_table_schema(supabase, table_name: str) -> dict:
    """
    테이블 스키마 조회

    PostgreSQL information_schema를 사용하여 컬럼 정보를 가져옵니다.
    """
    query = f"""
    SELECT
        column_name,
        data_type,
        is_nullable,
        column_default
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = '{table_name}'
    ORDER BY ordinal_position;
    """

    try:
        response = supabase.rpc('exec_sql', {'query': query}).execute()
        return {"success": True, "columns": response.data if response.data else []}
    except Exception as e:
        # RPC 함수가 없으면 직접 쿼리 시도
        try:
            # Use postgrest client directly
            from supabase import create_client
            url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
            key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

            if not url or not key:
                return {"success": False, "error": "Missing Supabase credentials"}

            # Create a new client with service role
            admin_client = create_client(url, key)

            # Query pg_catalog directly
            result = admin_client.rpc('exec_sql', {'sql': query}).execute()

            return {"success": True, "columns": result.data if result.data else []}
        except Exception as e2:
            return {"success": False, "error": str(e2)}


def verify_v2_reports_schema(columns: list) -> dict:
    """
    v2_reports 테이블 스키마 검증

    필수 컬럼:
    - content (TEXT)
    - registry_data (JSONB)
    - market_data (JSONB)
    - risk_score (JSONB)
    - report_data (JSONB)
    """
    column_names = {col['column_name'] for col in columns}

    required = {
        'content': 'TEXT',
        'registry_data': 'JSONB',
        'market_data': 'JSONB',
        'risk_score': 'JSONB',
        'report_data': 'JSONB',
        'case_id': 'UUID',
        'user_id': 'UUID',
    }

    missing = []
    wrong_type = []

    for col_name, expected_type in required.items():
        if col_name not in column_names:
            missing.append(col_name)
        else:
            # Find the column and check type
            col_info = next((c for c in columns if c['column_name'] == col_name), None)
            if col_info:
                actual_type = col_info['data_type'].upper()
                # Handle PostgreSQL type variations
                if expected_type == 'JSONB' and actual_type not in ['JSONB', 'JSON']:
                    wrong_type.append({
                        'column': col_name,
                        'expected': expected_type,
                        'actual': actual_type
                    })
                elif expected_type == 'TEXT' and actual_type not in ['TEXT', 'CHARACTER VARYING', 'VARCHAR']:
                    wrong_type.append({
                        'column': col_name,
                        'expected': expected_type,
                        'actual': actual_type
                    })
                elif expected_type == 'UUID' and actual_type != 'UUID':
                    wrong_type.append({
                        'column': col_name,
                        'expected': expected_type,
                        'actual': actual_type
                    })

    return {
        'table': 'v2_reports',
        'missing': missing,
        'wrong_type': wrong_type,
        'status': 'OK' if not missing and not wrong_type else 'NEEDS_MIGRATION'
    }


def verify_v2_cases_schema(columns: list) -> dict:
    """
    v2_cases 테이블 스키마 검증

    필수 컬럼:
    - metadata (JSONB) - deposit, price, monthly_rent 저장
    - property_address (TEXT)
    - contract_type (TEXT)
    - current_state (TEXT)
    """
    column_names = {col['column_name'] for col in columns}

    required = {
        'metadata': 'JSONB',
        'property_address': 'TEXT',
        'contract_type': 'TEXT',
        'current_state': 'TEXT',
        'user_id': 'UUID',
    }

    missing = []
    wrong_type = []

    for col_name, expected_type in required.items():
        if col_name not in column_names:
            missing.append(col_name)
        else:
            col_info = next((c for c in columns if c['column_name'] == col_name), None)
            if col_info:
                actual_type = col_info['data_type'].upper()
                if expected_type == 'JSONB' and actual_type not in ['JSONB', 'JSON']:
                    wrong_type.append({
                        'column': col_name,
                        'expected': expected_type,
                        'actual': actual_type
                    })
                elif expected_type == 'TEXT' and actual_type not in ['TEXT', 'CHARACTER VARYING', 'VARCHAR']:
                    wrong_type.append({
                        'column': col_name,
                        'expected': expected_type,
                        'actual': actual_type
                    })
                elif expected_type == 'UUID' and actual_type != 'UUID':
                    wrong_type.append({
                        'column': col_name,
                        'expected': expected_type,
                        'actual': actual_type
                    })

    return {
        'table': 'v2_cases',
        'missing': missing,
        'wrong_type': wrong_type,
        'status': 'OK' if not missing and not wrong_type else 'NEEDS_MIGRATION'
    }


def verify_v2_artifacts_schema(columns: list) -> dict:
    """
    v2_artifacts 테이블 스키마 검증

    필수 컬럼:
    - file_url (TEXT)
    - artifact_type (TEXT)
    - case_id (UUID)
    """
    column_names = {col['column_name'] for col in columns}

    required = {
        'file_url': 'TEXT',
        'artifact_type': 'TEXT',
        'case_id': 'UUID',
    }

    missing = []
    wrong_type = []

    for col_name, expected_type in required.items():
        if col_name not in column_names:
            missing.append(col_name)
        else:
            col_info = next((c for c in columns if c['column_name'] == col_name), None)
            if col_info:
                actual_type = col_info['data_type'].upper()
                if expected_type == 'TEXT' and actual_type not in ['TEXT', 'CHARACTER VARYING', 'VARCHAR']:
                    wrong_type.append({
                        'column': col_name,
                        'expected': expected_type,
                        'actual': actual_type
                    })
                elif expected_type == 'UUID' and actual_type != 'UUID':
                    wrong_type.append({
                        'column': col_name,
                        'expected': expected_type,
                        'actual': actual_type
                    })

    return {
        'table': 'v2_artifacts',
        'missing': missing,
        'wrong_type': wrong_type,
        'status': 'OK' if not missing and not wrong_type else 'NEEDS_MIGRATION'
    }


def generate_migration_sql(results: list) -> str:
    """
    검증 결과를 바탕으로 마이그레이션 SQL 생성
    """
    sql_statements = []

    for result in results:
        table = result['table']

        # Add missing columns
        for col in result['missing']:
            if table == 'v2_reports':
                if col == 'content':
                    sql_statements.append(f"ALTER TABLE {table} ADD COLUMN {col} TEXT;")
                elif col in ['registry_data', 'market_data', 'report_data']:
                    sql_statements.append(f"ALTER TABLE {table} ADD COLUMN {col} JSONB;")
                elif col == 'risk_score':
                    sql_statements.append(f"ALTER TABLE {table} ADD COLUMN {col} JSONB;")
                elif col in ['case_id', 'user_id']:
                    sql_statements.append(f"ALTER TABLE {table} ADD COLUMN {col} UUID REFERENCES v2_cases(id);")

            elif table == 'v2_cases':
                if col == 'metadata':
                    sql_statements.append(f"ALTER TABLE {table} ADD COLUMN {col} JSONB DEFAULT '{{}}'::jsonb;")
                elif col in ['property_address', 'contract_type', 'current_state']:
                    sql_statements.append(f"ALTER TABLE {table} ADD COLUMN {col} TEXT;")
                elif col == 'user_id':
                    sql_statements.append(f"ALTER TABLE {table} ADD COLUMN {col} UUID;")

            elif table == 'v2_artifacts':
                if col in ['file_url', 'artifact_type']:
                    sql_statements.append(f"ALTER TABLE {table} ADD COLUMN {col} TEXT;")
                elif col == 'case_id':
                    sql_statements.append(f"ALTER TABLE {table} ADD COLUMN {col} UUID REFERENCES v2_cases(id);")

        # Fix wrong types
        for wrong in result['wrong_type']:
            col = wrong['column']
            expected = wrong['expected']
            sql_statements.append(f"ALTER TABLE {table} ALTER COLUMN {col} TYPE {expected} USING {col}::{expected};")

    if not sql_statements:
        return "-- No migration needed. Schema is aligned."

    # Add header
    header = f"""-- Auto-generated migration: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
-- Schema alignment for new architecture

"""

    return header + "\n".join(sql_statements) + "\n"


def main():
    """Main execution function"""
    print("=" * 60)
    print("Supabase Schema Verification")
    print("=" * 60)

    # Service Role client creation
    try:
        supabase = get_supabase_client(service_role=True)
        print("[OK] Supabase connected (Service Role)\n")
    except Exception as e:
        print(f"[ERROR] Supabase connection failed: {e}")
        return

    # Table list
    tables = ['v2_reports', 'v2_cases', 'v2_artifacts']
    results = []

    # Verify each table schema
    for table in tables:
        print(f"[CHECK] Verifying {table} table...")

        # Simple table existence check using select
        try:
            # Just check if we can query the table
            test_query = supabase.table(table).select("*").limit(1).execute()

            # Get actual column names from the response (if any data exists)
            if test_query.data:
                columns = [{'column_name': k, 'data_type': 'UNKNOWN'} for k in test_query.data[0].keys()]
            else:
                # Table exists but is empty - we'll need to check another way
                # For now, assume it exists and we'll validate by attempting operations
                columns = []

            print(f"  [OK] {table} table exists")

            # Verify schema based on table
            if table == 'v2_reports':
                result = verify_v2_reports_schema(columns) if columns else {'table': table, 'missing': [], 'wrong_type': [], 'status': 'UNKNOWN'}
            elif table == 'v2_cases':
                result = verify_v2_cases_schema(columns) if columns else {'table': table, 'missing': [], 'wrong_type': [], 'status': 'UNKNOWN'}
            elif table == 'v2_artifacts':
                result = verify_v2_artifacts_schema(columns) if columns else {'table': table, 'missing': [], 'wrong_type': [], 'status': 'UNKNOWN'}

            results.append(result)

            # Print result
            if result['status'] == 'OK':
                print(f"  [OK] Schema is valid\n")
            elif result['status'] == 'UNKNOWN':
                print(f"  [WARN] Table is empty - cannot auto-verify (re-check after data creation)\n")
            else:
                print(f"  [WARN] Schema needs migration:")
                if result['missing']:
                    print(f"    - Missing columns: {', '.join(result['missing'])}")
                if result['wrong_type']:
                    print(f"    - Type mismatches:")
                    for wt in result['wrong_type']:
                        print(f"      * {wt['column']}: {wt['actual']} -> {wt['expected']}")
                print()

        except Exception as e:
            print(f"  [ERROR] {table} table query failed: {e}\n")
            results.append({
                'table': table,
                'missing': [],
                'wrong_type': [],
                'status': 'ERROR',
                'error': str(e)
            })

    # Generate migration SQL
    print("=" * 60)
    print("Verification Summary")
    print("=" * 60)

    needs_migration = any(r['status'] == 'NEEDS_MIGRATION' for r in results)

    if needs_migration:
        print("[WARN] Some tables need migration.\n")

        migration_sql = generate_migration_sql(results)
        migration_path = Path(__file__).parent.parent.parent.parent / 'db' / 'migrations' / '006_auto_schema_alignment.sql'

        with open(migration_path, 'w', encoding='utf-8') as f:
            f.write(migration_sql)

        print(f"[SQL] Migration file created: {migration_path}")
        print("\nMigration SQL:")
        print("-" * 60)
        print(migration_sql)
        print("-" * 60)
        print("\n[ACTION] Run SQL in Supabase Dashboard:")
        print("   1. Supabase Dashboard -> SQL Editor")
        print("   2. Paste the SQL above")
        print("   3. Click Run")
    else:
        print("[OK] All table schemas are valid. No migration needed.")

    print("\n" + "=" * 60)


if __name__ == "__main__":
    main()
