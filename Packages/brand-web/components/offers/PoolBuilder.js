'use client';
// Step 4 — the product pool (O5, O5b). Contract: features/offer-builder-v2 · rules v1.4 §1.4, §1.7
//
// Left: add products four ways — category → all / tick / filters, or search (plus gift items for a
// free gift's gift pool). Right: the pool, each line listed, with how many were counted once and how
// many were locked and skipped. The server resolves every line; this screen only shows its answer.
import { useEffect, useMemo, useState, useCallback } from 'react';
import { brandApi } from '../../lib/api';
import { dayMonth, inr } from './offerFormat';
import GiftItemForm from './GiftItemForm';

export function findPath(nodes, id, trail = []) {
  for (const n of nodes || []) {
    if (n.id === id) return [...trail, n];
    const hit = findPath(n.children, id, [...trail, n]);
    if (hit) return hit;
  }
  return null;
}

function Locked({ l }) {
  return <span className="st lock">🔒 In &quot;{l.offer_name}&quot; until {dayMonth(l.until)}</span>;
}

export function ProductRow({ p, checked, onToggle, disabledReason }) {
  const locked = !!p.locked;
  const inPool = !!p.in_pool;
  return (
    <div className={'prow' + (locked ? ' locked' : '')}>
      <input type="checkbox" checked={!locked && (!!checked || inPool)} disabled={!onToggle || locked || inPool || !!disabledReason}
        onChange={() => onToggle && onToggle(p.id)} />
      {p.image_url
        // eslint-disable-next-line @next/next/no-img-element
        ? <img className="th" src={p.image_url} alt="" onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }} />
        : <span className="th" />}
      <div className="t"><b>{p.name}</b><span className="xs mut2">{inr(p.price)}{p.brand_label ? ` · ${p.brand_label}` : ''}{p.leaf_name ? ` · ${p.leaf_name}` : ''}</span></div>
      {locked && <Locked l={p.locked} />}
      {!locked && inPool && <span className="st live">In pool</span>}
    </div>
  );
}

