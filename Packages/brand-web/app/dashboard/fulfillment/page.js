'use client';
import { useEffect, useState, useCallback } from 'react';
import { orderApi, fmtMoney } from '../../../lib/api';

// 5-step lifecycle (migration 105). 'dispatched' = the "Shipped" step.
const STEPS = [
  { key: 'confirmed',        label: 'Confirmed' },
  { key: 'packed',           label: 'Packed' },
  { key: 'dispatched',       label: 'Shipped' },
  { key: 'out_for_delivery', label: 'Out for Delivery' },
  { key: 'delivered',        label: 'Delivered' },
];
const STEP_IDX = Object.fromEntries(STEPS.map((s, i) => [s.key, i]));

const FILTERS = [
  { key: '',          label: 'All' },
  { key: 'confirmed', label: 'To pack' },
  { key: 'packed',    label: 'Packed' },
  { key: 'dispatched', label: 'Shipped' },
  { key: 'delivered', label: 'Delivered' },
  { key: 'cancelled', label: 'Cancelled' },
];

const COURIERS = ['Delhivery', 'DTDC', 'Blue Dart', 'India Post', 'XpressBees', 'Ekart', 'Other'];

// Best-effort deep links; fallback = Google search for the AWB.
function trackUrl(courier, awb) {
  if (!awb) return null;
  const c = String(courier || '').toLowerCase();
  if (c.includes('delhivery')) return `https://www.delhivery.com/track/package/${encodeURIComponent(awb)}`;
  if (c.includes('dtdc'))      return `https://www.dtdc.in/tracking/tracking_results.asp?strCnno=${encodeURIComponent(awb)}`;
  if (c.includes('blue'))      return `https://www.bluedart.com/tracking?trackingNo=${encodeURIComponent(awb)}`;
  if (c.includes('xpress'))    return `https://www.xpressbees.com/track?awb=${encodeURIComponent(awb)}`;
  if (c.includes('post'))      return `https://www.indiapost.gov.in/_layouts/15/dop.portal.tracking/trackconsignment.aspx`;
  return `https://www.google.com/search?q=${encodeURIComponent(`${courier || ''} ${awb} tracking`)}`;
}

