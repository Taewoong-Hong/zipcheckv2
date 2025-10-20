# ZipCheck AI - 소스 기반 Cloud Run 배포 가이드

**배포 방식**: Source-based deployment (Buildpacks)
**소요 시간**: 약 10-15분
**난이도**: 초급

> ✨ **Docker 이미지 빌드 불필요!** 소스 코드만 업로드하면 Cloud Run이 자동으로 빌드합니다.

---

## 📋 **사전 준비**

### **필수 파일 확인**

```bash
cd c:/dev/zipcheckv2/services/ai

# 필수 파일 존재 확인
ls -la app.py requirements.txt Procfile
```

**체크리스트**:
- [x] `app.py` - FastAPI 앱 엔트리포인트
- [x] `requirements.txt` - Python 의존성
- [x] `Procfile` - 실행 명령어 정의
- [x] `.gcloudignore` - 업로드 제외 파일

---

## 0️⃣ **GCP 초기 설정**

### **Step 1: 로그인**

```powershell
# Google Cloud 로그인
gcloud auth login

# 브라우저에서 계정 선택 후 "허용" 클릭
```

### **Step 2: 프로젝트 생성 및 설정**

```powershell
# 프로젝트 생성 (프로젝트 ID는 전역적으로 고유해야 함)
gcloud projects create zipcheck-ai-prod --name="ZipCheck AI Production"

# 프로젝트 설정
gcloud config set project zipcheck-ai-prod

# 리전 설정 (서울)
gcloud config set run/region asia-northeast3

# 확인
gcloud config list
```

### **Step 3: 결제 계정 연결**

```powershell
# 결제 계정 목록
gcloud billing accounts list

# 출력 예시:
# ACCOUNT_ID            NAME                OPEN
# 01XXXX-XXXXXX-XXXXXX  My Billing Account  True

# 결제 연결 (ACCOUNT_ID를 실제 값으로 교체)
gcloud billing projects link zipcheck-ai-prod `
  --billing-account=01XXXX-XXXXXX-XXXXXX
```

### **Step 4: API 활성화**

```powershell
# 필수 API 한 번에 활성화
gcloud services enable `
  run.googleapis.com `
  cloudbuild.googleapis.com `
  secretmanager.googleapis.com

# 활성화 확인
gcloud services list --enabled | Select-String "run.googleapis.com|cloudbuild.googleapis.com|secretmanager.googleapis.com"
```

---

## 1️⃣ **서비스 계정 생성 (권장)**

```powershell
# 전용 서비스 계정 생성
gcloud iam service-accounts create zipcheck-ai-sa `
  --display-name="ZipCheck AI Service Account" `
  --description="Service account for ZipCheck AI Cloud Run service"

# 생성 확인
gcloud iam service-accounts list
```

---

## 2️⃣ **Secret Manager 시크릿 생성**

### **OpenAI API Key**

```powershell
# 실제 API 키로 교체하세요!
echo -n "sk-your-openai-api-key-here" | `
  gcloud secrets create openai-api-key `
  --data-file=- `
  --replication-policy="automatic"
```

### **Supabase Database URL**

```powershell
echo -n "postgresql://postgres.gsiismzchtgdklvdvggu:x9HLz4pQVTDzaS3w@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres" | `
  gcloud secrets create supabase-database-url `
  --data-file=- `
  --replication-policy="automatic"
```

### **Anthropic API Key (선택사항)**

```powershell
# 나중에 사용할 경우
echo -n "sk-ant-your-key-here" | `
  gcloud secrets create anthropic-api-key `
  --data-file=- `
  --replication-policy="automatic"
```

### **시크릿 확인**

```powershell
# 생성된 시크릿 목록
gcloud secrets list

