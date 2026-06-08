# Follower App — Agreed (mockups) vs Built — Diff + Implementation Plan

> Authored 2026-06-08. Compares the locked Creator-Vibe HTML mockups
> (`design/wave4-creator-vibe/*-comprehensive.html`) against the built RN
> follower app (`Packages/Mobile/src/screens/follower/*`). Screen by screen.

## Big picture
- **Agreed:** one unified design — every discovery screen is a vertical stack of
  **admin-controlled shelves** (section engine) with **rich, branded cards**
  (creator via-lines, trust lines, gradient deal cards, ranked "#1" badges);
  detail screens are **admin-templated, schema-driven** (block order = platform,
  content = brand listing); a rich **5-type activity inbox**; a fuller Profile.
- **Built:** 5 discovery screens are **section-engine-gated with bespoke
  fallbacks** — the section-engine path renders **generic rails** (simpler than
  the mockups), while the bespoke fallbacks are sometimes **richer** than the
  engine. Detail screens (Business Page, Product Detail) are **bespoke per
  vertical**, not the generalized template. Orders + Profile are **simpler** than
  agreed. Bottom nav + Reels-deferred **match**.
- **Net:** structure is largely right on discovery; the gaps are (a) **card
  richness** in the engine path, (b) **data coverage** (offers empty, sub-cats
  empty, only Eat/Fashion zones), (c) **detail screens not generalized/templated**,
  (d) **Orders/Profile under-built** vs the mockups.

## Screen-by-screen diff

### 1. Home
- **Agreed:** location bar · greeting · search · Stories · Browse-by-Category (7)
  · What's-Hot-in-{city} (offers) · Top-Picks-This-Week · per-vertical zones
  (Top {Cat} Brands / Products / Offers) · Deals-Ending-Soon. Rich rails + deal cards.
