/**
 * OAuth Callback Route Handler (Server-side)
 *
 * This handles OAuth redirects from Google/Kakao/Naver.
 * It exchanges the code for a session and stores it in cookies (SSR).
 */

import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const error = requestUrl.searchParams.get('error');
  const naverToken = requestUrl.searchParams.get('naver_token');
  const origin = requestUrl.origin;

  const cookieStore = await cookies();

  // Create Supabase SSR client
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
            // Server component에서 set이 안 될 수 있음
            console.error('Cookie set error:', error);
          }
        },
        remove(name: string, options: any) {
          try {
            cookieStore.set({ name, value: '', ...options });
          } catch (error) {
            console.error('Cookie remove error:', error);
          }
        },
      },
    }
  );

  // Check for errors from OAuth provider
  if (error) {
    console.error('OAuth error:', error);
    return NextResponse.redirect(`${origin}/?error=${encodeURIComponent(error)}`);
  }

  // Handle OAuth code exchange (Google/Kakao)
  if (code) {
    console.log('[OAuth Callback] Exchanging code for session...');
    const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
    if (exchangeError) {
      console.error('[OAuth Callback] ❌ Code exchange error:', exchangeError);
      return NextResponse.redirect(`${origin}/?error=auth_failed`);
    }
    console.log('[OAuth Callback] ✅ Code exchange success, user:', data.session?.user.email);
  }

  // Handle Naver OAuth (custom token)
  if (naverToken) {
    console.log('[OAuth Callback] Setting Naver session...');
    const { data, error: sessionError } = await supabase.auth.setSession({
      access_token: naverToken,
      refresh_token: naverToken, // 네이버는 리프레시 토큰이 없으므로 동일한 토큰 사용
    });

    if (sessionError) {
      console.error('[OAuth Callback] ❌ Naver session error:', sessionError);
      return NextResponse.redirect(`${origin}/?error=auth_failed`);
    }
    console.log('[OAuth Callback] ✅ Naver session success, user:', data.session?.user.email);
  }

  // Verify session was created
  console.log('[OAuth Callback] Verifying session...');
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();

  if (sessionError || !session) {
    console.error('[OAuth Callback] ❌ Session verification failed:', sessionError);
    return NextResponse.redirect(`${origin}/?error=no_session`);
  }

  console.log('[OAuth Callback] ✅ Session verified');
  console.log('[OAuth Callback] User:', session.user.email);
  console.log('[OAuth Callback] Token preview:', session.access_token.substring(0, 20) + '...');
  console.log('[OAuth Callback] Token expires at:', new Date(session.expires_at! * 1000).toISOString());

  // Success - redirect to home
  return NextResponse.redirect(`${origin}/`);
}
