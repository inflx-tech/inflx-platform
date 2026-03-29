'use client';
import { useEffect, useState } from 'react';
import { brandApi, walletApi, campaignApi, fmtMoney, fmtRupees } from '../../lib/api';

function StatCard({ label, value, sub, color = 'navy', href }) {
  const colorMap = {
    navy:   'text-navy border-navy/10',
    teal:   'text-teal border-teal/10',
    orange: 'text-orange border-orange/10',
    gold:   'text-yellow-600 border-yellow-200',
    red:    'text-red border-red/10',
  };
  const card = (
    <div className={`bg-white rounded-xl border ${colorMap[color]} p-4 ${href ? 'hover:shadow-md transition-shadow cursor-pointer' : ''}`}>
      <div className="text-[10px] font-bold uppercase tracking-wider text-t3 mb-1">{label}</div>
      <div className={`font-display text-2xl font-extrabold ${colorMap[color].split(' ')[0]} mb-0.5`}>{value}</div>
      {sub && <div className="text-[10px] text-t3">{sub}</div>}
    </div>
  );
  return href ? <a href={href}>{card}</a> : card;
}

function CampaignRow({ c }) {
  const STATUS = {
    draft:          'bg-gray-100 text-gray-500',
    pending_wallet: 'bg-yellow-100 text-yellow-700',
    active:         'bg-teal-100 text-teal-700',
    live:           'bg-teal-100 text-teal-700',
    completed:      'bg-blue-100 text-blue-700',
    cancelled:      'bg-red-100 text-red-600',
  };
  return (
    <a href={`/dashboard/campaigns/${c.id}`}
      className="flex items-center justify-between py-3 px-4 hover:bg-surface2 rounded-xl transition-colors">
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-t1 truncate">{c.name}</div>
        <div className="text-[10px] text-t3 mt-0.5">
          {c.start_date ? new Date(c.start_date).toLocaleDateString('en-IN') : '—'} · {fmtRupees(c.total_budget || 0)}
        </div>
      </div>
      <span className={`ml-3 px-2 py-0.5 rounded-full text-[9px] font-bold capitalize flex-shrink-0 ${STATUS[c.status] || STATUS.draft}`}>
        {c.status?.replace(/_/g, ' ')}
      </span>
    </a>
  );
}

export default function BrandDashboardHome() {
  const [brand, setBrand]       = useState(null);
  const [wallet, setWallet]     = useState(null);
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    async function load() {
      const [br, wl, cp] = await Promise.all([
        brandApi.getMe(),
        walletApi.getBalance(),
        campaignApi.list(),
      ]);
      setLoading(false);
      if (br.success) setBrand(br.data?.brand || br.data);
      if (wl.success) setWallet(wl.data?.wallet || wl.data);
      if (cp.success) setCampaigns(cp.data?.campaigns || []);
    }
    load();
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center h-40 text-t3 text-sm">Loading dashboard…</div>
  );

  const balance     = wallet?.wallet_balance || 0;
  const escrowLocked = wallet?.escrow_locked || 0;
  const active      = campaigns.filter(c => ['active', 'live'].includes(c.status));
  const draft       = campaigns.filter(c => c.status === 'draft');
  const pending     = campaigns.filter(c => c.status === 'pending_wallet');
  const recent      = campaigns.slice(0, 5);

  const isLowBalance = balance < 50000; // below ₹500

  return (
    <div className="max-w-4xl">
      {/* Page header */}
      <div className="mb-5">
        <h1 className="font-display text-xl font-bold text-t1">
          Welcome back{brand?.business_name ? `, ${brand.business_name}` : ''}!
        </h1>
        <p className="text-xs text-t3 mt-0.5">Here's your brand dashboard at a glance</p>
      </div>

      {/* Low wallet / pending wallet alerts */}
      {pending.length > 0 && (
        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-xl flex items-center justify-between">
          <div>
            <div className="text-sm font-bold text-yellow-700">⚠️ {pending.length} campaign{pending.length > 1 ? 's' : ''} waiting for wallet funds</div>
            <div className="text-xs text-t2 mt-0.5">Top up your wallet to publish and go live</div>
          </div>
          <a href="/dashboard/wallet" className="text-xs font-bold text-orange hover:underline">Top Up →</a>
        </div>
      )}
      {isLowBalance && balance > 0 && (
        <div className="mb-4 p-3 bg-orange-50 border border-orange/20 rounded-xl flex items-center justify-between">
          <div className="text-sm font-bold text-orange">💳 Low wallet balance — {fmtMoney(balance)} available</div>
          <a href="/dashboard/wallet" className="text-xs font-bold text-orange hover:underline">Add Funds →</a>
        </div>
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <StatCard
          label="Wallet Balance"
          value={fmtMoney(balance)}
          sub={`${fmtMoney(escrowLocked)} locked in escrow`}
          color={isLowBalance ? 'red' : 'navy'}
          href="/dashboard/wallet"
        />
        <StatCard
          label="Active Campaigns"
          value={active.length}
          sub={`${draft.length} draft · ${pending.length} pending wallet`}
          color="teal"
          href="/dashboard/campaigns"
        />
        <StatCard
          label="Total Campaigns"
          value={campaigns.length}
          sub="All time"
          color="navy"
          href="/dashboard/campaigns"
        />
        <StatCard
          label="Account Status"
          value={brand?.status || '—'}
          sub={brand?.category || ''}
          color={brand?.status === 'approved' ? 'teal' : 'gold'}
        />
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { href: '/dashboard/campaigns/new', icon: '🚀', label: 'New Campaign' },
          { href: '/dashboard/influencers',   icon: '🔍', label: 'Find Influencers' },
          { href: '/dashboard/wallet',        icon: '💰', label: 'Wallet' },
          { href: '/dashboard/orders',        icon: '📦', label: 'Orders' },
        ].map(a => (
          <a key={a.href} href={a.href}
            className="bg-white border border-border rounded-xl p-3 flex flex-col items-center gap-1.5 hover:border-navy hover:shadow-sm transition-all text-center">
            <span className="text-2xl">{a.icon}</span>
            <span className="text-[11px] font-bold text-t1">{a.label}</span>
          </a>
        ))}
      </div>

      {/* Recent campaigns */}
      <div className="bg-white rounded-xl border border-border">
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <h2 className="text-sm font-bold text-t1">Recent Campaigns</h2>
          <a href="/dashboard/campaigns" className="text-xs text-navy font-semibold hover:underline">View all →</a>
        </div>
        {recent.length === 0 ? (
          <div className="px-4 py-8 text-center text-t3 text-sm">
            <div className="text-3xl mb-2">📣</div>
            No campaigns yet. <a href="/dashboard/campaigns/new" className="text-navy font-semibold hover:underline">Create your first campaign</a>
          </div>
        ) : (
          <div className="pb-2">
            {recent.map(c => <CampaignRow key={c.id} c={c} />)}
          </div>
        )}
      </div>
    </div>
  );
}