export default function PoolBuilder({ view, onView, setError }) {
  const offer = view.offer;
  const isGiftOffer = offer.offer_type === 'free_gift';
  const isFixed = offer.sub_type === 'fixed';
  const [poolTab, setPoolTab] = useState('buy');                 // 'buy' | 'gift'
  const [method, setMethod] = useState(isFixed ? 'search' : 'browse'); // 'browse' | 'search' | 'gift_items'
  const [tree, setTree] = useState(null);
  const [node, setNode] = useState(null);
  const [mode, setMode] = useState('all');                       // 'all' | 'pick' | 'filter'
  const [opts, setOpts] = useState(null);
  const [filters, setFilters] = useState({ leaf_ids: [], brands: [], price_min: '', price_max: '' });
  const [q, setQ] = useState('');
  const [cands, setCands] = useState(null);
  const [gifts, setGifts] = useState(null);
  const [ticked, setTicked] = useState([]);
  const [busy, setBusy] = useState(false);
  const [newGift, setNewGift] = useState(false);
  const [seeAll, setSeeAll] = useState(false);

  const gift = poolTab === 'gift';
  // A gift pool is picked one by one (rules 1.7); a fixed bundle takes exact products by search.
  const modesAllowed = gift ? ['pick'] : ['all', 'pick', 'filter'];

  useEffect(() => {
    brandApi.get('/brands/me/listing-tree').then((r) => { if (r.success) setTree(r.data.tree || []); });
  }, []);
  useEffect(() => { if (!modesAllowed.includes(mode)) setMode(modesAllowed[0]); }, [poolTab]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setTicked([]); }, [node, mode, poolTab, method]);

  // Candidates for the left side.
  const loadCands = useCallback(async () => {
    if (method === 'gift_items') {
      const r = await brandApi.offerCandidates(offer.id, { kind: 'gift_items' });
      setGifts(r.success ? r.data.gift_items : []);
      return;
    }
    const params = {};
    if (method === 'search') { if (!q.trim()) { setCands(null); return; } params.q = q.trim(); }
    else {
      if (!node) { setCands(null); return; }
      params.node = node.id;
      if (mode === 'filter') {
        if (filters.leaf_ids.length) params.leaf_ids = filters.leaf_ids.join(',');
        if (filters.brands.length) params.brands = filters.brands.join(',');
        if (filters.price_min !== '') params.price_min = filters.price_min;
        if (filters.price_max !== '') params.price_max = filters.price_max;
      }
    }
    const r = await brandApi.offerCandidates(offer.id, params);
    setCands(r.success ? r.data.products : []);
  }, [method, q, node, mode, filters, offer.id]);
  useEffect(() => { const t = setTimeout(loadCands, method === 'search' ? 300 : 0); return () => clearTimeout(t); }, [loadCands, method]);

  useEffect(() => {
    if (!node || mode !== 'filter') return;
    brandApi.offerFilterOptions(node.id).then((r) => setOpts(r.success ? r.data : null));
  }, [node, mode]);

  const children = useMemo(() => {
    const list = node ? (node.children || []) : (tree || []);
    return list.filter((n) => (n.product_count || 0) > 0);
  }, [node, tree]);
  const path = node && tree ? (findPath(tree, node.id) || [node]) : [];

  const addable = (cands || []).filter((p) => !p.locked && !p.in_pool);
  const lockedN = (cands || []).filter((p) => p.locked).length;

  async function add(line) {
    if (busy) return;
    setBusy(true); setError('');
    const r = await brandApi.addOfferSource(offer.id, { pool: poolTab, ...line });
    setBusy(false);
    if (!r.success) { setError(r.error?.message || 'Couldn\'t add those products.'); return; }
    onView(r.data);
    setTicked([]);
    loadCands();
  }
  async function removeLine(id) {
    const r = await brandApi.removeOfferSource(offer.id, id);
    if (r.success) { onView(r.data); loadCands(); } else setError(r.error?.message || 'Couldn\'t remove that line.');
  }
  async function patch(body) {
    const r = await brandApi.updateOffer(offer.id, body);
    if (r.success) onView(r.data); else setError(r.error?.message || 'Couldn\'t save that.');
  }
  const excludeProduct = (id) => patch({ excluded_product_ids: [...(offer.excluded_product_ids || []), id] });

  const cfg = offer.offer_config_json || {};
  const setQty = (id, v) => patch({ offer_config_json: { ...cfg, quantities: { ...(cfg.quantities || {}), [id]: Number(v) || 1 } } });
  const setLimit = (id, v) => patch({ offer_config_json: { ...cfg, gift_limits: { ...(cfg.gift_limits || {}), [id]: v === '' ? null : Number(v) } } });

  const toggle = (id) => setTicked((t) => (t.includes(id) ? t.filter((x) => x !== id) : [...t, id]));
  const sources = (view.pool.sources || []).filter((s) => s.pool === poolTab);
  const inPool = gift ? view.pool.gift : view.pool.buy;
  const lockedInPool = (view.pool.locked || []).length;
  const fixedTotal = isFixed ? view.pool.buy.reduce((s, p) => s + Number(p.price || 0) * ((cfg.quantities || {})[p.id] || 1), 0) : 0;
  const canAutoAdd = !gift && !isFixed && sources.some((s) => s.can_auto_add);

  const filterChips = () => {
    const f = filters;
    const chips = [];
    for (const id of f.leaf_ids) { const n = (opts?.sub_categories || []).find((x) => x.id === id); chips.push([`leaf:${id}`, n ? n.name : 'Sub-category', () => setFilters({ ...f, leaf_ids: f.leaf_ids.filter((x) => x !== id) })]); }
    for (const b of f.brands) chips.push([`b:${b}`, `Brand: ${b}`, () => setFilters({ ...f, brands: f.brands.filter((x) => x !== b) })]);
    if (f.price_min !== '' || f.price_max !== '') chips.push(['price', `Price ${f.price_min !== '' ? inr(f.price_min) : '…'} – ${f.price_max !== '' ? inr(f.price_max) : '…'}`, () => setFilters({ ...f, price_min: '', price_max: '' })]);
    return chips;
  };
  const hasFilter = filters.leaf_ids.length || filters.brands.length || filters.price_min !== '' || filters.price_max !== '';

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      {isGiftOffer && (
        <div className="mtabs">
          <button className={poolTab === 'buy' ? 'act' : ''} onClick={() => { setPoolTab('buy'); setMethod('browse'); }}>① Buy pool <span className="mono">{view.pool.counts.buy}</span></button>
          <button className={poolTab === 'gift' ? 'act' : ''} onClick={() => { setPoolTab('gift'); setMethod('gift_items'); }}>② Gift pool <span className="mono">{view.pool.counts.gift}</span></button>
        </div>
      )}
      <div className="pool">
        <div className="method">
          <div className="mtabs">
            {!isFixed && <button className={method === 'browse' ? 'act' : ''} onClick={() => setMethod('browse')}>Browse by category</button>}
            <button className={method === 'search' ? 'act' : ''} onClick={() => setMethod('search')}>Search products</button>
            {gift && <button className={method === 'gift_items' ? 'act' : ''} onClick={() => setMethod('gift_items')}>Gift items</button>}
          </div>

          {method === 'browse' && (
            <>
              <div className="crumb">
                <button onClick={() => setNode(null)}>All categories</button>
                {path.map((n, i) => (
                  <span key={n.id} className="row" style={{ gap: 4 }}>›{i === path.length - 1 ? <b>{n.name}</b> : <button onClick={() => setNode(n)}>{n.name}</button>}</span>
                ))}
                {node && <span className="mut2">· {node.product_count || 0} products</span>}
              </div>
              {!tree && <div className="skel" />}
              {children.length > 0 && (
                <div className="plist" style={{ maxHeight: 190 }}>
                  {children.map((n) => (
                    <div key={n.id} className="prow node" onClick={() => setNode(n)}>
                      <div className="t"><b>{n.name}</b><span className="xs mut2">{n.product_count} products</span></div><span className="mut2">›</span>
                    </div>
                  ))}
                </div>
              )}
              {tree && !node && children.length === 0 && <div className="hint">You have no products listed yet.</div>}
              {node && (
                <>
                  <div className="row wrapx" style={{ gap: 6 }}>
                    {modesAllowed.includes('all') && <button className={'chip' + (mode === 'all' ? ' act' : '')} onClick={() => setMode('all')}>All {node.product_count} products</button>}
                    <button className={'chip' + (mode === 'pick' ? ' act' : '')} onClick={() => setMode('pick')}>Tick specific products</button>
                    {modesAllowed.includes('filter') && <button className={'chip' + (mode === 'filter' ? ' act' : '')} onClick={() => setMode('filter')}>Use filters</button>}
                  </div>
                  {mode === 'filter' && (
                    <div className="card tint">
                      <div className="row wrapx" style={{ gap: 6 }}><span className="lbl">Filters</span><span className="hint">all must match</span></div>
                      <div className="row wrapx" style={{ gap: 6 }}>
                        {filterChips().map(([k, label, off], i) => (
                          <span key={k} className="row" style={{ gap: 4 }}>
                            {i > 0 && <span className="andpill">AND</span>}
                            <button className="chip act" onClick={off}>{label} ✕</button>
                          </span>
                        ))}
                      </div>
                      {opts && (
                        <>
                          {opts.sub_categories.length > 0 && (
                            <div className="row wrapx" style={{ gap: 6 }}><span className="xs mut2">Sub-category</span>
                              {opts.sub_categories.map((s) => (
                                <button key={s.id} className={'chip' + (filters.leaf_ids.includes(s.id) ? ' act' : '')}
                                  onClick={() => setFilters((f) => ({ ...f, leaf_ids: f.leaf_ids.includes(s.id) ? f.leaf_ids.filter((x) => x !== s.id) : [...f.leaf_ids, s.id] }))}>{s.name}</button>
                              ))}</div>
                          )}
                          {opts.brands.length > 0 && (
                            <div className="row wrapx" style={{ gap: 6 }}><span className="xs mut2">Brand</span>
                              {opts.brands.map((b) => (
                                <button key={b} className={'chip' + (filters.brands.includes(b) ? ' act' : '')}
                                  onClick={() => setFilters((f) => ({ ...f, brands: f.brands.includes(b) ? f.brands.filter((x) => x !== b) : [...f.brands, b] }))}>{b}</button>
                              ))}</div>
                          )}
                          <div className="row wrapx" style={{ gap: 6 }}><span className="xs mut2">Price range</span>
                            <input className="inp" style={{ width: 96 }} type="number" min="0" placeholder={opts.price.min != null ? `from ${opts.price.min}` : 'from'} value={filters.price_min} onChange={(e) => setFilters((f) => ({ ...f, price_min: e.target.value }))} />
                            <span>–</span>
                            <input className="inp" style={{ width: 96 }} type="number" min="0" placeholder={opts.price.max != null ? `to ${opts.price.max}` : 'to'} value={filters.price_max} onChange={(e) => setFilters((f) => ({ ...f, price_max: e.target.value }))} />
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </>
              )}
            </>
          )}

          {method === 'search' && (
            <input className="inp" placeholder="Product name or SKU, e.g. Levi's 511" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
          )}

          {method !== 'gift_items' && cands && (
            <>
              <div className="plist">
                {cands.length === 0 && <div className="prow"><span className="hint">No published products match.</span></div>}
                {cands.map((p) => (
                  <ProductRow key={p.id} p={p}
                    checked={method === 'browse' && (mode === 'all' || mode === 'filter') ? !p.locked : ticked.includes(p.id)}
                    onToggle={method === 'search' || mode === 'pick' ? toggle : null} />
                ))}
              </div>
              {method === 'browse' && mode === 'all' && (
                <div className="row between"><span className="hint">{addable.length} to add{lockedN ? ` · ${lockedN} locked and skipped` : ''}</span>
                  <button className="btn btn-ink btn-sm" disabled={busy || !addable.length} onClick={() => add({ method: 'category_all', category_node_id: node.id })}>Add {addable.length} to pool</button></div>
              )}
              {method === 'browse' && mode === 'filter' && (
                <div className="row between"><span className="hint">{(cands || []).length} match{lockedN ? ` · ${lockedN} locked and skipped` : ''}</span>
                  <button className="btn btn-ink btn-sm" disabled={busy || !hasFilter || !addable.length}
                    onClick={() => add({ method: 'category_filter', category_node_id: node.id, filters: { ...filters, price_min: filters.price_min === '' ? null : Number(filters.price_min), price_max: filters.price_max === '' ? null : Number(filters.price_max) } })}>Add {addable.length} to pool</button></div>
              )}
              {(method === 'search' || mode === 'pick') && (
                <div className="row between"><span className="hint">{ticked.length} ticked{lockedN ? ` · locked products can't be ticked` : ''}</span>
                  <button className="btn btn-ink btn-sm" disabled={busy || !ticked.length}
                    onClick={() => add(method === 'search'
                      ? { method: 'search', query: q.trim(), product_ids: ticked }
                      : { method: 'category_pick', category_node_id: node.id, product_ids: ticked })}>Add {ticked.length} to pool</button></div>
              )}
            </>
          )}

          {method === 'gift_items' && (
            <>
              <div className="row between"><span className="hint">Your gift items from Listings → Gift items. Never sold, only given.</span>
                <button className="btn btn-ghost btn-sm" onClick={() => setNewGift(true)}>+ New gift item</button></div>
              {newGift && <GiftItemForm onSaved={() => { setNewGift(false); loadCands(); }} onCancel={() => setNewGift(false)} />}
              <div className="plist">
                {gifts && gifts.length === 0 && <div className="prow"><span className="hint">No gift items yet. Add one with &quot;+ New gift item&quot;.</span></div>}
                {(gifts || []).map((g) => {
                  const inGift = view.pool.gift.some((x) => x.kind === 'gift_item' && x.id === g.id);
                  return (
                    <div key={g.id} className={'prow' + (g.locked ? ' locked' : '')}>
                      <input type="checkbox" disabled={!!g.locked || inGift} checked={inGift || ticked.includes(g.id)} onChange={() => toggle(g.id)} />
                      {g.photo_url
                        // eslint-disable-next-line @next/next/no-img-element
                        ? <img className="th" src={g.photo_url} alt="" /> : <span className="th" />}
                      <div className="t"><b>{g.name}</b><span className="xs mut2">Value {inr(g.value)} · {g.stock} in stock</span></div>
                      {g.locked ? <Locked l={g.locked} /> : <span className="st scheduled">Gift item</span>}
                    </div>
                  );
                })}
              </div>
              <div className="row between"><span className="hint">{ticked.length} ticked</span>
                <button className="btn btn-ink btn-sm" disabled={busy || !ticked.length} onClick={() => add({ method: 'gift_items', gift_item_ids: ticked })}>Add {ticked.length} to gift pool</button></div>
            </>
          )}

          {!gift && !isFixed && method === 'browse' && node && mode !== 'pick' && (
            <label className="row sm" style={{ gap: 8, marginTop: 4 }}>
              <input type="checkbox" checked={!!offer.auto_add} onChange={(e) => patch({ auto_add: e.target.checked })} />
              <span><b>Auto-add new products</b> that match category lines in future <span className="mut2">(off by default · locked products are skipped)</span></span>
            </label>
          )}
        </div>

        <div className="tray">
          <div className="row between"><span className="lbl">{gift ? 'Gift pool' : 'Your pool'}</span><span className="xs mut2">frozen when you publish</span></div>
          <div className="row" style={{ gap: 10, alignItems: 'flex-end' }}>
            <span className="n">{inPool.length}</span>
            <span className="sm mut">{gift ? `gift${inPool.length === 1 ? '' : 's'}${inPool.length > 1 ? ' · the shopper chooses' : ''}` : 'products · every size and colour included'}</span>
          </div>
          {sources.length === 0 && <div className="hint">Nothing added yet.</div>}
          {sources.map((s, i) => (
            <div key={s.id}>
              {i > 0 && <div className="or">— OR —</div>}
              <div className="srcrow"><div><b>{s.label}</b><div className="xs mut2">{s.detail}</div></div>
                <button className="x" title="Remove this line" onClick={() => removeLine(s.id)}>✕</button></div>
            </div>
          ))}
          {!gift && (view.pool.duplicates > 0 || lockedInPool > 0 || view.pool.excluded > 0) && (
            <div className="card tint" style={{ gap: 4 }}>
              <span className="xs">{[view.pool.duplicates ? `${view.pool.duplicates} duplicate${view.pool.duplicates > 1 ? 's' : ''} removed.` : null,
                lockedInPool ? `${lockedInPool} locked product${lockedInPool > 1 ? 's' : ''} skipped.` : null,
                view.pool.excluded ? `${view.pool.excluded} taken out by you.` : null].filter(Boolean).join(' ')}</span>
              <span className="xs mut2">Price range uses each product&apos;s price.</span>
            </div>
          )}
          {(view.pool.conflicts || []).length > 0 && (
            <div className="card nobox" style={{ gap: 3 }}>
              {view.pool.conflicts.map((c) => <span key={c.id} className="xs">🔒 &quot;{c.name}&quot; is now in &quot;{c.offer_name}&quot; until {dayMonth(c.ends_on)}. Remove its line or change the dates.</span>)}
            </div>
          )}
          {isFixed && view.pool.buy.length > 0 && (
            <div className="row between"><span className="sm">Total price of the items</span><b className="mono">{inr(fixedTotal)}</b></div>
          )}
          {gift && view.pool.gift.length > 0 && (
            <div className="plist">
              {view.pool.gift.map((g) => (
                <div key={g.kind + g.id} className="prow">
                  <div className="t"><b>{g.name}</b><span className="xs mut2">{g.kind === 'gift_item' ? `Gift-only · ${inr(g.value)} · stock ${g.stock}` : `Store product · ${inr(g.value)}`}</span></div>
                  {g.kind === 'product' && (
                    <label className="row xs">limit <input className={'inp' + ((cfg.gift_limits || {})[g.id] ? '' : ' err')} style={{ width: 64 }} type="number" min="1"
                      defaultValue={(cfg.gift_limits || {})[g.id] || ''} onBlur={(e) => setLimit(g.id, e.target.value)} /></label>
                  )}
                </div>
              ))}
            </div>
          )}
          {gift && <div className="card tint" style={{ gap: 3 }}><span className="xs"><b>Store products used as gifts need a gift stock limit.</b></span><span className="xs mut2">A product can&apos;t be in both the buy pool and the gift pool. Gift products are locked too.</span></div>}
          {!gift && view.pool.buy.length > 0 && (
            <button className="btn btn-ghost btn-sm" style={{ justifySelf: 'start' }} onClick={() => setSeeAll((s) => !s)}>{seeAll ? 'Hide the list' : `See all ${view.pool.buy.length} products`}</button>
          )}
          {!gift && (seeAll || isFixed) && view.pool.buy.length > 0 && (
            <div className="plist">
              {view.pool.buy.map((p) => (
                <div key={p.id} className="prow">
                  <div className="t"><b>{p.name}</b><span className="xs mut2">{inr(p.price)}{p.leaf_name ? ` · ${p.leaf_name}` : ''}</span></div>
                  {isFixed && <label className="row xs">Qty <input className="inp" style={{ width: 56 }} type="number" min="1" defaultValue={(cfg.quantities || {})[p.id] || 1} onBlur={(e) => setQty(p.id, e.target.value)} /></label>}
                  <button className="btn btn-ghost btn-sm" title="Take out of the pool" onClick={() => excludeProduct(p.id)}>✕</button>
                </div>
              ))}
            </div>
          )}
          {canAutoAdd && <div className="xs mut2">New products: {offer.auto_add ? 'added automatically from category lines' : 'not added automatically'}</div>}
        </div>
      </div>
      {offer.sub_type === 'pick_any' && !gift && <div className="hint">Pick-any bundles take products from one category. For several categories, go back and choose Mix &amp; match.</div>}
    </div>
  );
}
