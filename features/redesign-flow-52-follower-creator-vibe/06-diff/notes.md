# Flow 52 — Before/After diff notes (Creator Vibe follower re-theme)

**Before** = the F0 light yellow/ink palette (Flows 38–51) + the prior 4-tab nav.
**Reference mockup** = `04-preview/mockups/all-screens.html` (8 phones, cream/terracotta).
**After (mobile)** = the implemented screens below. Per Flow 49 precedent, deep
data-gated screens use mockup + founder physical-APK smoke as the "after"
evidence (Maestro emulator screenshots optional); `pnpm qa` proves zero web
regression (76/76 GREEN, mobile-only change cannot touch the web suite).

## What changed, screen by screen

### Foundation (52.0)
- `theme/tokens.js` — NEW `creatorVibe` palette block (cream `#F7F3EC` / terracotta
  `#8B4A2F` / ink `#1C1A17` / amber `#F2A93B` / offer `#D9531E`) + `serifDisplay`
  system-serif fallback (D1: Fraunces deferred to a later native APK). **Additive
  — brandPalette/lightColors/darkColors untouched ⇒ brand-web + mobile-brand
  unaffected.**
- `FollowerNavigator.js` — 4 tabs → **5: Home · Offers · 🎬 Reels (center FAB) ·
  Orders · Profile**. Active tint → brown. Tab content remapped (Deals→Offers,
  MyStuff→Orders, Me→Profile); Saved folded into Profile; fixed a pre-existing
  dead `SavedList` route. Every existing stack screen preserved.
- `ReelsScreen.js` — placeholder for the center tab (real shoppable-reels system
  is 52.8, backend-gated).

### Hero screens (52.1–52.7) — visual + UX only, zero functional change
- **Home** (`HomeScreenV2`) — cream bg, serif location title, brown accents.
- **5 shared cards** (`ProductCard`, `ServiceCard`, `NewOfferCard`, `CategoryGrid`,
  `InfluencerStoryRow`) — cream/white cards, amber creator rings, blue verified
  tick, offer-red hearts; NewOfferCard banner → terracotta. Reused by Home/
  Category/Offers/BrandStore.
- **Offers** (`DealsScreen`) — "Deals"→"Offers" (serif), terracotta category chips,
  NEW data-backed "Today's Best Deal" hero (highest-discount loaded deal; no new
  endpoint). No fabricated sort pills.
- **Business** (`BrandStoreScreen`) — chrome → terracotta (creator bar, logo,
  sticky CTA, tabs); product cards keep per-business hero tint; blue verified tick.
- **Product** (`ProductDetailScreen`) — primary + secondary CTAs → terracotta;
  serif title. Mockup's customize toggles / reels rail / BEN20 code DEFERRED
  (need backend that doesn't exist; no phantom UI).
- **Creator Store** (`InfluencerStoreScreen`) — terracotta hero, amber avatar/
  follow. Collab-businesses row / Message / reels rail deferred (feature adds).
- **Category** (`CategoryListScreen`) — sort-pill active green→terracotta; serif
  header; per-business accent kept on store cards (wayfinding).
- **Creator's Category** (`CreatorCategoryScreen`) — **NEW screen** (mockup 4a).
  Creator-scoped: partner businesses + the creator's picks in one category. Runs
  on `getStore` data filtered client-side; offer dispatch + 4-ID tracking mirror
  the Creator Store. New `CreatorCategory` route wired; Creator Store's category
  tap now lands here (was the global CategoryList).

### Mid-flow gaps (52.G) — close the brown→yellow clash in the journey
- **Profile** (`MeScreen`) — "Me"→"Profile" (serif), amber avatar, brown menu
  icons, offer-red logout.
- **Find** (`FindScreen`) — cream/brown, soft pill search.
- **Saved** (`SavedScreen`) — **was the last DARK-theme follower screen** → cream.
- **OfferCard** — legacy navy/teal/orange palette → creatorVibe (mode CTAs → brown;
  used by Saved).
- **Transaction screens** (`PayAtStore`, `PreBook`, `OnlineOrder`, `OrderCart`,
  `Enquiry`) — warm ink header + ink CTA with amber text on cream. **Payment/
  booking/order logic byte-identical.**

### 52.D — full coherence pass (founder asked to finish the whole app, 2026-06-01)
Themed the remaining surfaces so the ENTIRE follower app is one palette:
- Dining sub-app: `DiningHome/Browse/Search`, `RestaurantDetail/Bill/Booking/Cart`,
  `BookingConfirmed`, `MealsChat` + the restaurant component lib (`CreatorChip`,
  `FilterChip`, `FilterSheet`, `OfferPill`, `RestaurantCard`, `SagarStrip`,
  `TimeSlot`).
- Car flow: `CarDetail`, `CarBooking`, `CarRentalCard`.
- Profile journey: `Address`, `FollowedInfluencers`, `OrderDetail`, `OrderHistory`,
  `FollowerWallet`, `MyReturns`, `Lookbook*`, `SlotPicker`, `SchemaDetail`,
  `FollowerLogin` (last dark-theme screen → cream).

## Intentionally NOT recolored
`VegDot` + `StatusPill` stay on `brandPalette` — their green/red are semantic
food-safety / open-status indicators (veg=green, open=green) that must not shift
to the theme's blue. Verified by sweep: these are the only two follower files left
on the prior palette.

## Verification
- Babel transform: PASS on every touched file (Mobile metro preset).
- Integrity greps: 0 orphaned old-palette imports on in-scope files; all API /
  `availing_modes` dispatch / tracking / discount-math / nav markers preserved.
- `pnpm qa`: GREEN 76/76, gate 0 (web regression-free).
- Pending: Maestro mobile E2E on device/emulator (`pnpm qa:maestro`) + founder
  physical-APK smoke before release.
