"""Consensus logic for cross-validating OCR results from multiple models."""
import logging
from difflib import SequenceMatcher
from typing import Literal

logger = logging.getLogger(__name__)


class ConsensusResult:
    """Result of consensus validation between two OCR outputs."""

    def __init__(
        self,
        gemini_text: str,
        claude_text: str,
        similarity_score: float,
        agreed_text: str,
        confidence: Literal["high", "medium", "low"],
        needs_review: bool,
    ):
        self.gemini_text = gemini_text
        self.claude_text = claude_text
        self.similarity_score = similarity_score
        self.agreed_text = agreed_text
        self.confidence = confidence
        self.needs_review = needs_review

    def __repr__(self):
        return (
            f"ConsensusResult(similarity={self.similarity_score:.2f}, "
            f"confidence={self.confidence}, "
            f"needs_review={self.needs_review})"
        )


def calculate_similarity(text1: str, text2: str) -> float:
    """
    Calculate similarity between two texts using SequenceMatcher.

    Args:
        text1: First text
        text2: Second text

    Returns:
        Similarity score between 0.0 and 1.0
    """
    # Normalize texts (remove extra whitespace, lowercase)
    norm1 = " ".join(text1.split()).lower()
    norm2 = " ".join(text2.split()).lower()

    matcher = SequenceMatcher(None, norm1, norm2)
    return matcher.ratio()


def validate_consensus(
    gemini_text: str,
    claude_text: str,
    high_confidence_threshold: float = 0.9,
    medium_confidence_threshold: float = 0.7,
) -> ConsensusResult:
    """
    Validate consensus between Gemini and Claude OCR results.

    Strategy:
    - High confidence (>= 0.9 similarity): Use Gemini result (faster model)
    - Medium confidence (>= 0.7 similarity): Use longer result (more complete)
    - Low confidence (< 0.7 similarity): Flag for manual review, use Gemini by default

    Args:
        gemini_text: Text extracted by Gemini
        claude_text: Text extracted by Claude
        high_confidence_threshold: Threshold for high confidence (default 0.9)
        medium_confidence_threshold: Threshold for medium confidence (default 0.7)

    Returns:
        ConsensusResult with validation details
    """
    logger.info("Validating consensus between Gemini and Claude OCR results")

    # Calculate similarity
    similarity = calculate_similarity(gemini_text, claude_text)

    logger.info(
        f"Similarity score: {similarity:.2f} "
        f"(Gemini: {len(gemini_text)} chars, Claude: {len(claude_text)} chars)"
    )

    # Determine confidence level and agreed text
    if similarity >= high_confidence_threshold:
        confidence: Literal["high", "medium", "low"] = "high"
        agreed_text = gemini_text  # Use Gemini (faster, cheaper)
        needs_review = False
        logger.info("High confidence consensus - using Gemini result")

    elif similarity >= medium_confidence_threshold:
        confidence = "medium"
        # Use the longer text (likely more complete)
        agreed_text = gemini_text if len(gemini_text) >= len(claude_text) else claude_text
        needs_review = False
        logger.info(
            f"Medium confidence consensus - using {'Gemini' if len(gemini_text) >= len(claude_text) else 'Claude'} result"
        )

    else:
        confidence = "low"
        # Default to Gemini but flag for review
        agreed_text = gemini_text
        needs_review = True
        logger.warning(
            f"Low confidence consensus ({similarity:.2f}) - flagged for manual review"
        )

    return ConsensusResult(
        gemini_text=gemini_text,
        claude_text=claude_text,
        similarity_score=similarity,
        agreed_text=agreed_text,
        confidence=confidence,
        needs_review=needs_review,
    )


async def parallel_ocr_with_consensus(
    file_path: str,
    file_type: Literal["pdf", "image"],
    gemini_ocr_func,
    claude_ocr_func,
) -> ConsensusResult:
    """
    Run Gemini and Claude OCR in parallel and validate consensus.

    Args:
        file_path: Path to file (PDF or image)
        file_type: Type of file ("pdf" or "image")
        gemini_ocr_func: Gemini OCR function
        claude_ocr_func: Claude OCR function

    Returns:
        ConsensusResult with validation details

    Note:
        In production, use asyncio.gather() for true parallel execution.
        For now, we run sequentially for simplicity.
    """
    logger.info(f"Starting parallel OCR for {file_type}: {file_path}")

    # Run Gemini OCR
    logger.info("Running Gemini OCR...")
    gemini_text = gemini_ocr_func(file_path)

    # Run Claude OCR
    logger.info("Running Claude OCR...")
    claude_text = claude_ocr_func(file_path)

    # Validate consensus
    result = validate_consensus(gemini_text, claude_text)

    logger.info(f"Parallel OCR completed: {result}")

    return result