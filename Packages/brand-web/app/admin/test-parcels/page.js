'use client';
import { useCallback, useEffect, useState } from 'react';
import { adminApi } from '../../../lib/api';

/**
 * Admin · Test parcels — mockup R18.
 * Contract: features/item11-remote §6.4 · F19 · checks 35, 36
 *
 * Until the Shiprocket account exists, this page IS the courier. Every button posts a courier
 * update through the SAME webhook handler Shiprocket will use, so notifications, Needs You,
 * the wallet charges and the Delayed flag all run for real — months before a parcel does.
 *
 * Admin only, behind the `shipping` capability. Every press is logged with who and when.
 */

const EVENT_LABEL = {
  collected: 'Collected',
  out_for_delivery: 'Out for delivery',
  attempt_failed: 'Attempt failed',
  delivered: 'Delivered',
  returned_to_store: 'Back to store',
  weight_charge: 'Weight charge…',
  cancelled: 'Cancelled',
};
// The return leg reads differently to the person pressing it, though the events are the same.
const RETURN_LABEL = {
  collected: 'Collected',
  attempt_failed: 'Pickup failed',
  delivered: 'Delivered to branch',
};

const fmtDay = (iso) => (iso
  ? new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true })
  : '—');
const fmtTracking = (t) => (t ? String(t).replace(/(.{4})/g, '$1 ').trim() : '—');
const rupees = (n) => (n == null ? null : `₹${Number(n).toLocaleString('en-IN')}`);

/** The one line that says where a parcel has got to. */
function statusOf(p) {
  if (p.cancelledAt) return 'Cancelled';
  if (p.returnedToStoreAt) return 'Back at the store';
  if (p.deliveredAt) return p.direction === 'return' ? 'Delivered to branch' : 'Delivered';
  if (p.outForDeliveryAt) return 'Out for delivery';
  if (p.collectedAt) return 'Collected';
  if (p.bookedAt) return p.direction === 'return' ? 'Pickup booked' : 'Booked';
  return 'Not booked';
}

