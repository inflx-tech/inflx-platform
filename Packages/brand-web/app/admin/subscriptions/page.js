'use client';
import { useEffect, useState, useCallback } from 'react';
import { adminApi } from '../../../lib/api';

// Active brand subscriptions queue + mandate status + next charge.
// Read-only view; brand-side cancellation happens via the brand UI (Phase A7-brand).

function fmtINR(n) {
  if (n == null) return '—';
  return '₹' + Number(n).toLocaleString('en-IN');
}
function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

const STATUS_PILL = {
  active:   'bg-teal-100 text-teal-700',
  paused:   'bg-amber-100 text-amber-700',
  cancelled:'bg-red-100 text-red-700',
  past_due: 'bg-orange-100 text-orange-700',
};
const MANDATE_PILL = {
  active:   'bg-teal-100 text-teal-700',
  pending:  'bg-gray-100 text-gray-700',
  paused:   'bg-amber-100 text-amber-700',
  cancelled:'bg-red-100 text-red-700',
  revoked:  'bg-red-100 text-red-700',
};

export default function AdminSubscriptionsPage() {
  const [subs, setSubs] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ status: 'active', tier_key: '' });
  const [toast, setToast] = useState(null);

  const showToast = useCallback((msg, type = 'ok') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  async function load() {
    setLoading(true);
    const params = {};
    if (filter.status)   params.status   = filter.status;
    if (filter.tier_key) params.tier_key = filter.tier_key;
    params.limit = 200;
    const res = await adminApi.listActiveSubscriptions(params);
    setLoading(false);
    if (res.success) {
      setSubs(res.data.subscriptions || []);
      setTotal(res.data.total || 0);
    } else {
      showToast(res.error?.message || 'Failed to load', 'err');
    }
  }

  useEffect(() => { load(); }, [filter.status, filter.tier_key]);

  return (
    <div className="max-w-6xl">
      {toast && (
        <div className={`fixed top-5 right-5 z-50 px-5 py-3 rounded-xl shadow-lg text-sm font-semibold ${toast.type === 'err' ? 'bg-red-600 text-white' : 'bg-teal-600 text-white'}`}>
          {toast.type === 'err' ? '✗' : '✓'} {toast.msg}
        </div>
      )}

      <div className="mb-6">
        <h1 className="font-display text-xl font-bold text-t1">Active Subscriptions (L1)</h1>
        <p className="text-xs text-t3 mt-0.5">
          All brand_subscriptions rows with their tier + mandate state. Filter by status / tier.
        </p>
      </div>

      <div className="flex gap-3 mb-4 bg-white p-3 rounded-xl border border-border">
        <div>
          <label className="text-[10px] font-bold text-t3 uppercase block mb-1">Status</label>
          <select value={filter.status} onChange={e => setFilter({ ...filter, status: e.target.value })}
            className="px-3 py-1.5 text-sm border border-border rounded-lg">
            <option value="">All</option>
            <option value="active">Active</option>
            <option value="paused">Paused</option>
            <option value="past_due">Past Due</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
        <div>
          <label className="text-[10px] font-bold text-t3 uppercase block mb-1">Tier</label>
          <select value={filter.tier_key} onChange={e => setFilter({ ...filter, tier_key: e.target.value })}
            className="px-3 py-1.5 text-sm border border-border rounded-lg">
            <option value="">All</option>
            <option value="free">Free</option>
            <option value="growth">Growth</option>
            <option value="pro">Pro</option>
            <option value="enterprise">Enterprise</option>
          </select>
        </div>
        <div className="flex-1 flex items-end justify-end">
          <span className="text-xs text-t3">Showing {subs.length} of {total}</span>
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map(i => <div key={i} className="h-14 bg-surface2 rounded-xl animate-pulse" />)}
        </div>
      ) : subs.length === 0 ? (
        <div className="bg-white p-8 text-center text-t3 rounded-xl border border-border">No subscriptions matching filters.</div>
      ) : (
        <div className="bg-white rounded-xl border border-border overflow-hidden">
          <div className="grid grid-cols-12 gap-2 px-4 py-3 bg-surface2 text-[10px] font-bold text-t3 uppercase tracking-wide">
            <div className="col-span-3">Brand</div>
            <div className="col-span-2">Tier · Price</div>
            <div className="col-span-1">Status</div>
            <div className="col-span-1">Mandate</div>
            <div className="col-span-2">Cycle</div>
            <div className="col-span-2">Next charge</div>
            <div className="col-span-1 text-right">Last paid</div>
          </div>
          {subs.map((s, i) => (
            <div key={s.id} className={`grid grid-cols-12 gap-2 px-4 py-3 items-center text-sm ${i < subs.length - 1 ? 'border-b border-border' : ''}`}>
              <div className="col-span-3">
                <div className="font-semibold text-t1 truncate">{s.business_name}</div>
                <div className="text-[10px] text-t3 truncate">{s.brand_id}</div>
              </div>
              <div className="col-span-2">
                <div className="font-semibold text-t1 capitalize">{s.tier_key}</div>
                <div className="text-[11px] text-t3">{fmtINR(s.monthly_price_inr)}/mo</div>
              </div>
              <div className="col-span-1">
                <span className={`inline-block px-2 py-0.5 text-[10px] font-bold rounded ${STATUS_PILL[s.status] || 'bg-gray-100'}`}>
                  {s.status}
                </span>
              </div>
              <div className="col-span-1">
                <span className={`inline-block px-2 py-0.5 text-[10px] font-bold rounded ${MANDATE_PILL[s.mandate_status] || 'bg-gray-100'}`}>
                  {s.mandate_status || '—'}
                </span>
              </div>
              <div className="col-span-2 text-[11px] text-t2">
                {fmtDate(s.current_cycle_start)} → {fmtDate(s.current_cycle_end)}
              </div>
              <div className="col-span-2 text-[11px] text-t2">
                {fmtDate(s.next_charge_at)}
              </div>
              <div className="col-span-1 text-right text-[11px] text-t3">
                {fmtDate(s.last_charged_at)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
