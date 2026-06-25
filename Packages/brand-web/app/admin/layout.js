'use client';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { authApi, tryRefreshToken } from '../../lib/api';

// Each leaf nav item carries a `cap` — the capability key (B-2) that gates it.
// Platform Stats has no `cap` (always visible — landing + badges). Section
// headers are dropped automatically if every item under them is hidden.
const NAV = [
  { section: 'OVERVIEW' },
  { href: '/admin', label: 'Platform Stats', icon: '📊' },
  { href: '/admin/analytics', label: 'Analytics', icon: '📈', cap: 'analytics' },
  { section: 'MANAGEMENT' },
  { href: '/admin/approvals', label: 'Approvals', icon: '✅', badge: 'pending', cap: 'approvals' },
  { href: '/admin/brands', label: 'Brands', icon: '🏢', cap: 'brands' },
  { href: '/admin/influencers', label: 'Influencers', icon: '⭐', cap: 'influencers' },
  { href: '/admin/production-queue', label: 'Production Queue', icon: '🚚', cap: 'production' },
  { href: '/admin/orders', label: 'Orders', icon: '📦', cap: 'orders' },
  { section: 'CONTENT' },
  { href: '/admin/master-dishes', label: 'Master Dishes', icon: '🍽️', cap: 'master_data' },
  { href: '/admin/sections', label: 'App Builder', icon: '🧱', cap: 'sections' },
  { href: '/admin/section-library', label: 'Section Library', icon: '🧩', cap: 'libraries' },
  { href: '/admin/tag-vocabulary', label: 'Tag Vocabulary', icon: '🏷️', cap: 'categories' },
  { section: 'MARKETING' },
  { href: '/admin/marketing/leads',         label: 'Triage',        icon: '🎯', cap: 'marketing' },
  { href: '/admin/marketing/add',           label: 'Add Lead',      icon: '➕', cap: 'marketing' },
  { href: '/admin/marketing/verifications', label: 'Verifications', icon: '🔍', badge: 'verifications', cap: 'marketing' },
  { href: '/admin/marketing/invitations',   label: 'Invitations',   icon: '📨', badge: 'invitations', cap: 'marketing' },
  { href: '/admin/marketing/inbox',         label: 'Inbox',         icon: '📥', cap: 'marketing' },
  { href: '/admin/marketing/funnel',        label: 'Funnel',        icon: '📊', cap: 'marketing' },
  { href: '/admin/marketing/settings',      label: 'M-Settings',    icon: '🛠️', cap: 'marketing' },
  { section: 'REFERRALS' },
  { href: '/admin/referrals/settings',      label: 'Settings',      icon: '🛠️', cap: 'referrals' },
  { href: '/admin/referrals/relationships', label: 'Relationships', icon: '🤝', cap: 'referrals' },
  { href: '/admin/referrals/earnings',      label: 'Earnings',      icon: '💰', cap: 'referrals' },
  { href: '/admin/referrals/agencies',      label: 'Agencies',      icon: '🏛️', cap: 'referrals' },
  { section: 'FINANCE' },
  { href: '/admin/escrow', label: 'Escrow', icon: '🔒', cap: 'escrow' },
  { href: '/admin/payouts', label: 'Payouts', icon: '💸', cap: 'payouts' },
  { href: '/admin/returns', label: 'Returns', icon: '↩️', cap: 'returns' },
  { href: '/admin/subscriptions',         label: 'Active Subs',     icon: '🔁', cap: 'subscriptions' },
  { href: '/admin/billing/invoices',      label: 'Sub Invoices',    icon: '🧾', cap: 'subscriptions' },
  { section: 'PRICING' },
  { href: '/admin/pricing/tiers',         label: 'Tiers (L1)',      icon: '💎', cap: 'pricing' },
  { href: '/admin/pricing/features',      label: 'Features',        icon: '🧩', cap: 'pricing' },
  { href: '/admin/pricing/categories',    label: 'Categories (L3)', icon: '🏷️', cap: 'pricing' },
  { section: 'SETTINGS' },
  { href: '/admin/settings/payments', label: 'Payment Config', icon: '⚙️', cap: 'settings' },
  { href: '/admin/meals',             label: 'Meals',          icon: '🍽️', cap: 'settings' },
  { href: '/admin/users',             label: 'Admin Users',    icon: '👥', cap: 'users' },
];

// Drop nav leaves the admin lacks the capability for, then drop any section
// header left with no following leaves. superadmin sees everything.
// While caps haven't loaded yet (capabilities === null) show the full nav to
// avoid a flash of empty sidebar — the server still enforces every route.
function scopeNav(items, capabilities, isSuperadmin) {
  const visible = (isSuperadmin || capabilities === null)
    ? items
    : items.filter(it => it.section || !it.cap || capabilities.includes(it.cap));
  // Strip section headers that have no leaf after them.
  return visible.filter((it, i) => {
    if (!it.section) return true;
    const next = visible[i + 1];
    return next && !next.section;
  });
}

