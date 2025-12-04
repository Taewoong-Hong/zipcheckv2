#!/usr/bin/env python3
"""
Find 서초 cases in the database for testing checkpoint logs.

This script queries v2_cases table for any records with 서초 in address fields.
"""
import asyncio
import os
from pathlib import Path

# Add services/ai to Python path for imports
import sys
sys.stdout.reconfigure(encoding='utf-8')  # Fix cp949 encoding error on Windows
sys.path.insert(0, str(Path(__file__).parent / 'services' / 'ai'))

from dotenv import load_dotenv


async def find_seocho_cases():
    """Query database for 서초 cases."""
    # Load environment variables
    env_path = Path(__file__).parent / 'services' / 'ai' / '.env'
    load_dotenv(env_path)

    db_url = os.getenv('DATABASE_URL')
    if not db_url:
        print("ERROR: DATABASE_URL not found in .env file")
        return

    print(f"Connecting to database...")
    print(f"Database URL: {db_url[:50]}...")

    try:
        import asyncpg
    except ImportError:
        print("ERROR: asyncpg not installed. Installing...")
        import subprocess
        subprocess.run([sys.executable, "-m", "pip", "install", "asyncpg"], check=True)
        import asyncpg

    # Convert psycopg URL to asyncpg format if needed
    if 'postgresql+psycopg://' in db_url:
        db_url = db_url.replace('postgresql+psycopg://', 'postgresql://')

    try:
        conn = await asyncpg.connect(db_url)
        print("✅ Connected to database")

        # Query 1: Search for 서초 in address fields
        print("\n" + "="*80)
        print("QUERY 1: Searching v2_cases for 서초 addresses...")
        print("="*80)

        rows = await conn.fetch("""
            SELECT
                id,
                address_road,
                address_lot,
                address_dong,
                address_ho,
                contract_type,
                created_at,
                updated_at
            FROM v2_cases
            WHERE
                address_road ILIKE '%서초%'
                OR address_lot ILIKE '%서초%'
                OR address_dong ILIKE '%서초%'
            ORDER BY created_at DESC
            LIMIT 10
        """)

        if rows:
            print(f"\n✅ Found {len(rows)} case(s) with 서초 in address:")
            print("-" * 80)

            for i, row in enumerate(rows, 1):
                print(f"\n[{i}] CASE ID: {row['id']}")
                print(f"    Address (road): {row['address_road'][:100] if row['address_road'] else 'N/A'}")
                print(f"    Address (lot):  {row['address_lot'][:100] if row['address_lot'] else 'N/A'}")
                print(f"    Dong:           {row['address_dong']}")
                print(f"    Ho:             {row['address_ho']}")
                print(f"    Contract Type:  {row['contract_type']}")
                print(f"    Created:        {row['created_at']}")
                print(f"    Updated:        {row['updated_at']}")

                # Check for artifacts
                artifacts = await conn.fetch("""
                    SELECT
                        id,
                        artifact_type,
                        file_path,
                        file_name,
                        file_size,
                        created_at
                    FROM v2_artifacts
                    WHERE case_id = $1
                    ORDER BY created_at DESC
                """, row['id'])

                if artifacts:
                    print(f"    Artifacts ({len(artifacts)}):")
                    for art in artifacts:
                        print(f"      - {art['artifact_type']}: {art['file_name']} ({art['file_size']} bytes)")
                        print(f"        Path: {art['file_path']}")
                else:
                    print(f"    Artifacts: None")
        else:
            print("\n❌ No cases found with 서초 in address fields")

        # Query 2: Search all cases (in case address is encrypted)
        print("\n" + "="*80)
        print("QUERY 2: Getting recent cases (in case addresses are encrypted)...")
        print("="*80)

        recent_cases = await conn.fetch("""
            SELECT
                id,
                address_road,
                address_dong,
                contract_type,
                created_at
            FROM v2_cases
            ORDER BY created_at DESC
            LIMIT 20
        """)

        print(f"\n✅ Recent {len(recent_cases)} cases:")
        print("-" * 80)

        for i, row in enumerate(recent_cases, 1):
            # Try to find 서초 in potentially encrypted address
            addr_preview = row['address_road'][:80] if row['address_road'] else 'N/A'
            has_seocho = '서초' in (row['address_road'] or '') or '서초' in (row['address_dong'] or '')
            marker = "⭐" if has_seocho else "  "

            print(f"{marker}[{i}] {row['id']}")
            print(f"     Addr: {addr_preview}")
            print(f"     Dong: {row['address_dong']}, Type: {row['contract_type']}")
            print(f"     Created: {row['created_at']}")

        # Query 3: Count total cases
        total = await conn.fetchval("SELECT COUNT(*) FROM v2_cases")
        print(f"\n📊 Total cases in database: {total}")

        # Query 4: Cases with artifacts
        with_artifacts = await conn.fetchval("""
            SELECT COUNT(DISTINCT case_id)
            FROM v2_artifacts
            WHERE artifact_type = 'registry_pdf'
        """)
        print(f"📊 Cases with registry PDFs: {with_artifacts}")

        await conn.close()
        print("\n✅ Database connection closed")

    except Exception as e:
        print(f"\n❌ Database error: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    print("🔍 Searching for 서초 cases in v2_cases table...")
    print("="*80)
    asyncio.run(find_seocho_cases())
