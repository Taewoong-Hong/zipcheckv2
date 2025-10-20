"""PDF 파싱 및 텍스트 추출."""
import logging
import tempfile
from pathlib import Path
from typing import List, Dict, Any

import fitz  # PyMuPDF (import as fitz)
from unstructured.partition.pdf import partition_pdf
from PIL import Image

logger = logging.getLogger(__name__)


def _parse_with_pymupdf(path: str) -> str:
    """
    PyMuPDF로 빠르게 텍스트를 추출합니다.

    Args:
        path: PDF 파일 경로

    Returns:
        추출된 텍스트 (빈 문자열일 수 있음)
    """
    try:
        doc = fitz.open(path)
        texts = []
        for page in doc:
            texts.append(page.get_text("text"))
        doc.close()
        return "\n".join(texts).strip()
    except Exception as e:
        logger.warning(f"PyMuPDF 파싱 실패: {e}")
        return ""


def parse_pdf_to_text(
    path: str,
    strategy: str = "fast",
    min_text_threshold: int = 100
) -> str:
    """
    PDF 파일을 텍스트로 파싱합니다.
    PyMuPDF 우선 시도 → 실패 시 unstructured 폴백

    Args:
        path: PDF 파일 경로
        strategy: unstructured 파싱 전략 ("fast", "hi_res", "ocr_only")
        min_text_threshold: PyMuPDF 결과가 이 길이 미만이면 unstructured 사용

    Returns:
        추출된 전체 텍스트

    Raises:
        FileNotFoundError: 파일이 존재하지 않을 때
        ValueError: 파싱 실패 시

    Note:
        - PyMuPDF: 빠른 추출 (1-2초/문서)
        - unstructured: 레이아웃 인식, OCR 지원 (느림)
        - 전략:
          - "fast": 빠른 파싱, OCR 없음
          - "hi_res": 고해상도 파싱, 레이아웃 인식
          - "ocr_only": OCR만 사용 (스캔 문서용)
    """
    file_path = Path(path)
    if not file_path.exists():
        raise FileNotFoundError(f"PDF 파일을 찾을 수 없습니다: {path}")

    # 1. PyMuPDF 우선 시도 (빠름)
    logger.info(f"PDF 파싱 시작 (PyMuPDF): {path}")
    text = _parse_with_pymupdf(str(file_path))

    if len(text) >= min_text_threshold:
        logger.info(
            f"PDF 파싱 완료 (PyMuPDF): {len(text)} 글자"
        )
        return text

    # 2. PyMuPDF 결과가 빈약하면 unstructured 폴백
    logger.info(
        f"PyMuPDF 결과 빈약 ({len(text)} < {min_text_threshold}), "
        f"unstructured 폴백 (strategy={strategy})"
    )

    try:
        elements = partition_pdf(filename=str(file_path), strategy=strategy)

        # 텍스트 요소만 추출하여 결합
        text_parts = [
            element.text
            for element in elements
            if hasattr(element, "text") and element.text
        ]

        full_text = "\n".join(text_parts)
        logger.info(
            f"PDF 파싱 완료 (unstructured): {len(text_parts)}개 요소, "
            f"{len(full_text)} 글자"
        )

        return full_text

    except Exception as e:
        logger.error(f"PDF 파싱 실패 (unstructured): {e}")
        # unstructured도 실패하면 PyMuPDF 결과라도 반환
        if text:
            logger.warning("unstructured 실패, PyMuPDF 결과 반환")
            return text
        raise ValueError(f"PDF 파싱 중 오류 발생: {e}") from e


