'use client';

/**
 * Design Library (Creator Experience Engine Phase 3, features/design-library/,
 * migrations 131-132).
 *
 * Read-only view of the visual grammar the Adaptive Renderer (Phase 4) obeys:
 * the 10 layouts, each with its Layout Contract (required / optional / hidden
 * slots), plus the Section Style vocabulary. The "Creator Vibe" layout types,
 * formalized as data. No writes in v1.
 */

import { useEffect, useState, useCallback } from 'react';
import { adminApi } from '../../../lib/api';

const WORLDS = ['fashion', 'food', 'furniture', 'beauty', 'car_rental'];

export default function DesignLibraryPage() {
  const [world, setWorld] = useState('fashion');
  const [layouts, setLayouts] = useState([]);
  const [styles, setStyles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    const [l, s] = await Promise.all([adminApi.listDesignLayouts(world), adminApi.listSectionStyles()]);
    if (l.success) setLayouts(l.data?.layouts || []); else setError(l.error?.message || 'Failed to load layouts');
    if (s.success) setStyles(s.data?.section_styles || []);
    setLoading(false);
  }, [world]);
  useEffect(() => { load(); }, [load]);

  return (
    <div className="p-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-extrabold text-gray-900 flex items-center gap-2">📐 Design Library</h1>
        <select value={world} onChange={(e) => setWorld(e.target.value)}
                className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm font-semibold bg-white">
          {WORLDS.map((w) => <option key={w} value={w}>{w}</option>)}
        </select>
      </div>
      <p className="text-xs text-gray-500 mt-1 mb-5">
        The visual grammar the renderer obeys — the 10 layout types, formalized.
        <span className="ml-2 inline-block text-[10px] font-semibold bg-gray-100 border border-gray-200 rounded-full px-2 py-0.5 text-gray-500">Read-only · v1</span>
      </p>

      {error && <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>}
      {loading ? (
        <div className="text-sm text-gray-400 py-10">Loading catalog…</div>
      ) : (
        <>
          <h2 className="text-[11px] uppercase tracking-wide text-gray-400 font-bold mb-3">
            Layouts — <span className="text-emerald-600">green = required</span> · <span className="text-gray-400">grey = optional</span> · <span className="line-through text-gray-300">struck = never</span>
          </h2>
          {layouts.length === 0 ? (
            <div className="text-sm text-gray-400">No layouts seeded yet.</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {layouts.map((l) => <LayoutCard key={l.key} l={l} />)}
            </div>
          )}

          <h2 className="text-[11px] uppercase tracking-wide text-gray-400 font-bold mt-8 mb-3">Section styles — how a row of cards behaves</h2>
          <div className="flex flex-wrap gap-2">
            {styles.map((s) => (
              <div key={s.key} className="bg-white border border-gray-200 rounded-xl px-3 py-2">
                <div className="font-bold text-[13px] text-gray-900">{s.label}</div>
                <div className="text-[11px] text-gray-500">{s.hint}</div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function LayoutCard({ l }) {
  const c = l.contract || {};
  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-4">
      <div className="flex items-center gap-2">
        <div className="font-extrabold text-[14px] text-gray-900">{l.label}</div>
        <span className="text-[10px] rounded-full px-2 py-0.5 border border-gray-200 bg-gray-50 text-gray-500 ml-auto">{l.aspect_hint}</span>
        <span className="text-[10px] rounded-full px-2 py-0.5 border border-gray-200 bg-gray-50 text-gray-500">{l.kind}</span>
      </div>
      <SlotRow label="Required" slots={c.required} cls="bg-emerald-50 text-emerald-700 border-emerald-200" />
      <SlotRow label="Optional" slots={c.optional} cls="bg-gray-50 text-gray-500 border-gray-200" />
      <SlotRow label="Hidden" slots={c.hidden} cls="bg-gray-50 text-gray-300 border-gray-200 line-through" />
    </div>
  );
}

function SlotRow({ label, slots, cls }) {
  const arr = Array.isArray(slots) ? slots : [];
  return (
    <div className="mt-2">
      <div className="text-[10px] uppercase tracking-wide text-gray-400 font-semibold">{label}</div>
      <div className="flex flex-wrap gap-1 mt-1">
        {arr.length === 0 ? <span className="text-[11px] text-gray-300">—</span>
          : arr.map((s) => <span key={s} className={`text-[10px] rounded px-1.5 py-0.5 border ${cls}`}>{s}</span>)}
      </div>
    </div>
  );
}
