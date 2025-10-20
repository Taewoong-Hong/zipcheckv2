# Supabase ID 및 식별자 설명

## 🆔 Supabase의 다양한 ID 종류

### 1. 프로젝트 URL (Project Reference ID)
```
https://gsiismzchtgdklvdvggu.supabase.co
         └─────────┬──────────┘
            Project Reference
```

**용도:**
- Supabase 프로젝트의 고유 식별자
- API 엔드포인트 URL에 사용
- Database 호스트명에 포함

**특징:**
- 프로젝트 생성 시 자동 생성
- 프로젝트 수명 동안 거의 변경되지 않음
- 복원 시에도 대부분 유지됨

**사용 예시:**
```env
NEXT_PUBLIC_SUPABASE_URL=https://gsiismzchtgdklvdvggu.supabase.co
DATABASE_URL=postgresql://postgres:pwd@db.gsiismzchtgdklvdvggu.supabase.co:5432/postgres
```

---

### 2. User UID (Authentication User ID)
```
auth.users 테이블의 id 컬럼
예: 550e8400-e29b-41d4-a716-446655440000
```

**용도:**
- 회원가입한 **개별 사용자**를 식별하는 UUID
- RLS(Row Level Security) 정책에서 사용
- 사용자별 데이터 격리

**특징:**
- 사용자가 회원가입할 때마다 새로 생성
- UUID v4 형식 (36자)
- 사용자별로 고유함
- 삭제 전까지 영구적

**사용 예시:**
```sql
-- RLS 정책에서 사용
CREATE POLICY "users_can_view_own_data"
ON v2_contracts FOR SELECT
USING (user_id = auth.uid());

-- 테이블 구조
CREATE TABLE v2_contracts (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id),  -- 👈 User UID
    contract_id TEXT,
    ...
);
```

---

### 3. API Keys (Project-level)
```
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**용도:**
- **프로젝트 전체**에 대한 API 인증
- anon key: 클라이언트(브라우저)에서 사용
- service_role key: 서버에서 사용 (모든 권한)

**특징:**
- 프로젝트 수준의 키
- 복원 시에도 변경되지 않음
- JWT 토큰 형식

---

## 🔍 실제 사용 예시 비교

### 시나리오: 사용자 홍길동의 계약서 조회

```typescript
// 1. 프로젝트 URL 사용 (API 엔드포인트)
const supabaseUrl = 'https://gsiismzchtgdklvdvggu.supabase.co'
const supabaseAnonKey = 'eyJhbG...'  // 프로젝트 API Key

const supabase = createClient(supabaseUrl, supabaseAnonKey)

// 2. 로그인 후 User UID 획득
const { data: { user } } = await supabase.auth.getUser()
console.log(user.id)  // 👈 User UID: "550e8400-e29b-41d4-a716-446655440000"

// 3. User UID로 본인의 데이터만 조회
const { data } = await supabase
  .from('v2_contracts')
  .select('*')
  .eq('user_id', user.id)  // 👈 User UID 사용
```

---

## 📊 ID 비교표

| 항목 | 프로젝트 Reference ID | User UID | API Keys |
|------|---------------------|----------|----------|
| **식별 대상** | Supabase 프로젝트 | 개별 사용자 | 프로젝트 접근 권한 |
| **형식** | 영문+숫자 20자 | UUID (36자) | JWT 토큰 (긴 문자열) |
| **예시** | `gsiismzchtgdklvdvggu` | `550e8400-e29b-41d4-a716-446655440000` | `eyJhbGciOi...` |
| **생성 시점** | 프로젝트 생성 시 | 사용자 회원가입 시 | 프로젝트 생성 시 |
| **개수** | 프로젝트당 1개 | 사용자 수만큼 | 프로젝트당 2개 (anon, service) |
| **사용 위치** | URL, 환경변수 | 데이터베이스, RLS | API 호출 인증 |
| **복원 시 변경** | 거의 없음 (99%) | 변경 없음 | 변경 없음 |

---

## 🔐 실제 데이터 흐름

### 사용자 A가 계약서 업로드
```
1. 브라우저에서 API 호출
   → URL: https://gsiismzchtgdklvdvggu.supabase.co/rest/v1/...
          └─────────────┬───────────────┘
                  프로젝트 Reference ID

   → Header: apikey: eyJhbG...
                     └──┬──┘
                  API Key (프로젝트 인증)

2. Supabase Auth가 사용자 확인
   → User UID: 550e8400-e29b-41d4-a716-446655440000
               └──────────────┬─────────────────┘
                       사용자 A의 고유 ID

3. 데이터베이스에 저장
   INSERT INTO v2_contracts (id, user_id, contract_id, ...)
   VALUES (uuid_generate_v4(), '550e8400-...', 'contract-001', ...)
                                └────┬────┘
                            사용자 A의 UID (소유자 표시)

4. RLS 정책 검증
   WHERE user_id = auth.uid()
   → auth.uid()는 현재 로그인한 사용자의 UID 반환
   → 사용자 A는 자신의 데이터만 조회 가능
```

---

## 💡 핵심 요약

**프로젝트 URL ID (`gsiismzchtgdklvdvggu`)**
- "이 Supabase 프로젝트"를 식별
- 집 주소 같은 개념

**User UID (`550e8400-e29b-41d4-a716-446655440000`)**
- "이 사용자"를 식별
- 주민등록번호 같은 개념
- 집(프로젝트) 안에 사는 사람(사용자)

**API Keys**
- 프로젝트 접근을 위한 "열쇠"
- 집 출입 카드키 같은 개념

---

## 🎯 현재 상황에서 필요한 것

ZipCheck v2 프로젝트 복원 시:

✅ **확인 필요:**
- 프로젝트 URL (DATABASE_URL 업데이트용)
- API Keys (변경 여부 확인)

✅ **확인 불필요:**
- User UID (기존 사용자 데이터 그대로 유지됨)
- 사용자가 가입할 때마다 자동으로 생성되므로 신경 쓸 필요 없음

---

**작성일**: 2025-10-17
