#!/bin/bash

# Cloud Run 배포 스크립트 - 환경변수 20개 (zipcheck-ai-00074-fk5 구성 복제)

echo "=== ZipCheck AI Cloud Run 배포 시작 ==="
echo ""

# 프로젝트 정보
PROJECT_ID="advance-vector-475706-a5"
REGION="asia-northeast3"
SERVICE_NAME="zipcheck-ai"

# 현재 디렉토리 확인
if [ ! -f "app.py" ]; then
    echo "❌ 오류: services/ai 디렉토리에서 실행해주세요"
    exit 1
fi

echo "✅ 배포 준비 완료"
echo "   프로젝트: $PROJECT_ID"
echo "   리전: $REGION"
echo "   서비스: $SERVICE_NAME"
echo "   환경변수: 20개 (6개 plain + 14개 secrets)"
echo ""

# Step 1: SUPABASE_URL을 secret에서 제거하고 plain 환경변수로 전환
echo "📝 Step 1: SUPABASE_URL을 plain 환경변수로 전환..."
gcloud run services update $SERVICE_NAME \
  --region $REGION \
  --project $PROJECT_ID \
  --remove-secrets SUPABASE_URL \
  --update-env-vars "SUPABASE_URL=https://gsiismzchtgdklvdvggu.supabase.co" \
  --quiet

if [ $? -ne 0 ]; then
    echo "⚠️ Step 1 실패 (이미 plain일 수 있음), 계속 진행..."
fi

echo ""
echo "📦 Step 2: 전체 환경변수 20개 배포..."

# Step 2: 전체 배포 (zipcheck-ai-00074-fk5와 동일한 20개 환경변수)
gcloud run deploy $SERVICE_NAME \
  --source . \
  --region $REGION \
  --project $PROJECT_ID \
  --allow-unauthenticated \
  --update-env-vars "\
APP_ENV=production,\
LOG_LEVEL=INFO,\
PRIMARY_LLM=openai,\
JUDGE_LLM=claude,\
SUPABASE_URL=https://gsiismzchtgdklvdvggu.supabase.co,\
AI_ALLOWED_ORIGINS=https://zipcheck.kr;https://www.zipcheck.kr;http://localhost:3000" \
  --update-secrets "\
OPENAI_API_KEY=openai-api-key:latest,\
DATABASE_URL=supabase-database-url:latest,\
JWT_SECRET=supabase-jwt-secret:latest,\
SUPABASE_ANON_KEY=supabase-anon-key:2,\
SUPABASE_SERVICE_ROLE_KEY=supabase-service-role-key:latest,\
VWORLD_API_KEY=vworld-api-key-production:latest,\
ANTHROPIC_API_KEY=anthropic-api-key:latest,\
GEMINI_API_KEY=gemini-api-key:latest,\
TURNSTILE_SECRET_KEY=turnstile-secret-key:latest,\
ENCRYPTION_KEY=encryption-key:latest,\
DATA_GO_KR_API_KEY=data-go-kr-api-key:latest,\
BUILDING_LEDGER_API_KEY=building-ledger-api-key:latest,\
KEYWORD_JUSO_API_KEY=keyword-juso-api-key:latest,\
KAKAO_CLIENT_ID=kakao-client-id:latest"

# 배포 결과 확인
if [ $? -eq 0 ]; then
    echo ""
    echo "✅ 배포 완료!"
    echo ""
    echo "서비스 URL:"
    gcloud run services describe $SERVICE_NAME \
      --region $REGION \
      --project $PROJECT_ID \
      --format="value(status.url)"
    echo ""
    echo "현재 리비전:"
    gcloud run services describe $SERVICE_NAME \
      --region $REGION \
      --project $PROJECT_ID \
      --format="value(status.traffic.revisionName)"
    echo ""
    echo "환경변수 검증 (총 20개 확인):"
    ENV_COUNT=$(gcloud run services describe $SERVICE_NAME \
      --region $REGION \
      --project $PROJECT_ID \
      --format="yaml(spec.template.spec.containers[0].env)" | grep "^- name:" | wc -l)
    echo "   총 환경변수: ${ENV_COUNT}개"

    if [ "$ENV_COUNT" -eq 20 ]; then
        echo "   ✅ 환경변수 20개 설정 완료"
    else
        echo "   ⚠️ 환경변수 개수 불일치 (예상: 20개, 실제: ${ENV_COUNT}개)"
    fi
else
    echo ""
    echo "❌ 배포 실패"
    exit 1
fi