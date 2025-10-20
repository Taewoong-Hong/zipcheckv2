"""파일 검증 및 보안 체크."""
import logging
import re
from pathlib import Path
from typing import Tuple

logger = logging.getLogger(__name__)

# 파일 검증 설정
MAX_FILE_SIZE_MB = 50
ALLOWED_MIME_TYPES = ["application/pdf"]
ALLOWED_EXTENSIONS = [".pdf"]

# 위험한 파일명 패턴
DANGEROUS_PATTERNS = [
    r"\.\.",  # Path traversal
    r"[<>:\"|?*]",  # Windows 금지 문자
    r"^\.",  # 숨김 파일
]


class FileValidationError(Exception):
    """파일 검증 실패 예외."""
    pass


def sanitize_filename(filename: str) -> str:
    """
    파일명 새니타이제이션.

    Args:
        filename: 원본 파일명

    Returns:
        안전한 파일명

    Example:
        >>> sanitize_filename("../../etc/passwd.pdf")
        'etc_passwd.pdf'
    """
    # Path traversal 제거
    filename = filename.replace("..", "")

    # 디렉토리 구분자 제거
    filename = filename.replace("/", "_").replace("\\", "_")

    # 위험한 문자 제거
    filename = re.sub(r'[<>:"|?*]', "", filename)

    # 공백을 언더스코어로
    filename = filename.replace(" ", "_")

    # 연속된 언더스코어 제거
    filename = re.sub(r"_+", "_", filename)

    # 앞뒤 언더스코어/점 제거
    filename = filename.strip("_.")

    return filename


def validate_file_size(file_size: int, max_size_mb: int = MAX_FILE_SIZE_MB) -> None:
    """
    파일 크기 검증.

    Args:
        file_size: 파일 크기 (bytes)
        max_size_mb: 최대 크기 (MB)

    Raises:
        FileValidationError: 파일 크기 초과 시
    """
    max_size_bytes = max_size_mb * 1024 * 1024

    if file_size > max_size_bytes:
        size_mb = file_size / (1024 * 1024)
        raise FileValidationError(
            f"파일 크기가 너무 큽니다: {size_mb:.2f}MB "
            f"(최대: {max_size_mb}MB)"
        )

    logger.debug(f"파일 크기 검증 통과: {file_size / (1024 * 1024):.2f}MB")


def validate_file_extension(filename: str) -> None:
    """
    파일 확장자 검증.

    Args:
        filename: 파일명

    Raises:
        FileValidationError: 허용되지 않은 확장자
    """
    file_ext = Path(filename).suffix.lower()

    if file_ext not in ALLOWED_EXTENSIONS:
        raise FileValidationError(
            f"허용되지 않은 파일 형식입니다: {file_ext}. "
            f"허용 형식: {', '.join(ALLOWED_EXTENSIONS)}"
        )

    logger.debug(f"파일 확장자 검증 통과: {file_ext}")


def validate_mime_type(mime_type: str) -> None:
    """
    MIME 타입 검증.

    Args:
        mime_type: MIME 타입

    Raises:
        FileValidationError: 허용되지 않은 MIME 타입
    """
    if mime_type not in ALLOWED_MIME_TYPES:
        raise FileValidationError(
            f"허용되지 않은 MIME 타입입니다: {mime_type}. "
            f"허용 타입: {', '.join(ALLOWED_MIME_TYPES)}"
        )

    logger.debug(f"MIME 타입 검증 통과: {mime_type}")


def check_dangerous_filename(filename: str) -> None:
    """
    위험한 파일명 패턴 체크.

    Args:
        filename: 파일명

    Raises:
        FileValidationError: 위험한 패턴 발견 시
    """
    for pattern in DANGEROUS_PATTERNS:
        if re.search(pattern, filename):
            raise FileValidationError(
                f"파일명에 위험한 패턴이 포함되어 있습니다: {filename}"
            )

    logger.debug(f"파일명 보안 검증 통과: {filename}")


def validate_pdf_file(
    filename: str,
    file_size: int,
    mime_type: str | None = None,
) -> Tuple[str, bool]:
    """
    PDF 파일 전체 검증.

    Args:
        filename: 파일명
        file_size: 파일 크기 (bytes)
        mime_type: MIME 타입 (선택)

    Returns:
        (safe_filename, is_valid) 튜플

    Raises:
        FileValidationError: 검증 실패 시

    Example:
        >>> safe_name, is_valid = validate_pdf_file("contract.pdf", 1024000)
        >>> print(safe_name)
        'contract.pdf'
    """
    logger.info(f"PDF 파일 검증 시작: {filename}")

    # 1. 파일명 위험 패턴 체크
    check_dangerous_filename(filename)

    # 2. 파일 확장자 검증
    validate_file_extension(filename)

    # 3. 파일 크기 검증
    validate_file_size(file_size)

    # 4. MIME 타입 검증 (제공된 경우)
    if mime_type:
        validate_mime_type(mime_type)

    # 5. 파일명 새니타이제이션
    safe_filename = sanitize_filename(filename)

    logger.info(
        f"PDF 파일 검증 완료: {filename} → {safe_filename} "
        f"({file_size / 1024:.2f}KB)"
    )

    return safe_filename, True


def validate_contract_id(contract_id: str) -> None:
    """
    계약서 ID 검증.

    Args:
        contract_id: 계약서 ID

    Raises:
        FileValidationError: 유효하지 않은 ID

    Rules:
        - 1-100자
        - 영문, 숫자, 언더스코어, 하이픈만 허용
        - 공백, 특수문자 불가
    """
    if not contract_id:
        raise FileValidationError("계약서 ID가 비어있습니다")

    if len(contract_id) > 100:
        raise FileValidationError(
            f"계약서 ID가 너무 깁니다: {len(contract_id)}자 (최대: 100자)"
        )

    # 영문, 숫자, 언더스코어, 하이픈만 허용
    if not re.match(r'^[a-zA-Z0-9_-]+$', contract_id):
        raise FileValidationError(
            "계약서 ID는 영문, 숫자, 언더스코어(_), 하이픈(-)만 사용 가능합니다"
        )

    logger.debug(f"계약서 ID 검증 통과: {contract_id}")


def validate_address(addr: str | None) -> str | None:
    """
    주소 검증 및 새니타이제이션.

    Args:
        addr: 주소 (선택)

    Returns:
        검증된 주소 또는 None
    """
    if not addr:
        return None

    # 앞뒤 공백 제거
    addr = addr.strip()

    # 최대 길이 체크 (200자)
    if len(addr) > 200:
        logger.warning(f"주소가 너무 김: {len(addr)}자, 200자로 자름")
        addr = addr[:200]

    return addr
