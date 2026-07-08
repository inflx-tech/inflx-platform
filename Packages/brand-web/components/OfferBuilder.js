'use client';
import { useState, useMemo } from 'react';

/**
 * OfferBuilder — the reusable 5-type offer authoring form (Offer Engine).
 *
 * Controlled component: parent owns `draft` (use emptyDraft() / draftFromOffer())
 * and passes setDraft. Self-contained scoped styles (.ofb) so it can be dropped
 * into the campaign wizard in Sub-contract C without CSS coupling.
 *
 * The emitted payload (buildOfferConfig) matches the shapes the backend
 * offerConfig.validator accepts: discount/volume/bogo/bundle/free_gift.
 */

const OFFER_TYPES = [
  { key: 'discount',  label: 'Discount',  icon: '%' },
  { key: 'volume',    label: 'Volume',    icon: '≣' },
  { key: 'bogo',      label: 'BOGO',      icon: '⇄' },
  { key: 'bundle',    label: 'Bundle',    icon: '▣' },
  { key: 'free_gift', label: 'Free gift', icon: '🎁' },
];

const AVAILING_MODES = [
  { key: 'pay_at_store', label: '💸 Pay at store' },
  { key: 'online_order', label: '🛒 Online order' },
  { key: 'prebook',      label: '📅 Pre-book' },
  { key: 'enquiry',      label: '✉ Enquiry' },
];

function emptyDraft() {
  return {
    name: '',
    offer_type: 'discount',
    d_sub: 'pct', d_val: '', d_scope: 'store', d_category: '', d_prods: [],
    v_tiers: [{ min_spend: '', pct_off: '' }], v_scope: 'store', v_category: '', v_prods: [],
    bogo_buy: null, bogo_get: null,
    bnd_prods: [], bnd_price: '',
    gift_offers: [{ main: null, gift: null }],
    availing_modes: ['pay_at_store', 'online_order'],
  };
}

const prod = (p) => (p ? { id: p.id, name: p.name, price: p.price } : null);
const num = (v) => (v === '' || v == null ? 0 : Number(v));

/** Build the API payload { name, offer_type, offer_config_json, availing_modes }. */
function buildOfferConfig(d) {
  let cfg;
  switch (d.offer_type) {
    case 'discount':
      cfg = { sub_type: d.d_sub, value: num(d.d_val), scope: d.d_scope,
        category: d.d_scope === 'category' ? (d.d_category || null) : null,
        products: d.d_scope === 'products' ? (d.d_prods || []).map(prod) : [] };
      break;
    case 'volume':
      cfg = { tiers: (d.v_tiers || []).map(t => ({ min_spend: num(t.min_spend), pct_off: num(t.pct_off) })),
        scope: d.v_scope,
        category: d.v_scope === 'category' ? (d.v_category || null) : null,
        products: d.v_scope === 'products' ? (d.v_prods || []).map(prod) : [] };
      break;
    case 'bogo':
      cfg = { buy_product: prod(d.bogo_buy), get_product: prod(d.bogo_get) };
      break;
    case 'bundle':
      cfg = { products: (d.bnd_prods || []).map(prod), bundle_price: num(d.bnd_price) };
      break;
    case 'free_gift':
      cfg = { offers: (d.gift_offers || []).map(o => ({ main: prod(o.main), gift: prod(o.gift) })) };
      break;
    default:
      cfg = {};
  }
  return {
    name: (d.name || '').trim(),
    offer_type: d.offer_type,
    offer_config_json: cfg,
    availing_modes: d.availing_modes && d.availing_modes.length ? d.availing_modes : undefined,
  };
}

