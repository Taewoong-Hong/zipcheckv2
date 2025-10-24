/**
 * 유입 채널 TOP 10 차트 컴포넌트
 *
 * GA4 Data API에서 sessionDefaultChannelGroup별 활성 사용자 및 세션 수 표시
 */

'use client';

import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface ChannelData {
  channelGroup: string;
  activeUsers: number;
  sessions: number;
}

export default function ChannelChart() {
  const [channelData, setChannelData] = useState<ChannelData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchChannelData();
  }, []);

  async function fetchChannelData() {
    try {
      const response = await fetch('/api/admin/ga/overview', {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('채널 데이터를 불러올 수 없습니다.');
      }

      const data = await response.json();
      const channels: ChannelData[] = data.channels || [];

      // 한글로 채널명 변환
      const translatedChannels = channels.map((channel) => ({
        ...channel,
        channelGroup: translateChannelName(channel.channelGroup),
      }));

      setChannelData(translatedChannels);
    } catch (err: any) {
      console.error('채널 데이터 조회 실패:', err);
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

  if (channelData.length === 0) {
    return (
      <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700 text-center">
        <p className="text-gray-400">채널 데이터가 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700">
      {/* 차트 */}
      <ResponsiveContainer width="100%" height={400}>
        <BarChart data={channelData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis
            dataKey="channelGroup"
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
          <Legend
            wrapperStyle={{ paddingTop: '20px' }}
            iconType="circle"
            formatter={(value) => <span className="text-gray-300">{value}</span>}
          />
          <Bar dataKey="activeUsers" fill="#EC4899" name="활성 사용자" radius={[8, 8, 0, 0]} />
          <Bar dataKey="sessions" fill="#3B82F6" name="세션 수" radius={[8, 8, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>

      {/* 상세 테이블 */}
      <div className="mt-6 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-gray-700">
            <tr className="text-left text-gray-400">
              <th className="pb-3 pr-4">순위</th>
              <th className="pb-3 pr-4">채널</th>
              <th className="pb-3 pr-4 text-right">활성 사용자</th>
              <th className="pb-3 pr-4 text-right">세션 수</th>
              <th className="pb-3 text-right">세션/사용자</th>
            </tr>
          </thead>
          <tbody className="text-gray-300">
            {channelData.map((channel, index) => {
              const sessionsPerUser = channel.activeUsers > 0 ? channel.sessions / channel.activeUsers : 0;
              return (
                <tr key={channel.channelGroup} className="border-b border-gray-700/50">
                  <td className="py-3 pr-4">
                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-pink-500/10 text-pink-500 text-xs font-bold">
                      {index + 1}
                    </span>
                  </td>
                  <td className="py-3 pr-4 font-medium text-white">{channel.channelGroup}</td>
                  <td className="py-3 pr-4 text-right">{channel.activeUsers.toLocaleString()}</td>
                  <td className="py-3 pr-4 text-right">{channel.sessions.toLocaleString()}</td>
                  <td className="py-3 text-right">{sessionsPerUser.toFixed(2)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Custom Tooltip
function CustomTooltip({ active, payload, label }: any) {
  if (active && payload && payload.length) {
    return (
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 shadow-xl">
        <p className="font-bold text-white mb-2">{label}</p>
        {payload.map((entry: any, index: number) => (
          <p key={index} className="text-sm" style={{ color: entry.color }}>
            {entry.name}: {entry.value.toLocaleString()}
          </p>
        ))}
      </div>
    );
  }
  return null;
}

// 채널명 한글 변환
function translateChannelName(channelGroup: string): string {
  const translations: Record<string, string> = {
    'Organic Search': '자연 검색',
    'Direct': '직접 유입',
    'Referral': '추천',
    'Organic Social': '소셜 미디어',
    'Paid Search': '유료 검색',
    'Paid Social': '유료 소셜',
    'Display': '디스플레이 광고',
    'Email': '이메일',
    'Affiliates': '제휴',
    'Video': '동영상',
    'Unassigned': '미분류',
    'Cross-network': '크로스 네트워크',
    'Organic Shopping': '자연 쇼핑',
    'Paid Shopping': '유료 쇼핑',
    'Other': '기타',
  };

  return translations[channelGroup] || channelGroup;
}
