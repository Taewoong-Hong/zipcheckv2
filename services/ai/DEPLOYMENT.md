# ZipCheck AI - Cloud Run 배포 가이드

**버전**: 2.0.0
**플랫폼**: Google Cloud Run
**리전**: asia-northeast3 (서울)

---

## 📋 사전 준비

### 1. **Google Cloud 프로젝트 설정**

```bash
# Google Cloud SDK 설치 확인
gcloud version

# 로그인
gcloud auth login

# 프로젝트 생성 (선택)
gcloud projects create zipcheck-ai --name="ZipCheck AI"

# 프로젝트 설정
gcloud config set project zipcheck-ai

# 리전 설정 (서울)
gcloud config set run/region asia-northeast3
```

### 2. **필수 API 활성화**

```bash
# Cloud Run API
gcloud services enable run.googleapis.com

# Container Registry API
gcloud services enable containerregistry.googleapis.com

# Cloud Build API
gcloud services enable cloudbuild.googleapis.com

# Secret Manager API
gcloud services enable secretmanager.googleapis.com
```

---

## 🔐 시크릿 관리 (Secret Manager)

### **시크릿 생성**

```bash
# OpenAI API Key
echo -n "sk-proj-your-actual-key" | \
  gcloud secrets create openai-api-key \
  --data-file=- \
  --replication-policy="automatic"

# Anthropic API Key
echo -n "sk-ant-your-actual-key" | \
  gcloud secrets create anthropic-api-key \
  --data-file=- \
  --replication-policy="automatic"

# Supabase Database URL
echo -n "postgresql://postgres.<ref>:<password>@<host>:6543/postgres" | \
  gcloud secrets create supabase-database-url \
  --data-file=- \
  --replication-policy="automatic"
```

### **시크릿 확인**

```bash
# 목록 확인
gcloud secrets list

# 특정 시크릿 확인 (값은 보이지 않음)
gcloud secrets describe openai-api-key
```

### **서비스 계정 권한 부여**

```bash
# Compute Engine default service account에 권한 부여
PROJECT_NUMBER=$(gcloud projects describe zipcheck-ai --format="value(projectNumber)")

gcloud secrets add-iam-policy-binding openai-api-key \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

gcloud secrets add-iam-policy-binding anthropic-api-key \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

gcloud secrets add-iam-policy-binding supabase-database-url \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

---

## 🐳 Docker 이미지 빌드

### **로컬 빌드 및 테스트**

```bash
cd services/ai

# 이미지 빌드
docker build -t zipcheck-ai:local .

# 로컬 테스트 (환경변수는 .env 파일 사용)
docker run -p 8000:8000 --env-file .env zipcheck-ai:local

# 헬스체크 확인
curl http://localhost:8000/healthz
```

### **GCR(Google Container Registry)에 푸시**

```bash
# 프로젝트 ID 확인
PROJECT_ID=$(gcloud config get-value project)

# Docker 이미지 태그
docker tag zipcheck-ai:local gcr.io/${PROJECT_ID}/zipcheck-ai:latest

# GCR 인증
gcloud auth configure-docker

# 이미지 푸시
docker push gcr.io/${PROJECT_ID}/zipcheck-ai:latest
```

---

## 🚀 Cloud Run 배포

### **방법 1: gcloud CLI로 배포 (권장)**

```bash
cd services/ai

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
  --set-env-vars APP_ENV=production,LOG_LEVEL=INFO,EMBED_MODEL=text-embedding-3-small \
  --set-secrets OPENAI_API_KEY=openai-api-key:latest,DATABASE_URL=supabase-database-url:latest,ANTHROPIC_API_KEY=anthropic-api-key:latest
```

### **방법 2: service.yaml로 배포**

```bash
# service.yaml 수정 (PROJECT_ID 교체)
sed -i "s/PROJECT_ID/${PROJECT_ID}/g" service.yaml

# 배포
gcloud run services replace service.yaml --region asia-northeast3
```

### **방법 3: Cloud Build (CI/CD)**

```bash
# Cloud Build 트리거 생성 (GitHub 연동)
gcloud builds submit --config cloudbuild.yaml

# 또는 GitHub 푸시 시 자동 배포 설정
# https://console.cloud.google.com/cloud-build/triggers
```

---

## ✅ 배포 확인

### **서비스 URL 확인**

```bash
# 배포된 URL 확인
gcloud run services describe zipcheck-ai \
  --region asia-northeast3 \
  --format "value(status.url)"

# 예시 출력:
# https://zipcheck-ai-xxxxxxxxxxxx-an.a.run.app
```

### **헬스체크**

```bash
# URL을 변수에 저장
SERVICE_URL=$(gcloud run services describe zipcheck-ai \
  --region asia-northeast3 \
  --format "value(status.url)")

# 헬스체크
curl ${SERVICE_URL}/healthz

# 예상 응답:
# {"status":"healthy","version":"2.0.0"}
```

### **API 테스트**

```bash
# 분석 API 테스트
curl -X POST ${SERVICE_URL}/analyze \
  -H "Content-Type: application/json" \
  -d '{"question":"보증금 5000만원 계약의 총 비용은?","mode":"single"}'
