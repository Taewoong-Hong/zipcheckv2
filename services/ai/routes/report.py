"""
리포트 API

분석 결과 리포트 조회 및 다운로드
"""
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from typing import Optional, Dict, Any
from core.supabase_client import get_supabase_client
from core.auth import get_current_user
from core.report_generator import generate_markdown_report

router = APIRouter(prefix="/reports", tags=["report"])
router_single = APIRouter(prefix="/report", tags=["report"])


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
    request: Request
):
    """
    케이스 리포트 조회 (마크다운 형식)

    - 본인 케이스만 조회 가능 (토큰에서 user_id 추출)
    - 분석 완료된 케이스만 리포트 존재
    - 노션 스타일 마크다운으로 반환
    """
    import logging
    logger = logging.getLogger(__name__)

    logger.info(f"🔍 [GET /reports/{case_id}] Request received")

    # Authorization 헤더에서 토큰 추출
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        logger.error(f"❌ [GET /reports/{case_id}] Missing or invalid Authorization header")
        raise HTTPException(401, "Missing or invalid Authorization header")

    token = auth_header.replace("Bearer ", "")
    logger.info(f"✅ [GET /reports/{case_id}] Authorization header present")

    # service_role로 직접 사용자 정보 조회 (RLS 우회)
    supabase = get_supabase_client(service_role=True)

    # Supabase Auth API로 토큰에서 user_id 추출
    import httpx
    async with httpx.AsyncClient() as client:
        logger.info(f"🔐 [GET /reports/{case_id}] Validating token with Supabase Auth API")
        auth_response = await client.get(
            f"{supabase.supabase_url}/auth/v1/user",
            headers={
                "Authorization": f"Bearer {token}",
                "apikey": supabase.supabase_key
            },
            timeout=5.0
        )

        if not auth_response.is_success:
            logger.error(f"❌ [GET /reports/{case_id}] Token validation failed: {auth_response.status_code}")
            raise HTTPException(401, "Invalid or expired token")

        user_data = auth_response.json()
        user_id = user_data.get("id")

        if not user_id:
            logger.error(f"❌ [GET /reports/{case_id}] Token missing user ID")
            raise HTTPException(401, "Invalid token: missing user ID")

        logger.info(f"✅ [GET /reports/{case_id}] Token validated, user_id={user_id}")

    # 케이스 조회 (contract_type, metadata 포함)
    logger.info(f"📋 [GET /reports/{case_id}] Querying v2_cases table")
    case_response = supabase.table("v2_cases") \
        .select("id, user_id, current_state, contract_type, property_address, metadata") \
        .eq("id", case_id) \
        .eq("user_id", user_id) \
        .execute()

    if not case_response.data:
        logger.error(f"❌ [GET /reports/{case_id}] Case not found in v2_cases (user_id={user_id})")
        raise HTTPException(404, "Case not found")

    case = case_response.data[0]
    logger.info(f"✅ [GET /reports/{case_id}] Case found, current_state={case['current_state']}")

    # 분석 완료 여부 확인
    if case["current_state"] not in ["report"]:
        logger.warning(f"⚠️ [GET /reports/{case_id}] Report not available, current_state={case['current_state']}")
        raise HTTPException(400, f"Report not available. Current state: {case['current_state']}")

    # 리포트 조회
    logger.info(f"📄 [GET /reports/{case_id}] Querying v2_reports table")
    report_response = supabase.table("v2_reports") \
        .select("*") \
        .eq("case_id", case_id) \
        .execute()

    if not report_response.data:
        logger.error(f"❌ [GET /reports/{case_id}] Report not found in v2_reports table (case_id={case_id})")
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


# Guide compatibility: GET /report/:case_id
@router_single.get("/{case_id}")
async def get_report_single(
    case_id: str,
    request: Request
):
    return await get_report(case_id, request)


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
        .eq("user_id", user["sub"]) \
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
        .eq("user_id", user["sub"]) \
        .execute()

    if not report_response.data:
        raise HTTPException(404, "Report not found")

    # 삭제
    supabase.table("v2_reports") \
        .delete() \
        .eq("case_id", case_id) \
        .eq("user_id", user["sub"]) \
        .execute()

    return {"ok": True, "deleted_case_id": case_id}
