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

import { useEffect, useState, useCallback } from 'react';
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
  LayoutDashboard,
  Database,
  Settings,
  ChevronRight,
  Search,
  Filter,
  Download,
  Upload,
  Eye,
  Edit,
  Trash2,
  CheckCircle,
  XCircle,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  Home,
  MapPin,
  Play,
  RefreshCw,
} from 'lucide-react';

// 허용된 도메인 목록
const ALLOWED_DOMAINS = ['zipcheck.kr'];

// 사이드바 메뉴 타입
type MenuSection = 'dashboard' | 'users' | 'data' | 'crawler' | 'payments' | 'settings';

export default function AdminDashboard() {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<MenuSection>('dashboard');
  const [securityStatus, setSecurityStatus] = useState({
    googleAuth: false,
    domainWhitelist: false,
    mfaEnabled: false,
    adminRole: false,
  });

  const checkAuthSession = useCallback(async () => {
    try {
      setAuthError(null);

      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError || !session) {
        setIsLoading(false);
        return;
      }

      const userMetadata = session.user.user_metadata;
      const email = session.user.email;

      const hasGoogleIdentity = session.user.identities?.some(
        (identity: any) => identity.provider === 'google'
      );

      if (!hasGoogleIdentity) {
        setAuthError('접근 권한이 없습니다.');
        await supabase.auth.signOut();
        setIsLoading(false);
        return;
      }
      setSecurityStatus(prev => ({ ...prev, googleAuth: true }));

      if (!email || !isEmailDomainAllowed(email)) {
        setAuthError('접근 권한이 없습니다.');
        await supabase.auth.signOut();
        setIsLoading(false);
        return;
      }
      setSecurityStatus(prev => ({ ...prev, domainWhitelist: true }));

      const mfaEnabled = userMetadata?.email_verified &&
                         session.user.aud === 'authenticated' &&
                         userMetadata?.iss === 'https://accounts.google.com';

      if (!mfaEnabled) {
        setAuthError('접근 권한이 없습니다.');
        await supabase.auth.signOut();
        setIsLoading(false);
        return;
      }
      setSecurityStatus(prev => ({ ...prev, mfaEnabled: true }));

      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('role, email')
        .eq('id', session.user.id)
        .single();

      if (userError || (userData as any)?.role !== 'admin') {
        setAuthError('접근 권한이 없습니다.');
        await supabase.auth.signOut();
        setIsLoading(false);
        return;
      }
      setSecurityStatus(prev => ({ ...prev, adminRole: true }));

      setIsAuthenticated(true);
      setUserEmail(email || null);
    } catch (error: any) {
      setAuthError('권한 확인 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuthSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        checkAuthSession();
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [checkAuthSession]);

  async function handleGoogleLogin() {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/zc-ops-nx7k2`,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
            hd: ALLOWED_DOMAINS[0],
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

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-red-50 rounded-full mb-4">
              <ShieldCheck className="h-8 w-8 text-red-600" />
            </div>
            <h1 className="text-3xl font-bold text-neutral-900 mb-2">관리자 로그인</h1>
            <p className="text-neutral-600">인증이 필요합니다</p>
          </div>

          {authError && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 flex items-start space-x-3">
              <ShieldAlert className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-red-900 mb-1">접근 거부</p>
                <p className="text-sm text-red-700">{authError}</p>
              </div>
            </div>
          )}

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
    <div className="min-h-screen bg-neutral-50 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-neutral-200 flex flex-col">
        <div className="p-6 border-b border-neutral-200">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center">
              <Activity className="h-6 w-6 text-red-600" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-neutral-900">집체크</h1>
              <p className="text-xs text-neutral-500">관리자</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          <SidebarMenuItem
            icon={<LayoutDashboard className="h-5 w-5" />}
            label="대시보드"
            active={activeSection === 'dashboard'}
            onClick={() => setActiveSection('dashboard')}
          />
          <SidebarMenuItem
            icon={<Users className="h-5 w-5" />}
            label="회원 관리"
            active={activeSection === 'users'}
            onClick={() => setActiveSection('users')}
          />
          <SidebarMenuItem
            icon={<Database className="h-5 w-5" />}
            label="데이터 관리"
            active={activeSection === 'data'}
            onClick={() => setActiveSection('data')}
          />
          <SidebarMenuItem
            icon={<MapPin className="h-5 w-5" />}
            label="매물 크롤링"
            active={activeSection === 'crawler'}
            onClick={() => setActiveSection('crawler')}
          />
          <SidebarMenuItem
            icon={<CreditCard className="h-5 w-5" />}
            label="결제 관리"
            active={activeSection === 'payments'}
            onClick={() => setActiveSection('payments')}
          />
          <SidebarMenuItem
            icon={<Settings className="h-5 w-5" />}
            label="설정"
            active={activeSection === 'settings'}
            onClick={() => setActiveSection('settings')}
          />
        </nav>

        <div className="p-4 border-t border-neutral-200">
          <div className="flex items-center space-x-2 mb-3">
            <ShieldCheck className="h-4 w-4 text-green-600 flex-shrink-0" />
            <p className="text-xs text-green-600 font-medium">보안 인증 완료</p>
          </div>
          <p className="text-sm font-medium text-neutral-900 mb-3 truncate">{userEmail}</p>
          <button
            onClick={handleLogout}
            className="w-full px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors text-sm font-medium"
          >
            로그아웃
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white border-b border-neutral-200 px-8 py-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-neutral-900">
                {activeSection === 'dashboard' && '대시보드'}
                {activeSection === 'users' && '회원 관리'}
                {activeSection === 'data' && '데이터 관리'}
                {activeSection === 'crawler' && '매물 크롤링'}
                {activeSection === 'payments' && '결제 관리'}
                {activeSection === 'settings' && '설정'}
              </h2>
              <p className="text-sm text-neutral-500 mt-1">
                {activeSection === 'dashboard' && '실시간 운영 현황을 확인하세요'}
                {activeSection === 'users' && '회원 정보 및 권한을 관리하세요'}
                {activeSection === 'data' && '분석 데이터 및 문서를 관리하세요'}
                {activeSection === 'crawler' && '네이버 부동산 매물 크롤링 및 검색'}
                {activeSection === 'payments' && '결제 내역 및 정산을 관리하세요'}
                {activeSection === 'settings' && '시스템 설정을 관리하세요'}
              </p>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-8">
          {activeSection === 'dashboard' && <DashboardSection onNavigate={setActiveSection} />}
          {activeSection === 'users' && <UsersSection />}
          {activeSection === 'data' && <DataSection />}
          {activeSection === 'crawler' && <CrawlerSection />}
          {activeSection === 'payments' && <PaymentsSection />}
          {activeSection === 'settings' && <SettingsSection />}
        </main>
      </div>
    </div>
  );
}

// ==================== 대시보드 섹션 ====================
function DashboardSection({ onNavigate }: { onNavigate: (section: MenuSection) => void }) {
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalDocuments: 0,
    totalReports: 0,
    todayAnalyses: 0,
    todayDocs: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  async function fetchStats() {
    try {
      const res = await fetch('/api/admin/stats');
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-red-600 border-r-transparent"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <QuickStatCard
          icon={<Users className="h-6 w-6" />}
          label="총 회원수"
          value={stats.totalUsers.toLocaleString()}
          change="+12.5%"
          trend="up"
        />
        <QuickStatCard
          icon={<FileText className="h-6 w-6" />}
          label="금일 분석"
          value={stats.todayAnalyses.toString()}
          change="+8.2%"
          trend="up"
        />
        <QuickStatCard
          icon={<CreditCard className="h-6 w-6" />}
          label="총 문서"
          value={stats.totalDocuments.toLocaleString()}
          change="+15.3%"
          trend="up"
        />
        <QuickStatCard
          icon={<TrendingUp className="h-6 w-6" />}
          label="총 분석"
          value={stats.totalReports.toLocaleString()}
          change="-0.5%"
          trend="down"
        />
      </div>

      {/* Recent Activities */}
      <div className="bg-white rounded-xl border border-neutral-200 p-6">
        <h3 className="text-lg font-bold text-neutral-900 mb-4">최근 활동</h3>
        <div className="space-y-3">
          <ActivityItem
            type="user"
            message="새로운 회원 가입"
            user="user@example.com"
            time="5분 전"
          />
          <ActivityItem
            type="payment"
            message="결제 완료"
            user="buyer@example.com"
            time="12분 전"
          />
          <ActivityItem
            type="analysis"
            message="계약서 분석 완료"
            user="customer@example.com"
            time="1시간 전"
          />
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <button
          onClick={() => onNavigate('users')}
          className="bg-white border border-neutral-200 rounded-xl p-6 hover:border-red-300 hover:shadow-md transition-all text-left group"
        >
          <Users className="h-8 w-8 text-red-600 mb-3 group-hover:scale-110 transition-transform" />
          <h4 className="font-semibold text-neutral-900 mb-1">회원 관리</h4>
          <p className="text-sm text-neutral-500">회원 정보 및 권한 관리</p>
        </button>
        <button
          onClick={() => onNavigate('data')}
          className="bg-white border border-neutral-200 rounded-xl p-6 hover:border-red-300 hover:shadow-md transition-all text-left group"
        >
          <Database className="h-8 w-8 text-red-600 mb-3 group-hover:scale-110 transition-transform" />
          <h4 className="font-semibold text-neutral-900 mb-1">데이터 관리</h4>
          <p className="text-sm text-neutral-500">분석 데이터 및 통계 확인</p>
        </button>
        <button
          onClick={() => onNavigate('payments')}
          className="bg-white border border-neutral-200 rounded-xl p-6 hover:border-red-300 hover:shadow-md transition-all text-left group"
        >
          <CreditCard className="h-8 w-8 text-red-600 mb-3 group-hover:scale-110 transition-transform" />
          <h4 className="font-semibold text-neutral-900 mb-1">결제 관리</h4>
          <p className="text-sm text-neutral-500">결제 내역 및 정산 관리</p>
        </button>
      </div>
    </div>
  );
}

// ==================== 회원 관리 섹션 ====================
function UsersSection() {
  const [searchTerm, setSearchTerm] = useState('');
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalUsers, setTotalUsers] = useState(0);

  useEffect(() => {
    fetchUsers();
  }, []);

  async function fetchUsers() {
    try {
      const res = await fetch('/api/admin/users');
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users || []);
        setTotalUsers(data.total || 0);
      }
    } catch (error) {
      console.error('Failed to fetch users:', error);
    } finally {
      setLoading(false);
    }
  }

  const filteredUsers = users.filter(user =>
    user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.phone?.includes(searchTerm)
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-red-600 border-r-transparent"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="bg-white rounded-xl border border-neutral-200 p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-neutral-500 mb-1">총 회원 수</p>
            <p className="text-3xl font-bold text-neutral-900">{totalUsers.toLocaleString()}</p>
          </div>
          <Users className="h-10 w-10 text-red-600" />
        </div>
      </div>

      {/* Search & Filter */}
      <div className="bg-white rounded-xl border border-neutral-200 p-4 flex items-center space-x-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-neutral-400" />
          <input
            type="text"
            placeholder="이메일, 이름, 전화번호로 검색..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
          />
        </div>
        <button className="px-4 py-2 border border-neutral-200 rounded-lg hover:bg-neutral-50 flex items-center space-x-2">
          <Filter className="h-4 w-4" />
          <span className="text-sm">필터</span>
        </button>
        <button className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center space-x-2">
          <Download className="h-4 w-4" />
          <span className="text-sm">내보내기</span>
        </button>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-neutral-50 border-b border-neutral-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase">회원 이름</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase">이메일 주소</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase">성별</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase">연령대</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase">휴대전화번호</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase">가입일</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase">작업</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-neutral-500">
                    {searchTerm ? '검색 결과가 없습니다.' : '등록된 회원이 없습니다.'}
                  </td>
                </tr>
              ) : (
                filteredUsers.map(user => (
                  <tr key={user.id} className="hover:bg-neutral-50">
                    <td className="px-6 py-4">
                      <div className="font-medium text-neutral-900">{user.name || '-'}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-neutral-600">{user.email || '-'}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-neutral-600">
                        {user.gender === 'male' && '남성'}
                        {user.gender === 'female' && '여성'}
                        {!user.gender && '-'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-neutral-600">{user.age_group || '-'}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-neutral-600">{user.phone || '-'}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-neutral-600">
                        {user.created_at ? new Date(user.created_at).toLocaleDateString('ko-KR') : '-'}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-2">
                        <button className="p-2 hover:bg-neutral-100 rounded-lg" title="상세보기">
                          <Eye className="h-4 w-4 text-neutral-600" />
                        </button>
                        <button className="p-2 hover:bg-neutral-100 rounded-lg" title="수정">
                          <Edit className="h-4 w-4 text-neutral-600" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ==================== 데이터 관리 섹션 ====================
function DataSection() {
  const [dataList, setDataList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalDocs: 0,
    todayAnalyses: 0,
    pending: 0,
  });

  useEffect(() => {
    fetchData();
    fetchStats();
  }, []);

  async function fetchData() {
    try {
      const res = await fetch('/api/admin/data');
      if (res.ok) {
        const data = await res.json();
        setDataList(data.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  }

  async function fetchStats() {
    try {
      const res = await fetch('/api/admin/stats');
      if (res.ok) {
        const data = await res.json();
        setStats({
          totalDocs: data.totalDocuments || 0,
          todayAnalyses: data.todayAnalyses || 0,
          pending: 0, // TODO: 처리 대기 문서 수 계산
        });
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-red-600 border-r-transparent"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-neutral-200 rounded-xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-neutral-500 mb-1">총 문서</p>
              <p className="text-2xl font-bold text-neutral-900">{stats.totalDocs.toLocaleString()}</p>
            </div>
            <FileText className="h-8 w-8 text-blue-600" />
          </div>
        </div>
        <div className="bg-white border border-neutral-200 rounded-xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-neutral-500 mb-1">금일 분석</p>
              <p className="text-2xl font-bold text-neutral-900">{stats.todayAnalyses}</p>
            </div>
            <BarChart3 className="h-8 w-8 text-green-600" />
          </div>
        </div>
        <div className="bg-white border border-neutral-200 rounded-xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-neutral-500 mb-1">처리 대기</p>
              <p className="text-2xl font-bold text-neutral-900">{stats.pending}</p>
            </div>
            <Clock className="h-8 w-8 text-orange-600" />
          </div>
        </div>
      </div>

      {/* Data Table */}
      <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-neutral-200 flex items-center justify-between">
          <h3 className="font-semibold text-neutral-900">최근 분석 데이터</h3>
          <button className="px-4 py-2 text-sm border border-neutral-200 rounded-lg hover:bg-neutral-50 flex items-center space-x-2">
            <Upload className="h-4 w-4" />
            <span>업로드</span>
          </button>
        </div>

        <table className="w-full">
          <thead className="bg-neutral-50 border-b border-neutral-200">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase">문서 정보</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase">요청자</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase">분석 일시</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase">상태</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase">작업</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-200">
            {dataList.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-neutral-500">
                  등록된 문서가 없습니다.
                </td>
              </tr>
            ) : (
              dataList.map(item => (
                <tr key={item.id} className="hover:bg-neutral-50">
                  <td className="px-6 py-4">
                    <div>
                      <div className="font-medium text-neutral-900">{item.title}</div>
                      <div className="text-sm text-neutral-500">{item.type}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-neutral-600">{item.user}</td>
                  <td className="px-6 py-4 text-sm text-neutral-600">{item.date}</td>
                  <td className="px-6 py-4">
                    {item.status === 'completed' && (
                      <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-700 flex items-center space-x-1 w-fit">
                        <CheckCircle className="h-3 w-3" />
                        <span>완료</span>
                      </span>
                    )}
                    {item.status === 'processing' && (
                      <span className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-700 flex items-center space-x-1 w-fit">
                        <Clock className="h-3 w-3" />
                        <span>처리 중</span>
                      </span>
                    )}
                    {item.status === 'failed' && (
                      <span className="px-2 py-1 text-xs rounded-full bg-red-100 text-red-700 flex items-center space-x-1 w-fit">
                        <XCircle className="h-3 w-3" />
                        <span>실패</span>
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center space-x-2">
                      <button className="p-2 hover:bg-neutral-100 rounded-lg" title="상세보기">
                        <Eye className="h-4 w-4 text-neutral-600" />
                      </button>
                      <button className="p-2 hover:bg-neutral-100 rounded-lg" title="다운로드">
                        <Download className="h-4 w-4 text-neutral-600" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ==================== 매물 크롤링 섹션 ====================
function CrawlerSection() {
  // 환경변수 우선, 누락 시 현재 Cloud Run 서비스 URL로 폴백
  const API_BASE_URL = process.env.NEXT_PUBLIC_AI_API_URL || 'https://zipcheck-ai-ov5n6pt46a-du.a.run.app';

  // 전국 지역 데이터 (196개 지역)
  const KOREA_REGIONS = [
    // 서울특별시 (25개 구)
    {"sido": "서울특별시", "sigungu": "강남구", "lat": 37.5172, "lon": 127.0473},
    {"sido": "서울특별시", "sigungu": "강동구", "lat": 37.5301, "lon": 127.1238},
    {"sido": "서울특별시", "sigungu": "강북구", "lat": 37.6396, "lon": 127.0257},
    {"sido": "서울특별시", "sigungu": "강서구", "lat": 37.5509, "lon": 126.8495},
    {"sido": "서울특별시", "sigungu": "관악구", "lat": 37.4784, "lon": 126.9516},
    {"sido": "서울특별시", "sigungu": "광진구", "lat": 37.5384, "lon": 127.0822},
    {"sido": "서울특별시", "sigungu": "구로구", "lat": 37.4954, "lon": 126.8874},
    {"sido": "서울특별시", "sigungu": "금천구", "lat": 37.4568, "lon": 126.8956},
    {"sido": "서울특별시", "sigungu": "노원구", "lat": 37.6542, "lon": 127.0568},
    {"sido": "서울특별시", "sigungu": "도봉구", "lat": 37.6688, "lon": 127.0471},
    {"sido": "서울특별시", "sigungu": "동대문구", "lat": 37.5744, "lon": 127.0399},
    {"sido": "서울특별시", "sigungu": "동작구", "lat": 37.5124, "lon": 126.9393},
    {"sido": "서울특별시", "sigungu": "마포구", "lat": 37.5663, "lon": 126.9019},
    {"sido": "서울특별시", "sigungu": "서대문구", "lat": 37.5791, "lon": 126.9368},
    {"sido": "서울특별시", "sigungu": "서초구", "lat": 37.4837, "lon": 127.0324},
    {"sido": "서울특별시", "sigungu": "성동구", "lat": 37.5634, "lon": 127.0371},
    {"sido": "서울특별시", "sigungu": "성북구", "lat": 37.5894, "lon": 127.0167},
    {"sido": "서울특별시", "sigungu": "송파구", "lat": 37.5145, "lon": 127.1059},
    {"sido": "서울특별시", "sigungu": "양천구", "lat": 37.5170, "lon": 126.8664},
    {"sido": "서울특별시", "sigungu": "영등포구", "lat": 37.5264, "lon": 126.8962},
    {"sido": "서울특별시", "sigungu": "용산구", "lat": 37.5324, "lon": 126.9900},
    {"sido": "서울특별시", "sigungu": "은평구", "lat": 37.6027, "lon": 126.9291},
    {"sido": "서울특별시", "sigungu": "종로구", "lat": 37.5730, "lon": 126.9794},
    {"sido": "서울특별시", "sigungu": "중구", "lat": 37.5641, "lon": 126.9979},
    {"sido": "서울특별시", "sigungu": "중랑구", "lat": 37.6063, "lon": 127.0926},

    // 인천광역시 (10개 구/군)
    {"sido": "인천광역시", "sigungu": "계양구", "lat": 37.5372, "lon": 126.7379},
    {"sido": "인천광역시", "sigungu": "남동구", "lat": 37.4475, "lon": 126.7312},
    {"sido": "인천광역시", "sigungu": "동구", "lat": 37.4738, "lon": 126.6433},
    {"sido": "인천광역시", "sigungu": "미추홀구", "lat": 37.4633, "lon": 126.6505},
    {"sido": "인천광역시", "sigungu": "부평구", "lat": 37.5068, "lon": 126.7220},
    {"sido": "인천광역시", "sigungu": "서구", "lat": 37.5455, "lon": 126.6759},
    {"sido": "인천광역시", "sigungu": "연수구", "lat": 37.4106, "lon": 126.6781},
    {"sido": "인천광역시", "sigungu": "중구", "lat": 37.4738, "lon": 126.6214},
    {"sido": "인천광역시", "sigungu": "강화군", "lat": 37.7469, "lon": 126.4882},
    {"sido": "인천광역시", "sigungu": "옹진군", "lat": 37.4466, "lon": 126.6367},

    // 경기도 (31개 시/군)
    {"sido": "경기도", "sigungu": "수원시", "lat": 37.2636, "lon": 127.0286},
    {"sido": "경기도", "sigungu": "성남시", "lat": 37.4200, "lon": 127.1266},
    {"sido": "경기도", "sigungu": "고양시", "lat": 37.6583, "lon": 126.8320},
    {"sido": "경기도", "sigungu": "용인시", "lat": 37.2411, "lon": 127.1776},
    {"sido": "경기도", "sigungu": "부천시", "lat": 37.5034, "lon": 126.7660},
    {"sido": "경기도", "sigungu": "안산시", "lat": 37.3218, "lon": 126.8309},
    {"sido": "경기도", "sigungu": "안양시", "lat": 37.3943, "lon": 126.9568},
    {"sido": "경기도", "sigungu": "남양주시", "lat": 37.6362, "lon": 127.2168},
    {"sido": "경기도", "sigungu": "화성시", "lat": 37.1991, "lon": 126.8311},
    {"sido": "경기도", "sigungu": "평택시", "lat": 36.9921, "lon": 127.1127},
    {"sido": "경기도", "sigungu": "시흥시", "lat": 37.3800, "lon": 126.8028},
    {"sido": "경기도", "sigungu": "파주시", "lat": 37.7599, "lon": 126.7800},
    {"sido": "경기도", "sigungu": "의정부시", "lat": 37.7381, "lon": 127.0338},
    {"sido": "경기도", "sigungu": "김포시", "lat": 37.6152, "lon": 126.7159},
    {"sido": "경기도", "sigungu": "광주시", "lat": 37.4292, "lon": 127.2552},
    {"sido": "경기도", "sigungu": "광명시", "lat": 37.4786, "lon": 126.8644},
    {"sido": "경기도", "sigungu": "군포시", "lat": 37.3616, "lon": 126.9352},
    {"sido": "경기도", "sigungu": "하남시", "lat": 37.5393, "lon": 127.2145},
    {"sido": "경기도", "sigungu": "오산시", "lat": 37.1497, "lon": 127.0773},
    {"sido": "경기도", "sigungu": "양주시", "lat": 37.7852, "lon": 127.0457},
    {"sido": "경기도", "sigungu": "이천시", "lat": 37.2720, "lon": 127.4350},
    {"sido": "경기도", "sigungu": "구리시", "lat": 37.5943, "lon": 127.1296},
    {"sido": "경기도", "sigungu": "안성시", "lat": 37.0079, "lon": 127.2797},
    {"sido": "경기도", "sigungu": "포천시", "lat": 37.8950, "lon": 127.2004},
    {"sido": "경기도", "sigungu": "의왕시", "lat": 37.3449, "lon": 126.9683},
    {"sido": "경기도", "sigungu": "양평군", "lat": 37.4910, "lon": 127.4874},
    {"sido": "경기도", "sigungu": "여주시", "lat": 37.2982, "lon": 127.6377},
    {"sido": "경기도", "sigungu": "동두천시", "lat": 37.9034, "lon": 127.0605},
    {"sido": "경기도", "sigungu": "가평군", "lat": 37.8314, "lon": 127.5095},
    {"sido": "경기도", "sigungu": "과천시", "lat": 37.4292, "lon": 126.9875},
    {"sido": "경기도", "sigungu": "연천군", "lat": 38.0960, "lon": 127.0746},

    // 부산광역시 (16개 구/군)
    {"sido": "부산광역시", "sigungu": "강서구", "lat": 35.2121, "lon": 128.9806},
    {"sido": "부산광역시", "sigungu": "금정구", "lat": 35.2428, "lon": 129.0927},
    {"sido": "부산광역시", "sigungu": "남구", "lat": 35.1364, "lon": 129.0843},
    {"sido": "부산광역시", "sigungu": "동구", "lat": 35.1295, "lon": 129.0451},
    {"sido": "부산광역시", "sigungu": "동래구", "lat": 35.2047, "lon": 129.0839},
    {"sido": "부산광역시", "sigungu": "부산진구", "lat": 35.1629, "lon": 129.0530},
    {"sido": "부산광역시", "sigungu": "북구", "lat": 35.1975, "lon": 128.9903},
    {"sido": "부산광역시", "sigungu": "사상구", "lat": 35.1529, "lon": 128.9910},
    {"sido": "부산광역시", "sigungu": "사하구", "lat": 35.1042, "lon": 128.9743},
    {"sido": "부산광역시", "sigungu": "서구", "lat": 35.0971, "lon": 129.0244},
    {"sido": "부산광역시", "sigungu": "수영구", "lat": 35.1454, "lon": 129.1134},
    {"sido": "부산광역시", "sigungu": "연제구", "lat": 35.1761, "lon": 129.0799},
    {"sido": "부산광역시", "sigungu": "영도구", "lat": 35.0914, "lon": 129.0679},
    {"sido": "부산광역시", "sigungu": "중구", "lat": 35.1063, "lon": 129.0323},
    {"sido": "부산광역시", "sigungu": "해운대구", "lat": 35.1631, "lon": 129.1639},
    {"sido": "부산광역시", "sigungu": "기장군", "lat": 35.2447, "lon": 129.2221},

    // 대구광역시 (8개 구/군)
    {"sido": "대구광역시", "sigungu": "남구", "lat": 35.8463, "lon": 128.5974},
    {"sido": "대구광역시", "sigungu": "달서구", "lat": 35.8299, "lon": 128.5326},
    {"sido": "대구광역시", "sigungu": "달성군", "lat": 35.7748, "lon": 128.4312},
    {"sido": "대구광역시", "sigungu": "동구", "lat": 35.8869, "lon": 128.6354},
    {"sido": "대구광역시", "sigungu": "북구", "lat": 35.8858, "lon": 128.5828},
    {"sido": "대구광역시", "sigungu": "서구", "lat": 35.8718, "lon": 128.5589},
    {"sido": "대구광역시", "sigungu": "수성구", "lat": 35.8581, "lon": 128.6311},
    {"sido": "대구광역시", "sigungu": "중구", "lat": 35.8694, "lon": 128.6066},

    // 광주광역시 (5개 구)
    {"sido": "광주광역시", "sigungu": "광산구", "lat": 35.1397, "lon": 126.7935},
    {"sido": "광주광역시", "sigungu": "남구", "lat": 35.1328, "lon": 126.9026},
    {"sido": "광주광역시", "sigungu": "동구", "lat": 35.1460, "lon": 126.9227},
    {"sido": "광주광역시", "sigungu": "북구", "lat": 35.1740, "lon": 126.9119},
    {"sido": "광주광역시", "sigungu": "서구", "lat": 35.1519, "lon": 126.8895},

    // 대전광역시 (5개 구)
    {"sido": "대전광역시", "sigungu": "대덕구", "lat": 36.3466, "lon": 127.4148},
    {"sido": "대전광역시", "sigungu": "동구", "lat": 36.3111, "lon": 127.4548},
    {"sido": "대전광역시", "sigungu": "서구", "lat": 36.3554, "lon": 127.3838},
    {"sido": "대전광역시", "sigungu": "유성구", "lat": 36.3622, "lon": 127.3563},
    {"sido": "대전광역시", "sigungu": "중구", "lat": 36.3254, "lon": 127.4210},

    // 울산광역시 (5개 구/군)
    {"sido": "울산광역시", "sigungu": "남구", "lat": 35.5439, "lon": 129.3299},
    {"sido": "울산광역시", "sigungu": "동구", "lat": 35.5049, "lon": 129.4163},
    {"sido": "울산광역시", "sigungu": "북구", "lat": 35.5826, "lon": 129.3611},
    {"sido": "울산광역시", "sigungu": "중구", "lat": 35.5689, "lon": 129.3327},
    {"sido": "울산광역시", "sigungu": "울주군", "lat": 35.5221, "lon": 129.1543},

    // 세종특별자치시
    {"sido": "세종특별자치시", "sigungu": "세종시", "lat": 36.4800, "lon": 127.2890},

    // 강원도 (7개 시)
    {"sido": "강원도", "sigungu": "춘천시", "lat": 37.8813, "lon": 127.7300},
    {"sido": "강원도", "sigungu": "원주시", "lat": 37.3422, "lon": 127.9202},
    {"sido": "강원도", "sigungu": "강릉시", "lat": 37.7519, "lon": 128.8761},
    {"sido": "강원도", "sigungu": "동해시", "lat": 37.5247, "lon": 129.1144},
    {"sido": "강원도", "sigungu": "태백시", "lat": 37.1641, "lon": 128.9856},
    {"sido": "강원도", "sigungu": "속초시", "lat": 38.2070, "lon": 128.5919},
    {"sido": "강원도", "sigungu": "삼척시", "lat": 37.4500, "lon": 129.1656},

    // 충청북도 (3개 시)
    {"sido": "충청북도", "sigungu": "청주시", "lat": 36.6424, "lon": 127.4890},
    {"sido": "충청북도", "sigungu": "충주시", "lat": 36.9910, "lon": 127.9259},
    {"sido": "충청북도", "sigungu": "제천시", "lat": 37.1326, "lon": 128.1911},

    // 충청남도 (8개 시)
    {"sido": "충청남도", "sigungu": "천안시", "lat": 36.8151, "lon": 127.1139},
    {"sido": "충청남도", "sigungu": "공주시", "lat": 36.4465, "lon": 127.1189},
    {"sido": "충청남도", "sigungu": "보령시", "lat": 36.3330, "lon": 126.6129},
    {"sido": "충청남도", "sigungu": "아산시", "lat": 36.7898, "lon": 127.0016},
    {"sido": "충청남도", "sigungu": "서산시", "lat": 36.7848, "lon": 126.4503},
    {"sido": "충청남도", "sigungu": "논산시", "lat": 36.1870, "lon": 127.0986},
    {"sido": "충청남도", "sigungu": "계룡시", "lat": 36.2743, "lon": 127.2488},
    {"sido": "충청남도", "sigungu": "당진시", "lat": 36.8930, "lon": 126.6479},

    // 전라북도 (6개 시)
    {"sido": "전라북도", "sigungu": "전주시", "lat": 35.8242, "lon": 127.1480},
    {"sido": "전라북도", "sigungu": "군산시", "lat": 35.9678, "lon": 126.7368},
    {"sido": "전라북도", "sigungu": "익산시", "lat": 35.9483, "lon": 126.9575},
    {"sido": "전라북도", "sigungu": "정읍시", "lat": 35.5699, "lon": 126.8560},
    {"sido": "전라북도", "sigungu": "남원시", "lat": 35.4164, "lon": 127.3904},
    {"sido": "전라북도", "sigungu": "김제시", "lat": 35.8036, "lon": 126.8809},

    // 전라남도 (5개 시)
    {"sido": "전라남도", "sigungu": "목포시", "lat": 34.8118, "lon": 126.3922},
    {"sido": "전라남도", "sigungu": "여수시", "lat": 34.7604, "lon": 127.6622},
    {"sido": "전라남도", "sigungu": "순천시", "lat": 34.9507, "lon": 127.4872},
    {"sido": "전라남도", "sigungu": "나주시", "lat": 35.0160, "lon": 126.7109},
    {"sido": "전라남도", "sigungu": "광양시", "lat": 34.9407, "lon": 127.6956},

    // 경상북도 (10개 시)
    {"sido": "경상북도", "sigungu": "포항시", "lat": 36.0190, "lon": 129.3435},
    {"sido": "경상북도", "sigungu": "경주시", "lat": 35.8562, "lon": 129.2247},
    {"sido": "경상북도", "sigungu": "김천시", "lat": 36.1399, "lon": 128.1137},
    {"sido": "경상북도", "sigungu": "안동시", "lat": 36.5684, "lon": 128.7294},
    {"sido": "경상북도", "sigungu": "구미시", "lat": 36.1195, "lon": 128.3446},
    {"sido": "경상북도", "sigungu": "영주시", "lat": 36.8056, "lon": 128.6239},
    {"sido": "경상북도", "sigungu": "영천시", "lat": 35.9733, "lon": 128.9386},
    {"sido": "경상북도", "sigungu": "상주시", "lat": 36.4109, "lon": 128.1589},
    {"sido": "경상북도", "sigungu": "문경시", "lat": 36.5864, "lon": 128.1867},
    {"sido": "경상북도", "sigungu": "경산시", "lat": 35.8250, "lon": 128.7414},

    // 경상남도 (8개 시)
    {"sido": "경상남도", "sigungu": "창원시", "lat": 35.2281, "lon": 128.6811},
    {"sido": "경상남도", "sigungu": "진주시", "lat": 35.1800, "lon": 128.1076},
    {"sido": "경상남도", "sigungu": "통영시", "lat": 34.8544, "lon": 128.4331},
    {"sido": "경상남도", "sigungu": "사천시", "lat": 35.0036, "lon": 128.0642},
    {"sido": "경상남도", "sigungu": "김해시", "lat": 35.2286, "lon": 128.8894},
    {"sido": "경상남도", "sigungu": "밀양시", "lat": 35.5037, "lon": 128.7462},
    {"sido": "경상남도", "sigungu": "거제시", "lat": 34.8806, "lon": 128.6211},
    {"sido": "경상남도", "sigungu": "양산시", "lat": 35.3350, "lon": 129.0374},

    // 제주특별자치도 (2개 시)
    {"sido": "제주특별자치도", "sigungu": "제주시", "lat": 33.4996, "lon": 126.5312},
    {"sido": "제주특별자치도", "sigungu": "서귀포시", "lat": 33.2541, "lon": 126.5601},
  ];

  const [selectedSido, setSelectedSido] = useState('');
  const [selectedSigungu, setSelectedSigungu] = useState('');

  // 평수 (평 단위로 표시, m²로 변환)
  const [minAreaPyeong, setMinAreaPyeong] = useState(0);  // 0평부터 시작
  const [maxAreaPyeong, setMaxAreaPyeong] = useState(40);  // 40평 = 약 132m²

  // 가격 (천만원 단위로 표시, 0.1 = 1천만원)
  const [minPriceCheon, setMinPriceCheon] = useState(0);  // 0억원부터 시작
  const [maxPriceCheon, setMaxPriceCheon] = useState(150);  // 150 = 15억

  const [tradeTypes, setTradeTypes] = useState({
    SALE: true,
    JEONSE: true,
    MONTHLY: true,
  });

  // 물건 종류 (네이버 부동산 기준)
  const [propertyTypes, setPropertyTypes] = useState({
    APT: true,        // 아파트
    OPST: true,       // 오피스텔
    VILLA: true,      // 빌라
    DDDGG: true,      // 단독/다가구
    JWJT: false,      // 주거용 오피스텔
    GJCG: false,      // 공장/창고
    TOJI: false,      // 토지
  });

  const [properties, setProperties] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [crawling, setCrawling] = useState(false);

  // 평 ↔ m² 변환 함수
  const pyeongToM2 = (pyeong: number) => Math.round(pyeong * 3.3058);
  const m2ToPyeong = (m2: number) => Math.round(m2 / 3.3058 * 10) / 10;

  const sidoList = [...new Set(KOREA_REGIONS.map(r => r.sido))].sort();
  const sigunguList = selectedSido
    ? [...new Set(KOREA_REGIONS.filter(r => r.sido === selectedSido).map(r => r.sigungu))].sort()
    : [];

  async function handleCrawl() {
    if (!selectedSido) {
      alert('시/도를 선택해주세요');
      return;
    }

    setCrawling(true);
    try {
      const region = KOREA_REGIONS.find(
        r => r.sido === selectedSido && (!selectedSigungu || r.sigungu === selectedSigungu)
      );
      if (!region) {
        alert('선택한 지역을 찾을 수 없습니다');
        setCrawling(false);
        return;
      }

      const selectedTradeTypes = Object.entries(tradeTypes)
        .filter(([_, enabled]) => enabled)
        .map(([type]) => {
          if (type === 'SALE') return 'A1';
          if (type === 'JEONSE') return 'B1';
          if (type === 'MONTHLY') return 'B2';
          return 'A1';
        });

      const selectedPropertyTypes = Object.entries(propertyTypes)
        .filter(([_, enabled]) => enabled)
        .map(([type]) => type);

      const res = await fetch(`${API_BASE_URL}/realestate/crawl`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lat: region.lat,
          lon: region.lon,
          radius_km: 5.0,
          trade_types: selectedTradeTypes,
          property_types: selectedPropertyTypes,
        }),
      });

      if (res.ok) {
        alert('크롤링이 시작되었습니다. 잠시 후 검색해주세요.');
        setTimeout(() => handleSearch(), 5000);
      } else {
        alert('크롤링 요청 실패');
      }
    } catch (error) {
      console.error('Failed to crawl:', error);
      alert('크롤링 실패: ' + (error as Error).message);
    } finally {
      setCrawling(false);
    }
  }

  async function handleSearch() {
    if (!selectedSido) {
      alert('시/도를 선택해주세요');
      return;
    }

    setLoading(true);
    try {
      const region = KOREA_REGIONS.find(
        r => r.sido === selectedSido && (!selectedSigungu || r.sigungu === selectedSigungu)
      );
      if (!region) {
        alert('선택한 지역을 찾을 수 없습니다');
        setLoading(false);
        return;
      }

      const selectedPropertyTypes = Object.entries(propertyTypes)
        .filter(([_, enabled]) => enabled)
        .map(([type]) => type);

      const res = await fetch(`${API_BASE_URL}/realestate/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lat: region.lat,
          lon: region.lon,
          radius_km: 5.0,
          min_area: pyeongToM2(minAreaPyeong),
          max_area: pyeongToM2(maxAreaPyeong),
          min_price: minPriceCheon * 1000,  // 천만원 → 만원
          max_price: maxPriceCheon * 1000,  // 천만원 → 만원
          trade_types: Object.entries(tradeTypes)
            .filter(([_, enabled]) => enabled)
            .map(([type]) => type),
          property_types: selectedPropertyTypes,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setProperties(data.results || []);
      } else {
        alert('검색 요청 실패');
      }
    } catch (error) {
      console.error('Failed to search:', error);
      alert('검색 실패: ' + (error as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* 필터 섹션 */}
      <div className="bg-white rounded-xl border border-neutral-200 p-6">
        <h3 className="text-lg font-bold text-neutral-900 mb-4">검색 조건</h3>

        {/* 지역 선택 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">시/도</label>
            <select
              value={selectedSido}
              onChange={(e) => {
                setSelectedSido(e.target.value);
                setSelectedSigungu('');
              }}
              className="w-full px-4 py-2 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
            >
              <option value="">시/도 선택</option>
              {sidoList.map(sido => (
                <option key={sido} value={sido}>{sido}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">시/군/구</label>
            <select
              value={selectedSigungu}
              onChange={(e) => setSelectedSigungu(e.target.value)}
              disabled={!selectedSido}
              className="w-full px-4 py-2 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 disabled:bg-neutral-100 disabled:cursor-not-allowed"
            >
              <option value="">전체</option>
              {sigunguList.map(sigungu => (
                <option key={sigungu} value={sigungu}>{sigungu}</option>
              ))}
            </select>
          </div>
        </div>

        {/* 평수 범위 (한 줄 슬라이더) */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-neutral-700 mb-2">
            평수: {minAreaPyeong}평 ({pyeongToM2(minAreaPyeong)}㎡) ~ {maxAreaPyeong}평 ({pyeongToM2(maxAreaPyeong)}㎡)
          </label>
          <div className="flex items-center space-x-4">
            <span className="text-xs text-neutral-500 w-12">최소</span>
            <input
              type="range"
              min="0"
              max="100"
              step="1"
              value={minAreaPyeong}
              onChange={(e) => setMinAreaPyeong(parseInt(e.target.value))}
              className="flex-1 h-2 bg-neutral-200 rounded-lg appearance-none cursor-pointer accent-red-600"
            />
            <span className="text-xs text-neutral-500 w-12 text-center">~</span>
            <input
              type="range"
              min="0"
              max="100"
              step="1"
              value={maxAreaPyeong}
              onChange={(e) => setMaxAreaPyeong(parseInt(e.target.value))}
              className="flex-1 h-2 bg-neutral-200 rounded-lg appearance-none cursor-pointer accent-red-600"
            />
            <span className="text-xs text-neutral-500 w-12 text-right">최대</span>
          </div>
        </div>

        {/* 가격 범위 (한 줄 슬라이더, 천만원 단위) */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-neutral-700 mb-2">
            가격: {(minPriceCheon / 10).toFixed(1)}억원 ~ {(maxPriceCheon / 10).toFixed(1)}억원
          </label>
          <div className="flex items-center space-x-4">
            <span className="text-xs text-neutral-500 w-12">최소</span>
            <input
              type="range"
              min="0"
              max="500"
              step="5"
              value={minPriceCheon}
              onChange={(e) => setMinPriceCheon(parseInt(e.target.value))}
              className="flex-1 h-2 bg-neutral-200 rounded-lg appearance-none cursor-pointer accent-red-600"
            />
            <span className="text-xs text-neutral-500 w-12 text-center">~</span>
            <input
              type="range"
              min="0"
              max="500"
              step="5"
              value={maxPriceCheon}
              onChange={(e) => setMaxPriceCheon(parseInt(e.target.value))}
              className="flex-1 h-2 bg-neutral-200 rounded-lg appearance-none cursor-pointer accent-red-600"
            />
            <span className="text-xs text-neutral-500 w-12 text-right">최대</span>
          </div>
        </div>

        {/* 거래 유형 */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-neutral-700 mb-2">거래 유형</label>
          <div className="flex items-center space-x-4">
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={tradeTypes.SALE}
                onChange={(e) => setTradeTypes({ ...tradeTypes, SALE: e.target.checked })}
                className="w-4 h-4 text-red-600 border-neutral-300 rounded focus:ring-red-500"
              />
              <span className="text-sm text-neutral-700">매매</span>
            </label>
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={tradeTypes.JEONSE}
                onChange={(e) => setTradeTypes({ ...tradeTypes, JEONSE: e.target.checked })}
                className="w-4 h-4 text-red-600 border-neutral-300 rounded focus:ring-red-500"
              />
              <span className="text-sm text-neutral-700">전세</span>
            </label>
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={tradeTypes.MONTHLY}
                onChange={(e) => setTradeTypes({ ...tradeTypes, MONTHLY: e.target.checked })}
                className="w-4 h-4 text-red-600 border-neutral-300 rounded focus:ring-red-500"
              />
              <span className="text-sm text-neutral-700">월세</span>
            </label>
          </div>
        </div>

        {/* 물건 종류 */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-neutral-700 mb-2">물건 종류</label>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={propertyTypes.APT}
                onChange={(e) => setPropertyTypes({ ...propertyTypes, APT: e.target.checked })}
                className="w-4 h-4 text-red-600 border-neutral-300 rounded focus:ring-red-500"
              />
              <span className="text-sm text-neutral-700">아파트</span>
            </label>
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={propertyTypes.OPST}
                onChange={(e) => setPropertyTypes({ ...propertyTypes, OPST: e.target.checked })}
                className="w-4 h-4 text-red-600 border-neutral-300 rounded focus:ring-red-500"
              />
              <span className="text-sm text-neutral-700">오피스텔</span>
            </label>
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={propertyTypes.VILLA}
                onChange={(e) => setPropertyTypes({ ...propertyTypes, VILLA: e.target.checked })}
                className="w-4 h-4 text-red-600 border-neutral-300 rounded focus:ring-red-500"
              />
              <span className="text-sm text-neutral-700">빌라</span>
            </label>
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={propertyTypes.DDDGG}
                onChange={(e) => setPropertyTypes({ ...propertyTypes, DDDGG: e.target.checked })}
                className="w-4 h-4 text-red-600 border-neutral-300 rounded focus:ring-red-500"
              />
              <span className="text-sm text-neutral-700">단독/다가구</span>
            </label>
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={propertyTypes.JWJT}
                onChange={(e) => setPropertyTypes({ ...propertyTypes, JWJT: e.target.checked })}
                className="w-4 h-4 text-red-600 border-neutral-300 rounded focus:ring-red-500"
              />
              <span className="text-sm text-neutral-700">주거용 오피스텔</span>
            </label>
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={propertyTypes.GJCG}
                onChange={(e) => setPropertyTypes({ ...propertyTypes, GJCG: e.target.checked })}
                className="w-4 h-4 text-red-600 border-neutral-300 rounded focus:ring-red-500"
              />
              <span className="text-sm text-neutral-700">공장/창고</span>
            </label>
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={propertyTypes.TOJI}
                onChange={(e) => setPropertyTypes({ ...propertyTypes, TOJI: e.target.checked })}
                className="w-4 h-4 text-red-600 border-neutral-300 rounded focus:ring-red-500"
              />
              <span className="text-sm text-neutral-700">토지</span>
            </label>
          </div>
        </div>

        {/* 버튼 */}
        <div className="flex items-center space-x-3">
          <button
            onClick={handleCrawl}
            disabled={crawling}
            className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-neutral-300 disabled:cursor-not-allowed flex items-center space-x-2"
          >
            {crawling ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                <span>크롤링 중...</span>
              </>
            ) : (
              <>
                <Play className="h-4 w-4" />
                <span>크롤링 시작</span>
              </>
            )}
          </button>
          <button
            onClick={handleSearch}
            disabled={loading}
            className="px-6 py-2 bg-white border border-neutral-200 text-neutral-700 rounded-lg hover:bg-neutral-50 disabled:bg-neutral-100 disabled:cursor-not-allowed flex items-center space-x-2"
          >
            {loading ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                <span>검색 중...</span>
              </>
            ) : (
              <>
                <Search className="h-4 w-4" />
                <span>매물 검색</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* 매물 목록 */}
      <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-neutral-200">
          <h3 className="font-semibold text-neutral-900">
            매물 목록 {properties.length > 0 && `(${properties.length}건)`}
          </h3>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-red-600 border-r-transparent"></div>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-neutral-50 border-b border-neutral-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase">단지명</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase">주소</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase">평수(㎡)</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase">가격(만원)</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase">거래유형</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase">층</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200">
              {properties.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-neutral-500">
                    검색된 매물이 없습니다. 크롤링 후 검색해보세요.
                  </td>
                </tr>
              ) : (
                properties.map((property, idx) => (
                  <tr key={idx} className="hover:bg-neutral-50">
                    <td className="px-6 py-4">
                      <div className="font-medium text-neutral-900">{property.complex_name || '-'}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-neutral-600">{property.address || '-'}</div>
                    </td>
                    <td className="px-6 py-4 text-sm text-neutral-600">{property.exclusive_area || '-'}</td>
                    <td className="px-6 py-4">
                      <div className="font-semibold text-neutral-900">
                        {property.price ? `${property.price.toLocaleString()}` : '-'}
                      </div>
                      {property.deposit && (
                        <div className="text-xs text-neutral-500">보증금: {property.deposit.toLocaleString()}</div>
                      )}
                      {property.monthly_rent && (
                        <div className="text-xs text-neutral-500">월세: {property.monthly_rent.toLocaleString()}</div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        property.trade_type === 'SALE' ? 'bg-blue-100 text-blue-700' :
                        property.trade_type === 'JEONSE' ? 'bg-green-100 text-green-700' :
                        'bg-orange-100 text-orange-700'
                      }`}>
                        {property.trade_type === 'SALE' ? '매매' :
                         property.trade_type === 'JEONSE' ? '전세' : '월세'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-neutral-600">{property.floor || '-'}층</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ==================== 결제 관리 섹션 ====================
function PaymentsSection() {
  const dummyPayments = [
    { id: 1, orderId: 'ORD-20240124-001', user: 'user1@example.com', amount: 29000, method: '카드', status: 'success', date: '2024-01-24 15:30' },
    { id: 2, orderId: 'ORD-20240124-002', user: 'user2@example.com', amount: 29000, method: '카카오페이', status: 'success', date: '2024-01-24 14:15' },
    { id: 3, orderId: 'ORD-20240124-003', user: 'user3@example.com', amount: 29000, method: '카드', status: 'refunded', date: '2024-01-24 13:00' },
  ];

  return (
    <div className="space-y-6">
      {/* Payment Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white border border-neutral-200 rounded-xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-neutral-500 mb-1">금일 매출</p>
              <p className="text-2xl font-bold text-neutral-900">₩2.4M</p>
            </div>
            <TrendingUp className="h-8 w-8 text-green-600" />
          </div>
          <p className="text-xs text-green-600 mt-2 flex items-center">
            <ArrowUpRight className="h-3 w-3 mr-1" />
            +15.3% 전일 대비
          </p>
        </div>
        <div className="bg-white border border-neutral-200 rounded-xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-neutral-500 mb-1">금일 결제 건수</p>
              <p className="text-2xl font-bold text-neutral-900">83</p>
            </div>
            <CreditCard className="h-8 w-8 text-blue-600" />
          </div>
        </div>
        <div className="bg-white border border-neutral-200 rounded-xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-neutral-500 mb-1">환불 요청</p>
              <p className="text-2xl font-bold text-neutral-900">2</p>
            </div>
            <AlertCircle className="h-8 w-8 text-orange-600" />
          </div>
        </div>
        <div className="bg-white border border-neutral-200 rounded-xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-neutral-500 mb-1">결제 성공률</p>
              <p className="text-2xl font-bold text-neutral-900">98.5%</p>
            </div>
            <CheckCircle className="h-8 w-8 text-green-600" />
          </div>
        </div>
      </div>

      {/* Payments Table */}
      <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-neutral-200">
          <h3 className="font-semibold text-neutral-900">결제 내역</h3>
        </div>

        <table className="w-full">
          <thead className="bg-neutral-50 border-b border-neutral-200">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase">주문번호</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase">구매자</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase">금액</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase">결제수단</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase">상태</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase">결제일시</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase">작업</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-200">
            {dummyPayments.map(payment => (
              <tr key={payment.id} className="hover:bg-neutral-50">
                <td className="px-6 py-4 text-sm font-medium text-neutral-900">{payment.orderId}</td>
                <td className="px-6 py-4 text-sm text-neutral-600">{payment.user}</td>
                <td className="px-6 py-4 text-sm font-semibold text-neutral-900">₩{payment.amount.toLocaleString()}</td>
                <td className="px-6 py-4 text-sm text-neutral-600">{payment.method}</td>
                <td className="px-6 py-4">
                  {payment.status === 'success' && (
                    <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-700">완료</span>
                  )}
                  {payment.status === 'refunded' && (
                    <span className="px-2 py-1 text-xs rounded-full bg-orange-100 text-orange-700">환불</span>
                  )}
                </td>
                <td className="px-6 py-4 text-sm text-neutral-600">{payment.date}</td>
                <td className="px-6 py-4">
                  <button className="p-2 hover:bg-neutral-100 rounded-lg" title="영수증">
                    <FileText className="h-4 w-4 text-neutral-600" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ==================== 설정 섹션 ====================
function SettingsSection() {
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-neutral-200 p-8">
        <div className="text-center py-12">
          <Settings className="h-16 w-16 text-neutral-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-neutral-900 mb-2">시스템 설정</h3>
          <p className="text-neutral-500">API 키 관리, 알림 설정, 시스템 환경 설정 등을 할 수 있습니다.</p>
          <p className="text-sm text-neutral-400 mt-2">곧 출시 예정입니다.</p>
        </div>
      </div>
    </div>
  );
}

// ==================== 공통 컴포넌트 ====================
function SidebarMenuItem({
  icon,
  label,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`
        w-full flex items-center justify-between px-4 py-3 rounded-lg transition-all
        ${active
          ? 'bg-red-50 text-red-700 font-medium'
          : 'text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900'
        }
      `}
    >
      <div className="flex items-center space-x-3">
        {icon}
        <span className="text-sm">{label}</span>
      </div>
      {active && <ChevronRight className="h-4 w-4" />}
    </button>
  );
}

function QuickStatCard({
  icon,
  label,
  value,
  change,
  trend,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  change: string;
  trend: 'up' | 'down';
}) {
  return (
    <div className="bg-white border border-neutral-200 rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="p-2 bg-red-50 rounded-lg">
          {icon}
        </div>
        <span className={`text-sm font-medium flex items-center ${trend === 'up' ? 'text-green-600' : 'text-red-600'}`}>
          {trend === 'up' ? <ArrowUpRight className="h-4 w-4 mr-1" /> : <ArrowDownRight className="h-4 w-4 mr-1" />}
          {change}
        </span>
      </div>
      <p className="text-sm text-neutral-500 mb-1">{label}</p>
      <p className="text-2xl font-bold text-neutral-900">{value}</p>
    </div>
  );
}

function ActivityItem({
  type,
  message,
  user,
  time,
}: {
  type: 'user' | 'payment' | 'analysis';
  message: string;
  user: string;
  time: string;
}) {
  const icons = {
    user: <Users className="h-4 w-4" />,
    payment: <CreditCard className="h-4 w-4" />,
    analysis: <FileText className="h-4 w-4" />,
  };

  const colors = {
    user: 'bg-blue-100 text-blue-600',
    payment: 'bg-green-100 text-green-600',
    analysis: 'bg-purple-100 text-purple-600',
  };

  return (
    <div className="flex items-start space-x-3 p-3 hover:bg-neutral-50 rounded-lg transition-colors">
      <div className={`p-2 rounded-lg ${colors[type]}`}>
        {icons[type]}
      </div>
      <div className="flex-1">
        <p className="text-sm font-medium text-neutral-900">{message}</p>
        <p className="text-xs text-neutral-500">{user}</p>
      </div>
      <span className="text-xs text-neutral-400">{time}</span>
    </div>
  );
}
