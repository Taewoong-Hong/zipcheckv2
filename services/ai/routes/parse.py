"""Parsing API routes (guide compatibility).

Provides /parse/registry endpoint that parses a registry PDF from URL.
"""
import logging
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any

from core.auth import get_current_user
from ingest.registry_parser import parse_registry_from_url

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/parse", tags=["parse"])


class ParseRegistryRequest(BaseModel):
    file_url: str = Field(..., description="Registry PDF public URL")


class ParseRegistryResponse(BaseModel):
    parsed: Dict[str, Any]
    confidence: float
    text_length: Optional[int] = None


@router.post("/registry", response_model=ParseRegistryResponse)
async def parse_registry_endpoint(
    request: ParseRegistryRequest,
    user: dict = Depends(get_current_user)
):
    """
    Parse registry PDF from a public URL and return structured data.

    Note: Confidence is heuristically estimated based on parsed content size.
    """
    try:
        doc = await parse_registry_from_url(request.file_url)
        masked = doc.to_masked_dict()

        # Heuristic confidence: longer text and presence of sections increase confidence
        section_count = 0
        section_count += len(masked.get("mortgages", []) or [])
        section_count += len(masked.get("seizures", []) or [])
        section_count += len(masked.get("lease_rights", []) or [])
        base_conf = 0.5 + min(section_count * 0.1, 0.4)
        confidence = round(min(max(base_conf, 0.0), 0.99), 2)

        return ParseRegistryResponse(
            parsed=masked,
            confidence=confidence,
            text_length=len(doc.raw_text) if getattr(doc, "raw_text", None) else None,
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Registry parse failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to parse registry: {str(e)}")

