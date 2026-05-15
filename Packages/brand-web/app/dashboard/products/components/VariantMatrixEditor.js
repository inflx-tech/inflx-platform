'use client';

import { useMemo } from 'react';

/**
 * VariantMatrixEditor — Fashion-1 SKU matrix authoring.
 *
 * Renders two chip-selects (sizes + colors) and an auto-generated SKU grid
 * with a stock input per cell. Value shape (stored under wizardItem._variants
 * — the underscore-prefix tells publishDriver to route this through the
 * dedicated /variants endpoint rather than into brand_products columns):
 *
 *   [{ size: 'M', color: 'Red',  stock: 5 },
 *    { size: 'M', color: 'Blue', stock: 3 },
 *    { size: 'L', color: 'Red',  stock: 0 },
 *    ...]
 *
 * Modes (driven by which lists have entries):
 *   · No sizes + no colors  → empty variants array (product sold by base price/stock).
 *   · Sizes only            → one variant per size.
 *   · Colors only           → one variant per color.
 *   · Sizes × colors        → full matrix.
 *
 * Stock default is 0 (out-of-stock) when a new size/color is added; brand
 * fills in actual counts before publish.
 */

const COMMON_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL', '28', '30', '32', '34', '36', '38', '40', 'Free'];
const COMMON_COLORS = ['Black', 'White', 'Navy', 'Grey', 'Red', 'Blue', 'Green', 'Pink', 'Yellow', 'Beige', 'Brown', 'Mustard'];

export default function VariantMatrixEditor({ value, onChange }) {
  const variants = Array.isArray(value) ? value : [];

  // Derive currently-selected sizes & colors from the variant list
  const selectedSizes = useMemo(() => {
    const s = new Set(variants.map(v => v.size).filter(Boolean));
    return Array.from(s);
  }, [variants]);

  const selectedColors = useMemo(() => {
    const c = new Set(variants.map(v => v.color).filter(Boolean));
    return Array.from(c);
  }, [variants]);

  function toggleSize(size) {
    const isOn = selectedSizes.includes(size);
    let nextVariants;
    if (isOn) {
      nextVariants = variants.filter(v => v.size !== size);
    } else {
      if (selectedColors.length > 0) {
        // Matrix mode: add (size × each color) combos
        nextVariants = [...variants, ...selectedColors.map(c => ({ size, color: c, stock: 0 }))];
      } else {
        // Size-only mode
        nextVariants = [...variants, { size, color: null, stock: 0 }];
      }
    }
    onChange(nextVariants);
  }

  function toggleColor(color) {
    const isOn = selectedColors.includes(color);
    let nextVariants;
    if (isOn) {
      nextVariants = variants.filter(v => v.color !== color);
    } else {
      if (selectedSizes.length > 0) {
        nextVariants = [...variants, ...selectedSizes.map(s => ({ size: s, color, stock: 0 }))];
      } else {
        nextVariants = [...variants, { size: null, color, stock: 0 }];
      }
    }
    onChange(nextVariants);
  }

  function setStockAt(size, color, stock) {
    const nextVariants = variants.map(v =>
      v.size === size && v.color === color
        ? { ...v, stock: stock === '' ? null : Number(stock) }
        : v
    );
    onChange(nextVariants);
  }

  function findVariant(size, color) {
    return variants.find(v => v.size === size && v.color === color);
  }

  const showMatrix = selectedSizes.length > 0 || selectedColors.length > 0;
  const isFullMatrix = selectedSizes.length > 0 && selectedColors.length > 0;

  return (
    <div className="space-y-3 p-3 rounded-xl bg-pink-50/40 border border-pink-100">
      {/* Sizes */}
      <div>
        <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-1.5">Sizes</div>
        <div className="flex gap-1.5 flex-wrap">
          {COMMON_SIZES.map(s => {
            const on = selectedSizes.includes(s);
            return (
              <button key={s} type="button" onClick={() => toggleSize(s)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold border transition-all
                  ${on ? 'bg-pink-500 text-white border-pink-500' : 'bg-white text-gray-600 border-gray-200 hover:border-pink-300'}`}>
                {s}
              </button>
            );
          })}
        </div>
      </div>

      {/* Colors */}
      <div>
        <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-1.5">Colors</div>
        <div className="flex gap-1.5 flex-wrap">
          {COMMON_COLORS.map(c => {
            const on = selectedColors.includes(c);
            return (
              <button key={c} type="button" onClick={() => toggleColor(c)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold border transition-all
                  ${on ? 'bg-pink-500 text-white border-pink-500' : 'bg-white text-gray-600 border-gray-200 hover:border-pink-300'}`}>
                {c}
              </button>
            );
          })}
        </div>
      </div>

      {/* SKU stock matrix */}
      {showMatrix && (
        <div>
          <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-1.5">
            Stock per SKU ({variants.length} {variants.length === 1 ? 'SKU' : 'SKUs'})
          </div>
          {isFullMatrix ? (
            <div className="overflow-x-auto">
              <table className="text-[11px] border-collapse">
                <thead>
                  <tr>
                    <th className="px-2 py-1 text-left text-gray-500 font-semibold">Size \ Color</th>
                    {selectedColors.map(c => (
                      <th key={c} className="px-2 py-1 text-left text-gray-500 font-semibold">{c}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {selectedSizes.map(s => (
                    <tr key={s}>
                      <td className="px-2 py-1 font-bold text-gray-700">{s}</td>
                      {selectedColors.map(c => {
                        const v = findVariant(s, c);
                        return (
                          <td key={c} className="px-1 py-1">
                            <input
                              type="number" min={0}
                              value={v?.stock ?? 0}
                              onChange={(e) => setStockAt(s, c, e.target.value)}
                              className="w-14 px-1.5 py-0.5 text-[11px] border border-gray-200 rounded text-center outline-none focus:border-pink-400"
                            />
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="space-y-1">
              {variants.map((v, idx) => {
                const label = v.size || v.color;
                return (
                  <div key={`${v.size || ''}-${v.color || ''}-${idx}`} className="flex items-center gap-2">
                    <span className="text-[11px] font-bold text-gray-700 w-12">{label}</span>
                    <span className="text-[10px] text-gray-400">stock:</span>
                    <input
                      type="number" min={0}
                      value={v.stock ?? 0}
                      onChange={(e) => setStockAt(v.size, v.color, e.target.value)}
                      className="w-16 px-2 py-0.5 text-[11px] border border-gray-200 rounded outline-none focus:border-pink-400"
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {!showMatrix && (
        <p className="text-[10px] text-gray-400 italic">
          Skip if this item has no size/color variants — base price + base stock apply to the whole product.
        </p>
      )}
    </div>
  );
}
