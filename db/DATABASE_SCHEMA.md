# ZipCheck v2 Database Schema Documentation

> **작성일**: 2025-10-29
> **버전**: 2.0
> **데이터베이스**: Supabase (PostgreSQL 15 + pgvector)

---

## 목차
1. [개요](#개요)
2. [테이블 구조](#테이블-구조)
3. [ERD 다이어그램](#erd-다이어그램)
4. [관계 (Foreign Keys)](#관계-foreign-keys)
5. [RLS 정책](#rls-정책)
6. [헬퍼 함수](#헬퍼-함수)

---

## 개요

### 설계 전략
- **v2 prefix 전략**: 기존 v1 서비스와 충돌하지 않도록 모든 테이블에 `v2_` prefix 사용
- **보안**: Row Level Security (RLS) 활성화로 사용자 데이터 격리
- **확장성**: pgvector 활용한 벡터 검색 지원

### 주요 확장 기능
- `vector` (pgvector): 벡터 임베딩 저장 및 유사도 검색

---

## 테이블 구조

### 1. 사용자 & 인증

#### `v2_profiles`
사용자 프로필 정보 (Supabase Auth 연동)

| 컬럼명 | 타입 | NULL | 기본값 | 설명 |
|--------|------|------|--------|------|
| id | UUID | NO | `gen_random_uuid()` | Primary Key |
| user_id | UUID | NO | - | Supabase Auth user ID (UNIQUE) |
| name | TEXT | YES | - | 사용자 이름 (암호화) |
| email | TEXT | YES | - | 이메일 |
| created_at | TIMESTAMPTZ | YES | `NOW()` | 생성일 |
| updated_at | TIMESTAMPTZ | YES | `NOW()` | 수정일 |

**관계**:
- `user_id` → `auth.users(id)` (CASCADE DELETE)

**인덱스**:
- PRIMARY KEY: `id`
- UNIQUE: `user_id`

**RLS 정책**:
- `v2_users_can_view_own_profile`: 본인 프로필만 조회 가능
- `v2_users_can_insert_own_profile`: 본인 프로필만 생성 가능
- `v2_users_can_update_own_profile`: 본인 프로필만 수정 가능

---

### 2. 채팅 & 대화

#### `conversations`
대화 세션 (사용자별 채팅방)

| 컬럼명 | 타입 | NULL | 기본값 | 설명 |
|--------|------|------|--------|------|
| id | UUID | NO | `gen_random_uuid()` | Primary Key |
| user_id | UUID | NO | - | 사용자 ID |
| title | TEXT | YES | - | 대화 제목 |
| property_address | TEXT | YES | - | 부동산 주소 |
| contract_type | TEXT | YES | - | 계약 유형 (전세/월세/매매) |
| analysis_status | TEXT | YES | - | 분석 상태 |
| meta | JSONB | YES | `{}` | 메타데이터 |
| created_at | TIMESTAMPTZ | YES | `NOW()` | 생성일 |
| updated_at | TIMESTAMPTZ | YES | `NOW()` | 수정일 |

**관계**:
- `user_id` → `auth.users(id)` (CASCADE DELETE)

**RLS 정책**:
- SELECT, INSERT, UPDATE, DELETE: 본인 대화만 접근 가능

#### `messages`
대화 메시지 (사용자 ↔ AI)

| 컬럼명 | 타입 | NULL | 기본값 | 설명 |
|--------|------|------|--------|------|
| id | BIGINT | NO | `nextval()` | Primary Key (auto-increment) |
| conversation_id | UUID | NO | - | 대화 ID |
| role | TEXT | NO | - | 역할 (user/assistant) |
| content | TEXT | NO | - | 메시지 내용 |
| meta | JSONB | YES | `{}` | 메타데이터 (토큰 수, 모델 등) |
| created_at | TIMESTAMPTZ | YES | `NOW()` | 생성일 |

**관계**:
- `conversation_id` → `conversations(id)` (CASCADE DELETE)

**RLS 정책**:
- SELECT, INSERT, UPDATE, DELETE: 본인 대화의 메시지만 접근 가능

#### `recent_conversations` (뷰)
최근 대화 조회용 뷰 (성능 최적화)

**정의**:
```sql
CREATE VIEW recent_conversations
WITH (security_invoker = true) AS
SELECT
    c.id,
    c.user_id,
    c.title,
    c.property_address,
    c.contract_type,
    c.created_at,
    c.updated_at,
    m.content as last_message,
    m.created_at as last_message_at
FROM conversations c
LEFT JOIN LATERAL (
    SELECT content, created_at
    FROM messages
    WHERE conversation_id = c.id
    ORDER BY created_at DESC
    LIMIT 1
) m ON true
WHERE c.user_id = auth.uid()
ORDER BY c.updated_at DESC;
```

**보안**: `SECURITY INVOKER` 모드로 RLS 적용 강제

---

### 3. 계약 분석 시스템

#### `v2_cases`
분석 사례 (단일 부동산 계약 분석 케이스)

| 컬럼명 | 타입 | NULL | 기본값 | 설명 |
|--------|------|------|--------|------|
| id | UUID | NO | `uuid_generate_v4()` | Primary Key |
| user_id | UUID | NO | - | 사용자 ID |
| address_road | TEXT | NO | - | 도로명 주소 (암호화) |
| address_lot | TEXT | YES | - | 지번 주소 (암호화) |
| address_dong | TEXT | YES | - | 동 |
| address_ho | TEXT | YES | - | 호 |
| address_detail | JSONB | YES | - | 상세 주소 (juso API 응답) |
| contract_type | TEXT | NO | - | 계약 유형 (전세/전월세/월세/매매) |
| contract_amount | BIGINT | YES | - | 계약금액 (보증금 or 매매가) |
| monthly_rent | BIGINT | YES | - | 월세 (해당 시) |
| state | TEXT | NO | `'init'` | 상태 (init → report) |
| flags | JSONB | YES | `{}` | 플래그 (test_mode 등) |
| metadata | JSONB | YES | `{}` | 메타데이터 |
| created_at | TIMESTAMPTZ | YES | `NOW()` | 생성일 |
| updated_at | TIMESTAMPTZ | YES | `NOW()` | 수정일 |
| completed_at | TIMESTAMPTZ | YES | - | 완료일 |

**상태 전환**: `init` → `address_pick` → `contract_type` → `registry_choice` → `registry_ready` → `parse_enrich` → `report`

**관계**:
- `user_id` → `auth.users(id)` (CASCADE DELETE)

**인덱스**:
- `idx_v2_cases_user_id`
- `idx_v2_cases_state`
- `idx_v2_cases_created_at` (DESC)

#### `v2_artifacts`
파일/문서 아티팩트 (등기부, 계약서, 리포트 PDF)

| 컬럼명 | 타입 | NULL | 기본값 | 설명 |
|--------|------|------|--------|------|
| id | UUID | NO | `uuid_generate_v4()` | Primary Key |
| case_id | UUID | NO | - | 케이스 ID |
| artifact_type | TEXT | NO | - | 파일 유형 (registry_pdf/building_ledger/user_upload/generated_report) |
| file_path | TEXT | NO | - | Supabase Storage 경로 |
| file_name | TEXT | NO | - | 원본 파일명 |
| file_size | BIGINT | NO | - | 파일 크기 (bytes) |
| mime_type | TEXT | NO | - | MIME 타입 |
| parsed_data | JSONB | YES | - | 파싱된 데이터 (구조화된 JSON) |
| parse_confidence | REAL | YES | - | 파싱 신뢰도 (0~1) |
| parse_method | TEXT | YES | - | 파싱 방법 (pypdf/ocr/llm_gemini/llm_chatgpt) |
| metadata | JSONB | YES | `{}` | 메타데이터 |
| created_at | TIMESTAMPTZ | YES | `NOW()` | 생성일 |
| updated_at | TIMESTAMPTZ | YES | `NOW()` | 수정일 |

**관계**:
- `case_id` → `v2_cases(id)` (CASCADE DELETE)

**인덱스**:
- `idx_v2_artifacts_case_id`
- `idx_v2_artifacts_type`

#### `v2_reports`
분석 리포트

| 컬럼명 | 타입 | NULL | 기본값 | 설명 |
|--------|------|------|--------|------|
| id | UUID | NO | `uuid_generate_v4()` | Primary Key |
| case_id | UUID | NO | - | 케이스 ID |
| version | INTEGER | NO | 1 | 리포트 버전 |
| report_data | JSONB | NO | - | 전체 리포트 JSON |
| final_summary | TEXT | YES | - | 채팅형 요약 (5-8줄) |
| risk_score | INTEGER | YES | - | 리스크 점수 (0~100) |
| risk_band | TEXT | YES | - | 리스크 밴드 (LOW/MID/HIGH/VHIGH) |
| llm_model_draft | TEXT | YES | - | 초안 생성 모델 (gpt-4o-mini) |
| llm_model_review | TEXT | YES | - | 검증 모델 (claude-sonnet-4) |
| llm_tokens_used | INTEGER | YES | - | 총 토큰 사용량 |
| generation_time_ms | INTEGER | YES | - | 생성 소요 시간 (ms) |
| metadata | JSONB | YES | `{}` | 메타데이터 |
| created_at | TIMESTAMPTZ | YES | `NOW()` | 생성일 |

**관계**:
- `case_id` → `v2_cases(id)` (CASCADE DELETE)

**인덱스**:
- `idx_v2_reports_case_id`
- `idx_v2_reports_version` (case_id, version DESC)
- `idx_v2_reports_risk_band`

---

### 4. 문서 & 벡터 검색 (Legacy v2)

#### `v2_contracts` (Legacy)
계약서 메타데이터 (v2 초기 설계, 현재는 v2_cases 사용)

| 컬럼명 | 타입 | NULL | 기본값 | 설명 |
|--------|------|------|--------|------|
| id | UUID | NO | `gen_random_uuid()` | Primary Key |
| user_id | UUID | NO | - | 사용자 ID |
| contract_id | TEXT | NO | - | 계약서 고유 ID (UNIQUE) |
| addr | TEXT | YES | - | 부동산 주소 (암호화) |
| status | TEXT | YES | `'processing'` | 처리 상태 (processing/completed/failed) |
| created_at | TIMESTAMPTZ | YES | `NOW()` | 생성일 |
| updated_at | TIMESTAMPTZ | YES | `NOW()` | 수정일 |

**관계**:
- `user_id` → `auth.users(id)` (CASCADE DELETE)

#### `v2_documents` (Legacy)
문서 원본 및 추출 텍스트

| 컬럼명 | 타입 | NULL | 기본값 | 설명 |
|--------|------|------|--------|------|
| id | UUID | NO | `gen_random_uuid()` | Primary Key |
| contract_id | UUID | NO | - | 계약서 ID |
| user_id | UUID | NO | - | 사용자 ID |
| document_type | TEXT | YES | `'registry'` | 문서 유형 (registry/contract) |
| file_path | TEXT | YES | - | 파일 저장 경로 |
| file_name | TEXT | YES | - | 파일명 |
| file_size | INTEGER | YES | - | 파일 크기 |
| mime_type | TEXT | YES | - | MIME 타입 |
| text | TEXT | YES | - | PDF 추출 텍스트 |
| text_length | INTEGER | YES | - | 텍스트 길이 |
| property_address | TEXT | YES | - | 등기부상 주소 |
| owner_info | JSONB | YES | `{}` | 소유자 정보 |
| registry_date | DATE | YES | - | 등기부 발급일자 |
| registry_type | TEXT | YES | - | 등기부 유형 (land/building/collective) |
| created_at | TIMESTAMPTZ | YES | `NOW()` | 생성일 |

**관계**:
- `contract_id` → `v2_contracts(id)` (CASCADE DELETE)
- `user_id` → `auth.users(id)` (CASCADE DELETE)

#### `v2_embeddings` (Legacy)
벡터 임베딩 (pgvector)

| 컬럼명 | 타입 | NULL | 기본값 | 설명 |
|--------|------|------|--------|------|
| id | UUID | NO | `gen_random_uuid()` | Primary Key |
| doc_id | UUID | NO | - | 문서 ID |
| user_id | UUID | NO | - | 사용자 ID |
| embedding | vector(1536) | YES | - | OpenAI text-embedding-3-small |
| chunk_text | TEXT | YES | - | 임베딩된 텍스트 청크 |
| chunk_index | INTEGER | YES | - | 문서 내 청크 순서 |
| metadata | JSONB | YES | `{}` | 메타데이터 (페이지, 오프셋 등) |
| created_at | TIMESTAMPTZ | YES | `NOW()` | 생성일 |

**벡터 인덱스**:
```sql
CREATE INDEX idx_v2_embeddings_vector ON v2_embeddings
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);
```

**관계**:
- `doc_id` → `v2_documents(id)` (CASCADE DELETE)
- `user_id` → `auth.users(id)` (CASCADE DELETE)

---

### 5. 크레딧 & 감사 로그

#### `v2_credit_transactions`
크레딧 트랜잭션 (등기부 발급 비용 등)

| 컬럼명 | 타입 | NULL | 기본값 | 설명 |
|--------|------|------|--------|------|
| id | UUID | NO | `uuid_generate_v4()` | Primary Key |
| user_id | UUID | NO | - | 사용자 ID |
| case_id | UUID | YES | - | 케이스 ID (NULL 허용) |
| transaction_type | TEXT | NO | - | 트랜잭션 유형 (purchase/deduct/refund/bonus/expire) |
| amount | INTEGER | NO | - | 크레딧 수량 (음수: 차감, 양수: 증가) |
| balance_after | INTEGER | NO | - | 트랜잭션 후 잔액 |
| reason | TEXT | NO | - | 트랜잭션 사유 |
| reason_code | TEXT | YES | - | 사유 코드 (REGISTRY_ISSUE/RPA_FAILED 등) |
| metadata | JSONB | YES | `{}` | 결제 정보, RPA 잡 ID 등 |
| created_at | TIMESTAMPTZ | YES | `NOW()` | 생성일 |

**관계**:
- `user_id` → `auth.users(id)` (CASCADE DELETE)
- `case_id` → `v2_cases(id)` (SET NULL)

**인덱스**:
- `idx_v2_credit_txns_user_id`
- `idx_v2_credit_txns_case_id`
- `idx_v2_credit_txns_created_at` (DESC)

#### `v2_audit_logs`
감사 로그 (시스템 이벤트 추적)

| 컬럼명 | 타입 | NULL | 기본값 | 설명 |
|--------|------|------|--------|------|
| id | UUID | NO | `uuid_generate_v4()` | Primary Key |
| user_id | UUID | YES | - | 사용자 ID (NULL 허용) |
| case_id | UUID | YES | - | 케이스 ID (NULL 허용) |
| event_type | TEXT | NO | - | 이벤트 타입 (case_created/pdf_parsed 등) |
| event_category | TEXT | YES | - | 이벤트 카테고리 (case/registry/parsing/llm/error) |
| message | TEXT | NO | - | 이벤트 메시지 |
| severity | TEXT | NO | `'info'` | 심각도 (debug/info/warning/error/critical) |
| metadata | JSONB | YES | `{}` | 추가 정보 (API 응답, 에러 스택 등) |
| created_at | TIMESTAMPTZ | YES | `NOW()` | 생성일 |

**관계**:
- `user_id` → `auth.users(id)` (SET NULL)
- `case_id` → `v2_cases(id)` (SET NULL)

**인덱스**:
- `idx_v2_audit_logs_user_id`
- `idx_v2_audit_logs_case_id`
- `idx_v2_audit_logs_event_type`
- `idx_v2_audit_logs_created_at` (DESC)

#### `v2_public_data_cache`
공공 데이터 캐시 (실거래가, 건축물대장 등)

| 컬럼명 | 타입 | NULL | 기본값 | 설명 |
|--------|------|------|--------|------|
| id | UUID | NO | `uuid_generate_v4()` | Primary Key |
| data_type | TEXT | NO | - | 캐시 데이터 유형 (building_ledger/real_estate_trade/similar_property/auction) |
| query_params | JSONB | NO | - | 쿼리 파라미터 (주소, 기간 등) |
| query_hash | TEXT | NO | - | 파라미터 해시 (캐시 키, UNIQUE) |
| data | JSONB | NO | - | 캐시된 데이터 |
| data_source | TEXT | NO | - | 데이터 출처 (국토부 API 등) |
| hit_count | INTEGER | NO | 0 | 캐시 히트 횟수 |
| expires_at | TIMESTAMPTZ | NO | - | 만료 시간 |
| created_at | TIMESTAMPTZ | YES | `NOW()` | 생성일 |
| last_accessed_at | TIMESTAMPTZ | YES | `NOW()` | 마지막 접근 시간 |

**인덱스**:
- `idx_v2_public_data_cache_type`
- `idx_v2_public_data_cache_hash` (UNIQUE)
- `idx_v2_public_data_cache_expires`

---

## ERD 다이어그램

```
┌─────────────────┐
│  auth.users     │
│  (Supabase)     │
└────────┬────────┘
         │
         ├─────────────────────────────────────────┐
         │                                         │
         ▼                                         ▼
┌─────────────────┐                     ┌──────────────────┐
│  v2_profiles    │                     │  conversations   │
│  - id           │                     │  - id            │
│  - user_id (FK) │                     │  - user_id (FK)  │
│  - name         │                     │  - title         │
│  - email        │                     │  - property_addr │
└─────────────────┘                     └────────┬─────────┘
                                                 │
                                                 ▼
                                        ┌──────────────────┐
                                        │    messages      │
                                        │  - id            │
                                        │  - conversation  │
                                        │  - role          │
                                        │  - content       │
                                        └──────────────────┘

┌─────────────────┐
│   v2_cases      │◄────────────┬──────────────┐
│  - id           │             │              │
│  - user_id (FK) │             │              │
│  - address_road │             │              │
│  - contract_type│             │              │
│  - state        │             │              │
└────────┬────────┘             │              │
         │                      │              │
         ├──────────────────────┤              │
         │                      │              │
         ▼                      ▼              ▼
┌─────────────────┐   ┌──────────────────┐   ┌──────────────────┐
│ v2_artifacts    │   │   v2_reports     │   │ v2_credit_txns   │
│  - case_id (FK) │   │  - case_id (FK)  │   │  - case_id (FK)  │
│  - artifact_type│   │  - report_data   │   │  - user_id (FK)  │
│  - file_path    │   │  - risk_score    │   │  - amount        │
└─────────────────┘   └──────────────────┘   └──────────────────┘

┌─────────────────┐
│  v2_audit_logs  │
│  - user_id (FK) │
│  - case_id (FK) │
│  - event_type   │
│  - severity     │
└─────────────────┘
```

---

## 관계 (Foreign Keys)

### 주요 관계

1. **사용자 → 프로필**
   - `v2_profiles.user_id` → `auth.users(id)` (CASCADE DELETE)

2. **사용자 → 대화**
   - `conversations.user_id` → `auth.users(id)` (CASCADE DELETE)
   - `messages.conversation_id` → `conversations(id)` (CASCADE DELETE)

3. **사용자 → 케이스**
   - `v2_cases.user_id` → `auth.users(id)` (CASCADE DELETE)

4. **케이스 → 아티팩트/리포트**
   - `v2_artifacts.case_id` → `v2_cases(id)` (CASCADE DELETE)
   - `v2_reports.case_id` → `v2_cases(id)` (CASCADE DELETE)

5. **크레딧 트랜잭션**
   - `v2_credit_transactions.user_id` → `auth.users(id)` (CASCADE DELETE)
   - `v2_credit_transactions.case_id` → `v2_cases(id)` (SET NULL)

6. **감사 로그**
   - `v2_audit_logs.user_id` → `auth.users(id)` (SET NULL)
   - `v2_audit_logs.case_id` → `v2_cases(id)` (SET NULL)

---

## RLS 정책

### 기본 원칙
- **모든 테이블에서 RLS 활성화**
- **사용자는 본인 데이터만 접근 가능** (`auth.uid() = user_id`)
- **케이스 관련 테이블은 케이스 소유권을 통해 접근 제어**

### 예시

#### `v2_profiles`
```sql
CREATE POLICY "v2_users_can_view_own_profile"
    ON v2_profiles FOR SELECT
    USING (user_id = auth.uid());
```

#### `v2_artifacts` (서브쿼리를 통한 간접 접근)
```sql
CREATE POLICY "Users can view artifacts of their cases"
    ON v2_artifacts FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM v2_cases
        WHERE v2_cases.id = v2_artifacts.case_id
        AND v2_cases.user_id = auth.uid()
    ));
```

#### `recent_conversations` (뷰)
```sql
CREATE VIEW recent_conversations
WITH (security_invoker = true) AS  -- ⚠️ SECURITY INVOKER 필수!
SELECT ...
WHERE c.user_id = auth.uid();
```

---

## 헬퍼 함수

### 1. `get_user_credit_balance(p_user_id UUID)`
사용자 크레딧 잔액 조회

```sql
SELECT get_user_credit_balance('USER_UUID');
-- 반환: INTEGER (현재 잔액)
```

### 2. `deduct_credits(...)`
크레딧 차감 (트랜잭션)

```sql
SELECT deduct_credits(
    p_user_id := 'USER_UUID',
    p_case_id := 'CASE_UUID',
    p_amount := 10,
    p_reason := '등기부등본 자동 발급',
    p_reason_code := 'REGISTRY_ISSUE'
);
-- 반환: BOOLEAN (성공: true, 실패: EXCEPTION)
```

### 3. `refund_credits(...)`
크레딧 환불 (실패 시)

```sql
SELECT refund_credits(
    p_user_id := 'USER_UUID',
    p_case_id := 'CASE_UUID',
    p_amount := 10,
    p_reason := 'RPA 실패로 인한 환불',
    p_reason_code := 'RPA_FAILED'
);
```

### 4. `log_audit(...)`
감사 로그 기록

```sql
SELECT log_audit(
    p_user_id := 'USER_UUID',
    p_case_id := 'CASE_UUID',
    p_event_type := 'pdf_parsed',
    p_event_category := 'parsing',
    p_message := '등기부 PDF 파싱 완료',
    p_severity := 'info',
    p_metadata := '{"parser": "gemini", "confidence": 0.95}'::jsonb
);
-- 반환: UUID (로그 ID)
```

### 5. `delete_expired_cache()`
만료된 캐시 자동 삭제

```sql
SELECT delete_expired_cache();
```

---

## 마이그레이션 실행

### Supabase SQL Editor
1. Supabase Dashboard → SQL Editor
2. 스키마 파일 복사 후 실행:
   - `db/schema_v2.sql` (기본 테이블)
   - `db/migrations/003_chat_analysis_system.sql` (채팅 & 분석 시스템)
   - `db/migrations/004_fix_recent_conversations_security.sql` (보안 수정)

### Supabase CLI
```bash
cd c:/dev/zipcheckv2
supabase db push
```

---

## 보안 체크리스트

- [x] RLS 활성화 (모든 테이블)
- [x] `recent_conversations` 뷰: `SECURITY INVOKER` 모드
- [x] 개인정보 암호화 (`v2_profiles.name`, `v2_cases.address_*`)
- [x] 외래 키 CASCADE DELETE 설정
- [x] 인덱스 최적화 (user_id, created_at)
- [x] 감사 로그 시스템 활성화

---

## 참고 문서

- [Supabase RLS 가이드](https://supabase.com/docs/guides/auth/row-level-security)
- [pgvector 문서](https://github.com/pgvector/pgvector)
- [PostgreSQL SECURITY DEFINER/INVOKER](https://www.postgresql.org/docs/current/sql-createfunction.html)

---

**작성자**: Backend Team
**최종 수정**: 2025-10-29
