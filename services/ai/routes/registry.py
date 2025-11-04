"""등기부등본 업로드 및 처리 라우터."""
import logging
from typing import Optional
from uuid import UUID, uuid4
from datetime import datetime
import os
import re

from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel

from core.database import get_db_session, create_contract, create_document
from core.encryption import encrypt
from core.auth import get_current_user
from ingest.pdf_parse import parse_pdf_to_text
from ingest.upsert_vector import upsert_document_embeddings
from ingest.registry_parser import parse_registry_pdf
from core.supabase_client import get_supabase_client, supabase_storage
from core.settings import settings

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
    artifact_id: Optional[str] = None
    file_url: Optional[str] = None


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
    case_id: Optional[str] = Form(None, description="분석 케이스 ID (있으면 v2_artifacts에 연결)"),
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
    4. DB 저장 (v2_doc_texts)
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
        if not file.filename.lower().endswith(".pdf"):
            raise HTTPException(
                status_code=400,
                detail="PDF 파일만 업로드 가능합니다."
            )

        # 2. 계약 ID 생성 (등기부등본용)
        contract_id = f"registry_{uuid4().hex[:12]}"
        user_uuid = UUID(user_id)

        logger.info(f"등기부등본 업로드 시작: user_id={user_id}, contract_id={contract_id}")

        # 3. 임시 파일로 저장 (파일명 정제 + 크기 제한 + 서명 검사)
        raw_filename = os.path.basename(file.filename)
        safe_filename = re.sub(r"[^A-Za-z0-9._-]", "_", raw_filename)[:128] or "upload.pdf"
        temp_path = f"/tmp/{contract_id}_{safe_filename}"
        content = await file.read()

        # 크기 제한
        max_bytes = settings.upload_max_pdf_mb * 1024 * 1024
        if len(content) > max_bytes:
            raise HTTPException(status_code=413, detail="파일이 허용 용량을 초과했습니다")

        # MIME/시그니처 확인
        if file.content_type and file.content_type != "application/pdf":
            raise HTTPException(status_code=400, detail="유효한 PDF 파일이 아닙니다 (MIME)")
        if not content.startswith(b"%PDF-"):
            raise HTTPException(status_code=400, detail="유효한 PDF 파일이 아닙니다 (signature)")

        with open(temp_path, "wb") as f:
            f.write(content)

        file_size = len(content)
        logger.info(f"파일 저장 완료: {temp_path} ({file_size} bytes)")

        # 4. PDF 텍스트 추출 + 구조화 파싱
        text = parse_pdf_to_text(temp_path)
        logger.info(f"텍스트 추출 완료: {len(text)} chars")

        # 구조화 파싱 (정규식/필요시 OCR)
        registry_doc = await parse_registry_pdf(temp_path)
        masked = registry_doc.to_masked_dict()
        section_count = 0
        section_count += len(masked.get("mortgages", []) or [])
        section_count += len(masked.get("seizures", []) or [])
        section_count += len(masked.get("lease_rights", []) or [])
        parse_confidence = round(min(0.5 + min(section_count * 0.1, 0.4), 0.99), 2)

        # 5. 민감한 데이터 암호화
        encrypted_property_address = encrypt(property_address) if property_address else None
        encrypted_owner_name = encrypt(owner_name) if owner_name else None

        # 6. 계약 레코드 생성 (암호화된 주소)
        contract = create_contract(
            session=session,
            user_id=user_uuid,
            contract_id=contract_id,
            addr=encrypted_property_address or "등기부등본",
        )

        # 7. 문서 레코드 생성 (document_type='registry', 암호화된 데이터)
        owner_info = {}
        if encrypted_owner_name:
            owner_info["name"] = encrypted_owner_name

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
            property_address=encrypted_property_address,  # 암호화된 주소
            owner_info=owner_info,  # 암호화된 소유자 정보
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

        # 8. Supabase Storage 업로드 + v2_artifacts 기록 (case_id가 있으면)
        try:
            if case_id:
                # Storage 업로드 (설정 분리)
                bucket = settings.storage_bucket_artifacts
                storage_path = settings.storage_artifacts_path_template.format(
                    user_id=user_id,
                    contract_id=contract_id,
                    filename=file.filename,
                )
                await supabase_storage.upload_file(
                    bucket=bucket,
                    path=storage_path,
                    file_data=content,
                    content_type=file.content_type or "application/pdf",
                )
                # Private bucket: generate temporary signed URL for client convenience
                signed_url = await supabase_storage.get_signed_url(bucket, storage_path, expires_in=3600)

                # v2_artifacts 저장
                supabase = get_supabase_client(service_role=True)
                artifact_res = supabase.table("v2_artifacts").insert({
                    "case_id": case_id,
                    "artifact_type": "registry_pdf",
                    "file_path": f"{bucket}/{storage_path}",
                    "file_name": file.filename,
                    "file_size": file_size,
                    "mime_type": file.content_type or "application/pdf",
                    "parsed_data": masked,
                    "parse_confidence": parse_confidence,
                    "parse_method": "pypdf",  # 기본값 (필요시 OCR 케이스 보강)
                    "metadata": {
                        "contract_id": contract_id,
                        "signed_url_expires_in": 3600,
                    },
                }).execute()
                artifact_id = None
                if getattr(artifact_res, 'data', None):
                    try:
                        artifact_id = artifact_res.data[0].get('id')
                    except Exception:
                        artifact_id = None
                logger.info(f"v2_artifacts 기록 완료: case_id={case_id}, artifact_id={artifact_id}")
        except Exception as e:
            logger.error(f"Storage/Artifacts 처리 실패(계속 진행): {e}")

        return RegistryUploadResponse(
            success=True,
            message="등기부등본 업로드 및 처리 완료",
            contract_id=contract_id,
            document_id=str(document.id),
            text_length=len(text),
            property_address=property_address,
            artifact_id=locals().get('artifact_id'),
            file_url=locals().get('signed_url'),
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"등기부등본 업로드 실패: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"등기부등본 처리 중 오류 발생: {str(e)}"
        )
    finally:
        # 임시 파일 삭제 시도
        try:
            if 'temp_path' in locals() and os.path.exists(temp_path):
                os.unlink(temp_path)
        except Exception:
            pass


@router.get("/health")
async def health_check():
    """헬스 체크 엔드포인트."""
    return {"status": "ok", "service": "registry"}


@router.post("/issue")
async def issue_registry(
    case_id: str = Form(..., description="케이스 ID"),
    user: dict = Depends(get_current_user),
):
    """
    등기부 발급 (가이드 호환용 스텁)

    실제 IROS RPA 발급은 별도 서비스로 운영됩니다. 현재 환경에서는
    발급 요청을 접수하고, 프론트에서 업로드 플로우를 사용하도록 안내합니다.

    Returns:
        202 수락 응답과 안내 메시지
    """
    logger.info(f"등기부 발급 요청 (stub): case_id={case_id}, user_id={user.get('sub')}")
    # TODO: 프로덕션에서는 크레딧 차감 및 RPA 연동 구현
    raise HTTPException(status_code=501, detail="등기부 자동발급은 현재 환경에서 지원되지 않습니다. PDF 업로드를 사용하세요.")
