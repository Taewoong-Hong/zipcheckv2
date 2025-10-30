"""
SMS 인증 API 라우터
"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from core.sms import send_verification_sms, verify_sms_code
from core.security.turnstile import verify_turnstile
from core.security.recaptcha import verify_recaptcha
import logging

router = APIRouter(prefix="/auth", tags=["SMS 인증"])

logger = logging.getLogger(__name__)

class SendSMSRequest(BaseModel):
    phone: str  # 010-1234-5678 또는 01012345678
    turnstile_token: str | None = None
    recaptcha_token: str | None = None


class VerifySMSRequest(BaseModel):
    phone: str
    code: str  # 6자리 인증번호
    turnstile_token: str | None = None
    recaptcha_token: str | None = None


async def _verify_bot_protection(req: Request, turnstile_token: str | None, recaptcha_token: str | None) -> None:
    """Require at least one valid bot-protection token (Turnstile or reCAPTCHA)."""
    remote_ip = req.headers.get("x-forwarded-for", req.client.host if req.client else None)
    ok = False
    if turnstile_token:
        try:
            ok = await verify_turnstile(turnstile_token, remote_ip=remote_ip)
        except Exception as e:
            logger.warning(f"Turnstile verification error: {e}")
    if not ok and recaptcha_token:
        try:
            ok = await verify_recaptcha(recaptcha_token, remote_ip=remote_ip)
        except Exception as e:
            logger.warning(f"reCAPTCHA verification error: {e}")
    if not ok:
        raise HTTPException(status_code=400, detail="Bot verification failed")


@router.post("/send-sms")
async def send_sms(request: SendSMSRequest, http_req: Request):
    """
    SMS 인증번호 발송

    - **phone**: 수신자 전화번호 (예: 010-1234-5678 또는 01012345678)
    """
    # Bot protection
    await _verify_bot_protection(http_req, request.turnstile_token, request.recaptcha_token)

    result = send_verification_sms(request.phone)

    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["message"])

    return result


@router.post("/verify-sms")
async def verify_sms(request: VerifySMSRequest, http_req: Request):
    """
    SMS 인증번호 확인

    - **phone**: 전화번호
    - **code**: 6자리 인증번호
    """
    # Bot protection
    await _verify_bot_protection(http_req, request.turnstile_token, request.recaptcha_token)

    result = verify_sms_code(request.phone, request.code)

    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["message"])

    return result
