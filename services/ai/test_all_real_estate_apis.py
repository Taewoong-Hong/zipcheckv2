"""모든 부동산 공공데이터 API 전체 통합 테스트 스크립트."""
import asyncio
import logging
from datetime import datetime

# 국토교통부 API 클라이언트들 (API 키 1)
from core.apt_trade_detail_api import AptTradeDetailAPIClient
from core.apt_silv_trade_api import AptSilvTradeAPIClient
from core.apt_rent_api import AptRentAPIClient
from core.officetel_trade_api import OfficetelTradeAPIClient
from core.officetel_rent_api import OfficetelRentAPIClient
from core.rh_trade_api import RHTradeAPIClient
from core.rh_rent_api import RHRentAPIClient
from core.sh_trade_api import SHTradeAPIClient
from core.sh_rent_api import SHRentAPIClient
from core.land_trade_api import LandTradeAPIClient
from core.indu_trade_api import InduTradeAPIClient
from core.nrg_trade_api import NrgTradeAPIClient
from core.building_ledger_api import BuildingLedgerAPIClient

# 아파트 매매 기본 버전 (API 키 2)
from core.public_data_api import AptTradeAPIClient

# VWorld API (API 키 3)
from core.land_price_api import LandPriceAPIClient, ReqLevel

logging.basicConfig(level=logging.INFO, format='%(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


async def test_apt_trade_basic():
    """아파트 매매 실거래가 (기본) API 테스트 - API 키 2."""
    logger.info("\n" + "="*70)
    logger.info("1️⃣  아파트 매매 실거래가 (기본 버전) API 테스트 - 다른 API 키")
    logger.info("="*70)

    try:
        # settings에서 API 키 가져오기
        from core.settings import settings
        client = AptTradeAPIClient(api_key=settings.public_data_api_key)

        result = await client.get_apt_trades(
            lawd_cd="11680",  # 강남구
            deal_ymd="202401",
        )

        count = result.get("count", 0)
        items = result.get("items", [])

        logger.info(f"✅ 조회 성공: {len(items)}건 (총 {count}건)")

        if items:
            item = items[0]
            logger.info(f"   - 아파트: {item.get('aptName')}")
            logger.info(f"   - 위치: {item.get('dong')} {item.get('jibun')}")
            logger.info(f"   - 거래금액: {item.get('dealAmount'):,}만원")

        await client.close()

    except Exception as e:
        logger.error(f"❌ 테스트 실패: {e}")


async def test_apt_trade_detail():
    """아파트 매매 실거래가 상세 API 테스트."""
    logger.info("\n" + "="*70)
    logger.info("2️⃣  아파트 매매 실거래가 상세 API 테스트")
    logger.info("="*70)

    try:
        async with AptTradeDetailAPIClient() as client:
            result = await client.get_apt_trade_detail(
                lawd_cd="11680",
                deal_ymd="201512",
                num_of_rows=3,
            )

            items = result["body"]["items"]
            total = result["body"]["totalCount"]

            logger.info(f"✅ 조회 성공: {len(items)}건 (총 {total}건)")

            if items:
                parsed = client.parse_trade_item(items[0])
                logger.info(f"   - 아파트: {parsed['아파트명']}")
                logger.info(f"   - 거래금액: {parsed['거래금액_만원']:,}만원")

    except Exception as e:
        logger.error(f"❌ 테스트 실패: {e}")


async def test_apt_silv_trade():
    """아파트 분양권 전매 실거래가 API 테스트."""
    logger.info("\n" + "="*70)
    logger.info("3️⃣  아파트 분양권 전매 실거래가 API 테스트")
    logger.info("="*70)

    try:
        async with AptSilvTradeAPIClient() as client:
            result = await client.get_apt_silv_trade(
                lawd_cd="11680",
                deal_ymd="201512",
                num_of_rows=3,
            )

            items = result["body"]["items"]
            total = result["body"]["totalCount"]

            logger.info(f"✅ 조회 성공: {len(items)}건 (총 {total}건)")

            if items:
                parsed = client.parse_trade_item(items[0])
                logger.info(f"   - 아파트: {parsed['아파트명']}")
                logger.info(f"   - 거래금액: {parsed['거래금액_만원']:,}만원")

    except Exception as e:
        logger.error(f"❌ 테스트 실패: {e}")


async def test_apt_rent():
    """아파트 전월세 실거래가 API 테스트."""
    logger.info("\n" + "="*70)
    logger.info("4️⃣  아파트 전월세 실거래가 API 테스트")
    logger.info("="*70)

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
                logger.info(f"   - 계약유형: {parsed['계약유형']}")
                logger.info(f"   - 보증금: {parsed['보증금_만원']:,}만원")

    except Exception as e:
        logger.error(f"❌ 테스트 실패: {e}")


async def test_officetel_trade():
    """오피스텔 매매 실거래가 API 테스트."""
    logger.info("\n" + "="*70)
    logger.info("5️⃣  오피스텔 매매 실거래가 API 테스트")
    logger.info("="*70)

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
                logger.info(f"   - 거래금액: {parsed['거래금액_만원']:,}만원")

    except Exception as e:
        logger.error(f"❌ 테스트 실패: {e}")


async def test_officetel_rent():
    """오피스텔 전월세 실거래가 API 테스트."""
    logger.info("\n" + "="*70)
    logger.info("6️⃣  오피스텔 전월세 실거래가 API 테스트")
    logger.info("="*70)

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
                logger.info(f"   - 계약유형: {parsed['계약유형']}")
                logger.info(f"   - 보증금: {parsed['보증금_만원']:,}만원")

    except Exception as e:
        logger.error(f"❌ 테스트 실패: {e}")


async def test_rh_trade():
    """연립다세대 매매 실거래가 API 테스트."""
    logger.info("\n" + "="*70)
    logger.info("7️⃣  연립다세대 매매 실거래가 API 테스트")
    logger.info("="*70)

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
                logger.info(f"   - 거래금액: {parsed['거래금액_만원']:,}만원")

    except Exception as e:
        logger.error(f"❌ 테스트 실패: {e}")


async def test_rh_rent():
    """연립다세대 전월세 실거래가 API 테스트."""
    logger.info("\n" + "="*70)
    logger.info("8️⃣  연립다세대 전월세 실거래가 API 테스트")
    logger.info("="*70)

    try:
        async with RHRentAPIClient() as client:
            result = await client.get_rh_rent(
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

    except Exception as e:
        logger.error(f"❌ 테스트 실패: {e}")


async def test_sh_trade():
    """단독/다가구 매매 실거래가 API 테스트."""
    logger.info("\n" + "="*70)
    logger.info("9️⃣  단독/다가구 매매 실거래가 API 테스트")
    logger.info("="*70)

    try:
        async with SHTradeAPIClient() as client:
            result = await client.get_sh_trade(
                lawd_cd="11680",
                deal_ymd="201512",
                num_of_rows=3,
            )

            items = result["body"]["items"]
            total = result["body"]["totalCount"]

            logger.info(f"✅ 조회 성공: {len(items)}건 (총 {total}건)")

            if items:
                parsed = client.parse_trade_item(items[0])
                logger.info(f"   - 주택유형: {parsed['주택유형']}")
                logger.info(f"   - 거래금액: {parsed['거래금액_만원']:,}만원")

    except Exception as e:
        logger.error(f"❌ 테스트 실패: {e}")


async def test_sh_rent():
    """단독/다가구 전월세 실거래가 API 테스트."""
    logger.info("\n" + "="*70)
    logger.info("🔟  단독/다가구 전월세 실거래가 API 테스트")
    logger.info("="*70)

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

    except Exception as e:
        logger.error(f"❌ 테스트 실패: {e}")


async def test_land_trade():
    """토지 매매 실거래가 API 테스트."""
    logger.info("\n" + "="*70)
    logger.info("1️⃣1️⃣  토지 매매 실거래가 API 테스트")
    logger.info("="*70)

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
                logger.info(f"   - 토지면적: {parsed['토지면적']}㎡")
                logger.info(f"   - 거래금액: {parsed['거래금액_만원']:,}만원")

    except Exception as e:
        logger.error(f"❌ 테스트 실패: {e}")


async def test_indu_trade():
    """공장/창고 등 부동산 매매 실거래가 API 테스트."""
    logger.info("\n" + "="*70)
    logger.info("1️⃣2️⃣  공장/창고 등 부동산 매매 실거래가 API 테스트")
    logger.info("="*70)

    try:
        async with InduTradeAPIClient() as client:
            result = await client.get_indu_trade(
                lawd_cd="11680",
                deal_ymd="201512",
                num_of_rows=3,
            )

            items = result["body"]["items"]
            total = result["body"]["totalCount"]

            logger.info(f"✅ 조회 성공: {len(items)}건 (총 {total}건)")

            if items:
                parsed = client.parse_trade_item(items[0])
                logger.info(f"   - 건축물유형: {parsed['건축물유형']}")
                logger.info(f"   - 거래금액: {parsed['거래금액_만원']:,}만원")

    except Exception as e:
        logger.error(f"❌ 테스트 실패: {e}")


async def test_nrg_trade():
    """상업업무용 부동산 매매 실거래가 API 테스트."""
    logger.info("\n" + "="*70)
    logger.info("1️⃣3️⃣  상업업무용 부동산 매매 실거래가 API 테스트")
    logger.info("="*70)

    try:
        async with NrgTradeAPIClient() as client:
            result = await client.get_nrg_trade(
                lawd_cd="11680",
                deal_ymd="201512",
                num_of_rows=3,
            )

            items = result["body"]["items"]
            total = result["body"]["totalCount"]

            logger.info(f"✅ 조회 성공: {len(items)}건 (총 {total}건)")

            if items:
                parsed = client.parse_trade_item(items[0])
                logger.info(f"   - 건축물유형: {parsed['건축물유형']}")
                logger.info(f"   - 거래금액: {parsed['거래금액_만원']:,}만원")

    except Exception as e:
        logger.error(f"❌ 테스트 실패: {e}")


async def test_building_ledger():
    """건축물대장 API 테스트."""
    logger.info("\n" + "="*70)
    logger.info("1️⃣4️⃣  건축물대장 API 테스트")
    logger.info("="*70)

    try:
        async with BuildingLedgerAPIClient() as client:
            # 실제 메서드명: search_building_by_address
            result = await client.search_building_by_address(
                sigungu_cd="11680",
                bjdong_cd="10300",
                plat_gb_cd="0",  # 0:대지, 1:산, 2:블록
                bun="0641",
                ji="0009",
            )

            items = result["items"]
            total = result["totalCount"]

            logger.info(f"✅ 조회 성공: {len(items)}건 (총 {total}건)")

            if items:
                logger.info(f"   - 건물명: {items[0].get('bldNm')}")
                logger.info(f"   - 대지면적: {items[0].get('platArea')}㎡")

    except Exception as e:
        logger.error(f"❌ 테스트 실패: {e}")


async def test_land_price():
    """개별공시지가 API (VWorld) 테스트."""
    logger.info("\n" + "="*70)
    logger.info("1️⃣5️⃣  개별공시지가 API (VWorld) 테스트 - 다른 API 키")
    logger.info("="*70)

    try:
        async with LandPriceAPIClient() as client:
            result = await client.get_individual_land_price(
                stdr_year="2016",
                req_lvl=ReqLevel.SIGUNGU,
                ld_code="47890",
                num_of_rows=3,
            )

            page = result["response"]
            total = int(page.get("totalCount", 0))

            logger.info(f"✅ 조회 성공: 총 {total}건")

            if total > 0:
                logger.info("   ⚠️  VWorld 데이터 제공 제한 가능성 있음")
            else:
                logger.info("   ℹ️  조회 결과 없음 (0건)")

    except Exception as e:
        logger.error(f"❌ 테스트 실패: {e}")


async def main():
    """모든 API 통합 테스트 실행."""
    logger.info("\n" + "🏠" * 35)
    logger.info("부동산 공공데이터 API 전체 통합 테스트 시작")
    logger.info("총 15개 API 클라이언트 테스트")
    logger.info("🏠" * 35)

    # API 키 2 - 아파트 매매 기본 버전
    await test_apt_trade_basic()

    # API 키 1 - 국토교통부 실거래가 API (13개)
    await test_apt_trade_detail()
    await test_apt_silv_trade()
    await test_apt_rent()
    await test_officetel_trade()
    await test_officetel_rent()
    await test_rh_trade()
    await test_rh_rent()
    await test_sh_trade()
    await test_sh_rent()
    await test_land_trade()
    await test_indu_trade()
    await test_nrg_trade()
    await test_building_ledger()

    # API 키 3 - VWorld API
    await test_land_price()

    logger.info("\n" + "🏁" * 35)
    logger.info("전체 테스트 완료!")
    logger.info("🏁" * 35)


if __name__ == "__main__":
    asyncio.run(main())
