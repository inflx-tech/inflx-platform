'use client';
import { useEffect, useState, useRef } from 'react';
import { mediaGalleryApi, uploadFileToGallery } from '../../../../lib/api';

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

/**
 * GalleryPicker — modal that lets brand pick existing assets from Media
 * Gallery or upload new ones (which go into the Gallery AND get selected).
 *
 * Props:
 *   - open:         boolean
 *   - onClose:      () => void
 *   - onSelect:     (assets[]) => void — called on Done with picked assets
 *   - multiple:     boolean (default true)
 *   - initialSelectedIds: string[]  — pre-selected asset ids
 */
export default function GalleryPicker({ open, onClose, onSelect, multiple = true, initialSelectedIds = [] }) {
  const [tab, setTab]           = useState('library'); // 'library' | 'upload'
  const [assets, setAssets]     = useState([]);
  const [loading, setLoading]   = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set(initialSelectedIds));
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    setSelectedIds(new Set(initialSelectedIds));
    setTab('library');
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function load() {
    setLoading(true);
    const res = await mediaGalleryApi.list();
    setLoading(false);
    if (res.success) setAssets(res.data?.assets || []);
  }

  function toggleSelect(id) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); return next; }
      if (!multiple) next.clear();
      next.add(id);
      return next;
    });
  }

  async function handleUpload(files) {
    if (!files || !files.length) return;
    setUploading(true);
    setUploadError(null);
    const newlyUploaded = [];
    for (const file of files) {
      const { asset, error } = await uploadFileToGallery(file, { title: file.name });
      if (error) {
        setUploadError(error.message || 'Upload failed');
        break;
      }
      newlyUploaded.push(asset);
    }
    setUploading(false);
    if (newlyUploaded.length) {
      setAssets(prev => [...newlyUploaded, ...prev]);
      setSelectedIds(prev => {
        const next = new Set(prev);
        for (const a of newlyUploaded) {
          if (!multiple) next.clear();
          next.add(a.id);
          if (!multiple) break;
        }
        return next;
      });
      setTab('library');
    }
  }

  function handleDone() {
    const picked = assets.filter(a => selectedIds.has(a.id));
    onSelect(picked);
    onClose();
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <div className="font-display text-base font-bold text-t1">Media Gallery</div>
          <button onClick={onClose} className="text-t3 hover:text-t1 text-xl leading-none">×</button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-5 pt-3">
          <button
            onClick={() => setTab('library')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${tab === 'library' ? 'bg-navy-pale text-navy' : 'text-t3 hover:bg-surface2'}`}>
            From Gallery ({assets.length})
          </button>
          <button
            onClick={() => setTab('upload')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${tab === 'upload' ? 'bg-navy-pale text-navy' : 'text-t3 hover:bg-surface2'}`}>
            Upload New
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {tab === 'library' ? (
            loading ? (
              <div className="p-8 text-center text-t3 text-sm">Loading gallery…</div>
            ) : assets.length === 0 ? (
              <div className="p-12 text-center">
                <div className="text-4xl mb-2">🖼️</div>
                <div className="font-bold text-t1 mb-1">Your gallery is empty</div>
                <div className="text-xs text-t3 mb-4">Upload your first asset to share with influencers</div>
                <button onClick={() => setTab('upload')} className="px-4 py-2 bg-navy text-white font-semibold text-xs rounded-xl">Upload Now</button>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-3">
                {assets.map(a => {
                  const selected = selectedIds.has(a.id);
                  const isImage = (a.file_type || '').startsWith('image/');
                  return (
                    <div
                      key={a.id}
                      onClick={() => toggleSelect(a.id)}
                      className={`group cursor-pointer rounded-xl border-2 overflow-hidden transition-all ${selected ? 'border-navy ring-2 ring-navy/30' : 'border-border hover:border-navy/40'}`}>
                      <div className="aspect-square bg-surface2 flex items-center justify-center relative overflow-hidden">
                        {isImage && a.download_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={a.download_url} alt={a.title} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-4xl">{iconFor(a.file_type)}</span>
                        )}
                        {selected && (
                          <div className="absolute top-1 right-1 w-5 h-5 bg-navy rounded-full flex items-center justify-center text-white text-[10px] font-bold">✓</div>
                        )}
                      </div>
                      <div className="p-2">
                        <div className="text-[11px] font-semibold text-t1 truncate">{a.title}</div>
                        <div className="text-[9px] text-t3">{sizeLabel(a.file_size_bytes)}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          ) : (
            <div>
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-border rounded-xl p-10 text-center cursor-pointer hover:border-navy hover:bg-navy-pale/20 transition-colors">
                <div className="text-4xl mb-2">☁️</div>
                <div className="font-bold text-t1 mb-1">Click to select files</div>
                <div className="text-xs text-t3">Images, PDF, ZIP · max 25 MB each. For videos, add a Reference Link in the Gallery.</div>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple={multiple}
                  accept={ACCEPT_FILE_TYPES}
                  className="hidden"
                  onChange={e => handleUpload(Array.from(e.target.files || []))}
                />
              </div>
              {uploading && <div className="mt-3 text-center text-xs text-t3">Uploading…</div>}
              {uploadError && <div className="mt-3 text-center text-xs text-red-600">{uploadError}</div>}
              <div className="mt-4 text-[11px] text-t3 leading-relaxed">
                Uploaded files are saved to your gallery and can be reused in other campaigns.
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-border px-5 py-3">
          <div className="text-xs text-t3">
            {selectedIds.size} selected
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 bg-surface2 text-t2 font-semibold text-xs rounded-xl hover:bg-navy-pale">Cancel</button>
            <button
              onClick={handleDone}
              disabled={selectedIds.size === 0}
              className="px-4 py-2 bg-navy text-white font-semibold text-xs rounded-xl disabled:opacity-40 disabled:cursor-not-allowed">
              Attach {selectedIds.size > 0 ? `(${selectedIds.size})` : ''}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
