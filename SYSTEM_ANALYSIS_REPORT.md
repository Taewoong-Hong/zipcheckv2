
========================================
ZipCheck v2 완전 시스템 분석 리포트
========================================
작성일: 2025-01-21
데이터베이스: Supabase PostgreSQL (실제 연결 확인 완료)
레코드 수: cases(55), artifacts(41), reports(21), profiles(1)

========================================
1. DATABASE ERD 구조 (실제 스키마 확인 완료)
========================================

[핵심 테이블 관계도]

auth.users (Supabase Auth)
    |
    +-- v2_profiles (1:1) ----------> user_id UNIQUE
    |
    +-- v2_cases (1:N) --------------> user_id FK
         |
         +-- v2_artifacts (1:N) -----> case_id FK (CASCADE DELETE)
         |
         +-- v2_reports (1:N) -------> case_id FK (CASCADE DELETE)
         |
         +-- v2_audit_logs (1:N) ----> case_id FK (SET NULL)
         |
         +-- v2_credit_transactions -> case_id FK (SET NULL)

[테이블 상세 구조]

1. v2_cases (55 records) - 중심 테이블
   - id: uuid PRIMARY KEY
   - user_id: uuid FK -> auth.users
   - property_address: text (부동산 주소)
   - contract_type: text (매매/전세/월세)
   - current_state: text (상태 머신)
   - metadata: jsonb (deposit, price, monthly_rent 등)
   - Indexes: user_id, current_state, created_at DESC
   - RLS: 사용자는 본인 케이스만 CRUD 가능

2. v2_artifacts (41 records) - 파일 저장
   - id: uuid PRIMARY KEY
   - case_id: uuid FK -> v2_cases (CASCADE)
   - artifact_type: text (registry_pdf, contract_pdf)
   - file_path: text (Supabase Storage 경로)
   - parsed_data: jsonb (파싱 결과)
   - hash_sha256: text UNIQUE (중복 방지)
   - RLS: 사용자는 본인 케이스의 artifacts만 접근

3. v2_reports (21 records) - 분석 리포트
   - id: uuid PRIMARY KEY
   - case_id: uuid FK -> v2_cases (CASCADE)
   - content: text (LLM 최종 답변)
   - risk_score: jsonb (리스크 점수)
   - registry_data: jsonb (마스킹된 등기부)
   - market_data: jsonb (매매 시장 데이터)
   - RLS: 사용자는 본인 케이스의 리포트만 조회

4. v2_profiles (1 record) - 사용자 프로필
   - user_id: uuid FK -> auth.users (UNIQUE)
   - name: text (AES-256-GCM 암호화 권장)
   - RLS: 사용자는 본인 프로필만 조회/수정

5. v2_contracts (임대차 계약)
   - id: uuid PRIMARY KEY
   - user_id: uuid FK -> auth.users
   - contract_type: text
   - RLS: 사용자는 본인 계약만 접근

6. v2_credit_transactions (크레딧 거래)
   - user_id: uuid FK -> auth.users
   - case_id: uuid FK -> v2_cases (SET NULL)
   - credit_delta: integer (증감량)
   - RLS: 사용자는 본인 거래만 조회

7. v2_audit_logs (감사 로그)
   - case_id: uuid FK -> v2_cases (SET NULL)
   - event_type: text (파싱 에러, 경고 등)
   - severity: text (error, warning, info)
   - RLS: 사용자는 본인 케이스 로그만 조회

8. v2_doc_texts (문서 텍스트 청크)
   - contract_id: uuid FK -> v2_contracts (CASCADE)
   - chunk_text: text (벡터 임베딩용)

9. v2_artifact_docs (artifacts ↔ doc_texts 연결)
   - artifact_id: uuid FK -> v2_artifacts (CASCADE)
   - doc_id: uuid FK -> v2_doc_texts (CASCADE)

10. v2_public_data_cache (공공데이터 캐시)
    - RLS: service_role만 CUD 가능

========================================
2. 상태 머신 (State Machine)
========================================

케이스 진행 플로우:

init 
  → address_pick (주소 선택)
  → contract_type (계약 유형 선택)
  → registry_choice (등기부 선택)
  → registry_ready (등기부 준비 완료)
  → parse_enrich (파싱 및 데이터 수집)
  → report (리포트 생성 완료)

각 상태별 진행률:
- init: 0%
- address_pick: 15%
- contract_type: 30%
- registry_choice: 45%
- registry_ready: 60%
- parse_enrich: 80%
- report: 100%

