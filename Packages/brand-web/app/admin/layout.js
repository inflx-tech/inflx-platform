'use client';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { authApi, tryRefreshToken } from '../../lib/api';

const NAV = [
  { section: 'OVERVIEW' },
  { href: '/admin', label: 'Platform Stats', icon: '📊' },
  { href: '/admin/analytics', label: 'Analytics', icon: '📈' },
  { section: 'MANAGEMENT' },
  { href: '/admin/approvals', label: 'Approvals', icon: '✅', badge: 'pending' },
  { href: '/admin/brands', label: 'Brands', icon: '🏢' },
  { href: '/admin/influencers', label: 'Influencers', icon: '⭐' },
  { href: '/admin/production-queue', label: 'Production Queue', icon: '🚚' },
  { section: 'CONTENT' },
  { href: '/admin/master-dishes', label: 'Master Dishes', icon: '🍽️' },
  { href: '/admin/sections', label: 'App Sections', icon: '🎛️' },
  { href: '/admin/tag-vocabulary', label: 'Tag Vocabulary', icon: '🏷️' },
  { href: '/admin/follower-categories', label: 'Follower Categories', icon: '🗂️' },
  { section: 'MARKETING' },
  { href: '/admin/marketing/leads',         label: 'Triage',        icon: '🎯' },
  { href: '/admin/marketing/add',           label: 'Add Lead',      icon: '➕' },
  { href: '/admin/marketing/verifications', label: 'Verifications', icon: '🔍', badge: 'verifications' },
  { href: '/admin/marketing/invitations',   label: 'Invitations',   icon: '📨', badge: 'invitations' },
  { href: '/admin/marketing/inbox',         label: 'Inbox',         icon: '📥' },
  { href: '/admin/marketing/funnel',        label: 'Funnel',        icon: '📊' },
  { href: '/admin/marketing/settings',      label: 'M-Settings',    icon: '🛠️' },
  { section: 'REFERRALS' },
  { href: '/admin/referrals/settings',      label: 'Settings',      icon: '🛠️' },
  { href: '/admin/referrals/relationships', label: 'Relationships', icon: '🤝' },
  { href: '/admin/referrals/earnings',      label: 'Earnings',      icon: '💰' },
  { href: '/admin/referrals/agencies',      label: 'Agencies',      icon: '🏛️' },
  { section: 'FINANCE' },
  { href: '/admin/escrow', label: 'Escrow', icon: '🔒' },
  { href: '/admin/payouts', label: 'Payouts', icon: '💸' },
  { href: '/admin/subscriptions',         label: 'Active Subs',     icon: '🔁' },
  { href: '/admin/billing/invoices',      label: 'Sub Invoices',    icon: '🧾' },
  { section: 'PRICING' },
  { href: '/admin/pricing/tiers',         label: 'Tiers (L1)',      icon: '💎' },
  { href: '/admin/pricing/features',      label: 'Features',        icon: '🧩' },
  { href: '/admin/pricing/categories',    label: 'Categories (L3)', icon: '🏷️' },
  { section: 'SETTINGS' },
  { href: '/admin/settings/payments', label: 'Payment Config', icon: '⚙️' },
  { href: '/admin/meals',             label: 'Meals',          icon: '🍽️' },
  { href: '/admin/users',             label: 'Admin Users',    icon: '👥' },
];

export default function DashboardLayout({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [verificationCount, setVerificationCount] = useState(0);
  const [invitationCount, setInvitationCount] = useState(0);

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
          {NAV.map((item, i) => {
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
