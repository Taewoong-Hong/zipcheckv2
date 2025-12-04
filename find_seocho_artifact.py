#!/usr/bin/env python3
"""
Find 서초힐스 case by searching PDF filenames in v2_artifacts table.

This script queries v2_artifacts + v2_cases for registry PDFs with 서초/힐스 in filename.
"""
import asyncio
import os
from pathlib import Path

# Add services/ai to Python path for imports
import sys
sys.stdout.reconfigure(encoding='utf-8')  # Fix cp949 encoding error on Windows
sys.path.insert(0, str(Path(__file__).parent / 'services' / 'ai'))

from dotenv import load_dotenv


async def find_seocho_artifacts():
    """Query v2_artifacts for 서초/힐스 PDF files."""
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
        conn = await asyncpg.connect(db_url, statement_cache_size=0)
        print("✅ Connected to database")

        # Query 1: Search for 서초/힐스 in PDF filenames
        print("\n" + "="*80)
        print("QUERY 1: Searching v2_artifacts for 서초/힐스 in PDF filenames...")
        print("="*80)

        rows = await conn.fetch("""
            SELECT
                a.id as artifact_id,
                a.case_id,
                a.file_name,
                a.file_path,
                a.file_size,
                a.created_at as artifact_created,
                c.address_road,
                c.address_lot,
                c.address_dong,
                c.contract_type,
                c.created_at as case_created
            FROM v2_artifacts a
            JOIN v2_cases c ON a.case_id = c.id
            WHERE
                a.artifact_type = 'registry_pdf'
                AND (
                    a.file_name ILIKE '%서초%'
                    OR a.file_name ILIKE '%힐스%'
                    OR a.file_path ILIKE '%서초%'
                    OR a.file_path ILIKE '%힐스%'
                )
            ORDER BY c.created_at DESC
            LIMIT 20
        """)

        if rows:
            print(f"\n✅ Found {len(rows)} artifact(s) with 서초/힐스 in filename:")
            print("-" * 80)

            for i, row in enumerate(rows, 1):
                print(f"\n[{i}] 🎯 MATCH FOUND")
                print(f"    Case ID:        {row['case_id']}")
                print(f"    Artifact ID:    {row['artifact_id']}")
                print(f"    File Name:      {row['file_name']}")
                print(f"    File Path:      {row['file_path']}")
                print(f"    File Size:      {row['file_size']} bytes")
                print(f"    Address (road): {row['address_road'][:100] if row['address_road'] else 'N/A'}")
                print(f"    Address (lot):  {row['address_lot'][:100] if row['address_lot'] else 'N/A'}")
                print(f"    Address (dong): {row['address_dong']}")
                print(f"    Contract Type:  {row['contract_type']}")
                print(f"    Case Created:   {row['case_created']}")
                print(f"    Artifact Created: {row['artifact_created']}")
        else:
            print("\n❌ No artifacts found with 서초/힐스 in filename")

        # Query 2: Search ALL registry PDFs (fallback - show all to identify manually)
        print("\n" + "="*80)
        print("QUERY 2: Listing ALL registry PDFs (for manual identification)...")
        print("="*80)

        all_pdfs = await conn.fetch("""
            SELECT
                a.id as artifact_id,
                a.case_id,
                a.file_name,
                a.file_path,
                c.address_road,
                c.contract_type,
                c.created_at as case_created
            FROM v2_artifacts a
            JOIN v2_cases c ON a.case_id = c.id
            WHERE a.artifact_type = 'registry_pdf'
            ORDER BY c.created_at DESC
            LIMIT 50
        """)

        print(f"\n✅ All registry PDFs ({len(all_pdfs)} total, showing first 50):")
        print("-" * 80)

        for i, row in enumerate(all_pdfs, 1):
            # Highlight if filename might contain relevant keywords
            file_lower = (row['file_name'] or '').lower()
            addr_lower = (row['address_road'] or '').lower()

            marker = ""
            if '서초' in file_lower or '힐스' in file_lower or '서초' in addr_lower or '힐스' in addr_lower:
                marker = "🎯 "
            elif any(keyword in file_lower for keyword in ['test', 'seocho', 'hills']):
                marker = "⚠️ "

            print(f"{marker}[{i}] {row['case_id']}")
            print(f"     File: {row['file_name']}")
            print(f"     Path: {row['file_path'][:80]}..." if row['file_path'] and len(row['file_path']) > 80 else f"     Path: {row['file_path']}")
            print(f"     Addr: {row['address_road'][:60]}..." if row['address_road'] and len(row['address_road']) > 60 else f"     Addr: {row['address_road']}")
            print(f"     Type: {row['contract_type']}, Created: {row['case_created']}")
            print()

        # Query 3: Database statistics
        total_artifacts = await conn.fetchval("SELECT COUNT(*) FROM v2_artifacts WHERE artifact_type = 'registry_pdf'")
        total_cases = await conn.fetchval("SELECT COUNT(*) FROM v2_cases")

        print(f"\n📊 Total registry PDFs in database: {total_artifacts}")
        print(f"📊 Total cases in database: {total_cases}")

        await conn.close()
        print("\n✅ Database connection closed")

    except Exception as e:
        print(f"\n❌ Database error: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    print("🔍 Searching for 서초힐스 case by PDF filename...")
    print("="*80)
    asyncio.run(find_seocho_artifacts())
