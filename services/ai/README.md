# ZipCheck AI Service

부동산 계약서 리스크 분석 AI 서비스 백엔드

## 🚀 빠른 시작

### 1. 환경 설정

```bash
# Python 가상환경 생성 (Python 3.11+ 권장)
python -m venv venv

# 가상환경 활성화
# Windows
venv\Scripts\activate
# Linux/Mac
source venv/bin/activate

# 의존성 설치
pip install -r requirements.txt
```

### 2. 환경 변수 설정

```bash
# .env.example을 복사하여 .env 생성
cp .env.example .env

# .env 파일을 편집하여 필수 값 입력
# - DATABASE_URL
# - OPENAI_API_KEY
# - ANTHROPIC_API_KEY
```

### 3. 서버 실행

```bash
# 개발 모드 (자동 재시작)
uvicorn app:app --reload --port 8000

# 또는
python app.py
```

서버가 시작되면 다음 URL에서 확인:
- API: http://localhost:8000
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

### 4. 헬스체크

```bash
curl http://localhost:8000/healthz
```

응답:
```json
{
  "ok": true,
  "version": "2.0.0",
  "environment": "development"
}
```

## 📁 프로젝트 구조

```
services/ai/
├─ app.py                    # FastAPI 애플리케이션 엔트리포인트
├─ core/                     # 핵심 모듈
│  ├─ settings.py           # 환경 변수 및 설정
│  ├─ llm_factory.py        # LLM 인스턴스 생성
│  ├─ embeddings.py         # 임베딩 설정
│  ├─ retriever.py          # 벡터 검색
│  ├─ chains.py             # LangChain LCEL 체인
│  └─ dual_provider.py      # 듀얼 프로바이더 폴백
├─ ingest/                   # PDF 처리 및 인덱싱
│  ├─ pdf_parse.py          # PDF 파싱
│  └─ upsert_vector.py      # 벡터 DB 업서트
├─ api/                      # API 스펙
│  └─ openapi.yaml          # OpenAPI 3.1 스펙
├─ requirements.txt          # Python 의존성
├─ Dockerfile               # 컨테이너 이미지
├─ .env.example             # 환경 변수 템플릿
└─ README.md                # 이 파일
```

## 🔑 주요 엔드포인트

### POST /ingest
계약서 PDF 업로드 및 벡터 DB 저장

```bash
curl -X POST http://localhost:8000/ingest \
  -F "file=@contract.pdf" \
  -F "contract_id=contract_001" \
  -F "addr=서울시 강남구 테헤란로 123"
```

### POST /analyze
계약서 분석 요청

```bash
curl -X POST http://localhost:8000/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "question": "계약금 관련 리스크를 분석해주세요",
    "mode": "single",
    "provider": "openai"
  }'
```

## 🐳 Docker 실행

### 이미지 빌드
```bash
docker build -t zipcheck-ai:latest .
```

### 컨테이너 실행
```bash
docker run -p 8000:8000 \
  --env-file .env \
  zipcheck-ai:latest
```

## 🧪 테스트

### 필수 환경 변수 검증
```bash
# 서버 시작 시 필수 키 누락되면 실패
# DATABASE_URL, OPENAI_API_KEY, ANTHROPIC_API_KEY 필수
```

### OpenAPI 스펙 검증 (schemathesis)
```bash
pip install schemathesis
schemathesis run api/openapi.yaml --base-url http://localhost:8000
```

## 📊 로그 및 모니터링

### 로그 레벨 설정
`.env` 파일에서 `LOG_LEVEL` 설정:
- DEBUG: 상세 디버깅 정보
- INFO: 일반 정보 (기본값)
- WARNING: 경고 메시지
- ERROR: 에러만 출력

### Sentry 연동
`.env`에 `SENTRY_DSN` 설정 시 자동으로 에러 트래킹 활성화

### Langfuse 연동
LLM 호출 추적을 위해 다음 환경 변수 설정:
- LANGFUSE_PUBLIC_KEY
- LANGFUSE_SECRET_KEY
- LANGFUSE_HOST

## 🔒 보안 고려사항

1. **환경 변수 보호**: `.env` 파일은 절대 커밋하지 않음
2. **CORS 설정**: `AI_ALLOWED_ORIGINS`로 허용된 출처만 접근
3. **파일 크기 제한**: PDF 최대 50MB
4. **파일 타입 검증**: PDF만 허용
5. **RLS (Row Level Security)**: Supabase에서 사용자별 데이터 격리

## 📦 의존성 관리

### 주요 패키지
- **FastAPI**: 웹 프레임워크
- **LangChain**: RAG 파이프라인
- **OpenAI/Anthropic**: LLM 제공자
- **pgvector**: 벡터 검색
- **unstructured**: PDF 파싱

### 버전 업데이트
```bash
# 의존성 업데이트
pip install --upgrade -r requirements.txt

# requirements.txt 갱신
pip freeze > requirements.txt
```

## 🐛 트러블슈팅

### 서버 시작 실패
- `.env` 파일의 필수 환경 변수 확인
- DATABASE_URL이 올바른 PostgreSQL 연결 문자열인지 확인
- API 키가 유효한지 확인

### PDF 파싱 실패
- poppler-utils 설치 확인 (Linux/Mac)
- tesseract-ocr 설치 확인 (OCR 필요 시)
- PDF 파일이 손상되지 않았는지 확인

### 벡터 DB 연결 실패
- Supabase에서 pgvector 확장 활성화 확인:
  ```sql
  CREATE EXTENSION IF NOT EXISTS vector;
  ```
- DATABASE_URL 형식 확인

## 📚 참고 문서

- [FastAPI 문서](https://fastapi.tiangolo.com/)
- [LangChain 문서](https://python.langchain.com/)
- [Supabase 문서](https://supabase.com/docs)
- [OpenAPI 스펙](./api/openapi.yaml)

## 📝 개발 로드맵

- ✅ **P0**: 부팅/스펙 고정 (완료)
- 🚧 **P1**: 데이터/보안 토대
- 🔜 **P2**: 인덱싱 & 단일모델 분석
- 🔜 **P3**: 듀얼 LLM(폴백/컨센서스) & 안정화

## 🤝 기여

이슈 및 PR은 환영합니다!

## 📄 라이선스

MIT License
