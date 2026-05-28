# Flow 40 (F1) — Before/After diff notes

## Before
- BrandStoreScreen: Wave-3 **darkColors** — ink-black bg, amber accents, dark
  cards, light-on-dark ProductCard (F0 cascade).
- InfluencerStoreScreen: Wave-4 **lightColors** — already light but `#EAB308`
  yellow + `paper`/`yellow100` tokens (not brandPalette).

## After (unified light brandPalette)
| Screen | After |
|---|---|
| BrandStoreScreen | light bg + white cards + ink text · accent.pale banner/offer tints · accent.accent logo + creator bar + sticky CTA (white text retained — readable on saturated accent) · green verified badge · light ProductCard grid (cascade cleared) · yellow spinner/refresh · "brought to you by [creator]" creator bar intact |
| InfluencerStoreScreen | brand yellow #FFC107 (was #EAB308) · yellowPale (was yellow100) · white (was paper) · Outfit-Black creator name + mono handle + sansMedium creator notes (fonts already present) · accent.pale creator-pick tiles |

## Per locked F0 design language
- Light brandPalette chrome · per-business accents wayfinding-only · ink/yellow
  brand accents · Outfit headings · mono handles/prices.
- Creator vibe centerpiece: BrandStore creator bar + InfluencerStore creator
  notes carry the attribution.

## Preservation evidence
- getBrandStore / getStore / getStoreProducts / follow / unfollow / saveOffer /
  unsaveOffer unchanged.
- BrandStore inline RestaurantDetailScreen render (component import) preserved —
  confirmed NOT a nav bug (the earlier "nav-registration gap" for RestaurantDetail
  is explained by this inline render).
- Path-B 4-ID tracking propagation forwarded verbatim on both.
- ProductCard (light atom) reused — BrandStore cascade cleared.

## Cascade status after this flow
Cleared: BrandStore. Remaining light-on-dark: SavedScreen (→ F2). All F1
common-spine ProductCard hosts now coherent.

## Open-item update
The "RestaurantDetail/etc. nav-registration gap" flagged in F0 is partly
explained: BrandStore renders RestaurantDetail INLINE. OrderCart/SlotPicker/
SchemaDetail registration still to verify in F3/F4.

## Sign-off
- Design language locked at F0 (Flow 38). This flow applies it. Founder "proceed to F1".
- Web QA + OTA: see lock.json.
