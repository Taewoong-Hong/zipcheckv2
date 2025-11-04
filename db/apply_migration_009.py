"""
Migration 009 적용: Artifacts/Documents 레이어 분리

사용법:
    python db/apply_migration_009.py
"""
import os
import sys
from pathlib import Path
import psycopg
from dotenv import load_dotenv

# Windows 인코딩 설정
if sys.platform == "win32":
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

# .env 파일 로드
env_path = Path(__file__).parent.parent / "services" / "ai" / ".env"
load_dotenv(env_path)

DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    print("❌ DATABASE_URL 환경변수가 설정되지 않았습니다.")
    print(f"   .env 파일 경로: {env_path}")
    sys.exit(1)

# 마이그레이션 파일 읽기
migration_file = Path(__file__).parent / "migrations" / "009_refactor_artifacts_documents.sql"

if not migration_file.exists():
    print(f"❌ 마이그레이션 파일을 찾을 수 없습니다: {migration_file}")
    sys.exit(1)

with open(migration_file, "r", encoding="utf-8") as f:
    migration_sql = f.read()

# 롤백 스크립트 제거 (주석 부분)
if "/*" in migration_sql:
    migration_sql = migration_sql.split("/*")[0].strip()

print("=" * 60)
print("Migration 009: Artifacts/Documents 레이어 분리")
print("=" * 60)
print(f"📁 마이그레이션 파일: {migration_file.name}")
print(f"📊 데이터베이스: {DATABASE_URL.split('@')[1] if '@' in DATABASE_URL else 'Supabase'}")
print()

# 사용자 확인
response = input("⚠️  마이그레이션을 실행하시겠습니까? (yes/no): ")
if response.lower() not in ['yes', 'y']:
    print("❌ 마이그레이션이 취소되었습니다.")
    sys.exit(0)

print()
print("🔄 마이그레이션 실행 중...")
print()

try:
    # psycopg3 연결
    with psycopg.connect(DATABASE_URL) as conn:
        with conn.cursor() as cur:
            # 마이그레이션 실행
            cur.execute(migration_sql)

            # 결과 확인
            print("✅ 마이그레이션 완료!")
            print()

            # 테이블 확인
            print("📊 변경된 테이블 확인:")
            print()

            # 1. v2_doc_texts 존재 확인
            cur.execute("""
                SELECT EXISTS (
                    SELECT 1 FROM information_schema.tables
                    WHERE table_schema = 'public'
                    AND table_name = 'v2_doc_texts'
                );
            """)
            doc_texts_exists = cur.fetchone()[0]
            print(f"   v2_doc_texts: {'✅ 존재' if doc_texts_exists else '❌ 없음'}")

            # 2. v2_artifact_docs 존재 확인
            cur.execute("""
                SELECT EXISTS (
                    SELECT 1 FROM information_schema.tables
                    WHERE table_schema = 'public'
                    AND table_name = 'v2_artifact_docs'
                );
            """)
            artifact_docs_exists = cur.fetchone()[0]
            print(f"   v2_artifact_docs: {'✅ 존재' if artifact_docs_exists else '❌ 없음'}")

            # 3. v2_artifacts 새 컬럼 확인
            cur.execute("""
                SELECT column_name
                FROM information_schema.columns
                WHERE table_schema = 'public'
                AND table_name = 'v2_artifacts'
                AND column_name IN ('hash_sha256', 'deleted_at', 'created_by', 'user_id', 'file_url');
            """)
            new_columns = [row[0] for row in cur.fetchall()]
            print(f"   v2_artifacts 새 컬럼: {', '.join(new_columns) if new_columns else '❌ 없음'}")

            # 4. v2_doc_texts 새 컬럼 확인
            cur.execute("""
                SELECT column_name
                FROM information_schema.columns
                WHERE table_schema = 'public'
                AND table_name = 'v2_doc_texts'
                AND column_name IN ('source_kind', 'source_ref_id', 'lang', 'page_range', 'section_label', 'version');
            """)
            doc_text_columns = [row[0] for row in cur.fetchall()]
            print(f"   v2_doc_texts 새 컬럼: {', '.join(doc_text_columns) if doc_text_columns else '❌ 없음'}")

            # 5. v2_embeddings 외래키 확인
            cur.execute("""
                SELECT constraint_name, table_name
                FROM information_schema.table_constraints
                WHERE table_schema = 'public'
                AND constraint_type = 'FOREIGN KEY'
                AND table_name = 'v2_embeddings'
                AND constraint_name = 'v2_embeddings_doc_id_fkey';
            """)
            fk_exists = cur.fetchone()
            print(f"   v2_embeddings FK: {'✅ v2_doc_texts 참조' if fk_exists else '❌ 없음'}")

            print()
            print("=" * 60)
            print("✅ Migration 009 완료!")
            print("=" * 60)
            print()
            print("다음 단계:")
            print("  1. 코드에서 documentId → artifactId 변수명 통일")
            print("  2. v2_documents → v2_doc_texts 참조 업데이트")
            print("  3. 테스트 및 검증")

except Exception as e:
    print()
    print("=" * 60)
    print(f"❌ 마이그레이션 실패: {e}")
    print("=" * 60)
    print()
    print("롤백 방법:")
    print("  1. migration 파일의 롤백 스크립트 참조")
    print("  2. psql 또는 Supabase SQL Editor에서 롤백 실행")
    sys.exit(1)
