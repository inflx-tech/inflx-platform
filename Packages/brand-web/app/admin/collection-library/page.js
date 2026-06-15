'use client';
import { useEffect, useState, useCallback } from 'react';
import { adminApi } from '../../../lib/api';

/**
 * Collection Library admin (contract: merch-engine-p4b-collection-builder).
 *
 * A Collection = a named, ordered group of Section-Library sections. Placed via
 * App Sections, rendered by the 4a engine as a titled band + member shelves.
 * Navy admin theme.
 */

const EMPTY = { business_type: '', name: '', image_url: '', section_ids: [] };

export default function CollectionLibraryPage() {
  const [rows, setRows] = useState([]);
  const [sections, setSections] = useState([]);     // all section_library sections (for the picker)
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);     // null | 'new' | row
  const [form, setForm] = useState(EMPTY);
  const [addPick, setAddPick] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(null);
  const [toast, setToast] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const [colRes, secRes] = await Promise.all([
      adminApi.listCollectionLibrary(),
      adminApi.listSectionLibrary(),
    ]);
    setLoading(false);
    if (colRes.success) setRows(colRes.data?.collections || []);
    if (secRes.success) setSections((secRes.data?.sections || []).filter(s => s.status === 'active'));
  }, []);
  useEffect(() => { load(); }, [load]);

  function showToast(m) { setToast(m); setTimeout(() => setToast(''), 2500); }
  const sectionOf = (id) => sections.find(s => s.id === id);

  function openCreate() { setForm({ ...EMPTY }); setAddPick(''); setFormError(null); setEditing('new'); }
  function openEdit(c) {
    setForm({
      business_type: c.business_type || '', name: c.name || '', image_url: c.image_url || '',
      section_ids: Array.isArray(c.section_ids) ? [...c.section_ids] : [],
    });
    setAddPick(''); setFormError(null); setEditing(c);
  }

  function addSection(id) {
    if (!id || form.section_ids.includes(id)) return;
    setForm(prev => ({ ...prev, section_ids: [...prev.section_ids, id] }));
    setAddPick('');
  }
  function removeSection(id) { setForm(prev => ({ ...prev, section_ids: prev.section_ids.filter(x => x !== id) })); }
  function moveSection(idx, dir) {
    setForm(prev => {
      const next = [...prev.section_ids];
      const j = idx + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[idx], next[j]] = [next[j], next[idx]];
      return { ...prev, section_ids: next };
    });
  }

  async function handleSave() {
    setFormError(null);
    if (!form.name.trim()) { setFormError('Name is required.'); return; }
    const payload = {
      name: form.name.trim(),
      business_type: form.business_type || null,
      image_url: form.image_url.trim() || null,
      section_ids: form.section_ids,
    };
    setSaving(true);
    const res = editing === 'new'
      ? await adminApi.createCollectionLibrary(payload)
      : await adminApi.updateCollectionLibrary(editing.id, payload);
    setSaving(false);
    if (res.success) { setEditing(null); showToast(editing === 'new' ? 'Collection created.' : 'Collection saved.'); load(); }
    else setFormError(res.error?.message || 'Save failed.');
  }

  async function toggleHide(c) {
    const next = c.status === 'active' ? 'hidden' : 'active';
    const res = await adminApi.updateCollectionLibrary(c.id, { status: next });
    if (res.success) { showToast(next === 'hidden' ? `Hid “${c.name}”.` : `Showing “${c.name}”.`); load(); }
    else alert(res.error?.message || 'Could not change status.');
  }

  const available = sections.filter(s => !form.section_ids.includes(s.id));

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="font-display text-xl font-bold text-t1">Collection Library</h1>
          <p className="text-xs text-t3 mt-0.5">
            Group sections into a themed bundle. Place a collection on a screen (App Sections) → it renders as a titled band + its member shelves.
          </p>
        </div>
        <button onClick={openCreate} className="px-4 py-2 bg-navy hover:bg-navy/90 text-white text-xs font-bold rounded-xl">+ New collection</button>
      </div>

      {loading ? (
        <div className="bg-white rounded-2xl border border-border p-12 text-center text-sm text-t3">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="bg-white rounded-2xl border border-border p-12 text-center text-sm text-t3">No collections yet — create the first one.</div>
      ) : (
        <div className="bg-white rounded-2xl border border-border overflow-hidden">
          {rows.map(c => (
            <div key={c.id} className="grid grid-cols-12 items-center px-5 py-3.5 border-t border-border first:border-t-0">
              <div className="col-span-4 flex items-center gap-3">
                <span className="w-9 h-9 rounded-lg bg-navy-pale flex items-center justify-center text-base">{c.image_url ? '🖼️' : '🗂️'}</span>
                <div><div className="text-sm font-bold text-t1">{c.name}</div>{c.status === 'hidden' && <div className="text-[10px] text-t3">hidden</div>}</div>
              </div>
              <div className="col-span-6 flex flex-wrap gap-1.5">
                <span className="text-[10.5px] font-semibold px-2 py-0.5 rounded-full bg-surface2 text-t2">{(c.section_ids || []).length} sections</span>
                {(c.section_ids || []).slice(0, 4).map(id => (
                  <span key={id} className="text-[10.5px] font-semibold px-2 py-0.5 rounded-full bg-surface2 text-t3">{sectionOf(id)?.name || '—'}</span>
                ))}
              </div>
              <div className="col-span-2 flex justify-end gap-2">
                <button onClick={() => openEdit(c)} className="text-xs font-bold text-navy border border-navy/30 rounded-lg px-3 py-1.5">Edit</button>
                <button onClick={() => toggleHide(c)} className="text-xs font-semibold text-t3 border border-border rounded-lg px-3 py-1.5 hover:text-t1">{c.status === 'active' ? 'Hide' : 'Show'}</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => !saving && setEditing(null)}>
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-border px-5 py-3">
              <div className="font-display text-base font-bold text-t1">{editing === 'new' ? 'New collection' : `Edit: ${editing.name}`}</div>
              <button onClick={() => !saving && setEditing(null)} className="text-t3 hover:text-t1 text-xl leading-none">×</button>
            </div>
            <div className="px-5 py-4 space-y-4 max-h-[70vh] overflow-auto">
              {formError && <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg px-3 py-2">{formError}</div>}
              <div>
                <label className="block text-[11px] font-bold text-t2 mb-1">Name <span className="text-red-500">*</span></label>
                <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full border border-border rounded-lg px-3 py-2 text-sm font-semibold" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-t2 mb-1">Business <span className="text-t3 font-medium">(grouping, optional)</span></label>
                  <input value={form.business_type} onChange={e => setForm({ ...form, business_type: e.target.value })} placeholder="e.g. fashion" className="w-full border border-border rounded-lg px-3 py-2 text-xs" />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-t2 mb-1">Header image <span className="text-t3 font-medium">(optional)</span></label>
                  <input value={form.image_url} onChange={e => setForm({ ...form, image_url: e.target.value })} placeholder="https://…" className="w-full border border-border rounded-lg px-3 py-2 text-xs" />
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-t2 mb-1">Sections <span className="text-t3 font-medium">(order = display order)</span></label>
                <div className="border border-border rounded-lg overflow-hidden">
                  {form.section_ids.length === 0 && <div className="px-3 py-3 text-[11px] text-t3 italic">No sections yet — add from the dropdown below.</div>}
                  {form.section_ids.map((id, idx) => {
                    const s = sectionOf(id);
                    return (
                      <div key={id} className="flex items-center gap-2 px-3 py-2 border-t border-border first:border-t-0">
                        <div className="flex flex-col text-t3 leading-none">
                          <button onClick={() => moveSection(idx, -1)} disabled={idx === 0} className="disabled:opacity-30">▲</button>
                          <button onClick={() => moveSection(idx, 1)} disabled={idx === form.section_ids.length - 1} className="disabled:opacity-30">▼</button>
                        </div>
                        <div className="flex-1 text-xs font-semibold text-t1">{s?.name || '(missing/hidden section)'}{s?.business_type ? <span className="text-t3 font-normal"> · {s.business_type}</span> : null}</div>
                        <button onClick={() => removeSection(id)} className="text-red-500 text-sm" aria-label="remove">✕</button>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-2">
                  <select value={addPick} onChange={e => addSection(e.target.value)} className="w-full border border-border rounded-lg px-3 py-2 text-xs bg-white">
                    <option value="">+ Add a section…</option>
                    {available.map(s => <option key={s.id} value={s.id}>{s.name}{s.business_type ? ` · ${s.business_type}` : ''}</option>)}
                  </select>
                  {sections.length === 0 && <p className="text-[10px] text-t3 mt-1 italic">No sections yet — create them in Section Library first.</p>}
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-3">
              <button onClick={() => !saving && setEditing(null)} disabled={saving} className="px-4 py-2 bg-surface2 text-t2 text-xs font-semibold rounded-xl hover:bg-navy-pale disabled:opacity-40">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="px-5 py-2 bg-navy text-white text-xs font-bold rounded-xl disabled:opacity-50">{saving ? 'Saving…' : (editing === 'new' ? 'Create collection' : 'Save collection')}</button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="fixed bottom-6 right-6 bg-t1 text-white text-xs font-semibold px-4 py-2 rounded-xl shadow-lg z-50">{toast}</div>}
    </div>
  );
}
