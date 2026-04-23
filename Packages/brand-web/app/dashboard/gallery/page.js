'use client';
import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { mediaGalleryApi, uploadFileToGallery } from '../../../lib/api';

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
  const [tab, setTab] = useState('assets'); // 'assets' | 'contracts'

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-5">
        <h1 className="font-display text-xl font-bold text-t1">Media Gallery</h1>
        <p className="text-xs text-t3 mt-0.5">Brand assets you share with influencers, plus all signed contracts in one place.</p>
      </div>

      <div className="flex gap-1 mb-4 border-b border-border">
        <button
          onClick={() => setTab('assets')}
          className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${tab === 'assets' ? 'border-navy text-navy' : 'border-transparent text-t3 hover:text-t1'}`}>
          Brand Assets
        </button>
        <button
          onClick={() => setTab('contracts')}
          className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${tab === 'contracts' ? 'border-navy text-navy' : 'border-transparent text-t3 hover:text-t1'}`}>
          Contracts
        </button>
      </div>

      {tab === 'assets' ? <AssetsPanel /> : <ContractsPanel />}
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
  const fileInputRef = useRef(null);

  async function load() {
    setLoading(true);
    const res = await mediaGalleryApi.list(tagFilter ? { tag: tagFilter } : null);
    setLoading(false);
    if (res.success) setAssets(res.data?.assets || []);
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
        <div className="text-[11px] text-t3">Images, video, PDF, ZIP · max 50 MB each</div>
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
