# Admin Section Engine — locked model + audit + cleanup plan (2026-06-23)

## The locked model (founder, FINAL)
Everything in the follower app is a **Section**. A Section = a **Template** (how
it looks) + a **Rule** (who/what fills it). Admin places Sections into a
**Scope + World**. **Rules are context-aware** — a Rule reads *where it sits*
(scope, world, business, viewer) so the SAME Section shows different content in
different places, automatically. A creator carousel is just one Section with one
Rule, like any other; all Rules live in the Section Library, reusable.

**Three scopes:** Home (world switcher; each vertical its own world/page) ·
Creator Store (per-creator, same worlds, only their promoted products) ·
Business page (one business's own goods, per-vertical design).

**Admin journey:** pick Scope → pick World → add Sections in order → for each
pick a Template + a Rule → Publish. App renders that stack; each section fills
itself live by rule + context.

## Audit verdict (8-agent read-only): engine ~60% there, wrapped in confusion + 2 unbuilt scopes
### Confirmed blocking BUG
- `validateShelf` allow-list `SHELF_TYPES` (adminSections.controller.js:21) =
  `creators/nav_tiles/offers/products/brands/mixed/controls`. But the admin
  presets emit `tiles`, `category_rail`, `restaurant_list` (sections/page.js:46–55).
  → Publishing a Category-rail / Image-tiles / Restaurant-list section is
  **REJECTED** ("bad shelf_type"). This is why only "Food under 400" (a valid
  `products`/library section) + the hardcoded craving rail ever appeared, and the
  category rail + Type-B restaurant cards never showed despite being "shipped."
  Fix: widen SHELF_TYPES. One line.

### Confusions / redundancy
- "Scope" overloaded: `screen` tab (Category/Offers/Creator) vs `scope_type`
  selector (Global/City/Vertical). Founder's Home/Creator/Business = the `screen`
  axis; the world = `scope_type=vertical`. Double-selection, mislabeled.
- Two screen-config systems: Home Builder (follower_categories + craving tiles)
  vs App Sections (section_config). Home is NOT arrangeable in App Sections
  (hardcoded). Account icon / search not modeled as sections.
- `home` screen scope key still writable but inert (footgun).
- Collections (collection_library, mig 104, collection-library page, `collection`
  rule/preset) = dead duplicate of Section Library, 0 live placements,
  migration self-labels "dormant."
- `top_by_sales` rule = hardcoded `return []` (sectionRules.service.js:1052) yet
  `RULE_FOR_TYPE.products='top_by_sales'` (sections/page.js:35) → setting a shelf
  to "products" renders empty.
- Redundant rule pairs: offer-gated (`stories`, `creators_in_category`) vs
  listing twins (`creators_listing`, `creators_in_category_listing`); offer ones
  usually empty (campaign_offers unmaterialized).
- Legacy follower-categories admin page duplicates Home Builder (same table).

### Genuine GAPS (not built)
- **Business-page scope does not exist.** DB CHECK allows only home/category/
  offers/creator_store/creator_category (083_section_config.sql:30). Restaurant
  page = hardcoded RestaurantDetailScreen + resolveBrandStore. No admin
  composition, no per-vertical business-page template.
- **Creator Store sections built but UNWIRED.** creator_store/creator_category
  scopes + correct "promoted = live-allocated" filter exist in backend, but
  getCreatorSections has NO mobile consumer; the live InfluencerStoreScreen uses
  the older offers-flattening resolver (getStore/resolveStore).
- **Smart creator-carousel rule absent.** Current creator rules are generic
  lists: location = weak sort (ignored by category rules), followed-by missing
  from world rules, famous/active = loose proxies (followers_count, has-offer),
  no priority ordering, and no brand-scoped (business-page) creator rule.

## Cleanup + build plan (phased — see chat for discussion points)
- **P1 CLEAN (safe, mostly deletion):** fix SHELF_TYPES bug · hide/remove
  Collections · kill top_by_sales + fix products default · retire legacy
  follower-categories page · prune redundant offer-gated creator rules · remove
  inert `home` scope.
- **P2 UNIFY admin language:** 3 scopes (Home/Creator/Business) → World →
  Sections; one Template+Rule picker; resolve Home Builder boundary (DISCUSS).
- **P3 CONTEXT-AWARE ENGINE:** standard context to every rule (scope, world,
  brand, creator, viewer location + follows).
- **P4 SMART CREATOR RULE:** one Library rule (promote+location+famous+active+
  followed; collab-for-business). Data defs to DISCUSS.
- **P5 BUILD MISSING SCOPES:** wire Creator Store to sections · Business-page
  composition (hybrid vs full — DISCUSS).

### Open data questions for the creator rule
- "near viewer" for a creator = via the brand they promote (we have brand
  location), since creators have no own geo. Confirm.
- "active" signal = ? (recent collab / recent content / has live allocation).
- "famous" = followers_count (have it, scraped). "followed" = follower→influencer
  follows (have it). "promotes food" = has food allocation/picks (have it).
