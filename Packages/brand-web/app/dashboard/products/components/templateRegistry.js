'use client';

/**
 * templateRegistry.js — category_key → template module.
 *
 * Each template module is a plain object exporting any subset of:
 *   stepComponents:       { snake_case_step_name: ReactComponent, ... }
 *                         Used to dispatch wizard step content. Falls back to
 *                         built-in components in builtinStepComponents.js when
 *                         the step's `component` value isn't present here.
 *   FleetRowComponent:    ({ product, onRemove }) => JSX
 *                         Renders one row in the brand's fleet/menu/services
 *                         list. If absent, layout uses a default spec-less row.
 *   customPublish?:       async ({ template, brand, wizardState, wizardItems }) => result
 *                         Optional override of the default storage_format-driven
 *                         publishDriver. Use only when the payload shape is too
 *                         complex to express declaratively (e.g. car_rental's
 *                         master_vehicle_id + nested variants_json.specs).
 *   initialWizardState?:  () => object
 *                         Seeds the wizard's `wizardState` on entry to the add
 *                         flow. Useful for templates with default values
 *                         (security_deposit: 5000, extra_km_charge: 12, etc.).
 *
 * PR-A ships the registry empty. car_rental continues to route through the
 * legacy CUSTOM_WIZARDS map in ListingWizard.js for one cycle (PR-A scope:
 * no behavior change for production traffic). Restaurant + salon register
 * themselves here in PR-B. Car_rental migrates to the layout in PR-C.
 */

import restaurantTemplate from './restaurant';
import salonTemplate     from './salon';
import carRentalTemplate from './car-rental';
import fashionTemplate   from './fashion';

const REGISTRY = {
  restaurant: restaurantTemplate,
  salon:      salonTemplate,
  car_rental: carRentalTemplate,   // PR-3: migrated from CUSTOM_WIZARDS in ListingWizard.js
  fashion:    fashionTemplate,     // Fashion-1: unified walkin+online apparel
};

export function getTemplate(categoryKey) {
  return REGISTRY[categoryKey] || null;
}

export function isRegistered(categoryKey) {
  return Boolean(REGISTRY[categoryKey]);
}
