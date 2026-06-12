'use client';

/**
 * Drill-down listing wizard (Ship 2.3) — contract: listing-drilldown-taxonomy-engine.
 * Works for ANY drill-down vertical (fashion + furniture) — the vertical is derived
 * from the brand's category at runtime. Drill the tree ONCE to a leaf, then batch-add
 * products (photo + brand + price + typed facets + per-colour variant pics & per-
 * variant stock). Auto-SKU from the backend. One listing model (no Showcase/Sell).
 * Rides: listingApi.getTree / getNodeFacets / getBrands / batchCreate.
 */

import { useEffect, useState, useCallback } from 'react';
import { listingApi, uploadFileToGallery, API_BASE, brandApi } from '../../../../lib/api';

const FREE = new Set(['free_size', 'one_size', 'unstitched']);
const COLOR_KEY = 'color_tone';   // the VISUAL variant → drives per-colour pics (both verticals)
const SIZE_KEY = 'size';

// Fashion size systems (clothing). Furniture has no size_system → its variant facets
// (Seater/Doors/Seats/Size) carry real allowed_values and render normally.
const SIZE_SYSTEMS = {
  alpha: ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL', '4XL'],
  plus_alpha: ['XL', '2XL', '3XL', '4XL', '5XL', '6XL'],
  waist_in: ['26', '28', '30', '32', '34', '36', '38', '40', '42', '44'],
  waist_plus: ['38', '40', '42', '44', '46', '48', '50'],
  bra: ['30', '32', '34', '36', '38', '40', '42', '44'],
  age: ['0-3m', '3-6m', '6-12m', '12-18m', '18-24m', '2-3y', '3-4y', '4-5y', '5-6y', '6-7y', '7-8y', '8-9y', '9-10y', '10-11y', '11-12y', '13-14y', '15-16y'],
  uk_women: ['UK2', 'UK3', 'UK4', 'UK5', 'UK6', 'UK7', 'UK8', 'UK9'],
  uk_men: ['UK5', 'UK6', 'UK7', 'UK8', 'UK9', 'UK10', 'UK11', 'UK12'],
  kids_shoe: ['UK4', 'UK5', 'UK6', 'UK7', 'UK8', 'UK9', 'UK10', 'UK11', 'UK12', 'UK13'],
  ring: ['Adjustable', '6', '8', '10', '12', '14', '16', '18', '20', '22'],
  bangle: ['2.4', '2.6', '2.8', '2.10', 'Free'], sock_size: ['S', 'M', 'L', 'Free'],
  free_size: ['Free Size'], one_size: ['One Size'], unstitched: ['Unstitched'],
};
const sizeValues = (sys) => SIZE_SYSTEMS[sys] || ['Free Size'];
const tagFor = (f) => f.facet_role === 'variant' ? <span className="tag variant">variant</span>
  : f.facet_role === 'discovery' ? <span className="tag disc">discovery</span>
  : f.facet_role === 'listing_attr' || f.facet_role === 'attr' ? <span className="tag attr">listing</span> : null;
const arr = (v) => Array.isArray(v) ? v : (v ? [v] : []);
const blankDraft = () => ({ name: '', price: '', brand: '', sku: '', stock: '', images: [], facets: {}, variants: {} });

