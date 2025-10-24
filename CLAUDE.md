# 🧩 **집체크 (ZipCheck) LLM 리팩토링 PRD v2 + 구현 구조**

> **📚 문서 구조**: 프로젝트 전체 가이드는 이 파일에, 세부 기술 문서는 [docs/](docs/README.md) 폴더에 정리되어 있습니다.

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

## 📝 작업 현황 (2025-10-20)

### ✅ 완료된 작업
1. **UI/UX 개선**
   - 채팅 인터페이스 크기 조정 (메인 페이지, 메시지, 사이드바)
   - 모바일/태블릿 반응형 디자인 구현
   - 태블릿 환경 사이드바 토글 버튼 추가 (cursor-e-resize 적용)
   - 데스크톱 채팅 입력창 디자인 개선
   - 메인 채팅창 클립 버튼 제거
   - 모바일에서 딥서치 아이콘 숨김 (md:hidden)
   - 채팅 메시지 프로필/텍스트 크기 최적화

2. **GitHub 저장소 설정**
   - 새 저장소 생성: https://github.com/Taewoong-Hong/zipcheckv2.git
   - 보안 파일 .gitignore 처리 (node_modules, .next, .env 등)
   - API 키 제거 및 플레이스홀더로 교체 (보안 이슈 해결)
   - 초기 커밋 및 main 브랜치 force push 완료

### 🔧 향후 작업 (TODO)
1. **기능 구현**
   - 채팅 중 홈 버튼 클릭 시 채팅창 초기화 기능 수정
   - 파일 업로드 기능 활성화
   - 딥서치 기능 구현
   - 사용자 프로필 기능 구현
   - 검색 모달 기능 확장

2. **백엔드 연동**
   - Google Cloud Run 재배포 (API 키 업데이트 필요)
   - 환경 변수 재설정
   - API 엔드포인트 연결 검증
   - CORS 설정 확인

3. **품질 개선**
   - 테스트 코드 작성
   - 성능 최적화 (번들 사이즈 최소화)
   - 접근성 개선 (WCAG 준수)
   - 에러 핸들링 강화

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

## 🛡️ Cloudflare Turnstile 봇 방지 시스템 (2025-01-24)

### ✅ 구현 완료

Cloudflare Turnstile을 통한 봇 차단 시스템 구현. 회원가입, 무료 분석 요청, 비회원 문의 등 Abuse 가능성이 있는 모든 엔드포인트에 적용.

### 🔧 환경변수 설정

#### 프론트엔드 (Vercel)
```bash
NEXT_PUBLIC_TURNSTILE_SITE_KEY=YOUR_SITE_KEY_HERE  # Cloudflare Dashboard에서 발급
TURNSTILE_SECRET_KEY=0x4AAAAAAB0i7GZiRbNMj2tuUHgMjicQYLA  # 서버 사이드 검증용
```

#### 백엔드 (Google Cloud Run - Secret Manager)
```bash
TURNSTILE_SECRET_KEY=0x4AAAAAAB0i7GZiRbNMj2tuUHgMjicQYLA
```

### 📦 구현 파일

1. **백엔드 검증 유틸**
   - `services/ai/core/security/turnstile.py`: Cloudflare API 검증 로직
   - 비동기/동기 버전 모두 지원

2. **프론트엔드 위젯**
   - `apps/web/components/auth/TurnstileWidget.tsx`: React 컴포넌트
   - `apps/web/app/layout.tsx`: Turnstile 스크립트 로드

### 🔐 보안 정책

- **비밀키 관리**: `TURNSTILE_SECRET_KEY`는 절대 프론트엔드에 노출 금지
- **토큰 검증**: 모든 폼 제출 시 백엔드에서 토큰 검증 필수
- **실패 처리**: 검증 실패 시 사용자 친화적 메시지 표시
- **재사용 방지**: Turnstile 자동 토큰 만료/재사용 체크

### 📝 사용 예시

