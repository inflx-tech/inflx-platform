'use client';

/**
 * InventoryBrowser — the Inventory pane of the Listings workspace.
 * Contract: listing-workspace-ux (supersedes the row-list from
 * listing-fashion-inventory-browse; the endpoints are unchanged).
 *
 * Three panes: category tree · product table · stats + filters.
 *
 * Node browse is RECURSIVE server-side (getMyNodeProducts uses WITH RECURSIVE),
 * so selecting a branch lists everything beneath it — not just a single leaf.
 * It returns ALL statuses, live-first (contract:
 * backend-defect-inventory-hidden-products), so Hide/Show round-trips properly
 * here and hidden rows stay visible and filterable.
 */

import { useEffect, useState, useCallback } from 'react';
import { brandApi, listingApi } from '../../../../lib/api';
import CategoryTree from './CategoryTree';
import PriceChangeDialog, { priceImpacts } from '../../../../components/offers/PriceChangeDialog';
import { dayMonth, span, addDays } from '../../../../components/offers/offerFormat';

const nextDay = (d) => addDays(d, 1);

const money = (v) => (v == null || v === '' ? '—' : '₹' + Number(v).toLocaleString('en-IN'));

// Turn a per-product server response into one honest sentence. Refused rows are
// NAMED with their reason — never folded into a bare success count.
function describeOutcome(base, skipped) {
  if (!skipped || !skipped.length) return base + '.';
  const detail = skipped.slice(0, 3)
    .map((s) => `${s.name ? `"${s.name}"` : 'One product'} — ${s.reason}`)
    .join(' · ');
  const more = skipped.length > 3 ? ` …and ${skipped.length - 3} more.` : '';
  return `${base}. ${skipped.length} skipped: ${detail}${more}`;
}

function facetSummary(facets) {
  if (!facets || typeof facets !== 'object') return '';
  const bits = [];
  for (const k of Object.keys(facets)) {
    if (k === 'brand' || k === '_images') continue;
    const v = facets[k];
    const vals = Array.isArray(v) ? v : (v ? [v] : []);
    if (vals.length) bits.push(vals.slice(0, 3).join(', '));
    if (bits.length >= 3) break;
  }
  return bits.join(' · ');
}

function colorsOf(p) {
  let vj = p.variants_json;
  if (typeof vj === 'string') { try { vj = JSON.parse(vj || '{}'); } catch { vj = {}; } }
  const colors = (vj && Array.isArray(vj.colors)) ? vj.colors : [];
  const sizes = colors.reduce((a, c) => a + (Array.isArray(c.sizes) ? c.sizes.length : 0), 0);
  return { names: colors.map(c => c.color).filter(Boolean), sizes };
}

// Best-effort CSS colour for a swatch; unknown names fall back to a neutral chip.
const SWATCH = {
  white: '#fff', black: '#0A0A0A', navy: '#1e3a5f', blue: '#2563eb', 'sky blue': '#87CEEB',
  red: '#dc2626', green: '#16a34a', grey: '#9ca3af', gray: '#9ca3af', beige: '#e8ddc8',
  brown: '#7c4a21', pink: '#f472b6', yellow: '#FFC107', orange: '#f97316', purple: '#7E22CE',
  maroon: '#7f1d1d', cream: '#f5efe0', olive: '#6b7a3a', lavender: '#c4b5fd', teal: '#0d9488',
};
const swatchFor = (name) => SWATCH[String(name || '').trim().toLowerCase()] || '#D4D4D8';

