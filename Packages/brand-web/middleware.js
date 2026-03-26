import { NextResponse } from 'next/server';
export function middleware(request) {
  const { pathname } = request.nextUrl;
  if (pathname.startsWith('/dashboard')) {
    const token = request.cookies.get('inflx_token')?.value;
    if (!token) return NextResponse.redirect(new URL('/login', request.url));
  }
  return NextResponse.next();
}
export const config = { matcher: ['/dashboard/:path*'] };
