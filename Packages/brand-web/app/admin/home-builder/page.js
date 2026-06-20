'use client';

/**
 * Home Builder — admin manages the follower v2 home: the business world tabs
 * (follower_verticals) + each one's "What's on your mind?" category rail
 * (follower_vertical_categories). Rename / reorder / upload a 3D image (reuses
 * the shared stock image upload → /v1/media/stock/* URL) / hide.
 * Backend: /admin/home-verticals + /admin/home-vertical-categories.
 */

import { useEffect, useState } from 'react';
import { adminApi, uploadAdminStockImage } from '../../../lib/api';

export default function HomeBuilderPage() {
  const [verticals, setVerticals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function load() {
    const r = await adminApi.listHomeVerticals();
    setLoading(false);
    if (r.success) setVerticals(r.data?.verticals || []);
    else setErr(r.error?.message || 'Failed to load');
  }
  useEffect(() => { load(); }, []);

  const guard = async (fn) => {
    setErr(''); setBusy(true);
    try { const r = await fn(); if (r && r.success === false) setErr(r.error?.message || 'Failed'); }
    finally { setBusy(false); load(); }
  };

  // Verticals
  const addVertical = () => {
    const key = (prompt('Business key (lowercase, e.g. food)') || '').trim().toLowerCase();
    if (!key) return;
    const name = (prompt('Display name (e.g. Food)') || '').trim();
    if (!name) return;
    guard(() => adminApi.createHomeVertical({ key, name, sort_order: verticals.length + 1 }));
  };
  const renameVertical = (v) => { const n = prompt('Business name', v.name); if (n && n.trim()) guard(() => adminApi.updateHomeVertical(v.id, { name: n.trim() })); };
  const toggleVertical = (v) => guard(() => adminApi.updateHomeVertical(v.id, { enabled: !v.enabled }));
  const moveVertical = (i, dir) => {
    const j = i + dir; if (j < 0 || j >= verticals.length) return;
    const a = verticals[i], b = verticals[j];
    guard(async () => { await adminApi.updateHomeVertical(a.id, { sort_order: b.sort_order }); return adminApi.updateHomeVertical(b.id, { sort_order: a.sort_order }); });
  };
  const uploadVerticalImg = async (v, file) => {
    setErr(''); setBusy(true);
    const res = await uploadAdminStockImage(file);
    if (res.error) { setErr(res.error.message || 'Upload failed'); setBusy(false); return; }
    await adminApi.updateHomeVertical(v.id, { image_url: res.public_url });
    setBusy(false); load();
  };

  // Categories
  const addCategory = (vKey, count) => {
    const key = (prompt('Category key (lowercase, e.g. pizza)') || '').trim().toLowerCase();
    if (!key) return;
    const name = (prompt('Category name (e.g. Pizza)') || '').trim();
    if (!name) return;
    guard(() => adminApi.createHomeCategory({ vertical_key: vKey, key, name, sort_order: count + 1 }));
  };
  const renameCategory = (c) => { const n = prompt('Category name', c.name); if (n && n.trim()) guard(() => adminApi.updateHomeCategory(c.id, { name: n.trim() })); };
  const toggleCategory = (c) => guard(() => adminApi.updateHomeCategory(c.id, { enabled: !c.enabled }));
  const moveCategory = (cats, i, dir) => {
    const j = i + dir; if (j < 0 || j >= cats.length) return;
    const a = cats[i], b = cats[j];
    guard(async () => { await adminApi.updateHomeCategory(a.id, { sort_order: b.sort_order }); return adminApi.updateHomeCategory(b.id, { sort_order: a.sort_order }); });
  };
  const uploadCategoryImg = async (c, file) => {
    setErr(''); setBusy(true);
    const res = await uploadAdminStockImage(file);
    if (res.error) { setErr(res.error.message || 'Upload failed'); setBusy(false); return; }
    await adminApi.updateHomeCategory(c.id, { image_url: res.public_url });
    setBusy(false); load();
  };

  if (loading) return <div className="p-6 text-sm text-gray-500">Loading…</div>;

  return (
    <div className="p-6 max-w-4xl">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold">Home Builder</h1>
          <p className="text-xs text-gray-500">Business tabs + their category rails on the follower home. Upload a 3D image (falls back to the emoji until you do).</p>
        </div>
        <button onClick={addVertical} disabled={busy} className="bg-gold text-black text-sm font-semibold px-3 py-1.5 rounded-lg disabled:opacity-50">+ Add business</button>
      </div>
      {err && <div className="mb-3 text-sm text-red-600 bg-red-50 px-3 py-2 rounded">{err}</div>}

      <div className="space-y-4">
        {verticals.map((v, i) => (
          <div key={v.id} className={`border rounded-xl p-4 bg-white ${v.enabled ? '' : 'opacity-50'}`}>
            <div className="flex items-center gap-3">
              <ImgBox url={v.image_url} fallback={v.icon} onPick={(f) => uploadVerticalImg(v, f)} />
              <div className="flex-1">
                <div className="font-semibold">{v.name} <span className="text-xs text-gray-400">/{v.key}</span></div>
                <div className="text-xs text-gray-400">order {v.sort_order} · {v.enabled ? 'visible' : 'hidden'}</div>
              </div>
              <div className="flex items-center gap-1">
                <IconBtn onClick={() => moveVertical(i, -1)} title="Move up">↑</IconBtn>
                <IconBtn onClick={() => moveVertical(i, 1)} title="Move down">↓</IconBtn>
                <IconBtn onClick={() => renameVertical(v)} title="Rename">✎</IconBtn>
                <IconBtn onClick={() => toggleVertical(v)} title="Show/hide">{v.enabled ? '🙈' : '👁'}</IconBtn>
              </div>
            </div>

            <div className="mt-3 pl-3 border-l-2 border-gray-100">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Categories</span>
                <button onClick={() => addCategory(v.key, (v.categories || []).length)} disabled={busy} className="text-xs text-gold font-semibold">+ Add category</button>
              </div>
              {(v.categories || []).length === 0 && <div className="text-xs text-gray-400 mb-1">No categories yet.</div>}
              <div className="space-y-2">
                {(v.categories || []).map((c, ci) => (
                  <div key={c.id} className={`flex items-center gap-2 ${c.enabled ? '' : 'opacity-50'}`}>
                    <ImgBox small url={c.image_url} fallback={c.icon} onPick={(f) => uploadCategoryImg(c, f)} />
                    <div className="flex-1 text-sm">{c.name} <span className="text-xs text-gray-400">/{c.key}</span></div>
                    <IconBtn onClick={() => moveCategory(v.categories, ci, -1)}>↑</IconBtn>
                    <IconBtn onClick={() => moveCategory(v.categories, ci, 1)}>↓</IconBtn>
                    <IconBtn onClick={() => renameCategory(c)}>✎</IconBtn>
                    <IconBtn onClick={() => toggleCategory(c)}>{c.enabled ? '🙈' : '👁'}</IconBtn>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ImgBox({ url, fallback, onPick, small }) {
  const size = small ? 'w-9 h-9' : 'w-12 h-12';
  return (
    <label className={`${size} rounded-lg bg-gray-100 flex items-center justify-center overflow-hidden cursor-pointer flex-shrink-0 border border-gray-200`}>
      {url ? <img src={url} alt="" className="w-full h-full object-cover" /> : <span className={small ? 'text-lg' : 'text-2xl'}>{fallback || '🖼'}</span>}
      <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onPick(f); e.target.value = ''; }} />
    </label>
  );
}

function IconBtn({ onClick, children, title }) {
  return <button onClick={onClick} title={title} className="w-7 h-7 rounded-md border border-gray-200 text-sm flex items-center justify-center hover:bg-gray-50">{children}</button>;
}
