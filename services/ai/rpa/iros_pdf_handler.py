"""
IROS Registry Document Handler
Handles both PS and PDF files from IROS, converts PS to PDF, and saves to database
"""
import logging
import time
from pathlib import Path
from datetime import datetime
from typing import Optional, Tuple, Union
import shutil

from ps_to_pdf_converter import PSToPDFConverter, PSConverterError

logger = logging.getLogger(__name__)


class IROSDocumentHandler:
    """Handle IROS registry documents (PS/PDF) with conversion and database storage"""

    def __init__(self, download_dir: str = "./downloads"):
        """
        Initialize document handler

        Args:
            download_dir: Directory for downloaded files
        """
        self.download_dir = Path(download_dir)
        self.download_dir.mkdir(parents=True, exist_ok=True)
        self.ps_converter = PSToPDFConverter()

    def find_latest_document(
        self,
        extensions: list = ['.ps', '.pdf'],
        max_age_seconds: int = 60
    ) -> Optional[Path]:
        """
        Find the most recently downloaded document (PS or PDF)

        Args:
            extensions: File extensions to look for
            max_age_seconds: Maximum age of file in seconds

        Returns:
            Path to latest document or None if not found
        """
        # Check default Downloads folder
        downloads_folder = Path.home() / "Downloads"

        logger.info(f"Searching for documents in: {downloads_folder}")
        logger.info(f"Extensions: {extensions}, Max age: {max_age_seconds}s")

        latest_file = None
        latest_time = 0

        for ext in extensions:
            pattern = f"*{ext}"
            for file_path in downloads_folder.glob(pattern):
                file_time = file_path.stat().st_mtime
                age = time.time() - file_time

                if age <= max_age_seconds and file_time > latest_time:
                    latest_file = file_path
                    latest_time = file_time

        if latest_file:
            age = time.time() - latest_time
            logger.info(f"Found document: {latest_file.name} (age: {age:.1f}s)")
            return latest_file
        else:
            logger.warning(f"No recent documents found within {max_age_seconds}s")
            return None

    def process_document(
        self,
        file_path: Optional[Path] = None,
        output_filename: Optional[str] = None,
        max_wait: int = 60
    ) -> Tuple[bool, Optional[Path]]:
        """
        Process IROS document: find file, convert PS to PDF if needed, save to downloads

        Args:
            file_path: Explicit file path (optional, will auto-detect if not provided)
            output_filename: Custom output filename (optional)
            max_wait: Maximum wait time for file detection (seconds)

        Returns:
            Tuple of (success: bool, pdf_path: Optional[Path])
        """
        try:
            # Step 1: Find document if not provided
            if file_path is None:
                logger.info(f"Auto-detecting document (max wait: {max_wait}s)...")

                start_time = time.time()
                file_path = None

                while time.time() - start_time < max_wait:
                    file_path = self.find_latest_document(
                        extensions=['.ps', '.pdf'],
                        max_age_seconds=max_wait
                    )

                    if file_path:
                        break

                    time.sleep(2)

                if not file_path:
                    logger.error("No document found within timeout")
                    return False, None

            # Step 2: Determine output path
            if output_filename:
                output_path = self.download_dir / output_filename
            else:
                timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                output_path = self.download_dir / f"registry_document_{timestamp}.pdf"

            # Step 3: Convert or copy based on file type
            if file_path.suffix.lower() in ['.ps', '.eps']:
                logger.info(f"PS file detected: {file_path}")
                logger.info("Converting PS to PDF...")

                try:
                    pdf_path = self.ps_converter.convert(
                        str(file_path),
                        str(output_path)
                    )
                    logger.info(f"✅ PS converted to PDF: {pdf_path}")
                    logger.info(f"   Size: {pdf_path.stat().st_size:,} bytes")
                    logger.info(f"   Method: {self.ps_converter.conversion_method}")

                except PSConverterError as e:
                    logger.error(f"❌ PS conversion failed: {e}")
                    return False, None

            elif file_path.suffix.lower() == '.pdf':
                logger.info(f"PDF file detected: {file_path}")
                logger.info("Copying PDF to downloads folder...")

                shutil.copy2(file_path, output_path)
                pdf_path = output_path
                logger.info(f"✅ PDF copied: {pdf_path}")

            else:
                logger.error(f"Unsupported file type: {file_path.suffix}")
                return False, None

            # Step 4: Verify final PDF
            if not pdf_path.exists() or pdf_path.stat().st_size == 0:
                logger.error("Final PDF is missing or empty")
                return False, None

            logger.info(f"✅ Document processed successfully: {pdf_path}")
            return True, pdf_path

        except Exception as e:
            logger.error(f"Error processing document: {e}", exc_info=True)
            return False, None

    async def save_to_database(
        self,
        pdf_path: Path,
        user_id: str,
        property_address: str,
        metadata: Optional[dict] = None
    ) -> bool:
        """
        Save PDF to Supabase Storage and record metadata in database

        Args:
            pdf_path: Path to PDF file
            user_id: User ID
            property_address: Property address
            metadata: Additional metadata (optional)

        Returns:
            True if saved successfully, False otherwise
        """
        try:
            logger.info("=" * 60)
            logger.info("Saving to Supabase Database")
            logger.info("=" * 60)

            # Import Supabase client
            import sys
            sys.path.append(str(Path(__file__).parent.parent))

            from core.database import get_supabase_client

            supabase = get_supabase_client()

            # 1. Upload PDF to Storage
            bucket_name = "registry_documents"
            storage_path = f"{user_id}/{pdf_path.name}"

            logger.info(f"Uploading to: {bucket_name}/{storage_path}")

            with open(pdf_path, 'rb') as f:
                pdf_data = f.read()

            # Upload file
            result = supabase.storage.from_(bucket_name).upload(
                path=storage_path,
                file=pdf_data,
                file_options={"content-type": "application/pdf"}
            )

            if hasattr(result, 'error') and result.error:
                logger.error(f"Storage upload error: {result.error}")
                return False

            logger.info(f"✅ PDF uploaded: {storage_path}")

            # Get public URL
            public_url = supabase.storage.from_(bucket_name).get_public_url(storage_path)

            # 2. Save metadata to database
            doc_metadata = metadata or {}

            doc_data = {
                "user_id": user_id,
                "property_address": property_address,
                "document_type": doc_metadata.get("document_type", "registry_certificate"),
                "file_url": public_url,
                "file_path": storage_path,
                "file_size": len(pdf_data),
                "status": "completed",
                "payment_amount": doc_metadata.get("payment_amount", 1000),
                "payment_method": doc_metadata.get("payment_method", "prepaid_electronic"),
                "issued_at": datetime.now().isoformat(),
            }

            insert_result = supabase.table("v2_documents").insert(doc_data).execute()

            if insert_result.data:
                doc_id = insert_result.data[0]['id']
                logger.info(f"✅ Metadata saved: Document ID {doc_id}")
                logger.info(f"📄 Public URL: {public_url}")
                return True
            else:
                logger.error("Failed to save metadata to database")
                return False

        except Exception as e:
            logger.error(f"Error saving to database: {e}", exc_info=True)
            return False


