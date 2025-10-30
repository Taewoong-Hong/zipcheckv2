"""
Google reCAPTCHA verification utility.

Usage:
    from core.security.recaptcha import verify_recaptcha
    ok = await verify_recaptcha(token, remote_ip="1.2.3.4")
"""
import logging
from typing import Optional
import httpx

from core.settings import settings

logger = logging.getLogger(__name__)

VERIFY_URL = "https://www.google.com/recaptcha/api/siteverify"


async def verify_recaptcha(token: str, remote_ip: Optional[str] = None) -> bool:
    """
    Verify reCAPTCHA token against Google.

    Args:
        token: Client reCAPTCHA token
        remote_ip: Optional client IP

    Returns:
        True if verification succeeded, else False
    """
    secret = settings.recaptcha_secret_key
    if not secret:
        logger.error("reCAPTCHA secret key not configured")
        return False

    if not token:
        logger.warning("Empty reCAPTCHA token")
        return False

    try:
        data = {"secret": secret, "response": token}
        if remote_ip:
            data["remoteip"] = remote_ip

        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(VERIFY_URL, data=data)
            resp.raise_for_status()
            result = resp.json()
            success = bool(result.get("success"))
            if not success:
                logger.warning(f"reCAPTCHA verification failed: {result}")
            return success
    except Exception as e:
        logger.error(f"reCAPTCHA verification error: {e}")
        return False

