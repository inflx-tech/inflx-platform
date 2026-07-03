# Section System Spec — the follower app as a section factory

**Status: LOCKED 2026-07-03 — founder decisions applied (see §9 decision log).**
Catalog names in §3 are the admin-facing vocabulary from here on.
Drafted from a 3-agent code audit (backend engine, mobile renderer, admin UI).
Extends the locked model in `Docs/ADMIN_SECTION_ENGINE.md` (2026-06-23) and the
follower VISION. This doc is Phase 0 of the Section System Cleanup program.

---

## 1. The model (canonical language from here on)

Everything the follower sees on a composed page is a **Section**.
Every Section answers exactly **four questions** (founder-locked business
language — these are the wizard step names):

| Step | Question | Meaning | Today's code home |
|---|---|---|---|
| **1 · Design** | How does it look? | Which design template renders it | `shelf_type` + `config_json.style` + `presentation_type` (3 places → 1 catalog) |
| **2 · Content** | What fills it? | Auto rule / admin rule / uploaded images | `rule` / `library_section_id` / `config_json.tiles` |
| **3 · Display** | Where + when does it show? | Page, world, position, schedule | `screen` + `scope_type/value` + position; **schedule = new** |
| **4 · Action** | What happens on tap? | Product grid / category page / custom page | `config_json.tap_destination` or implicit per item |

Every Section is one of **three kinds** (by its Content):

| Kind | Content source | Admin effort | Example |
|---|---|---|---|
| **1 · Data** | Built-in backend rule; self-updating | Pick rule + title | "What's hot in {city}", Stories, Ending soon |
| **2 · Rule** | Admin-authored filter (Section Library `rule_json`) | Build filter once, reuse | "Jeans under ₹499", "Min 60% off" |
| **3 · Visual** | Admin-uploaded images + wired actions; no query at render | Upload + wire | Hero slider, collage, announcement strip |

Page context (city, coords, world, creator allocation, brand id, follow graph)
stacks on top of every kind **automatically** — same section, different content
per page. This already works and does not change.

**The three standard pages** are already section-engine screens:

| Page | `screen` value | Layout granularity |
|---|---|---|
| Home (per world) | `home` shell + `category` per vertical | One stack per world |
| Creator Store | `creator_store` (+ `creator_category`) | One stack for ALL creators (content personalizes) |
| Brand/Business page | `business` | One stack per vertical (content = that brand) |
| Custom pages | `page` + `follower_pages.key` | One stack per page |

