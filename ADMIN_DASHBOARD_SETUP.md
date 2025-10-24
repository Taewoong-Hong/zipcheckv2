# 관리자 대시보드 설정 가이드

집체크 관리자 대시보드는 GA4 Data API를 통해 실시간 운영 지표를 모니터링할 수 있습니다.

---

## 📋 구성 요소

### 페이지 및 컴포넌트
- **관리자 페이지**: `app/zc-ops-nx7k2/page.tsx` (보안상 예측 불가능한 경로)
- **KPI 카드**: `components/admin/KPICards.tsx`
- **전환 퍼널**: `components/admin/FunnelChart.tsx`
- **유입 채널**: `components/admin/ChannelChart.tsx`

### API 라우트
- **GA4 데이터 조회**: `app/api/admin/ga/overview/route.ts`
- **관리자 권한 검증**: `lib/admin-auth.ts`

---

## 🔧 설정 단계

### 1단계: Google Cloud 프로젝트 설정

#### 1-1. GA4 Data API 활성화
1. [Google Cloud Console](https://console.cloud.google.com) 접속
2. 프로젝트 선택 또는 새 프로젝트 생성
3. **API 및 서비스 → 라이브러리** 이동
4. "Google Analytics Data API" 검색 및 **사용 설정** 클릭

#### 1-2. 서비스 계정 생성
1. **API 및 서비스 → 사용자 인증 정보** 이동
2. **사용자 인증 정보 만들기 → 서비스 계정** 클릭
3. 서비스 계정 이름 입력 (예: `zipcheck-ga4-reader`)
4. 역할 선택: **없음** (GA4에서 직접 권한 부여)
5. **완료** 클릭

#### 1-3. 서비스 계정 키 생성
1. 생성한 서비스 계정 클릭
2. **키 탭 → 키 추가 → 새 키 만들기** 클릭
3. 키 유형: **JSON** 선택
4. **생성** 클릭 → JSON 파일 다운로드 (안전하게 보관!)

---

### 2단계: GA4 설정

#### 2-1. Property ID 확인
1. [Google Analytics](https://analytics.google.com) 접속
2. **관리 → 속성 설정** 이동
3. **속성 ID** 확인 (숫자 형태, 예: `123456789`)
   - ⚠️ **Measurement ID (G-XXXXXX)와 다름!**

#### 2-2. 서비스 계정에 권한 부여
1. **관리 → 속성 액세스 관리** 이동
2. **+ 사용자 추가** 클릭
3. 서비스 계정 이메일 입력 (예: `zipcheck-ga4-reader@project-id.iam.gserviceaccount.com`)
4. 역할 선택: **뷰어** (Viewer)
5. **추가** 클릭

---

### 3단계: 환경변수 설정

#### 3-1. `.env.local` 파일 업데이트
```bash
# GA4 Data API (서비스 계정)
GA4_PROPERTY_ID=123456789
GA_SERVICE_ACCOUNT_KEY_JSON={"type":"service_account","project_id":"your-project","private_key_id":"...","private_key":"-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n","client_email":"zipcheck-ga4-reader@your-project.iam.gserviceaccount.com","client_id":"...","auth_uri":"https://accounts.google.com/o/oauth2/auth","token_uri":"https://oauth2.googleapis.com/token","auth_provider_x509_cert_url":"https://www.googleapis.com/oauth2/v1/certs","client_x509_cert_url":"..."}

# Supabase Service Role Key (관리자 권한 검증용)
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key_here
```

#### 3-2. JSON 키 파일 변환 (한 줄로)
```bash
# Linux/Mac
cat service-account-key.json | jq -c . | pbcopy

# Windows (PowerShell)
Get-Content service-account-key.json -Raw | ConvertFrom-Json | ConvertTo-Json -Compress | Set-Clipboard
```

---

### 4단계: Supabase 데이터베이스 설정

#### 4-1. users 테이블에 role 컬럼 추가 (없는 경우)
```sql
-- Supabase SQL Editor에서 실행
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin'));

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);

-- 특정 사용자에게 admin 권한 부여
UPDATE public.users
SET role = 'admin'
WHERE email = 'your-admin-email@example.com';
```

#### 4-2. RLS 정책 업데이트 (선택사항)
```sql
-- 관리자는 모든 데이터 조회 가능
CREATE POLICY "Admins can read all"
ON public.users
FOR SELECT
USING (
  auth.uid() IN (
    SELECT id FROM public.users WHERE role = 'admin'
  )
);
```

---

### 5단계: 패키지 설치 및 빌드

```bash
cd apps/web

# 패키지 설치
npm install

# 개발 서버 실행
npm run dev
```

---

## 🚀 접속 및 테스트

### 1. 관리자 계정으로 로그인
1. http://localhost:3000 접속
2. Google OAuth로 로그인
3. Supabase users 테이블에서 `role = 'admin'` 확인

### 2. 관리자 대시보드 접속
- URL: http://localhost:3000/zc-ops-nx7k2
- 권한 확인 후 대시보드 표시

### 3. 테스트 항목
- ✅ KPI 카드 로딩 (Active Users, New Users 등)
- ✅ 전환 퍼널 차트 표시
- ✅ 유입 채널 TOP 10 차트 표시
- ✅ 5분 캐싱 동작 확인

---

## 📊 대시보드 위젯 설명

### KPI 카드 (6개)
1. **활성 사용자**: 최근 7일 간 앱/웹을 사용한 고유 사용자 수
2. **신규 사용자**: 처음 방문한 사용자 수
3. **세션 수**: 총 방문 세션 수
4. **이벤트 발생**: 전체 이벤트 발생 횟수
5. **참여율**: (세션 중 참여한 비율)
6. **평균 세션**: 세션당 평균 체류 시간

### 주요 이벤트 (6개)
1. `start_zipcheck`: 집체크 시작
2. `address_submitted`: 주소 제출
3. `pdf_uploaded`: PDF 업로드
4. `report_viewed`: 리포트 조회
5. `signup_completed`: 회원가입 완료
6. `plan_payment_success`: 결제 완료

### 전환 퍼널
- 사용자 여정 단계별 전환율 및 이탈률 시각화
- 각 단계별 상세 정보 카드 제공

### 유입 채널 TOP 10
- 세션 소스별 활성 사용자 및 세션 수
- 채널별 세션/사용자 비율 계산

---

## 🔒 보안 고려사항

### 1. 관리자 권한 보호
- ✅ Supabase Auth 세션 검증
- ✅ users 테이블 `role = 'admin'` 검증
- ✅ 예측 불가능한 URL (`/zc-ops-nx7k2`)

### 2. API 보호
- ✅ 서버 전용 API 라우트 (`app/api/admin/**`)
- ✅ 클라이언트에서 직접 GA API 호출 금지
- ✅ 서비스 계정 키는 환경변수로만 관리

### 3. 캐싱 전략
- ✅ 메모리 캐시 (5분 TTL)
- ✅ GA4 API 쿼터 절약
- ✅ 응답 속도 개선

---

## 🛠️ 트러블슈팅

### 문제 1: "GA4_PROPERTY_ID 환경변수가 설정되지 않았습니다"
**해결**: `.env.local` 파일에 `GA4_PROPERTY_ID` 추가 후 서버 재시작

### 문제 2: "서비스 계정 키 JSON 파싱 실패"
**해결**: JSON 키를 한 줄로 변환했는지 확인, 줄바꿈 문자 제거

### 문제 3: "Unauthorized" 또는 "관리자 권한이 없습니다"
**해결**: Supabase users 테이블에서 해당 사용자의 `role` 컬럼이 `'admin'`인지 확인

### 문제 4: "GA4 Data API 호출 실패"
**해결**:
1. GA4 Data API가 활성화되었는지 확인
2. 서비스 계정이 GA4 속성에 뷰어 권한이 있는지 확인
3. Property ID가 숫자 형태인지 확인 (G-XXXX가 아님!)

### 문제 5: 데이터가 표시되지 않음
**해결**:
1. GA4에 실제 데이터가 수집되고 있는지 확인
2. 날짜 범위 (`7daysAgo ~ today`) 확인
3. 브라우저 콘솔에서 API 응답 확인

---

## 📈 다음 단계 (추가 기능)

### Step 2: BigQuery Export 연동
```typescript
// BigQuery로 심층 분석
import { BigQuery } from '@google-cloud/bigquery';

const bigquery = new BigQuery({
  projectId: 'your-project',
  credentials: JSON.parse(process.env.GCP_SERVICE_ACCOUNT_KEY_JSON),
});

const query = `
  SELECT
    event_name,
    COUNT(*) as event_count,
    COUNT(DISTINCT user_pseudo_id) as unique_users
  FROM \`your-project.analytics_XXXXX.events_*\`
  WHERE _TABLE_SUFFIX BETWEEN FORMAT_DATE('%Y%m%d', DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY))
    AND FORMAT_DATE('%Y%m%d', CURRENT_DATE())
  GROUP BY event_name
  ORDER BY event_count DESC
  LIMIT 20
`;

const [rows] = await bigquery.query(query);
```

### 추가 위젯 아이디어
- 📅 일별/주별 트렌드 차트
- 🌍 지역별 사용자 분포 지도
- 📱 디바이스/브라우저 점유율
- ⚠️ 에러율 모니터링 및 알림
- 💰 결제 전환율 및 LTV 분석
- 📧 이메일 캠페인 성과 추적

---

## 📚 참고 자료

- [GA4 Data API 문서](https://developers.google.com/analytics/devguides/reporting/data/v1)
- [GA4 Event Reference](https://support.google.com/analytics/answer/9267735)
- [Supabase RLS 문서](https://supabase.com/docs/guides/auth/row-level-security)
- [Recharts 문서](https://recharts.org/)

---

**작성일**: 2025-01-24
**버전**: 1.0.0
