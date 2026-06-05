'use client';
import { useEffect, useState, useCallback } from 'react';
import { sectionApi } from '../../../lib/api';

/**
 * App Sections — Admin Section Manager (Creator Vibe Phase B).
 *
 * Curate the follower section engine (section_config, Phase A). Per screen +
 * scope: reorder (up/down), show/hide, set count, and on "Top in" rails pick
 * category + item-type (ranking is automatic per type). Publish writes
 * PUT /admin/sections/:screen — instant (engine cache busts within its TTL).
 * Contract: features/admin-section-manager/.
 */

const SCREENS = [
  { key: 'home', label: 'Home' },
  { key: 'category', label: 'Category' },
  { key: 'offers', label: 'Offers' },
  { key: 'creator_store', label: 'Creator Store' },
  { key: 'creator_category', label: "Creator's Category" },
];

const CATEGORIES = ['dining', 'shopping', 'groom', 'stay_fit', 'travel', 'home', 'events'];
const ITEM_TYPES = ['brands', 'products', 'offers'];
// Ranking is automatic per item-type (see SECTION-CATALOG.md).
const RULE_FOR_TYPE = { brands: 'top_by_engagement', products: 'top_by_sales', offers: 'top_by_conversions' };

function hasTypeControls(s) {
  return s.shelf_key === 'top_in' || s.item_type != null;
}

