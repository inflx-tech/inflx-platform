'use client';

/**
 * Drill-down listing wizard (Ship 2) — contract: listing-drilldown-taxonomy-engine.
 * Seller drills the category tree ONCE to a leaf, then batch-adds many products
 * (photo + price + typed facets) without re-navigating. Rides the live engine APIs:
 *   listingApi.getTree(vertical) · getNodeFacets(nodeId) · batchCreate(payload)
 * One listing model (no Showcase/Sell): the follower CTA comes from the brand's
 * availing_modes. Self-contained route; does not touch the per-vertical wizard.
 */

import { useEffect, useState, useCallback } from 'react';
import { listingApi, uploadFileToGallery, API_BASE } from '../../../../lib/api';

const VERTICAL = 'fashion'; // only seeded vertical today; furniture rides the same engine later

const CSS = `
.lst *{box-sizing:border-box}
.lst{--white:#fff;--bg:#FAFAFA;--bg2:#F4F4F5;--yellow:#FFC107;--yellow-pale:#FFF7CC;--yellow-text:#6B5A00;
  --ink:#0A0A0A;--ink2:#1F1F22;--muted:#52525B;--muted2:#71717A;--muted3:#A1A1AA;--border:#E4E4E7;
  --success:#10B981;--success-pale:#D1FAE5;--success-text:#047857;--danger:#E8401A;--danger-pale:#FDEEE9;
  --variant:#7E22CE;--variant-pale:#F3E8FF;--disc:#0E7490;--disc-pale:#CFFAFE;--info:#1D4ED8;--info-pale:#DBEAFE;
  font-family:'Plus Jakarta Sans','Outfit',system-ui,sans-serif;color:var(--ink);font-size:13px;line-height:1.45}
.lst h1{font-family:'Outfit',sans-serif;font-size:22px;font-weight:700;letter-spacing:-.3px;margin:0}
.lst .rule{width:42px;height:3px;background:var(--yellow);border-radius:2px;margin:6px 0 10px}
.lst .sub{font-size:12px;color:var(--muted2);max-width:620px}
.lst .crumb{display:flex;flex-wrap:wrap;gap:5px;align-items:center;font-size:12px;color:var(--muted2);margin:14px 0;font-weight:600}
.lst .crumb b{color:var(--ink)} .lst .crumb a{color:var(--muted2);cursor:pointer;text-decoration:none} .lst .crumb a:hover{color:var(--ink)}
.lst .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:10px}
.lst .node{display:flex;align-items:center;justify-content:space-between;gap:8px;background:var(--white);border:1px solid var(--border);
  border-radius:12px;padding:13px 14px;cursor:pointer;transition:.12s}
.lst .node:hover{border-color:var(--yellow);transform:translateY(-1px)}
.lst .node .nm{font-weight:700;font-size:13px} .lst .node .mt{font-size:10px;color:var(--muted3);margin-top:2px}
.lst .node .a{color:var(--muted3);font-size:16px}
.lst .leaf{border-left:3px solid var(--yellow)}
.lst .panel{background:var(--white);border:1px solid var(--border);border-radius:14px;padding:16px;margin-top:10px}
.lst .fl{display:block;font-size:11px;font-weight:700;color:var(--ink2);margin:12px 0 5px}
.lst .fl .req{color:var(--danger)} .lst .fl .tag{font-size:9px;font-weight:800;padding:1px 6px;border-radius:5px;margin-left:5px}
.lst .tag.variant{background:var(--variant-pale);color:var(--variant)} .lst .tag.disc{background:var(--disc-pale);color:var(--disc)} .lst .tag.attr{background:var(--info-pale);color:var(--info)}
.lst input.t,.lst select.t{width:100%;background:var(--white);border:1px solid var(--border);border-radius:9px;padding:10px;font-size:13px;font-family:inherit;color:var(--ink)}
.lst input.t:focus,.lst select.t:focus{outline:none;border-color:var(--yellow)}
.lst .chips{display:flex;flex-wrap:wrap;gap:6px}
.lst .chip{padding:7px 12px;border-radius:99px;border:1px solid var(--border);background:var(--white);font-size:12px;font-weight:600;cursor:pointer;user-select:none}
.lst .chip.on{background:var(--ink);border-color:var(--ink);color:#fff} .lst .chip.on.v{background:var(--variant);border-color:var(--variant)}
.lst .tog{display:inline-flex;border:1px solid var(--border);border-radius:9px;overflow:hidden}
.lst .tog button{border:0;background:var(--white);padding:8px 16px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;color:var(--muted2)}
.lst .tog button.on{background:var(--ink);color:var(--yellow)}
.lst .btn{padding:11px 16px;border:0;border-radius:11px;font-size:13px;font-weight:800;cursor:pointer;font-family:inherit}
.lst .btn.yellow{background:var(--yellow);color:var(--ink)} .lst .btn.ink{background:var(--ink);color:var(--yellow)} .lst .btn.ghost{background:var(--white);border:1px solid var(--border);color:var(--ink2)}
.lst .btn:disabled{opacity:.5;cursor:not-allowed}
.lst .row{display:flex;gap:10px;flex-wrap:wrap}
.lst .imgs{display:flex;gap:8px;flex-wrap:wrap;margin-top:6px}
.lst .thumb{width:62px;height:62px;border-radius:9px;object-fit:cover;border:1px solid var(--border)}
.lst .added{display:flex;align-items:center;gap:11px;background:var(--bg2);border:1px solid var(--border);border-radius:11px;padding:9px 11px;margin-bottom:7px}
.lst .added .x{color:var(--danger);background:0;border:0;font-size:17px;cursor:pointer;margin-left:auto}
.lst .err{background:var(--danger-pale);border:1px solid #f3c0b0;color:#9a2a12;border-radius:10px;padding:9px 12px;font-size:12px;font-weight:600;margin:10px 0}
.lst .ok{background:var(--success-pale);border:1px solid #9be3c4;color:var(--success-text);border-radius:10px;padding:9px 12px;font-size:12px;font-weight:700;margin:10px 0}
.lst .sec{font-size:11px;text-transform:uppercase;letter-spacing:.6px;color:var(--muted2);font-weight:800;margin:14px 0 8px}
`;

