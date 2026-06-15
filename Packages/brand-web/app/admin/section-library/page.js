'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import { adminApi } from '../../../lib/api';

/**
 * Section Library admin (contract: merch-engine-p3b-rule-builder-ui).
 *
 * Reusable, data-driven follower sections. Admin composes a section from filters
 * (sub-category + tags + price + sort) with a live "matches N products" preview.
 * Sections are inert until placed on a screen (Phase 3c). Navy admin theme.
 */

// Businesses whose products are sub-categorised in the drill-down tree (3a/3b).
// Others (food/beauty/cars) use category+tags+price+sort (no tree yet).
const TREE_VERTICALS = { fashion: 'fashion', furniture: 'furniture' };
const SORTS = [
  { key: 'newest', label: 'Newest' },
  { key: 'price_asc', label: 'Price: low → high' },
  { key: 'price_desc', label: 'Price: high → low' },
];
const EMPTY = { business_type: '', name: '', image_url: '', sort: 'newest',
  subcategory_node_id: '', subcategory_label: '', tags: [], price_min: '', price_max: '' };

// Flatten the nested category tree into indented, selectable rows.
function flattenTree(roots, depth = 0, out = []) {
  for (const n of roots || []) {
    out.push({ id: n.id, name: n.name, depth });
    if (n.children && n.children.length) flattenTree(n.children, depth + 1, out);
  }
  return out;
}

