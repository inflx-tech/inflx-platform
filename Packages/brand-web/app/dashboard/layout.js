'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { notificationApi, brandApi, authApi, tryRefreshToken } from '../../lib/api';

const NAV = [
  { href: '/dashboard',             label: 'Dashboard',   icon: '🏠' },
  { href: '/dashboard/campaigns',   label: 'Campaigns',   icon: '📣' },
  { href: '/dashboard/contracts',   label: 'Contracts',   icon: '📝' },
  { href: '/dashboard/influencers', label: 'Influencers', icon: '⭐' },
  { href: '/dashboard/products',    label: 'Listings',    icon: '🏪' },
  { href: '/dashboard/bookings',    label: 'Bookings',    icon: '📅' },
  { href: '/dashboard/gallery',     label: 'Gallery',     icon: '🖼️' },
  { href: '/dashboard/proposals',   label: 'Proposals',   icon: '📨' },
  { href: '/dashboard/conversions', label: 'Conversions', icon: '💰' },
  { href: '/dashboard/wallet',      label: 'Wallet',      icon: '🏦' },
  { href: '/dashboard/profile',     label: 'Profile',     icon: '👤' },
];

export default function DashboardLayout({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [brandStatus, setBrandStatus] = useState(null); // 'pending' | 'approved' | 'rejected'

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const u = JSON.parse(localStorage.getItem('inflx_user') || 'null');
        const token = localStorage.getItem('inflx_token');
        if (!u || !token) { router.push('/login'); return; }
        // Admin landing on /dashboard by accident — bounce them to /admin
        // rather than kicking them out to /login.
        if (u.role === 'admin') { router.push('/admin'); return; }
        if (u.role !== 'brand') { router.push('/login'); return; }
        // Re-sync cookie so middleware doesn't expire it before localStorage does
        document.cookie = `inflx_token=${token}; path=/; max-age=2592000`;
        setUser(u);

        // Proactive refresh on cold start. The HttpOnly refresh cookie
        // (30-day, rotating) is sent automatically because every fetch
        // uses credentials: 'include'. If it's still valid we get a
        // fresh access token before any data fetch hits the wire — no
        // visible 401 → retry blink. If the refresh cookie is stale,
        // the next API call will 401, the request wrapper will trigger
        // clearSession, and the user lands on /login. Don't redirect
        // here — the existing access token may still be valid for the
        // remainder of its 15-minute window.
        tryRefreshToken().catch(() => {});
      } catch { router.push('/login'); }
    }
  }, []);

  useEffect(() => {
    notificationApi.list().then(res => {
      if (res.success) setUnreadCount(res.data?.unread_count || 0);
    });
    // Check brand approval status
    brandApi.getMe().then(res => {
      if (res.success) {
        const brand = res.data?.brand || res.data;
        setBrandStatus(brand?.status || null);
      }
    });
  }, [pathname]);

  async function logout() {
    // Best-effort server-side revoke so a stolen refresh cookie can't
    // be replayed. Don't block UX on it — even if the network call
    // fails we still clear local state and redirect.
    try { await authApi.logout(); } catch { /* ignore */ }
    localStorage.clear();
    document.cookie = 'inflx_token=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
    router.push('/login');
  }

  return (
    <div className="min-h-screen flex flex-col bg-bg font-body">
      {/* Top Nav */}
      <header className="bg-navy-deep h-14 flex items-center justify-between px-6 flex-shrink-0 sticky top-0 z-40">
        <div className="flex items-center gap-8">
          <div className="font-display text-lg font-extrabold text-white">
            <img src="/inflx-logo-dark.png" alt="INFLX" style={{height: "28px"}} />
          </div>
          <nav className="flex items-center gap-1">
            {NAV.map(item => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
              return (
                <Link key={item.href} href={item.href} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${isActive ? 'bg-white/10 text-white' : 'text-white/55 hover:text-white/85 hover:bg-white/5'}`}>
                  <span>{item.icon}</span> {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/dashboard/notifications" className="relative p-2 text-white/60 hover:text-white transition-colors">
            <span className="text-base">🔔</span>
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-orange rounded-full text-[8px] font-bold text-white flex items-center justify-center">{unreadCount > 9 ? '9+' : unreadCount}</span>
            )}
          </Link>
          {user && (
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-gold/20 border border-gold/40 flex items-center justify-center text-[9px] font-bold text-gold font-display">
                {(user.phone || '').slice(-2)}
              </div>
              <button onClick={logout} className="text-[10px] text-white/40 hover:text-white/60">Sign out</button>
            </div>
          )}
        </div>
      </header>

      {/* Pending approval banner */}
      {brandStatus === 'pending' && (
        <div className="bg-amber-50 border-b border-amber-200 px-6 py-3 flex items-center justify-center gap-2">
          <span className="text-lg">⏳</span>
          <span className="text-sm text-amber-800 font-medium">
            Your account is pending admin approval. You can explore the platform, but some features are restricted until approved.
          </span>
        </div>
      )}
      {brandStatus === 'rejected' && (
        <div className="bg-red-50 border-b border-red-200 px-6 py-3 flex items-center justify-center gap-2">
          <span className="text-lg">❌</span>
          <span className="text-sm text-red-700 font-medium">
            Your account was not approved. Please contact support or resubmit your application from the Profile page.
          </span>
        </div>
      )}

      <main className="flex-1 p-6">
        {children}
      </main>
    </div>
  );
}
