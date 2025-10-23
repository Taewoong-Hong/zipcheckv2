"""PDF quality assessment for routing to appropriate processing method."""
import logging
from pathlib import Path
from typing import Literal

import fitz  # PyMuPDF

logger = logging.getLogger(__name__)


class PDFQualityResult:
    """PDF quality assessment result."""

    def __init__(
        self,
        has_text_layer: bool,
        text_length: int,
        page_count: int,
        avg_text_per_page: float,
        has_korean: bool,
        quality_score: float,
        needs_ocr: bool,
        method: Literal["direct", "ocr"],
    ):
        self.has_text_layer = has_text_layer
        self.text_length = text_length
        self.page_count = page_count
        self.avg_text_per_page = avg_text_per_page
        self.has_korean = has_korean
        self.quality_score = quality_score
        self.needs_ocr = needs_ocr
        self.method = method

    def __repr__(self):
        return (
            f"PDFQualityResult(method={self.method}, "
            f"score={self.quality_score:.2f}, "
            f"pages={self.page_count}, "
            f"text_length={self.text_length})"
        )


def assess_pdf_quality(pdf_path: str, min_quality_score: float = 0.6) -> PDFQualityResult:
    """
    Assess PDF quality to determine processing method.

    Strategy:
    - High quality (score >= threshold) → Direct text extraction with pypdf
    - Low quality (score < threshold) → OCR with Gemini + Claude

    Args:
        pdf_path: Path to PDF file
        min_quality_score: Minimum score threshold for direct extraction (default 0.6)

    Returns:
        PDFQualityResult with assessment details

    Quality Scoring Heuristics:
    - Has text layer: +0.3
    - Korean text present: +0.3
    - Reasonable text length: +0.2
    - Good text per page ratio: +0.2
    """
    logger.info(f"Assessing PDF quality: {pdf_path}")

    try:
        doc = fitz.open(pdf_path)
        page_count = len(doc)

        # Extract all text from PDF
        all_text = ""
        for page in doc:
            all_text += page.get_text()

        doc.close()

        text_length = len(all_text.strip())
        avg_text_per_page = text_length / page_count if page_count > 0 else 0

        # Check if text layer exists (not just image-only PDF)
        has_text_layer = text_length > 50  # At least 50 characters

        # Check for Korean characters
        has_korean = any("\uac00" <= c <= "\ud7a3" for c in all_text)

        # Calculate quality score
        quality_score = 0.0

        # 1. Has extractable text layer
        if has_text_layer:
            quality_score += 0.3

        # 2. Korean text present (important for Korean contracts)
        if has_korean:
            quality_score += 0.3

        # 3. Reasonable text length (at least 200 chars for a contract)
        if text_length >= 200:
            quality_score += 0.2

        # 4. Good text per page ratio (at least 100 chars per page average)
        if avg_text_per_page >= 100:
            quality_score += 0.2

        # Determine processing method
        needs_ocr = quality_score < min_quality_score
        method: Literal["direct", "ocr"] = "ocr" if needs_ocr else "direct"

        result = PDFQualityResult(
            has_text_layer=has_text_layer,
            text_length=text_length,
            page_count=page_count,
            avg_text_per_page=avg_text_per_page,
            has_korean=has_korean,
            quality_score=quality_score,
            needs_ocr=needs_ocr,
            method=method,
        )

        logger.info(
            f"PDF quality assessment: {result.method} "
            f"(score={quality_score:.2f}, "
            f"pages={page_count}, "
            f"text_length={text_length}, "
            f"korean={has_korean})"
        )

        return result

    except Exception as e:
        logger.error(f"Failed to assess PDF quality: {e}")
        # On error, default to OCR for safety
        return PDFQualityResult(
            has_text_layer=False,
            text_length=0,
            page_count=0,
            avg_text_per_page=0.0,
            has_korean=False,
            quality_score=0.0,
            needs_ocr=True,
            method="ocr",
        )


def extract_text_from_pdf_direct(pdf_path: str) -> str:
    """
    Extract text directly from PDF (for high-quality PDFs).

    Args:
        pdf_path: Path to PDF file

    Returns:
        Extracted text

    Raises:
        Exception: If extraction fails
    """
    logger.info(f"Extracting text directly from PDF: {pdf_path}")

    try:
        doc = fitz.open(pdf_path)
        all_text = []

        for page_num, page in enumerate(doc):
            page_text = page.get_text()
            all_text.append(f"\n\n--- 페이지 {page_num + 1} ---\n\n{page_text}")

        doc.close()

        result = "".join(all_text)
        logger.info(f"Successfully extracted {len(result)} characters from PDF")

        return result

    except Exception as e:
        logger.error(f"Failed to extract text from PDF: {e}")
        raise