'use client';

import RestaurantFleetRow from './RestaurantFleetRow';

/**
 * restaurant template module — registered in templateRegistry.js.
 *
 * Restaurant uses ONLY built-in step components (brand_fields, photo_upload,
 * repeatable_items, preview, done). All defined in builtinStepComponents.js.
 * No template-specific step components needed.
 *
 * Restaurant has no customPublish — the storage_format declarative spec in
 * restaurant.json drives publishDriver directly. First real exercise of the
 * publishDriver since PR-A. If publishDriver bugs surface during restaurant
 * authoring QA, fix in publishDriver.js — don't override here.
 */

const restaurantTemplate = {
  // stepComponents: {} — empty by design, all dispatch falls through to builtins
  FleetRowComponent: RestaurantFleetRow,
  // customPublish: not needed — storage_format-driven
  // initialWizardState: not needed
  /**
   * canProceed gate on the menu step — schema declares min_items: 5 and the
   * publishDriver silently skips empty rows, so without this gate a brand
   * could click Publish with zero items and land in a confusing "0 items
   * added" done screen. Floor enforces a real menu before advancing.
   */
  canProceed: (wizardState, step, wizardItems) => {
    if (step?.id === 'menu') {
      const filled = (wizardItems || []).filter(i => i?.name && i?.price);
      const min = step.min_items || 1;
      return filled.length >= min;
    }
    return true;
  },
};

export default restaurantTemplate;
