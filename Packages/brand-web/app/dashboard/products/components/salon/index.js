'use client';

import SalonMasterPicker from './SalonMasterPicker';
import SalonSpecConfirmation from './SalonSpecConfirmation';
import SalonPricingForm from './SalonPricingForm';
import SalonFleetRow from './SalonFleetRow';
import SalonServiceInlinePicker from './SalonServiceInlinePicker';

/**
 * salon template module — registered in templateRegistry.js.
 *
 * Phase Salon-1 introduces SalonServiceInlinePicker, which collapses the
 * legacy 3-step authoring (service_picker → service_specs → service_pricing)
 * into a single inline-expand multi-pick step. salon.json's listing_steps
 * now declares one `service_authoring` step with component
 * `salon_service_inline` instead of the three separate steps.
 *
 * Step components currently registered:
 *   - salon_service_inline → SalonServiceInlinePicker (Phase Salon-1)
 *       Multi-pick master grid + per-item inline editor (price, duration,
 *       gender, premium, stylist choice, stylist multi-select, inclusions,
 *       before/after photos via GalleryPicker).
 *
 *   The legacy components stay imported and exposed under their original
 *   snake_case names so any schema author who keeps the 3-step layout
 *   (e.g. via a future variant schema) still gets the working components:
 *
 *   - master_picker → SalonMasterPicker
 *   - spec_confirmation → SalonSpecConfirmation
 *   - pricing → SalonPricingForm
 *
 * canProceed gates: brand_team unchanged. The new service_authoring step
 * gates on: at least one picked, every picked has price > 0, and every
 * service with requires_stylist_choice has stylists assigned.
 */

const salonTemplate = {
  stepComponents: {
    // Phase Salon-1
    salon_service_inline: SalonServiceInlinePicker,

    // Legacy 3-step components — retained for back-compat with any schema
    // variant that uses the separated step layout. salon.json no longer
    // references these by default; they're dispatched only if a schema
    // author re-introduces master_picker / spec_confirmation / pricing
    // steps.
    master_picker: SalonMasterPicker,
    spec_confirmation: SalonSpecConfirmation,
    pricing: SalonPricingForm,
  },

  FleetRowComponent: SalonFleetRow,
  // customPublish: not needed. publishDriver iterates wizardItems and
  // resolves storage_format paths (master_row.service_name + wizard_state.foo)
  // per item. SalonServiceInlinePicker populates _master_row on each item
  // at pick-time so master_row.* resolution works per-item.

  /**
   * Per-step validation gates. Layout's canProceedFromStep() calls this
   * before advancing the wizard. Returning false greys out the Next button.
   *
   * Signature: (wizardState, step, wizardItems) — wizardItems was added in
   * v1.3 §6.5 so multi-item steps (like service_authoring) can gate on the
   * picked set.
   */
  canProceed: (wizardState, step, wizardItems) => {
    if (!step) return true;

    if (step.id === 'brand_team') {
      const teamMembers = wizardState.team_members || [];
      return teamMembers.length > 0;
    }

    if (step.id === 'service_authoring') {
      // Phase Salon-1 consolidated step. Gates:
      //   1. At least one service picked.
      //   2. Every picked service has price > 0 (you can't publish ₹0).
      //   3. Every service flagged requires_stylist_choice has stylists
      //      assigned (else SlotPickerScreen hits the "no stylists" defensive
      //      state at booking time).
      const items = Array.isArray(wizardItems) ? wizardItems : [];
      if (items.length === 0) return false;
      for (const it of items) {
        if (!(Number(it.price) > 0)) return false;
        if (it.requires_stylist_choice) {
          const ids = it.available_stylist_ids || [];
          if (ids.length === 0) return false;
        }
      }
      return true;
    }

    // Legacy gates retained for schema variants that re-enable the 3-step flow.
    if (step.id === 'service_picker') {
      return !!wizardState._master_row;
    }
    if (step.id === 'service_specs') {
      if (wizardState.requires_stylist_choice) {
        const ids = wizardState.available_stylist_ids || [];
        if (ids.length === 0) return false;
      }
      return true;
    }
    if (step.id === 'service_pricing') {
      return Number(wizardState.price) > 0;
    }

    // brand_photos: gate on 3-photo minimum (matches restaurant's pattern).
    // brand_config.photo_requirements.gallery_min = 3 per salon.json.
    if (step.id === 'brand_photos') {
      const photos = Array.isArray(wizardState.photos) ? wizardState.photos : [];
      return photos.length >= 3;
    }

    return true;
  },
};

export default salonTemplate;
