'use client';
import { useEffect, useState, useCallback } from 'react';
import { adminApi } from '../../../../lib/api';

// Subscription invoice history with filters. Read-only.

function fmtINR(n) {
  if (n == null) return '—';
  return '₹' + Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}
function fmtDT(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' });
}

const STATUS_PILL = {
  pending:  'bg-amber-100 text-amber-700',
  paid:     'bg-teal-100 text-teal-700',
  failed:   'bg-red-100 text-red-700',
  refunded: 'bg-orange-100 text-orange-700',
};

export default function AdminBillingInvoicesPage() {
  const [invoices, setInvoices] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ status: '', tier_key: '', brand_id: '' });

  async function load() {
    setLoading(true);
    const params = {};
    if (filter.status)   params.status   = filter.status;
    if (filter.tier_key) params.tier_key = filter.tier_key;
    if (filter.brand_id) params.brand_id = filter.brand_id;
    params.limit = 200;
    const res = await adminApi.listSubscriptionInvoices(params);
    setLoading(false);
    if (res.success) {
      setInvoices(res.data.invoices || []);
      setTotal(res.data.total || 0);
    }
  }
  useEffect(() => { load(); }, [filter.status, filter.tier_key, filter.brand_id]);

  const totalPaid = invoices
    .filter(i => i.status === 'paid')
    .reduce((s, i) => s + parseFloat(i.total_inr || 0), 0);

  return (
    <div className="max-w-6xl">
      <div className="mb-6">
        <h1 className="font-display text-xl font-bold text-t1">Subscription Invoices (L1)</h1>
        <p className="text-xs text-t3 mt-0.5">
          All subscription_invoices rows with GST + payment IDs. Filter by status / tier / brand.
        </p>
      </div>

      <div className="flex gap-3 mb-4 bg-white p-3 rounded-xl border border-border items-end">
        <div>
          <label className="text-[10px] font-bold text-t3 uppercase block mb-1">Status</label>
          <select value={filter.status} onChange={e => setFilter({ ...filter, status: e.target.value })}
            className="px-3 py-1.5 text-sm border border-border rounded-lg">
            <option value="">All</option>
            <option value="pending">Pending</option>
            <option value="paid">Paid</option>
            <option value="failed">Failed</option>
            <option value="refunded">Refunded</option>
          </select>
        </div>
        <div>
          <label className="text-[10px] font-bold text-t3 uppercase block mb-1">Tier</label>
          <select value={filter.tier_key} onChange={e => setFilter({ ...filter, tier_key: e.target.value })}
            className="px-3 py-1.5 text-sm border border-border rounded-lg">
            <option value="">All</option>
            <option value="growth">Growth</option>
            <option value="pro">Pro</option>
            <option value="enterprise">Enterprise</option>
          </select>
        </div>
        <div>
          <label className="text-[10px] font-bold text-t3 uppercase block mb-1">Brand ID</label>
          <input type="text" placeholder="uuid"
            value={filter.brand_id} onChange={e => setFilter({ ...filter, brand_id: e.target.value })}
            className="px-3 py-1.5 text-sm border border-border rounded-lg w-56" />
        </div>
        <div className="flex-1 flex flex-col items-end">
          <span className="text-xs text-t3">Showing {invoices.length} of {total}</span>
          <span className="text-[11px] text-teal-700 font-semibold">Paid (filtered): {fmtINR(totalPaid)}</span>
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map(i => <div key={i} className="h-14 bg-surface2 rounded-xl animate-pulse" />)}
        </div>
      ) : invoices.length === 0 ? (
        <div className="bg-white p-8 text-center text-t3 rounded-xl border border-border">No invoices matching filters.</div>
      ) : (
        <div className="bg-white rounded-xl border border-border overflow-hidden">
          <div className="grid grid-cols-12 gap-2 px-4 py-3 bg-surface2 text-[10px] font-bold text-t3 uppercase tracking-wide">
            <div className="col-span-3">Brand · Tier</div>
            <div className="col-span-2">Period</div>
            <div className="col-span-1 text-right">Amount</div>
            <div className="col-span-1 text-right">GST</div>
            <div className="col-span-1 text-right">Total</div>
            <div className="col-span-1">Status</div>
            <div className="col-span-1">Paid at</div>
            <div className="col-span-2 text-right">Razorpay</div>
          </div>
          {invoices.map((iv, i) => (
            <div key={iv.id} className={`grid grid-cols-12 gap-2 px-4 py-3 items-center text-sm ${i < invoices.length - 1 ? 'border-b border-border' : ''}`}>
              <div className="col-span-3">
                <div className="font-semibold text-t1 truncate">{iv.business_name}</div>
                <div className="text-[10px] text-t3 capitalize">{iv.tier_key}</div>
              </div>
              <div className="col-span-2 text-[11px] text-t2">
                {fmtDate(iv.period_start)} → {fmtDate(iv.period_end)}
              </div>
              <div className="col-span-1 text-right text-sm font-semibold text-t1">
                {fmtINR(iv.amount_inr)}
              </div>
              <div className="col-span-1 text-right text-[11px] text-t3">
                {fmtINR(iv.gst_amount_inr)}
              </div>
              <div className="col-span-1 text-right text-sm font-bold text-t1">
                {fmtINR(iv.total_inr)}
              </div>
              <div className="col-span-1">
                <span className={`inline-block px-2 py-0.5 text-[10px] font-bold rounded ${STATUS_PILL[iv.status] || 'bg-gray-100'}`}>
                  {iv.status}
                </span>
                {iv.failure_reason && (
                  <div className="text-[10px] text-red-500 mt-0.5 truncate" title={iv.failure_reason}>{iv.failure_reason}</div>
                )}
              </div>
              <div className="col-span-1 text-[11px] text-t3">
                {fmtDT(iv.paid_at)}
              </div>
              <div className="col-span-2 text-right text-[10px] text-t3 font-mono truncate" title={iv.razorpay_payment_id}>
                {iv.razorpay_payment_id || '—'}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
