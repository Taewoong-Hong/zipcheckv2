"""
등기부등본 자동 발급 API 라우터

RPA를 통한 등기부등본 자동 발급 및 크레딧 차감
"""

import logging
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, HTTPException, status, Depends, BackgroundTasks
from pydantic import BaseModel, Field

from core.auth import get_current_user
from core.settings import settings
from core.database import get_session_maker, get_user_credits, deduct_credits
from rpa.registry_rpa import issue_registry_pdf, RegistryRPAError

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/registry", tags=["registry"])


class IssueRegistryRequest(BaseModel):
    """등기부등본 발급 요청"""
    address: str = Field(..., min_length=5, max_length=200, description="부동산 주소")
    result_index: int = Field(default=0, ge=0, description="검색 결과 인덱스")


class IssueRegistryResponse(BaseModel):
    """등기부등본 발급 응답"""
    ok: bool
    pdf_path: Optional[str] = None
    message: str
    credits_remaining: int


@router.post("/issue", response_model=IssueRegistryResponse)
async def issue_registry(
    request: IssueRegistryRequest,
    background_tasks: BackgroundTasks,
    user: dict = Depends(get_current_user),
) -> IssueRegistryResponse:
    """
    등기부등본 자동 발급 (RPA)

    **필요 크레딧**: 10 크레딧

    **프로세스**:
    1. 사용자 크레딧 확인 (10 크레딧 이상 필요)
    2. RPA를 통한 인터넷등기소 자동 발급
    3. PDF 다운로드 및 저장
    4. 크레딧 차감
    5. Supabase Storage에 업로드

    Args:
        request: 발급 요청 (주소, 검색 결과 인덱스)
        background_tasks: 백그라운드 작업 (파일 정리 등)
        user: 인증된 사용자

    Returns:
        발급 결과 (PDF 경로, 남은 크레딧)

    Raises:
        HTTPException:
            - 401: 인증 실패
            - 402: 크레딧 부족
            - 500: 발급 실패
    """
    user_id = user["sub"]
    logger.info(f"등기부등본 발급 요청: user_id={user_id}, address={request.address}")

    # 필요 크레딧
    REQUIRED_CREDITS = 10

    # DB 세션 생성
    SessionLocal = get_session_maker()
    db_session = SessionLocal()

    try:
        # 1. 크레딧 확인
        current_credits = get_user_credits(db_session, user_id)

        if current_credits < REQUIRED_CREDITS:
            logger.warning(
                f"크레딧 부족: user_id={user_id}, "
                f"current={current_credits}, required={REQUIRED_CREDITS}"
            )
            raise HTTPException(
                status_code=status.HTTP_402_PAYMENT_REQUIRED,
                detail=f"크레딧이 부족합니다. (현재: {current_credits}, 필요: {REQUIRED_CREDITS})",
            )

        logger.info(f"크레딧 확인 완료: {current_credits} 크레딧 보유")

        # 2. RPA 발급 시도
        logger.info("RPA를 통한 등기부등본 발급 시작...")

        # 환경변수에서 인터넷등기소 계정 정보 가져오기
        iros_user_id = settings.iros_user_id
        iros_password = settings.iros_password

        if not iros_user_id or not iros_password:
            logger.error("인터넷등기소 계정 정보가 설정되지 않았습니다")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="등기부등본 발급 서비스가 설정되지 않았습니다",
            )

        try:
            pdf_path = await issue_registry_pdf(
                address=request.address,
                user_id=iros_user_id,
                password=iros_password,
                result_index=request.result_index,
                headless=True,  # 프로덕션에서는 헤드리스 모드
            )

            logger.info(f"등기부등본 발급 성공: {pdf_path}")

        except RegistryRPAError as e:
            logger.error(f"등기부등본 발급 실패: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"등기부등본 발급 실패: {str(e)}",
            )

        # 3. 크레딧 차감
        try:
            deduct_credits(
                db_session,
                user_id,
                REQUIRED_CREDITS,
                reason="등기부등본 자동 발급",
                metadata={"address": request.address},
            )
            logger.info(f"크레딧 차감 완료: {REQUIRED_CREDITS} 크레딧")

        except Exception as e:
            logger.error(f"크레딧 차감 실패: {e}")
            # 크레딧 차감 실패 시 발급된 파일은 유지 (사용자 불이익 방지)
            # 추후 관리자가 수동으로 처리해야 함

        # 4. 남은 크레딧 조회
        remaining_credits = get_user_credits(db_session, user_id)

        # 5. 백그라운드 작업: 임시 파일 정리 (선택적)
        # background_tasks.add_task(cleanup_temp_file, pdf_path)

        return IssueRegistryResponse(
            ok=True,
            pdf_path=pdf_path,
            message="등기부등본 발급이 완료되었습니다",
            credits_remaining=remaining_credits,
        )

    except HTTPException:
        raise

    except Exception as e:
        logger.error(f"예상치 못한 오류: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"서버 오류: {str(e)}",
        )

    finally:
        db_session.close()


@router.get("/credits")
async def get_credits_balance(
    user: dict = Depends(get_current_user),
) -> dict:
    """
    사용자 크레딧 잔액 조회

    Returns:
        크레딧 잔액 정보
    """
    user_id = user["sub"]

    SessionLocal = get_session_maker()
    db_session = SessionLocal()

    try:
        credits = get_user_credits(db_session, user_id)

        return {
            "user_id": user_id,
            "credits": credits,
            "registry_cost": 10,  # 등기부등본 발급 비용
        }

    finally:
        db_session.close()
