'use client';
import { useEffect, useMemo, useState, useRef } from 'react';
import { adminApi, sectionApi, uploadAdminStockImage } from '../../../lib/api';

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
  // banner editor (image + CTA) + category picker + tree cache
  const [bannerEdit, setBannerEdit] = useState(null); // { rowId, chipIdx, bannerIdx }
  const [catPicker, setCatPicker] = useState(null);   // { rowId }
  const [catTree, setCatTree] = useState([]);         // flattened nodes {id,name,image_url,depth}
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => {
    adminApi.conceptInspector().then(res => {
      if (res.success) setInspector(res.data || { concepts: [], collections: [] });
    });
    // Same tree + images the Category Images page maintains — one image source.
    sectionApi.categoryTree('fashion').then(res => {
      if (!res.success) return;
      const flat = [];
      const walk = (nodes, depth) => (nodes || []).forEach(n => {
        flat.push({ id: n.id, name: n.name, image_url: n.meta?.image_url || n.image_url || null, depth });
        walk(n.children, depth + 1);
      });
      walk(res.data?.tree || res.data?.nodes || res.data || [], 0);
      setCatTree(flat);
    }).catch(() => {});
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
      else if (type === 'category_row') r.push({ _id: rid(), type, title: 'Shop by category', category_ids: [] });
      else r.push({ _id: rid(), type, title: type === 'creator_row' ? 'Creators' : 'Stores', rule: 'popularity', limit: 12 });
      return r;
    });
  }

  // Banner art upload — same presign helper as every admin image surface.
  async function onBannerFile(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !bannerEdit) return;
    setUploading(true);
    try {
      const up = await uploadAdminStockImage(file, sectionApi.stockUploadUrl);
      if (up?.public_url) {
        mutate(r => {
          const row = r.find(x => x._id === bannerEdit.rowId);
          if (row) row.chips[bannerEdit.chipIdx].banners[bannerEdit.bannerIdx].image_url = up.public_url;
          return r;
        });
      } else alert('Upload failed.');
    } catch { alert('Upload failed.'); }
    setUploading(false);
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
                  {row.type === 'section' ? 'Section' : row.type === 'category_row' ? 'Category row' : row.type === 'creator_row' ? 'Creator row' : 'Brand row'}
                </span>
                {(row.type === 'creator_row' || row.type === 'business_row') && (
                  <select value={row.rule} onChange={e => mutate(r => { r[i].rule = e.target.value; return r; })}
                    className="text-[11px] font-semibold border border-border rounded-lg px-2 py-1">
                    {RULES[row.type].map(x => <option key={x} value={x}>rule: {x}</option>)}
                  </select>
                )}
                <button onClick={() => removeRow(i)} className="text-[11px] font-bold text-red-500 px-1">Remove</button>
              </div>

              {row.type === 'category_row' && (
                <div className="mt-3">
                  <div className="flex flex-wrap items-center gap-2">
                    {(row.category_ids || []).map((cid) => {
                      const node = catTree.find(n => n.id === cid);
                      return (
                        <span key={cid} className="inline-flex flex-col items-center gap-1">
                          {node?.image_url
                            ? <img src={node.image_url} alt="" className="w-12 h-12 rounded-full object-cover border border-border" />
                            : <span className="w-12 h-12 rounded-full border border-dashed border-red-300 text-[8px] text-red-500 flex items-center justify-center text-center">no image</span>}
                          <span className="text-[10px] font-semibold text-t1 max-w-[64px] truncate">{node?.name || '…'}</span>
                          <button onClick={() => mutate(r => { r[i].category_ids = r[i].category_ids.filter(x => x !== cid); return r; })}
                            className="text-[9px] text-t3">remove</button>
                        </span>
                      );
                    })}
                    <button onClick={() => setCatPicker({ rowId: row._id })}
                      className="w-12 h-12 rounded-full border-2 border-dashed border-border text-t2 text-lg">＋</button>
                  </div>
                  <div className="text-[10px] text-t3 mt-2">Round images come from <b>Category Images</b> — one image, every surface. Categories without an image won't render (upload there first).</div>
                </div>
              )}

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
                        {chip.banners.map((b, bi) => {
                          const editing = bannerEdit && bannerEdit.rowId === row._id && bannerEdit.chipIdx === ci && bannerEdit.bannerIdx === bi;
                          return (
                            <button key={bi} onClick={() => setBannerEdit(editing ? null : { rowId: row._id, chipIdx: ci, bannerIdx: bi })}
                              className={`inline-flex items-center gap-1.5 text-[11px] font-semibold border rounded-lg px-2 py-1 ${editing ? 'border-navy bg-white' : 'bg-surface2 border-border'}`}>
                              {b.image_url
                                ? <img src={b.image_url} alt="" className="w-5 h-5 rounded object-cover" />
                                : <span className="w-5 h-5 rounded bg-surface2 border border-dashed border-border text-[9px] leading-5 text-t3">🖼</span>}
                              {bannerName(b)}
                              <span className={`font-bold ${bannerCount(b) > 0 ? 'text-teal' : 'text-red-500'}`}>{bannerCount(b)}</span>
                            </button>
                          );
                        })}
                      </div>
                      {bannerEdit && bannerEdit.rowId === row._id && bannerEdit.chipIdx === ci && row.chips[ci].banners[bannerEdit.bannerIdx] && (
                        <div className="mt-2 flex items-center gap-3 border border-navy/30 bg-white rounded-xl p-2.5">
                          {row.chips[ci].banners[bannerEdit.bannerIdx].image_url
                            ? <img src={row.chips[ci].banners[bannerEdit.bannerIdx].image_url} alt="" className="w-16 h-10 rounded-lg object-cover border border-border" />
                            : <div className="w-16 h-10 rounded-lg border border-dashed border-border text-[9px] text-t3 flex items-center justify-center text-center">no art —<br/>post cover used</div>}
                          <button onClick={() => fileRef.current?.click()} disabled={uploading}
                            className="text-[11px] font-bold text-navy">{uploading ? 'Uploading…' : row.chips[ci].banners[bannerEdit.bannerIdx].image_url ? 'Replace image' : 'Upload banner image'}</button>
                          <div className="flex items-center gap-1.5 ml-2">
                            <span className="text-[10px] font-bold text-t3">CTA</span>
                            <input value={row.chips[ci].banners[bannerEdit.bannerIdx].cta || ''} placeholder="Shop Now"
                              onChange={e => mutate(r => { r[i].chips[ci].banners[bannerEdit.bannerIdx].cta = e.target.value || null; return r; })}
                              className="text-[11px] font-semibold border border-border rounded-lg px-2 py-1 w-28" />
                          </div>
                          <button onClick={() => { mutate(r => { r[i].chips[ci].banners.splice(bannerEdit.bannerIdx, 1); return r; }); setBannerEdit(null); }}
                            className="text-[11px] font-bold text-red-500 ml-auto">Remove banner</button>
                          <button onClick={() => setBannerEdit(null)} className="text-t3 text-xs">✕</button>
                        </div>
                      )}
                    </div>
                  ))}
                  <button onClick={() => mutate(r => { r[i].chips.push({ label: 'New chip', banners: [] }); return r; })}
                    className="text-[11px] font-bold text-t2">+ Add chip</button>
                </div>
              )}
            </div>
          ))}

          <div className="flex gap-2">
            {[['section', '+ Section'], ['category_row', '+ Category row'], ['creator_row', '+ Creator row'], ['business_row', '+ Brand row']].map(([t, l]) => (
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

      {/* category picker (round-image tiles source) */}
      {catPicker && (
        <div className="fixed inset-0 bg-black/30 z-40 flex items-center justify-center" onClick={() => setCatPicker(null)}>
          <div className="bg-white rounded-2xl border border-border w-[480px] max-h-[70vh] overflow-auto p-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-2 mb-3">
              <h3 className="text-sm font-bold text-t1">Pick categories</h3>
              <span className="text-[10px] text-t3">images from Category Images</span>
              <button onClick={() => setCatPicker(null)} className="ml-auto text-t3">✕</button>
            </div>
            <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Search categories…"
              className="w-full text-sm border border-border rounded-xl px-3 py-2 mb-2" />
            {catTree
              .filter(n => !q.trim() || n.name.toLowerCase().includes(q.trim().toLowerCase()))
              .slice(0, 60)
              .map(n => (
                <button key={n.id}
                  onClick={() => { mutate(r => { const row = r.find(x => x._id === catPicker.rowId); if (row && !row.category_ids.includes(n.id)) row.category_ids.push(n.id); return r; }); }}
                  className="w-full flex items-center gap-2 text-left px-2 py-1.5 rounded-lg hover:bg-surface2">
                  {n.image_url
                    ? <img src={n.image_url} alt="" className="w-8 h-8 rounded-full object-cover border border-border" />
                    : <span className="w-8 h-8 rounded-full border border-dashed border-border" />}
                  <span className="text-xs font-semibold text-t1" style={{ paddingLeft: n.depth * 10 }}>{n.name}</span>
                  {!n.image_url && <span className="ml-auto text-[10px] font-bold text-red-500">no image</span>}
                </button>
              ))}
          </div>
        </div>
      )}

      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onBannerFile} />
      {toast && <div className="fixed bottom-6 right-6 bg-t1 text-white text-xs font-semibold px-4 py-2 rounded-xl shadow-lg z-50">{toast}</div>}
    </div>
  );
}
