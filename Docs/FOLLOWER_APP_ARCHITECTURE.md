# INFLX Follower App — Complete Architecture (code-grounded)

**Scope (founder-set):** brand listing → publishing → offers → admin composes
follower pages → what a follower sees on each surface + the design system.
*Excludes payments/campaigns/influencer mechanics.* Built from a 2-agent code
read (brand+admin, follower app) cross-checked against source. 2026-07-09.

---

## 0. The one-paragraph model

A **brand lists** products (into a category tree with typed facets, tags, and
cropped photos) and **publishes** them (`pushed_to_store`). The brand **creates
offers** (a reusable library; 5 types; scoped to store/category/products) and
**publishes offers to store**. An **admin composes** every follower screen as an
ordered stack of **sections** (each = one Design + one Content rule + Display
placement + tap Action), placed per **screen × scope (global/city/world)**. At
request time the **section engine** resolves each section live — injecting the
follower's **context** (city, GPS, world, follow graph, creator allocation) — so
the same section shows different content to different followers. The **follower
app** renders that server-driven stack per surface, and every tap routes to a
product, a category browser, a custom page, or a store.

**Five layers:** ① Brand listing → ② Offers → ③ Admin composition → ④ Engine
resolution → ⑤ Follower rendering. Design system sits across ④–⑤.

---

## 1. Layer ① — Brand listing (the catalogue)

### Tables
- **`brand_products`** (`001_initial_schema.sql`; +`010`,`013`,`095`,`099`,`101`,`118`).
  Key columns: `name, price, mrp`(retired for display, dormant), `category_key`
  (business type), `super_category` (roll-up), `section` (legacy shelf tag),
  **`category_node_id`** (FK → drill tree leaf; NULL for flat verticals),
  **`facets`** jsonb (typed leaf values e.g. `{size,color}`, GIN), **`tags`**
  text[] (GIN), **`variants_json`** (per-colour images + sizes + per-size stock +
  SKU), `image_url` (resolved cover), **`pushed_to_store`** (visibility gate),
  `is_active`, `is_featured`, `featured_sort`, `badge`, `veg_flag`, `description`.
- **`category_nodes`** (`095`): the drill tree. `vertical` · `parent_id` ·
  `segment`(depth0) · `category`(depth1) · `name` · `depth` · `is_leaf` (only
  leaves take products) · `size_system`/`variant_axis` (leaf) · **`meta.image_url`**
  (category image, jsonb, no migration). Fashion has 19 categories under
  Men/Women/Kids/Unisex → subcategory leaves.
- **`facet_definitions`** (`095`): per-leaf typed schema (scope ALL/category/leaf;
  `facet_role` variant|descriptive|discovery|media|price; input_type; required;
  allowed_values; show_if conditional).
- **`tag_vocabulary`** (`099`): admin-curated tags per business scope; stores
  add curated-only (contract listing-tags-at-add) world-aware slugs.

### Flow (endpoints)
- Add / batch: `POST /brands/me/products` · `POST /brands/me/products/batch`
  (drill-down wizard: pick leaf → typed facets → colour/size variants → tags →
  cropped photos; auto-SKU `STORE-0001`, per-variant sub-SKUs).
- Edit / browse: `PATCH /brands/me/listing-products/:id` · `GET
  /brands/me/listing-tree` · `/listing-nodes/:id/products`.
- **Publish** = `pushed_to_store` on the product. Every follower-facing query
  gates on `approved brand + is_active + pushed_to_store`.
- **Images** go through the shared **crop-to-frame uploader** (contract
  image-crop-uploader): the brand crops to the surface's exact aspect (products
  = 3:4) → uploaded to R2 → served at `/v1/media/…`. `resolveProductImage`
  derives the cover from `image_url` → variants → facet images.

---

## 2. Layer ② — Offers (the discount engine)

