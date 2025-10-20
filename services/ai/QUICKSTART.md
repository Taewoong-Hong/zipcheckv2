# ZipCheck AI - Google Cloud 빠른 시작 가이드

**소요 시간**: 약 20분
**난이도**: 초급

---

## 📋 **체크리스트**

- [ ] Google Cloud 계정 가입 완료
- [ ] 신용카드 등록 완료 (무료 크레딧 $300)
- [ ] Google Cloud SDK (gcloud) 설치
- [ ] Docker Desktop 설치

---

## 1️⃣ **Google Cloud SDK 설치**

### **Windows**

```powershell
# 1. Google Cloud SDK 다운로드
# https://cloud.google.com/sdk/docs/install

# 2. 설치 파일 실행
# GoogleCloudSDKInstaller.exe

# 3. 설치 후 PowerShell 재시작

# 4. 설치 확인
gcloud version
```

**예상 출력**:
```
Google Cloud SDK 462.0.0
bq 2.0.101
core 2024.02.23
gcloud-crc32c 1.0.0
gsutil 5.27
```

### **macOS/Linux**

```bash
# macOS (Homebrew)
brew install google-cloud-sdk

# Linux
curl https://sdk.cloud.google.com | bash
exec -l $SHELL

# 확인
gcloud version
```

---

## 2️⃣ **Google Cloud 초기 설정**

### **Step 1: 로그인**

```bash
# Google 계정으로 로그인
gcloud auth login
```

**브라우저가 열리면**:
1. Google 계정 선택
2. "허용" 클릭
3. 터미널로 돌아오기

### **Step 2: 프로젝트 생성**

```bash
# 프로젝트 ID는 전역적으로 고유해야 함
# 예: zipcheck-ai-prod, zipcheck-ai-123 등

# 프로젝트 생성
gcloud projects create zipcheck-ai-prod --name="ZipCheck AI Production"

# 프로젝트 설정
gcloud config set project zipcheck-ai-prod

# 확인
gcloud config list
```

**예상 출력**:
```
[core]
account = your-email@gmail.com
project = zipcheck-ai-prod
```

### **Step 3: 결제 계정 연결**

```bash
# 결제 계정 목록 확인
gcloud billing accounts list

# 예상 출력:
# ACCOUNT_ID            NAME                OPEN  MASTER_ACCOUNT_ID
# 01XXXX-XXXXXX-XXXXXX  My Billing Account  True

# 결제 계정 연결 (ACCOUNT_ID를 실제 값으로 교체)
gcloud billing projects link zipcheck-ai-prod \
  --billing-account=01XXXX-XXXXXX-XXXXXX
```

**💡 Tip**: 결제 계정이 없다면:
1. https://console.cloud.google.com/billing
2. "결제 계정 추가" 클릭
3. 신용카드 정보 입력

### **Step 4: 필수 API 활성화**

```bash
# 한 번에 모든 API 활성화
gcloud services enable \
  run.googleapis.com \
  containerregistry.googleapis.com \
  cloudbuild.googleapis.com \
  secretmanager.googleapis.com

# 활성화 확인 (1-2분 소요)
gcloud services list --enabled
```

---

## 3️⃣ **API 키 및 시크릿 설정**

### **Step 1: Secret Manager에 API 키 저장**

```bash
# 현재 디렉토리 확인 (services/ai 여야 함)
pwd
# 출력: c:/dev/zipcheckv2/services/ai

# OpenAI API Key 저장
# ⚠️ 실제 API 키로 교체하세요!
echo -n "sk-your-openai-api-key-here" | \
  gcloud secrets create openai-api-key --data-file=-

# Supabase Database URL 저장
echo -n "postgresql://postgres.gsiismzchtgdklvdvggu:x9HLz4pQVTDzaS3w@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres" | \
  gcloud secrets create supabase-database-url --data-file=-

# Anthropic API Key 저장 (선택사항 - 나중에 사용)
echo -n "sk-ant-your-key-here" | \
  gcloud secrets create anthropic-api-key --data-file=-
```

### **Step 2: 시크릿 확인**

```bash
# 생성된 시크릿 목록
gcloud secrets list

# 예상 출력:
# NAME                      CREATED              REPLICATION_POLICY  LOCATIONS
# anthropic-api-key         2025-10-20T05:30:00  automatic           -
# openai-api-key            2025-10-20T05:29:00  automatic           -
# supabase-database-url     2025-10-20T05:29:30  automatic           -
```

### **Step 3: 서비스 계정 권한 부여**

```bash
# 프로젝트 번호 가져오기
PROJECT_NUMBER=$(gcloud projects describe zipcheck-ai-prod --format="value(projectNumber)")

echo "프로젝트 번호: $PROJECT_NUMBER"

# Compute Engine 서비스 계정에 Secret Manager 접근 권한 부여
for SECRET in openai-api-key supabase-database-url anthropic-api-key; do
  gcloud secrets add-iam-policy-binding $SECRET \
    --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
    --role="roles/secretmanager.secretAccessor"
done

echo "✅ 시크릿 권한 설정 완료"
```

