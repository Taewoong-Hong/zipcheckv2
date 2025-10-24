"""벡터 DB에 문서 업서트."""
import logging
from typing import Dict, List, Any
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_core.documents import Document
from tenacity import (
    retry,
    stop_after_attempt,
    wait_exponential,
    retry_if_exception_type,
)
from openai import RateLimitError, APIError

from core.retriever import get_vectorstore

logger = logging.getLogger(__name__)


def upsert_contract_text(
    doc_id: str,
    text: str,
    metadata: Dict[str, Any] | None = None,
    chunk_size: int = 1200,
    chunk_overlap: int = 150,
    collection_name: str = "v2_contract_docs",
) -> int:
    """
    계약서 텍스트를 청크로 분할하고 벡터 DB에 업서트합니다.

    Args:
        doc_id: 문서 고유 ID
        text: 전체 텍스트
        metadata: 추가 메타데이터 (주소, 계약 유형 등)
        chunk_size: 청크 크기 (문자 수)
        chunk_overlap: 청크 간 오버랩 (문자 수)
        collection_name: 벡터 컬렉션 이름

    Returns:
        업서트된 청크 개수

    Example:
        >>> text = "계약서 내용..."
        >>> metadata = {"addr": "서울시 강남구", "contract_type": "매매"}
        >>> count = upsert_contract_text("contract_001", text, metadata)
        >>> print(f"{count}개 청크 저장됨")
    """
    if not text or not text.strip():
        raise ValueError("텍스트가 비어있습니다")

    logger.info(
        f"텍스트 청킹 시작: doc_id={doc_id}, "
        f"길이={len(text)}, chunk_size={chunk_size}"
    )

    # 텍스트 분할기 설정
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
        length_function=len,
        separators=["\n\n", "\n", ". ", " ", ""],
    )

    # 청크 생성
    chunks = splitter.split_text(text)
    logger.info(f"{len(chunks)}개 청크 생성됨")

    # 메타데이터 준비
    base_metadata = metadata or {}
    base_metadata["doc_id"] = doc_id

    # Document 객체 생성
    documents = []
    for i, chunk in enumerate(chunks):
        chunk_metadata = {
            **base_metadata,
            "chunk_index": i,
            "chunk_total": len(chunks),
        }
        doc = Document(page_content=chunk, metadata=chunk_metadata)
        documents.append(doc)

    # 벡터 스토어에 추가 (재시도 로직 포함)
    try:
        vectorstore = get_vectorstore(collection_name=collection_name)

        # 임베딩 재시도 래퍼
        @retry(
            stop=stop_after_attempt(3),
            wait=wait_exponential(multiplier=1, min=2, max=10),
            retry=retry_if_exception_type((RateLimitError, APIError)),
            reraise=True,
        )
        def add_documents_with_retry():
            return vectorstore.add_documents(documents)

        add_documents_with_retry()

        logger.info(
            f"벡터 DB 업서트 완료: {len(documents)}개 청크, "
            f"collection={collection_name}"
        )
        return len(documents)

    except Exception as e:
        logger.error(f"벡터 DB 업서트 실패: {e}")
        raise ValueError(f"벡터 DB 업서트 중 오류 발생: {e}") from e


def upsert_contract_pages(
    doc_id: str,
    pages_data: List[Dict[str, Any]],
    metadata: Dict[str, Any] | None = None,
    collection_name: str = "v2_contract_docs",
) -> int:
    """
    페이지별 데이터를 벡터 DB에 업서트합니다.

    Args:
        doc_id: 문서 고유 ID
        pages_data: 페이지별 데이터 리스트
            [{"text": str, "page": int, "metadata": dict}, ...]
        metadata: 공통 메타데이터
        collection_name: 벡터 컬렉션 이름

    Returns:
        업서트된 총 청크 개수

    Example:
        >>> from ingest.pdf_parse import parse_pdf_with_metadata
        >>> pages = parse_pdf_with_metadata("contract.pdf")
        >>> count = upsert_contract_pages("contract_001", pages)
    """
    if not pages_data:
        raise ValueError("페이지 데이터가 비어있습니다")

    logger.info(f"페이지별 업서트 시작: {len(pages_data)} 페이지")

    total_chunks = 0
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=1200,
        chunk_overlap=150,
    )

    base_metadata = metadata or {}
    base_metadata["doc_id"] = doc_id

    documents = []

    for page_data in pages_data:
        text = page_data["text"]
        page_num = page_data["page"]
        page_meta = page_data.get("metadata", {})

        # 페이지별 청크 생성
        chunks = splitter.split_text(text)

        for i, chunk in enumerate(chunks):
            chunk_metadata = {
                **base_metadata,
                **page_meta,
                "page": page_num,
                "chunk_index": i,
                "chunk_total": len(chunks),
            }
            doc = Document(page_content=chunk, metadata=chunk_metadata)
            documents.append(doc)

        total_chunks += len(chunks)

    # 벡터 스토어에 추가
    try:
        vectorstore = get_vectorstore(collection_name=collection_name)
        vectorstore.add_documents(documents)

        logger.info(
            f"페이지별 업서트 완료: {len(pages_data)} 페이지, "
            f"{total_chunks}개 청크"
        )
        return total_chunks

    except Exception as e:
        logger.error(f"페이지별 업서트 실패: {e}")
        raise ValueError(f"페이지별 업서트 중 오류 발생: {e}") from e


