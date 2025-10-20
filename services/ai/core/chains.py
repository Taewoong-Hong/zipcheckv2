"""LangChain LCEL chains for contract analysis."""
from typing import Any, Dict
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.runnables import Runnable
from langchain_core.output_parsers import StrOutputParser

from .llm_factory import create_llm
from .retriever import get_retriever


# Contract analysis prompt template
CONTRACT_ANALYSIS_PROMPT = """너는 부동산 계약서 리스크 점검 전문 보조원입니다.

사용자 질문: {question}

다음은 계약서에서 검색된 관련 내용입니다:
{context}

요구사항:
1. 계약서에서 발견된 잠재적 리스크를 조목조목 리스트로 정리하세요
2. 각 리스크 항목마다 다음을 포함하세요:
   - 리스크 제목 및 설명
   - 근거가 되는 계약서 내용 요약
   - 권장 조치사항
3. 법률적 단정 표현은 피하고, "검토가 필요합니다", "확인을 권장합니다" 등의 표현을 사용하세요
4. 중요한 사항은 전문가(변호사, 공인중개사) 상담을 권장하세요
5. 응답은 한국어로 작성하세요

분석 결과:"""


def build_contract_analysis_chain(
    provider: str | None = None,
    k: int = 6
) -> Runnable:
    """
    Build a chain for single-model contract analysis.

    Args:
        provider: LLM provider to use ("openai" or "claude")
        k: Number of document chunks to retrieve

    Returns:
        Runnable chain that takes {"question": str} and returns analysis string

    Example:
        >>> chain = build_contract_analysis_chain()
        >>> result = chain.invoke({"question": "계약금 관련 리스크를 분석해주세요"})
        >>> print(result)
    """
    retriever = get_retriever(k=k)
    llm = create_llm(provider=provider)
    prompt = ChatPromptTemplate.from_template(CONTRACT_ANALYSIS_PROMPT)

    def retrieve_context(inputs: Dict[str, Any]) -> Dict[str, Any]:
        """Retrieve relevant documents and format as context."""
        question = inputs["question"]
        docs = retriever.get_relevant_documents(question)

        # Format documents with truncation to avoid token limits
        context_parts = []
        for i, doc in enumerate(docs, 1):
            content = doc.page_content[:800]  # Truncate long chunks
            metadata = doc.metadata
            source_info = f"[출처 {i}]"
            if "doc_id" in metadata:
                source_info += f" 문서ID: {metadata['doc_id']}"
            if "page" in metadata:
                source_info += f", 페이지: {metadata['page']}"

            context_parts.append(f"{source_info}\n{content}")

        context = "\n\n---\n\n".join(context_parts)
        return {"context": context, "question": question}

    # Build LCEL chain
    chain = retrieve_context | prompt | llm | StrOutputParser()

    return chain


def single_model_analyze(
    question: str,
    provider: str | None = None,
    k: int = 6
) -> Dict[str, Any]:
    """
    단일 모델로 계약서를 분석하고 sources와 함께 반환합니다.

    Args:
        question: 사용자 질문
        provider: LLM provider ("openai" or "claude")
        k: 검색할 문서 청크 수

    Returns:
        {
            "answer": "분석 결과 텍스트",
            "sources": [
                {"doc_id": "...", "chunk_index": 0, "page": 1, ...},
                ...
            ]
        }

    Example:
        >>> result = single_model_analyze("임차보증금 관련 위험 요인은?")
        >>> print(result["answer"])
        >>> print(f"출처: {len(result['sources'])}개")
    """
    from .retriever import get_retriever
    from .llm_factory import create_llm

    # 1. 벡터 검색으로 관련 문서 가져오기
    retriever = get_retriever(k=k)
    docs = retriever.get_relevant_documents(question)

    # 2. 컨텍스트 생성
    context_parts = []
    sources = []

    for i, doc in enumerate(docs, 1):
        content = doc.page_content[:800]  # 토큰 제한 방지
        metadata = doc.metadata

        # 출처 정보
        source_info = f"[출처 {i}]"
        if "doc_id" in metadata:
            source_info += f" 문서ID: {metadata['doc_id']}"
        if "page" in metadata:
            source_info += f", 페이지: {metadata['page']}"

        context_parts.append(f"{source_info}\n{content}")

        # Sources 배열에 추가
        sources.append({
            "doc_id": metadata.get("doc_id"),
            "chunk_index": metadata.get("chunk_index"),
            "page": metadata.get("page"),
            "content_preview": content[:200] + "..." if len(content) > 200 else content
        })

    context = "\n\n---\n\n".join(context_parts)

    # 3. LLM 호출
    llm = create_llm(provider=provider)
    prompt = ChatPromptTemplate.from_template(CONTRACT_ANALYSIS_PROMPT)

    messages = prompt.invoke({"question": question, "context": context}).to_messages()
    response = llm.invoke(messages)

    # 4. 결과 반환
    return {
        "answer": response.content,
        "sources": sources
    }


def build_simple_chain(provider: str | None = None) -> Runnable:
    """
    Build a simple chain without RAG for testing.

    Args:
        provider: LLM provider to use

    Returns:
        Simple chain for direct LLM interaction
    """
    llm = create_llm(provider=provider)
    prompt = ChatPromptTemplate.from_template("{question}")

    return prompt | llm | StrOutputParser()
