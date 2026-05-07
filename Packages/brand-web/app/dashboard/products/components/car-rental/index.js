'use client';

import { useEffect, useState } from 'react';
import { brandApi } from '../../../../../lib/api';
import VehicleTypeSelector from './VehicleTypeSelector';
import MakeModelPicker from './MakeModelPicker';
import SpecConfirmation from './SpecConfirmation';
import CarPricingForm from './CarPricingForm';
import CarRentalFleetRow from './CarRentalFleetRow';

/**
 * car_rental template module — registered in templateRegistry.js (PR-3).
 *
 * Migrated from the legacy CarRentalWizard.js which hardcoded its own 3-tab
 * UI + wizard chrome + imperative handlePublish. PR-3 ports the four
 * template-specific step components (VehicleTypeSelector, MakeModelPicker,
 * SpecConfirmation, CarPricingForm) onto the shared ListingTemplateLayout
 * via thin adapter wrappers below.
 *
 * Step components map to schema's snake_case names:
 *   - option_grid       → VehicleTypeStep (wraps VehicleTypeSelector)
 *   - master_picker     → MakeModelStep (wraps MakeModelPicker; loads
 *                         master_vehicles from /brands/me/master-catalogue)
 *   - spec_confirmation → SpecConfirmationStep (wraps SpecConfirmation)
 *   - pricing           → CarPricingStep (wraps CarPricingForm)
 *
 * Storage_format-driven publish: car_rental.json declares the full
 * variants_json shape (master_row paths + nested specs + type hints).
 * publishDriver consumes it without a customPublish override — first
 * exercise of master_row resolution under the layout for a category that
 * was previously imperative. If publishDriver bugs surface here, fix in
 * publishDriver.js per the locked discipline.
 *
 * Master row → wizard_state flatten: when MakeModelPicker selects a
 * vehicle, the wrapper writes both `_master_row` (for storage_format's
 * top-level `master_row.X` paths) AND flattens spec fields into wizard
 * state by name (so variants_json.specs.seats etc. resolve via the type-
 * hint pattern). Plus a derived `description` string for the top-level
 * brand_products.description column.
 */

// VEHICLE_OPTIONS comes from the schema's listing_steps[0].options now.
// This array is kept here only as a fallback if the schema doesn't supply.
const VEHICLE_OPTIONS_FALLBACK = [
  { value: 'Hatchback', label: 'Hatchback', sub: '4–5 seats · Compact', icon: 'hatchback' },
  { value: 'Sedan', label: 'Sedan', sub: '5 seats · Mid-size', icon: 'sedan' },
  { value: 'SUV', label: 'SUV', sub: '5 seats · All-terrain', icon: 'suv' },
  { value: 'MPV / MUV', label: 'MPV / MUV', sub: '6–7 seats · Family', icon: 'mpv' },
  { value: 'Luxury', label: 'Luxury', sub: '4–5 seats · Premium', icon: 'luxury' },
  { value: 'Tempo Traveller', label: 'Tempo Traveller', sub: '9–17 seats · Group', icon: 'tempo' },
];

// ── Step adapters: layout signature → existing component signature ─────────

function VehicleTypeStep({ step, wizardState, onFieldChange }) {
  const options = step.options || VEHICLE_OPTIONS_FALLBACK;
  function handleSelect(value) {
    onFieldChange('selectedSegment', value);
    // Reset downstream when segment changes — prevents stale make/model
    onFieldChange('selectedMake', null);
    onFieldChange('_master_row', null);
    onFieldChange('selectedVariant', null);
  }
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold text-gray-900">{step.title}</h2>
        {step.subtitle && <p className="text-sm text-gray-500 mt-1">{step.subtitle}</p>}
      </div>
      <VehicleTypeSelector
        options={options}
        selected={wizardState.selectedSegment}
        onSelect={handleSelect}
      />
    </div>
  );
}

