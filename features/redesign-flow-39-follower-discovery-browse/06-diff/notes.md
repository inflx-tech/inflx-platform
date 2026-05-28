# Flow 39 (F1) — Before/After diff notes

## Before
FindScreen / CategoryListScreen / DealsScreen on Wave-3 **darkColors**:
ink-black bg, amber accents, dark cards. CategoryList + Deals showed the
now-light ProductCard (F0) on a dark bg = the bounded intermediate cascade.

## After (light brandPalette)
| Screen | After |
|---|---|
| FindScreen | light bg · Outfit-Black title + category labels · ink-bordered search · yellowPale mono deal-count badges · white category + sub cards |
| CategoryListScreen | light bg · white dining/store cards · **per-business `.pale` hero tints** via getBusinessAccentLight (restaurant red-pale, etc.) · saturated `.accent` deal badge with white text · open/closed pill · light ProductCard grids for shopping/booking · sort filter chips |
| DealsScreen | light bg · **ink-border + yellowPale + ink-text active filter tab** · yellow refresh/spinner · light ProductCard 2-col grid |

## Per locked F0 design language
- Light brandPalette chrome · per-business accents wayfinding-only (CategoryList
  hero tints) · ink/yellow brand accents · Outfit headings · mono badges.

## Preservation evidence
- ALL followerApi calls (getCategories/getCategoryStores/getDeals) unchanged.
- CategoryList DINING/SHOPPING/BOOKING mental-model split + per-category routing
  (BrandStore / ProductDetail / CarDetail) preserved verbatim.
- `buildTrackingFromOffer` 4-ID attribution forwarded on every tap — unchanged.
- ProductCard (light atom) reused — cascade cleared.

## Cascade status after this flow
Cleared: Category, Deals. Remaining light-on-dark: BrandStore (→ Flow 40),
SavedScreen (→ F2). All other ProductCard hosts now coherent.

## Sign-off
- Design language locked at F0 (Flow 38). This flow applies it. Founder "proceed to F1".
- Web QA + OTA: see lock.json.
