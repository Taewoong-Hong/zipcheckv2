"""
JWT 인증 미들웨어 - Supabase JWT 검증

⚠️ 보안 원칙:
1. 프론트엔드에서 받은 Supabase JWT를 검증
2. Service Role Key는 서버 내부에서만 사용 (프론트엔드 노출 금지)
3. JWKS (JSON Web Key Set)로 공개키 검증
4. 만료/위조 토큰 차단
"""

import os
import jwt
import requests
from functools import wraps
from typing import Optional, Dict, Any
from fastapi import HTTPException, Request, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import logging

logger = logging.getLogger(__name__)

# Supabase 설정
SUPABASE_URL = os.getenv("SUPABASE_URL", "https://gsiismzchtgdklvdvggu.supabase.co")
SUPABASE_JWT_SECRET = os.getenv("SUPABASE_JWT_SECRET")  # JWT 시크릿 (HS256 사용 시)
JWKS_URL = f"{SUPABASE_URL}/auth/v1/keys"

# HTTP Bearer 스키마
security = HTTPBearer()

# JWKS 캐시 (성능 최적화)
_jwks_cache: Optional[Dict[str, Any]] = None


def get_jwks() -> Dict[str, Any]:
    """
    Supabase JWKS 가져오기 (캐싱)

    Returns:
        JWKS (JSON Web Key Set)
    """
    global _jwks_cache

    if _jwks_cache is not None:
        return _jwks_cache

    try:
        response = requests.get(JWKS_URL, timeout=5)
        response.raise_for_status()
        _jwks_cache = response.json()
        logger.info("JWKS loaded successfully")
        return _jwks_cache
    except Exception as e:
        logger.error(f"Failed to fetch JWKS: {e}")
        raise HTTPException(
            status_code=500,
            detail="Failed to fetch authentication keys"
        )


def get_public_key(token: str) -> str:
    """
    JWT 헤더에서 kid를 추출하고 매칭되는 공개키 반환

    Args:
        token: JWT 토큰

    Returns:
        공개키 (PEM 형식)
    """
    try:
        # JWT 헤더 디코딩 (검증 없이)
        unverified_header = jwt.get_unverified_header(token)
        kid = unverified_header.get("kid")

        if not kid:
            raise HTTPException(
                status_code=401,
                detail="Invalid token: missing kid"
            )

        # JWKS에서 매칭되는 키 찾기
        jwks = get_jwks()
        for key in jwks.get("keys", []):
            if key.get("kid") == kid:
                # JWK를 PEM으로 변환
                return jwt.algorithms.RSAAlgorithm.from_jwk(key)

        raise HTTPException(
            status_code=401,
            detail="Invalid token: key not found"
        )

    except jwt.DecodeError as e:
        logger.error(f"Token decode error: {e}")
        raise HTTPException(
            status_code=401,
            detail="Invalid token format"
        )


def verify_token(token: str) -> Dict[str, Any]:
    """
    JWT 토큰 검증 - Supabase API를 통한 검증

    Args:
        token: JWT 토큰

    Returns:
        디코딩된 페이로드

    Raises:
        HTTPException: 토큰이 유효하지 않은 경우
    """
    try:
        # Supabase auth API를 통해 토큰 검증
        response = requests.get(
            f"{SUPABASE_URL}/auth/v1/user",
            headers={"Authorization": f"Bearer {token}"},
            timeout=5
        )

        if response.status_code == 401:
            logger.warning("Token verification failed: Invalid or expired token")
            raise HTTPException(
                status_code=401,
                detail="Invalid or expired token"
            )

        if not response.ok:
            logger.error(f"Token verification error: {response.status_code}")
            raise HTTPException(
                status_code=500,
                detail="Token verification failed"
            )

        user_data = response.json()

        # JWT 페이로드 형식으로 반환
        payload = {
            "sub": user_data.get("id"),
            "email": user_data.get("email"),
            "role": user_data.get("role", "authenticated"),
            "aud": "authenticated"
        }

        logger.info(f"Token verified for user: {payload.get('sub')}")
        return payload

    except requests.RequestException as e:
        logger.error(f"Token verification request failed: {e}")
        raise HTTPException(
            status_code=500,
            detail="Token verification service unavailable"
        )


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> Dict[str, Any]:
    """
    FastAPI Dependency: 현재 인증된 사용자 정보 가져오기

    Usage:
        @app.get("/protected")
        async def protected_route(user: dict = Depends(get_current_user)):
            user_id = user["sub"]
            return {"message": f"Hello, {user_id}"}

    Args:
        credentials: Bearer 토큰

    Returns:
        사용자 정보 (JWT 페이로드)
    """
    token = credentials.credentials
    return verify_token(token)


async def get_optional_user(
    request: Request
) -> Optional[Dict[str, Any]]:
    """
    FastAPI Dependency: 선택적 인증 (인증 없이도 접근 가능)

    Usage:
        @app.get("/optional")
        async def optional_route(user: dict = Depends(get_optional_user)):
            if user:
                return {"message": f"Hello, {user['sub']}"}
            return {"message": "Hello, guest"}

    Args:
        request: FastAPI Request

    Returns:
        사용자 정보 또는 None
    """
    auth_header = request.headers.get("Authorization")

    if not auth_header or not auth_header.startswith("Bearer "):
        return None

    token = auth_header.replace("Bearer ", "")

    try:
        return verify_token(token)
    except HTTPException:
        return None


def require_admin(user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
    """
    FastAPI Dependency: 관리자 권한 확인

    Usage:
        @app.delete("/admin/documents/{doc_id}")
        async def delete_document(
            doc_id: str,
            user: dict = Depends(require_admin)
        ):
            # 관리자만 접근 가능
            pass

    Args:
        user: 현재 사용자

    Returns:
        사용자 정보 (관리자인 경우)

    Raises:
        HTTPException: 관리자가 아닌 경우
    """
    is_admin = user.get("app_metadata", {}).get("is_admin", False)

    if not is_admin:
        logger.warning(f"Non-admin user {user.get('sub')} attempted admin access")
        raise HTTPException(
            status_code=403,
            detail="Admin access required"
        )

    return user


# ============================================
# 사용 예시
# ============================================
"""
from fastapi import FastAPI, Depends
from core.auth import get_current_user, get_optional_user, require_admin

app = FastAPI()

# 1. 인증 필수 엔드포인트
@app.post("/documents")
async def create_document(user: dict = Depends(get_current_user)):
    user_id = user["sub"]  # Supabase user_id
    email = user["email"]
    # ... 문서 생성 로직
    return {"user_id": user_id}

# 2. 선택적 인증 엔드포인트
@app.get("/public/info")
async def public_info(user: dict = Depends(get_optional_user)):
    if user:
        return {"message": f"Welcome back, {user['email']}"}
    return {"message": "Welcome, guest"}

# 3. 관리자 전용 엔드포인트
@app.delete("/admin/users/{user_id}")
async def delete_user(user_id: str, admin: dict = Depends(require_admin)):
    # 관리자만 접근 가능
    return {"deleted": user_id}
"""