#### 프론트엔드 (회원가입 페이지)
```typescript
import TurnstileWidget from '@/components/auth/TurnstileWidget';

const [turnstileToken, setTurnstileToken] = useState('');

<TurnstileWidget
  onSuccess={(token) => setTurnstileToken(token)}
  onError={() => setTurnstileToken('')}
  theme="light"
  size="normal"
/>

// 폼 제출 시 토큰 포함
const formData = new FormData();
formData.append('cf_turnstile_token', turnstileToken);
```

#### 백엔드 (FastAPI 엔드포인트)
```python
from fastapi import Form, HTTPException, Request
from core.security.turnstile import verify_turnstile

@app.post("/auth/signup")
async def signup(
    request: Request,
    email: str = Form(...),
    password: str = Form(...),
    cf_turnstile_token: str = Form(...)
):
    # Turnstile 검증
    remote_ip = request.client.host if request.client else None
    is_valid = await verify_turnstile(cf_turnstile_token, remote_ip=remote_ip)

    if not is_valid:
        raise HTTPException(400, "Bot verification failed")

    # 가입 로직 수행
    return {"ok": True}
```

### 🚨 운영 체크리스트
- [x] 비밀키 서버 전용 환경변수 설정
- [x] 실패 시 사용자 친화 메시지 표시
- [x] 토큰 재사용/만료 체크 (Turnstile 자동 처리)
- [ ] 레이트 리밋 (IP/세션) 추가 구현
- [ ] 검증 실패율/IP 분포 모니터링
- [ ] E2E 테스트: 위젯→토큰→검증→가입 흐름

---

## 🔐 Google OAuth 설정 가이드 (2025-01-23)

### ✅ 완료된 작업
1. **Google Cloud Console 설정**
   - Client ID: `901515411397-soknq5qg2l3ga3ggc3gcrp70rmt2iovt.apps.googleusercontent.com`
   - OAuth 2.0 클라이언트 생성 완료

2. **코드 구현**
   - `core/google_oauth.py`: Google OAuth 2.0 클라이언트
   - `core/supabase_client.py`: Supabase Auth/Storage 클라이언트
   - `routes/auth.py`: FastAPI OAuth 라우터 (`/auth/google/login`, `/auth/google/callback`)
   - `lib/supabase.ts`: Next.js Supabase 클라이언트
   - `app/auth/callback/page.tsx`: OAuth 콜백 페이지
   - `components/auth/LoginModal.tsx`: Google 로그인 버튼 통합

### 🔧 필요한 추가 설정

#### 1️⃣ Google Cloud Console 설정
**승인된 JavaScript 원본** (OAuth 2.0 Client 설정):
```
http://localhost:3000
https://zipcheck.kr
```

**승인된 리디렉션 URI**:
```
http://localhost:3000/auth/callback
https://zipcheck.kr/auth/callback
https://gsiismzchtgdklvdvggu.supabase.co/auth/v1/callback
```

> ⚠️ Supabase 콜백 URI가 가장 중요합니다! 여기서 실제 토큰 교환이 이루어집니다.

#### 2️⃣ Supabase Dashboard 설정
1. **Authentication → Providers → Google** 이동
2. **Enable Google Provider** 활성화
3. 다음 정보 입력:
   - **Client ID**: `901515411397-soknq5qg2l3ga3ggc3gcrp70rmt2iovt.apps.googleusercontent.com`
   - **Client Secret**: (Google Cloud Console에서 복사)
4. **Authorized Redirect URLs** 확인:
   - `https://gsiismzchtgdklvdvggu.supabase.co/auth/v1/callback`

#### 3️⃣ Client Secret 발급
1. Google Cloud Console → APIs & Services → Credentials
2. OAuth 2.0 Client IDs → 생성한 클라이언트 선택
3. **Client Secret** 복사
4. 다음 파일에 추가:
   - `services/ai/.env` → `GOOGLE_CLIENT_SECRET=YOUR_SECRET_HERE`

### 📝 로그인 플로우

