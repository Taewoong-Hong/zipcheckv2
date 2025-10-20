"""ZipCheck AI FastAPI 애플리케이션."""
import logging
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Literal

from fastapi import FastAPI, UploadFile, Form, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import sentry_sdk
from sentry_sdk.integrations.fastapi import FastApiIntegration

from uuid import UUID, uuid4

from core.settings import settings
from core.chains import build_contract_analysis_chain, single_model_analyze
from core.database import (
    get_session_maker,
    create_contract,
    create_document,
    update_contract_status,
)
from ingest.pdf_parse import parse_pdf_to_text, validate_pdf
from ingest.upsert_vector import upsert_contract_text
from ingest.validators import (
    validate_pdf_file,
    validate_contract_id,
    validate_address,
    FileValidationError,
)

# 로깅 설정
logging.basicConfig(
    level=getattr(logging, settings.log_level),
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


# Sentry 초기화
if settings.sentry_dsn:
    sentry_sdk.init(
        dsn=settings.sentry_dsn,
        integrations=[FastApiIntegration()],
        environment=settings.app_env,
        traces_sample_rate=0.1 if settings.app_env == "production" else 1.0,
    )
    logger.info("Sentry 초기화 완료")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """애플리케이션 시작/종료 시 실행되는 코드."""
    # 시작 시
    logger.info("ZipCheck AI 서비스 시작")
    logger.info(f"환경: {settings.app_env}")
    logger.info(f"Primary LLM: {settings.primary_llm}")
    logger.info(f"Judge LLM: {settings.judge_llm}")
    logger.info(f"Embedding Model: {settings.embed_model}")

    yield

    # 종료 시
    logger.info("ZipCheck AI 서비스 종료")


# FastAPI 앱 생성
app = FastAPI(
    title="ZipCheck AI",
    description="부동산 계약서 리스크 분석 AI 서비스",
    version="2.0.0",
    lifespan=lifespan,
)


# CORS 미들웨어 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Pydantic 모델
class HealthResponse(BaseModel):
    """헬스체크 응답 모델."""
    ok: bool
    version: str = "2.0.0"
    environment: str


class IngestResponse(BaseModel):
    """PDF 인제스트 응답 모델."""
    ok: bool
    contract_id: str
    length: int
    chunks: int


class AnalyzeRequest(BaseModel):
    """분석 요청 모델."""
    question: str = Field(..., min_length=1, max_length=1000)
    mode: Literal["single", "consensus"] = Field(
        default="single",
        description="분석 모드: single(단일 모델) 또는 consensus(듀얼 모델)"
    )
    provider: Literal["openai", "claude"] | None = Field(
        default=None,
        description="LLM 제공자 (single 모드에서만 사용)"
    )


class SourceInfo(BaseModel):
    """출처 정보 모델."""
    doc_id: str | None = None
    chunk_index: int | None = None
    page: int | None = None
    content_preview: str | None = None


class AnalyzeResponse(BaseModel):
    """분석 응답 모델."""
    answer: str
    mode: str
    provider: str | None = None
    sources: list[SourceInfo] = Field(default_factory=list)


# 엔드포인트
@app.get("/healthz", response_model=HealthResponse)
async def health_check():
    """
    헬스체크 엔드포인트.

    Returns:
        서비스 상태 정보
    """
    return HealthResponse(
        ok=True,
        environment=settings.app_env,
    )


@app.post("/ingest", response_model=IngestResponse)
async def ingest_contract(
    file: UploadFile,
    contract_id: str = Form(..., min_length=1, max_length=100),
    addr: str = Form(default="", max_length=200),
    user_id: str = Form(...),  # TODO: 실제로는 JWT에서 추출
):
    """
    계약서 PDF 업로드 및 벡터 DB 저장.

    Args:
        file: PDF 파일
        contract_id: 계약서 고유 ID
        addr: 부동산 주소 (선택)
        user_id: 사용자 ID (UUID)

    Returns:
        업로드 결과

    Raises:
        HTTPException: 파일 검증 실패 또는 처리 오류 시
    """
    logger.info(f"PDF 업로드 요청: contract_id={contract_id}, user_id={user_id}")

    # user_id 검증
    try:
        user_uuid = UUID(user_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="유효하지 않은 user_id 형식입니다",
        )

    # contract_id 검증
    try:
        validate_contract_id(contract_id)
    except FileValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )

    # 주소 검증
    addr = validate_address(addr)

    # 파일 검증
    if not file.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="파일명이 없습니다",
        )

    content = await file.read()
    file_size = len(content)

    try:
        safe_filename, _ = validate_pdf_file(
            file.filename,
            file_size,
            file.content_type,
        )
    except FileValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )

    # DB 세션 생성
    SessionLocal = get_session_maker()
    db_session = SessionLocal()

    # 임시 파일 저장
    temp_dir = Path("/tmp")
    temp_dir.mkdir(exist_ok=True)
    temp_path = temp_dir / f"{contract_id}_{safe_filename}"

    try:
        # 파일 저장
        with open(temp_path, "wb") as f:
            f.write(content)

        logger.info(f"파일 저장 완료: {temp_path} ({file_size} bytes)")

        # 1. DB에 contract 레코드 생성
        try:
            contract = create_contract(
                session=db_session,
                user_id=user_uuid,
                contract_id=contract_id,
                addr=addr,
            )
            contract_db_id = contract.id
        except Exception as e:
            logger.error(f"계약서 DB 저장 실패: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"계약서 저장 실패: {str(e)}",
            )

        # 2. PDF 파싱
        try:
            text = parse_pdf_to_text(str(temp_path))

            # 최소 텍스트 길이 검증
            if len(text.strip()) < 100:
                logger.warning(f"PDF에서 추출된 텍스트가 너무 짧습니다: {len(text)} 글자")
                update_contract_status(db_session, contract_db_id, "failed")
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail=f"PDF에서 텍스트를 충분히 추출하지 못했습니다 ({len(text)} 글자). OCR이 필요한 스캔 문서일 수 있습니다.",
                )

        except HTTPException:
            raise
        except FileNotFoundError as e:
            logger.error(f"PDF 파일을 찾을 수 없음: {e}")
            update_contract_status(db_session, contract_db_id, "failed")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"PDF 파일을 찾을 수 없습니다: {str(e)}",
            )
        except ValueError as e:
            logger.error(f"PDF 파싱 오류: {e}")
            update_contract_status(db_session, contract_db_id, "failed")
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"PDF 파싱 실패: {str(e)}",
            )
        except Exception as e:
            logger.error(f"PDF 파싱 중 예상치 못한 오류: {e}")
            update_contract_status(db_session, contract_db_id, "failed")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"PDF 파싱 중 서버 오류: {str(e)}",
            )

        # 3. DB에 document 레코드 생성
        try:
            document = create_document(
                session=db_session,
                contract_id=contract_db_id,
                user_id=user_uuid,
                text=text,
                file_name=safe_filename,
                file_path=str(temp_path),
                file_size=file_size,
                mime_type=file.content_type,
            )
        except Exception as e:
            logger.error(f"문서 DB 저장 실패: {e}")
            update_contract_status(db_session, contract_db_id, "failed")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"문서 저장 실패: {str(e)}",
            )

        # 4. 벡터 DB 업서트
        metadata = {
            "addr": addr,
            "user_id": str(user_uuid),
            "contract_db_id": str(contract_db_id),
            "doc_id": str(document.id),
        }
        try:
            chunks = upsert_contract_text(contract_id, text, metadata)
        except Exception as e:
            logger.error(f"벡터 DB 업서트 실패: {e}")
            update_contract_status(db_session, contract_db_id, "failed")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"벡터 DB 저장 실패: {str(e)}",
            )

        # 5. 성공 시 상태 업데이트
        update_contract_status(db_session, contract_db_id, "completed")

        logger.info(
            f"인제스트 완료: contract_id={contract_id}, "
            f"db_id={contract_db_id}, 길이={len(text)}, 청크={chunks}"
        )

        return IngestResponse(
            ok=True,
            contract_id=contract_id,
            length=len(text),
            chunks=chunks,
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
        # DB 세션 종료
        db_session.close()

        # 임시 파일 삭제
        if temp_path.exists():
            temp_path.unlink()
            logger.debug(f"임시 파일 삭제: {temp_path}")


@app.post("/analyze", response_model=AnalyzeResponse)
async def analyze_contract(request: AnalyzeRequest):
    """
    계약서 분석 요청.

    Args:
        request: 분석 요청 (질문, 모드, 제공자)

    Returns:
        분석 결과

    Raises:
        HTTPException: 분석 실패 시
    """
    logger.info(
        f"분석 요청: mode={request.mode}, "
        f"provider={request.provider}, "
        f"question={request.question[:50]}..."
    )

    try:
        if request.mode == "single":
            # 단일 모델 분석 (sources 포함)
            result = single_model_analyze(
                question=request.question,
                provider=request.provider
            )

            return AnalyzeResponse(
                answer=result["answer"],
                mode="single",
                provider=request.provider or settings.primary_llm,
                sources=[SourceInfo(**s) for s in result["sources"]],
            )

        elif request.mode == "consensus":
            # TODO: P3에서 구현 예정
            raise HTTPException(
                status_code=status.HTTP_501_NOT_IMPLEMENTED,
                detail="컨센서스 모드는 아직 구현되지 않았습니다",
            )

        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"지원하지 않는 모드입니다: {request.mode}",
            )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"분석 실패: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"분석 중 오류 발생: {str(e)}",
        )


# 개발 서버 실행 (uvicorn app:app --reload)
if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "app:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level=settings.log_level.lower(),
    )
