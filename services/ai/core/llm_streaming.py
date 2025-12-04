"""
ZipCheck AI - LLM 스트리밍 모듈

듀얼 LLM 병렬 스트리밍 로직 (GPT-4o-mini + Claude Sonnet)

이 모듈은 두 가지 LLM을 병렬로 실행하여:
1. GPT-4o-mini: 빠른 초안 생성
2. Claude Sonnet: 초안 검증 및 개선

Architecture:
- stream_gpt_draft(): GPT-4o-mini 초안 생성
- stream_claude_validation(): Claude Sonnet 검증
- merge_dual_streams(): 두 스트림을 병렬로 실행하고 SSE 이벤트 머지
- dual_stream_analysis(): 통합 래퍼 함수 (conflicts 감지 포함)
"""
import asyncio
import json
import logging
from typing import AsyncGenerator, Callable, Dict, Any, Tuple, Optional, List
from langchain_openai import ChatOpenAI
from langchain_anthropic import ChatAnthropic
from langchain_core.messages import HumanMessage
from core.prompts import build_judge_prompt

logger = logging.getLogger(__name__)


# ===========================
# 타입 변환 헬퍼 함수
# ===========================
def ensure_text(content: Any) -> str:
    """
    LangChain 응답의 content를 안전하게 문자열로 변환
    
    LangChain이 str 말고 list/fragment로 줄 수도 있으니 방어적으로 처리
    
    Args:
        content: LangChain 응답의 content (str | list[str | dict[str, Any]])
    
    Returns:
        str: 변환된 문자열
    """
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        # 예: ["문장1", "문장2"] 혹은 [{"type": "text", "text": "..."}, ...]
        parts: List[str] = []
        for item in content:
            if isinstance(item, str):
                parts.append(item)
            elif isinstance(item, dict):
                # 텍스트 필드가 있으면 우선 사용
                text = item.get("text") or item.get("content") or ""
                if text:
                    parts.append(str(text))
            else:
                parts.append(str(item))
        return "".join(parts)
    # 기타 타입은 그냥 str로
    return str(content)


# ===========================
# 개별 LLM 스트리밍 함수
# ===========================
async def stream_gpt_draft(llm_prompt: str) -> AsyncGenerator[Dict[str, Any], None]:
    """
    GPT-4o-mini 초안 생성 스트리밍

    Args:
        llm_prompt: LLM에 전달할 프롬프트 (분석 컨텍스트 포함)

    Yields:
        Dict with keys:
        - phase: 'draft'
        - model: 'gpt-4o-mini'
        - content: 생성된 텍스트 조각
        - total_length: 현재까지 생성된 총 길이
        - done: 완료 여부
        - final_content: (done=True일 때) 최종 전체 텍스트
        - error: (에러 시) 에러 메시지
    """
    llm_draft = ChatOpenAI(
        model="gpt-4o-mini",
        temperature=0.3,
        streaming=True
    )
    draft_content = ""
    chunk_count = 0

    try:
        async for chunk in llm_draft.astream([HumanMessage(content=llm_prompt)]):
            if hasattr(chunk, 'content') and chunk.content:
                draft_content += ensure_text(chunk.content)
                chunk_count += 1

                # 이벤트 전송 (phase='draft', model='gpt-4o-mini')
                if chunk_count % 5 == 0:  # 더 자주 업데이트
                    yield {
                        'phase': 'draft',
                        'model': 'gpt-4o-mini',
                        'content': chunk.content,
                        'total_length': len(draft_content),
                        'done': False
                    }

        # 완료 이벤트
        yield {
            'phase': 'draft',
            'model': 'gpt-4o-mini',
            'content': '',
            'total_length': len(draft_content),
            'done': True,
            'final_content': draft_content
        }

    except Exception as e:
        logger.error(f"GPT 초안 생성 실패: {e}")
        yield {
            'phase': 'draft',
            'model': 'gpt-4o-mini',
            'error': str(e),
            'done': True
        }


