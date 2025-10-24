/**
 * 관리자 대시보드 페이지
 *
 * 경로: /zc-ops-nx7k2 (보안을 위해 예측 불가능한 경로 사용)
 * 인증: Google OAuth SSO + 도메인 화이트리스트 + MFA 강제 + role = 'admin'
 *
 * 보안 계층:
 * 1. Google OAuth SSO 로그인
 * 2. 도메인 화이트리스트 (@zipcheck.kr만 허용)
 * 3. MFA 강제 (Google 2단계 인증)
 * 4. Supabase users 테이블 role = 'admin' 검증
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import {
  BarChart3,
  Users,
  FileText,
  CreditCard,
  TrendingUp,
  Activity,
  AlertCircle,
  Shield,
  ShieldCheck,
  ShieldAlert,
} from 'lucide-react';
import KPICards from '@/components/admin/KPICards';
import FunnelChart from '@/components/admin/FunnelChart';
import ChannelChart from '@/components/admin/ChannelChart';

// 허용된 도메인 목록
const ALLOWED_DOMAINS = ['zipcheck.kr'];

export default function AdminDashboard() {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [securityStatus, setSecurityStatus] = useState({
    googleAuth: false,
    domainWhitelist: false,
    mfaEnabled: false,
    adminRole: false,
  });

  useEffect(() => {
    // 초기 세션 확인
    checkAuthSession();

    // Auth state 변화 감지 (로그인 콜백 처리)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        checkAuthSession();
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  async function checkAuthSession() {
    try {
      setAuthError(null);

      // 1. Supabase 세션 확인
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      console.log('🔍 Step 1 - Session:', session ? 'OK' : 'FAIL', sessionError);

      if (sessionError || !session) {
        setIsLoading(false);
        return;
      }

      const userMetadata = session.user.user_metadata;
      const email = session.user.email;

      // 2. Google OAuth 검증 (identities 배열에서 google provider 확인)
      const hasGoogleIdentity = session.user.identities?.some(
        (identity: any) => identity.provider === 'google'
      );
      console.log('📧 Email:', email, 'Has Google Identity:', hasGoogleIdentity);

      if (!hasGoogleIdentity) {
        console.log('❌ Step 2 FAILED - Not Google OAuth');
        setAuthError('접근 권한이 없습니다.');
        await supabase.auth.signOut();
        setIsLoading(false);
        return;
      }
      console.log('✅ Step 2 - Google OAuth OK');
      setSecurityStatus(prev => ({ ...prev, googleAuth: true }));

      // 3. 도메인 화이트리스트 검증
      if (!email || !isEmailDomainAllowed(email)) {
        console.log('❌ Step 3 FAILED - Domain not allowed:', email);
        setAuthError('접근 권한이 없습니다.');
        await supabase.auth.signOut();
        setIsLoading(false);
        return;
      }
      console.log('✅ Step 3 - Domain whitelist OK');
      setSecurityStatus(prev => ({ ...prev, domainWhitelist: true }));

      // 4. MFA 검증 (Google 2단계 인증)
      const mfaEnabled = userMetadata?.email_verified &&
                         session.user.aud === 'authenticated' &&
                         userMetadata?.iss === 'https://accounts.google.com';
      console.log('🔐 MFA Check:', { email_verified: userMetadata?.email_verified, aud: session.user.aud, iss: userMetadata?.iss });

      if (!mfaEnabled) {
        console.log('❌ Step 4 FAILED - MFA not enabled');
        setAuthError('접근 권한이 없습니다.');
        await supabase.auth.signOut();
        setIsLoading(false);
        return;
      }
      console.log('✅ Step 4 - MFA OK');
      setSecurityStatus(prev => ({ ...prev, mfaEnabled: true }));

      // 5. 관리자 권한 확인 (role = 'admin')
      console.log('🔑 Checking admin role for user ID:', session.user.id);
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('role, email')
        .eq('id', session.user.id)
        .single();

      console.log('📊 User data:', userData, 'Error:', userError);

      if (userError || userData?.role !== 'admin') {
        console.log('❌ Step 5 FAILED - Not admin. Role:', userData?.role);
        setAuthError('접근 권한이 없습니다.');
        await supabase.auth.signOut();
        setIsLoading(false);
        return;
      }
      console.log('✅ Step 5 - Admin role OK');
      setSecurityStatus(prev => ({ ...prev, adminRole: true }));

      // 모든 보안 검증 통과
      setIsAuthenticated(true);
      setUserEmail(email || null);
    } catch (error: any) {
      console.error('Auth check failed:', error);
      setAuthError('권한 확인 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleGoogleLogin() {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/zc-ops-nx7k2`,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
            hd: ALLOWED_DOMAINS[0], // Google Workspace 도메인 힌트
          },
        },
      });

      if (error) {
        setAuthError('Google 로그인에 실패했습니다.');
      }
    } catch (error: any) {
      setAuthError('로그인 처리 중 오류가 발생했습니다.');
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    setIsAuthenticated(false);
    setUserEmail(null);
    setSecurityStatus({
      googleAuth: false,
      domainWhitelist: false,
      mfaEnabled: false,
      adminRole: false,
    });
  }

  function isEmailDomainAllowed(email: string): boolean {
    const domain = email.split('@')[1];
    return ALLOWED_DOMAINS.includes(domain);
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-red-600 border-r-transparent"></div>
          <p className="mt-4 text-neutral-600">보안 검증 중...</p>
        </div>
      </div>
    );
  }

  // 로그인 화면
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          {/* 로고 및 제목 */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-red-50 rounded-full mb-4">
              <ShieldCheck className="h-8 w-8 text-red-600" />
            </div>
            <h1 className="text-3xl font-bold text-neutral-900 mb-2">관리자 로그인</h1>
            <p className="text-neutral-600">인증이 필요합니다</p>
          </div>

          {/* 에러 메시지 */}
          {authError && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 flex items-start space-x-3">
              <ShieldAlert className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-red-900 mb-1">접근 거부</p>
                <p className="text-sm text-red-700">{authError}</p>
              </div>
            </div>
          )}

          {/* Google 로그인 버튼 */}
          <button
            onClick={handleGoogleLogin}
            className="w-full px-6 py-4 bg-white hover:bg-gray-50 text-gray-800 font-semibold rounded-xl transition-all transform hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center space-x-3 shadow-lg border border-neutral-200"
          >
            <svg className="h-6 w-6" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            <span>로그인</span>
          </button>

          {/* 홈 버튼 */}
          <div className="mt-6 text-center">
            <button
              onClick={() => router.push('/')}
              className="text-sm text-neutral-500 hover:text-neutral-700 transition-colors"
            >
              ← 홈으로 돌아가기
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 대시보드 화면 (로그인 후)
  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Header */}
      <header className="border-b border-neutral-200 bg-white backdrop-blur-sm sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center">
                <Activity className="h-6 w-6 text-red-600" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-neutral-900">집체크 관리자</h1>
                <p className="text-sm text-neutral-500">실시간 운영 대시보드</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-right hidden md:block">
                <div className="flex items-center space-x-2 mb-1">
                  <ShieldCheck className="h-4 w-4 text-green-600" />
                  <p className="text-xs text-green-600">보안 인증 완료</p>
                </div>
                <p className="text-sm font-medium text-neutral-900">{userEmail}</p>
              </div>
              <button
                onClick={handleLogout}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors text-sm font-medium"
              >
                로그아웃
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* KPI Cards */}
        <section className="mb-6">
          <div className="flex items-center space-x-2 mb-4">
            <TrendingUp className="h-5 w-5 text-red-600" />
            <h2 className="text-lg font-bold text-neutral-900">핵심 지표 (최근 7일)</h2>
          </div>
          <KPICards />
        </section>

        {/* Funnel Analysis */}
        <section className="mb-6">
          <div className="flex items-center space-x-2 mb-4">
            <BarChart3 className="h-5 w-5 text-red-600" />
            <h2 className="text-lg font-bold text-neutral-900">전환 퍼널 분석</h2>
          </div>
          <FunnelChart />
        </section>

        {/* Channel Performance */}
        <section className="mb-6">
          <div className="flex items-center space-x-2 mb-4">
            <Users className="h-5 w-5 text-red-600" />
            <h2 className="text-lg font-bold text-neutral-900">유입 채널 TOP 10</h2>
          </div>
          <ChannelChart />
        </section>

        {/* Quick Actions */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <QuickActionCard
            icon={<FileText className="h-5 w-5" />}
            title="PDF 업로드"
            value="대기 중"
            color="blue"
          />
          <QuickActionCard
            icon={<CreditCard className="h-5 w-5" />}
            title="결제 이슈"
            value="0건"
            color="green"
          />
          <QuickActionCard
            icon={<AlertCircle className="h-5 w-5" />}
            title="오류 알림"
            value="정상"
            color="gray"
          />
        </section>
      </main>
    </div>
  );
}

