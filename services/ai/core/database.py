"""데이터베이스 모델 및 세션 관리."""
import logging
from datetime import datetime
from typing import Optional
from uuid import UUID, uuid4

from sqlalchemy import (
    Column,
    String,
    Text,
    Integer,
    DateTime,
    ForeignKey,
    CheckConstraint,
    create_engine,
)
from sqlalchemy.dialects.postgresql import UUID as PGUUID, JSONB
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship, sessionmaker, Session
from pgvector.sqlalchemy import Vector

from .settings import settings

logger = logging.getLogger(__name__)

# SQLAlchemy Base
Base = declarative_base()


# ============================================
# Models
# ============================================

class Profile(Base):
    """사용자 프로필 모델 (v2)."""
    __tablename__ = "v2_profiles"

    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id = Column(PGUUID(as_uuid=True), unique=True, nullable=False)
    name = Column(String)
    email = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Contract(Base):
    """계약서 메타데이터 모델 (v2)."""
    __tablename__ = "v2_contracts"
    __table_args__ = (
        CheckConstraint("status IN ('processing', 'completed', 'failed')", name="check_status"),
    )

    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id = Column(PGUUID(as_uuid=True), nullable=False, index=True)
    contract_id = Column(String, unique=True, nullable=False, index=True)
    addr = Column(Text)
    status = Column(String, default="processing")
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    # Note: user_id references auth.users directly, not v2_profiles
    documents = relationship("Document", back_populates="contract", cascade="all, delete-orphan")
    reports = relationship("Report", back_populates="contract", cascade="all, delete-orphan")


class Document(Base):
    """문서 원본 및 텍스트 모델 (v2)."""
    __tablename__ = "v2_documents"

    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    contract_id = Column(PGUUID(as_uuid=True), ForeignKey("v2_contracts.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(PGUUID(as_uuid=True), nullable=False, index=True)
    file_path = Column(Text)
    file_name = Column(Text)
    file_size = Column(Integer)
    mime_type = Column(String)
    text = Column(Text)
    text_length = Column(Integer)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

    # Relationships
    contract = relationship("Contract", back_populates="documents")
    embeddings = relationship("Embedding", back_populates="document", cascade="all, delete-orphan")


class Embedding(Base):
    """벡터 임베딩 모델 (pgvector) (v2)."""
    __tablename__ = "v2_embeddings"

    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    doc_id = Column(PGUUID(as_uuid=True), ForeignKey("v2_documents.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(PGUUID(as_uuid=True), nullable=False, index=True)
    embedding = Column(Vector(1536))  # text-embedding-3-small (1536 dimensions)
    chunk_text = Column(Text)
    chunk_index = Column(Integer)
    chunk_metadata = Column(JSONB, default={})  # Renamed from 'metadata' (reserved word)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

    # Relationships
    document = relationship("Document", back_populates="embeddings")


class Report(Base):
    """분석 리포트 모델 (v2)."""
    __tablename__ = "v2_reports"
    __table_args__ = (
        CheckConstraint("mode IN ('single', 'consensus')", name="check_mode"),
    )

    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    contract_id = Column(PGUUID(as_uuid=True), ForeignKey("v2_contracts.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(PGUUID(as_uuid=True), nullable=False, index=True)
    question = Column(Text)
    result_json = Column(JSONB)
    result_text = Column(Text)
    mode = Column(String, default="single")
    provider = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

    # Relationships
    contract = relationship("Contract", back_populates="reports")


# ============================================
# Database Session Management
# ============================================

def get_engine():
    """SQLAlchemy 엔진 생성."""
    # psycopg3를 위한 URL 스킴 변경 (postgresql:// -> postgresql+psycopg://)
    db_url = settings.database_url
    if db_url.startswith("postgresql://"):
        db_url = db_url.replace("postgresql://", "postgresql+psycopg://", 1)

    return create_engine(
        db_url,
        echo=settings.log_level == "DEBUG",
        pool_pre_ping=True,  # 연결 상태 확인
        pool_recycle=3600,   # 1시간마다 연결 재생성
        pool_size=5,
        max_overflow=5,
        connect_args={"prepare_threshold": 0},  # Supabase pooler 호환성
    )


def get_session_maker():
    """SessionMaker 생성."""
    engine = get_engine()
    return sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db_session() -> Session:
    """DB 세션 생성 (의존성 주입용)."""
    SessionLocal = get_session_maker()
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


# ============================================
# Helper Functions
# ============================================

def create_contract(
    session: Session,
    user_id: UUID,
    contract_id: str,
    addr: Optional[str] = None,
) -> Contract:
    """계약서 생성."""
    contract = Contract(
        user_id=user_id,
        contract_id=contract_id,
        addr=addr,
        status="processing",
    )
    session.add(contract)
    session.commit()
    session.refresh(contract)
    logger.info(f"계약서 생성: contract_id={contract_id}, db_id={contract.id}")
    return contract


def create_document(
    session: Session,
    contract_id: UUID,
    user_id: UUID,
    text: str,
    file_name: Optional[str] = None,
    file_path: Optional[str] = None,
    file_size: Optional[int] = None,
    mime_type: Optional[str] = None,
) -> Document:
    """문서 생성."""
    document = Document(
        contract_id=contract_id,
        user_id=user_id,
        text=text,
        text_length=len(text),
        file_name=file_name,
        file_path=file_path,
        file_size=file_size,
        mime_type=mime_type,
    )
    session.add(document)
    session.commit()
    session.refresh(document)
    logger.info(f"문서 생성: doc_id={document.id}, text_length={len(text)}")
    return document


def get_contract_by_contract_id(
    session: Session,
    contract_id: str,
) -> Optional[Contract]:
    """contract_id로 계약서 조회."""
    return session.query(Contract).filter(Contract.contract_id == contract_id).first()


def update_contract_status(
    session: Session,
    contract_id: UUID,
    status: str,
) -> None:
    """계약서 상태 업데이트."""
    contract = session.query(Contract).filter(Contract.id == contract_id).first()
    if contract:
        contract.status = status
        session.commit()
        logger.info(f"계약서 상태 업데이트: contract_id={contract_id}, status={status}")


def create_report(
    session: Session,
    contract_id: UUID,
    user_id: UUID,
    question: str,
    result_text: str,
    result_json: Optional[dict] = None,
    mode: str = "single",
    provider: Optional[str] = None,
) -> Report:
    """분석 리포트 생성."""
    report = Report(
        contract_id=contract_id,
        user_id=user_id,
        question=question,
        result_text=result_text,
        result_json=result_json,
        mode=mode,
        provider=provider,
    )
    session.add(report)
    session.commit()
    session.refresh(report)
    logger.info(f"리포트 생성: report_id={report.id}")
    return report
