'use client';
import { useEffect, useState, useCallback } from 'react';
import { adminApi, fmtMoney } from '../../../lib/api';

// Returns workflow admin UI (G-4). Reuses the existing admin returns
// endpoints (queue + approve/reject/mark-refunded). The server lets a
// superadmin, or an admin holding the Returns permission, both read and decide;
// the buttons show for exactly those people (asked from /admin/me).
//
// shopper-walk-fixes (W14): a return of an item ordered through a creator's post (`order_line_id`
// is set) is decided here the same way, with three differences the server enforces: the refund is
// what was paid for the item (never a typed amount); items returned together are approved, rejected
// and refunded together; and "Mark refunded" itself undoes the item and sends an online payment back.

const TABS = [
  { key: 'requested', label: 'Requested' },
  { key: 'approved',  label: 'Approved' },
  { key: 'received',  label: 'Received' },
  { key: 'refunded',  label: 'Refunded' },
  { key: 'rejected',  label: 'Rejected' },
];

const REASON_LABEL = {
  wrong_size:       'Wrong size',
  damaged:          'Damaged',
  not_as_described: 'Not as described',
  changed_mind:     'Changed mind',
  other:            'Other',
};

function StatusBadge({ status }) {
  const cfg = {
    requested: 'bg-gold-pale text-yellow-700',
    approved:  'bg-navy-pale text-navy',
    received:  'bg-navy-pale text-navy',
    refunded:  'bg-teal-pale text-teal-deep',
    rejected:  'bg-red-pale text-red',
  };
  return <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap ${cfg[status] || 'bg-surface2 text-t3'}`}>{status}</span>;
}

function fmtDate(d) {
  if (!d) return '--';
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function AdminReturnsPage() {
  const [tab, setTab] = useState('requested');
  const [returns, setReturns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');

  // Modal: { ret, action: 'approve' | 'reject' | 'refund' }
  const [modal, setModal] = useState(null);
  const [refundAmount, setRefundAmount] = useState('');
  const [adminNotes, setAdminNotes] = useState('');
  const [refundId, setRefundId] = useState('');
  const [processing, setProcessing] = useState(false);

  // Who may decide a return: the server's own rule (a superadmin, or the Returns permission).
  // shopper-walk-fixes: this used to read `admin_role` off the user kept at sign-in — which never
  // carries it — so Approve, Reject and Mark refunded were hidden from every admin.
  const [canAction, setCanAction] = useState(false);
  useEffect(() => {
    adminApi.getMe().then((res) => {
      if (res.success) setCanAction(res.data?.admin_role === 'superadmin' || (Array.isArray(res.data?.capabilities) && res.data.capabilities.includes('returns')));
    });
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await adminApi.getReturns(tab);
    setLoading(false);
    if (res.success || res.ok) setReturns(res.data?.returns || []);
    else setReturns([]);
  }, [tab]);

  useEffect(() => { load(); }, [load]);

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  }

  function openModal(ret, action) {
    setModal({ ret, action });
    setRefundAmount(ret.refund_amount != null ? String(ret.refund_amount) : (ret.transaction_amount != null ? String(ret.transaction_amount) : ''));
    setAdminNotes('');
    setRefundId('');
  }

  async function handleConfirm() {
    if (!modal) return;
    setProcessing(true);
    let res;
    if (modal.action === 'approve') {
      res = await adminApi.approveReturn(modal.ret.id, Number(refundAmount), adminNotes || undefined);
    } else if (modal.action === 'reject') {
      res = await adminApi.rejectReturn(modal.ret.id, adminNotes);
    } else {
      res = await adminApi.markReturnRefunded(modal.ret.id, refundId || undefined);
    }
    setProcessing(false);
    if (res.success || res.ok) {
      const rf = res.data?.refund;
      showToast(
        modal.action === 'approve' ? 'Return approved' :
        modal.action === 'reject'  ? 'Return rejected' :
        rf?.status === 'issued'    ? `Refunded ${fmtMoney(rf.amount)} to the shopper` :
        rf?.status === 'manual'    ? `Returned. Pay ${fmtMoney(rf.amount)} to the shopper by hand (cash order)` :
        rf?.status === 'failed'    ? `Returned, but the refund of ${fmtMoney(rf.amount)} FAILED — send it from Razorpay` :
                                     'Marked refunded'
      );
      setModal(null);
      load();
    } else {
      showToast(res.error?.message || 'Action failed');
    }
  }

  const gridCols = 'grid-cols-[1.4fr_1fr_110px_110px_100px_120px_160px]';

  return (
    <div className="max-w-6xl">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="font-display text-xl font-bold text-t1">Returns &amp; Refunds</h1>
          <p className="text-xs text-t3 mt-0.5">Review customer return requests, approve refunds, and record refund issuance.</p>
        </div>
      </div>

      {/* Status tabs */}
      <div className="flex items-center gap-2 mb-4">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${tab === t.key ? 'bg-navy text-white' : 'bg-white border border-border text-t2 hover:border-navy hover:text-navy'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-border overflow-hidden">
        <div className={`grid ${gridCols} gap-2 px-4 py-2.5 bg-surface2 border-b border-border text-[10px] font-bold uppercase tracking-wider text-t3`}>
          <div>Product</div>
          <div>Customer</div>
          <div>Reason</div>
          <div>Order / Refund</div>
          <div>Status</div>
          <div>Requested</div>
          <div>Action</div>
        </div>

        {loading ? (
          <div className="p-8 text-center text-t3 text-sm">Loading...</div>
        ) : returns.length === 0 ? (
          <div className="p-12 text-center">
            <div className="text-2xl mb-2">0</div>
            <div className="text-sm text-t3">No returns in this state</div>
          </div>
        ) : (
          returns.map(r => (
            <div key={r.id} className={`grid ${gridCols} gap-2 px-4 py-3 border-b border-border last:border-0 items-center`}>
              {/* Product */}
              <div className="flex items-center gap-2 min-w-0">
                {r.product_image_url ? (
                  <img src={r.product_image_url} alt="" className="w-9 h-9 rounded-lg object-cover bg-surface2 flex-shrink-0" />
                ) : (
                  <div className="w-9 h-9 rounded-lg bg-surface2 flex items-center justify-center text-t3 text-xs flex-shrink-0">▤</div>
                )}
                <div className="min-w-0">
                  <div className="text-xs font-medium text-t1 truncate">{r.product_name || 'Item'}{r.line_qty > 1 ? ` ×${r.line_qty}` : ''}</div>
                  <div className="text-[10px] text-t3 truncate">{r.brand_name}{(r.variant_size || r.variant_color) ? ` · ${[r.variant_size, r.variant_color].filter(Boolean).join(' / ')}` : ''}</div>
                </div>
              </div>
              {/* Customer */}
              <div className="min-w-0">
                <div className="text-xs text-t1 truncate">{r.follower_name || 'Customer'}</div>
                <div className="text-[10px] text-t3 truncate">{r.follower_phone}</div>
              </div>
              {/* Reason */}
              <div className="text-[11px] text-t2">{REASON_LABEL[r.reason] || r.reason}</div>
              {/* Amount */}
              <div className="font-display text-xs">
                <div className="font-bold text-t1">{fmtMoney(r.transaction_amount)}</div>
                {r.refund_amount != null && <div className="text-[10px] text-teal-deep">↳ {fmtMoney(r.refund_amount)}</div>}
                {r.order_line_id && <div className="text-[10px] text-t3">{r.payment_method === 'cod' ? 'Cash on delivery' : 'Paid online'}{r.request_items > 1 ? ` · ${r.request_items} items together` : ''}</div>}
              </div>
              {/* Status */}
              <div><StatusBadge status={r.return_status} /></div>
              {/* Requested */}
              <div className="text-[10px] text-t3">{fmtDate(r.created_at)}</div>
              {/* Actions */}
              <div className="flex gap-1 flex-wrap">
                {canAction && r.return_status === 'requested' && (
                  <>
                    <button onClick={() => openModal(r, 'approve')} className="px-2 py-1 text-[10px] font-bold bg-teal-pale text-teal-deep border border-teal/20 rounded-lg hover:bg-teal hover:text-white transition-colors">Approve</button>
                    <button onClick={() => openModal(r, 'reject')} className="px-2 py-1 text-[10px] font-bold bg-red-pale text-red border border-red/20 rounded-lg hover:bg-red hover:text-white transition-colors">Reject</button>
                  </>
                )}
                {canAction && (r.return_status === 'approved' || r.return_status === 'received') && (
                  <button onClick={() => openModal(r, 'refund')} className="px-2 py-1 text-[10px] font-bold bg-navy-pale text-navy border border-navy/20 rounded-lg hover:bg-navy hover:text-white transition-colors">Mark Refunded</button>
                )}
                {(r.return_status === 'refunded' || r.return_status === 'rejected') && (
                  <span className="text-[10px] text-t3">{r.admin_notes ? r.admin_notes.slice(0, 24) : '--'}</span>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Action modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-96 shadow-2xl">
            <h3 className="font-display text-base font-bold text-t1 mb-1">
              {modal.action === 'approve' ? 'Approve Return' : modal.action === 'reject' ? 'Reject Return' : 'Mark Refunded'}
            </h3>
            <p className="text-xs text-t3 mb-3">{modal.ret.product_name || 'Item'} · {modal.ret.brand_name}</p>

            <div className="bg-surface2 rounded-xl p-3 mb-4 space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-t3">Customer</span>
                <span className="text-t2">{modal.ret.follower_name || 'Customer'}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-t3">Order amount</span>
                <span className="font-bold text-t1 font-display">{fmtMoney(modal.ret.transaction_amount)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-t3">Reason</span>
                <span className="text-t2">{REASON_LABEL[modal.ret.reason] || modal.ret.reason}</span>
              </div>
              {modal.ret.reason_text && (
                <div className="text-[11px] text-t3 pt-1 border-t border-border">"{modal.ret.reason_text}"</div>
              )}
            </div>

            {modal.action === 'approve' && (
              <>
                {modal.ret.order_line_id ? (
                  <p className="text-xs text-t2 mb-3">
                    The refund is what was paid for {modal.ret.request_items > 1 ? `these ${modal.ret.request_items} items, returned together` : 'this item'}.
                    Approving tells the shopper and the store; the store collects it. Nothing is refunded until you mark it refunded.
                  </p>
                ) : (
                  <>
                    <label className="block text-xs font-bold text-t2 uppercase tracking-wider mb-2">Refund Amount (₹)</label>
                    <input
                      type="number" min="0" step="0.01"
                      value={refundAmount}
                      onChange={e => setRefundAmount(e.target.value)}
                      className="w-full border-2 border-border2 rounded-xl p-2.5 text-sm text-t1 outline-none focus:border-gold mb-3"
                    />
                  </>
                )}
                <label className="block text-xs font-bold text-t2 uppercase tracking-wider mb-2">Notes (optional)</label>
                <textarea
                  value={adminNotes}
                  onChange={e => setAdminNotes(e.target.value)}
                  placeholder="Internal / customer-visible note"
                  className="w-full border-2 border-border2 rounded-xl p-2.5 text-sm text-t1 outline-none focus:border-gold resize-none mb-4"
                  rows={2}
                />
              </>
            )}

            {modal.action === 'reject' && (
              <div className="mb-4">
                <label className="block text-xs font-bold text-t2 uppercase tracking-wider mb-2">Rejection Reason (required)</label>
                <textarea
                  value={adminNotes}
                  onChange={e => setAdminNotes(e.target.value)}
                  placeholder="Shown to the customer — explain why the return was declined"
                  className="w-full border-2 border-border2 rounded-xl p-2.5 text-sm text-t1 outline-none focus:border-gold resize-none"
                  rows={3}
                />
              </div>
            )}

            {modal.action === 'refund' && modal.ret.order_line_id && (
              <p className="text-xs text-t2 mb-4">
                Do this once the item is back with the store. It takes the item off the order, puts its stock back, takes the creator&apos;s commission out of her pending earnings, and adds nothing to the store&apos;s wallet for it.{' '}
                {modal.ret.payment_method === 'cod'
                  ? 'The shopper paid cash on delivery: after this, pay the refund to them by hand.'
                  : 'The refund goes back to the shopper\'s original payment method now.'}
              </p>
            )}
            {modal.action === 'refund' && !modal.ret.order_line_id && (
              <div className="mb-4">
                <label className="block text-xs font-bold text-t2 uppercase tracking-wider mb-2">Razorpay Refund ID (optional)</label>
                <input
                  type="text"
                  value={refundId}
                  onChange={e => setRefundId(e.target.value)}
                  placeholder="rfnd_xxx"
                  className="w-full border-2 border-border2 rounded-xl p-2.5 text-sm text-t1 outline-none focus:border-gold"
                />
                <p className="text-[10px] text-t3 mt-2">Records the refund as issued and notifies the customer. This cancels any held influencer commission for the order.</p>
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={handleConfirm}
                disabled={processing || (modal.action === 'reject' && !adminNotes.trim()) || (modal.action === 'approve' && !(Number(refundAmount) >= 0))}
                className={`flex-1 py-2.5 font-bold rounded-xl text-sm disabled:opacity-40 text-white ${
                  modal.action === 'reject' ? 'bg-gradient-to-r from-red to-orange' : 'bg-gradient-to-r from-teal to-teal-deep'
                }`}
              >
                {processing ? 'Working...' :
                  modal.action === 'approve' ? 'Approve Return' :
                  modal.action === 'reject'  ? 'Confirm Rejection' :
                                               'Mark Refunded'}
              </button>
              <button onClick={() => setModal(null)} className="px-4 py-2.5 bg-surface2 text-t2 font-bold rounded-xl text-sm">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 bg-t1 text-white px-4 py-3 rounded-xl text-sm font-medium shadow-lg z-50">{toast}</div>
      )}
    </div>
  );
}