/** Inverse: hydrate a draft from a saved brand_offers row (for editing). */
function draftFromOffer(o) {
  const d = emptyDraft();
  d.name = o.name || '';
  d.offer_type = o.offer_type;
  d.availing_modes = o.availing_modes || ['pay_at_store', 'online_order'];
  const c = o.offer_config_json || {};
  if (o.offer_type === 'discount') {
    d.d_sub = c.sub_type || 'pct'; d.d_val = String(c.value ?? '');
    d.d_scope = c.scope || (c.products?.length ? 'products' : 'store');
    d.d_category = c.category || ''; d.d_prods = c.products || [];
  } else if (o.offer_type === 'volume') {
    d.v_tiers = (c.tiers || [{ min_spend: '', pct_off: '' }]).map(t => ({ min_spend: String(t.min_spend ?? ''), pct_off: String(t.pct_off ?? '') }));
    d.v_scope = c.scope || (c.products?.length ? 'products' : 'store');
    d.v_category = c.category || ''; d.v_prods = c.products || [];
  } else if (o.offer_type === 'bogo') {
    d.bogo_buy = c.buy_product || null; d.bogo_get = c.get_product || null;
  } else if (o.offer_type === 'bundle') {
    d.bnd_prods = c.products || []; d.bnd_price = String(c.bundle_price ?? '');
  } else if (o.offer_type === 'free_gift') {
    d.gift_offers = (c.offers || [{ main: null, gift: null }]);
  }
  return d;
}

function previewLine(d) {
  switch (d.offer_type) {
    case 'discount': {
      const base = d.d_sub === 'flat' ? `₹${d.d_val || '?'} off` : `${d.d_val || '?'}% off`;
      const where = d.d_scope === 'category' ? ` on ${d.d_category || 'a category'}` : d.d_scope === 'products' ? ` on ${(d.d_prods || []).length} product(s)` : ' on the whole store';
      return base + where;
    }
    case 'volume': return `Up to ${Math.max(0, ...(d.v_tiers || []).map(t => Number(t.pct_off) || 0))}% off — ${(d.v_tiers || []).length} tier(s)`;
    case 'bogo': return `Buy ${d.bogo_buy?.name || '?'} → ${d.bogo_get?.name || '?'} free`;
    case 'bundle': return `Bundle ${(d.bnd_prods || []).length} products @ ₹${d.bnd_price || '?'}`;
    case 'free_gift': return `Free gift — ${(d.gift_offers || []).length} pairing(s)`;
    default: return '';
  }
}

// Where does the built offer actually apply? (CTA-applicability hint.)
function applicabilityHint(offerType, scope) {
  const scoped = scope === 'category' || scope === 'products';
  if (offerType === 'bundle' || offerType === 'bogo' || offerType === 'free_gift') {
    return 'Applies to online orders (product-level offers need a cart, so pay-at-store bills can’t honour them).';
  }
  if (scoped) {
    return 'Applies to online orders. On a pay-at-store bill only whole-store % offers apply — a paper bill can’t be scoped to specific products or a category.';
  }
  return 'Applies to online orders and pay-at-store bills.';
}

