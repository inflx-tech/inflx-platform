import { NextResponse } from 'next/server';

// Admin lives on its own host (admin.inflx.in). The real public host (inflx.in)
// must not serve /admin, and the admin host serves only the admin (+ /login).
// Real auth is still enforced server-side on every admin API call; this is host
// routing + the existing login-cookie gate. Redirects are 307 (temporary).
//
// IMPORTANT: the public->admin bounce fires ONLY on the exact prod public host.
// localhost, Vercel preview URLs, etc. keep serving /admin normally so dev / QA /
// preview builds are unaffected.
const ADMIN_HOST = 'admin.inflx.in';
const PUBLIC_PROD_HOSTS = ['inflx.in', 'www.inflx.in'];

export function middleware(request) {
  const { pathname, search } = request.nextUrl;
  const host = (request.headers.get('host') || '').toLowerCase();
  const token = request.cookies.get('inflx_token')?.value;

  // ── Admin host: serve only the admin; bounce brand routes back to the public host ──
  if (host === ADMIN_HOST) {
    if (pathname === '/') {
      return NextResponse.redirect(new URL('/admin', request.url));
    }
    if (pathname.startsWith('/dashboard')) {
      return NextResponse.redirect(`https://inflx.in${pathname}${search}`);
    }
    if (pathname.startsWith('/admin') && !token) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
    return NextResponse.next();
  }

  // ── Real public host: /admin is not served here — move it to the admin host ──
  if (PUBLIC_PROD_HOSTS.includes(host) && pathname.startsWith('/admin')) {
    return NextResponse.redirect(`https://${ADMIN_HOST}${pathname}${search}`);
  }

  // ── All other hosts (localhost, previews) + the login-cookie gate (unchanged) ──
  if (pathname.startsWith('/dashboard') && !token) {
    return NextResponse.redirect(new URL('/login', request.url));
  }
  if (pathname.startsWith('/admin') && !token) {
    return NextResponse.redirect(new URL('/login', request.url));
  }
  return NextResponse.next();
}

export const config = { matcher: ['/', '/dashboard/:path*', '/admin/:path*'] };
