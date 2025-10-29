"""
Supabase 데이터베이스 스키마 조회 스크립트

테이블 목록, 컬럼 정보, 관계(Foreign Keys) 확인
"""
import psycopg
import os
from dotenv import load_dotenv

# .env 파일 로드
load_dotenv('services/ai/.env')

DATABASE_URL = os.getenv('DATABASE_URL')

def get_tables():
    """public 스키마의 모든 테이블 조회"""
    query = """
    SELECT
        table_name,
        (SELECT obj_description((quote_ident(table_schema)||'.'||quote_ident(table_name))::regclass, 'pg_class')) as table_comment
    FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_type = 'BASE TABLE'
    ORDER BY table_name;
    """

    with psycopg.connect(DATABASE_URL) as conn:
        with conn.cursor() as cur:
            cur.execute(query)
            tables = cur.fetchall()

    return tables


def get_table_columns(table_name):
    """특정 테이블의 컬럼 정보 조회"""
    query = """
    SELECT
        column_name,
        data_type,
        character_maximum_length,
        is_nullable,
        column_default,
        col_description((table_schema||'.'||table_name)::regclass::oid, ordinal_position) as column_comment
    FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = %s
    ORDER BY ordinal_position;
    """

    with psycopg.connect(DATABASE_URL) as conn:
        with conn.cursor() as cur:
            cur.execute(query, (table_name,))
            columns = cur.fetchall()

    return columns


def get_foreign_keys():
    """모든 외래 키 관계 조회"""
    query = """
    SELECT
        tc.table_name as from_table,
        kcu.column_name as from_column,
        ccu.table_name AS to_table,
        ccu.column_name AS to_column,
        tc.constraint_name
    FROM information_schema.table_constraints AS tc
    JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema = 'public'
    ORDER BY tc.table_name, kcu.column_name;
    """

    with psycopg.connect(DATABASE_URL) as conn:
        with conn.cursor() as cur:
            cur.execute(query)
            fks = cur.fetchall()

    return fks


def get_views():
    """모든 뷰 조회"""
    query = """
    SELECT
        table_name,
        view_definition
    FROM information_schema.views
    WHERE table_schema = 'public'
    ORDER BY table_name;
    """

    with psycopg.connect(DATABASE_URL) as conn:
        with conn.cursor() as cur:
            cur.execute(query)
            views = cur.fetchall()

    return views


def main():
    print("=" * 80)
    print("ZipCheck v2 - Supabase Database Schema")
    print("=" * 80)
    print()

    # 1. 테이블 목록
    print("📊 테이블 목록:")
    print("-" * 80)
    tables = get_tables()
    for table_name, comment in tables:
        print(f"  - {table_name}")
        if comment:
            print(f"    설명: {comment}")
    print()

    # 2. 각 테이블의 컬럼 정보
    print("📋 테이블 상세 정보:")
    print("=" * 80)
    for table_name, _ in tables:
        print(f"\n테이블: {table_name}")
        print("-" * 80)
        columns = get_table_columns(table_name)

        print(f"{'컬럼명':<30} {'타입':<20} {'NULL':<8} {'기본값':<20}")
        print("-" * 80)
        for col_name, data_type, max_len, nullable, default, comment in columns:
            type_str = f"{data_type}"
            if max_len:
                type_str += f"({max_len})"

            default_str = str(default)[:18] if default else "-"
            print(f"{col_name:<30} {type_str:<20} {nullable:<8} {default_str:<20}")
            if comment:
                print(f"  → {comment}")
        print()

    # 3. 외래 키 관계
    print("\n🔗 테이블 관계 (Foreign Keys):")
    print("=" * 80)
    fks = get_foreign_keys()
    for from_table, from_col, to_table, to_col, constraint_name in fks:
        print(f"  {from_table}.{from_col} → {to_table}.{to_col}")
        print(f"    (제약: {constraint_name})")
    print()

    # 4. 뷰 목록
    print("\n👁️  뷰 목록:")
    print("=" * 80)
    views = get_views()
    for view_name, definition in views:
        print(f"  - {view_name}")
        print(f"    정의: {definition[:100]}...")
    print()

    print("=" * 80)
    print("✅ 스키마 조회 완료")
    print("=" * 80)


if __name__ == "__main__":
    main()
