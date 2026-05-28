'use client';
import { useEffect, useState, useCallback, useMemo } from 'react';
import { adminApi, getStoredUser } from '../../../lib/api';

const INFLUENCER_TABS = [
  { key: 'initiated',  label: 'Pending' },
  { key: 'processing', label: 'Processing' },
  { key: 'completed',  label: 'Completed' },
  { key: 'failed',     label: 'Failed' },
  { key: 'all',        label: 'All' },
];

const BRAND_TABS = [
  { key: 'pending',    label: 'Pending' },
  { key: 'processing', label: 'Processing' },
  { key: 'completed',  label: 'Completed' },
  { key: 'failed',     label: 'Failed' },
  { key: 'cancelled',  label: 'Cancelled' },
  { key: 'all',        label: 'All' },
];

// The status that is actionable (approve/reject) for each scope.
const ACTIONABLE = { influencer: 'initiated', brand: 'pending' };

function StatusBadge({ status }) {
  const cfg = {
    initiated:  'bg-gold-pale text-yellow-700',
    pending:    'bg-gold-pale text-yellow-700',
    queued:     'bg-navy-pale text-navy',
    processing: 'bg-navy-pale text-navy',
    completed:  'bg-teal-pale text-teal-deep',
    failed:     'bg-red-pale text-red',
    cancelled:  'bg-red-pale text-red',
  };
  return <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap ${cfg[status] || 'bg-surface2 text-t3'}`}>{status}</span>;
}

function MethodBadge({ method }) {
  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${method === 'upi' ? 'bg-navy-pale text-navy' : 'bg-surface2 text-t2'}`}>
      {method === 'upi' ? 'UPI' : 'Bank'}
    </span>
  );
}

function StatCard({ label, value, sub, color = 'navy' }) {
  const colors = { navy: 'text-navy', teal: 'text-teal', orange: 'text-orange', gold: 'text-yellow-600', red: 'text-red' };
  return (
    <div className="bg-white rounded-xl border border-border p-3.5">
      <div className="text-[10px] font-bold uppercase tracking-wider text-t3 mb-1">{label}</div>
      <div className={`font-display text-2xl font-extrabold ${colors[color] || 'text-t1'} mb-0.5`}>{value}</div>
      {sub && <div className="text-[10px] text-t3">{sub}</div>}
    </div>
  );
}

function maskAccount(val) {
  if (!val) return '--';
  const s = String(val);
  if (s.length <= 4) return s;
  return '****' + s.slice(-4);
}