### Table
- **`brand_offers`** (`084`; +`085` store-direct). Columns: `name`, **`offer_type`**
  ∈ discount|volume|bogo|bundle|free_gift, **`offer_config_json`** (shape per type),
  `availing_modes` (pay_at_store|online_order|prebook|enquiry), **`status`**
  (draft|active|archived), **`published_to_store`**, `store_starts_at/ends_at`.

### Config shapes (validator `offerConfig.validator.js`)
- **discount:** `{sub_type: pct|flat, value, scope: store|category|products,
  category?, category_node_id?, products?}` — value type gated by scope
  (store/category → % only).
- **volume:** `{mode: spend|quantity, tiers:[{min_spend|min_qty, pct_off}], scope,
  category_node_id?, products?}`.
- **bogo:** new same-product `{product,buy_qty,free_qty}` OR legacy
  `{buy_product,get_product}`.
- **bundle:** `{products:[≥2], bundle_price}`. **free_gift:** `{offers:[{main,gift}]}`.

### Reality (verified end-to-end)
The engine **`resolveOfferDiscount`** fully computes all 5 types **server-side at
checkout** on all 3 paths (pay-at-store, store-direct, **online-order** via
`priceOrderForGroup`). Category scope is **hierarchy-aware** (matches the offer's
`category_node_id` anywhere in a product's ancestor path). Product cards carry
the best live store-discount as `discount_value/offer_price` (MRP retired). Cart
previews the discount + free items via `POST /follower/cart/price`.

Endpoints: `POST /brands/me/offers` · `PATCH …/:id` (status + publish-to-store +
window). Offer builder: applies-to first → scope-gated value → searchable
finders → full category hierarchy picker (contracts offer-builder-ux,
offer-builder-categories-products, offer-category-hierarchy).

---

## 3. Layer ③ — Admin App Builder (composition)

### The unit: `section_config` (`083`; +`119`,`122`,`124`,`126`)
Each row = one placed section. Columns encode **what × where × when × on tap**:

| Column | Encodes |
|---|---|
| `screen` | WHERE — home · category · offers · creator_store · creator_category · business · page |
| `scope_type` / `scope_value` | WHERE — global / city / **vertical(world)** override layer |
| `shelf_key` | identity (repeatable rails differ by category_key/item_type) |
| `title` | label, templated `{city}`/`{category}`/`{creator}` |
| `shelf_type` | render family — creators·nav_tiles·offers·products·brands·mixed·controls·tiles·category_rail·restaurant_list |
| `rule` | WHAT — a built-in rule key, or `library_products`, or `static` |
| `item_type`, `category_key` | rule scoping |
| `item_limit`, `position`, `enabled` | count · order · on/off |
| `config_json` | design (`style`/`design`/`presentation_type`), `tiles[]`, `tap_destination`, `timer`, `world_rules_override`, `sub`, `sticky` |
| `starts_at` / `ends_at` | WHEN — schedule; expired = silently dropped |

### The 4-step wizard (business language)
**1 Design** (pick one of 18 designs — 7 rule shelves, 8 image banners/frames, 3
nav) → **2 Content** (Automatic rule / My rule / My images) → **3 Display**
(screen·world·position·schedule·location knobs) → **4 Action** (tap → product
grid / category browser / custom page).

### Content kinds
- **Automatic** — 13 built-in rules (`sectionRules.service`): top_by_engagement,
  top_by_conversions, top_picks, newest, biggest_discounts, ending_soon,
  all_offers, follow_graph, stories, creators_smart, restaurants_with_featured,
  products_in_category, businesses_in_category, world_categories, category_nodes.
- **My rule** — **`section_library`** (`103`) `rule_json`: subcategory_node_id
  (subtree) · tags (AND) · exclude_tags · hand-picked product_ids · price_min/max
  · brand facet · has_offer · min_discount_pct · sort. Live match preview.
- **My images** — `config_json.tiles[]` (image_url + label + tap_destination +
  optional library_section_id). Presigned via `POST /admin/sections/stock-upload-url`
  (own `sections` capability). Multi-image full-width banner = swipe deck.

### Pages, worlds, categories
- **Custom pages** `follower_pages` (`122`): registry; content = sections at
  `screen='page', scope_value=<key>`.
- **Worlds** `follower_verticals` (`110`): the home tabs (food/fashion/…), icon +
  image + accent. **Craving** `follower_vertical_categories`.
- **Browse tiles** `follower_categories` (`100`): 7 super-categories → member
  business categories.
- **World rules** `world_rule_settings` (`126`): per-world `location_mode`
  (boundary/rank_only/off) · `radius_km` · `empty_fallback` (widen/nearest/empty).
- **Category images**: `category_nodes.meta.image_url` via `PATCH
  /admin/sections/category-node-image`.

### Save + gating
`PUT /admin/sections/:screen` (transactional upsert on the uniq index, busts the
engine cache). Gated by **capability `sections`**; images use the same. City UI +
analytics exist. Admin lives in **brand-web/app/admin** (not admin-web).

---

## 4. Layer ④ — Section engine (resolution)

`sectionEngine.service.buildSections` per request:
1. **loadConfig** — enabled rows for the screen, within schedule window; **scope
   merge** global → vertical → city (higher layer replaces by identity).
2. **context** injected per row: `scope, vertical, brandId, city, followerId,
   followedIds, categoryKey, ruleDef (library), influencer, lat/lng, worldRules`.
3. Run the `rule` → items (each carries entity_type + price + offer
   discount_value/offer_price + tracking 4-IDs when creator-mediated).
4. **Location** (World Rules): boundary hard-gate + empty-fallback (widen/nearest).
5. **Hide-when-empty**: a rule-filled banner/hero matching 0 is dropped
   server-side; data shelves with 0 items are dropped by the phone. **A follower
   never sees an empty section.**
6. Payload `{sections:[{key,title,type,config,items}]}`.

**Public endpoints** (context per surface): `/follower/section/category/:key`
(home per world) · `/follower/business/:id/sections` · `/follower/section/creator/:handle`
· `/follower/page/:key/sections` · `/follower/section-results` (view-all) ·
`/listing/nodes/:id/children|products` (category browser).

---

## 5. Layer ⑤ — Follower app (rendering)

### Navigation (`FollowerNavigator.js`)
Bottom tabs: **Home · Reels(placeholder) · Orders · Profile**. Shared stack:
ProductDetail, Cart, OnlineOrder, PayAtStore, PreBook, Enquiry, BrandStore,
InfluencerStore, CategoryBrowser, SectionResults, FollowerPage, Find, Orders,
Addresses, Wallet, Returns, etc.

### Surfaces → data → section-driven?
| Surface | Screen | Data | Section-driven |
|---|---|---|---|
| Home (per world) | HomeScreen | getVerticals + getCategorySections | ✅ (tabs+veg filter aside) |
| Custom page | FollowerPageScreen | getPageSections | ✅ 100% |
| Business page | BrandStoreScreen | getBrandStore + getBusinessSections | ✅ hybrid (fallback grid) |
| Creator store | InfluencerStoreScreen | getStore + getCreatorSections | ✅ hybrid (fallback picks) |
| View-all | SectionResultsScreen | getSectionResults (re-runs rule) | ✅ 100% |
| Category browse | CategoryBrowserScreen | listingNodeChildren + listingNodeProducts | ❌ hardcoded (rail+grid+facets+search+counts) |
| PDP | ProductDetailScreen | product + offer | ❌ (entered from sections) |
| Cart / Orders / Profile | … | cart/orders/me | ❌ |

### SectionRenderer designs
`controls · category_rail · collection_header · banner_gateway · tiles
(carousel/featured/grid/banner/mosaic/themed_rail/hero_slider/strip/split/fullbleed)
· hero_tiles · offers(hero/grid/deal-rail) · creators(story rail) · nav_tiles
(category rail) · brands(row/list) · products(ShelfProductCard | FoodDishCard) ·
restaurant_list(nested dishes)`.

### Tap routing
Section-level `config.tap_destination`: `{type:'category', category_node_id}` →
CategoryBrowser (rail+grid) · `{type:'page', page_key}` → FollowerPage ·
`{type:'grid'}` → SectionResults. Per item by entity_type: offer/product → PDP ·
brand → BrandStore · creator → InfluencerStore. (Fixed field-name bug: renderer
reads `category_node_id`.) Section taps emit `recordSectionEvent`.

### Category browser (Blinkit-parity)
Left rail = the tapped node's children (with **live product counts**), drill on
tap (never empty — a branch shows its subtree), right = product grid + facet
chips + sort + **in-category search** (`?q=` name/description within subtree).

---

## 6. Design system (across ④–⑤)

- **Tokens** `theme/tokens.js`: **two palettes coexist** — legacy `creatorVibe`
  (cream/gold) and current **`toing`** (white `#F4F5F7` · yellow `#F8CB46` · pink
  `#E11D6B` · ink `#1A1D1F`). Fonts: Plus Jakarta Sans (body) + Outfit (display) +
  JetBrains Mono (numerals). spacing 4/8pt, radius 8/12/16.
- **Canonical product card = 3:4** (contract design-system-p1): ShelfProductCard
  (rails), CategoryBrowser grid, SectionResults grid all reskinned to one clean
  3:4 card (image · ink+yellow discount badge · brand bold / name muted / price +
  struck · radius+border+shadow). The **cropper crops products to 3:4** so
  crop == display (no re-crop).
- **Open design debt** (why it still trails AJIO): the two-palette split; several
  screens only colour-shimmed (BrandStore/PDP/Influencer) not fully reskinned;
  Home/PDP/Cart not yet on the system; some product "photos" are wide promo
  graphics (source-content issue). Redesign program rolls the 3:4 card + tokens
  outward screen-by-screen (Home → PDP → Cart), mockup-first.

---

## 7. End-to-end example ("Monsoon under ₹999" banner)

1. Brand lists monsoon products under Men›Topwear›T-Shirt, tags them `monsoon`,
   crops photos 3:4, publishes (`pushed_to_store`). Optionally a store discount
   offer scoped to that category.
2. Admin: App Builder → Home → fashion world → add **Full-width banner** →
   Content **My rule** (`tags: monsoon`, `min_discount 40`) → Display (schedule)
   → Action (tap → category browser at Topwear).
3. Engine: for a Mumbai follower, resolves the rule live (monsoon + discount +
   context) → 3 preview products on the banner; drops it if 0 match.
4. Follower: sees the banner on the fashion home; tap → CategoryBrowser rail+grid
   at Topwear; product tap → PDP → cart applies the offer at checkout.

---

## 8. Code pointers
- Data: `backend/migrations/{001,013,083,084,095,099,100,101,103,104,109,110,118,119,122,124,126}.sql`
- Brand: `controllers/{brand,listing,brandOffer}.controller.js`, `services/{taxonomy,tags,offer,offerConfig.validator}.js`
- Admin: `controllers/{adminSections,adminSectionLibrary,adminPages,adminFollowerCategories,adminFollowerVerticals,adminWorldRules}.controller.js`, `brand-web/app/admin/**`
- Engine: `services/{sectionEngine,sectionRules,sectionLibrary}.service.js`, `controllers/follower.controller.js`
- Follower app: `Mobile/src/navigation/FollowerNavigator.js`, `components/SectionRenderer.js`, `components/sections/TileSection.js`, `components/vibe/*`, `screens/follower/*`, `theme/tokens.js`
- Reference: `Docs/SECTION_ENCYCLOPEDIA.md` (per-design settings → follower outcome)
