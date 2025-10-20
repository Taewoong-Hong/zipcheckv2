# OpenAI API 사용 가이드 - ZipCheck AI

**버전**: 2.0.0
**날짜**: 2025-10-20
**요금제**: Standard Tier

---

## 모델 전략

### 핵심 조합

1. **GPT-4o** (`gpt-4o`)
   - **용도**: Vision API + Structured Outputs
   - **사용 사례**: 스캔된 PDF → 구조화된 JSON 추출
   - **가격**: Input $0.0025/1K, Output $0.010/1K
   - **최대 토큰**: 128K context, 16K output

2. **GPT-4o-mini** (`gpt-4o-mini`)
   - **용도**: 빠른 분류/검증
   - **사용 사례**: 문서 타입 분류, 간단한 validation
   - **가격**: Input $0.00015/1K, Output $0.0006/1K
   - **최대 토큰**: 128K context, 16K output

3. **text-embedding-3-small** (1536D)
   - **용도**: RAG 임베딩
   - **사용 사례**: 계약서 텍스트 벡터화
   - **가격**: $0.00002/1K tokens
   - **차원**: 1536

4. **text-embedding-3-large** (3072D) - Optional
   - **용도**: 고정밀도 검색
   - **사용 사례**: 복잡한 법률 조항 검색
   - **가격**: $0.00013/1K tokens
   - **차원**: 3072

---

## 구현된 기능

### 1. GPT-4o Vision API (Structured Outputs)

**파일**: `core/vision.py`

**기능**:
- 스캔된 계약서 이미지 → 구조화된 JSON
- Pydantic 스키마 기반 Structured Outputs
- 다중 페이지 자동 병합

**사용 예시**:
```python
from core.vision import extract_contract_with_vision

# 단일 이미지 추출
result = extract_contract_with_vision("contract_page1.png")
print(result["property"]["address"])
print(result["terms"]["deposit"])

# 여러 페이지 병합
from core.vision import extract_contract_from_pdf_images
images = ["page1.png", "page2.png", "page3.png"]
merged_result = extract_contract_from_pdf_images(images, combine=True)
```

**스키마 구조**:
```python
class RealEstateContract(BaseModel):
    document_title: str
    parties: List[ContractParty]  # 임대인, 임차인, 중개인
    property: PropertyInfo  # 주소, 면적, 종류
    terms: ContractTerms  # 보증금, 월세, 계약기간
    special_provisions: List[SpecialProvisions]  # 특약사항
    contract_date: str | None
```

### 2. GPT-4o-mini 문서 분류

**파일**: `core/vision.py`

**기능**:
- 빠른 문서 타입 분류 (low detail)
- 비용 효율적 (<$0.001/문서)

**사용 예시**:
```python
from core.vision import classify_document_type

doc_type = classify_document_type("uploaded_doc.png")
if doc_type == "real_estate_contract":
    # GPT-4o로 전체 추출
    result = extract_contract_with_vision("uploaded_doc.png")
elif doc_type == "lease_contract":
    # 임대차 전용 처리
    pass
```

### 3. PDF → 이미지 변환

**파일**: `ingest/pdf_parse.py`

**기능**:
- PyMuPDF로 고품질 이미지 렌더링
- Vision API 최적화 (200 DPI)

**사용 예시**:
```python
from ingest.pdf_parse import pdf_to_images, parse_scanned_pdf_with_vision

# 1. PDF → 이미지 변환
images = pdf_to_images("contract.pdf", dpi=200)

# 2. 스캔 PDF 직접 처리 (내부적으로 변환)
result = parse_scanned_pdf_with_vision("scanned_contract.pdf")
```

### 4. 비용 모니터링

**파일**: `core/cost_monitor.py`

**기능**:
- 실시간 비용 추적
- 모델별 사용량 분석
- 임계값 경고 (일일/월간)

**사용 예시**:
```python
from core.cost_monitor import get_cost_monitor, track_llm_usage

# 사용량 기록
cost_info = track_llm_usage(
    model="gpt-4o",
    input_tokens=1000,
    output_tokens=500,
    operation="vision_ocr",
    user_id="user123"
)
print(f"비용: ${cost_info['cost']:.4f}")

# 리포트 생성
monitor = get_cost_monitor()
print(monitor.generate_report())
```

---

## API 엔드포인트 통합

### 기존 엔드포인트

#### POST `/ingest`
```python
# 1. PyMuPDF 우선 (빠름)
# 2. < 100자면 unstructured 폴백
# 3. 여전히 빈약하면 422 에러
```

#### POST `/analyze`
```python
# 단일 모델 분석 (GPT-4o-mini)
# RAG 검색 → LLM 분석 → sources 배열 반환
```

### 새 엔드포인트 (추가 예정)

#### POST `/ingest-vision` (제안)
```python
{
  "file": "scanned_contract.pdf",
  "contract_id": "C-2024-001",
  "user_id": "uuid",
  "use_vision": true  # GPT-4o Vision 강제 사용
}

# Response:
{
  "ok": true,
  "contract_id": "C-2024-001",
  "extracted_data": {
    "property": {...},
    "parties": [...],
    "terms": {...}
  },
  "vision_used": true,
  "cost": 0.0125  # USD
}
```

