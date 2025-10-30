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

    # LLM Providers (멀티 LLM 전략)
    openai_api_key: str = Field(..., description="OpenAI API key (gpt-4o, gpt-4o-mini)")
    anthropic_api_key: str | None = Field(default=None, description="Anthropic Claude API key (컨센서스 Judge)")
    gemini_api_key: str | None = Field(default=None, description="Google Gemini API key (Vision/OCR)")

    # Public Data API Keys (MVP 선택사항)
    keyword_juso_api_key: str | None = Field(default=None, description="도로명주소 검색 API 키 (행안부)")
    data_go_kr_api_key: str | None = Field(default=None, description="공공데이터포털 API 키 (국토부 실거래가)")
    building_ledger_api_key: str | None = Field(default=None, description="건축물대장 + 아파트 매매 기본 API 키 (국토부)")
    vworld_api_key: str | None = Field(default=None, description="VWorld 개별공시지가 API 키")
    vworld_domain: str | None = Field(default=None, description="VWorld API 도메인 (선택)")

    @property
    def public_data_api_key(self) -> str:
        """아파트 매매 기본 API 키 (data_go_kr_api_key와 동일 - 법정동과 함께 승인됨)."""
        return self.data_go_kr_api_key

    # OAuth Configuration (MVP 선택사항)
    # Kakao OAuth
    kakao_client_id: str | None = Field(default=None, description="카카오 클라이언트 ID")
    kakao_redirect_uri: str = Field(
        default="http://localhost:8000/api/auth/kakao/callback",
        description="카카오 리다이렉트 URI"
    )

    # Google OAuth
    google_client_id: str | None = Field(default=None, description="Google OAuth 클라이언트 ID")
    google_client_secret: str | None = Field(default=None, description="Google OAuth 클라이언트 시크릿")
    google_redirect_uri: str = Field(
        default="http://localhost:3000/auth/callback",
        description="Google OAuth 리다이렉트 URI"
    )

    # Naver OAuth
    naver_client_id: str | None = Field(default=None, description="Naver OAuth 클라이언트 ID")
    naver_client_secret: str | None = Field(default=None, description="Naver OAuth 클라이언트 시크릿")
    naver_redirect_uri: str = Field(
        default="http://localhost:3000/auth/callback",
        description="Naver OAuth 리다이렉트 URI"
    )

    # Supabase Configuration (MVP 선택사항)
    supabase_url: str | None = Field(default=None, description="Supabase 프로젝트 URL")
    supabase_anon_key: str | None = Field(default=None, description="Supabase Anonymous Key")
    supabase_service_role_key: str | None = Field(default=None, description="Supabase Service Role Key (서버 전용)")

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

    # Chat guardrail configuration
    chat_guardrail_mode: Literal["off", "soft", "hard"] = Field(
        default="soft",
        description="Guardrail mode: off (disabled), soft (nudge only), hard (block)"
    )
    guardrail_min_confidence: float = Field(
        default=0.5,
        ge=0.0,
        le=1.0,
        description="Minimum confidence threshold used in hard/soft modes"
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

    # Storage (Supabase)
    storage_bucket_artifacts: str = Field(
        default="artifacts",
        description="Supabase Storage bucket for artifacts"
    )
    storage_artifacts_path_template: str = Field(
        default="{user_id}/{contract_id}/{filename}",
        description="Path template for artifact uploads"
    )

    # Upload/Parse Security Limits
    upload_max_pdf_mb: int = Field(
        default=20,
        description="Maximum allowed PDF upload size in MB"
    )
    parse_max_download_mb: int = Field(
        default=20,
        description="Maximum allowed size for URL-based registry PDF download (MB)"
    )
    allow_parse_public_supabase_only: bool = Field(
        default=True,
        description="Restrict /parse/registry to Supabase public storage URLs only"
    )

    # Google reCAPTCHA
    recaptcha_site_key: str | None = Field(
        default=None,
        description="Google reCAPTCHA site key"
    )
    recaptcha_secret_key: str | None = Field(
        default=None,
        description="Google reCAPTCHA secret key"
    )

    @property
    def supabase_public_storage_prefix(self) -> str | None:
        if not self.supabase_url:
            return None
        return f"{self.supabase_url}/storage/v1/object/public/"

    # Internet Registry Service (IROS) Configuration - RPA 제거됨, 향후 사용 가능
    iros_user_id: str | None = Field(default=None, description="인터넷등기소 아이디 (선택)")
    iros_password: str | None = Field(default=None, description="인터넷등기소 비밀번호 (선택)")

    # Encryption
    encryption_key: str | None = Field(
        default=None,
        description="Data encryption key (AES-256)"
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