async def stream_claude_validation(draft_content: str) -> AsyncGenerator[Dict[str, Any], None]:
    """
    Claude Sonnet 검증 스트리밍 (초안 기반)

    Args:
        draft_content: GPT-4o-mini가 생성한 초안 텍스트

    Yields:
        Dict with keys:
        - phase: 'validation'
        - model: 'claude-3-5-sonnet' or 'claude-3-5-haiku' (fallback)
        - content: 검증 텍스트 조각
        - total_length: 현재까지 생성된 총 길이
        - done: 완료 여부
        - final_content: (done=True일 때) 최종 검증 텍스트
        - error: (에러 시) 에러 메시지

    Note:
        - 초안이 충분히 생성될 때까지 3초 대기
        - 초안이 2000자를 초과하면 앞 2000자만 사용
        - Claude Sonnet 실패 시 자동으로 Haiku로 폴백
    """
    # 초안이 충분히 생성될 때까지 대기
    await asyncio.sleep(3)

    judge_prompt = build_judge_prompt(draft_content)

    llm_judge = ChatAnthropic(
        model_name="claude-3-5-sonnet-latest",
        temperature=0.1,
        streaming=True,
        timeout=60,
        stop=None
    )
    validation_content = ""
    chunk_count = 0

    try:
        async for chunk in llm_judge.astream([HumanMessage(content=judge_prompt)]):
            if hasattr(chunk, 'content') and chunk.content:
                validation_content += ensure_text(chunk.content)
                chunk_count += 1

                # 이벤트 전송 (phase='validation', model='claude-3-5-sonnet')
                if chunk_count % 5 == 0:
                    yield {
                        'phase': 'validation',
                        'model': 'claude-3-5-sonnet',
                        'content': chunk.content,
                        'total_length': len(validation_content),
                        'done': False
                    }

        # 완료 이벤트
        yield {
            'phase': 'validation',
            'model': 'claude-3-5-sonnet',
            'content': '',
            'total_length': len(validation_content),
            'done': True,
            'final_content': validation_content
        }

    except Exception as e:
        msg = str(e)
        # Fallback to Haiku
        if "NotFound" in msg or "not_found_error" in msg or "model:" in msg:
            logger.warning("Claude Sonnet 실패, Haiku로 폴백")

            llm_haiku = ChatAnthropic(
                model_name="claude-3-5-haiku-latest",
                temperature=0.1,
                streaming=True,
                timeout=60,
                stop=None
            )
            validation_content = ""

            async for chunk in llm_haiku.astream([HumanMessage(content=judge_prompt)]):
                if hasattr(chunk, 'content') and chunk.content:
                    validation_content += ensure_text(chunk.content)

                    if chunk_count % 5 == 0:
                        yield {
                            'phase': 'validation',
                            'model': 'claude-3-5-haiku',
                            'content': chunk.content,
                            'total_length': len(validation_content),
                            'done': False
                        }

            yield {
                'phase': 'validation',
                'model': 'claude-3-5-haiku',
                'done': True,
                'final_content': validation_content
            }
        else:
            logger.error(f"Claude 검증 실패: {e}")
            yield {
                'phase': 'validation',
                'model': 'claude-3-5-sonnet',
                'error': str(e),
                'done': True
            }


