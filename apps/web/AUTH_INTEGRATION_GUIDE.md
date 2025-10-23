# 🔐 소셜 로그인 백엔드 연동 가이드

프론트엔드 담당자가 완료한 UI/UX 작업과 백엔드 담당자가 연결해야 할 부분을 정리한 문서입니다.

## ✅ 완료된 프론트엔드 작업

### 1. 생성된 컴포넌트
- `components/auth/SocialLoginButton.tsx` - 소셜 로그인 버튼 (카카오, 구글, 네이버)
- `components/auth/LoginModal.tsx` - 로그인 모달 팝업
- `components/sidebar/UserProfileNew.tsx` - 로그인 상태에 따른 사용자 프로필
- `app/login/page.tsx` - 독립적인 로그인 페이지

### 2. 브랜드 컬러 적용
- **Primary**: #E91E63 (핑크)
- **Secondary**: #D32F2F (진한 빨강)
- **Light**: #FF5252 (밝은 빨강)
- 그라데이션과 애니메이션 효과 적용

### 3. 접근성 (WCAG 2.1 AA)
- 키보드 네비게이션 (Tab, ESC 키)
- ARIA 속성 (role, aria-label, aria-modal 등)
- 포커스 관리 및 스크린 리더 지원

### 4. 반응형 디자인
- 모바일, 태블릿, 데스크톱 최적화
- 터치 제스처 및 호버 효과
- 적응형 레이아웃

---

## 🔧 백엔드 담당자가 연결해야 할 부분

### 1. NextAuth.js 설정

#### 1.1 API Route 생성
**경로**: `apps/web/app/api/auth/[...nextauth]/route.ts`

```typescript
import NextAuth from "next-auth";
import KakaoProvider from "next-auth/providers/kakao";
import GoogleProvider from "next-auth/providers/google";
import NaverProvider from "next-auth/providers/naver";

const handler = NextAuth({
  providers: [
    KakaoProvider({
      clientId: process.env.KAKAO_CLIENT_ID!,
      clientSecret: process.env.KAKAO_CLIENT_SECRET!,
    }),
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    NaverProvider({
      clientId: process.env.NAVER_CLIENT_ID!,
      clientSecret: process.env.NAVER_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      // 사용자 정보를 Supabase에 저장하는 로직 추가
      return true;
    },
    async session({ session, token }) {
      // 세션에 추가 정보 포함
      return session;
    },
    async jwt({ token, user, account }) {
      // JWT 토큰에 추가 정보 포함
      return token;
    },
  },
  pages: {
    signIn: "/login", // 커스텀 로그인 페이지
  },
  session: {
    strategy: "jwt",
  },
});

export { handler as GET, handler as POST };
```

#### 1.2 환경 변수 설정
**파일**: `apps/web/.env.local`

```bash
# NextAuth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-secret-key-here

# Kakao OAuth
KAKAO_CLIENT_ID=your-kakao-client-id
KAKAO_CLIENT_SECRET=your-kakao-client-secret

# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# Naver OAuth
NAVER_CLIENT_ID=your-naver-client-id
NAVER_CLIENT_SECRET=your-naver-client-secret

# Supabase (사용자 정보 저장용)
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
```

---

### 2. OAuth 앱 등록 가이드

#### 2.1 카카오 개발자 센터
1. https://developers.kakao.com/ 접속
2. 애플리케이션 추가
3. **Redirect URI**: `http://localhost:3000/api/auth/callback/kakao`
4. **활성화 설정**: 카카오 로그인
5. Client ID와 Secret 복사

#### 2.2 구글 클라우드 콘솔
1. https://console.cloud.google.com/ 접속
2. OAuth 2.0 클라이언트 ID 생성
3. **승인된 리디렉션 URI**: `http://localhost:3000/api/auth/callback/google`
4. Client ID와 Secret 복사

#### 2.3 네이버 개발자 센터
1. https://developers.naver.com/ 접속
2. 애플리케이션 등록
3. **Callback URL**: `http://localhost:3000/api/auth/callback/naver`
4. **사용 API**: 네이버 로그인
5. Client ID와 Secret 복사

---

### 3. SessionProvider 래핑

**파일**: `apps/web/app/layout.tsx`

```typescript
import type { Metadata } from "next";
import "./globals.css";
import { Inter } from "next/font/google";
import { SessionProvider } from "next-auth/react"; // 추가

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "집체크(ZipCheck) - 부동산 계약 리스크 AI 분석",
  description: "AI를 활용한 부동산 계약서 분석 서비스",
  icons: {
    icon: "/logo.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body className={inter.className}>
        {/* SessionProvider로 래핑 */}
        <SessionProvider>
          {children}
        </SessionProvider>
      </body>
    </html>
  );
}
```

---

### 4. 프론트엔드 컴포넌트 연결

