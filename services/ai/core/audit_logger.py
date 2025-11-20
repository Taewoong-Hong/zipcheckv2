"""
감사 로그 (Audit Log) 헬퍼

v2_audit_logs 테이블에 이벤트를 기록하는 유틸리티 함수
"""
import logging
from typing import Optional, Dict, Any
from datetime import datetime
from core.supabase_client import get_supabase_client

logger = logging.getLogger(__name__)


class EventType:
    """이벤트 타입 상수"""
    # Case 관련
    CASE_CREATED = "case_created"
    CASE_UPDATED = "case_updated"
    CASE_STATE_CHANGED = "case_state_changed"

    # Registry 관련
    REGISTRY_UPLOADED = "registry_uploaded"
    REGISTRY_PARSING_START = "registry_parsing_start"
    REGISTRY_PARSING_SUCCESS = "registry_parsing_success"
    REGISTRY_PARSING_FAILED = "registry_parsing_failed"

    # Parsing 관련
    PDF_TEXT_EXTRACTION_FAILED = "pdf_text_extraction_failed"
    OCR_FAILED = "ocr_failed"
    REGEX_PARSING_LOW_CONFIDENCE = "regex_parsing_low_confidence"
    MISSING_CRITICAL_FIELDS = "missing_critical_fields"

    # Data Collection 관련
    PUBLIC_API_CALLED = "public_api_called"
    PUBLIC_API_FAILED = "public_api_failed"

    # LLM 관련
    LLM_CALLED = "llm_called"
    LLM_FAILED = "llm_failed"

    # Report 관련
    REPORT_GENERATED = "report_generated"
    REPORT_GENERATION_FAILED = "report_generation_failed"


class EventCategory:
    """이벤트 카테고리 상수"""
    CASE = "case"
    REGISTRY = "registry"
    PARSING = "parsing"
    DATA_COLLECTION = "data_collection"
    LLM = "llm"
    REPORT = "report"
    CREDIT = "credit"
    ERROR = "error"


class Severity:
    """심각도 레벨 상수"""
    DEBUG = "debug"
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"
    CRITICAL = "critical"


def log_audit_event(
    event_type: str,
    message: str,
    category: str,
    severity: str = Severity.INFO,
    user_id: Optional[str] = None,
    case_id: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None
) -> None:
    """
    감사 로그 이벤트 기록

    Args:
        event_type: 이벤트 타입 (EventType 상수 사용 권장)
        message: 이벤트 메시지
        category: 이벤트 카테고리 (EventCategory 상수 사용 권장)
        severity: 심각도 (Severity 상수 사용 권장)
        user_id: 사용자 UUID (선택)
        case_id: 케이스 UUID (선택)
        metadata: 추가 메타데이터 (선택)

    Example:
        >>> log_audit_event(
        ...     event_type=EventType.REGISTRY_PARSING_FAILED,
        ...     message="OCR 실패: 텍스트가 너무 짧음",
        ...     category=EventCategory.PARSING,
        ...     severity=Severity.ERROR,
        ...     case_id=case_id,
        ...     metadata={"text_length": 50, "min_required": 100}
        ... )
    """
    try:
        supabase = get_supabase_client(service_role=True)

        # 로그 엔트리 생성
        log_entry = {
            "event_type": event_type,
            "event_category": category,
            "message": message,
            "severity": severity,
            "user_id": user_id,
            "case_id": case_id,
            "metadata": metadata or {},
            "created_at": datetime.utcnow().isoformat()
        }

        # Supabase에 삽입
        supabase.table("v2_audit_logs").insert(log_entry).execute()

        # 로컬 로그에도 기록
        log_level = {
            Severity.DEBUG: logging.DEBUG,
            Severity.INFO: logging.INFO,
            Severity.WARNING: logging.WARNING,
            Severity.ERROR: logging.ERROR,
            Severity.CRITICAL: logging.CRITICAL
        }.get(severity, logging.INFO)

        logger.log(
            log_level,
            f"[AUDIT] {category}/{event_type}: {message} (case_id={case_id}, user_id={user_id})"
        )

    except Exception as e:
        # 감사 로그 기록 실패 시 로컬 로그에만 기록 (서비스 중단 방지)
        logger.error(f"감사 로그 기록 실패: {e}", exc_info=True)


# 편의 함수들
def log_parsing_error(
    case_id: str,
    error_message: str,
    error_type: str,
    user_id: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None
) -> None:
    """
    파싱 에러 로그 기록

    Args:
        case_id: 케이스 UUID
        error_message: 에러 메시지
        error_type: 에러 타입 (EventType 상수 사용)
        user_id: 사용자 UUID (선택)
        metadata: 추가 메타데이터 (선택)
    """
    log_audit_event(
        event_type=error_type,
        message=error_message,
        category=EventCategory.PARSING,
        severity=Severity.ERROR,
        user_id=user_id,
        case_id=case_id,
        metadata=metadata
    )


def log_parsing_success(
    case_id: str,
    message: str,
    user_id: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None
) -> None:
    """
    파싱 성공 로그 기록

    Args:
        case_id: 케이스 UUID
        message: 성공 메시지
        user_id: 사용자 UUID (선택)
        metadata: 추가 메타데이터 (선택)
    """
    log_audit_event(
        event_type=EventType.REGISTRY_PARSING_SUCCESS,
        message=message,
        category=EventCategory.PARSING,
        severity=Severity.INFO,
        user_id=user_id,
        case_id=case_id,
        metadata=metadata
    )


def log_parsing_warning(
    case_id: str,
    warning_message: str,
    user_id: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None
) -> None:
    """
    파싱 경고 로그 기록 (낮은 신뢰도, 필드 누락 등)

    Args:
        case_id: 케이스 UUID
        warning_message: 경고 메시지
        user_id: 사용자 UUID (선택)
        metadata: 추가 메타데이터 (선택)
    """
    log_audit_event(
        event_type=EventType.REGEX_PARSING_LOW_CONFIDENCE,
        message=warning_message,
        category=EventCategory.PARSING,
        severity=Severity.WARNING,
        user_id=user_id,
        case_id=case_id,
        metadata=metadata
    )