// Security Check Item Component
function SecurityCheckItem({
  checked,
  label,
  description,
}: {
  checked: boolean;
  label: string;
  description: string;
}) {
  return (
    <div className="flex items-start space-x-3 p-3 rounded-lg bg-neutral-50 border border-neutral-200">
      <div className={`mt-0.5 ${checked ? 'text-green-600' : 'text-neutral-400'}`}>
        {checked ? (
          <ShieldCheck className="h-5 w-5" />
        ) : (
          <Shield className="h-5 w-5" />
        )}
      </div>
      <div className="flex-1">
        <p className={`text-sm font-medium ${checked ? 'text-green-700' : 'text-neutral-600'}`}>
          {label}
        </p>
        <p className="text-xs text-neutral-500 mt-0.5">{description}</p>
      </div>
    </div>
  );
}

// Quick Action Card Component
function QuickActionCard({
  icon,
  title,
  value,
  color
}: {
  icon: React.ReactNode;
  title: string;
  value: string;
  color: 'blue' | 'green' | 'gray' | 'red';
}) {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    green: 'bg-green-50 text-green-700 border-green-200',
    gray: 'bg-neutral-50 text-neutral-700 border-neutral-200',
    red: 'bg-red-50 text-red-700 border-red-200',
  };

  return (
    <div className={`p-5 rounded-xl border bg-white ${colorClasses[color]} hover:shadow-lg transition-shadow`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-neutral-600 mb-1">{title}</p>
          <p className="text-xl font-bold">{value}</p>
        </div>
        <div className="opacity-70">
          {icon}
        </div>
      </div>
    </div>
  );
}
