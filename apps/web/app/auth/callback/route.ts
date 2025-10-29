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
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
    if (exchangeError) {
      console.error('Code exchange error:', exchangeError);
      return NextResponse.redirect(`${origin}/?error=auth_failed`);
    }
  }

  // Handle Naver OAuth (custom token)
  if (naverToken) {
    const { error: sessionError } = await supabase.auth.setSession({
      access_token: naverToken,
      refresh_token: naverToken, // 네이버는 리프레시 토큰이 없으므로 동일한 토큰 사용
    });

    if (sessionError) {
      console.error('Naver session error:', sessionError);
      return NextResponse.redirect(`${origin}/?error=auth_failed`);
    }
  }

  // Verify session was created
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();

  if (sessionError || !session) {
    console.error('Session verification failed:', sessionError);
    return NextResponse.redirect(`${origin}/?error=no_session`);
  }

  console.log('OAuth callback success, user:', session.user.email);

  // Success - redirect to home
  return NextResponse.redirect(`${origin}/`);
}