---

## 4️⃣ **Docker 이미지 빌드 & 푸시**

### **Step 1: Container Registry 인증**

```bash
# Docker를 GCR과 연동
gcloud auth configure-docker
```

### **Step 2: 이미지 빌드**

```bash
# 현재 위치 확인
pwd
# c:/dev/zipcheckv2/services/ai

# 프로젝트 ID 확인
PROJECT_ID=$(gcloud config get-value project)
echo "프로젝트 ID: $PROJECT_ID"

# Docker 이미지 빌드 (3-5분 소요)
docker build -t gcr.io/${PROJECT_ID}/zipcheck-ai:latest .
```

**예상 출력**:
```
[+] Building 180.5s (15/15) FINISHED
 => [internal] load build definition from Dockerfile
 => [builder 1/4] FROM docker.io/library/python:3.12-slim
 => [builder 4/4] RUN pip install --no-cache-dir -r requirements.txt
 => [stage-1 5/6] COPY --from=builder /usr/local/lib/python3.12/site-packages
 => exporting to image
 => => writing image sha256:abc123...
 => => naming to gcr.io/zipcheck-ai-prod/zipcheck-ai:latest
```

### **Step 3: GCR에 푸시**

```bash
# 이미지 푸시 (1-2분 소요)
docker push gcr.io/${PROJECT_ID}/zipcheck-ai:latest
```

**예상 출력**:
```
The push refers to repository [gcr.io/zipcheck-ai-prod/zipcheck-ai]
latest: digest: sha256:abc123... size: 4567
```

### **Step 4: 푸시 확인**

```bash
# Container Registry에서 이미지 확인
gcloud container images list

# 이미지 상세 정보
gcloud container images describe gcr.io/${PROJECT_ID}/zipcheck-ai:latest
```

---

## 5️⃣ **Cloud Run 배포**

### **한 번에 배포하기**

```bash
# 서울 리전에 배포 (2-3분 소요)
gcloud run deploy zipcheck-ai \
  --image gcr.io/${PROJECT_ID}/zipcheck-ai:latest \
  --region asia-northeast3 \
  --platform managed \
  --allow-unauthenticated \
  --min-instances 0 \
  --max-instances 10 \
  --memory 2Gi \
  --cpu 2 \
  --timeout 300 \
  --concurrency 80 \
  --set-env-vars "APP_ENV=production,LOG_LEVEL=INFO,PRIMARY_LLM=openai,EMBED_MODEL=text-embedding-3-small,EMBED_DIMENSIONS=1536,OPENAI_VISION_MODEL=gpt-4o,OPENAI_CLASSIFICATION_MODEL=gpt-4o-mini,OPENAI_ANALYSIS_MODEL=gpt-4o-mini" \
  --set-secrets "OPENAI_API_KEY=openai-api-key:latest,DATABASE_URL=supabase-database-url:latest,ANTHROPIC_API_KEY=anthropic-api-key:latest"
```

**예상 출력**:
```
Deploying container to Cloud Run service [zipcheck-ai] in project [zipcheck-ai-prod] region [asia-northeast3]
✓ Deploying new service... Done.
  ✓ Creating Revision...
  ✓ Routing traffic...
Done.
Service [zipcheck-ai] revision [zipcheck-ai-00001-abc] has been deployed and is serving 100 percent of traffic.
Service URL: https://zipcheck-ai-xxxxxxxxxxxx-an.a.run.app
```

### **배포 URL 저장**

```bash
# 서비스 URL 가져오기
SERVICE_URL=$(gcloud run services describe zipcheck-ai \
  --region asia-northeast3 \
  --format "value(status.url)")

echo "🎉 배포 완료!"
echo "서비스 URL: $SERVICE_URL"
```

---

## 6️⃣ **배포 테스트**

### **헬스체크**

```bash
# 헬스체크 엔드포인트 호출
curl ${SERVICE_URL}/healthz

# 예상 응답:
# {"status":"healthy","version":"2.0.0"}
```

### **API 문서 확인**

브라우저에서 열기:
```bash
echo "${SERVICE_URL}/docs"
```

예시: `https://zipcheck-ai-xxxxxxxxxxxx-an.a.run.app/docs`

### **분석 API 테스트**

```bash
# 계약서 분석 API 테스트
curl -X POST ${SERVICE_URL}/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "question": "보증금 5000만원, 월세 50만원 계약의 1년 총 비용은?",
    "mode": "single"
  }'
```

**예상 응답**:
```json
{
  "answer": "1년 총 비용은 다음과 같습니다:\n\n1. 보증금: 5,000만원 (계약 종료 후 반환)\n2. 월세 총액: 50만원 × 12개월 = 600만원\n\n따라서 실제 지출되는 비용은 월세 600만원입니다.",
  "mode": "single",
  "provider": "openai",
  "sources": []
}
```

