# 🔐 Supabase SECURITY DEFINER 뷰 보안 수정 가이드

## 📋 문제 요약

**감지된 보안 위험**: `public.recent_conversations` 뷰가 `SECURITY DEFINER` 속성으로 정의되어 RLS(Row Level Security) 정책 우회 가능

### 🚨 위험도
- **등급**: 중간~높음
- **영향**: 다른 사용자의 대화 데이터 노출 가능성
- **원인**: SECURITY DEFINER 속성으로 인해 뷰 실행 시 작성자(owner) 권한 사용

---

## 🔍 보안 위험 설명

### SECURITY DEFINER vs SECURITY INVOKER

| 속성 | 권한 | RLS 적용 | 보안 위험 |
|------|------|---------|----------|
| **SECURITY DEFINER** | 뷰 소유자(예: postgres) | ❌ 무시됨 | ⚠️ 높음 - 모든 데이터 노출 가능 |
| **SECURITY INVOKER** | 현재 실행 사용자 | ✅ 적용됨 | ✅ 안전 - RLS 필터 작동 |

### 예시 시나리오

```sql
-- 문제 있는 뷰 (SECURITY DEFINER)
CREATE VIEW public.recent_conversations
SECURITY DEFINER AS
SELECT * FROM conversations;

-- 일반 사용자 실행 시
SELECT * FROM public.recent_conversations;
-- 결과: 모든 사용자의 대화 데이터 반환 (RLS 무시됨)
```

```sql
-- 안전한 뷰 (SECURITY INVOKER)
CREATE VIEW public.recent_conversations
SECURITY INVOKER AS
SELECT * FROM conversations
WHERE user_id = auth.uid();

-- 일반 사용자 실행 시
SELECT * FROM public.recent_conversations;
-- 결과: 본인 대화 데이터만 반환 (RLS 적용됨)
```

---

## ✅ 해결 방법

### 1️⃣ 마이그레이션 파일 적용

```bash
# Supabase SQL Editor에서 실행
# 파일: db/migrations/004_fix_recent_conversations_security.sql
```

또는 Supabase CLI 사용:

```bash
cd c:\dev\zipcheckv2
supabase db push
```

### 2️⃣ 주요 변경 사항

#### Before (취약)
```sql
CREATE VIEW public.recent_conversations
SECURITY DEFINER AS  -- ⚠️ 위험: RLS 무시
SELECT * FROM conversations;
```

#### After (안전)
```sql
CREATE VIEW public.recent_conversations
SECURITY INVOKER AS  -- ✅ 안전: RLS 적용
SELECT
    c.id,
    c.user_id,
    c.title,
    -- ...
FROM conversations c
WHERE c.user_id = auth.uid();  -- ✅ 명시적 필터
```

### 3️⃣ RLS 정책 확인

마이그레이션 파일에서 자동으로 확인/생성:

```sql
-- conversations 테이블 정책
CREATE POLICY "Users can view own conversations"
ON conversations FOR SELECT
USING (auth.uid() = user_id);

-- messages 테이블 정책
CREATE POLICY "Users can view messages of own conversations"
ON messages FOR SELECT
USING (EXISTS (
    SELECT 1 FROM conversations
    WHERE conversations.id = messages.conversation_id
    AND conversations.user_id = auth.uid()
));
```

---

## 🧪 보안 검증

### 1. 뷰 정의 확인

Supabase SQL Editor에서 실행:

```sql
-- 뷰 속성 확인 (SECURITY INVOKER인지 확인)
SELECT
    viewname,
    viewowner,
    definition
FROM pg_views
WHERE viewname = 'recent_conversations';
```

**예상 결과**:
- `definition`에 `WHERE user_id = auth.uid()` 포함
- `SECURITY DEFINER`가 아닌 `SECURITY INVOKER` (또는 명시 없음, 기본값)

### 2. RLS 정책 확인

```sql
-- conversations/messages 테이블 RLS 정책 확인
SELECT
    schemaname,
    tablename,
    policyname,
    permissive,
    cmd,
    qual
FROM pg_policies
WHERE tablename IN ('conversations', 'messages')
ORDER BY tablename, policyname;
```

**예상 결과**:
- `conversations` 테이블: 4개 정책 (SELECT, INSERT, UPDATE, DELETE)
- `messages` 테이블: 2개 정책 (SELECT, INSERT)
- 모든 정책의 `qual` 컬럼에 `auth.uid() = user_id` 포함

### 3. 실제 데이터 접근 테스트

```sql
-- 테스트 사용자로 로그인 후 실행
SELECT * FROM recent_conversations;
```

**예상 결과**:
- 본인의 대화만 반환
- 다른 사용자의 대화는 보이지 않음

### 4. RLS 활성화 확인

```sql
-- 테이블 RLS 활성화 여부 확인
SELECT
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables
WHERE tablename IN ('conversations', 'messages');
```

