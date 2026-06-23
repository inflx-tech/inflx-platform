# Follower App — Master Map (2026-06-23)

Complete read-only audit of every follower screen (`Packages/Mobile/src/screens/follower` +
`SplashScreen` + shared components), run as 8 parallel auditors. This is the single
source of truth for the follower redesign: what exists, its state, what's dead.
Pairs with the deeper food-specific punch list in `FOOD_JOURNEY_AUDIT.md`.

## Headline
- **44 follower screens total.** 9 already NEW (toing) · 2 MIXED · ~26 OLD (creatorVibe) ·
  **7 DEAD/orphaned (delete, don't reskin)** · 1 NEITHER (Splash, hardcoded gold).
- **The app is far smaller than 44 screens of work.** Fashion / furniture / beauty
  share ONE storefront (`BrandStoreScreen`) + ONE product page (`ProductDetailScreen`).
  The order journey is shared across all verticals. Only restaurants and cars have
  bespoke screens. **The reskin collapses to ~7 work-packages.**

## The 7 work-packages (this is the real plan shape)
1. **Storefronts** — RestaurantDetailScreen (food, MIXED) · BrandStoreScreen (fashion/
   furniture/beauty, OLD) · CarDetail + CarBooking (cars, OLD).
2. **Product detail** — ProductDetailScreen (shared by all non-car verticals, OLD/MIXED, large).
3. **Order journey** — OnlineOrder · OrderConfirmation · OrderHistory · OrderDetail (OLD, shared).
4. **Action tails** — PreBook/RestaurantBooking · PayAtStore/RestaurantBill · Enquiry · MealsChat (OLD).
5. **Offers + Saved** — DealsScreen · SavedScreen (OLD).
6. **Profile cluster** — MeScreen · FollowerWallet · FollowedInfluencers · MyReturns (OLD).
7. **Chrome + entry** — FollowerNavigator · Find · DiningSearch · SectionResults · SectionRenderer
   chrome · FollowerLogin · Splash (OLD/MIXED).

## Theme inventory (by real token import)

**NEW — toing (9, done):** HomeScreen · DishGroupResultScreen · CartScreen · AddressScreen ·
AddressDetailsScreen · LocationSearchScreen · LocationEntryScreen* · MapPinScreen.
(+ components: FoodDishCard, RestaurantSection, RestaurantResultCard, TileSection,
DishDetailSheet, CustomiseSheet, CravingRail, CategoryRail.)

**MIXED (2):** RestaurantDetailScreen (Menu tab toing, shell creatorVibe — ~85% old) ·
FollowerLoginScreen (hardcoded dark navy + dead creatorVibe shim).

**OLD — creatorVibe (~26):** FindScreen · CategoryListScreen · DealsScreen · SavedScreen ·
MeScreen · OrderHistoryScreen · OrderConfirmationScreen · OnlineOrderScreen · OrderDetailScreen ·
ProductDetailScreen · BrandStoreScreen · InfluencerStoreScreen · CreatorCategoryScreen ·
SectionResultsScreen · FollowedInfluencersScreen · EnquiryScreen · PayAtStoreScreen ·
PreBookScreen · RestaurantBillScreen · RestaurantBookingScreen · BookingConfirmedScreen ·
CarDetailScreen · CarBookingScreen · MealsChatScreen · FollowerWalletScreen · MyReturnsScreen ·
ReelsScreen · DiningSearchScreen + the vibe component kit (Shelf*, DealCard, FeatureCard,
SagarStrip) + SectionRenderer's own chrome.

**NEITHER:** SplashScreen (hardcoded `#F5A623` gold, brand/influencer tagline).

## DEAD / ORPHANED — delete, don't reskin (7)
- **OrderCartScreen** — `navigate('OrderCart')` from BrandStore:120 + RestaurantDetail:158, but
  **NOT registered** → broken CTA (the live cart is `CartScreen`/`Cart`).
- **RestaurantCartScreen** — registered but nothing navigates to it (dead duplicate cart).
- **SchemaDetailScreen** — orphaned; CTA targets unregistered `'__action_dispatch'`.
- **SalonDetailScreen** — 10-line re-export of SchemaDetail; never registered/navigated.
- **SlotPickerScreen** — salon slot booking; not registered, not delegated. (Salon booking path
  is entirely dead — salon today = BrandStore grid + ProductDetail verbs only.)
- **LookbookDetailScreen** — registered but unreachable (LookbookCard imported nowhere).
- **LocationEntryScreen** — toing but orphaned (superseded by direct LocationSearch). Keep file,
  it's new; just unused.

## Functional landmines (fix regardless of theme — these are NOT cosmetic)
1. **MOCK PAYMENTS hardcoded** — PreBookScreen, RestaurantBookingScreen, RestaurantBillScreen use
   `pay_mock_…` / `mockPayment`, NOT real Razorpay. **Table-booking and restaurant bill-pay do
   not take real money today.** (SlotPicker + PayAtStore + CarBooking + OnlineOrder use real
   `processPayment`.) Inconsistent + a real revenue gap.
2. **VEG-MARK BUG** — unmarked dishes (`veg_flag='na'`, the DB default) render RED non-veg.
   Locations: FoodDishCard:36 · RestaurantDetailScreen:543 · DishDetailSheet:38 ·
   CustomiseSheet:198 · components/restaurant/VegDot.js:20. (See FOOD_JOURNEY_AUDIT.md.)
3. **OrderCart broken route** (above) — the brand/restaurant "order online" CTA can't navigate.
4. **CarBooking date mismatch** — UI shows hardcoded "Apr 10"/"Apr 10+n" but books from tomorrow
   (CarBookingScreen:174,180 vs 66–69). Needs a real date picker.
5. **FollowerWallet is phantom** — no follower-wallet schema; always ₹0; "Browse partners" button
   has no onPress.
6. **Login leaks + hardcodes** — test-OTP hint "use: 000000" visible in prod UI
   (FollowerLoginScreen:198); hardcoded `city:'Vijayawada', state:'AP'` on register (:112).
7. **MealsChat fakes "current location"** — hardcoded Vijayawada coords (172–173,184), never reads GPS.
8. **Dead affordances** — share `↗` (InfluencerStore:170), "Tap to call salon" (SlotPicker:285),
   wallet/empty buttons — visible controls with no handler.
9. **Hardcoded data dressed as real** — car pricing/ratings/specs (CarDetail), restaurant slots
   (RestaurantBooking), "Open till 11 PM" (RestaurantDetail:269), advance ₹200 / token ₹100.

## Recommended sequence
0. **Cleanup pass (cheap, high-relief):** delete the 7 dead screens + the broken OrderCart route +
   the dead shims/affordances. The confusion pile shrinks immediately.
1. **Quick functional fixes:** veg-mark · OrderCart · login OTP-hint/city · CarBooking date.
   (Defer mock-payments → real Razorpay as its own surfaced, money-touching task.)
2. **Food world to 100%** (storefront shell + order journey) — gives a complete "done" reference.
3. Roll the same toing reskin across the **shared** screens (BrandStore, ProductDetail, order
   journey) — finishing food finishes most of fashion/furniture/beauty for free.
4. Cars (CarDetail/CarBooking) · Offers · Profile cluster · Chrome+Login last.

Each package: vision-locked → whole-screen reskin → test → ship → delete its old code.
