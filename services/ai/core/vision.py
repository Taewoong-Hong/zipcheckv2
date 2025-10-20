"""GPT-4o Vision API for scanned PDF processing with Structured Outputs."""
import base64
import logging
from pathlib import Path
from typing import Any, Dict, List

from pydantic import BaseModel, Field
from langchain_core.messages import HumanMessage
from langchain_openai import ChatOpenAI

from .settings import settings

logger = logging.getLogger(__name__)


# Structured Output Schema for Real Estate Contract
class ContractParty(BaseModel):
    """계약 당사자 정보."""
    role: str = Field(description="역할: 임대인, 임차인, 중개인 등")
    name: str = Field(description="이름 또는 상호")
    resident_number: str | None = Field(default=None, description="주민등록번호 (앞자리)")
    phone: str | None = Field(default=None, description="전화번호")
    address: str | None = Field(default=None, description="주소")


class PropertyInfo(BaseModel):
    """부동산 물건 정보."""
    address: str = Field(description="부동산 소재지 주소")
    property_type: str = Field(description="물건 종류: 아파트, 오피스텔, 단독주택 등")
    area_m2: float | None = Field(default=None, description="면적(제곱미터)")
    area_pyeong: float | None = Field(default=None, description="면적(평)")


class ContractTerms(BaseModel):
    """계약 조건."""
    contract_type: str = Field(description="계약 유형: 매매, 전세, 월세 등")
    deposit: int | None = Field(default=None, description="보증금(원)")
    monthly_rent: int | None = Field(default=None, description="월세(원)")
    sale_price: int | None = Field(default=None, description="매매가(원)")
    contract_start_date: str | None = Field(default=None, description="계약 시작일 (YYYY-MM-DD)")
    contract_end_date: str | None = Field(default=None, description="계약 종료일 (YYYY-MM-DD)")
    move_in_date: str | None = Field(default=None, description="입주일 (YYYY-MM-DD)")


class SpecialProvisions(BaseModel):
    """특약 사항."""
    provision: str = Field(description="특약 내용")


class RealEstateContract(BaseModel):
    """부동산 계약서 구조화 스키마."""
    document_title: str = Field(description="문서 제목")
    parties: List[ContractParty] = Field(description="계약 당사자 목록")
    property: PropertyInfo = Field(description="부동산 물건 정보")
    terms: ContractTerms = Field(description="계약 조건")
    special_provisions: List[SpecialProvisions] = Field(
        default_factory=list,
        description="특약 사항 목록"
    )
    contract_date: str | None = Field(default=None, description="계약 체결일 (YYYY-MM-DD)")
    original_text: str | None = Field(default=None, description="원본 텍스트 (필요시)")


def encode_image_to_base64(image_path: str) -> str:
    """
    이미지 파일을 base64로 인코딩합니다.

    Args:
        image_path: 이미지 파일 경로

    Returns:
        base64 인코딩된 문자열
    """
    with open(image_path, "rb") as f:
        return base64.b64encode(f.read()).decode("utf-8")


def extract_contract_with_vision(
    image_path: str,
    detail: str | None = None,
) -> Dict[str, Any]:
    """
    GPT-4o Vision API로 스캔된 계약서를 구조화된 JSON으로 추출합니다.

    Args:
        image_path: 계약서 이미지 파일 경로 (PDF → PNG 변환 필요)
        detail: Vision API detail level ("low", "high", "auto")

    Returns:
        구조화된 계약서 데이터 (RealEstateContract 스키마)

    Raises:
        FileNotFoundError: 이미지 파일을 찾을 수 없음
        ValueError: Vision API 처리 실패

    Example:
        >>> result = extract_contract_with_vision("contract_page1.png")
        >>> print(result["property"]["address"])
        >>> print(result["terms"]["deposit"])
    """
    if not Path(image_path).exists():
        raise FileNotFoundError(f"이미지 파일을 찾을 수 없음: {image_path}")

    detail = detail or settings.vision_detail
    logger.info(f"Vision API 호출: {image_path}, detail={detail}")

    # 이미지를 base64로 인코딩
    base64_image = encode_image_to_base64(image_path)

    # GPT-4o Vision LLM 생성 (Structured Outputs 지원)
    llm = ChatOpenAI(
        model=settings.openai_vision_model,
        temperature=0.0,  # 정확한 추출을 위해 0으로 설정
        max_tokens=settings.vision_max_tokens,
        api_key=settings.openai_api_key,
    )

    # Structured Outputs 활성화
    structured_llm = llm.with_structured_output(RealEstateContract)

    # Vision API 메시지 구성
    message = HumanMessage(
        content=[
            {
                "type": "text",
                "text": """다음은 부동산 계약서 이미지입니다.
계약서에서 모든 정보를 정확하게 추출하여 구조화된 JSON으로 반환하세요.

주의사항:
- 모든 날짜는 YYYY-MM-DD 형식으로 변환하세요
- 금액은 숫자만 입력하세요 (쉼표 제외, 예: 50000000)
- 확실하지 않은 정보는 null로 표시하세요
- 특약 사항은 모두 추출하세요
""",
            },
            {
                "type": "image_url",
                "image_url": {
                    "url": f"data:image/png;base64,{base64_image}",
                    "detail": detail,
                },
            },
        ]
    )

    try:
        # Structured Outputs로 응답 받기
        result = structured_llm.invoke([message])

        logger.info(f"Vision API 성공: {image_path}")
        return result.model_dump()

    except Exception as e:
        logger.error(f"Vision API 실패: {e}")
        raise ValueError(f"Vision API 처리 실패: {str(e)}")


