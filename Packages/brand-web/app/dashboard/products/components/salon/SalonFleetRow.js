'use client';

/**
 * SalonFleetRow — brand-side service row in the fleet list view.
 *
 * Reads attributes from variants_json (per salon's storage_format spec).
 * Shows section, duration, gender, premium flag, stylist count, and price.
 *
 * Same defensive variants_json parse as RestaurantFleetRow — values may be
 * a JSON string or pre-parsed object depending on the fleet endpoint
 * serializer.
 */

function parseVariants(raw) {
  if (!raw) return {};
  if (typeof raw === 'object') return raw;
  try { return JSON.parse(raw) || {}; } catch { return {}; }
}

export default function SalonFleetRow({ product, onRemove }) {
  const v = parseVariants(product.variants_json);
  const stylistCount = Array.isArray(v.available_stylist_ids) ? v.available_stylist_ids.length : 0;

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-4">
      <div className="w-20 h-14 bg-gray-100 rounded-lg flex items-center justify-center text-2xl flex-shrink-0 overflow-hidden">
        {product.image_url
          ? <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
          : '💇'}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-bold text-gray-900 truncate">{product.name}</span>

          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold flex-shrink-0
            ${product.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
            {product.is_active ? 'Live' : 'Inactive'}
          </span>

          {v.premium && (
            <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-amber-100 text-amber-700 flex-shrink-0">
              ✨ Premium
            </span>
          )}
          {v.requires_stylist_choice && stylistCount > 0 && (
            <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-purple-100 text-purple-700 flex-shrink-0">
              {stylistCount} stylist{stylistCount !== 1 ? 's' : ''}
            </span>
          )}
          {v.requires_stylist_choice && stylistCount === 0 && (
            <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-red-100 text-red-700 flex-shrink-0">
              ⚠ No stylists
            </span>
          )}
        </div>
        <p className="text-xs text-gray-500 mt-0.5 truncate">
          {product.category || 'Uncategorized'}
          {v.duration_mins && <span className="ml-2">· {v.duration_mins}m</span>}
          {v.gender && <span className="ml-2">· {v.gender}</span>}
        </p>
      </div>

      <div className="text-right flex-shrink-0">
        <div className="text-lg font-extrabold text-gray-900">
          ₹{Number(product.price || 0).toLocaleString('en-IN')}
        </div>
      </div>

      <button onClick={onRemove}
        className="text-red-400 hover:text-red-600 text-xs font-semibold ml-2">Remove</button>
    </div>
  );
}
