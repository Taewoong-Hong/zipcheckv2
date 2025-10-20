"""Application settings and configuration."""
from typing import Literal
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application configuration settings."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore"
    )

    # Database
    database_url: str = Field(
        ...,
        description="PostgreSQL connection URL with pgvector support"
    )

    # LLM Providers
    openai_api_key: str = Field(..., description="OpenAI API key")
    anthropic_api_key: str = Field(..., description="Anthropic API key")

    # LLM Configuration
    primary_llm: Literal["openai", "claude"] = Field(
        default="openai",
        description="Primary LLM provider"
    )
    judge_llm: Literal["openai", "claude"] = Field(
        default="claude",
        description="Judge LLM for consensus mode"
    )

    # OpenAI Model Strategy
    openai_vision_model: str = Field(
        default="gpt-4o",
        description="GPT-4o for vision/OCR + Structured Outputs (scanned PDFs)"
    )
    openai_classification_model: str = Field(
        default="gpt-4o-mini",
        description="GPT-4o-mini for fast classification/validation"
    )
    openai_analysis_model: str = Field(
        default="gpt-4o-mini",
        description="Default analysis model (can upgrade to gpt-4o for complex cases)"
    )

    # Embedding Configuration
    embed_model: str = Field(
        default="text-embedding-3-small",
        description="Embedding model: text-embedding-3-small (1536D) or -large (3072D)"
    )
    embed_dimensions: int = Field(
        default=1536,
        description="Embedding dimensions (1536 for small, 3072 for large)"
    )

    # Model Parameters
    llm_temperature: float = Field(
        default=0.2,
        ge=0.0,
        le=2.0,
        description="LLM temperature"
    )
    llm_max_tokens: int = Field(
        default=2048,
        ge=256,
        le=16384,
        description="Maximum tokens for LLM response"
    )

    # Vision API Configuration
    vision_max_tokens: int = Field(
        default=4096,
        ge=256,
        le=16384,
        description="Maximum tokens for vision API responses"
    )
    vision_detail: Literal["low", "high", "auto"] = Field(
        default="high",
        description="Vision API detail level (high for OCR, low for cost savings)"
    )

    # API Configuration
    ai_allowed_origins: str = Field(
        default="*",
        description="CORS allowed origins (comma-separated)"
    )

    # Redis (Optional)
    redis_url: str | None = Field(
        default=None,
        description="Redis URL for task queue"
    )

    # Observability
    sentry_dsn: str | None = Field(
        default=None,
        description="Sentry DSN for error tracking"
    )
    langfuse_public_key: str | None = Field(
        default=None,
        description="Langfuse public key"
    )
    langfuse_secret_key: str | None = Field(
        default=None,
        description="Langfuse secret key"
    )
    langfuse_host: str = Field(
        default="https://cloud.langfuse.com",
        description="Langfuse host URL"
    )

    # Application
    app_env: Literal["development", "staging", "production"] = Field(
        default="development",
        description="Application environment"
    )
    log_level: Literal["DEBUG", "INFO", "WARNING", "ERROR"] = Field(
        default="INFO",
        description="Logging level"
    )

    @property
    def cors_origins(self) -> list[str]:
        """Parse CORS origins from comma-separated string."""
        if self.ai_allowed_origins == "*":
            return ["*"]
        return [origin.strip() for origin in self.ai_allowed_origins.split(",")]


# Global settings instance
settings = Settings()
