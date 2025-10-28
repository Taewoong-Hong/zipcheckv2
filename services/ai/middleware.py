"""요청 로깅 미들웨어 - 타임아웃 디버깅용"""
import time
import logging
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

logger = logging.getLogger(__name__)


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """요청 처리 시간 로깅 미들웨어"""

    async def dispatch(self, request: Request, call_next):
        start_time = time.time()
        path = request.url.path
        method = request.method

        logger.info(f"[REQ START] {method} {path}")

        try:
            response = await call_next(request)
            duration_ms = int((time.time() - start_time) * 1000)
            logger.info(f"[REQ END] {method} {path} -> {response.status_code} ({duration_ms}ms)")
            return response
        except Exception as e:
            duration_ms = int((time.time() - start_time) * 1000)
            logger.error(f"[REQ ERROR] {method} {path} -> {type(e).__name__}: {str(e)} ({duration_ms}ms)")
            raise
