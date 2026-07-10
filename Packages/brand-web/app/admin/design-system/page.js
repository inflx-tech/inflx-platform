'use client';

/**
 * Design System (Creator Experience Engine Phase 1, features/design-system-tokens/,
 * migrations 127-128).
 *
 * Read-only catalog of the curated visual vocabulary an admin PICKS from —
 * Presets, Moods, Palettes, Typography, Backgrounds. The admin is a curator,
 * not a designer: no artwork upload, no color picker. This is the vocabulary
 * the Theme wizard (Phase 2) will consume. Background image files are the
 * one-time design workstream (shown as "asset pending" until produced).
 */

import { useEffect, useState, useCallback } from 'react';
import { adminApi } from '../../../lib/api';

const WORLDS = ['fashion', 'food', 'furniture', 'beauty', 'car_rental'];

const EMPTY_TOKENS = { mood: [], palette: [], typography: [], background: [], radius: [], shadow: [] };

export default function DesignSystemPage() {
  const [world, setWorld] = useState('fashion');
  const [tokens, setTokens] = useState(EMPTY_TOKENS);
  const [presets, setPresets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    const [t, p] = await Promise.all([
      adminApi.listDesignTokens(world),
      adminApi.listDesignPresets(world),
    ]);
    if (t.success) setTokens({ ...EMPTY_TOKENS, ...(t.data?.tokens || {}) });
    else setError(t.error?.message || 'Failed to load tokens');
    if (p.success) setPresets(p.data?.presets || []);
    setLoading(false);
  }, [world]);
  useEffect(() => { load(); }, [load]);

  return (
    <div className="p-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-extrabold text-gray-900 flex items-center gap-2">🎨 Design System</h1>
        <label className="text-xs text-gray-500 flex items-center gap-2">
          World
          <select
            value={world}
            onChange={(e) => setWorld(e.target.value)}
            className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm font-semibold bg-white"
          >
            {WORLDS.map((w) => <option key={w} value={w}>{w}</option>)}
          </select>
        </label>
      </div>
      <p className="text-xs text-gray-500 mt-1 mb-5">
        The curated vocabulary the Theme wizard will use. Pick, never draw.
        <span className="ml-2 inline-block text-[10px] font-semibold bg-gray-100 border border-gray-200 rounded-full px-2 py-0.5 text-gray-500">Read-only · v1</span>
      </p>

      {error && <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>}
      {loading ? (
        <div className="text-sm text-gray-400 py-10">Loading catalog…</div>
      ) : (
        <div className="space-y-8">

          {/* PRESETS */}
          <Section title="Presets — start a Theme here" count={presets.length}>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {presets.map((p) => (
                <div key={p.key} className="bg-white border border-gray-200 rounded-xl p-3.5">
                  <div className="font-extrabold text-sm text-gray-900 mb-2">{p.label}</div>
                  <div className="flex flex-wrap gap-1">
                    {['mood', 'palette', 'typography', 'background'].map((k) => p.tokens?.[k] ? (
                      <span key={k} className="text-[10px] bg-gray-100 border border-gray-200 rounded-full px-2 py-0.5 text-gray-600">{p.tokens[k]}</span>
                    ) : null)}
                  </div>
                </div>
              ))}
              {!presets.length && <Empty />}
            </div>
          </Section>

          {/* MOODS */}
          <Section title="Moods" count={tokens.mood.length}>
            <div className="flex flex-wrap gap-2">
              {tokens.mood.map((m) => (
                <span key={m.key} className="text-xs bg-white border border-gray-200 rounded-full px-3 py-1.5 text-gray-700 font-medium">{m.label}</span>
              ))}
              {!tokens.mood.length && <Empty />}
            </div>
          </Section>

          {/* PALETTES */}
          <Section title="Palettes" count={tokens.palette.length}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {tokens.palette.map((p) => {
                const c = p.config || {};
                return (
                  <div key={p.key} className="bg-white border border-gray-200 rounded-xl p-3.5 flex items-center gap-3">
                    {['primary', 'secondary', 'accent', 'bg', 'text'].map((slot) => (
                      <span key={slot} title={`${slot}: ${c[slot] || ''}`} className="w-7 h-7 rounded-lg border border-black/10" style={{ background: c[slot] || '#fff' }} />
                    ))}
                    <div className="ml-1">
                      <div className="font-bold text-sm text-gray-900">{p.label}</div>
                      <div className="text-[10px] text-gray-400">{c.primary} · {c.accent}</div>
                    </div>
                  </div>
                );
              })}
              {!tokens.palette.length && <Empty />}
            </div>
          </Section>

          {/* TYPOGRAPHY */}
          <Section title="Typography" count={tokens.typography.length}>
            <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
              {tokens.typography.map((t) => {
                const c = t.config || {};
                const style = {
                  fontFamily: c.family === 'serif' ? 'Georgia, serif' : 'Inter, sans-serif',
                  fontWeight: c.weight || 600,
                  letterSpacing: c.spacing || 0,
                  textTransform: c.transform || 'none',
                };
                return (
                  <div key={t.key} className="flex items-center justify-between px-4 py-3">
                    <span className="text-xl text-gray-900" style={style}>Street Style</span>
                    <span className="text-[10px] bg-gray-100 border border-gray-200 rounded-full px-2 py-0.5 text-gray-500">{t.label}</span>
                  </div>
                );
              })}
              {!tokens.typography.length && <div className="px-4 py-3"><Empty /></div>}
            </div>
          </Section>

          {/* BACKGROUNDS */}
          <Section title="Backgrounds — curated library (admin picks, never uploads artwork)" count={tokens.background.length}>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {tokens.background.map((b) => {
                const c = b.config || {};
                const pending = !c.asset_r2_key;
                const light = isLight(c.avg_color);
                return (
                  <div key={b.key} className="rounded-xl h-20 flex items-end p-2 relative overflow-hidden border border-black/5"
                       style={{ background: c.avg_color || '#ccc' }}>
                    <span className={`text-xs font-semibold ${light ? 'text-gray-800' : 'text-white'}`}>{b.label}</span>
                    {pending && <span className="absolute top-1.5 right-1.5 text-[9px] bg-black/45 text-white px-1.5 py-0.5 rounded">asset pending</span>}
                  </div>
                );
              })}
              {!tokens.background.length && <Empty />}
            </div>
          </Section>

        </div>
      )}
    </div>
  );
}

function Section({ title, count, children }) {
  return (
    <section>
      <h2 className="text-[11px] uppercase tracking-wide text-gray-400 font-bold mb-3">
        {title}{typeof count === 'number' ? <span className="ml-1.5 text-gray-300">· {count}</span> : null}
      </h2>
      {children}
    </section>
  );
}

function Empty() {
  return <div className="text-xs text-gray-400">Nothing seeded for this world yet.</div>;
}

// crude light/dark check so labels stay legible over the avg-color tile
function isLight(hex) {
  if (!hex || hex[0] !== '#' || hex.length < 7) return false;
  const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) > 160;
}
