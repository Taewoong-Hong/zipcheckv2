"""
LLM 라우터

ChatGPT (초안 생성) + Claude (검증) 듀얼 시스템
"""
import logging
from typing import Dict, List, Optional, Literal
from pydantic import BaseModel
from langchain_openai import ChatOpenAI
from langchain_anthropic import ChatAnthropic
from langchain_core.messages import HumanMessage, SystemMessage
from core.settings import settings

logger = logging.getLogger(__name__)


# ===========================
# Data Models
# ===========================
class LLMResponse(BaseModel):
    """LLM 응답"""
    content: str
    model: str
    provider: str
    tokens: Optional[int] = None


class DualAnalysisResult(BaseModel):
    """듀얼 분석 결과"""
    draft: LLMResponse  # ChatGPT 초안
    validation: LLMResponse  # Claude 검증
    final_answer: str  # 최종 답변
    confidence: float  # 신뢰도 (0.0~1.0)
    conflicts: List[str]  # 불일치 항목


# ===========================
# LLM 클라이언트
# ===========================
def get_openai_client(model: str = "gpt-4o-mini", temperature: float = 0.2) -> ChatOpenAI:
    """
    OpenAI 클라이언트 생성

    Default: gpt-4o-mini (빠르고 저렴)
    """
    return ChatOpenAI(
        model=model,
        temperature=temperature,
        max_tokens=4096,
    )


def get_claude_client(model: str = "claude-3-5-sonnet-latest", temperature: float = 0.1) -> ChatAnthropic:
    """
    Claude 클라이언트 생성

    Default: claude-3-5-sonnet (검증용)
    """
    return ChatAnthropic(
        model=model,
        temperature=temperature,
        max_tokens=4096,
    )


# ===========================
# 단일 모델 분석 (기존)
# ===========================
def single_model_analyze(
    question: str,
    context: str,
    provider: Literal["openai", "claude"] = "openai"
) -> LLMResponse:
    """
    단일 모델로 분석

    - provider: "openai" 또는 "claude"
    - context: 검색된 문서 컨텍스트
    """
    system_prompt = """너는 부동산 계약 리스크 점검 전문가이다.

사용자 질문에 대해 다음 근거 문서를 참고하여 답변하라:

{context}

요구사항:
- 계약 리스크를 조목조목 리스트로 정리
- 각 항목마다 '근거'와 '권장 조치' 포함
- 법률 단정 표현은 지양하고, "참고", "검토", "전문가 상담" 등으로 권장
- 출처 정보는 절대 노출하지 말 것
"""

    if provider == "openai":
        llm = get_openai_client()
    else:
        llm = get_claude_client()

    messages = [
        SystemMessage(content=system_prompt.format(context=context)),
        HumanMessage(content=question),
    ]

    response = llm.invoke(messages)

    return LLMResponse(
        content=response.content,
        model=llm.model_name,
        provider=provider,
        tokens=response.response_metadata.get("token_usage", {}).get("total_tokens"),
    )


