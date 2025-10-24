/**
 * KPI 카드 컴포넌트
 *
 * GA4 Data API에서 조회한 핵심 지표를 카드 형태로 표시
 */

'use client';

import { useEffect, useState } from 'react';
import { Users, UserPlus, Activity, MousePointer, TrendingUp, Clock } from 'lucide-react';

interface KPIData {
  activeUsers: number;
  newUsers: number;
  sessions: number;
  eventCount: number;
  engagementRate: number;
  averageSessionDuration: number;
}

interface EventData {
  eventName: string;
  eventCount: number;
}

export default function KPICards() {
  const [kpiData, setKpiData] = useState<KPIData | null>(null);
  const [events, setEvents] = useState<EventData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchKPIData();
  }, []);

  async function fetchKPIData() {
    try {
      const response = await fetch('/api/admin/ga/overview', {
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // 쿠키 포함
      });

      if (!response.ok) {
        throw new Error('KPI 데이터를 불러올 수 없습니다.');
      }

      const data = await response.json();
      setKpiData(data.kpi);
      setEvents(data.events || []);
    } catch (err: any) {
      console.error('KPI 데이터 조회 실패:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700 animate-pulse"
          >
            <div className="h-12 bg-gray-700 rounded mb-4"></div>
            <div className="h-8 bg-gray-700 rounded"></div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-6 text-center">
        <p className="text-red-400">{error}</p>
        <button
          onClick={fetchKPIData}
          className="mt-4 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
        >
          다시 시도
        </button>
      </div>
    );
  }

  if (!kpiData) {
    return null;
  }

  // 주요 이벤트 카운트 추출
  const getEventCount = (eventName: string): number => {
    const event = events.find((e) => e.eventName === eventName);
    return event?.eventCount || 0;
  };

  const formatDuration = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes}m ${secs}s`;
  };

  return (
    <>
      {/* 기본 KPI */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
        <KPICard
          icon={<Users className="h-6 w-6" />}
          title="활성 사용자"
          value={kpiData.activeUsers.toLocaleString()}
          subtitle="최근 7일"
          color="pink"
        />
        <KPICard
          icon={<UserPlus className="h-6 w-6" />}
          title="신규 사용자"
          value={kpiData.newUsers.toLocaleString()}
          subtitle="최근 7일"
          color="blue"
        />
        <KPICard
          icon={<Activity className="h-6 w-6" />}
          title="세션 수"
          value={kpiData.sessions.toLocaleString()}
          subtitle="최근 7일"
          color="green"
        />
        <KPICard
          icon={<MousePointer className="h-6 w-6" />}
          title="이벤트 발생"
          value={kpiData.eventCount.toLocaleString()}
          subtitle="전체 이벤트"
          color="purple"
        />
        <KPICard
          icon={<TrendingUp className="h-6 w-6" />}
          title="참여율"
          value={`${(kpiData.engagementRate * 100).toFixed(1)}%`}
          subtitle="평균 참여율"
          color="orange"
        />
        <KPICard
          icon={<Clock className="h-6 w-6" />}
          title="평균 세션"
          value={formatDuration(kpiData.averageSessionDuration)}
          subtitle="세션 지속 시간"
          color="cyan"
        />
      </div>

      {/* 주요 이벤트 카운트 */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <EventCard
          title="집체크 시작"
          value={getEventCount('start_zipcheck')}
          color="pink"
        />
        <EventCard
          title="주소 제출"
          value={getEventCount('address_submitted')}
          color="blue"
        />
        <EventCard
          title="PDF 업로드"
          value={getEventCount('pdf_uploaded')}
          color="green"
        />
        <EventCard
          title="리포트 조회"
          value={getEventCount('report_viewed')}
          color="purple"
        />
        <EventCard
          title="회원가입 완료"
          value={getEventCount('signup_completed')}
          color="orange"
        />
        <EventCard
          title="결제 성공"
          value={getEventCount('plan_payment_success')}
          color="cyan"
        />
      </div>
    </>
  );
}

// KPI Card Component
function KPICard({
  icon,
  title,
  value,
  subtitle,
  color,
}: {
  icon: React.ReactNode;
  title: string;
  value: string;
  subtitle: string;
  color: 'pink' | 'blue' | 'green' | 'purple' | 'orange' | 'cyan';
}) {
  const colorClasses = {
    pink: 'bg-pink-500/10 text-pink-500 border-pink-500/20',
    blue: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
    green: 'bg-green-500/10 text-green-500 border-green-500/20',
    purple: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
    orange: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
    cyan: 'bg-cyan-500/10 text-cyan-500 border-cyan-500/20',
  };

  return (
    <div
      className={`p-6 rounded-xl border ${colorClasses[color]} backdrop-blur-sm hover:scale-105 transition-transform`}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="opacity-80">{icon}</div>
      </div>
      <div>
        <p className="text-3xl font-bold text-white mb-1">{value}</p>
        <p className="text-sm font-medium mb-1">{title}</p>
        <p className="text-xs opacity-60">{subtitle}</p>
      </div>
    </div>
  );
}

// Event Card Component
function EventCard({
  title,
  value,
  color,
}: {
  title: string;
  value: number;
  color: 'pink' | 'blue' | 'green' | 'purple' | 'orange' | 'cyan';
}) {
  const colorClasses = {
    pink: 'bg-pink-500/5 border-pink-500/10 text-pink-400',
    blue: 'bg-blue-500/5 border-blue-500/10 text-blue-400',
    green: 'bg-green-500/5 border-green-500/10 text-green-400',
    purple: 'bg-purple-500/5 border-purple-500/10 text-purple-400',
    orange: 'bg-orange-500/5 border-orange-500/10 text-orange-400',
    cyan: 'bg-cyan-500/5 border-cyan-500/10 text-cyan-400',
  };

  return (
    <div className={`p-4 rounded-lg border ${colorClasses[color]} backdrop-blur-sm`}>
      <p className="text-2xl font-bold text-white mb-1">{value.toLocaleString()}</p>
      <p className="text-xs font-medium">{title}</p>
    </div>
  );
}
