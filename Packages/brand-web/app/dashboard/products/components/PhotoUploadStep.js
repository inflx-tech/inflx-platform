'use client';

import { useState } from 'react';
import GalleryPicker from '../../gallery/components/GalleryPicker';

/**
 * PhotoUploadStep — the working `photo_upload` step component, schema-driven.
 *
 * Replaces the visual placeholder that used to live in builtinStepComponents.
 * Mounts the brand-web GalleryPicker modal: brand picks from already-uploaded
 * assets OR uploads new ones (which also land in the brand's gallery for
 * reuse across listings).
 *
 * Selected asset OBJECTS persist into wizardState.photos (the brand_config
 * `photos` field, declared as image[]). publishDriver's brand-write path
 * routes them into brand.listing_data.photos on Publish.
 *
 * Reads gating thresholds in priority order:
 *   1. template.brand_config.photo_requirements.{gallery_min,gallery_max,gallery_recommended}
 *   2. step.{min_photos,max_photos,recommended_photos}
 *   3. sensible defaults
 *
 * The canProceed hook in each template's registry module enforces the minimum
 * (restaurant gates on photos.length >= 3; salon should do the same after
 * Phase Salon-1).
 *
 * Generalized in Phase Salon-1 from the prior restaurant-only RestaurantPhotoStep.
 * Salon now picks this up automatically via the layout's built-in dispatch
 * because salon's `photo_upload` step has no template override.
 */

