'use client';

/**
 * SalonPricingForm — service_pricing step. Single price input with master
 * benchmark guidance when available.
 *
 * Note: master_salon_services doesn't carry price_min/price_max columns
 * today (only master_vehicles does). The PriceField gracefully skips the
 * benchmark line when those fields are absent on the master row, showing
 * an explanatory note instead. A follow-up migration could add the
 * benchmark columns to master_salon_services if pricing guidance becomes
 * a meaningful conversion driver.
 */

export default function SalonPricingForm({ step, wizardState, onFieldChange }) {
  const priceFields = step.price_fields || [];
  const masterRow = wizardState._master_row;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold text-gray-900">{step.title}</h2>
        {step.subtitle && <p className="text-sm text-gray-500 mt-1">{step.subtitle}</p>}
      </div>

      {masterRow && (
        <div className="bg-purple-50 border border-purple-200 rounded-xl p-3">
          <div className="text-xs font-bold text-purple-900">{masterRow.name || masterRow.service_name}</div>
          <div className="text-[10px] text-purple-600 mt-0.5">
            {masterRow.category} · {wizardState.duration_mins || masterRow.duration_mins_default}m
          </div>
        </div>
      )}

      {priceFields.map(field => (
        <PriceField
          key={field.key}
          field={field}
          value={wizardState[field.key]}
          onChange={(v) => onFieldChange(field.key, v)}
          masterRow={masterRow}
        />
      ))}
    </div>
  );
}

function PriceField({ field, value, onChange, masterRow }) {
  const benchMin = field.benchmark_fields?.[0] && masterRow?.[field.benchmark_fields[0]];
  const benchMax = field.benchmark_fields?.[1] && masterRow?.[field.benchmark_fields[1]];
  const showBenchmark = benchMin != null && benchMax != null;

  return (
    <div>
      <label className="block text-xs font-semibold text-gray-700 mb-1.5">
        {field.label} {field.required && <span className="text-red-400">*</span>}
      </label>
      <div className="flex items-center border-2 border-gray-200 rounded-xl overflow-hidden focus-within:border-purple-400">
        <div className="px-3 py-2.5 text-sm text-gray-500 border-r border-gray-200 bg-gray-50">
          {field.unit || '₹'}
        </div>
        <input type="number" value={value ?? ''}
          onChange={e => onChange(e.target.value === '' ? null : Number(e.target.value))}
          placeholder="0"
          className="flex-1 px-3 py-2.5 text-sm font-semibold outline-none" />
      </div>
      {showBenchmark ? (
        <p className="text-[10px] text-gray-500 mt-1">
          Suggested range: ₹{benchMin} – ₹{benchMax}
        </p>
      ) : (
        <p className="text-[10px] text-gray-400 mt-1 italic">
          (Pricing benchmarks not available for this service)
        </p>
      )}
    </div>
  );
}
