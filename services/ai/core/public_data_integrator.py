"""
공공 데이터 통합 모듈

건축물대장, 실거래가 등 여러 API를 통합 호출
"""
import logging
from typing import Optional, Dict, Any
from datetime import datetime
from pydantic import BaseModel

logger = logging.getLogger(__name__)


# ===========================
# 통합 데이터 모델
# ===========================
class PublicDataResult(BaseModel):
    """공공 데이터 통합 결과"""
    # 건축물대장
    building_ledger: Optional[Dict[str, Any]] = None
    building_error: Optional[str] = None

    # 실거래가 (아파트)
    apt_trades: Optional[list] = None
    apt_trades_error: Optional[str] = None

    # 공시지가
    land_price: Optional[Dict[str, Any]] = None
    land_price_error: Optional[str] = None

    # 메타 정보
    fetched_at: str = datetime.utcnow().isoformat()
    success_count: int = 0
    total_count: int = 3


# ===========================
# 통합 함수
# ===========================
async def fetch_all_public_data(
    property_address: str,
    sigungu_code: Optional[str] = None,
    bjdong_code: Optional[str] = None,
    deal_year: Optional[int] = None,
    deal_month: Optional[int] = None
) -> PublicDataResult:
    """
    공공 데이터 일괄 조회

    - 건축물대장: routes/building.py::get_building_ledger() 사용
    - 실거래가: routes/apt_trade.py::get_apt_trade_transactions() 사용
    - 공시지가: routes/land_price.py::get_individual_land_price() 사용

    에러가 발생해도 다른 API는 계속 호출 (부분 성공 허용)
    """
    result = PublicDataResult()

    # 1️⃣ 건축물대장 조회
    try:
        from routes.building import fetch_building_ledger_data

        building_data = await fetch_building_ledger_data(
            sigungu_code=sigungu_code or "11680",  # 기본값: 강남구
            bjdong_code=bjdong_code or "10300",
            bun="0012",  # TODO: 주소에서 번지 파싱 필요
            ji="0004"
        )

        result.building_ledger = building_data
        result.success_count += 1
        logger.info("건축물대장 조회 성공")

    except Exception as e:
        result.building_error = str(e)
        logger.warning(f"건축물대장 조회 실패: {e}")

    # 2️⃣ 실거래가 조회 (아파트)
    try:
        from routes.apt_trade import fetch_apt_trade_data

        # 기본값: 최근 3개월
        if not deal_year or not deal_month:
            now = datetime.now()
            deal_year = now.year
            deal_month = now.month

        trade_data = await fetch_apt_trade_data(
            lawd_cd=sigungu_code or "11680",
            deal_ymd=f"{deal_year}{deal_month:02d}"
        )

        result.apt_trades = trade_data.get("items", [])
        result.success_count += 1
        logger.info(f"실거래가 조회 성공: {len(result.apt_trades)}건")

    except Exception as e:
        result.apt_trades_error = str(e)
        logger.warning(f"실거래가 조회 실패: {e}")

    # 3️⃣ 공시지가 조회
    try:
        from routes.land_price import fetch_land_price_data

        land_data = await fetch_land_price_data(
            pnu=f"{sigungu_code}{bjdong_code}",  # PNU 코드 조합
            stdr_year=str(datetime.now().year)
        )

        result.land_price = land_data
        result.success_count += 1
        logger.info("공시지가 조회 성공")

    except Exception as e:
        result.land_price_error = str(e)
        logger.warning(f"공시지가 조회 실패: {e}")

    logger.info(f"공공 데이터 통합 완료: {result.success_count}/{result.total_count} 성공")
    return result


# ===========================
# 헬퍼 함수
# ===========================
def extract_property_value_estimate(public_data: PublicDataResult) -> Optional[int]:
    """
    공공 데이터에서 부동산 가치 추정 (만원)

    우선순위:
    1. 최근 실거래가 (아파트)
    2. 공시지가
    3. None (데이터 없음)
    """
    # 1. 실거래가 (최근 3개월 평균)
    if public_data.apt_trades and len(public_data.apt_trades) > 0:
        total = 0
        count = 0
        for trade in public_data.apt_trades[:10]:  # 최대 10건
            try:
                # 거래금액 파싱 (예: "80,000" → 80000만원)
                amount_str = trade.get("거래금액", "").replace(",", "").strip()
                if amount_str:
                    total += int(amount_str)
                    count += 1
            except:
                pass

        if count > 0:
            avg = total // count
            logger.info(f"실거래가 평균: {avg}만원 ({count}건)")
            return avg

    # 2. 공시지가
    if public_data.land_price:
        try:
            price_str = public_data.land_price.get("pblntfPclnd", "0")
            price = int(price_str) // 10000  # 원 → 만원
            logger.info(f"공시지가: {price}만원")
            return price
        except:
            pass

    logger.warning("부동산 가치 추정 실패: 데이터 없음")
    return None


# ===========================
# 예시 사용법 (테스트용)
# ===========================
if __name__ == "__main__":
    import asyncio

    async def test():
        result = await fetch_all_public_data(
            property_address="서울특별시 강남구 대치동 12-4",
            sigungu_code="11680",
            bjdong_code="10300"
        )

        print(f"성공: {result.success_count}/{result.total_count}")
        print(f"건축물대장: {result.building_ledger is not None}")
        print(f"실거래가: {len(result.apt_trades or [])}건")
        print(f"공시지가: {result.land_price is not None}")

        value = extract_property_value_estimate(result)
        print(f"추정 가치: {value}만원")

    asyncio.run(test())
