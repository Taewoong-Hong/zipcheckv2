import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const AI_API_URL = process.env.AI_API_URL || 'https://zipcheck-ai-ov5n6pt46a-du.a.run.app';

/**
 * GET /api/chat/sessions
 * 최근 대화 목록 조회
 */
export async function GET(request: NextRequest) {
  try {
    // Supabase 클라이언트 생성 (사용자 토큰 사용)
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    });

    // FastAPI 채팅 API 호출
    const response = await fetch(`${AI_API_URL}/chat/recent?limit=20`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Backend API error: ${response.status}`);
    }

    const data = await response.json();

    return NextResponse.json(data);
  } catch (error) {
    console.error('Get sessions error:', error);
    return NextResponse.json(
      {
        error: '대화 목록 조회 실패',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/chat/sessions
 * 새 대화 세션 시작
 */
export async function POST(request: NextRequest) {
  try {
    // Supabase 클라이언트 생성 (사용자 토큰 사용)
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');

    // FastAPI 채팅 API 호출
    const response = await fetch(`${AI_API_URL}/chat/init`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Backend API error: ${response.status}`);
    }

    const data = await response.json();

    return NextResponse.json(data);
  } catch (error) {
    console.error('Create session error:', error);
    return NextResponse.json(
      {
        error: '대화 생성 실패',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