```

---

## 📊 모니터링 & 로그

### **로그 확인**

```bash
# 실시간 로그
gcloud run services logs tail zipcheck-ai --region asia-northeast3

# 최근 100개 로그
gcloud run services logs read zipcheck-ai \
  --region asia-northeast3 \
  --limit 100
```

### **메트릭 확인**

- **Cloud Console**: https://console.cloud.google.com/run
- **Logs Explorer**: https://console.cloud.google.com/logs

### **비용 확인**

```bash
# Cloud Run 비용 확인
gcloud billing accounts list

# Cost Calculator
# https://cloud.google.com/products/calculator
```

---

## 🔄 업데이트 & 롤백

### **새 버전 배포**

```bash
# 1. 새 이미지 빌드 & 푸시
docker build -t gcr.io/${PROJECT_ID}/zipcheck-ai:v2 .
docker push gcr.io/${PROJECT_ID}/zipcheck-ai:v2

# 2. 배포
gcloud run deploy zipcheck-ai \
  --image gcr.io/${PROJECT_ID}/zipcheck-ai:v2 \
  --region asia-northeast3
```

### **롤백**

```bash
# 이전 버전 목록 확인
gcloud run revisions list --service zipcheck-ai --region asia-northeast3

# 특정 리비전으로 롤백
gcloud run services update-traffic zipcheck-ai \
  --to-revisions <REVISION_NAME>=100 \
  --region asia-northeast3
```

---

## ⚙️ 환경 변수 업데이트

### **환경 변수 추가/수정**

```bash
gcloud run services update zipcheck-ai \
  --update-env-vars NEW_VAR=value \
  --region asia-northeast3
```

### **시크릿 업데이트**

```bash
# 새 시크릿 버전 생성
echo -n "new-api-key" | gcloud secrets versions add openai-api-key --data-file=-

# Cloud Run은 자동으로 latest 버전 사용
```

---

## 🌐 커스텀 도메인 설정

### **도메인 매핑**

```bash
# 1. 도메인 확인
gcloud domains verify api.zipcheck.app

# 2. 도메인 매핑
gcloud run domain-mappings create \
  --service zipcheck-ai \
  --domain api.zipcheck.app \
  --region asia-northeast3

# 3. DNS 레코드 추가 (출력된 값 사용)
```

---

## 💰 비용 최적화

### **권장 설정**

```yaml
min-instances: 0        # 트래픽 없을 때 0으로 스케일
max-instances: 10       # 최대 10개 인스턴스
memory: 2Gi             # PDF 처리 위해 2GB 필요
cpu: 2                  # 2 vCPU
timeout: 300            # 5분 (Vision API 대비)
concurrency: 80         # 인스턴스당 80 동시 요청
```

### **예상 비용 (월간)**

- **요청**: 10,000건/월 → $0.40
- **CPU 시간**: 100 vCPU-hours → $2.40
- **메모리**: 200 GiB-hours → $0.25
- **네트워킹**: 10 GB → $1.20
- **총 비용**: ~$4-5/월

---

## 🔒 보안 Best Practices

1. **인증 설정**
   ```bash
   # Public access 차단 (프로덕션)
   gcloud run services update zipcheck-ai \
     --no-allow-unauthenticated \
     --region asia-northeast3
   ```

2. **CORS 설정**
   - `AI_ALLOWED_ORIGINS` 환경 변수로 도메인 제한

3. **Rate Limiting**
   - Cloud Armor 사용 권장
   - FastAPI middleware로 IP별 제한

4. **시크릿 로테이션**
   - 정기적으로 API 키 교체 (3개월마다)

---

## 🆘 트러블슈팅

### **자주 발생하는 오류**

#### 1. **Container failed to start**
```bash
# 로그 확인
gcloud run services logs read zipcheck-ai --region asia-northeast3 --limit 50

# 흔한 원인:
# - PORT 환경 변수 미설정
# - 시크릿 접근 권한 부족
# - 메모리 부족 (OOM)
```

#### 2. **Secret Manager 접근 오류**
```bash
# 서비스 계정 권한 확인
gcloud secrets get-iam-policy openai-api-key

# 권한 추가
PROJECT_NUMBER=$(gcloud projects describe zipcheck-ai --format="value(projectNumber)")
gcloud secrets add-iam-policy-binding openai-api-key \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

#### 3. **Timeout 오류**
```bash
# Timeout 늘리기 (최대 60분)
gcloud run services update zipcheck-ai \
  --timeout 3600 \
  --region asia-northeast3
```

---

## 📚 추가 자료

- [Cloud Run 문서](https://cloud.google.com/run/docs)
- [Secret Manager 가이드](https://cloud.google.com/secret-manager/docs)
- [Cloud Build 설정](https://cloud.google.com/build/docs)
- [Cloud Run 가격](https://cloud.google.com/run/pricing)

---

**마지막 업데이트**: 2025-10-20
**담당자**: 백엔드 개발팀
