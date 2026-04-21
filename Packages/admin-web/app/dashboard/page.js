'use client';
import { useEffect, useState } from 'react';
import { adminApi } from '../../lib/api';

function StatCard({ label, value, sub, color = 'navy' }) {
  const colors = { navy: 'text-navy', teal: 'text-teal', orange: 'text-orange', gold: 'text-yellow-600' };
  return (
    <div className="bg-white rounded-xl border border-border p-3.5">
      <div className="text-[10px] font-bold uppercase tracking-wider text-t3 mb-1">{label}</div>
      <div className={`font-display text-2xl font-extrabold ${colors[color] || 'text-t1'} mb-0.5`}>{value}</div>
      {sub && <div className="text-[10px] text-t3">{sub}</div>}
    </div>
  );
}

export default function DashboardHome() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      const res = await adminApi.getStats();
      setLoading(false);
      if (res.success) setStats(res.data);
      else setError(res.error?.message || 'Failed to load stats');
    }
    load();
  }, []);

  if (loading) return <div className="flex items-center justify-center h-40 text-t3 text-sm">Loading...</div>;
  if (error) return <div className="p-4 bg-red-pale rounded-xl text-red text-sm">{error}</div>;
  if (!stats) return null;

  const pending = stats.pending_approvals || {};
  const totalPending = (pending.brands || 0) + (pending.influencers || 0);

  function fmt(n) { return new Intl.NumberFormat('en-IN').format(n || 0); }
  function fmtMoney(p) {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(p || 0);
  }

  return (
    <div className="max-w-4xl">
      <div className="mb-4">
        <h1 className="font-display text-xl font-bold text-t1">Platform Overview</h1>
        <p className="text-xs text-t3 mt-0.5">Real-time platform statistics</p>
      </div>

      {/* Pending alert */}
      {totalPending > 0 && (
        <div className="mb-4 p-3 bg-orange-pale border border-orange/20 rounded-xl flex items-center justify-between">
          <div>
            <div className="text-sm font-bold text-orange">⚠️ {totalPending} pending approval{totalPending !== 1 ? 's' : ''}</div>
            <div className="text-xs text-t2 mt-0.5">{pending.brands || 0} brands · {pending.influencers || 0} influencers</div>
          </div>
          <a href="/dashboard/approvals" className="text-xs font-bold text-orange hover:underline">Review →</a>
        </div>
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-4 gap-3 mb-4">
        <StatCard label="Total Brands" value={fmt(stats.active_brands || stats.total_brands)} sub="registered brands" color="navy" />
        <StatCard label="Influencers" value={fmt(stats.active_influencers || stats.total_influencers)} sub="registered influencers" color="orange" />
        <StatCard label="Active Campaigns" value={fmt(stats.active_campaigns || stats.live_campaigns)} sub="live right now" color="teal" />
        <StatCard label="Platform Revenue" value={fmtMoney(stats.platform_revenue_this_month)} sub="this month" color="gold" />
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-white rounded-xl border border-border p-4">
          <div className="text-xs font-bold text-t2 uppercase tracking-wider mb-3">Escrow Status</div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-t2">Locked</span>
            <span className="font-bold text-navy font-display">{fmtMoney(stats.escrow_locked)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-t2">Queued for release</span>
            <span className="font-bold text-gold font-display">{fmtMoney(stats.escrow_queued)}</span>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-border p-4">
          <div className="text-xs font-bold text-t2 uppercase tracking-wider mb-3">Follower Activity</div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-t2">Total Transactions</span>
            <span className="font-bold text-navy font-display">{fmt(stats.total_follower_transactions)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-t2">Commission Paid</span>
            <span className="font-bold text-teal font-display">{fmtMoney(stats.total_commission_paid)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
