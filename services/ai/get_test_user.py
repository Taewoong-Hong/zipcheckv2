"""Supabase에서 테스트 사용자 ID 가져오기."""
import logging
from sqlalchemy import text
from core.database import get_engine

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def get_test_user_id():
    """auth.users에서 첫 번째 사용자 ID를 가져옵니다."""
    try:
        engine = get_engine()
        with engine.connect() as conn:
            # auth.users 테이블에서 첫 번째 사용자 조회
            result = conn.execute(
                text("SELECT id, email FROM auth.users LIMIT 1;")
            )
            user = result.fetchone()

            if user:
                logger.info(f"[OK] Found test user: {user[1]}")
                logger.info(f"     User ID: {user[0]}")
                return str(user[0])
            else:
                logger.warning("[WARNING] No users found in auth.users table")
                logger.info("You need to:")
                logger.info("  1. Sign up a test user in your Supabase project")
                logger.info("  2. Or use the Supabase dashboard to create a test user")
                return None

    except Exception as e:
        logger.error(f"[ERROR] Failed to query auth.users: {e}")
        return None


if __name__ == "__main__":
    user_id = get_test_user_id()
    if user_id:
        print(f"\n\nUse this user_id for testing:")
        print(f"  {user_id}")
    else:
        print("\n\nNo valid user ID found. Create a test user first.")