- **Built:** `HomeScreenV2` section-engine (now listing-driven for Top-Eats +
  Trending-Dishes) + bespoke fallback. Shelf structure matches (stories, browse,
  what's-hot, top-picks, top-in brands/products/offers, deals-ending-soon).
- **Gap:** many shelves still offer-gated/empty (what's-hot, top-picks, deals);
  only **Eat + Fashion** zones configured (no Groom/Travel/Home/Events); cards are
  generic rails, not the gradient deal cards. **Status: STRUCTURE ✓, DATA/COVERAGE PARTIAL.**

### 2. Category (e.g. Eat)
- **Agreed:** header · **sticky sub-category chips** (Restaurants/Cafes/Street
  Food/Bakery) · Top {Cat} Creators · Popular {Businesses} · Trending {Items} ·
  Best {Cat} Deals · divider · filter/sort bar · **All {Businesses} full list**.
- **Built:** `CategoryListScreen` section-engine (now listing-driven): subcat_chips
  (empty) · top_creators (listing) · popular_businesses (listing) · trending_items
  (listing) · best_deals (offers) · filter_bar · all_businesses (rail).
- **Gap:** **sub-cat chips have no data** (need sub-type taxonomy); "All Businesses"
  renders as a rail not a full-width list; best-deals empty (offers). **Status: CLOSE — sub-cat data + list layout.**

### 3. Offers
- **Agreed:** header · sticky category chips · sort bar · **Today's-Best-Deal hero**
  (auto/pinned) · per-category offer rails · 3 modes (All / category-grid / By-Creator).
- **Built:** `DealsScreen` section-engine OR bespoke 4-tab + 2-col grid; hero exists.
- **Gap:** **offers are empty** (campaign_offers mismatch — separate fix); **By-Creator
  grouping not built**. **Status: BLOCKED on offer-source fix.**

### 4. Creator Store
- **Agreed:** profile (avatar, name, role, 3 counters, Follow/Message, bio) ·
  **My-Store-Collabs (brands)** · category tabs · **What-{Creator}-Promotes (products)**
  · **Top-Picks-by-{Creator} (ranked #1/#2)** · Reels (deferred).
- **Built:** `InfluencerStoreScreen` section-engine + bespoke hero + browse-by-category
  grid + hot-picks list.
- **Gap:** no **Collabs (brand partners) rail**; hot-picks not split into
  Promotes + ranked Top-Picks; engine rules (creator_promotes/top_picks) are
  offer-gated → empty. (Message intentionally dropped — design = Follow+Share, no DM.)
  **Status: PARTIAL — needs listing-driven creator picks + collabs + ranking.**

### 5. Creator's Category
- **Agreed:** header · sub-cat sticky bar · Partner {Businesses} · {Creator}'s Picks
  (2-col grid) · {Creator}'s Top (ranked rail).
- **Built:** `CreatorCategoryScreen` section-engine + bespoke partner-scroll + picks-grid.
- **Gap:** ranked "Top" rail; sub-cat data; engine path offer-gated. **Status: CLOSE.**

### 6. Business Page  ← biggest architectural gap
- **Agreed:** ONE **admin-templated** page; block order = platform, content = brand
  listing; **layout auto by category** (restaurant = photo-hero + Overview/Menu/
  Reviews/Photos tabs; others = standard); **trust line** (creators × business);
  **creator-picks callout** (if via creator); **sticky CTA from availing_modes**.
- **Built:** **bespoke per vertical** — `RestaurantDetailScreen` (rich, hardcoded
  dining: hero carousel, tabs Overview/Menu/Offers/Reviews/Photos, "Sagar's Table"
  trust strip, sticky CTA), `SalonDetailScreen` (schema card_config), `CarDetailScreen`
  (hardcoded), `BrandStoreScreen` (legacy). **Not** one generalized admin-templated block model.
- **Gap:** restaurant screen ~**80% matches** the mockup already (Reviews =
  placeholder); but it's **not the generalized template** and **block order isn't
  admin-controlled**. Other verticals are separate bespoke screens. **Status:
  restaurant CLOSE; generalization = the Phase-D build.**

### 7. Product Detail
- **Agreed:** hero · title+meta · price+savings · **creator endorsement box** ·
  **conditional Customize (add-ons) / Select-Size (variants)** · Details ·
  More-from-{brand} · sticky CTA (price + availing-mode) · Reels/code deferred.
- **Built:** `ProductDetailScreen` bespoke — hero · title+brand · creator note ·
  MRP+discount · badge · description · CTA stack (availing_modes) · More-from-brand.
- **Gap:** **no Customize / variants / size block** (the agreed conditional block);
  matches the earlier dish-detail finding (no veg/spice/portion/variants). **Status:
  CLOSE — add the conditional customize/variants block.**

### 8. Orders (activity inbox)
- **Agreed:** unified inbox, **5 transaction types** (Order/Booking/Pay-at-store/
  Enquiry/Return) with **rich cards** (progress tracker, QR for bookings, status
  pills, via @creator), **type tabs** (Active/Orders/Bookings/Visits/Enquiries/
  Returns/History), month-grouped history.
- **Built:** `OrderHistoryScreen` bespoke — simple unified FlatList (brand, id,
  status, type, amount, date) → OrderDetail; Returns is a separate screen.
- **Gap:** **big** — no progress tracker, no QR, no type tabs, no rich per-type
  cards, no month grouping, enquiries/returns not integrated into the inbox.
  **Status: UNDER-BUILT vs agreed.**

### 9. Profile
- **Agreed:** profile card (avatar, name, masked phone, location, edit) · **stats
  row** (Orders/Following/Saved) · **Wallet card** (gradient, balance) · **Refer &
  Earn banner** · menu (Orders/Following/Saved/Addresses/Returns/Settings&Help) · Log Out.
- **Built:** `MeScreen` bespoke — profile card (avatar, name, phone, city) · 5-item
  menu (Wallet/Orders/Addresses/Following/Saved) · Log Out.
- **Gap:** missing **stats row**, **inline Wallet card**, **Refer & Earn**, Returns +
  Settings&Help menu items, edit pencil. **Status: UNDER-BUILT vs agreed.**

### Bottom nav + Reels
- **Match:** 5-tab Home/Offers/Reels(FAB)/Orders/Profile ✓. Reels = placeholder,
  agreed deferred to 52.8 ✓.

## Cross-cutting gaps (apply to multiple screens)
1. **Card richness** — the SectionRenderer renders generic rails; the mockups have
   gradient deal cards, creator via-lines, trust lines, ranked "#1" badges.
2. **Offer-source mismatch** — `campaign_offers` empty even when an offer is
   configured at set level → every offer shelf/badge empty. Blocks Offers + deals.
3. **Sub-category taxonomy** — sub-cat chips (Restaurants/Cafes/…) have no data
   (needs the drill-down sub-type taxonomy / brand sub-types).
4. **Listing-driven creator path** — creator_promotes / creator_top_picks are
   offer-gated; need listing-driven (picks-based) versions like we did for category.
5. **Detail screens not templated** — Business Page + Product Detail are bespoke
   per vertical, not the agreed admin-templated schema-driven block model.

## Implementation plan (prioritized)
**Phase 1 — Make discovery match (extend what we just built):**
- Extend listing-driven rules to the remaining Home/Creator shelves
  (what's-hot/top-picks → hybrid listing+engagement; creator_promotes/top_picks →
  picks-based) so Home + Creator Store fill without offers.
- Add per-vertical Home zones for the live verticals; wire sub-category chips to
  real sub-types (interim: distinct `section`/sub-type values; full: drill-down taxonomy #2).
- "All Businesses" full-list layout on Category.

**Phase 2 — Offer overlay (unblocks Offers + deals + attribution):**
- Fix the offer-source mismatch (set-level coupon/`campaign_offers`/`brand_offers`
  → one model the shelves read); then Today's-Best-Deal hero, per-category offer
  rails, By-Creator mode, and discount badges light up, and 4-ID attribution flows.

**Phase 3 — Card richness:** upgrade SectionRenderer cards to the mockup styles
  (gradient deal cards, creator via-lines, trust lines, ranked badges).

**Phase 4 — Detail screens templated:** generalize Business Page + Product Detail
  into the admin-templated, schema-driven block model (restaurant already ~80%);
  add the conditional Customize/variants block on Product Detail; wire Reviews.

**Phase 5 — Orders + Profile to spec:** rich 5-type activity inbox (tracker/QR/
  tabs/month-grouping); Profile stats row + Wallet card + Refer&Earn + menu items.

**Phase 6 — Reels (52.8):** last, needs APK + video infra.
