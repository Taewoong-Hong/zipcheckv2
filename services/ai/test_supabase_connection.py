#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Supabase PostgreSQL + pgvector 연결 테스트 스크립트
"""
import os
import sys
from dotenv import load_dotenv
import psycopg2
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT

# Windows 콘솔 UTF-8 설정
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')

# Load environment variables
load_dotenv()

def test_connection():
    """Supabase PostgreSQL 연결 테스트"""
    database_url = os.getenv("DATABASE_URL")

    if not database_url:
        print("❌ DATABASE_URL 환경변수가 설정되지 않았습니다.")
        return False

    print(f"🔗 연결 정보: {database_url.split('@')[1] if '@' in database_url else 'hidden'}")

    try:
        # 연결 테스트
        conn = psycopg2.connect(database_url)
        conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
        cursor = conn.cursor()

        print("✅ PostgreSQL 연결 성공!")

        # PostgreSQL 버전 확인
        cursor.execute("SELECT version();")
        version = cursor.fetchone()[0]
        print(f"📌 PostgreSQL 버전: {version.split(',')[0]}")

        # pgvector 확장 확인
        cursor.execute("""
            SELECT EXISTS(
                SELECT 1 FROM pg_extension WHERE extname = 'vector'
            );
        """)
        has_pgvector = cursor.fetchone()[0]

        if has_pgvector:
            print("✅ pgvector 확장이 설치되어 있습니다.")

            # pgvector 버전 확인
            cursor.execute("""
                SELECT extversion FROM pg_extension WHERE extname = 'vector';
            """)
            pgvector_version = cursor.fetchone()[0]
            print(f"📌 pgvector 버전: {pgvector_version}")
        else:
            print("⚠️  pgvector 확장이 설치되어 있지 않습니다.")
            print("   Supabase Dashboard에서 Database > Extensions > vector 를 활성화하세요.")
            return False

        # v2 테이블 존재 여부 확인
        cursor.execute("""
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = 'public'
            AND table_name LIKE 'v2_%'
            ORDER BY table_name;
        """)
        v2_tables = cursor.fetchall()

        if v2_tables:
            print(f"\n✅ v2 테이블이 {len(v2_tables)}개 발견되었습니다:")
            for table in v2_tables:
                print(f"   - {table[0]}")
        else:
            print("\n⚠️  v2 테이블이 없습니다. schema_v2.sql을 실행하세요:")
            print("   psql $DATABASE_URL -f db/schema_v2.sql")
            return False

        # 벡터 테이블 검증
        cursor.execute("""
            SELECT column_name, data_type, udt_name
            FROM information_schema.columns
            WHERE table_name = 'v2_embeddings'
            AND column_name = 'embedding';
        """)
        embedding_col = cursor.fetchone()

        if embedding_col:
            print(f"\n✅ v2_embeddings 테이블의 vector 컬럼 확인:")
            print(f"   - 컬럼명: {embedding_col[0]}")
            print(f"   - 타입: {embedding_col[2]}")
        else:
            print("\n⚠️  v2_embeddings 테이블에 embedding 컬럼이 없습니다.")
            return False

        # RLS 정책 확인
        cursor.execute("""
            SELECT tablename, policyname
            FROM pg_policies
            WHERE schemaname = 'public'
            AND tablename LIKE 'v2_%'
            ORDER BY tablename, policyname;
        """)
        policies = cursor.fetchall()

        if policies:
            print(f"\n✅ RLS 정책이 {len(policies)}개 설정되어 있습니다:")
            current_table = None
            for table, policy in policies:
                if table != current_table:
                    print(f"\n   📋 {table}:")
                    current_table = table
                print(f"      - {policy}")
        else:
            print("\n⚠️  RLS 정책이 설정되어 있지 않습니다.")

        # 연결 정보 요약
        cursor.execute("""
            SELECT
                schemaname,
                COUNT(*) as table_count
            FROM pg_tables
            WHERE schemaname = 'public'
            AND tablename LIKE 'v2_%'
            GROUP BY schemaname;
        """)
        summary = cursor.fetchone()

        if summary:
            print(f"\n📊 데이터베이스 요약:")
            print(f"   - 스키마: {summary[0]}")
            print(f"   - v2 테이블 수: {summary[1]}")

        cursor.close()
        conn.close()

        print("\n🎉 Supabase 연결 테스트를 모두 통과했습니다!")
        return True

    except psycopg2.Error as e:
        print(f"\n❌ PostgreSQL 연결 오류:")
        print(f"   {e}")
        return False
    except Exception as e:
        print(f"\n❌ 예상치 못한 오류:")
        print(f"   {e}")
        return False


def main():
    """메인 함수"""
    print("=" * 60)
    print("🧪 Supabase PostgreSQL + pgvector 연결 테스트")
    print("=" * 60)
    print()

    success = test_connection()

    print()
    print("=" * 60)

    if success:
        print("✅ 모든 테스트 통과!")
        sys.exit(0)
    else:
        print("❌ 일부 테스트 실패. 위 메시지를 확인하세요.")
        sys.exit(1)


if __name__ == "__main__":
    main()
