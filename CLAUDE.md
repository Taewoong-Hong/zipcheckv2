# 🧩 **집체크 (ZipCheck) LLM 리팩토링 PRD v2 + 구현 구조**

## 🎨 브랜드 컬러
- **Primary Colors**:
  - Red/Pink 계열의 그라데이션 (메인 로고 컬러)
  - #D32F2F (진한 빨강)
  - #E91E63 (핑크)
  - #FF5252 (밝은 빨강)

---

## 🧱 권장 구조 (하이브리드)
```
zipcheck-v2/
├─ apps/web/                 # Next.js 15 (TS) - UI/결제/인증
├─ services/ai/              # ⬅ Python FastAPI - LLM/RAG/파싱
│  ├─ app.py
│  ├─ core/
│  │  ├─ chains.py
│  │  ├─ embeddings.py
│  │  ├─ retriever.py
│  │  └─ risk_rules.py
│  ├─ ingest/
│  │  ├─ pdf_parse.py
│  │  └─ upsert_vector.py
│  ├─ eval/                  # RAG 품질평가(ragas 등)
│  └─ requirements.txt
└─ db/                       # Supabase 스키마/RLS/sql
```

---

## 🐍 Python 패키지 (services/ai/requirements.txt)
```
fastapi[all]
uvicorn[standard]
langchain
langchain-community
langchain-openai
pydantic
python-dotenv
psycopg[binary]==3.1.19      # ⭐ psycopg3 사용 (psycopg2 대신)
SQLAlchemy
pgvector
sentence-transformers
unstructured[pdf]
pymupdf
tiktoken
tenacity
ragas
```

---

## ⚙️ 최소 실행 파이프라인

### 1️⃣ 임베딩 & 벡터DB (Postgres + pgvector)
```python
# services/ai/core/embeddings.py
from langchain_openai import OpenAIEmbeddings

def get_embedder():
    # 모델은 상황에 맞게 교체 가능 (OpenAI, nomic, bge 등)
    return OpenAIEmbeddings(model="text-embedding-3-large")
```

```python
# services/ai/core/retriever.py
from langchain_community.vectorstores.pgvector import PGVector
from sqlalchemy import create_engine
from .embeddings import get_embedder
import os

def get_pg_connection():
    url = os.environ["DATABASE_URL"]  # Supabase Postgres URL
    # ⭐ psycopg3를 위한 URL 스킴 변경
    if url.startswith("postgresql://"):
        url = url.replace("postgresql://", "postgresql+psycopg://", 1)
    return create_engine(
        url,
        pool_pre_ping=True,
        pool_size=5,
        max_overflow=5,
        connect_args={"prepare_threshold": 0}  # Supabase pooler 호환성
    )

def get_vectorstore():
    engine = get_pg_connection()
    collection = "v2_contract_docs"
    return PGVector(
        connection=engine,
        collection_name=collection,
        embedding_function=get_embedder(),
    )

def get_retriever(k: int = 6):
    vs = get_vectorstore()
    return vs.as_retriever(search_kwargs={"k": k})
```

---

### 2️⃣ 계약서 파싱 → 청크 → 업서트
```python
# services/ai/ingest/pdf_parse.py
from unstructured.partition.pdf import partition_pdf

def parse_pdf_to_text(path: str) -> str:
    elements = partition_pdf(filename=path, strategy="fast")
    return "\n".join([e.text for e in elements if hasattr(e, "text") and e.text])
```

```python
# services/ai/ingest/upsert_vector.py
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain.schema import Document
from ..core.retriever import get_vectorstore

def upsert_contract_text(doc_id: str, text: str, metadata: dict):
    splitter = RecursiveCharacterTextSplitter(chunk_size=1200, chunk_overlap=150)
    chunks = splitter.split_text(text)
    docs = [Document(page_content=c, metadata={**metadata, "doc_id": doc_id}) for c in chunks]
    vs = get_vectorstore()
    vs.add_documents(docs)
```

---

