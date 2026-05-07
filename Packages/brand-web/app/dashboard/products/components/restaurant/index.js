'use client';

import RestaurantFleetRow from './RestaurantFleetRow';
import RestaurantDishPicker from './RestaurantDishPicker';
import RestaurantPhotoStep from './RestaurantPhotoStep';

/**
 * restaurant template module — registered in templateRegistry.js.
 *
 * Step components (PR-2 of restaurant rework):
 *   - restaurant_dish_picker → RestaurantDishPicker
 *       Step 4 component with internal Bulk/Individual path-choice.
 *       Bulk path mounts shared BulkUploadCard. Individual path browses
 *       master_dishes by cuisine→section, tap-to-add with inline price
 *       edit + image swap (mounts GalleryPicker).
 *
 *   - photo_upload → RestaurantPhotoStep (TEMPLATE OVERRIDE of built-in)
 *       Step 3 component mounting GalleryPicker for the brand's existing
 *       brand-asset gallery + new uploads. Selected asset objects persist
 *       into wizardState.photos (image[] FieldType).
 *
 * Salon and car_rental keep using the built-in `photo_upload` placeholder
 * until their own gallery integration lands. The override pattern is the
 * registry's by-design behavior: tmpl.stepComponents[name] takes precedence
 * over builtins[name] when both define a component for the same name.
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
    photo_upload:           RestaurantPhotoStep,   // overrides built-in for restaurant only
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