// Searchable, section-grouped product finder. Replaces the flat <select>
// everywhere a product is chosen — usable at large inventory. multi=true keeps
// removable chips above the search; single-select fires onPick and closes.
function ProductFinder({ products = [], selected, multi = false, onPick, onToggle, placeholder = 'Search products by name or SKU…' }) {
  const [q, setQ] = useState('');
  const selIds = multi ? new Set((selected || []).map(p => String(p.id))) : new Set(selected ? [String(selected.id)] : []);
  const matches = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const rows = products.filter(p => !needle
      || (p.name || '').toLowerCase().includes(needle)
      || (p.sku || '').toLowerCase().includes(needle));
    const groups = {};
    for (const p of rows) { const g = p.section || 'Other'; (groups[g] = groups[g] || []).push(p); }
    return Object.entries(groups).slice(0, 30).map(([g, items]) => [g, items.slice(0, 25)]);
  }, [products, q]);

  if (!products.length) return <div className="hint">Add products to your catalogue first.</div>;
  return (
    <div>
      {multi && (selected || []).length > 0 && (
        <div className="chips">
          {(selected || []).map((p, i) => (
            <span key={p.id || i} className="chip">{p.name}<span className="x" onClick={() => onToggle(p)}>✕</span></span>
          ))}
        </div>
      )}
      {!multi && selected && (
        <div className="chips"><span className="chip">{selected.name}<span className="x" onClick={() => onPick(null)}>✕</span></span></div>
      )}
      <div className="finder">
        <div className="fhead"><input className="inp" style={{ margin: 0 }} value={q} onChange={e => setQ(e.target.value)} placeholder={placeholder} /></div>
        <div className="flist">
          {matches.length === 0 ? <div className="fempty">No products match “{q}”.</div> : matches.map(([g, items]) => (
            <div key={g}>
              <div className="fgrp">{g}</div>
              {items.map(p => {
                const on = selIds.has(String(p.id));
                return (
                  <div key={p.id} className={'fopt' + (on ? ' on' : '')}
                    onClick={() => { if (multi) onToggle(p); else onPick(p); }}>
                    <span className="fnm">{p.name}</span>
                    <span className="fpr">₹{p.price}{on ? ' ✓' : ''}</span>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Searchable category (section) picker — the brand's REAL catalogue sections
// (offers match bp.section). Falls back to a hint when the catalogue has none.
function CategoryPicker({ sections = [], value, onChange }) {
  const [q, setQ] = useState('');
  if (!sections.length) return <div className="hint">Add products first — your catalogue sections become the categories you can scope an offer to.</div>;
  const rows = sections.filter(s => !q.trim() || s.toLowerCase().includes(q.trim().toLowerCase()));
  return (
    <div>
      {value && <div className="chips"><span className="chip">{value}<span className="x" onClick={() => onChange('')}>✕</span></span></div>}
      <div className="finder">
        <div className="fhead"><input className="inp" style={{ margin: 0 }} value={q} onChange={e => setQ(e.target.value)} placeholder="Search your categories…" /></div>
        <div className="flist">
          {rows.length === 0 ? <div className="fempty">No category matches “{q}”.</div> : rows.map(s => (
            <div key={s} className={'fopt' + (value === s ? ' on' : '')} onClick={() => onChange(s)}>
              <span className="fnm">{s}</span>{value === s ? <span className="fpr">✓</span> : null}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function OfferBuilder({ draft, setDraft, products = [], sections = [] }) {
  const d = draft;
  const set = (field, value) => setDraft({ ...d, [field]: value });
  const setMany = (obj) => setDraft({ ...d, ...obj });

  const sameId = (a, b) => String(a?.id) === String(b?.id);
  const toggleInList = (field, list, p) => {
    const has = (list || []).some(x => sameId(x, p));
    set(field, has ? list.filter(x => !sameId(x, p)) : [...(list || []), prod(p)]);
  };

  // Applies-to picker: scope segment + (category | products) body. onScope may
  // coerce the value type (discount: store/category → % only).
  const AppliesTo = ({ scopeVal, onScope, catVal, catField, prodsVal, prodsField, offerType }) => (
    <>
      <div className="seg">
        {['store', 'category', 'products'].map(s => (
          <button key={s} className={scopeVal === s ? 'act' : ''} onClick={() => onScope(s)}>
            {s === 'store' ? 'Whole store' : s === 'category' ? 'Category' : 'Products'}
          </button>
        ))}
      </div>
      {scopeVal === 'category' && (
        <div style={{ marginTop: 8 }}><CategoryPicker sections={sections} value={catVal} onChange={(v) => set(catField, v)} /></div>
      )}
      {scopeVal === 'products' && (
        <div style={{ marginTop: 8 }}>
          <ProductFinder products={products} multi selected={prodsVal} onToggle={(p) => toggleInList(prodsField, prodsVal, p)} />
        </div>
      )}
      <div className="hint" style={{ marginTop: 10 }}>↳ {applicabilityHint(offerType, scopeVal)}</div>
    </>
  );

  return (
    <div className="ofb">
      <style dangerouslySetInnerHTML={{ __html: OFB_CSS }} />

      <div className="f">
        <label className="flbl">Offer name</label>
        <input className="inp" value={d.name} placeholder="e.g. Monsoon 20% Off — Footwear" onChange={e => set('name', e.target.value)} />
      </div>

      <label className="flbl">Offer type</label>
      <div className="typebar">
        {OFFER_TYPES.map(t => (
          <button key={t.key} className={`tcard${d.offer_type === t.key ? ' act' : ''}`} onClick={() => set('offer_type', t.key)}>
            <span className="e">{t.icon}</span><span className="t">{t.label}</span>
          </button>
        ))}
      </div>

      {/* DISCOUNT — applies-to FIRST, then a scope-gated value. */}
      {d.offer_type === 'discount' && (
        <div className="cfg">
          <h5>Applies to</h5>
          <AppliesTo offerType="discount" scopeVal={d.d_scope}
            onScope={(s) => setMany({ d_scope: s, d_sub: s === 'products' ? d.d_sub : 'pct' })}
            catVal={d.d_category} catField="d_category" prodsVal={d.d_prods} prodsField="d_prods" />
          <h5 style={{ marginTop: 16 }}>Discount value</h5>
          <div className="row">
            {d.d_scope === 'products' ? (
              <div className="tog"><button className={d.d_sub === 'pct' ? 'act' : ''} onClick={() => set('d_sub', 'pct')}>%</button><button className={d.d_sub === 'flat' ? 'act' : ''} onClick={() => set('d_sub', 'flat')}>₹</button></div>
            ) : (
              <div className="tog"><button className="act">% off</button></div>
            )}
            <input className="inp mono" style={{ flex: 1 }} value={d.d_val} onChange={e => set('d_val', e.target.value)}
              placeholder={d.d_sub === 'flat' && d.d_scope === 'products' ? '₹ off each product' : '% off'} />
          </div>
          {d.d_scope !== 'products' && <div className="hint-inline" style={{ display: 'block', marginTop: 6 }}>A flat ₹ amount only makes sense on a single product — {d.d_scope === 'store' ? 'whole store' : 'category'} offers are percentage.</div>}
        </div>
      )}

      {/* VOLUME — applies-to FIRST, then spend tiers (tiers are always %). */}
      {d.offer_type === 'volume' && (
        <div className="cfg">
          <h5>Applies to</h5>
          <AppliesTo offerType="volume" scopeVal={d.v_scope}
            onScope={(s) => set('v_scope', s)}
            catVal={d.v_category} catField="v_category" prodsVal={d.v_prods} prodsField="v_prods" />
          <h5 style={{ marginTop: 16 }}>Spend tiers</h5>
          {(d.v_tiers || []).map((t, ti) => (
            <div key={ti} className="g2">
              <div className="f"><label className="flbl">Min spend (₹)</label><input className="inp mono" value={t.min_spend} onChange={e => { const n = [...d.v_tiers]; n[ti] = { ...t, min_spend: e.target.value }; set('v_tiers', n); }} /></div>
              <div className="f"><label className="flbl">% off</label><div className="row">
                <input className="inp mono" value={t.pct_off} onChange={e => { const n = [...d.v_tiers]; n[ti] = { ...t, pct_off: e.target.value }; set('v_tiers', n); }} />
                {(d.v_tiers || []).length > 1 && <button className="xbtn" onClick={() => set('v_tiers', d.v_tiers.filter((_, i) => i !== ti))}>✕</button>}
              </div></div>
            </div>
          ))}
          <button className="addbtn" onClick={() => set('v_tiers', [...(d.v_tiers || []), { min_spend: '', pct_off: '' }])}>+ Add tier</button>
        </div>
      )}

      {/* BOGO */}
      {d.offer_type === 'bogo' && (
        <div className="cfg">
          <h5>Buy this</h5>
          <ProductFinder products={products} selected={d.bogo_buy} onPick={p => set('bogo_buy', p ? prod(p) : null)} placeholder="Search the product they buy…" />
          <h5 style={{ marginTop: 16 }}>Get this free</h5>
          <ProductFinder products={products} selected={d.bogo_get} onPick={p => set('bogo_get', p ? prod(p) : null)} placeholder="Search the free product…" />
          <div className="hint" style={{ marginTop: 10 }}>↳ {applicabilityHint('bogo')}</div>
        </div>
      )}

      {/* BUNDLE */}
      {d.offer_type === 'bundle' && (
        <div className="cfg">
          <h5>Bundle products <span className="hint-inline">(min 2)</span></h5>
          <ProductFinder products={products} multi selected={d.bnd_prods} onToggle={(p) => toggleInList('bnd_prods', d.bnd_prods, p)} placeholder="Search products to bundle…" />
          <div className="f" style={{ marginTop: 12, maxWidth: 220 }}><label className="flbl">Bundle price (₹)</label><input className="inp mono" value={d.bnd_price} onChange={e => set('bnd_price', e.target.value)} /></div>
          <div className="hint" style={{ marginTop: 6 }}>↳ {applicabilityHint('bundle')}</div>
        </div>
      )}

      {/* FREE GIFT */}
      {d.offer_type === 'free_gift' && (
        <div className="cfg">
          <h5>Free gift pairings</h5>
          {(d.gift_offers || []).map((go, gi) => (
            <div key={gi} style={{ borderTop: gi ? '1px dashed var(--border)' : 'none', paddingTop: gi ? 12 : 0, marginBottom: 12 }}>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <label className="flbl">Pairing {gi + 1}</label>
                {(d.gift_offers || []).length > 1 && <button className="xbtn" onClick={() => set('gift_offers', d.gift_offers.filter((_, i) => i !== gi))}>✕ remove</button>}
              </div>
              <label className="flbl" style={{ marginTop: 6 }}>When they buy</label>
              <ProductFinder products={products} selected={go.main} onPick={p => { const n = [...d.gift_offers]; n[gi] = { ...go, main: p ? prod(p) : null }; set('gift_offers', n); }} placeholder="Search the qualifying product…" />
              <label className="flbl" style={{ marginTop: 10 }}>Gift them</label>
              <ProductFinder products={products} selected={go.gift} onPick={p => { const n = [...d.gift_offers]; n[gi] = { ...go, gift: p ? prod(p) : null }; set('gift_offers', n); }} placeholder="Search the gift product…" />
            </div>
          ))}
          <button className="addbtn" onClick={() => set('gift_offers', [...(d.gift_offers || []), { main: null, gift: null }])}>+ Add gift pairing</button>
          <div className="hint" style={{ marginTop: 10 }}>↳ {applicabilityHint('free_gift')}</div>
        </div>
      )}

      {/* availing modes */}
      <h5 style={{ marginTop: 16 }}>Availing modes</h5>
      <div className="modes">
        {AVAILING_MODES.map(m => {
          const on = (d.availing_modes || []).includes(m.key);
          return (
            <button key={m.key} className={`mode${on ? ' on' : ''}`} onClick={() => set('availing_modes', on ? d.availing_modes.filter(x => x !== m.key) : [...(d.availing_modes || []), m.key])}>
              <span>{m.label}</span><span className="dot">{on ? '✓' : ''}</span>
            </button>
          );
        })}
      </div>

      <div className="preview"><span className="pl">Preview</span> {previewLine(d)}</div>
    </div>
  );
}

const OFB_CSS = `
.ofb{--yellow:#FFC107;--yellow-pale:#FFF7CC;--yellow-text:#6B5A00;--ink:#0A0A0A;--muted:#52525B;--muted-2:#71717A;--muted-3:#A1A1AA;--muted-4:#D4D4D8;--border:#E4E4E7;--bg:#FAFAFA;--bg2:#F4F4F5;font-family:'Plus Jakarta Sans','Outfit',system-ui,sans-serif;color:var(--ink)}
.ofb *{box-sizing:border-box}
.ofb .mono{font-family:'JetBrains Mono','Consolas',monospace}
.ofb .f{margin-bottom:14px}
.ofb .flbl{display:block;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.3px;color:var(--muted);margin-bottom:6px}
.ofb .inp{width:100%;font-size:13px;padding:10px 13px;border:1px solid var(--border);border-radius:10px;background:#fff;color:var(--ink);outline:none;font-family:inherit}
.ofb .inp:focus{border-color:var(--yellow);box-shadow:0 0 0 3px var(--yellow-pale)}
.ofb .typebar{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:4px}
.ofb .tcard{flex:1;min-width:90px;border:1px solid var(--border);border-radius:12px;padding:11px 8px;text-align:center;cursor:pointer;background:#fff;font-family:inherit}
.ofb .tcard:hover{border-color:var(--ink)}
.ofb .tcard.act{border-color:var(--ink);background:var(--ink);color:var(--yellow)}
.ofb .tcard .e{font-size:19px;display:block;margin-bottom:4px}
.ofb .tcard .t{font-size:11.5px;font-weight:800}
.ofb .cfg{border-top:1px dashed var(--border);margin-top:16px;padding-top:16px}
.ofb h5{font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.3px;color:var(--muted);margin-bottom:10px}
.ofb .hint-inline{font-weight:600;text-transform:none;letter-spacing:0;color:var(--muted-3)}
.ofb .row{display:flex;gap:8px;align-items:center}
.ofb .g2{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.ofb .tog{display:inline-flex;border:1px solid var(--border);border-radius:10px;overflow:hidden}
.ofb .tog button{padding:9px 15px;border:0;background:#fff;font-weight:800;cursor:pointer;font-size:13px;font-family:inherit}
.ofb .tog button.act{background:var(--ink);color:var(--yellow)}
.ofb .seg{display:inline-flex;gap:6px;flex-wrap:wrap}
.ofb .seg button{padding:7px 13px;border-radius:99px;border:1px solid var(--border);background:#fff;font-size:11.5px;font-weight:700;color:var(--muted);cursor:pointer;font-family:inherit}
.ofb .seg button.act{background:var(--ink);border-color:var(--ink);color:var(--yellow)}
.ofb .chips{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px}
.ofb .chip{display:inline-flex;align-items:center;gap:6px;padding:6px 10px;border:1px solid var(--border);border-radius:8px;background:var(--bg);font-size:12px;font-weight:700}
.ofb .chip .x{color:var(--muted-3);cursor:pointer;font-weight:800}
.ofb .addbtn{border:1px dashed var(--muted-4);background:#fff;color:var(--muted);border-radius:8px;padding:7px 12px;font-weight:700;font-size:12px;cursor:pointer;font-family:inherit}
.ofb .xbtn{border:1px solid var(--border);background:#fff;border-radius:8px;padding:0 10px;font-weight:800;color:var(--muted-2);cursor:pointer}
.ofb .hint{font-size:11.5px;color:var(--muted-2);margin-top:8px}
.ofb .modes{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.ofb .mode{display:flex;align-items:center;justify-content:space-between;padding:9px 12px;border:1px solid var(--border);border-radius:10px;background:#fff;font-size:12.5px;font-weight:600;cursor:pointer;font-family:inherit}
.ofb .mode.on{border-color:var(--ink);background:var(--yellow-pale)}
.ofb .mode .dot{width:18px;height:18px;border-radius:5px;border:1px solid var(--muted-4);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;color:var(--ink)}
.ofb .mode.on .dot{background:var(--ink);color:var(--yellow);border-color:var(--ink)}
.ofb .preview{margin-top:16px;background:var(--yellow-pale);border:1px solid var(--yellow);border-radius:10px;padding:11px 13px;font-size:13px;font-weight:700;color:var(--yellow-text)}
.ofb .preview .pl{font-family:'JetBrains Mono',monospace;font-size:9px;font-weight:800;text-transform:uppercase;background:var(--ink);color:var(--yellow);padding:2px 6px;border-radius:4px;margin-right:8px}
.ofb .finder{border:1px solid var(--border);border-radius:12px;margin-top:8px;overflow:hidden}
.ofb .fhead{padding:8px;border-bottom:1px solid var(--bg2)}
.ofb .flist{max-height:230px;overflow-y:auto}
.ofb .fgrp{font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.3px;color:var(--muted-3);padding:9px 11px 3px}
.ofb .fopt{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:9px 11px;border-top:1px solid #F7F7F5;cursor:pointer}
.ofb .fopt:hover{background:var(--bg)}
.ofb .fopt.on{background:var(--yellow-pale)}
.ofb .fnm{font-size:12.5px;font-weight:600}
.ofb .fpr{font-size:12px;color:var(--muted-2);font-family:'JetBrains Mono',monospace;white-space:nowrap}
.ofb .fempty{padding:14px 11px;font-size:12px;color:var(--muted-3)}
`;

export default OfferBuilder;
export { OfferBuilder, buildOfferConfig, emptyDraft, draftFromOffer, previewLine, OFFER_TYPES };