#### POST `/classify` (제안)
```python
{
  "file": "document.pdf"
}

# Response:
{
  "document_type": "real_estate_contract",
  "confidence": 0.95,
  "cost": 0.0003
}
```

---

## 비용 예상

### 시나리오 1: 일반 텍스트 PDF
- **파싱**: PyMuPDF (무료)
- **임베딩**: text-embedding-3-small
  - 평균 5페이지 = ~3000 토큰 → $0.00006
- **분석**: GPT-4o-mini
  - 입력 2000 + 출력 1000 → $0.0009
- **총 비용**: **~$0.001/건**

### 시나리오 2: 스캔 PDF (Vision API)
- **분류**: GPT-4o-mini (low detail)
  - 1 이미지 → $0.0003
- **추출**: GPT-4o (high detail)
  - 5 페이지 × (765 입력 + 500 출력) → $0.015
- **임베딩**: text-embedding-3-small
  - ~3000 토큰 → $0.00006
- **총 비용**: **~$0.015/건**

### 월간 예상 (1000건/월)
- 텍스트 PDF 80%: 800 × $0.001 = $0.80
- 스캔 PDF 20%: 200 × $0.015 = $3.00
- **총 비용**: **$3.80/월** (1000건 기준)

---

## 환경 설정

### `.env` 파일

```bash
# OpenAI API Key (Standard Tier)
OPENAI_API_KEY=sk-proj-your-actual-key-here

# Model Strategy
OPENAI_VISION_MODEL=gpt-4o
OPENAI_CLASSIFICATION_MODEL=gpt-4o-mini
OPENAI_ANALYSIS_MODEL=gpt-4o-mini

# Embedding Configuration
EMBED_MODEL=text-embedding-3-small
EMBED_DIMENSIONS=1536

# Vision API Configuration
VISION_MAX_TOKENS=4096
VISION_DETAIL=high  # high for OCR, low for cost savings
```

### LLM Factory 사용

```python
from core.llm_factory import create_llm

# Vision 작업용 (자동으로 GPT-4o 선택)
llm_vision = create_llm(model_type="vision")

# 분류 작업용 (자동으로 GPT-4o-mini 선택)
llm_classify = create_llm(model_type="classification")

# 분석 작업용 (기본값: GPT-4o-mini)
llm_analyze = create_llm(model_type="analysis")

# 수동 지정
llm_custom = create_llm(model_name="gpt-4o", temperature=0.0)
```

---

## 테스트 가이드

### 1. Vision API 테스트

```bash
cd services/ai

# Python 인터프리터 실행
python

>>> from ingest.pdf_parse import parse_scanned_pdf_with_vision
>>> result = parse_scanned_pdf_with_vision("sample_scanned.pdf")
>>> print(result["property"]["address"])
>>> print(result["terms"]["deposit"])
```

### 2. 비용 모니터링 테스트

```bash
python

>>> from core.cost_monitor import get_cost_monitor, track_llm_usage
>>>
>>> # 사용량 기록
>>> cost = track_llm_usage("gpt-4o", 1000, 500)
>>> print(f"Cost: ${cost['cost']:.4f}")
>>>
>>> # 리포트 생성
>>> monitor = get_cost_monitor()
>>> print(monitor.generate_report())
```

### 3. E2E 테스트 (API Key 필요)

```bash
# 1. .env 파일에 실제 API 키 설정
OPENAI_API_KEY=sk-proj-...

# 2. 서버 실행
uvicorn app:app --reload

# 3. 헬스체크
curl http://localhost:8000/healthz

# 4. 일반 PDF 업로드
curl -X POST http://localhost:8000/ingest \
  -F "file=@contract.pdf" \
  -F "contract_id=test-001" \
  -F "user_id=00000000-0000-0000-0000-000000000001"

# 5. 분석 요청
curl -X POST http://localhost:8000/analyze \
  -H "Content-Type: application/json" \
  -d '{"question": "계약서 상 보증금은 얼마인가요?", "mode": "single"}'
```

---

## 다음 단계

### P2.5: Vision API 통합 완료
- [ ] `/ingest-vision` 엔드포인트 추가
- [ ] `/classify` 엔드포인트 추가
- [ ] 비용 모니터링 대시보드 API
- [ ] 자동 텍스트 vs Vision 라우팅

### P3: Dual LLM + Consensus
- [ ] GPT-4o + Claude 듀얼 분석
- [ ] 저지(Judge) 모드 구현
- [ ] 장시간 작업 큐 (Celery)
- [ ] Langfuse 로깅 통합

---

## 참고 링크

- [OpenAI API Pricing](https://openai.com/pricing)
- [GPT-4o Vision Guide](https://platform.openai.com/docs/guides/vision)
- [Structured Outputs](https://platform.openai.com/docs/guides/structured-outputs)
- [Standard Tier Limits](https://platform.openai.com/docs/guides/rate-limits)

---

**주의사항**:
1. ✅ 실제 API 키로 교체 필수 (`.env` 파일 Line 8)
2. ✅ Vision API는 Standard Tier에서 사용 가능
3. ✅ 비용 모니터링으로 예산 초과 방지
4. ✅ 스캔 PDF는 Vision API, 일반 PDF는 PyMuPDF 자동 라우팅
5. ✅ Structured Outputs로 일관된 데이터 보장
