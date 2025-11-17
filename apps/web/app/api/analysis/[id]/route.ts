/**
 * 분석 실행 API
 */


import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authHeader = request.headers.get('authorization');
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
          set(name: string, value: string, options: any) {
            try {
              cookieStore.set({ name, value, ...options });
            } catch (error) {
              console.warn(`[analysis] Cookie set failed for ${name}:`, error);
            }
          },
          remove(name: string, options: any) {
            try {
              cookieStore.set({ name, value: '', ...options });
            } catch (error) {
              console.warn(`[analysis] Cookie remove failed for ${name}:`, error);
            }
          },
        },
      }
    );

    // Multi-tier authentication: Authorization header -> Supabase session -> Cookie fallback
    let bearerToken: string | undefined;
    let userId: string | undefined;

    if (authHeader?.startsWith('Bearer ')) {
      bearerToken = authHeader.slice('Bearer '.length).trim();
      console.log('[analysis] Using token from Authorization header');

      // Verify token and get user info
      const { data: { user }, error } = await supabase.auth.getUser(bearerToken);
      if (error || !user) {
        console.error('[analysis] Invalid token:', error);
        return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
      }
      userId = user.id;
    } else {
      console.log('[analysis] Fetching session from Supabase...');
      const { data: { session } } = await supabase.auth.getSession();

      if (session?.access_token) {
        bearerToken = session.access_token;
        userId = session.user.id;
        console.log('[analysis] Using token from Supabase session');
      } else {
        // Fallback: try well-known cookie names
        const cookieAccess = cookieStore.get('sb-access-token')?.value
          || cookieStore.get('sb:token')?.value
          || cookieStore.get('supabase-auth-token')?.value;

        if (cookieAccess) {
          try {
            if (cookieAccess.startsWith('{')) {
              const parsed = JSON.parse(cookieAccess);
              bearerToken = parsed?.access_token || parsed?.currentSession?.access_token;
            } else {
              bearerToken = cookieAccess;
            }

            if (bearerToken) {
              const { data: { user }, error } = await supabase.auth.getUser(bearerToken);
              if (user && !error) {
                userId = user.id;
                console.log('[analysis] Using token from cookie');
              }
            }
          } catch (e) {
            console.warn('[analysis] Failed parsing token cookie:', e);
          }
        }
      }
    }

    if (!bearerToken || !userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: caseId } = await params;

    console.log(`[analysis] Looking for case: ${caseId}, user: ${userId}`);

    // 케이스 조회
    const { data: caseData, error: caseError } = await supabase
      .from('v2_cases')
      .select('*')
      .eq('id', caseId)
      .eq('user_id', userId)
      .single();

    if (caseError || !caseData) {
      console.error(`[analysis] Case not found. Error:`, caseError);
      console.error(`[analysis] Data:`, caseData);
      return NextResponse.json({ error: 'Case not found' }, { status: 404 });
    }

    console.log(`[analysis] Case found:`, caseData.id);

    // TODO: 실제 백엔드 FastAPI 서버로 분석 요청
    // const backendUrl = process.env.BACKEND_URL || 'http://localhost:8000';
    // const response = await fetch(`${backendUrl}/analyze/${caseId}`, {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    // });

    // 임시: 케이스 상태를 report로 업데이트
    await supabase
      .from('v2_cases')
      .update({ state: 'report' })
      .eq('id', caseId);

    return NextResponse.json({ ok: true, caseId });
  } catch (error) {
    console.error('Analysis error:', error);
    return NextResponse.json(
      { error: 'Failed to run analysis' },
      { status: 500 }
    );
  }
}
