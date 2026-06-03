'use client';

/**
 * /dashboard/offers — the reusable Offer Library (Offer Engine, Sub-contract B).
 * Brands design offers against their catalogue, independent of campaigns.
 * Distribution (publish-to-store, per-influencer campaign attach) is C/D.
 */

import { useEffect, useState, useCallback, useMemo } from 'react';
import { brandApi } from '../../../lib/api';
import OfferBuilder, { buildOfferConfig, emptyDraft, draftFromOffer, previewLine } from '../../../components/OfferBuilder';

const TYPE_ICON = { discount: '%', volume: '≣', bogo: '⇄', bundle: '▣', free_gift: '🎁' };
const TYPE_LABEL = { discount: 'Discount', volume: 'Volume', bogo: 'BOGO', bundle: 'Bundle', free_gift: 'Free gift' };
const TABS = [['all', 'All'], ['active', 'Active'], ['draft', 'Drafts'], ['archived', 'Archived']];

export default function OffersPage() {
  const [offers, setOffers] = useState([]);
  const [counts, setCounts] = useState({ all: 0, draft: 0, active: 0, archived: 0 });
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('all');
  const [typeFilter, setTypeFilter] = useState('');
  const [q, setQ] = useState('');
  const [modal, setModal] = useState(null);       // { editingId|null, draft }
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = useCallback((msg, type = 'ok') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3200);
  }, []);

  async function load() {
    const [offRes, prodRes] = await Promise.all([brandApi.getOffers(), brandApi.getProducts()]);
    if (offRes.success) { setOffers(offRes.data?.offers || []); setCounts(offRes.data?.counts || { all: 0, draft: 0, active: 0, archived: 0 }); }
    if (prodRes.success) setProducts(prodRes.data?.products || []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const sections = useMemo(() => [...new Set(products.map(p => p.section).filter(Boolean))], [products]);

  const visible = useMemo(() => offers.filter(o =>
    (tab === 'all' || o.status === tab) &&
    (!typeFilter || o.offer_type === typeFilter) &&
    (!q || o.name.toLowerCase().includes(q.toLowerCase()))
  ), [offers, tab, typeFilter, q]);

  const openNew = () => setModal({ editingId: null, draft: emptyDraft() });
  const openEdit = (o) => setModal({ editingId: o.id, draft: draftFromOffer(o) });

  async function save(activate) {
    const payload = buildOfferConfig(modal.draft);
    if (!payload.name) { showToast('Offer name is required', 'err'); return; }
    setSaving(true);
    try {
      let res;
      if (modal.editingId) {
        res = await brandApi.updateOffer(modal.editingId, { ...payload, status: activate ? 'active' : undefined });
      } else {
        res = await brandApi.createOffer(payload);
        if (res.success && activate) res = await brandApi.updateOffer(res.data.offer.id, { status: 'active' });
      }
      if (!res.success) {
        const e = res.error || {};
        showToast(e.message ? `${e.message}${e.field ? ` (${e.field})` : ''}` : 'Could not save offer', 'err');
        return;
      }
      showToast(modal.editingId ? 'Offer updated' : 'Offer created');
      setModal(null);
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function setStatus(o, status) {
    const res = await brandApi.updateOffer(o.id, { status });
    if (res.success) { showToast(status === 'archived' ? 'Offer archived' : 'Offer activated'); load(); }
    else showToast(res.error?.message || 'Update failed', 'err');
  }

  return (
    <div className="ofl">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      <div className="hdr">
        <div>
          <h1>Offers</h1>
          <div className="sub">Design reusable offers on your products & services. Attach them to influencers in a campaign or (soon) publish to your store — without re-authoring discounts each time.</div>
        </div>
        <button className="btn btn-ink" onClick={openNew}>+ New offer</button>
      </div>

      {loading ? <div className="spin">Loading…</div> : (
        <>
          <div className="stats">
            <div className="stat"><div className="n">{counts.all}</div><div className="l">Total offers</div></div>
            <div className="stat"><div className="n">{counts.active}</div><div className="l">Active</div></div>
            <div className="stat"><div className="n">{counts.draft}</div><div className="l">Drafts</div></div>
            <div className="stat"><div className="n">{counts.archived}</div><div className="l">Archived</div></div>
          </div>

          <div className="tabs">
            {TABS.map(([k, lbl]) => (
              <button key={k} className={tab === k ? 'act' : ''} onClick={() => setTab(k)}>{lbl} <span className="mono">{k === 'all' ? counts.all : counts[k] || 0}</span></button>
            ))}
          </div>

          <div className="toolbar">
            <div className="search"><input className="inp" placeholder="Search offers by name…" value={q} onChange={e => setQ(e.target.value)} /></div>
            <button className={`chip${!typeFilter ? ' act' : ''}`} onClick={() => setTypeFilter('')}>All types</button>
            {Object.keys(TYPE_LABEL).map(t => (
              <button key={t} className={`chip${typeFilter === t ? ' act' : ''}`} onClick={() => setTypeFilter(t)}>{TYPE_LABEL[t]}</button>
            ))}
          </div>

          {visible.length === 0 ? (
            offers.length === 0 ? (
              <div className="empty">
                <div className="em">◆</div>
                <h3>Design your first offer</h3>
                <p>Offers live here independently of campaigns. Build one once, then reuse it across campaigns and influencers.</p>
                <button className="btn btn-ink" onClick={openNew}>+ New offer</button>
              </div>
            ) : <div className="empty-soft">No offers match this filter.</div>
          ) : (
            <div className="list">
              {visible.map(o => (
                <div key={o.id} className="offer-row" style={o.status === 'archived' ? { opacity: .62 } : null}>
                  <div className="o-ico">{TYPE_ICON[o.offer_type] || '◆'}</div>
                  <div className="o-main">
                    <h4>{o.name}</h4>
                    <div className="o-desc">{previewLine(draftFromOffer(o))}</div>
                    <div className="o-tags">
                      <span className="pill type">{TYPE_LABEL[o.offer_type]}</span>
                      <span className={`pill ${o.status}`}>{o.status}</span>
                    </div>
                  </div>
                  <div className="o-act">
                    <button className="btn btn-ghost btn-sm" onClick={() => openEdit(o)}>Edit</button>
                    {o.status !== 'active' && o.status !== 'archived' && <button className="btn btn-yellow btn-sm" onClick={() => setStatus(o, 'active')}>Activate</button>}
                    {o.status !== 'archived' && <button className="btn btn-ghost btn-sm" onClick={() => setStatus(o, 'archived')}>Archive</button>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {modal && (
        <div className="modal-bg" onClick={() => !saving && setModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-h"><h3>{modal.editingId ? 'Edit offer' : 'New offer'}</h3><button className="modal-x" onClick={() => !saving && setModal(null)}>×</button></div>
            <div className="modal-b">
              <OfferBuilder draft={modal.draft} setDraft={(d) => setModal(m => ({ ...m, draft: d }))} products={products} sections={sections} />
            </div>
            <div className="modal-f">
              <button className="btn btn-ghost" onClick={() => setModal(null)} disabled={saving}>Cancel</button>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-ghost" onClick={() => save(false)} disabled={saving}>{saving ? 'Saving…' : 'Save draft'}</button>
                <button className="btn btn-ink" onClick={() => save(true)} disabled={saving}>Save &amp; activate</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {toast && <div className={`toast${toast.type === 'err' ? ' err' : ''}`}>{toast.type === 'err' ? '✗' : '✓'} {toast.msg}</div>}
    </div>
  );
}

const CSS = `
.ofl{--white:#fff;--bg:#FAFAFA;--bg2:#F4F4F5;--yellow:#FFC107;--yellow-hover:#E0A800;--yellow-pale:#FFF7CC;--yellow-text:#6B5A00;--ink:#0A0A0A;--ink-2:#1F1F22;--muted:#52525B;--muted-2:#71717A;--muted-3:#A1A1AA;--border:#E4E4E7;--success-pale:#D1FAE5;--success-text:#047857;font-family:'Plus Jakarta Sans','Outfit',system-ui,sans-serif;color:var(--ink);font-size:13px;line-height:1.45}
.ofl *{box-sizing:border-box}
.ofl .mono{font-family:'JetBrains Mono','Consolas',monospace}
.ofl h1{font-family:'Outfit',sans-serif;font-size:26px;font-weight:700;letter-spacing:-.5px}
.ofl .hdr{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:18px}
.ofl .sub{font-size:13px;color:var(--muted);margin-top:4px;max-width:640px}
.ofl .btn{padding:9px 15px;border-radius:10px;font-size:12.5px;font-weight:700;border:0;cursor:pointer;font-family:inherit}
.ofl .btn-ink{background:var(--ink);color:var(--yellow)}.ofl .btn-ink:hover{background:var(--ink-2)}
.ofl .btn-yellow{background:var(--yellow);color:var(--ink)}.ofl .btn-yellow:hover{background:var(--yellow-hover)}
.ofl .btn-ghost{background:#fff;border:1px solid var(--border);color:var(--ink)}.ofl .btn-ghost:hover{border-color:var(--ink)}
.ofl .btn-sm{padding:6px 11px;font-size:11.5px}
.ofl .btn:disabled{opacity:.5;cursor:default}
.ofl .spin{padding:40px;text-align:center;color:var(--muted-2)}
.ofl .stats{display:flex;gap:10px;margin-bottom:18px}
.ofl .stat{flex:1;background:#fff;border:1px solid var(--border);border-radius:14px;padding:14px 16px}
.ofl .stat .n{font-family:'Outfit',sans-serif;font-size:24px;font-weight:800}
.ofl .stat .l{font-size:11px;color:var(--muted);font-weight:600;text-transform:uppercase;letter-spacing:.3px;margin-top:2px}
.ofl .tabs{display:flex;gap:4px;background:var(--bg2);padding:4px;border-radius:11px;margin-bottom:16px;width:fit-content}
.ofl .tabs button{border:0;background:transparent;padding:7px 16px;border-radius:8px;font-weight:700;font-size:12.5px;cursor:pointer;color:var(--muted);font-family:inherit}
.ofl .tabs button.act{background:#fff;color:var(--ink);box-shadow:0 1px 2px rgba(0,0,0,.06)}
.ofl .toolbar{display:flex;align-items:center;gap:10px;margin-bottom:16px;flex-wrap:wrap}
.ofl .search{flex:1;min-width:200px}
.ofl .inp{width:100%;font-size:13px;padding:10px 13px;border:1px solid var(--border);border-radius:10px;background:#fff;color:var(--ink);outline:none;font-family:inherit}
.ofl .inp:focus{border-color:var(--yellow);box-shadow:0 0 0 3px var(--yellow-pale)}
.ofl .chip{padding:6px 12px;border-radius:99px;background:#fff;border:1px solid var(--border);font-size:11.5px;font-weight:700;color:var(--muted);cursor:pointer;font-family:inherit}
.ofl .chip:hover{border-color:var(--ink);color:var(--ink)}.ofl .chip.act{background:var(--ink);border-color:var(--ink);color:var(--yellow)}
.ofl .offer-row{background:#fff;border:1px solid var(--border);border-radius:14px;padding:14px 16px;display:grid;grid-template-columns:46px 1fr auto;gap:14px;align-items:center;margin-bottom:8px}
.ofl .offer-row:hover{border-color:var(--ink)}
.ofl .o-ico{width:46px;height:46px;border-radius:11px;background:var(--yellow-pale);color:var(--yellow-text);display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:800}
.ofl .o-main h4{font-family:'Outfit',sans-serif;font-size:14.5px;font-weight:700;margin-bottom:3px}
.ofl .o-desc{font-size:12px;color:var(--muted);margin-bottom:6px}
.ofl .o-tags{display:flex;gap:6px;flex-wrap:wrap}
.ofl .o-act{display:flex;gap:6px;align-items:center}
.ofl .pill{font-family:'JetBrains Mono',monospace;font-size:9.5px;font-weight:800;padding:3px 9px;border-radius:99px;text-transform:uppercase;letter-spacing:.3px}
.ofl .pill.type{background:var(--yellow-pale);color:var(--yellow-text)}
.ofl .pill.draft{background:var(--bg2);color:var(--muted-2)}
.ofl .pill.active{background:var(--success-pale);color:var(--success-text)}
.ofl .pill.archived{background:var(--bg2);color:var(--muted-3)}
.ofl .empty{background:linear-gradient(135deg,#FFFDEB,#FFF7CC);border:1px solid rgba(255,193,7,.4);border-radius:18px;padding:48px 32px;text-align:center;position:relative;overflow:hidden;margin-top:14px}
.ofl .empty::before{content:'';position:absolute;top:-50px;right:-50px;width:180px;height:180px;background:var(--yellow);border-radius:50%;opacity:.18}
.ofl .empty .em{font-size:46px;margin-bottom:10px;position:relative}
.ofl .empty h3{font-family:'Outfit',sans-serif;font-size:19px;font-weight:700;margin-bottom:6px;position:relative}
.ofl .empty p{font-size:12.5px;color:var(--muted);max-width:460px;margin:0 auto 18px;line-height:1.55;position:relative}
.ofl .empty .btn{position:relative}
.ofl .empty-soft{padding:30px;text-align:center;color:var(--muted-2);font-size:12.5px}
.ofl .modal-bg{position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:50;display:flex;align-items:center;justify-content:center;padding:16px}
.ofl .modal{background:#fff;border-radius:16px;max-width:620px;width:100%;max-height:92vh;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 25px 50px -12px rgba(0,0,0,.25)}
.ofl .modal-h{padding:16px 22px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between}
.ofl .modal-h h3{font-family:'Outfit',sans-serif;font-size:16px;font-weight:700}
.ofl .modal-x{width:30px;height:30px;border-radius:50%;color:var(--muted-2);font-size:20px;background:transparent;border:0;cursor:pointer}
.ofl .modal-x:hover{background:var(--bg2);color:var(--ink)}
.ofl .modal-b{flex:1;overflow-y:auto;padding:18px 22px}
.ofl .modal-f{padding:14px 22px;border-top:1px solid var(--border);background:var(--bg2);display:flex;justify-content:space-between;gap:8px}
.ofl .toast{position:fixed;top:24px;right:24px;background:var(--ink);color:#fff;padding:12px 18px;border-radius:12px;font-size:13px;font-weight:600;z-index:100;box-shadow:0 10px 25px rgba(0,0,0,.15)}
.ofl .toast.err{background:#B91C1C}
`;
