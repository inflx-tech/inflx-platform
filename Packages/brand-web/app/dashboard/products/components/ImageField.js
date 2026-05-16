'use client';

import { useState } from 'react';
import GalleryPicker from '../../gallery/components/GalleryPicker';

/**
 * ImageField — Wave 1 Dining. Renders either:
 *
 *   mode="single"   →  Square dropzone for one image. Optional COVER badge.
 *                      Value shape: string URL (image_url).
 *
 *   mode="gallery"  →  Grid of square tiles with add/remove. Min/max enforced
 *                      from field.min/field.max. Value shape: string[] URLs.
 *
 * Both modes open the existing GalleryPicker modal so the brand can pick
 * from previously-uploaded assets OR upload new ones. The picker handles
 * S3/R2 upload — we just consume the returned asset URLs.
 *
 * The renderer doesn't itself upload — it delegates to GalleryPicker, then
 * normalizes the returned asset shape to the URL string(s) the schema
 * expects for image / image[] fields.
 */
export default function ImageField({ field, mode = 'single', value, onChange, error }) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const isGallery = mode === 'gallery';

  // Normalize value shape per mode
  const urls = isGallery
    ? (Array.isArray(value) ? value : [])
    : (value ? [value] : []);

  const min = field.min ?? 0;
  const max = field.max ?? (isGallery ? 12 : 1);
  const canAddMore = urls.length < max;

  function handlePickerSelect(assets) {
    setPickerOpen(false);
    if (!Array.isArray(assets) || assets.length === 0) return;
    const newUrls = assets.map(a => a.url || a.cdn_url || a.image_url).filter(Boolean);
    if (isGallery) {
      const combined = [...urls, ...newUrls].slice(0, max);
      onChange(combined);
    } else {
      onChange(newUrls[0]);
    }
  }

  function handleRemove(idx) {
    if (isGallery) {
      onChange(urls.filter((_, i) => i !== idx));
    } else {
      onChange(null);
    }
  }

  function handleMove(idx, dir) {
    // Reorder within gallery (gallery mode only)
    if (!isGallery) return;
    const next = [...urls];
    const tgt = idx + dir;
    if (tgt < 0 || tgt >= next.length) return;
    [next[idx], next[tgt]] = [next[tgt], next[idx]];
    onChange(next);
  }

  return (
    <div className="space-y-2">
      {/* Grid of selected images */}
      {urls.length > 0 && (
        <div className="grid grid-cols-4 gap-2">
          {urls.map((url, idx) => (
            <div key={`${url}_${idx}`} className="relative aspect-square rounded-xl border overflow-hidden group bg-gray-50"
                 style={{ borderColor: '#D0D7DE' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt={`upload ${idx + 1}`} className="w-full h-full object-cover" />

              {/* Cover badge — single-mode + field.cover_required */}
              {!isGallery && field.cover_required !== false && (
                <span className="absolute top-1 left-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wide"
                      style={{ fontFamily: 'monospace', backgroundColor: '#1F2328', color: '#fff' }}>
                  ⭐ Cover
                </span>
              )}

              {/* Remove */}
              <button type="button"
                      onClick={() => handleRemove(idx)}
                      className="absolute top-1 right-1 w-6 h-6 rounded-full bg-white shadow flex items-center justify-center text-gray-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                      aria-label="Remove image">
                ×
              </button>

              {/* Reorder arrows — gallery mode only */}
              {isGallery && urls.length > 1 && (
                <div className="absolute bottom-1 left-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button type="button" onClick={() => handleMove(idx, -1)} disabled={idx === 0}
                          className="flex-1 py-0.5 rounded bg-white/90 text-[10px] font-bold text-gray-700 disabled:opacity-30">
                    ←
                  </button>
                  <button type="button" onClick={() => handleMove(idx, 1)} disabled={idx === urls.length - 1}
                          className="flex-1 py-0.5 rounded bg-white/90 text-[10px] font-bold text-gray-700 disabled:opacity-30">
                    →
                  </button>
                </div>
              )}
            </div>
          ))}

          {/* Add-more tile */}
          {canAddMore && (
            <button type="button"
                    onClick={() => setPickerOpen(true)}
                    className="aspect-square rounded-xl border-dashed border-2 flex flex-col items-center justify-center text-xs font-bold transition-colors hover:bg-yellow-50"
                    style={{ borderColor: '#AFB8C1', color: '#57606A' }}>
              <span className="text-2xl" style={{ color: '#EAB308' }}>+</span>
              <span>Add</span>
            </button>
          )}
        </div>
      )}

      {/* Empty state — single big dropzone */}
      {urls.length === 0 && (
        <button type="button"
                onClick={() => setPickerOpen(true)}
                className={`w-full aspect-square max-w-[200px] rounded-xl border-dashed border-2 flex flex-col items-center justify-center gap-2 text-sm font-semibold transition-colors hover:bg-yellow-50 ${
                  error ? 'border-red-400 bg-red-50 text-red-500' : ''
                }`}
                style={!error ? { borderColor: '#AFB8C1', color: '#57606A', backgroundColor: '#F8F9FA' } : undefined}>
          <span className="text-3xl" style={{ color: '#EAB308' }}>+</span>
          <span>{isGallery ? 'Add photos' : 'Pick photo'}</span>
          <span className="text-[11px] font-normal text-gray-400">
            From gallery or upload
          </span>
        </button>
      )}

      {/* Min/max helper text */}
      {(min > 0 || max < 99) && (
        <p className="text-[11px] text-gray-400" style={{ fontFamily: 'monospace' }}>
          {urls.length} / {max} {urls.length < min ? `· need ${min - urls.length} more` : ''}
        </p>
      )}

      {/* Modal */}
      <GalleryPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={handlePickerSelect}
        multiple={isGallery}
        initialSelectedIds={[]}
      />
    </div>
  );
}
