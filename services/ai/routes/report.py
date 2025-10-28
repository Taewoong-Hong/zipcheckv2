"""
리포트 API

분석 결과 리포트 조회 및 다운로드
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional, Dict, Any
from core.supabase_client import get_supabase_client
from core.auth import get_current_user
from core.report_generator import generate_markdown_report

router = APIRouter(prefix="/reports", tags=["report"])


# ===========================
# Response Models
# ===========================
class ReportResponse(BaseModel):
    """리포트 응답"""
    id: str
    case_id: str
    user_id: str
    content: str
    risk_score: Dict[str, Any]
    metadata: Optional[Dict[str, Any]] = None
    created_at: str


# ===========================
# API Endpoints
# ===========================
@router.get("/{case_id}")
async def get_report(
    case_id: str,
    user: dict = Depends(get_current_user)
):
    """
    케이스 리포트 조회 (마크다운 형식)

    - 본인 케이스만 조회 가능
    - 분석 완료된 케이스만 리포트 존재
    - 노션 스타일 마크다운으로 반환
    """
    supabase = get_supabase_client()

    # 케이스 조회 (contract_type, metadata 포함)
    case_response = supabase.table("v2_cases") \
        .select("id, user_id, current_state, contract_type, property_address, metadata") \
        .eq("id", case_id) \
        .eq("user_id", user["id"]) \
        .execute()

    if not case_response.data:
        raise HTTPException(404, "Case not found")

    case = case_response.data[0]

    # 분석 완료 여부 확인
    if case["current_state"] not in ["report", "completed"]:
        raise HTTPException(400, f"Report not available. Current state: {case['current_state']}")

    # 리포트 조회
    report_response = supabase.table("v2_reports") \
        .select("*") \
        .eq("case_id", case_id) \
        .execute()

    if not report_response.data:
        raise HTTPException(404, "Report not found")

    report = report_response.data[0]

    # 메타데이터에서 가격 정보 추출
    metadata = case.get("metadata") or {}
    deposit = metadata.get("deposit") or metadata.get("price")
    monthly_rent = metadata.get("monthlyRent")

    # 마크다운 리포트 생성
    markdown_content = generate_markdown_report(
        contract_type=case.get("contract_type", "전세"),
        address=case.get("property_address", "주소 정보 없음"),
        deposit=deposit,
        monthly_rent=monthly_rent,
        risk_score=report.get("risk_score", {}),
        negotiation_points=report.get("risk_score", {}).get("negotiation_points", []),
        recommendations=report.get("risk_score", {}).get("recommendations", []),
        registry_data=report.get("registry_data"),
        market_data=report.get("market_data"),
    )

    # 응답 데이터
    return {
        "content": markdown_content,
        "contract_type": case.get("contract_type"),
        "address": case.get("property_address"),
        "risk_score": report.get("risk_score"),
        "created_at": report.get("created_at"),
    }


@router.get("", response_model=list[ReportResponse])
async def list_reports(
    user: dict = Depends(get_current_user),
    limit: int = 20,
    offset: int = 0
):
    """
    사용자 리포트 목록 조회

    - 최근 생성순 정렬
    - 페이지네이션 지원
    """
    supabase = get_supabase_client()

    response = supabase.table("v2_reports") \
        .select("*") \
        .eq("user_id", user["id"]) \
        .order("created_at", desc=True) \
        .range(offset, offset + limit - 1) \
        .execute()

    reports = response.data or []
    return [ReportResponse(**report) for report in reports]


@router.delete("/{case_id}")
async def delete_report(
    case_id: str,
    user: dict = Depends(get_current_user)
):
    """
    리포트 삭제

    - 본인 리포트만 삭제 가능
    - 케이스는 삭제되지 않음 (리포트만 삭제)
    """
    supabase = get_supabase_client()

    # 리포트 조회 및 소유 확인
    report_response = supabase.table("v2_reports") \
        .select("id, user_id") \
        .eq("case_id", case_id) \
        .eq("user_id", user["id"]) \
        .execute()

    if not report_response.data:
        raise HTTPException(404, "Report not found")

    # 삭제
    supabase.table("v2_reports") \
        .delete() \
        .eq("case_id", case_id) \
        .eq("user_id", user["id"]) \
        .execute()

    return {"ok": True, "deleted_case_id": case_id}
