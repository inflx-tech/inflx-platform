'use client';

/**
 * RestaurantFleetRow — brand-side menu item row in the fleet list view.
 *
 * Reads attributes from variants_json (the storage_format target for
 * restaurant's per-item flags). Defensive parse since variants_json may
 * arrive as either a JSON string or pre-parsed object depending on how the
 * fleet endpoint serializes it.
 *
 * Shows section, veg/non-veg dot, bestseller / chef-special inline flags,
 * and price. Live/Inactive pill matches the layout's DefaultFleetRow pattern
 * for visual continuity across templates.
 *
 * Section grouping in the fleet view is a polish-pass enhancement — flat
 * list works for PR-B QA. If a restaurant author hits 100+ items and the
 * flat list becomes unhelpful, FleetView gains a grouping pass then.
 */

function parseVariants(raw) {
  if (!raw) return {};
  if (typeof raw === 'object') return raw;
  try { return JSON.parse(raw) || {}; } catch { return {}; }
}

export default function RestaurantFleetRow({ product, onRemove }) {
  const v = parseVariants(product.variants_json);
  const veg = v.veg_flag;
  const isVeg = veg === 'veg' || veg === 'Veg' || veg === true;
  const isNonVeg = veg === 'non_veg' || veg === 'Non-Veg';

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-4">
      <div className="w-20 h-14 bg-gray-100 rounded-lg flex items-center justify-center text-2xl flex-shrink-0 overflow-hidden">
        {product.image_url
          ? <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
          : '🍽️'}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Veg/non-veg dot */}
          {(isVeg || isNonVeg) && (
            <span className={`w-3 h-3 rounded-sm border-[1.5px] flex items-center justify-center flex-shrink-0
              ${isVeg ? 'border-green-600' : 'border-red-600'}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${isVeg ? 'bg-green-600' : 'bg-red-600'}`} />
            </span>
          )}

          <span className="text-sm font-bold text-gray-900 truncate">{product.name}</span>

          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold flex-shrink-0
            ${product.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
            {product.is_active ? 'Live' : 'Inactive'}
          </span>

          {v.bestseller && (
            <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-amber-100 text-amber-700 flex-shrink-0">
              ⭐ Bestseller
            </span>
          )}
          {v.chef_special && (
            <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-purple-100 text-purple-700 flex-shrink-0">
              👨‍🍳 Chef's Special
            </span>
          )}
        </div>
        <p className="text-xs text-gray-500 mt-0.5 truncate">
          {product.category || product.section || 'Uncategorized'}
          {v.spice_level && <span className="ml-2">· 🌶 {v.spice_level}</span>}
          {v.portion_size && <span className="ml-2">· {v.portion_size}</span>}
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