#### Supabase 기반 플로우 (권장)
```
1. 사용자가 "구글로 계속하기" 버튼 클릭
   ↓
2. supabase.auth.signInWithOAuth({ provider: 'google' })
   ↓
3. Google 로그인 페이지로 리디렉션
   ↓
4. 사용자 로그인 후 Supabase 콜백으로 리디렉션
   (https://gsiismzchtgdklvdvggu.supabase.co/auth/v1/callback?code=...)
   ↓
5. Supabase가 토큰 교환 후 /auth/callback으로 리디렉션
   ↓
6. /auth/callback 페이지에서 세션 확인
   ↓
7. 홈 페이지로 리디렉션
```

### 🧪 테스트 방법
1. **로컬 개발 서버 시작**:
   ```bash
   cd apps/web
   npm run dev
   ```

2. **로그인 테스트**:
   - http://localhost:3000 접속
   - 로그인 모달 열기
   - "구글로 계속하기" 클릭
   - Google 계정으로 로그인
   - `/auth/callback`으로 리디렉션 확인
   - 홈 페이지로 자동 이동 확인

3. **세션 확인**:
   ```typescript
   import { supabase } from '@/lib/supabase';

   const { data: { session } } = await supabase.auth.getSession();
   console.log('User:', session?.user.email);
   ```

### 🚨 주의사항
- **Client Secret은 절대 프론트엔드에 노출하지 마세요**
- `.env.local` 파일은 `.gitignore`에 추가되어야 합니다
- 프로덕션 배포 시 환경변수를 별도로 설정하세요
- Supabase RLS (Row Level Security) 정책 설정 필수

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

## 📱 모바일 앱 기술 스택 (React Native)

### 핵심 프레임워크
- **앱 프레임워크**: React Native + Expo + TypeScript
- **상태관리**: Zustand or Redux Toolkit (웹과 공유 가능)
- **네비게이션**: @react-navigation/native

### 기능별 라이브러리
- **파일 업로드**:
  - `expo-document-picker` (PDF/문서)
  - `expo-image-picker` (이미지)
  - → Cloud Run API로 업로드

- **PDF 뷰어**:
  - `react-native-pdf` (URL/바이너리 표시)

- **푸시 알림**:
  - `expo-notifications`
  - 서버에서 FCM/APNs 연동

### 백엔드 통합
- **Auth/DB/Storage**:
  - Supabase (Auth + Storage)
  - `react-native-url-polyfill` 추가 (필수)

- **에러/로그**:
  - Sentry
  - `react-native-device-info`

- **AI 호출**:
  - 백엔드(Cloud Run) REST API → OpenAI/Claude/Gemini 프록시
  - 직접 LLM API 호출 없음 (보안)

### 아키텍처
```
React Native App (TypeScript)
    ↓
Supabase Auth + Storage
    ↓
Cloud Run (FastAPI) ← AI Gateway
    ↓
OpenAI / Claude / Gemini
```

---

이 내용은 기존 PRD.md의 AI 리팩토링 및 구조 정의를 포함하며, 실제 코드 베이스 구성의 표준 가이드로 사용 가능합니다
## 🔐 고객 데이터 암호화 시스템 (2025-01-24)

### ✅ 구현 완료

AES-256-GCM 알고리즘을 사용한 고객 데이터 암호화/복호화 시스템 구현. 개인정보 보호법 및 GDPR 준수.

### 🔧 환경변수 설정

#### 프론트엔드 & 백엔드 공통
```bash
# 데이터 암호화 키 (고객 데이터 보호)
# ⚠️ 프로덕션에서는 32자 이상의 강력한 랜덤 키 사용 필수!
# 키 생성 예시: openssl rand -base64 32
ENCRYPTION_KEY=zipcheck_v2_encryption_key_change_this_in_production_12345
```

### 📦 구현 파일

#### 프론트엔드 (Next.js)
1. **암호화 유틸리티**
   - `apps/web/lib/encryption.ts`: AES-256-GCM 암호화/복호화 로직
   - 객체 필드 암호화/복호화 헬퍼 함수
   - 마스킹 함수 (이메일, 이름, 전화번호)

#### 백엔드 (FastAPI)
1. **암호화 유틸리티**
   - `services/ai/core/encryption.py`: AES-256-GCM 암호화/복호화 로직
   - PBKDF2 키 파생 함수 (SHA-256, 100,000 iterations)
   - 싱글톤 패턴으로 성능 최적화

