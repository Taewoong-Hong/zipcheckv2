"""LLM factory for creating OpenAI and Claude instances."""
from typing import Literal
from langchain_openai import ChatOpenAI
from langchain_anthropic import ChatAnthropic
from langchain_core.language_models import BaseChatModel

from .settings import settings


# Model Type for specialized use cases
ModelType = Literal["vision", "classification", "analysis", "judge"]


def create_llm(
    provider: Literal["openai", "claude"] | None = None,
    temperature: float | None = None,
    max_tokens: int | None = None,
    model_name: str | None = None,
    model_type: ModelType | None = None,
) -> BaseChatModel:
    """
    Create an LLM instance based on provider and model type.

    Args:
        provider: LLM provider ("openai" or "claude"). Defaults to settings.primary_llm
        temperature: Temperature for generation. Defaults to settings.llm_temperature
        max_tokens: Max tokens for response. Defaults to settings.llm_max_tokens
        model_name: Specific model name. Uses model_type defaults if not specified
        model_type: Specialized model type for automatic model selection

    Returns:
        Configured LLM instance

    Raises:
        ValueError: If provider is invalid or API key is missing

    Examples:
        >>> # Auto-select GPT-4o for vision tasks
        >>> llm = create_llm(model_type="vision")
        >>>
        >>> # Auto-select GPT-4o-mini for classification
        >>> llm = create_llm(model_type="classification")
        >>>
        >>> # Use specific model override
        >>> llm = create_llm(model_name="gpt-4o", temperature=0.0)
    """
    provider = provider or settings.primary_llm
    temperature = temperature if temperature is not None else settings.llm_temperature
    max_tokens = max_tokens if max_tokens is not None else settings.llm_max_tokens

    # Auto-select model based on model_type if model_name not specified
    if not model_name and model_type:
        if provider == "openai":
            model_name = _get_openai_model_by_type(model_type)
        # For claude, use default models for now

    if provider == "openai":
        # Use vision-specific max_tokens if model_type is vision
        if model_type == "vision" and max_tokens == settings.llm_max_tokens:
            max_tokens = settings.vision_max_tokens

        return ChatOpenAI(
            model=model_name or settings.openai_analysis_model,
            temperature=temperature,
            max_tokens=max_tokens,
            api_key=settings.openai_api_key,
            max_retries=0,
            timeout=30,
        )
    elif provider == "claude":
        return ChatAnthropic(
            model=model_name or "claude-3-5-sonnet-20241022",
            temperature=temperature,
            max_tokens=max_tokens,
            api_key=settings.anthropic_api_key,
            max_retries=0,
            timeout=30,
        )
    else:
        raise ValueError(f"Unsupported provider: {provider}")


def _get_openai_model_by_type(model_type: ModelType) -> str:
    """
    Get OpenAI model name based on model type.

    Args:
        model_type: Type of model needed

    Returns:
        Model name string
    """
    if model_type == "vision":
        return settings.openai_vision_model
    elif model_type == "classification":
        return settings.openai_classification_model
    elif model_type == "analysis":
        return settings.openai_analysis_model
    elif model_type == "judge":
        return settings.openai_classification_model  # Use fast model for judging
    else:
        return settings.openai_analysis_model


def create_judge_llm() -> BaseChatModel:
    """
    Create a judge LLM for consensus mode.

    Returns:
        Configured judge LLM instance
    """
    return create_llm(
        provider=settings.judge_llm,
        temperature=0.1,  # Lower temperature for more consistent judging
    )