# 예상 출력:
# NAME                      CREATED              REPLICATION_POLICY
# anthropic-api-key         2025-10-20T06:00:00  automatic
# openai-api-key            2025-10-20T05:59:00  automatic
# supabase-database-url     2025-10-20T05:59:30  automatic
```

---

## 3️⃣ **서비스 계정 권한 부여**

```powershell
# 서비스 계정에 Secret Manager 접근 권한 부여
gcloud secrets add-iam-policy-binding openai-api-key `
  --member="serviceAccount:zipcheck-ai-sa@zipcheck-ai-prod.iam.gserviceaccount.com" `
  --role="roles/secretmanager.secretAccessor"

gcloud secrets add-iam-policy-binding supabase-database-url `
  --member="serviceAccount:zipcheck-ai-sa@zipcheck-ai-prod.iam.gserviceaccount.com" `
  --role="roles/secretmanager.secretAccessor"

gcloud secrets add-iam-policy-binding anthropic-api-key `
  --member="serviceAccount:zipcheck-ai-sa@zipcheck-ai-prod.iam.gserviceaccount.com" `
  --role="roles/secretmanager.secretAccessor"

Write-Output "✅ 서비스 계정 권한 설정 완료"
```

---

## 4️⃣ **소스 기반 배포 (핵심!)**

### **배포 명령어**

```powershell
# 현재 디렉토리 확인 (프로젝트 루트여야 함)
cd c:/dev/zipcheckv2

# 소스 기반 배포 실행 (5-10분 소요)
gcloud run deploy zipcheck-ai `
  --source services/ai `
  --region asia-northeast3 `
  --allow-unauthenticated `
  --execution-environment gen2 `
  --service-account zipcheck-ai-sa@zipcheck-ai-prod.iam.gserviceaccount.com `
  --min-instances=0 `
  --max-instances=10 `
  --concurrency=80 `
  --cpu=2 `
  --memory=2Gi `
  --timeout=300 `
  --set-env-vars "APP_ENV=production,LOG_LEVEL=INFO,PRIMARY_LLM=openai,JUDGE_LLM=claude,EMBED_MODEL=text-embedding-3-small,EMBED_DIMENSIONS=1536,OPENAI_VISION_MODEL=gpt-4o,OPENAI_CLASSIFICATION_MODEL=gpt-4o-mini,OPENAI_ANALYSIS_MODEL=gpt-4o-mini,LLM_TEMPERATURE=0.2,LLM_MAX_TOKENS=2048,VISION_MAX_TOKENS=4096,VISION_DETAIL=high,AI_ALLOWED_ORIGINS=*" `
  --set-secrets "OPENAI_API_KEY=openai-api-key:latest,DATABASE_URL=supabase-database-url:latest,ANTHROPIC_API_KEY=anthropic-api-key:latest"
```

### **배포 과정 설명**

```
1. 소스 코드 업로드 → Cloud Build
2. Buildpacks가 Python 앱 감지
3. requirements.txt 자동 설치
4. Procfile의 web 명령으로 실행
5. Cloud Run에 배포 완료
```

### **예상 출력**

```
This command is equivalent to running `gcloud builds submit --pack image=[IMAGE] services/ai` and `gcloud run deploy zipcheck-ai --image [IMAGE]`

Building using Buildpacks and deploying container to Cloud Run service [zipcheck-ai] in project [zipcheck-ai-prod] region [asia-northeast3]
✓ Building and deploying new service... Done.
  ✓ Uploading sources...
  ✓ Building Container... Logs are available at [https://console.cloud.google.com/cloud-build/builds/...]
  ✓ Creating Revision...
  ✓ Routing traffic...
Done.
Service [zipcheck-ai] revision [zipcheck-ai-00001-abc] has been deployed and is serving 100 percent of traffic.
Service URL: https://zipcheck-ai-xxxxxxxxxxxx-an.a.run.app
```

---

## 5️⃣ **배포 확인 및 테스트**

### **서비스 URL 가져오기**

```powershell
# 배포된 URL 확인
$SERVICE_URL = gcloud run services describe zipcheck-ai `
  --region asia-northeast3 `
  --format "value(status.url)"

Write-Output "🎉 배포 완료!"
Write-Output "서비스 URL: $SERVICE_URL"

# URL을 환경 변수로 저장
$env:SERVICE_URL = $SERVICE_URL
```

