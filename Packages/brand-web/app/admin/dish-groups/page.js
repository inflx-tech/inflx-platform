'use client';

import { useEffect, useState, useCallback } from 'react';
import { adminApi } from '../../../lib/api';

// Admin dish-group builder: create food-discovery tiles (Biryani, Paratha...),
// auto-suggest member dishes by name, tick to confirm, set an optional keyword.
// Contract: features/food-dish-groups.
export default function DishGroupsPage() {
  const [groups, setGroups] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  // member editor state
  const [editing, setEditing] = useState(null);     // the group being edited
  const [checked, setChecked] = useState(new Set()); // master_dish_ids selected
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [memBusy, setMemBusy] = useState(false);

  const load = useCallback(async () => {
    const r = await adminApi.listDishGroups();
    if (r.success) setGroups(r.data?.groups || []);
    else setError(r.error?.message || 'Failed to load');
  }, []);
  useEffect(() => { load(); }, [load]);

  const guard = async (fn) => {
    setBusy(true); setError(null);
    try { const r = await fn(); if (r && r.success === false) setError(r.error?.message || 'Action failed'); }
    catch (e) { setError(e.message || 'Action failed'); }
    finally { setBusy(false); await load(); }
  };

  const create = async () => {
    const name = prompt('New dish group name (e.g. Biryani, Paratha, Pizza):');
    if (!name || !name.trim()) return;
    setBusy(true); setError(null);
    try {
      const r = await adminApi.createDishGroup({ name: name.trim(), keyword: name.trim().toLowerCase() });
      if (r.success) { await load(); await openMembers(r.data.group, true); }
      else setError(r.error?.message || 'Create failed');
    } finally { setBusy(false); }
  };

  const rename = (g) => { const n = prompt('Rename group:', g.name); if (n && n.trim()) guard(() => adminApi.updateDishGroup(g.id, { name: n.trim() })); };
  const setKw = (g) => { const k = prompt('Keyword to also match by name (blank = none):', g.keyword || ''); if (k !== null) guard(() => adminApi.updateDishGroup(g.id, { keyword: k.trim() })); };
  const toggle = (g) => guard(() => adminApi.updateDishGroup(g.id, { enabled: g.status !== 'active' }));
  const del = (g) => { if (confirm(`Hide "${g.name}"?`)) guard(() => adminApi.deleteDishGroup(g.id)); };
  const move = (g, dir) => {
    const i = groups.findIndex(x => x.id === g.id); const j = i + dir;
    if (j < 0 || j >= groups.length) return;
    const other = groups[j];
    guard(async () => {
      await adminApi.updateDishGroup(g.id, { sort_order: other.sort_order });
      return adminApi.updateDishGroup(other.id, { sort_order: g.sort_order });
    });
  };

  // ── Member editor ──────────────────────────────────────────────────────────
  const openMembers = async (g, autoSuggest = false) => {
    setEditing(g); setQuery(''); setSuggestions([]); setMemBusy(true);
    try {
      const r = await adminApi.getDishGroupMembers(g.id);
      const cur = new Set((r.data?.members || []).map(m => m.id));
      setChecked(cur);
      // pre-suggest by the group's name so the admin just confirms
      if (autoSuggest || cur.size === 0) {
        const s = await adminApi.suggestDishGroupMembers(g.name);
        const sug = s.data?.suggestions || [];
        setSuggestions(sug);
        if (autoSuggest) setChecked(new Set([...cur, ...sug.map(x => x.id)]));
      }
    } finally { setMemBusy(false); }
  };
  const runSuggest = async (q) => {
    setQuery(q);
    if (q.trim().length < 2) { setSuggestions([]); return; }
    const s = await adminApi.suggestDishGroupMembers(q.trim());
    setSuggestions(s.data?.suggestions || []);
  };
  const toggleMember = (id) => setChecked(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const saveMembers = async () => {
    setMemBusy(true); setError(null);
    try {
      const r = await adminApi.setDishGroupMembers(editing.id, [...checked]);
      if (r.success === false) setError(r.error?.message || 'Save failed');
      else { setEditing(null); await load(); }
    } finally { setMemBusy(false); }
  };

  return (
    <div className="p-6 max-w-4xl">
      <div className="flex items-center mb-4">
        <h1 className="text-xl font-bold flex-1">Dish Groups</h1>
        <button onClick={create} disabled={busy} className="bg-black text-white text-sm px-3 py-1.5 rounded-lg disabled:opacity-50">+ New group</button>
      </div>
      <p className="text-xs text-gray-500 mb-4">Tiles on the food home. Tap a tile → nearby restaurants serving any dish in it (members below, or the keyword as a safety net for custom dishes).</p>
      {error && <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg p-2 mb-3">{error}</div>}

      <div className="space-y-2">
        {groups.map((g, i) => (
          <div key={g.id} className={`border rounded-xl p-3 bg-white ${g.status !== 'active' ? 'opacity-50' : ''}`}>
            <div className="flex items-center gap-3">
              <div className="flex flex-col">
                <button onClick={() => move(g, -1)} disabled={i === 0} className="text-gray-400 disabled:opacity-30 leading-none">▲</button>
                <button onClick={() => move(g, 1)} disabled={i === groups.length - 1} className="text-gray-400 disabled:opacity-30 leading-none">▼</button>
              </div>
              <div className="flex-1">
                <div className="font-bold text-sm">{g.name}</div>
                <div className="text-[11px] text-gray-500">{g.member_count} dishes{g.keyword ? ` · keyword "${g.keyword}"` : ''}</div>
              </div>
              <button onClick={() => openMembers(g)} className="text-xs border px-2 py-1 rounded-lg">Edit dishes</button>
              <button onClick={() => rename(g)} className="text-xs text-gray-600">Rename</button>
              <button onClick={() => setKw(g)} className="text-xs text-gray-600">Keyword</button>
              <button onClick={() => toggle(g)} className="text-xs text-gray-600">{g.status === 'active' ? 'Hide' : 'Show'}</button>
              <button onClick={() => del(g)} className="text-xs text-red-500">Delete</button>
            </div>
          </div>
        ))}
        {groups.length === 0 && <div className="text-sm text-gray-400 py-8 text-center">No dish groups yet. Click "+ New group".</div>}
      </div>

      {editing && (
        <div className="fixed inset-0 bg-black/40 flex items-start justify-center p-4 overflow-auto z-50">
          <div className="bg-white rounded-2xl max-w-lg w-full my-6 p-5">
            <div className="flex items-center mb-3">
              <h2 className="text-lg font-bold flex-1">{editing.name} — dishes</h2>
              <button onClick={() => setEditing(null)} className="text-gray-400 text-xl">✕</button>
            </div>
            <div className="flex gap-2 mb-3">
              <input value={query} onChange={e => runSuggest(e.target.value)} placeholder="Search dishes to add…"
                className="flex-1 border rounded-lg px-3 py-1.5 text-sm" />
              <button onClick={() => openMembers(editing, true)} className="text-xs border px-2 py-1.5 rounded-lg whitespace-nowrap">Auto-suggest by name</button>
            </div>
            <div className="text-[11px] text-gray-500 mb-2">{checked.size} selected</div>
            <div className="max-h-72 overflow-auto border rounded-lg">
              {memBusy && <div className="p-3 text-xs text-gray-400">Loading…</div>}
              {!memBusy && suggestions.length === 0 && <div className="p-3 text-xs text-gray-400">Type to search, or use Auto-suggest.</div>}
              {suggestions.map(s => (
                <label key={s.id} className="flex items-center gap-2 px-3 py-1.5 border-b last:border-0 text-sm cursor-pointer hover:bg-gray-50">
                  <input type="checkbox" checked={checked.has(s.id)} onChange={() => toggleMember(s.id)} />
                  <span className="flex-1">{s.name}</span>
                  <span className="text-[10px] text-gray-400">{s.cuisine} · {s.section}</span>
                </label>
              ))}
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setEditing(null)} className="text-sm text-gray-500 px-3 py-1.5">Cancel</button>
              <button onClick={saveMembers} disabled={memBusy} className="bg-black text-white text-sm px-4 py-1.5 rounded-lg disabled:opacity-50">Save dishes</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