function MakeModelStep({ step, wizardState, onFieldChange }) {
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await brandApi.get('/brands/me/master-catalogue');
        if (cancelled) return;
        if (res.success && res.data?.items) setVehicles(res.data.items);
        else setError(res.error?.message || 'Failed to load vehicles');
      } catch (e) {
        if (!cancelled) setError(e.message || 'Failed to load vehicles');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  function handleSelectMake(make) {
    onFieldChange('selectedMake', make);
    onFieldChange('_master_row', null);
  }

  function handleSelectModel(model) {
    onFieldChange('_master_row', model);
    // Flatten master row spec fields into wizardState by name so the
    // storage_format type-hint pattern in variants_json.specs resolves
    // via wizardState lookups (publishDriver.collectNestedJson).
    onFieldChange('seats', model.seats);
    onFieldChange('fuel_type', model.fuel_type);
    onFieldChange('engine_cc', model.engine_cc);
    onFieldChange('transmission', model.transmission);
    onFieldChange('kmpl', model.kmpl);
    onFieldChange('ac', model.ac);
    onFieldChange('sunroof', model.sunroof);
    onFieldChange('features', model.features_json || []);
    // Derived description for brand_products.description column.
    onFieldChange('description',
      `${model.seats} seats · ${model.fuel_type} · ${model.transmission}`);
    // Pre-seed services from master row's services_json (brand can edit later)
    if (model.services_json && (!wizardState.services || wizardState.services.length === 0)) {
      onFieldChange('services', model.services_json);
    }
  }

  if (loading) return <div className="py-8 text-center text-sm text-gray-400">Loading vehicles…</div>;
  if (error) return <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-600">{error}</div>;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold text-gray-900">{step.title}</h2>
        {step.subtitle && <p className="text-sm text-gray-500 mt-1">{step.subtitle}</p>}
      </div>
      <MakeModelPicker
        vehicles={vehicles}
        selectedSegment={wizardState.selectedSegment}
        selectedMake={wizardState.selectedMake}
        selectedModel={wizardState._master_row}
        onSelectMake={handleSelectMake}
        onSelectModel={handleSelectModel}
      />
    </div>
  );
}

function SpecConfirmationStep({ step, wizardState, onFieldChange }) {
  const vehicle = wizardState._master_row;
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold text-gray-900">{step.title}</h2>
        {step.subtitle && <p className="text-sm text-gray-500 mt-1">{step.subtitle}</p>}
      </div>
      <SpecConfirmation
        vehicle={vehicle}
        selectedVariant={wizardState.selectedVariant}
        onSelectVariant={(v) => onFieldChange('selectedVariant', v)}
      />
    </div>
  );
}

function CarPricingStep({ step, wizardState, onFieldChange }) {
  const vehicle = wizardState._master_row;
  // Bridge between flat wizardState fields and CarPricingForm's pricing object.
  const pricing = {
    day_rate: wizardState.day_rate,
    km_rate: wizardState.km_rate,
    security_deposit: wizardState.security_deposit ?? 5000,
    extra_km_charge: wizardState.extra_km_charge ?? 12,
  };
  function handlePricingChange(next) {
    if (next.day_rate !== pricing.day_rate) onFieldChange('day_rate', next.day_rate);
    if (next.km_rate !== pricing.km_rate) onFieldChange('km_rate', next.km_rate);
    if (next.security_deposit !== pricing.security_deposit) onFieldChange('security_deposit', next.security_deposit);
    if (next.extra_km_charge !== pricing.extra_km_charge) onFieldChange('extra_km_charge', next.extra_km_charge);
  }
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold text-gray-900">{step.title}</h2>
        {step.subtitle && <p className="text-sm text-gray-500 mt-1">{step.subtitle}</p>}
      </div>
      <CarPricingForm
        vehicle={vehicle}
        pricing={pricing}
        onPricingChange={handlePricingChange}
        services={wizardState.services || []}
        onServicesChange={(s) => onFieldChange('services', s)}
      />
    </div>
  );
}

// ── Template module ────────────────────────────────────────────────────────

const carRentalTemplate = {
  stepComponents: {
    option_grid: VehicleTypeStep,
    master_picker: MakeModelStep,
    spec_confirmation: SpecConfirmationStep,
    pricing: CarPricingStep,
  },

  FleetRowComponent: CarRentalFleetRow,

  initialWizardState: () => ({
    security_deposit: 5000,
    extra_km_charge: 12,
    services: [],
  }),

  canProceed: (wizardState, step) => {
    if (!step) return true;
    if (step.id === 'vehicle_type')   return !!wizardState.selectedSegment;
    if (step.id === 'make_model')     return !!wizardState._master_row;
    if (step.id === 'confirm_specs')  return true;     // always proceedable
    if (step.id === 'pricing')        return Number(wizardState.day_rate) > 0;
    return true;
  },
};

export default carRentalTemplate;
