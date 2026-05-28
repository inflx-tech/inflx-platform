# Flow 40 (F1) — Follower Storefronts · Spec

**Bucket**: mobile-follower redesign (Wave 3) — Phase F1 (common spine), 2nd flow
**Owner**: founder · **Locked**: 2026-05-28

## 1 · Problem
The two storefronts — BrandStore (the brand's shop, darkColors) and
InfluencerStore (the creator's curated store, lightColors `#EAB308`) — are the
creator-marketplace centerpiece but run two different non-brandPalette systems.
BrandStore also hosts the now-light ProductCard (F0) → light-on-dark cascade.

## 2 · Goal
Unify both storefronts onto the F0-locked light brandPalette:
- **BrandStoreScreen**: dark → light flip (darkColors → brandPalette).
- **InfluencerStoreScreen**: lightColors → brandPalette migration (same hexes
  for ink/muted/border/bg; key change is yellow `#EAB308` → `#FFC107`).
Clears the BrandStore ProductCard cascade.

## 3 · Scope
### In-scope
- `screens/follower/BrandStoreScreen.js` (706) — token-swap + getBusinessAccent → getBusinessAccentLight (`.dim` → `.pale`)
- `screens/follower/InfluencerStoreScreen.js` (410) — lightColors → brandPalette migration + getBusinessAccentLight
### Out-of-scope
- Backend / API / navigation / tracking — untouched
- RestaurantDetailScreen (rendered INLINE by BrandStore for restaurant brands — confirmed not a nav bug) → its own restyle in F4
- SavedScreen cascade → F2

## 4 · Dependencies
- ZERO API change. getBrandStore / getStore / getStoreProducts / follow / unfollow / saveOffer preserved.
- `getBusinessAccentLight` (F0): `.accent` saturated (backs white-text avatars/badges/creatorBar/sticky CTA — readable), `.pale` for light tints (banner/offer/pick-img).
- ProductCard (light, F0) reused → BrandStore cascade cleared.

## 5 · Risk surface — LOW-MEDIUM
- BrandStore is 706 LOC with a creator bar + sticky CTA + inline RestaurantDetail render. White text (`#fff`) on `accent.accent` saturated backgrounds RETAINED (readable); `accent.dim` remapped to `.pale`.
- InfluencerStore lightColors→brandPalette: mostly identical hexes; visible change is the warmer brand yellow + yellowPale.
- 4-ID tracking (Path-B propagation) preserved verbatim on both.

## 6 · Success criteria
1. Both storefronts render on light brandPalette.
2. BrandStore ProductCard cascade cleared.
3. Creator endorsement / "brought to you by" surfaces intact (accent-colored, readable).
4. Zero API/nav/tracking change.
5. `pnpm qa` 76/76 GREEN gate 0.
6. OTA × 3.
7. `06-diff/notes.md` non-empty.
