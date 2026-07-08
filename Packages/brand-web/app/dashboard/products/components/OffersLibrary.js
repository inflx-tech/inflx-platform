'use client';
// OFFERS LIBRARY — the brand's reusable offer engine (folded from the old
// /dashboard/offers page in E-3, extracted to a shared component in
// listing-offers-tab so BOTH product surfaces can mount it:
//   • /dashboard/products        → "Offers" sub-tab (non-drill-down brands)
//   • /dashboard/products/listing → "Offers" tab (fashion/furniture brands)
// All logic preserved: CRUD, publish-to-store toggle, "where it's used"
// attachments. CSS scoped under .ofl (no clash with .prd / .lst scopes).
import { useEffect, useState, useCallback, useMemo } from 'react';
import { brandApi } from '../../../../lib/api';
import OfferBuilder, { buildOfferConfig, emptyDraft, draftFromOffer, previewLine } from '../../../../components/OfferBuilder';

const OFL_TYPE_ICON = { discount: '%', volume: '≣', bogo: '⇄', bundle: '▣', free_gift: '🎁' };
const OFL_TYPE_LABEL = { discount: 'Discount', volume: 'Volume', bogo: 'BOGO', bundle: 'Bundle', free_gift: 'Free gift' };
const OFL_TABS = [['all', 'All'], ['active', 'Active'], ['draft', 'Drafts'], ['archived', 'Archived']];