function fmtRel(iso) {
  if (!iso) return '—';
  const sec = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (sec < 3600) return `${Math.floor(sec / 60) || 1}m ago`;
  if (sec < 86_400) return `${Math.floor(sec / 3600)}h ago`;
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

const CSS = `
.ful *{box-sizing:border-box}
.ful{--white:#fff;--bg:#FAFAFA;--bg2:#F4F4F5;--yellow:#FFC107;--yellow-pale:#FFF7CC;--yellow-text:#6B5A00;
--ink:#0A0A0A;--muted:#52525B;--muted-2:#71717A;--muted-3:#A1A1AA;--border:#E4E4E7;--border-soft:#F4F4F5;
--success:#10B981;--success-pale:#D1FAE5;--success-text:#047857;--danger:#E8401A;--danger-pale:#FDEEE9;--danger-text:#B91C1C;--conv:#7E22CE;--conv-pale:#F3E8FF;--info:#1D4ED8;--info-pale:#DBEAFE;
font-family:'Plus Jakarta Sans','Outfit',system-ui,sans-serif;color:var(--ink);font-size:13px;max-width:1000px;margin:0 auto}
.ful .hdr h1{font-family:'Outfit',sans-serif;font-size:24px;font-weight:700;letter-spacing:-.4px}
.ful .hdr .rule{width:42px;height:3px;background:var(--yellow);border-radius:2px;margin:6px 0}
.ful .hdr .sub{font-size:12px;color:var(--muted-2);margin-bottom:16px}
.ful .cnt-chip{display:inline-flex;padding:5px 11px;border-radius:99px;background:var(--ink);color:var(--yellow);font-family:'JetBrains Mono',monospace;font-size:11px;font-weight:800;margin-bottom:6px}
.ful .chip-row{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:14px}
.ful .chip{padding:6px 12px;border-radius:99px;background:var(--white);border:1px solid var(--border);font-size:11.5px;font-weight:600;color:var(--muted);cursor:pointer;font-family:inherit}
.ful .chip.act{background:var(--ink);border-color:var(--ink);color:var(--yellow);font-weight:700}
.ful .oc{background:var(--white);border:1px solid var(--border);border-radius:12px;margin-bottom:8px;overflow:hidden}
.ful .oc.open{border-color:var(--ink)}
.ful .oc-row{padding:12px 14px;display:grid;grid-template-columns:auto 1fr auto auto;gap:12px;align-items:center;cursor:pointer;width:100%;text-align:left;background:transparent;border:0;color:var(--ink);font-family:inherit}
.ful .oc-badge{font-family:'JetBrains Mono',monospace;font-size:10px;font-weight:800;padding:5px 10px;border-radius:8px;background:var(--conv-pale);color:var(--conv)}
.ful .oc-name{font-family:'Outfit',sans-serif;font-size:13.5px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ful .oc-meta{font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--muted-2);margin-top:2px}
.ful .oc-amt{font-family:'JetBrains Mono',monospace;font-size:14px;font-weight:800;text-align:right}
.ful .pill{font-family:'JetBrains Mono',monospace;font-size:9.5px;font-weight:800;padding:3px 9px;border-radius:99px;text-transform:uppercase;white-space:nowrap}
.ful .pill.confirmed{background:var(--yellow-pale);color:var(--yellow-text)}
.ful .pill.packed{background:var(--conv-pale);color:var(--conv)}
.ful .pill.dispatched,.ful .pill.out_for_delivery{background:var(--info-pale);color:var(--info)}
.ful .pill.delivered{background:var(--success-pale);color:var(--success-text)}
.ful .pill.cancelled{background:var(--danger-pale);color:var(--danger-text)}
.ful .oc-exp{background:var(--bg);border-top:1px solid var(--border-soft);padding:16px}
.ful .exp-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:16px}
.ful .kv-l{font-family:'JetBrains Mono',monospace;font-size:9px;font-weight:800;color:var(--muted-2);text-transform:uppercase;letter-spacing:.4px}
.ful .kv-v{font-family:'JetBrains Mono',monospace;font-size:12px;font-weight:700;margin-top:3px}
.ful .kv-v a{color:var(--info);text-decoration:none}
.ful .stepper{display:flex;align-items:flex-start;margin:8px 0 18px}
.ful .step{display:flex;flex-direction:column;align-items:center;gap:6px;flex:1;position:relative}
.ful .step .dot{width:30px;height:30px;border-radius:50%;background:#EDE9E0;color:var(--muted-2);display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:800;z-index:2}
.ful .step.done .dot{background:var(--success);color:#fff}
.ful .step.curr .dot{background:var(--ink);color:var(--yellow)}
.ful .step .lab{font-size:10px;font-weight:700;color:var(--muted-2);text-align:center}
.ful .step.done .lab,.ful .step.curr .lab{color:var(--ink)}
.ful .step .line{position:absolute;top:15px;left:50%;width:100%;height:2px;background:#E4E4E7;z-index:1}
.ful .step.done .line{background:var(--success)}
.ful .step:last-child .line{display:none}
.ful .shipbox{background:var(--white);border:1px dashed var(--yellow);border-radius:10px;padding:14px;margin-bottom:14px}
.ful .shipbox h4{font-family:'Outfit',sans-serif;font-size:13px;font-weight:700;margin-bottom:10px}
.ful .two{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.ful .fld label{display:block;font-size:10px;font-weight:800;color:var(--muted-2);text-transform:uppercase;letter-spacing:.4px;margin-bottom:4px}
.ful .fld input,.ful .fld select{width:100%;border:1px solid var(--border);border-radius:8px;padding:9px 11px;font-size:12.5px;font-family:inherit}
.ful .acts{display:flex;gap:10px;align-items:center;flex-wrap:wrap}
.ful .btn{background:var(--ink);color:var(--yellow);border:none;font-weight:800;font-size:12.5px;padding:11px 20px;border-radius:9px;cursor:pointer;font-family:inherit}
.ful .btn:disabled{opacity:.5;cursor:not-allowed}
.ful .btn.gh{background:var(--white);border:1px solid var(--border);color:var(--muted)}
.ful .cancel{margin-left:auto;font-size:11.5px;font-weight:700;color:var(--danger-text);background:none;border:none;cursor:pointer}
.ful .note{font-size:11px;color:var(--muted-2);margin-top:10px;line-height:1.5}
.ful .term{font-size:12px;color:var(--muted);font-weight:600}
.ful .empty{background:linear-gradient(135deg,#FFFDEB,#FFF7CC);border:1px solid rgba(255,193,7,.4);border-radius:18px;padding:48px;text-align:center;margin-top:14px}
.ful .empty .em{font-size:44px;margin-bottom:8px}.ful .empty .h{font-family:'Outfit',sans-serif;font-size:18px;font-weight:700;margin-bottom:6px}
.ful .spinner{width:32px;height:32px;border:3px solid var(--border);border-top-color:var(--yellow);border-radius:50%;animation:ful-spin .8s linear infinite;margin:80px auto;display:block}
@keyframes ful-spin{to{transform:rotate(360deg)}}
.ful .msg{padding:9px 13px;border-radius:9px;font-size:12px;font-weight:600;margin-bottom:12px}
.ful .msg.err{background:var(--danger-pale);color:var(--danger-text)}
.ful .msg.ok{background:var(--success-pale);color:var(--success-text)}
`;

export default function FulfillmentPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [openId, setOpenId] = useState(null);
  const [ship, setShip] = useState({}); // { [id]: { courier, tracking } }
  const [busy, setBusy] = useState(null);
  const [msg, setMsg] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await orderApi.list(filter ? { status: filter } : undefined);
      if (res.success || res.data) setOrders(res.data?.orders || []);
    } catch (e) { console.error('fulfillment load', e); }
    finally { setLoading(false); }
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  async function advance(o, next, extra = {}) {
    setBusy(o.id); setMsg(null);
    try {
      const res = await orderApi.updateStatus(o.id, { order_status: next, ...extra });
      if (res.success || res.data) {
        setMsg({ kind: 'ok', text: `Order marked ${next.replace(/_/g, ' ')}. Customer notified.` });
        await load();
      } else {
        setMsg({ kind: 'err', text: res.error?.message || 'Update failed' });
      }
    } catch (e) {
      setMsg({ kind: 'err', text: e.message || 'Update failed' });
    } finally { setBusy(null); }
  }

  function onShip(o) {
    const s = ship[o.id] || {};
    if (!s.courier || !s.tracking) { setMsg({ kind: 'err', text: 'Enter courier + tracking number to ship.' }); return; }
    advance(o, 'dispatched', { courier_name: s.courier, tracking_number: s.tracking.trim() });
  }

  function cancel(o) {
    if (!confirm(`Cancel this order for ${o.follower_name || 'the customer'}? This notifies them.`)) return;
    advance(o, 'cancelled');
  }

  return (
    <div className="ful">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="hdr">
        <span className="cnt-chip">{orders.length} order{orders.length === 1 ? '' : 's'}</span>
        <h1>Order Fulfillment</h1>
        <div className="rule" />
        <div className="sub">Pack, ship, and track online orders. Your customer &amp; admin see each step. Commission stays held until the return window closes.</div>
      </div>

      <div className="chip-row">
        {FILTERS.map(f => (
          <button key={f.key || 'all'} className={`chip${filter === f.key ? ' act' : ''}`}
            onClick={() => { setFilter(f.key); setOpenId(null); }}>{f.label}</button>
        ))}
      </div>

      {msg && <div className={`msg ${msg.kind}`}>{msg.text}</div>}

      {loading ? <div className="spinner" /> : orders.length === 0 ? (
        <div className="empty"><div className="em">📦</div><div className="h">No orders in this view</div></div>
      ) : orders.map(o => {
        const isOpen = openId === o.id;
        const idx = STEP_IDX[o.order_status] ?? 0;
        const cancelled = o.order_status === 'cancelled';
        const items = Array.isArray(o.items_json) ? o.items_json : [];
        const itemLabel = items.length ? `${items.length} item${items.length > 1 ? 's' : ''}` : '—';
        const s = ship[o.id] || {};
        const tUrl = trackUrl(o.courier_name, o.tracking_number);
        return (
          <div key={o.id} className={`oc${isOpen ? ' open' : ''}`}>
            <button className="oc-row" onClick={() => setOpenId(isOpen ? null : o.id)}>
              <span className="oc-badge">📦 ORDER</span>
              <div style={{ minWidth: 0 }}>
                <div className="oc-name">{o.follower_name || 'Customer'}</div>
                <div className="oc-meta">{itemLabel} · {fmtRel(o.created_at)}{o.tracking_number ? ` · AWB ${o.tracking_number}` : ''}</div>
              </div>
              <div className="oc-amt">{fmtMoney(o.net_amount ?? 0)}</div>
              <span className={`pill ${o.order_status}`}>● {String(o.order_status || '').replace(/_/g, ' ')}</span>
            </button>

            {isOpen && (
              <div className="oc-exp">
                <div className="exp-grid">
                  <div><div className="kv-l">Customer</div><div className="kv-v">{o.follower_name || '—'}{o.follower_phone ? ` · ${o.follower_phone}` : ''}</div></div>
                  <div><div className="kv-l">Ship to</div><div className="kv-v">{o.delivery_address || '—'}</div></div>
                  <div><div className="kv-l">Courier / AWB</div><div className="kv-v">{o.courier_name ? `${o.courier_name} · ${o.tracking_number || '—'}` : '—'}{tUrl ? <> · <a href={tUrl} target="_blank" rel="noreferrer">Track ↗</a></> : null}</div></div>
                </div>

                {!cancelled ? (
                  <div className="stepper">
                    {STEPS.map((st, i) => (
                      <div key={st.key} className={`step${i < idx ? ' done' : i === idx ? ' curr' : ''}`}>
                        <div className="line" />
                        <div className="dot">{i < idx ? '✓' : i + 1}</div>
                        <div className="lab">{st.label}</div>
                      </div>
                    ))}
                  </div>
                ) : <div className="term" style={{ marginBottom: 14, color: 'var(--danger-text)' }}>This order was cancelled.</div>}

                {/* Ship form — shown when the next action is to ship (status = packed). */}
                {o.order_status === 'packed' && (
                  <div className="shipbox">
                    <h4>Ship this order</h4>
                    <div className="two">
                      <div className="fld"><label>Courier</label>
                        <select value={s.courier || ''} onChange={e => setShip(p => ({ ...p, [o.id]: { ...s, courier: e.target.value } }))}>
                          <option value="">Select courier</option>
                          {COURIERS.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>
                      <div className="fld"><label>Tracking / AWB number</label>
                        <input value={s.tracking || ''} onChange={e => setShip(p => ({ ...p, [o.id]: { ...s, tracking: e.target.value } }))} placeholder="e.g. 1234567890123" />
                      </div>
                    </div>
                    <div className="note">The customer sees this courier + AWB and a track-on-courier link.</div>
                  </div>
                )}

                {/* Actions per current status */}
                {!cancelled && o.order_status !== 'delivered' && (
                  <div className="acts">
                    {o.order_status === 'confirmed' && (
                      <button className="btn" disabled={busy === o.id} onClick={() => advance(o, 'packed')}>Mark Packed →</button>
                    )}
                    {o.order_status === 'packed' && (
                      <button className="btn" disabled={busy === o.id} onClick={() => onShip(o)}>Mark Shipped →</button>
                    )}
                    {o.order_status === 'dispatched' && (
                      <>
                        <button className="btn gh" disabled={busy === o.id} onClick={() => advance(o, 'out_for_delivery')}>Mark Out for Delivery</button>
                        <button className="btn" disabled={busy === o.id} onClick={() => advance(o, 'delivered')}>Mark Delivered ✓</button>
                      </>
                    )}
                    {o.order_status === 'out_for_delivery' && (
                      <button className="btn" disabled={busy === o.id} onClick={() => advance(o, 'delivered')}>Mark Delivered ✓</button>
                    )}
                    <button className="cancel" disabled={busy === o.id} onClick={() => cancel(o)}>Cancel order</button>
                  </div>
                )}
                {o.order_status === 'delivered' && <div className="term">✓ Delivered{o.delivered_at ? ` · ${fmtRel(o.delivered_at)}` : ''}. Commission releases after the return window.</div>}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
