"""Test script for Vision OCR: Gemini + Claude parallel processing."""
import os
import sys
from pathlib import Path
import time

# Fix Windows console encoding
import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent))

from core.gemini_vision import extract_text_from_pdf_with_gemini
from core.claude_vision import extract_text_from_pdf_with_claude
from core.consensus import validate_consensus
from core.pdf_quality import assess_pdf_quality, extract_text_from_pdf_direct

print("=" * 80)
print("Phase 1.4: Vision OCR Test")
print("=" * 80)

# Test PDF file path
test_pdf = "test_documents/sample_doc.pdf"

if not os.path.exists(test_pdf):
    print(f"❌ Test PDF not found: {test_pdf}")
    print("Please place a test PDF in test_documents/sample_doc.pdf")
    sys.exit(1)

# ============================================================================
# Step 1: PDF Quality Assessment
# ============================================================================
print("\n[Step 1] PDF Quality Assessment")
print("-" * 80)

quality_result = assess_pdf_quality(test_pdf)
print(f"PDF Quality: {quality_result}")
print(f"  - Has text layer: {quality_result.has_text_layer}")
print(f"  - Quality score: {quality_result.quality_score:.2f}")
print(f"  - Recommended method: {quality_result.method}")
print(f"  - Page count: {quality_result.page_count}")
print(f"  - Text length: {quality_result.text_length} chars")
print(f"  - Korean text: {quality_result.has_korean}")

# ============================================================================
# Step 2: Direct Text Extraction (if quality is good)
# ============================================================================
if quality_result.method == "direct":
    print("\n[Step 2] Direct Text Extraction (High Quality PDF)")
    print("-" * 80)

    start_time = time.time()
    direct_text = extract_text_from_pdf_direct(test_pdf)
    elapsed = time.time() - start_time

    print(f"✅ Direct extraction completed in {elapsed:.2f}s")
    print(f"Extracted {len(direct_text)} characters")
    print(f"\nFirst 500 characters:\n{direct_text[:500]}...")

    # Extract address
    print("\n[Address Detection]")
    if "경기도" in direct_text or "서울" in direct_text:
        # Simple address extraction
        lines = direct_text.split('\n')
        for line in lines:
            if "경기도" in line or "서울" in line:
                print(f"  Found address: {line.strip()}")
                break

else:
    # ============================================================================
    # Step 3: Gemini Vision OCR
    # ============================================================================
    print("\n[Step 3] Gemini Vision OCR (Low Quality PDF - needs OCR)")
    print("-" * 80)

    start_time = time.time()
    try:
        gemini_text = extract_text_from_pdf_with_gemini(test_pdf, dpi=200)
        gemini_elapsed = time.time() - start_time

        print(f"✅ Gemini OCR completed in {gemini_elapsed:.2f}s")
        print(f"Extracted {len(gemini_text)} characters")
        print(f"\nFirst 500 characters:\n{gemini_text[:500]}...")
    except Exception as e:
        print(f"❌ Gemini OCR failed: {e}")
        gemini_text = None
        gemini_elapsed = 0

    # ============================================================================
    # Step 4: Claude Vision OCR
    # ============================================================================
    print("\n[Step 4] Claude Vision OCR")
    print("-" * 80)

    start_time = time.time()
    try:
        claude_text = extract_text_from_pdf_with_claude(test_pdf, dpi=200)
        claude_elapsed = time.time() - start_time

        print(f"✅ Claude OCR completed in {claude_elapsed:.2f}s")
        print(f"Extracted {len(claude_text)} characters")
        print(f"\nFirst 500 characters:\n{claude_text[:500]}...")
    except Exception as e:
        print(f"❌ Claude OCR failed: {e}")
        claude_text = None
        claude_elapsed = 0

    # ============================================================================
    # Step 5: Consensus Validation
    # ============================================================================
    if gemini_text and claude_text:
        print("\n[Step 5] Consensus Validation")
        print("-" * 80)

        consensus = validate_consensus(gemini_text, claude_text)

        print(f"Similarity score: {consensus.similarity_score:.2%}")
        print(f"Confidence level: {consensus.confidence}")
        print(f"Needs manual review: {consensus.needs_review}")
        print(f"Selected text length: {len(consensus.agreed_text)} characters")

        if consensus.needs_review:
            print("\n⚠️  Low similarity detected - manual review recommended")
            print(f"Gemini length: {len(gemini_text)} chars")
            print(f"Claude length: {len(claude_text)} chars")

        # Extract address from consensus text
        print("\n[Address Detection]")
        if "경기도" in consensus.agreed_text or "서울" in consensus.agreed_text:
            lines = consensus.agreed_text.split('\n')
            for line in lines:
                if "경기도" in line or "서울" in line:
                    print(f"  Found address: {line.strip()}")
                    break

# ============================================================================
# Summary
# ============================================================================
print("\n" + "=" * 80)
print("Phase 1.4 Test Summary")
print("=" * 80)
print("✅ Vision OCR test completed!")
print("\nNext step: Phase 2 - Public Data API Integration")
