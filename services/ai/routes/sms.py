"""
SMS 인증 API 라우터
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from core.sms import send_verification_sms, verify_sms_code

router = APIRouter(prefix="/auth", tags=["SMS 인증"])


class SendSMSRequest(BaseModel):
    phone: str  # 010-1234-5678 또는 01012345678


class VerifySMSRequest(BaseModel):
    phone: str
    code: str  # 6자리 인증번호


@router.post("/send-sms")
async def send_sms(request: SendSMSRequest):
    """
    SMS 인증번호 발송

    - **phone**: 수신자 전화번호 (예: 010-1234-5678 또는 01012345678)
    """
    result = send_verification_sms(request.phone)

    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["message"])

    return result


@router.post("/verify-sms")
async def verify_sms(request: VerifySMSRequest):
    """
    SMS 인증번호 확인

    - **phone**: 전화번호
    - **code**: 6자리 인증번호
    """
    result = verify_sms_code(request.phone, request.code)

    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["message"])

    return result
