"""개별공시지가 API 테스트 스크립트."""
import asyncio
import logging
from core.land_price_api import LandPriceAPIClient, ReqLevel

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def main():
    """개별공시지가 API 테스트."""

    # 테스트 케이스
    test_cases = [
        {
            "name": "서울특별시 강남구 역삼동",
            "year": "2023",
            "dong_code": "1168010300",  # 서울특별시(11) 강남구(680) 역삼동(10300)
        },
        {
            "name": "서울특별시 서초구 서초동",
            "year": "2023",
            "dong_code": "1165010100",  # 서울특별시(11) 서초구(650) 서초동(10100)
        },
    ]

    async with LandPriceAPIClient() as client:
        for test in test_cases:
            logger.info(f"\n{'='*60}")
            logger.info(f"테스트: {test['name']} ({test['year']}년)")
            logger.info(f"{'='*60}")

            try:
                # 1. 기본 검색 (100건)
                result = await client.get_land_price_by_address(
                    year=test["year"],
                    sido_code=test["dong_code"][:2],
                    sigungu_code=test["dong_code"][:5],
                    dong_code=test["dong_code"],
                    num_of_rows=10,
                )

                logger.info(f"✅ 검색 성공: {len(result)}건")

                if result:
                    # 첫 번째 결과 출력
                    first = result[0]
                    logger.info(f"\n📍 첫 번째 결과:")
                    logger.info(f"  - 위치: {first['ld_code_nm']}")
                    logger.info(f"  - 지목: {first['land_category']}")
                    logger.info(f"  - 면적: {first['area']:,.1f} ㎡")
                    logger.info(f"  - 공시지가: {first['price_per_sqm']:,} 원/㎡")
                    logger.info(f"  - 용도지역: {first['purpose_area']}")
                    logger.info(f"  - 용도지구: {first['purpose_district']}")

                    # 2. 평균 공시지가 통계
                    stats = await client.get_average_land_price(
                        year=test["year"],
                        dong_code=test["dong_code"],
                    )

                    logger.info(f"\n📊 공시지가 통계:")
                    logger.info(f"  - 지역: {stats['area_name']}")
                    logger.info(f"  - 총 {stats['count']}건")
                    logger.info(f"  - 평균: {stats['avg_price']:,} 원/㎡")
                    logger.info(f"  - 최저: {stats['min_price']:,} 원/㎡")
                    logger.info(f"  - 최고: {stats['max_price']:,} 원/㎡")
                else:
                    logger.warning(f"⚠️  검색 결과 없음")

            except Exception as e:
                logger.error(f"❌ 테스트 실패: {e}")


if __name__ == "__main__":
    asyncio.run(main())