async def complete_iros_flow(
    user_id: str,
    property_address: str,
    wait_for_download: int = 60
) -> Tuple[bool, Optional[str]]:
    """
    Complete IROS document processing flow

    Args:
        user_id: User ID for database
        property_address: Property address
        wait_for_download: Maximum wait time for download (seconds)

    Returns:
        Tuple of (success: bool, pdf_url: Optional[str])
    """
    handler = IROSDocumentHandler()

    logger.info("=" * 60)
    logger.info("IROS Complete Flow Started")
    logger.info("=" * 60)

    # Step 1: Process document (find, convert if needed)
    success, pdf_path = handler.process_document(max_wait=wait_for_download)
    if not success or not pdf_path:
        logger.error("❌ Document processing failed")
        return False, None

    # Step 2: Save to database
    saved = await handler.save_to_database(
        pdf_path=pdf_path,
        user_id=user_id,
        property_address=property_address,
        metadata={
            "document_type": "registry_certificate",
            "payment_amount": 1000,
            "payment_method": "prepaid_electronic"
        }
    )

    if not saved:
        logger.error("❌ Database save failed")
        return False, None

    # Step 3: Get public URL
    from core.database import get_supabase_client
    supabase = get_supabase_client()

    storage_path = f"{user_id}/{pdf_path.name}"
    public_url = supabase.storage.from_("registry_documents").get_public_url(storage_path)

    logger.info("=" * 60)
    logger.info("✅ IROS Complete Flow Finished")
    logger.info(f"PDF URL: {public_url}")
    logger.info("=" * 60)

    return True, public_url


# Test function
if __name__ == "__main__":
    import asyncio

    logging.basicConfig(level=logging.INFO)

    async def test():
        success, url = await complete_iros_flow(
            user_id="test_user_123",
            property_address="서울특별시 동작구 남부순환로257길 33, 제에이동 제4층 제401호",
            wait_for_download=60
        )

        if success:
            print(f"\n✅ Success! PDF URL: {url}")
        else:
            print("\n❌ Failed!")

    asyncio.run(test())
