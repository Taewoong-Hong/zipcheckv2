"""
SOLAPI SMS 인증 모듈
"""
import os
import random
import string
from typing import Dict, Optional
from datetime import datetime, timedelta
from solapi import SolapiMessageService
from solapi.model import RequestMessage

# 인증번호 저장소 (실제 프로덕션에서는 Redis 사용 권장)
verification_codes: Dict[str, Dict] = {}

# SOLAPI 클라이언트 초기화
def get_solapi_client():
    """SOLAPI 클라이언트 생성"""
    api_key = os.getenv("SOLAPI_API_KEY")
    api_secret = os.getenv("SOLAPI_API_SECRET")

    if not api_key or not api_secret:
        raise ValueError("SOLAPI_API_KEY and SOLAPI_API_SECRET must be set in environment variables")

    return SolapiMessageService(api_key=api_key, api_secret=api_secret)


def generate_verification_code(length: int = 6) -> str:
    """6자리 랜덤 인증번호 생성"""
    return ''.join(random.choices(string.digits, k=length))


def send_verification_sms(phone: str) -> Dict:
    """
    SMS 인증번호 발송

    Args:
        phone: 수신자 전화번호 (예: 01012345678)

    Returns:
        {"success": bool, "message": str, "expires_at": str}
    """
    try:
        # 전화번호 포맷 검증 (010으로 시작하는 11자리)
        phone = phone.replace("-", "").replace(" ", "")
        if not phone.startswith("010") or len(phone) != 11:
            return {"success": False, "message": "올바른 전화번호 형식이 아닙니다 (010-XXXX-XXXX)"}

        # 인증번호 생성
        code = generate_verification_code()

        # 만료 시간 (3분)
        expires_at = datetime.now() + timedelta(minutes=3)

        # 인증번호 저장
        verification_codes[phone] = {
            "code": code,
            "expires_at": expires_at,
            "attempts": 0  # 시도 횟수
        }

        # SOLAPI로 SMS 발송
        client = get_solapi_client()
        from_number = os.getenv("SOLAPI_FROM_NUMBER", "")  # 발신번호

        if not from_number:
            return {"success": False, "message": "발신번호가 설정되지 않았습니다"}

        text_message = f"[집체크] 인증번호는 [{code}]입니다. 3분 내에 입력해주세요."

        # RequestMessage 모델 생성
        message = RequestMessage(
            from_=from_number,
            to=phone,
            text=text_message
        )

        # 메시지 발송
        response = client.send(message)

        print(f"SMS 발송 성공: {phone} → 인증번호 {code}")

        return {
            "success": True,
            "message": "인증번호가 발송되었습니다",
            "expires_at": expires_at.isoformat()
        }

    except Exception as e:
        print(f"SMS 발송 실패: {str(e)}")
        return {"success": False, "message": f"SMS 발송 중 오류가 발생했습니다: {str(e)}"}


def verify_sms_code(phone: str, code: str) -> Dict:
    """
    SMS 인증번호 확인

    Args:
        phone: 전화번호
        code: 사용자가 입력한 인증번호

    Returns:
        {"success": bool, "message": str}
    """
    try:
        # 전화번호 포맷 정리
        phone = phone.replace("-", "").replace(" ", "")

        # 인증번호 존재 여부 확인
        if phone not in verification_codes:
            return {"success": False, "message": "인증번호를 먼저 요청해주세요"}

        stored = verification_codes[phone]

        # 만료 시간 확인
        if datetime.now() > stored["expires_at"]:
            del verification_codes[phone]
            return {"success": False, "message": "인증번호가 만료되었습니다. 다시 요청해주세요"}

        # 시도 횟수 확인 (5회 초과 시 차단)
        if stored["attempts"] >= 5:
            del verification_codes[phone]
            return {"success": False, "message": "인증 시도 횟수를 초과했습니다. 다시 요청해주세요"}

        # 인증번호 확인
        if stored["code"] == code:
            del verification_codes[phone]  # 인증 성공 시 삭제
            return {"success": True, "message": "인증이 완료되었습니다"}
        else:
            stored["attempts"] += 1
            remaining = 5 - stored["attempts"]
            return {
                "success": False,
                "message": f"인증번호가 일치하지 않습니다 (남은 시도: {remaining}회)"
            }

    except Exception as e:
        print(f"인증 확인 실패: {str(e)}")
        return {"success": False, "message": f"인증 확인 중 오류가 발생했습니다: {str(e)}"}
