'use client';
import { useEffect, useState, useCallback } from 'react';
import { sectionApi, uploadAdminStockImage } from '../../../lib/api';
import ImageCropModal from '../../../components/ImageCropModal';
import { frameFor } from '../../../lib/imageFrames';

// Admin → Category Images (category-images P2). Browse the drill-down category
// tree and give each node a picture (crop-to-frame, 1:1). Stored in
// category_nodes.meta.image_url; the follower rail + tiles render it (falling
// back to the colored placeholder where absent).
const VERTICALS = ['fashion', 'furniture'];

// Flatten the tree → indented rows so the whole hierarchy is uploadable.
function flatten(nodes, depth = 0, out = []) {
  for (const n of (nodes || [])) {
    out.push({ ...n, _depth: depth });
    if (n.children && n.children.length) flatten(n.children, depth + 1, out);
  }
  return out;
}

export default function CategoryImagesPage() {
  const [vertical, setVertical] = useState('fashion');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [crop, setCrop] = useState(null);      // { node, file }
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await sectionApi.categoryTree(vertical);
    setLoading(false);
    if (r.success) setRows(flatten(r.data?.tree || []));
    else setMsg({ kind: 'err', text: r.error?.message || 'Failed to load tree' });
  }, [vertical]);
  useEffect(() => { load(); }, [load]);

  const toast = (kind, text) => { setMsg({ kind, text }); setTimeout(() => setMsg(null), 3000); };

  const onCropDone = async (croppedFile) => {
    const node = crop.node;
    setCrop(null); setBusy(node.id);
    const up = await uploadAdminStockImage(croppedFile, sectionApi.stockUploadUrl);
    if (up.error || !up.public_url) { setBusy(''); toast('err', up.error?.message || 'Upload failed'); return; }
    const r = await sectionApi.setCategoryNodeImage(node.id, up.public_url);
    setBusy('');
    if (!r.success) { toast('err', r.error?.message || 'Save failed'); return; }
    setRows(rs => rs.map(x => x.id === node.id ? { ...x, image_url: up.public_url } : x));
    toast('ok', `Image set for ${node.name}`);
  };
  const clearImage = async (node) => {
    setBusy(node.id);
    const r = await sectionApi.setCategoryNodeImage(node.id, null);
    setBusy('');
    if (!r.success) { toast('err', r.error?.message || 'Failed'); return; }
    setRows(rs => rs.map(x => x.id === node.id ? { ...x, image_url: null } : x));
  };

  const needle = q.trim().toLowerCase();
  const visible = needle ? rows.filter(r => (r.name || '').toLowerCase().includes(needle)) : rows;
  const withImg = rows.filter(r => r.image_url).length;
  const fr = frameFor('category');

  return (
    <div style={{ padding: 24, maxWidth: 780, margin: '0 auto', fontFamily: "'Plus Jakarta Sans',system-ui,sans-serif" }}>
      <h1 style={{ fontSize: 22, fontWeight: 800 }}>🖼️ Category Images</h1>
      <p style={{ fontSize: 13, color: '#71717A', margin: '4px 0 14px' }}>
        Give each category a picture (square, crop-to-frame). Shows in the follower
        category rail and tiles. {withImg}/{rows.length} have an image.
      </p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        {VERTICALS.map(v => (
          <button key={v} onClick={() => setVertical(v)}
            style={{ padding: '7px 14px', borderRadius: 999, border: '1px solid #E4E4E7', fontWeight: 700, fontSize: 12,
              background: vertical === v ? '#0A0A0A' : '#fff', color: vertical === v ? '#FFC107' : '#52525B', cursor: 'pointer', textTransform: 'capitalize' }}>{v}</button>
        ))}
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search categories…"
          style={{ flex: 1, minWidth: 160, border: '1px solid #E4E4E7', borderRadius: 10, padding: '8px 12px', fontSize: 13 }} />
      </div>

      {msg && <div style={{ marginBottom: 10, padding: '8px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700,
        background: msg.kind === 'ok' ? '#D1FAE5' : '#FEF2F2', color: msg.kind === 'ok' ? '#047857' : '#B91C1C' }}>{msg.text}</div>}

      {loading ? <div style={{ color: '#71717A', fontSize: 13 }}>Loading {vertical} categories…</div> : (
        <div style={{ border: '1px solid #E4E4E7', borderRadius: 12, overflow: 'hidden' }}>
          {visible.map((n) => (
            <div key={n.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 12px', borderTop: '1px solid #F4F4F5', paddingLeft: 12 + n._depth * 18 }}>
              <div style={{ width: 44, height: 44, borderRadius: 10, background: '#F4F4F5', overflow: 'hidden', flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {n.image_url
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={n.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <span style={{ color: '#C7C7CC', fontSize: 16 }}>{n.is_leaf ? '◆' : '▸'}</span>}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{n.name}</div>
                <div style={{ fontSize: 11, color: '#A1A1AA' }}>{[n.segment, n.category].filter(Boolean).join(' › ') || vertical}{n.is_leaf ? ' · leaf' : ''}</div>
              </div>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#1D4ED8', cursor: 'pointer' }}>
                {busy === n.id ? '…' : (n.image_url ? 'Replace' : 'Upload')}
                <input type="file" accept="image/*" style={{ display: 'none' }}
                  onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) setCrop({ node: n, file: f }); }} />
              </label>
              {n.image_url ? <button onClick={() => clearImage(n)} style={{ fontSize: 11, color: '#B91C1C', background: 'none', border: 0, cursor: 'pointer' }}>Remove</button> : null}
            </div>
          ))}
          {!visible.length && <div style={{ padding: 16, color: '#A1A1AA', fontSize: 13 }}>No category matches “{q}”.</div>}
        </div>
      )}

      {crop && (
        <ImageCropModal file={crop.file} aspect={fr.aspect} outW={fr.w} outH={fr.h} title={`Category · 1:1 — ${crop.node.name}`}
          onCancel={() => setCrop(null)} onDone={onCropDone} />
      )}
    </div>
  );
}
