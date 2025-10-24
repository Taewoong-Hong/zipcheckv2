"""RTMS API 베이스 클래스

모든 리팩토링된 RTMS API 클라이언트의 공통 베이스 클래스입니다.
async context manager 프로토콜을 구현하여 기존 테스트 코드와 호환됩니다.
"""


class RTMSBaseClient:
    """
    RTMS API 베이스 클래스.

    async context manager 프로토콜을 구현하여 `async with` 패턴을 지원합니다.
    실제로는 httpx.AsyncClient를 내부적으로 관리하지 않고,
    data_go_kr.call_data_go_api()가 매 요청마다 AsyncClient를 생성/닫습니다.
    """

    async def __aenter__(self):
        """Async context manager 진입."""
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager 종료."""
        # 실제로 닫을 리소스가 없음 (data_go_kr.py에서 관리)
        pass

    async def close(self):
        """호환성을 위한 더미 close 메서드."""
        pass
