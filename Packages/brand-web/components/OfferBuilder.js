'use client';

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

function OfferBuilder({ draft, setDraft, products = [], sections = [] }) {
  const d = draft;
  const set = (field, value) => setDraft({ ...d, [field]: value });
  const findProd = (id) => products.find(p => String(p.id) === String(id)) || null;

  // single-product <select>
  const SingleSelect = ({ value, onPick, placeholder }) => (
    <select className="inp" value={value?.id || ''} onChange={e => onPick(findProd(e.target.value))}>
      <option value="">{placeholder}</option>
      {products.map(p => <option key={p.id} value={p.id}>{p.name} · ₹{p.price}</option>)}
    </select>
  );

  // multi-product picker (chips + add select)
  const MultiPicker = ({ list, field }) => (
    <div>
      <div className="chips">
        {(list || []).map((p, i) => (
          <span key={p.id || i} className="chip">{p.name}<span className="x" onClick={() => set(field, list.filter((_, j) => j !== i))}>✕</span></span>
        ))}
      </div>
      <select className="inp" value="" onChange={e => { const p = findProd(e.target.value); if (p && !list.some(x => String(x.id) === String(p.id))) set(field, [...(list || []), p]); }}>
        <option value="">+ Add product…</option>
        {products.map(p => <option key={p.id} value={p.id}>{p.name} · ₹{p.price}</option>)}
      </select>
    </div>
  );

  const ScopeToggle = ({ scopeField, catField, scopeVal, catVal, prodsField, prodsVal }) => (
    <>
      <div className="seg">
        {['store', 'category', 'products'].map(s => (
          <button key={s} className={scopeVal === s ? 'act' : ''} onClick={() => set(scopeField, s)}>
            {s === 'store' ? 'Whole store' : s === 'category' ? 'Category' : 'Products'}
          </button>
        ))}
      </div>
      {scopeVal === 'category' && (
        sections.length > 0
          ? <select className="inp" style={{ marginTop: 8 }} value={catVal || ''} onChange={e => set(catField, e.target.value)}>
              <option value="">Pick a section</option>
              {sections.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          : <div className="hint">Add products with sections to enable category filtering.</div>
      )}
      {scopeVal === 'products' && (
        products.length > 0 ? <div style={{ marginTop: 8 }}><MultiPicker list={prodsVal} field={prodsField} /></div>
          : <div className="hint">Add products to your catalogue first.</div>
      )}
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

      {/* DISCOUNT */}
      {d.offer_type === 'discount' && (
        <div className="cfg">
          <h5>Discount value</h5>
          <div className="row">
            <div className="tog"><button className={d.d_sub === 'pct' ? 'act' : ''} onClick={() => set('d_sub', 'pct')}>%</button><button className={d.d_sub === 'flat' ? 'act' : ''} onClick={() => set('d_sub', 'flat')}>₹</button></div>
            <input className="inp mono" style={{ flex: 1 }} value={d.d_val} onChange={e => set('d_val', e.target.value)} />
          </div>
          <h5 style={{ marginTop: 14 }}>Applies to</h5>
          <ScopeToggle scopeField="d_scope" catField="d_category" scopeVal={d.d_scope} catVal={d.d_category} prodsField="d_prods" prodsVal={d.d_prods} />
        </div>
      )}

      {/* VOLUME */}
      {d.offer_type === 'volume' && (
        <div className="cfg">
          <h5>Spend tiers</h5>
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
          <h5 style={{ marginTop: 14 }}>Applies to</h5>
          <ScopeToggle scopeField="v_scope" catField="v_category" scopeVal={d.v_scope} catVal={d.v_category} prodsField="v_prods" prodsVal={d.v_prods} />
        </div>
      )}

      {/* BOGO */}
      {d.offer_type === 'bogo' && (
        <div className="cfg">
          <h5>Buy one, get one</h5>
          <div className="g2">
            <div className="f"><label className="flbl">Buy this</label><SingleSelect value={d.bogo_buy} onPick={p => set('bogo_buy', p)} placeholder="Pick buy product" /></div>
            <div className="f"><label className="flbl">Get this free</label><SingleSelect value={d.bogo_get} onPick={p => set('bogo_get', p)} placeholder="Pick free product" /></div>
          </div>
        </div>
      )}

      {/* BUNDLE */}
      {d.offer_type === 'bundle' && (
        <div className="cfg">
          <h5>Bundle products <span className="hint-inline">(min 2)</span></h5>
          {products.length > 0 ? <MultiPicker list={d.bnd_prods} field="bnd_prods" /> : <div className="hint">Add products to your catalogue first.</div>}
          <div className="f" style={{ marginTop: 12, maxWidth: 220 }}><label className="flbl">Bundle price (₹)</label><input className="inp mono" value={d.bnd_price} onChange={e => set('bnd_price', e.target.value)} /></div>
        </div>
      )}

      {/* FREE GIFT */}
      {d.offer_type === 'free_gift' && (
        <div className="cfg">
          <h5>Free gift pairings</h5>
          {(d.gift_offers || []).map((go, gi) => (
            <div key={gi} className="g2">
              <div className="f"><label className="flbl">When they buy</label><SingleSelect value={go.main} onPick={p => { const n = [...d.gift_offers]; n[gi] = { ...go, main: p }; set('gift_offers', n); }} placeholder="Pick main product" /></div>
              <div className="f"><label className="flbl">Gift them</label><div className="row">
                <SingleSelect value={go.gift} onPick={p => { const n = [...d.gift_offers]; n[gi] = { ...go, gift: p }; set('gift_offers', n); }} placeholder="Pick gift" />
                {(d.gift_offers || []).length > 1 && <button className="xbtn" onClick={() => set('gift_offers', d.gift_offers.filter((_, i) => i !== gi))}>✕</button>}
              </div></div>
            </div>
          ))}
          <button className="addbtn" onClick={() => set('gift_offers', [...(d.gift_offers || []), { main: null, gift: null }])}>+ Add gift pairing</button>
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
`;

export default OfferBuilder;
export { OfferBuilder, buildOfferConfig, emptyDraft, draftFromOffer, previewLine, OFFER_TYPES };