**예상 결과**:
- `rowsecurity` 컬럼: 모두 `true`

---

## 📊 보안 개선 체크리스트

### 마이그레이션 전
- [ ] Supabase Security Advisor 경고 확인
- [ ] 현재 뷰 정의 백업 (Supabase Dashboard → SQL Editor)
- [ ] 기존 RLS 정책 확인

### 마이그레이션 실행
- [ ] `004_fix_recent_conversations_security.sql` 파일 적용
- [ ] 에러 없이 완료 확인
- [ ] 마이그레이션 로그 검토

### 마이그레이션 후
- [ ] 뷰 정의 검증 (SECURITY INVOKER 확인)
- [ ] RLS 정책 검증 (conversations/messages)
- [ ] 실제 데이터 접근 테스트 (본인 데이터만 보이는지)
- [ ] Supabase Security Advisor 재검사 (경고 해제 확인)

### 애플리케이션 테스트
- [ ] `/api/chat/recent` 엔드포인트 테스트
- [ ] 다른 사용자 대화 접근 불가 확인
- [ ] 본인 대화 정상 조회 확인
- [ ] 프론트엔드 "최근 대화" 목록 정상 작동

---

## 🔧 문제 해결 (Troubleshooting)

### 문제 1: "permission denied for view recent_conversations"

**원인**: RLS 정책 누락 또는 권한 부족

**해결**:
```sql
-- authenticated 역할에 SELECT 권한 부여
GRANT SELECT ON public.recent_conversations TO authenticated;

-- conversations 테이블 RLS 정책 추가
CREATE POLICY "Users can view own conversations"
ON conversations FOR SELECT
USING (auth.uid() = user_id);
```

### 문제 2: "다른 사용자 대화가 여전히 보임"

**원인**: 뷰에 `WHERE auth.uid() = user_id` 필터 누락

**해결**:
```sql
-- 뷰 재생성 (필터 추가)
DROP VIEW IF EXISTS public.recent_conversations;
CREATE VIEW public.recent_conversations
SECURITY INVOKER AS
SELECT * FROM conversations
WHERE user_id = auth.uid();  -- ⭐ 필수 필터
```

### 문제 3: "뷰 조회 시 데이터 없음"

**원인**: `auth.uid()` 인증 컨텍스트 누락

**해결**:
```typescript
// 프론트엔드: Supabase 클라이언트에 세션 전달 확인
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  }
});
```

```python
# 백엔드: service_role=False 사용 (RLS 적용)
supabase = get_supabase_client(service_role=False)
```

### 문제 4: "Cannot drop view: dependent objects exist"

**원인**: 다른 뷰/함수가 이 뷰를 참조 중

**해결**:
```sql
-- CASCADE 옵션으로 삭제
DROP VIEW IF EXISTS public.recent_conversations CASCADE;

-- 또는 의존 객체 확인
SELECT
    dependent_view.relname
FROM pg_depend
JOIN pg_rewrite ON pg_depend.objid = pg_rewrite.oid
JOIN pg_class as dependent_view ON pg_rewrite.ev_class = dependent_view.oid
WHERE pg_depend.refobjid = 'public.recent_conversations'::regclass;
```

---

## 📚 추가 참고 자료

### Supabase 공식 문서
- [Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Security Best Practices](https://supabase.com/docs/guides/database/postgres/security)
- [PostgreSQL Views](https://www.postgresql.org/docs/current/sql-createview.html)

### 보안 가이드라인
1. **SECURITY DEFINER는 최소한으로 사용**
   - 불가피한 경우에만 사용 (예: 시스템 함수, 크로스 테넌트 집계)
   - 사용 시 엄격한 권한 제한 및 감사 로그 필수

2. **뷰는 기본적으로 SECURITY INVOKER 사용**
   - 사용자 데이터 접근 시 RLS 필수 적용
   - 명시적 `WHERE auth.uid() = user_id` 필터 권장

3. **정기적인 보안 점검**
   - Supabase Security Advisor 월 1회 확인
   - RLS 정책 누락 테이블 점검
   - 권한 과다 부여 검토

---

## 📝 변경 이력

| 날짜 | 작성자 | 변경 내용 |
|------|--------|----------|
| 2025-01-29 | Backend Developer | 초기 작성 - recent_conversations 뷰 보안 수정 |

---

## ✅ 결론

이 마이그레이션을 적용하면:

✅ **RLS 정책 적용**: 사용자는 본인 데이터만 조회 가능
✅ **보안 경고 해제**: Supabase Security Advisor 경고 제거
✅ **성능 영향 없음**: SECURITY INVOKER는 성능에 영향 없음
✅ **호환성 유지**: 기존 API 엔드포인트 수정 불필요

**즉시 적용을 권장합니다!** 🔐