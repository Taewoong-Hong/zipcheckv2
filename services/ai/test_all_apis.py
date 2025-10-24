"""모든 부동산 공공데이터 API 통합 테스트 스크립트."""
import asyncio
import logging
from datetime import datetime

# 국토교통부 API 클라이언트들
from core.apt_trade_detail_api import AptTradeDetailAPIClient
from core.apt_rent_api import AptRentAPIClient
from core.officetel_trade_api import OfficetelTradeAPIClient
from core.officetel_rent_api import OfficetelRentAPIClient
from core.rh_trade_api import RHTradeAPIClient
from core.sh_rent_api import SHRentAPIClient
from core.land_trade_api import LandTradeAPIClient
from core.indu_trade_api import InduTradeAPIClient
from core.nrg_trade_api import NrgTradeAPIClient

# VWorld API
from core.land_price_api import LandPriceAPIClient, ReqLevel

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def test_apt_trade():
    """아파트 매매 실거래가 상세 API 테스트."""
    logger.info("\n" + "="*60)
    logger.info("1️⃣  아파트 매매 실거래가 상세 API 테스트")
    logger.info("="*60)

    try:
        async with AptTradeDetailAPIClient() as client:
            result = await client.get_apt_trade_detail(
                lawd_cd="11680",  # 강남구
                deal_ymd="201512",
                num_of_rows=3,
            )

            items = result["body"]["items"]
            total = result["body"]["totalCount"]

            logger.info(f"✅ 조회 성공: {len(items)}건 (총 {total}건)")

            if items:
                parsed = client.parse_trade_item(items[0])
                logger.info(f"   - 아파트: {parsed['아파트명']}")
                logger.info(f"   - 위치: {parsed['읍면동명']} {parsed['지번']}")
                logger.info(f"   - 거래금액: {parsed['거래금액_만원']:,}만원")

    except Exception as e:
        logger.error(f"❌ 테스트 실패: {e}")


async def test_apt_rent():
    """아파트 전월세 실거래가 API 테스트."""
    logger.info("\n" + "="*60)
    logger.info("2️⃣  아파트 전월세 실거래가 API 테스트")
    logger.info("="*60)

    try:
        async with AptRentAPIClient() as client:
            result = await client.get_apt_rent(
                lawd_cd="11680",
                deal_ymd="201512",
                num_of_rows=3,
            )

            items = result["body"]["items"]
            total = result["body"]["totalCount"]

            logger.info(f"✅ 조회 성공: {len(items)}건 (총 {total}건)")

            if items:
                parsed = client.parse_rent_item(items[0])
                logger.info(f"   - 아파트: {parsed['아파트명']}")
                logger.info(f"   - 계약유형: {parsed['계약유형']}")
                logger.info(f"   - 보증금: {parsed['보증금_만원']:,}만원")

    except Exception as e:
        logger.error(f"❌ 테스트 실패: {e}")


async def test_officetel_trade():
    """오피스텔 매매 실거래가 API 테스트."""
    logger.info("\n" + "="*60)
    logger.info("3️⃣  오피스텔 매매 실거래가 API 테스트")
    logger.info("="*60)

    try:
        async with OfficetelTradeAPIClient() as client:
            result = await client.get_officetel_trade(
                lawd_cd="11680",
                deal_ymd="201512",
                num_of_rows=3,
            )

            items = result["body"]["items"]
            total = result["body"]["totalCount"]

            logger.info(f"✅ 조회 성공: {len(items)}건 (총 {total}건)")

            if items:
                parsed = client.parse_trade_item(items[0])
                logger.info(f"   - 오피스텔: {parsed['오피스텔명']}")
                logger.info(f"   - 위치: {parsed['읍면동명']} {parsed['지번']}")
                logger.info(f"   - 거래금액: {parsed['거래금액_만원']:,}만원")

    except Exception as e:
        logger.error(f"❌ 테스트 실패: {e}")


async def test_officetel_rent():
    """오피스텔 전월세 실거래가 API 테스트."""
    logger.info("\n" + "="*60)
    logger.info("4️⃣  오피스텔 전월세 실거래가 API 테스트")
    logger.info("="*60)

    try:
        async with OfficetelRentAPIClient() as client:
            result = await client.get_officetel_rent(
                lawd_cd="11680",
                deal_ymd="201512",
                num_of_rows=3,
            )

            items = result["body"]["items"]
            total = result["body"]["totalCount"]

            logger.info(f"✅ 조회 성공: {len(items)}건 (총 {total}건)")

            if items:
                parsed = client.parse_rent_item(items[0])
                logger.info(f"   - 오피스텔: {parsed['오피스텔명']}")
                logger.info(f"   - 계약유형: {parsed['계약유형']}")
                logger.info(f"   - 보증금: {parsed['보증금_만원']:,}만원")

    except Exception as e:
        logger.error(f"❌ 테스트 실패: {e}")