export default function SectionsPage() {
  const [screen, setScreen] = useState('home');
  const [shelves, setShelves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);

  const load = useCallback(async (scr) => {
    setLoading(true);
    setMsg(null);
    const res = await sectionApi.getSections(scr, 'global');
    if (res.success) setShelves(res.data.shelves || []);
    else setMsg({ kind: 'err', text: res.error?.message || 'Failed to load' });
    setLoading(false);
  }, []);

  useEffect(() => { load(screen); }, [screen, load]);

  const update = (id, patch) =>
    setShelves(prev => prev.map(s => (s.id === id ? { ...s, ...patch } : s)));

  const move = (idx, dir) => {
    setShelves(prev => {
      const next = [...prev];
      const j = idx + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[idx], next[j]] = [next[j], next[idx]];
      return next.map((s, i) => ({ ...s, position: i }));
    });
  };

  const changeCount = (id, delta) =>
    setShelves(prev => prev.map(s =>
      s.id === id ? { ...s, item_limit: Math.max(0, Math.min(50, (s.item_limit || 0) + delta)) } : s));

  const changeType = (id, item_type) =>
    update(id, { item_type, rule: RULE_FOR_TYPE[item_type] || undefined });

  const removeShelf = async (s) => {
    if (!confirm(`Remove "${s.title}"? This hides it from the app.`)) return;
    const res = await sectionApi.deleteSection(s.id);
    if (res.success) setShelves(prev => prev.filter(x => x.id !== s.id));
    else setMsg({ kind: 'err', text: res.error?.message || 'Delete failed' });
  };

  const publish = async () => {
    setSaving(true);
    setMsg(null);
    const payload = {
      scope_type: 'global',
      shelves: shelves.map((s, i) => ({
        id: s.id, shelf_key: s.shelf_key, title: s.title, shelf_type: s.shelf_type,
        rule: s.rule, item_type: s.item_type, category_key: s.category_key,
        item_limit: Number(s.item_limit), position: i, enabled: s.enabled !== false,
        pinned_ref: s.pinned_ref, config_json: s.config_json,
      })),
    };
    const res = await sectionApi.saveSections(screen, payload);
    if (res.success) {
      setShelves(res.data.shelves || []);
      setMsg({ kind: 'ok', text: `Published — ${res.data.saved_count} shelves saved. Live within ~60s.` });
    } else {
      setMsg({ kind: 'err', text: res.error?.message || 'Publish failed' });
    }
    setSaving(false);
  };

  return (
    <div className="p-6 max-w-4xl">
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-xl font-bold text-gray-900">🎛️ App Sections</h1>
        <button
          onClick={publish}
          disabled={saving || loading}
          className="px-4 py-2 rounded-lg bg-amber-700 text-white text-sm font-bold disabled:opacity-50"
        >
          {saving ? 'Publishing…' : 'Publish'}
        </button>
      </div>
      <p className="text-xs text-gray-500 mb-4">
        Reorder, show/hide, set count, and pick category + item-type per shelf. Changes go live
        in the follower app within ~60s — no app update. Ranking is automatic per type.
      </p>

      {/* Screen tabs */}
      <div className="flex flex-wrap gap-2 mb-4">
        {SCREENS.map(s => (
          <button
            key={s.key}
            onClick={() => setScreen(s.key)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${
              screen === s.key ? 'bg-amber-700 text-white border-amber-700' : 'bg-white text-gray-600 border-gray-300'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {msg && (
        <div className={`mb-3 px-3 py-2 rounded-lg text-xs font-semibold ${
          msg.kind === 'ok' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
        }`}>{msg.text}</div>
      )}

      {loading ? (
        <div className="text-sm text-gray-500 py-10 text-center">Loading…</div>
      ) : shelves.length === 0 ? (
        <div className="text-sm text-gray-500 py-10 text-center">No shelves configured for this screen.</div>
      ) : (
        <div className="flex flex-col gap-2">
          {shelves.map((s, idx) => (
            <div
              key={s.id}
              className={`flex items-center gap-3 border rounded-xl px-3 py-2.5 bg-white ${
                s.enabled === false ? 'opacity-50' : ''
              }`}
            >
              {/* reorder */}
              <div className="flex flex-col">
                <button onClick={() => move(idx, -1)} disabled={idx === 0} className="text-gray-400 disabled:opacity-30 leading-none">▲</button>
                <button onClick={() => move(idx, 1)} disabled={idx === shelves.length - 1} className="text-gray-400 disabled:opacity-30 leading-none">▼</button>
              </div>

              {/* main */}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-gray-900 truncate">{s.title}</div>
                <div className="text-[11px] text-gray-500 truncate">
                  {s.shelf_type} · {s.rule}
                </div>
                {hasTypeControls(s) && (
                  <div className="flex gap-2 mt-1.5">
                    <select
                      value={s.category_key || ''}
                      onChange={e => update(s.id, { category_key: e.target.value || null })}
                      className="text-[11px] border border-gray-300 rounded px-1.5 py-0.5 bg-gray-50"
                    >
                      <option value="">(no category)</option>
                      {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <select
                      value={s.item_type || ''}
                      onChange={e => changeType(s.id, e.target.value || null)}
                      className="text-[11px] border border-gray-300 rounded px-1.5 py-0.5 bg-gray-50"
                    >
                      <option value="">(type)</option>
                      {ITEM_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                )}
              </div>

              {/* count */}
              <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden">
                <button onClick={() => changeCount(s.id, -1)} className="w-7 h-7 bg-gray-50 text-amber-700 font-bold">−</button>
                <span className="w-8 text-center text-xs font-bold">{s.item_limit}</span>
                <button onClick={() => changeCount(s.id, 1)} className="w-7 h-7 bg-gray-50 text-amber-700 font-bold">+</button>
              </div>

              {/* toggle */}
              <button
                onClick={() => update(s.id, { enabled: !(s.enabled !== false) })}
                className={`w-10 h-6 rounded-full relative transition-colors ${s.enabled !== false ? 'bg-amber-700' : 'bg-gray-300'}`}
                aria-label="toggle enabled"
              >
                <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-all ${s.enabled !== false ? 'left-[18px]' : 'left-0.5'}`} />
              </button>

              {/* delete */}
              <button onClick={() => removeShelf(s)} className="text-gray-300 hover:text-red-500 text-sm" aria-label="remove">✕</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
