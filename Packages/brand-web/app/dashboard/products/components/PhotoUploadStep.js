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

  const labelNoun = template?.label || 'Listing';
  const defaultTitle = `${labelNoun} photos`;

  function handlePickerDone(picked) {
    onFieldChange('photos', picked);  // full asset objects so we can re-render thumbnails
  }

  function removePhoto(assetId) {
    onFieldChange('photos', photos.filter(p => p.id !== assetId));
  }

  const initialSelectedIds = photos.map(p => p.id);

  // Accent — pulled from card_config so the CTA matches the category color
  // (orange for restaurant, purple for salon, blue for car_rental).
  const accent = template?.card_config?.accent || '#F97316'; // orange-500 default
  const accentHover = template?.card_config?.accent_hover || accent;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold text-gray-900">{step.title || defaultTitle}</h2>
        {step.subtitle && <p className="text-sm text-gray-500 mt-1">{step.subtitle}</p>}
      </div>

      {/* Status row */}
      <div className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3 border border-gray-200">
        <div className="text-xs">
          <span className="font-bold text-gray-700">{photos.length}</span>
          <span className="text-gray-500"> of {max} photos</span>
          {photos.length < min && (
            <span className="text-amber-600 ml-2">
              (need {min - photos.length} more to publish)
            </span>
          )}
          {photos.length >= min && photos.length < recommended && (
            <span className="text-blue-600 ml-2">
              (add {recommended - photos.length} more for best discoverability)
            </span>
          )}
        </div>
        <button type="button" onClick={() => setPickerOpen(true)}
          style={{ backgroundColor: accent }}
          className="px-4 py-2 text-white text-xs font-bold rounded-xl hover:opacity-90 transition-opacity">
          {photos.length === 0 ? '+ Add photos' : '+ Add or change'}
        </button>
      </div>

      {/* Photo grid */}
      {photos.length === 0 ? (
        <div className="text-center py-10 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
          <p className="text-3xl mb-2">📷</p>
          <p className="text-sm font-bold text-gray-700 mb-1">No photos yet</p>
          <p className="text-xs text-gray-400 mb-3">
            Pick from your gallery or upload from your device
          </p>
          <button type="button" onClick={() => setPickerOpen(true)}
            style={{ backgroundColor: accent }}
            className="px-5 py-2 text-white text-xs font-bold rounded-xl hover:opacity-90 transition-opacity">
            Open Gallery
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-3">
          {photos.map(p => (
            <div key={p.id} className="aspect-square rounded-xl overflow-hidden bg-gray-100 relative group border border-gray-200">
              {p.download_url
                ? <img src={p.download_url} alt={p.title || 'Photo'} className="w-full h-full object-cover" />
                : <div className="w-full h-full flex items-center justify-center text-3xl">🖼️</div>}
              <button type="button" onClick={() => removePhoto(p.id)}
                className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 text-white text-xs opacity-0 group-hover:opacity-100 transition-opacity">
                ×
              </button>
            </div>
          ))}
        </div>
      )}

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