# ===========================
# 듀얼 시스템 분석 (ChatGPT → Claude)
# ===========================
def dual_model_analyze(
    question: str,
    context: str,
    draft_model: str = "gpt-4o-mini",
    judge_model: str = "claude-3-5-sonnet-latest"
) -> DualAnalysisResult:
    """
    듀얼 시스템 분석

    1. ChatGPT로 초안 생성
    2. Claude로 초안 검증
    3. 불일치 항목 추출
    4. 최종 답변 생성
    """
    logger.info(f"듀얼 분석 시작: draft={draft_model}, judge={judge_model}")

    # Step 1: ChatGPT 초안 생성
    draft_prompt = """너는 부동산 계약 리스크 점검 전문가이다.

사용자 질문에 대해 다음 근거 문서를 참고하여 초안을 작성하라:

{context}

요구사항:
- 계약 리스크를 조목조목 리스트로 정리
- 각 항목마다 '근거'와 '권장 조치' 포함
- 법률 단정 표현은 지양하고, "참고", "검토", "전문가 상담" 등으로 권장
"""

    draft_llm = ChatOpenAI(model=draft_model, temperature=0.3, max_tokens=4096)
    draft_messages = [
        SystemMessage(content=draft_prompt.format(context=context)),
        HumanMessage(content=question),
    ]
    draft_response = draft_llm.invoke(draft_messages)
    draft = LLMResponse(
        content=draft_response.content,
        model=draft_model,
        provider="openai",
        tokens=draft_response.response_metadata.get("token_usage", {}).get("total_tokens"),
    )

    logger.info(f"초안 생성 완료 ({draft.tokens} tokens)")

    # Step 2: Claude 검증
    judge_prompt = """너는 부동산 계약 리스크 점검 검증자이다.

다음은 ChatGPT가 생성한 초안이다:

{draft}

이 초안을 다음 관점에서 검증하라:
1. 사실 관계의 정확성
2. 법률적 표현의 적절성
3. 누락된 중요 리스크
4. 권장 조치의 실효성

검증 결과를 다음 형식으로 작성하라:

### 검증 결과
- 정확한 내용: ...
- 수정 필요: ...
- 추가 필요: ...

### 최종 권장사항
...
"""

    judge_llm = ChatAnthropic(model=judge_model, temperature=0.1, max_tokens=4096)
    judge_messages = [
        SystemMessage(content=judge_prompt.format(draft=draft.content)),
        HumanMessage(content=question),
    ]
    try:
        judge_response = judge_llm.invoke(judge_messages)
    except Exception as e:
        msg = str(e)
        if "NotFound" in msg or "not_found_error" in msg or "model:" in msg:
            fallback_model = "claude-3-5-haiku-latest"
            logger.warning(
                f"Judge model '{judge_model}' unavailable. Falling back to '{fallback_model}'."
            )
            judge_llm = ChatAnthropic(model=fallback_model, temperature=0.1, max_tokens=4096)
            judge_response = judge_llm.invoke(judge_messages)
            judge_model = fallback_model
        else:
            raise
    validation = LLMResponse(
        content=judge_response.content,
        model=judge_model,
        provider="claude",
        tokens=judge_response.response_metadata.get("usage", {}).get("total_tokens"),
    )

    logger.info(f"검증 완료 ({validation.tokens} tokens)")

    # Step 3: 불일치 항목 추출 (간단한 휴리스틱)
    conflicts = []
    if "수정 필요" in validation.content:
        conflicts.append("Claude가 초안에 수정이 필요하다고 판단했습니다.")
    if "추가 필요" in validation.content:
        conflicts.append("Claude가 누락된 항목이 있다고 판단했습니다.")

    # Step 4: 최종 답변 생성
    if len(conflicts) == 0:
        # 불일치 없음 → 초안 그대로 사용
        final_answer = draft.content
        confidence = 0.95
    else:
        # 불일치 있음 → 검증 결과 포함
        final_answer = f"""### ChatGPT 초안
{draft.content}

### Claude 검증 의견
{validation.content}

⚠️ 두 모델 간 견해 차이가 있습니다. 최종 판단은 법무사 또는 변호사와 상담하세요.
"""
        confidence = 0.75

    logger.info(f"듀얼 분석 완료: confidence={confidence}, conflicts={len(conflicts)}")

    return DualAnalysisResult(
        draft=draft,
        validation=validation,
        final_answer=final_answer,
        confidence=confidence,
        conflicts=conflicts,
    )


# ===========================
# 스트리밍 응답 (향후 구현)
# ===========================
async def stream_dual_analysis(
    question: str,
    context: str
):
    """
    듀얼 분석 스트리밍 버전

    TODO: Phase 2에서 구현
    - ChatGPT 스트리밍 → 실시간 표시
    - Claude 검증 → 후속 스트리밍
    """
    pass


# ===========================
# 예시 사용법 (테스트용)
# ===========================
if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)

    # 예시 컨텍스트
    context = """
    제1조 (목적) 본 계약은 전세권 설정을 목적으로 한다.
    제2조 (계약금액) 전세금은 금 500,000,000원으로 한다.
    제3조 (특약사항) 임대인은 계약 만료 시 전세금 전액을 반환한다.
    """

    question = "이 전세 계약의 리스크는 무엇인가요?"

    # 듀얼 분석 실행
    result = dual_model_analyze(question, context)

    print("=== 듀얼 분석 결과 ===")
    print(f"신뢰도: {result.confidence * 100:.1f}%")
    print(f"불일치 항목: {len(result.conflicts)}개")
    print(f"\n최종 답변:\n{result.final_answer}")
