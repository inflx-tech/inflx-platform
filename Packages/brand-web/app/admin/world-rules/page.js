'use client';

/**
 * World Settings (Phase 3, features/phase3-world-rules/, mig 126).
 *
 * Per-world section-engine behaviour — the founder's "food is deliverable-only,
 * fashion is discoverable-everywhere" lever:
 *   · Location: Rank-only (legacy — everything shows, nearest first) ·
 *     Boundary (hard radius with coords; hard city match without) · Off.
 *   · If empty: widen ×2 once / show nearest anyway / honest empty.
 *   · Trending window default for this world's trending/top shelves.
 * A world with no saved row = Rank-only (legacy). Changes go live within ~60s.
 */

import { useEffect, useState, useCallback } from 'react';
import { adminApi } from '../../../lib/api';

const MODES = [
  { v: 'rank_only', l: 'Rank only', hint: 'everything shows, nearest first — today’s behaviour' },
  { v: 'boundary',  l: 'Boundary',  hint: 'only within the radius (or same city when no GPS) — for deliverable worlds' },
  { v: 'off',       l: 'Off',       hint: 'location ignored completely' },
];
const FALLBACKS = [
  { v: 'show_nearest', l: 'Show nearest anyway' },
  { v: 'widen',        l: 'Widen the radius (×2, once)' },
  { v: 'show_empty',   l: 'Show empty (honest)' },
];