export default function PayoutsPage() {
  const [scope, setScope] = useState('influencer'); // 'influencer' | 'brand'
  const TABS = useMemo(() => (scope === 'brand' ? BRAND_TABS : INFLUENCER_TABS), [scope]);

  const [tab, setTab] = useState('initiated');
  const [withdrawals, setWithdrawals] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Modal state
  const [modal, setModal] = useState(null); // { withdrawal, action: 'approve'|'reject' }
  const [rejectReason, setRejectReason] = useState('');
  const [processing, setProcessing] = useState(false);
  const [toast, setToast] = useState('');

  const user = typeof window !== 'undefined' ? getStoredUser() : null;
  const canProcess = user?.admin_role === 'finance' || user?.admin_role === 'superadmin';

  function switchScope(next) {
    if (next === scope) return;
    setScope(next);
    setTab(next === 'brand' ? 'pending' : 'initiated');
    setPage(1);
    setSearch('');
    setSearchInput('');
  }

  const load = useCallback(async () => {
    setLoading(true);
    const res = scope === 'brand'
      ? await adminApi.getBrandWithdrawals(tab, search, page)
      : await adminApi.getWithdrawals(tab, search, page);
    setLoading(false);
    if (res.success) {
      setWithdrawals(res.data?.withdrawals || []);
      setSummary(res.data?.summary || null);
      const total = res.meta?.total || 0;
      const limit = res.meta?.limit || 50;
      setTotalPages(Math.max(1, Math.ceil(total / limit)));
    }
  }, [scope, tab, search, page]);

  useEffect(() => { load(); }, [load]);

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  }

  async function handleProcess() {
    if (!modal) return;
    if (modal.action === 'reject' && !rejectReason.trim()) return;
    setProcessing(true);
    const reason = modal.action === 'reject' ? rejectReason : undefined;
    const res = scope === 'brand'
      ? await adminApi.processBrandWithdrawal(modal.withdrawal.id, modal.action, reason)
      : await adminApi.processWithdrawal(modal.withdrawal.id, modal.action, reason);
    setProcessing(false);
    if (res.success) {
      showToast(modal.action === 'approve' ? 'Withdrawal approved successfully' : 'Withdrawal rejected — funds returned to wallet');
      setModal(null);
      setRejectReason('');
      load();
    } else {
      showToast(res.error?.message || 'Action failed');
    }
  }

  function fmtMoney(p) {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(p || 0);
  }

  function fmtDate(d) {
    if (!d) return '--';
    return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  function handleSearch(e) {
    e.preventDefault();
    setPage(1);
    setSearch(searchInput);
  }

  const isBrand = scope === 'brand';
  const actionable = ACTIONABLE[scope];
  // Grid templates differ: brand has no TDS / Net Payout columns.
  const gridCols = isBrand
    ? 'grid-cols-[1.4fr_1fr_110px_90px_90px_150px_110px]'
    : 'grid-cols-[1.2fr_0.8fr_90px_90px_90px_80px_80px_130px_100px]';

  return (
    <div className="max-w-6xl">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="font-display text-xl font-bold text-t1">Payout Management</h1>
          <p className="text-xs text-t3 mt-0.5">
            {isBrand ? 'Review and process brand wallet withdrawal requests' : 'Review and process influencer withdrawal requests'}
          </p>
        </div>
        <form onSubmit={handleSearch} className="flex items-center gap-2">
          <input
            type="text"
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            placeholder={isBrand ? 'Search business, phone...' : 'Search name, phone, handle...'}
            className="w-56 border border-border2 rounded-lg px-3 py-1.5 text-xs text-t1 outline-none focus:border-navy"
          />
          <button type="submit" className="px-3 py-1.5 text-xs font-semibold bg-navy text-white rounded-lg">Search</button>
          {search && (
            <button type="button" onClick={() => { setSearchInput(''); setSearch(''); setPage(1); }} className="px-2 py-1.5 text-xs text-t3 hover:text-t1">Clear</button>
          )}
        </form>
      </div>

      {/* Scope toggle — Influencer / Brand payout queues */}
      <div className="flex items-center gap-2 mb-4">
        <button
          onClick={() => switchScope('influencer')}
          className={`px-4 py-2 text-xs font-bold rounded-lg transition-colors ${!isBrand ? 'bg-t1 text-white' : 'bg-white border border-border text-t2 hover:border-t1'}`}
        >
          Influencer
        </button>
        <button
          onClick={() => switchScope('brand')}
          className={`px-4 py-2 text-xs font-bold rounded-lg transition-colors ${isBrand ? 'bg-t1 text-white' : 'bg-white border border-border text-t2 hover:border-t1'}`}
        >
          Brand
        </button>
      </div>

      {/* Summary stats */}
      {summary && (
        <div className="grid grid-cols-4 gap-3 mb-4">
          <StatCard label="Pending Requests" value={summary.pending_count || 0} sub={`${fmtMoney(summary.pending_amount)} total`} color="orange" />
          <StatCard label="Processing" value={summary.processing_count || 0} sub="awaiting Razorpay" color="navy" />
          <StatCard label="Paid Today" value={summary.today_count || 0} sub={fmtMoney(summary.today_paid)} color="teal" />
          <StatCard label="Pending Amount" value={fmtMoney(summary.pending_amount)} sub={`${summary.pending_count || 0} request${(summary.pending_count || 0) !== 1 ? 's' : ''}`} color="gold" />
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-2 mb-4">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => { setTab(t.key); setPage(1); }}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${tab === t.key ? 'bg-navy text-white' : 'bg-white border border-border text-t2 hover:border-navy hover:text-navy'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-border overflow-hidden">
        {/* Header */}
        <div className={`grid ${gridCols} gap-2 px-4 py-2.5 bg-surface2 border-b border-border text-[10px] font-bold uppercase tracking-wider text-t3`}>
          <div>{isBrand ? 'Brand' : 'Influencer'}</div>
          <div>Payment</div>
          <div>{isBrand ? 'Amount' : 'Requested'}</div>
          {!isBrand && <div>TDS</div>}
          {!isBrand && <div>Net Payout</div>}
          <div>Method</div>
          <div>Status</div>
          <div>Date</div>
          <div>Action</div>
        </div>

        {loading ? (
          <div className="p-8 text-center text-t3 text-sm">Loading...</div>
        ) : withdrawals.length === 0 ? (
          <div className="p-12 text-center">
            <div className="text-2xl mb-2">0</div>
            <div className="text-sm text-t3">No {isBrand ? 'brand' : ''} withdrawal records for this filter</div>
            {search && <div className="text-xs text-t3 mt-1">Try adjusting your search query</div>}
          </div>
        ) : (
          withdrawals.map(w => (
            <div key={w.id} className={`grid ${gridCols} gap-2 px-4 py-3 border-b border-border last:border-0 items-center`}>
              {/* Identity */}
              <div>
                {isBrand ? (
                  <>
                    <div className="text-xs font-medium text-t1 truncate">{w.brand_name || 'Unknown'}</div>
                    <div className="text-[10px] text-t3 truncate">{w.brand_phone}</div>
                  </>
                ) : (
                  <>
                    <div className="text-xs font-medium text-t1 truncate">{w.influencer_name || 'Unknown'}</div>
                    <div className="text-[10px] text-t3 truncate">@{w.instagram_handle} · {w.influencer_phone}</div>
                  </>
                )}
              </div>
              {/* Payment info */}
              <div className="text-[10px] text-t2 truncate">
                {w.upi_id ? (
                  <span title={w.upi_id}>UPI: {maskAccount(w.upi_id)}</span>
                ) : w.bank_account_no ? (
                  <span title="Bank account">A/C: {maskAccount(w.bank_account_no)} {w.bank_ifsc ? `· ${w.bank_ifsc}` : ''}</span>
                ) : (
                  <span className="text-t3">--</span>
                )}
              </div>
              {/* Amount */}
              <div className="font-bold text-t1 font-display text-xs">{fmtMoney(w.amount_requested)}</div>
              {!isBrand && <div className="text-xs text-t3">{fmtMoney(w.tds_deducted)}</div>}
              {!isBrand && <div className="font-bold text-teal-deep font-display text-xs">{fmtMoney(w.net_paid)}</div>}
              {/* Method */}
              <div><MethodBadge method={w.method} /></div>
              {/* Status */}
              <div><StatusBadge status={w.status} /></div>
              {/* Date */}
              <div className="text-[10px] text-t3">
                {fmtDate(w.created_at)}
                {w.razorpay_payout_id && (
                  <div className="text-[9px] text-t3 truncate" title={w.razorpay_payout_id}>
                    RP: {w.razorpay_payout_id.slice(0, 16)}...
                  </div>
                )}
              </div>
              {/* Actions */}
              <div className="flex gap-1">
                {canProcess && w.status === actionable ? (
                  <>
                    <button
                      onClick={() => setModal({ withdrawal: w, action: 'approve' })}
                      className="px-2 py-1 text-[10px] font-bold bg-teal-pale text-teal-deep border border-teal/20 rounded-lg hover:bg-teal hover:text-white transition-colors"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => setModal({ withdrawal: w, action: 'reject' })}
                      className="px-2 py-1 text-[10px] font-bold bg-red-pale text-red border border-red/20 rounded-lg hover:bg-red hover:text-white transition-colors"
                    >
                      Reject
                    </button>
                  </>
                ) : (
                  <span className="text-[10px] text-t3">
                    {w.completed_at ? fmtDate(w.completed_at).split(',')[0] : '--'}
                  </span>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-4">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} className="px-3 py-1.5 text-xs font-semibold bg-white border border-border rounded-lg disabled:opacity-30">Prev</button>
          <span className="text-xs text-t3">Page {page} of {totalPages}</span>
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="px-3 py-1.5 text-xs font-semibold bg-white border border-border rounded-lg disabled:opacity-30">Next</button>
        </div>
      )}

      {/* Confirm Modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-96 shadow-2xl">
            <h3 className="font-display text-base font-bold text-t1 mb-1">
              {modal.action === 'approve' ? 'Confirm Approval' : 'Reject Withdrawal'}
            </h3>
            <p className="text-xs text-t3 mb-3">
              {isBrand
                ? modal.withdrawal.brand_name
                : `${modal.withdrawal.influencer_name} (@${modal.withdrawal.instagram_handle})`}
            </p>

            <div className="bg-surface2 rounded-xl p-3 mb-4 space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-t3">{isBrand ? 'Amount' : 'Requested'}</span>
                <span className="font-bold text-t1 font-display">{fmtMoney(modal.withdrawal.amount_requested)}</span>
              </div>
              {!isBrand && (
                <>
                  <div className="flex justify-between text-xs">
                    <span className="text-t3">TDS (10%)</span>
                    <span className="text-t2">{fmtMoney(modal.withdrawal.tds_deducted)}</span>
                  </div>
                  <div className="flex justify-between text-xs border-t border-border pt-1.5">
                    <span className="text-t3 font-bold">Net Payout</span>
                    <span className="font-bold text-teal-deep font-display">{fmtMoney(modal.withdrawal.net_paid)}</span>
                  </div>
                </>
              )}
              <div className="flex justify-between text-xs">
                <span className="text-t3">Method</span>
                <span className="text-t2">{modal.withdrawal.method === 'upi' ? 'UPI' : 'Bank Transfer'}</span>
              </div>
            </div>

            {modal.action === 'approve' && (
              <div className="mb-4 p-3 bg-teal-pale border border-teal/20 rounded-xl">
                <div className="text-xs text-teal-deep font-medium">
                  This will trigger a Razorpay payout of {fmtMoney(isBrand ? modal.withdrawal.amount_requested : modal.withdrawal.net_paid)} to the {isBrand ? 'brand' : 'influencer'}.
                </div>
              </div>
            )}

            {modal.action === 'reject' && (
              <div className="mb-4">
                <label className="block text-xs font-bold text-t2 uppercase tracking-wider mb-2">Rejection Reason (required)</label>
                <textarea
                  value={rejectReason}
                  onChange={e => setRejectReason(e.target.value)}
                  placeholder="e.g. Invalid bank details — please update payment info and try again"
                  className="w-full border-2 border-border2 rounded-xl p-3 text-sm text-t1 outline-none focus:border-gold resize-none"
                  rows={3}
                />
                <p className="text-[10px] text-t3 mt-1">Funds will be returned to the {isBrand ? 'brand' : 'influencer'}&apos;s wallet.</p>
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={handleProcess}
                disabled={processing || (modal.action === 'reject' && !rejectReason.trim())}
                className={`flex-1 py-2.5 font-bold rounded-xl text-sm disabled:opacity-40 text-white ${
                  modal.action === 'approve'
                    ? 'bg-gradient-to-r from-teal to-teal-deep'
                    : 'bg-gradient-to-r from-red to-orange'
                }`}
              >
                {processing
                  ? (modal.action === 'approve' ? 'Approving...' : 'Rejecting...')
                  : (modal.action === 'approve' ? 'Confirm Approval' : 'Confirm Rejection')
                }
              </button>
              <button
                onClick={() => { setModal(null); setRejectReason(''); }}
                className="px-4 py-2.5 bg-surface2 text-t2 font-bold rounded-xl text-sm"
              >
                Cancel
              </button>
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