def parse_pdf_with_metadata(path: str) -> List[Dict[str, Any]]:
    """
    PDF를 파싱하고 페이지별 메타데이터와 함께 반환합니다.

    Args:
        path: PDF 파일 경로

    Returns:
        페이지별 텍스트와 메타데이터 리스트
        [{"text": str, "page": int, "metadata": dict}, ...]

    Example:
        >>> pages = parse_pdf_with_metadata("contract.pdf")
        >>> for page_data in pages:
        ...     print(f"페이지 {page_data['page']}: {page_data['text'][:100]}")
    """
    file_path = Path(path)
    if not file_path.exists():
        raise FileNotFoundError(f"PDF 파일을 찾을 수 없습니다: {path}")

    try:
        logger.info(f"PDF 메타데이터 파싱 시작: {path}")
        doc = fitz.open(str(file_path))

        pages_data = []
        for page_num in range(len(doc)):
            page = doc[page_num]
            text = page.get_text()

            page_data = {
                "text": text,
                "page": page_num + 1,  # 1-indexed
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


def pdf_to_images(path: str, output_dir: str | None = None, dpi: int = 200) -> List[str]:
    """
    PDF 페이지를 이미지로 변환합니다 (Vision API용).

    Args:
        path: PDF 파일 경로
        output_dir: 출력 디렉토리 (None이면 임시 디렉토리 사용)
        dpi: 이미지 해상도 (기본값: 200, OCR용 권장)

    Returns:
        생성된 이미지 파일 경로 목록 (페이지 순서대로)

    Example:
        >>> images = pdf_to_images("contract.pdf")
        >>> for img_path in images:
        ...     result = extract_contract_with_vision(img_path)
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
        doc = fitz.open(str(file_path))
        image_paths = []

        for page_num in range(len(doc)):
            page = doc[page_num]

            # PDF 페이지를 이미지로 렌더링
            # matrix = zoom factor for DPI (200 DPI → zoom = 200/72 = 2.78)
            zoom = dpi / 72
            mat = fitz.Matrix(zoom, zoom)
            pix = page.get_pixmap(matrix=mat)

            # PNG로 저장
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


def parse_scanned_pdf_with_vision(path: str) -> Dict[str, Any]:
    """
    스캔된 PDF를 GPT-4o Vision API로 구조화된 JSON으로 파싱합니다.

    Args:
        path: PDF 파일 경로

    Returns:
        구조화된 계약서 데이터 (RealEstateContract 스키마)

    Raises:
        FileNotFoundError: 파일이 존재하지 않을 때
        ValueError: 파싱 실패 시

    Note:
        - PDF의 모든 페이지를 이미지로 변환한 후 Vision API 호출
        - 여러 페이지의 정보를 자동으로 병합
        - Structured Outputs로 일관된 JSON 스키마 보장

    Example:
        >>> result = parse_scanned_pdf_with_vision("scanned_contract.pdf")
        >>> print(result["property"]["address"])
        >>> print(result["terms"]["deposit"])
    """
    from ..core.vision import extract_contract_from_pdf_images

    logger.info(f"스캔 PDF Vision 파싱 시작: {path}")

    # 1. PDF를 이미지로 변환
    image_paths = pdf_to_images(path, dpi=200)

    try:
        # 2. Vision API로 구조화된 데이터 추출
        result = extract_contract_from_pdf_images(image_paths, combine=True)
        logger.info(f"스캔 PDF Vision 파싱 완료: {path}")
        return result

    finally:
        # 3. 임시 이미지 파일 정리
        for img_path in image_paths:
            try:
                Path(img_path).unlink()
            except Exception as e:
                logger.warning(f"임시 이미지 삭제 실패: {img_path}, {e}")


def validate_pdf(path: str, max_size_mb: int = 50) -> bool:
    """
    PDF 파일 유효성을 검증합니다.

    Args:
        path: PDF 파일 경로
        max_size_mb: 최대 파일 크기 (MB)

    Returns:
        유효하면 True, 아니면 False

    Raises:
        ValueError: 파일이 유효하지 않을 때
    """
    file_path = Path(path)

    # 파일 존재 확인
    if not file_path.exists():
        raise ValueError(f"파일이 존재하지 않습니다: {path}")

    # 파일 크기 확인
    file_size_mb = file_path.stat().st_size / (1024 * 1024)
    if file_size_mb > max_size_mb:
        raise ValueError(
            f"파일 크기가 너무 큽니다: {file_size_mb:.2f}MB "
            f"(최대: {max_size_mb}MB)"
        )

    # MIME 타입 확인 (확장자)
    if file_path.suffix.lower() != ".pdf":
        raise ValueError(f"PDF 파일이 아닙니다: {path}")

    # PDF 열기 테스트
    try:
        doc = fitz.open(str(file_path))
        page_count = len(doc)
        doc.close()

        if page_count == 0:
            raise ValueError("PDF에 페이지가 없습니다")

        logger.info(
            f"PDF 유효성 검증 성공: {file_size_mb:.2f}MB, "
            f"{page_count} 페이지"
        )
        return True

    except Exception as e:
        raise ValueError(f"PDF 파일이 손상되었거나 유효하지 않습니다: {e}") from e