def extract_contract_from_pdf_images(
    image_paths: List[str],
    combine: bool = True,
) -> Dict[str, Any] | List[Dict[str, Any]]:
    """
    여러 페이지의 계약서 이미지를 처리합니다.

    Args:
        image_paths: 계약서 이미지 파일 경로 목록 (페이지 순서대로)
        combine: True면 모든 페이지 정보를 하나로 병합, False면 페이지별 반환

    Returns:
        combine=True: 병합된 계약서 데이터
        combine=False: 페이지별 계약서 데이터 목록

    Example:
        >>> images = ["page1.png", "page2.png"]
        >>> result = extract_contract_from_pdf_images(images)
        >>> print(result["parties"])
    """
    results = []

    for i, image_path in enumerate(image_paths, 1):
        logger.info(f"페이지 {i}/{len(image_paths)} 처리 중: {image_path}")
        try:
            result = extract_contract_with_vision(image_path)
            results.append(result)
        except Exception as e:
            logger.warning(f"페이지 {i} 처리 실패: {e}")
            continue

    if not results:
        raise ValueError("모든 페이지 처리 실패")

    if not combine:
        return results

    # 여러 페이지 정보를 하나로 병합
    # 첫 페이지를 기준으로 하고 나머지 페이지의 특약/당사자 정보 추가
    merged = results[0]

    for page_data in results[1:]:
        # 특약 사항 병합
        merged["special_provisions"].extend(page_data.get("special_provisions", []))

        # 당사자 정보 병합 (중복 제거)
        existing_parties = {p["name"] for p in merged["parties"]}
        for party in page_data.get("parties", []):
            if party["name"] not in existing_parties:
                merged["parties"].append(party)

    logger.info(f"총 {len(results)}개 페이지 병합 완료")
    return merged


def classify_document_type(image_path: str) -> str:
    """
    GPT-4o-mini로 문서 유형을 빠르게 분류합니다.

    Args:
        image_path: 문서 이미지 파일 경로

    Returns:
        문서 유형: "real_estate_contract", "lease_contract", "sales_contract",
                  "unknown", etc.

    Example:
        >>> doc_type = classify_document_type("doc.png")
        >>> if doc_type == "real_estate_contract":
        >>>     result = extract_contract_with_vision("doc.png")
    """
    if not Path(image_path).exists():
        raise FileNotFoundError(f"이미지 파일을 찾을 수 없음: {image_path}")

    base64_image = encode_image_to_base64(image_path)

    # GPT-4o-mini로 빠른 분류
    llm = ChatOpenAI(
        model=settings.openai_classification_model,
        temperature=0.0,
        max_tokens=50,
        api_key=settings.openai_api_key,
    )

    message = HumanMessage(
        content=[
            {
                "type": "text",
                "text": """다음 문서의 유형을 분류하세요.
응답은 다음 중 하나만 반환하세요:
- real_estate_contract (부동산 매매계약서)
- lease_contract (임대차계약서)
- sales_contract (일반 매매계약서)
- unknown (알 수 없음)
""",
            },
            {
                "type": "image_url",
                "image_url": {
                    "url": f"data:image/png;base64,{base64_image}",
                    "detail": "low",  # 분류는 저해상도로 충분
                },
            },
        ]
    )

    try:
        response = llm.invoke([message])
        doc_type = response.content.strip().lower()
        logger.info(f"문서 분류: {image_path} → {doc_type}")
        return doc_type
    except Exception as e:
        logger.error(f"문서 분류 실패: {e}")
        return "unknown"
