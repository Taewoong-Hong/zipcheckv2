"""Pydantic models for address confirmation workflow."""
from pydantic import BaseModel, Field
from typing import Literal, Optional


class AddressConfirmationRequest(BaseModel):
    """주소 확인 요청 모델."""
    session_id: str = Field(..., description="세션 ID")
    confirmed: bool = Field(..., description="추출된 주소가 맞는지 여부")
    user_input_address: Optional[str] = Field(
        None,
        description="사용자가 직접 입력한 주소 (confirmed=False일 때 필요)"
    )


class AddressConfirmationResponse(BaseModel):
    """주소 확인 응답 모델."""
    status: Literal["confirmed", "need_input", "validated", "error"]
    message: str
    normalized_address: Optional[str] = None
    next_step: Optional[str] = None


class ContractUploadResponse(BaseModel):
    """계약서 업로드 응답 모델 (주소 추출 포함)."""
    ok: bool
    session_id: str
    extracted_address: Optional[str] = None
    address_confidence: float = 0.0
    confirmation_message: str
    next_step: Literal["confirm_address", "proceed", "manual_input"]


class PublicDataRequest(BaseModel):
    """공공데이터 조회 요청 모델."""
    session_id: str = Field(..., description="세션 ID")
    address: str = Field(..., description="확정된 주소")


class RealEstateAnalysisRequest(BaseModel):
    """최종 부동산 분석 요청 모델."""
    session_id: str = Field(..., description="세션 ID")
    contract_text: str = Field(..., description="계약서 텍스트")
    public_data: dict = Field(..., description="공공데이터 결과")
    analysis_type: Literal["sale", "rent"] = Field(..., description="분석 유형: 매매 or 임대차")
