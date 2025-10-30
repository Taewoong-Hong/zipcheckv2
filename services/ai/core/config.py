"""
환경 변수 검증 및 설정 관리

⚠️ 보안 원칙:
1. 모든 필수 환경 변수는 시작 시 검증
2. 민감한 정보는 절대 로그에 출력하지 않음
3. 개발/프로덕션 환경 분리
4. 기본값은 안전한 값으로 설정
"""

import os
import sys
import logging
from typing import Optional
from pydantic import BaseModel, Field, validator
from dotenv import load_dotenv

# .env 파일 로드
load_dotenv()

logger = logging.getLogger(__name__)


class Settings(BaseModel):
    """
    애플리케이션 설정 (환경 변수 기반)
    """

    # ============================================
    # 환경 설정
    # ============================================
    APP_ENV: str = Field(
        default="development",
        description="애플리케이션 환경 (development/production)"
    )
    LOG_LEVEL: str = Field(
        default="INFO",
        description="로그 레벨 (DEBUG/INFO/WARNING/ERROR)"
    )

    # ============================================
    # Supabase 설정
    # ============================================
    SUPABASE_URL: str = Field(
        ...,  # 필수
        description="Supabase 프로젝트 URL"
    )
    SUPABASE_ANON_KEY: Optional[str] = Field(
        default=None,
        description="Supabase Anon Key (프론트엔드용, 백엔드에서는 사용 안 함)"
    )
    SUPABASE_SERVICE_ROLE_KEY: str = Field(
        ...,  # 필수
        description="Supabase Service Role Key (백엔드 전용)"
    )
    JWT_SECRET: Optional[str] = Field(
        default=None,
        description="JWT Secret (HS256 검증용, Edge Function과 공통 사용)"
    )

    # ============================================
    # Database 설정
    # ============================================
    DATABASE_URL: str = Field(
        ...,  # 필수
        description="PostgreSQL 연결 URL (Supabase)"
    )

    # ============================================
    # OpenAI 설정
    # ============================================
    OPENAI_API_KEY: str = Field(
        ...,  # 필수
        description="OpenAI API Key"
    )
    OPENAI_MODEL: str = Field(
        default="gpt-4o-mini",
        description="사용할 OpenAI 모델"
    )
    OPENAI_EMBEDDING_MODEL: str = Field(
        default="text-embedding-3-small",
        description="임베딩 모델"
    )

    # ============================================
    # 보안 설정
    # ============================================
    ALLOWED_ORIGINS: str = Field(
        default="http://localhost:3000,https://zipcheck.kr",
        description="CORS 허용 오리진 (콤마로 구분)"
    )
    MAX_FILE_SIZE: int = Field(
        default=52428800,  # 50MB
        description="최대 파일 크기 (바이트)"
    )
    MAX_UPLOAD_FILES: int = Field(
        default=10,
        description="동시 업로드 파일 수 제한"
    )

    # ============================================
    # Rate Limiting
    # ============================================
    RATE_LIMIT_PER_MINUTE: int = Field(
        default=60,
        description="분당 API 요청 제한"
    )
    RATE_LIMIT_PER_HOUR: int = Field(
        default=1000,
        description="시간당 API 요청 제한"
    )

    # ============================================
    # AI 처리 설정
    # ============================================
    CHUNK_SIZE: int = Field(
        default=1200,
        description="텍스트 청크 크기 (토큰)"
    )
    CHUNK_OVERLAP: int = Field(
        default=150,
        description="청크 오버랩 크기 (토큰)"
    )
    EMBEDDING_BATCH_SIZE: int = Field(
        default=100,
        description="임베딩 배치 크기"
    )
    MAX_RETRIEVAL_DOCS: int = Field(
        default=6,
        description="벡터 검색 시 최대 문서 수"
    )

    # ============================================
    # 검증 로직
    # ============================================
    @validator("APP_ENV")
    def validate_app_env(cls, v):
        """환경 값 검증"""
        if v not in ["development", "production", "staging"]:
            raise ValueError(
                "APP_ENV must be 'development', 'production', or 'staging'"
            )
        return v

    @validator("LOG_LEVEL")
    def validate_log_level(cls, v):
        """로그 레벨 검증"""
        if v not in ["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"]:
            raise ValueError(
                "LOG_LEVEL must be one of: DEBUG, INFO, WARNING, ERROR, CRITICAL"
            )
        return v

    @validator("SUPABASE_URL")
    def validate_supabase_url(cls, v):
        """Supabase URL 검증"""
        if not v.startswith("https://"):
            raise ValueError("SUPABASE_URL must start with 'https://'")
        return v

    @validator("DATABASE_URL")
    def validate_database_url(cls, v):
        """Database URL 검증"""
        if not v.startswith("postgresql"):
            raise ValueError("DATABASE_URL must be a PostgreSQL connection string")
        return v

    @validator("OPENAI_API_KEY")
    def validate_openai_key(cls, v):
        """OpenAI API Key 검증"""
        if not v.startswith("sk-"):
            raise ValueError("OPENAI_API_KEY must start with 'sk-'")
        return v

    @validator("MAX_FILE_SIZE")
    def validate_max_file_size(cls, v):
        """파일 크기 제한 검증"""
        max_allowed = 100 * 1024 * 1024  # 100MB
        if v > max_allowed:
            raise ValueError(f"MAX_FILE_SIZE cannot exceed {max_allowed} bytes")
        return v

    # ============================================
    # 유틸리티 메서드
    # ============================================
    def is_production(self) -> bool:
        """프로덕션 환경 여부"""
        return self.APP_ENV == "production"

    def is_development(self) -> bool:
        """개발 환경 여부"""
        return self.APP_ENV == "development"

    def get_allowed_origins_list(self) -> list:
        """CORS 허용 오리진 리스트"""
        return [origin.strip() for origin in self.ALLOWED_ORIGINS.split(",")]

    def mask_sensitive_value(self, value: str, show_chars: int = 4) -> str:
        """민감한 값 마스킹 (로그용)"""
        if len(value) <= show_chars:
            return "***"
        return f"{value[:show_chars]}...{value[-show_chars:]}"

    class Config:
        """Pydantic 설정"""
        case_sensitive = True
        env_file = ".env"
        env_file_encoding = "utf-8"


