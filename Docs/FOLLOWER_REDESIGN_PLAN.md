# INFLX Follower-App Redesign — Master Plan (v1 · 2026-05-27)

> Durable plan for the **mobile-follower bucket** redesign. The 4th and final
> mobile bucket. Survives window rollovers — read this first when resuming
> follower work. Authored after a full read-only architecture audit + founder
> vision lock.

---

## 0 · THE VISION (founder, locked 2026-05-27)

The follower app is a **creator-vibe shopping + services marketplace** — the
public buys products and avails services that influencers promote through
brand campaigns. Think **Amazon/Flipkart (products) + Luzo (beauty/services)
fused with a creator marketplace** where the influencer attribution is the
soul of every screen.

- **30+ businesses exist; we focus on 4 NOW**: `restaurant`, `fashion`,
  `beauty (salon)`, `car_rental`. The other 26 are deferred (render via the
  generic schema engine until they get bespoke treatment).
- **Creator/influencer vibe is the MAIN THEME** — "X's deal" attribution,
  story rows, creator endorsement chips everywhere.
- Colors / fonts / text style **resemble the brand + influencer palette**
  (`brandPalette` + Outfit / Plus Jakarta Sans / JetBrains Mono).

## 1 · THREE FOUNDATION DECISIONS (locked 2026-05-27 via AskUserQuestion)

1. **Visual identity → FLIP to light brandPalette.** All follower screens
   adopt white + yellow `#FFC107` + ink + Outfit/PJS/Mono, unifying all 3
   INFLX apps (brand / influencer / follower) into ONE design language. The
   creator vibe comes from **layout + influencer attribution**, NOT a dark
   theme. (Retires the Wave-3 dark "Pinterest" theme + the Wave-4 lightColors
   `#EAB308` yellow — both converge on `brandPalette`.)
2. **Detail screens → hand-built for the 4 focus verticals, schema engine for
   the deferred 26.** Restaurant/fashion/beauty/car get bespoke high-quality
   screens (menu/booking, size/color variants, slot-picking, specs/pricing).
   `SchemaDetailScreen` stays alive as the fallback engine for deferred
   businesses.
3. **Home → one unified marketplace home + dining sub-home.** `HomeScreenV2`
   (restyled) mixes products + services across all verticals Amazon-style;
   `DiningHomeScreen` stays as the "eat" sub-home (restaurants browse by
   vibe/cuisine).

---

## 2 · ARCHITECTURE REALITY (verified by code audit)

### Routing spine
- `HomeScreenV2` → `CategoryGrid` routes by `cat.key`: `all`→Find, `eat`→
  DiningHome, else→CategoryList.
