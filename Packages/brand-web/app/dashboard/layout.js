'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { notificationApi, brandApi, authApi, tryRefreshToken } from '../../lib/api';
import Logo from '../../../shared/components/Logo';

// NAV — order + hrefs preserved exactly. Contracts folded into Campaigns,
// Proposals into Influencers, Offers into Listings (products).
// Window A's future "Subscription" + "Billing" appends slot in below
// at array-tail without disturbing existing items.
//
// `feature` marks a vertical-specific item: it renders only when the
// brand's category schema declares features[feature]===true. Items
// without `feature` are universal (every vertical sees them). Meals is
// restaurant-only; Bookings is for booking-capable verticals. Until the
// schema resolves, gated items stay hidden so a non-restaurant brand
// never flashes "Meals".
const NAV = [
  { href: '/dashboard',             label: 'Dashboard',   icon: '⌂' },
  { href: '/dashboard/campaigns',   label: 'Campaigns',   icon: '⊟' },
  { href: '/dashboard/influencers', label: 'Influencers', icon: '★' },
  { href: '/dashboard/products',    label: 'Listings',    icon: '▤' },
  { href: '/dashboard/meals',       label: 'Meals',       icon: '◉', feature: 'meals' },
  { href: '/dashboard/bookings',    label: 'Bookings',    icon: '▦', feature: 'booking' },
  { href: '/dashboard/gallery',     label: 'Gallery',     icon: '▢' },
  { href: '/dashboard/fulfillment', label: 'Fulfillment', icon: '📦' },
  { href: '/dashboard/returns',     label: 'Returns',     icon: '↩' },
  { href: '/dashboard/conversions', label: 'Conversions', icon: '₹' },
  { href: '/dashboard/wallet',                 label: 'Wallet',   icon: '◫' },
  { href: '/dashboard/settings/profile',       label: 'Settings', icon: '⚙' },
];

export default function DashboardLayout({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [brandStatus, setBrandStatus] = useState(null); // 'pending' | 'approved' | 'rejected'
  const [features, setFeatures] = useState(null); // brand's category schema feature flags; null until loaded

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
    // Resolve the brand's category schema to gate vertical-specific nav
    // (Meals / Bookings). Same source of truth the Listings wizard uses.
    brandApi.getSchema().then(res => {
      if (res.success) setFeatures(res.data?.schema?.features || {});
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

  // Last-2-of-phone initials for avatar (current convention).
  const initials = (user?.phone || '').slice(-2) || '·';

  return (
    <div className="min-h-screen flex flex-col bg-[#FAFAFA] font-body">

      {/* ── Topbar — ink chrome ─────────────────────────────────── */}
      <header className="bg-[#0A0A0A] h-16 flex items-center justify-between px-7 gap-6 flex-shrink-0 sticky top-0 z-40 border-b border-[#2A2A2D]">

        {/* Brand mark — Logo placeholder (light variant for dark chrome) */}
        <div className="flex items-center flex-shrink-0">
          <Logo tone="light" size="sm" />
        </div>

        {/* horizontal nav */}
        <nav className="flex items-center gap-0.5 flex-1 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          {NAV.filter(item => !item.feature || features?.[item.feature] === true).map(item => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-[10px] text-[12.5px] whitespace-nowrap transition-all ${
                  isActive
                    ? 'bg-[#FFC107] text-[#0A0A0A] font-bold'
                    : 'text-[#A1A1AA] font-medium hover:text-white hover:bg-[#2A2A2D]'
                }`}
              >
                <span className="opacity-85" style={{ fontSize: '13px' }}>{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Right cluster — bell + avatar + sign out */}
        <div className="flex items-center gap-3 flex-shrink-0">
          <Link
            href="/dashboard/notifications"
            className="relative w-9 h-9 rounded-[10px] flex items-center justify-center text-[#A1A1AA] hover:text-white hover:bg-[#2A2A2D] transition-all"
            aria-label="Notifications"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/>
              <path d="M13.73 21a2 2 0 01-3.46 0"/>
            </svg>
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 min-w-[16px] h-4 px-1 bg-[#FFC107] border-2 border-[#0A0A0A] rounded-full text-[9.5px] font-bold text-[#0A0A0A] flex items-center justify-center font-mono">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </Link>
          {user && (
            <>
              <div
                className="w-9 h-9 rounded-full bg-[#FFC107] text-[#0A0A0A] flex items-center justify-center text-[12px] font-bold font-mono tracking-wide cursor-default"
                title={user.phone || ''}
              >
                {initials}
              </div>
              <button
                onClick={logout}
                className="text-[11px] font-semibold text-[#71717A] hover:text-white transition-colors px-1 py-1"
              >
                Sign out
              </button>
            </>
          )}
        </div>
      </header>

      {/* ── Persistent pending banner (locked palette) ───────────── */}
      {brandStatus === 'pending' && (
        <div className="bg-[#FFF7CC] border-b border-[#FFC107]/40 px-7 py-3 flex items-center justify-center gap-3">
          <span className="flex-shrink-0 w-[22px] h-[22px] rounded-full bg-[#0A0A0A] text-[#FFC107] inline-flex items-center justify-center font-display font-extrabold text-[11px]">
            !
          </span>
          <span className="text-[13px] text-[#1F1F22]">
            <strong className="text-[#0A0A0A] font-bold">Account under review.</strong>{' '}
            You can explore the platform — some actions stay locked until approval.
          </span>
          <span className="ml-1 inline-block bg-[#0A0A0A] text-[#FFC107] font-mono font-semibold text-[11px] px-2.5 py-0.5 rounded-full">
            ETA &lt; 24h
          </span>
        </div>
      )}
      {brandStatus === 'rejected' && (
        <div className="bg-[#FDEEE9] border-b border-[#E8401A]/20 px-7 py-3 flex items-center justify-center gap-3">
          <span className="flex-shrink-0 w-[22px] h-[22px] rounded-full bg-[#E8401A] text-white inline-flex items-center justify-center font-display font-extrabold text-[12px]">
            !
          </span>
          <span className="text-[13px] text-[#1F1F22]">
            <strong className="text-[#0A0A0A] font-bold">Account needs a fix.</strong>{' '}
            Your application wasn't approved. Please review and resubmit from the{' '}
            <Link href="/dashboard/settings/profile" className="font-semibold text-[#0A0A0A] border-b border-dotted border-[#A1A1AA]">
              Profile page
            </Link>.
          </span>
        </div>
      )}

      <main className="flex-1 p-7">
        {children}
      </main>
    </div>
  );
}
