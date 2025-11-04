#!/usr/bin/env python3
"""
Supabase DB 마이그레이션 적용 스크립트
"""
import psycopg
from dotenv import load_dotenv
import os
import sys

# .env 파일 로드
load_dotenv('services/ai/.env')

# DATABASE_URL 가져오기
DATABASE_URL = os.getenv('DATABASE_URL')
if not DATABASE_URL:
    print("ERROR: DATABASE_URL not found in environment")
    sys.exit(1)

# psycopg3용 URL 수정
if DATABASE_URL.startswith("postgresql://"):
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+psycopg://", 1).replace("+psycopg://", "://")

def apply_migration():
    """contract_type NULL 허용 마이그레이션 적용"""

    try:
        # DB 연결
        print("Connecting to database...")
        conn = psycopg.connect(DATABASE_URL)
        cur = conn.cursor()

        # 현재 스키마 확인
        print("\n=== Current Schema ===")
        cur.execute("""
            SELECT
                column_name,
                is_nullable,
                data_type,
                column_default
            FROM information_schema.columns
            WHERE table_schema = 'public'
                AND table_name = 'v2_cases'
                AND column_name = 'contract_type'
        """)
        result = cur.fetchone()
        if result:
            col_name, is_nullable, data_type, col_default = result
            print(f"Column: {col_name}")
            print(f"Nullable: {is_nullable}")
            print(f"Type: {data_type}")
            print(f"Default: {col_default}")

        # NOT NULL 제약 제거
        print("\n=== Applying Migration ===")
        print("Removing NOT NULL constraint from contract_type...")
        cur.execute("""
            ALTER TABLE v2_cases
            ALTER COLUMN contract_type DROP NOT NULL
        """)

        # 변경사항 커밋
        conn.commit()
        print("[SUCCESS] Migration applied successfully!")

        # 변경 후 확인
        print("\n=== After Migration ===")
        cur.execute("""
            SELECT
                column_name,
                is_nullable,
                data_type,
                column_default
            FROM information_schema.columns
            WHERE table_schema = 'public'
                AND table_name = 'v2_cases'
                AND column_name = 'contract_type'
        """)
        result = cur.fetchone()
        if result:
            col_name, is_nullable, data_type, col_default = result
            print(f"Column: {col_name}")
            print(f"Nullable: {is_nullable}")
            print(f"Type: {data_type}")
            print(f"Default: {col_default}")

        # CHECK 제약 확인
        print("\n=== CHECK Constraints ===")
        cur.execute("""
            SELECT
                conname AS constraint_name,
                pg_get_constraintdef(oid) AS definition
            FROM pg_constraint
            WHERE conrelid = 'public.v2_cases'::regclass
                AND contype = 'c'
                AND pg_get_constraintdef(oid) LIKE '%contract_type%'
        """)
        constraints = cur.fetchall()
        for constraint in constraints:
            print(f"Constraint: {constraint[0]}")
            print(f"Definition: {constraint[1]}")

        # 연결 종료
        cur.close()
        conn.close()

        print("\n[SUCCESS] Migration completed successfully!")
        print("contract_type column is now nullable.")
        print("Cases can be created without contract_type and updated later.")

    except Exception as e:
        print(f"\n[ERROR] Migration failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    apply_migration()