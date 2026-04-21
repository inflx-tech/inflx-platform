'use client';
import { useEffect, useState } from 'react';
import { adminApi, getStoredUser } from '../../../lib/api';

function StatusBadge({ status }) {
  const cfg = {
    queued: 'bg-gold-pale text-yellow-700',
    locked: 'bg-navy-pale text-navy',
    released: 'bg-teal-pale text-teal-deep',
  };
  return <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${cfg[status] || 'bg-surface2 text-t3'}`}>{status}</span>;
}

export default function EscrowPage() {
  const [entries, setEntries] = useState([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [releaseModal, setReleaseModal] = useState(null);
  const [releaseReason, setReleaseReason] = useState('');
  const [releasing, setReleasing] = useState(false);
  const [toast, setToast] = useState('');
  const user = typeof window !== 'undefined' ? getStoredUser() : null;
  const canRelease = user?.admin_role === 'finance' || user?.admin_role === 'superadmin';

  async function load() {
    setLoading(true);
    const res = await adminApi.getEscrow(filter);
    setLoading(false);
    if (res.success) setEntries(res.data?.escrow_entries || res.data || []);
  }

  useEffect(() => { load(); }, [filter]);

  async function handleRelease() {
    if (!releaseReason.trim()) return;
    setReleasing(true);
    const res = await adminApi.releaseEscrow(releaseModal.id, releaseReason);
    setReleasing(false);
    if (res.success) {
      showToast('Escrow released successfully');
      setReleaseModal(null);
      setReleaseReason('');
      load();
    } else {
      showToast(res.error?.message || 'Release failed', true);
    }
  }

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  }

  function fmtMoney(p) {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(p || 0);
  }

  return (
    <div className="max-w-5xl">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="font-display text-xl font-bold text-t1">Escrow Management</h1>
          <p className="text-xs text-t3 mt-0.5">View and manually release escrow tranches</p>
        </div>
        <div className="flex items-center gap-2">
          {['all', 'queued', 'locked', 'released'].map(s => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors capitalize ${filter === s ? 'bg-navy text-white' : 'bg-white border border-border text-t2 hover:border-navy hover:text-navy'}`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-border overflow-hidden">
        {/* Table header */}
        <div className="grid grid-cols-[1fr_1fr_1fr_80px_100px_120px_100px] gap-3 px-4 py-2.5 bg-surface2 border-b border-border text-[10px] font-bold uppercase tracking-wider text-t3">
          <div>Campaign</div>
          <div>Influencer</div>
          <div>Brand</div>
          <div>Tranche</div>
          <div>Amount</div>
          <div>Status</div>
          <div>Action</div>
        </div>

        {loading ? (
          <div className="p-8 text-center text-t3 text-sm">Loading...</div>
        ) : entries.length === 0 ? (
          <div className="p-8 text-center text-t3 text-sm">No escrow entries found</div>
        ) : (
          entries.map(entry => (
            <div key={entry.id} className="grid grid-cols-[1fr_1fr_1fr_80px_100px_120px_100px] gap-3 px-4 py-3 border-b border-border last:border-0 items-center text-sm">
              <div className="text-t1 font-medium truncate text-xs">{entry.campaign_name}</div>
              <div className="text-t2 truncate text-xs">@{entry.influencer_name || entry.instagram_handle}</div>
              <div className="text-t2 truncate text-xs">{entry.brand_name}</div>
              <div className="text-center">
                <span className="w-6 h-6 rounded-full bg-navy-pale text-navy text-[10px] font-bold inline-flex items-center justify-center">T{entry.tranche_number}</span>
              </div>
              <div className="font-bold text-t1 font-display text-xs">{fmtMoney(entry.amount)}</div>
              <div><StatusBadge status={entry.status} /></div>
              <div>
                {canRelease && (entry.status === 'queued' || entry.status === 'locked') ? (
                  <button
                    onClick={() => setReleaseModal(entry)}
                    className="px-2.5 py-1 text-[10px] font-bold bg-orange-pale text-orange-deep border border-orange/20 rounded-lg hover:bg-orange hover:text-white transition-colors"
                  >
                    Release
                  </button>
                ) : (
                  <span className="text-[10px] text-t3">{entry.released_at ? new Date(entry.released_at).toLocaleDateString('en-IN') : '—'}</span>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Release modal */}
      {releaseModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-96 shadow-2xl">
            <h3 className="font-display text-base font-bold text-t1 mb-1">Manual Escrow Release</h3>
            <p className="text-xs text-t3 mb-4">T{releaseModal.tranche_number} · {releaseModal.campaign_name} · {fmtMoney(releaseModal.amount)}</p>
            <div className="mb-4">
              <label className="block text-xs font-bold text-t2 uppercase tracking-wider mb-2">Override Reason (required)</label>
              <textarea
                value={releaseReason}
                onChange={e => setReleaseReason(e.target.value)}
                placeholder="e.g. Brand dispute resolved — manually releasing per agreement"
                className="w-full border-2 border-border2 rounded-xl p-3 text-sm text-t1 outline-none focus:border-gold resize-none"
                rows={3}
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleRelease}
                disabled={releasing || !releaseReason.trim()}
                className="flex-1 py-2.5 bg-gradient-to-r from-red to-orange text-white font-bold rounded-xl text-sm disabled:opacity-40"
              >
                {releasing ? 'Releasing...' : 'Confirm Release'}
              </button>
              <button onClick={() => { setReleaseModal(null); setReleaseReason(''); }} className="px-4 py-2.5 bg-surface2 text-t2 font-bold rounded-xl text-sm">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 right-6 bg-t1 text-white px-4 py-3 rounded-xl text-sm font-medium shadow-lg z-50">{toast}</div>
      )}
    </div>
  );
}
