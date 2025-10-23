# 🟡 카카오 로그인 설정 (간단 버전)

## ✅ 현재 상태
- ✅ 카카오 로그인 코드 구현 완료
- ✅ Supabase 프로젝트: `gsiismzchtgdklvdvggu`
- ✅ 카카오 Callback URL: `https://gsiismzchtgdklvdvggu.supabase.co/auth/v1/callback`

---

## 🔧 1단계: Supabase Dashboard 설정 (5분)

1. **https://supabase.com/dashboard** 접속
2. 프로젝트 선택: **gsiismzchtgdklvdvggu**
3. **Authentication → Providers → Kakao**
4. **Enable** 토글 **ON**
5. 입력:
   - **Client ID**: `81cb1a70b8fe82ca515f645ff77a07d1`
   - **Client Secret**: `B1KNHzoeVAiamo3k8smYfcs2yqMAtpGh`
6. **Save** 클릭

> 📝 저장하면 자동으로 Callback URL이 표시됩니다: `https://tlytjitkokavfhwzedml.supabase.co/auth/v1/callback`

---

## 🔧 2단계: Kakao Developers 설정 (5분)

1. **https://developers.kakao.com/console/app** 접속
2. 앱 선택 (앱 키: `81cb1a70b8fe82ca515f645ff77a07d1`)
3. **제품 설정 → 카카오 로그인 → Redirect URI** 클릭
4. **등록** 버튼 클릭 후 추가:
   ```
   https://gsiismzchtgdklvdvggu.supabase.co/auth/v1/callback
   http://localhost:3001/auth/callback
   ```
5. **카카오 로그인** 활성화 상태 **ON** 확인
6. **동의항목** 설정:
   - ✅ 닉네임 (필수 동의)
   - ✅ 카카오계정(이메일) (필수 동의) ← **중요!**
   - ✅ 프로필 사진 (선택 동의)
7. **저장**

---

## 🧪 테스트

1. 브라우저: **http://localhost:3001**
2. 로그인 모달 열기
3. **"카카오로 계속하기"** 클릭
4. 카카오 로그인 → 동의 → 완료!

---

## 🚨 주의사항

### 개발 중인 앱의 경우
카카오 앱이 **개발 중** 상태이면 **팀원으로 등록된 카카오 계정**만 로그인 가능합니다.

**팀원 추가 방법**:
1. Kakao Developers → **팀 관리**
2. **팀원 초대** → 카카오계정 이메일 입력
3. 초대 수락 후 테스트 가능

### 프로덕션 배포 시
1. **비즈니스 채널 생성** 필요
2. **검수 신청** 후 승인 필요
3. 승인 후 모든 사용자 로그인 가능

---

## ✅ 완료!

설정 완료 후 3가지 소셜 로그인 모두 사용 가능:
- ✅ Google (Supabase)
- ✅ Kakao (Supabase)
- ✅ Naver (커스텀)
