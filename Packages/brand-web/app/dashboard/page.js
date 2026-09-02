'use client';
import { useEffect, useState } from 'react';
import { brandApi, walletApi, campaignApi, brandInboxApi, fmtMoney, fmtRupees } from '../../lib/api';

/* ── StatCard — yellow icon-in-circle (poster pattern) ──────── */

function StatCard({ label, value, sub, href, icon, subTone }) {
  const subClass = subTone === 'warn'
    ? 'text-[11.5px] text-[#B91C1C] font-semibold mt-0.5'
    : subTone === 'success'
    ? 'text-[11.5px] text-[#047857] font-semibold mt-0.5'
    : 'text-[11.5px] text-[#71717A] mt-0.5';

  const card = (
    <div className="bg-white rounded-[16px] border border-[#E4E4E7] p-[18px] hover:-translate-y-0.5 hover:shadow-[0_6px_20px_-10px_rgba(0,0,0,0.08)] hover:border-[#D4D4D8] transition-all">
      <div className="flex items-start justify-between">
        <div className="w-10 h-10 rounded-full bg-[#FFC107] flex items-center justify-center flex-shrink-0">
          {icon}
        </div>
        {href && <span className="text-[#A1A1AA] font-mono text-[14px] font-bold">→</span>}
      </div>
      <div className="text-[11px] font-semibold uppercase tracking-[0.4px] text-[#71717A] mt-3 mb-1">
        {label}
      </div>
      <div className="font-mono font-bold text-[24px] text-[#0A0A0A] -tracking-[0.4px] leading-tight">
        {value}
      </div>
      {sub && <div className={subClass}>{sub}</div>}
    </div>
  );
  return href ? <a href={href} className="block">{card}</a> : card;
}

/* ── Campaign status pill ───────────────────────────────────── */

const CAMPAIGN_STATUS = {
  draft:          { bg: 'bg-[#F4F4F5]',    text: 'text-[#71717A]',  dot: 'bg-[#A1A1AA]',  label: 'Draft' },
  pending_wallet: { bg: 'bg-[#FFF7CC]',    text: 'text-[#6B5A00]',  dot: 'bg-[#E0A800]',  label: 'Pending wallet' },
  active:         { bg: 'bg-[#D1FAE5]',    text: 'text-[#047857]',  dot: 'bg-[#10B981]',  label: 'Active' },
  live:           { bg: 'bg-[#D1FAE5]',    text: 'text-[#047857]',  dot: 'bg-[#10B981]',  label: 'Live' },
  published:      { bg: 'bg-[#FFF7CC]',    text: 'text-[#6B5A00]',  dot: 'bg-[#E0A800]',  label: 'Published' },
  completed:      { bg: 'bg-[#F4F4F5]',    text: 'text-[#52525B]',  dot: 'bg-[#71717A]',  label: 'Completed' },
  cancelled:      { bg: 'bg-[#FDEEE9]',    text: 'text-[#B91C1C]',  dot: 'bg-[#E8401A]',  label: 'Cancelled' },
};