export default function SectionLibraryPage() {
  const [rows, setRows] = useState([]);
  const [businesses, setBusinesses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);   // null | 'new' | row
  const [form, setForm] = useState(EMPTY);
  const [tree, setTree] = useState([]);
  const [tags, setTags] = useState([]);
  const [preview, setPreview] = useState(null);
  const [previewing, setPreviewing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(null);
  const [toast, setToast] = useState('');
  const debRef = useRef(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [secRes, bizRes] = await Promise.all([
      adminApi.listSectionLibrary(),
      adminApi.listFollowerCategories(),
    ]);
    setLoading(false);
    if (secRes.success) setRows(secRes.data?.sections || []);
    if (bizRes.success) setBusinesses((bizRes.data?.categories || []).filter(c => c.status === 'active'));
  }, []);
  useEffect(() => { load(); }, [load]);

  function showToast(m) { setToast(m); setTimeout(() => setToast(''), 2500); }

  // Load tree + tags for a business.
  const loadBusinessMeta = useCallback(async (bt) => {
    setTags([]); setTree([]);
    if (!bt) return;
    const tagRes = await adminApi.listTagVocabulary(bt);
    if (tagRes.success) setTags((tagRes.data?.tags || []).filter(t => t.status === 'active'));
    const vertical = TREE_VERTICALS[bt];
    if (vertical) {
      const treeRes = await adminApi.getListingTree(vertical);
      if (treeRes.success) setTree(flattenTree(treeRes.data?.tree || treeRes.data || []));
    }
  }, []);

  function openCreate() {
    const bt = businesses[0]?.key || '';
    const f = { ...EMPTY, business_type: bt };
    setForm(f); setFormError(null); setPreview(null); setEditing('new');
    loadBusinessMeta(bt);
  }
  function openEdit(s) {
    const r = s.rule_json || {};
    const f = {
      business_type: s.business_type, name: s.name || '', image_url: s.image_url || '',
      sort: r.sort || 'newest',
      subcategory_node_id: r.subcategory_node_id || '', subcategory_label: '',
      tags: Array.isArray(r.tags) ? r.tags : [],
      price_min: r.price_min ?? '', price_max: r.price_max ?? '',
    };
    setForm(f); setFormError(null); setPreview(null); setEditing(s);
    loadBusinessMeta(s.business_type);
  }

  function patch(changes) { setForm(prev => ({ ...prev, ...changes })); }

  function onBusinessChange(bt) {
    patch({ business_type: bt, subcategory_node_id: '', subcategory_label: '', tags: [] });
    loadBusinessMeta(bt);
  }
  function toggleTag(slug) {
    setForm(prev => ({ ...prev, tags: prev.tags.includes(slug) ? prev.tags.filter(t => t !== slug) : [...prev.tags, slug] }));
  }

  function buildRuleJson(f) {
    const rule = { sort: f.sort || 'newest' };
    if (f.subcategory_node_id) rule.subcategory_node_id = f.subcategory_node_id;
    if (f.tags.length) rule.tags = f.tags;
    if (f.price_min !== '' && f.price_min != null) rule.price_min = Number(f.price_min);
    if (f.price_max !== '' && f.price_max != null) rule.price_max = Number(f.price_max);
    return rule;
  }

  // Debounced live preview whenever the rule changes.
  useEffect(() => {
    if (!editing || !form.business_type) return;
    if (debRef.current) clearTimeout(debRef.current);
    debRef.current = setTimeout(async () => {
      setPreviewing(true);
      const res = await adminApi.previewSectionLibrary({
        business_type: form.business_type, rule_json: buildRuleJson(form),
      });
      setPreviewing(false);
      if (res.success) setPreview(res.data);
    }, 350);
    return () => debRef.current && clearTimeout(debRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing, form.business_type, form.subcategory_node_id, JSON.stringify(form.tags), form.price_min, form.price_max, form.sort]);

  async function handleSave() {
    setFormError(null);
    if (!form.name.trim()) { setFormError('Name is required.'); return; }
    if (!form.business_type) { setFormError('Pick a business.'); return; }
    if (form.price_min !== '' && form.price_max !== '' && Number(form.price_min) > Number(form.price_max)) {
      setFormError('Min price must be ≤ max price.'); return;
    }
    const payload = {
      business_type: form.business_type, name: form.name.trim(),
      image_url: form.image_url.trim() || null, rule_json: buildRuleJson(form),
    };
    setSaving(true);
    const res = editing === 'new'
      ? await adminApi.createSectionLibrary(payload)
      : await adminApi.updateSectionLibrary(editing.id, payload);
    setSaving(false);
    if (res.success) { setEditing(null); showToast(editing === 'new' ? 'Section created.' : 'Section saved.'); load(); }
    else setFormError(res.error?.message || 'Save failed.');
  }

  async function toggleHide(s) {
    const next = s.status === 'active' ? 'hidden' : 'active';
    const res = await adminApi.updateSectionLibrary(s.id, { status: next });
    if (res.success) { showToast(next === 'hidden' ? `Hid “${s.name}”.` : `Showing “${s.name}”.`); load(); }
    else alert(res.error?.message || 'Could not change status.');
  }

  const labelOf = (k) => businesses.find(b => b.key === k)?.label || k;
  const grouped = rows.reduce((acc, s) => { (acc[s.business_type] = acc[s.business_type] || []).push(s); return acc; }, {});
  const hasTree = !!TREE_VERTICALS[form.business_type];

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="font-display text-xl font-bold text-t1">Section Library</h1>
          <p className="text-xs text-t3 mt-0.5">
            Reusable shelves built from filters. A section auto-fills with the right products; place it on a screen (next step) to show followers.
          </p>
        </div>
        <button onClick={openCreate} className="px-4 py-2 bg-navy hover:bg-navy/90 text-white text-xs font-bold rounded-xl">+ New section</button>
      </div>

      {loading ? (
        <div className="bg-white rounded-2xl border border-border p-12 text-center text-sm text-t3">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="bg-white rounded-2xl border border-border p-12 text-center text-sm text-t3">No sections yet — create the first one.</div>
      ) : (
        Object.keys(grouped).map(bt => (
          <div key={bt} className="mb-6">
            <div className="text-[11px] font-bold uppercase tracking-wider text-t3 mb-2">{labelOf(bt)}</div>
            <div className="bg-white rounded-2xl border border-border overflow-hidden">
              {grouped[bt].map(s => {
                const r = s.rule_json || {};
                return (
                  <div key={s.id} className="grid grid-cols-12 items-center px-5 py-3.5 border-t border-border first:border-t-0">
                    <div className="col-span-4 flex items-center gap-3">
                      <span className="w-9 h-9 rounded-lg bg-navy-pale flex items-center justify-center text-base">{s.image_url ? '🖼️' : '🧩'}</span>
                      <div>
                        <div className="text-sm font-bold text-t1">{s.name}</div>
                        {s.status === 'hidden' && <div className="text-[10px] text-t3">hidden</div>}
                      </div>
                    </div>
                    <div className="col-span-6 flex flex-wrap gap-1.5">
                      {r.subcategory_node_id && <span className="text-[10.5px] font-semibold px-2 py-0.5 rounded-full bg-surface2 text-t2">sub-category</span>}
                      {(r.tags || []).map(t => <span key={t} className="text-[10.5px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">#{t}</span>)}
                      {r.price_min != null && <span className="text-[10.5px] font-semibold px-2 py-0.5 rounded-full bg-surface2 text-t2">≥ ₹{r.price_min}</span>}
                      {r.price_max != null && <span className="text-[10.5px] font-semibold px-2 py-0.5 rounded-full bg-surface2 text-t2">≤ ₹{r.price_max}</span>}
                      <span className="text-[10.5px] font-semibold px-2 py-0.5 rounded-full bg-surface2 text-t3">{(SORTS.find(x => x.key === r.sort) || SORTS[0]).label}</span>
                    </div>
                    <div className="col-span-2 flex justify-end gap-2">
                      <button onClick={() => openEdit(s)} className="text-xs font-bold text-navy border border-navy/30 rounded-lg px-3 py-1.5">Edit</button>
                      <button onClick={() => toggleHide(s)} className="text-xs font-semibold text-t3 border border-border rounded-lg px-3 py-1.5 hover:text-t1">{s.status === 'active' ? 'Hide' : 'Show'}</button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))
      )}

      {editing && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => !saving && setEditing(null)}>
          <div className="bg-white rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-border px-5 py-3">
              <div className="font-display text-base font-bold text-t1">{editing === 'new' ? 'New section' : `Edit: ${editing.name}`}</div>
              <button onClick={() => !saving && setEditing(null)} className="text-t3 hover:text-t1 text-xl leading-none">×</button>
            </div>

            <div className="grid grid-cols-5">
              {/* form */}
              <div className="col-span-3 px-5 py-4 border-r border-border space-y-3.5 max-h-[70vh] overflow-auto">
                {formError && <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg px-3 py-2">{formError}</div>}
                <div>
                  <label className="block text-[11px] font-bold text-t2 mb-1">Name</label>
                  <input value={form.name} onChange={e => patch({ name: e.target.value })} className="w-full border border-border rounded-lg px-3 py-2 text-sm font-semibold" />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-t2 mb-1">Business</label>
                  <select value={form.business_type} onChange={e => onBusinessChange(e.target.value)} className="w-full border border-border rounded-lg px-3 py-2 text-sm">
                    {businesses.map(b => <option key={b.key} value={b.key}>{b.label}</option>)}
                  </select>
                </div>
                {hasTree ? (
                  <div>
                    <label className="block text-[11px] font-bold text-t2 mb-1">Sub-category <span className="text-t3 font-medium">(node + everything under it)</span></label>
                    <div className="border border-border rounded-lg p-2 max-h-36 overflow-auto text-xs bg-white">
                      <div onClick={() => patch({ subcategory_node_id: '', subcategory_label: '' })}
                        className={`px-2 py-1 rounded cursor-pointer ${!form.subcategory_node_id ? 'bg-navy-pale font-bold text-navy' : 'text-t2'}`}>Any</div>
                      {tree.map(n => (
                        <div key={n.id} onClick={() => patch({ subcategory_node_id: n.id, subcategory_label: n.name })}
                          style={{ paddingLeft: 8 + n.depth * 14 }}
                          className={`py-1 rounded cursor-pointer ${form.subcategory_node_id === n.id ? 'bg-navy-pale font-bold text-navy' : 'text-t2 hover:bg-surface2'}`}>
                          {n.name}{form.subcategory_node_id === n.id ? ' ✓' : ''}
                        </div>
                      ))}
                      {tree.length === 0 && <div className="px-2 py-1 text-t3 italic">No tree for this business.</div>}
                    </div>
                  </div>
                ) : (
                  <div className="text-[11px] text-t3 italic bg-surface2 rounded-lg px-3 py-2">Sub-category filtering isn’t available for this business yet — use tags / price below.</div>
                )}
                <div>
                  <label className="block text-[11px] font-bold text-t2 mb-1">Tags <span className="text-t3 font-medium">(must carry all selected)</span></label>
                  <div className="flex flex-wrap gap-1.5">
                    {tags.map(t => (
                      <button key={t.slug} type="button" onClick={() => toggleTag(t.slug)}
                        className={`text-[11px] font-semibold rounded-full px-2.5 py-1 border ${form.tags.includes(t.slug) ? 'bg-navy text-white border-navy' : 'bg-white text-t2 border-border'}`}>{t.label}</button>
                    ))}
                    {tags.length === 0 && <span className="text-[11px] text-t3 italic">No tags in this business’s vocabulary.</span>}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="block text-[11px] font-bold text-t2 mb-1">Min price ₹</label><input type="number" value={form.price_min} onChange={e => patch({ price_min: e.target.value })} className="w-full border border-border rounded-lg px-3 py-2 text-sm" /></div>
                  <div><label className="block text-[11px] font-bold text-t2 mb-1">Max price ₹</label><input type="number" value={form.price_max} onChange={e => patch({ price_max: e.target.value })} className="w-full border border-border rounded-lg px-3 py-2 text-sm" /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="block text-[11px] font-bold text-t2 mb-1">Sort</label>
                    <select value={form.sort} onChange={e => patch({ sort: e.target.value })} className="w-full border border-border rounded-lg px-3 py-2 text-sm">
                      {SORTS.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                    </select>
                  </div>
                  <div><label className="block text-[11px] font-bold text-t2 mb-1">Image URL <span className="text-t3 font-medium">(optional)</span></label><input value={form.image_url} onChange={e => patch({ image_url: e.target.value })} placeholder="https://…" className="w-full border border-border rounded-lg px-3 py-2 text-xs" /></div>
                </div>
              </div>

              {/* live preview */}
              <div className="col-span-2 px-5 py-4 bg-surface2 max-h-[70vh] overflow-auto">
                <div className="text-[10px] font-bold uppercase tracking-wider text-t3 mb-1">Live preview · platform</div>
                <div className="text-3xl font-black text-green-600">{previewing ? '…' : (preview?.count ?? '—')}{preview?.capped ? '+' : ''}</div>
                <div className="text-[11px] text-t2 mb-3">products match right now</div>
                <div className="grid grid-cols-2 gap-2">
                  {(preview?.sample || []).map(p => (
                    <div key={p.id} className="bg-white border border-border rounded-lg p-2">
                      <div className="h-12 rounded bg-navy-pale flex items-center justify-center text-lg mb-1.5 overflow-hidden">
                        {p.image_url ? <img src={p.image_url} alt="" className="h-12 w-full object-cover" /> : '🧩'}
                      </div>
                      <div className="text-[11px] font-bold leading-tight text-t1 line-clamp-2">{p.name}</div>
                      <div className="text-[11px] font-extrabold text-t1 mt-0.5">₹{p.price}</div>
                    </div>
                  ))}
                </div>
                <div className="text-[10px] text-t3 mt-3 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-2">
                  Counts only <b>gated</b> products (approved brand + pushed-to-store). On a creator’s store the same section shows only that creator’s allocated items — context stacks automatically.
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-3">
              <button onClick={() => !saving && setEditing(null)} disabled={saving} className="px-4 py-2 bg-surface2 text-t2 text-xs font-semibold rounded-xl hover:bg-navy-pale disabled:opacity-40">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="px-5 py-2 bg-navy text-white text-xs font-bold rounded-xl disabled:opacity-50">{saving ? 'Saving…' : (editing === 'new' ? 'Create section' : 'Save section')}</button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="fixed bottom-6 right-6 bg-t1 text-white text-xs font-semibold px-4 py-2 rounded-xl shadow-lg z-50">{toast}</div>}
    </div>
  );
}
