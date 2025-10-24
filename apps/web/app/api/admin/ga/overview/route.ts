/**
 * GA4 Data API - 전체 개요 조회
 *
 * GET /api/admin/ga/overview
 *
 * 반환 데이터:
 * - 최근 7일 Active Users
 * - 주요 이벤트 카운트 (start_zipcheck, pdf_uploaded, plan_payment_success 등)
 * - 유입 채널별 사용자 수
 */

import { NextRequest, NextResponse } from 'next/server';
import { BetaAnalyticsDataClient } from '@google-analytics/data';
import { verifyAdminAuth } from '@/lib/admin-auth';

// GA4 클라이언트 초기화
let analyticsDataClient: BetaAnalyticsDataClient | null = null;

function getAnalyticsClient(): BetaAnalyticsDataClient {
  if (!analyticsDataClient) {
    const keyJson = process.env.GA_SERVICE_ACCOUNT_KEY_JSON;
    if (!keyJson) {
      throw new Error('GA_SERVICE_ACCOUNT_KEY_JSON 환경변수가 설정되지 않았습니다.');
    }

    try {
      const credentials = JSON.parse(keyJson);
      analyticsDataClient = new BetaAnalyticsDataClient({ credentials });
    } catch (error) {
      throw new Error('GA 서비스 계정 키 JSON 파싱 실패: ' + error);
    }
  }
  return analyticsDataClient;
}

// 메모리 캐시 (5분)
let cache: {
  data: any;
  timestamp: number;
} | null = null;
const CACHE_TTL = 5 * 60 * 1000; // 5분

export async function GET(request: NextRequest) {
  try {
    // 1. 관리자 권한 확인
    const authResult = await verifyAdminAuth(request);
    if (!authResult.authorized) {
      return NextResponse.json(
        { error: 'Unauthorized', message: authResult.message },
        { status: 401 }
      );
    }

    // 2. 캐시 확인
    if (cache && Date.now() - cache.timestamp < CACHE_TTL) {
      return NextResponse.json({
        ...cache.data,
        cached: true,
        cacheAge: Math.floor((Date.now() - cache.timestamp) / 1000),
      });
    }

    // 3. GA4 Property ID 확인
    const propertyId = process.env.GA4_PROPERTY_ID;
    if (!propertyId) {
      return NextResponse.json(
        { error: 'GA4_PROPERTY_ID 환경변수가 설정되지 않았습니다.' },
        { status: 500 }
      );
    }

    const client = getAnalyticsClient();

    // 4. GA4 Data API 호출 - KPI 데이터
    const [kpiReport] = await client.runReport({
      property: `properties/${propertyId}`,
      dateRanges: [{ startDate: '7daysAgo', endDate: 'today' }],
      dimensions: [],
      metrics: [
        { name: 'activeUsers' },
        { name: 'newUsers' },
        { name: 'sessions' },
        { name: 'eventCount' },
        { name: 'engagementRate' },
        { name: 'averageSessionDuration' },
      ],
    });

    // 5. GA4 Data API 호출 - 주요 이벤트
    const [eventsReport] = await client.runReport({
      property: `properties/${propertyId}`,
      dateRanges: [{ startDate: '7daysAgo', endDate: 'today' }],
      dimensions: [{ name: 'eventName' }],
      metrics: [{ name: 'eventCount' }],
      dimensionFilter: {
        filter: {
          fieldName: 'eventName',
          inListFilter: {
            values: [
              'start_zipcheck',
              'address_submitted',
              'pdf_uploaded',
              'report_viewed',
              'signup_completed',
              'plan_payment_success',
            ],
          },
        },
      },
      limit: 50,
    });

    // 6. GA4 Data API 호출 - 유입 채널
    const [channelsReport] = await client.runReport({
      property: `properties/${propertyId}`,
      dateRanges: [{ startDate: '7daysAgo', endDate: 'today' }],
      dimensions: [{ name: 'sessionDefaultChannelGroup' }],
      metrics: [{ name: 'activeUsers' }, { name: 'sessions' }],
      orderBys: [{ metric: { metricName: 'activeUsers' }, desc: true }],
      limit: 10,
    });

    // 7. 응답 데이터 구성
    const kpiRow = kpiReport.rows?.[0];
    const kpiData = {
      activeUsers: parseInt(kpiRow?.metricValues?.[0]?.value || '0'),
      newUsers: parseInt(kpiRow?.metricValues?.[1]?.value || '0'),
      sessions: parseInt(kpiRow?.metricValues?.[2]?.value || '0'),
      eventCount: parseInt(kpiRow?.metricValues?.[3]?.value || '0'),
      engagementRate: parseFloat(kpiRow?.metricValues?.[4]?.value || '0'),
      averageSessionDuration: parseFloat(kpiRow?.metricValues?.[5]?.value || '0'),
    };

    const events = (eventsReport.rows || []).map((row) => ({
      eventName: row.dimensionValues?.[0]?.value || '',
      eventCount: parseInt(row.metricValues?.[0]?.value || '0'),
    }));

    const channels = (channelsReport.rows || []).map((row) => ({
      channelGroup: row.dimensionValues?.[0]?.value || '',
      activeUsers: parseInt(row.metricValues?.[0]?.value || '0'),
      sessions: parseInt(row.metricValues?.[1]?.value || '0'),
    }));

    const responseData = {
      kpi: kpiData,
      events,
      channels,
      timestamp: new Date().toISOString(),
    };

    // 8. 캐시 저장
    cache = {
      data: responseData,
      timestamp: Date.now(),
    };

    return NextResponse.json({
      ...responseData,
      cached: false,
    });
  } catch (error: any) {
    console.error('GA4 Data API 에러:', error);
    return NextResponse.json(
      {
        error: 'GA4 Data API 호출 실패',
        message: error.message || '알 수 없는 오류',
      },
      { status: 500 }
    );
  }
}
