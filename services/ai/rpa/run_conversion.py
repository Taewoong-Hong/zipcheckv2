"""
Simple script to convert PS to PDF and upload to database
"""
import asyncio
import logging
from pathlib import Path
import sys

# Add parent directory to path
sys.path.append(str(Path(__file__).parent.parent))

from rpa.iros_pdf_handler import complete_iros_flow

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)

logger = logging.getLogger(__name__)


async def main():
    """Main function"""
    print("=" * 70)
    print("IROS Document Processing - Complete Flow")
    print("=" * 70)
    print()

    # Test configuration
    user_id = "test_user_20250127"
    property_address = "서울특별시 동작구 남부순환로257길 33, 제에이동 제4층 제401호"
    max_wait = 120  # 2 minutes

    print(f"User ID: {user_id}")
    print(f"Property: {property_address}")
    print(f"Max wait: {max_wait} seconds")
    print()
    print("Looking for recent PS or PDF files in Downloads folder...")
    print()

    # Run complete flow
    success, pdf_url = await complete_iros_flow(
        user_id=user_id,
        property_address=property_address,
        wait_for_download=max_wait
    )

    print()
    print("=" * 70)
    if success:
        print("✅ SUCCESS!")
        print()
        print(f"PDF URL: {pdf_url}")
        print()
        print("Next steps:")
        print("1. Access PDF at URL above")
        print("2. View in app PDF viewer")
        print("3. Check Supabase Storage")
    else:
        print("❌ FAILED!")
        print("Check logs above for details")
    print("=" * 70)

    return success


if __name__ == "__main__":
    result = asyncio.run(main())
    sys.exit(0 if result else 1)