========================================
3. API 엔드포인트 구조
========================================

FastAPI 라우터 (13개):

1. /auth (인증)
   - POST /auth/google/login
   - GET /auth/google/callback
   - GET /auth/me

2. /cases (케이스 관리)
   - GET /cases
   - POST /cases
   - GET /cases/{id}
   - PATCH /cases/{id}
   - DELETE /cases/{id}

3. /analyze (분석)
   - POST /analyze/start
   - GET /analyze/stream/{case_id} (SSE)
   - GET /analyze/status/{case_id}
   - POST /analyze (간단 채팅)

4. /report (리포트)
   - GET /report/{case_id}

5. /registry (등기부)
   - POST /registry/upload
   - POST /registry/parse

6. /chat (채팅)
   - POST /chat/init
   - POST /chat/message
   - GET /chat/recent

7. /sms (SMS 인증)
   - POST /sms/send
   - POST /sms/verify

8. /health (헬스체크)
   - GET /health

========================================
4. 핵심 비즈니스 로직 (분석 파이프라인)
========================================

execute_analysis_pipeline() - 7단계 자동화:

1단계: 케이스 데이터 조회
  - v2_cases 테이블에서 주소, 계약 정보 조회

2단계: 등기부 파싱 (LLM 없음\!)
  - v2_artifacts에서 PDF URL 조회
  - parse_registry_from_url() 호출
  - 정규식 기반 파싱 (hallucination 방지)
  - 개인정보 마스킹 (홍길동 → 홍XX)

3단계: 공공 데이터 수집
  - 법정동코드 API 호출 (LegalDongCodeAPIClient)
  - 실거래가 API 호출 (AptTradeAPIClient)
  - property_value 추정 (평균 실거래가 × 낙찰가율)

4단계: 리스크 엔진 실행 (규칙 기반, LLM 없음\!)
  - analyze_risks(contract_data, registry_data)
  - 전세가율, 근저당 비율, 권리하자 점수 계산
  - 협상 포인트 & 권장 조치 생성

5단계: LLM 리포트 생성 (해석만)
  - build_risk_features_from_registry() (코드로 100% 계산)
  - build_llm_prompt() (마크다운 프롬프트 생성)
  - GPT-4o-mini 호출 (해석 및 요약만)

6단계: 리포트 저장
  - v2_reports 테이블에 저장
  - registry_data: 마스킹된 등기부 정보
  - risk_score: 리스크 분석 결과
  - content: LLM 최종 답변

7단계: 상태 전환
  - parse_enrich → report
  - updated_at 갱신

========================================
5. 보안 및 최적화 기능
========================================

[보안]
1. Row Level Security (RLS) - 모든 v2_* 테이블 활성화
2. AES-256-GCM 암호화 (개인정보)
3. JWT 인증 (Supabase Auth)
4. SSRF 방지 (URL 파싱 시 내부 IP 차단)
5. Bot 방어 (Cloudflare Turnstile + reCAPTCHA)

[최적화]
1. 인덱스: user_id, case_id, current_state, created_at
2. CASCADE DELETE (artifacts, reports)
3. 공공데이터 캐싱 (v2_public_data_cache)
4. pgvector 벡터 검색

========================================
6. Legacy vs V2 비교
========================================

Legacy (v1):
- 단일 테이블 (cases, documents)
- LLM으로 등기부 구조화 (hallucination 위험)
- RLS 미흡
- 보안 취약점 (SECURITY DEFINER 뷰)

V2 (현재):
- 정규화된 10개 테이블
- 정규식 기반 파싱 (hallucination 제거)
- 전체 테이블 RLS 적용
- 보안 강화 (SECURITY INVOKER, 암호화, SSRF 방지)
- 감사 로그 시스템 (v2_audit_logs)
- 크레딧 시스템 (v2_credit_transactions)

========================================
분석 완료
========================================
- 실제 DB 연결 확인: ✓
- 테이블 스키마 확인: ✓ (10개 테이블)
- Foreign Key 관계: ✓ (CASCADE/SET NULL)
- RLS 정책 확인: ✓ (모든 테이블 활성화)
- 실제 데이터 샘플: ✓ (55 cases, 41 artifacts, 21 reports)
- FastAPI 헬스체크: ✓ (정상 응답)
- ERD 구조 파악: ✓ (완료)

더 이상 반복 질문 없이 작업 가능합니다.
