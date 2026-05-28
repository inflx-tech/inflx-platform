# Flow 39 (F1) — Follower Discovery + Browse · Spec

**Bucket**: mobile-follower redesign (Wave 3) — Phase F1 (common spine)
**Owner**: founder · **Locked**: 2026-05-28

## 1 · Problem
Three discovery/browse screens still run the Wave-3 darkColors theme after F0
flipped the home-cluster + atoms to light brandPalette. CategoryList + Deals
host the now-light `ProductCard`, so they currently show light cards on a dark
bg (the bounded intermediate cascade state F0 flagged). This flow clears it.

## 2 · Goal
Flip FindScreen + CategoryListScreen + DealsScreen to the light brandPalette
design language locked in F0 (Flow 38). Pure visual restyle — zero behavior
change. Design authority = the F0 master mockup (mirrored into 04-preview).

## 3 · Scope
### In-scope
- `screens/follower/FindScreen.js` (303) — token-swap + Outfit/mono polish
- `screens/follower/CategoryListScreen.js` (464) — token-swap + getBusinessAccent → getBusinessAccentLight (dining/shopping/booking mental-model split preserved)
- `screens/follower/DealsScreen.js` (195) — token-swap + ink/yellowPale active filter tab
### Out-of-scope
- BrandStore + InfluencerStore → Flow 40 (next)
- All backend / API / navigation / tracking — untouched

## 4 · Dependencies
- ZERO API change. Consumes getCategoryStores / getCategories / getDeals as before.
- `getBusinessAccentLight` (added F0) used for per-business hero tints on CategoryList.
- ProductCard (light, from F0) reused — clears its cascade on these screens.

## 5 · Risk surface — LOW
- Pure restyle. `#fff` labels on CategoryList dining cards remain (they sit on
  saturated per-business accent badges — readable).
- CategoryList mental-model split (dining cards vs product grid) + per-category
  routing preserved verbatim.
- Deals active filter tab: amber → ink-border + yellowPale + ink text.

## 6 · Success criteria
1. 3 screens render on light brandPalette.
2. ProductCard cascade cleared on Category + Deals.
3. getBusinessAccentLight drives CategoryList hero tints.
4. Zero API/nav/tracking change.
5. `pnpm qa` 76/76 GREEN gate 0.
6. OTA shipped × 3.
7. `06-diff/notes.md` non-empty.
