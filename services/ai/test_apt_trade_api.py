"""아파트 매매 실거래가 상세 API 테스트 스크립트."""
import asyncio
import logging
from core.apt_trade_detail_api import AptTradeDetailAPIClient

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def main():
    """아파트 실거래가 상세 API 테스트."""

    # 테스트 케이스
    test_cases = [
        {
            "name": "서울 강남구 2024년 1월",
            "lawd_cd": "11680",
            "deal_ymd": "202401",
        },
        {
            "name": "서울 서초구 2024년 1월",
            "lawd_cd": "11650",
            "deal_ymd": "202401",
        },
    ]

    async with AptTradeDetailAPIClient() as client:
        for test in test_cases:
            logger.info(f"\n{'='*60}")
            logger.info(f"테스트: {test['name']}")
            logger.info(f"{'='*60}")

            try:
                # 실거래가 조회
                result = await client.get_apt_trade_detail(
                    lawd_cd=test["lawd_cd"],
                    deal_ymd=test["deal_ymd"],
                    num_of_rows=5,
                )

                items = result["body"]["items"]
                total_count = result["body"]["totalCount"]

                logger.info(f"검색 성공: {len(items)}건 (총 {total_count}건)")

                if items:
                    # 첫 번째 결과 파싱 및 출력
                    first = items[0]
                    parsed = client.parse_trade_item(first)

                    logger.info(f"\n첫 번째 거래:")
                    logger.info(f"  아파트: {parsed['아파트명']}")
                    logger.info(f"  위치: {parsed['읍면동명']} {parsed['지번']}")
                    logger.info(f"  전용면적: {parsed['전용면적']:.2f} m2")
                    logger.info(f"  층: {parsed['층']}")
                    logger.info(f"  거래금액: {parsed['거래금액_만원']:,} 만원")
                    logger.info(f"  거래일자: {parsed['거래일자']}")
                    logger.info(f"  건축년도: {parsed['건축년도']}")

                    if parsed.get('아파트동'):
                        logger.info(f"  동: {parsed['아파트동']} (소유권 이전등기 완료)")
                    if parsed.get('중개사소재지'):
                        logger.info(f"  중개사: {parsed['중개사소재지']}")

                else:
                    logger.warning(f"검색 결과 없음")

            except Exception as e:
                logger.error(f"테스트 실패: {e}", exc_info=True)


if __name__ == "__main__":
    asyncio.run(main())