### 3️⃣ 체인(LCEL) + 근거 스니펫 인용
```python
# services/ai/core/chains.py
from langchain_core.prompts import ChatPromptTemplate
from langchain_openai import ChatOpenAI
from .retriever import get_retriever

def build_contract_analysis_chain():
    retriever = get_retriever(k=6)
    llm = ChatOpenAI(model="gpt-4o-mini", temperature=0.2)

    prompt = ChatPromptTemplate.from_template(
        """너는 부동산 계약 리스크 점검 보조원이다.
사용자 질문: {question}

다음은 검색된 근거 스니펫들이다:
{context}

요구사항:
- 계약 리스크를 조목조목 리스트로 정리
- 각 항목마다 '근거 스니펫 요약'과 '권장 조치' 포함
- 법률 단정 표현은 지양하고, 참고/검토/전문가 상담을 권장
"""
    )

    # LCEL 파이프라인
    def _retrieve(inputs):
        docs = retriever.get_relevant_documents(inputs["question"])
        ctx = "\n\n---\n\n".join([d.page_content[:800] for d in docs])
        return {"context": ctx, **inputs}

    chain = _retrieve | prompt | llm
    return chain
```

---

### 4️⃣ FastAPI 엔드포인트
```python
# services/ai/app.py
import os
from fastapi import FastAPI, UploadFile, Form
from pydantic import BaseModel
from ingest.pdf_parse import parse_pdf_to_text
from ingest.upsert_vector import upsert_contract_text
from core.chains import build_contract_analysis_chain

app = FastAPI(title="ZipCheck AI")

class AskBody(BaseModel):
    question: str

@app.post("/ingest")
async def ingest(file: UploadFile, contract_id: str = Form(...), addr: str = Form("")):
    # 1) 파일 저장
    path = f"/tmp/{contract_id}.pdf"
    with open(path, "wb") as f:
        f.write(await file.read())
    # 2) 파싱 -> 업서트
    text = parse_pdf_to_text(path)
    upsert_contract_text(contract_id, text, {"addr": addr})
    return {"ok": True, "contract_id": contract_id, "length": len(text)}

@app.post("/analyze")
async def analyze(body: AskBody):
    chain = build_contract_analysis_chain()
    resp = chain.invoke({"question": body.question})
    return {"answer": resp.content}
```

> Next.js에서 `/api/contract/analyze`는 위 FastAPI로 프록시 호출.
> 장시간 작업(대용량 PDF)은 큐(Celery/RQ)로 비동기 처리 후 웹훅/폴링.

---

## 🚀 Google Cloud Run 배포 (2025-01-20 완료)

### ✅ 완료된 작업
1. **GCP 프로젝트 설정**
   - 프로젝트 ID: `advance-vector-475706-a5`
   - 프로젝트 이름: `zipcheck123`
   - 리전: `asia-northeast3` (서울)

2. **API 활성화**
   - Cloud Run API
   - Cloud Build API
   - Secret Manager API

3. **Secret Manager 설정**
   - `openai-api-key`: OpenAI API 키 저장
   - `supabase-database-url`: Supabase Postgres 연결 URL 저장

4. **Service Account 생성**
   - 이름: `zipcheck-ai-sa`
   - 권한: Secret Manager 접근 권한 부여

5. **의존성 호환성 해결**
   - `psycopg2-binary` → `psycopg[binary]==3.1.19` 업그레이드
   - `core/database.py`에서 URL 스킴 변경 (`postgresql://` → `postgresql+psycopg://`)
   - Supabase pooler 호환성 설정 추가 (`prepare_threshold=0`)

6. **빌드 설정**
   - `.python-version` 파일 생성 (Python 3.11.9 지정)
   - `Procfile` 생성 (소스 기반 배포용)
   - `.gcloudignore` 업데이트

### 🔧 배포 명령어
```bash
cd C:\dev\zipcheckv2

gcloud run deploy zipcheck-ai \
  --source services/ai \
  --region asia-northeast3 \
  --allow-unauthenticated \
  --set-env-vars "APP_ENV=production,LOG_LEVEL=INFO" \
  --set-secrets "OPENAI_API_KEY=openai-api-key:latest,DATABASE_URL=supabase-database-url:latest"
```

