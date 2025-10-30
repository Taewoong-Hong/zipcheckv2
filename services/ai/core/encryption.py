"""
고객 데이터 암호화/복호화 유틸리티
AES-256-GCM 알고리즘 사용
"""

import os
import logging
from typing import Any, Dict, List, Optional
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC  # ✅ 올바른 import
import base64
from core.settings import settings

logger = logging.getLogger(__name__)

# 상수
NONCE_LENGTH = 12  # GCM 권장 nonce 길이
KEY_LENGTH = 32    # AES-256 키 길이


class EncryptionManager:
    """암호화/복호화 관리 클래스"""

    def __init__(self):
        """암호화 키 초기화"""
        self.key = self._get_encryption_key()
        self.aesgcm = AESGCM(self.key)

    def _get_encryption_key(self) -> bytes:
        """환경변수에서 암호화 키 가져오기 및 파생"""
        encryption_key = settings.encryption_key
        if not encryption_key:
            raise ValueError("ENCRYPTION_KEY environment variable is not set")

        # PBKDF2HMAC을 사용하여 키 파생 (32 bytes = 256 bits)
        kdf = PBKDF2HMAC(
            algorithm=hashes.SHA256(),
            length=KEY_LENGTH,
            salt=b"zipcheck_salt_v2",  # 프로덕션에서는 랜덤 salt 사용 권장
            iterations=100000,
        )
        return kdf.derive(encryption_key.encode())

    def encrypt(self, plaintext: str) -> str:
        """
        데이터 암호화

        Args:
            plaintext: 암호화할 평문

        Returns:
            암호화된 데이터 (base64 인코딩된 nonce:ciphertext)
        """
        if not plaintext:
            return ""

        try:
            # 랜덤 nonce 생성
            nonce = os.urandom(NONCE_LENGTH)

            # 암호화
            ciphertext = self.aesgcm.encrypt(nonce, plaintext.encode(), None)

            # nonce + ciphertext를 base64로 인코딩
            encrypted_data = nonce + ciphertext
            return base64.b64encode(encrypted_data).decode()

        except Exception as e:
            logger.error(f"Encryption error: {e}")
            raise ValueError("Failed to encrypt data")

    def decrypt(self, encrypted_data: str) -> str:
        """
        데이터 복호화

        Args:
            encrypted_data: 암호화된 데이터 (base64 인코딩)

        Returns:
            복호화된 평문
        """
        if not encrypted_data:
            return ""

        try:
            # base64 디코딩
            decoded_data = base64.b64decode(encrypted_data.encode())

            # nonce와 ciphertext 분리
            nonce = decoded_data[:NONCE_LENGTH]
            ciphertext = decoded_data[NONCE_LENGTH:]

            # 복호화
            plaintext = self.aesgcm.decrypt(nonce, ciphertext, None)
            return plaintext.decode()

        except Exception as e:
            logger.error(f"Decryption error: {e}")
            raise ValueError("Failed to decrypt data")

    def encrypt_fields(self, data: Dict[str, Any], fields: List[str]) -> Dict[str, Any]:
        """
        딕셔너리의 특정 필드들을 암호화

        Args:
            data: 원본 데이터
            fields: 암호화할 필드명 리스트

        Returns:
            암호화된 데이터
        """
        encrypted = data.copy()

        for field in fields:
            if field in encrypted and isinstance(encrypted[field], str):
                encrypted[field] = self.encrypt(encrypted[field])

        return encrypted

    def decrypt_fields(self, data: Dict[str, Any], fields: List[str]) -> Dict[str, Any]:
        """
        딕셔너리의 특정 필드들을 복호화

        Args:
            data: 암호화된 데이터
            fields: 복호화할 필드명 리스트

        Returns:
            복호화된 데이터
        """
        decrypted = data.copy()

        for field in fields:
            if field in decrypted and isinstance(decrypted[field], str):
                try:
                    decrypted[field] = self.decrypt(decrypted[field])
                except Exception as e:
                    logger.warning(f"Failed to decrypt field {field}: {e}")
                    # 복호화 실패 시 원본 유지 (마이그레이션 중일 수 있음)

        return decrypted

    def decrypt_list_fields(
        self, data_list: List[Dict[str, Any]], fields: List[str]
    ) -> List[Dict[str, Any]]:
        """
        리스트의 각 딕셔너리에서 특정 필드들을 복호화

        Args:
            data_list: 암호화된 데이터 리스트
            fields: 복호화할 필드명 리스트

        Returns:
            복호화된 데이터 리스트
        """
        return [self.decrypt_fields(item, fields) for item in data_list]


# 전역 인스턴스
_encryption_manager: Optional[EncryptionManager] = None


def get_encryption_manager() -> EncryptionManager:
    """암호화 매니저 싱글톤 인스턴스 반환"""
    global _encryption_manager
    if _encryption_manager is None:
        _encryption_manager = EncryptionManager()
    return _encryption_manager


# 편의 함수들
def encrypt(plaintext: str) -> str:
    """데이터 암호화"""
    return get_encryption_manager().encrypt(plaintext)


def decrypt(encrypted_data: str) -> str:
    """데이터 복호화"""
    return get_encryption_manager().decrypt(encrypted_data)


def encrypt_fields(data: Dict[str, Any], fields: List[str]) -> Dict[str, Any]:
    """딕셔너리 필드 암호화"""
    return get_encryption_manager().encrypt_fields(data, fields)


def decrypt_fields(data: Dict[str, Any], fields: List[str]) -> Dict[str, Any]:
    """딕셔너리 필드 복호화"""
    return get_encryption_manager().decrypt_fields(data, fields)


def decrypt_list_fields(
    data_list: List[Dict[str, Any]], fields: List[str]
) -> List[Dict[str, Any]]:
    """리스트 필드 복호화"""
    return get_encryption_manager().decrypt_list_fields(data_list, fields)


# 마스킹 함수들 (로그/디버깅용)
def mask_email(email: str) -> str:
    """이메일 마스킹"""
    if not email or "@" not in email:
        return email

    local_part, domain = email.split("@", 1)
    if len(local_part) <= 2:
        return f"{local_part[0]}***@{domain}"

    visible_chars = min(2, len(local_part) // 3)
    masked = local_part[:visible_chars] + "***"
    return f"{masked}@{domain}"


def mask_name(name: str) -> str:
    """이름 마스킹"""
    if not name or len(name) <= 1:
        return name

    if len(name) == 2:
        return f"{name[0]}*"

    first_char = name[0]
    last_char = name[-1]
    masked = "*" * (len(name) - 2)
    return f"{first_char}{masked}{last_char}"


def mask_phone(phone: str) -> str:
    """전화번호 마스킹"""
    if not phone:
        return phone

    cleaned = "".join(filter(str.isdigit, phone))

    if len(cleaned) == 11:
        return f"{cleaned[:3]}-****-{cleaned[7:]}"
    elif len(cleaned) == 10:
        return f"{cleaned[:3]}-***-{cleaned[6:]}"

    return phone
