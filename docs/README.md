# 📚 ZipCheck 문서 가이드

집체크 프로젝트의 기술 문서 모음입니다.

## 📁 문서 구조

```
docs/
├── architecture/       # 시스템 아키텍처 설계 문서
├── setup/             # 환경 설정 및 구성 가이드
├── features/          # 기능별 상세 문서
│   ├── oauth/         # OAuth 인증 시스템
│   ├── payment/       # 결제 시스템
│   ├── security/      # 보안 구현
│   └── pdf/          # PDF 뷰어 기능
├── database/          # 데이터베이스 관련 문서
├── admin/             # 관리자 설정 가이드
├── changelog/         # 변경 이력
└── archive/           # 레거시 문서
```

## 📋 주요 문서

### 🏗️ Architecture (아키텍처)
- **[architecture/CHAT_ARCHITECTURE.md](architecture/CHAT_ARCHITECTURE.md)** - 채팅 시스템 아키텍처
- **[architecture/ANALYSIS_SYSTEM_GUIDE.md](architecture/ANALYSIS_SYSTEM_GUIDE.md)** - 7단계 분석 파이프라인
- **[architecture/CORE_LOGIC_REDESIGN.md](architecture/CORE_LOGIC_REDESIGN.md)** - 핵심 평가 엔진 v2.0

### ⚙️ Setup (환경 설정)
- **[setup/ENV_USAGE.md](setup/ENV_USAGE.md)** - 환경 변수 설정 가이드
- **[setup/MIGRATION_GUIDE.md](setup/MIGRATION_GUIDE.md)** - 데이터베이스 마이그레이션
- **[setup/SUPABASE_STORAGE_SETUP.md](setup/SUPABASE_STORAGE_SETUP.md)** - Storage 버킷 구성

### 🔐 Features - OAuth
- **[features/oauth/OAUTH_SETUP.md](features/oauth/OAUTH_SETUP.md)** - OAuth 통합 설정 가이드
- **[features/oauth/KAKAO_OAUTH_SETUP.md](features/oauth/KAKAO_OAUTH_SETUP.md)** - 카카오 OAuth 상세 설정
- **[features/oauth/NAVER_SUPABASE_CUSTOM_OAUTH.md](features/oauth/NAVER_SUPABASE_CUSTOM_OAUTH.md)** - 네이버 OAuth Edge Function

### 💳 Features - Payment
- **[features/payment/BILLING_API_GUIDE.md](features/payment/BILLING_API_GUIDE.md)** - 토스페이먼츠 빌링키 결제
- **[features/payment/TOSSPAYMENTS_ERROR_CODES.md](features/payment/TOSSPAYMENTS_ERROR_CODES.md)** - 에러 코드 참조

### 🔒 Features - Security
- **[features/security/SECURITY.md](features/security/SECURITY.md)** - 보안 가이드 및 베스트 프랙티스
- **[features/security/SECURITY_IMPLEMENTATION_SUMMARY.md](features/security/SECURITY_IMPLEMENTATION_SUMMARY.md)** - 보안 구현 요약
- **[features/security/ENCRYPTION_IMPLEMENTATION.md](features/security/ENCRYPTION_IMPLEMENTATION.md)** - PII 암호화 구현

### 📄 Features - PDF
- **[features/pdf/PDF_VIEWER_GUIDE.md](features/pdf/PDF_VIEWER_GUIDE.md)** - PDF 뷰어 컴포넌트

### 👤 Admin (관리자)
- **[admin/ADMIN_DASHBOARD_SETUP.md](admin/ADMIN_DASHBOARD_SETUP.md)** - 관리자 대시보드 설정
- **[admin/ADMIN_SECURITY_FINAL.md](admin/ADMIN_SECURITY_FINAL.md)** - 관리자 보안 최종본
- **[admin/ADMIN_SETUP_QUICK.md](admin/ADMIN_SETUP_QUICK.md)** - 빠른 설정 가이드
- **[admin/SECURITY_AUDIT_REPORT.md](admin/SECURITY_AUDIT_REPORT.md)** - 보안 감사 리포트

### 📝 Changelog (변경 이력)
- **[changelog/REFACTORING_SUMMARY.md](changelog/REFACTORING_SUMMARY.md)** - 리팩토링 히스토리

### 📦 Archive (레거시)
- **[archive/CHAT_SYSTEM_ARCHITECTURE.md](archive/CHAT_SYSTEM_ARCHITECTURE.md)** - 구 채팅 아키텍처
- **[archive/ANALYSIS_FLOW_STATUS_REPORT.md](archive/ANALYSIS_FLOW_STATUS_REPORT.md)** - 분석 플로우 상태 리포트
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
