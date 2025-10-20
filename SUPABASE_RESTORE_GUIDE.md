# Supabase 프로젝트 복원 가이드

## 📋 복원 시 변경되는 항목

### ✅ 변경되지 않는 항목 (보존됨)
- **API Keys** (anon key, service_role key) - 그대로 유지
- **Database password** - 그대로 유지
- **모든 데이터** (테이블, 데이터, RLS 정책)
- **Functions, Triggers, Extensions**
- **Storage 파일들**
- **Auth 설정 및 사용자**

### ⚠️ 변경될 수 있는 항목
- **프로젝트 URL/도메인** (확률 낮지만 가능)
- **Database host** (pooler 주소가 변경될 수 있음)
- **Connection pooler 설정**

## 🔧 복원 절차

### 1. Dashboard 접속
```
https://supabase.com/dashboard/projects
```

### 2. 프로젝트 상태 확인
- **Paused** 또는 **Inactive** 상태 확인
- 프로젝트 카드에 "Restore" 버튼 표시됨

### 3. 프로젝트 복원
1. 프로젝트 클릭 또는 "Restore" 버튼 클릭
2. 복원 확인 대화상자에서 "Restore project" 클릭
3. 2-3분 대기 (진행 상황 표시됨)
4. 복원 완료 시 "Active" 상태로 변경

### 4. 연결 정보 재확인

복원 후 다음 정보들을 확인하고 업데이트해야 합니다:

#### A. Project Settings → API
```
NEXT_PUBLIC_SUPABASE_URL=https://[PROJECT_REF].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
```
👉 **API 키는 대부분 변경되지 않음**

#### B. Project Settings → Database → Connection String
```
DATABASE_URL=postgresql://postgres.[PROJECT_REF]:[PASSWORD]@[HOST]:6543/postgres
```
👉 **HOST 주소는 변경될 수 있음** (중요!)

#### C. Connection Pooler 설정
- Transaction mode (Port 6543) - 권장
- Session mode (Port 5432)
- Direct connection

## 📝 복원 후 체크리스트

### 필수 확인 사항
- [ ] 프로젝트 URL 동일한지 확인
- [ ] DATABASE_URL의 HOST 주소 확인
- [ ] API keys 동일한지 확인 (99% 동일)
- [ ] Database password 동일한지 확인

### 업데이트 필요한 파일들
1. **루트 디렉토리**
   - `.env.local` - Next.js 환경변수

2. **AI 서비스**
   - `services/ai/.env` - Python 환경변수

3. **테스트 필요**
   - Database 연결 테스트
   - API 연결 테스트
   - Auth 작동 테스트

## 🔍 연결 정보 찾는 방법

### Database Connection String
```
Dashboard → Project Settings → Database → Connection String → URI
```

복사 예시:
```
postgresql://postgres.abc123xyz:[YOUR-PASSWORD]@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres
```

### API Keys
```
Dashboard → Project Settings → API → Project API keys
```

## ⚡ 빠른 복원 체크 스크립트

복원 후 이 명령어로 연결 테스트:

```bash
cd services/ai
.\venv\Scripts\python test_psycopg3.py
```

성공 시 출력:
```
[OK] psycopg3 connection successful
[OK] Database: postgres, User: postgres
[OK] pgvector: True
[OK] v2 tables: 5
```

## 🛡️ 향후 일시 중지 방지 방법

### 방법 1: 정기적 접속
- 7일에 한 번 이상 Dashboard 접속
- 또는 API 호출 (cron job 설정)

### 방법 2: Uptime 모니터링 서비스
- UptimeRobot (무료)
- Pingdom
- 5분마다 health check API 호출

### 방법 3: Pro 플랜 업그레이드
- $25/월
- 일시 중지 없음
- 더 높은 성능 및 용량

## 📞 문제 발생 시

### 복원 실패
1. Supabase Support에 문의
2. Dashboard에서 "Help" 버튼 클릭
3. 또는 https://supabase.com/support

### 데이터 손실
- 일시 중지 상태에서는 데이터가 손실되지 않음
- 백업은 Pro 플랜부터 자동 제공
- 중요 데이터는 정기적으로 export 권장

---

**작성일**: 2025-10-17
**대상**: ZipCheck v2 프로젝트
