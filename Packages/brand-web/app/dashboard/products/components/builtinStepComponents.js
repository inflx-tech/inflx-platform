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
// Sections summary — one card per logical grouping, each with Edit. The
// LivePreview phone-frame lives in the layout's right rail on every step
// (Wave 2.1 chrome rework), so this step no longer renders it inline.
// QualityScore moved to the Done step where it carries more weight.

export function preview({ step, template, brand, wizardState, wizardItems, onJumpToStep }) {
  const ls = brand?.listing_data || {};
  const merged = { ...ls, ...(wizardState || {}) };

  const cuisines    = arr(merged.cuisines).join(', ') || '—';
  const vibes       = arr(merged.vibes).map(v => String(v).replace(/_/g, ' ')).join(', ') || '—';
  const locality    = merged.locality || brand?.city || '—';
  const locVerified = !!merged.google_maps_url;
  const photos      = arr(merged.photos);
  const coverSet    = !!merged.cover_image_url;
  const dishes      = wizardItems.length;
  const sections    = new Set(wizardItems.map(it => it?.section).filter(Boolean)).size;
  const amenityKeys = ['parking', 'outdoor_seating', 'wifi', 'kids_welcome', 'wheelchair_accessible'];
  const amenityCount = amenityKeys.filter(k => merged[k] === true).length;
  const tables      = merged.table_count;
  const hoursSet    = !!merged.hours_json && Object.keys(merged.hours_json || {}).length > 0;
  const actions = [
    merged.accepts_table_booking !== false && { icon: '🪑', label: 'Book a Table' },
    merged.pay_at_store_supported !== false && { icon: '💳', label: 'Pay at Restaurant' },
    merged.online_order_supported === true   && { icon: '🛵', label: 'Order Online' },
    merged.enquiry_enabled !== false         && { icon: '💬', label: 'Send Enquiry' },
  ].filter(Boolean);

  function jump(stepId) {
    if (typeof onJumpToStep === 'function') onJumpToStep(stepId);
  }

  return (
    <div className="space-y-4">
      <StepHeader title={step.title || 'Final review'} subtitle={step.subtitle || 'Everything followers will see — review and publish.'} />

      <SummaryCard title="Basics" onEdit={() => jump('basics')}>
        <div className="text-sm text-ink-2 leading-relaxed">
          <span className="font-bold text-ink-1">{brand?.business_name || merged.business_name || 'Your restaurant'}</span> · {cuisines} · <span className="font-mono">₹{merged.cost_for_two || '—'}/2</span>
          <div className="text-ink-3 mt-1">Vibes: {vibes}</div>
        </div>
      </SummaryCard>

      <SummaryCard title="Location · Hours" onEdit={() => jump('location')}>
        <div className="text-sm text-ink-2 leading-relaxed">
          {locality} {locVerified && <span className="font-mono text-teal-deep text-xs">· ✓ verified</span>}
          <div className="text-ink-3 mt-1">{hoursSet ? 'Operating hours set' : <span className="text-yellow-deep">Hours not yet set</span>}</div>
        </div>
      </SummaryCard>

      <SummaryCard title="Dining setup · Photos · Menu" onEdit={() => jump('dining_setup')}>
        <div className="text-sm text-ink-2 leading-relaxed flex flex-wrap gap-x-4 gap-y-1">
          <span><span className="font-mono font-bold text-ink-1">{amenityCount}</span> amenities</span>
          {tables && <span><span className="font-mono font-bold text-ink-1">{tables}</span> tables</span>}
          <span><span className="font-mono font-bold text-ink-1">{photos.length}</span> photos {coverSet && <span className="text-teal-deep text-xs">· ★ cover</span>}</span>
          <span><span className="font-mono font-bold text-ink-1">{dishes}</span> dishes{sections > 0 && <span> in {sections} sections</span>}</span>
        </div>
      </SummaryCard>

      <SummaryCard title="Actions enabled" onEdit={() => jump('actions')}>
        <div className="flex flex-wrap gap-1.5">
          {actions.length === 0 && <span className="text-sm text-yellow-deep">No actions enabled — followers won't have any CTAs</span>}
          {actions.map((a, i) => (
            <span key={i} className="inline-flex items-center gap-1 bg-ink-1 text-white px-2.5 py-1 rounded-full text-xs font-semibold">
              {a.icon} {a.label}
            </span>
          ))}
        </div>
      </SummaryCard>

      <div className="bg-yellow-pale border border-yellow rounded-xl p-3 flex gap-2.5 items-start">
        <span className="text-base">🚀</span>
        <p className="text-xs text-ink-2 leading-relaxed">
          <strong className="text-ink-1">This is the final review.</strong> After publishing, every change syncs to followers within seconds. Click Publish below or use Back to edit any section.
        </p>
      </div>
    </div>
  );
}

// Internal — render a summary card with title + Edit button + body slot.
function SummaryCard({ title, onEdit, children }) {
  return (
    <div className="bg-paper-surface border border-line-soft rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="font-display text-sm font-bold text-ink-1">{title}</div>
        {onEdit && (
          <button onClick={onEdit}
            className="font-mono text-[10px] uppercase tracking-wider font-bold text-ink-3 hover:text-yellow-deep transition-colors">
            Edit
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

function arr(v) { return Array.isArray(v) ? v : []; }

// ── done ────────────────────────────────────────────────────────────────────
// Success step rendered by the layout after publish completes.
// The layout passes publishResult; this just formats it.

export function done({ step, publishResult, template, scoreData }) {
  const tips = step.boost_tips || [];
  const created = publishResult?.products_created || 0;
  const noun = template?.product_noun_plural?.toLowerCase() || 'listings';
  // Honest-save: publishDriver collects the REAL reasons any save failed.
  // Never claim "You're live" when saves were rejected by the server.
  const errors = Array.isArray(publishResult?.errors) ? publishResult.errors : [];
  const hasErrors = errors.length > 0;

  // Three next-action cards — primary follow-ups after publish.
  // The yellow card is the recommended path (campaign first); the other
  // two are equal-weight secondary CTAs.
  const NEXT_ACTIONS = [
    { icon: '🏷️', title: 'Create your first campaign',  desc: 'Attract creators with a discount + commission offer.',  href: '/dashboard/campaigns',  accent: 'yellow' },
    { icon: '🤝', title: 'Invite specific creators',    desc: 'Browse and invite local influencers.',                  href: '/dashboard/influencers',    accent: 'paper' },
    { icon: '📥', title: 'Back to dashboard',           desc: 'Track activity, edit menu, top up wallet.',             href: '/dashboard',                accent: 'paper' },
  ];

  return (
    <div className="py-2 space-y-6">
      <div className="text-center space-y-3">
        {hasErrors ? (
          <div className="w-16 h-16 rounded-full bg-red-100 mx-auto flex items-center justify-center text-3xl text-red-600">!</div>
        ) : (
          <div className="w-16 h-16 rounded-full bg-teal-pale mx-auto flex items-center justify-center">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#00B894"
                 strokeWidth="2.5" strokeLinecap="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
        )}
        <div>
          <div className="font-display text-2xl font-extrabold text-ink-1 tracking-tight">
            {hasErrors
              ? (created > 0 ? 'Almost there — some items didn\'t save' : 'We couldn\'t save your listing yet')
              : (step.title || 'You\'re live on INFLX 🎉')}
          </div>
          {!hasErrors && step.subtitle && <div className="text-sm text-ink-3 mt-1">{step.subtitle}</div>}
          <div className="text-xs text-ink-3 mt-2 font-mono uppercase tracking-wider">
            {created > 0 ? `Published · +${created} ${noun}` : (hasErrors ? `0 ${noun} saved` : 'Brand profile updated')}
          </div>
        </div>
      </div>

      {hasErrors && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-left">
          <div className="font-mono text-[10px] font-bold text-red-700 uppercase tracking-wider mb-2">
            {errors.length} {errors.length === 1 ? 'item' : 'items'} need attention
          </div>
          <ul className="space-y-1.5 mb-3">
            {errors.slice(0, 8).map((e, i) => (
              <li key={i} className="text-xs text-red-800 flex gap-2"><span>•</span><span>{e}</span></li>
            ))}
            {errors.length > 8 && <li className="text-xs text-red-700">…and {errors.length - 8} more</li>}
          </ul>
          <a href="/dashboard/products"
             className="inline-block px-4 py-2 rounded-lg text-xs font-bold bg-yellow hover:bg-yellow-deep text-ink-1">
            Back to my listing — fix &amp; try again
          </a>
        </div>
      )}

      {/* Quality score with ring, tier, and Path-to-next-tier checklist.
          Single card per Wave 2.1 — combines what the mockup splits into
          score-card + path-to-Gold because QualityScore already renders
          both pieces inline. */}
      {scoreData && (
        <QualityScore scoreData={scoreData} template={template} />
      )}

      {/* 3 next-action cards — hidden when nothing saved (would be misleading) */}
      {!(hasErrors && created === 0) && (
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {NEXT_ACTIONS.map(a => {
          const accentBg = a.accent === 'yellow'
            ? 'bg-yellow-pale border border-yellow text-ink-1'
            : 'bg-paper border border-line-soft text-ink-1';
          const btnBg = a.accent === 'yellow'
            ? 'bg-yellow hover:bg-yellow-deep text-ink-1'
            : 'bg-paper hover:bg-paper-surface text-ink-1 border border-line-soft';
          return (
            <div key={a.title} className={`rounded-xl p-5 shadow-sm ${accentBg}`}>
              <div className="text-3xl">{a.icon}</div>
              <div className="font-display text-sm font-extrabold mt-2.5 tracking-tight">{a.title}</div>
              <div className="text-[12px] text-ink-2 mt-1.5 leading-relaxed">{a.desc}</div>
              <a href={a.href}
                 className={`mt-3 block w-full text-center px-3 py-2 rounded-lg text-xs font-bold transition-colors ${btnBg}`}>
                {a.accent === 'yellow' ? 'Create campaign →' : 'Open →'}
              </a>
            </div>
          );
        })}
      </div>
      )}

      {!hasErrors && tips.length > 0 && (
        <div className="bg-paper-surface border border-line-soft rounded-xl p-4">
          <div className="font-mono text-[10px] font-bold text-ink-3 uppercase tracking-wider mb-2">Boost your listing</div>
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
