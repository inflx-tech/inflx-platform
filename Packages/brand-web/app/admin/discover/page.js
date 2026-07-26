'use client';
import { useEffect, useMemo, useState } from 'react';
import { adminApi } from '../../../lib/api';

/**
 * Discover Builder — Stage B2 (board b1-discover.html frame 4).
 * Contract: features/concept-stageb-discover/.
 *
 * ONE layout per scope: Global home | Business structure (applies to every
 * store, rows auto-hide per store when empty). Ordered rows:
 *   section       — title + chips, each chip = label + banners (each banner =
 *                   ONE concept/collection, picked from the live Inspector
 *                   list with visible-post counts)
 *   creator_row   — title + rule (area / following / popularity)
 *   business_row  — title + rule (area / popularity)
 * Publish is instant — the layout is data; the follower resolver re-reads it.
 */

const RULES = { creator_row: ['popularity', 'area', 'following'], business_row: ['popularity', 'area'] };
const FAMILY_LABEL = { 1: 'Category', 2: 'Price', 3: 'Offer', 4: 'Cat+Price', 5: 'Cat+Offer', 6: 'Collection' };

const rid = () => `r${Date.now()}${Math.floor(Math.random() * 1e5)}`;

export default function DiscoverBuilderPage() {
  const [scope, setScope] = useState('global');
  const [rows, setRows] = useState(null);
  const [inspector, setInspector] = useState({ concepts: [], collections: [] });
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');
  const [picker, setPicker] = useState(null); // { rowId, chipIdx }
  const [q, setQ] = useState('');

  useEffect(() => {
    adminApi.conceptInspector().then(res => {
      if (res.success) setInspector(res.data || { concepts: [], collections: [] });
    });
  }, []);

  useEffect(() => {
    setRows(null); setDirty(false);
    adminApi.getDiscoverLayout(scope).then(res => {
      if (res.success) {
        const rj = res.data?.layout?.rows_json || [];
        setRows(rj.map(r => ({ ...r, _id: r._id || rid() })));
      }
    });
  }, [scope]);

  function mutate(fn) { setRows(prev => { const next = fn(structuredClone(prev)); return next; }); setDirty(true); }

  const move = (i, d) => mutate(r => { const j = i + d; if (j < 0 || j >= r.length) return r; [r[i], r[j]] = [r[j], r[i]]; return r; });
  const removeRow = (i) => mutate(r => { r.splice(i, 1); return r; });

  function addRow(type) {
    mutate(r => {
      if (type === 'section') r.push({ _id: rid(), type, title: 'New section', chips: [{ label: null, banners: [] }] });
      else r.push({ _id: rid(), type, title: type === 'creator_row' ? 'Creators' : 'Stores', rule: 'popularity', limit: 12 });
      return r;
    });
  }

  async function save() {
    setSaving(true);
    const clean = rows.map(({ _id, ...r }) => r);
    const res = await adminApi.putDiscoverLayout(scope, clean);
    setSaving(false);
    if (res.success) { setDirty(false); setToast('Published — live on next Discover load.'); setTimeout(() => setToast(''), 2500); }
    else alert(res.error?.message || 'Save failed.');
  }

  // Inspector entries with visible counts, searchable, for the banner picker.
  const pickList = useMemo(() => {
    const all = [
      ...inspector.concepts.map(c => ({ kind: 'concept', id: c.id, name: c.name, family: c.family, visible: c.visible })),
      ...inspector.collections.map(c => ({ kind: 'collection', id: c.id, name: c.name, family: 6, visible: c.visible })),
    ];
    const t = q.trim().toLowerCase();
    return (t ? all.filter(e => e.name.toLowerCase().includes(t)) : all).slice(0, 40);
  }, [inspector, q]);

  function addBanner(entry) {
    if (!picker) return;
    mutate(r => {
      const row = r.find(x => x._id === picker.rowId);
      if (!row) return r;
      const chip = row.chips[picker.chipIdx];
      const key = entry.kind === 'concept' ? 'concept_id' : 'collection_id';
      if (!chip.banners.some(b => b[key] === entry.id)) chip.banners.push({ [key]: entry.id, title: null });
      return r;
    });
  }

  const bannerName = (b) => {
    const hit = b.concept_id
      ? inspector.concepts.find(c => c.id === b.concept_id)
      : inspector.collections.find(c => c.id === b.collection_id);
    return b.title || hit?.name || '…';
  };
  const bannerCount = (b) => {
    const hit = b.concept_id
      ? inspector.concepts.find(c => c.id === b.concept_id)
      : inspector.collections.find(c => c.id === b.collection_id);
    return hit?.visible ?? 0;
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-5">
        <div>
          <h1 className="font-display text-xl font-bold text-t1">Discover Builder</h1>
          <p className="text-xs text-t3 mt-0.5">ONE layout · Fashion · publish is instant (the layout is data, not code).</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {['global', 'business'].map(s => (
            <button key={s} onClick={() => setScope(s)}
              className={`text-xs font-bold px-3 py-1.5 rounded-full border ${scope === s ? 'bg-navy text-white border-navy' : 'border-border text-t2'}`}>
              {s === 'global' ? 'Global home' : 'Business structure'}
            </button>
          ))}
          <button onClick={save} disabled={!dirty || saving}
            className={`text-xs font-bold px-4 py-2 rounded-xl ${dirty ? 'bg-navy text-white' : 'bg-surface2 text-t3'}`}>
            {saving ? 'Publishing…' : 'Publish'}
          </button>
        </div>
      </div>

      {scope === 'business' && (
        <div className="mb-4 text-[11px] text-t3 bg-white border border-border rounded-xl px-4 py-3">
          This structure applies to <b>every store page</b>. Each row shows only what that store actually has — empty rows hide themselves.
        </div>
      )}

      {!rows ? (
        <div className="bg-white rounded-2xl border border-border p-12 text-center text-sm text-t3">Loading…</div>
      ) : (
        <div className="space-y-3">
          {rows.map((row, i) => (
            <div key={row._id} className="bg-white rounded-2xl border border-border p-4">
              <div className="flex items-center gap-2">
                <div className="flex flex-col gap-0.5">
                  <button onClick={() => move(i, -1)} className="text-[10px] text-t3 leading-none">▲</button>
                  <button onClick={() => move(i, +1)} className="text-[10px] text-t3 leading-none">▼</button>
                </div>
                <input value={row.title || ''} onChange={e => mutate(r => { r[i].title = e.target.value; return r; })}
                  className="text-sm font-bold text-t1 border border-transparent hover:border-border rounded px-1.5 py-0.5 flex-1" />
                <span className="text-[10px] font-bold text-t3 border border-border rounded-lg px-2 py-1">
                  {row.type === 'section' ? 'Section' : row.type === 'creator_row' ? 'Creator row' : 'Brand row'}
                </span>
                {row.type !== 'section' && (
                  <select value={row.rule} onChange={e => mutate(r => { r[i].rule = e.target.value; return r; })}
                    className="text-[11px] font-semibold border border-border rounded-lg px-2 py-1">
                    {RULES[row.type].map(x => <option key={x} value={x}>rule: {x}</option>)}
                  </select>
                )}
                <button onClick={() => removeRow(i)} className="text-[11px] font-bold text-red-500 px-1">Remove</button>
              </div>

              {row.type === 'section' && (
                <div className="mt-3 space-y-2">
                  {row.chips.map((chip, ci) => (
                    <div key={ci} className="border border-border rounded-xl p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <input value={chip.label || ''} placeholder="chip label (blank = no chip)"
                          onChange={e => mutate(r => { r[i].chips[ci].label = e.target.value || null; return r; })}
                          className="text-xs font-semibold border border-border rounded-lg px-2 py-1 w-52" />
                        <button onClick={() => { setPicker({ rowId: row._id, chipIdx: ci }); setQ(''); }}
                          className="text-[11px] font-bold text-navy">+ Add banner</button>
                        {row.chips.length > 1 && (
                          <button onClick={() => mutate(r => { r[i].chips.splice(ci, 1); return r; })}
                            className="text-[11px] text-t3 ml-auto">remove chip</button>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {chip.banners.length === 0 && <span className="text-[11px] text-t3 italic">no banners yet</span>}
                        {chip.banners.map((b, bi) => (
                          <span key={bi} className="inline-flex items-center gap-1.5 text-[11px] font-semibold bg-surface2 border border-border rounded-lg px-2 py-1">
                            {bannerName(b)}
                            <span className={`font-bold ${bannerCount(b) > 0 ? 'text-teal' : 'text-red-500'}`}>{bannerCount(b)}</span>
                            <button onClick={() => mutate(r => { r[i].chips[ci].banners.splice(bi, 1); return r; })} className="text-t3">✕</button>
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                  <button onClick={() => mutate(r => { r[i].chips.push({ label: 'New chip', banners: [] }); return r; })}
                    className="text-[11px] font-bold text-t2">+ Add chip</button>
                </div>
              )}
            </div>
          ))}

          <div className="flex gap-2">
            {[['section', '+ Section'], ['creator_row', '+ Creator row'], ['business_row', '+ Brand row']].map(([t, l]) => (
              <button key={t} onClick={() => addRow(t)}
                className="flex-1 border-2 border-dashed border-border rounded-2xl py-3 text-xs font-bold text-t2 hover:border-navy">
                {l}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* banner picker */}
      {picker && (
        <div className="fixed inset-0 bg-black/30 z-40 flex items-center justify-center" onClick={() => setPicker(null)}>
          <div className="bg-white rounded-2xl border border-border w-[480px] max-h-[70vh] overflow-auto p-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-2 mb-3">
              <h3 className="text-sm font-bold text-t1">Pick a concept / collection</h3>
              <button onClick={() => setPicker(null)} className="ml-auto text-t3">✕</button>
            </div>
            <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Search… (counts are live visible posts)"
              className="w-full text-sm border border-border rounded-xl px-3 py-2 mb-2" />
            {pickList.map(e => (
              <button key={`${e.kind}:${e.id}`} onClick={() => addBanner(e)}
                className="w-full flex items-center gap-2 text-left px-2 py-2 rounded-lg hover:bg-surface2">
                <span className="text-xs font-semibold text-t1 flex-1">{e.name}</span>
                <span className="text-[10px] text-t3">{FAMILY_LABEL[e.family] || '—'}</span>
                <span className={`text-[11px] font-bold ${e.visible > 0 ? 'text-teal' : 'text-red-500'}`}>{e.visible} posts</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {toast && <div className="fixed bottom-6 right-6 bg-t1 text-white text-xs font-semibold px-4 py-2 rounded-xl shadow-lg z-50">{toast}</div>}
    </div>
  );
}