export default function InventoryBrowser({ vlabel, onAdd, onEditCategory, search }) {
  const [tree, setTree] = useState(null);
  const [treeLoading, setTreeLoading] = useState(true);
  const [sel, setSel] = useState(null);            // null = "All products"
  const [products, setProducts] = useState([]);
  const [pLoading, setPLoading] = useState(false);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState('');
  const [picked, setPicked] = useState([]);        // selected product ids
  const [bulkBusy, setBulkBusy] = useState(false);
  const [fStatus, setFStatus] = useState([]);      // [] = no stock filter
  const [fVis, setFVis] = useState([]);            // [] = live + hidden
  const [fBrands, setFBrands] = useState([]);
  // Bulk move (contract: listing-bulk-move-and-offer). The bulk "Attach offer" is retired
  // (offer-builder-v2, rules 1.13): products join offers only through the pool builder.
  const [modal, setModal] = useState(null);        // 'move' | null
  const [moveTarget, setMoveTarget] = useState(null);
  const [modalBusy, setModalBusy] = useState(false);
  // offer-builder-v2 (O9): the offer each product is in now / next, and one product's panel.
  const [offerOf, setOfferOf] = useState({});
  const [focus, setFocus] = useState(null);        // { product, panel }
  const [priceWarn, setPriceWarn] = useState(null); // O12 before a bulk price change

  useEffect(() => {
    (async () => {
      const r = await brandApi.get('/brands/me/listing-tree');
      setTreeLoading(false);
      if (r.success) setTree(r.data.tree || []);
      else setErr(r.error?.message || 'Failed to load your listings');
    })();
  }, []);

  const loadAll = useCallback(async () => {
    setPLoading(true); setErr('');
    const r = await brandApi.getProducts();
    setPLoading(false);
    if (r.success) setProducts(r.data.products || []);
    else setErr(r.error?.message || 'Failed to load products');
  }, []);

  const loadNode = useCallback(async (node) => {
    setPLoading(true); setErr('');
    const r = await brandApi.get(`/brands/me/listing-nodes/${node.id}/products`);
    setPLoading(false);
    if (r.success) setProducts(r.data.products || []);
    else setErr(r.error?.message || 'Failed to load products');
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  // offer-builder-v2 (O9): which offer each product is in now, and the next one booked.
  const loadOffers = useCallback(async () => {
    const r = await brandApi.productOffers();
    if (r.success) setOfferOf(r.data.products || {});
  }, []);
  useEffect(() => { loadOffers(); }, [loadOffers]);
  const openPanel = async (p) => {
    setFocus({ product: p, panel: null });
    const r = await brandApi.productOfferPanel(p.id);
    setFocus((f) => (f && f.product.id === p.id ? { product: p, panel: r.success ? r.data : { now: null, next: null } } : f));
  };

  const select = (node) => {
    setSel(node); setPicked([]); setMsg('');
    if (node) loadNode(node); else loadAll();
  };
  const refresh = () => { if (sel) loadNode(sel); else loadAll(); loadOffers(); };

  // ── row actions (unchanged endpoints) ──────────────────────────────────────
  const doToggle = async (p) => {
    setBusy(p.id); setMsg('');
    const r = await brandApi.updateProduct(p.id, { is_active: !p.is_active });
    setBusy('');
    if (!r.success) { setErr(r.error?.message || 'Update failed'); return; }
    refresh();
  };
  const doRemove = async (p) => {
    if (!window.confirm(`Remove "${p.name}" from your listing?`)) return;
    setBusy(p.id);
    const r = await brandApi.deleteProduct(p.id);
    setBusy('');
    if (r.success) refresh(); else setErr(r.error?.message || 'Remove failed');
  };

  // ── bulk actions — loop the existing per-product endpoints ─────────────────
  // No bulk endpoint exists, so this is N requests and NOT transactional. We
  // report exactly how many succeeded and how many failed; never assume success.
  const runBulk = async (label, fn) => {
    const targets = rows.filter(p => picked.includes(p.id));
    if (!targets.length) return;
    setBulkBusy(true); setErr(''); setMsg('');
    let ok = 0; const failed = [];
    for (const p of targets) {
      // eslint-disable-next-line no-await-in-loop
      const r = await fn(p);
      if (r?.success) ok += 1; else failed.push(p.name);
    }
    setBulkBusy(false); setPicked([]);
    setMsg(failed.length
      ? `${label}: ${ok} updated, ${failed.length} failed — ${failed.slice(0, 3).join(', ')}${failed.length > 3 ? '…' : ''}`
      : `${label}: ${ok} product${ok === 1 ? '' : 's'} updated.`);
    refresh();
  };
  const bulkActive = (is_active) => runBulk(is_active ? 'Shown' : 'Hidden',
    (p) => brandApi.updateProduct(p.id, { is_active }));
  const bulkRemove = () => {
    const n = picked.length;
    if (!window.confirm(`Remove ${n} product${n === 1 ? '' : 's'} from your listing? This can't be undone.`)) return;
    return runBulk('Removed', (p) => brandApi.deleteProduct(p.id));
  };
  // offer-builder-v2 (O12, rules 1.11): products in a live or scheduled offer are warned about
  // before the new price is saved. Nothing is blocked; their creators are told after the save.
  const bulkPrice = async () => {
    const raw = window.prompt(`New price (₹) for ${picked.length} selected product(s):`);
    if (raw == null) return;
    const price = Number(String(raw).trim());
    if (!Number.isFinite(price) || price <= 0) { setErr('Enter a price above ₹0.'); return; }
    const targets = rows.filter((p) => picked.includes(p.id));
    setBulkBusy(true);
    const hits = await priceImpacts(targets.map((p) => ({ id: p.id, price, old: p.price })));
    setBulkBusy(false);
    if (hits.length) { setPriceWarn({ impacts: hits, price }); return; }
    return runBulk('Price updated', (p) => brandApi.updateProduct(p.id, { price }));
  };
  const confirmBulkPrice = async () => {
    const { price } = priceWarn;
    setPriceWarn(null);
    await runBulk('Price updated', (p) => brandApi.updateProduct(p.id, { price }));
  };

  // ── bulk move ─────────────────────────────────────────────────────
  // Both endpoints answer per product. We report exactly what the server said,
  // including which rows it refused and why — a bulk action that quietly drops
  // rows is worse than one that names them.
  const openMove = () => { setMoveTarget(null); setModal('move'); };
  const doMove = async () => {
    if (!moveTarget) return;
    setModalBusy(true); setErr(''); setMsg('');
    const r = await listingApi.moveProducts(picked, moveTarget.id);
    setModalBusy(false);
    if (!r.ok) { setErr(r.error?.message || 'Move failed'); return; }
    const { moved_count: n, skipped = [] } = r.data;
    setMsg(describeOutcome(`${n} product${n === 1 ? '' : 's'} moved to ${moveTarget.name}`, skipped));
    setModal(null); setPicked([]);
    // The tree's per-node counts changed on both sides of the move.
    const t = await brandApi.get('/brands/me/listing-tree');
    if (t.success) setTree(t.data.tree || []);
    refresh();
  };

  // ── derived ────────────────────────────────────────────────────────────────
  const q = String(search || '').trim().toLowerCase();
  const brandOf = (p) => (p.facets && p.facets.brand) || '';
  const stockState = (p) => (p.stock == null ? 'none' : p.stock <= 0 ? 'out' : p.stock <= 5 ? 'low' : 'ok');

  let rows = products;
  if (q) rows = rows.filter(p => (p.name || '').toLowerCase().includes(q) || (p.sku || '').toLowerCase().includes(q));
  if (fStatus.length) rows = rows.filter(p => fStatus.includes(stockState(p) === 'ok' || stockState(p) === 'none' ? 'ok' : stockState(p)));
  if (fVis.length) rows = rows.filter(p => fVis.includes(p.is_active ? 'live' : 'hidden'));
  if (fBrands.length) rows = rows.filter(p => fBrands.includes(brandOf(p)));

  const brandCounts = products.reduce((m, p) => {
    const b = brandOf(p); if (b) m[b] = (m[b] || 0) + 1; return m;
  }, {});
  const topBrands = Object.entries(brandCounts).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const lowN = products.filter(p => stockState(p) === 'low').length;
  const outN = products.filter(p => stockState(p) === 'out').length;
  const liveN = products.filter(p => p.is_active).length;
  const avg = products.length
    ? Math.round(products.reduce((a, p) => a + (Number(p.price) || 0), 0) / products.length) : 0;

  const toggleIn = (list, setList, v) =>
    setList(list.includes(v) ? list.filter(x => x !== v) : [...list, v]);
  const allPicked = rows.length > 0 && picked.length === rows.length;

  const total = (tree || []).reduce((a, n) => a + (n.product_count || 0), 0);

  if (!treeLoading && total === 0 && !products.length) {
    return (
      <div className="empty2">
        <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 4 }}>No {vlabel.toLowerCase()} products listed yet</div>
        <div className="sub" style={{ marginBottom: 12 }}>Once you add products they&apos;ll show here, organised by the category you listed under.</div>
        <button className="btn ink" onClick={onAdd}>+ Add products</button>
      </div>
    );
  }

  return (
    <div className="ws">
      {priceWarn && (
        <PriceChangeDialog impacts={priceWarn.impacts} busy={bulkBusy}
          onCancel={() => setPriceWarn(null)} onConfirm={confirmBulkPrice} />
      )}
      {modal === 'move' && (
        <div className="modalwrap" onClick={() => !modalBusy && setModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="mhd">
              <b>Move {picked.length} product{picked.length === 1 ? '' : 's'}</b>
              <button className="x" onClick={() => setModal(null)}>×</button>
            </div>
            <div className="msub">Pick the item type to move them into. Products keep their SKU, photos and variants.</div>
            <div className="mbody">
              <CategoryTree
                nodes={tree} title="Move into"
                selectedId={moveTarget?.id}
                onSelect={(n) => { if (n.is_leaf) setMoveTarget(n); }}
                countOf={(n) => n.product_count || 0} />
            </div>
            <div className="mfoot">
              <span className="pickd">
                {moveTarget
                  ? <>Moving into <b>{moveTarget.name}</b></>
                  : 'Select an item type (the lowest level) to continue.'}
              </span>
              <button className="btn ghost" onClick={() => setModal(null)}>Cancel</button>
              <button className="btn yellow" disabled={!moveTarget || modalBusy} onClick={doMove}>
                {modalBusy ? 'Moving…' : `Move ${picked.length}`}
              </button>
            </div>
          </div>
        </div>
      )}

      <CategoryTree
        nodes={tree} loading={treeLoading} hideEmpty
        title="Browse by category"
        selectedId={sel?.id}
        onSelect={select}
        countOf={(n) => n.product_count || 0}
        topItem={{ label: 'All products', count: total, active: !sel, onClick: () => select(null) }}
      />

      <div className="card">
        <div className="crumbbar">
          <span className="cr">
            {sel
              ? <>{[sel.segment, sel.category !== sel.segment ? sel.category : null].filter(Boolean).map((s, i) => (
                  <span key={i}>{s}<span className="sep">›</span></span>
                ))}<b>{sel.name}</b></>
              : <b>All products</b>}
            <span style={{ color: 'var(--muted3)', fontWeight: 600 }}>
              {' · '}{pLoading ? 'loading…' : `${rows.length} product${rows.length === 1 ? '' : 's'}`}
              {q ? ' matching search' : ''}
            </span>
          </span>
          <span className="right">
            <button className="btn ink sm" onClick={() => onEditCategory(sel)}>
              + Add {sel ? 'to this category' : 'products'}
            </button>
          </span>
        </div>

        <div className="tblwrap">
          {err && <div className="err" style={{ margin: '12px 14px' }}>{err}</div>}
          {msg && <div className="ok" style={{ margin: '12px 14px' }}>{msg}</div>}

          {picked.length > 0 && (
            <div style={{ padding: '12px 14px 0' }}>
              <div className="bulkbar">
                <span>{picked.length} selected</span>
                <button className="btn sm" disabled={bulkBusy} onClick={() => bulkActive(false)}>Hide</button>
                <button className="btn sm" disabled={bulkBusy} onClick={() => bulkActive(true)}>Show</button>
                <button className="btn sm" disabled={bulkBusy} onClick={bulkPrice}>Edit price</button>
                <button className="btn sm" disabled={bulkBusy} onClick={openMove}>Move category</button>
                <button className="btn sm danger" disabled={bulkBusy} onClick={bulkRemove}>Remove</button>
                {bulkBusy && <span style={{ fontWeight: 700 }}>Working…</span>}
                <button className="x" onClick={() => setPicked([])}>×</button>
              </div>
            </div>
          )}

          {pLoading ? <div className="sub" style={{ padding: 16 }}>Loading…</div>
            : rows.length === 0 ? <div className="sub" style={{ padding: 16 }}>
                {q ? 'No products match that search.' : 'Nothing listed under here yet.'}
              </div>
            : (
            <table className="tbl">
              <thead><tr>
                <th style={{ width: 34 }}>
                  <input type="checkbox" checked={allPicked}
                    onChange={() => setPicked(allPicked ? [] : rows.map(p => p.id))} />
                </th>
                <th style={{ width: 52 }} />
                <th>Product</th>
                <th>Brand</th>
                <th>Variants</th>
                <th>SKU</th>
                <th style={{ textAlign: 'right' }}>Price</th>
                <th style={{ textAlign: 'right' }}>Stock</th>
                <th>Status</th>
                <th>Offer</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr></thead>
              <tbody>
                {rows.map(p => {
                  const { names, sizes } = colorsOf(p);
                  const st = stockState(p);
                  return (
                    <tr key={p.id} className={p.is_active ? '' : 'hid'}>
                      <td>
                        <input type="checkbox" checked={picked.includes(p.id)}
                          onChange={() => toggleIn(picked, setPicked, p.id)} />
                      </td>
                      <td>
                        {p.image_url
                          // eslint-disable-next-line @next/next/no-img-element
                          ? <img className="pimg" src={p.image_url} alt=""
                              onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }} />
                          : <span className="pimg ph">▦</span>}
                      </td>
                      <td>
                        <div className="pn">{p.name}</div>
                        <div className="pm">{facetSummary(p.facets) || '—'}</div>
                      </td>
                      <td className="tdbrand">{brandOf(p) || '—'}</td>
                      <td>
                        {names.length ? (
                          <span className="vchips">
                            {names.slice(0, 4).map(c => (
                              <span key={c} className="vch" title={c} style={{ background: swatchFor(c) }} />
                            ))}
                            <span className="vmore">
                              {names.length > 4 ? `+${names.length - 4} ` : ''}{sizes ? `· ${sizes} sizes` : ''}
                            </span>
                          </span>
                        ) : <span className="pm">—</span>}
                      </td>
                      <td className="tdsku">{p.sku || '—'}</td>
                      <td className="tdprice">{money(p.price)}</td>
                      <td className={'tdstock' + (st === 'low' || st === 'out' ? ' warn' : '')}>
                        {p.stock == null ? '—' : p.stock}
                      </td>
                      <td>
                        <span className={'pill ' + (!p.is_active ? 'hid' : st === 'out' ? 'low' : st === 'low' ? 'low' : 'live')}>
                          {!p.is_active ? 'Hidden' : st === 'out' ? 'Out of stock' : st === 'low' ? 'Low stock' : 'Live'}
                        </span>
                      </td>
                      <td>
                        {/* offer-builder-v2 (O9): the offer now (until when), or the next (from when) */}
                        <button className="offcell" title="See this product's offers" onClick={() => openPanel(p)}>
                          {offerOf[p.id]?.now
                            ? <><span className="pill live">{offerOf[p.id].now.name}</span><span className="pm">until {dayMonth(offerOf[p.id].now.until)}</span></>
                            : offerOf[p.id]?.next
                              ? <><span className="pill sched">{offerOf[p.id].next.name}</span><span className="pm">from {dayMonth(offerOf[p.id].next.from)}</span></>
                              : <span className="pm">No offer</span>}
                        </button>
                      </td>
                      <td>
                        <span className="pact">
                          <button onClick={() => { window.location.href = `/dashboard/products/listing?edit=${p.id}`; }}>Edit</button>
                          <button disabled={busy === p.id} onClick={() => doToggle(p)}>{p.is_active ? 'Hide' : 'Show'}</button>
                          <button className="danger" disabled={busy === p.id} onClick={() => doRemove(p)}>Remove</button>
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="card rail">
        {focus && (
          /* offer-builder-v2 (O9): the product's offer now and its next offer */
          <div className="offpanel">
            <div className="railhd"><span className="t">{focus.product.name}</span>
              <button className="x" onClick={() => setFocus(null)}>×</button></div>
            {!focus.panel ? <div className="sub">Loading…</div> : (
              <>
                <div className="offbox">
                  <div className="ft">Offer now</div>
                  {focus.panel.now ? (
                    <>
                      <div><b>{focus.panel.now.name}</b> · {span(focus.panel.now.from, focus.panel.now.until)}</div>
                      <div className="pm">Given to {focus.panel.now.creators} creator{focus.panel.now.creators === 1 ? '' : 's'} · in {focus.panel.now.posts} of their posts{focus.panel.now.pool === 'gift' ? ' · as a gift' : ''}</div>
                      <a className="btn ghost sm" href={`/dashboard/products/offers/${focus.panel.now.offer_id}`}>Open offer</a>
                    </>
                  ) : <div className="pm">None.</div>}
                </div>
                <div className="offbox">
                  <div className="ft">Next offer</div>
                  {focus.panel.next
                    ? <div><b>{focus.panel.next.name}</b> · {span(focus.panel.next.from, focus.panel.next.until)}</div>
                    : <div className="pm">None.{focus.panel.now ? ` Free from ${dayMonth(nextDay(focus.panel.now.until))}.` : ''}</div>}
                </div>
              </>
            )}
          </div>
        )}
        <div className="railhd"><span className="t">{sel ? sel.name : 'Whole catalogue'}</span></div>
        <div className="tiles">
          <div className="tile"><b>{products.length}</b><span>Products</span></div>
          <div className="tile"><b>{liveN}</b><span>Live</span></div>
          <div className={'tile' + (lowN + outN > 0 ? ' warn' : '')}><b>{lowN + outN}</b><span>Low / out</span></div>
          <div className="tile"><b>{money(avg)}</b><span>Avg price</span></div>
        </div>
        <div className="frow">
          <div className="ft">Visibility</div>
          <label className="fopt">
            <input type="checkbox" checked={fVis.includes('live')} onChange={() => toggleIn(fVis, setFVis, 'live')} />
            Live <span className="n">{liveN}</span>
          </label>
          <label className="fopt">
            <input type="checkbox" checked={fVis.includes('hidden')} onChange={() => toggleIn(fVis, setFVis, 'hidden')} />
            Hidden <span className="n">{products.length - liveN}</span>
          </label>
        </div>
        <div className="frow">
          <div className="ft">Stock</div>
          <label className="fopt">
            <input type="checkbox" checked={fStatus.includes('ok')} onChange={() => toggleIn(fStatus, setFStatus, 'ok')} />
            In stock <span className="n">{products.length - lowN - outN}</span>
          </label>
          <label className="fopt">
            <input type="checkbox" checked={fStatus.includes('low')} onChange={() => toggleIn(fStatus, setFStatus, 'low')} />
            Low stock (≤5) <span className="n">{lowN}</span>
          </label>
          <label className="fopt">
            <input type="checkbox" checked={fStatus.includes('out')} onChange={() => toggleIn(fStatus, setFStatus, 'out')} />
            Out of stock <span className="n">{outN}</span>
          </label>
        </div>
        {topBrands.length > 0 && (
          <div className="frow">
            <div className="ft">Brand</div>
            {topBrands.map(([b, n]) => (
              <label key={b} className="fopt">
                <input type="checkbox" checked={fBrands.includes(b)} onChange={() => toggleIn(fBrands, setFBrands, b)} />
                {b} <span className="n">{n}</span>
              </label>
            ))}
          </div>
        )}
        {(fStatus.length > 0 || fVis.length > 0 || fBrands.length > 0) && (
          <div className="frow">
            <button className="btn ghost sm"
              onClick={() => { setFStatus([]); setFVis([]); setFBrands([]); }}>Clear filters</button>
          </div>
        )}
      </div>
    </div>
  );
}
