'use client';
import { useEffect, useState, useCallback } from 'react';
import { adminApi } from '../../../../lib/api';

// L3 marketplace fee — category × Path A/B/C admin.
// Edits propagate to live transactions within ~60s (pricing.service cache TTL).

export default function PricingCategoriesPage() {
  const [cats, setCats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingKey, setEditingKey] = useState(null);
  const [form, setForm] = useState({});
  const [errors, setErrors] = useState({});
  const [toast, setToast] = useState(null);
  const [addOpen, setAddOpen] = useState(false);
  const [newRow, setNewRow] = useState({
    category_key: '', name: '', label: '',
    path_a_pct: '', path_b_pct: '', path_c_pct: '',
  });

  const showToast = useCallback((msg, type = 'ok') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }, []);

  async function load() {
    setLoading(true);
    const res = await adminApi.listCategories();
    setLoading(false);
    if (res.success) {
      const list = res.data.categories || [];
      setCats(list);
      const f = {};
      list.forEach(c => {
        f[c.category_key] = {
          label:              c.label,
          path_a_pct:         c.path_a_pct,
          path_b_pct:         c.path_b_pct,
          path_c_pct:         c.path_c_pct,
          active:             c.active,
          description:        c.description || '',
        };
      });
      setForm(f);
    } else {
      showToast(res.error?.message || 'Failed to load categories', 'err');
    }
  }
  useEffect(() => { load(); }, []);

  function setField(key, field, value) {
    setForm(prev => ({ ...prev, [key]: { ...prev[key], [field]: value } }));
    setErrors(prev => { const n = { ...prev }; delete n[`${key}.${field}`]; return n; });
  }

  function validatePct(v) {
    const n = parseFloat(v);
    return !(isNaN(n) || n < 0 || n > 50);
  }

  async function saveRow(key) {
    const f = form[key];
    const errs = {};
    if (!validatePct(f.path_a_pct)) errs[`${key}.path_a_pct`] = '0–50';
    if (!validatePct(f.path_b_pct)) errs[`${key}.path_b_pct`] = '0–50';
    if (!validatePct(f.path_c_pct)) errs[`${key}.path_c_pct`] = '0–50';
    setErrors(errs);
    if (Object.keys(errs).length) return;

    setSaving(true);
    const res = await adminApi.updateCategory(key, {
      label:              f.label,
      path_a_pct:         parseFloat(f.path_a_pct),
      path_b_pct:         parseFloat(f.path_b_pct),
      path_c_pct:         parseFloat(f.path_c_pct),
      active:             !!f.active,
      description:        f.description || null,
    });
    setSaving(false);
    if (res.success) {
      showToast(`Saved ${key}`);
      setEditingKey(null);
      load();
    } else {
      showToast(res.error?.message || 'Save failed', 'err');
    }
  }

  async function deleteRow(key) {
    if (!confirm(`Delete category "${key}"? Brands registered with this category will fall back to brands.platform_fee_pct (8% default). Confirm?`)) return;
    const res = await adminApi.deleteCategory(key);
    if (res.success) { showToast(`Deleted ${key}`); load(); }
    else showToast(res.error?.message || 'Delete failed', 'err');
  }

  async function addCategory() {
    if (!newRow.category_key || !newRow.name || !newRow.label) {
      showToast('key, name, label required', 'err'); return;
    }
    for (const f of ['path_a_pct', 'path_b_pct', 'path_c_pct']) {
      if (!validatePct(newRow[f])) { showToast(`${f} must be 0–50`, 'err'); return; }
    }
    const res = await adminApi.createCategory({
      category_key:       newRow.category_key,
      name:               newRow.name,
      label:              newRow.label,
      path_a_pct:         parseFloat(newRow.path_a_pct),
      path_b_pct:         parseFloat(newRow.path_b_pct),
      path_c_pct:         parseFloat(newRow.path_c_pct),
    });
    if (res.success) {
      showToast(`Added ${newRow.category_key}`);
      setAddOpen(false);
      setNewRow({
        category_key: '', name: '', label: '',
        path_a_pct: '', path_b_pct: '', path_c_pct: '',
      });
      load();
    } else {
      showToast(res.error?.message || 'Create failed', 'err');
    }
  }

  return (
    <div className="max-w-6xl">
      {toast && (
        <div className={`fixed top-5 right-5 z-50 px-5 py-3 rounded-xl shadow-lg text-sm font-semibold ${toast.type === 'err' ? 'bg-red-600 text-white' : 'bg-teal-600 text-white'}`}>
          {toast.type === 'err' ? '✗' : '✓'} {toast.msg}
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-xl font-bold text-t1">Marketplace Categories (L3)</h1>
          <p className="text-xs text-t3 mt-0.5">
            Per-category fee % charged on follower transactions. Path A = direct buy, Path B = via influencer click,
            Path C = attribution within 30 days. Cache TTL ~60s; edits apply on next transaction after cache miss.
            The return window is no longer set here: it is one number for the whole platform, in Money › Settings.
          </p>
          {/*
            Item 9: this screen and the list of businesses INFLX lets register are two
            different lists, and the second one is far shorter. A rate here does nothing
            until that business can actually sign up, so say which one is live rather
            than leaving sixteen rows all looking equally in use.
          */}
          <p className="text-xs text-t2 mt-1.5">
            <span className="font-semibold">Open for registration today: Fashion.</span>{' '}
            The rest are configured but no new business can register under them
            (INFLX is fashion-only). A store pays the rate for the business type it
            registered as — one rate for everything that store sells.
          </p>
        </div>
        <button onClick={() => setAddOpen(true)}
          className="px-4 py-2 bg-navy text-white font-semibold text-sm rounded-lg hover:bg-navy-mid transition-colors">
          + Add Category
        </button>
      </div>

      {addOpen && (
        <div className="mb-4 bg-white border-2 border-navy rounded-xl p-4">
          <div className="grid grid-cols-12 gap-2">
            <input className="col-span-2 px-2 py-1.5 text-sm border rounded" placeholder="category_key"
                   value={newRow.category_key} onChange={e => setNewRow({ ...newRow, category_key: e.target.value })} />
            <input className="col-span-2 px-2 py-1.5 text-sm border rounded" placeholder="name"
                   value={newRow.name} onChange={e => setNewRow({ ...newRow, name: e.target.value })} />
            <input className="col-span-2 px-2 py-1.5 text-sm border rounded" placeholder="Label (display)"
                   value={newRow.label} onChange={e => setNewRow({ ...newRow, label: e.target.value })} />
            <input className="col-span-1 px-2 py-1.5 text-sm border rounded" placeholder="A%" type="number"
                   value={newRow.path_a_pct} onChange={e => setNewRow({ ...newRow, path_a_pct: e.target.value })} />
            <input className="col-span-1 px-2 py-1.5 text-sm border rounded" placeholder="B%" type="number"
                   value={newRow.path_b_pct} onChange={e => setNewRow({ ...newRow, path_b_pct: e.target.value })} />
            <input className="col-span-1 px-2 py-1.5 text-sm border rounded" placeholder="C%" type="number"
                   value={newRow.path_c_pct} onChange={e => setNewRow({ ...newRow, path_c_pct: e.target.value })} />
            <button onClick={addCategory} className="col-span-3 px-3 py-1.5 bg-teal-600 text-white text-sm font-semibold rounded">Add</button>
          </div>
          <div className="mt-2 text-right">
            <button onClick={() => setAddOpen(false)} className="text-xs text-t3 hover:text-t1">Cancel</button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map(i => <div key={i} className="h-16 bg-surface2 rounded-xl animate-pulse" />)}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-border overflow-hidden">
          <div className="grid grid-cols-12 gap-2 px-4 py-3 bg-surface2 text-[11px] font-bold text-t3 uppercase tracking-wide">
            <div className="col-span-2">Key / Label</div>
            <div className="col-span-2 text-center">Path A (direct)</div>
            <div className="col-span-2 text-center">Path B (via inf)</div>
            <div className="col-span-2 text-center">Path C (attrib)</div>
            <div className="col-span-2 text-center">Active</div>
            <div className="col-span-2 text-right">Actions</div>
          </div>

          {cats.map((c, i) => {
            const f = form[c.category_key] || {};
            const isEdit = editingKey === c.category_key;
            const err = (field) => errors[`${c.category_key}.${field}`];
            return (
              <div key={c.category_key}
                   className={`grid grid-cols-12 gap-2 px-4 py-3 items-center ${i < cats.length - 1 ? 'border-b border-border' : ''}`}>
                <div className="col-span-2">
                  <div className="text-sm font-bold text-t1">{c.category_key}</div>
                  {isEdit ? (
                    <input value={f.label || ''} onChange={e => setField(c.category_key, 'label', e.target.value)}
                      className="w-full mt-1 px-2 py-1 text-[11px] border border-border rounded" />
                  ) : (
                    <div className="text-[11px] text-t3">{f.label}</div>
                  )}
                </div>

                {['path_a_pct', 'path_b_pct', 'path_c_pct'].map(field => (
                  <div key={field} className="col-span-2 text-center">
                    {isEdit ? (
                      <>
                        <input type="number" min={0} max={50} step={0.1}
                          value={f[field] ?? ''}
                          onChange={e => setField(c.category_key, field, e.target.value === '' ? '' : Number(e.target.value))}
                          className={`w-full px-2 py-1.5 text-sm text-center font-bold border-2 rounded-lg outline-none ${err(field) ? 'border-red-400' : 'border-navy/30 focus:border-navy'}`}
                        />
                        {err(field) && <div className="text-[10px] text-red-500 mt-0.5">{err(field)}</div>}
                      </>
                    ) : (
                      <span className="font-display text-base font-bold text-navy bg-navy-pale px-3 py-1 rounded-lg inline-block">
                        {f[field]}%
                      </span>
                    )}
                  </div>
                ))}

                {/* shopper-walk-fixes (W11): the return window is ONE platform number now (Money ›
                    Settings). A category no longer has one of its own, so its box is gone from here. */}
                <div className="col-span-2 text-center">
                  {isEdit ? (
                    <input type="checkbox" checked={!!f.active}
                      onChange={e => setField(c.category_key, 'active', e.target.checked)}
                      className="w-4 h-4" />
                  ) : (
                    <span className={`inline-block px-2 py-0.5 text-[10px] font-semibold rounded ${f.active ? 'bg-teal-100 text-teal-700' : 'bg-surface2 text-t3'}`}>
                      {f.active ? 'ON' : 'OFF'}
                    </span>
                  )}
                </div>

                <div className="col-span-2 text-right">
                  {isEdit ? (
                    <div className="flex gap-1 justify-end">
                      <button onClick={() => { setEditingKey(null); setErrors({}); load(); }}
                        className="px-2 py-1 text-xs text-t3 hover:text-t1">Cancel</button>
                      <button onClick={() => saveRow(c.category_key)} disabled={saving}
                        className="px-2 py-1 text-xs bg-teal-600 text-white rounded disabled:opacity-50">Save</button>
                    </div>
                  ) : (
                    <div className="flex gap-1 justify-end">
                      <button onClick={() => setEditingKey(c.category_key)}
                        className="px-2 py-1 text-xs bg-navy text-white rounded hover:bg-navy-mid">Edit</button>
                      <button onClick={() => deleteRow(c.category_key)}
                        className="px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded">Delete</button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