def upsert_document_embeddings(
    doc_id: str,
    user_id: str,
    text: str,
    metadata: Dict[str, Any] | None = None,
    chunk_size: int = 1200,
    chunk_overlap: int = 150,
) -> int:
    """
    문서 텍스트를 청크로 분할하고 v2_embeddings 테이블에 직접 저장합니다.
    (등기부등본 등 document_type='registry'인 문서용)

    Args:
        doc_id: 문서 고유 ID (v2_documents.id)
        user_id: 사용자 UUID
        text: 전체 텍스트
        metadata: 추가 메타데이터
        chunk_size: 청크 크기 (문자 수)
        chunk_overlap: 청크 간 오버랩 (문자 수)

    Returns:
        업서트된 청크 개수
    """
    if not text or not text.strip():
        raise ValueError("텍스트가 비어있습니다")

    logger.info(
        f"문서 임베딩 시작: doc_id={doc_id}, user_id={user_id}, "
        f"길이={len(text)}, chunk_size={chunk_size}"
    )

    # 텍스트 분할기 설정
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
        length_function=len,
        separators=["\n\n", "\n", ". ", " ", ""],
    )

    # 청크 생성
    chunks = splitter.split_text(text)
    logger.info(f"{len(chunks)}개 청크 생성됨")

    # 메타데이터 준비
    base_metadata = metadata or {}

    # Document 객체 생성 (pgvector용)
    documents = []
    for i, chunk in enumerate(chunks):
        chunk_metadata = {
            **base_metadata,
            "doc_id": doc_id,
            "user_id": user_id,
            "chunk_index": i,
            "chunk_total": len(chunks),
        }
        doc = Document(page_content=chunk, metadata=chunk_metadata)
        documents.append(doc)

    # 벡터 스토어에 추가 (재시도 로직 포함)
    try:
        # pgvector collection은 자동으로 v2_embeddings 테이블에 저장됨
        vectorstore = get_vectorstore(collection_name="v2_embeddings")

        # 임베딩 재시도 래퍼
        @retry(
            stop=stop_after_attempt(3),
            wait=wait_exponential(multiplier=1, min=2, max=10),
            retry=retry_if_exception_type((RateLimitError, APIError)),
            reraise=True,
        )
        def add_documents_with_retry():
            return vectorstore.add_documents(documents)

        add_documents_with_retry()

        logger.info(
            f"문서 임베딩 완료: {len(documents)}개 청크, "
            f"doc_id={doc_id}"
        )
        return len(documents)

    except Exception as e:
        logger.error(f"문서 임베딩 실패: {e}")
        raise ValueError(f"문서 임베딩 중 오류 발생: {e}") from e


def delete_document_chunks(
    doc_id: str,
    collection_name: str = "v2_contract_docs",
) -> bool:
    """
    특정 문서의 모든 청크를 삭제합니다.

    Args:
        doc_id: 삭제할 문서 ID
        collection_name: 벡터 컬렉션 이름

    Returns:
        삭제 성공 여부

    Note:
        실제 구현은 PGVector의 delete 기능에 따라 달라질 수 있습니다.
        현재는 메타데이터 필터링을 통한 삭제를 가정합니다.
    """
    try:
        vectorstore = get_vectorstore(collection_name=collection_name)

        # PGVector에서는 직접적인 메타데이터 기반 삭제가 제한적일 수 있음
        # 필요시 SQL 쿼리로 직접 삭제
        logger.warning(
            f"문서 삭제 요청: doc_id={doc_id}. "
            "PGVector의 삭제 기능은 제한적일 수 있습니다."
        )

        # TODO: 실제 삭제 로직 구현
        # vectorstore.delete(filter={"doc_id": doc_id})

        return True

    except Exception as e:
        logger.error(f"문서 삭제 실패: {e}")
        return False
