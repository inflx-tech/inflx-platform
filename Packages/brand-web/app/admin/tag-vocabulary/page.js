'use client';
import { useEffect, useState, useCallback, useMemo } from 'react';
import { adminApi } from '../../../lib/api';

/**
 * Tag Vocabulary admin CRUD page (contract: merch-engine-p1a-product-tags).
 *
 * The fixed tags brands pick from while listing a product, and that admin
 * Collections will rule on in later phases. Keyed by `scope` = a business type
 * (a brand_products.category_key value) OR 'ALL' for cross-business tags.
 * Brands may also add their OWN free tags while listing — those are not managed
 * here. Hiding a tag removes it from the brand picker but never touches a
 * product already tagged with it (tags are snapshot slugs, not an FK).
 *
 * Built in the admin navy theme (consistent with the rest of /admin) — the
 * gold/cream palette is the follower-app standard, not the internal tool.
 */

// Starter scopes so the page isn't empty before any tag exists. Admin can add
// any scope via "+ business" (it should match a brand's category_key). When
// contract 1b formalises follower categories, scopes regroup under those.
// 'fashion' is the WORLD scope — tags here reach all three fashion category
// keys (fashion / fashion_walkin / fashion_online); curate fashion tags here
// (contract listing-tags-at-add).
const DEFAULT_SCOPES = ['ALL', 'restaurant', 'fashion', 'fashion_walkin', 'salon', 'car_rental', 'furniture'];

const EMPTY_FORM = { label: '', sort_order: '', status: 'active' };

