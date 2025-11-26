"""
집체크 Analysis Lab - Event Logger

개발자용 디버깅 이벤트 로깅 시스템.
각 단계의 실행을 추적하고 상세한 에러 컨텍스트를 캡처합니다.
"""
import logging
import json
import traceback
from datetime import datetime
from typing import Any, Dict, Optional, List
from enum import Enum
from pydantic import BaseModel
from core.supabase_client import get_supabase_client


# Configure dedicated logger for dev analysis
analysis_logger = logging.getLogger("analysis_lab")
analysis_logger.setLevel(logging.DEBUG)

# Console handler with detailed format
console_handler = logging.StreamHandler()
console_handler.setLevel(logging.DEBUG)
formatter = logging.Formatter(
    '%(asctime)s - [%(levelname)s] - %(name)s - Step:%(funcName)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
console_handler.setFormatter(formatter)
analysis_logger.addHandler(console_handler)


# ===========================
# Event Types
# ===========================
class EventType(str, Enum):
    """이벤트 타입"""
    # Step Events
    STEP_STARTED = "step_started"
    STEP_COMPLETED = "step_completed"
    STEP_FAILED = "step_failed"

    # Data Events
    DATA_FETCHED = "data_fetched"
    DATA_PARSED = "data_parsed"
    DATA_VALIDATION_FAILED = "data_validation_failed"

    # API Events
    API_CALLED = "api_called"
    API_SUCCESS = "api_success"
    API_FAILED = "api_failed"
    API_RETRY = "api_retry"

    # Error Events
    ERROR_CAUGHT = "error_caught"
    ERROR_RECOVERED = "error_recovered"

    # Performance Events
    SLOW_OPERATION = "slow_operation"
    MEMORY_WARNING = "memory_warning"


class EventSeverity(str, Enum):
    """이벤트 심각도"""
    DEBUG = "debug"
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"
    CRITICAL = "critical"


# ===========================
# Event Model
# ===========================
class AnalysisEvent(BaseModel):
    """분석 이벤트 모델"""
    event_id: str
    case_id: str
    step_name: str
    event_type: EventType
    severity: EventSeverity
    message: str
    timestamp: datetime
    execution_time_ms: Optional[int] = None
    metadata: Dict[str, Any] = {}
    error_details: Optional[Dict[str, Any]] = None
    stack_trace: Optional[str] = None


# ===========================
# Event Logger Class
# ===========================
class DevEventLogger:
    """개발 환경 이벤트 로거"""

    def __init__(self):
        self.events: List[AnalysisEvent] = []
        self.case_events: Dict[str, List[AnalysisEvent]] = {}

    def log_event(
        self,
        case_id: str,
        step_name: str,
        event_type: EventType,
        message: str,
        severity: EventSeverity = EventSeverity.INFO,
        execution_time_ms: Optional[int] = None,
        metadata: Optional[Dict[str, Any]] = None,
        error: Optional[Exception] = None
    ) -> AnalysisEvent:
        """이벤트 로깅"""
        event = AnalysisEvent(
            event_id=f"{case_id}_{datetime.utcnow().timestamp()}",
            case_id=case_id,
            step_name=step_name,
            event_type=event_type,
            severity=severity,
            message=message,
            timestamp=datetime.utcnow(),
            execution_time_ms=execution_time_ms,
            metadata=metadata or {},
            error_details=self._extract_error_details(error) if error else None,
            stack_trace=traceback.format_exc() if error else None
        )

        # Store in memory
        self.events.append(event)
        if case_id not in self.case_events:
            self.case_events[case_id] = []
        self.case_events[case_id].append(event)

        # Log to console
        self._log_to_console(event)

        # Optionally persist to database
        self._persist_event(event)

        return event

    def log_step_start(self, case_id: str, step_name: str, metadata: Optional[Dict] = None):
        """단계 시작 로깅"""
        return self.log_event(
            case_id=case_id,
            step_name=step_name,
            event_type=EventType.STEP_STARTED,
            message=f"{step_name} 시작",
            severity=EventSeverity.INFO,
            metadata=metadata
        )

    def log_step_complete(
        self,
        case_id: str,
        step_name: str,
        execution_time_ms: int,
        result: Optional[Dict] = None
    ):
        """단계 완료 로깅"""
        metadata = {"result_summary": self._summarize_result(result)} if result else {}
        return self.log_event(
            case_id=case_id,
            step_name=step_name,
            event_type=EventType.STEP_COMPLETED,
            message=f"{step_name} 완료 ({execution_time_ms}ms)",
            severity=EventSeverity.INFO,
            execution_time_ms=execution_time_ms,
            metadata=metadata
        )

    def log_step_error(
        self,
        case_id: str,
        step_name: str,
        error: Exception,
        execution_time_ms: Optional[int] = None
    ):
        """단계 에러 로깅"""
        return self.log_event(
            case_id=case_id,
            step_name=step_name,
            event_type=EventType.STEP_FAILED,
            message=f"{step_name} 실패: {str(error)}",
            severity=EventSeverity.ERROR,
            execution_time_ms=execution_time_ms,
            error=error
        )

    def log_api_call(
        self,
        case_id: str,
        step_name: str,
        api_name: str,
        params: Optional[Dict] = None
    ):
        """API 호출 로깅"""
        return self.log_event(
            case_id=case_id,
            step_name=step_name,
            event_type=EventType.API_CALLED,
            message=f"API 호출: {api_name}",
            severity=EventSeverity.DEBUG,
            metadata={"api": api_name, "params": params}
        )

    def log_api_response(
        self,
        case_id: str,
        step_name: str,
        api_name: str,
        status_code: Optional[int] = None,
        response_time_ms: Optional[int] = None,
        success: bool = True
    ):
        """API 응답 로깅"""
        event_type = EventType.API_SUCCESS if success else EventType.API_FAILED
        severity = EventSeverity.DEBUG if success else EventSeverity.WARNING

        return self.log_event(
            case_id=case_id,
            step_name=step_name,
            event_type=event_type,
            message=f"API 응답: {api_name} ({'성공' if success else '실패'})",
            severity=severity,
            execution_time_ms=response_time_ms,
            metadata={"api": api_name, "status_code": status_code}
        )

    def log_slow_operation(
        self,
        case_id: str,
        step_name: str,
        operation: str,
        execution_time_ms: int,
        threshold_ms: int = 5000
    ):
        """느린 작업 경고 로깅"""
        if execution_time_ms > threshold_ms:
            return self.log_event(
                case_id=case_id,
                step_name=step_name,
                event_type=EventType.SLOW_OPERATION,
                message=f"느린 작업 감지: {operation} ({execution_time_ms}ms > {threshold_ms}ms)",
                severity=EventSeverity.WARNING,
                execution_time_ms=execution_time_ms,
                metadata={"operation": operation, "threshold_ms": threshold_ms}
            )

    def get_case_events(self, case_id: str) -> List[AnalysisEvent]:
        """특정 케이스의 모든 이벤트 조회"""
        return self.case_events.get(case_id, [])

    def get_error_events(self, case_id: Optional[str] = None) -> List[AnalysisEvent]:
        """에러 이벤트만 조회"""
        events = self.case_events.get(case_id, self.events) if case_id else self.events
        return [e for e in events if e.severity in [EventSeverity.ERROR, EventSeverity.CRITICAL]]

    def export_events(self, case_id: Optional[str] = None, format: str = "json") -> str:
        """이벤트 내보내기"""
        events = self.case_events.get(case_id, self.events) if case_id else self.events

        if format == "json":
            return json.dumps(
                [e.dict() for e in events],
                default=str,
                ensure_ascii=False,
                indent=2
            )
        elif format == "text":
            lines = []
            for e in events:
                lines.append(f"[{e.timestamp}] [{e.severity}] {e.step_name}: {e.message}")
                if e.metadata:
                    lines.append(f"  Metadata: {json.dumps(e.metadata, ensure_ascii=False)}")
                if e.error_details:
                    lines.append(f"  Error: {e.error_details}")
            return "\n".join(lines)
        else:
            raise ValueError(f"Unsupported format: {format}")

    # ===========================
    # Private Methods
    # ===========================
    def _extract_error_details(self, error: Exception) -> Dict[str, Any]:
        """에러 상세 정보 추출"""
        return {
            "type": error.__class__.__name__,
            "message": str(error),
            "args": error.args if hasattr(error, 'args') else None,
            "attributes": {
                k: v for k, v in error.__dict__.items()
                if not k.startswith('_') and isinstance(v, (str, int, float, bool, list, dict))
            } if hasattr(error, '__dict__') else {}
        }

    def _summarize_result(self, result: Any) -> Dict[str, Any]:
        """결과 요약"""
        if isinstance(result, dict):
            return {
                "keys": list(result.keys()),
                "size": len(str(result)),
                "sample": {k: v for k, v in list(result.items())[:3]}
            }
        elif isinstance(result, list):
            return {
                "count": len(result),
                "size": len(str(result)),
                "sample": result[:3] if result else []
            }
        else:
            return {"type": type(result).__name__, "value": str(result)[:100]}

    def _log_to_console(self, event: AnalysisEvent):
        """콘솔 로깅"""
        log_message = f"[{event.step_name}] {event.message}"

        if event.metadata:
            log_message += f" | Metadata: {json.dumps(event.metadata, ensure_ascii=False)}"

        if event.severity == EventSeverity.DEBUG:
            analysis_logger.debug(log_message)
        elif event.severity == EventSeverity.INFO:
            analysis_logger.info(log_message)
        elif event.severity == EventSeverity.WARNING:
            analysis_logger.warning(log_message)
        elif event.severity == EventSeverity.ERROR:
            analysis_logger.error(log_message)
        elif event.severity == EventSeverity.CRITICAL:
            analysis_logger.critical(log_message)

    def _persist_event(self, event: AnalysisEvent):
        """이벤트를 데이터베이스에 저장 (선택적)"""
        try:
            # 개발 환경에서만 로깅 (v2_dev_events 테이블 사용)
            supabase = get_supabase_client(service_role=True)

            # Check if table exists and insert
            supabase.table("v2_dev_events").insert({
                "event_id": event.event_id,
                "case_id": event.case_id,
                "step_name": event.step_name,
                "event_type": event.event_type,
                "severity": event.severity,
                "message": event.message,
                "execution_time_ms": event.execution_time_ms,
                "metadata": event.metadata,
                "error_details": event.error_details,
                "stack_trace": event.stack_trace,
                "created_at": event.timestamp.isoformat()
            }).execute()
        except Exception as e:
            # 로깅 실패는 무시 (메인 프로세스에 영향 없도록)
            analysis_logger.debug(f"Failed to persist event to database: {e}")


# ===========================
# Singleton Instance
# ===========================
dev_logger = DevEventLogger()


# ===========================
# Context Manager for Step Logging
# ===========================
class StepLogger:
    """단계 로깅을 위한 컨텍스트 매니저"""

    def __init__(self, case_id: str, step_name: str, metadata: Optional[Dict] = None):
        self.case_id = case_id
        self.step_name = step_name
        self.metadata = metadata
        self.start_time = None

    def __enter__(self):
        self.start_time = datetime.now()
        dev_logger.log_step_start(self.case_id, self.step_name, self.metadata)
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        execution_time = int((datetime.now() - self.start_time).total_seconds() * 1000)

        if exc_type:
            # Error occurred
            dev_logger.log_step_error(
                self.case_id,
                self.step_name,
                exc_val,
                execution_time
            )
        else:
            # Success
            dev_logger.log_step_complete(
                self.case_id,
                self.step_name,
                execution_time
            )

        # Check for slow operation
        dev_logger.log_slow_operation(
            self.case_id,
            self.step_name,
            self.step_name,
            execution_time
        )

        # Don't suppress the exception
        return False


# ===========================
# Decorator for Function Logging
# ===========================
def log_analysis_step(step_name: str):
    """분석 단계 로깅 데코레이터"""
    def decorator(func):
        async def wrapper(case_id: str, *args, **kwargs):
            with StepLogger(case_id, step_name):
                return await func(case_id, *args, **kwargs)
        return wrapper
    return decorator