### ⚠️ 배포 중 해결한 이슈
1. **Python 버전 문제**
   - 초기: Buildpack이 Python 3.13.9를 자동 선택
   - 해결: `.python-version` 파일로 Python 3.11.9 고정

2. **psycopg2 호환성 문제**
   - 초기: `psycopg2-binary==2.9.9`가 Python 3.13과 호환 안 됨
   - 해결: `psycopg[binary]==3.1.19`로 업그레이드 + URL 스킴 변경

3. **pymupdf 빌드 문제**
   - 문제: Python 3.13에서 소스 빌드 시도하여 10분+ 소요
   - 해결: Python 3.11로 고정하여 prebuilt wheel 사용

### 📁 생성된 파일
- `services/ai/.python-version`: Python 버전 고정
- `services/ai/Procfile`: Cloud Run 시작 명령어
- `services/ai/runtime.txt`: Python 버전 지정 (백업용)
- `services/ai/DEPLOY_SOURCE.md`: 소스 기반 배포 가이드

---

## 📋 향후 작업 (Next Steps)

### 1️⃣ Cloud Run 배포 완료 (진행 중)
- [ ] `.python-version` 파일로 Python 3.11.9 빌드 확인
- [ ] 배포 성공 및 서비스 URL 확인
- [ ] Health check 엔드포인트 테스트
- [ ] API 문서 (`/docs`) 확인

### 2️⃣ 배포 후 검증
- [ ] `/healthz` 엔드포인트 테스트
- [ ] `/analyze` API 호출 테스트
- [ ] OpenAI API 연동 확인
- [ ] Supabase 데이터베이스 연결 확인
- [ ] 로그 확인 (Cloud Logging)
- [ ] 성능 모니터링 설정

### 3️⃣ Next.js 프론트엔드 연동
- [ ] Next.js API Route에서 Cloud Run URL로 프록시 설정
- [ ] 환경변수에 Cloud Run URL 추가
- [ ] CORS 설정 확인
- [ ] 프론트엔드에서 API 호출 테스트

### 4️⃣ 추가 기능 구현
- [ ] PDF 업로드 및 파싱 테스트
- [ ] 벡터 임베딩 및 검색 테스트
- [ ] RAG 품질 평가 (ragas)
- [ ] 비용 모니터링 및 최적화
- [ ] Rate limiting 설정
- [ ] 에러 핸들링 강화

### 5️⃣ 프로덕션 준비
- [ ] CI/CD 파이프라인 구축
- [ ] 로그 집계 및 모니터링 (Sentry, Langfuse)
- [ ] 백업 및 재해 복구 계획
- [ ] 보안 검토 (Secret rotation, RLS 정책)
- [ ] 부하 테스트 및 성능 최적화
- [ ] 문서화 및 운영 가이드 작성

---

## 🧩 운영 체크리스트
- **RLS**: `v2_documents`, `v2_embeddings`에 사용자/테넌트 단위 정책 필수
- **출처 표기**: 응답에 선택된 문단의 `doc_id / page/offset`을 함께 반환
- **가드레일**: 위험 문장 차단("법률적 확정" 등), 비용 상한, 재시도/백오프(tenacity)
- **로그/평가**: Langfuse + ragas로 쿼리/정확도/라벨 관리
- **배포**: Cloud Run 소스 기반 배포 (Buildpacks)
- **모니터링**: Cloud Logging, Error Reporting, Cloud Monitoring 설정

---

## 💡 핵심 기술 스택
- **Backend**: Python 3.11 + FastAPI + LangChain
- **Database**: Supabase (Postgres + pgvector)
- **LLM**: OpenAI (gpt-4o-mini, text-embedding-3-small)
- **Deployment**: Google Cloud Run (서울 리전)
- **Secret Management**: Google Secret Manager
- **PDF Processing**: unstructured + pymupdf
- **Vector Store**: pgvector (Supabase)

---

이 내용은 기존 PRD.md의 AI 리팩토링 및 구조 정의를 포함하며, 실제 코드 베이스 구성의 표준 가이드로 사용 가능합니다.
