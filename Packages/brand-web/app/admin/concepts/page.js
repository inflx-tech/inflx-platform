'use client';
import { useEffect, useState, useCallback, useMemo } from 'react';
import { adminApi } from '../../../lib/api';

/**
 * Concept Template Manager (Post/Concept P1, mig 139).
 * Contract: features/concept-p1-engine/.
 *
 * Admin authors ~47 TEMPLATES; combined with the fashion listing tree's leaves
 * they yield thousands of addressable CONCEPTS — never stored as rows. The
 * preview answers "what would this concept catch RIGHT NOW" via the same
 * evaluator that renders follower shelves (library_products), so preview
 * truth = render truth. In P2 a creator picks one concept per post; posts
 * attach to discovery through it.
 *
 * Kinds → families: category+leaf=1 · price=2 · offer=3 · price+leaf=4 · offer+leaf=5.
 */

const KIND_TABS = [
  { key: 'category', label: 'Category' },
  { key: 'price', label: 'Price' },
  { key: 'offer', label: 'Offer' },
];
const GROUPS = ['seasonal', 'occasion', 'style', 'utility'];
const OFFER_TYPES = ['discount', 'volume', 'bogo', 'bundle', 'free_gift'];

const EMPTY_FORM = {
  kind: 'category', template_group: 'seasonal', name_pattern: '',
  required_tags: '', eff_price_min: '', eff_price_max: '',
  offer_type: 'discount', min_discount_pct: '', sort_order: '', status: 'active',
};

function ruleSummary(t) {
  const bits = [];
  if ((t.required_tags || []).length) bits.push(`tags: ${t.required_tags.join(', ')}`);
  if (t.eff_price_min != null && t.eff_price_max != null) bits.push(`eff ₹${t.eff_price_min}–₹${t.eff_price_max}`);
  else if (t.eff_price_max != null) bits.push(`eff ≤ ₹${t.eff_price_max}`);
  else if (t.eff_price_min != null) bits.push(`eff ≥ ₹${t.eff_price_min}`);
  if (t.offer_type) bits.push(`offer: ${t.offer_type}${t.min_discount_pct != null ? ` ≥${t.min_discount_pct}%` : ''}`);
  return bits.length ? bits.join(' · ') : '— discovery bucket (no filter)';
}

// Flatten the fashion tree to LEAVES only (concepts bind at the shoppable level).
function flattenLeaves(nodes, prefix = [], out = []) {
  for (const n of (nodes || [])) {
    if (n.is_leaf) out.push({ id: String(n.id), label: [...prefix, n.name].join(' › '), name: n.name });
    if (n.children?.length) flattenLeaves(n.children, [...prefix, n.name], out);
  }
  return out;
}

