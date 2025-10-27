"""
Simple script to handle ePageSAFER modal immediately
Run this AFTER clicking the '발급' button in Playwright
"""
import time
import pyautogui
from datetime import datetime
from pathlib import Path

print("=" * 60)
print("ePageSAFER Handler - Waiting for modal...")
print("=" * 60)

# Wait a bit for modal to appear after button click
time.sleep(2)

# Method 1: Press Enter (most common confirmation)
print("\nAttempting to confirm modal with Enter key...")
pyautogui.press('enter')
time.sleep(1)

# Method 2: Try Alt+S (sometimes "저장" button shortcut)
print("Attempting Alt+S (Save shortcut)...")
pyautogui.hotkey('alt', 's')
time.sleep(1)

# Method 3: Try Ctrl+S (another save shortcut)
print("Attempting Ctrl+S...")
pyautogui.hotkey('ctrl', 's')
time.sleep(2)

# Check for PDF in Downloads folder
downloads = Path.home() / "Downloads"
print(f"\nChecking for PDF in: {downloads}")

pdf_files = list(downloads.glob("*.pdf"))
if pdf_files:
    # Get most recent
    latest = max(pdf_files, key=lambda p: p.stat().st_mtime)
    age = time.time() - latest.stat().st_mtime

    if age < 30:  # Within last 30 seconds
        print(f"\nSUCCESS! Found recent PDF:")
        print(f"  File: {latest.name}")
        print(f"  Size: {latest.stat().st_size} bytes")
        print(f"  Age: {age:.1f} seconds")

        # Copy to our downloads folder
        target_dir = Path(__file__).parent / "downloads"
        target_dir.mkdir(exist_ok=True)

        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        target = target_dir / f"registry_document_{timestamp}.pdf"

        import shutil
        shutil.copy2(latest, target)
        print(f"\nCopied to: {target}")
    else:
        print(f"\nFound PDF but it's too old ({age:.1f}s)")
else:
    print("\nNo PDF found yet. ePageSAFER might need manual intervention.")

    # Take screenshot for debugging
    screenshot_dir = Path(__file__).parent / "downloads"
    screenshot_dir.mkdir(exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    screenshot_path = screenshot_dir / f"screenshot_{timestamp}.png"

    screenshot = pyautogui.screenshot()
    screenshot.save(str(screenshot_path))
    print(f"Screenshot saved: {screenshot_path}")

print("\n" + "=" * 60)
print("Handler finished")
print("=" * 60)
