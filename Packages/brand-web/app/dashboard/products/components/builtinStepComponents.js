'use client';

import DynamicFieldRenderer from './DynamicFieldRenderer';
import LivePreview from './LivePreview';
import QualityScore from './QualityScore';

/**
 * builtinStepComponents.js — fallback step components for snake_case
 * `step.component` values from schema JSON.
 *
 * Naming convention: schema JSON uses snake_case for `component` values.
 * The contract's TS interface names (RepeatableItemStep, PhotoUploadStep,
 * PreviewStep, etc.) are types; the runtime dispatch keys are the snake_case
 * strings authored in the JSON.
 *
 * Templates can override any of these by registering a same-name step
 * component in templateRegistry.js. The layout's dispatch checks the
 * template registry first; this map is the fallback.
 */

// ── basic_fields ────────────────────────────────────────────────────────────

export function basic_fields({ step, wizardState, onFieldChange, errors }) {
  const fields = step.fields || [];
  return (
    <div className="space-y-4">
      <StepHeader title={step.title} subtitle={step.subtitle} />
      {fields.map(field => (
        <FieldRow key={field.key} field={field} value={wizardState[field.key]}
                  onChange={onFieldChange} error={errors?.[field.key]} />
      ))}
    </div>
  );
}

// ── brand_fields ────────────────────────────────────────────────────────────
// Renders the subset of template.brand_config.fields named in
// step.field_keys[]. Values write to brand listing_data via the layout's
// shared wizardState; the publish driver routes them to brands.listing_data
// rather than brand_products.

export function brand_fields({ step, template, wizardState, onFieldChange, errors }) {
  const allBrandFields = template?.brand_config?.fields || {};
  const keys = step.field_keys || Object.keys(allBrandFields);
  return (
    <div className="space-y-4">
      <StepHeader title={step.title} subtitle={step.subtitle} />
      {keys.map(key => {
        const fieldDef = allBrandFields[key];
        if (!fieldDef) return null;
        // Construct a FieldDef shape DynamicFieldRenderer expects.
        const field = { key, ...fieldDef };
        return (
          <FieldRow key={key} field={field} value={wizardState[key]}
                    onChange={onFieldChange} error={errors?.[key]} />
        );
      })}
    </div>
  );
}

// ── repeatable_items ────────────────────────────────────────────────────────
// Restaurant menu, salon services. Each click of "Add" appends a row;
// publish iterates wizardItems[] and POSTs one brand_products row each.

export function repeatable_items({ step, wizardItems, onItemAdd, onItemRemove, onItemFieldChange, errors }) {
  const fields = step.item_fields || [];
  const noun = step.product_noun || 'item';

  return (
    <div className="space-y-4">
      <StepHeader title={step.title} subtitle={step.subtitle} />

      <div className="flex items-center justify-between">
        <h3 className="text-base font-bold text-gray-800 capitalize">{noun}s ({wizardItems.length})</h3>
        <button type="button" onClick={onItemAdd}
          className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold rounded-xl transition-colors">
          + Add {noun}
        </button>
      </div>

      {wizardItems.length === 0 && (
        <div className="text-center py-8 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
          <p className="text-gray-400 text-sm">No {noun}s yet. Click the button above to add one.</p>
        </div>
      )}

      {wizardItems.map((item, idx) => (
        <div key={idx} className="bg-white border-2 border-gray-100 rounded-xl p-4 space-y-3 relative group">
          <button type="button" onClick={() => onItemRemove(idx)}
            className="absolute top-2 right-2 text-gray-300 hover:text-red-500 text-lg opacity-0 group-hover:opacity-100 transition-opacity">
            ×
          </button>
          <div className="text-xs font-bold text-gray-400 uppercase">{noun} #{idx + 1}</div>
          {fields.map(field => (
            <FieldRow
              key={field.key}
              field={field}
              value={item[field.key]}
              onChange={(key, val) => onItemFieldChange(idx, key, val)}
              error={errors?.[`item_${idx}_${field.key}`]}
              compact
            />
          ))}
        </div>
      ))}
    </div>
  );
}