#### 4.1 로그인 버튼 연결
**파일**: `components/auth/SocialLoginButton.tsx` (TODO 주석 찾기)

```typescript
import { signIn } from "next-auth/react";

const handleSocialLogin = (provider: "kakao" | "google" | "naver") => {
  signIn(provider, { callbackUrl: "/" });
};
```

#### 4.2 로그아웃 버튼 연결
**파일**: `components/sidebar/UserProfileNew.tsx` (TODO 주석 찾기)

```typescript
import { signOut } from "next-auth/react";

const handleLogout = () => {
  signOut({ callbackUrl: "/" });
};
```

#### 4.3 세션 상태 확인
**파일**: `components/sidebar/UserProfileNew.tsx` (TODO 주석 찾기)

```typescript
import { useSession } from "next-auth/react";

const { data: session, status } = useSession();
const isLoggedIn = status === "authenticated";

// Mock user data 대신 실제 세션 데이터 사용
const user = {
  name: session?.user?.name || "사용자",
  email: session?.user?.email || "",
  image: session?.user?.image || null,
  plan: "무료", // 추후 데이터베이스에서 가져오기
};
```

---

### 5. 사용자 정보 데이터베이스 저장

#### 5.1 Supabase 테이블 생성
```sql
-- users 테이블
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  image TEXT,
  provider TEXT, -- "kakao", "google", "naver"
  provider_id TEXT,
  plan TEXT DEFAULT '무료',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 인덱스 생성
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_provider ON users(provider, provider_id);
```

#### 5.2 signIn 콜백에서 사용자 저장
```typescript
async signIn({ user, account, profile }) {
  if (!user.email) return false;

  // Supabase에 사용자 정보 저장 또는 업데이트
  const { error } = await supabase
    .from("users")
    .upsert({
      email: user.email,
      name: user.name,
      image: user.image,
      provider: account?.provider,
      provider_id: account?.providerAccountId,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: "email"
    });

  return !error;
}
```

---

### 6. 프로덕션 배포 시 주의사항

#### 6.1 환경 변수 업데이트
- `NEXTAUTH_URL`을 프로덕션 도메인으로 변경
- `NEXTAUTH_SECRET`을 강력한 랜덤 문자열로 생성 (openssl rand -base64 32)

#### 6.2 OAuth 앱 설정 업데이트
- 각 플랫폼의 Redirect URI를 프로덕션 도메인으로 추가
- 예: `https://zipcheck.com/api/auth/callback/kakao`

#### 6.3 HTTPS 적용
- 프로덕션 환경에서는 반드시 HTTPS 사용
- OAuth 콜백은 HTTPS만 지원

---

## 📋 테스트 체크리스트

### 로그인 플로우
- [ ] 카카오 로그인 버튼 클릭 → 카카오 인증 → 리디렉션 → 세션 생성
- [ ] 구글 로그인 버튼 클릭 → 구글 인증 → 리디렉션 → 세션 생성
- [ ] 네이버 로그인 버튼 클릭 → 네이버 인증 → 리디렉션 → 세션 생성

### 세션 관리
- [ ] 로그인 후 사용자 정보 표시
- [ ] 새로고침 시 세션 유지
- [ ] 로그아웃 시 세션 삭제
- [ ] 세션 만료 시 자동 로그아웃

### UI/UX
- [ ] 모달 ESC 키로 닫기
- [ ] 로그인 상태에 따른 UI 변경
- [ ] 프로필 드롭다운 메뉴 동작
- [ ] 모바일/태블릿 반응형 확인

### 데이터베이스
- [ ] 신규 사용자 정보 저장
- [ ] 기존 사용자 정보 업데이트
- [ ] 중복 이메일 처리

---

## 🆘 문제 해결

### 자주 발생하는 오류

#### 1. "signIn is not defined"
→ `next-auth/react`에서 import 누락

#### 2. "callback URL is not configured"
→ OAuth 앱 설정에서 Redirect URI 확인

#### 3. "NEXTAUTH_SECRET is not defined"
→ `.env.local` 파일에 환경 변수 추가

#### 4. "Session is null"
→ SessionProvider 래핑 확인

---

## 📞 연락처

프론트엔드 작업 완료, 백엔드 연동은 백엔드 담당자에게 전달하세요.

**프론트엔드 담당**: UI/UX 구현 완료
**백엔드 담당**: NextAuth.js 설정 및 데이터베이스 연동 필요

---

## 📚 참고 자료

- [NextAuth.js 공식 문서](https://next-auth.js.org/)
- [카카오 로그인 가이드](https://developers.kakao.com/docs/latest/ko/kakaologin/rest-api)
- [구글 OAuth 가이드](https://developers.google.com/identity/protocols/oauth2)
- [네이버 로그인 가이드](https://developers.naver.com/docs/login/overview/)