2. **관리자 API**
   - `apps/web/app/api/admin/stats/route.ts`: 통계 데이터 API
   - `apps/web/app/api/admin/data/route.ts`: 문서 데이터 API (암호화/복호화 포함)
   - `apps/web/app/api/admin/users/route.ts`: 회원 데이터 API

### 🔐 암호화 대상 데이터

#### 필수 암호화 필드
- **v2_profiles**: `name` (이름)
- **v2_documents**: `property_address` (부동산 주소), `owner_info` (소유자 정보)
- **v2_contracts**: `addr` (주소)
- **이메일**: auth.users에서 관리 (Supabase 자체 암호화)

#### 선택적 마스킹 (로그/디버깅용)
- 이메일: `user@example.com` → `us***@example.com`
- 이름: `홍길동` → `홍*동`
- 전화번호: `010-1234-5678` → `010-****-5678`

### 📝 사용 예시

#### 프론트엔드 (TypeScript)
```typescript
import { encrypt, decrypt, encryptFields, decryptFields } from '@/lib/encryption';

// 단일 필드 암호화
const encrypted = encrypt('홍길동');

// 단일 필드 복호화
const decrypted = decrypt(encrypted);

// 객체 필드 암호화
const user = { name: '홍길동', email: 'user@example.com', age: 30 };
const encryptedUser = encryptFields(user, ['name']); // name만 암호화

// 객체 필드 복호화
const decryptedUser = decryptFields(encryptedUser, ['name']);
```

#### 백엔드 (Python)
```python
from core.encryption import encrypt, decrypt, encrypt_fields, decrypt_fields

# 단일 필드 암호화
encrypted = encrypt('홍길동')

# 단일 필드 복호화
decrypted = decrypt(encrypted)

# 딕셔너리 필드 암호화
user = {'name': '홍길동', 'email': 'user@example.com', 'age': 30}
encrypted_user = encrypt_fields(user, ['name'])  # name만 암호화

# 딕셔너리 필드 복호화
decrypted_user = decrypt_fields(encrypted_user, ['name'])

# 리스트 필드 복호화
users = [{'name': 'encrypted1'}, {'name': 'encrypted2'}]
decrypted_users = decrypt_list_fields(users, ['name'])
```

### 🔒 보안 정책

#### 키 관리
- **환경변수 보호**: `ENCRYPTION_KEY`는 절대 코드에 하드코딩 금지
- **키 교체**: 정기적인 키 교체 (6개월마다 권장)
- **키 백업**: 안전한 시크릿 관리 시스템(GCP Secret Manager, AWS Secrets Manager) 사용

#### 암호화 정책
- **알고리즘**: AES-256-GCM (Authenticated Encryption)
- **키 파생**: PBKDF2-HMAC-SHA256 (100,000 iterations)
- **Nonce/IV**: 매번 랜덤 생성 (재사용 방지)
- **인증 태그**: GCM 모드로 데이터 무결성 보장

#### 데이터 처리
- **저장**: 암호화된 데이터만 데이터베이스에 저장
- **전송**: HTTPS로만 전송 (TLS 1.3 권장)
- **로깅**: 복호화된 데이터는 로그에 절대 기록 금지
- **백업**: 암호화 키는 별도 안전한 장소에 백업

### 🚨 운영 체크리스트
- [x] 암호화 라이브러리 설치 (cryptography==42.0.0)
- [x] 환경변수 설정 (ENCRYPTION_KEY)
- [x] 암호화 유틸리티 구현 (프론트엔드/백엔드)
- [x] API 엔드포인트에 암호화/복호화 로직 통합
- [x] 관리자 페이지 실제 데이터 연동
- [ ] 프로덕션 키 생성 및 Secret Manager 등록
- [ ] 기존 데이터 마이그레이션 (평문 → 암호문)
- [ ] 암호화 성능 테스트 및 최적화
- [ ] 로그 점검 (민감 데이터 노출 여부)
- [ ] 키 교체 프로세스 문서화

---

