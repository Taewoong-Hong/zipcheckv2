"""건축물대장 API 테스트 스크립트."""
import asyncio
import logging
from core.building_ledger_api import BuildingLedgerAPIClient

# 로깅 설정
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)

logger = logging.getLogger(__name__)


async def test_building_search():
    """건축물대장 검색 테스트."""
    logger.info("=== 건축물대장 API 테스트 시작 ===\n")

    # 테스트 파라미터 (서울특별시 강남구 역삼동 예시)
    test_cases = [
        {
            "name": "서울특별시 강남구 역삼동 테스트",
            "sigungu_cd": "11680",  # 강남구
            "bjdong_cd": "10300",   # 역삼동
            "bun": "736",           # 본번
            "ji": "6",              # 지번
            "plat_gb_cd": "0"       # 대지
        },
        # 추가 테스트 케이스
        # {
        #     "name": "다른 주소 테스트",
        #     "sigungu_cd": "11110",  # 종로구
        #     "bjdong_cd": "10100",   # 청운동
        #     "bun": "1",
        #     "ji": "",
        #     "plat_gb_cd": "0"
        # }
    ]

    async with BuildingLedgerAPIClient() as client:
        for i, test_case in enumerate(test_cases, 1):
            logger.info(f"\n[테스트 {i}] {test_case['name']}")
            logger.info(f"주소 코드: {test_case['sigungu_cd']}-{test_case['bjdong_cd']} {test_case['bun']}-{test_case['ji']}")

            try:
                # 건축물대장 검색
                result = await client.search_building_by_address(
                    sigungu_cd=test_case["sigungu_cd"],
                    bjdong_cd=test_case["bjdong_cd"],
                    plat_gb_cd=test_case["plat_gb_cd"],
                    bun=test_case["bun"],
                    ji=test_case["ji"]
                )

                if result["success"]:
                    logger.info(f"✅ 검색 성공! 총 {result['totalCount']}건 발견")

                    # 결과 출력
                    for idx, item in enumerate(result["items"], 1):
                        logger.info(f"\n--- 건물 {idx} ---")
                        logger.info(f"관리번호(PK): {item.get('mgmBldrgstPk', 'N/A')}")
                        logger.info(f"대지위치: {item.get('platPlc', 'N/A')}")
                        logger.info(f"도로명주소: {item.get('newPlatPlc', 'N/A')}")
                        logger.info(f"건물명: {item.get('bldNm', 'N/A')}")
                        logger.info(f"주용도: {item.get('mainPurpsCdNm', 'N/A')}")
                        logger.info(f"연면적: {item.get('totArea', 'N/A')} ㎡")
                        logger.info(f"건축면적: {item.get('archArea', 'N/A')} ㎡")
                        logger.info(f"건폐율: {item.get('bcRat', 'N/A')}%")
                        logger.info(f"용적률: {item.get('vlRat', 'N/A')}%")
                        logger.info(f"사용승인일: {item.get('useAprDay', 'N/A')}")

                        # 상세 정보 조회 테스트 (첫 번째 건물만)
                        if idx == 1 and item.get('mgmBldrgstPk'):
                            logger.info(f"\n[상세 정보 조회 테스트]")
                            detail_result = await client.get_building_detail(
                                sigungu_cd=test_case["sigungu_cd"],
                                bjdong_cd=test_case["bjdong_cd"],
                                plat_gb_cd=test_case["plat_gb_cd"],
                                bun=test_case["bun"],
                                ji=test_case["ji"],
                                mgm_bldrgst_pk=item['mgmBldrgstPk']
                            )

                            if detail_result["success"] and detail_result["item"]:
                                detail = detail_result["item"]
                                logger.info(f"✅ 상세 조회 성공!")
                                logger.info(f"지상층수: {detail.get('grndFlrCnt', 'N/A')}층")
                                logger.info(f"지하층수: {detail.get('ugrndFlrCnt', 'N/A')}층")
                                logger.info(f"높이: {detail.get('height', 'N/A')}m")
                                logger.info(f"세대수: {detail.get('hhldCnt', 'N/A')}")
                                logger.info(f"승용승강기: {detail.get('rideUseElvtCnt', 'N/A')}대")
                                logger.info(f"허가일: {detail.get('pmsDay', 'N/A')}")
                                logger.info(f"착공일: {detail.get('stcnsDay', 'N/A')}")
                else:
                    logger.error(f"❌ 검색 실패")

            except Exception as e:
                logger.error(f"❌ 테스트 실패: {e}", exc_info=True)

    logger.info("\n=== 건축물대장 API 테스트 완료 ===")


async def main():
    """메인 실행 함수."""
    await test_building_search()


if __name__ == "__main__":
    asyncio.run(main())
