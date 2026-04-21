'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { adminApi, getStoredUser } from '../../../lib/api';

const TABS = [
  { key: 'all',       label: 'All' },
  { key: 'approved',  label: 'Approved' },
  { key: 'pending',   label: 'Pending' },
  { key: 'rejected',  label: 'Rejected' },
  { key: 'suspended', label: 'Suspended' },
];

function StatusBadge({ status }) {
  const cfg = {
    approved:  'bg-teal-pale text-teal-deep',
    pending:   'bg-gold-pale text-yellow-700',
    rejected:  'bg-red-pale text-red',
    suspended: 'bg-surface2 text-t3',
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap ${cfg[status] || 'bg-surface2 text-t3'}`}>
      {status}
    </span>
  );
}

function StatCard({ label, value, color = 'navy' }) {
  const colors = { navy: 'text-navy', teal: 'text-teal', orange: 'text-orange', gold: 'text-yellow-600', red: 'text-red' };
  return (
    <div className="bg-white rounded-xl border border-border p-3.5">
      <div className="text-[10px] font-bold uppercase tracking-wider text-t3 mb-1">{label}</div>
      <div className={`font-display text-2xl font-extrabold ${colors[color] || 'text-t1'}`}>{value}</div>
    </div>
  );
}

export default function BrandsPage() {
  const router = useRouter();
  const [tab, setTab] = useState('all');
  const [brands, setBrands] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Quick-action state
  const [actionModal, setActionModal] = useState(null); // { brand, action: 'approved'|'rejected'|'suspended' }
  const [rejectReason, setRejectReason] = useState('');
  const [processing, setProcessing] = useState(false);

  // Fee override state
  const [feeModal, setFeeModal] = useState(null); // brand object
  const [feeInput, setFeeInput] = useState('');
  const [savingFee, setSavingFee] = useState(false);

  const [toast, setToast] = useState('');

  const user = typeof window !== 'undefined' ? getStoredUser() : null;
  const canAction = user?.admin_role === 'reviewer' || user?.admin_role === 'superadmin';
  const canFee = user?.admin_role === 'finance' || user?.admin_role === 'superadmin';

  const load = useCallback(async () => {
    setLoading(true);
    const res = await adminApi.getBrands(tab, search, page);
    setLoading(false);
    if (res.success) {
      setBrands(res.data?.brands || []);
      setSummary(res.data?.summary || null);
      const total = res.meta?.total || 0;
      const limit = res.meta?.limit || 20;
      setTotalPages(Math.max(1, Math.ceil(total / limit)));
    }
  }, [tab, search, page]);

  useEffect(() => { load(); }, [load]);

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  }

  function handleSearch(e) {
    e.preventDefault();
    setPage(1);
    setSearch(searchInput);
  }

  // Quick status action
  async function handleAction() {
    if (!actionModal) return;
    if (actionModal.action === 'rejected' && !rejectReason.trim()) return;
    setProcessing(true);
    const res = await adminApi.updateBrandStatus(actionModal.brand.id, {
      status: actionModal.action,
      reason: actionModal.action === 'rejected' ? rejectReason : undefined,
    });
    setProcessing(false);
    if (res.success) {
      showToast(`Brand ${actionModal.action} successfully`);
      setActionModal(null);
      setRejectReason('');
      load();
    } else {
      showToast(res.error?.message || 'Action failed');
    }
  }

  // Fee override
  async function handleSaveFee() {
    if (!feeModal) return;
    const pct = parseFloat(feeInput);
    if (isNaN(pct) || pct < 0 || pct > 50) { showToast('Enter a valid fee 0-50%'); return; }
    setSavingFee(true);
    const res = await adminApi.setBrandPlatformFee(feeModal.id, pct);
    setSavingFee(false);
    if (res.success) {
      showToast(`Platform fee updated to ${res.data.platform_fee_pct}%`);
      setFeeModal(null);
      setFeeInput('');
      load();
    } else {
      showToast(res.error?.message || 'Failed to update fee');
    }
  }

  function fmtMoney(p) {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(p || 0);
  }

  function fmtDate(d) {
    if (!d) return '--';
    return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  return (
    <div className="max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="font-display text-xl font-bold text-t1">Brand Directory</h1>
          <p className="text-xs text-t3 mt-0.5">All registered brands on the platform</p>
        </div>
        <form onSubmit={handleSearch} className="flex items-center gap-2">
          <input
            type="text"
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            placeholder="Search name, phone, city, category..."
            className="w-60 border border-border2 rounded-lg px-3 py-1.5 text-xs text-t1 outline-none focus:border-navy"
          />
          <button type="submit" className="px-3 py-1.5 text-xs font-semibold bg-navy text-white rounded-lg">Search</button>
          {search && (
            <button type="button" onClick={() => { setSearchInput(''); setSearch(''); setPage(1); }} className="px-2 py-1.5 text-xs text-t3 hover:text-t1">Clear</button>
          )}
        </form>
      </div>

      {/* Summary stats */}
      {summary && (
        <div className="grid grid-cols-5 gap-3 mb-4">
          <StatCard label="Total Brands" value={summary.total} color="navy" />
          <StatCard label="Approved" value={summary.approved} color="teal" />
          <StatCard label="Pending" value={summary.pending} color="gold" />
          <StatCard label="Rejected" value={summary.rejected} color="red" />
          <StatCard label="Suspended" value={summary.suspended} color="orange" />
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
            {summary && t.key !== 'all' && (
              <span className="ml-1.5 opacity-60">({summary[t.key] || 0})</span>
            )}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-border overflow-hidden">
        {/* Header */}
        <div className="grid grid-cols-[1.4fr_1fr_0.7fr_0.7fr_0.6fr_0.6fr_0.6fr_0.7fr_120px] gap-2 px-4 py-2.5 bg-surface2 border-b border-border text-[10px] font-bold uppercase tracking-wider text-t3">
          <div>Brand</div>
          <div>Contact</div>
          <div>Category</div>
          <div>City</div>
          <div>Status</div>
          <div>Wallet</div>
          <div>Fee</div>
          <div>Joined</div>
          <div>Actions</div>
        </div>

        {loading ? (
          <div className="p-8 text-center text-t3 text-sm">Loading...</div>
        ) : brands.length === 0 ? (
          <div className="p-12 text-center">
            <div className="text-sm text-t3">
              {search ? 'No brands matching your search' : `No ${tab === 'all' ? '' : tab + ' '}brands found`}
            </div>
            {search && <div className="text-xs text-t3 mt-1">Try adjusting your search query</div>}
          </div>
        ) : (
          brands.map(b => (
            <div
              key={b.id}
              onClick={() => router.push(`/dashboard/brands/${b.id}`)}
              className="grid grid-cols-[1.4fr_1fr_0.7fr_0.7fr_0.6fr_0.6fr_0.6fr_0.7fr_120px] gap-2 px-4 py-3 border-b border-border last:border-0 items-center cursor-pointer hover:bg-surface2/50 transition-colors"
            >
              {/* Brand name + logo initial */}
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-navy-pale flex items-center justify-center text-[10px] font-bold text-navy font-display flex-shrink-0">
                  {(b.business_name || '').slice(0, 2).toUpperCase()}
                </div>
                <div className="text-xs font-medium text-t1 truncate">{b.business_name}</div>
              </div>
              {/* Contact */}
              <div className="min-w-0">
                <div className="text-xs text-t1 truncate">{b.contact_name}</div>
                <div className="text-[10px] text-t3 truncate">{b.phone}</div>
              </div>
              {/* Category */}
              <div className="text-xs text-t2 truncate capitalize">{b.category || '--'}</div>
              {/* City */}
              <div className="text-xs text-t2 truncate">{b.city || '--'}</div>
              {/* Status */}
              <div><StatusBadge status={b.status} /></div>
              {/* Wallet */}
              <div className="font-bold text-t1 font-display text-xs">{fmtMoney(b.wallet_balance)}</div>
              {/* Fee */}
              <div className="text-xs text-t2">
                {b.platform_fee_pct != null ? `${b.platform_fee_pct}%` : '8%'}
              </div>
              {/* Joined */}
              <div className="text-[10px] text-t3">{fmtDate(b.created_at)}</div>
              {/* Actions */}
              <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                {canAction && b.status === 'pending' && (
                  <>
                    <button
                      onClick={() => setActionModal({ brand: b, action: 'approved' })}
                      className="px-2 py-1 text-[10px] font-bold bg-teal-pale text-teal-deep border border-teal/20 rounded-lg hover:bg-teal hover:text-white transition-colors"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => setActionModal({ brand: b, action: 'rejected' })}
                      className="px-2 py-1 text-[10px] font-bold bg-red-pale text-red border border-red/20 rounded-lg hover:bg-red hover:text-white transition-colors"
                    >
                      Reject
                    </button>
                  </>
                )}
                {canAction && b.status === 'approved' && (
                  <button
                    onClick={() => setActionModal({ brand: b, action: 'suspended' })}
                    className="px-2 py-1 text-[10px] font-bold bg-surface2 text-t3 border border-border rounded-lg hover:bg-red-pale hover:text-red hover:border-red/20 transition-colors"
                  >
                    Suspend
                  </button>
                )}
                {canFee && (
                  <button
                    onClick={() => { setFeeModal(b); setFeeInput(String(b.platform_fee_pct ?? 8)); }}
                    className="px-2 py-1 text-[10px] font-bold bg-gold-pale text-yellow-700 border border-gold/20 rounded-lg hover:bg-gold hover:text-white transition-colors"
                    title="Set platform fee"
                  >
                    Fee
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-4">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="px-3 py-1.5 text-xs font-semibold bg-white border border-border rounded-lg disabled:opacity-30"
          >
            Prev
          </button>
          <span className="text-xs text-t3">Page {page} of {totalPages}</span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="px-3 py-1.5 text-xs font-semibold bg-white border border-border rounded-lg disabled:opacity-30"
          >
            Next
          </button>
        </div>
      )}

      {/* Action Modal (Approve / Reject / Suspend) */}
      {actionModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-96 shadow-2xl">
            <h3 className="font-display text-base font-bold text-t1 mb-1 capitalize">
              {actionModal.action === 'approved' ? 'Approve' : actionModal.action === 'rejected' ? 'Reject' : 'Suspend'} Brand
            </h3>
            <p className="text-xs text-t3 mb-4">
              {actionModal.brand.business_name} ({actionModal.brand.contact_name})
            </p>

            {actionModal.action === 'rejected' && (
              <div className="mb-4">
                <label className="block text-xs font-bold text-t2 uppercase tracking-wider mb-2">Rejection Reason (required)</label>
                <textarea
                  value={rejectReason}
                  onChange={e => setRejectReason(e.target.value)}
                  placeholder="e.g. Incomplete business details — please update and resubmit"
                  className="w-full border-2 border-border2 rounded-xl p-3 text-sm text-t1 outline-none focus:border-gold resize-none"
                  rows={3}
                />
              </div>
            )}

            {actionModal.action === 'approved' && (
              <div className="mb-4 p-3 bg-teal-pale border border-teal/20 rounded-xl">
                <div className="text-xs text-teal-deep font-medium">
                  This brand will be approved and notified immediately.
                </div>
              </div>
            )}

            {actionModal.action === 'suspended' && (
              <div className="mb-4 p-3 bg-red-pale border border-red/20 rounded-xl">
                <div className="text-xs text-red font-medium">
                  This brand will be suspended and lose access to their dashboard.
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={handleAction}
                disabled={processing || (actionModal.action === 'rejected' && !rejectReason.trim())}
                className={`flex-1 py-2.5 font-bold rounded-xl text-sm disabled:opacity-40 text-white ${
                  actionModal.action === 'approved'
                    ? 'bg-gradient-to-r from-teal to-teal-deep'
                    : 'bg-gradient-to-r from-red to-orange'
                }`}
              >
                {processing ? 'Processing...' : `Confirm ${actionModal.action === 'approved' ? 'Approval' : actionModal.action === 'rejected' ? 'Rejection' : 'Suspension'}`}
              </button>
              <button
                onClick={() => { setActionModal(null); setRejectReason(''); }}
                className="px-4 py-2.5 bg-surface2 text-t2 font-bold rounded-xl text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Fee Modal */}
      {feeModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-96 shadow-2xl">
            <h3 className="font-display text-base font-bold text-t1 mb-1">Set Platform Fee</h3>
            <p className="text-xs text-t3 mb-4">
              {feeModal.business_name} — current: {feeModal.platform_fee_pct ?? 8}%
            </p>
            <div className="flex items-center gap-2 mb-4">
              <div className="flex items-center border-2 border-border2 rounded-xl overflow-hidden flex-1">
                <input
                  type="number"
                  value={feeInput}
                  onChange={e => setFeeInput(e.target.value)}
                  placeholder="8"
                  min="0"
                  max="50"
                  step="0.5"
                  className="flex-1 px-3 py-2.5 text-sm outline-none"
                />
                <span className="px-3 py-2.5 bg-surface2 text-t3 text-sm font-bold border-l border-border2">%</span>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleSaveFee}
                disabled={savingFee || !feeInput}
                className="flex-1 py-2.5 bg-navy text-white font-bold rounded-xl text-sm disabled:opacity-40"
              >
                {savingFee ? 'Saving...' : 'Save Fee'}
              </button>
              <button
                onClick={() => { setFeeModal(null); setFeeInput(''); }}
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
