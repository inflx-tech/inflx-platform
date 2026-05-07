'use client';

import { useState } from 'react';
import GalleryPicker from '../../../gallery/components/GalleryPicker';

/**
 * RestaurantPhotoStep — overrides the built-in `photo_upload` step for
 * restaurants. Mounts the existing brand-web GalleryPicker modal so the
 * brand selects from already-uploaded assets OR uploads new ones (which
 * also land in the brand's gallery for reuse elsewhere).
 *
 * Selected asset IDs persist into wizardState.photos (the new
 * brand_config.fields.photos field, declared as image[] per v1.3
 * FieldType enum). publishDriver routes the array through to
 * brand.listing_data.photos via the brand-write path on Publish.
 *
 * Per v1.4 contract patch: photo_upload step component for restaurant is
 * a TEMPLATE OVERRIDE (registered in restaurant/index.js's stepComponents)
 * — salon and car_rental keep the built-in placeholder until their own
 * gallery integration lands.
 *
 * Quality rule honored: brand_config.photo_requirements.gallery_min/max
 * read by canProceed (in restaurant/index.js) to gate Next.
 */

export default function RestaurantPhotoStep({ step, template, wizardState, onFieldChange }) {
  const [pickerOpen, setPickerOpen] = useState(false);

  const photos = Array.isArray(wizardState.photos) ? wizardState.photos : [];
  const photoReq = template?.brand_config?.photo_requirements || {};
  const min = photoReq.gallery_min || step.min_photos || 0;
  const max = photoReq.gallery_max || step.max_photos || 99;
  const recommended = photoReq.gallery_recommended || step.recommended_photos || min;

  // wizardState stores asset IDs. We need the full asset objects for
  // thumbnail rendering — GalleryPicker returns {id, download_url, ...}
  // on select. We persist the full objects to wizardState (id is what
  // the publishDriver writes to brand.listing_data; the rest is for
  // re-render).
  function handlePickerDone(picked) {
    onFieldChange('photos', picked);  // store full asset objects
  }

  function removePhoto(assetId) {
    onFieldChange('photos', photos.filter(p => p.id !== assetId));
  }

  const initialSelectedIds = photos.map(p => p.id);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold text-gray-900">{step.title || 'Restaurant photos'}</h2>
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
          className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold rounded-xl">
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
            className="px-5 py-2 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold rounded-xl">
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
