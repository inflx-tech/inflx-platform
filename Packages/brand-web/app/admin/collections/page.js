'use client';
import { useEffect, useState, useCallback } from 'react';
import { adminApi } from '../../../lib/api';

/**
 * Collections vocabulary (Post/Concept P1, mig 139 — family 6).
 * Contract: features/concept-p1-engine/.
 *
 * Admin-curated NAMES with no product rule — the escape hatch for mixed-
 * category creator posts ("Airport Looks" = jeans + shoes + bag). At publish
 * time (P2) a creator picks ONE collection INSTEAD of a concept; creators
 * never free-type names, so the global Collections surface aggregates cleanly
 * across every creator (founder lock 2026-07-22).
 */

export default function CollectionsPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState(null);
  const [editing, setEditing] = useState(null);   // { id, name }
  const [toast, setToast] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const res = await adminApi.listCollectionsVocab(true);
    setLoading(false);
    if (res.success) setRows(res.data?.collections || []);
  }, []);
  useEffect(() => { load(); }, [load]);

  function showToast(m) { setToast(m); setTimeout(() => setToast(''), 2500); }

  async function handleAdd() {
    const name = newName.trim();
    if (!name) return;
    setAdding(true); setAddError(null);
    const res = await adminApi.createCollectionVocab({ name });
    setAdding(false);
    if (res.success) { setNewName(''); showToast(`Added “${name}”.`); load(); }
    else setAddError(res.error?.message || 'Could not add collection.');
  }

  async function handleRename() {
    if (!editing) return;
    const name = editing.name.trim();
    if (!name) return;
    const res = await adminApi.updateCollectionVocab(editing.id, { name });
    if (res.success) { setEditing(null); showToast('Renamed.'); load(); }
    else alert(res.error?.message || 'Rename failed.');
  }

  async function toggleHide(c) {
    const next = c.status === 'active' ? 'hidden' : 'active';
    const res = await adminApi.updateCollectionVocab(c.id, { status: next });
    if (res.success) { showToast(next === 'hidden' ? `Hid “${c.name}”.` : `Showing “${c.name}”.`); load(); }
    else alert(res.error?.message || 'Could not change status.');
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-5">
        <h1 className="font-display text-xl font-bold text-t1">Collections</h1>
        <p className="text-xs text-t3 mt-0.5">
          The named list creators pick from for mixed-category posts ("Airport Looks" = jeans + shoes + bag).
          No product rule — pure curation. Creators cannot invent names, so these aggregate cleanly across every creator.
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-border p-4 mb-4">
        <div className="flex gap-2 max-w-md">
          <input value={newName} onChange={e => setNewName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleAdd(); }}
            placeholder="Add a collection — e.g. Beach Wedding"
            className="flex-1 border border-border rounded-lg px-3 py-2 text-xs" />
          <button onClick={handleAdd} disabled={adding || !newName.trim()}
            className="px-4 py-2 bg-navy text-white text-xs font-bold rounded-lg disabled:opacity-40">
            {adding ? 'Adding…' : '+ Add'}
          </button>
        </div>
        {addError && <div className="text-[11px] text-red-600 mt-2">{addError}</div>}
      </div>

      {loading ? (
        <div className="bg-white rounded-2xl border border-border p-12 text-center text-sm text-t3">Loading collections…</div>
      ) : (
        <div className="bg-white rounded-2xl border border-border overflow-hidden">
          {rows.map(c => (
            <div key={c.id} className="flex items-center justify-between px-5 py-3.5 border-t border-border first:border-t-0">
              <div>
                {editing?.id === c.id ? (
                  <div className="flex gap-2">
                    <input value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })}
                      onKeyDown={e => { if (e.key === 'Enter') handleRename(); }}
                      className="border border-border rounded-lg px-3 py-1.5 text-sm font-semibold" autoFocus />
                    <button onClick={handleRename} className="text-xs font-bold text-white bg-navy rounded-lg px-3">Save</button>
                    <button onClick={() => setEditing(null)} className="text-xs text-t3">Cancel</button>
                  </div>
                ) : (
                  <>
                    <div className="text-sm font-bold text-t1">{c.name}</div>
                    <div className="text-[10px] text-t3">{c.slug}</div>
                  </>
                )}
              </div>
              <div className="flex items-center gap-2">
                {c.status === 'active'
                  ? <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-pale text-green">Active</span>
                  : <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-surface2 text-t3">Hidden</span>}
                <button onClick={() => setEditing({ id: c.id, name: c.name })}
                  className="text-xs font-bold text-navy border border-navy/30 rounded-lg px-3 py-1.5">Rename</button>
                <button onClick={() => toggleHide(c)}
                  className="text-xs font-semibold text-t3 border border-border rounded-lg px-3 py-1.5 hover:text-t1">
                  {c.status === 'active' ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>
          ))}
          {rows.length === 0 && (
            <div className="px-5 py-10 text-center text-sm text-t3">No collections yet — add the first one above.</div>
          )}
          <div className="px-5 py-3 border-t border-border text-[11px] text-t3 italic">
            Hiding removes a name from the creator picker (P2) but never touches posts already published under it.
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 right-6 bg-t1 text-white text-xs font-semibold px-4 py-2 rounded-xl shadow-lg z-50">{toast}</div>
      )}
    </div>
  );
}