# ===========================
# 병렬 스트리밍 오케스트레이션
# ===========================
async def merge_dual_streams(
    draft_generator: AsyncGenerator[Dict[str, Any], None],
    validation_generator_factory: Callable[[str], AsyncGenerator[Dict[str, Any], None]],
    step_base: float = 6.0,
    progress_base: float = 0.78
) -> AsyncGenerator[str | Tuple[str, str, Optional[Dict[str, Any]]], None]:
    """
    듀얼 LLM 병렬 스트리밍 이벤트 머지
    """
    draft_content = ""
    validation_content = ""
    draft_done = False
    validation_done = False
    last_validation_event: Optional[Dict[str, Any]] = None

    draft_gen = draft_generator
    validation_gen = None
    draft_start_time = asyncio.get_event_loop().time()

    while not (draft_done and validation_done):
        try:
            # GPT 초안 스트림 처리
            if not draft_done:
                try:
                    draft_event = await asyncio.wait_for(draft_gen.__anext__(), timeout=0.1)

                    if draft_event.get("done"):
                        draft_done = True
                        draft_content = draft_event.get("final_content", draft_content)

                        message = f"✅ GPT-4o-mini 초안 완료 ({len(draft_content)}자)"
                        payload = {
                            "step": step_base + 0.1,
                            "phase": "draft",
                            "model": "gpt-4o-mini",
                            "message": message,
                            "progress": progress_base + 0.04,
                            "draft_length": len(draft_content),
                        }
                        yield f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"

                        # Claude 검증 시작
                        if validation_gen is None:
                            validation_gen = validation_generator_factory(draft_content)
                            payload = {
                                "step": step_base + 0.2,
                                "phase": "validation",
                                "message": "🔍 Claude Sonnet 검증 시작...",
                                "progress": progress_base + 0.05,
                            }
                            yield f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"
                    else:
                        total_length = draft_event.get("total_length", 0)
                        if total_length > 0 and total_length % 100 == 0:
                            message = f"📝 초안 생성 중... ({total_length}자)"
                            payload = {
                                "step": step_base + 0.1,
                                "phase": "draft",
                                "model": "gpt-4o-mini",
                                "message": message,
                                "progress": progress_base
                                + min(total_length / 2000, 1) * 0.04,
                                "partial_length": total_length,
                            }
                            yield f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"

                except asyncio.TimeoutError:
                    pass
                except StopAsyncIteration:
                    draft_done = True

            # Claude 검증 스트림 처리
            if validation_gen is not None and not validation_done:
                try:
                    validation_event = await asyncio.wait_for(
                        validation_gen.__anext__(), timeout=0.1
                    )
                    last_validation_event = validation_event

                    if validation_event.get("done"):
                        validation_done = True
                        validation_content = validation_event.get(
                            "final_content", validation_content
                        )

                        model_name = validation_event.get(
                            "model", "claude-3-5-sonnet"
                        )
                        message = f"✅ {model_name} 검증 완료 ({len(validation_content)}자)"
                        payload = {
                            "step": step_base + 0.2,
                            "phase": "validation",
                            "model": model_name,
                            "message": message,
                            "progress": progress_base + 0.10,
                            "validation_length": len(validation_content),
                        }
                        yield f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"
                    else:
                        total_length = validation_event.get("total_length", 0)
                        if total_length > 0 and total_length % 100 == 0:
                            model_name = validation_event.get(
                                "model", "claude-3-5-sonnet"
                            )
                            message = f"🔍 검증 중... ({total_length}자)"
                            payload = {
                                "step": step_base + 0.2,
                                "phase": "validation",
                                "model": model_name,
                                "message": message,
                                "progress": progress_base
                                + 0.06
                                + min(total_length / 2000, 1) * 0.04,
                                "partial_length": total_length,
                            }
                            yield f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"

                except asyncio.TimeoutError:
                    pass
                except StopAsyncIteration:
                    validation_done = True

            # 병렬 검증 시작 (초안 시작 3초 후)
            if validation_gen is None and (
                asyncio.get_event_loop().time() - draft_start_time
            ) > 3:
                if draft_content:
                    validation_gen = validation_generator_factory(draft_content)
                    payload = {
                        "step": step_base + 0.2,
                        "phase": "validation",
                        "message": "🔍 Claude Sonnet 검증 시작 (병렬)...",
                        "progress": progress_base + 0.05,
                    }
                    yield f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"

            await asyncio.sleep(0.05)

        except Exception as e:
            logger.error(f"병렬 스트리밍 루프 오류: {e}")
            break

    # 최종 결과를 tuple로 yield (async generator는 return 불가)
    yield (draft_content, validation_content, last_validation_event)  # type: ignore

