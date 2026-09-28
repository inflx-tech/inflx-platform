'use client';
// The 4-field gift item form (O13): name, photo, value, stock. Contract: features/offer-builder-v2
// Used by Listings → Gift items and by the pool builder's "+ New gift item" (rules 1.7): both save
// to the same place, so an item made inside an offer can be restocked and reused later.
import { useState } from 'react';
import { brandApi, uploadFileToGallery, API_BASE } from '../../lib/api';

export default function GiftItemForm({ item = null, onSaved, onCancel }) {
  const [name, setName] = useState(item?.name || '');
  const [value, setValue] = useState(item?.value ?? '');
  const [stock, setStock] = useState(item?.stock ?? '');
  const [photo, setPhoto] = useState(item?.photo_url || '');
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function upload(file) {
    if (!file) return;
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) { setErr('Upload a JPG, PNG or WebP photo.'); return; }
    setUploading(true); setErr('');
    const r = await uploadFileToGallery(file, { title: file.name, tags: ['gift_item'] });
    setUploading(false);
    if (r.asset?.id) setPhoto(`${API_BASE}/media/assets/${r.asset.id}`);
    else setErr(r.error?.message || 'The photo didn\'t upload. Try again.');
  }

  async function save() {
    if (busy) return;
    setBusy(true); setErr('');
    const body = { name, value: value === '' ? null : Number(value), stock: stock === '' ? null : Number(stock), photo_url: photo || null };
    const r = item ? await brandApi.updateGiftItem(item.id, body) : await brandApi.createGiftItem(body);
    setBusy(false);
    if (!r.success) { setErr(r.error?.message || 'Couldn\'t save the gift item.'); return; }
    onSaved && onSaved(r.data.gift_item);
  }

  return (
    <div className="card">
      <h4>{item ? `Edit ${item.name}` : 'New gift item'}</h4>
      <div className="field"><span className="lbl">Name</span>
        <input className="inp" value={name} maxLength={120} placeholder="Silver coin 5g" onChange={(e) => setName(e.target.value)} /></div>
      <div className="field"><span className="lbl">Photo</span>
        <div className="row">
          {photo
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={photo} alt="" style={{ width: 44, height: 44, borderRadius: 9, objectFit: 'cover', border: '1px solid var(--border)' }} />
            : null}
          <label className="btn btn-ghost btn-sm">{uploading ? 'Uploading…' : (photo ? 'Change photo' : 'Upload…')}
            <input type="file" accept="image/jpeg,image/png,image/webp" hidden disabled={uploading} onChange={(e) => upload(e.target.files && e.target.files[0])} />
          </label>
        </div>
      </div>
      <div className="grid2">
        <div className="field"><span className="lbl">Value (₹)</span>
          <input className="inp" type="number" min="1" step="1" value={value} placeholder="650" onChange={(e) => setValue(e.target.value)} />
          <span className="hint">Shown to shoppers as &quot;worth ₹{value || '650'}&quot;. Used in the gift check.</span></div>
        <div className="field"><span className="lbl">Stock</span>
          <input className="inp" type="number" min="0" step="1" value={stock} placeholder="50" onChange={(e) => setStock(e.target.value)} />
          <span className="hint">Each gift given takes one. Restock here any time.</span></div>
      </div>
      {err && <div className="err">{err}</div>}
      <div className="row">
        <button className="btn btn-ink btn-sm" disabled={busy || uploading} onClick={save}>{busy ? 'Saving…' : 'Save gift item'}</button>
        {onCancel && <button className="btn btn-ghost btn-sm" disabled={busy} onClick={onCancel}>Cancel</button>}
      </div>
    </div>
  );
}
