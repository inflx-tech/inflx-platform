'use client';

import DynamicFieldRenderer from '../DynamicFieldRenderer';

/**
 * SalonSpecConfirmation — service_specs step. Confirms / edits the spec
 * fields for the picked master service. Pre-filled from master_row defaults
 * when SalonMasterPicker dispatched.
 *
 * Three field types need custom rendering (not via DynamicFieldRenderer):
 *   - available_stylist_ids (string[]) — pulls options from wizardState.team_members
 *     (saved in earlier brand_team step). Renders as stylist chip picker.
 *   - inclusions (string[]) — comma-separated free-text input.
 *   - before_after_images (image[]) — comma-separated URL input (R2 upload
 *     deferred per contracts-v1.3 §9).
 *
 * Other spec_fields (description, gender, duration_mins, premium,
 * requires_stylist_choice) are rendered through DynamicFieldRenderer with the
 * FieldSchema looked up from template.attributes_schema.
 */

export default function SalonSpecConfirmation({ step, template, wizardState, onFieldChange, errors }) {
  const masterRow = wizardState._master_row;
  const teamMembers = wizardState.team_members || [];
  const attrs = template?.attributes_schema || {};

  if (!masterRow) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-700">
        No service picked yet. Go back and pick a service first.
      </div>
    );
  }

  const specFields = step.spec_fields || [];

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold text-gray-900">{step.title}</h2>
        {step.subtitle && <p className="text-sm text-gray-500 mt-1">{step.subtitle}</p>}
      </div>

      {/* Picked service summary */}
      <div className="bg-purple-50 border border-purple-200 rounded-xl p-3 flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-white overflow-hidden flex items-center justify-center text-xl">
          {masterRow.image_url
            ? <img src={masterRow.image_url} alt={masterRow.name} className="w-full h-full object-cover" />
            : '💇'}
        </div>
        <div>
          <div className="text-sm font-bold text-purple-900">{masterRow.name || masterRow.service_name}</div>
          <div className="text-[10px] text-purple-600">{masterRow.category} · {masterRow.duration_mins_default}m default</div>
        </div>
      </div>

      {/* Spec fields */}
      {specFields.map(key => {
        if (key === 'available_stylist_ids') {
          return (
            <StylistPicker
              key={key}
              label={attrs[key]?.label || 'Stylists offering this service'}
              value={wizardState[key] || []}
              teamMembers={teamMembers}
              onChange={(next) => onFieldChange(key, next)}
            />
          );
        }
        if (key === 'inclusions') {
          return (
            <StringArrayInput
              key={key}
              label={attrs[key]?.label || "What's included"}
              hint="Comma-separated (e.g. Wash, Cut, Blow-dry)"
              value={wizardState[key] || []}
              onChange={(next) => onFieldChange(key, next)}
            />
          );
        }
        if (key === 'before_after_images') {
          return (
            <StringArrayInput
              key={key}
              label={attrs[key]?.label || 'Before / After photos'}
              hint="Photo upload coming soon — paste comma-separated URLs for now"
              value={wizardState[key] || []}
              onChange={(next) => onFieldChange(key, next)}
            />
          );
        }

        // Generic — DynamicFieldRenderer with FieldSchema from attributes_schema
        const fieldDef = attrs[key];
        if (!fieldDef) return null;
        const field = { key, ...fieldDef };
        return (
          <FieldRow key={key} field={field} value={wizardState[key]}
            onChange={onFieldChange} error={errors?.[key]} />
        );
      })}
    </div>
  );
}

function FieldRow({ field, value, onChange, error }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-700 mb-1.5">
        {field.label} {field.required && <span className="text-red-400">*</span>}
      </label>
      <DynamicFieldRenderer field={field} value={value} onChange={onChange} error={error} />
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
}

function StylistPicker({ label, value, teamMembers, onChange }) {
  if (teamMembers.length === 0) {
    return (
      <div>
        <label className="block text-xs font-semibold text-gray-700 mb-1.5">{label}</label>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-700">
          No stylists added yet. Go back to the team step to add stylists, then return to assign them to this service.
        </div>
      </div>
    );
  }

  function toggle(id) {
    const next = value.includes(id) ? value.filter(v => v !== id) : [...value, id];
    onChange(next);
  }

  return (
    <div>
      <label className="block text-xs font-semibold text-gray-700 mb-1.5">{label}</label>
      <p className="text-[10px] text-gray-400 mb-2">Tap stylists who offer this service</p>
      <div className="flex flex-wrap gap-2">
        {teamMembers.map(tm => {
          const active = value.includes(tm.id);
          return (
            <button key={tm.id} type="button" onClick={() => toggle(tm.id)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full border-2 text-xs font-semibold transition-all
                ${active
                  ? 'border-purple-400 bg-purple-50 text-purple-700'
                  : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}>
              <span className="w-5 h-5 rounded-full bg-gray-100 overflow-hidden flex items-center justify-center text-[10px]">
                {tm.photo_url
                  ? <img src={tm.photo_url} alt="" className="w-full h-full object-cover" />
                  : '💇'}
              </span>
              {tm.name || 'Unnamed'}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function StringArrayInput({ label, hint, value, onChange }) {
  const text = Array.isArray(value) ? value.join(', ') : (value || '');
  function handleChange(s) {
    const items = s.split(',').map(x => x.trim()).filter(Boolean);
    onChange(items);
  }
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-700 mb-1.5">{label}</label>
      <input type="text" value={text} onChange={e => handleChange(e.target.value)}
        className="w-full border-2 border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-purple-400" />
      {hint && <p className="text-[10px] text-gray-400 mt-1 italic">{hint}</p>}
    </div>
  );
}