export default function OffersLibrary() {
  const [offers, setOffers] = useState([]);
  const [counts, setCounts] = useState({ all: 0, draft: 0, active: 0, archived: 0 });
  const [products, setProducts] = useState([]);
  const [offerCategories, setOfferCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('all');
  const [typeFilter, setTypeFilter] = useState('');
  const [q, setQ] = useState('');
  const [modal, setModal] = useState(null);       // { editingId|null, draft }
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [detail, setDetail] = useState(null);     // { offer, attachments, loading } — "where it's used"

  const showToast = useCallback((msg, type = 'ok') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3200);
  }, []);

  async function load() {
    const [offRes, prodRes, catRes] = await Promise.all([
      brandApi.getOffers(), brandApi.getProducts(), brandApi.getOfferCategories?.(),
    ]);
    if (offRes.success) { setOffers(offRes.data?.offers || []); setCounts(offRes.data?.counts || { all: 0, draft: 0, active: 0, archived: 0 }); }
    if (prodRes.success) setProducts(prodRes.data?.products || []);
    if (catRes?.success) setOfferCategories(catRes.data?.categories || []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  // Category options = the COMPLETE vertical taxonomy (offer-builder-scope), not
  // just categories that currently have products. Fall back to the product-
  // derived sections if the endpoint is unavailable (older backend).
  const sections = useMemo(() => (
    offerCategories.length ? offerCategories
      : [...new Set(products.map(p => p.section).filter(Boolean))]
  ), [offerCategories, products]);

  const visible = useMemo(() => offers.filter(o =>
    (tab === 'all' || o.status === tab) &&
    (!typeFilter || o.offer_type === typeFilter) &&
    (!q || o.name.toLowerCase().includes(q.toLowerCase()))
  ), [offers, tab, typeFilter, q]);

  const fmtDate = (d) => (d ? String(d).slice(0, 10) : '');
  const openNew = () => setModal({ editingId: null, draft: emptyDraft(), published_to_store: false, store_starts_at: '', store_ends_at: '' });
  const openEdit = (o) => setModal({ editingId: o.id, draft: draftFromOffer(o), published_to_store: !!o.published_to_store, store_starts_at: fmtDate(o.store_starts_at), store_ends_at: fmtDate(o.store_ends_at) });

  async function openDetail(o) {
    setDetail({ offer: o, attachments: [], loading: true });
    const res = await brandApi.getOfferAttachments(o.id);
    setDetail({ offer: o, attachments: res.success ? (res.data?.attachments || []) : [], loading: false });
  }

  async function togglePublish(o) {
    const res = await brandApi.updateOffer(o.id, { published_to_store: !o.published_to_store });
    if (res.success) { showToast(!o.published_to_store ? 'Published to store' : 'Removed from store'); load(); }
    else showToast(res.error?.message || 'Update failed', 'err');
  }

  async function save(activate) {
    const payload = buildOfferConfig(modal.draft);
    if (!payload.name) { showToast('Offer name is required', 'err'); return; }
    setSaving(true);
    try {
      const dist = {
        published_to_store: !!modal.published_to_store,
        store_starts_at: modal.store_starts_at || null,
        store_ends_at: modal.store_ends_at || null,
      };
      let res;
      if (modal.editingId) {
        res = await brandApi.updateOffer(modal.editingId, { ...payload, ...dist, status: activate ? 'active' : undefined });
      } else {
        res = await brandApi.createOffer(payload);
        if (res.success && (activate || dist.published_to_store)) {
          res = await brandApi.updateOffer(res.data.offer.id, { ...dist, status: activate ? 'active' : undefined });
        }
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
      <style dangerouslySetInnerHTML={{ __html: OFL_CSS }} />

      <div className="hdr">
        <div>
          <h1>Offers</h1>
          <div className="sub">Design reusable offers on your products & services. Publish them to your store, or attach them to influencers in a campaign — without re-authoring discounts each time.</div>
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
            {OFL_TABS.map(([k, lbl]) => (
              <button key={k} className={tab === k ? 'act' : ''} onClick={() => setTab(k)}>{lbl} <span className="mono">{k === 'all' ? counts.all : counts[k] || 0}</span></button>
            ))}
          </div>

          <div className="toolbar">
            <div className="search"><input className="inp" placeholder="Search offers by name…" value={q} onChange={e => setQ(e.target.value)} /></div>
            <button className={`chip${!typeFilter ? ' act' : ''}`} onClick={() => setTypeFilter('')}>All types</button>
            {Object.keys(OFL_TYPE_LABEL).map(t => (
              <button key={t} className={`chip${typeFilter === t ? ' act' : ''}`} onClick={() => setTypeFilter(t)}>{OFL_TYPE_LABEL[t]}</button>
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
                  <div className="o-ico">{OFL_TYPE_ICON[o.offer_type] || '◆'}</div>
                  <div className="o-main" style={{ cursor: 'pointer' }} onClick={() => openDetail(o)} title="View where this offer is used">
                    <h4>{o.name}</h4>
                    <div className="o-desc">{previewLine(draftFromOffer(o))}</div>
                    <div className="o-tags">
                      <span className="pill type">{OFL_TYPE_LABEL[o.offer_type]}</span>
                      <span className={`pill ${o.status}`}>{o.status}</span>
                      {o.published_to_store && <span className="pill store">◧ In store</span>}
                      {o.attached_count > 0 && <span className="pill infl">★ {o.attached_count} influencer{o.attached_count > 1 ? 's' : ''} →</span>}
                    </div>
                  </div>
                  <div className="o-act">
                    {o.status === 'active' && (
                      <button className={`btn btn-sm ${o.published_to_store ? 'btn-ghost' : 'btn-yellow'}`} onClick={() => togglePublish(o)}>
                        {o.published_to_store ? '◧ In store ✓' : '◧ Publish to store'}
                      </button>
                    )}
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

              <div className="dist-sec">
                <div className="dist-row">
                  <div>
                    <div className="dist-title">◧ Publish to store</div>
                    <div className="dist-sub">Every follower sees this in your store and can buy it directly — no influencer, no commission.</div>
                  </div>
                  <button type="button" className={`sw ${modal.published_to_store ? 'on' : ''}`} onClick={() => setModal(m => ({ ...m, published_to_store: !m.published_to_store }))}><span className="dot" /></button>
                </div>
                {modal.published_to_store && (
                  <>
                    <div className="dist-dates">
                      <div><label className="flbl2">Start date (optional)</label><input type="date" className="inp" value={modal.store_starts_at} onChange={e => setModal(m => ({ ...m, store_starts_at: e.target.value }))} /></div>
                      <div><label className="flbl2">End date (optional)</label><input type="date" className="inp" value={modal.store_ends_at} onChange={e => setModal(m => ({ ...m, store_ends_at: e.target.value }))} /></div>
                    </div>
                    {!modal.editingId && <div className="dist-note">New offers save as a draft — a store offer only goes live once it's <b>Active</b>. Use "Save &amp; activate".</div>}
                  </>
                )}
              </div>
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

      {detail && (
        <div className="modal-bg" onClick={() => setDetail(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-h"><h3>{detail.offer.name}</h3><button className="modal-x" onClick={() => setDetail(null)}>×</button></div>
            <div className="modal-b">
              <div className="o-tags" style={{ marginBottom: 16 }}>
                <span className="pill type">{OFL_TYPE_LABEL[detail.offer.offer_type]}</span>
                <span className={`pill ${detail.offer.status}`}>{detail.offer.status}</span>
                {detail.offer.published_to_store && <span className="pill store">◧ In store</span>}
              </div>
              <div className="lbl2">Where it's used — influencers & campaigns</div>
              {detail.loading ? <div className="spin">Loading…</div> : (
                detail.attachments.length === 0 ? (
                  <div className="empty-soft">Not attached to any influencer yet. {detail.offer.published_to_store ? 'It is currently live in your store.' : 'Publish it to your store, or attach it to influencers in a campaign.'}</div>
                ) : (
                  <table className="atbl">
                    <thead><tr><th>Influencer</th><th>Campaign</th><th>Type</th><th>Status</th></tr></thead>
                    <tbody>
                      {detail.attachments.map(a => (
                        <tr key={a.campaign_influencer_id}>
                          <td><b>{a.influencer_name}</b><div className="sub2">@{a.instagram_handle}</div></td>
                          <td>{a.campaign_name}<div className="sub2">set: {a.set_name} · {a.campaign_status}</div></td>
                          <td><span className={`pill ${a.allocation === 'promotional' ? 'infl' : 'type'}`}>{a.goal}</span></td>
                          <td><span className="pill draft" style={{ textTransform: 'capitalize' }}>{a.status}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )
              )}
            </div>
            <div className="modal-f"><span style={{ fontSize: 11.5, color: 'var(--muted-2)' }}>{detail.attachments.length} influencer attachment{detail.attachments.length === 1 ? '' : 's'}</span><button className="btn btn-ink" onClick={() => setDetail(null)}>Close</button></div>
          </div>
        </div>
      )}

      {toast && <div className={`toast${toast.type === 'err' ? ' err' : ''}`}>{toast.type === 'err' ? '✗' : '✓'} {toast.msg}</div>}
    </div>
  );
}

const OFL_CSS = `
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
.ofl .pill.store{background:#DBEAFE;color:#1D4ED8}
.ofl .pill.infl{background:#F3E8FF;color:#7E22CE}
.ofl .sw{width:44px;height:24px;background:var(--muted-3);border-radius:99px;position:relative;cursor:pointer;border:0;flex-shrink:0}
.ofl .sw.on{background:#10B981}
.ofl .sw .dot{position:absolute;top:2px;left:2px;width:20px;height:20px;background:#fff;border-radius:50%;box-shadow:0 1px 3px rgba(0,0,0,.2);transition:transform .15s}
.ofl .sw.on .dot{transform:translateX(20px)}
.ofl .dist-sec{margin-top:18px;border-top:1px dashed var(--border);padding-top:16px}
.ofl .dist-row{display:flex;align-items:flex-start;justify-content:space-between;gap:14px}
.ofl .dist-title{font-family:'Outfit',sans-serif;font-size:14px;font-weight:700}
.ofl .dist-sub{font-size:11.5px;color:var(--muted);margin-top:3px;max-width:420px;line-height:1.5}
.ofl .dist-dates{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:12px}
.ofl .flbl2{display:block;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.3px;color:var(--muted);margin-bottom:6px}
.ofl .dist-note{font-size:11px;color:var(--yellow-text);background:var(--yellow-pale);border-radius:8px;padding:8px 11px;margin-top:10px}
.ofl .lbl2{font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.3px;color:var(--muted);margin-bottom:8px}
.ofl .atbl{width:100%;border-collapse:collapse;font-size:12.5px}
.ofl .atbl th{text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.3px;color:var(--muted-2);padding:6px 8px;border-bottom:1px solid var(--border)}
.ofl .atbl td{padding:9px 8px;border-bottom:1px solid var(--bg2);vertical-align:top}
.ofl .sub2{font-size:10.5px;color:var(--muted-2);margin-top:2px}
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
