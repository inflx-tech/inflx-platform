'use client';

import { useEffect, useState, useCallback } from 'react';
import { adminApi } from '../../../lib/api';

/**
 * Returns admin page — Fashion-1b reviewer workflow.
 *
 * Reviews customer-initiated returns (follower_returns table, migration 048).
 * Admin can: approve (with refund_amount), reject (with admin_notes), or
 * mark a previously-approved return as refunded (after Razorpay refund is
 * processed manually for V1).
 *
 * Status filter pills cycle through: requested (default) | approved |
 * received | refunded | rejected.
 *
 * Action modal: tap any row to expand the approve/reject form inline.
 */

const STATUS_TABS = [
  { value: 'requested', label: 'Awaiting Review', accent: 'bg-orange-pale text-orange', count: true },
  { value: 'approved',  label: 'Approved',         accent: 'bg-navy-pale text-navy' },
  { value: 'received',  label: 'Goods Received',   accent: 'bg-navy-pale text-navy' },
  { value: 'refunded',  label: 'Refunded',         accent: 'bg-teal-pale text-teal' },
  { value: 'rejected',  label: 'Rejected',         accent: 'bg-red-pale text-red' },
];

function fmtMoney(n) {
  if (n == null) return '—';
  return '₹' + Number(n).toLocaleString('en-IN');
}

function fmtDate(s) {
  if (!s) return '—';
  return new Date(s).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
}

