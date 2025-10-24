"""Building Ledger API Routes."""
import logging
from typing import Optional
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from core.building_ledger_api import BuildingLedgerAPIClient, BuildingLedgerAPIError

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/building", tags=["building"])


# Request/Response Models
class BuildingSearchRequest(BaseModel):
    """건축물대장 검색 요청."""
    sigungu_cd: str = Field(..., description="시군구코드 5자리 (예: 11680)", min_length=5, max_length=5)
    bjdong_cd: str = Field(..., description="법정동코드 5자리 (예: 10300)", min_length=5, max_length=5)
    bun: str = Field(..., description="본번 (예: 12 or 0012)")
    ji: str = Field(default="", description="지번 (예: 3 or 0003)")
    plat_gb_cd: str = Field(default="0", description="대지구분코드 (0:대지, 1:산, 2:블록)")
    num_of_rows: int = Field(default=10, ge=1, le=100, description="페이지당 결과 수")
    page_no: int = Field(default=1, ge=1, description="페이지 번호")


class BuildingDetailRequest(BaseModel):
    """건축물대장 상세 조회 요청."""
    sigungu_cd: str = Field(..., description="시군구코드 5자리")
    bjdong_cd: str = Field(..., description="법정동코드 5자리")
    bun: str = Field(..., description="본번")
    ji: str = Field(default="", description="지번")
    plat_gb_cd: str = Field(default="0", description="대지구분코드")
    mgm_bldrgst_pk: str = Field(..., description="관리건축물대장PK (고유번호)")


@router.post("/search")
async def search_building(request: BuildingSearchRequest):
    """
    건축물대장 검색 (주소 기반).

    주소 정보를 통해 건축물대장 표제부 요약 정보를 검색합니다.

    **사용 예시:**
    ```json
    {
        "sigungu_cd": "11680",
        "bjdong_cd": "10300",
        "bun": "12",
        "ji": "3",
        "plat_gb_cd": "0",
        "num_of_rows": 10,
        "page_no": 1
    }
    ```

    **응답 예시:**
    ```json
    {
        "success": true,
        "totalCount": 1,
        "items": [
            {
                "mgmBldrgstPk": "11680-100123456",
                "platPlc": "서울특별시 강남구 역삼동 12-3",
                "bldNm": "역삼빌딩",
                "mainPurpsCdNm": "업무시설",
                "totArea": "1234.56",
                "archArea": "567.89",
                "useAprDay": "20200101"
            }
        ]
    }
    ```
    """
    logger.info(f"건축물대장 검색 요청: {request.model_dump()}")

    try:
        async with BuildingLedgerAPIClient() as client:
            result = await client.search_building_by_address(
                sigungu_cd=request.sigungu_cd,
                bjdong_cd=request.bjdong_cd,
                plat_gb_cd=request.plat_gb_cd,
                bun=request.bun,
                ji=request.ji,
                num_of_rows=request.num_of_rows,
                page_no=request.page_no
            )

            return result

    except BuildingLedgerAPIError as e:
        logger.error(f"건축물대장 검색 실패: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"건축물대장 검색 중 예외 발생: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.post("/detail")
async def get_building_detail(request: BuildingDetailRequest):
    """
    건축물대장 상세 정보 조회 (표제부).

    관리건축물대장PK를 통해 상세 정보를 조회합니다.

    **사용 예시:**
    ```json
    {
        "sigungu_cd": "11680",
        "bjdong_cd": "10300",
        "bun": "12",
        "ji": "3",
        "plat_gb_cd": "0",
        "mgm_bldrgst_pk": "11680-100123456"
    }
    ```

    **응답 예시:**
    ```json
    {
        "success": true,
        "item": {
            "mgmBldrgstPk": "11680-100123456",
            "platPlc": "서울특별시 강남구 역삼동 12-3",
            "newPlatPlc": "서울특별시 강남구 테헤란로 123",
            "bldNm": "역삼빌딩",
            "mainPurpsCdNm": "업무시설",
            "totArea": "1234.56",
            "archArea": "567.89",
            "bcRat": "60.5",
            "vlRat": "200.3",
            "grndFlrCnt": "10",
            "ugrndFlrCnt": "3",
            "useAprDay": "20200101"
        }
    }
    ```
    """
    logger.info(f"건축물대장 상세 조회 요청: pk={request.mgm_bldrgst_pk}")

    try:
        async with BuildingLedgerAPIClient() as client:
            result = await client.get_building_detail(
                sigungu_cd=request.sigungu_cd,
                bjdong_cd=request.bjdong_cd,
                plat_gb_cd=request.plat_gb_cd,
                bun=request.bun,
                ji=request.ji,
                mgm_bldrgst_pk=request.mgm_bldrgst_pk
            )

            return result

    except BuildingLedgerAPIError as e:
        logger.error(f"건축물대장 상세 조회 실패: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"건축물대장 상세 조회 중 예외 발생: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/search-simple")
async def search_building_simple(
    sigungu_cd: str = Query(..., description="시군구코드 5자리 (예: 11680)"),
    bjdong_cd: str = Query(..., description="법정동코드 5자리 (예: 10300)"),
    bun: str = Query(..., description="본번 (예: 12)"),
    ji: str = Query(default="", description="지번 (예: 3)"),
    plat_gb_cd: str = Query(default="0", description="대지구분코드 (0:대지, 1:산, 2:블록)")
):
    """
    건축물대장 간편 검색 (GET 방식).

    Query Parameter를 사용한 간단한 검색 API입니다.

    **사용 예시:**
    ```
    GET /building/search-simple?sigungu_cd=11680&bjdong_cd=10300&bun=12&ji=3
    ```
    """
    logger.info(f"건축물대장 간편 검색: {sigungu_cd}-{bjdong_cd} {bun}-{ji}")

    try:
        async with BuildingLedgerAPIClient() as client:
            result = await client.search_building_by_address(
                sigungu_cd=sigungu_cd,
                bjdong_cd=bjdong_cd,
                plat_gb_cd=plat_gb_cd,
                bun=bun,
                ji=ji
            )

            return result

    except BuildingLedgerAPIError as e:
        logger.error(f"건축물대장 간편 검색 실패: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"건축물대장 간편 검색 중 예외 발생: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")
