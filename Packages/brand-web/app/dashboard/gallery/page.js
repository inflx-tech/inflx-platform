'use client';
import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { mediaGalleryApi, referenceLinkApi, uploadFileToGallery } from '../../../lib/api';

const ACCEPT_FILE_TYPES = 'image/png,image/jpeg,image/jpg,image/webp,image/gif,image/svg+xml,image/heic,image/heif,application/pdf,application/zip';

const TAG_OPTIONS = [
  { value: 'logo',         label: 'Logo' },
  { value: 'brand_kit',    label: 'Brand Kit' },
  { value: 'product_shot', label: 'Product Shot' },
  { value: 'video',        label: 'Video' },
  { value: 'document',     label: 'Document' },
  { value: 'other',        label: 'Other' },
];

function iconFor(type) {
  if (!type) return '📄';
  if (type.startsWith('image/')) return '🖼️';
  if (type.startsWith('video/')) return '🎬';
  if (type === 'application/pdf') return '📄';
  if (type.includes('zip')) return '📦';
  return '📄';
}

function sizeLabel(bytes) {
  const n = Number(bytes || 0);
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function fmtDate(iso) {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }); }
  catch { return '—'; }
}

function fmtRupees(n) {
  const x = Math.round(Number(n) || 0);
  return `Rs. ${x.toLocaleString('en-IN')}`;
}

const STATUS_COLORS = {
  draft:              'bg-gray-100 text-gray-700',
  pending_influencer: 'bg-amber-100 text-amber-800',
  pending_brand:      'bg-blue-100 text-blue-800',
  active:             'bg-green-100 text-green-800',
  cancelled:          'bg-red-100 text-red-700',
};

