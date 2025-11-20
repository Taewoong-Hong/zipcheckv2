/**
 * 분석 실행 API (v2)
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

      // Skip token verification here - FastAPI will handle it with service role key
      // This prevents token corruption that occurs during getUser() call
      // userId will be extracted by FastAPI from the token
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

    if (!bearerToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: caseId } = await params;

    // FastAPI handles case validation with service role key to avoid RLS issues
    console.log(`[analysis] Starting analysis for case: ${caseId}`);

    // ✅ FastAPI 백엔드로 분석 요청
    const backendUrl = process.env.AI_API_URL;
    console.log(`[analysis] AI_API_URL debug:`, backendUrl);
    console.log(`[analysis] All env vars:`, {
      AI_API_URL: process.env.AI_API_URL,
      NEXT_PUBLIC_AI_API_URL: process.env.NEXT_PUBLIC_AI_API_URL
    });

    if (!backendUrl) {
      console.error('[analysis] AI_API_URL not configured - check .env.local');
      return NextResponse.json({ error: 'Backend URL not configured' }, { status: 500 });
    }

    console.log(`[analysis] Calling FastAPI: ${backendUrl}/analyze/start`);
    console.log(`[analysis] Token debug - length: ${bearerToken?.length}, first 50 chars: ${bearerToken?.substring(0, 50)}...`);
    console.log(`[analysis] Token debug - last 50 chars: ...${bearerToken?.substring(bearerToken.length - 50)}`);

    try {
      const response = await fetch(`${backendUrl}/analyze/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${bearerToken}`,
        },
        body: JSON.stringify({
          case_id: caseId,
        }),
      });

      console.log(`[analysis] FastAPI response status: ${response.status}`);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[analysis] FastAPI error:`, errorText);
        return NextResponse.json(
          { error: `Analysis failed: ${errorText}` },
          { status: response.status }
        );
      }

      const analysisResult = await response.json();
      console.log(`[analysis] Analysis started:`, analysisResult);

      return NextResponse.json({ ok: true, caseId, result: analysisResult });
    } catch (fetchError) {
      console.error('[analysis] FastAPI connection error:', fetchError);
      return NextResponse.json(
        { error: 'Failed to connect to analysis backend' },
        { status: 503 }
      );
    }
  } catch (error) {
    console.error('Analysis error:', error);
    return NextResponse.json(
      { error: 'Failed to run analysis' },
      { status: 500 }
    );
  }
}
