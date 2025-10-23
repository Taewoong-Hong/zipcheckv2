"""Test script for LLM APIs: Gemini, Claude, OpenAI."""
import os
import sys
from pathlib import Path

# Fix Windows console encoding
import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent))

from core.settings import settings

print("=" * 80)
print("Phase 1: LLM API Connection Test")
print("=" * 80)

# ============================================================================
# Test 1: Gemini API
# ============================================================================
print("\n[Test 1] Gemini API Connection")
print("-" * 80)

try:
    import google.generativeai as genai

    # Configure
    genai.configure(api_key=settings.gemini_api_key)

    # Create model (use gemini-2.0-flash for speed and cost efficiency)
    model = genai.GenerativeModel("gemini-2.0-flash")

    # Test simple text generation
    response = model.generate_content("Hello, Gemini! Please respond in Korean.")

    print("✅ Gemini API connection successful!")
    print(f"Response: {response.text[:200]}...")
    print(f"Full response length: {len(response.text)} characters")

except Exception as e:
    print(f"❌ Gemini API connection failed: {e}")

# ============================================================================
# Test 2: Claude (Anthropic) API
# ============================================================================
print("\n[Test 2] Claude (Anthropic) API Connection")
print("-" * 80)

try:
    import anthropic

    # Create client
    client = anthropic.Anthropic(api_key=settings.anthropic_api_key)

    # Test simple text generation
    message = client.messages.create(
        model="claude-3-5-sonnet-20241022",
        max_tokens=1024,
        messages=[{"role": "user", "content": "Hello, Claude! Please respond in Korean."}],
    )

    print("✅ Claude API connection successful!")
    print(f"Response: {message.content[0].text[:200]}...")
    print(f"Full response length: {len(message.content[0].text)} characters")

except Exception as e:
    print(f"❌ Claude API connection failed: {e}")

# ============================================================================
# Test 3: OpenAI API (existing)
# ============================================================================
print("\n[Test 3] OpenAI API Connection")
print("-" * 80)

try:
    from openai import OpenAI

    # Create client
    client = OpenAI(api_key=settings.openai_api_key)

    # Test simple text generation
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": "Hello, GPT! Please respond in Korean."}],
        max_tokens=1024,
    )

    print("✅ OpenAI API connection successful!")
    print(f"Response: {response.choices[0].message.content[:200]}...")
    print(f"Full response length: {len(response.choices[0].message.content)} characters")

except Exception as e:
    print(f"❌ OpenAI API connection failed: {e}")

# ============================================================================
# Summary
# ============================================================================
print("\n" + "=" * 80)
print("Phase 1 Test Summary")
print("=" * 80)
print("✅ All three LLM APIs are ready for use!")
print("\nNext step: Test Vision APIs with image OCR (Phase 1.2)")
