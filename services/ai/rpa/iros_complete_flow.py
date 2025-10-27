"""
IROS Complete RPA Flow: Login → Search → Payment → Download PDF → Save to DB
Integrates Playwright for web automation and PyAutoGUI for native UI handling
"""
import asyncio
import logging
from pathlib import Path
from datetime import datetime
from typing import Optional, Tuple
import sys

# Add parent directory to path
sys.path.append(str(Path(__file__).parent.parent))

from epagesafer_handler import EPageSaferHandler

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class IROSCompleteFlow:
    """Complete IROS RPA flow with PDF download and database integration"""

    def __init__(self, download_dir: str = "./downloads"):
        """
        Initialize complete flow handler

        Args:
            download_dir: Directory for downloaded PDFs
        """
        self.download_dir = Path(download_dir)
        self.download_dir.mkdir(parents=True, exist_ok=True)
        self.epagesafer_handler = EPageSaferHandler(download_dir=str(self.download_dir))

    async def click_issue_button_and_download(self) -> Tuple[bool, Optional[Path]]:
        """
        Click '발급' button and handle PDF download

        This should be called AFTER navigating to the 미열람·미발급 page
        where the '발급' button is visible.

        Returns:
            Tuple of (success: bool, pdf_path: Optional[Path])
        """
        try:
            logger.info("=" * 60)
            logger.info("Step: Click '발급' button and download PDF")
            logger.info("=" * 60)

            # Note: The actual Playwright click should be done by the calling code
            # This function focuses on handling the modal and download

            # Generate filename with timestamp
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"registry_document_{timestamp}.pdf"

            logger.info(f"Target filename: {filename}")

            # Process ePageSAFER modal and download
            success, pdf_path = self.epagesafer_handler.process_iros_download(
                custom_filename=filename,
                modal_timeout=30,
                download_timeout=20
            )

            if success and pdf_path:
                logger.info(f"✅ PDF downloaded successfully: {pdf_path}")
                return True, pdf_path
            else:
                logger.error("❌ Failed to download PDF")
                # Take screenshot for debugging
                screenshot = self.epagesafer_handler.take_screenshot(
                    filename=f"error_screenshot_{timestamp}.png"
                )
                logger.info(f"Error screenshot saved: {screenshot}")
                return False, None

        except Exception as e:
            logger.error(f"Error in click_issue_button_and_download: {e}", exc_info=True)
            return False, None

    async def save_to_supabase(self, pdf_path: Path, metadata: dict) -> bool:
        """
        Save PDF to Supabase Storage and record metadata

        Args:
            pdf_path: Path to PDF file
            metadata: Dictionary with document metadata
                Required keys: user_id, property_address, document_type

        Returns:
            True if saved successfully, False otherwise
        """
        try:
            logger.info("=" * 60)
            logger.info("Step: Save PDF to Supabase")
            logger.info("=" * 60)

            # Import Supabase client
            from core.database import get_supabase_client

            supabase = get_supabase_client()

            # 1. Upload PDF to Storage
            bucket_name = "registry_documents"
            storage_path = f"{metadata['user_id']}/{pdf_path.name}"

            logger.info(f"Uploading to: {bucket_name}/{storage_path}")

            with open(pdf_path, 'rb') as f:
                pdf_data = f.read()

            # Upload file
            result = supabase.storage.from_(bucket_name).upload(
                path=storage_path,
                file=pdf_data,
                file_options={"content-type": "application/pdf"}
            )

            if result.get('error'):
                logger.error(f"Storage upload error: {result['error']}")
                return False

            logger.info(f"✅ PDF uploaded to storage: {storage_path}")

            # Get public URL
            public_url = supabase.storage.from_(bucket_name).get_public_url(storage_path)

            # 2. Save metadata to database (v2_documents table)
            doc_data = {
                "user_id": metadata["user_id"],
                "property_address": metadata["property_address"],
                "document_type": metadata.get("document_type", "registry_certificate"),
                "file_url": public_url,
                "file_path": storage_path,
                "file_size": len(pdf_data),
                "status": "completed",
                "payment_amount": metadata.get("payment_amount", 1000),
                "payment_method": metadata.get("payment_method", "prepaid_electronic"),
                "issued_at": datetime.now().isoformat(),
            }

            insert_result = supabase.table("v2_documents").insert(doc_data).execute()

            if insert_result.data:
                logger.info(f"✅ Metadata saved to database: {insert_result.data[0]['id']}")
                return True
            else:
                logger.error("Failed to save metadata to database")
                return False

        except Exception as e:
            logger.error(f"Error saving to Supabase: {e}", exc_info=True)
            return False

    async def run_complete_flow(
        self,
        user_id: str,
        property_address: str = "서울특별시 동작구 남부순환로257길 33, 제에이동 제4층 제401호"
    ) -> Tuple[bool, Optional[str]]:
        """
        Run complete IROS flow

        Args:
            user_id: User ID for database
            property_address: Property address (already processed)

        Returns:
            Tuple of (success: bool, pdf_url: Optional[str])
        """
        try:
            logger.info("=" * 60)
            logger.info("IROS COMPLETE FLOW STARTED")
            logger.info("=" * 60)

            # Note: Login, search, payment steps should be done separately
            # This focuses on the final steps: issue button → download → save

            logger.info("Waiting for '발급' button click in Playwright...")
            logger.info("Please ensure the button is clicked before proceeding")

            # Step 1: Handle PDF download (after button click)
            success, pdf_path = await self.click_issue_button_and_download()
            if not success or not pdf_path:
                return False, None

            # Step 2: Save to Supabase
            metadata = {
                "user_id": user_id,
                "property_address": property_address,
                "document_type": "registry_certificate",
                "payment_amount": 1000,
                "payment_method": "prepaid_electronic",
            }

            saved = await self.save_to_supabase(pdf_path, metadata)
            if not saved:
                return False, None

            # Step 3: Get public URL for display
            from core.database import get_supabase_client
            supabase = get_supabase_client()

            storage_path = f"{user_id}/{pdf_path.name}"
            public_url = supabase.storage.from_("registry_documents").get_public_url(storage_path)

            logger.info("=" * 60)
            logger.info("✅ COMPLETE FLOW FINISHED SUCCESSFULLY")
            logger.info(f"PDF URL: {public_url}")
            logger.info("=" * 60)

            return True, public_url

        except Exception as e:
            logger.error(f"Error in complete flow: {e}", exc_info=True)
            return False, None


async def main():
    """Main entry point for testing"""
    flow = IROSCompleteFlow(download_dir="./downloads")

    # Test user
    test_user_id = "test_user_123"
    test_property = "서울특별시 동작구 남부순환로257길 33, 제에이동 제4층 제401호"

    print("=" * 60)
    print("IROS Complete Flow Test")
    print("=" * 60)
    print("Prerequisites:")
    print("1. Playwright browser should be at 미열람·미발급 page")
    print("2. '발급' button should be visible")
    print("3. ePageSAFER should be installed on system")
    print("=" * 60)
    print("Press Enter to continue...")
    input()

    # Run complete flow
    success, pdf_url = await flow.run_complete_flow(
        user_id=test_user_id,
        property_address=test_property
    )

    if success:
        print(f"✅ Success! PDF URL: {pdf_url}")
    else:
        print("❌ Flow failed. Check logs for details.")


if __name__ == "__main__":
    asyncio.run(main())