export default function TagVocabularyPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [scope, setScope] = useState('ALL');

  const [editing, setEditing] = useState(null);   // null | <tag object>
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(null);

  const [newLabel, setNewLabel] = useState('');
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState(null);

  const [toast, setToast] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const res = await adminApi.listTagVocabulary();   // all scopes
    setLoading(false);
    if (res.success) setRows(res.data?.tags || []);
  }, []);

  useEffect(() => { load(); }, [load]);

  function showToast(m) { setToast(m); setTimeout(() => setToast(''), 2500); }

  // Scope chips = defaults ∪ scopes seen in data (ALL pinned first).
  const scopes = useMemo(() => {
    const set = new Set(DEFAULT_SCOPES);
    rows.forEach(r => set.add(r.scope));
    const all = Array.from(set);
    return ['ALL', ...all.filter(s => s !== 'ALL').sort()];
  }, [rows]);

  const visible = useMemo(
    () => rows.filter(r => r.scope === scope)
              .sort((a, b) => (a.sort_order - b.sort_order) || a.label.localeCompare(b.label)),
    [rows, scope]
  );

  async function handleAdd() {
    const label = newLabel.trim();
    if (!label) return;
    setAdding(true); setAddError(null);
    const res = await adminApi.createTagVocab({ scope, label });
    setAdding(false);
    if (res.success) { setNewLabel(''); showToast(`Added “${label}”.`); load(); }
    else setAddError(res.error?.message || 'Could not add tag.');
  }

  function openEdit(tag) {
    setForm({ label: tag.label || '', sort_order: tag.sort_order ?? '', status: tag.status || 'active' });
    setFormError(null);
    setEditing(tag);
  }

  async function handleSave() {
    if (!editing) return;
    const label = form.label.trim();
    if (!label) { setFormError('Label cannot be empty.'); return; }
    setSaving(true); setFormError(null);
    const res = await adminApi.updateTagVocab(editing.id, {
      label,
      sort_order: form.sort_order === '' ? 0 : Number(form.sort_order),
      status: form.status,
    });
    setSaving(false);
    if (res.success) { setEditing(null); showToast('Tag updated.'); load(); }
    else setFormError(res.error?.message || 'Save failed.');
  }

  async function toggleHide(tag) {
    const next = tag.status === 'active' ? 'hidden' : 'active';
    const res = await adminApi.updateTagVocab(tag.id, { status: next });
    if (res.success) { showToast(next === 'hidden' ? `Hid “${tag.label}”.` : `Showing “${tag.label}”.`); load(); }
    else alert(res.error?.message || 'Could not change status.');
  }

  function addScope() {
    const s = window.prompt('New business scope (a brand category_key, e.g. fashion_online). Use ALL for every business.');
    if (s && s.trim()) setScope(s.trim());
  }

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="font-display text-xl font-bold text-t1">Tag Vocabulary</h1>
          <p className="text-xs text-t3 mt-0.5">
            Fixed tags brands choose from while listing. You build Collections on these. Brands can also add their own free tags.
          </p>
        </div>
      </div>

      {/* Scope chips */}
      <div className="bg-white rounded-2xl border border-border p-4 mb-4">
        <div className="text-[10px] font-bold text-t3 uppercase tracking-wider mb-1.5">Business scope</div>
        <div className="flex gap-2 flex-wrap items-center">
          {scopes.map(s => (
            <button key={s} onClick={() => setScope(s)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold border-2 ${scope === s ? 'border-navy bg-navy-pale text-navy' : 'border-border text-t3 hover:border-t3'}`}>
              {s === 'ALL' ? '★ All businesses' : s}
            </button>
          ))}
          <button onClick={addScope}
            className="px-3 py-1.5 rounded-full text-xs font-bold border-2 border-dashed border-border text-t3 hover:border-navy hover:text-navy">
            ＋ business
          </button>
        </div>

        {/* Add tag to current scope */}
        <div className="flex gap-2 mt-4 max-w-md">
          <input value={newLabel} onChange={e => setNewLabel(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleAdd(); }}
            placeholder={scope === 'ALL' ? 'Add a cross-business tag — e.g. Trending' : `Add a ${scope} tag — e.g. Summer`}
            className="flex-1 border border-border rounded-lg px-3 py-2 text-xs" />
          <button onClick={handleAdd} disabled={adding || !newLabel.trim()}
            className="px-4 py-2 bg-navy hover:bg-navy/90 text-white text-xs font-bold rounded-lg disabled:opacity-40">
            {adding ? 'Adding…' : '+ Add tag'}
          </button>
        </div>
        {addError && <div className="text-[11px] text-red-600 mt-2">{addError}</div>}
      </div>

      {/* Tag table */}
      {loading ? (
        <div className="bg-white rounded-2xl border border-border p-12 text-center text-sm text-t3">Loading tags…</div>
      ) : (
        <div className="bg-white rounded-2xl border border-border overflow-hidden">
          <div className="grid grid-cols-12 px-5 py-2.5 bg-surface2 text-[10px] font-bold uppercase tracking-wider text-t3">
            <div className="col-span-5">Tag</div>
            <div className="col-span-2">Order</div>
            <div className="col-span-2">Status</div>
            <div className="col-span-3 text-right">Actions</div>
          </div>
          {visible.map(t => (
            <div key={t.id} className="grid grid-cols-12 items-center px-5 py-3.5 border-t border-border">
              <div className="col-span-5">
                <div className="text-sm font-bold text-t1">{t.label}</div>
                <div className="text-[10px] text-t3">{t.slug}</div>
              </div>
              <div className="col-span-2 text-xs text-t2">{t.sort_order}</div>
              <div className="col-span-2">
                {t.status === 'active'
                  ? <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-pale text-green">Active</span>
                  : <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-surface2 text-t3">Hidden</span>}
              </div>
              <div className="col-span-3 flex justify-end gap-2">
                <button onClick={() => openEdit(t)}
                  className="text-xs font-bold text-navy border border-navy/30 rounded-lg px-3 py-1.5">Edit</button>
                <button onClick={() => toggleHide(t)}
                  className="text-xs font-semibold text-t3 border border-border rounded-lg px-3 py-1.5 hover:text-t1">
                  {t.status === 'active' ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>
          ))}
          {visible.length === 0 && (
            <div className="px-5 py-10 text-center text-sm text-t3 border-t border-border">
              No tags in <strong>{scope === 'ALL' ? 'All businesses' : scope}</strong> yet — add the first one above.
            </div>
          )}
          <div className="px-5 py-3 border-t border-border text-[11px] text-t3 italic">
            Hidden tags leave the brand picker but stay on any product already tagged. ★ All-business tags appear in every business’s picker.
          </div>
        </div>
      )}

      {/* Edit modal */}
      {editing && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => !saving && setEditing(null)}>
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-border px-5 py-3">
              <div className="font-display text-base font-bold text-t1">Edit: {editing.label}</div>
              <button onClick={() => !saving && setEditing(null)} className="text-t3 hover:text-t1 text-xl leading-none">×</button>
            </div>
            <div className="px-5 py-4 space-y-4">
              {formError && <div className="bg-red-pale border border-red/20 text-red text-xs rounded-lg px-3 py-2">{formError}</div>}
              <div>
                <label className="block text-[11px] font-bold text-t2 mb-1">Label <span className="text-red">*</span></label>
                <input value={form.label} onChange={e => setForm({ ...form, label: e.target.value })}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm font-semibold" />
                <p className="text-[10px] text-t3 mt-1 italic">Renaming changes the slug Collections match on — re-check any rule using the old slug.</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-t2 mb-1">Sort order</label>
                  <input type="number" value={form.sort_order}
                    onChange={e => setForm({ ...form, sort_order: e.target.value })}
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
                className="px-4 py-2 bg-surface2 text-t2 text-xs font-semibold rounded-xl hover:bg-navy-pale disabled:opacity-40">Cancel</button>
              <button onClick={handleSave} disabled={saving}
                className="px-5 py-2 bg-navy text-white text-xs font-bold rounded-xl disabled:opacity-50">
                {saving ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 bg-t1 text-white text-xs font-semibold px-4 py-2 rounded-xl shadow-lg z-50">{toast}</div>
      )}
    </div>
  );
}