export default function PhotoUploadStep({ step, template, wizardState, onFieldChange }) {
  const [pickerOpen, setPickerOpen] = useState(false);

  const photos = Array.isArray(wizardState.photos) ? wizardState.photos : [];
  const photoReq = template?.brand_config?.photo_requirements || {};
  const min = photoReq.gallery_min || step.min_photos || 0;
  const max = photoReq.gallery_max || step.max_photos || 99;
  const recommended = photoReq.gallery_recommended || step.recommended_photos || min;

  // Wave 2 (Dining) — cover photo workflow. When the step config carries
  // cover_required: true (restaurant.json sets this on the photos step),
  // we ask the brand to mark one gallery photo as the cover. The selected
  // photo's URL is mirrored into wizardState[cover_field_key] (default
  // 'cover_image_url'). publishDriver routes it into brand.listing_data,
  // and the backend updateMe handler mirrors it into the typed
  // brands.cover_image_url column for discovery filters.
  const coverRequired = step.cover_required || photoReq.cover_required || false;
  const coverFieldKey = step.cover_field_key || 'cover_image_url';
  const coverUrl      = wizardState[coverFieldKey] || null;

  const labelNoun = template?.label || 'Listing';
  const defaultTitle = `${labelNoun} photos`;

  function urlOf(p) {
    return p?.download_url || p?.url || null;
  }

  function handlePickerDone(picked) {
    onFieldChange('photos', picked);
    // If the previously-chosen cover is no longer in the gallery, drop it.
    if (coverUrl && !picked.some(p => urlOf(p) === coverUrl)) {
      onFieldChange(coverFieldKey, null);
    }
    // Auto-pick the first photo as cover if cover is required and none set.
    if (coverRequired && !coverUrl && picked.length > 0) {
      const firstUrl = urlOf(picked[0]);
      if (firstUrl) onFieldChange(coverFieldKey, firstUrl);
    }
  }

  function removePhoto(assetId) {
    const removed = photos.find(p => p.id === assetId);
    const removedUrl = urlOf(removed);
    onFieldChange('photos', photos.filter(p => p.id !== assetId));
    // Clear cover if the removed photo was the cover.
    if (removedUrl && removedUrl === coverUrl) {
      onFieldChange(coverFieldKey, null);
    }
  }

  function setCover(photo) {
    const url = urlOf(photo);
    if (url) onFieldChange(coverFieldKey, url);
  }

  const initialSelectedIds = photos.map(p => p.id);

  // Accent — pulled from card_config so the CTA matches the category color
  // (orange for restaurant, purple for salon, blue for car_rental).
  const accent = template?.card_config?.accent || '#F97316'; // orange-500 default
  const accentHover = template?.card_config?.accent_hover || accent;

  // Find the cover photo object (if any) so the dedicated section can
  // render it as a tall hero tile with Change button — matches the
  // mockup pattern of cover-as-its-own-section above the gallery grid.
  const coverPhoto = coverUrl ? photos.find(p => urlOf(p) === coverUrl) : null;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-xl font-bold text-ink-1 tracking-tight">{step.title || defaultTitle}</h2>
        {step.subtitle && <p className="text-sm text-ink-3 mt-1">{step.subtitle}</p>}
      </div>

      {/* ─── Cover photo section (only when cover_required) ────────────── */}
      {coverRequired && (
        <div>
          <div className="flex items-baseline justify-between mb-2">
            <h4 className="font-display text-base font-bold text-ink-1">
              Cover photo <span className="text-red ml-0.5">*</span>
            </h4>
            <span className="font-mono text-[10px] uppercase tracking-wider text-ink-3">
              headline image · shown on every card
            </span>
          </div>
          {coverPhoto ? (
            <div className="relative rounded-xl overflow-hidden border border-line-soft bg-paper-surface" style={{ height: 240 }}>
              <img src={urlOf(coverPhoto)} alt="Cover"
                   className="w-full h-full object-cover" />
              <span className="absolute top-3 left-3 px-3 py-1 rounded-md bg-ink-1 text-yellow font-mono text-[10px] uppercase tracking-wider font-bold shadow">
                ★ Cover
              </span>
              <div className="absolute bottom-3 right-3 flex gap-2">
                <button type="button" onClick={() => setPickerOpen(true)}
                  className="px-3 py-1.5 rounded-md bg-paper text-ink-1 border border-line-soft text-xs font-bold hover:bg-paper-surface transition-colors">
                  Change
                </button>
                <button type="button" onClick={() => onFieldChange(coverFieldKey, null)}
                  className="px-3 py-1.5 rounded-md bg-paper text-ink-2 border border-line-soft text-xs font-bold hover:bg-paper-surface transition-colors">
                  Unset
                </button>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border-2 border-dashed border-line-soft bg-paper-surface flex flex-col items-center justify-center text-center" style={{ height: 240 }}>
              <div className="text-3xl mb-2">⭐</div>
              <div className="font-display text-sm font-bold text-ink-1">No cover picked yet</div>
              <div className="text-xs text-ink-3 mt-1 max-w-xs">
                {photos.length === 0
                  ? 'Add some gallery photos first, then mark one as your cover.'
                  : 'Pick a photo from your gallery below and click "Make cover".'}
              </div>
              {photos.length === 0 && (
                <button type="button" onClick={() => setPickerOpen(true)}
                  className="mt-3 px-4 py-2 bg-yellow hover:bg-yellow-deep text-ink-1 text-xs font-bold rounded-lg transition-colors">
                  Open Gallery
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* ─── Gallery section ───────────────────────────────────────────── */}
      <div>
        <div className="flex items-baseline justify-between mb-3">
          <h4 className="font-display text-base font-bold text-ink-1">
            {coverRequired ? 'Ambience gallery' : (step.title || defaultTitle)}
            {' '}
            <span className="font-normal text-ink-3 text-xs ml-1">
              {photos.length} of {max} · min {min}
            </span>
          </h4>
          <button type="button" onClick={() => setPickerOpen(true)}
            className="px-3 py-1.5 bg-yellow hover:bg-yellow-deep text-ink-1 text-xs font-bold rounded-lg transition-colors">
            {photos.length === 0 ? '+ Add photos' : '+ Add or change'}
          </button>
        </div>

        {/* Quota row */}
        {photos.length < min && (
          <div className="text-xs text-yellow-deep mb-2">
            Need <span className="font-mono font-bold">{min - photos.length}</span> more photo{min - photos.length !== 1 ? 's' : ''} to publish.
          </div>
        )}
        {photos.length >= min && photos.length < recommended && (
          <div className="text-xs text-ink-2 mb-2">
            Add <span className="font-mono font-bold">{recommended - photos.length}</span> more for best discoverability.
          </div>
        )}

        {photos.length === 0 ? (
          <div className="text-center py-10 bg-paper-surface rounded-xl border-2 border-dashed border-line-soft">
            <p className="text-3xl mb-2">📷</p>
            <p className="font-display text-sm font-bold text-ink-1 mb-1">No photos yet</p>
            <p className="text-xs text-ink-3 mb-3">
              Pick from your gallery or upload from your device.
            </p>
            <button type="button" onClick={() => setPickerOpen(true)}
              className="px-4 py-2 bg-yellow hover:bg-yellow-deep text-ink-1 text-xs font-bold rounded-lg transition-colors">
              Open Gallery
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-2">
            {photos.map(p => {
              const url = urlOf(p);
              const isCover = coverRequired && url && url === coverUrl;
              return (
                <div key={p.id}
                     className={`aspect-square rounded-lg overflow-hidden bg-paper-surface relative group border transition-all
                       ${isCover ? 'border-yellow ring-2 ring-yellow-pale' : 'border-line-soft'}`}>
                  {url
                    ? <img src={url} alt={p.title || 'Photo'} className="w-full h-full object-cover" />
                    : <div className="w-full h-full flex items-center justify-center text-2xl">🖼️</div>}

                  {isCover && (
                    <div className="absolute top-1 left-1 px-1.5 py-0.5 rounded bg-ink-1 text-yellow font-mono text-[8px] uppercase tracking-wider font-bold">
                      Cover
                    </div>
                  )}

                  {coverRequired && !isCover && (
                    <button type="button" onClick={() => setCover(p)}
                      className="absolute bottom-1 left-1 right-1 px-1.5 py-1 rounded bg-black/55 backdrop-blur text-white text-[10px] font-semibold opacity-0 group-hover:opacity-100 transition-opacity">
                      Make cover
                    </button>
                  )}

                  <button type="button" onClick={() => removePhoto(p.id)}
                    className="absolute top-1 right-1 w-5 h-5 rounded-full bg-paper text-ink-1 text-xs flex items-center justify-center shadow opacity-0 group-hover:opacity-100 transition-opacity"
                    aria-label="Remove photo">
                    ×
                  </button>
                </div>
              );
            })}
            {photos.length < max && (
              <button type="button" onClick={() => setPickerOpen(true)}
                className="aspect-square rounded-lg border-2 border-dashed border-line-soft bg-paper text-ink-3 text-2xl hover:border-yellow hover:text-yellow-deep transition-colors flex items-center justify-center">
                +
              </button>
            )}
          </div>
        )}

        {/* Photos quality nudge */}
        {photos.length >= min && photos.length < 8 && (
          <div className="bg-yellow-pale border border-yellow rounded-lg px-3 py-2 mt-3 text-xs text-ink-2 flex gap-2 items-start">
            <span className="text-base">📸</span>
            <span><strong className="text-ink-1">+10 quality pts</strong> at 8 gallery photos · <strong className="text-ink-1">+5 more</strong> at 10. Restaurants with rich galleries get 3× more clicks.</span>
          </div>
        )}
      </div>

      <GalleryPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={handlePickerDone}
        multiple={true}
        initialSelectedIds={initialSelectedIds}
      />
    </div>
  );
}