function CampaignRow({ c }) {
  const status = CAMPAIGN_STATUS[c.status] || CAMPAIGN_STATUS.draft;
  return (
    <a href={`/dashboard/campaigns/${c.id}`}
      className="flex items-center gap-3 py-3 px-4 hover:bg-[#FAFAFA] border-t border-[#E4E4E7] first:border-t-0 transition-colors">
      <div className="flex-1 min-w-0">
        <div className="text-[13.5px] font-semibold text-[#0A0A0A] truncate">{c.name}</div>
        <div className="text-[11px] text-[#71717A] mt-0.5 flex items-center gap-1.5 flex-wrap">
          <span className="font-mono">
            {c.start_date ? new Date(c.start_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '—'}
            {/* collab-part5 — "Ongoing" rather than a bare start date. */}
            {c.end_date ? ` → ${new Date(c.end_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}` : ' → Ongoing'}
          </span>
          <span className="text-[#D4D4D8]">·</span>
          <span className="font-mono font-semibold text-[#0A0A0A]">{fmtRupees(c.total_budget || 0)}</span>
        </div>
      </div>
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-[0.2px] ${status.bg} ${status.text}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
        {status.label}
      </span>
    </a>
  );
}

/* ── Transaction type pill + row ────────────────────────────── */

const TX_TYPE_STYLES = {
  pay_at_store:   { bg: 'bg-[#D1FAE5]', text: 'text-[#047857]',  label: 'WALK-IN' },
  prebook:        { bg: 'bg-[#FFF7CC]', text: 'text-[#6B5A00]',  label: 'BOOKING' },
  online_order:   { bg: 'bg-[#F4F4F5]', text: 'text-[#52525B]',  label: 'ORDER'   },
  redirect_click: { bg: 'bg-[#F4F4F5]', text: 'text-[#71717A]',  label: 'CLICK'   },
};

function TransactionRow({ tx }) {
  const style = TX_TYPE_STYLES[tx.type] || TX_TYPE_STYLES.redirect_click;
  const isClick = tx.type === 'redirect_click';
  return (
    <div className="flex items-center gap-3 py-3 px-4 hover:bg-[#FAFAFA] border-t border-[#E4E4E7] first:border-t-0 transition-colors">
      <span className={`px-2 py-0.5 rounded-full text-[9.5px] font-bold tracking-[0.3px] flex-shrink-0 font-mono ${style.bg} ${style.text}`}>
        {style.label}
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-[13.5px] font-semibold text-[#0A0A0A] truncate">
          {tx.follower_name || tx.follower_phone || 'Customer'}
        </div>
        <div className="text-[11px] text-[#71717A] mt-0.5">
          {new Date(tx.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
        </div>
      </div>
      <div className={`font-mono font-bold text-[13.5px] flex-shrink-0 ${isClick ? 'text-[#71717A]' : 'text-[#047857]'}`}>
        {isClick ? '—' : `+${fmtRupees(tx.amount || 0)}`}
      </div>
    </div>
  );
}

/* ── Main Dashboard ─────────────────────────────────────────── */

export default function BrandDashboardHome() {
  const [brand, setBrand]               = useState(null);
  const [wallet, setWallet]             = useState(null);
  const [campaigns, setCampaigns]       = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [summary, setSummary]           = useState(null);
  const [products, setProducts]         = useState([]);
  const [inbox, setInbox]               = useState(null);
  const [loading, setLoading]           = useState(true);
  const [brandError, setBrandError]     = useState(false);

  useEffect(() => {
    async function load() {
      const [br, wl, cp, tx, pr, ib] = await Promise.all([
        brandApi.getMe(),
        walletApi.getBalance(),
        campaignApi.list(),
        brandApi.get('/brands/me/transactions?limit=5'),
        brandApi.getProducts(),
        brandInboxApi.summary().catch(() => ({ success: false })),
      ]);
      setLoading(false);
      // Track the failure explicitly. `setLoading(false)` fires unconditionally,
      // so a failed /brands/me used to leave `brand` null and render a bare
      // "Welcome back" with no name and no error — indistinguishable from a
      // successful load. Surface it instead of failing silently.
      setBrandError(!br.success);
      if (br.success) setBrand(br.data?.brand || br.data);
      if (wl.success) setWallet(wl.data?.wallet || wl.data);
      if (cp.success) setCampaigns(cp.data?.campaigns || []);
      if (tx.success) {
        // The endpoint returns { transactions: [...], summary: { total_revenue, ... } }
        // Read both — surface a true cumulative Total Revenue from .summary instead of
        // re-summing the limited row set. Backend SQL: brand.controller.js:722-735.
        setTransactions(tx.data?.transactions || tx.data || []);
        setSummary(tx.data?.summary || null);
      }
      if (pr.success) setProducts(pr.data?.products || pr.data || []);
      if (ib.success) setInbox(ib.data?.summary || null);
    }
    load();
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center h-40 text-[#71717A] text-sm font-body">Loading dashboard…</div>
  );

  const balance         = wallet?.wallet_balance || 0;
  const escrowLocked    = wallet?.escrow_locked || 0;
  const activeCampaigns = campaigns.filter(c => ['active', 'live'].includes(c.status));
  const recentCampaigns = campaigns.slice(0, 3);
  const recentTx        = Array.isArray(transactions) ? transactions.slice(0, 5) : [];
  const productCount    = Array.isArray(products) ? products.length : 0;

  // True total revenue — backend already returns it as summary.total_revenue
  // (SUM of follower_transactions.net_amount WHERE status='completed').
  // Previously was a misleading sum-of-last-5; honest correction.
  const totalRevenue = summary?.total_revenue || 0;

  const today = new Date().toLocaleDateString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

  // Status lives on `users`, not `brands` — /brands/me returns it as
  // `user_status`. Reading `brand.status` was always undefined, so none of
  // these banners could ever render.
  const status     = brand?.user_status || brand?.status || null;
  const isPending  = status === 'pending';
  const isApproved = status === 'approved';
  const isRejected = status === 'rejected';

  const inboxPending = inbox
    ? (inbox.pending_negotiations || 0) + (inbox.pending_reviews || 0) + (inbox.pending_signatures || 0) + (inbox.contracts_failed || 0) + (inbox.pdf_failed || 0)
    : 0;

  /* ── icon SVGs (single source for the yellow-circle pattern) ── */
  const ic = {
    trophy: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0A0A0A" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 11l18-8-3 18-7-7-8-3z"/></svg>,
    wallet: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0A0A0A" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="7" width="18" height="12" rx="2"/><path d="M3 10h18"/><path d="M7 15h.01"/></svg>,
    trend:  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0A0A0A" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>,
    cart:   <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0A0A0A" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3h2l3.6 13.6a2 2 0 002 1.4h7.7a2 2 0 002-1.4L22 8H6"/><circle cx="9" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/></svg>,
  };

  return (
    <div className="max-w-6xl">

      {/* ── Welcome Header ──────────────────────────────────── */}
      <div className="mb-7">
        <div className="text-[11px] font-medium text-[#71717A] uppercase tracking-[0.3px] mb-1">{today}</div>
        <h1 className="font-display text-[28px] font-bold text-[#0A0A0A] -tracking-[0.6px]">
          Welcome back{brand?.business_name ? `, ${brand.business_name}` : ''}
        </h1>
        <div className="w-11 h-1 bg-[#FFC107] rounded-full mt-2"></div>

        {/* Without this, a failed /brands/me renders a nameless greeting that
            looks like a normal page — and the account-status banners below
            silently vanish too, since they all key off the same fetch. */}
        {brandError && (
          <div className="mt-3 flex items-center gap-2.5 px-3.5 py-2.5 bg-[#FEF2F2] border border-[#FECACA] rounded-[10px]">
            <span className="text-[13px]">⚠️</span>
            <div className="text-[12.5px] text-[#991B1B]">
              We couldn&apos;t load your business profile, so your name and account status
              aren&apos;t showing.{' '}
              <button
                onClick={() => window.location.reload()}
                className="font-bold underline underline-offset-2 hover:text-[#7F1D1D]"
              >
                Retry
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Account Status Banners (Flow 1 — locked palette: yellow + ink + danger/success) ── */}
      {isPending && (
        <div className="mb-5 p-4 bg-[#FFF7CC] border border-[#FFC107]/40 border-l-4 border-l-[#FFC107] rounded-[12px] flex items-start gap-3">
          <span className="flex-shrink-0 w-[26px] h-[26px] rounded-full bg-[#0A0A0A] text-[#FFC107] inline-flex items-center justify-center mt-0.5">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          </span>
          <div>
            <div className="text-sm font-bold text-[#0A0A0A]">Account under review</div>
            <div className="text-xs text-[#52525B] mt-0.5 leading-relaxed">Your account is being reviewed by our team. Some features may be limited until approval — usually within 24 hours.</div>
          </div>
        </div>
      )}
      {isRejected && (
        <div className="mb-5 p-4 bg-[#FDEEE9] border border-[#E8401A]/20 border-l-4 border-l-[#E8401A] rounded-[12px] flex items-start gap-3">
          <span className="flex-shrink-0 w-[26px] h-[26px] rounded-full bg-[#E8401A] text-white font-display font-extrabold text-[14px] inline-flex items-center justify-center mt-0.5">!</span>
          <div>
            <div className="text-sm font-bold text-[#0A0A0A]">Account needs a fix</div>
            <div className="text-xs text-[#52525B] mt-0.5 leading-relaxed">
              Your application wasn't approved.{' '}
              <a href="/dashboard/settings/profile" className="font-semibold text-[#0A0A0A] border-b border-dotted border-[#A1A1AA]">Review your profile</a> and resubmit.
            </div>
          </div>
        </div>
      )}
      {isApproved && (
        <div className="mb-5 flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#D1FAE5] border border-[#10B981]/20 rounded-full text-xs font-bold text-[#047857]">
            <span className="w-2 h-2 rounded-full bg-[#10B981] inline-block" />
            Verified account
          </span>
        </div>
      )}

      {/* ── Action Required (brand inbox) ─────────────────────── */}
      {inbox && inboxPending > 0 && (
        <div className="mb-7 bg-white border border-[#E4E4E7] rounded-[18px] p-5 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-[#FFC107]"></div>
          <div className="flex items-center justify-between mb-3.5">
            <h2 className="font-display text-[14px] font-bold text-[#0A0A0A] flex items-center gap-2.5">
              Action Required
              <span className="bg-[#FFC107] text-[#0A0A0A] px-2 py-0.5 rounded-full font-mono text-[11px] font-bold">
                {inboxPending} pending
              </span>
            </h2>
            <span className="text-[11.5px] text-[#71717A]">Things waiting on you</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2.5">
            <a href="/dashboard/inbox?tab=negotiations" className="bg-[#F4F4F5] border border-[#E4E4E7] rounded-[12px] px-3.5 py-3 hover:border-[#0A0A0A] hover:bg-white transition-all">
              <div className="font-mono font-bold text-[22px] text-[#0A0A0A] leading-none">{inbox.pending_negotiations || 0}</div>
              <div className="text-[10.5px] font-semibold text-[#52525B] uppercase tracking-[0.4px] mt-1.5">Negotiations</div>
            </a>
            <a href="/dashboard/inbox?tab=reviews" className="bg-[#F4F4F5] border border-[#E4E4E7] rounded-[12px] px-3.5 py-3 hover:border-[#0A0A0A] hover:bg-white transition-all">
              <div className="font-mono font-bold text-[22px] text-[#0A0A0A] leading-none">{inbox.pending_reviews || 0}</div>
              <div className="text-[10.5px] font-semibold text-[#52525B] uppercase tracking-[0.4px] mt-1.5">Content reviews</div>
            </a>
            <a href="/dashboard/inbox?tab=signatures" className="bg-[#F4F4F5] border border-[#E4E4E7] rounded-[12px] px-3.5 py-3 hover:border-[#0A0A0A] hover:bg-white transition-all">
              <div className="font-mono font-bold text-[22px] text-[#0A0A0A] leading-none">{inbox.pending_signatures || 0}</div>
              <div className="text-[10.5px] font-semibold text-[#52525B] uppercase tracking-[0.4px] mt-1.5">Contract signs</div>
            </a>
            {inbox.contracts_failed > 0 && (
              <a href="/dashboard/inbox?tab=failures" className="bg-[#FDEEE9] border border-[#E8401A]/20 rounded-[12px] px-3.5 py-3 hover:border-[#E8401A] transition-all">
                <div className="font-mono font-bold text-[22px] text-[#B91C1C] leading-none">{inbox.contracts_failed}</div>
                <div className="text-[10.5px] font-semibold text-[#B91C1C] uppercase tracking-[0.4px] mt-1.5">Contract failed</div>
              </a>
            )}
            {inbox.pdf_failed > 0 && (
              <a href="/dashboard/inbox?tab=failures" className="bg-[#FDEEE9] border border-[#E8401A]/20 rounded-[12px] px-3.5 py-3 hover:border-[#E8401A] transition-all">
                <div className="font-mono font-bold text-[22px] text-[#B91C1C] leading-none">{inbox.pdf_failed}</div>
                <div className="text-[10.5px] font-semibold text-[#B91C1C] uppercase tracking-[0.4px] mt-1.5">PDF failed</div>
              </a>
            )}
          </div>
        </div>
      )}

      {/* ── Overview Stat Cards ─────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 mb-8">
        <StatCard
          label="Active campaigns"
          value={activeCampaigns.length}
          sub={`${campaigns.length} total`}
          icon={ic.trophy}
          href="/dashboard/campaigns"
        />
        <StatCard
          label="Wallet balance"
          value={fmtRupees(balance)}
          sub={escrowLocked > 0 ? `${fmtRupees(escrowLocked)} in escrow` : 'No escrow locked'}
          subTone={balance < 50000 ? 'warn' : undefined}
          icon={ic.wallet}
          href="/dashboard/wallet"
        />
        <StatCard
          label="Total revenue"
          value={fmtRupees(totalRevenue)}
          sub="All completed follower transactions"
          icon={ic.trend}
          href="/dashboard/conversions"
        />
        <StatCard
          label="Listed products"
          value={productCount}
          sub="In your catalogue"
          icon={ic.cart}
          href="/dashboard/products"
        />
      </div>

      {/* ── Quick Actions ───────────────────────────────────── */}
      <div className="mb-8">
        <h2 className="font-display text-[14px] font-bold text-[#0A0A0A] mb-3 flex items-center gap-2.5">
          <span className="w-1 h-4 bg-[#FFC107] rounded-sm"></span>
          Quick actions
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <a href="/dashboard/campaigns"
            className="bg-[#FFC107] text-[#0A0A0A] rounded-[14px] py-3.5 px-4 font-display font-bold text-[13px] flex items-center justify-between hover:-translate-y-0.5 transition-transform relative overflow-hidden">
            <span className="z-10 relative">Create campaign</span>
            <span className="font-mono z-10 relative">→</span>
            <span className="absolute -top-5 -right-5 w-14 h-14 rounded-full bg-[#0A0A0A] opacity-[0.08]"></span>
          </a>
          <a href="/dashboard/influencers"
            className="bg-[#0A0A0A] text-white rounded-[14px] py-3.5 px-4 font-display font-bold text-[13px] flex items-center justify-between hover:-translate-y-0.5 transition-transform relative overflow-hidden">
            <span className="z-10 relative">Browse influencers</span>
            <span className="font-mono z-10 relative">→</span>
            <span className="absolute -top-5 -right-5 w-14 h-14 rounded-full bg-[#FFC107] opacity-[0.18]"></span>
          </a>
          <a href="/dashboard/products"
            className="bg-[#0A0A0A] text-white rounded-[14px] py-3.5 px-4 font-display font-bold text-[13px] flex items-center justify-between hover:-translate-y-0.5 transition-transform relative overflow-hidden">
            <span className="z-10 relative">Manage listings</span>
            <span className="font-mono z-10 relative">→</span>
            <span className="absolute -top-5 -right-5 w-14 h-14 rounded-full bg-[#FFC107] opacity-[0.18]"></span>
          </a>
          <a href="/dashboard/wallet"
            className="bg-[#0A0A0A] text-white rounded-[14px] py-3.5 px-4 font-display font-bold text-[13px] flex items-center justify-between hover:-translate-y-0.5 transition-transform relative overflow-hidden">
            <span className="z-10 relative">View wallet</span>
            <span className="font-mono z-10 relative">→</span>
            <span className="absolute -top-5 -right-5 w-14 h-14 rounded-full bg-[#FFC107] opacity-[0.18]"></span>
          </a>
        </div>
      </div>

      {/* ── Two-column: Recent Activity + Recent Campaigns ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Recent Activity */}
        <div className="bg-white rounded-[18px] border border-[#E4E4E7] overflow-hidden">
          <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-[#E4E4E7]">
            <h2 className="font-display text-[14px] font-bold text-[#0A0A0A]">Recent activity</h2>
            <a href="/dashboard/conversions" className="text-[12px] text-[#0A0A0A] font-semibold hover:bg-[#FFF7CC] px-2.5 py-1 rounded-lg transition-colors">View all →</a>
          </div>
          {recentTx.length === 0 ? (
            <div className="px-4 py-10 text-center text-[#71717A] text-sm">
              <div className="w-12 h-12 rounded-full bg-[#F4F4F5] inline-flex items-center justify-center mb-3 text-xl">·</div>
              <div>No transactions yet.</div>
              <div className="text-[11.5px] text-[#71717A] mt-1">Follower purchases via campaign links will appear here.</div>
            </div>
          ) : (
            <div>
              {recentTx.map((tx, i) => <TransactionRow key={tx.id || i} tx={tx} />)}
            </div>
          )}
        </div>

        {/* Recent Campaigns */}
        <div className="bg-white rounded-[18px] border border-[#E4E4E7] overflow-hidden">
          <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-[#E4E4E7]">
            <h2 className="font-display text-[14px] font-bold text-[#0A0A0A]">Recent campaigns</h2>
            <a href="/dashboard/campaigns" className="text-[12px] text-[#0A0A0A] font-semibold hover:bg-[#FFF7CC] px-2.5 py-1 rounded-lg transition-colors">View all →</a>
          </div>
          {recentCampaigns.length === 0 ? (
            <div className="px-4 py-10 text-center text-[#71717A] text-sm">
              <div className="w-12 h-12 rounded-full bg-[#F4F4F5] inline-flex items-center justify-center mb-3 text-xl">·</div>
              <div>No campaigns yet.</div>
              <div className="text-[11.5px] mt-1">
                <span className="text-[#71717A]">Create your first campaign in the INFLX brand app on your phone</span>
              </div>
            </div>
          ) : (
            <div>
              {recentCampaigns.map(c => <CampaignRow key={c.id} c={c} />)}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