async def test_rh_trade():
    """연립다세대 매매 실거래가 API 테스트."""
    logger.info("\n" + "="*60)
    logger.info("5️⃣  연립다세대 매매 실거래가 API 테스트")
    logger.info("="*60)

    try:
        async with RHTradeAPIClient() as client:
            result = await client.get_rh_trade(
                lawd_cd="11680",
                deal_ymd="201512",
                num_of_rows=3,
            )

            items = result["body"]["items"]
            total = result["body"]["totalCount"]

            logger.info(f"✅ 조회 성공: {len(items)}건 (총 {total}건)")

            if items:
                parsed = client.parse_trade_item(items[0])
                logger.info(f"   - 연립다세대: {parsed['연립다세대명']}")
                logger.info(f"   - 위치: {parsed['읍면동명']} {parsed['지번']}")
                logger.info(f"   - 거래금액: {parsed['거래금액_만원']:,}만원")

    except Exception as e:
        logger.error(f"❌ 테스트 실패: {e}")


async def test_sh_rent():
    """단독/다가구 전월세 실거래가 API 테스트."""
    logger.info("\n" + "="*60)
    logger.info("6️⃣  단독/다가구 전월세 실거래가 API 테스트")
    logger.info("="*60)

    try:
        async with SHRentAPIClient() as client:
            result = await client.get_sh_rent(
                lawd_cd="11680",
                deal_ymd="201512",
                num_of_rows=3,
            )

            items = result["body"]["items"]
            total = result["body"]["totalCount"]

            logger.info(f"✅ 조회 성공: {len(items)}건 (총 {total}건)")

            if items:
                parsed = client.parse_rent_item(items[0])
                logger.info(f"   - 계약유형: {parsed['계약유형']}")
                logger.info(f"   - 보증금: {parsed['보증금_만원']:,}만원")
                logger.info(f"   - 건축년도: {parsed['건축년도']}")

    except Exception as e:
        logger.error(f"❌ 테스트 실패: {e}")


async def test_land_trade():
    """토지 매매 실거래가 API 테스트."""
    logger.info("\n" + "="*60)
    logger.info("7️⃣  토지 매매 실거래가 API 테스트")
    logger.info("="*60)

    try:
        async with LandTradeAPIClient() as client:
            result = await client.get_land_trade(
                lawd_cd="11680",
                deal_ymd="201512",
                num_of_rows=3,
            )

            items = result["body"]["items"]
            total = result["body"]["totalCount"]

            logger.info(f"✅ 조회 성공: {len(items)}건 (총 {total}건)")

            if items:
                parsed = client.parse_trade_item(items[0])
                logger.info(f"   - 위치: {parsed['읍면동명']} {parsed['지번']}")
                logger.info(f"   - 토지면적: {parsed['토지면적']}㎡")
                logger.info(f"   - 거래금액: {parsed['거래금액_만원']:,}만원")

    except Exception as e:
        logger.error(f"❌ 테스트 실패: {e}")


async def test_land_price():
    """개별공시지가 API 테스트."""
    logger.info("\n" + "="*60)
    logger.info("8️⃣  개별공시지가 API (VWorld) 테스트")
    logger.info("="*60)

    try:
        async with LandPriceAPIClient() as client:
            result = await client.get_individual_land_price(
                stdr_year="2016",
                req_lvl=ReqLevel.SIGUNGU,
                ld_code="4789000000",
                num_of_rows=3,
            )

            page = result["response"]
            total = int(page.get("totalCount", 0))

            logger.info(f"✅ 조회 성공: 총 {total}건")

            if total > 0:
                logger.info("   ⚠️  VWorld 데이터 제공 제한 가능성 있음")

    except Exception as e:
        logger.error(f"❌ 테스트 실패: {e}")


async def main():
    """모든 API 통합 테스트 실행."""
    logger.info("\n" + "🏠" * 30)
    logger.info("부동산 공공데이터 API 통합 테스트 시작")
    logger.info("🏠" * 30)

    # 국토교통부 API 테스트 (모두 같은 API 키)
    await test_apt_trade()
    await test_apt_rent()
    await test_officetel_trade()
    await test_officetel_rent()
    await test_rh_trade()
    await test_sh_rent()
    await test_land_trade()

    # VWorld API 테스트 (다른 API 키)
    await test_land_price()

    logger.info("\n" + "🏁" * 30)
    logger.info("테스트 완료!")
    logger.info("🏁" * 30)


if __name__ == "__main__":
    asyncio.run(main())