export default function WorldRulesPage() {
  const [worlds, setWorlds] = useState([]);
  const [saved, setSaved] = useState({});   // world_key → row
  const [draft, setDraft] = useState({});   // world_key → edited fields
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState(null);

  const load = useCallback(async () => {
    const [w, r] = await Promise.all([adminApi.listHomeVerticals(), adminApi.listWorldRules()]);
    if (w.success) setWorlds((w.data?.verticals || []).sort((a, b) => a.sort_order - b.sort_order));
    if (r.success) {
      const map = {};
      for (const row of (r.data?.world_rules || [])) map[row.world_key] = row;
      setSaved(map);
      setDraft({});
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const effective = (key) => ({
    location_mode: 'rank_only', radius_km: '', empty_fallback: 'show_nearest', window_days_default: '',
    ...(saved[key] ? {
      location_mode: saved[key].location_mode,
      radius_km: saved[key].radius_km ?? '',
      empty_fallback: saved[key].empty_fallback,
      window_days_default: saved[key].window_days_default ?? '',
    } : {}),
    ...(draft[key] || {}),
  });
  const patch = (key, p) => { setMsg(null); setDraft(prev => ({ ...prev, [key]: { ...(prev[key] || {}), ...p } })); };
  const dirty = (key) => !!draft[key];

  const save = async (key) => {
    const e = effective(key);
    if (e.location_mode === 'boundary' && !(Number(e.radius_km) > 0)) {
      setMsg({ kind: 'err', text: `${key} — Boundary needs a radius (km).` }); return;
    }
    setBusy(key);
    const res = await adminApi.saveWorldRules(key, {
      location_mode: e.location_mode,
      radius_km: e.radius_km === '' ? null : Number(e.radius_km),
      empty_fallback: e.empty_fallback,
      window_days_default: e.window_days_default === '' ? null : Number(e.window_days_default),
    });
    setBusy('');
    if (res.success) { setMsg({ kind: 'ok', text: `${key} saved — live within ~60s.` }); load(); }
    else setMsg({ kind: 'err', text: res.error?.message || 'Save failed' });
  };

  const reset = async (key) => {
    setBusy(key);
    const res = await adminApi.deleteWorldRules(key);
    setBusy('');
    if (res.success) { setMsg({ kind: 'ok', text: `${key} back to default (rank only).` }); load(); }
    else setMsg({ kind: 'err', text: res.error?.message || 'Reset failed' });
  };

  return (
    <div className="p-6 max-w-4xl">
      <h1 className="text-xl font-extrabold text-gray-900 flex items-center gap-2">🌍 World Settings</h1>
      <p className="text-xs text-gray-500 mt-1 mb-1">
        Per-world behaviour for every shelf the App Builder composes. <b>Boundary</b> makes location a hard gate
        (a Hyderabad follower stops seeing Vijayawada restaurants) — use it for deliverable worlds like food.
        <b> Rank only</b> keeps today’s behaviour: everything shows, nearest first — right for fashion &amp; other
        shippable worlds. Business pages and creator stores are never boundary-gated (share links always open in full).
      </p>
      <p className="text-[11px] text-gray-400 mb-4">A world without saved settings = Rank only. Changes reach the app within ~60s. No app update needed.</p>

      {msg && (
        <div className={`mb-3 px-3 py-2 rounded-lg text-xs font-semibold ${msg.kind === 'ok' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {msg.text}
        </div>
      )}

      <div className="flex flex-col gap-3">
        {worlds.map((w) => {
          const e = effective(w.key);
          const hasRow = !!saved[w.key];
          return (
            <div key={w.key} className="rounded-xl border border-gray-200 bg-white p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm font-bold text-gray-900">{w.icon ? `${w.icon} ` : ''}{w.name || w.key}
                  <span className="ml-2 text-[10px] font-semibold rounded-full px-2 py-0.5 bg-gray-100 text-gray-500">
                    {hasRow ? e.location_mode.replace('_', ' ') : 'default · rank only'}
                  </span>
                </div>
                <div className="flex gap-2">
                  {hasRow && (
                    <button type="button" onClick={() => reset(w.key)} disabled={busy === w.key}
                      className="text-[11px] font-semibold text-gray-400 hover:text-gray-600">Reset to default</button>
                  )}
                  <button type="button" onClick={() => save(w.key)} disabled={busy === w.key || !dirty(w.key)}
                    className={`text-[11px] font-bold rounded-lg px-3 py-1.5 ${dirty(w.key) ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-400'}`}>
                    {busy === w.key ? 'Saving…' : 'Save'}
                  </button>
                </div>
              </div>
              <div className="flex items-end gap-4 flex-wrap">
                <label className="text-[11px] font-semibold text-gray-600">Location
                  <select value={e.location_mode} onChange={ev => patch(w.key, { location_mode: ev.target.value })}
                    className="mt-0.5 block text-xs border border-gray-300 rounded px-2 py-1 bg-white">
                    {MODES.map(m => <option key={m.v} value={m.v}>{m.l}</option>)}
                  </select>
                </label>
                {e.location_mode === 'boundary' && (
                  <>
                    <label className="text-[11px] font-semibold text-gray-600">Radius (km)
                      <input type="number" min="1" max="5000" value={e.radius_km}
                        onChange={ev => patch(w.key, { radius_km: ev.target.value })}
                        className="mt-0.5 block w-24 text-xs border border-gray-300 rounded px-2 py-1" placeholder="e.g. 10" />
                    </label>
                    <label className="text-[11px] font-semibold text-gray-600">If the area is empty
                      <select value={e.empty_fallback} onChange={ev => patch(w.key, { empty_fallback: ev.target.value })}
                        className="mt-0.5 block text-xs border border-gray-300 rounded px-2 py-1 bg-white">
                        {FALLBACKS.map(f => <option key={f.v} value={f.v}>{f.l}</option>)}
                      </select>
                    </label>
                  </>
                )}
                <label className="text-[11px] font-semibold text-gray-600">Trending window default (days)
                  <input type="number" min="1" max="90" value={e.window_days_default}
                    onChange={ev => patch(w.key, { window_days_default: ev.target.value })}
                    className="mt-0.5 block w-24 text-xs border border-gray-300 rounded px-2 py-1" placeholder="7" />
                </label>
              </div>
              <div className="text-[10px] text-gray-400 mt-2">{MODES.find(m => m.v === e.location_mode)?.hint}</div>
            </div>
          );
        })}
        {worlds.length === 0 && <div className="text-xs text-gray-400 italic">Loading worlds…</div>}
      </div>
    </div>
  );
}
