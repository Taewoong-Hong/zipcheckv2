"""Claude Vision API for OCR cross-validation."""
import base64
import logging
from pathlib import Path
from typing import List

import anthropic
from PIL import Image
import fitz  # PyMuPDF
import io

from .settings import settings

logger = logging.getLogger(__name__)


def pdf_to_images(pdf_path: str, dpi: int = 200) -> List[Image.Image]:
    """
    Convert PDF pages to PIL Images.

    Args:
        pdf_path: Path to PDF file
        dpi: Resolution for image conversion (default 200 for OCR quality)

    Returns:
        List of PIL Image objects
    """
    images = []
    pdf_document = fitz.open(pdf_path)

    for page_num in range(len(pdf_document)):
        page = pdf_document[page_num]
        # Convert to pixmap with specified DPI
        mat = fitz.Matrix(dpi / 72, dpi / 72)
        pix = page.get_pixmap(matrix=mat)

        # Convert to PIL Image
        img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
        images.append(img)

    pdf_document.close()
    return images


def load_image(image_path: str) -> Image.Image:
    """
    Load image from file path.

    Args:
        image_path: Path to image file

    Returns:
        PIL Image object
    """
    return Image.open(image_path)


def image_to_base64(image: Image.Image, format: str = "PNG") -> tuple[str, str]:
    """
    Convert PIL Image to base64 string.

    Args:
        image: PIL Image object
        format: Image format (PNG, JPEG, etc.)

    Returns:
        Tuple of (base64_string, media_type)
    """
    buffered = io.BytesIO()
    image.save(buffered, format=format)
    img_bytes = buffered.getvalue()
    img_base64 = base64.b64encode(img_bytes).decode("utf-8")

    media_type = f"image/{format.lower()}"
    return img_base64, media_type


def extract_text_from_image_with_claude(image: Image.Image) -> str:
    """
    Extract text from image using Claude Vision.

    Args:
        image: PIL Image object

    Returns:
        Extracted text

    Raises:
        Exception: If OCR fails
    """
    if not settings.anthropic_api_key:
        raise ValueError("ANTHROPIC_API_KEY not found in settings")

    client = anthropic.Anthropic(api_key=settings.anthropic_api_key)

    # Convert image to base64
    img_base64, media_type = image_to_base64(image)

    prompt = """이 이미지는 부동산 계약서의 한 페이지입니다.
이미지에서 모든 텍스트를 정확하게 추출해주세요.

요구사항:
1. 텍스트를 정확하게 읽어주세요 (오타 없이)
2. 원본 레이아웃과 순서를 유지해주세요
3. 표, 항목 번호, 날짜, 주소 등 모든 내용을 포함해주세요
4. 특히 주소 정보는 정확하게 추출해주세요
5. 불필요한 설명 없이 텍스트만 추출해주세요

추출된 텍스트:"""

    try:
        message = client.messages.create(
            model="claude-3-5-sonnet-latest",
            max_tokens=4096,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "image",
                            "source": {
                                "type": "base64",
                                "media_type": media_type,
                                "data": img_base64,
                            },
                        },
                        {"type": "text", "text": prompt},
                    ],
                }
            ],
        )

        return message.content[0].text

    except Exception as e:
        logger.error(f"Claude Vision OCR failed: {e}")
        raise


def extract_text_from_pdf_with_claude(pdf_path: str, dpi: int = 200) -> str:
    """
    Extract text from PDF using Claude Vision OCR.

    This is used for cross-validation with Gemini results.

    Args:
        pdf_path: Path to PDF file
        dpi: Resolution for image conversion (default 200)

    Returns:
        Extracted text from all pages

    Raises:
        ValueError: If API key is not configured
        Exception: If OCR fails
    """
    logger.info(f"Starting Claude Vision OCR for PDF: {pdf_path}")

    # Convert PDF to images
    images = pdf_to_images(pdf_path, dpi=dpi)
    logger.info(f"Converted PDF to {len(images)} images")

    # Extract text from each page
    all_text = []
    for i, image in enumerate(images):
        logger.info(f"Claude processing page {i + 1}/{len(images)}")
        try:
            page_text = extract_text_from_image_with_claude(image)
            all_text.append(f"\n\n--- 페이지 {i + 1} ---\n\n{page_text}")
        except Exception as e:
            logger.warning(f"Failed to extract text from page {i + 1}: {e}")
            all_text.append(f"\n\n--- 페이지 {i + 1} (추출 실패) ---\n\n")

    result = "".join(all_text)
    logger.info(f"Claude Vision OCR completed. Extracted {len(result)} characters")

    return result


def extract_text_from_image_file_with_claude(image_path: str) -> str:
    """
    Extract text from image file using Claude Vision OCR.

    Supports: JPG, PNG, GIF, WebP

    Args:
        image_path: Path to image file

    Returns:
        Extracted text

    Raises:
        ValueError: If API key is not configured
        Exception: If OCR fails
    """
    logger.info(f"Starting Claude Vision OCR for image: {image_path}")

    try:
        image = load_image(image_path)
        text = extract_text_from_image_with_claude(image)
        logger.info(f"Claude Vision OCR completed. Extracted {len(text)} characters")
        return text
    except Exception as e:
        logger.error(f"Failed to extract text from image: {e}")
        raise
