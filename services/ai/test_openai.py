"""OpenAI API 통합 테스트"""
import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent))

from core.settings import settings
from core.llm_factory import create_llm
from core.embeddings import get_embedder
from core.cost_monitor import get_cost_monitor, track_llm_usage


def test_api_key():
    """API 키 유효성 검증"""
    print("\n=== [1/5] API Key Validation ===")
    key = settings.openai_api_key
    if not key or key.startswith("sk-test"):
        print("[ERROR] Invalid API key")
        return False

    print(f"[OK] API Key: {key[:20]}...{key[-4:]}")
    print(f"[OK] Key Type: {'Service Account' if 'svcacct' in key else 'User'}")
    return True


def test_embedding():
    """Embedding API 테스트"""
    print("\n=== [2/5] Embedding API Test ===")
    try:
        embedder = get_embedder()
        print(f"[OK] Model: {settings.embed_model}")
        print(f"[OK] Dimensions: {settings.embed_dimensions}")

        # 테스트 텍스트
        test_text = "서울특별시 강남구 역삼동 123-45 소재 아파트"
        print(f"[INFO] Test text: {test_text}")

        # 임베딩 생성
        result = embedder.embed_query(test_text)

        print(f"[OK] Embedding dimensions: {len(result)}")
        print(f"[OK] First 5 values: {result[:5]}")

        # 비용 추적
        # text-embedding-3-small: ~10 tokens for Korean text
        estimated_tokens = len(test_text) // 2
        cost = track_llm_usage(
            model=settings.embed_model,
            input_tokens=estimated_tokens,
            output_tokens=0,
            operation="test_embedding"
        )
        print(f"[OK] Estimated cost: ${cost['cost']:.6f}")

        return True
    except Exception as e:
        print(f"[ERROR] Embedding failed: {e}")
        return False


def test_gpt4o_mini():
    """GPT-4o-mini 분석 테스트"""
    print("\n=== [3/5] GPT-4o-mini Analysis Test ===")
    try:
        llm = create_llm(model_type="analysis")
        print(f"[OK] Model: {settings.openai_analysis_model}")

        # 테스트 프롬프트
        from langchain_core.messages import SystemMessage, HumanMessage

        messages = [
            SystemMessage(content="너는 부동산 계약서 분석 전문가야."),
            HumanMessage(content="보증금 5000만원, 월세 50만원 계약의 총 비용을 1년 기준으로 계산해줘.")
        ]

        print("[INFO] Sending test prompt...")
        response = llm.invoke(messages)

        print(f"[OK] Response length: {len(response.content)} chars")
        print(f"[OK] Response preview:\n{response.content[:200]}...")

        # 토큰 사용량 (근사치)
        input_tokens = sum(len(m.content) for m in messages) // 2
        output_tokens = len(response.content) // 2

        cost = track_llm_usage(
            model=settings.openai_analysis_model,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            operation="test_analysis"
        )
        print(f"[OK] Estimated cost: ${cost['cost']:.6f}")

        return True
    except Exception as e:
        print(f"[ERROR] GPT-4o-mini failed: {e}")
        import traceback
        traceback.print_exc()
        return False


def test_gpt4o_classification():
    """GPT-4o-mini 분류 테스트"""
    print("\n=== [4/5] GPT-4o-mini Classification Test ===")
    try:
        llm = create_llm(model_type="classification", temperature=0.0)
        print(f"[OK] Model: {settings.openai_classification_model}")

        # 테스트 프롬프트
        test_text = """
부동산 매매계약서

물건의 표시
소재지: 서울특별시 강남구 역삼동 123-45
종류: 아파트
면적: 85.5㎡

계약내용
매매대금: 10억원
계약금: 1억원 (계약시)
중도금: 4억원 (2024-06-01)
잔금: 5억원 (2024-12-01)
"""

        from langchain_core.messages import SystemMessage, HumanMessage

        messages = [
            SystemMessage(content="문서 타입을 분류하세요. 응답은 'real_estate_contract', 'lease_contract', 'unknown' 중 하나만 반환하세요."),
            HumanMessage(content=test_text)
        ]

        print("[INFO] Classifying document type...")
        response = llm.invoke(messages)

        doc_type = response.content.strip().lower()
        print(f"[OK] Classification: {doc_type}")

        # 토큰 사용량 추적
        input_tokens = (len(test_text) + 50) // 2
        output_tokens = len(response.content) // 2

        cost = track_llm_usage(
            model=settings.openai_classification_model,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            operation="test_classification"
        )
        print(f"[OK] Estimated cost: ${cost['cost']:.6f}")

        return True
    except Exception as e:
        print(f"[ERROR] Classification failed: {e}")
        return False


def test_cost_monitoring():
    """비용 모니터링 시스템 테스트"""
    print("\n=== [5/5] Cost Monitoring Test ===")
    try:
        monitor = get_cost_monitor()

        # 일일 통계
        daily = monitor.get_daily_stats()
        print(f"[OK] Today's usage:")
        print(f"    - Input tokens: {daily['input_tokens']:,}")
        print(f"    - Output tokens: {daily['output_tokens']:,}")
        print(f"    - Total cost: ${daily['cost']:.6f}")

        # 모델별 분석
        breakdown = monitor.get_model_breakdown(period_days=1)
        print(f"[OK] Model breakdown:")
        for model, stats in breakdown.items():
            print(f"    - {model}: ${stats['cost']:.6f} ({stats['count']} calls)")

        return True
    except Exception as e:
        print(f"[ERROR] Cost monitoring failed: {e}")
        return False


def generate_report():
    """최종 리포트 생성"""
    print("\n" + "="*50)
    print("OPENAI API TEST REPORT")
    print("="*50)

    monitor = get_cost_monitor()
    print(monitor.generate_report())


def main():
    """메인 테스트 실행"""
    print("="*50)
    print("OpenAI API Integration Test")
    print("="*50)

    results = {
        "API Key Validation": test_api_key(),
        "Embedding API": test_embedding(),
        "GPT-4o-mini Analysis": test_gpt4o_mini(),
        "GPT-4o-mini Classification": test_gpt4o_classification(),
        "Cost Monitoring": test_cost_monitoring(),
    }

    # 결과 요약
    print("\n" + "="*50)
    print("TEST RESULTS SUMMARY")
    print("="*50)

    for test_name, passed in results.items():
        status = "[PASS]" if passed else "[FAIL]"
        print(f"{status} {test_name}")

    # 리포트 생성
    if all(results.values()):
        generate_report()
        print("\n[SUCCESS] All tests passed!")
        return 0
    else:
        print("\n[WARNING] Some tests failed. Check errors above.")
        return 1


if __name__ == "__main__":
    sys.exit(main())
