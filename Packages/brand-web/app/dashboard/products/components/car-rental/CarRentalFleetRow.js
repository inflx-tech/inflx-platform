'use client';

/**
 * CarRentalFleetRow — brand-side vehicle row in the fleet list view.
 *
 * Extracted from CarRentalWizard.js (lines 217-249) as part of PR-3 —
 * the legacy CarRentalWizard.js is deleted; the fleet card render moves
 * here to be mounted by the shared ListingTemplateLayout's FleetView.
 *
 * Reads vehicle name + status + specs (parsed from variants_json) + price
 * per day. Same defensive variants_json parse as Restaurant/Salon fleet
 * rows.
 */

function parseVariants(raw) {
  if (!raw) return {};
  if (typeof raw === 'object') return raw;
  try { return JSON.parse(raw) || {}; } catch { return {}; }
}

export default function CarRentalFleetRow({ product, onRemove }) {
  const v = parseVariants(product.variants_json);
  const specs = v.specs || {};

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-4">
      <div className="w-20 h-14 bg-gray-100 rounded-lg flex items-center justify-center text-2xl flex-shrink-0">
        🚗
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-gray-900 truncate">{product.name}</span>
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold flex-shrink-0
            ${product.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
            {product.is_active ? 'Live' : 'Inactive'}
          </span>
        </div>
        <p className="text-xs text-gray-500 mt-0.5 truncate">{product.description || product.section}</p>
        <div className="flex gap-3 mt-1.5 text-xs text-gray-400">
          {specs.seats && <span>🪑 {specs.seats} seats</span>}
          {specs.fuel_type && <span>⛽ {specs.fuel_type.split(' / ')[0]}</span>}
          {v.km_rate && <span>🛣️ ₹{v.km_rate}/km</span>}
        </div>
      </div>
      <div className="text-right flex-shrink-0">
        <div className="text-lg font-extrabold text-gray-900">
          ₹{Number(product.price || 0).toLocaleString('en-IN')}
        </div>
        <div className="text-[10px] text-gray-400">/day</div>
      </div>
      <button onClick={onRemove}
        className="text-red-400 hover:text-red-600 text-xs font-semibold ml-2">Remove</button>
    </div>
  );
}
