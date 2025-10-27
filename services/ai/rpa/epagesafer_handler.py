"""
ePageSAFER Modal Handler for IROS Registry Document Issuance
Windows UI Automation using PyAutoGUI
"""
import pyautogui
import time
import os
from pathlib import Path
from typing import Optional, Tuple
import logging

logger = logging.getLogger(__name__)

class EPageSaferHandler:
    """Handles ePageSAFER security program modals for IROS PDF downloads"""

    def __init__(self, download_dir: str = "./downloads"):
        """
        Initialize handler

        Args:
            download_dir: Directory to save downloaded PDFs
        """
        self.download_dir = Path(download_dir)
        self.download_dir.mkdir(parents=True, exist_ok=True)

        # PyAutoGUI settings
        pyautogui.FAILSAFE = True  # Move mouse to corner to abort
        pyautogui.PAUSE = 0.5  # Pause between actions

    def wait_for_modal(self, timeout: int = 30) -> bool:
        """
        Wait for ePageSAFER modal window to appear

        Args:
            timeout: Maximum wait time in seconds

        Returns:
            True if modal appeared, False otherwise
        """
        logger.info(f"Waiting for ePageSAFER modal (timeout: {timeout}s)")
        start_time = time.time()

        while time.time() - start_time < timeout:
            # Try to find window by title (adjust based on actual window title)
            windows = pyautogui.getWindowsWithTitle('ePageSAFER')
            if windows:
                logger.info("ePageSAFER modal detected")
                return True

            # Also check for Markany-related windows
            windows = pyautogui.getWindowsWithTitle('Markany')
            if windows:
                logger.info("Markany modal detected")
                return True

            time.sleep(0.5)

        logger.warning("ePageSAFER modal not detected within timeout")
        return False

    def click_confirm_button(
        self,
        button_image: Optional[str] = None,
        confidence: float = 0.9
    ) -> bool:
        """
        Click confirm button on ePageSAFER modal using image recognition

        Args:
            button_image: Path to button screenshot (e.g., 'epagesafer_confirm.png')
            confidence: Image matching confidence (0.0-1.0)

        Returns:
            True if button clicked, False otherwise
        """
        try:
            logger.info("Looking for confirm button")

            # Method 1: Image recognition (preferred for stability)
            if button_image and os.path.exists(button_image):
                logger.info(f"Using image recognition: {button_image}")
                location = pyautogui.locateOnScreen(
                    button_image,
                    confidence=confidence
                )

                if location:
                    center = pyautogui.center(location)
                    logger.info(f"Button found at: {center}")
                    pyautogui.click(center)
                    time.sleep(1)
                    return True
                else:
                    logger.warning(f"Button image not found on screen")

            # Method 2: Keyboard shortcut (fallback)
            logger.info("Fallback: Pressing Enter to confirm")
            pyautogui.press('enter')
            time.sleep(1)

            return True

        except Exception as e:
            logger.error(f"Failed to click confirm button: {e}")
            return False

    def handle_save_dialog(self, filename: Optional[str] = None) -> bool:
        """
        Handle Windows Save As dialog

        Args:
            filename: Custom filename (optional)

        Returns:
            True if saved successfully, False otherwise
        """
        try:
            logger.info("Handling Save As dialog")

            if filename:
                # Clear current filename and type new one
                logger.info(f"Setting filename: {filename}")
                pyautogui.hotkey('ctrl', 'a')  # Select all
                time.sleep(0.2)
                pyautogui.write(filename, interval=0.1)
                time.sleep(0.5)

            # Press Enter to save
            logger.info("Pressing Enter to save")
            pyautogui.press('enter')
            time.sleep(2)

            return True

        except Exception as e:
            logger.error(f"Failed to handle save dialog: {e}")
            return False

    def get_latest_pdf(self, timeout: int = 10) -> Optional[Path]:
        """
        Get the most recently downloaded PDF file

        Args:
            timeout: Maximum wait time in seconds

        Returns:
            Path to PDF file or None if not found
        """
        logger.info(f"Looking for latest PDF in: {self.download_dir}")
        start_time = time.time()

        while time.time() - start_time < timeout:
            pdf_files = list(self.download_dir.glob("*.pdf"))

            if pdf_files:
                # Get most recent file
                latest_pdf = max(pdf_files, key=lambda p: p.stat().st_mtime)
                logger.info(f"Found PDF: {latest_pdf}")
                return latest_pdf

            time.sleep(0.5)

        logger.warning("No PDF file found within timeout")
        return None

    def process_iros_download(
        self,
        custom_filename: Optional[str] = None,
        modal_timeout: int = 30,
        download_timeout: int = 20
    ) -> Tuple[bool, Optional[Path]]:
        """
        Complete process to handle IROS PDF download with ePageSAFER

        Args:
            custom_filename: Custom filename for PDF (optional)
            modal_timeout: Wait time for modal (seconds)
            download_timeout: Wait time for download completion (seconds)

        Returns:
            Tuple of (success: bool, pdf_path: Optional[Path])
        """
        try:
            # Step 1: Wait for ePageSAFER modal
            if not self.wait_for_modal(timeout=modal_timeout):
                logger.error("ePageSAFER modal did not appear")
                return False, None

            # Step 2: Click confirm button
            if not self.click_confirm_button():
                logger.error("Failed to click confirm button")
                return False, None

            # Step 3: Wait a bit for Save As dialog
            time.sleep(2)

            # Step 4: Handle Save As dialog
            if not self.handle_save_dialog(filename=custom_filename):
                logger.error("Failed to handle save dialog")
                return False, None

            # Step 5: Get downloaded PDF
            pdf_path = self.get_latest_pdf(timeout=download_timeout)
            if not pdf_path:
                logger.error("Failed to find downloaded PDF")
                return False, None

            logger.info(f"Successfully downloaded PDF: {pdf_path}")
            return True, pdf_path

        except Exception as e:
            logger.error(f"Error processing IROS download: {e}")
            return False, None

    def take_screenshot(self, filename: str = "epagesafer_screenshot.png") -> Path:
        """
        Take screenshot for debugging

        Args:
            filename: Screenshot filename

        Returns:
            Path to screenshot file
        """
        screenshot_path = self.download_dir / filename
        screenshot = pyautogui.screenshot()
        screenshot.save(str(screenshot_path))
        logger.info(f"Screenshot saved: {screenshot_path}")
        return screenshot_path


# Usage example
if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)

    handler = EPageSaferHandler(download_dir="./downloads")

    # After clicking "발급" button in IROS
    print("Click '발급' button in IROS, then press Enter...")
    input()

    # Process download
    success, pdf_path = handler.process_iros_download(
        custom_filename="registry_document.pdf",
        modal_timeout=30,
        download_timeout=20
    )

    if success:
        print(f"✅ PDF downloaded successfully: {pdf_path}")
    else:
        print("❌ Failed to download PDF")
        # Take screenshot for debugging
        screenshot = handler.take_screenshot()
        print(f"Screenshot saved: {screenshot}")
