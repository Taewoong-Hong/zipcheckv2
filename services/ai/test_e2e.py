"""
End-to-End 테스트 스크립트

전체 파이프라인을 테스트합니다:
1. DB 연결 확인
2. 벡터 확장 확인
3. v2 테이블 존재 확인
4. 서버 부팅 확인

사용법:
    python test_e2e.py
"""
import sys
from pathlib import Path

# 프로젝트 루트를 sys.path에 추가
sys.path.insert(0, str(Path(__file__).parent))

from core.settings import settings
from core.retriever import get_pg_connection
from sqlalchemy import text
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def test_db_connection():
    """DB 연결 테스트"""
    print("\n" + "="*60)
    print("[1] DATABASE CONNECTION TEST")
    print("="*60)

    try:
        engine = get_pg_connection()
        with engine.connect() as conn:
            result = conn.execute(text("SELECT version();"))
            version = result.fetchone()[0]
            print(f"[OK] DB 연결 성공!")
            print(f"   PostgreSQL 버전: {version[:50]}...")
            return True
    except Exception as e:
        print(f"[ERROR] DB 연결 실패: {e}")
        return False


def test_vector_extension():
    """pgvector 확장 확인"""
    print("\n" + "="*60)
    print("[2] PGVECTOR EXTENSION TEST")
    print("="*60)

    try:
        engine = get_pg_connection()
        with engine.connect() as conn:
            # pgvector 확장 확인
            result = conn.execute(text("""
                SELECT EXISTS(
                    SELECT 1 FROM pg_extension WHERE extname = 'vector'
                );
            """))
            has_vector = result.fetchone()[0]

            if has_vector:
                print(f"[OK] pgvector 확장 활성화됨")

                # 버전 확인
                result = conn.execute(text("""
                    SELECT extversion FROM pg_extension WHERE extname = 'vector';
                """))
                version = result.fetchone()[0]
                print(f"   pgvector 버전: {version}")
                return True
            else:
                print(f"[ERROR] pgvector 확장이 활성화되지 않음")
                print(f"   SQL Editor에서 실행하세요: CREATE EXTENSION vector;")
                return False

    except Exception as e:
        print(f"[ERROR] pgvector 확장 확인 실패: {e}")
        return False


def test_v2_tables():
    """v2 테이블 존재 확인"""
    print("\n" + "="*60)
    print("[3] V2 TABLES TEST")
    print("="*60)

    v2_tables = [
        'v2_profiles',
        'v2_contracts',
        'v2_documents',
        'v2_embeddings',
        'v2_reports'
    ]

    try:
        engine = get_pg_connection()
        with engine.connect() as conn:
            all_exist = True

            for table in v2_tables:
                result = conn.execute(text(f"""
                    SELECT EXISTS (
                        SELECT 1 FROM information_schema.tables
                        WHERE table_name = '{table}'
                    );
                """))
                exists = result.fetchone()[0]

                if exists:
                    # 행 수 확인
                    result = conn.execute(text(f"SELECT COUNT(*) FROM {table};"))
                    count = result.fetchone()[0]
                    print(f"[OK] {table}: {count}행")
                else:
                    print(f"[ERROR] {table}: 존재하지 않음")
                    all_exist = False

            if not all_exist:
                print(f"\n[WARNING] 일부 테이블이 없습니다!")
                print(f"   SQL Editor에서 실행하세요: db/schema_v2.sql")
                return False

            return True

    except Exception as e:
        print(f"[ERROR] 테이블 확인 실패: {e}")
        return False


