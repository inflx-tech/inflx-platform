# Flow 40 (F1) — Impact

**Chat verdict (terse)**: zero functional / backend / logic / DB impact — visual restyle only.

## Files changed
| File | Change |
|---|---|
| `screens/follower/BrandStoreScreen.js` | darkColors → brandPalette flip + getBusinessAccent → getBusinessAccentLight (.dim → .pale) |
| `screens/follower/InfluencerStoreScreen.js` | lightColors → brandPalette migration + getBusinessAccentLight |
| `features/redesign-flow-40-*/` | 7 artifacts |

## APIs touched: ZERO. Backend: ZERO.

## Regression surface
- `pnpm qa` 76 Playwright: zero Mobile-touching; expect 76/76 GREEN.
- Maestro 4/4 baseline applies. Founder APK smoke-test covers — especially the
  brand store + inline restaurant render + follow flow.

## Mobile-specific
- BrandStore: `#fff` text retained on `accent.accent` saturated surfaces
  (logo/creatorBar/avatars/sticky CTA — readable); `accent.dim` → `.pale`.
- BrandStore renders RestaurantDetailScreen INLINE for restaurant brands
  (component import line 7) — preserved; that screen's own restyle is F4.
- InfluencerStore: lightColors → brandPalette; mostly identical hexes, visible
  change is brand yellow #EAB308 → #FFC107 + yellowPale.
- Path-B 4-ID tracking propagation preserved verbatim on both.
- ProductCard (light, F0) reused — BrandStore cascade cleared.

## Deploy class
Production-impacting — OTA × 3 (brand/influencer no-op shared bundle; follower
carries the change). No native rebuild.
