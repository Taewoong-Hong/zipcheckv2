# 🔧 Supabase Anon Key 교체 가이드

## 🚨 문제 발견

`.env.local` 파일의 `NEXT_PUBLIC_SUPABASE_ANON_KEY`가 **placeholder**로 되어 있어서 Supabase API 호출이 실패하고 있습니다.

```bash
# 현재 상태 (❌ 잘못됨)
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...placeholder
```

---

## ✅ 해결 방법

### 1️⃣ Supabase Dashboard에서 Anon Key 복사

#### Step 1: Supabase Dashboard 접속
```
https://supabase.com/dashboard
→ 프로젝트 선택: gsiismzchtgdklvdvggu
```

#### Step 2: API Settings 이동
```
좌측 메뉴 → Settings → API
```

#### Step 3: Anon Key 복사
**"Project API keys" 섹션**에서:

```
┌─────────────────────────────────────────────────────┐
│ anon public                                         │
│ eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...            │
│ [Copy] 버튼                                         │
└─────────────────────────────────────────────────────┘
```

**"Copy"** 버튼을 눌러서 전체 키를 복사하세요.

---

### 2️⃣ .env.local 파일 수정

#### 파일 위치
```
C:\dev\zipcheckv2\apps\web\.env.local
```

#### 수정 내용
```bash
# Before (❌)
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdzaWlzbXpjaHRnZGtsdmR2Z2d1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzc1MTQzNjAsImV4cCI6MjA1MzA5MDM2MH0.placeholder

# After (✅)
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdzaWlzbXpjaHRnZGtsdmR2Z2d1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzc1MTQzNjAsImV4cCI6MjA1MzA5MDM2MH0.REAL_SIGNATURE_HERE
```

> ⚠️ **중요**: JWT 토큰의 마지막 부분(Signature)이 `.placeholder`가 아닌 **실제 서명값**이어야 합니다!

---

### 3️⃣ Next.js 서버 재시작

환경변수 변경은 서버 재시작이 필요합니다!

```bash
# 터미널에서 Ctrl+C로 서버 종료

# 다시 시작
cd C:\dev\zipcheckv2\apps\web
npm run dev
```

---

## 🧪 테스트

### 1️⃣ 서버 재시작 후
```
http://localhost:3000/zc-ops-nx7k2
```

### 2️⃣ "로그인" 버튼 클릭
✅ **예상 동작**: Google 로그인 페이지로 리디렉션

❌ **이전 문제**: 버튼 클릭 시 아무 반응 없음

---

## 🔍 Anon Key 형식 확인

올바른 Anon Key는 다음 형식입니다:

```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.
eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdzaWlzbXpjaHRnZGtsdmR2Z2d1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzc1MTQzNjAsImV4cCI6MjA1MzA5MDM2MH0.
REAL_SIGNATURE_HERE_NOT_PLACEHOLDER
     ↑↑↑ 이 부분이 중요!
```

JWT는 3개 부분으로 구성:
1. **Header**: `eyJhbGciOi...`
2. **Payload**: `eyJpc3MiOi...`
3. **Signature**: `REAL_SIGNATURE` ← 이게 `.placeholder`면 안 됨!

---

## 📝 참고: Service Role Key는?

**Service Role Key는 절대 프론트엔드에 노출하면 안 됩니다!**

```bash
# ✅ 프론트엔드 (.env.local)
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...real_signature

# ❌ 프론트엔드에 넣으면 안 됨!
# SUPABASE_SERVICE_ROLE_KEY=eyJ...  ← 백엔드 전용!
```

---

## ✅ 체크리스트

- [ ] Supabase Dashboard → Settings → API 접속
- [ ] "anon public" 키 복사
- [ ] `.env.local` 파일에서 ANON_KEY 교체
- [ ] 마지막 부분이 `.placeholder`가 아닌지 확인
- [ ] Next.js 서버 재시작 (Ctrl+C → npm run dev)
- [ ] http://localhost:3000/zc-ops-nx7k2 접속
- [ ] "로그인" 버튼 클릭 → Google 로그인 페이지로 이동 확인

---

**작성일**: 2025-01-24
**문제**: 로그인 버튼 클릭 시 아무 반응 없음
**원인**: ANON_KEY가 placeholder로 설정됨
**해결**: Supabase Dashboard에서 실제 Anon Key 복사 후 교체
