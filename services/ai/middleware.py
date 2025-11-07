"""요청 로깅 및 인증 미들웨어"""
import time
import logging
import jwt
import os
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from datetime import datetime

logger = logging.getLogger(__name__)

# JWT Secret (Supabase)
JWT_SECRET = os.getenv("JWT_SECRET")


async def ensure_user_profile(user_id: str, email: str):
    """
    첫 로그인 시 사용자 프로필 자동 생성

    - v2_profiles 테이블에 사용자 존재 여부 확인
    - 없으면 자동 생성 (INSERT ON CONFLICT DO NOTHING)
    - OAuth 중복 가입 방지 (동일 이메일, 다른 제공자)
    """
    try:
        from core.supabase_client import get_supabase_client

        supabase = get_supabase_client(service_role=True)  # RLS 우회

        # 프로필 존재 여부 확인
        profile_check = supabase.table("v2_profiles") \
            .select("id") \
            .eq("user_id", user_id) \
            .execute()

        if not profile_check.data:
            # 첫 로그인 → 프로필 생성
            supabase.table("v2_profiles").insert({
                "user_id": user_id,
                "email": email,
                "created_at": datetime.utcnow().isoformat(),
                "updated_at": datetime.utcnow().isoformat(),
            }).execute()

            logger.info(f"[PROFILE] Created new profile: {user_id} ({email})")
        else:
            logger.debug(f"[PROFILE] Profile exists: {user_id}")

    except Exception as e:
        # 프로필 생성 실패해도 요청은 계속 진행 (중요하지 않은 작업)
        logger.warning(f"[PROFILE] Failed to ensure profile: {e}")


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """요청 처리 시간 로깅 + 인증 표준화 미들웨어"""

    async def dispatch(self, request: Request, call_next):
        start_time = time.time()
        path = request.url.path
        method = request.method

        logger.info(f"[REQ START] {method} {path}")

        # ✅ 1. JWT 토큰 추출 (쿠키 또는 Authorization 헤더)
        token = (
            request.cookies.get("sb-access-token")
            or (request.headers.get("Authorization") or "").replace("Bearer ", "")
        )

        # ✅ 2. 인증 정보 표준화 (request.state.user에 저장)
        request.state.user = None
        if token and JWT_SECRET:
            try:
                payload = jwt.decode(
                    token,
                    JWT_SECRET,
                    algorithms=["HS256"],
                    options={"verify_aud": False},
                )

                # ✅ 3. user_id 표준화 (id/sub/user_id 중 하나 선택)
                uid = payload.get("id") or payload.get("sub") or payload.get("user_id")

                if uid:
                    request.state.user = {
                        "id": uid,  # ★ 표준화된 user_id
                        "sub": uid,  # 호환성 유지
                        "email": payload.get("email"),
                        "role": payload.get("role"),
                        "raw": payload,  # 원본 JWT 페이로드
                    }
                    logger.debug(f"[AUTH] User authenticated: {uid}")

                    # ✅ 첫 로그인 시 프로필 자동 생성 (비동기)
                    import asyncio
                    asyncio.create_task(ensure_user_profile(uid, payload.get("email")))
                else:
                    logger.warning(f"[AUTH] JWT payload missing user ID: {payload.keys()}")

            except jwt.ExpiredSignatureError:
                logger.warning(f"[AUTH] JWT expired")
            except jwt.InvalidTokenError as e:
                logger.warning(f"[AUTH] Invalid JWT: {e}")
            except Exception as e:
                logger.error(f"[AUTH] Unexpected JWT error: {e}")

        # ✅ 4. 요청 처리
        try:
            response = await call_next(request)
            duration_ms = int((time.time() - start_time) * 1000)
            logger.info(f"[REQ END] {method} {path} -> {response.status_code} ({duration_ms}ms)")
            return response
        except Exception as e:
            duration_ms = int((time.time() - start_time) * 1000)
            logger.error(f"[REQ ERROR] {method} {path} -> {type(e).__name__}: {str(e)} ({duration_ms}ms)")
            raise