const FREE = new Set(['free_size', 'one_size', 'unstitched']);

// Size = the variant axis. Its values come from the leaf's size_system (the
// facet's allowed_values is only a pointer), so render real pickable chips.
const SIZE_SYSTEMS = {
  alpha:      ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL', '4XL'],
  plus_alpha: ['XL', '2XL', '3XL', '4XL', '5XL', '6XL'],
  waist_in:   ['26', '28', '30', '32', '34', '36', '38', '40', '42', '44'],
  waist_plus: ['38', '40', '42', '44', '46', '48', '50'],
  bra:        ['30', '32', '34', '36', '38', '40', '42', '44'],
  age:        ['0-3m', '3-6m', '6-12m', '12-18m', '18-24m', '2-3y', '3-4y', '4-5y', '5-6y', '6-7y', '7-8y', '8-9y', '9-10y', '10-11y', '11-12y', '13-14y', '15-16y'],
  uk_women:   ['UK2', 'UK3', 'UK4', 'UK5', 'UK6', 'UK7', 'UK8', 'UK9'],
  uk_men:     ['UK5', 'UK6', 'UK7', 'UK8', 'UK9', 'UK10', 'UK11', 'UK12'],
  kids_shoe:  ['UK4', 'UK5', 'UK6', 'UK7', 'UK8', 'UK9', 'UK10', 'UK11', 'UK12', 'UK13'],
  ring:       ['Adjustable', '6', '8', '10', '12', '14', '16', '18', '20', '22'],
  bangle:     ['2.4', '2.6', '2.8', '2.10', 'Free'],
  sock_size:  ['S', 'M', 'L', 'Free'],
  free_size:  ['Free Size'],
  one_size:   ['One Size'],
  unstitched: ['Unstitched'],
};
const sizeValues = (sys) => SIZE_SYSTEMS[sys] || ['Free Size'];
const tagFor = (f) => f.facet_role === 'variant' ? <span className="tag variant">variant</span>
  : f.facet_role === 'discovery' ? <span className="tag disc">discovery</span>
  : f.facet_role === 'attr' ? <span className="tag attr">listing</span> : null;