### **헬스체크**

```powershell
# 헬스체크 엔드포인트 호출
curl "$SERVICE_URL/healthz"

# 예상 응답:
# {"status":"healthy","version":"2.0.0"}
```

### **API 문서 확인**

```powershell
# Swagger UI 열기
Start-Process "$SERVICE_URL/docs"
```

### **분석 API 테스트**

```powershell
# JSON 데이터로 분석 요청
$body = @{
    question = "보증금 5000만원, 월세 50만원 계약의 1년 총 비용은?"
    mode = "single"
} | ConvertTo-Json

Invoke-RestMethod -Uri "$SERVICE_URL/analyze" `
  -Method Post `
  -ContentType "application/json" `
  -Body $body
```

**예상 응답**:
```json
{
  "answer": "1년 총 비용:\n1. 보증금: 5,000만원 (반환)\n2. 월세: 600만원 (50만원 × 12개월)\n\n실제 지출: 월세 600만원",
  "mode": "single",
  "provider": "openai",
  "sources": []
}
```

---

## 6️⃣ **환경 변수 업데이트**

### **루트 .env.local 파일 수정**

```powershell
# 파일 열기
code c:/dev/zipcheckv2/.env.local
```

**프로덕션 URL 추가**:
```bash
# AI API (FastAPI Backend) - PRODUCTION
AI_API_URL=https://zipcheck-ai-xxxxxxxxxxxx-an.a.run.app
NEXT_PUBLIC_AI_API_URL=https://zipcheck-ai-xxxxxxxxxxxx-an.a.run.app
```

**💡 Tip**: PowerShell 변수 `$SERVICE_URL`을 복사해서 붙여넣으세요!

```powershell
Write-Output $SERVICE_URL
```

---

## 7️⃣ **로그 확인**

### **실시간 로그**

```powershell
# 실시간 로그 스트리밍
gcloud run services logs tail zipcheck-ai `
  --region asia-northeast3 `
  --format "table(timestamp,severity,textPayload)"
```

### **최근 로그**

```powershell
# 최근 100개 로그
gcloud run services logs read zipcheck-ai `
  --region asia-northeast3 `
  --limit 100
```

### **Cloud Console**

- **Cloud Run**: https://console.cloud.google.com/run?project=zipcheck-ai-prod
- **로그**: https://console.cloud.google.com/logs?project=zipcheck-ai-prod
- **빌드**: https://console.cloud.google.com/cloud-build/builds?project=zipcheck-ai-prod

---

## 8️⃣ **업데이트 배포**

코드 수정 후 재배포:

```powershell
cd c:/dev/zipcheckv2

# 소스 기반 재배포 (간단!)
gcloud run deploy zipcheck-ai `
  --source services/ai `
  --region asia-northeast3
```

**변경 사항만 자동 감지하여 빠르게 배포됩니다!**

---

## 9️⃣ **환경 변수 업데이트**

### **환경 변수 추가/수정**

```powershell
# 새 환경 변수 추가
gcloud run services update zipcheck-ai `
  --update-env-vars NEW_VAR=value `
  --region asia-northeast3

# 여러 개 한 번에
gcloud run services update zipcheck-ai `
  --update-env-vars "VAR1=value1,VAR2=value2" `
  --region asia-northeast3
```

### **시크릿 업데이트**

```powershell
# 새 버전의 시크릿 생성
echo -n "new-api-key-value" | `
  gcloud secrets versions add openai-api-key --data-file=-

# Cloud Run이 자동으로 latest 버전 사용
# 재배포 필요 없음!
```

---

## 🔟 **스케일링 설정 조정**

```powershell
# 최소/최대 인스턴스 조정
gcloud run services update zipcheck-ai `
  --min-instances=1 `
  --max-instances=20 `
  --region asia-northeast3

# 동시성 조정
gcloud run services update zipcheck-ai `
  --concurrency=100 `
  --region asia-northeast3

