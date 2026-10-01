'use client';
// Adding products to a published offer no creator has yet. Contract: features/offer-add-products
// · rules 1.10. Browse a category or search, tick, add. The server holds them from today under
// the same lock and checks as publishing; this panel only shows its answer.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { brandApi } from '../../lib/api';
import { dayMonth } from './offerFormat';
import { ProductRow, findPath } from './PoolBuilder';

export default function AddProductsPanel({ offer, onAdded, onGiven, onCancel }) {
  const [method, setMethod] = useState('browse');                // 'browse' | 'search'
  const [tree, setTree] = useState(null);
  const [node, setNode] = useState(null);
  const [q, setQ] = useState('');
  const [cands, setCands] = useState(null);
  const [ticked, setTicked] = useState([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    brandApi.get('/brands/me/listing-tree').then((r) => setTree(r.success ? (r.data.tree || []) : []));
  }, []);

  const loadCands = useCallback(async () => {
    const params = {};
    if (method === 'search') { if (!q.trim()) { setCands(null); return; } params.q = q.trim(); }
    else { if (!node) { setCands(null); return; } params.node = node.id; }
    const r = await brandApi.offerCandidates(offer.id, params);
    setCands(r.success ? r.data.products : []);
  }, [method, q, node, offer.id]);
  useEffect(() => { const t = setTimeout(loadCands, method === 'search' ? 300 : 0); return () => clearTimeout(t); }, [loadCands, method]);

  const children = useMemo(() => {
    const list = node ? (node.children || []) : (tree || []);
    return list.filter((n) => (n.product_count || 0) > 0);
  }, [node, tree]);
  const path = node && tree ? (findPath(tree, node.id) || [node]) : [];
  const lockedN = (cands || []).filter((p) => p.locked).length;
  const toggle = (id) => { setErr(''); setTicked((t) => (t.includes(id) ? t.filter((x) => x !== id) : [...t, id])); };

  async function add() {
    if (busy || !ticked.length) return;
    setBusy(true); setErr('');
    const r = await brandApi.addOfferProducts(offer.id, ticked);
    setBusy(false);
    if (!r.success && r.error?.code === 'OFFER_GIVEN') { onGiven(r.error.message); return; }
    if (!r.success) { setErr(r.error?.message || 'Couldn\'t add those products.'); loadCands(); return; }
    onAdded(r.data);
  }

  return (
    <div className="card" data-testid="add-products">
      <div className="row between wrapx">
        <b className="sm">Tick the products to add to this offer</b>
        <div className="row">
          <button className="btn btn-ghost btn-sm" disabled={busy} onClick={onCancel}>Cancel</button>
          <button className="btn btn-ink btn-sm" disabled={busy || !ticked.length} onClick={add}>{busy ? 'Adding…' : `Add ${ticked.length || ''} product${ticked.length === 1 ? '' : 's'}`}</button>
        </div>
      </div>
      <div className="mtabs">
        <button className={method === 'browse' ? 'act' : ''} onClick={() => setMethod('browse')}>Browse by category</button>
        <button className={method === 'search' ? 'act' : ''} onClick={() => setMethod('search')}>Search products</button>
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
        </>
      )}

      {method === 'search' && (
        <input className="inp" placeholder="Product name or SKU" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
      )}

      {cands && (
        <div className="plist">
          {cands.length === 0 && <div className="prow"><span className="hint">No published products match.</span></div>}
          {cands.map((p) => <ProductRow key={p.id} p={p} checked={ticked.includes(p.id)} onToggle={toggle} />)}
        </div>
      )}
      {err && <div className="err">{err}</div>}
      <div className="hint">
        Products you add are locked to this offer until {dayMonth(offer.ends_on)}.
        {lockedN ? ' Locked products are in another offer on these dates and can\'t be ticked.' : ''}
        {offer.offer_type === 'free_gift' ? ' Gifts can\'t be added here.' : ''}
      </div>
    </div>
  );
}