// ── photo_upload ────────────────────────────────────────────────────────────
// Scaffold only — actual R2 upload pipeline is platform-level work
// (deferred per contracts-v1.2.md §9). For PR-A this renders the slot grid;
// click handlers no-op.

export function photo_upload({ step, wizardState, onFieldChange }) {
  const slots = step.slots || ['Photo'];
  return (
    <div className="space-y-3">
      <StepHeader title={step.title} subtitle={step.subtitle} />
      <div className="grid grid-cols-2 gap-3">
        {slots.map(slot => (
          <div key={slot}
            className="aspect-video bg-gray-50 border-2 border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center gap-1 cursor-pointer hover:border-orange-300 transition-colors">
            <span className="text-2xl">📷</span>
            <span className="text-xs text-gray-400 font-medium">{slot}</span>
          </div>
        ))}
      </div>
      <p className="text-xs text-gray-400 italic">Photo upload pipeline pending (platform work item).</p>
    </div>
  );
}

// ── preview ─────────────────────────────────────────────────────────────────
// Renders LivePreview + QualityScore + a publish-readiness summary.

export function preview({ step, template, brand, wizardState, wizardItems, scoreData, previewData }) {
  const products = wizardItems.length > 0 ? wizardItems : (wizardState.name ? [wizardState] : []);
  return (
    <div className="space-y-4">
      <StepHeader title={step.title} subtitle={step.subtitle} />
      <QualityScore scoreData={scoreData} />
      <LivePreview
        brand={previewData?.brand || brand}
        products={previewData?.products || products}
        cardConfig={previewData?.card_config || template?.card_config}
        actionTypes={previewData?.action_types || template?.action_types}
      />
    </div>
  );
}

// ── done ────────────────────────────────────────────────────────────────────
// Success step rendered by the layout after publish completes.
// The layout passes publishResult; this just formats it.

export function done({ step, publishResult, template }) {
  const tips = step.boost_tips || [];
  const created = publishResult?.products_created || 0;
  const noun = template?.product_noun_plural?.toLowerCase() || 'listings';

  return (
    <div className="text-center py-6 space-y-4">
      <div className="w-16 h-16 rounded-full bg-green-100 mx-auto flex items-center justify-center">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#059669"
             strokeWidth="2.5" strokeLinecap="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </div>
      <div>
        <div className="text-xl font-extrabold text-gray-900">{step.title || 'Listing published!'}</div>
        {step.subtitle && <div className="text-sm text-gray-500 mt-1">{step.subtitle}</div>}
        <div className="text-sm text-gray-600 mt-2">
          {created > 0 ? `${created} ${noun} added.` : 'Brand profile updated.'}
        </div>
      </div>
      {tips.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-left max-w-md mx-auto">
          <div className="text-xs font-bold text-amber-700 uppercase mb-2">Boost your listing</div>
          <ul className="space-y-1.5">
            {tips.map((tip, i) => (
              <li key={i} className="text-xs text-amber-800 flex gap-2">
                <span>•</span><span>{tip}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ── Internal helpers ────────────────────────────────────────────────────────

function StepHeader({ title, subtitle }) {
  if (!title && !subtitle) return null;
  return (
    <div>
      {title && <h2 className="text-xl font-bold text-gray-900">{title}</h2>}
      {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
    </div>
  );
}

function FieldRow({ field, value, onChange, error, compact }) {
  return (
    <div>
      <label className={compact
        ? 'block text-xs font-semibold text-gray-600 mb-1'
        : 'block text-sm font-semibold text-gray-700 mb-1.5'}>
        {field.label} {field.required && <span className="text-red-400">*</span>}
      </label>
      <DynamicFieldRenderer field={field} value={value} onChange={onChange} error={error} />
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
}
