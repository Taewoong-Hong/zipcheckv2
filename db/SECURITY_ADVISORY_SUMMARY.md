# 🔐 Supabase Security Advisor - SECURITY DEFINER 뷰 보안 수정 요약

**일자**: 2025-01-29
**심각도**: 중간~높음 (데이터 노출 가능성)
**대상**: `public.recent_conversations` 뷰

---

## 📋 한 줄 요약

> Supabase Security Advisor가 감지한 `recent_conversations` 뷰의 **SECURITY DEFINER 속성**을 **SECURITY INVOKER**로 변경하여 **RLS 정책 우회 가능성을 제거**했습니다.

---

## 🚨 보안 위험 요약

### 문제 원인
```sql
-- ⚠️ 위험한 코드 (변경 전)
CREATE VIEW public.recent_conversations
SECURITY DEFINER AS  -- 뷰 소유자 권한으로 실행 (RLS 무시)
SELECT * FROM conversations;
```

### 위험 내용
- **RLS 정책 무시**: SECURITY DEFINER로 인해 뷰 실행 시 작성자(postgres, supabase_admin) 권한 사용
- **데이터 노출**: 일반 사용자가 다른 사용자의 대화 데이터 조회 가능
- **Supabase 핵심 방어선 우회**: RLS는 Supabase의 핵심 보안 메커니즘

### 영향 범위
- **대상 API**: `/api/chat/recent` (최근 대화 목록 조회)
- **영향 받는 사용자**: 모든 인증된 사용자
- **노출 가능 데이터**: 다른 사용자의 대화 ID, 제목, 주소, 계약 유형, 메시지 내역

---

## ✅ 해결 방법

### 1. 뷰 재정의 (SECURITY INVOKER)
```sql
-- ✅ 안전한 코드 (변경 후)
CREATE VIEW public.recent_conversations
SECURITY INVOKER AS  -- 현재 사용자 권한으로 실행 (RLS 적용)
SELECT
    c.id,
    c.user_id,
    c.title,
    -- ...
FROM conversations c
WHERE c.user_id = auth.uid();  -- ⭐ 명시적 필터
```

### 2. RLS 정책 확인 및 생성
- `conversations` 테이블: SELECT, INSERT, UPDATE, DELETE 정책
- `messages` 테이블: SELECT, INSERT 정책

### 3. 적용 파일
- **마이그레이션**: [`db/migrations/004_fix_recent_conversations_security.sql`](migrations/004_fix_recent_conversations_security.sql)
- **가이드 문서**: [`db/SECURITY_FIX_GUIDE.md`](SECURITY_FIX_GUIDE.md)

---

## 🔧 적용 방법 (즉시 실행 가능)

### Supabase Dashboard에서 적용
1. Supabase Dashboard 로그인
2. **SQL Editor** 탭 이동
3. [`004_fix_recent_conversations_security.sql`](migrations/004_fix_recent_conversations_security.sql) 파일 내용 복사
4. SQL Editor에 붙여넣기 후 **Run** 버튼 클릭

### Supabase CLI로 적용 (권장)
```bash
cd c:\dev\zipcheckv2
supabase db push
```

---

## ✅ 검증 체크리스트

### 마이그레이션 후 확인 (Supabase SQL Editor)
```sql
-- 1. 뷰 정의 확인 (SECURITY INVOKER 확인)
SELECT viewname, definition
FROM pg_views
WHERE viewname = 'recent_conversations';

-- 2. RLS 정책 확인
SELECT tablename, policyname, cmd, qual
FROM pg_policies
WHERE tablename IN ('conversations', 'messages')
ORDER BY tablename, policyname;

-- 3. 본인 데이터만 조회되는지 테스트
SELECT * FROM recent_conversations;
```

### 애플리케이션 테스트
- [ ] `/api/chat/recent` 엔드포인트 정상 작동 확인
- [ ] 본인 대화만 조회되는지 확인
- [ ] 다른 사용자 대화 접근 불가 확인
- [ ] Supabase Security Advisor 재검사 (경고 해제 확인)

---

## 📊 보안 개선 효과

| 항목 | Before (취약) | After (안전) |
|------|---------------|--------------|
| **뷰 권한** | SECURITY DEFINER (owner 권한) | SECURITY INVOKER (현재 사용자 권한) |
| **RLS 적용** | ❌ 무시됨 | ✅ 적용됨 |
| **데이터 접근** | 모든 사용자 대화 조회 가능 | 본인 대화만 조회 가능 |
| **보안 경고** | ⚠️ Security Advisor 경고 | ✅ 경고 해제 |
| **성능 영향** | N/A | ✅ 영향 없음 |

---

## 📚 추가 참고 자료

- **상세 가이드**: [`db/SECURITY_FIX_GUIDE.md`](SECURITY_FIX_GUIDE.md) (30+ 페이지 완전 가이드)
- **마이그레이션 파일**: [`db/migrations/004_fix_recent_conversations_security.sql`](migrations/004_fix_recent_conversations_security.sql)
- **Supabase 공식 문서**: [Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- **PostgreSQL 문서**: [CREATE VIEW - SECURITY](https://www.postgresql.org/docs/current/sql-createview.html)

---

## ⏰ 긴급도

**즉시 적용 권장** - 프로덕션 환경에서 사용자 데이터 노출 가능성이 있으므로 **오늘 중 적용을 권장**합니다.

**적용 시간**: 약 5분 (마이그레이션 + 검증)
**롤백 가능**: 네 (기존 뷰 정의 백업 권장)

---

## 📞 문의

- **GitHub Issue**: [Taewoong-Hong/zipcheckv2](https://github.com/Taewoong-Hong/zipcheckv2)
- **가이드 문서**: [`db/SECURITY_FIX_GUIDE.md`](SECURITY_FIX_GUIDE.md) 참조

---

**작성자**: Backend Developer
**작성일**: 2025-01-29
**버전**: 1.0.0