- `CategoryListScreen` splits by **user mental model** (keep this — it's good):
  - DINING (restaurant/bakery) → restaurant cards → BrandStore (menu inside)
  - SHOPPING (fashion/florist/packaged_food) → 2-col product grid → ProductDetail
  - BOOKING (salon/car_rental/function_hall) → grid → CarDetail / SlotPicker

### Two detail strategies coexist
- **Schema engine** — `SchemaDetailScreen` (379 LOC) renders any business from
  `template.card_config.detail_sections` (description / spec_grid /
  feature_chips / gallery / variant_selector / return_policy). CTA via
  `__action_dispatch` route. **Half-wired foundation** — `__action_dispatch`
  target isn't registered. Templates come from backend/CDN, not a local dir.
- **Hand-built** — Wave 4 dining (`RestaurantDetailScreen` 1,106 LOC + 7 more)
  + car (`CarDetail`/`CarBooking`). Higher per-vertical quality.

### Tracking spine (NON-NEGOTIABLE — preserve verbatim everywhere)
`buildTracking` / `buildTrackingFromOffer` propagate the 4-ID attribution
(cid/sid/oid/iid) through every navigation so follower transactions credit
the correct influencer. This is the commission-attribution backbone.

### SDK boundaries (all already shipping — no native rebuild needed)
- `react-native-razorpay@2.3.1` — 9 payment screens (Car/PayAtStore/PreBook/
  Restaurant flows)
- `react-native-vector-icons/MaterialCommunityIcons` — baked in (NATIVE_RUNTIME=2)
- ZERO image-picker / ZERO webview / ZERO maps in follower.

### Three visual systems live today (all → converge on brandPalette)
| System | Look | Count |
|---|---|---|
| darkColors (Wave 3) | ink-black + amber | 13 |
| lightColors (Wave 4) | paper + `#EAB308` | 11 |
| legacy colors (Wave 1) | navy + orange | 12 |

### Creator-vibe DNA already present
`InfluencerStoryRow` (home) · "X's deal" attribution strips · creator
endorsement chips · `businessAccents` per-business accent map · 4-ID tracking.

---

## 3 · SCREEN TAXONOMY (39 files; 34 wired; ~12,564 LOC)

### TIER 1 · COMMON SPINE (business-agnostic, 13)
FollowerLogin · HomeScreenV2 · Find · CategoryList · BrandStore ·
InfluencerStore ⭐ · Saved · FollowerWallet · Me · Address ·
FollowedInfluencers · Deals · OrderHistory

### TIER 2 · SHARED CTA / CHECKOUT (business-agnostic, 9)
OrderCart · PayAtStore · PreBook · OnlineOrder · SlotPicker · Enquiry ·
OrderDetail · MyReturns · BookingConfirmed

### TIER 3 · BUSINESS-SPECIFIC (4 focus verticals, 13)
- 🍽️ Restaurant (8): DiningHome · DiningBrowse · DiningSearch · RestaurantDetail
  · RestaurantCart · RestaurantBooking · RestaurantBill · MealsChat
- 👗 Fashion (2): ProductDetail · LookbookDetail
- 💇 Beauty/Salon (1 + engine): SalonDetail→SchemaDetail (+ SlotPicker shared)
- 🚗 Car rental (2): CarDetail · CarBooking

### TIER 4 · SCHEMA ENGINE (foundation for 26 deferred, keep)
SchemaDetailScreen + shared components

### 🗑️ DEAD CODE (retire — ~600 LOC, unwired in FollowerNavigator)
HomeScreen (→HomeScreenV2) · FollowerProfileScreen (→MeScreen) · FeedScreen ·
StoreScreen. SalonDetailScreen = 10-line re-export shim of SchemaDetail (keep).

---

## 4 · SHARED COMPONENT CASCADE (restyle FIRST — these atoms touch dozens of screens)

Located in `Packages/Mobile/src/components/`:
- `cards/ProductCard.js` · `cards/ServiceCard.js` · `cards/NewOfferCard.js`
- `CategoryGrid.js` · `InfluencerStoryRow.js` · `OfferCard.js` · `Avatar.js` ·
  `LocationHeader.js` · `CategoryPills.js`
- `restaurant/{RestaurantCard, CreatorChip, FilterChip, FilterSheet, OfferPill,
  SagarStrip, StatusPill, TimeSlot, VegDot}`
- TWO StatusPills: `components/brand/StatusPill.js` (canonical 43-entry map, used
  by brand+influencer) vs `components/restaurant/StatusPill.js` (lightColors,
  restaurant-specific). **Decide: migrate restaurant screens to the canonical
  brand StatusPill, or keep the restaurant one re-themed to brandPalette.**

Restyling these atoms cascades brandPalette into many screens before
per-screen work begins.

---

## 5 · PHASED PLAN (continue global flow numbering 38+)

Same locked 5-step rhythm per flow: **pick → HTML mockup lock → terse impact
verdict → implement → OTA × 3 + close-out**. Dual-probe pre-warm before every
`pnpm qa`. GOVERNANCE_OVERRIDE on release-flip (Maestro 4/4 baseline applies).

### Phase F0 · Foundation + design language *(DO FIRST — cascades)*
- **Flow 38**: Master design-language mockup (home + a store + a detail + a CTA
  in creator-vibe-light brandPalette) → lock the look. Restyle the shared
  component library (Tier-4 atoms above). Retire dead code (~600 LOC).
  *This flow establishes the visual contract for all 16 flows that follow.*

### Phase F1 · Common spine
- **Flow 39**: HomeScreenV2 + FindScreen (unified marketplace home + search)
- **Flow 40**: CategoryListScreen + DealsScreen (browse surfaces)
- **Flow 41**: BrandStoreScreen + InfluencerStoreScreen (storefronts — creator centerpiece)

### Phase F2 · Account + wallet
- **Flow 42**: MeScreen + FollowerWalletScreen
- **Flow 43**: SavedScreen + FollowedInfluencersScreen + AddressScreen
- **Flow 44**: OrderHistoryScreen + OrderDetailScreen

### Phase F3 · Shared CTA / checkout flows
- **Flow 45**: OrderCartScreen + OnlineOrderScreen
- **Flow 46**: PayAtStoreScreen + PreBookScreen
- **Flow 47**: SlotPickerScreen + EnquiryScreen + BookingConfirmedScreen
- **Flow 48**: MyReturnsScreen (+ tail)

### Phase F4 · Restaurant vertical (already lightColors — lowest lift)
- **Flow 49**: DiningHome + DiningBrowse + DiningSearch
- **Flow 50**: RestaurantDetail (1,106 LOC — solo)
- **Flow 51**: RestaurantCart + RestaurantBooking + RestaurantBill + MealsChat

### Phase F5 · Fashion + beauty + car verticals
- **Flow 52**: ProductDetail + LookbookDetail (fashion)
- **Flow 53**: SchemaDetailScreen + SalonDetail (beauty + the 26-business engine)
- **Flow 54**: CarDetail + CarBooking

**~17 flows (38–54).** At ~3–4 flows/session ≈ 4–5 sessions. After Flow 54 →
follower bucket COMPLETE → all 3 mobile apps unified on brandPalette.

---

## 6 · KEY RULES CARRIED FROM BRAND+INFLUENCER BUCKETS

- brandPalette tokens + Outfit (`displayBold`/`displayBlack`) + Plus Jakarta
  Sans (`sans*`) + JetBrains Mono (`mono*` for all digits/IDs/amounts/handles).
- StatusPill canonical map (43 entries) — reuse; add follower statuses only if
  genuinely new (order/booking states may need additions — verify first).
- MCI icons over emoji for ACTION icons; KEEP type/category emoji (per the
  CATEGORY_EMOJI / DELIVERABLE_ICONS precedent).
- Preserve every render branch, every API call, the 4-ID tracking spine, all
  Razorpay flows byte-for-byte.
- 7 contract artifacts per flow. Dual-probe pre-warm. OTA × 3. Close-out commit.
- NO native rebuild (everything ships via OTA — NATIVE_RUNTIME=2).

## 7 · OPEN ITEMS TO RESOLVE DURING F0

1. **`__action_dispatch` half-wired route** — confirm whether SchemaDetail's CTA
   is dead or intercepted; fix or document during F0.
2. **OrderCart / SchemaDetail / SlotPicker** navigated-to but not explicitly in
   FollowerNavigator `Stack.Screen` list — verify registration (possible nav bug).
3. **Two StatusPill components** — pick one canonical path for follower.
4. **Tab bar** currently dark (`darkColors.card`) — restyle to brandPalette in F0.
5. **Razorpay paise boundary** — confirm `*100` only at the SDK call (money is
   rupees everywhere else per migration 021).

---

## 8 · CURRENT STATE AT PLAN AUTHORING

- Mobile-brand bucket: COMPLETE (16/16).
- Mobile-influencer bucket: COMPLETE (Flows 28–37, 23/23). HEAD region ~`9d165d4`+.
- OTA versions after influencer bucket: brand v85+ / influencer v74+ / follower v48+.
- Follower bucket: NOT STARTED — this plan is the entry point.

**Next action**: build the Flow 38 (Phase F0) master design-language mockup,
lock it, then cascade.