export default function DashboardLayout({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [verificationCount, setVerificationCount] = useState(0);
  const [invitationCount, setInvitationCount] = useState(0);
  // B-2 capability scoping. null = not yet loaded (show full nav to avoid a
  // sidebar flash; server still enforces every route). isSuperadmin bypasses.
  const [capabilities, setCapabilities] = useState(null);
  const [isSuperadmin, setIsSuperadmin] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const u = JSON.parse(localStorage.getItem('inflx_user') || 'null');
        const token = localStorage.getItem('inflx_token');
        if (!u || u.role !== 'admin' || !token) { router.push('/login'); return; }
        // Re-sync the cookie middleware reads — the access-token cookie
        // is short-lived (15 min) but middleware only checks existence,
        // so renew its lifetime to match the refresh window.
        document.cookie = `inflx_token=${token}; path=/; max-age=2592000`;
        setUser(u);

        // Proactive refresh on cold start. The HttpOnly refresh cookie
        // is sent with credentials: 'include' on every fetch. If still
        // valid (within 30 days) we get a fresh access token before any
        // data fetch hits the wire — no 401 → retry blink. If it's
        // expired, the next API call's 401 path runs clearSession()
        // and the user lands on /login. We don't redirect from here so
        // a momentary network hiccup doesn't kick a logged-in admin.
        tryRefreshToken().catch(() => {});
      } catch { router.push('/login'); }
    }
  }, []);

  useEffect(() => {
    async function fetchPending() {
      try {
        const { api } = await import('../../lib/api');
        const res = await api.get('/admin/stats');
        if (res.success) {
          const p = res.data;
          setPendingCount((p.pending_approvals?.brands || 0) + (p.pending_approvals?.influencers || 0));
          setVerificationCount(p.pending_verifications || 0);
          setInvitationCount(p.pending_invitations || 0);
        }
      } catch {}
    }
    fetchPending();
  }, []);

  // B-2 — fetch the caller's own capabilities to scope the nav. Runs after the
  // proactive refresh above has had a chance to seat a fresh token. superadmin
  // sees the full nav regardless of the capabilities array.
  useEffect(() => {
    async function fetchMe() {
      try {
        const { adminApi } = await import('../../lib/api');
        const res = await adminApi.getMe();
        if (res.success) {
          setIsSuperadmin(res.data?.admin_role === 'superadmin');
          setCapabilities(Array.isArray(res.data?.capabilities) ? res.data.capabilities : []);
        }
      } catch {}
    }
    fetchMe();
  }, []);

  const navItems = scopeNav(NAV, capabilities, isSuperadmin);

  async function logout() {
    // Best-effort server-side revoke. Backend clears the HttpOnly
    // refresh cookie + marks the token used so it can't be replayed.
    // Don't block the redirect on it — local state still gets cleared
    // even if the network call fails.
    try { await authApi.logout(); } catch { /* ignore */ }
    localStorage.clear();
    document.cookie = 'inflx_token=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
    router.push('/login');
  }

  return (
    <div className="flex h-screen overflow-hidden bg-bg font-body">
      {/* Sidebar */}
      <div className="w-48 bg-navy-deep flex flex-col flex-shrink-0 overflow-y-auto">
        {/* Logo */}
        <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
          <div className="font-display text-base font-extrabold text-white">
            INFL<span className="bg-gradient-to-r from-red to-orange bg-clip-text text-transparent">X</span>
          </div>
          {user && (
            <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-gold/20 text-gold border border-gold/30">
              {user.admin_role || 'ADMIN'}
            </span>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2 py-2">
          {navItems.map((item, i) => {
            if (item.section) return (
              <div key={i} className="px-2 pt-3 pb-1 text-[9px] font-bold text-white/25 uppercase tracking-widest">{item.section}</div>
            );
            const isActive = pathname === item.href || (item.href !== '/admin' && pathname.startsWith(item.href));
            return (
              <Link key={item.href} href={item.href} className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all mb-0.5 ${isActive ? 'bg-gold/15 text-gold font-semibold' : 'text-white/55 hover:bg-white/7 hover:text-white/85'}`}>
                <span className="text-xs w-4 text-center flex-shrink-0">{item.icon}</span>
                <span className="flex-1">{item.label}</span>
                {item.badge === 'pending' && pendingCount > 0 && (
                  <span className="bg-orange text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">{pendingCount}</span>
                )}
                {item.badge === 'verifications' && verificationCount > 0 && (
                  <span className="bg-orange text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">{verificationCount}</span>
                )}
                {item.badge === 'invitations' && invitationCount > 0 && (
                  <span className="bg-orange text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">{invitationCount}</span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* User */}
        {user && (
          <div className="px-3 py-3 border-t border-white/5">
            <div className="text-[10px] text-white/40 mb-1 truncate">{user.phone}</div>
            <button onClick={logout} className="text-[10px] text-white/30 hover:text-white/60">Sign out →</button>
          </div>
        )}
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <div className="h-11 bg-white border-b border-border flex items-center justify-between px-4 flex-shrink-0">
          <div className="font-display text-sm font-bold text-t1">
            {NAV.find(n => n.href && (pathname === n.href || (n.href !== '/admin' && pathname.startsWith(n.href))))?.label || 'Dashboard'}
          </div>
          <div className="flex items-center gap-2">
            {user && (
              <div className="w-7 h-7 rounded-full bg-gold-pale flex items-center justify-center text-[9px] font-bold text-yellow-700 border border-gold/30 font-display">
                {(user.phone || '').slice(-2)}
              </div>
            )}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 bg-bg">
          {children}
        </div>
      </div>
    </div>
  );
}