export default function TestParcelsPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [busy, setBusy] = useState(null);
  const [toast, setToast] = useState(null);
  const [weightFor, setWeightFor] = useState(null);
  const [weightAmount, setWeightAmount] = useState('');
  const [weightReason, setWeightReason] = useState('');

  const show = (msg, kind = 'ok') => { setToast({ msg, kind }); setTimeout(() => setToast(null), 4000); };

  const load = useCallback(async () => {
    setLoading(true); setLoadError(false);
    const res = await adminApi.getTestParcels();
    setLoading(false);
    if (!res.success) { setLoadError(true); return; }
    setData(res.data);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function send(parcel, event, extra = {}) {
    setBusy(`${parcel.id}:${event}`);
    const res = await adminApi.injectTestParcelEvent(parcel.id, { event, ...extra });
    setBusy(null);
    if (!res.success) { show(res.error?.message || 'That did not go through.', 'err'); return; }
    if (res.data.duplicate) show('Already seen — the same update twice is one event. Nothing changed.');
    else if (!res.data.applied) show('Recorded, but it changed nothing — it arrived out of order.');
    else show(`${EVENT_LABEL[event] || event} sent.`);
    load();
  }

  function submitWeight(parcel) {
    const amount = Number(weightAmount);
    if (!(amount > 0)) { show('Enter the amount the courier charged.', 'err'); return; }
    setWeightFor(null); setWeightAmount(''); setWeightReason('');
    send(parcel, 'weight_charge', { amount, reason: weightReason.trim() || null });
  }

  const live = data && data.live;

  return (
    <div className="max-w-5xl">
      <div className="mb-5">
        <h1 className="font-display text-xl font-bold text-t1">Test parcels</h1>
        <p className="text-xs text-t3 mt-0.5">
          This page plays the courier. It moves each test parcel on, one real update at a time.
        </p>
      </div>

      {/* Courier in use */}
      <div className="bg-white rounded-xl border border-border p-5 mb-4">
        <div className="text-[11px] font-bold uppercase tracking-wide text-t3 mb-1">Courier in use</div>
        <div className="flex items-baseline gap-3">
          <span className="text-lg font-bold text-t1 capitalize">{data?.provider || '—'}</span>
          {live && <span className="text-xs font-bold text-red-700 bg-red-50 border border-red-200 rounded px-2 py-0.5">LIVE PROVIDER</span>}
        </div>
        <p className="text-xs text-t3 mt-1.5 leading-relaxed">
          Every parcel is booked on the simulated courier. Switching to Shiprocket is a founder
          decision and needs the live account; simulated parcels can never move to it.
        </p>
      </div>

      {/* Test pincodes */}
      <div className="bg-white rounded-xl border border-border p-5 mb-5">
        <div className="text-[11px] font-bold uppercase tracking-wide text-t3 mb-2">Test pincodes</div>
        <ul className="text-sm text-t2 space-y-1">
          <li><b className="font-mono">Ending in 999</b> — couriers don&apos;t deliver.</li>
          <li><b className="font-mono">Ending in 998</b> — delivers, no return pickup.</li>
          <li><b>Anything else</b> — both work.</li>
        </ul>
      </div>

      {loading ? (
        <div className="space-y-3">{[1, 2].map(i => <div key={i} className="h-32 bg-surface2 rounded-xl animate-pulse" />)}</div>
      ) : loadError ? (
        <div className="bg-white rounded-xl border border-border p-6 text-sm text-t2">
          Couldn&apos;t load the parcels. <button onClick={load} className="font-semibold text-navy underline">Try again</button>
        </div>
      ) : !data.parcels.length ? (
        <div className="bg-white rounded-xl border border-border p-8 text-center">
          <div className="text-sm font-semibold text-t1">No test parcels yet</div>
          <p className="text-xs text-t3 mt-1">One appears here the moment a brand books a parcel in the app.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {data.parcels.map((p) => {
            const labels = p.direction === 'return' ? { ...EVENT_LABEL, ...RETURN_LABEL } : EVENT_LABEL;
            return (
              <div key={p.id} className="bg-white rounded-xl border border-border p-5" data-testid={`parcel-${p.id}`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-t1 truncate">
                      {p.direction === 'return'
                        ? `${p.creatorName || 'Creator'} → ${p.brandName || 'Brand'}`
                        : `${p.brandName || 'Brand'} → ${p.creatorName || 'Creator'}`}
                    </div>
                    <div className="text-xs text-t3 mt-0.5">
                      {[p.campaignName, p.setName].filter(Boolean).join(' · ')}
                      {p.campaignName ? ' · ' : ''}
                      <span className="font-mono">{fmtTracking(p.trackingNumber)}</span>
                      {p.bookedAt ? ` · booked ${fmtDay(p.bookedAt)}` : ''} · {p.direction}
                      {p.attemptFailedCount > 0 ? ` · ${p.attemptFailedCount} failed attempt${p.attemptFailedCount > 1 ? 's' : ''}` : ''}
                    </div>
                    {(p.chargedAmount != null || p.returnHoldAmount != null) && (
                      <div className="text-xs text-t3 mt-0.5">
                        {p.chargedAmount != null ? `charged ${rupees(p.chargedAmount)}` : ''}
                        {p.chargedAmount != null && p.returnHoldAmount != null ? ' · ' : ''}
                        {p.returnHoldAmount != null ? `return locked ${rupees(p.returnHoldAmount)}` : ''}
                      </div>
                    )}
                  </div>
                  <span className="shrink-0 text-xs font-bold text-navy bg-surface2 border border-border rounded px-2 py-1">
                    {statusOf(p)}
                  </span>
                </div>

                <div className="flex flex-wrap gap-2 mt-4">
                  {p.next.map((e) => (
                    <button
                      key={e}
                      disabled={!!busy || live}
                      data-testid={`ev-${e}`}
                      onClick={() => (e === 'weight_charge' ? setWeightFor(p.id) : send(p, e))}
                      className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-border text-t1 hover:border-navy disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {busy === `${p.id}:${e}` ? 'Sending…' : (labels[e] || e)}
                    </button>
                  ))}
                </div>

                {weightFor === p.id && (
                  <div className="mt-3 rounded-lg border border-border bg-surface2 p-3">
                    <div className="text-xs font-bold text-t1 mb-2">What did the courier charge, and why?</div>
                    <div className="flex flex-wrap gap-2 items-center">
                      <input type="number" min="1" value={weightAmount} onChange={(e) => setWeightAmount(e.target.value)}
                        placeholder="₹" className="w-24 px-3 py-2 text-sm rounded-lg border border-border focus:outline-none focus:border-navy" />
                      <input value={weightReason} onChange={(e) => setWeightReason(e.target.value)}
                        placeholder="Weighed 2.4 kg, entered 1.2 kg"
                        className="flex-1 min-w-[16rem] px-3 py-2 text-sm rounded-lg border border-border focus:outline-none focus:border-navy" />
                      <button onClick={() => submitWeight(p)} disabled={!!busy}
                        className="px-3 py-2 bg-navy text-white text-xs font-bold rounded-lg disabled:opacity-50">Send</button>
                      <button onClick={() => { setWeightFor(null); setWeightAmount(''); setWeightReason(''); }}
                        className="px-3 py-2 text-xs font-semibold text-t2 rounded-lg border border-border">Cancel</button>
                    </div>
                  </div>
                )}

                <p className="text-[11px] text-t3 mt-3 leading-relaxed">
                  Each button sends a courier update through the same webhook INFLX uses for
                  Shiprocket, so notifications, Needs You, wallet charges and Delayed all run for real.
                </p>
              </div>
            );
          })}
        </div>
      )}

      <div className="text-xs text-t3 bg-surface2 rounded-lg px-3 py-2 mt-5">
        Only Admin sees this page. Every button press is logged with who and when. Labels from
        the simulator read “TEST — NOT A REAL SHIPMENT”.
      </div>

      {toast && (
        <div className={`fixed bottom-6 right-6 px-4 py-3 rounded-xl text-sm font-semibold shadow-lg ${toast.kind === 'err' ? 'bg-red-700 text-white' : 'bg-navy text-white'}`}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
