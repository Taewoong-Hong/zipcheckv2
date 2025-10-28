"""
케이스 관리 API

분석 케이스(v2_cases) 생성/조회/수정/삭제를 담당합니다.
"""
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from core.supabase_client import get_supabase_client
from core.auth import get_current_user

router = APIRouter(prefix="/case", tags=["case"])


# ===========================
# Request/Response Models
# ===========================
class CreateCaseRequest(BaseModel):
    """케이스 생성 요청"""
    property_address: str
    contract_type: str  # "매매" | "전세" | "월세"
    metadata: Optional[dict] = None


class UpdateCaseRequest(BaseModel):
    """케이스 업데이트 요청"""
    property_address: Optional[str] = None
    contract_type: Optional[str] = None
    current_state: Optional[str] = None
    metadata: Optional[dict] = None


class CaseResponse(BaseModel):
    """케이스 응답"""
    id: str
    user_id: str
    property_address: str
    contract_type: str
    current_state: str
    metadata: Optional[dict]
    created_at: str
    updated_at: str


# ===========================
# API Endpoints
# ===========================
@router.post("", response_model=CaseResponse)
async def create_case(
    request: CreateCaseRequest,
    user: dict = Depends(get_current_user)
):
    """
    새 분석 케이스 생성

    - user_id: 현재 로그인한 사용자
    - current_state: "address" (초기 상태)
    - metadata: 추가 정보 (선택)
    """
    supabase = get_supabase_client()

    # v2_cases 테이블에 삽입
    response = supabase.table("v2_cases").insert({
        "user_id": user["id"],
        "property_address": request.property_address,
        "contract_type": request.contract_type,
        "current_state": "address",  # 초기 상태
        "metadata": request.metadata or {},
    }).execute()

    if not response.data:
        raise HTTPException(500, "Failed to create case")

    case = response.data[0]
    return CaseResponse(**case)


@router.get("/{case_id}", response_model=CaseResponse)
async def get_case(
    case_id: str,
    user: dict = Depends(get_current_user)
):
    """
    케이스 조회

    - 본인 케이스만 조회 가능 (RLS 적용)
    """
    supabase = get_supabase_client()

    response = supabase.table("v2_cases") \
        .select("*") \
        .eq("id", case_id) \
        .eq("user_id", user["id"]) \
        .execute()

    if not response.data:
        raise HTTPException(404, "Case not found")

    case = response.data[0]
    return CaseResponse(**case)


@router.patch("/{case_id}", response_model=CaseResponse)
async def update_case(
    case_id: str,
    request: UpdateCaseRequest,
    user: dict = Depends(get_current_user)
):
    """
    케이스 업데이트

    - current_state: 상태 전환 (address → contract → registry → analysis → report)
    - metadata: 추가 정보 업데이트
    """
    supabase = get_supabase_client()

    # 업데이트할 필드 구성
    update_data = {}
    if request.property_address is not None:
        update_data["property_address"] = request.property_address
    if request.contract_type is not None:
        update_data["contract_type"] = request.contract_type
    if request.current_state is not None:
        update_data["current_state"] = request.current_state
    if request.metadata is not None:
        update_data["metadata"] = request.metadata

    if not update_data:
        raise HTTPException(400, "No fields to update")

    update_data["updated_at"] = datetime.utcnow().isoformat()

    response = supabase.table("v2_cases") \
        .update(update_data) \
        .eq("id", case_id) \
        .eq("user_id", user["id"]) \
        .execute()

    if not response.data:
        raise HTTPException(404, "Case not found or update failed")

    case = response.data[0]
    return CaseResponse(**case)


@router.delete("/{case_id}")
async def delete_case(
    case_id: str,
    user: dict = Depends(get_current_user)
):
    """
    케이스 삭제

    - 관련 artifacts, reports도 CASCADE 삭제됨 (FK 설정 필요)
    """
    supabase = get_supabase_client()

    response = supabase.table("v2_cases") \
        .delete() \
        .eq("id", case_id) \
        .eq("user_id", user["id"]) \
        .execute()

    if not response.data:
        raise HTTPException(404, "Case not found")

    return {"ok": True, "deleted_case_id": case_id}


@router.get("", response_model=list[CaseResponse])
async def list_cases(
    user: dict = Depends(get_current_user),
    limit: int = 20,
    offset: int = 0
):
    """
    사용자의 케이스 목록 조회

    - 최근 생성순 정렬
    - 페이지네이션 지원
    """
    supabase = get_supabase_client()

    response = supabase.table("v2_cases") \
        .select("*") \
        .eq("user_id", user["id"]) \
        .order("created_at", desc=True) \
        .range(offset, offset + limit - 1) \
        .execute()

    cases = response.data or []
    return [CaseResponse(**case) for case in cases]