---

## 7️⃣ **환경 변수 업데이트 (.env.local)**

### **루트 .env.local 파일 수정**

```bash
# 파일 열기
code c:/dev/zipcheckv2/.env.local
```

**추가할 내용**:
```bash
# AI API (FastAPI Backend) - PRODUCTION
AI_API_URL=https://zipcheck-ai-xxxxxxxxxxxx-an.a.run.app
NEXT_PUBLIC_AI_API_URL=https://zipcheck-ai-xxxxxxxxxxxx-an.a.run.app
```

**💡 Tip**: `${SERVICE_URL}` 값을 실제 URL로 교체하세요!

---

## 8️⃣ **모니터링 & 로그**

### **실시간 로그 확인**

```bash
# 실시간 로그 스트리밍
gcloud run services logs tail zipcheck-ai \
  --region asia-northeast3 \
  --format "table(timestamp,severity,textPayload)"
```

### **Cloud Console에서 확인**

1. **Cloud Run 대시보드**:
   ```
   https://console.cloud.google.com/run?project=zipcheck-ai-prod
   ```

2. **로그 탐색기**:
   ```
   https://console.cloud.google.com/logs?project=zipcheck-ai-prod
   ```

3. **비용 확인**:
   ```
   https://console.cloud.google.com/billing?project=zipcheck-ai-prod
   ```

---

## 9️⃣ **업데이트 배포**

코드 수정 후 재배포:

```bash
# 1. 새 이미지 빌드
docker build -t gcr.io/${PROJECT_ID}/zipcheck-ai:latest .

# 2. 푸시
docker push gcr.io/${PROJECT_ID}/zipcheck-ai:latest

# 3. Cloud Run 업데이트 (자동으로 새 이미지 사용)
gcloud run deploy zipcheck-ai \
  --image gcr.io/${PROJECT_ID}/zipcheck-ai:latest \
  --region asia-northeast3
```

---

## 🔟 **비용 관리**

### **예산 알림 설정**

```bash
# 월 $10 초과 시 알림
gcloud billing budgets create \
  --billing-account=$(gcloud billing accounts list --format="value(name)" --limit=1) \
  --display-name="ZipCheck AI Budget" \
  --budget-amount=10 \
  --threshold-rule=percent=50 \
  --threshold-rule=percent=90 \
  --threshold-rule=percent=100
```

### **현재 비용 확인**

```bash
# 이번 달 비용
gcloud billing accounts list --format="table(name,displayName,open)"
```

**Cloud Console**:
```
https://console.cloud.google.com/billing/
```

---

## ✅ **완료 체크리스트**

배포 완료 후 확인:

- [ ] `gcloud version` 정상 작동
- [ ] `gcloud config list` - 프로젝트 설정됨
- [ ] `gcloud secrets list` - 3개 시크릿 생성됨
- [ ] `docker images` - zipcheck-ai 이미지 존재
- [ ] `gcloud container images list` - GCR에 이미지 푸시됨
- [ ] `gcloud run services list` - zipcheck-ai 서비스 실행 중
- [ ] `curl ${SERVICE_URL}/healthz` - 200 OK 응답
- [ ] `${SERVICE_URL}/docs` - Swagger UI 접근 가능
- [ ] `.env.local` - 프로덕션 URL 업데이트됨

---

## 🆘 **문제 해결**

### **"Permission denied" 오류**

```bash
# 서비스 계정 권한 재확인
PROJECT_NUMBER=$(gcloud projects describe $(gcloud config get-value project) --format="value(projectNumber)")

gcloud secrets add-iam-policy-binding openai-api-key \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

### **"Container failed to start" 오류**

```bash
# 로그 확인
gcloud run services logs read zipcheck-ai \
  --region asia-northeast3 \
  --limit 100

# 가장 흔한 원인:
# 1. PORT 환경 변수 누락 → 배포 명령어에 --set-env-vars 추가
# 2. 시크릿 접근 권한 부족 → 위 "Permission denied" 섹션 참고
# 3. 메모리 부족 → --memory 2Gi 이상 설정
```

### **Docker 빌드 실패**

```bash
# Docker Desktop이 실행 중인지 확인
docker info

# Python 버전 확인
docker run --rm python:3.12-slim python --version
```

---

## 📚 **추가 자료**

- [Cloud Run 문서](https://cloud.google.com/run/docs)
- [Secret Manager 가이드](https://cloud.google.com/secret-manager/docs)
- [gcloud CLI 레퍼런스](https://cloud.google.com/sdk/gcloud/reference)
- [Cloud Run 가격](https://cloud.google.com/run/pricing)

---

**🎉 축하합니다! ZipCheck AI가 프로덕션 환경에 배포되었습니다!**

다음: [Next.js 앱에서 Cloud Run API 연동하기](../web/README.md)
