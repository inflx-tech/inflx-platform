'use client';
import { useEffect, useState } from 'react';
import { brandApi, walletApi, campaignApi, brandInboxApi, fmtMoney, fmtRupees } from '../../lib/api';

/* ── Stat Card ──────────────────────────────────────────────── */

function StatCard({ label, value, sub, color = 'navy', href, icon }) {
  const colorMap = {
    navy:   'text-navy border-navy/10',
    teal:   'text-teal border-teal/10',
    orange: 'text-orange border-orange/10',
    gold:   'text-yellow-600 border-yellow-200',
    red:    'text-red border-red/10',
  };
  const card = (
    <div className={`bg-white rounded-xl border ${colorMap[color]} p-5 ${href ? 'hover:shadow-md transition-shadow cursor-pointer' : ''}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="text-[10px] font-bold uppercase tracking-wider text-t3">{label}</div>
        {icon && <span className="text-lg opacity-60">{icon}</span>}
      </div>
      <div className={`font-display text-2xl font-extrabold ${colorMap[color].split(' ')[0]} mb-0.5`}>{value}</div>
      {sub && <div className="text-[10px] text-t3">{sub}</div>}
    </div>
  );
  return href ? <a href={href}>{card}</a> : card;
}

/* ── Campaign Row ───────────────────────────────────────────── */

const CAMPAIGN_STATUS = {
  draft:          'bg-gray-100 text-gray-500',
  pending_wallet: 'bg-yellow-100 text-yellow-700',
  active:         'bg-teal-100 text-teal-700',
  live:           'bg-teal-100 text-teal-700',
  published:      'bg-blue-100 text-blue-700',
  completed:      'bg-blue-100 text-blue-700',
  cancelled:      'bg-red-100 text-red-600',
};

function CampaignRow({ c }) {
  return (
    <a href={`/dashboard/campaigns/${c.id}`}
      className="flex items-center justify-between py-3 px-4 hover:bg-surface2 rounded-xl transition-colors">
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-t1 truncate">{c.name}</div>
        <div className="text-[10px] text-t3 mt-0.5">
          {c.start_date ? new Date(c.start_date).toLocaleDateString('en-IN') : '—'}
          {c.end_date ? ` — ${new Date(c.end_date).toLocaleDateString('en-IN')}` : ''}
          {' · '}{fmtRupees(c.total_budget || 0)}
        </div>
      </div>
      <span className={`ml-3 px-2 py-0.5 rounded-full text-[9px] font-bold capitalize flex-shrink-0 ${CAMPAIGN_STATUS[c.status] || CAMPAIGN_STATUS.draft}`}>
        {c.status?.replace(/_/g, ' ')}
      </span>
    </a>
  );
}

/* ── Transaction Type Styles ────────────────────────────────── */

const TX_TYPE_STYLES = {
  pay_at_store:   { bg: 'bg-teal-50', text: 'text-teal-700', label: 'Walk-in' },
  prebook:        { bg: 'bg-blue-50', text: 'text-blue-700', label: 'Booking' },
  online_order:   { bg: 'bg-purple-50', text: 'text-purple-700', label: 'Order' },
  redirect_click: { bg: 'bg-gray-50', text: 'text-gray-600', label: 'Click' },
};

function TransactionRow({ tx }) {
  const style = TX_TYPE_STYLES[tx.type] || TX_TYPE_STYLES.redirect_click;
  return (
    <div className="flex items-center justify-between py-3 px-4 hover:bg-surface2 rounded-xl transition-colors">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold flex-shrink-0 ${style.bg} ${style.text}`}>
          {style.label}
        </span>
        <div className="min-w-0">
          <div className="text-sm font-medium text-t1 truncate">
            {tx.follower_name || tx.follower_phone || 'Customer'}
          </div>
          <div className="text-[10px] text-t3">
            {new Date(tx.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
          </div>
        </div>
      </div>
      <div className="text-sm font-bold text-navy ml-3">{fmtMoney(tx.amount || 0)}</div>
    </div>
  );
}

/* ── Main Dashboard ─────────────────────────────────────────── */

export default function BrandDashboardHome() {
  const [brand, setBrand]               = useState(null);
  const [wallet, setWallet]             = useState(null);
  const [campaigns, setCampaigns]       = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [products, setProducts]         = useState([]);
  const [inbox, setInbox]               = useState(null);
  const [loading, setLoading]           = useState(true);

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
      if (br.success) setBrand(br.data?.brand || br.data);
      if (wl.success) setWallet(wl.data?.wallet || wl.data);
      if (cp.success) setCampaigns(cp.data?.campaigns || []);
      if (tx.success) setTransactions(tx.data?.transactions || tx.data || []);
      if (pr.success) setProducts(pr.data?.products || pr.data || []);
      if (ib.success) setInbox(ib.data?.summary || null);
    }
    load();
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center h-40 text-t3 text-sm">Loading dashboard...</div>
  );

  const balance      = wallet?.wallet_balance || 0;
  const escrowLocked = wallet?.escrow_locked || 0;
  const activeCampaigns = campaigns.filter(c => ['active', 'live'].includes(c.status));
  const recentCampaigns = campaigns.slice(0, 3);
  const recentTx        = Array.isArray(transactions) ? transactions.slice(0, 5) : [];
  const productCount    = Array.isArray(products) ? products.length : 0;

  // Revenue from transactions
  const totalRevenue = recentTx.reduce((sum, tx) => sum + (tx.amount || 0), 0);

  const today = new Date().toLocaleDateString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

  const isPending  = brand?.status === 'pending';
  const isApproved = brand?.status === 'approved';
  const isRejected = brand?.status === 'rejected';

  return (
    <div className="max-w-5xl">

      {/* ── Welcome Header ──────────────────────────────────── */}
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-t1">
          Welcome back{brand?.business_name ? `, ${brand.business_name}` : ''}
        </h1>
        <p className="text-xs text-t3 mt-1">{today}</p>
      </div>

      {/* ── Account Status Banners ──────────────────────────── */}
      {isPending && (
        <div className="mb-5 p-4 bg-amber-50 border border-amber-300 rounded-xl flex items-center gap-3">
          <span className="text-amber-500 text-xl">&#9888;</span>
          <div>
            <div className="text-sm font-bold text-amber-700">Account Pending Review</div>
            <div className="text-xs text-amber-600 mt-0.5">Your account is being reviewed by our team. Some features may be limited until approval.</div>
          </div>
        </div>
      )}
      {isRejected && (
        <div className="mb-5 p-4 bg-red-50 border border-red-300 rounded-xl flex items-center gap-3">
          <span className="text-red-500 text-xl">&#10006;</span>
          <div>
            <div className="text-sm font-bold text-red-700">Account Rejected</div>
            <div className="text-xs text-red-600 mt-0.5">
              Your account application was not approved.{' '}
              <a href="/dashboard/profile" className="font-semibold underline">Review your profile</a> and resubmit.
            </div>
          </div>
        </div>
      )}
      {isApproved && (
        <div className="mb-5 flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-green-50 border border-green-200 rounded-full text-xs font-bold text-green-700">
            <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
            Verified Account
          </span>
        </div>
      )}

      {/* ── Action Required (brand inbox) ─────────────────────── */}
      {inbox && (inbox.pending_negotiations + inbox.pending_reviews + inbox.pending_signatures + inbox.contracts_failed + inbox.pdf_failed) > 0 && (
        <div className="mb-6 p-4 bg-orange-50 border border-orange-200 rounded-2xl">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-orange-900">Action Required</h2>
            <span className="text-[10px] text-orange-600 font-semibold">Things waiting on you</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            <a href="/dashboard/inbox?tab=negotiations" className="bg-white border border-orange-200 rounded-xl px-3 py-2 hover:border-orange-400 transition-colors">
              <div className="text-2xl font-extrabold text-orange-700">{inbox.pending_negotiations}</div>
              <div className="text-[10px] font-bold text-gray-600 uppercase tracking-wide">Negotiations</div>
            </a>
            <a href="/dashboard/inbox?tab=reviews" className="bg-white border border-orange-200 rounded-xl px-3 py-2 hover:border-orange-400 transition-colors">
              <div className="text-2xl font-extrabold text-orange-700">{inbox.pending_reviews}</div>
              <div className="text-[10px] font-bold text-gray-600 uppercase tracking-wide">Content reviews</div>
            </a>
            <a href="/dashboard/inbox?tab=signatures" className="bg-white border border-orange-200 rounded-xl px-3 py-2 hover:border-orange-400 transition-colors">
              <div className="text-2xl font-extrabold text-orange-700">{inbox.pending_signatures}</div>
              <div className="text-[10px] font-bold text-gray-600 uppercase tracking-wide">Contract signs</div>
            </a>
            {inbox.contracts_failed > 0 && (
              <a href="/dashboard/inbox?tab=failures" className="bg-white border border-red-300 rounded-xl px-3 py-2 hover:border-red-500 transition-colors">
                <div className="text-2xl font-extrabold text-red-700">{inbox.contracts_failed}</div>
                <div className="text-[10px] font-bold text-red-700 uppercase tracking-wide">Contract failed</div>
              </a>
            )}
            {inbox.pdf_failed > 0 && (
              <a href="/dashboard/inbox?tab=failures" className="bg-white border border-red-300 rounded-xl px-3 py-2 hover:border-red-500 transition-colors">
                <div className="text-2xl font-extrabold text-red-700">{inbox.pdf_failed}</div>
                <div className="text-[10px] font-bold text-red-700 uppercase tracking-wide">PDF failed</div>
              </a>
            )}
          </div>
        </div>
      )}

      {/* ── Overview Stat Cards ─────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          label="Active Campaigns"
          value={activeCampaigns.length}
          sub={`${campaigns.length} total campaigns`}
          color="teal"
          icon="&#128640;"
          href="/dashboard/campaigns"
        />
        <StatCard
          label="Wallet Balance"
          value={fmtMoney(balance)}
          sub={escrowLocked > 0 ? `${fmtMoney(escrowLocked)} in escrow` : 'No escrow locked'}
          color={balance < 50000 ? 'red' : 'navy'}
          icon="&#128176;"
          href="/dashboard/wallet"
        />
        <StatCard
          label="Total Revenue"
          value={fmtMoney(totalRevenue)}
          sub="From follower transactions"
          color="orange"
          icon="&#128200;"
          href="/dashboard/conversions"
        />
        <StatCard
          label="Listed Products"
          value={productCount}
          sub="In your catalogue"
          color="navy"
          icon="&#128722;"
          href="/dashboard/products"
        />
      </div>

      {/* ── Quick Actions ───────────────────────────────────── */}
      <div className="mb-8">
        <h2 className="text-sm font-bold text-t1 mb-3">Quick Actions</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { href: '/dashboard/campaigns/new', label: 'Create Campaign',   gradient: 'from-navy to-teal' },
            { href: '/dashboard/influencers',   label: 'Browse Influencers', gradient: 'from-teal to-emerald-500' },
            { href: '/dashboard/products',      label: 'Manage Listings',    gradient: 'from-orange to-amber-400' },
            { href: '/dashboard/wallet',        label: 'View Wallet',        gradient: 'from-navy to-indigo-500' },
          ].map(a => (
            <a key={a.href} href={a.href}
              className={`bg-gradient-to-r ${a.gradient} rounded-xl p-3.5 text-center text-white text-xs font-bold shadow-sm hover:shadow-md hover:scale-[1.02] transition-all`}>
              {a.label}
            </a>
          ))}
        </div>
      </div>

      {/* ── Two-column: Recent Activity + Recent Campaigns ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Recent Activity */}
        <div className="bg-white rounded-xl border border-border">
          <div className="flex items-center justify-between px-4 pt-4 pb-2">
            <h2 className="text-sm font-bold text-t1">Recent Activity</h2>
            <a href="/dashboard/conversions" className="text-xs text-navy font-semibold hover:underline">View all &rarr;</a>
          </div>
          {recentTx.length === 0 ? (
            <div className="px-4 py-8 text-center text-t3 text-sm">
              <div className="text-3xl mb-2">&#128203;</div>
              No transactions yet. Activity from follower purchases will appear here.
            </div>
          ) : (
            <div className="pb-2">
              {recentTx.map((tx, i) => <TransactionRow key={tx.id || i} tx={tx} />)}
            </div>
          )}
        </div>

        {/* Recent Campaigns */}
        <div className="bg-white rounded-xl border border-border">
          <div className="flex items-center justify-between px-4 pt-4 pb-2">
            <h2 className="text-sm font-bold text-t1">Recent Campaigns</h2>
            <a href="/dashboard/campaigns" className="text-xs text-navy font-semibold hover:underline">View all &rarr;</a>
          </div>
          {recentCampaigns.length === 0 ? (
            <div className="px-4 py-8 text-center text-t3 text-sm">
              <div className="text-3xl mb-2">&#128227;</div>
              No campaigns yet.{' '}
              <a href="/dashboard/campaigns/new" className="text-navy font-semibold hover:underline">Create your first campaign</a>
            </div>
          ) : (
            <div className="pb-2">
              {recentCampaigns.map(c => <CampaignRow key={c.id} c={c} />)}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
