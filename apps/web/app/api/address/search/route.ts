/**
 * 주소 검색 API
 *
 * @description
 * 행정안전부 도로명주소 API (juso-proxy)를 통해 주소 검색
 *
 * @author 집체크 개발팀
 * @version 1.0.0
 * @date 2025-01-27
 */

import { NextRequest, NextResponse } from 'next/server';

// 행정안전부 도로명주소 API
const JUSO_API_URL = 'https://business.juso.go.kr/addrlink/addrLinkApi.do';
const JUSO_API_KEY = process.env.JUSO_API_KEY || 'devU01TX0FVVEgyMDI1MDEyNzEzMTA0NTExNTE1MzA=';

/**
 * GET /api/address/search
 *
 * @param request - Next.js 요청
 * @returns 주소 검색 결과
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');

    // 검색어 검증
    if (!query || query.trim().length < 2) {
      return NextResponse.json(
        { error: '검색어는 최소 2자 이상이어야 합니다.' },
        { status: 400 }
      );
    }

    // 행정안전부 API 호출
    const params = new URLSearchParams({
      confmKey: JUSO_API_KEY,
      currentPage: '1',
      countPerPage: '20',
      keyword: query.trim(),
      resultType: 'json',
    });

    const response = await fetch(`${JUSO_API_URL}?${params}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Juso API returned ${response.status}`);
    }

    const data = await response.json();

    // API 응답 형식 확인
    if (!data.results || !data.results.common) {
      throw new Error('Invalid API response format');
    }

    // 오류 코드 체크
    const errorCode = data.results.common.errorCode;
    if (errorCode !== '0') {
      const errorMessage = data.results.common.errorMessage || 'Unknown error';
      throw new Error(`Juso API error: ${errorCode} - ${errorMessage}`);
    }

    // 검색 결과 반환
    const results = data.results.juso || [];

    return NextResponse.json({
      results: results,
      count: results.length,
      totalCount: parseInt(data.results.common.totalCount || '0', 10),
    });
  } catch (error) {
    console.error('Address search error:', error);

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : '주소 검색 중 오류가 발생했습니다.',
        results: [],
        count: 0,
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/address/search
 *
 * @param request - Next.js 요청 (JSON body: { query: string })
 * @returns 주소 검색 결과
 */
export async function POST(request: NextRequest) {
  try {
    const { query } = await request.json();

    // 검색어 검증
    if (!query || query.trim().length < 2) {
      return NextResponse.json(
        { error: '검색어는 최소 2자 이상이어야 합니다.' },
        { status: 400 }
      );
    }

    // 행정안전부 API 호출
    const params = new URLSearchParams({
      confmKey: JUSO_API_KEY,
      currentPage: '1',
      countPerPage: '20',
      keyword: query.trim(),
      resultType: 'json',
    });

    const response = await fetch(`${JUSO_API_URL}?${params}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Juso API returned ${response.status}`);
    }

    const data = await response.json();

    // API 응답 형식 확인
    if (!data.results || !data.results.common) {
      throw new Error('Invalid API response format');
    }

    // 오류 코드 체크
    const errorCode = data.results.common.errorCode;
    if (errorCode !== '0') {
      const errorMessage = data.results.common.errorMessage || 'Unknown error';
      throw new Error(`Juso API error: ${errorCode} - ${errorMessage}`);
    }

    // 검색 결과 반환
    const results = data.results.juso || [];

    return NextResponse.json({
      results: results,
      count: results.length,
      totalCount: parseInt(data.results.common.totalCount || '0', 10),
    });
  } catch (error) {
    console.error('Address search error:', error);

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : '주소 검색 중 오류가 발생했습니다.',
        results: [],
        count: 0,
      },
      { status: 500 }
    );
  }
}
