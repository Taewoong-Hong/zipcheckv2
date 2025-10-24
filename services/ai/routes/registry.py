"""등기부등본 업로드 및 처리 라우터."""
import logging
from typing import Optional
from uuid import UUID, uuid4
from datetime import datetime

from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel

from core.database import get_db_session, create_contract, create_document
from ingest.pdf_parse import parse_pdf_to_text
from ingest.upsert_vector import upsert_document_embeddings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/registry", tags=["registry"])


# ============================================
# Request/Response Models
# ============================================

class RegistryUploadResponse(BaseModel):
    """등기부등본 업로드 응답."""
    success: bool
    message: str
    contract_id: str
    document_id: str
    text_length: int
    property_address: Optional[str] = None


class RegistryMetadata(BaseModel):
    """등기부등본 메타데이터."""
    property_address: Optional[str] = None
    owner_name: Optional[str] = None
    registry_date: Optional[str] = None
    registry_type: Optional[str] = None  # land, building, collective


# ============================================
# API Endpoints
# ============================================

@router.post("/upload", response_model=RegistryUploadResponse)
async def upload_registry(
    file: UploadFile = File(..., description="등기부등본 PDF 파일"),
    user_id: str = Form(..., description="사용자 ID (UUID)"),
    property_address: Optional[str] = Form(None, description="부동산 주소"),
    owner_name: Optional[str] = Form(None, description="소유자 이름"),
    registry_date: Optional[str] = Form(None, description="등기부 발급일 (YYYY-MM-DD)"),
    registry_type: Optional[str] = Form("building", description="등기부 유형: land, building, collective"),
    session: Session = Depends(get_db_session),
):
    """
    등기부등본 PDF 업로드 및 처리.

    1. PDF 파일 업로드
    2. 텍스트 추출 및 파싱
    3. 메타데이터 추출 (주소, 소유자 등)
    4. DB 저장 (v2_documents)
    5. 벡터 임베딩 생성 및 저장

    Args:
        file: 등기부등본 PDF 파일
        user_id: 사용자 UUID
        property_address: 부동산 소재지 (옵션)
        owner_name: 소유자 이름 (옵션)
        registry_date: 발급일 (옵션)
        registry_type: 등기부 유형 (land/building/collective)
        session: DB 세션

    Returns:
        업로드 결과 및 document_id
    """
    try:
        # 1. 파일 검증
        if not file.filename.endswith(".pdf"):
            raise HTTPException(
                status_code=400,
                detail="PDF 파일만 업로드 가능합니다."
            )

        # 2. 계약 ID 생성 (등기부등본용)
        contract_id = f"registry_{uuid4().hex[:12]}"
        user_uuid = UUID(user_id)

        logger.info(f"등기부등본 업로드 시작: user_id={user_id}, contract_id={contract_id}")

        # 3. 임시 파일로 저장
        temp_path = f"/tmp/{contract_id}_{file.filename}"
        with open(temp_path, "wb") as f:
            content = await file.read()
            f.write(content)

        file_size = len(content)
        logger.info(f"파일 저장 완료: {temp_path} ({file_size} bytes)")

        # 4. PDF 텍스트 추출
        text = parse_pdf_to_text(temp_path)
        logger.info(f"텍스트 추출 완료: {len(text)} chars")

        if len(text) < 100:
            raise HTTPException(
                status_code=400,
                detail="PDF에서 충분한 텍스트를 추출할 수 없습니다. 스캔 품질을 확인해주세요."
            )

        # 5. 계약 레코드 생성
        contract = create_contract(
            session=session,
            user_id=user_uuid,
            contract_id=contract_id,
            addr=property_address or "등기부등본",
        )

        # 6. 문서 레코드 생성 (document_type='registry')
        owner_info = {}
        if owner_name:
            owner_info["name"] = owner_name

        registry_date_obj = None
        if registry_date:
            try:
                registry_date_obj = datetime.strptime(registry_date, "%Y-%m-%d").date()
            except ValueError:
                logger.warning(f"Invalid registry_date format: {registry_date}")

        document = create_document(
            session=session,
            contract_id=contract.id,
            user_id=user_uuid,
            text=text,
            file_name=file.filename,
            file_path=temp_path,
            file_size=file_size,
            mime_type=file.content_type,
            document_type="registry",
            property_address=property_address,
            owner_info=owner_info,
            registry_date=registry_date_obj,
            registry_type=registry_type,
        )

        logger.info(f"문서 저장 완료: doc_id={document.id}")

        # 7. 벡터 임베딩 생성 (비동기 처리 가능)
        try:
            upsert_document_embeddings(
                doc_id=str(document.id),
                user_id=str(user_uuid),
                text=text,
                metadata={
                    "document_type": "registry",
                    "property_address": property_address or "",
                    "registry_type": registry_type,
                    "file_name": file.filename,
                },
            )
            logger.info(f"벡터 임베딩 생성 완료: doc_id={document.id}")
        except Exception as e:
            logger.error(f"벡터 임베딩 생성 실패 (계속 진행): {e}")
            # 임베딩 실패는 치명적이지 않으므로 계속 진행

        return RegistryUploadResponse(
            success=True,
            message="등기부등본 업로드 및 처리 완료",
            contract_id=contract_id,
            document_id=str(document.id),
            text_length=len(text),
            property_address=property_address,
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"등기부등본 업로드 실패: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"등기부등본 처리 중 오류 발생: {str(e)}"
        )


@router.get("/health")
async def health_check():
    """헬스 체크 엔드포인트."""
    return {"status": "ok", "service": "registry"}
