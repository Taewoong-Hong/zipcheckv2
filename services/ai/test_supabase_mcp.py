"""Supabase MCP 연결 테스트 스크립트."""
import sys
from sqlalchemy import create_engine, text
from core.settings import settings

def test_connection():
    """데이터베이스 연결 테스트."""
    print("=" * 60)
    print("Supabase MCP Connection Test")
    print("=" * 60)

    # 1. 설정 확인
    print("\n[1] Configuration Check")
    print(f"  - Database Host: {settings.database_url.split('@')[1].split('/')[0]}")
    print(f"  - App Environment: {settings.app_env}")
    print(f"  - Primary LLM: {settings.primary_llm}")
    print(f"  - Embed Model: {settings.embed_model}")

    # 2. 연결 테스트
    print("\n[2] Connection Test")
    try:
        engine = create_engine(settings.database_url)
        with engine.connect() as conn:
            result = conn.execute(text("SELECT version();"))
            version = result.fetchone()[0]
            print(f"  [OK] Connection successful!")
            print(f"  - PostgreSQL Version: {version.split(',')[0]}")
    except Exception as e:
        print(f"  [FAIL] Connection failed: {e}")
        return False

    # 3. pgvector 확장 확인
    print("\n[3] pgvector Extension Check")
    try:
        with engine.connect() as conn:
            result = conn.execute(text(
                "SELECT extname, extversion FROM pg_extension WHERE extname = 'vector';"
            ))
            row = result.fetchone()
            if row:
                print(f"  [OK] pgvector installed: v{row[1]}")
            else:
                print("  [FAIL] pgvector not found")
                return False
    except Exception as e:
        print(f"  ✗ Extension check failed: {e}")
        return False

    # 4. v2 테이블 확인
    print("\n[4] v2 Tables Check")
    try:
        with engine.connect() as conn:
            result = conn.execute(text("""
                SELECT table_name
                FROM information_schema.tables
                WHERE table_schema = 'public'
                AND table_name LIKE 'v2_%'
                ORDER BY table_name;
            """))
            tables = [row[0] for row in result.fetchall()]
            if tables:
                print(f"  ✓ Found {len(tables)} v2 tables:")
                for table in tables:
                    print(f"    - {table}")
            else:
                print("  ! No v2 tables found (schema not deployed?)")
    except Exception as e:
        print(f"  ✗ Table check failed: {e}")
        return False

    # 5. RLS 정책 확인
    print("\n[5] Row Level Security (RLS) Check")
    try:
        with engine.connect() as conn:
            result = conn.execute(text("""
                SELECT schemaname, tablename, rowsecurity
                FROM pg_tables
                WHERE tablename LIKE 'v2_%'
                ORDER BY tablename;
            """))
            for row in result.fetchall():
                table = row[1]
                rls = "ENABLED" if row[2] else "DISABLED"
                print(f"  - {table}: RLS {rls}")
    except Exception as e:
        print(f"  ✗ RLS check failed: {e}")
        return False

    # 6. 벡터 인덱스 확인
    print("\n[6] Vector Index Check")
    try:
        with engine.connect() as conn:
            result = conn.execute(text("""
                SELECT indexname, indexdef
                FROM pg_indexes
                WHERE indexname LIKE '%vector%';
            """))
            indexes = list(result.fetchall())
            if indexes:
                print(f"  ✓ Found {len(indexes)} vector index(es):")
                for idx in indexes:
                    print(f"    - {idx[0]}")
            else:
                print("  ! No vector indexes found")
    except Exception as e:
        print(f"  ✗ Index check failed: {e}")
        return False

    print("\n" + "=" * 60)
    print("All checks passed!")
    print("=" * 60)
    return True

if __name__ == "__main__":
    success = test_connection()
    sys.exit(0 if success else 1)
