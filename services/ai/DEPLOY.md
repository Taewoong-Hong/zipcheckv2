# ZipCheck AI - Cloud Run 배포 가이드

## 🚀 빠른 배포 (추천)

**Windows**:
```cmd
cd c:\dev\zipcheckv2
.\services\ai\deploy.cmd
```

**Linux/Mac**:
```bash
cd /path/to/zipcheckv2
bash services/ai/deploy.sh
```

## 📋 필수 환경변수 (총 14개)

### Plain 환경변수 (4개)
| 변수명 | 값 | 설명 |
|--------|-----|------|
| `APP_ENV` | `production` | 운영 환경 |
| `LOG_LEVEL` | `INFO` | 로그 레벨 |
| `AI_ALLOWED_ORIGINS` | `https://zipcheck.kr,https://www.zipcheck.kr,http://localhost:3000` | CORS 허용 도메인 |
| `SUPABASE_URL` | `https://gsiismzchtgdklvdvggu.supabase.co` | Supabase 프로젝트 URL |

### Secret 환경변수 (10개)
| 변수명 | Secret 이름 | 버전 | 용도 |
|--------|-------------|------|------|
| `OPENAI_API_KEY` | `openai-api-key` | `latest` | ChatGPT (듀얼 초안) |
| `ANTHROPIC_API_KEY` | `anthropic-api-key` | `latest` | Claude (듀얼 검증) |
| `GEMINI_API_KEY` | `gemini-api-key` | `latest` | 이미지 PDF OCR |
| `DATABASE_URL` | `supabase-database-url` | `latest` | Supabase Postgres |
| `JWT_SECRET` | `supabase-jwt-secret` | `latest` | Supabase JWT |
| `SUPABASE_ANON_KEY` | `supabase-anon-key` | `2` | Supabase 익명 인증 ⚠️ |
| `SUPABASE_SERVICE_ROLE_KEY` | `supabase-service-role-key` | `latest` | Supabase Admin |
| `DATA_GO_KR_API_KEY` | `data-go-kr-api-key` | `latest` | 공공데이터포털 |
| `BUILDING_LEDGER_API_KEY` | `building-ledger-api-key` | `latest` | 건축물대장 |
| `VWORLD_API_KEY` | `vworld-api-key-production` | `latest` | VWorld 지도 |

> ⚠️ **중요**: `SUPABASE_ANON_KEY`는 version 2를 사용합니다 (개행 문자 제거됨).

## 🔧 수동 배포 (디버깅용)

```bash
cd c:\dev\zipcheckv2

gcloud run deploy zipcheck-ai \
  --source services/ai \
  --region asia-northeast3 \
  --allow-unauthenticated \
  --project advance-vector-475706-a5 \
  --set-env-vars "APP_ENV=production,LOG_LEVEL=INFO,AI_ALLOWED_ORIGINS=https://zipcheck.kr,https://www.zipcheck.kr,http://localhost:3000,SUPABASE_URL=https://gsiismzchtgdklvdvggu.supabase.co" \
  --set-secrets "OPENAI_API_KEY=openai-api-key:latest,ANTHROPIC_API_KEY=anthropic-api-key:latest,GEMINI_API_KEY=gemini-api-key:latest,DATABASE_URL=supabase-database-url:latest,JWT_SECRET=supabase-jwt-secret:latest,SUPABASE_ANON_KEY=supabase-anon-key:2,SUPABASE_SERVICE_ROLE_KEY=supabase-service-role-key:latest,DATA_GO_KR_API_KEY=data-go-kr-api-key:latest,BUILDING_LEDGER_API_KEY=building-ledger-api-key:latest,VWORLD_API_KEY=vworld-api-key-production:latest"
```

## 📊 배포 후 검증

### 1. Service URL 확인
```bash
gcloud run services describe zipcheck-ai --region asia-northeast3 --format="value(status.url)"
```

**예상 결과**: `https://zipcheck-ai-871793445649.asia-northeast3.run.app`

### 2. 환경변수 확인
```bash
gcloud run services describe zipcheck-ai --region asia-northeast3 --format="yaml(spec.template.spec.containers[0].env)"
```

**확인 사항**: 총 14개 환경변수 (Plain 4개 + Secret 10개)

### 3. API 문서 접근
```
https://zipcheck-ai-871793445649.asia-northeast3.run.app/docs
```

**예상 결과**: FastAPI Swagger UI 표시됨

### 4. 듀얼 LLM 시스템 테스트
프로덕션 환경(zipcheck.kr)에서:
1. 로그인
2. 채팅 메시지 전송
3. ChatGPT + Claude 듀얼 검증 응답 확인

### 5. 로그 확인
```bash
gcloud logging tail "resource.type=cloud_run_revision AND resource.labels.service_name=zipcheck-ai" --project=advance-vector-475706-a5
```

**확인 사항**:
- ✅ `SUPABASE_URL` 정상 로드 (No more "Invalid URL 'None/auth/v1/user'")
- ✅ `ANTHROPIC_API_KEY` 정상 로드 (Claude 검증 작동)
- ✅ 인증 에러 없음

## 🚨 트러블슈팅

### 문제: 500 에러 발생
**해결**:
```bash
# 실시간 로그 확인
gcloud logging tail "resource.type=cloud_run_revision AND resource.labels.service_name=zipcheck-ai" --project=advance-vector-475706-a5
```

### 문제: Secret 접근 권한 없음
**해결**:
```bash
# Service Account에 Secret Manager 권한 부여
gcloud secrets add-iam-policy-binding [SECRET_NAME] \
  --member="serviceAccount:871793445649-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor" \
  --project=advance-vector-475706-a5
```

### 문제: CORS 에러
**해결**: `AI_ALLOWED_ORIGINS`에 도메인 추가 후 재배포

## 📝 배포 히스토리

| 리비전 | 날짜 | 환경변수 | 비고 |
|--------|------|---------|------|
| `00047-xw4` | 2025-01-29 | 14개 | ✅ 정상 작동 (참조용) |
| `00054-qph` | 2025-10-30 | 7개 | ❌ 누락 많음 |
| `00055-xxx` | 2025-10-30 | 14개 | ✅ 이번 배포 |

## 🔐 Secret Manager 관리

### Secret 목록 확인
```bash
gcloud secrets list --project=advance-vector-475706-a5
```

### Secret 버전 확인
```bash
gcloud secrets versions list [SECRET_NAME] --project=advance-vector-475706-a5
```

### Secret 값 업데이트
```bash
echo -n "NEW_VALUE" | gcloud secrets versions add [SECRET_NAME] --data-file=- --project=advance-vector-475706-a5
```

## 📚 참고 문서

- [Cloud Run 공식 문서](https://cloud.google.com/run/docs)
- [Secret Manager 가이드](https://cloud.google.com/secret-manager/docs)
- [CLAUDE.md](../../CLAUDE.md) - 프로젝트 전체 가이드
- [CHANGELOG_2025-01-29.md](../../docs/CHANGELOG_2025-01-29.md) - 채팅 에러 해결 내역