export default function DrilldownListingPage() {
  const [tree, setTree] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [crumb, setCrumb] = useState([]);     // [{name, children}] drill path (non-leaf)
  const [level, setLevel] = useState([]);     // nodes currently shown
  const [leaf, setLeaf] = useState(null);     // selected leaf node (+ facets)
  const [facets, setFacets] = useState([]);
  const [draft, setDraft] = useState({ name: '', price: '', stock: '', images: [], facets: {} });
  const [items, setItems] = useState([]);     // batch staged under this leaf
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [ok, setOk] = useState('');

  useEffect(() => {
    (async () => {
      const r = await listingApi.getTree(VERTICAL);
      setLoading(false);
      if (r.ok) { setTree(r.data.tree); setLevel(r.data.tree); }
      else setErr(r.error?.message || 'Failed to load categories');
    })();
  }, []);

  const resetDraft = () => setDraft({ name: '', price: '', stock: '', images: [], facets: {} });

  const drillInto = useCallback(async (node) => {
    setOk('');
    if (node.is_leaf) {
      const r = await listingApi.getNodeFacets(node.id);
      if (!r.ok) { setErr(r.error?.message || 'Failed to load facets'); return; }
      setErr('');
      setLeaf({ ...node, size_required: r.data.node.size_required });
      setFacets(r.data.facets.filter(f => f.facet_key !== 'images' && f.facet_key !== 'price'));
      setItems([]); resetDraft();
      setCrumb(c => [...c, { name: node.name, children: level }]);
    } else {
      setCrumb(c => [...c, { name: node.name, children: level }]);
      setLevel(node.children || []);
    }
  }, [level]);

  const jumpTo = (i) => {
    // i = -1 → root; else index into crumb
    setLeaf(null); setErr(''); setOk('');
    if (i < 0) { setLevel(tree); setCrumb([]); return; }
    setLevel(crumb[i].children);
    setCrumb(crumb.slice(0, i));
  };

  const setFacet = (key, val) => setDraft(d => ({ ...d, facets: { ...d.facets, [key]: val } }));
  const toggleMulti = (key, opt) => setDraft(d => {
    const cur = Array.isArray(d.facets[key]) ? d.facets[key] : [];
    return { ...d, facets: { ...d.facets, [key]: cur.includes(opt) ? cur.filter(x => x !== opt) : [...cur, opt] } };
  });

  const onPickImages = async (e) => {
    const files = Array.from(e.target.files || []); if (!files.length) return;
    setUploading(true);
    const urls = [];
    for (const f of files) {
      const r = await uploadFileToGallery(f, { title: f.name, tags: ['listing'] });
      if (r.asset?.id) urls.push(`${API_BASE}/media/assets/${r.asset.id}`);
    }
    setUploading(false);
    setDraft(d => ({ ...d, images: [...d.images, ...urls].slice(0, 6) }));
  };

  const draftErrors = () => {
    const e = [];
    if (!draft.name.trim()) e.push('name');
    if (draft.price === '' || Number(draft.price) < 0) e.push('price');
    for (const f of facets) {
      let req = f.required === 'required';
      if (f.facet_key === 'size') req = leaf && !FREE.has(leaf.size_system || 'free_size');
      const v = draft.facets[f.facet_key];
      const empty = v == null || v === '' || (Array.isArray(v) && v.length === 0);
      if (req && empty) e.push(f.label);
    }
    return e;
  };

  const addItem = () => {
    const e = draftErrors();
    if (e.length) { setErr('Required: ' + e.join(', ')); return; }
    setErr('');
    setItems(list => [...list, {
      name: draft.name.trim(), price: Number(draft.price),
      stock: draft.stock === '' ? null : Number(draft.stock),
      images: draft.images, facets: draft.facets,
    }]);
    resetDraft();
  };

  const saveBatch = async () => {
    if (!items.length) return;
    setSaving(true); setErr(''); setOk('');
    const r = await listingApi.batchCreate({ category_node_id: leaf.id, items });
    setSaving(false);
    if (r.ok) { setOk(`✓ ${r.data.created_count} product(s) added under ${leaf.name}.`); setItems([]); }
    else setErr(r.error?.message || 'Save failed');
  };

  if (loading) return <div className="lst" style={{ padding: 24 }}><style>{CSS}</style>Loading categories…</div>;

  return (
    <div className="lst" style={{ padding: 24, maxWidth: 920, margin: '0 auto' }}>
      <style>{CSS}</style>
      <h1>Add products — {VERTICAL}</h1>
      <div className="rule" />
      <div className="sub">Drill to the exact item type once, then add as many products as you like under it — photo + price + details. No re-navigating per item.</div>

      <div className="crumb">
        <a onClick={() => jumpTo(-1)}>{VERTICAL[0].toUpperCase() + VERTICAL.slice(1)}</a>
        {crumb.map((c, i) => <span key={i}>›  {i === crumb.length - 1 && leaf ? <b>{c.name}</b> : <a onClick={() => jumpTo(i)}>{c.name}</a>}</span>)}
      </div>

      {err && <div className="err">{err}</div>}
      {ok && <div className="ok">{ok}</div>}

      {!leaf && (
        <div className="grid">
          {level.map(n => (
            <div key={n.id} className={'node' + (n.is_leaf ? ' leaf' : '')} onClick={() => drillInto(n)}>
              <div>
                <div className="nm">{n.name}</div>
                <div className="mt">{n.is_leaf ? 'item type' : `${(n.children || []).length} ${n.depth === 0 ? 'categories' : 'items'}`}</div>
              </div>
              <div className="a">›</div>
            </div>
          ))}
        </div>
      )}

      {leaf && (
        <div className="panel">
          <div style={{ fontWeight: 800, fontSize: 15 }}>Add {leaf.name}</div>
          <div className="sub" style={{ marginTop: 2 }}>{leaf.segment} › {leaf.category} › {leaf.name}{leaf.size_system ? ` · sizes: ${leaf.size_system}` : ''}</div>

          <label className="fl">Photos (up to 6) — the first is the cover</label>
          <input className="t" type="file" accept="image/*" multiple onChange={onPickImages} />
          {uploading && <div className="sub" style={{ marginTop: 4 }}>Uploading…</div>}
          {draft.images.length > 0 && <div className="imgs">{draft.images.map((u, i) => <img key={i} className="thumb" src={u} alt="" />)}</div>}

          <div className="row">
            <div style={{ flex: 1, minWidth: 160 }}>
              <label className="fl">Product name <span className="req">*</span></label>
              <input className="t" value={draft.name} onChange={e => setDraft(d => ({ ...d, name: e.target.value }))} placeholder="e.g. Slim Fit Blue Jeans" />
            </div>
            <div style={{ width: 130 }}>
              <label className="fl">Price ₹ <span className="req">*</span></label>
              <input className="t" type="number" value={draft.price} onChange={e => setDraft(d => ({ ...d, price: e.target.value }))} placeholder="0" />
            </div>
            <div style={{ width: 110 }}>
              <label className="fl">Stock</label>
              <input className="t" type="number" value={draft.stock} onChange={e => setDraft(d => ({ ...d, stock: e.target.value }))} placeholder="—" />
            </div>
          </div>

          {facets.map(f => {
            const isSize = f.facet_key === 'size';
            const allowed = isSize ? sizeValues(leaf.size_system) : (Array.isArray(f.allowed_values) ? f.allowed_values : []);
            const enumerated = allowed.length > 1;
            const req = (f.required === 'required') || (isSize && leaf.size_required);
            const v = draft.facets[f.facet_key];
            return (
              <div key={f.facet_key}>
                <label className="fl">{f.label}{req && <span className="req"> *</span>} {tagFor(f)}</label>
                {isSize && (
                  <div className="chips">{allowed.map(o => (
                    <span key={o} className={'chip' + ((Array.isArray(v) && v.includes(o)) ? ' on v' : '')} onClick={() => toggleMulti('size', o)}>{o}</span>
                  ))}</div>
                )}
                {!isSize && f.input_type === 'multi_select' && enumerated && (
                  <div className="chips">{allowed.map(o => (
                    <span key={o} className={'chip' + ((Array.isArray(v) && v.includes(o)) ? ' on' + (f.facet_role === 'variant' ? ' v' : '') : '')} onClick={() => toggleMulti(f.facet_key, o)}>{o}</span>
                  ))}</div>
                )}
                {f.input_type === 'single_select' && enumerated && (
                  <select className="t" value={v || ''} onChange={e => setFacet(f.facet_key, e.target.value)}>
                    <option value="">Select…</option>{allowed.map(o => <option key={o}>{o}</option>)}
                  </select>
                )}
                {f.input_type === 'boolean' && (
                  <div className="tog">
                    <button className={v === 'No' || !v ? 'on' : ''} onClick={() => setFacet(f.facet_key, 'No')}>No</button>
                    <button className={v === 'Yes' ? 'on' : ''} onClick={() => setFacet(f.facet_key, 'Yes')}>Yes</button>
                  </div>
                )}
                {f.input_type === 'number' && <input className="t" style={{ maxWidth: 160 }} type="number" value={v || ''} onChange={e => setFacet(f.facet_key, e.target.value)} />}
                {!isSize && (f.input_type === 'text' || (!enumerated && (f.input_type === 'single_select' || f.input_type === 'multi_select'))) &&
                  <input className="t" value={v || ''} onChange={e => setFacet(f.facet_key, e.target.value)} placeholder="optional" />}
              </div>
            );
          })}

          <div className="row" style={{ marginTop: 14 }}>
            <button className="btn yellow" onClick={addItem}>+ Add this item</button>
            <button className="btn ghost" onClick={() => jumpTo(crumb.length - 1)}>‹ Pick another item type</button>
          </div>

          {items.length > 0 && (
            <>
              <div className="sec">Staged under {leaf.name} ({items.length})</div>
              {items.map((it, i) => (
                <div key={i} className="added">
                  <div>
                    <div style={{ fontWeight: 700 }}>{it.name}</div>
                    <div className="sub">₹{it.price}{it.stock != null ? ` · stock ${it.stock}` : ''} · {Object.values(it.facets).flat().filter(Boolean).slice(0, 4).join(' · ') || '—'}</div>
                  </div>
                  <button className="x" onClick={() => setItems(list => list.filter((_, j) => j !== i))}>×</button>
                </div>
              ))}
              <button className="btn ink" disabled={saving} onClick={saveBatch} style={{ marginTop: 6 }}>
                {saving ? 'Saving…' : `Save all ${items.length} product(s)`}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