# ===========================
# 통합 래퍼 함수
# ===========================
async def dual_stream_analysis(
    llm_prompt: str,
    step_base: float = 6.0,
    progress_base: float = 0.78
) -> AsyncGenerator[str | Tuple[str, str, float, List[str]], None]:
    """
    듀얼 LLM 병렬 스트리밍 분석 (통합 래퍼)

    GPT-4o-mini 초안 생성과 Claude Sonnet 검증을 병렬로 실행하고,
    SSE 이벤트를 스트리밍합니다. 최종적으로 conflicts를 감지하고
    confidence를 계산합니다.

    Args:
        llm_prompt: LLM에 전달할 분석 프롬프트
        step_base: SSE 이벤트 step 기준값 (기본값: 6.0)
        progress_base: SSE 이벤트 progress 기준값 (기본값: 0.78)

    Yields:
        SSE 이벤트 문자열 (data: {...}\n\n)

    Returns:
        최종 yield: Tuple[str, str, float, List[str]]
        - draft_content: 완성된 GPT 초안
        - validation_content: 완성된 Claude 검증
        - confidence: 신뢰도 (0.0~1.0)
        - conflicts: 불일치 항목 리스트

    Example:
        ```python
        async for event in dual_stream_analysis(prompt):
            if isinstance(event, str):
                # SSE 이벤트 전송
                yield event
            else:
                # 최종 결과 (tuple)
                draft, validation, confidence, conflicts = event
        ```
    """
    # Step 1: 병렬 스트리밍 실행
    draft_gen = stream_gpt_draft(llm_prompt)
    validation_factory = stream_claude_validation

    async for event in merge_dual_streams(
        draft_generator=draft_gen,
        validation_generator_factory=validation_factory,
        step_base=step_base,
        progress_base=progress_base
    ):
        # SSE 이벤트는 그대로 전달
        if isinstance(event, str):
            yield event
        else:
            # 최종 결과 (tuple) 처리
            draft_content, validation_content, last_validation_event = event

            # Step 2: Conflicts 감지
            conflicts = []
            if "수정 필요" in validation_content:
                conflicts.append("Claude가 초안에 수정이 필요하다고 판단했습니다.")
            if "추가 필요" in validation_content:
                conflicts.append("Claude가 누락된 항목이 있다고 판단했습니다.")

            # Step 3: Confidence 계산
            if len(conflicts) == 0:
                confidence = 0.95
            else:
                confidence = 0.75

            # 최종 결과를 tuple로 yield
            yield (draft_content, validation_content, confidence, conflicts)


# ===========================
# Non-Streaming Wrapper (Background Tasks)
# ===========================
async def simple_llm_analysis(
    llm_prompt: str,
    model: str = "gpt-4o-mini",
    max_retries: int = 3,
    temperature: float = 0.3,
    max_tokens: int = 4096,
    timeout: int = 30
) -> str:
    """
    백그라운드 작업용 Non-Streaming LLM 분석

    SSE 스트리밍 오버헤드 없이 백그라운드 처리를 위한 간단한 재시도 로직입니다.
    routes에 중복되어 있던 LLM 호출 로직을 중앙화합니다.

    Args:
        llm_prompt: 분석할 LLM 프롬프트
        model: OpenAI 모델 이름 (기본값: gpt-4o-mini)
        max_retries: 재시도 횟수 (기본값: 3)
        temperature: LLM temperature (기본값: 0.3)
        max_tokens: 생성할 최대 토큰 수 (기본값: 4096)
        timeout: 요청 타임아웃 (초 단위, 기본값: 30)

    Returns:
        최종 LLM 응답 내용

    Raises:
        HTTPException: 모든 재시도 실패 시

    Example:
        ```python
        from core.llm_streaming import simple_llm_analysis

        # 백그라운드 작업
        final_answer = await simple_llm_analysis(prompt)
        ```
    """
    from fastapi import HTTPException

    llm = ChatOpenAI(
        model=model,
        temperature=temperature,
        max_retries=0,  # 재시도는 수동으로 처리
        timeout=timeout
    )
    messages = [HumanMessage(content=llm_prompt)]

    last_err = None
    for attempt in range(1, max_retries + 1):
        try:
            response = llm.invoke(messages)
            final_content = ensure_text(response.content)
            logger.info(f"LLM 해석 완료 (시도 {attempt}): {len(final_content)}자")
            return final_content
        except Exception as e:
            last_err = e
            logger.warning(f"LLM 호출 시도 {attempt} 실패: {e}")
            if attempt < max_retries:
                # 지수 백오프: 1초, 2초, 3초
                await asyncio.sleep(min(1 * attempt, 3))

    # 모든 재시도 실패
    logger.error(f"LLM 호출 전체 실패 ({max_retries}회 시도): {last_err}")
    raise HTTPException(503, "분석이 지연됩니다. 잠시 후 다시 시도해주세요.")
