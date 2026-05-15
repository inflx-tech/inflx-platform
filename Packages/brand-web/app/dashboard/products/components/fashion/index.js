'use client';

/**
 * fashion template module — registered in templateRegistry.js.
 *
 * Fashion-1 ships using the built-in step components (brand_fields,
 * photo_upload, repeatable_items, preview, done). No custom step
 * components are needed because:
 *   · Variants render through the new `variant_matrix` FieldType in
 *     DynamicFieldRenderer, surfaced via the repeatable_items step's
 *     item_fields[].
 *   · The fashion-specific authoring UX is the variant-matrix editor
 *     itself, not a wholesale step rewrite.
 *   · publishDriver was extended in Fashion-1 to detect `_variants` on
 *     wizardItems and call /brands/me/products/:id/variants after each
 *     product is created.
 *
 * Things this module would add in Fashion-2 or later:
 *   · FashionFleetRow — per-item row showing variant summary (e.g.
 *     "5 sizes × 3 colors · 15 SKUs · 47 in stock")
 *   · canProceed gate on the product_authoring step (e.g. require at
 *     least 3 items)
 *   · customPublish for the "ship items + lookbooks atomically" flow
 *     once lookbooks land
 */

const fashionTemplate = {
  // stepComponents: empty for V1 — built-ins cover everything.
  // FleetRowComponent: TBD in Fashion-1b.

  canProceed: (wizardState, step, wizardItems) => {
    if (!step) return true;

    if (step.id === 'brand_basics') {
      // gender_focus is required:true in schema; enforce here for safety.
      if (!wizardState.gender_focus) return false;
      return true;
    }

    if (step.id === 'brand_photos') {
      const photos = Array.isArray(wizardState.photos) ? wizardState.photos : [];
      return photos.length >= 3;
    }

    if (step.id === 'product_authoring') {
      // V1 — allow zero-item publishes (brand can update later). Tightening
      // to >= 1 happens in Fashion-1b once the bulk Excel flow is wired
      // for fashion (right now the only path is per-item authoring).
      return true;
    }

    return true;
  },
};

export default fashionTemplate;
