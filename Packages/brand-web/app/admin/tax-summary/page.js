'use client';

/**
 * /admin/tax-summary — Wave 4 (compliance reporting).
 * Monthly GST collected / TCS owed / TDS withheld for filing returns.
 * Finance/superadmin only (enforced by the backend route).
 */

import { useEffect, useState, useCallback } from 'react';
import { adminApi } from '../../../lib/api';

function fmt(n) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(Number(n) || 0);
}

function thisMonth() {
  return new Date().toISOString().slice(0, 7);
}

export default function TaxSummaryPage() {
  const [month, setMonth] = useState(thisMonth());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);

  const load = useCallback(async (m) => {
    setLoading(true); setErr(null);
    const res = await adminApi.getTaxSummary(m);
    setLoading(false);
    if (res.success) setData(res.data);
    else setErr(res.error?.message || 'Failed to load tax summary');
  }, []);

  useEffect(() => { load(month); }, [month, load]);

  const gst = data?.gst_collected;
  const detail = data?.detail || {};

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="font-display text-xl font-bold text-t1">Tax Summary</h1>
          <p className="text-xs text-t3 mt-0.5">Monthly GST collected, TCS owed, and TDS withheld — for filing returns.</p>
        </div>
        <input
          type="month"
          value={month}
          onChange={e => setMonth(e.target.value)}
          className="border border-border2 rounded-lg px-3 py-1.5 text-sm text-t1 outline-none focus:border-navy"
        />
      </div>

      {err && <div className="p-3 mb-4 bg-red-pale text-red rounded-lg text-sm">{err}</div>}

      {loading ? (
        <div className="p-12 text-center text-t3 text-sm">Loading…</div>
      ) : data ? (
        <>
          {/* Headline cards */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="bg-white rounded-xl border border-border p-4">
              <div className="text-[10px] font-bold uppercase tracking-wider text-t3 mb-1">GST collected</div>
              <div className="font-display text-2xl font-extrabold text-navy">{fmt(gst?.total)}</div>
            </div>
            <div className="bg-white rounded-xl border border-border p-4">
              <div className="text-[10px] font-bold uppercase tracking-wider text-t3 mb-1">TCS owed</div>
              <div className="font-display text-2xl font-extrabold text-orange">{fmt(data.tcs_owed)}</div>
            </div>
            <div className="bg-white rounded-xl border border-border p-4">
              <div className="text-[10px] font-bold uppercase tracking-wider text-t3 mb-1">TDS withheld</div>
              <div className="font-display text-2xl font-extrabold text-teal-deep">{fmt(data.tds_withheld)}</div>
            </div>
          </div>

          {/* GST breakdown */}
          <div className="bg-white rounded-xl border border-border overflow-hidden mb-4">
            <div className="px-4 py-2.5 bg-surface2 border-b border-border text-[10px] font-bold uppercase tracking-wider text-t3">GST collected — breakdown</div>
            {[
              ['Subscriptions (L1)', gst?.subscription, `${detail.subscription_invoices_paid || 0} invoices paid`],
              ['Commerce commission (L3)', gst?.commission, `${detail.commerce_transactions || 0} transactions`],
              ['Protection fee (L2)', gst?.escrow_fee, `${detail.escrow_tranches_released || 0} tranches released`],
            ].map(([label, val, sub]) => (
              <div key={label} className="flex items-center justify-between px-4 py-3 border-b border-border last:border-0">
                <div>
                  <div className="text-sm text-t1">{label}</div>
                  <div className="text-[10px] text-t3">{sub}</div>
                </div>
                <div className="font-display font-bold text-t1">{fmt(val)}</div>
              </div>
            ))}
            <div className="flex items-center justify-between px-4 py-3 bg-surface2 font-bold">
              <div className="text-sm text-t1">Total GST</div>
              <div className="font-display text-navy">{fmt(gst?.total)}</div>
            </div>
          </div>

          {/* Other lines */}
          <div className="bg-white rounded-xl border border-border overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <div>
                <div className="text-sm text-t1">TCS owed (Sec 52, commerce)</div>
                <div className="text-[10px] text-t3">deducted from brand settlements this month</div>
              </div>
              <div className="font-display font-bold text-orange">{fmt(data.tcs_owed)}</div>
            </div>
            <div className="flex items-center justify-between px-4 py-3">
              <div>
                <div className="text-sm text-t1">TDS withheld (influencer payouts)</div>
                <div className="text-[10px] text-t3">{detail.withdrawals_paid || 0} withdrawals paid</div>
              </div>
              <div className="font-display font-bold text-teal-deep">{fmt(data.tds_withheld)}</div>
            </div>
          </div>

          <p className="text-[10px] text-t3 mt-3">
            Date basis: subscription GST by invoice paid date; commission GST + TCS by transaction date; Protection-fee GST by tranche release date; TDS by payout completion date.
          </p>
        </>
      ) : null}
    </div>
  );
}
