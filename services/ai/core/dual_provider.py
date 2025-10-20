"""Dual provider wrapper with fallback and retry logic."""
import logging
from typing import Any, Callable, Literal
from tenacity import (
    retry,
    stop_after_attempt,
    wait_exponential,
    retry_if_exception_type,
)
from langchain_core.runnables import Runnable

from .llm_factory import create_llm
from .settings import settings

logger = logging.getLogger(__name__)


class ProviderError(Exception):
    """Base exception for provider errors."""
    pass


class OpenAIError(ProviderError):
    """OpenAI provider error."""
    pass


class ClaudeError(ProviderError):
    """Claude provider error."""
    pass


def create_fallback_chain(
    chain_factory: Callable[[str], Runnable],
    primary: Literal["openai", "claude"] | None = None,
) -> Runnable:
    """
    Create a chain with automatic fallback between providers.

    Args:
        chain_factory: Function that takes provider name and returns a chain
        primary: Primary provider to try first

    Returns:
        Chain with fallback logic

    Example:
        >>> def make_chain(provider):
        ...     return build_contract_analysis_chain(provider=provider)
        >>> chain = create_fallback_chain(make_chain)
        >>> result = chain.invoke({"question": "리스크 분석"})
    """
    primary = primary or settings.primary_llm
    secondary = "claude" if primary == "openai" else "openai"

    primary_chain = chain_factory(primary)
    secondary_chain = chain_factory(secondary)

    def invoke_with_fallback(inputs: dict[str, Any]) -> Any:
        """Invoke chain with fallback on provider failure."""
        try:
            logger.info(f"Attempting with primary provider: {primary}")
            return primary_chain.invoke(inputs)
        except Exception as e:
            logger.warning(
                f"Primary provider ({primary}) failed: {e}. "
                f"Falling back to {secondary}"
            )
            try:
                return secondary_chain.invoke(inputs)
            except Exception as fallback_error:
                logger.error(
                    f"Both providers failed. "
                    f"Primary: {e}, Secondary: {fallback_error}"
                )
                raise ProviderError(
                    f"All providers failed. Last error: {fallback_error}"
                ) from fallback_error

    # Create a wrapper chain
    class FallbackChain(Runnable):
        """Runnable wrapper with fallback logic."""

        def invoke(self, inputs: dict[str, Any], *args, **kwargs) -> Any:
            return invoke_with_fallback(inputs)

    return FallbackChain()


@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=2, max=10),
    retry=retry_if_exception_type((ProviderError, ConnectionError)),
)
def invoke_with_retry(chain: Runnable, inputs: dict[str, Any]) -> Any:
    """
    Invoke a chain with automatic retry on transient failures.

    Args:
        chain: Chain to invoke
        inputs: Input dictionary

    Returns:
        Chain output

    Raises:
        ProviderError: After max retries exhausted
    """
    try:
        return chain.invoke(inputs)
    except Exception as e:
        logger.error(f"Chain invocation failed: {e}")
        raise ProviderError(f"Chain invocation failed: {e}") from e
