"""
PS (PostScript) to PDF Converter for IROS Registry Documents
Handles .ps files downloaded from IROS and converts them to PDF format
"""
import logging
from pathlib import Path
from typing import Optional
import shutil

logger = logging.getLogger(__name__)


class PSConverterError(Exception):
    """Custom exception for PS conversion errors"""
    pass


class PSToPDFConverter:
    """Convert PostScript (.ps) files to PDF format"""

    def __init__(self):
        """Initialize converter"""
        self.conversion_method = None

    def convert(self, ps_file_path: str, output_pdf_path: Optional[str] = None) -> Path:
        """
        Convert PS file to PDF

        Args:
            ps_file_path: Path to input .ps file
            output_pdf_path: Path for output .pdf file (optional, defaults to same name with .pdf)

        Returns:
            Path to converted PDF file

        Raises:
            PSConverterError: If conversion fails with all methods
        """
        ps_path = Path(ps_file_path)

        if not ps_path.exists():
            raise PSConverterError(f"PS file not found: {ps_file_path}")

        if not ps_path.suffix.lower() in ['.ps', '.eps']:
            raise PSConverterError(f"Not a PS file: {ps_file_path}")

        # Determine output path
        if output_pdf_path:
            pdf_path = Path(output_pdf_path)
        else:
            pdf_path = ps_path.with_suffix('.pdf')

        logger.info(f"Converting PS to PDF: {ps_path} -> {pdf_path}")

        # Try multiple conversion methods
        methods = [
            self._convert_with_pymupdf,
            self._convert_with_ghostscript,
            self._convert_with_subprocess,
        ]

        last_error = None
        for method in methods:
            try:
                method(ps_path, pdf_path)
                logger.info(f"✅ Conversion successful using {method.__name__}")
                self.conversion_method = method.__name__
                return pdf_path
            except Exception as e:
                logger.warning(f"Method {method.__name__} failed: {e}")
                last_error = e
                continue

        # All methods failed
        raise PSConverterError(f"All conversion methods failed. Last error: {last_error}")

    def _convert_with_pymupdf(self, ps_path: Path, pdf_path: Path) -> None:
        """
        Convert using PyMuPDF (fitz) library

        Args:
            ps_path: Input PS file path
            pdf_path: Output PDF file path
        """
        try:
            import fitz  # PyMuPDF
        except ImportError:
            raise PSConverterError("PyMuPDF not installed. Run: pip install pymupdf")

        logger.info("Trying conversion with PyMuPDF...")

        try:
            # Open PS file
            doc = fitz.open(str(ps_path))

            # Save as PDF
            doc.save(str(pdf_path))
            doc.close()

            # Verify output
            if not pdf_path.exists() or pdf_path.stat().st_size == 0:
                raise PSConverterError("PDF file not created or empty")

            logger.info(f"PyMuPDF conversion successful: {pdf_path.stat().st_size} bytes")

        except Exception as e:
            raise PSConverterError(f"PyMuPDF conversion failed: {e}")

    def _convert_with_ghostscript(self, ps_path: Path, pdf_path: Path) -> None:
        """
        Convert using Ghostscript command-line tool

        Args:
            ps_path: Input PS file path
            pdf_path: Output PDF file path
        """
        import subprocess
        import platform

        # Determine Ghostscript command based on OS
        if platform.system() == 'Windows':
            gs_commands = ['gswin64c.exe', 'gswin32c.exe', 'gs']
        else:
            gs_commands = ['gs']

        logger.info("Trying conversion with Ghostscript...")

        for gs_cmd in gs_commands:
            try:
                cmd = [
                    gs_cmd,
                    '-dNOPAUSE',
                    '-dBATCH',
                    '-dSAFER',
                    '-sDEVICE=pdfwrite',
                    '-dCompatibilityLevel=1.4',
                    '-dPDFSETTINGS=/prepress',
                    f'-sOutputFile={pdf_path}',
                    str(ps_path)
                ]

                result = subprocess.run(
                    cmd,
                    capture_output=True,
                    text=True,
                    timeout=60
                )

                if result.returncode == 0 and pdf_path.exists():
                    logger.info(f"Ghostscript conversion successful: {pdf_path.stat().st_size} bytes")
                    return

                logger.warning(f"{gs_cmd} failed with code {result.returncode}")
                if result.stderr:
                    logger.warning(f"Error output: {result.stderr[:500]}")

            except FileNotFoundError:
                logger.warning(f"{gs_cmd} not found in PATH")
                continue
            except Exception as e:
                logger.warning(f"{gs_cmd} failed: {e}")
                continue

        raise PSConverterError("Ghostscript not available or conversion failed")

    def _convert_with_subprocess(self, ps_path: Path, pdf_path: Path) -> None:
        """
        Convert using ps2pdf command (if available)

        Args:
            ps_path: Input PS file path
            pdf_path: Output PDF file path
        """
        import subprocess

        logger.info("Trying conversion with ps2pdf...")

        try:
            cmd = ['ps2pdf', str(ps_path), str(pdf_path)]

            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=60
            )

            if result.returncode == 0 and pdf_path.exists():
                logger.info(f"ps2pdf conversion successful: {pdf_path.stat().st_size} bytes")
                return

            raise PSConverterError(f"ps2pdf failed with code {result.returncode}")

        except FileNotFoundError:
            raise PSConverterError("ps2pdf command not found")
        except Exception as e:
            raise PSConverterError(f"ps2pdf conversion failed: {e}")


def convert_iros_registry_ps(ps_file: str, output_dir: Optional[str] = None) -> Path:
    """
    Convenience function to convert IROS registry PS file to PDF

    Args:
        ps_file: Path to downloaded .ps file from IROS
        output_dir: Optional output directory (defaults to same as input)

    Returns:
        Path to converted PDF file

    Example:
        >>> pdf_path = convert_iros_registry_ps("registry_20250127.ps")
        >>> print(f"PDF created: {pdf_path}")
    """
    converter = PSToPDFConverter()

    ps_path = Path(ps_file)

    if output_dir:
        output_path = Path(output_dir) / ps_path.with_suffix('.pdf').name
    else:
        output_path = None

    return converter.convert(str(ps_path), str(output_path) if output_path else None)


# Test function
if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)

    import sys
    if len(sys.argv) < 2:
        print("Usage: python ps_to_pdf_converter.py <input.ps> [output.pdf]")
        sys.exit(1)

    input_ps = sys.argv[1]
    output_pdf = sys.argv[2] if len(sys.argv) > 2 else None

    try:
        result = convert_iros_registry_ps(input_ps, output_pdf)
        print(f"✅ Success! PDF created: {result}")
    except Exception as e:
        print(f"❌ Error: {e}")
        sys.exit(1)