**Sub-sections inside a world (founder decision #2, v1):** e.g. Fashion →
Men / Women / Kids. Implemented as a **Category tiles / Image cards section
whose Action opens a custom page** — one page per segment, each composed like
any other page. No engine change, no recommendation logic in v1.

---

## 2. Current inventory (code-grounded, verify-twice'd)

### 2.1 Stored section types (DB CHECK, migration 119)
`creators · nav_tiles · offers · products · brands · mixed · controls · tiles ·
category_rail · restaurant_list`

### 2.2 Synthesized payload types (NOT stored — engine/renderer conventions)
- `banner_gateway` — emitted when a `library_products` placement has
  `config.presentation_type='banner'` (sectionEngine.service.js:155–171).
- `hero_tiles` — `presentation_type='hero_tiles'` variant.
- `collection_header` — presentational band.

> Confusion source #1: what admin stores and what the app receives are not the
> same vocabulary. The catalog in §3 gives every design ONE id and ONE
> business-friendly name; old values become aliases.

### 2.3 Tile styles (`shelf_type='tiles'`, `config.style`, TileSection.js)
`carousel` (default) · `featured` · `grid` · `banner` (bg + ≤3 sub-tiles) ·
`mosaic` (large=full-width / small=2-up) · `themed_rail` (frame + header +
boxed countdown). Optional `config.timer {ends_at,label}` on any style —
display-only today (expired timer hides the timer, never the section).

### 2.4 Built-in rules (Kind 1) — with the business names the wizard shows

| Rule key | Wizard label | Needs |
|---|---|---|
| `top_by_engagement` | Trending now | city |
| `top_by_conversions` | Best converting offers | city |
| `top_picks` | Most bought + saved | city |
| `newest` | New this week | — |
| `follow_graph` | From creators you follow | signed-in follower |
| `biggest_discounts` | Biggest discounts | city |
| `ending_soon` | Ending soon | live offers |
| `all_offers` | All live offers | — |
| `stories` | Creator stories | follow graph + city |
| `creators_smart` | Creators for this page | scope-aware |
| `restaurants_with_featured` | Restaurants near you | lat/lng |
| `products_in_category` | Products in this world | world |
| `businesses_in_category` | Shops in this world | world |
| `nav_verticals` / `world_categories` / `category_nodes` | navigation fills | config |

**Removed in Phase 2 (founder decision #1 — duplicates/dead):** `top_by_sales`
(hardcoded `[]`), offer-gated creator twins (`stories`/`creators_in_category`
offer-gated variants where listing twins exist), dormant `collection` rule.

### 2.5 Admin rule fields (Kind 2, `section_library.rule_json`)
`business_type` (or ALL) · `subcategory_node_id` (fashion/furniture tree) ·
`tags[]` (AND) · `price_min/max` · `sort` (newest|price_asc|price_desc) ·
`has_offer` + `min_discount_pct`. Live preview returns match count + sample.
**Not supported yet:** brand filter, hand-picked products, exclude tags
(Phase 4).

### 2.6 Actions (tap destinations)
`config.tap_destination` on sections and per-tile:
- `{type:'grid'}` (default) → SectionResults re-runs the rule
- `{type:'category', category_node_id}` → CategoryBrowser (sidebar + facets)
- `{type:'page', page_key}` → FollowerPage (custom page stack)
Kind-1 items navigate implicitly by `entity_type` (offer→PDP, brand→BrandStore,
creator→InfluencerStore). **Not supported yet:** specific brand store, specific
offer, external URL (parked).

### 2.7 Gaps this spec addresses
No `starts_at/ends_at` (timer cosmetic) · no auto-play hero slider · design
vocabulary split across 3 fields · Kind-2 creation spans 2 admin screens ·
`config_json` untyped · city scope has no admin UI · no section analytics.

---

## 3. Design Catalog v1 — LOCKED (deduped + business names)

One flat catalog. `config_json.design` stores the design id; the **Admin name**
is what brands/shop owners see in the wizard. Legacy fields (`shelf_type`,
`style`, `presentation_type`) keep working via aliases — **zero data migration,
zero follower-app breakage on day 1**.

Dedup pass (founder decision #1 + #3) merged 5 former entries:
- `banner_gateway` + `hero_offer` → **Full-width banner** (one component,
  three Content fills: image / rule / auto-offer).
- `tile_carousel` + `tile_featured` → **Image cards** (card size + badge are
  options, not separate designs).
- `mosaic` + planned `collage_slots` → **Collage** (slot templates; free-form
  mosaic = one of the templates).

**Status:** LIVE = renders today · ALIAS = renders today under an old name ·
NEW = Phase-3 build.

### 3.1 Content shelves (Data / Rule fills)

| Design id | Admin name | Looks like | Aliases (today) | Status |
|---|---|---|---|---|
| `product_shelf` | Product shelf | Horizontal product cards (food: dish cards + veg dot) | `shelf_type=products` | LIVE |
| `deals_shelf` | Deals shelf | Horizontal deal cards | `shelf_type=offers/mixed` | LIVE |
| `shops_row` | Shops row | Horizontal shop cards | `shelf_type=brands` | LIVE |
| `shops_list` | Shops list | Full-width shop rows | `brands` + `config.main_list` | ALIAS |
| `creators_row` | Creators row | Story circles + follow badge | `shelf_type=creators` | LIVE |
| `restaurants_list` | Restaurants list | Restaurant card + dish carousel inside | `shelf_type=restaurant_list` | LIVE |

### 3.2 Visual banners & frames (Visual fills — admin images)

| Design id | Admin name | Looks like | Aliases (today) | Status |
|---|---|---|---|---|
| `hero_slider` | Hero slider | **Full-width auto-advancing slides + dots; per-slide action** | — | **NEW — first build** |
| `full_width_banner` | Full-width banner | One edge-to-edge banner; fill = image, rule, or auto-offer | synthesized `banner_gateway`; `offers`+`presentation_type=banner` | MERGED (LIVE parts + NEW image fill) |
| `announcement_strip` | Announcement strip | Thin full-width strip (partner/notice) | — | NEW |
| `split_banner` | Split banner | Two tiles 50/50, independent actions | — | NEW |
| `image_cards` | Image cards | Horizontal image cards; size S/M option, optional badge | `tiles` style=carousel / style=featured | MERGED (LIVE) |
| `image_grid` | Image grid | 4-column image tiles | `tiles` style=grid | LIVE |
| `banner_with_tiles` | Banner with tiles | Themed bg + up to 3 tiles inside | `tiles` style=banner | LIVE |
| `collage` | Collage | Slot templates: `1big+2small`, `2x2`, `1+3`, free | `tiles` style=mosaic | MERGED (LIVE + NEW slots) |
| `sale_zone` | Sale zone | Colored/image frame + heading + countdown + tile rail | `tiles` style=themed_rail | LIVE |
| `video_slide` | Video slide | Autoplay muted video | — | PARKED |

### 3.3 Structure & navigation

| Design id | Admin name | Looks like | Aliases | Status |
|---|---|---|---|---|
| `category_row` | Category row | "What's on your mind?" circles, in-page filter | `shelf_type=category_rail` | LIVE |
| `category_tiles` | Category tiles | Tiles → category browser or custom page | `shelf_type=nav_tiles` | LIVE |
| `filter_chips` | Filter chips | Sort/filter chip strip | `shelf_type=controls` | LIVE |
| `group_heading` | Group heading | Titled color band above a group | synthesized `collection_header` | ALIAS |

> Catalog count after dedup: **20 designs** (was 24). Build-new list:
> `hero_slider`, `announcement_strip`, `split_banner`, image fill of
> `full_width_banner`, slot templates of `collage`. `video_slide` parked.

---

## 4. Typed `config_json` schemas

Common envelope (all designs):

```jsonc
{
  "design": "hero_slider",              // catalog id (new, canonical)
  "sub": "optional subtitle",
  "tap_destination": {                   // section-level default Action
    "type": "grid" | "category" | "page",
    "category_node_id": "uuid?",        // when type=category
    "page_key": "slug?"                 // when type=page
  },
  "timer": { "ends_at": "ISO8601", "label": "Ends in" }  // optional, any visual design
}
```

Per-design payloads (deltas only):

```jsonc
// hero_slider
{ "design": "hero_slider",
  "autoplay_ms": 4000,                  // 0 = manual swipe only
  "slides": [ { "image_url": "...", "label": "?", "library_section_id": "uuid?",
                "tap_destination": { } } ] }        // per-slide Action overrides section Action

// full_width_banner — ONE component, three Content fills (decision #3)
{ "design": "full_width_banner",
  "fill": "image" | "rule" | "auto_offer",
  "image_url": "?",                     // fill=image
  "library_section_id": "uuid?" }       // fill=rule (tap re-runs rule, ex banner_gateway)

// image_cards / image_grid / banner_with_tiles / collage / sale_zone / split_banner
{ "design": "image_cards",
  "card_size": "small|medium",          // ex carousel vs featured
  "tiles": [ { "image_url": "...", "label": "?", "badge": "?", "size": "large|small?",
               "library_section_id": "uuid?", "tap_destination": { } } ],
  "frame": { "bg_color": "?", "bg_image_url": "?", "title_align": "left|center" },  // sale_zone
  "banner_image_url": "?",              // banner_with_tiles
  "slot_template": "1big+2small|2x2|1+3|free" }     // collage

// announcement_strip
{ "design": "announcement_strip", "image_url": "...", "tap_destination": { } }

// Kind-2 placements (any content shelf)
{ "design": "product_shelf", "library_section_id": "uuid" }
```

**Validation (Phase 1):** `PUT /admin/sections/:screen` validates `config_json`
against the design's schema; unknown design / malformed payload = 400 with a
field-level message. Legacy rows without `design` validate via the alias
mapping. No more silent failures on device.

### 4.1 Scheduling (new columns, Phase 1)

```
section_config.starts_at  timestamptz NULL   -- NULL = live immediately
section_config.ends_at    timestamptz NULL   -- NULL = never expires
```

- Engine `loadConfig()` adds `AND (starts_at IS NULL OR starts_at <= now())
  AND (ends_at IS NULL OR ends_at > now())`.
- **Expired sections disappear automatically — no "sale over" state (founder
  decision #4).** The page simply gets shorter.
- The countdown timer defaults to the section's own `ends_at` — timer becomes
  honest. `config.timer.ends_at` remains as an override for "timer shows offer
  window, section stays" cases.
- Existing rows: both NULL → behavior unchanged. Deploy-inert until the wizard
  exposes the fields.

---

## 5. The Add-Section wizard (App Builder restructure, Phase 2)

One flow replaces today's preset picker + Section Library round-trip. Step
names are the founder-locked business language (decision #5):

1. **Design** — thumbnail grid of the §3 catalog (grouped: shelves / banners &
   frames / structure), showing Admin names. Picking a design decides which
   Content kinds are offered.
2. **Content** — three tabs:
   - *Automatic* — Kind-1 rules with §2.4 labels + one-line "what feeds this"
     + live sample.
   - *My rule* — Section Library builder INLINE (create or pick existing;
     still writes `section_library`, rules stay reusable).
   - *My images* — per-design upload slots with expected pixel size (§7).
3. **Display** — page + world, position, enabled, and the new `starts_at` /
   `ends_at` pickers. (City scope UI = Phase 5, field reserved.)
4. **Action** — one destination picker (product grid / category page / custom
   page), section-level + per-tile/slide overrides where the design has tiles.

Existing sections open in the same wizard (aliases resolve to catalog ids).
Live phone preview keeps working and (Phase 3) renders real uploaded images.

**Also in Phase 2 (decision #1 + ADMIN_SECTION_ENGINE P1-CLEAN, still
pending):** retire dormant Collections UI + `collection` rule, kill
`top_by_sales` default, prune offer-gated creator rule twins, retire legacy
follower-categories admin page, remove the inert writable `home` scope key.

---

## 6. What does NOT change

- `section_config` spine, scope merge, rule registry, context injection,
  caching — untouched (schedule filter is additive).
- Follower payload shape `{sections:[{key,title,type,config,items}]}` —
  untouched; new designs are new `type`/`config.design` values the renderer
  learns.
- Section Library table + preview endpoint — untouched (wizard embeds it).
- Home Builder (worlds + craving rails) — untouched in this program.
- Layout granularity (per page-TYPE, not per individual store) — unchanged;
  per-store overrides are explicitly OUT of v1.
- No recommendation/ranking engine in v1 (founder decision #2).

---

## 7. Image standards (shown in the wizard, used in art prompts)

| Design | Canvas (px) | Aspect |
|---|---|---|
| Hero slider slide | 1080×560 | ~2:1 |
| Full-width banner | 1080×720 | 3:2 |
| Announcement strip | 1080×240 | 4.5:1 |
| Sale zone frame bg | 1080×640 | ~1.7:1 |
| Collage large slot | 720×900 | 4:5 |
| Collage small slot / split banner tile | 520×520 | 1:1 |
| Image cards / image grid tile | 480×600 | 4:5 |

Palette for generated artwork: white base, yellow `#F8CB46`, ink `#1A1D1F`,
pink `#E35694`; flat, 16px radius, 5% text safe-zones.

---

## 8. Build phases → contracts

| Phase | Contract slug (proposed) | Scope | Release class |
|---|---|---|---|
| P1 | `section-scheduling` | migration + engine filter + config validation | deploy-inert until UI |
| P2 | `app-builder-wizard` | 4-step wizard (Design/Content/Display/Action) + catalog aliases + P1-CLEAN retirements | admin-only, prod-impacting (gated go) |
| P3a | `design-hero-slider` | hero slider renderer + wizard card + real-image preview | OTA ×3 |
| P3b | `design-banners` | full-width image fill, announcement strip, split banner, collage slots | OTA ×3 |
| P4 | `rule-builder-depth` | brand filter, hand-pick, exclude tags | backend + admin |
| P5 | (scoped later) | analytics, city UI | — |

**Acceptance test (end of P3a):** founder composes, alone, a campaign home =
hero slider + announcement strip + scheduled sale zone with honest countdown +
collage with three different actions — live on device, no chat help.

---

## 9. Founder decision log (2026-07-03 — Phase 0 LOCK)

1. **Catalog:** review all, remove duplicates, business-friendly names →
   applied in §3 (24 → 20 designs; 3 merges; Admin-name column).
2. **Sub-sections in a world:** keep v1 simple — Fashion → Men/Women/Kids as
   tiles, **each opens another (custom) page**. No recommendation engine yet.
3. **Banner gateway:** merged into **Full-width banner** — one component,
   three fills (image / rule / auto-offer). Less maintenance.
4. **Expiry:** expired sections **disappear automatically**; no "sale over"
   message.
5. **Language:** wizard steps = **1 Design · 2 Content · 3 Display ·
   4 Action** — business terminology for brands and shop owners, not
   technical terms.
