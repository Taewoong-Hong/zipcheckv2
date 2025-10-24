# 📚 ZipCheck 문서 가이드

집체크 프로젝트의 기술 문서 모음입니다.

## 📋 문서 목록

### 🔐 인증 & OAuth
- **[OAUTH_SETUP.md](OAUTH_SETUP.md)** - OAuth 통합 설정 가이드
- **[KAKAO_OAUTH_SETUP.md](KAKAO_OAUTH_SETUP.md)** - 카카오 OAuth 상세 설정
- **[NAVER_SUPABASE_CUSTOM_OAUTH.md](NAVER_SUPABASE_CUSTOM_OAUTH.md)** - 네이버 OAuth Edge Function 구현

### 💳 결제 시스템
- **[BILLING_API_GUIDE.md](BILLING_API_GUIDE.md)** - 토스페이먼츠 빌링키 결제 가이드
- **[TOSSPAYMENTS_ERROR_CODES.md](TOSSPAYMENTS_ERROR_CODES.md)** - 토스페이먼츠 에러 코드 참조

### 🔒 보안
- **[SECURITY.md](SECURITY.md)** - 보안 가이드 및 베스트 프랙티스
- **[SECURITY_IMPLEMENTATION_SUMMARY.md](SECURITY_IMPLEMENTATION_SUMMARY.md)** - 보안 구현 요약

### 🔍 SEO
- **[SEO_GUIDE.md](SEO_GUIDE.md)** - SEO 최적화 가이드

### 📦 Archive
- **[archive/WORK_LOG_20250123.md](archive/WORK_LOG_20250123.md)** - 2025-01-23 작업 일지

## 🎯 문서 사용 가이드

### 새로운 기능 개발 시
1. **인증**: `OAUTH_SETUP.md` 참조
2. **결제**: `BILLING_API_GUIDE.md` 참조
3. **보안**: `SECURITY.md` 확인 필수

### 에러 발생 시
1. **결제 에러**: `TOSSPAYMENTS_ERROR_CODES.md`에서 에러 코드 검색
2. **OAuth 에러**: 해당 OAuth 문서 참조

### 배포 전 체크리스트
1. ✅ `SECURITY.md`의 보안 체크리스트 검증
2. ✅ `SEO_GUIDE.md`의 SEO 최적화 확인
3. ✅ 환경 변수 설정 확인

## 📝 문서 기여 가이드

### 새 문서 추가 시
- 파일명: `SNAKE_CASE.md` 형식 사용
- 제목: `# 📚 제목` 형식으로 이모지 포함
- 목차: 긴 문서는 목차 추가
- 날짜: 마지막에 작성일 기록

### 문서 업데이트 시
- 변경 이력 섹션에 날짜와 변경 내용 기록
- 중요한 변경사항은 `CLAUDE.md`에도 반영

## 🔗 관련 문서
- **[../CLAUDE.md](../CLAUDE.md)** - 프로젝트 메인 문서 (LLM용)
- **[../apps/web/README.md](../apps/web/README.md)** - 프론트엔드 가이드
- **[../services/ai/README.md](../services/ai/README.md)** - AI 서비스 가이드