export default function ConceptsPage() {
  const [templates, setTemplates] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('category');
  const [toast, setToast] = useState('');

  const [editing, setEditing] = useState(null);    // null | 'new' | <template>
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(null);

  const [preview, setPreview] = useState(null);    // { template, leafId, loading, result, error }

  const load = useCallback(async () => {
    setLoading(true);
    const [tRes, treeRes] = await Promise.all([
      adminApi.listConceptTemplates(true),
      adminApi.getListingTree('fashion'),
    ]);
    setLoading(false);
    if (tRes.success) setTemplates(tRes.data?.templates || []);
    if (treeRes.success) setLeaves(flattenLeaves(treeRes.data?.tree || []));
  }, []);
  useEffect(() => { load(); }, [load]);

  function showToast(m) { setToast(m); setTimeout(() => setToast(''), 2500); }

  const visible = useMemo(() => templates.filter(t => t.kind === tab), [templates, tab]);
  const activeCounts = useMemo(() => {
    const by = { category: 0, price: 0, offer: 0 };
    templates.forEach(t => { if (t.status === 'active') by[t.kind] += 1; });
    return by;
  }, [templates]);
  const addressable = activeCounts.category * leaves.length
    + activeCounts.price * (1 + leaves.length)
    + activeCounts.offer * (1 + leaves.length);

  function openNew() {
    setForm({ ...EMPTY_FORM, kind: tab });
    setFormError(null); setEditing('new');
  }
  function openEdit(t) {
    setForm({
      kind: t.kind, template_group: t.template_group || 'seasonal',
      name_pattern: t.name_pattern, required_tags: (t.required_tags || []).join(', '),
      eff_price_min: t.eff_price_min ?? '', eff_price_max: t.eff_price_max ?? '',
      offer_type: t.offer_type || 'discount', min_discount_pct: t.min_discount_pct ?? '',
      sort_order: t.sort_order ?? '', status: t.status,
    });
    setFormError(null); setEditing(t);
  }

  async function handleSave() {
    const payload = {
      kind: form.kind,
      name_pattern: form.name_pattern.trim(),
      template_group: form.kind === 'category' ? form.template_group : null,
      required_tags: form.required_tags.split(',').map(s => s.trim()).filter(Boolean),
      eff_price_min: form.kind === 'price' && form.eff_price_min !== '' ? Number(form.eff_price_min) : null,
      eff_price_max: form.kind === 'price' && form.eff_price_max !== '' ? Number(form.eff_price_max) : null,
      offer_type: form.kind === 'offer' ? form.offer_type : null,
      min_discount_pct: form.kind === 'offer' && form.min_discount_pct !== '' ? Number(form.min_discount_pct) : null,
      sort_order: form.sort_order === '' ? 0 : Number(form.sort_order),
      status: form.status,
    };
    setSaving(true); setFormError(null);
    const res = editing === 'new'
      ? await adminApi.createConceptTemplate(payload)
      : await adminApi.updateConceptTemplate(editing.id, payload);
    setSaving(false);
    if (res.success) { setEditing(null); showToast(editing === 'new' ? 'Template created.' : 'Template updated.'); load(); }
    else setFormError(res.error?.message || 'Save failed.');
  }

  async function toggleHide(t) {
    const next = t.status === 'active' ? 'hidden' : 'active';
    const res = await adminApi.updateConceptTemplate(t.id, { status: next });
    if (res.success) { showToast(next === 'hidden' ? `Hid “${t.name_pattern}”.` : `Showing “${t.name_pattern}”.`); load(); }
    else alert(res.error?.message || 'Could not change status.');
  }

  function openPreview(t) {
    setPreview({ template: t, leafId: '', loading: false, result: null, error: null });
  }
  async function runPreview(leafId) {
    setPreview(p => ({ ...p, leafId, loading: true, result: null, error: null }));
    const res = await adminApi.previewConcept({
      template_id: preview.template.id,
      category_node_id: leafId || null,
    });
    setPreview(p => p && ({
      ...p, loading: false,
      result: res.success ? res.data : null,
      error: res.success ? null : (res.error?.message || 'Preview failed.'),
    }));
  }

  const groupedCategory = useMemo(() => {
    if (tab !== 'category') return null;
    const by = {};
    for (const g of GROUPS) by[g] = [];
    for (const t of visible) (by[t.template_group] || (by[t.template_group] = [])).push(t);
    return by;
  }, [tab, visible]);

  const renderRow = (t) => (
    <div key={t.id} className="grid grid-cols-12 items-center px-5 py-3 border-t border-border">
      <div className="col-span-5">
        <div className="text-sm font-bold text-t1">{t.name_pattern}</div>
        <div className="text-[10px] text-t3">{ruleSummary(t)}</div>
      </div>
      <div className="col-span-2 text-xs text-t2">{t.template_group || '—'}</div>
      <div className="col-span-2">
        {t.status === 'active'
          ? <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-pale text-green">Active</span>
          : <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-surface2 text-t3">Hidden</span>}
      </div>
      <div className="col-span-3 flex justify-end gap-2">
        <button onClick={() => openPreview(t)}
          className="text-xs font-bold text-white bg-navy rounded-lg px-3 py-1.5">Preview</button>
        <button onClick={() => openEdit(t)}
          className="text-xs font-bold text-navy border border-navy/30 rounded-lg px-3 py-1.5">Edit</button>
        <button onClick={() => toggleHide(t)}
          className="text-xs font-semibold text-t3 border border-border rounded-lg px-3 py-1.5 hover:text-t1">
          {t.status === 'active' ? 'Hide' : 'Show'}
        </button>
      </div>
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="font-display text-xl font-bold text-t1">Concepts</h1>
          <p className="text-xs text-t3 mt-0.5">
            Templates × the {leaves.length || '…'} shoppable categories = every concept a creator can publish under.
            One template here is instantly addressable across the whole tree.
          </p>
        </div>
        <div className="text-right">
          <div className="font-display text-lg font-bold text-navy">{addressable.toLocaleString()}</div>
          <div className="text-[10px] text-t3 uppercase tracking-wider">addressable concepts</div>
        </div>
      </div>

      {/* Kind tabs */}
      <div className="flex gap-2 mb-4">
        {KIND_TABS.map(k => (
          <button key={k.key} onClick={() => setTab(k.key)}
            className={`px-4 py-2 rounded-xl text-xs font-bold border-2 ${tab === k.key ? 'border-navy bg-navy-pale text-navy' : 'border-border text-t3 hover:border-t3'}`}>
            {k.label} <span className="opacity-60">({templates.filter(t => t.kind === k.key).length})</span>
          </button>
        ))}
        <div className="flex-1" />
        <button onClick={openNew}
          className="px-4 py-2 bg-navy text-white text-xs font-bold rounded-xl">+ New template</button>
      </div>

      {loading ? (
        <div className="bg-white rounded-2xl border border-border p-12 text-center text-sm text-t3">Loading templates…</div>
      ) : tab === 'category' ? (
        GROUPS.map(g => (groupedCategory[g] || []).length > 0 && (
          <div key={g} className="bg-white rounded-2xl border border-border overflow-hidden mb-4">
            <div className="px-5 py-2.5 bg-surface2 text-[10px] font-bold uppercase tracking-wider text-t3">{g} ({groupedCategory[g].length})</div>
            {groupedCategory[g].map(renderRow)}
          </div>
        ))
      ) : (
        <div className="bg-white rounded-2xl border border-border overflow-hidden">
          <div className="grid grid-cols-12 px-5 py-2.5 bg-surface2 text-[10px] font-bold uppercase tracking-wider text-t3">
            <div className="col-span-5">Template</div>
            <div className="col-span-2">Group</div>
            <div className="col-span-2">Status</div>
            <div className="col-span-3 text-right">Actions</div>
          </div>
          {visible.map(renderRow)}
          {visible.length === 0 && <div className="px-5 py-10 text-center text-sm text-t3">No {tab} templates yet.</div>}
        </div>
      )}

      {/* Add / edit modal */}
      {editing && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => !saving && setEditing(null)}>
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-border px-5 py-3">
              <div className="font-display text-base font-bold text-t1">
                {editing === 'new' ? 'New concept template' : `Edit: ${editing.name_pattern}`}
              </div>
              <button onClick={() => !saving && setEditing(null)} className="text-t3 hover:text-t1 text-xl leading-none">×</button>
            </div>
            <div className="px-5 py-4 space-y-4">
              {formError && <div className="bg-red-pale border border-red/20 text-red text-xs rounded-lg px-3 py-2">{formError}</div>}
              {editing === 'new' && (
                <div>
                  <label className="block text-[11px] font-bold text-t2 mb-1">Kind</label>
                  <div className="flex gap-2">
                    {KIND_TABS.map(k => (
                      <button key={k.key} onClick={() => setForm({ ...form, kind: k.key })}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold border-2 ${form.kind === k.key ? 'border-navy bg-navy-pale text-navy' : 'border-border text-t3'}`}>
                        {k.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <label className="block text-[11px] font-bold text-t2 mb-1">
                  Name {form.kind === 'category' && <span className="font-normal text-t3">(must contain {'{Category}'})</span>} <span className="text-red">*</span>
                </label>
                <input value={form.name_pattern} onChange={e => setForm({ ...form, name_pattern: e.target.value })}
                  placeholder={form.kind === 'category' ? 'Resort {Category}' : form.kind === 'price' ? 'Under ₹699' : 'Mega BOGO'}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm font-semibold" />
              </div>
              {form.kind === 'category' && (
                <>
                  <div>
                    <label className="block text-[11px] font-bold text-t2 mb-1">Group</label>
                    <select value={form.template_group} onChange={e => setForm({ ...form, template_group: e.target.value })}
                      className="w-full border border-border rounded-lg px-3 py-2 text-xs">
                      {GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-t2 mb-1">Required tags <span className="font-normal text-t3">(comma-separated; empty = discovery bucket, no product filter)</span></label>
                    <input value={form.required_tags} onChange={e => setForm({ ...form, required_tags: e.target.value })}
                      placeholder="winter, warm" className="w-full border border-border rounded-lg px-3 py-2 text-xs" />
                  </div>
                </>
              )}
              {form.kind === 'price' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-t2 mb-1">Min ₹ (after discount)</label>
                    <input type="number" value={form.eff_price_min} onChange={e => setForm({ ...form, eff_price_min: e.target.value })}
                      className="w-full border border-border rounded-lg px-3 py-2 text-xs" />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-t2 mb-1">Max ₹ (after discount)</label>
                    <input type="number" value={form.eff_price_max} onChange={e => setForm({ ...form, eff_price_max: e.target.value })}
                      className="w-full border border-border rounded-lg px-3 py-2 text-xs" />
                  </div>
                </div>
              )}
              {form.kind === 'offer' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-t2 mb-1">Offer type</label>
                    <select value={form.offer_type} onChange={e => setForm({ ...form, offer_type: e.target.value })}
                      className="w-full border border-border rounded-lg px-3 py-2 text-xs">
                      {OFFER_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-t2 mb-1">Min discount % <span className="font-normal text-t3">(discount only)</span></label>
                    <input type="number" value={form.min_discount_pct} onChange={e => setForm({ ...form, min_discount_pct: e.target.value })}
                      className="w-full border border-border rounded-lg px-3 py-2 text-xs" />
                  </div>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-t2 mb-1">Sort order</label>
                  <input type="number" value={form.sort_order} onChange={e => setForm({ ...form, sort_order: e.target.value })}
                    placeholder="0" className="w-full border border-border rounded-lg px-3 py-2 text-xs" />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-t2 mb-1">Status</label>
                  <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}
                    className="w-full border border-border rounded-lg px-3 py-2 text-xs">
                    <option value="active">Active</option>
                    <option value="hidden">Hidden</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-3">
              <button onClick={() => !saving && setEditing(null)} disabled={saving}
                className="px-4 py-2 bg-surface2 text-t2 text-xs font-semibold rounded-xl disabled:opacity-40">Cancel</button>
              <button onClick={handleSave} disabled={saving || !form.name_pattern.trim()}
                className="px-5 py-2 bg-navy text-white text-xs font-bold rounded-xl disabled:opacity-50">
                {saving ? 'Saving…' : editing === 'new' ? 'Create template' : 'Save changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Preview modal */}
      {preview && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setPreview(null)}>
          <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-border px-5 py-3">
              <div className="font-display text-base font-bold text-t1">Preview: {preview.template.name_pattern}</div>
              <button onClick={() => setPreview(null)} className="text-t3 hover:text-t1 text-xl leading-none">×</button>
            </div>
            <div className="px-5 py-4 space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-t2 mb-1">
                  Shoppable category {preview.template.kind === 'category'
                    ? <span className="text-red">*</span>
                    : <span className="font-normal text-t3">(optional — empty previews the template platform-wide)</span>}
                </label>
                <select value={preview.leafId} onChange={e => runPreview(e.target.value)}
                  className="w-full border border-border rounded-lg px-3 py-2 text-xs">
                  <option value="">{preview.template.kind === 'category' ? 'Pick a category…' : 'All categories'}</option>
                  {leaves.map(l => <option key={l.id} value={l.id}>{l.label}</option>)}
                </select>
                {preview.template.kind !== 'category' && !preview.result && !preview.loading && (
                  <button onClick={() => runPreview('')}
                    className="mt-2 px-4 py-2 bg-navy text-white text-xs font-bold rounded-lg">Preview platform-wide</button>
                )}
              </div>
              {preview.loading && <div className="text-sm text-t3 py-6 text-center">Running the live rule…</div>}
              {preview.error && <div className="bg-red-pale border border-red/20 text-red text-xs rounded-lg px-3 py-2">{preview.error}</div>}
              {preview.result && (
                <div>
                  <div className="flex items-baseline justify-between mb-3">
                    <div>
                      <div className="font-display text-lg font-bold text-t1">{preview.result.name}</div>
                      <div className="text-[10px] text-t3">family {preview.result.family} · rule: {JSON.stringify(preview.result.rule_json)}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-display text-xl font-bold text-navy">{preview.result.count}{preview.result.capped ? '+' : ''}</div>
                      <div className="text-[10px] text-t3 uppercase tracking-wider">live products</div>
                    </div>
                  </div>
                  {preview.result.count === 0 ? (
                    <div className="bg-surface2 rounded-xl px-4 py-6 text-center text-xs text-t3">
                      No live products match right now — the concept still exists; it fills as brands list/offer matching products.
                    </div>
                  ) : (
                    <div className="grid grid-cols-4 gap-3">
                      {preview.result.sample.map(p => (
                        <div key={p.id} className="border border-border rounded-xl overflow-hidden">
                          {p.image_url
                            ? <img src={p.image_url} alt="" className="w-full h-24 object-cover" />
                            : <div className="w-full h-24 bg-surface2" />}
                          <div className="p-2">
                            <div className="text-[11px] font-bold text-t1 truncate">{p.name}</div>
                            <div className="text-[10px] text-t3">
                              ₹{p.offer_price ?? p.price}{p.discount_value ? ` · ${p.discount_value}% off` : ''}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 right-6 bg-t1 text-white text-xs font-semibold px-4 py-2 rounded-xl shadow-lg z-50">{toast}</div>
      )}
    </div>
  );
}
