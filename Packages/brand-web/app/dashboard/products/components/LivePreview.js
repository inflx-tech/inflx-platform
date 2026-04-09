'use client';

/**
 * LivePreview — phone-frame mockup showing how the store appears to followers.
 * Reads card_config from schema to render with correct accent colors and layout.
 */

import { fmtRupees } from '../../../../lib/api';

export default function LivePreview({ brand, products, cardConfig, actionTypes }) {
  if (!cardConfig) return null;

  const accent = cardConfig.accent || '#f59e0b';
  const accentDim = cardConfig.accent_dim || 'rgba(245,158,11,0.1)';
  const icon = cardConfig.icon || '🏪';

  const cheapestProduct = products?.length > 0
    ? products.reduce((min, p) => (parseFloat(p.price) < parseFloat(min.price) ? p : min), products[0])
    : null;

  const priceDisplay = cheapestProduct
    ? `${fmtRupees(cheapestProduct.price)} ${cardConfig.price_display?.unit || ''}`
    : 'Add products to see price';

  return (
    <div className="bg-white border-2 border-gray-100 rounded-2xl p-5 space-y-4">
      <div className="text-sm font-bold text-gray-800">📱 Follower Preview</div>
      <p className="text-xs text-gray-400">This is how followers will see your store</p>

      {/* Phone frame */}
      <div className="mx-auto w-[280px] bg-[#070b16] rounded-[28px] p-3 shadow-xl">
        <div className="bg-[#0e1525] rounded-[20px] overflow-hidden">
          {/* Store card preview */}
          <div className="p-4">
            {/* Mini card */}
            <div className="bg-[#151d30] rounded-xl border border-[rgba(255,255,255,0.06)] overflow-hidden">
              {/* Hero area */}
              <div className="h-20 flex items-center justify-center text-3xl"
                style={{ background: `linear-gradient(135deg, ${accentDim}, rgba(0,0,0,0.1))` }}>
                {icon}
              </div>

              {/* Card body */}
              <div className="p-3 space-y-2">
                <div className="text-white text-sm font-bold truncate" style={{ fontFamily: 'Syne, sans-serif' }}>
                  {brand?.business_name || 'Your Store Name'}
                </div>
                <div className="text-[#94a3b8] text-[10px]">
                  {brand?.category?.replace(/_/g, ' ')} · {brand?.city || 'Your City'}
                </div>

                {/* Price */}
                <div className="flex items-center gap-2">
                  <span className="text-sm font-black" style={{ color: accent, fontFamily: 'Syne, sans-serif' }}>
                    {priceDisplay}
                  </span>
                </div>

                {/* CTA buttons */}
                <div className="flex gap-2 mt-2">
                  {cardConfig.cta_primary && (
                    <button className="flex-1 py-1.5 rounded-lg text-[10px] font-bold text-white"
                      style={{ backgroundColor: cardConfig.cta_primary.color || accent }}>
                      {cardConfig.cta_primary.label}
                    </button>
                  )}
                  {cardConfig.cta_secondary && (
                    <button className="flex-1 py-1.5 rounded-lg text-[10px] font-bold border"
                      style={{ borderColor: accent, color: accent }}>
                      {cardConfig.cta_secondary.label}
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Products preview */}
            {products && products.length > 0 && (
              <div className="mt-3">
                <div className="text-[#94a3b8] text-[9px] font-bold uppercase tracking-wide mb-2">Products</div>
                <div className="grid grid-cols-2 gap-2">
                  {products.slice(0, 4).map((p, i) => (
                    <div key={i} className="bg-[#151d30] rounded-lg border border-[rgba(255,255,255,0.06)] p-2">
                      <div className="text-white text-[10px] font-semibold truncate">{p.name}</div>
                      <div className="text-[10px] font-bold mt-1" style={{ color: accent }}>
                        {fmtRupees(p.price)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
