# Flow 38 (F0) — Follower Foundation + Design Language · Spec

**Bucket**: mobile-follower redesign (Wave 3) — 1st flow, foundation phase
**Owner**: founder
**Locked**: 2026-05-27

---

## 1 · Problem

The follower app runs 3 coexisting visual systems (darkColors Wave-3, lightColors
Wave-4, legacy colors Wave-1) and does not resemble the unified brandPalette
shipped across the brand + influencer apps (Flows 18–37). The founder's locked
vision: a **creator-vibe shopping + services marketplace** on the **light
brandPalette** (white + yellow #FFC107 + ink + Outfit/Plus Jakarta Sans/
JetBrains Mono), unifying all 3 INFLX apps into one design language.

This is the **foundation flow** — it sets the visual contract for the 16
follower flows that follow (F1–F5). Per the cascade strategy, the shared
component atoms are restyled FIRST (they cascade brandPalette into ~30 screens),
plus the flagship Home + tab bar, plus dead-code retirement.

## 2 · Goal

1. Establish the creator-vibe-light design language (locked via master mockup).
2. Restyle the home-cluster shared atoms to brandPalette so subsequent flows
   inherit them.
3. Restyle the flagship `HomeScreenV2` + tab bar so the entry surface is fully
   coherent immediately.
4. Add the light per-business accent token foundation (`getBusinessAccentLight`).
5. Retire ~600 LOC of confirmed dead code.

## 3 · Scope

### In-scope (this flow)
- `theme/tokens.js` — ADD `businessAccentsLight` + `getBusinessAccentLight()` (additive; `darkColors`/`businessAccents` untouched)
- `components/cards/ProductCard.js` — light restyle (core card atom)
- `components/cards/ServiceCard.js` — light restyle
- `components/cards/NewOfferCard.js` — ink+yellow banner restyle
- `components/CategoryGrid.js` — light per-business pale tiles
- `components/InfluencerStoryRow.js` — yellow rings + ink/yellow avatars
- `screens/follower/HomeScreenV2.js` — flip to light brandPalette (flagship)
- `navigation/FollowerNavigator.js` — light tab bar + MCI icons + yellow active
- DELETE: `screens/follower/{HomeScreen, FollowerProfileScreen, FeedScreen, StoreScreen}.js` (~600 LOC dead code)

### Out-of-scope (deferred to later phases)
- Other ProductCard host screens (CategoryList/Deals/Saved/BrandStore) → F1 (immediate next; brief light-card-on-dark intermediate accepted)
- Restaurant atoms (`restaurant/RestaurantCard`, `restaurant/StatusPill`, chips), `SchemaCard`, `CarRentalCard`, `LookbookCard`, `OfferCard` → restyled with their host screens in F4/F5
- All per-screen redesigns (F1–F5)
- Navigation-registration gaps (see §6 open items) → F3/F4
- Schema engine, Razorpay flows, backend — untouched

## 4 · Data / dependencies

- ZERO API change. ZERO backend change.
- ZERO new SDK (MCI icons already baked in via NATIVE_RUNTIME=2 from Flow 28).
- Atoms keep IDENTICAL prop APIs → all existing consumers stay compatible.
- 4-ID tracking spine (buildTracking) untouched.

## 5 · Risk surface

- **LOW-MEDIUM** — pure visual restyle of shared atoms + flagship + tab + dead-code.
- **Cascade intermediate state**: ProductCard/ServiceCard now light; their non-Home
  hosts (CategoryList/Deals/Saved/BrandStore) stay dark until F1 → light cards on
  dark bg for those screens until next flow. Accepted (F1 is immediate next; founder
  smoke-tests APK before real-user impact).
- **Dead-code deletion**: verified-twice all 4 files unreferenced (only self-refs;
  no tests; the lone `HomeScreen` import is the *influencer* HomeScreen, different file).
- **getBusinessAccentLight additive**: `darkColors` + `businessAccents` retained for
  not-yet-migrated follower screens → zero break on dark screens.

## 6 · Open items resolved/documented in this flow

1. **Nav-registration gap (documented, NOT fixed)**: `RestaurantDetail`, `OrderCart`,
   `SlotPicker`, `SchemaDetail`, `RestaurantBill`, `RestaurantBooking` are navigated-to
   but not found as `component={...}` registrations in FollowerNavigator. Pre-existing;
   belongs to F3 (CTA) / F4 (restaurant) where these screens are redesigned + wired.
   F0 does NOT touch navigation routing.
2. **Two StatusPills**: `components/brand/StatusPill` (canonical 43-map) vs
   `components/restaurant/StatusPill` (lightColors). Resolution deferred to F4 (restaurant)
   — restaurant screens will migrate to the canonical pill or the restaurant pill gets
   re-themed. F0 touches neither.
3. **Razorpay paise boundary** — confirmed handled at the SDK call only (CarBooking etc.),
   money is rupees everywhere else. No F0 change.

## 7 · Success criteria

1. Master mockup locked (4 surfaces + design-spec panels).
2. Home-cluster atoms + HomeScreenV2 + tab bar render on light brandPalette.
3. `getBusinessAccentLight` added; `darkColors` retained (additive).
4. 4 dead screens deleted; zero broken imports.
5. Atoms keep identical prop APIs (no consumer break).
6. Web `pnpm qa` 76/76 GREEN gate 0.
7. OTA brand v86 / influencer v75 / follower v49.
8. `06-diff/notes.md` non-empty.
