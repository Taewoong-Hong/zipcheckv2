#!/bin/bash
# ZipCheck AI - Cloud Run 배포 스크립트
# 필수 환경변수 14개 포함

set -e  # 에러 발생 시 즉시 종료

echo "🚀 ZipCheck AI Cloud Run 배포 시작..."
echo "📍 리전: asia-northeast3 (서울)"
echo "📦 소스: services/ai"
echo ""

# 배포 실행 (CORS는 세미콜론으로 구분)
gcloud run deploy zipcheck-ai \
  --source services/ai \
  --region asia-northeast3 \
  --allow-unauthenticated \
  --project advance-vector-475706-a5 \
  --update-env-vars "\
APP_ENV=production,\
LOG_LEVEL=INFO,\
SUPABASE_URL=https://gsiismzchtgdklvdvggu.supabase.co,\
AI_ALLOWED_ORIGINS=https://zipcheck.kr;https://www.zipcheck.kr;http://localhost:3000" \
  --update-secrets "\
OPENAI_API_KEY=openai-api-key:latest,\
ANTHROPIC_API_KEY=anthropic-api-key:latest,\
GEMINI_API_KEY=gemini-api-key:latest,\
DATABASE_URL=supabase-database-url:latest,\
JWT_SECRET=supabase-jwt-secret:latest,\
SUPABASE_ANON_KEY=supabase-anon-key:2,\
SUPABASE_SERVICE_ROLE_KEY=supabase-service-role-key:latest,\
DATA_GO_KR_API_KEY=data-go-kr-api-key:latest,\
BUILDING_LEDGER_API_KEY=building-ledger-api-key:latest,\
VWORLD_API_KEY=vworld-api-key-production:latest"

echo ""
echo "✅ 배포 완료!"
echo "🔗 Service URL: https://zipcheck-ai-ov5n6pt46a-du.a.run.app"
echo ""
echo "📋 배포된 환경변수 (총 14개):"
echo "  1. APP_ENV=production"
echo "  2. LOG_LEVEL=INFO"
echo "  3. AI_ALLOWED_ORIGINS (CORS)"
echo "  4. SUPABASE_URL"
echo "  5. OPENAI_API_KEY (Secret)"
echo "  6. ANTHROPIC_API_KEY (Secret)"
echo "  7. GEMINI_API_KEY (Secret)"
echo "  8. DATABASE_URL (Secret)"
echo "  9. JWT_SECRET (Secret)"
echo " 10. SUPABASE_ANON_KEY (Secret, version 2)"
echo " 11. SUPABASE_SERVICE_ROLE_KEY (Secret)"
echo " 12. DATA_GO_KR_API_KEY (Secret)"
echo " 13. BUILDING_LEDGER_API_KEY (Secret)"
echo " 14. VWORLD_API_KEY (Secret)"
echo ""
echo "🧪 테스트: https://zipcheck-ai-ov5n6pt46a-du.a.run.app/docs"
