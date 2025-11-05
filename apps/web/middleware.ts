import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { hostname, pathname } = request.nextUrl;

  // ✅ API 경로는 리다이렉트하지 않음 (완전 제외)
  if (pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  // ✅ 정적 자산 제외
  if (
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/static/') ||
    pathname.match(/\.(ico|png|jpg|jpeg|svg|webp|avif|woff|woff2|ttf|eot)$/)
  ) {
    return NextResponse.next();
  }

  // ✅ apex 도메인 (zipcheck.kr) → www 리다이렉트
  if (hostname === 'zipcheck.kr') {
    const url = request.nextUrl.clone();
    url.hostname = 'www.zipcheck.kr';
    url.protocol = 'https:';
    return NextResponse.redirect(url, 308); // 308 Permanent Redirect
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