# ============================================
# 싱글톤 설정 인스턴스
# ============================================
_settings: Optional[Settings] = None


def get_settings() -> Settings:
    """
    설정 가져오기 (싱글톤)

    Returns:
        Settings 인스턴스

    Raises:
        ValueError: 필수 환경 변수가 누락된 경우
    """
    global _settings

    if _settings is not None:
        return _settings

    try:
        _settings = Settings()
        logger.info("Settings loaded successfully")

        # 개발 환경에서만 설정 요약 출력
        if _settings.is_development():
            logger.info(f"Environment: {_settings.APP_ENV}")
            logger.info(f"Log Level: {_settings.LOG_LEVEL}")
            logger.info(
                f"Supabase URL: {_settings.SUPABASE_URL}"
            )
            logger.info(
                f"OpenAI Model: {_settings.OPENAI_MODEL}"
            )
            logger.info(
                f"Max File Size: {_settings.MAX_FILE_SIZE / 1024 / 1024:.1f}MB"
            )

        return _settings

    except Exception as e:
        logger.error(f"Failed to load settings: {e}")
        logger.error(
            "\n⚠️ 필수 환경 변수를 확인하세요:\n"
            "  - SUPABASE_URL\n"
            "  - SUPABASE_SERVICE_ROLE_KEY\n"
            "  - DATABASE_URL\n"
            "  - OPENAI_API_KEY\n"
        )
        sys.exit(1)


def validate_environment():
    """
    환경 변수 검증 (애플리케이션 시작 시 호출)

    Raises:
        SystemExit: 검증 실패 시
    """
    try:
        settings = get_settings()

        # 프로덕션 환경 추가 검증
        if settings.is_production():
            # HTTPS 필수
            if not settings.SUPABASE_URL.startswith("https://"):
                raise ValueError("Production must use HTTPS for Supabase URL")

            # Service Role Key 노출 방지
            if settings.SUPABASE_SERVICE_ROLE_KEY == settings.SUPABASE_ANON_KEY:
                raise ValueError("Service Role Key must be different from Anon Key")

            logger.info("✅ Production environment validation passed")
        else:
            logger.info("✅ Development environment validation passed")

    except Exception as e:
        logger.error(f"❌ Environment validation failed: {e}")
        sys.exit(1)


# ============================================
# 사용 예시
# ============================================
"""
from core.config import get_settings, validate_environment

# 1. 애플리케이션 시작 시 검증
validate_environment()

# 2. 설정 사용
settings = get_settings()

# 3. 개별 값 접근
openai_key = settings.OPENAI_API_KEY
max_file_size = settings.MAX_FILE_SIZE

# 4. 환경 확인
if settings.is_production():
    # 프로덕션 전용 로직
    pass

# 5. 로그용 마스킹
logger.info(f"API Key: {settings.mask_sensitive_value(settings.OPENAI_API_KEY)}")
"""
