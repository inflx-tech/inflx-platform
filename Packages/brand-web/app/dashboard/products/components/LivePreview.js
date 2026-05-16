'use client';

/**
 * LivePreview — 320×560 phone-frame mockup of the follower-facing detail
 * screen. Reads wizardState first (so the brand sees their unsaved edits
 * live), then falls back to the saved brand profile + product list.
 *
 * For category=restaurant this mirrors RestaurantDetailScreen's layout
 * (hero + cuisines + vibes + cost + action CTAs + sample menu). Other
 * categories degrade to the generic card preview.
 *
 * Props:
 *   brand        — the saved brand row (post-publish state)
 *   products     — the saved product list
 *   cardConfig   — schema.card_config (accent, icon, ctas)
 *   actionTypes  — schema.action_types
 *   wizardState  — current unsaved form values (live edits)
 *   template     — full schema (for restaurant-specific rendering)
 */

import { fmtRupees } from '../../../../lib/api';

const FRAME_W = 320;
const FRAME_H = 560;

export default function LivePreview({ brand, products, cardConfig, actionTypes, wizardState, template }) {
  if (!cardConfig && !template) return null;

  const isRestaurant = template?.category_key === 'restaurant';

  // Merge wizardState (unsaved) over brand.listing_data (saved) so the preview
  // tracks live edits as the brand types. wizardState wins on every key.
  const ls = brand?.listing_data || {};
  const merged = { ...ls, ...(wizardState || {}) };

  const name        = brand?.business_name || merged.business_name || 'Your Restaurant';
  const cuisines    = Array.isArray(merged.cuisines) ? merged.cuisines : [];
  const vibes       = Array.isArray(merged.vibes) ? merged.vibes : [];
  const locality    = merged.locality || brand?.city || 'Your area';
  const costForTwo  = merged.cost_for_two || 0;
  const description = merged.restaurant_description || '';
  const photos      = Array.isArray(merged.photos) ? merged.photos : [];
  const coverUrl    = merged.cover_image_url || photos[0]?.download_url || photos[0]?.url || null;
  const acceptsTable = merged.accepts_table_booking !== false;
  const payAtStore   = merged.pay_at_store_supported !== false;
  const onlineOrder  = merged.online_order_supported === true;

  const accent     = cardConfig?.accent || '#EAB308';
  const accentDim  = cardConfig?.accent_dim || 'rgba(234,179,8,0.10)';

  return (
    <div className="bg-paper border border-line-soft rounded-2xl p-5 space-y-3 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <div className="font-display text-sm font-bold text-ink-1">📱 Live Preview</div>
          <p className="text-xs text-ink-3">How followers will see you</p>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-teal" />
          <span className="font-mono text-[10px] uppercase tracking-wider text-teal-deep">live</span>
        </div>
      </div>

      {/* Phone bezel */}
      <div className="mx-auto bg-ink-1 rounded-[36px] p-2 shadow-xl" style={{ width: FRAME_W + 16 }}>
        {/* Notch */}
        <div className="flex justify-center pt-1 pb-2">
          <div className="w-20 h-1 rounded-full bg-paper-deep opacity-30" />
        </div>
        {/* Screen */}
        <div className="bg-paper rounded-[28px] overflow-hidden relative" style={{ width: FRAME_W, height: FRAME_H }}>
          <div className="overflow-y-auto h-full pb-20" style={{ scrollbarWidth: 'none' }}>
            {/* Hero */}
            <div className="relative h-44 flex items-end overflow-hidden"
              style={coverUrl
                ? { backgroundImage: `url(${coverUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }
                : { background: `linear-gradient(135deg, ${accent}, ${accentDim})` }
              }>
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
              <div className="absolute top-3 left-3 right-3 flex justify-between items-center">
                <button className="w-8 h-8 rounded-full bg-black/40 backdrop-blur flex items-center justify-center text-white text-sm">‹</button>
                <button className="w-8 h-8 rounded-full bg-black/40 backdrop-blur flex items-center justify-center text-white text-xs">♡</button>
              </div>
              <div className="relative p-3 w-full">
                <div className="font-display text-white text-lg font-extrabold leading-tight tracking-tight">{name}</div>
                <div className="text-white/80 text-[10px] mt-0.5 flex items-center gap-1.5 flex-wrap">
                  {cuisines.slice(0, 3).join(' · ') || 'Add cuisines'}
                  <span className="opacity-50">·</span>
                  <span>{locality}</span>
                </div>
              </div>
            </div>

            {/* Quick stats row */}
            <div className="px-3 py-2.5 flex items-center gap-3 border-b border-paper-deep">
              <Stat label="COST/2" value={costForTwo ? `₹${costForTwo}` : '—'} />
              <Divider />
              <Stat label="OPEN" value="11–11" highlight />
              <Divider />
              <Stat label="RATING" value="4.5★" />
            </div>

            {/* Vibe pills */}
            {vibes.length > 0 && (
              <div className="px-3 py-2.5 flex flex-wrap gap-1.5">
                {vibes.slice(0, 4).map(v => (
                  <span key={v} className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
                    style={{ backgroundColor: accentDim, color: accent }}>
                    {String(v).replace(/_/g, ' ')}
                  </span>
                ))}
              </div>
            )}

            {/* Description */}
            {description && (
              <div className="px-3 pb-2.5">
                <p className="text-[11px] text-ink-2 leading-relaxed line-clamp-3">{description}</p>
              </div>
            )}

            {/* Photo strip */}
            {photos.length > 0 && (
              <div className="px-3 pb-3">
                <div className="text-[9px] font-bold uppercase tracking-wider text-ink-3 mb-1.5">Gallery</div>
                <div className="flex gap-1.5 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
                  {photos.slice(0, 6).map((p, i) => (
                    <div key={i} className="flex-shrink-0 w-14 h-14 rounded-lg bg-paper-deep overflow-hidden">
                      {(p.download_url || p.url) && <img src={p.download_url || p.url} alt="" className="w-full h-full object-cover" />}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Sample menu */}
            {isRestaurant && (
              <div className="px-3 pb-3">
                <div className="text-[9px] font-bold uppercase tracking-wider text-ink-3 mb-1.5">Menu preview</div>
                {(products && products.length > 0)
                  ? <div className="space-y-1.5">
                      {products.slice(0, 3).map((p, i) => (
                        <div key={i} className="flex items-center justify-between bg-paper-surface rounded-lg px-2.5 py-1.5 border border-paper-deep">
                          <div className="min-w-0 flex-1">
                            <div className="text-[11px] font-semibold text-ink-1 truncate flex items-center gap-1.5">
                              <span className={`w-2 h-2 inline-block rounded-sm border ${p.veg_flag === 'Veg' ? 'border-teal' : 'border-red'}`}>
                                <span className={`block w-1 h-1 m-0.5 rounded-full ${p.veg_flag === 'Veg' ? 'bg-teal' : 'bg-red'}`} />
                              </span>
                              {p.name || 'Menu item'}
                            </div>
                            {p.section && <div className="text-[9px] text-ink-3">{p.section}</div>}
                          </div>
                          <div className="font-mono text-[11px] font-bold text-ink-1 ml-2">₹{p.price || '—'}</div>
                        </div>
                      ))}
                    </div>
                  : <div className="text-[10px] text-ink-3 italic">Add menu items to see them here</div>
                }
              </div>
            )}
          </div>

          {/* Sticky action bar */}
          <div className="absolute bottom-0 left-0 right-0 bg-paper border-t border-paper-deep px-3 py-2 flex gap-1.5">
            {acceptsTable && (
              <button className="flex-1 py-2 rounded-lg text-[10px] font-bold bg-yellow text-ink-1">
                Book Table
              </button>
            )}
            {payAtStore && (
              <button className="flex-1 py-2 rounded-lg text-[10px] font-bold bg-paper text-ink-1 border border-line-soft">
                Pay Bill
              </button>
            )}
            {onlineOrder && (
              <button className="flex-1 py-2 rounded-lg text-[10px] font-bold bg-teal text-white">
                Order
              </button>
            )}
            {!acceptsTable && !payAtStore && !onlineOrder && (
              <div className="flex-1 text-center text-[10px] text-ink-3 italic py-2">
                Enable at least one action in step 7
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Caption */}
      <p className="text-center text-[10px] text-ink-3 font-mono">
        320 × 560 · matches RestaurantDetailScreen
      </p>
    </div>
  );
}

function Stat({ label, value, highlight }) {
  return (
    <div className="flex flex-col items-center flex-1">
      <div className={`font-display text-xs font-extrabold ${highlight ? 'text-teal-deep' : 'text-ink-1'}`}>{value}</div>
      <div className="font-mono text-[8px] uppercase tracking-wider text-ink-3">{label}</div>
    </div>
  );
}

function Divider() {
  return <div className="w-px h-6 bg-paper-deep" />;
}
