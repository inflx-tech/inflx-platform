'use client';
import DynamicFieldRenderer from './DynamicFieldRenderer';

/**
 * DynamicStepRenderer — renders a single wizard step from config.
 *
 * Step types:
 *   - Basic fields step (listing_steps[].fields) — renders DynamicFieldRenderer per field
 *   - Repeatable items step (listing_steps[].sections[].type === 'repeatable_items') — add/remove items
 *   - Preview step (listing_steps[].sections[].type === 'live_preview') — shows LivePreview
 */

export default function DynamicStepRenderer({ step, formData, onFieldChange, products, onProductAdd, onProductRemove, onProductFieldChange, errors }) {
  if (!step) return null;

  return (
    <div className="space-y-6">
      {/* Step header */}
      <div>
        <h2 className="text-xl font-bold text-gray-900">{step.title}</h2>
        {step.subtitle && <p className="text-sm text-gray-500 mt-1">{step.subtitle}</p>}
      </div>

      {/* Basic fields */}
      {step.fields && step.fields.map(field => {
        // Skip toggle fields handled separately (they render their own label)
        const isToggle = field.type === 'toggle';
        return (
          <div key={field.key} className={field.grid === 'half' ? 'inline-block w-[calc(50%-8px)] mr-4 align-top' : ''}>
            {!isToggle && (
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                {field.label} {field.required && <span className="text-red-400">*</span>}
              </label>
            )}
            <DynamicFieldRenderer
              field={field}
              value={formData[field.key]}
              onChange={onFieldChange}
              error={errors?.[field.key]}
            />
            {errors?.[field.key] && (
              <p className="text-xs text-red-500 mt-1">{errors[field.key]}</p>
            )}
          </div>
        );
      })}

      {/* Sections (repeatable items, photos, preview) */}
      {step.sections && step.sections.map((section, sIdx) => {
        if (section.type === 'repeatable_items') {
          return (
            <RepeatableItemsSection
              key={sIdx}
              section={section}
              products={products}
              onProductAdd={onProductAdd}
              onProductRemove={onProductRemove}
              onProductFieldChange={onProductFieldChange}
              errors={errors}
            />
          );
        }

        if (section.type === 'photo_upload') {
          return (
            <PhotoUploadSection key={sIdx} section={section} formData={formData} onFieldChange={onFieldChange} />
          );
        }

        if (section.type === 'live_preview' || section.type === 'quality_score' || section.type === 'publish_button') {
          // These are rendered by the parent ListingWizard, not here
          return null;
        }

        return null;
      })}
    </div>
  );
}

// ── Repeatable Items Section ──────────────────────────────────────────────────

function RepeatableItemsSection({ section, products, onProductAdd, onProductRemove, onProductFieldChange, errors }) {
  const fields = section.item_fields || [];
  const itemType = section.item_type || 'item';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-bold text-gray-800 capitalize">{itemType.replace(/_/g, ' ')}s</h3>
        <button type="button" onClick={onProductAdd}
          className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold rounded-xl transition-colors">
          + Add {itemType.replace(/_/g, ' ')}
        </button>
      </div>

      {products.length === 0 && (
        <div className="text-center py-8 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
          <p className="text-gray-400 text-sm">No {itemType.replace(/_/g, ' ')}s yet. Click the button above to add one.</p>
        </div>
      )}

      {products.map((product, pIdx) => (
        <div key={pIdx} className="bg-white border-2 border-gray-100 rounded-xl p-4 space-y-3 relative group">
          <button type="button" onClick={() => onProductRemove(pIdx)}
            className="absolute top-2 right-2 text-gray-300 hover:text-red-500 text-lg opacity-0 group-hover:opacity-100 transition-opacity">
            ×
          </button>
          <div className="text-xs font-bold text-gray-400 uppercase">
            {itemType.replace(/_/g, ' ')} #{pIdx + 1}
          </div>
          {fields.map(field => (
            <div key={field.key}>
              <label className="block text-xs font-semibold text-gray-600 mb-1">
                {field.label} {field.required && <span className="text-red-400">*</span>}
              </label>
              <DynamicFieldRenderer
                field={field}
                value={product[field.key]}
                onChange={(key, val) => onProductFieldChange(pIdx, key, val)}
                error={errors?.[`product_${pIdx}_${field.key}`]}
              />
            </div>
          ))}
        </div>
      ))}

      {section.excel_upload && (
        <div className="text-center py-4 bg-blue-50 rounded-xl border border-blue-200">
          <p className="text-blue-600 text-xs font-semibold">📤 Or upload an Excel file to bulk-add {itemType.replace(/_/g, ' ')}s</p>
          <button type="button" className="mt-2 px-4 py-1.5 bg-blue-100 hover:bg-blue-200 text-blue-700 text-xs font-bold rounded-lg transition-colors">
            Upload Excel
          </button>
        </div>
      )}
    </div>
  );
}

// ── Photo Upload Section ──────────────────────────────────────────────────────

function PhotoUploadSection({ section, formData, onFieldChange }) {
  const slots = section.slots || ['Photo'];
  return (
    <div className="space-y-3">
      <h3 className="text-base font-bold text-gray-800">Photos</h3>
      <div className="grid grid-cols-2 gap-3">
        {slots.map(slot => (
          <div key={slot}
            className="aspect-video bg-gray-50 border-2 border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center gap-1 cursor-pointer hover:border-orange-300 transition-colors">
            <span className="text-2xl">📷</span>
            <span className="text-xs text-gray-400 font-medium">{slot}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
