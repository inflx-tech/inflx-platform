'use client';

import SalonMasterPicker from './SalonMasterPicker';
import SalonSpecConfirmation from './SalonSpecConfirmation';
import SalonPricingForm from './SalonPricingForm';
import SalonFleetRow from './SalonFleetRow';

/**
 * salon template module — registered in templateRegistry.js.
 *
 * Three template-specific step components (PR-B step 3.2):
 *   - master_picker      → SalonMasterPicker (calls /brands/me/master-catalogue,
 *                          aliases master_row.service_name + master_row.section
 *                          for storage_format compatibility, prevents
 *                          double-add via is_activated check)
 *   - spec_confirmation  → SalonSpecConfirmation (auto-fills from master_row,
 *                          custom renderers for available_stylist_ids /
 *                          inclusions / before_after_images)
 *   - pricing            → SalonPricingForm (single-field price input;
 *                          gracefully omits benchmark line when master row
 *                          lacks price_min/max)
 *
 * canProceed gates registered for the four steps where a wrong forward-move
 * would either lose data or land in a broken state. v1.3 §6.5 hook.
 *
 * Step 3 still owes:
 *   - FleetRowComponent (3.3)
 *   - team_member_list FieldType (3.1 — done) ✓
 */

const salonTemplate = {
  stepComponents: {
    master_picker: SalonMasterPicker,
    spec_confirmation: SalonSpecConfirmation,
    pricing: SalonPricingForm,
  },

  FleetRowComponent: SalonFleetRow,
  // customPublish: not needed — storage_format with master_row.foo paths is
  // exercised by publishDriver. First real test of the master_row resolution
  // path; if bugs surface in salon authoring QA, fix in publishDriver.js.
  // initialWizardState: not needed.

  /**
   * Per-step validation gates. Layout's canProceedFromStep() calls this
   * before advancing the wizard. Returning false greys out the Next button.
   */
  canProceed: (wizardState, step) => {
    if (!step) return true;

    if (step.id === 'brand_team') {
      // Salon's brand_config.fields.team_members is required:true, min:1.
      // Enforce the minimum at step boundary so the user can't sleep-walk
      // past with zero stylists.
      const teamMembers = wizardState.team_members || [];
      return teamMembers.length > 0;
    }

    if (step.id === 'service_picker') {
      // Must pick a master service before advancing to spec_confirmation.
      return !!wizardState._master_row;
    }

    if (step.id === 'service_specs') {
      // If buyer-picks-stylist is on, at least one stylist must offer this
      // service or SlotPickerScreen will hit the "no stylists configured"
      // defensive state at booking time.
      if (wizardState.requires_stylist_choice) {
        const ids = wizardState.available_stylist_ids || [];
        if (ids.length === 0) return false;
      }
      return true;
    }

    if (step.id === 'service_pricing') {
      // Price required to publish.
      return Number(wizardState.price) > 0;
    }

    return true;
  },
};

export default salonTemplate;
