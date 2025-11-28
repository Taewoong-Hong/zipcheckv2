#!/usr/bin/env python3
"""
v2_cases 테이블에 source 컬럼 추가 및 검증

Usage:
    python scripts/add_source_column.py

Environment:
    DATABASE_URL 환경변수 필요
"""
import os
import sys

# .env 파일 로드 시도
try:
    from dotenv import load_dotenv
    # 여러 위치에서 .env 찾기
    for env_path in [
        'services/ai/.env',
        'apps/web/.env.local',
        '.env',
    ]:
        if os.path.exists(env_path):
            load_dotenv(env_path)
            print(f"✅ Loaded env from: {env_path}")
            break
except ImportError:
    print("⚠️ python-dotenv not installed, using system env vars")

import psycopg


def get_database_url():
    """DATABASE_URL 환경변수 가져오기"""
    url = os.environ.get('DATABASE_URL')
    if not url:
        # Supabase 개별 환경변수로 조합 시도
        supabase_url = os.environ.get('SUPABASE_URL') or os.environ.get('NEXT_PUBLIC_SUPABASE_URL')
        if supabase_url:
            # Supabase URL에서 프로젝트 ID 추출
            # https://gsiismzchtgdklvdvggu.supabase.co -> gsiismzchtgdklvdvggu
            project_id = supabase_url.replace('https://', '').split('.')[0]
            # Supabase Pooler 연결 문자열 생성 (기본 형태)
            print(f"📌 Supabase 프로젝트 ID: {project_id}")
            print("❌ DATABASE_URL이 필요합니다. Supabase Dashboard에서 확인하세요:")
            print("   Settings > Database > Connection String")
            return None
    return url


def check_and_add_source_column():
    """v2_cases 테이블에 source 컬럼 확인 및 추가"""

    database_url = get_database_url()
    if not database_url:
        print("\n💡 DATABASE_URL 설정 방법:")
        print("   export DATABASE_URL='postgresql://postgres.xxx:password@xxx.pooler.supabase.com:6543/postgres'")
        return False

    # psycopg3 URL 스킴 변환
    if database_url.startswith('postgresql://'):
        database_url = database_url.replace('postgresql://', 'postgresql+psycopg://', 1)

    print(f"\n🔌 데이터베이스 연결 중...")
    print(f"   URL: {database_url[:50]}...")

    try:
        # psycopg3 연결
        conn_url = database_url.replace('postgresql+psycopg://', 'postgresql://')
        with psycopg.connect(conn_url) as conn:
            with conn.cursor() as cur:

                # 1. 현재 v2_cases 테이블 컬럼 확인
                print("\n📋 v2_cases 테이블 구조 확인...")
                cur.execute("""
                    SELECT column_name, data_type, is_nullable, column_default
                    FROM information_schema.columns
                    WHERE table_name = 'v2_cases'
                    ORDER BY ordinal_position
                """)
                columns = cur.fetchall()

                print("\n   현재 컬럼:")
                existing_columns = set()
                for col in columns:
                    existing_columns.add(col[0])
                    default = f" DEFAULT {col[3]}" if col[3] else ""
                    nullable = "NULL" if col[2] == 'YES' else "NOT NULL"
                    print(f"   - {col[0]}: {col[1]} {nullable}{default}")

                # 2. environment 컬럼 확인
                if 'environment' not in existing_columns:
                    print("\n⚠️ environment 컬럼이 없습니다. 추가합니다...")
                    cur.execute("""
                        ALTER TABLE v2_cases
                        ADD COLUMN IF NOT EXISTS environment TEXT DEFAULT 'prod'
                    """)
                    print("   ✅ environment 컬럼 추가 완료")
                else:
                    print("\n✅ environment 컬럼 존재 확인")

                # 3. source 컬럼 확인 및 추가
                if 'source' not in existing_columns:
                    print("\n⚠️ source 컬럼이 없습니다. 추가합니다...")
                    cur.execute("""
                        ALTER TABLE v2_cases
                        ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'service'
                    """)

                    # 인덱스 추가
                    cur.execute("""
                        CREATE INDEX IF NOT EXISTS idx_v2_cases_source
                        ON v2_cases(source)
                    """)

                    # 복합 인덱스 추가 (environment + source 필터링 최적화)
                    cur.execute("""
                        CREATE INDEX IF NOT EXISTS idx_v2_cases_env_source
                        ON v2_cases(environment, source)
                    """)

                    print("   ✅ source 컬럼 추가 완료")
                    print("   ✅ idx_v2_cases_source 인덱스 생성")
                    print("   ✅ idx_v2_cases_env_source 복합 인덱스 생성")
                else:
                    print("\n✅ source 컬럼 이미 존재")

                # 4. 커밋
                conn.commit()

                # 5. 최종 확인
                print("\n📋 최종 v2_cases 테이블 구조:")
                cur.execute("""
                    SELECT column_name, data_type, is_nullable, column_default
                    FROM information_schema.columns
                    WHERE table_name = 'v2_cases'
                    AND column_name IN ('environment', 'source')
                    ORDER BY ordinal_position
                """)
                final_cols = cur.fetchall()
                for col in final_cols:
                    default = f" DEFAULT {col[3]}" if col[3] else ""
                    nullable = "NULL" if col[2] == 'YES' else "NOT NULL"
                    print(f"   - {col[0]}: {col[1]} {nullable}{default}")

                # 6. 샘플 데이터 확인
                print("\n📊 기존 케이스 현황:")
                cur.execute("""
                    SELECT
                        environment,
                        source,
                        COUNT(*) as count
                    FROM v2_cases
                    GROUP BY environment, source
                    ORDER BY environment, source
                """)
                stats = cur.fetchall()
                if stats:
                    for stat in stats:
                        print(f"   - {stat[0] or 'NULL'} / {stat[1] or 'NULL'}: {stat[2]}건")
                else:
                    print("   (데이터 없음)")

                print("\n✅ 마이그레이션 완료!")
                return True

    except Exception as e:
        print(f"\n❌ 오류 발생: {e}")
        import traceback
        traceback.print_exc()
        return False


if __name__ == '__main__':
    success = check_and_add_source_column()
    sys.exit(0 if success else 1)