export default function GalleryPage() {
  const [tab, setTab] = useState('assets'); // 'assets' | 'links' | 'contracts'

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-5">
        <h1 className="font-display text-xl font-bold text-t1">Media Gallery</h1>
        <p className="text-xs text-t3 mt-0.5">Brand assets you share with influencers, links to external references, and every signed contract in one place.</p>
      </div>

      <div className="flex gap-1 mb-4 border-b border-border">
        <button
          onClick={() => setTab('assets')}
          className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${tab === 'assets' ? 'border-navy text-navy' : 'border-transparent text-t3 hover:text-t1'}`}>
          Brand Assets
        </button>
        <button
          onClick={() => setTab('links')}
          className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${tab === 'links' ? 'border-navy text-navy' : 'border-transparent text-t3 hover:text-t1'}`}>
          Reference Links
        </button>
        <button
          onClick={() => setTab('contracts')}
          className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${tab === 'contracts' ? 'border-navy text-navy' : 'border-transparent text-t3 hover:text-t1'}`}>
          Contracts
        </button>
      </div>

      {tab === 'assets'    ? <AssetsPanel /> :
       tab === 'links'     ? <LinksPanel /> :
       <ContractsPanel />}
    </div>
  );
}

function UsageBar({ usage }) {
  if (!usage) return null;
  const pct = usage.used_pct || 0;
  const usedMb = (usage.used_bytes / (1024 * 1024)).toFixed(1);
  const quotaMb = Math.floor(usage.quota_bytes / (1024 * 1024));
  const remainingMb = Math.max(0, (usage.remaining_bytes / (1024 * 1024))).toFixed(0);
  const barColor = pct >= 90 ? 'bg-red-500' : pct >= 75 ? 'bg-amber-500' : 'bg-navy';
  return (
    <div className="mb-4 p-3 bg-white rounded-xl border border-border">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs font-semibold text-t1">Storage: {usedMb} MB of {quotaMb} MB used</span>
        <span className="text-[11px] text-t3">{remainingMb} MB free</span>
      </div>
      <div className="h-2 bg-surface2 rounded-full overflow-hidden">
        <div className={`h-full ${barColor} transition-all`} style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
      {pct >= 90 && (
        <div className="mt-2 text-[11px] text-red-700">
          You're near the limit. Delete unused assets, or contact support to increase your quota.
        </div>
      )}
    </div>
  );
}

function AssetsPanel() {
  const [assets, setAssets]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [tagFilter, setTagFilter] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [editingAsset, setEditingAsset] = useState(null);
  const [usage, setUsage] = useState(null);
  const fileInputRef = useRef(null);

  async function load() {
    setLoading(true);
    const [assetsRes, usageRes] = await Promise.all([
      mediaGalleryApi.list(tagFilter ? { tag: tagFilter } : null),
      mediaGalleryApi.getUsage(),
    ]);
    setLoading(false);
    if (assetsRes.success) setAssets(assetsRes.data?.assets || []);
    if (usageRes.success)  setUsage(usageRes.data);
  }

  useEffect(() => { load(); }, [tagFilter]);

  async function handleFiles(files) {
    if (!files || !files.length) return;
    setUploading(true);
    setUploadError(null);
    for (const file of files) {
      const { error } = await uploadFileToGallery(file, { title: file.name });
      if (error) { setUploadError(error.message || 'Upload failed'); break; }
    }
    setUploading(false);
    load();
  }

  async function handleDelete(id) {
    if (!confirm('Delete this asset? This cannot be undone.')) return;
    const res = await mediaGalleryApi.delete(id);
    if (res.success || res.ok || res.status === 204) load();
  }

  return (
    <div>
      <UsageBar usage={usage} />

      {/* Toolbar */}
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-t3 font-semibold">Filter:</span>
          <button
            onClick={() => setTagFilter('')}
            className={`px-2.5 py-1 text-[11px] rounded-lg font-semibold ${tagFilter === '' ? 'bg-navy text-white' : 'bg-surface2 text-t2 hover:bg-navy-pale'}`}>
            All
          </button>
          {TAG_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setTagFilter(opt.value)}
              className={`px-2.5 py-1 text-[11px] rounded-lg font-semibold ${tagFilter === opt.value ? 'bg-navy text-white' : 'bg-surface2 text-t2 hover:bg-navy-pale'}`}>
              {opt.label}
            </button>
          ))}
        </div>

        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="px-4 py-2 bg-navy text-white font-semibold text-xs rounded-xl hover:bg-navy-deep transition-colors disabled:opacity-50">
          {uploading ? 'Uploading…' : '+ Upload Asset'}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={ACCEPT_FILE_TYPES}
          className="hidden"
          onChange={e => handleFiles(Array.from(e.target.files || []))}
        />
      </div>

      {uploadError && (
        <div className="mb-3 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">{uploadError}</div>
      )}

      {/* Upload dropzone (also clickable) */}
      <div
        onClick={() => fileInputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); }}
        onDrop={e => { e.preventDefault(); handleFiles(Array.from(e.dataTransfer.files || [])); }}
        className="border-2 border-dashed border-border rounded-xl p-6 text-center cursor-pointer hover:border-navy hover:bg-navy-pale/20 transition-colors mb-5">
        <div className="text-2xl mb-1">☁️</div>
        <div className="text-sm font-semibold text-t1">Click or drag files here to upload</div>
        <div className="text-[11px] text-t3">Images, PDF, ZIP · max 25 MB each. For videos, add a Reference Link instead.</div>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="p-8 text-center text-t3 text-sm">Loading…</div>
      ) : assets.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-xl border border-border">
          <div className="text-4xl mb-2">🖼️</div>
          <div className="font-bold text-t1 mb-1">No assets yet</div>
          <div className="text-xs text-t3">Upload logos, brand kits, videos, and reference material to share with influencers</div>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {assets.map(a => (
            <AssetCard
              key={a.id}
              asset={a}
              onEdit={() => setEditingAsset(a)}
              onDelete={() => handleDelete(a.id)}
            />
          ))}
        </div>
      )}

      {editingAsset && (
        <EditAssetModal
          asset={editingAsset}
          onClose={() => setEditingAsset(null)}
          onSaved={() => { setEditingAsset(null); load(); }}
        />
      )}
    </div>
  );
}

function AssetCard({ asset, onEdit, onDelete }) {
  const isImage = (asset.file_type || '').startsWith('image/');
  const isVideo = (asset.file_type || '').startsWith('video/');
  return (
    <div className="bg-white rounded-xl border border-border overflow-hidden group">
      <div className="aspect-square bg-surface2 flex items-center justify-center relative overflow-hidden">
        {isImage && asset.download_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={asset.download_url} alt={asset.title} className="w-full h-full object-cover" />
        ) : isVideo && asset.download_url ? (
          <video src={asset.download_url} className="w-full h-full object-cover" muted />
        ) : (
          <span className="text-5xl">{iconFor(asset.file_type)}</span>
        )}
      </div>
      <div className="p-3">
        <div className="text-xs font-bold text-t1 truncate">{asset.title}</div>
        {asset.description && <div className="text-[10px] text-t3 mt-0.5 line-clamp-2">{asset.description}</div>}
        <div className="flex flex-wrap gap-1 mt-2">
          {(asset.tags || []).map(t => (
            <span key={t} className="text-[9px] bg-navy-pale text-navy px-1.5 py-0.5 rounded">{t.replace(/_/g, ' ')}</span>
          ))}
        </div>
        <div className="flex items-center justify-between mt-2 pt-2 border-t border-border">
          <div className="text-[10px] text-t3">{sizeLabel(asset.file_size_bytes)}</div>
          <div className="flex gap-1">
            {asset.download_url && (
              <a href={asset.download_url} target="_blank" rel="noreferrer" className="text-[10px] text-navy font-semibold hover:underline">Open</a>
            )}
            <button onClick={onEdit} className="text-[10px] text-t3 hover:text-navy">Edit</button>
            <button onClick={onDelete} className="text-[10px] text-red-600 hover:text-red-700">Del</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function EditAssetModal({ asset, onClose, onSaved }) {
  const [title, setTitle]             = useState(asset.title || '');
  const [description, setDescription] = useState(asset.description || '');
  const [tags, setTags]               = useState(new Set(asset.tags || []));
  const [saving, setSaving]           = useState(false);
  const [error, setError]             = useState(null);

  function toggleTag(value) {
    const next = new Set(tags);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    setTags(next);
  }

  async function save() {
    setSaving(true);
    setError(null);
    const res = await mediaGalleryApi.update(asset.id, {
      title, description, tags: Array.from(tags),
    });
    setSaving(false);
    if (res.success) onSaved();
    else setError(res.error?.message || 'Save failed');
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <div className="font-display text-base font-bold text-t1">Edit Asset</div>
          <button onClick={onClose} className="text-t3 hover:text-t1 text-xl leading-none">×</button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="text-xs font-semibold text-t2 block mb-1">Title</label>
            <input value={title} onChange={e => setTitle(e.target.value)} className="w-full px-3 py-2 border border-border rounded-lg text-sm" />
          </div>
          <div>
            <label className="text-xs font-semibold text-t2 block mb-1">Description</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} className="w-full px-3 py-2 border border-border rounded-lg text-sm" />
          </div>
          <div>
            <label className="text-xs font-semibold text-t2 block mb-1">Tags</label>
            <div className="flex flex-wrap gap-1.5">
              {TAG_OPTIONS.map(opt => (
                <button key={opt.value} onClick={() => toggleTag(opt.value)}
                  className={`px-2.5 py-1 text-[11px] rounded-lg font-semibold ${tags.has(opt.value) ? 'bg-navy text-white' : 'bg-surface2 text-t2 hover:bg-navy-pale'}`}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          {error && <div className="text-xs text-red-600">{error}</div>}
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-3">
          <button onClick={onClose} className="px-4 py-2 bg-surface2 text-t2 font-semibold text-xs rounded-xl">Cancel</button>
          <button onClick={save} disabled={saving || !title.trim()} className="px-4 py-2 bg-navy text-white font-semibold text-xs rounded-xl disabled:opacity-40">
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

function LinksPanel() {
  const [links, setLinks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // null = none, {} = new, {id} = edit

  async function load() {
    setLoading(true);
    const res = await referenceLinkApi.list();
    setLoading(false);
    if (res.success) setLinks(res.data?.links || []);
  }

  useEffect(() => { load(); }, []);

  async function handleDelete(id) {
    if (!confirm('Delete this link?')) return;
    const res = await referenceLinkApi.delete(id);
    if (res.success || res.ok || res.status === 204) load();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="text-xs text-t3">
          URLs to YouTube videos, Drive folders, Figma files, etc. Zero storage cost — only the link is saved.
        </div>
        <button
          onClick={() => setEditing({})}
          className="px-4 py-2 bg-navy text-white font-semibold text-xs rounded-xl hover:bg-navy-deep">
          + Add Link
        </button>
      </div>

      {loading ? (
        <div className="p-8 text-center text-t3 text-sm">Loading…</div>
      ) : links.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-xl border border-border">
          <div className="text-4xl mb-2">🔗</div>
          <div className="font-bold text-t1 mb-1">No reference links yet</div>
          <div className="text-xs text-t3">Add YouTube reels, Drive folders, Figma files, Notion briefs — anything you'd normally share by link.</div>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-border overflow-hidden">
          {links.map(l => (
            <div key={l.id} className="flex items-start gap-3 p-4 border-b border-border last:border-0 hover:bg-surface1/50">
              <div className="text-xl flex-shrink-0">{iconForUrl(l.url)}</div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-t1 truncate">{l.title}</div>
                <a href={l.url} target="_blank" rel="noreferrer" className="text-[11px] text-navy hover:underline truncate block">{l.url}</a>
                {l.description && <div className="text-[11px] text-t3 mt-1 line-clamp-2">{l.description}</div>}
              </div>
              <div className="flex gap-1 flex-shrink-0">
                <a href={l.url} target="_blank" rel="noreferrer" className="px-2 py-1 text-[11px] text-navy font-semibold hover:bg-navy-pale rounded">Open</a>
                <button onClick={() => setEditing(l)} className="px-2 py-1 text-[11px] text-t3 hover:bg-surface2 rounded">Edit</button>
                <button onClick={() => handleDelete(l.id)} className="px-2 py-1 text-[11px] text-red-600 hover:bg-red-50 rounded">Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <LinkModal
          link={editing.id ? editing : null}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }}
        />
      )}
    </div>
  );
}

function iconForUrl(url) {
  const u = (url || '').toLowerCase();
  if (u.includes('youtube.') || u.includes('youtu.be')) return '▶️';
  if (u.includes('drive.google.') || u.includes('docs.google.')) return '📄';
  if (u.includes('figma.com')) return '🎨';
  if (u.includes('notion.')) return '📝';
  if (u.includes('instagram.')) return '📷';
  if (u.includes('dropbox.')) return '📦';
  return '🔗';
}

function LinkModal({ link, onClose, onSaved }) {
  const [title, setTitle] = useState(link?.title || '');
  const [url, setUrl] = useState(link?.url || '');
  const [description, setDescription] = useState(link?.description || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  async function save() {
    setSaving(true);
    setError(null);
    const payload = { url, title, description: description || null };
    const res = link?.id
      ? await referenceLinkApi.update(link.id, payload)
      : await referenceLinkApi.create(payload);
    setSaving(false);
    if (res.success) onSaved();
    else setError(res.error?.message || 'Save failed');
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <div className="font-display text-base font-bold text-t1">{link?.id ? 'Edit Link' : 'Add Reference Link'}</div>
          <button onClick={onClose} className="text-t3 hover:text-t1 text-xl leading-none">×</button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="text-xs font-semibold text-t2 block mb-1">Title</label>
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Product launch hero video" className="w-full px-3 py-2 border border-border rounded-lg text-sm" />
          </div>
          <div>
            <label className="text-xs font-semibold text-t2 block mb-1">URL</label>
            <input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://…" className="w-full px-3 py-2 border border-border rounded-lg text-sm" />
          </div>
          <div>
            <label className="text-xs font-semibold text-t2 block mb-1">Description (optional)</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} className="w-full px-3 py-2 border border-border rounded-lg text-sm" />
          </div>
          {error && <div className="text-xs text-red-600">{error}</div>}
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-3">
          <button onClick={onClose} className="px-4 py-2 bg-surface2 text-t2 font-semibold text-xs rounded-xl">Cancel</button>
          <button onClick={save} disabled={saving || !title.trim() || !url.trim()} className="px-4 py-2 bg-navy text-white font-semibold text-xs rounded-xl disabled:opacity-40">
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ContractsPanel() {
  const [contracts, setContracts] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [previewContract, setPreviewContract] = useState(null);

  useEffect(() => {
    mediaGalleryApi.listContracts().then(res => {
      setLoading(false);
      if (res.success) setContracts(res.data?.contracts || []);
    });
  }, []);

  const filtered = contracts.filter(c => {
    if (statusFilter !== 'all' && c.status !== statusFilter) return false;
    if (search) {
      const s = search.toLowerCase();
      return (c.campaign_name || '').toLowerCase().includes(s) ||
             (c.influencer_name || '').toLowerCase().includes(s) ||
             (c.influencer_handle || '').toLowerCase().includes(s);
    }
    return true;
  });

  return (
    <div>
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by campaign or influencer…"
          className="flex-1 min-w-[240px] px-3 py-2 border border-border rounded-lg text-sm"
        />
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="px-3 py-2 border border-border rounded-lg text-sm">
          <option value="all">All statuses</option>
          <option value="draft">Draft</option>
          <option value="pending_influencer">Pending Influencer</option>
          <option value="pending_brand">Pending Brand</option>
          <option value="active">Active</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      {loading ? (
        <div className="p-8 text-center text-t3 text-sm">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-xl border border-border">
          <div className="text-4xl mb-2">📝</div>
          <div className="font-bold text-t1 mb-1">No contracts match</div>
          <div className="text-xs text-t3">Sign a contract with an influencer to see it here.</div>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-surface2">
              <tr className="text-left text-[11px] text-t3 uppercase">
                <th className="px-4 py-2 font-semibold">Campaign</th>
                <th className="px-4 py-2 font-semibold">Influencer</th>
                <th className="px-4 py-2 font-semibold">Fee</th>
                <th className="px-4 py-2 font-semibold">Status</th>
                <th className="px-4 py-2 font-semibold">Signed</th>
                <th className="px-4 py-2 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => (
                <tr key={c.id} className="border-t border-border hover:bg-surface1/50">
                  <td className="px-4 py-3">
                    <div className="font-semibold text-t1">{c.campaign_name}</div>
                    <div className="text-[10px] text-t3">{c.campaign_goal}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-semibold text-t1">{c.influencer_name}</div>
                    {c.influencer_handle && <div className="text-[10px] text-t3">@{c.influencer_handle}</div>}
                  </td>
                  <td className="px-4 py-3 text-t1 font-semibold">
                    {fmtRupees(Number(c.influencer_fee) + Number(c.bonus_amount || 0))}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-0.5 text-[10px] font-semibold rounded ${STATUS_COLORS[c.status] || 'bg-gray-100 text-gray-700'}`}>
                      {String(c.status || '').replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[11px] text-t3">{fmtDate(c.brand_signed_at || c.created_at)}</td>
                  <td className="px-4 py-3 text-right">
                    {c.pdf_url ? (
                      <button onClick={() => setPreviewContract(c)} className="text-[11px] text-navy font-semibold hover:underline">View PDF</button>
                    ) : (
                      <span className="text-[10px] text-t3">No PDF yet</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {previewContract && (
        <ContractPreviewModal contract={previewContract} onClose={() => setPreviewContract(null)} />
      )}
    </div>
  );
}

function ContractPreviewModal({ contract, onClose }) {
  const [url, setUrl]       = useState(null);
  const [loading, setLoad]  = useState(true);
  const [error, setError]   = useState(null);

  useEffect(() => {
    mediaGalleryApi.contractPdfUrl(contract.id).then(res => {
      setLoad(false);
      if (res.success) setUrl(res.data?.url);
      else setError(res.error?.message || 'Could not load PDF');
    });
  }, [contract.id]);

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-4xl h-[88vh] flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <div>
            <div className="font-display text-base font-bold text-t1">{contract.campaign_name}</div>
            <div className="text-[11px] text-t3">{contract.influencer_name}{contract.influencer_handle ? ` · @${contract.influencer_handle}` : ''}</div>
          </div>
          <div className="flex items-center gap-2">
            {url && <a href={url} target="_blank" rel="noreferrer" className="px-3 py-1.5 bg-navy text-white text-xs font-semibold rounded-lg">Download</a>}
            <button onClick={onClose} className="text-t3 hover:text-t1 text-xl leading-none">×</button>
          </div>
        </div>
        <div className="flex-1 overflow-hidden bg-surface2">
          {loading ? (
            <div className="h-full flex items-center justify-center text-t3 text-sm">Loading PDF…</div>
          ) : error ? (
            <div className="h-full flex items-center justify-center text-red-600 text-sm">{error}</div>
          ) : url ? (
            <iframe src={url} className="w-full h-full" title="Contract PDF" />
          ) : (
            <div className="h-full flex items-center justify-center text-t3 text-sm">No PDF available</div>
          )}
        </div>
      </div>
    </div>
  );
}
