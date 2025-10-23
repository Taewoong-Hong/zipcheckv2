"""Address extraction and validation from contract text."""
import re
import logging
from typing import Optional

logger = logging.getLogger(__name__)


class AddressExtractionResult:
    """Result of address extraction."""

    def __init__(
        self,
        found: bool,
        address: Optional[str] = None,
        confidence: float = 0.0,
        method: str = "regex",
    ):
        self.found = found
        self.address = address
        self.confidence = confidence
        self.method = method

    def __repr__(self):
        return (
            f"AddressExtractionResult(found={self.found}, "
            f"address='{self.address}', "
            f"confidence={self.confidence:.2f})"
        )


def extract_address_from_text(text: str) -> AddressExtractionResult:
    """
    Extract Korean address from text using regex patterns.

    Patterns supported:
    - 도로명주소: 서울특별시 강남구 테헤란로 123
    - 지번주소: 서울시 강남구 삼성동 123-45
    - 경기도 주소: 경기도 파주시 하우고개길 356
    - 약식: 서울 강남구 역삼동 123

    Args:
        text: Text to extract address from

    Returns:
        AddressExtractionResult with extracted address
    """
    logger.info("Extracting address from text...")

    # Korean address patterns
    patterns = [
        # Pattern 1: 도로명주소 (가장 구체적)
        r"((?:서울특별시|서울|부산광역시|부산|대구광역시|대구|인천광역시|인천|광주광역시|광주|대전광역시|대전|울산광역시|울산|세종특별자치시|세종|경기도|강원도|충청북도|충청남도|전라북도|전라남도|경상북도|경상남도|제주특별자치도|제주)\s*[가-힣]+(?:시|군|구)\s*[가-힣\d\-]+(?:로|길)\s*\d+(?:\-\d+)?(?:\s*\([가-힣\d\-]+\))?)",

        # Pattern 2: 지번주소
        r"((?:서울특별시|서울|부산광역시|부산|대구광역시|대구|인천광역시|인천|광주광역시|광주|대전광역시|대전|울산광역시|울산|세종특별자치시|세종|경기도|강원도|충청북도|충청남도|전라북도|전라남도|경상북도|경상남도|제주특별자치도|제주)\s*[가-힣]+(?:시|군|구)\s*[가-힣]+동\s*\d+(?:\-\d+)?)",

        # Pattern 3: 간단한 형식
        r"((?:서울|부산|대구|인천|광주|대전|울산|세종|경기도|강원도|충청북도|충청남도|전라북도|전라남도|경상북도|경상남도|제주)\s*[가-힣]+(?:시|군|구)\s*[가-힣\d\-\s]+)",
    ]

    best_match = None
    best_confidence = 0.0

    for i, pattern in enumerate(patterns):
        matches = re.findall(pattern, text)

        if matches:
            # Take the first match
            address = matches[0].strip()

            # Calculate confidence based on pattern complexity
            confidence = 0.9 - (i * 0.2)  # Pattern 1: 0.9, Pattern 2: 0.7, Pattern 3: 0.5

            # Boost confidence if address contains specific keywords
            if "로" in address or "길" in address:
                confidence += 0.1
            if re.search(r"\d+동", address):  # Has building number
                confidence += 0.05
            if "(" in address:  # Has detail in parentheses
                confidence += 0.05

            confidence = min(confidence, 1.0)

            if confidence > best_confidence:
                best_match = address
                best_confidence = confidence

            logger.info(f"Found address with pattern {i+1}: {address} (confidence: {confidence:.2f})")

    if best_match:
        return AddressExtractionResult(
            found=True,
            address=best_match,
            confidence=best_confidence,
            method="regex",
        )
    else:
        logger.warning("No address found in text")
        return AddressExtractionResult(found=False)


def normalize_address(address: str) -> str:
    """
    Normalize address format.

    Args:
        address: Raw address string

    Returns:
        Normalized address string
    """
    # Remove extra whitespace
    normalized = " ".join(address.split())

    # Standardize city names
    replacements = {
        "서울특별시": "서울시",
        "부산광역시": "부산시",
        "대구광역시": "대구시",
        "인천광역시": "인천시",
        "광주광역시": "광주시",
        "대전광역시": "대전시",
        "울산광역시": "울산시",
        "세종특별자치시": "세종시",
        "제주특별자치도": "제주도",
    }

    for old, new in replacements.items():
        normalized = normalized.replace(old, new)

    return normalized


def format_address_for_confirmation(address: str) -> str:
    """
    Format address for user confirmation message.

    Args:
        address: Extracted address

    Returns:
        Formatted confirmation message
    """
    normalized = normalize_address(address)
    return f"분석하실 주소지가 '{normalized}' 가 맞으신가요?"


def validate_user_input_address(user_address: str) -> tuple[bool, str]:
    """
    Validate user-provided address.

    Args:
        user_address: Address string provided by user

    Returns:
        Tuple of (is_valid, normalized_address or error_message)
    """
    if not user_address or len(user_address.strip()) < 10:
        return False, "주소가 너무 짧습니다. 최소 10자 이상 입력해주세요."

    # Check if contains Korean characters
    if not re.search(r"[가-힣]", user_address):
        return False, "한글 주소를 입력해주세요."

    # Check if contains city/province
    cities = ["서울", "부산", "대구", "인천", "광주", "대전", "울산", "세종", "경기", "강원", "충청", "전라", "경상", "제주"]
    if not any(city in user_address for city in cities):
        return False, "시/도 정보가 포함된 주소를 입력해주세요. (예: 서울시, 경기도 등)"

    # Normalize and return
    normalized = normalize_address(user_address)
    return True, normalized
