"""Public data aggregation routes (guide compatibility).

Provides /fetch/public endpoint to collect market/building data for an address.
"""
import logging
from datetime import datetime
from typing import Any, Dict, Optional

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field

from core.auth import get_current_user
from core.public_data_api import (
    LegalDongCodeAPIClient,
    AptTradeAPIClient,
)
from core.settings import settings
import httpx

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/fetch", tags=["public-data"])


class FetchPublicRequest(BaseModel):
    address: str = Field(..., description="Full address keyword for lookup")


class FetchPublicResponse(BaseModel):
    ok: bool
    address: str
    lawd5: Optional[str] = None
    market: Optional[Dict[str, Any]] = None


@router.post("/public", response_model=FetchPublicResponse)
async def fetch_public_data(
    request: FetchPublicRequest,
    user: dict = Depends(get_current_user)
):
    """
    Aggregate public market data for an address.

    Currently returns:
    - lawd5 code via LegalDongCode API
    - average apartment trade price for current month (if available)
    """
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            # 1) 법정동 코드 조회
            lawd5: Optional[str] = None
            try:
                legal = LegalDongCodeAPIClient(settings.public_data_api_key, client=client)
                res = await legal.get_legal_dong_code(keyword=request.address)
                items = res.get("body", {}).get("items", [])
                if items:
                    lawd5 = items[0].get("lawd5")
            except Exception as e:
                logger.warning(f"Legal dong code lookup failed: {e}")

            # 2) 실거래가 평균 (가능한 경우)
            market: Optional[Dict[str, Any]] = None
            if lawd5:
                now = datetime.now()
                deal_ymd = f"{now.year}{now.month:02d}"
                try:
                    apt = AptTradeAPIClient(settings.public_data_api_key, client=client)
                    trades = await apt.get_apt_trades(lawd_cd=lawd5, deal_ymd=deal_ymd)
                    items = trades.get("body", {}).get("items", [])
                    amounts = [i.get("dealAmount") for i in items if i.get("dealAmount")]
                    avg = int(sum(amounts) / len(amounts)) if amounts else None
                    market = {
                        "avg_trade_price": avg,
                        "deal_ymd": deal_ymd,
                        "sample_count": len(amounts),
                    }
                except Exception as e:
                    logger.warning(f"Apt trade lookup failed: {e}")

            return FetchPublicResponse(
                ok=True,
                address=request.address,
                lawd5=lawd5,
                market=market,
            )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"fetch_public_data failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch public data")

