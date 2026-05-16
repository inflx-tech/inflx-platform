'use client';

import DynamicFieldRenderer from './DynamicFieldRenderer';
import LivePreview from './LivePreview';
import QualityScore from './QualityScore';
import PhotoUploadStep from './PhotoUploadStep';

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

export function brand_fields({ step, template, wizardState, onFieldChange, onMultiFieldChange, errors }) {
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
                    onChange={onFieldChange} onMultiChange={onMultiFieldChange}
                    error={errors?.[key]} />
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
// Working built-in: mounts GalleryPicker via the generalized PhotoUploadStep.
// Phase Salon-1 replaced the prior placeholder scaffold. Templates may still
// register an override in templateRegistry.js, but no longer need to — the
// default behavior is now correct for every category.

export const photo_upload = PhotoUploadStep;

// ── preview ─────────────────────────────────────────────────────────────────
// Renders LivePreview + QualityScore + a publish-readiness summary.

export function preview({ step, template, brand, wizardState, wizardItems, scoreData, previewData }) {
  const products = wizardItems.length > 0 ? wizardItems : (wizardState.name ? [wizardState] : []);
  return (
    <div className="space-y-4">
      <StepHeader title={step.title} subtitle={step.subtitle} />
      <QualityScore scoreData={scoreData} template={template} />
      <LivePreview
        brand={previewData?.brand || brand}
        products={previewData?.products || products}
        cardConfig={previewData?.card_config || template?.card_config}
        actionTypes={previewData?.action_types || template?.action_types}
        wizardState={wizardState}
        template={template}
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

  // Three next-action cards (Wave 2E spec) — primary follow-ups after publish.
  const NEXT_ACTIONS = [
    { icon: '📣', title: 'Create a campaign',  desc: 'Get creators to drive footfall',  href: '/dashboard/campaigns/new',  accent: 'yellow' },
    { icon: '⭐', title: 'Invite creators',    desc: 'Browse and invite local influencers',     href: '/dashboard/influencers',    accent: 'teal' },
    { icon: '🏠', title: 'Back to dashboard',  desc: 'Track activity + bookings inbox',         href: '/dashboard',                accent: 'paper' },
  ];

  return (
    <div className="py-6 space-y-5">
      <div className="text-center space-y-3">
        <div className="w-16 h-16 rounded-full bg-teal-pale mx-auto flex items-center justify-center">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#00B894"
               strokeWidth="2.5" strokeLinecap="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <div>
          <div className="font-display text-2xl font-extrabold text-ink-1 tracking-tight">{step.title || 'Listing published!'}</div>
          {step.subtitle && <div className="text-sm text-ink-3 mt-1">{step.subtitle}</div>}
          <div className="text-sm text-ink-2 mt-2 font-mono">
            {created > 0 ? `+${created} ${noun}` : 'BRAND PROFILE UPDATED'}
          </div>
        </div>
      </div>

      {/* 3 next-action cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-2xl mx-auto">
        {NEXT_ACTIONS.map(a => {
          const accentBg = a.accent === 'yellow'
            ? 'bg-yellow hover:bg-yellow-deep text-ink-1'
            : a.accent === 'teal'
              ? 'bg-teal hover:bg-teal-deep text-white'
              : 'bg-paper hover:bg-paper-surface text-ink-1 border border-line-soft';
          return (
            <a key={a.title} href={a.href}
               className={`block rounded-xl p-4 transition-colors shadow-sm ${accentBg}`}>
              <div className="text-2xl mb-1">{a.icon}</div>
              <div className="font-display text-sm font-extrabold">{a.title}</div>
              <div className="text-[11px] opacity-80 mt-0.5">{a.desc}</div>
            </a>
          );
        })}
      </div>

      {tips.length > 0 && (
        <div className="bg-yellow-pale border border-yellow rounded-xl p-4 text-left max-w-2xl mx-auto">
          <div className="font-mono text-[10px] font-bold text-yellow-deep uppercase tracking-wider mb-2">Boost your listing</div>
          <ul className="space-y-1.5">
            {tips.map((tip, i) => (
              <li key={i} className="text-xs text-ink-2 flex gap-2">
                <span className="text-yellow-deep">•</span><span>{tip}</span>
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
      {title && <h2 className="font-display text-xl font-bold text-ink-1 tracking-tight">{title}</h2>}
      {subtitle && <p className="text-sm text-ink-3 mt-1">{subtitle}</p>}
    </div>
  );
}

function FieldRow({ field, value, onChange, onMultiChange, error, compact }) {
  return (
    <div>
      <label className={compact
        ? 'block text-xs font-semibold text-gray-600 mb-1'
        : 'block text-sm font-semibold text-gray-700 mb-1.5'}>
        {field.label} {field.required && <span className="text-red-400">*</span>}
      </label>
      {field.help && !compact && (
        <p className="text-xs text-gray-400 mb-1.5">{field.help}</p>
      )}
      <DynamicFieldRenderer field={field} value={value} onChange={onChange} onMultiChange={onMultiChange} error={error} />
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
}