def test_hnsw_index():
    """HNSW 인덱스 확인"""
    print("\n" + "="*60)
    print("[4] HNSW INDEX TEST")
    print("="*60)

    try:
        engine = get_pg_connection()
        with engine.connect() as conn:
            result = conn.execute(text("""
                SELECT indexname, indexdef
                FROM pg_indexes
                WHERE tablename = 'v2_embeddings'
                AND indexname LIKE '%vector%';
            """))

            indexes = result.fetchall()

            if indexes:
                for idx_name, idx_def in indexes:
                    print(f"[OK] 인덱스 발견: {idx_name}")
                    if 'hnsw' in idx_def.lower():
                        print(f"   타입: HNSW (Good)")
                    else:
                        print(f"   타입: {idx_def[:100]}...")
                return True
            else:
                print(f"[ERROR] v2_embeddings에 벡터 인덱스가 없습니다")
                print(f"   SQL Editor에서 실행하세요:")
                print(f"   CREATE INDEX idx_v2_embeddings_vector ON v2_embeddings")
                print(f"   USING hnsw (embedding vector_cosine_ops)")
                print(f"   WITH (m = 16, ef_construction = 64);")
                return False

    except Exception as e:
        print(f"[ERROR] 인덱스 확인 실패: {e}")
        return False


def test_api_keys():
    """API 키 설정 확인"""
    print("\n" + "="*60)
    print("[5] API KEYS TEST")
    print("="*60)

    has_openai = settings.openai_api_key and not settings.openai_api_key.startswith("sk-test")
    has_anthropic = settings.anthropic_api_key and not settings.anthropic_api_key.startswith("sk-ant-test")

    if has_openai:
        print(f"[OK] OPENAI_API_KEY: 설정됨 ({settings.openai_api_key[:10]}...)")
    else:
        print(f"[WARN] OPENAI_API_KEY: 테스트 키 또는 미설정")
        print(f"   .env 파일에서 실제 키로 교체하세요")

    if has_anthropic:
        print(f"[OK] ANTHROPIC_API_KEY: 설정됨 ({settings.anthropic_api_key[:10]}...)")
    else:
        print(f"[WARN] ANTHROPIC_API_KEY: 테스트 키 또는 미설정")
        print(f"   .env 파일에서 실제 키로 교체하세요")

    return has_openai  # OpenAI는 필수


def print_summary(results):
    """테스트 결과 요약"""
    print("\n" + "="*60)
    print("[SUMMARY] TEST RESULTS")
    print("="*60)

    all_passed = all(results.values())

    for test_name, passed in results.items():
        status = "[PASS]" if passed else "[FAIL]"
        print(f"{status} - {test_name}")

    print("\n" + "="*60)

    if all_passed:
        print("[SUCCESS] 모든 테스트 통과! 서버를 시작할 수 있습니다.")
        print("\n다음 명령으로 서버 시작:")
        print("  cd services/ai")
        print("  uvicorn app:app --reload")
        print("\n서버 시작 후 테스트:")
        print("  curl http://localhost:8000/healthz")
    else:
        print("[WARNING] 일부 테스트 실패. 위의 안내를 따라 수정하세요.")

        if not results.get("Vector Extension"):
            print("\n[1] Supabase SQL Editor에서 실행:")
            print("   CREATE EXTENSION IF NOT EXISTS vector;")

        if not results.get("V2 Tables"):
            print("\n[2] Supabase SQL Editor에서 실행:")
            print("   db/schema_v2.sql 파일의 내용 전체")

        if not results.get("API Keys"):
            print("\n[3] .env 파일 수정:")
            print("   OPENAI_API_KEY=sk-proj-... (실제 키)")

    print("="*60 + "\n")


def main():
    print("ZipCheck AI E2E Test")
    print("="*60)

    results = {}

    # 1. DB 연결
    results["DB Connection"] = test_db_connection()

    if results["DB Connection"]:
        # 2. pgvector 확장
        results["Vector Extension"] = test_vector_extension()

        # 3. v2 테이블
        results["V2 Tables"] = test_v2_tables()

        # 4. HNSW 인덱스
        results["HNSW Index"] = test_hnsw_index()
    else:
        print("\n[WARNING] DB 연결 실패로 나머지 테스트를 건너뜁니다.")
        results["Vector Extension"] = False
        results["V2 Tables"] = False
        results["HNSW Index"] = False

    # 5. API 키
    results["API Keys"] = test_api_keys()

    # 요약
    print_summary(results)

    # 종료 코드
    sys.exit(0 if all(results.values()) else 1)


if __name__ == "__main__":
    main()
