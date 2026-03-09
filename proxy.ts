import { NextResponse, type NextRequest } from 'next/server';

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith('/executions/')) {
    const nextUrl = request.nextUrl.clone();
    nextUrl.pathname = pathname.replace(/^\/executions\//, '/runs/');
    return NextResponse.redirect(nextUrl);
  }

  if (pathname.startsWith('/api/test-executions/')) {
    const parts = pathname.split('/').filter(Boolean);
    const isPlainDetailEndpoint = parts.length === 3 && parts[0] === 'api' && parts[1] === 'test-executions';
    if (isPlainDetailEndpoint) {
      const nextUrl = request.nextUrl.clone();
      nextUrl.pathname = `/api/execution-details/${parts[2]}`;
      return NextResponse.redirect(nextUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/executions/:path*', '/api/test-executions/:path*'],
};
