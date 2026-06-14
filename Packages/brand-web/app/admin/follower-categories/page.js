'use client';
import { useEffect, useState, useCallback } from 'react';
import { adminApi } from '../../../lib/api';

/**
 * Follower Categories admin CRUD (contract: merch-engine-p1b-category-admin).
 *
 * The top-level "browse by category" tiles on the follower Find screen. Seeded
 * to mirror today; editing here changes what followers browse (the brand
 * journey — register/list/allocate/store — is independent of these tiles).
 * Navy admin theme (gold/cream is the follower-app standard).
 */

const EMPTY = { key: '', label: '', icon: '', sort_order: '', status: 'active', members: '' };

export default function FollowerCategoriesPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);   // null | 'new' | <row>
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(null);
  const [toast, setToast] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const res = await adminApi.listFollowerCategories();
    setLoading(false);
    if (res.success) setRows(res.data?.categories || []);
  }, []);

  useEffect(() => { load(); }, [load]);

  function showToast(m) { setToast(m); setTimeout(() => setToast(''), 2500); }

  function openCreate() {
    setForm({ ...EMPTY, sort_order: String((rows[rows.length - 1]?.sort_order ?? 0) + 1) });
    setFormError(null); setEditing('new');
  }
  function openEdit(c) {
    setForm({
      key: c.key, label: c.label || '', icon: c.icon || '',
      sort_order: c.sort_order ?? '', status: c.status || 'active',
      members: (c.member_categories || []).join(', '),
    });
    setFormError(null); setEditing(c);
  }

  function parseMembers(s) {
    return String(s || '').split(',').map(x => x.trim()).filter(Boolean);
  }

  async function handleSave() {
    setFormError(null);
    if (!form.label.trim()) { setFormError('Label is required.'); return; }
    if (editing === 'new' && !/^[a-z0-9_]+$/.test(form.key.trim().toLowerCase())) {
      setFormError('Key must be lowercase letters, numbers, or underscore.'); return;
    }
    const payload = {
      label: form.label.trim(),
      icon: form.icon.trim() || null,
      sort_order: form.sort_order === '' ? 0 : Number(form.sort_order),
      status: form.status,
      member_categories: parseMembers(form.members),
    };
    setSaving(true);
    const res = editing === 'new'
      ? await adminApi.createFollowerCategory({ ...payload, key: form.key.trim().toLowerCase() })
      : await adminApi.updateFollowerCategory(editing.id, payload);
    setSaving(false);
    if (res.success) { setEditing(null); showToast(editing === 'new' ? 'Tile created.' : 'Tile updated.'); load(); }
    else setFormError(res.error?.message || 'Save failed.');
  }

  async function toggleHide(c) {
    const next = c.status === 'active' ? 'hidden' : 'active';
    const res = await adminApi.updateFollowerCategory(c.id, { status: next });
    if (res.success) { showToast(next === 'hidden' ? `Hid “${c.label}”.` : `Showing “${c.label}”.`); load(); }
    else alert(res.error?.message || 'Could not change status.');
  }

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="font-display text-xl font-bold text-t1">Follower Categories</h1>
          <p className="text-xs text-t3 mt-0.5">
            The top tiles followers browse on the Find screen. Seeded to today — edit name, icon, order, member businesses, or hide one. Followers never see an empty list.
          </p>
        </div>
        <button onClick={openCreate} className="px-4 py-2 bg-navy hover:bg-navy/90 text-white text-xs font-bold rounded-xl">+ Add tile</button>
      </div>

      {loading ? (
        <div className="bg-white rounded-2xl border border-border p-12 text-center text-sm text-t3">Loading…</div>
      ) : (
        <div className="bg-white rounded-2xl border border-border overflow-hidden">
          <div className="grid grid-cols-12 px-5 py-2.5 bg-surface2 text-[10px] font-bold uppercase tracking-wider text-t3">
            <div className="col-span-3">Tile</div>
            <div className="col-span-1">Order</div>
            <div className="col-span-5">Member businesses</div>
            <div className="col-span-1">Status</div>
            <div className="col-span-2 text-right">Actions</div>
          </div>
          {rows.map(c => (
            <div key={c.id} className="grid grid-cols-12 items-center px-5 py-3.5 border-t border-border">
              <div className="col-span-3 flex items-center gap-3">
                <span className="w-9 h-9 rounded-lg bg-navy-pale flex items-center justify-center text-lg">{c.icon || '▫'}</span>
                <div><div className="text-sm font-bold text-t1">{c.label}</div><div className="text-[10px] text-t3">{c.key}</div></div>
              </div>
              <div className="col-span-1 text-xs text-t2">{c.sort_order}</div>
              <div className="col-span-5 flex flex-wrap gap-1.5">
                {(c.member_categories || []).slice(0, 6).map(m => (
                  <span key={m} className="text-[10.5px] font-semibold px-2 py-0.5 rounded-full bg-surface2 text-t2">{m}</span>
                ))}
                {(c.member_categories || []).length > 6 && (
                  <span className="text-[10.5px] font-semibold px-2 py-0.5 rounded-full bg-surface2 text-t3">+{c.member_categories.length - 6}</span>
                )}
              </div>
              <div className="col-span-1">
                {c.status === 'active'
                  ? <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-pale text-green">Active</span>
                  : <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-surface2 text-t3">Hidden</span>}
              </div>
              <div className="col-span-2 flex justify-end gap-2">
                <button onClick={() => openEdit(c)} className="text-xs font-bold text-navy border border-navy/30 rounded-lg px-3 py-1.5">Edit</button>
                <button onClick={() => toggleHide(c)} className="text-xs font-semibold text-t3 border border-border rounded-lg px-3 py-1.5 hover:text-t1">
                  {c.status === 'active' ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>
          ))}
          {rows.length === 0 && <div className="px-5 py-10 text-center text-sm text-t3 border-t border-border">No tiles — add the first one.</div>}
          <div className="px-5 py-3 border-t border-border text-[11px] text-t3 italic">
            Hidden tiles leave the Find screen but keep their data; member businesses and brand journeys are untouched.
          </div>
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => !saving && setEditing(null)}>
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-border px-5 py-3">
              <div className="font-display text-base font-bold text-t1">{editing === 'new' ? 'Add tile' : `Edit: ${editing.label}`}</div>
              <button onClick={() => !saving && setEditing(null)} className="text-t3 hover:text-t1 text-xl leading-none">×</button>
            </div>
            <div className="px-5 py-4 space-y-4">
              {formError && <div className="bg-red-pale border border-red/20 text-red text-xs rounded-lg px-3 py-2">{formError}</div>}
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block text-[11px] font-bold text-t2 mb-1">Label <span className="text-red">*</span></label>
                  <input value={form.label} onChange={e => setForm({ ...form, label: e.target.value })}
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm font-semibold" />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-t2 mb-1">Icon</label>
                  <input value={form.icon} onChange={e => setForm({ ...form, icon: e.target.value })}
                    placeholder="🍽️" className="w-full border border-border rounded-lg px-3 py-2 text-sm text-center" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-t2 mb-1">Key {editing === 'new' && <span className="text-red">*</span>}</label>
                  <input value={form.key} disabled={editing !== 'new'}
                    onChange={e => setForm({ ...form, key: e.target.value })}
                    placeholder="shop" className="w-full border border-border rounded-lg px-3 py-2 text-xs disabled:bg-surface2 disabled:text-t3" />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-t2 mb-1">Sort order</label>
                  <input type="number" value={form.sort_order} onChange={e => setForm({ ...form, sort_order: e.target.value })}
                    className="w-full border border-border rounded-lg px-3 py-2 text-xs" />
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-t2 mb-1">Member businesses</label>
                <input value={form.members} onChange={e => setForm({ ...form, members: e.target.value })}
                  placeholder="restaurant, bakery, grocery"
                  className="w-full border border-border rounded-lg px-3 py-2 text-xs" />
                <p className="text-[10px] text-t3 mt-1 italic">Comma-separated business category keys (a brand’s `category`). Unknown keys just match no brands.</p>
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
            <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-3">
              <button onClick={() => !saving && setEditing(null)} disabled={saving}
                className="px-4 py-2 bg-surface2 text-t2 text-xs font-semibold rounded-xl hover:bg-navy-pale disabled:opacity-40">Cancel</button>
              <button onClick={handleSave} disabled={saving}
                className="px-5 py-2 bg-navy text-white text-xs font-bold rounded-xl disabled:opacity-50">
                {saving ? 'Saving…' : (editing === 'new' ? 'Create tile' : 'Save changes')}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="fixed bottom-6 right-6 bg-t1 text-white text-xs font-semibold px-4 py-2 rounded-xl shadow-lg z-50">{toast}</div>}
    </div>
  );
}
