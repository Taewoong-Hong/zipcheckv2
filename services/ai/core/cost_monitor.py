"""OpenAI API 비용 모니터링 및 사용량 추적."""
import logging
from datetime import datetime, timedelta
from typing import Dict, Any, List
from collections import defaultdict

logger = logging.getLogger(__name__)


# OpenAI Standard Tier 가격 (2024년 기준, USD/1K tokens)
PRICING = {
    # GPT-4o
    "gpt-4o": {"input": 0.0025, "output": 0.010},
    "gpt-4o-2024-11-20": {"input": 0.0025, "output": 0.010},
    "gpt-4o-2024-08-06": {"input": 0.0025, "output": 0.010},
    "gpt-4o-2024-05-13": {"input": 0.0025, "output": 0.010},

    # GPT-4o-mini
    "gpt-4o-mini": {"input": 0.000150, "output": 0.000600},
    "gpt-4o-mini-2024-07-18": {"input": 0.000150, "output": 0.000600},

    # Embeddings
    "text-embedding-3-small": {"input": 0.000020, "output": 0.0},
    "text-embedding-3-large": {"input": 0.000130, "output": 0.0},
    "text-embedding-ada-002": {"input": 0.000100, "output": 0.0},
}


class CostMonitor:
    """
    OpenAI API 비용 및 사용량을 추적합니다.

    Features:
    - 모델별 토큰 사용량 추적
    - 실시간 비용 계산
    - 일일/주간/월간 통계
    - 비용 임계값 경고
    - 사용량 리포트 생성
    """

    def __init__(self):
        """CostMonitor 초기화."""
        self.usage_history: List[Dict[str, Any]] = []
        self.daily_usage: Dict[str, Dict[str, float]] = defaultdict(
            lambda: {"input_tokens": 0, "output_tokens": 0, "cost": 0.0}
        )
        self.cost_alerts: List[Dict[str, Any]] = []

        # 비용 임계값 (USD)
        self.daily_threshold = 10.0  # 일일 $10 초과 시 경고
        self.monthly_threshold = 100.0  # 월간 $100 초과 시 경고

    def track_usage(
        self,
        model: str,
        input_tokens: int,
        output_tokens: int = 0,
        metadata: Dict[str, Any] | None = None,
    ) -> Dict[str, Any]:
        """
        API 사용량을 기록하고 비용을 계산합니다.

        Args:
            model: 사용된 모델 이름
            input_tokens: 입력 토큰 수
            output_tokens: 출력 토큰 수 (임베딩은 0)
            metadata: 추가 메타데이터 (operation, user_id 등)

        Returns:
            비용 정보 딕셔너리

        Example:
            >>> monitor = CostMonitor()
            >>> cost_info = monitor.track_usage("gpt-4o", 1000, 500)
            >>> print(f"비용: ${cost_info['cost']:.4f}")
        """
        # 모델 가격 조회
        pricing = PRICING.get(model)
        if not pricing:
            logger.warning(f"알 수 없는 모델: {model}, 비용 계산 건너뜀")
            return {
                "model": model,
                "input_tokens": input_tokens,
                "output_tokens": output_tokens,
                "cost": 0.0,
                "error": "Unknown model",
            }

        # 비용 계산 (USD)
        input_cost = (input_tokens / 1000) * pricing["input"]
        output_cost = (output_tokens / 1000) * pricing["output"]
        total_cost = input_cost + output_cost

        # 사용량 기록
        timestamp = datetime.now()
        usage_record = {
            "timestamp": timestamp.isoformat(),
            "model": model,
            "input_tokens": input_tokens,
            "output_tokens": output_tokens,
            "total_tokens": input_tokens + output_tokens,
            "input_cost": input_cost,
            "output_cost": output_cost,
            "cost": total_cost,
            "metadata": metadata or {},
        }

        self.usage_history.append(usage_record)

        # 일일 통계 업데이트
        date_key = timestamp.strftime("%Y-%m-%d")
        self.daily_usage[date_key]["input_tokens"] += input_tokens
        self.daily_usage[date_key]["output_tokens"] += output_tokens
        self.daily_usage[date_key]["cost"] += total_cost

        # 임계값 확인
        self._check_thresholds(date_key)

        logger.debug(
            f"사용량 기록: {model}, "
            f"input={input_tokens}, output={output_tokens}, "
            f"cost=${total_cost:.4f}"
        )

        return {
            "model": model,
            "input_tokens": input_tokens,
            "output_tokens": output_tokens,
            "total_tokens": input_tokens + output_tokens,
            "cost": total_cost,
            "timestamp": timestamp.isoformat(),
        }

    def _check_thresholds(self, date_key: str):
        """비용 임계값 확인 및 경고 생성."""
        daily_cost = self.daily_usage[date_key]["cost"]

        # 일일 임계값 확인
        if daily_cost > self.daily_threshold:
            alert = {
                "type": "daily_threshold",
                "date": date_key,
                "cost": daily_cost,
                "threshold": self.daily_threshold,
                "message": f"일일 비용 임계값 초과: ${daily_cost:.2f} > ${self.daily_threshold:.2f}",
            }
            self.cost_alerts.append(alert)
            logger.warning(alert["message"])

        # 월간 임계값 확인
        month_key = date_key[:7]  # YYYY-MM
        monthly_cost = sum(
            stats["cost"]
            for date, stats in self.daily_usage.items()
            if date.startswith(month_key)
        )

        if monthly_cost > self.monthly_threshold:
            alert = {
                "type": "monthly_threshold",
                "month": month_key,
                "cost": monthly_cost,
                "threshold": self.monthly_threshold,
                "message": f"월간 비용 임계값 초과: ${monthly_cost:.2f} > ${self.monthly_threshold:.2f}",
            }
            self.cost_alerts.append(alert)
            logger.warning(alert["message"])

    def get_daily_stats(self, date: str | None = None) -> Dict[str, Any]:
        """
        특정 날짜의 사용량 통계를 조회합니다.

        Args:
            date: 날짜 (YYYY-MM-DD), None이면 오늘

        Returns:
            일일 통계 딕셔너리
        """
        if date is None:
            date = datetime.now().strftime("%Y-%m-%d")

        stats = self.daily_usage.get(date, {
            "input_tokens": 0,
            "output_tokens": 0,
            "cost": 0.0,
        })

        return {
            "date": date,
            "input_tokens": stats["input_tokens"],
            "output_tokens": stats["output_tokens"],
            "total_tokens": stats["input_tokens"] + stats["output_tokens"],
            "cost": stats["cost"],
        }

    def get_monthly_stats(self, month: str | None = None) -> Dict[str, Any]:
        """
        특정 월의 사용량 통계를 조회합니다.

        Args:
            month: 월 (YYYY-MM), None이면 이번 달

        Returns:
            월간 통계 딕셔너리
        """
        if month is None:
            month = datetime.now().strftime("%Y-%m")

        # 해당 월의 모든 일일 통계 합산
        monthly_stats = {
            "input_tokens": 0,
            "output_tokens": 0,
            "cost": 0.0,
        }

        for date, stats in self.daily_usage.items():
            if date.startswith(month):
                monthly_stats["input_tokens"] += stats["input_tokens"]
                monthly_stats["output_tokens"] += stats["output_tokens"]
                monthly_stats["cost"] += stats["cost"]

        return {
            "month": month,
            "input_tokens": monthly_stats["input_tokens"],
            "output_tokens": monthly_stats["output_tokens"],
            "total_tokens": monthly_stats["input_tokens"] + monthly_stats["output_tokens"],
            "cost": monthly_stats["cost"],
        }

    def get_model_breakdown(self, period_days: int = 30) -> Dict[str, Dict[str, Any]]:
        """
        모델별 사용량 분석을 조회합니다.

        Args:
            period_days: 분석 기간 (일)

        Returns:
            모델별 통계 딕셔너리
        """
        cutoff_date = datetime.now() - timedelta(days=period_days)
        model_stats: Dict[str, Dict[str, float]] = defaultdict(
            lambda: {"input_tokens": 0, "output_tokens": 0, "cost": 0.0, "count": 0}
        )

        for record in self.usage_history:
            record_date = datetime.fromisoformat(record["timestamp"])
            if record_date >= cutoff_date:
                model = record["model"]
                model_stats[model]["input_tokens"] += record["input_tokens"]
                model_stats[model]["output_tokens"] += record["output_tokens"]
                model_stats[model]["cost"] += record["cost"]
                model_stats[model]["count"] += 1

        return dict(model_stats)

    def generate_report(self) -> str:
        """
        사용량 리포트를 생성합니다.

        Returns:
            포맷팅된 리포트 문자열
        """
        today = datetime.now().strftime("%Y-%m-%d")
        this_month = datetime.now().strftime("%Y-%m")

        daily = self.get_daily_stats(today)
        monthly = self.get_monthly_stats(this_month)
        model_breakdown = self.get_model_breakdown(30)

        report = f"""
=== OpenAI API Usage Report ===
Generated: {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}

Daily Stats ({today}):
- Input Tokens: {daily['input_tokens']:,}
- Output Tokens: {daily['output_tokens']:,}
- Total Tokens: {daily['total_tokens']:,}
- Cost: ${daily['cost']:.4f}

Monthly Stats ({this_month}):
- Input Tokens: {monthly['input_tokens']:,}
- Output Tokens: {monthly['output_tokens']:,}
- Total Tokens: {monthly['total_tokens']:,}
- Cost: ${monthly['cost']:.4f}

Model Breakdown (Last 30 days):
"""

        for model, stats in sorted(
            model_breakdown.items(),
            key=lambda x: x[1]["cost"],
            reverse=True
        ):
            report += f"""
{model}:
  - Calls: {stats['count']:,}
  - Input Tokens: {stats['input_tokens']:,}
  - Output Tokens: {stats['output_tokens']:,}
  - Cost: ${stats['cost']:.4f}
"""

        if self.cost_alerts:
            report += "\n\nCost Alerts:\n"
            for alert in self.cost_alerts[-5:]:  # 최근 5개
                report += f"- {alert['message']}\n"

        report += "\n==============================\n"
        return report


# 전역 모니터 인스턴스
_global_monitor: CostMonitor | None = None


def get_cost_monitor() -> CostMonitor:
    """전역 CostMonitor 인스턴스를 가져옵니다."""
    global _global_monitor
    if _global_monitor is None:
        _global_monitor = CostMonitor()
    return _global_monitor


def track_llm_usage(
    model: str,
    input_tokens: int,
    output_tokens: int = 0,
    **metadata
) -> Dict[str, Any]:
    """
    LLM 사용량을 전역 모니터에 기록합니다 (편의 함수).

    Args:
        model: 모델 이름
        input_tokens: 입력 토큰 수
        output_tokens: 출력 토큰 수
        **metadata: 추가 메타데이터

    Returns:
        비용 정보

    Example:
        >>> cost = track_llm_usage("gpt-4o", 1000, 500, operation="analyze")
        >>> print(f"Cost: ${cost['cost']:.4f}")
    """
    monitor = get_cost_monitor()
    return monitor.track_usage(model, input_tokens, output_tokens, metadata)
