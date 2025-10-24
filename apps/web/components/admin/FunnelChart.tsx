/**
 * 전환 퍼널 차트 컴포넌트
 *
 * 사용자 여정: start_zipcheck → address_submitted → pdf_uploaded →
 *             report_viewed → signup_completed → plan_payment_success
 */

'use client';

import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { TrendingDown } from 'lucide-react';

interface EventData {
  eventName: string;
  eventCount: number;
}

interface FunnelStage {
  name: string;
  displayName: string;
  count: number;
  conversionRate: number;
  dropRate: number;
  color: string;
}

const FUNNEL_STAGES = [
  { name: 'start_zipcheck', displayName: '집체크 시작', color: '#EC4899' },
  { name: 'address_submitted', displayName: '주소 제출', color: '#3B82F6' },
  { name: 'pdf_uploaded', displayName: 'PDF 업로드', color: '#10B981' },
  { name: 'report_viewed', displayName: '리포트 조회', color: '#8B5CF6' },
  { name: 'signup_completed', displayName: '회원가입', color: '#F59E0B' },
  { name: 'plan_payment_success', displayName: '결제 완료', color: '#06B6D4' },
];

export default function FunnelChart() {
  const [funnelData, setFunnelData] = useState<FunnelStage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchFunnelData();
  }, []);

  async function fetchFunnelData() {
    try {
      const response = await fetch('/api/admin/ga/overview', {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('퍼널 데이터를 불러올 수 없습니다.');
      }

      const data = await response.json();
      const events: EventData[] = data.events || [];

      // 퍼널 단계별 데이터 구성
      const stages: FunnelStage[] = FUNNEL_STAGES.map((stage, index) => {
        const event = events.find((e) => e.eventName === stage.name);
        const count = event?.eventCount || 0;

        // 전환율 계산 (첫 번째 단계 대비)
        const firstStageCount = events.find((e) => e.eventName === FUNNEL_STAGES[0].name)?.eventCount || 1;
        const conversionRate = (count / firstStageCount) * 100;

        // 이탈률 계산 (이전 단계 대비)
        const prevCount =
          index > 0 ? (events.find((e) => e.eventName === FUNNEL_STAGES[index - 1].name)?.eventCount || 0) : count;
        const dropRate = prevCount > 0 ? ((prevCount - count) / prevCount) * 100 : 0;

        return {
          name: stage.name,
          displayName: stage.displayName,
          count,
          conversionRate: isNaN(conversionRate) ? 0 : conversionRate,
          dropRate: isNaN(dropRate) ? 0 : dropRate,
          color: stage.color,
        };
      });

      setFunnelData(stages);
    } catch (err: any) {
      console.error('퍼널 데이터 조회 실패:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }

  if (isLoading) {
    return (
      <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700">
        <div className="h-96 flex items-center justify-center">
          <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-pink-500 border-r-transparent"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-6 text-center">
        <p className="text-red-400">{error}</p>
      </div>
    );
  }

  const totalStart = funnelData[0]?.count || 0;
  const totalEnd = funnelData[funnelData.length - 1]?.count || 0;
  const overallConversionRate = totalStart > 0 ? (totalEnd / totalStart) * 100 : 0;

  return (
    <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700">
      {/* 전체 전환율 */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-400 mb-1">전체 전환율</p>
          <p className="text-3xl font-bold text-white">{overallConversionRate.toFixed(2)}%</p>
          <p className="text-sm text-gray-500 mt-1">
            {totalStart.toLocaleString()} 시작 → {totalEnd.toLocaleString()} 완료
          </p>
        </div>
      </div>

      {/* 차트 */}
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={funnelData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis
            dataKey="displayName"
            stroke="#9CA3AF"
            angle={-45}
            textAnchor="end"
            height={100}
            tick={{ fontSize: 12 }}
          />
          <YAxis stroke="#9CA3AF" tick={{ fontSize: 12 }} />
          <Tooltip
            content={<CustomTooltip />}
            contentStyle={{
              backgroundColor: '#1F2937',
              border: '1px solid #374151',
              borderRadius: '8px',
            }}
          />
          <Bar dataKey="count" radius={[8, 8, 0, 0]}>
            {funnelData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {/* 단계별 상세 정보 */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {funnelData.map((stage, index) => (
          <StageCard key={stage.name} stage={stage} stageNumber={index + 1} />
        ))}
      </div>
    </div>
  );
}

// Custom Tooltip
function CustomTooltip({ active, payload }: any) {
  if (active && payload && payload.length) {
    const data = payload[0].payload as FunnelStage;
    return (
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 shadow-xl">
        <p className="font-bold text-white mb-2">{data.displayName}</p>
        <p className="text-sm text-gray-300">발생 횟수: {data.count.toLocaleString()}</p>
        <p className="text-sm text-gray-300">전환율: {data.conversionRate.toFixed(2)}%</p>
        {data.dropRate > 0 && (
          <p className="text-sm text-red-400 flex items-center mt-1">
            <TrendingDown className="h-4 w-4 mr-1" />
            이탈률: {data.dropRate.toFixed(2)}%
          </p>
        )}
      </div>
    );
  }
  return null;
}

// Stage Card Component
function StageCard({ stage, stageNumber }: { stage: FunnelStage; stageNumber: number }) {
  return (
    <div className="bg-gray-700/30 rounded-lg p-4 border border-gray-600/50">
      <div className="flex items-center justify-between mb-3">
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white"
          style={{ backgroundColor: stage.color }}
        >
          {stageNumber}
        </div>
        {stage.dropRate > 0 && (
          <div className="flex items-center text-xs text-red-400">
            <TrendingDown className="h-3 w-3 mr-1" />
            {stage.dropRate.toFixed(1)}%
          </div>
        )}
      </div>
      <p className="text-sm font-medium text-white mb-1">{stage.displayName}</p>
      <p className="text-2xl font-bold text-white mb-1">{stage.count.toLocaleString()}</p>
      <div className="flex items-center justify-between text-xs">
        <span className="text-gray-400">전환율</span>
        <span className="text-green-400 font-semibold">{stage.conversionRate.toFixed(1)}%</span>
      </div>
    </div>
  );
}