export default function DrilldownListingPage() {
  const [vertical, setVertical] = useState('fashion');
  const [tree, setTree] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [crumb, setCrumb] = useState([]);
  const [level, setLevel] = useState([]);
  const [leaf, setLeaf] = useState(null);
  const [facets, setFacets] = useState([]);
  const [draft, setDraft] = useState(blankDraft());
  const [step, setStep] = useState(1);          // 1 Basics · 2 Variants · 3 Details · 4 Review
  const [moreOpen, setMoreOpen] = useState(false); // step-3 optional facets (collapsed by default)
  const [mode, setMode] = useState('one');      // 'one' = stepper · 'bulk' = Excel (contract: listing-excel-bulk)
  const [importing, setImporting] = useState(false);
  const [importErrors, setImportErrors] = useState(null);  // per-product row errors
  const [importFileErr, setImportFileErr] = useState('');  // file-level (stale template etc.)
  const [imported, setImported] = useState([]);            // just-created products → photo tray
  const [trayUploading, setTrayUploading] = useState('');
  const [items, setItems] = useState([]);
  const [uploading, setUploading] = useState('');
  const [saving, setSaving] = useState(false);
  const [ok, setOk] = useState('');
  const [brandOpts, setBrandOpts] = useState([]);
  const [counts, setCounts] = useState({});

  useEffect(() => {
    (async () => {
      let v = 'fashion';
      try {
        const s = await brandApi.getSchema();
        const cat = String(s?.data?.schema?.category_key || '');
        if (cat.startsWith('furniture')) v = 'furniture';
      } catch { /* default fashion */ }
      setVertical(v);
      const r = await listingApi.getTree(v);
      setLoading(false);
      if (r.ok) { setTree(r.data.tree); setLevel(r.data.tree); } else setErr(r.error?.message || 'Failed to load categories');
      loadBrands(v, '');
    })();
  }, []);

  async function loadBrands(v, q) {
    const r = await listingApi.getBrands(v, q);
    if (r.ok) setBrandOpts(r.data.brands || []);
  }

  const drillInto = useCallback(async (node) => {
    setOk('');
    if (node.is_leaf) {
      const r = await listingApi.getNodeFacets(node.id);
      if (!r.ok) { setErr(r.error?.message || 'Failed to load specs'); return; }
      setErr('');
      setLeaf({ ...node, size_system: r.data.node.size_system, size_required: r.data.node.size_required });
      setFacets((r.data.facets || []).filter(f => f.facet_key !== 'images' && f.facet_key !== 'price'));
      setItems([]); setDraft(blankDraft()); setStep(1); setMoreOpen(false);
      setMode('one'); setImported([]); setImportErrors(null); setImportFileErr('');
      setCrumb(c => [...c, { name: node.name, children: level }]);
    } else {
      setCrumb(c => [...c, { name: node.name, children: level }]);
      setLevel(node.children || []);
    }
  }, [level]);

  const jumpTo = (i) => {
    setLeaf(null); setErr(''); setOk('');
    if (i < 0) { setLevel(tree); setCrumb([]); return; }
    setLevel(crumb[i].children); setCrumb(crumb.slice(0, i));
  };

  const setFacet = (key, val) => setDraft(d => ({ ...d, facets: { ...d.facets, [key]: val } }));
  const toggleMulti = (key, opt) => setDraft(d => {
    const cur = arr(d.facets[key]);
    return { ...d, facets: { ...d.facets, [key]: cur.includes(opt) ? cur.filter(x => x !== opt) : [...cur, opt] } };
  });
  const setColorImages = (color, urls) => setDraft(d => {
    const v = { ...(d.variants || {}) };
    v[color] = { ...(v[color] || { images: [], stock: {} }), images: [...arr(v[color]?.images), ...urls].slice(0, 6) };
    return { ...d, variants: v };
  });
  const setColorVariantStock = (color, val, stock) => setDraft(d => {
    const v = { ...(d.variants || {}) };
    const cv = { ...(v[color] || { images: [], stock: {} }) };
    cv.stock = { ...cv.stock, [val]: stock };
    v[color] = cv;
    return { ...d, variants: v };
  });

  async function uploadImages(fileList, target) {
    const files = Array.from(fileList || []); if (!files.length) return;
    setUploading(target);
    const urls = [];
    for (const f of files) {
      const r = await uploadFileToGallery(f, { title: f.name, tags: ['listing'] });
      if (r.asset?.id) urls.push(`${API_BASE}/media/assets/${r.asset.id}`);
    }
    setUploading('');
    if (target === 'cover') setDraft(d => ({ ...d, images: [...d.images, ...urls].slice(0, 6) }));
    else setColorImages(target, urls);
  }

  // Visual variant (colour) drives pics; the OTHER variant facet (size/seater/doors/
  // seats) is the per-unit STOCK axis.
  const stockFacet = facets.find(f => f.facet_role === 'variant' && f.facet_key !== COLOR_KEY) || null;
  const stockKey = stockFacet?.facet_key || null;
  const selectedColors = arr(draft.facets[COLOR_KEY]);
  const selectedVariants = stockKey ? arr(draft.facets[stockKey]) : [];

  // Steps fall straight out of facet_role (contract listing-add-stepper):
  //   ② Variants  = role 'variant'   ③ Details = everything else.
  // 'brand' is handled by its own field in ① so it never doubles up in ③.
  const variantFacets = facets.filter(f => f.facet_role === 'variant');
  const detailFacets  = facets.filter(f => f.facet_role !== 'variant' && f.facet_key !== 'brand');
  const hasVariantStep = variantFacets.length > 0;
  // Required ones lead Step ③; the rest hide under "More details".
  const facetRequired = (f) => {
    if (f.facet_key === SIZE_KEY && leaf?.size_system) return !FREE.has(leaf.size_system);
    return f.required === 'required';
  };
  const facetEmpty = (f) => {
    const v = draft.facets[f.facet_key];
    return v == null || v === '' || (Array.isArray(v) && v.length === 0);
  };
  const requiredDetails = detailFacets.filter(facetRequired);
  const optionalDetails = detailFacets.filter(f => !facetRequired(f));

  // Per-step validation — STRICTER-or-equal to taxonomy.validateItem, so a step
  // that passes can never fail server-side. (Photos are required here though the
  // backend treats them as optional — the stepper is the photo-first path.)
  const stepErrors = (s) => {
    const e = [];
    if (s === 1) {
      if (!draft.name.trim()) e.push('product name');
      if (draft.price === '' || Number(draft.price) < 0) e.push('price');
      if (!draft.images.length) e.push('a cover photo');
    }
    if (s === 2) variantFacets.filter(f => facetRequired(f) && facetEmpty(f)).forEach(f => e.push(f.label));
    if (s === 3) requiredDetails.filter(f => facetEmpty(f)).forEach(f => e.push(f.label));
    return e;
  };
  const stepBlocked = stepErrors(step);

  const goNext = () => {
    if (stepBlocked.length) return;          // Next is disabled; the inline hint explains
    setErr('');
    let n = step + 1;
    if (n === 2 && !hasVariantStep) n = 3;   // auto-skip Variants when the leaf has none
    setStep(n);
  };
  const goBack = () => {
    setErr('');
    let p = step - 1;
    if (p === 2 && !hasVariantStep) p = 1;
    setStep(p);
  };

  const STEP_DEFS = [
    { n: 1, label: 'Basics' },
    ...(hasVariantStep ? [{ n: 2, label: 'Variants' }] : []),
    { n: 3, label: 'Details' },
    { n: 4, label: 'Review' },
  ];

  // One facet's input — shared by Step ② (variant facets) and Step ③ (details).
  const renderFacet = (f) => {
    const isSize = f.facet_key === SIZE_KEY && !!leaf?.size_system;
    const allowed = isSize ? sizeValues(leaf.size_system) : (Array.isArray(f.allowed_values) ? f.allowed_values : []);
    const enumerated = allowed.length > 1;
    const req = (f.required === 'required') || (isSize && leaf.size_required);
    const v = draft.facets[f.facet_key];
    return (
      <div key={f.facet_key}>
        <label className="fl">{f.label}{req && <span className="req"> *</span>} {tagFor(f)}</label>
        {isSize && (
          <div className="chips">{allowed.map(o => (
            <span key={o} className={'chip' + ((Array.isArray(v) && v.includes(o)) ? ' on v' : '')} onClick={() => toggleMulti(SIZE_KEY, o)}>{o}</span>
          ))}</div>
        )}
        {!isSize && f.input_type === 'multi_select' && enumerated && (
          <div className="chips">{allowed.map(o => (
            <span key={o} className={'chip' + ((Array.isArray(v) && v.includes(o)) ? ' on' + (f.facet_role === 'variant' ? ' v' : '') : '')} onClick={() => toggleMulti(f.facet_key, o)}>{o}</span>
          ))}</div>
        )}
        {!isSize && f.input_type === 'single_select' && enumerated && (
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
        {f.input_type === 'number' && <input className="t" style={{ maxWidth: 180 }} type="number" value={v || ''} onChange={e => setFacet(f.facet_key, e.target.value)} placeholder={f.allowed_values?.[0] || ''} />}
        {f.input_type === 'dimension' && (
          <div className="row" style={{ gap: 6 }}>
            {['l', 'w', 'h'].map(d => <input key={d} className="t" style={{ width: 70 }} type="number" placeholder={d.toUpperCase()} value={v?.[d] || ''} onChange={e => setFacet(f.facet_key, { ...(v || {}), [d]: e.target.value })} />)}
            <span className="muted2" style={{ alignSelf: 'center' }}>cm</span>
          </div>
        )}
        {!isSize && (f.input_type === 'text' || (!enumerated && (f.input_type === 'single_select' || f.input_type === 'multi_select'))) &&
          <input className="t" value={v || ''} onChange={e => setFacet(f.facet_key, e.target.value)} placeholder="optional" />}
      </div>
    );
  };

  const draftErrors = () => {
    const e = [];
    if (!draft.name.trim()) e.push('name');
    if (draft.price === '' || Number(draft.price) < 0) e.push('price');
    for (const f of facets) {
      let req = f.required === 'required';
      if (f.facet_key === SIZE_KEY && leaf.size_system) req = !FREE.has(leaf.size_system);
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
    const variants = selectedColors.map(color => ({
      color,
      images: arr(draft.variants[color]?.images),
      sizes: selectedVariants.map(val => ({ size: val, stock: draft.variants[color]?.stock?.[val] ?? null })),
    }));
    setItems(list => [...list, {
      name: draft.name.trim(), price: Number(draft.price),
      brand: draft.brand.trim() || null, sku: draft.sku.trim() || null,
      stock: draft.stock === '' ? null : Number(draft.stock),
      images: draft.images, facets: draft.facets,
      variants: variants.length ? variants : undefined,
    }]);
    // Carry brand + the descriptive/discovery facet values to the next item so
    // adding many similar products is fast; clear identity, photos and variants.
    const carry = blankDraft();
    carry.brand = draft.brand;
    detailFacets.forEach(f => { if (!facetEmpty(f)) carry.facets[f.facet_key] = draft.facets[f.facet_key]; });
    setDraft(carry);
    setStep(1); setMoreOpen(false);
  };

  const saveBatch = async () => {
    if (!items.length) return;
    setSaving(true); setErr(''); setOk('');
    const r = await listingApi.batchCreate({ category_node_id: leaf.id, items });
    setSaving(false);
    if (r.ok) {
      const skus = (r.data.products || []).map(p => p.sku).filter(Boolean);
      setOk(`✓ ${r.data.created_count} product(s) live under ${leaf.name}. SKUs: ${skus.slice(0, 4).join(', ')}${skus.length > 4 ? '…' : ''}`);
      setCounts(c => ({ ...c, [leaf.id]: (c[leaf.id] || 0) + r.data.created_count }));
      setItems([]);
    } else setErr(r.error?.message || 'Save failed');
  };

  // ── Excel bulk add ──────────────────────────────────────────────────────
  async function handleImport(file) {
    if (!file) return;
    setImporting(true); setImportErrors(null); setImportFileErr(''); setErr(''); setOk('');
    const r = await listingApi.importProducts(leaf.id, file);
    setImporting(false);
    if (r.ok) {
      const created = r.data?.products || [];
      setImported(created);
      setOk(`✓ ${r.data?.created_count} product(s) created under ${leaf.name} — add photos below`);
      setCounts(c => ({ ...c, [leaf.id]: (c[leaf.id] || 0) + (r.data?.created_count || 0) }));
    } else {
      let parsed = null;
      try { parsed = r.error?.field ? JSON.parse(r.error.field) : null; } catch { /* not json */ }
      if (parsed?.row_errors) setImportErrors(parsed.row_errors);
      else if (parsed?.file_errors) setImportFileErr(parsed.file_errors.join(' '));
      else setImportFileErr(r.error?.message || 'Import failed');
    }
  }

  async function addTrayPhoto(productId, fileList) {
    const files = Array.from(fileList || []); if (!files.length) return;
    setTrayUploading(productId);
    const r = await uploadFileToGallery(files[0], { title: files[0].name, tags: ['listing'] });
    if (r.asset?.id) {
      const url = `${API_BASE}/media/assets/${r.asset.id}`;
      await brandApi.updateProduct(productId, { image_url: url });
      setImported(list => list.map(p => p.id === productId ? { ...p, image_url: url } : p));
    }
    setTrayUploading('');
  }

  const vlabel = vertical[0].toUpperCase() + vertical.slice(1);
  if (loading) return <div className="lst" style={{ padding: 24 }}><style>{CSS}</style>Loading {vlabel} categories…</div>;

  return (
    <div className="lst" style={{ padding: 24, maxWidth: 960, margin: '0 auto' }}>
      <style>{CSS}</style>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap' }}>
        <h1>Add products — {vlabel}</h1>
        <a href="/dashboard/products?setup=1" className="setuplink">⚙ Store setup</a>
      </div>
      <div className="rule" />
      <div className="sub">Drill to the exact item-type once, then add every product of that type — photo, brand, price, variants (each colour gets its own pics + stock). SKU is generated automatically.</div>

      <div className="crumb">
        <a onClick={() => jumpTo(-1)}>{vlabel}</a>
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
                <div className="mt">
                  {n.is_leaf ? (counts[n.id] ? `✓ ${counts[n.id]} added` : 'item type')
                    : `${(n.children || []).length} ${n.depth === 0 ? 'categories' : 'items'}`}
                </div>
              </div>
              <div className="a">{n.is_leaf && counts[n.id] ? '✓' : '›'}</div>
            </div>
          ))}
        </div>
      )}

      {leaf && (
        <div className="panel">
          <div className="phead">Add {leaf.name}{counts[leaf.id] ? <span className="done">· {counts[leaf.id]} already added</span> : null}</div>
          <div className="sub" style={{ marginBottom: 4 }}>{leaf.segment}{leaf.category && leaf.category !== leaf.segment ? ` › ${leaf.category}` : ''} › {leaf.name}</div>

          {/* Entry mode — one-by-one (stepper) or bulk Excel */}
          <div className="bulktabs">
            <span className={'btab' + (mode === 'one' ? ' on' : '')} onClick={() => setMode('one')}>Add one-by-one</span>
            <span className={'btab' + (mode === 'bulk' ? ' on' : '')} onClick={() => setMode('bulk')}>Bulk add (Excel)</span>
          </div>

          {mode === 'one' && (<>
          {/* Progress header — steps derive from facet_role (② hidden when no variants) */}
          <div className="steps">
            {STEP_DEFS.map((sd, i) => (
              <div key={sd.n} className="stwrap">
                {i > 0 && <span className="bar" />}
                <span className={'st' + (step === sd.n ? ' on' : step > sd.n ? ' done' : '')}>
                  <span className="n">{step > sd.n ? '✓' : sd.n}</span>{step >= sd.n ? sd.label : ''}
                </span>
              </div>
            ))}
          </div>

          {/* ① Basics */}
          {step === 1 && (
            <div className="stepbody">
              <label className="fl">Cover photos (up to 6) — the first is the cover <span className="req">*</span></label>
              <input className="t" type="file" accept="image/*" multiple onChange={e => uploadImages(e.target.files, 'cover')} />
              {uploading === 'cover' && <div className="sub">Uploading…</div>}
              {draft.images.length > 0 && <div className="imgs">{draft.images.map((u, i) => <img key={i} className="thumb" src={u} alt="" />)}</div>}
              <div className="row">
                <div style={{ flex: 1, minWidth: 170 }}>
                  <label className="fl">Product name <span className="req">*</span></label>
                  <input className="t" value={draft.name} onChange={e => setDraft(d => ({ ...d, name: e.target.value }))} placeholder="e.g. Oakwood 3-Seater Sofa" />
                </div>
                <div style={{ flex: 1, minWidth: 150 }}>
                  <label className="fl">Brand</label>
                  <input className="t" list="brandlist" value={draft.brand}
                    onChange={e => { const v = e.target.value; setDraft(d => ({ ...d, brand: v })); loadBrands(vertical, v); }}
                    placeholder="Search or type your brand" />
                  <datalist id="brandlist">{brandOpts.map(b => <option key={b} value={b} />)}</datalist>
                </div>
              </div>
              <div className="row">
                <div style={{ width: 130 }}>
                  <label className="fl">Price ₹ <span className="req">*</span></label>
                  <input className="t" type="number" value={draft.price} onChange={e => setDraft(d => ({ ...d, price: e.target.value }))} placeholder="0" />
                </div>
                <div style={{ width: 110 }}>
                  <label className="fl">Stock</label>
                  <input className="t" type="number" value={draft.stock} onChange={e => setDraft(d => ({ ...d, stock: e.target.value }))} placeholder="—" />
                </div>
                <div style={{ flex: 1, minWidth: 150 }}>
                  <label className="fl">SKU <span className="muted2">(auto — leave blank)</span></label>
                  <input className="t" value={draft.sku} onChange={e => setDraft(d => ({ ...d, sku: e.target.value }))} placeholder="auto-generated" />
                </div>
              </div>
            </div>
          )}

          {/* ② Variants — only the variant-role facets + per-colour pics & stock */}
          {step === 2 && (
            <div className="stepbody">
              {variantFacets.map(renderFacet)}
              {selectedColors.length > 0 && (
                <>
                  <div className="sec">Variant photos &amp; stock — per colour</div>
                  {selectedColors.map(color => {
                    const cv = draft.variants[color] || { images: [], stock: {} };
                    return (
                      <div key={color} className="vcard">
                        <div className="vhead"><span className="dot" />{color}</div>
                        <label className="fl">Photos for {color}</label>
                        <input className="t" type="file" accept="image/*" multiple onChange={e => uploadImages(e.target.files, color)} />
                        {uploading === color && <div className="sub">Uploading…</div>}
                        {arr(cv.images).length > 0 && <div className="imgs">{cv.images.map((u, i) => <img key={i} className="thumb" src={u} alt="" />)}</div>}
                        {selectedVariants.length > 0 && (
                          <>
                            <label className="fl">Stock per {stockFacet?.label || 'variant'}</label>
                            <div className="vstock">{selectedVariants.map(val => (
                              <div key={val} className="vsize">
                                <span>{val}</span>
                                <input type="number" placeholder="0" value={cv.stock?.[val] ?? ''} onChange={e => setColorVariantStock(color, val, e.target.value)} />
                              </div>
                            ))}</div>
                          </>
                        )}
                      </div>
                    );
                  })}
                </>
              )}
            </div>
          )}

          {/* ③ Details — required attrs lead, the rest under "More details" */}
          {step === 3 && (
            <div className="stepbody">
              {requiredDetails.map(renderFacet)}
              {optionalDetails.length > 0 && (
                <>
                  <div className="more" onClick={() => setMoreOpen(o => !o)}>
                    {moreOpen ? '▾' : '▸'} More details (optional) — {optionalDetails.length} field{optionalDetails.length > 1 ? 's' : ''}
                  </div>
                  {moreOpen && optionalDetails.map(renderFacet)}
                </>
              )}
              {requiredDetails.length === 0 && optionalDetails.length === 0 &&
                <div className="sub" style={{ marginTop: 10 }}>No extra details for this item type — continue to review.</div>}
            </div>
          )}

          {/* ④ Review */}
          {step === 4 && (
            <div className="stepbody review">
              {draft.images[0] && <img className="revimg" src={draft.images[0]} alt="" />}
              <div className="revname">{draft.name || '(unnamed)'}</div>
              <div className="revmeta">₹{draft.price || '0'}{draft.brand ? ` · ${draft.brand}` : ''}</div>
              {selectedColors.length > 0 && (
                <div className="revrow">{selectedColors.map(c => {
                  const tot = stockKey && draft.variants[c]?.stock ? Object.values(draft.variants[c].stock).reduce((a, b) => a + (Number(b) || 0), 0) : null;
                  return <span key={c} className="pill v">{c}{tot != null ? ` ·${tot}` : ''}</span>;
                })}</div>
              )}
              <div className="revrow">{detailFacets.map(f => {
                const v = draft.facets[f.facet_key]; const txt = Array.isArray(v) ? v.join(', ') : v;
                return txt ? <span key={f.facet_key} className="pill">{txt}</span> : null;
              })}</div>
            </div>
          )}

          {/* Step navigation */}
          <div className="nav">
            {step > 1
              ? <button className="btn ghost" onClick={goBack}>‹ Back</button>
              : <button className="btn ghost" onClick={() => jumpTo(crumb.length - 1)}>‹ Pick another type</button>}
            {step < 4
              ? <button className={'btn ink' + (stepBlocked.length ? ' dis' : '')} onClick={goNext}>Next ›</button>
              : <button className="btn yellow" onClick={addItem}>+ Add this item</button>}
          </div>
          {step < 4 && stepBlocked.length > 0 && <div className="hint">Still needed: {stepBlocked.join(', ')}</div>}

          {items.length > 0 && (
            <>
              <div className="sec">Staged under {leaf.name} ({items.length})</div>
              {items.map((it, i) => (
                <div key={i} className="added">
                  <div>
                    <div style={{ fontWeight: 700 }}>{it.name}{it.brand ? <span className="brandtag">{it.brand}</span> : null}</div>
                    <div className="sub">₹{it.price}{it.variants ? ` · ${it.variants.length} colour(s)` : ''} · {Object.values(it.facets).flat().filter(Boolean).slice(0, 4).join(' · ') || '—'}</div>
                  </div>
                  <button className="x" onClick={() => setItems(list => list.filter((_, j) => j !== i))}>×</button>
                </div>
              ))}
              <button className="btn ink" disabled={saving} onClick={saveBatch} style={{ marginTop: 6 }}>
                {saving ? 'Saving…' : `Save all ${items.length} product(s)`}
              </button>
            </>
          )}
          </>)}

          {mode === 'bulk' && (
            <div className="bulkwrap">
              <div className="brow">
                <div className="bcard">
                  <div className="bcn">1 · Download template</div>
                  <div className="bcd">An Excel built for <b>this item type's current specs</b> — with dropdowns where options are fixed.</div>
                  <a className="btn yellow" href={listingApi.templateUrl(leaf.id)}>⬇ {leaf.name}-template.xlsx</a>
                </div>
                <div className="bcard">
                  <div className="bcn">2 · Upload filled file</div>
                  <div className="bcd">One row per colour+size. We check every row, then create them all — or show what to fix.</div>
                  <label className={'btn ink' + (importing ? ' dis' : '')} style={{ display: 'inline-block', cursor: 'pointer' }}>
                    {importing ? 'Checking…' : '⬆ Choose .xlsx / .csv'}
                    <input type="file" accept=".xlsx,.csv" style={{ display: 'none' }} disabled={importing}
                      onChange={e => handleImport(e.target.files?.[0])} />
                  </label>
                </div>
              </div>
              <div className="bnote"><b>Auto-updating:</b> change a spec for this item type and the template here changes too — the sheet is always today's specs (stamped on the Instructions tab).</div>

              {importFileErr && <div className="err">{importFileErr}</div>}
              {importErrors && (
                <div className="err">
                  <div style={{ fontWeight: 800, marginBottom: 6 }}>{importErrors.length} product(s) need fixing — nothing was saved</div>
                  {importErrors.slice(0, 25).map((p, i) => (
                    <div key={i} className="erow"><b>{p.name}</b>{p.rows?.length ? ` (row ${p.rows.join(', ')})` : ''} — {p.errors.join('; ')}</div>
                  ))}
                </div>
              )}

              {imported.length > 0 && (
                <>
                  <div className="sec">Add photos — {imported.length} just imported</div>
                  {imported.map(p => (
                    <div key={p.id} className="trow">
                      {p.image_url ? <img className="tph" src={p.image_url} alt="" /> : <span className="tph ph">＋</span>}
                      <div>
                        <div style={{ fontWeight: 700 }}>{p.name}</div>
                        <div className="sub">{p.sku}{p.image_url ? ' · photo added' : ' · needs photos'}</div>
                      </div>
                      <label className="btn ghost" style={{ marginLeft: 'auto', cursor: 'pointer' }}>
                        {trayUploading === p.id ? 'Uploading…' : '＋ Add photos'}
                        <input type="file" accept="image/*" style={{ display: 'none' }}
                          onChange={e => addTrayPhoto(p.id, e.target.files)} />
                      </label>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const CSS = `
.lst *{box-sizing:border-box}
.lst{--white:#fff;--bg:#FAFAFA;--bg2:#F4F4F5;--yellow:#FFC107;--yellow-pale:#FFF7CC;--yellow-text:#6B5A00;
  --ink:#0A0A0A;--ink2:#1F1F22;--muted:#52525B;--muted2:#71717A;--muted3:#A1A1AA;--border:#E4E4E7;
  --success:#10B981;--success-pale:#D1FAE5;--success-text:#047857;--danger:#E8401A;--danger-pale:#FDEEE9;
  --variant:#7E22CE;--variant-pale:#F3E8FF;--disc:#0E7490;--disc-pale:#CFFAFE;--info:#1D4ED8;--info-pale:#DBEAFE;
  font-family:'Plus Jakarta Sans','Outfit',system-ui,sans-serif;color:var(--ink);font-size:13px;line-height:1.45}
.lst h1{font-family:'Outfit',sans-serif;font-size:22px;font-weight:700;letter-spacing:-.3px;margin:0}
.lst .rule{width:42px;height:3px;background:var(--yellow);border-radius:2px;margin:6px 0 10px}
.lst .sub{font-size:12px;color:var(--muted2);max-width:680px}
.lst .setuplink{font-size:12px;font-weight:700;color:var(--ink2);background:var(--bg2);border:1px solid var(--border);border-radius:9px;padding:7px 12px;text-decoration:none;white-space:nowrap}
.lst .setuplink:hover{border-color:var(--yellow)}
.lst .muted2{color:var(--muted3);font-weight:500}
.lst .crumb{display:flex;flex-wrap:wrap;gap:5px;align-items:center;font-size:12px;color:var(--muted2);margin:14px 0;font-weight:600}
.lst .crumb b{color:var(--ink)} .lst .crumb a{color:var(--muted2);cursor:pointer} .lst .crumb a:hover{color:var(--ink)}
.lst .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:10px}
.lst .node{display:flex;align-items:center;justify-content:space-between;gap:8px;background:var(--white);border:1px solid var(--border);
  border-radius:12px;padding:13px 14px;cursor:pointer;transition:.12s}
.lst .node:hover{border-color:var(--yellow);transform:translateY(-1px)}
.lst .node.leaf{border-left:3px solid var(--yellow)}
.lst .node .nm{font-weight:700;font-size:13px} .lst .node .mt{font-size:10px;color:var(--muted3);margin-top:2px}
.lst .node .a{color:var(--muted3);font-size:16px}
.lst .panel{background:var(--white);border:1px solid var(--border);border-radius:14px;padding:16px;margin-top:10px}
.lst .phead{font-family:'Outfit';font-weight:800;font-size:16px} .lst .phead .done{font-size:11px;font-weight:700;color:var(--success-text);margin-left:6px}
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
.lst .vcard{border:1px solid var(--border);border-radius:12px;padding:12px;margin-top:8px;background:var(--bg)}
.lst .vhead{font-weight:800;font-size:13px;display:flex;align-items:center;gap:7px}
.lst .vhead .dot{width:12px;height:12px;border-radius:50%;border:1px solid var(--border);background:var(--variant-pale)}
.lst .vstock{display:flex;flex-wrap:wrap;gap:8px}
.lst .vsize{display:flex;align-items:center;gap:6px;background:var(--white);border:1px solid var(--border);border-radius:9px;padding:5px 8px}
.lst .vsize span{font-size:11px;font-weight:700;min-width:24px} .lst .vsize input{width:60px;border:0;border-bottom:1px solid var(--border);font-size:12px;padding:2px;font-family:inherit}
.lst .added{display:flex;align-items:center;gap:11px;background:var(--bg2);border:1px solid var(--border);border-radius:11px;padding:9px 11px;margin-bottom:7px}
.lst .added .x{color:var(--danger);background:0;border:0;font-size:17px;cursor:pointer;margin-left:auto}
.lst .brandtag{font-size:10px;font-weight:700;background:var(--info-pale);color:var(--info);padding:1px 7px;border-radius:6px;margin-left:7px}
.lst .err{background:var(--danger-pale);border:1px solid #f3c0b0;color:#9a2a12;border-radius:10px;padding:9px 12px;font-size:12px;font-weight:600;margin:10px 0}
.lst .ok{background:var(--success-pale);border:1px solid #9be3c4;color:var(--success-text);border-radius:10px;padding:9px 12px;font-size:12px;font-weight:700;margin:10px 0}
.lst .sec{font-size:11px;text-transform:uppercase;letter-spacing:.6px;color:var(--muted2);font-weight:800;margin:16px 0 8px}
.lst .steps{display:flex;align-items:center;gap:4px;margin-bottom:14px;flex-wrap:wrap}
.lst .stwrap{display:flex;align-items:center;gap:4px}
.lst .st{display:flex;align-items:center;gap:6px;font-size:11px;font-weight:700;color:var(--muted3)}
.lst .st .n{width:20px;height:20px;border-radius:50%;background:var(--bg2);display:flex;align-items:center;justify-content:center;font-size:11px;color:var(--muted2);border:1px solid var(--border)}
.lst .st.on{color:var(--ink)} .lst .st.on .n{background:var(--ink);color:var(--yellow);border-color:var(--ink)}
.lst .st.done .n{background:var(--success);color:#fff;border-color:var(--success)}
.lst .bar{width:18px;height:2px;background:var(--border)}
.lst .stepbody{min-height:120px}
.lst .nav{display:flex;justify-content:space-between;gap:10px;margin-top:16px;border-top:1px solid var(--border);padding-top:14px}
.lst .hint{font-size:11px;color:var(--danger);font-weight:700;margin-top:6px;text-align:right}
.lst .more{margin-top:12px;border:1px dashed var(--border);border-radius:9px;padding:9px 11px;font-size:12px;font-weight:700;color:var(--muted2);background:var(--bg);cursor:pointer;user-select:none}
.lst .more:hover{border-color:var(--yellow);color:var(--ink2)}
.lst .review{text-align:left}
.lst .revimg{width:80px;height:80px;border-radius:11px;object-fit:cover;border:1px solid var(--border);margin-bottom:8px}
.lst .revname{font-family:'Outfit';font-weight:800;font-size:16px}
.lst .revmeta{font-size:13px;color:var(--muted);font-weight:600;margin-top:2px}
.lst .revrow{margin-top:8px}
.lst .pill{display:inline-block;background:var(--bg2);border:1px solid var(--border);border-radius:6px;padding:2px 8px;font-size:11px;font-weight:700;margin:0 4px 4px 0}
.lst .pill.v{background:var(--variant-pale);color:var(--variant);border-color:#e7d3fb}
.lst .bulktabs{display:flex;gap:6px;margin:8px 0 14px}
.lst .btab{padding:8px 15px;border-radius:9px;font-size:12px;font-weight:800;border:1px solid var(--border);background:var(--bg);color:var(--muted2);cursor:pointer;user-select:none}
.lst .btab.on{background:var(--ink);color:#fff;border-color:var(--ink)}
.lst .bulkwrap{margin-top:4px}
.lst .brow{display:flex;gap:12px;flex-wrap:wrap}
.lst .bcard{flex:1;min-width:230px;border:1px solid var(--border);border-radius:12px;padding:14px;background:var(--bg)}
.lst .bcn{font-family:'Outfit';font-weight:800;font-size:14px;margin-bottom:3px}
.lst .bcd{font-size:11px;color:var(--muted2);line-height:1.5;margin-bottom:11px}
.lst .bnote{margin-top:12px;font-size:11px;color:var(--yellow-text);background:var(--yellow-pale);border:1px solid #f0e1a8;border-radius:9px;padding:10px 12px;line-height:1.5}
.lst .erow{font-size:12px;color:#7a2410;padding:3px 0;border-bottom:1px dashed #f0c4b4}
.lst .erow:last-child{border-bottom:0}
.lst .trow{display:flex;align-items:center;gap:11px;background:var(--white);border:1px solid var(--border);border-radius:11px;padding:9px 11px;margin-bottom:8px}
.lst .tph{width:42px;height:42px;border-radius:9px;object-fit:cover;border:1px solid var(--border)}
.lst .tph.ph{display:flex;align-items:center;justify-content:center;border:1.5px dashed var(--border);color:var(--muted3);font-size:17px}
`;
