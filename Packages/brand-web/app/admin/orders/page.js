'use client';
import { useEffect, useState, useCallback } from 'react';
import { adminApi, fmtMoney } from '../../../lib/api';

const STATUSES = ['confirmed', 'packed', 'dispatched', 'out_for_delivery', 'delivered', 'cancelled'];
const LABEL = { confirmed: 'Confirmed', packed: 'Packed', dispatched: 'Shipped', out_for_delivery: 'Out for Delivery', delivered: 'Delivered', cancelled: 'Cancelled' };
const FILTERS = [{ k: '', l: 'All' }, ...STATUSES.map(s => ({ k: s, l: LABEL[s] }))];
const PILL = {
  confirmed: 'bg-amber-100 text-amber-800', packed: 'bg-violet-100 text-violet-700',
  dispatched: 'bg-blue-100 text-blue-700', out_for_delivery: 'bg-blue-100 text-blue-700',
  delivered: 'bg-emerald-100 text-emerald-700', cancelled: 'bg-red-100 text-red-700',
};

function trackUrl(courier, awb) {
  if (!awb) return null;
  const c = String(courier || '').toLowerCase();
  if (c.includes('delhivery')) return `https://www.delhivery.com/track/package/${encodeURIComponent(awb)}`;
  if (c.includes('dtdc')) return `https://www.dtdc.in/tracking/tracking_results.asp?strCnno=${encodeURIComponent(awb)}`;
  if (c.includes('blue')) return `https://www.bluedart.com/tracking?trackingNo=${encodeURIComponent(awb)}`;
  if (c.includes('xpress')) return `https://www.xpressbees.com/track?awb=${encodeURIComponent(awb)}`;
  return `https://www.google.com/search?q=${encodeURIComponent(`${courier || ''} ${awb} tracking`)}`;
}
const fmtD = (iso) => iso ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '—';

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [q, setQ] = useState('');
  const [openId, setOpenId] = useState(null);
  const [draft, setDraft] = useState({}); // {id:{status,courier,tracking}}
  const [busy, setBusy] = useState(null);
  const [msg, setMsg] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (filter) params.status = filter;
      if (q.trim()) params.q = q.trim();
      const res = await adminApi.listOrders(Object.keys(params).length ? params : undefined);
      if (res.success || res.data) setOrders(res.data?.orders || []);
    } catch (e) { console.error('admin orders', e); }
    finally { setLoading(false); }
  }, [filter, q]);

  useEffect(() => { load(); }, [filter]); // eslint-disable-line react-hooks/exhaustive-deps

  async function apply(o) {
    const d = draft[o.id] || {};
    const status = d.status || o.order_status;
    setBusy(o.id); setMsg(null);
    try {
      const body = { order_status: status };
      if (d.courier) body.courier_name = d.courier;
      if (d.tracking) body.tracking_number = d.tracking.trim();
      const res = await adminApi.updateOrderStatus(o.id, body);
      if (res.success || res.data) { setMsg({ ok: true, t: `Order set to ${LABEL[status]}. Customer notified.` }); await load(); }
      else setMsg({ ok: false, t: res.error?.message || 'Update failed' });
    } catch (e) { setMsg({ ok: false, t: e.message }); } finally { setBusy(null); }
  }
  async function cancel(o) {
    if (!confirm('Cancel this order? Notifies the customer + reverses held commission via the refund flow.')) return;
    setBusy(o.id); setMsg(null);
    try {
      const res = await adminApi.updateOrderStatus(o.id, { order_status: 'cancelled' });
      if (res.success || res.data) { setMsg({ ok: true, t: 'Order cancelled.' }); await load(); }
      else setMsg({ ok: false, t: res.error?.message || 'Cancel failed' });
    } catch (e) { setMsg({ ok: false, t: e.message }); } finally { setBusy(null); }
  }

  return (
    <div className="p-6 max-w-5xl">
      <h1 className="text-xl font-bold text-gray-900">📦 Orders &amp; Fulfillment</h1>
      <p className="text-xs text-gray-500 mt-1 mb-4">Platform-wide oversight. Override status, cancel, and track every online order. Refunds + commission reversal run through Returns.</p>

      <div className="flex flex-wrap items-center gap-2 mb-3">
        {FILTERS.map(f => (
          <button key={f.k || 'all'} onClick={() => { setFilter(f.k); setOpenId(null); }}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${filter === f.k ? 'bg-[#1f2d4d] text-white border-[#1f2d4d]' : 'bg-white text-gray-600 border-gray-300'}`}>{f.l}</button>
        ))}
        <div className="ml-auto flex gap-2">
          <input value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => e.key === 'Enter' && load()}
            placeholder="Search order #, customer, brand, AWB…" className="text-xs border border-gray-300 rounded-lg px-3 py-1.5 w-56" />
          <button onClick={load} className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-gray-800 text-white">Search</button>
        </div>
      </div>

      {msg && <div className={`mb-3 px-3 py-2 rounded-lg text-xs font-semibold ${msg.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>{msg.t}</div>}

      {loading ? <div className="text-sm text-gray-500 py-10 text-center">Loading…</div>
        : orders.length === 0 ? <div className="text-sm text-gray-500 py-10 text-center">No orders in this view.</div>
        : (
        <div className="border border-gray-200 rounded-xl overflow-hidden bg-white">
          <div className="grid grid-cols-[110px_1.4fr_1fr_90px_110px_70px] gap-2 px-4 py-2.5 bg-gray-50 text-[10px] font-bold text-gray-400 uppercase tracking-wide">
            <span>Order</span><span>Customer</span><span>Brand · Creator</span><span>Amount</span><span>Status</span><span>Date</span>
          </div>
          {orders.map(o => {
            const isOpen = openId === o.id;
            const d = draft[o.id] || {};
            const tUrl = trackUrl(o.courier_name, o.tracking_number);
            const ref = `#${String(o.id).replace(/-/g, '').slice(0, 8).toUpperCase()}`;
            return (
              <div key={o.id} className="border-t border-gray-100">
                <button onClick={() => setOpenId(isOpen ? null : o.id)} className="w-full text-left grid grid-cols-[110px_1.4fr_1fr_90px_110px_70px] gap-2 px-4 py-2.5 items-center hover:bg-gray-50">
                  <span className="font-mono text-[11px] font-bold text-[#1f2d4d]">{ref}</span>
                  <div className="min-w-0"><div className="text-[13px] font-bold truncate">{o.follower_name || 'Customer'}</div><div className="text-[11px] text-gray-500 truncate">{(Array.isArray(o.items_json) ? o.items_json.length : 0)} item(s){o.follower_phone ? ` · ${o.follower_phone}` : ''}</div></div>
                  <div className="min-w-0"><div className="text-xs font-semibold truncate">{o.brand_name}</div><div className="text-[11px] text-gray-500 truncate">{o.creator_handle ? `via @${o.creator_handle}` : 'direct'}</div></div>
                  <span className="font-mono text-[13px] font-extrabold text-right">{fmtMoney(o.net_amount ?? 0)}</span>
                  <span className={`justify-self-start font-mono text-[9px] font-extrabold px-2 py-1 rounded-full uppercase ${PILL[o.order_status] || 'bg-gray-100 text-gray-600'}`}>{LABEL[o.order_status] || o.order_status}</span>
                  <span className="font-mono text-[11px] text-gray-500 text-right">{fmtD(o.created_at)}</span>
                </button>

                {isOpen && (
                  <div className="bg-gray-50 px-4 py-4 border-t border-gray-100">
                    <div className="grid grid-cols-4 gap-3 mb-4">
                      <div><div className="text-[9px] font-bold text-gray-400 uppercase">Ship to</div><div className="text-xs font-semibold mt-0.5">{o.delivery_address || '—'}</div></div>
                      <div><div className="text-[9px] font-bold text-gray-400 uppercase">Courier / AWB</div><div className="text-xs font-semibold mt-0.5">{o.courier_name ? `${o.courier_name} · ${o.tracking_number || '—'}` : '—'}{tUrl ? <> · <a href={tUrl} target="_blank" rel="noreferrer" className="text-blue-600">Track ↗</a></> : null}</div></div>
                      <div><div className="text-[9px] font-bold text-gray-400 uppercase">Commission</div><div className="text-xs font-semibold mt-0.5">{fmtMoney(o.influencer_commission ?? 0)} · {o.commission_confirmed_at ? 'released' : (o.tx_status === 'refunded' ? 'reversed' : 'held')}</div></div>
                      <div><div className="text-[9px] font-bold text-gray-400 uppercase">Platform fee</div><div className="text-xs font-semibold mt-0.5">{fmtMoney(o.platform_fee ?? 0)}</div></div>
                    </div>

                    {o.order_status !== 'cancelled' && (
                      <div className="bg-white border border-gray-200 rounded-lg p-3">
                        <div className="text-xs font-bold text-[#1f2d4d] mb-2">Admin controls</div>
                        <div className="flex flex-wrap items-center gap-2">
                          <select value={d.status || o.order_status} onChange={e => setDraft(p => ({ ...p, [o.id]: { ...d, status: e.target.value } }))}
                            className="text-xs border border-gray-300 rounded-lg px-2 py-1.5">
                            {STATUSES.filter(s => s !== 'cancelled').map(s => <option key={s} value={s}>{LABEL[s]}</option>)}
                          </select>
                          <input value={d.courier || ''} onChange={e => setDraft(p => ({ ...p, [o.id]: { ...d, courier: e.target.value } }))} placeholder="Courier (optional)" className="text-xs border border-gray-300 rounded-lg px-2 py-1.5 w-32" />
                          <input value={d.tracking || ''} onChange={e => setDraft(p => ({ ...p, [o.id]: { ...d, tracking: e.target.value } }))} placeholder="AWB (optional)" className="text-xs border border-gray-300 rounded-lg px-2 py-1.5 w-36" />
                          <button disabled={busy === o.id} onClick={() => apply(o)} className="text-xs font-bold px-4 py-1.5 rounded-lg bg-amber-700 text-white disabled:opacity-50">Apply</button>
                          <button disabled={busy === o.id} onClick={() => cancel(o)} className="ml-auto text-xs font-bold px-3 py-1.5 rounded-lg border border-red-300 text-red-700 disabled:opacity-50">Cancel order</button>
                        </div>
                        <div className="mt-2 text-[11px] text-amber-800 bg-amber-50 rounded px-2.5 py-2">⚠ Overriding status notifies the customer. Refunds run via <strong>Returns</strong> — a refund reverses the influencer's held commission automatically.</div>
                      </div>
                    )}
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