export default function ReturnsPage() {
  const [statusFilter, setStatusFilter] = useState('requested');
  const [returns, setReturns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionFor, setActionFor] = useState(null);  // id of return being acted on
  const [actionMode, setActionMode] = useState(null);// 'approve' | 'reject' | 'refund'
  const [refundAmount, setRefundAmount] = useState('');
  const [adminNotes, setAdminNotes] = useState('');
  const [refundId, setRefundId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(
        (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/v1').replace(/\/+$/, '') +
          `/admin/returns?status=${statusFilter}`,
        {
          headers: typeof window !== 'undefined'
            ? { Authorization: `Bearer ${localStorage.getItem('inflx_token')}` }
            : {},
        }
      );
      const json = await res.json();
      if (json?.success) {
        setReturns(json.data?.returns || []);
      } else {
        setErr(json?.error?.message || 'Failed to load');
      }
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);

  function openAction(retId, mode, prefillRefund) {
    setActionFor(retId);
    setActionMode(mode);
    setRefundAmount(prefillRefund || '');
    setAdminNotes('');
    setRefundId('');
  }
  function closeAction() {
    setActionFor(null);
    setActionMode(null);
    setRefundAmount('');
    setAdminNotes('');
    setRefundId('');
  }

  async function callAdmin(method, path, body) {
    const base = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/v1').replace(/\/+$/, '');
    const res = await fetch(base + path, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${typeof window !== 'undefined' ? localStorage.getItem('inflx_token') : ''}`,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    return res.json();
  }

  async function submitAction() {
    setSubmitting(true);
    setErr(null);
    try {
      let path, body;
      if (actionMode === 'approve') {
        if (!(Number(refundAmount) > 0)) {
          setErr('Refund amount must be > 0');
          setSubmitting(false);
          return;
        }
        path = `/admin/returns/${actionFor}/approve`;
        body = { refund_amount: Number(refundAmount), admin_notes: adminNotes || null };
      } else if (actionMode === 'reject') {
        if (!adminNotes.trim()) {
          setErr('Please add notes when rejecting');
          setSubmitting(false);
          return;
        }
        path = `/admin/returns/${actionFor}/reject`;
        body = { admin_notes: adminNotes };
      } else if (actionMode === 'refund') {
        path = `/admin/returns/${actionFor}/mark-refunded`;
        body = { razorpay_refund_id: refundId || null };
      }
      const r = await callAdmin('POST', path, body);
      if (r?.success) {
        closeAction();
        await load();
      } else {
        setErr(r?.error?.message || 'Action failed');
      }
    } catch (e) {
      setErr(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="p-6">
      <div className="flex items-end justify-between mb-5">
        <div>
          <h1 className="font-display text-xl font-bold text-t1">Returns</h1>
          <p className="text-xs text-t3 mt-1">Review customer-initiated returns. Approve with refund amount, reject with notes, or mark refunded after issuing payment.</p>
        </div>
      </div>

      {/* Status tabs */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {STATUS_TABS.map(t => (
          <button key={t.value} onClick={() => setStatusFilter(t.value)}
            className={`px-3 py-1.5 rounded-full text-xs font-bold border-2 transition-all
              ${statusFilter === t.value
                ? 'border-navy bg-navy text-white'
                : 'border-border text-t2 hover:border-navy/40'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {err && (
        <div className="bg-red-pale border border-red/30 rounded-xl p-3 mb-4 text-sm text-red">
          {err}
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="text-center py-12 text-sm text-t3">Loading…</div>
      ) : returns.length === 0 ? (
        <div className="text-center py-16 bg-surface2 rounded-2xl border border-border">
          <p className="text-3xl mb-2">↩️</p>
          <p className="text-sm font-bold text-t1">No returns in this state</p>
          <p className="text-xs text-t3 mt-1">Returns will show up here as customers submit them.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {returns.map(r => {
            const isActing = actionFor === r.id;
            const statusTab = STATUS_TABS.find(t => t.value === r.return_status);
            return (
              <div key={r.id} className="bg-white border border-border rounded-2xl p-4">
                <div className="flex items-start gap-3">
                  <div className="w-14 h-14 rounded-lg bg-surface2 flex items-center justify-center overflow-hidden flex-shrink-0">
                    {r.product_image_url
                      ? <img src={r.product_image_url} alt={r.product_name} className="w-full h-full object-cover" />
                      : <span className="text-2xl">👗</span>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-t1">{r.product_name || 'Item'}</span>
                      {(r.variant_size || r.variant_color) && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-surface2 text-t2 font-bold">
                          {[r.variant_size, r.variant_color].filter(Boolean).join(' · ')}
                        </span>
                      )}
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${statusTab?.accent || 'bg-surface2 text-t2'}`}>
                        {statusTab?.label || r.return_status}
                      </span>
                    </div>
                    <div className="text-[11px] text-t3 mt-1">
                      <strong className="text-t1">{r.brand_name}</strong> · {r.follower_name} ({r.follower_phone}) · Tx {fmtMoney(r.transaction_amount)}
                    </div>
                    <div className="text-[11px] text-t2 mt-1">
                      <strong className="text-t1 capitalize">{(r.reason || '').replace(/_/g, ' ')}</strong>
                      {r.reason_text ? ` — ${r.reason_text}` : ''}
                    </div>
                    <div className="text-[10px] text-t3 mt-1">
                      Requested {fmtDate(r.created_at)}
                      {r.reviewed_at && ` · Reviewed ${fmtDate(r.reviewed_at)}`}
                      {r.refunded_at && ` · Refunded ${fmtDate(r.refunded_at)}`}
                    </div>
                    {r.refund_amount != null && (
                      <div className="text-[11px] text-teal font-bold mt-1">Refund: {fmtMoney(r.refund_amount)}</div>
                    )}
                    {r.admin_notes && (
                      <div className="text-[11px] text-t2 mt-1 italic">"{r.admin_notes}"</div>
                    )}
                  </div>

                  {/* Action buttons */}
                  {!isActing && (
                    <div className="flex flex-col gap-1.5">
                      {r.return_status === 'requested' && (
                        <>
                          <button onClick={() => openAction(r.id, 'approve', r.transaction_amount || '')}
                            className="text-[10px] px-3 py-1.5 bg-teal text-white font-bold rounded-lg hover:opacity-90">Approve</button>
                          <button onClick={() => openAction(r.id, 'reject')}
                            className="text-[10px] px-3 py-1.5 border border-red text-red font-bold rounded-lg hover:bg-red-pale">Reject</button>
                        </>
                      )}
                      {(r.return_status === 'approved' || r.return_status === 'received') && (
                        <button onClick={() => openAction(r.id, 'refund')}
                          className="text-[10px] px-3 py-1.5 bg-navy text-white font-bold rounded-lg hover:opacity-90">Mark refunded</button>
                      )}
                    </div>
                  )}
                </div>

                {/* Inline action form */}
                {isActing && (
                  <div className="mt-3 pt-3 border-t border-border space-y-2">
                    {actionMode === 'approve' && (
                      <>
                        <label className="text-[10px] font-bold text-t3 uppercase">Refund Amount (₹)</label>
                        <input type="number" value={refundAmount} onChange={e => setRefundAmount(e.target.value)}
                          className="w-full border-2 border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-teal" />
                        <label className="text-[10px] font-bold text-t3 uppercase mt-2">Notes (optional)</label>
                        <textarea value={adminNotes} onChange={e => setAdminNotes(e.target.value)} rows={2}
                          className="w-full border-2 border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-teal resize-none" />
                      </>
                    )}
                    {actionMode === 'reject' && (
                      <>
                        <label className="text-[10px] font-bold text-t3 uppercase">Reason for rejection (visible to customer)</label>
                        <textarea value={adminNotes} onChange={e => setAdminNotes(e.target.value)} rows={3}
                          placeholder="e.g. Outside return window — please contact us for special review"
                          className="w-full border-2 border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-red resize-none" />
                      </>
                    )}
                    {actionMode === 'refund' && (
                      <>
                        <label className="text-[10px] font-bold text-t3 uppercase">Razorpay Refund ID (optional)</label>
                        <input type="text" value={refundId} onChange={e => setRefundId(e.target.value)}
                          placeholder="rfnd_..."
                          className="w-full border-2 border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-navy" />
                        <p className="text-[10px] text-t3 italic">For V1, Razorpay refund is initiated manually; paste the ID here once issued.</p>
                      </>
                    )}
                    <div className="flex gap-2 justify-end pt-1">
                      <button onClick={closeAction} disabled={submitting}
                        className="text-xs px-4 py-2 text-t2 hover:text-t1">Cancel</button>
                      <button onClick={submitAction} disabled={submitting}
                        className={`text-xs px-4 py-2 font-bold rounded-lg text-white
                          ${actionMode === 'reject' ? 'bg-red' : actionMode === 'refund' ? 'bg-navy' : 'bg-teal'}
                          ${submitting ? 'opacity-50' : ''}`}>
                        {submitting ? 'Saving…' : 'Confirm'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
