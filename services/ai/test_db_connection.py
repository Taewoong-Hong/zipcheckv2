"""데이터베이스 연결 테스트 스크립트."""
import logging
from core.database import get_engine, get_session_maker
from sqlalchemy import text

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def test_db_connection():
    """Supabase PostgreSQL 연결 테스트."""
    try:
        logger.info("데이터베이스 연결 테스트 시작...")

        # 엔진 생성
        engine = get_engine()
        logger.info(f"✅ 엔진 생성 성공: {engine.url.database}")

        # 연결 테스트
        with engine.connect() as conn:
            result = conn.execute(text("SELECT version();"))
            version = result.scalar()
            logger.info(f"✅ PostgreSQL 버전: {version}")

            # pgvector 확장 확인
            result = conn.execute(
                text("SELECT EXISTS(SELECT 1 FROM pg_extension WHERE extname = 'vector');")
            )
            has_vector = result.scalar()
            if has_vector:
                logger.info("✅ pgvector 확장 설치됨")
            else:
                logger.warning("⚠️  pgvector 확장이 설치되지 않음")

            # v2 테이블 확인
            result = conn.execute(
                text("""
                    SELECT table_name
                    FROM information_schema.tables
                    WHERE table_schema = 'public'
                    AND table_name LIKE 'v2_%'
                    ORDER BY table_name;
                """)
            )
            tables = result.fetchall()

            if tables:
                logger.info(f"✅ v2 테이블 발견: {len(tables)}개")
                for table in tables:
                    logger.info(f"   - {table[0]}")
            else:
                logger.warning("⚠️  v2 테이블이 없습니다. schema_v2.sql을 실행하세요.")

        logger.info("✅ 데이터베이스 연결 테스트 성공!")
        return True

    except Exception as e:
        logger.error(f"❌ 데이터베이스 연결 실패: {e}")
        return False


if __name__ == "__main__":
    success = test_db_connection()
    exit(0 if success else 1)
