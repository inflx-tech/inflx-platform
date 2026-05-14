'use client';

import { useState } from 'react';
import DynamicFieldRenderer from '../DynamicFieldRenderer';
import GalleryPicker from '../../../gallery/components/GalleryPicker';

/**
 * SalonSpecConfirmation — service_specs step. Confirms / edits the spec
 * fields for the picked master service. Pre-filled from master_row defaults
 * when SalonMasterPicker dispatched.
 *
 * Three field types need custom rendering (not via DynamicFieldRenderer):
 *   - available_stylist_ids (string[]) — pulls options from wizardState.team_members
 *     (saved in earlier brand_team step). Renders as stylist chip picker.
 *   - inclusions (string[]) — comma-separated free-text input.
 *   - before_after_images (image[]) — Phase Salon-1: now mounts GalleryPicker
 *     and stores URL strings (extracted from picked assets' download_url).
 *     String storage is intentional: keeps the follower-side gallery renderer
 *     in SchemaDetailScreen unchanged (it reads URL strings, not asset
 *     objects). Switch to object storage when the follower side is migrated.
 *
 * Other spec_fields (description, gender, duration_mins, premium,
 * requires_stylist_choice) are rendered through DynamicFieldRenderer with the
 * FieldSchema looked up from template.attributes_schema.
 *
 * NOTE: This component is part of the legacy 3-step salon flow
 * (service_picker → service_specs → service_pricing). Phase Salon-1
 * introduces SalonServiceInlinePicker which consolidates all three into a
 * single inline-expand step; this file remains as a compatibility shim for
 * any schema author who keeps the separated steps.
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
            <BeforeAfterPicker
              key={key}
              label={attrs[key]?.label || 'Before / After photos'}
              value={wizardState[key] || []}
              max={attrs[key]?.max || 6}
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

/**
 * BeforeAfterPicker — gallery-backed image picker for the salon service's
 * before_after_images field. Stores URL strings in wizardState (not asset
 * objects) so the follower-side gallery renderer continues reading the same
 * shape it always has.
 */
function BeforeAfterPicker({ label, value, max, onChange }) {
  const [open, setOpen] = useState(false);
  const urls = Array.isArray(value) ? value : [];

  function handlePicked(assets) {
    // Take each asset's download_url; append to existing URLs and de-dup.
    const next = [...urls];
    for (const a of assets) {
      if (a?.download_url && !next.includes(a.download_url)) {
        if (next.length >= max) break;
        next.push(a.download_url);
      }
    }
    onChange(next);
  }

  function removeAt(idx) {
    const next = urls.filter((_, i) => i !== idx);
    onChange(next);
  }

  return (
    <div>
      <label className="block text-xs font-semibold text-gray-700 mb-1.5">{label}</label>
      <div className="flex items-center justify-between bg-gray-50 rounded-xl px-3 py-2 border border-gray-200 mb-2">
        <span className="text-[11px] text-gray-500">
          {urls.length} of {max} photos
        </span>
        <button type="button" onClick={() => setOpen(true)}
          disabled={urls.length >= max}
          className={`px-3 py-1.5 text-[11px] font-bold rounded-lg transition-colors
            ${urls.length >= max
              ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
              : 'bg-purple-500 hover:bg-purple-600 text-white'}`}>
          {urls.length === 0 ? '+ Add photos' : '+ Add more'}
        </button>
      </div>

      {urls.length === 0 ? (
        <div className="text-center py-6 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
          <p className="text-2xl mb-1">📷</p>
          <p className="text-[11px] text-gray-400">
            Before / after shots convert at 2× — add a few to publish.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {urls.map((url, idx) => (
            <div key={`${url}-${idx}`} className="aspect-square rounded-lg overflow-hidden bg-gray-100 relative group border border-gray-200">
              <img src={url} alt={`Before/after ${idx + 1}`} className="w-full h-full object-cover" />
              <button type="button" onClick={() => removeAt(idx)}
                className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white text-[10px] opacity-0 group-hover:opacity-100 transition-opacity">
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      <GalleryPicker
        open={open}
        onClose={() => setOpen(false)}
        onSelect={handlePicked}
        multiple={true}
      />
    </div>
  );
}
