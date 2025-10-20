# 집체크(ZipCheck) 웹 프론트엔드

## 🚀 시작하기

### 1. 환경 변수 설정

`.env.local` 파일을 생성하고 백엔드 API URL을 설정합니다:

```bash
cp .env.example .env.local
```

`.env.local` 파일을 편집하여 실제 Cloud Run URL을 입력:

```env
# 백엔드 담당자에게 받은 실제 Cloud Run URL
AI_API_URL=https://zipcheck-ai-xxxxx-du.a.run.app

# 로컬 개발 서버
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 2. 패키지 설치

```bash
npm install
```

### 3. 개발 서버 실행

```bash
npm run dev
```

http://localhost:3000 에서 확인할 수 있습니다.

## 📦 프로덕션 빌드

```bash
npm run build
npm run start
```

## 🏗️ 아키텍처

### 백엔드 연동 구조

```
[Next.js Frontend]
     ↓
[/api/chat] (프록시)
     ↓
[Google Cloud Run]
  - zipcheck-ai 서비스
  - FastAPI + LangChain
  - OpenAI GPT-4
  - Supabase Vector DB
```

### 주요 기능

- ✅ **AI 채팅**: 부동산 계약서 분석 및 리스크 평가
- ✅ **파일 업로드**: PDF, DOC, HWP 등 계약서 파일 지원
- ✅ **실시간 스트리밍**: AI 응답을 실시간으로 표시
- ✅ **반응형 디자인**: 모바일/데스크톱 최적화
- ✅ **브랜드 UI**: 집체크 브랜드 컬러 및 디자인 시스템

## 🎨 UI 컴포넌트

### 채팅 관련
- `ChatInterface.tsx`: 메인 채팅 인터페이스
- `Message.tsx`: 메시지 표시 컴포넌트
- `ChatInput.tsx`: 채팅 입력 컴포넌트

### 레이아웃
- `Sidebar.tsx`: 사이드바 네비게이션
- `UserProfile.tsx`: 사용자 프로필 컴포넌트

### 페이지
- `/`: 메인 채팅 페이지
- `/terms`: 이용약관 페이지
- `/pricing`: 요금제 페이지

## 🔧 백엔드 API 엔드포인트

### POST `/api/chat`
채팅 메시지를 백엔드 AI 서비스로 전달

**요청**:
```json
{
  "messages": [
    {"role": "user", "content": "질문 내용"}
  ]
}
```

**응답**: Server-Sent Events 스트림

### GET `/api/chat`
백엔드 헬스 체크

**응답**:
```json
{
  "status": "healthy",
  "backend": "connected",
  "timestamp": "2024-01-01T00:00:00Z"
}
```

## 📝 백엔드 배포 정보

백엔드는 Google Cloud Run에 배포되어 있습니다:

```bash
# 백엔드 배포 명령어 (참고용)
gcloud run deploy zipcheck-ai \
  --source services/ai \
  --region asia-northeast3 \
  --allow-unauthenticated \
  --execution-environment gen2 \
  --service-account zipcheck-ai-sa@advance-vector-475706-a5.iam.gserviceaccount.com \
  --min-instances=0 \
  --max-instances=10 \
  --concurrency=80 \
  --cpu=2 \
  --memory=2Gi \
  --timeout=300 \
  --set-env-vars "APP_ENV=production,LOG_LEVEL=INFO" \
  --set-secrets "OPENAI_API_KEY=openai-api-key:latest,DATABASE_URL=supabase-database-url:latest"
```

## 🚨 주의사항

1. **환경 변수**: 실제 Cloud Run URL을 백엔드 담당자에게 확인
2. **CORS**: 백엔드에서 프론트엔드 도메인 허용 필요
3. **인증**: 현재 `allow-unauthenticated` 설정 (추후 인증 추가 필요)
4. **API 키**: OpenAI API 키는 백엔드에서 관리 (프론트엔드에 노출 X)

## 📞 문의

- 프론트엔드 이슈: [프론트엔드 담당자]
- 백엔드 이슈: [백엔드 담당자]
- 일반 문의: support@zipcheck.kr