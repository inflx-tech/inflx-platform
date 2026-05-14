'use client';

import RestaurantFleetRow from './RestaurantFleetRow';
import RestaurantDishPicker from './RestaurantDishPicker';

/**
 * restaurant template module — registered in templateRegistry.js.
 *
 * Step components:
 *   - restaurant_dish_picker → RestaurantDishPicker
 *       Step 4 component with internal Bulk/Individual path-choice.
 *       Bulk path mounts shared BulkUploadCard. Individual path browses
 *       master_dishes by cuisine→section, tap-to-add with inline price
 *       edit + image swap (mounts GalleryPicker).
 *
 * The prior `photo_upload → RestaurantPhotoStep` template override was
 * removed in Phase Salon-1: the built-in `photo_upload` in
 * builtinStepComponents.js now mounts the same GalleryPicker integration
 * (via the generalized PhotoUploadStep), so every category — restaurant,
 * salon, car_rental, and any future schema — gets working photo authoring
 * with zero per-template wiring. The override pattern remains available
 * for genuine category-specific UX divergence.
 *
 * Layout configuration:
 *   - hideUploadTab: true — restaurant handles bulk upload INSIDE step 4's
 *     path-choice. The layout's top-level "Bulk Upload" tab is hidden for
 *     restaurant brands per chat decision (two entry points = confusing).
 *     Salon and car_rental keep the layout-tab Upload (no step-internal bulk).
 *
 * canProceed gates:
 *   - menu step: NO GATE per chat decision. min_items removed from schema;
 *     brand can publish a zero-item menu. Admin moderation in next phase
 *     catches quality issues.
 *   - brand_photos step: enforces brand_config.photo_requirements.gallery_min.
 *     Default 3 photos required to advance.
 *
 * Storage_format-driven publish: restaurant has no customPublish — the
 * declarative storage_format in restaurant.json drives publishDriver
 * directly. Restaurant exercises three of four publishDriver source-
 * resolution types (wizard_state.foo, master_row.foo for individual-add
 * items, nested spec for variants_json).
 */

const restaurantTemplate = {
  stepComponents: {
    restaurant_dish_picker: RestaurantDishPicker,
    // photo_upload now flows through the built-in (which mounts GalleryPicker)
  },

  FleetRowComponent: RestaurantFleetRow,

  hideUploadTab: true,   // step 4's path-choice replaces the layout-tab Upload

  canProceed: (wizardState, step) => {
    if (!step) return true;

    if (step.id === 'brand_photos') {
      const photos = Array.isArray(wizardState.photos) ? wizardState.photos : [];
      // Floor from brand_config.photo_requirements.gallery_min if available;
      // restaurant.json declares gallery_min: 3.
      const min = 3;
      return photos.length >= min;
    }

    return true;
  },
};

export default restaurantTemplate;