# 타임아웃 조정
gcloud run services update zipcheck-ai `
  --timeout=600 `
  --region asia-northeast3
```

---

## 🔒 **인증 설정 (프로덕션)**

### **Public Access 제한**

```powershell
# Public access 차단
gcloud run services update zipcheck-ai `
  --no-allow-unauthenticated `
  --region asia-northeast3

# Next.js 백엔드만 접근 가능하도록 설정
# (서비스 계정 인증 필요)
```

### **CORS 설정**

환경 변수로 허용 도메인 지정:

```powershell
gcloud run services update zipcheck-ai `
  --update-env-vars "AI_ALLOWED_ORIGINS=https://zipcheck.app,https://www.zipcheck.app" `
  --region asia-northeast3
```

---

## 💰 **비용 모니터링**

### **예산 알림 설정**

```powershell
# 월 $10 초과 시 알림
gcloud billing budgets create `
  --billing-account=$(gcloud billing accounts list --format="value(name)" --limit=1) `
  --display-name="ZipCheck AI Budget" `
  --budget-amount=10 `
  --threshold-rule=percent=50 `
  --threshold-rule=percent=90 `
  --threshold-rule=percent=100
```

### **예상 비용 (월간)**

**무료 할당량**:
- 2백만 요청/월
- 360,000 vCPU-초
- 180,000 GiB-초

**10,000건 기준**: ~$4-5/월

---

## 🆘 **문제 해결**

### **빌드 실패**

```powershell
# 빌드 로그 확인
gcloud builds list --limit=1

# 특정 빌드 로그
gcloud builds log <BUILD_ID>
```

**흔한 원인**:
- requirements.txt 버전 충돌
- 시스템 패키지 누락 (Buildpacks가 자동 설치)
- 메모리 부족 → `--memory=4Gi`로 증가

### **서비스 시작 실패**

```powershell
# 로그 확인
gcloud run services logs read zipcheck-ai `
  --region asia-northeast3 `
  --limit 50

# 가장 흔한 원인:
# 1. PORT 환경 변수 → Procfile에 $PORT 사용 확인
# 2. 시크릿 접근 권한 부족 → 3️⃣ 단계 재확인
# 3. 의존성 설치 실패 → requirements.txt 확인
```

### **Secret Manager 접근 오류**

```powershell
# 권한 재확인
gcloud secrets get-iam-policy openai-api-key

# 서비스 계정 권한 재부여
gcloud secrets add-iam-policy-binding openai-api-key `
  --member="serviceAccount:zipcheck-ai-sa@zipcheck-ai-prod.iam.gserviceaccount.com" `
  --role="roles/secretmanager.secretAccessor"
```

---

## ✅ **완료 체크리스트**

- [ ] `gcloud auth login` 완료
- [ ] 프로젝트 생성 및 설정 완료
- [ ] 결제 계정 연결 완료
- [ ] API 활성화 완료 (run, cloudbuild, secretmanager)
- [ ] 서비스 계정 생성 완료
- [ ] 시크릿 3개 생성 완료 (openai, supabase, anthropic)
- [ ] 시크릿 권한 부여 완료
- [ ] `gcloud run deploy` 성공
- [ ] `curl $SERVICE_URL/healthz` → 200 OK
- [ ] Swagger UI 접근 가능 (`$SERVICE_URL/docs`)
- [ ] `.env.local` 업데이트 완료

---

## 🎉 **축하합니다!**

ZipCheck AI가 **소스 기반 배포**로 Cloud Run에 성공적으로 배포되었습니다!

**다음 단계**:
1. Next.js 앱에서 Cloud Run API 연동
2. 커스텀 도메인 설정 (api.zipcheck.app)
3. CI/CD 파이프라인 구축 (GitHub Actions)

---

**📚 추가 자료**:
- [Cloud Run 문서](https://cloud.google.com/run/docs)
- [Buildpacks 가이드](https://cloud.google.com/docs/buildpacks)
- [Source-based deployment](https://cloud.google.com/run/docs/deploying-source-code)
