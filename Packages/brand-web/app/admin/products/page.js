'use client';
import { useEffect, useState, useCallback } from 'react';
import { adminApi } from '../../../lib/api';

/**
 * Admin · Product Queue — features/product-approval-switch (M2, M3).
 *
 * While the Product approval switch (Settings → Platform) is on, a product a brand publishes waits
 * here before it is in the brand's store, in any creator's list or in any offer. Approve makes it
 * live at once; Send back needs a reason, which the brand is told word for word. A product approved
 * once stays approved. Modelled on the Post Queue.
 */

const TABS = [
  { key: 'pending', label: 'Waiting' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Sent back' },
];

function ago(iso) {
  if (!iso) return '';
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return `${Math.floor(s / 86400)} d ago`;
}
const rupees = (n) => (n == null ? '—' : `₹${Number(n).toLocaleString('en-IN')}`);

export default function ProductQueuePage() {
  const [tab, setTab] = useState('pending');
  const [products, setProducts] = useState([]);
  const [counts, setCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);             // product id being decided
  const [rejecting, setRejecting] = useState(null);   // { product, reason }
  const [toast, setToast] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const res = await adminApi.listProductQueue(tab);
    setLoading(false);
    if (res.success) { setProducts(res.data?.products || []); setCounts(res.data?.counts || {}); }
  }, [tab]);
  useEffect(() => { load(); }, [load]);

  function showToast(m) { setToast(m); setTimeout(() => setToast(''), 2500); }

  async function approve(p) {
    setBusy(p.id);
    const res = await adminApi.approveProduct(p.id);
    setBusy(null);
    if (res.success) { showToast(`${p.name} is live — the brand has been told.`); load(); }
    else alert(res.error?.message || 'Approve failed.');
  }

  async function confirmReject() {
    if (!rejecting) return;
    if (!rejecting.reason.trim()) { alert('Give the brand a reason.'); return; }
    setBusy(rejecting.product.id);
    const res = await adminApi.rejectProduct(rejecting.product.id, rejecting.reason.trim());
    setBusy(null);
    if (res.success) { setRejecting(null); showToast('Sent back — the brand has been told the reason.'); load(); }
    else alert(res.error?.message || 'Send back failed.');
  }

  return (
    <div className="max-w-5xl mx-auto" data-testid="product-queue">
      <div className="mb-5">
        <h1 className="font-display text-xl font-bold text-t1">Product Queue</h1>
        <p className="text-xs text-t3 mt-0.5 max-w-2xl">
          While <b>Product approval</b> is on (Settings → Platform), a product a brand publishes waits here before it is
          in the brand's store, in any creator's list or in any offer. Approve makes it live at once. Send back needs a
          reason, which the brand is told word for word. A product approved once stays approved.
        </p>
      </div>

      <div className="flex gap-2 mb-4">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} data-testid={`tab-${t.key}`}
            className={`px-4 py-2 rounded-xl text-xs font-bold border-2 ${tab === t.key ? 'border-navy bg-navy-pale text-navy' : 'border-border text-t3 hover:border-t3'}`}>
            {t.label} <span className="opacity-60">({counts[t.key] || 0})</span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="bg-white rounded-2xl border border-border p-12 text-center text-sm text-t3">Loading products…</div>
      ) : products.length === 0 ? (
        <div className="bg-white rounded-2xl border border-border p-12 text-center text-sm text-t3">
          {tab === 'pending' ? 'Nothing waiting for approval. 🎉' : tab === 'approved' ? 'No products approved from here yet.' : 'Nothing sent back.'}
        </div>
      ) : (
        <div className="space-y-3">
          {products.map(p => (
            <div key={p.id} className="bg-white rounded-2xl border border-border p-4 flex items-center gap-4" data-testid={`queue-product-${p.id}`}>
              {p.image_url
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={p.image_url} alt="" className="w-16 h-16 rounded-xl object-cover shrink-0 bg-surface2" />
                : <div className="w-16 h-16 rounded-xl bg-surface2 shrink-0 flex items-center justify-center text-2xl">🛍️</div>}
              <div className="min-w-0 flex-1">
                <div className="text-sm font-bold text-t1 truncate">{p.name}</div>
                <div className="text-xs text-t2 mt-0.5 truncate">
                  {p.brand?.name || '—'} · {rupees(p.price)}{p.category ? ` · ${p.category}` : ''}
                </div>
                <div className="text-[11px] text-t3 mt-0.5">
                  {tab === 'pending' && <>sent {ago(p.approval_requested_at)}</>}
                  {tab === 'approved' && <>approved {ago(p.approval_decided_at)}{p.decided_by ? ` by ${p.decided_by}` : ''}{p.approval_note ? ` · ${p.approval_note}` : ''}{p.pushed_to_store ? '' : ' · hidden by the brand since'}</>}
                  {tab === 'rejected' && <>sent back {ago(p.approval_decided_at)}{p.decided_by ? ` by ${p.decided_by}` : ''}</>}
                  {p.sku ? ` · SKU ${p.sku}` : ''}
                  {p.is_active === false ? ' · hidden by the brand' : ''}
                </div>
                {tab === 'rejected' && p.approval_note && (
                  <div className="text-[11px] text-red bg-red-pale rounded-lg px-3 py-1.5 mt-1.5 inline-block">{p.approval_note}</div>
                )}
              </div>
              {tab === 'pending' && (
                <div className="flex gap-2 shrink-0">
                  <button onClick={() => approve(p)} disabled={busy === p.id} data-testid={`approve-${p.id}`}
                    className="px-4 py-2 bg-teal text-white text-xs font-bold rounded-xl disabled:opacity-50">
                    {busy === p.id ? '…' : '✓ Approve'}
                  </button>
                  <button onClick={() => setRejecting({ product: p, reason: '' })} disabled={busy === p.id} data-testid={`reject-${p.id}`}
                    className="px-4 py-2 bg-white text-red border border-red/30 text-xs font-bold rounded-xl">
                    ✕ Send back
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {rejecting && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setRejecting(null)}>
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()} data-testid="reject-dialog">
            <div className="border-b border-border px-5 py-3 font-display text-base font-bold text-t1">
              Send back “{rejecting.product.name}”
            </div>
            <div className="px-5 py-4">
              <label className="block text-[11px] font-bold text-t2 mb-1">Reason <span className="font-normal text-t3">(sent to {rejecting.product.brand?.name || 'the brand'})</span></label>
              <textarea value={rejecting.reason} onChange={e => setRejecting({ ...rejecting, reason: e.target.value })}
                rows={3} placeholder="e.g. The photo is a stock image. Please add your own photo of the product."
                className="w-full border border-border rounded-lg px-3 py-2 text-xs" autoFocus />
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-3">
              <button onClick={() => setRejecting(null)} className="px-4 py-2 bg-surface2 text-t2 text-xs font-semibold rounded-xl">Cancel</button>
              <button onClick={confirmReject} disabled={busy === rejecting.product.id || !rejecting.reason.trim()} data-testid="reject-confirm"
                className="px-5 py-2 bg-red text-white text-xs font-bold rounded-xl disabled:opacity-50">
                {busy === rejecting.product.id ? 'Sending back…' : 'Send back'}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 right-6 bg-t1 text-white text-xs font-semibold px-4 py-2 rounded-xl shadow-lg z-50">{toast}</div>
      )}
    </div>
  );
}
