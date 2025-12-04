"""PDF 파싱 및 텍스트 추출."""
import logging
import tempfile
from pathlib import Path
from typing import List, Dict, Any, cast

import fitz  # PyMuPDF
from PIL import Image

logger = logging.getLogger(__name__)


# ----------------------------------------
# 1) PyMuPDF 텍스트 추출
# ----------------------------------------
def _parse_with_pymupdf(path: str) -> str:
    """
    PyMuPDF로 빠르게 텍스트를 추출합니다.
    """
    try:
        doc = fitz.open(path)  # type: ignore[attr-defined]
        texts = []
        for page in doc:
            texts.append(page.get_text("text"))
        doc.close()
        return "\n".join(texts).strip()
    except Exception as e:
        logger.warning(f"PyMuPDF 파싱 실패: {e}")
        return ""


def parse_pdf_to_text(path: str) -> str:
    """
    PDF 파일을 텍스트로 파싱합니다 (PyMuPDF 사용).
    """
    file_path = Path(path)
    if not file_path.exists():
        raise FileNotFoundError(f"PDF 파일을 찾을 수 없습니다: {path}")

    logger.info(f"PDF 파싱 시작 (PyMuPDF): {path}")
    text = _parse_with_pymupdf(str(file_path))

    if text:
        logger.info(f"PDF 파싱 완료: {len(text)} 글자")
        return text
    else:
        raise ValueError(f"PDF에서 텍스트를 추출할 수 없습니다: {path}")


# ----------------------------------------
# 2) PDF + 메타데이터 파싱
# ----------------------------------------
def parse_pdf_with_metadata(path: str) -> List[Dict[str, Any]]:
    """
    페이지별 텍스트 + 메타데이터 반환
    """
    file_path = Path(path)
    if not file_path.exists():
        raise FileNotFoundError(f"PDF 파일을 찾을 수 없습니다: {path}")

    try:
        logger.info(f"PDF 메타데이터 파싱 시작: {path}")

        doc = fitz.open(str(file_path))  # type: ignore[attr-defined]
        pages_data = []

        for page_num in range(len(doc)):
            page = doc[page_num]
            text = page.get_text()

            page_data = {
                "text": text,
                "page": page_num + 1,
                "metadata": {
                    "width": page.rect.width,
                    "height": page.rect.height,
                    "rotation": page.rotation,
                },
            }
            pages_data.append(page_data)

        doc.close()
        logger.info(f"PDF 메타데이터 파싱 완료: {len(pages_data)} 페이지")
        return pages_data

    except Exception as e:
        logger.error(f"PDF 메타데이터 파싱 실패: {e}")
        raise ValueError(f"PDF 메타데이터 파싱 중 오류 발생: {e}") from e


# ----------------------------------------
# 3) PDF → 이미지 변환 (Vision API 용)
# ----------------------------------------
def pdf_to_images(path: str, output_dir: str | None = None, dpi: int = 200) -> List[str]:
    """
    PDF 페이지를 이미지로 변환합니다.
    """
    file_path = Path(path)
    if not file_path.exists():
        raise FileNotFoundError(f"PDF 파일을 찾을 수 없습니다: {path}")

    if output_dir is None:
        output_dir = tempfile.mkdtemp(prefix="pdf_images_")

    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)

    logger.info(f"PDF → 이미지 변환 시작: {path}, DPI={dpi}")

    try:
        doc = fitz.open(str(file_path))  # type: ignore[attr-defined]
        image_paths = []

        for page_num in range(len(doc)):
            page = doc[page_num]

            zoom = dpi / 72
            mat = fitz.Matrix(zoom, zoom)
            pix = page.get_pixmap(matrix=mat)

            image_filename = f"page_{page_num + 1:03d}.png"
            image_path = output_path / image_filename
            pix.save(str(image_path))

            image_paths.append(str(image_path))
            logger.debug(f"페이지 {page_num + 1} → {image_path}")

        doc.close()
        logger.info(f"PDF → 이미지 변환 완료: {len(image_paths)}개 페이지")
        return image_paths

    except Exception as e:
        logger.error(f"PDF → 이미지 변환 실패: {e}")
        raise ValueError(f"PDF를 이미지로 변환 중 오류 발생: {e}") from e


# ----------------------------------------
# 4) Vision OCR 기반 스캔 PDF 파싱
# ----------------------------------------
def parse_scanned_pdf_with_vision(path: str) -> Dict[str, Any]:
    """
    스캔 PDF를 Vision AI로 JSON 파싱합니다.
    """
    from ..core.vision import extract_contract_from_pdf_images

    logger.info(f"스캔 PDF Vision 파싱 시작: {path}")

    image_paths = pdf_to_images(path, dpi=200)

    try:
        result = extract_contract_from_pdf_images(image_paths, combine=True)
        logger.info(f"스캔 PDF Vision 파싱 완료: {path}")
        return cast(Dict[str, Any], result)

    finally:
        for img_path in image_paths:
            try:
                Path(img_path).unlink()
            except Exception as e:
                logger.warning(f"임시 이미지 삭제 실패: {img_path}, {e}")


# ----------------------------------------
# 5) PDF 유효성 검사
# ----------------------------------------
def validate_pdf(path: str, max_size_mb: int = 50) -> bool:
    """
    PDF 파일 유효성 검사.
    """
    file_path = Path(path)

    if not file_path.exists():
        raise ValueError(f"파일이 존재하지 않습니다: {path}")

    file_size_mb = file_path.stat().st_size / (1024 * 1024)
    if file_size_mb > max_size_mb:
        raise ValueError(
            f"파일 크기가 너무 큽니다: {file_size_mb:.2f}MB (최대: {max_size_mb}MB)"
        )

    if file_path.suffix.lower() != ".pdf":
        raise ValueError(f"PDF 파일이 아닙니다: {path}")

    try:
        doc = fitz.open(str(file_path))  # type: ignore[attr-defined]
        page_count = len(doc)
        doc.close()

        if page_count == 0:
            raise ValueError("PDF에 페이지가 없습니다")

        logger.info(f"PDF 유효성 검증 성공: {file_size_mb:.2f}MB, {page_count} 페이지")
        return True

    except Exception as e:
        raise ValueError(f"PDF 파일이 손상되었거나 유효하지 않습니다: {e}") from e
