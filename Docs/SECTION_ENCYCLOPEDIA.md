# Section Encyclopedia — what every admin choice produces in the follower app

**Code-grounded 2026-07-07** (after Section Cleanup P0–P5 and Section-Rules
Admin-Control P1–P5, follower OTA v182). Built from a 3-way code audit
(admin wizard · backend engine · mobile renderer) with spot verification.
This is the **operator's manual**: pick a design + a content mode + settings →
this doc tells you exactly what the follower sees. Companion docs:
`SECTION_SYSTEM_SPEC.md` (the locked design spec), `ADMIN_SECTION_ENGINE.md`
(the 2026-06-23 audit, now partially superseded). Code pointers in §10.

---

## 1. The 60-second mental model

1. You compose a **page** (a world's home, the Offers hub, the Business page,
   the Creator store, or a Custom page) as an ordered stack of **sections**.
2. Every section = **Design** (how it looks) + **Content** (what fills it) +
   **Display** (where/when it shows) + **Action** (what a tap opens).
3. On every follower request the engine re-resolves each section **live**
   against the follower's context: city, GPS coords, world, the creator whose
   store they're on, the business page they're on, and who they follow.
   That is why one section shows different things to different followers.
4. Publish writes rows to `section_config`; the phone renders whatever the
   engine returns. No app release needed for content changes.

**Scope layering:** a page stack is resolved as
*global baseline → world (vertical) override → city override* — a city row
with the same section identity **replaces** the world/global one; otherwise
rows merge and sort by position. So you can run one national stack and
override just Vijayawada.

---

## 2. The three Content modes (your "auto rule vs my rule" question)

| Mode | Who does the work | What it is | Freshness |
|---|---|---|---|
| **⚡ Automatic** | Backend | A built-in query (Trending, Ending soon, Shops in this world…). Zero config — you pick it, it self-updates. | Live on every request (60s cache) |
| **🧩 My rule** | You, once | A saved filter in the Section Library (world + subcategory + tags + price + discount + brand + hand-picks). Reusable across many sections. | Live — products entering/leaving the filter appear/disappear automatically |
| **🖼 My images** | You, fully | Uploaded artwork + a wired Action per tile/slide. The engine runs **no query** — it shows exactly what you uploaded. | Static until you edit |

Rules of thumb:
- Want it to **maintain itself** → Automatic.
- Want **your merchandising idea** ("jeans under ₹499, min 40% off, not
  ethnic") that still self-updates → My rule.
- Want **exact art direction** (campaign banner, festive collage) → My images,
  and wire each tile's tap to a rule, category, or page.

---

## 3. Design-by-design encyclopedia (all 18 designs)

Legend for every entry — **Fills:** allowed content modes ·
**Name shows?** whether the mandatory section name is visible to followers ·
**If empty:** what happens when content resolves to nothing ·
**Tap:** what a follower tap does.

### 3.1 Shelves — filled by rules, always fresh

**Product shelf** (`product_shelf`)
- Looks: horizontal rail of product cards (food worlds get dish cards with veg
  dot; photo-first ranking — products with photos come first).
- Fills: Automatic (*Products in this world — newest first*) or My rule.
- Name shows? Yes, as the rail title (supports `{city}` / `{category}` /
  `{creator}` templates, e.g. "What's hot in {city}").
- If empty: invisible to the follower (renderer drops empty data shelves).
- Tap: card → product detail. "See all"/header → your Action (default:
  results grid that re-runs the rule with a bigger limit).

**Deals shelf** (`deals_shelf`)
- Looks: horizontal offer/deal cards with discount badges.
- Fills: Automatic — 7 rules: *Best converting* · *Trending now* · *Biggest
  discounts* · *Ending soon* · *New this week* · *From creators the follower
  follows* · *All live offers* — or My rule.
- Name shows? Yes. If empty: invisible. Tap: card → offer's product page
  (carries the 4-ID tracking link when the offer came via a creator).

**Shops row** (`shops_row`) / **Shops list** (`shops_list`)
- Looks: row = horizontal shop cards; list = full-width rows (directory style).
- Fills: Automatic — *Shops in this world* (needs a live menu, no offer
  required) or *Trending shops* (engagement-ranked, needs a live offer).
- Extra knob (Display step): "Only shops with a live offer" checkbox.
- Name shows? Yes. If empty: invisible. Tap: shop → its Business page.

**Creators row** (`creators_row`)
- Looks: story circles with follow badge; live-deal ring where applicable.
- Fills: Automatic — *Smart mix* (followed first, then near/active/famous; on
  a Business page it narrows to creators who collab with that brand) ·
  *Top creators* · *Creators in this world*.
- Name shows? Yes. If empty: invisible. Tap: circle → that Creator's store.

**Restaurants list** (`restaurants_list`) — food worlds only
- Looks: restaurant header cards (rating, ETA, cuisines) with a featured-dish
  rail nested inside each.
- Fills: Automatic — *Restaurants near the follower + featured dishes*.
  Location-aware: distance-ranked, honors world location mode (§5.3).
- Name shows? Yes. If empty: invisible. Tap: restaurant → Business page;
  dish → dish detail.

**Menu (food)** (`food_menu`) — Business page (food) only
- Looks: the business's own collapsible menu. Fills: Automatic (static — the
  brand's own catalog). Name shows? Yes. Tap: dish → detail.

### 3.2 Banners & frames — your images

**Full-width banner** (`full_width_banner`) — *two personalities:*
- **Image fill:** one edge-to-edge banner (1080×720). Shows exactly your
  image; never hides. Tap → your Action. **Name is NOT displayed** (admin
  label only).
- **Rule fill (banner-gateway):** headline + eyebrow + CTA + optional image,
  backed by a My-rule. The engine probes the rule with 3 items; the banner
  face shows those matching products as preview thumbs. **Hide-when-empty:**
  if the rule matches nothing right now, the banner is dropped server-side —
  followers never see a dead banner. Tap → full results grid of the rule.
  Headline is required (that's the visible text, not the section name).

**Hero slider** (`hero_slider`)
- Looks: full-width auto-advancing slides + dots (1080×560); autoplay speed
  configurable, 0 = manual swipe. Per-slide Action.
- Name NOT displayed. If a slide has no image it's filtered out; zero valid
  slides → section invisible.

**Announcement strip** (`announcement_strip`)
- Thin full-width strip (1080×240), one image, one Action. Name NOT displayed.

**Split banner** (`split_banner`)
- Two square tiles 50/50 (520×520 each), independent Actions. Name NOT
  displayed (tile labels render as scrims on the images).

**Image cards** (`image_cards`)
- Horizontal image-card rail; Small (carousel) / Medium (featured w/ badge)
  toggle. **Name IS displayed** above the rail. Per-tile Action.

**Image grid** (`image_grid`)
- 4-column image tiles. Name displayed above. Per-tile Action.

**Banner with tiles** (`banner_with_tiles`)
- Themed background image + up to 3 small tiles inside. Title renders inline
  on the banner. Per-tile Action.

**Collage** (`collage`)
- Mixed-size mosaic; slot templates: free / 1big+2small / 2×2 / 1+3.
  Name displayed above (if set). Per-tile Action.

**Sale zone** (`sale_zone`)
- Colored/image frame + heading + **countdown** + tile rail. Title renders in
  the frame header. Countdown reads the section's own end time (§5.2) — when
  it expires the whole section disappears, so the timer is honest.

> **Empty behavior for all image designs:** a tile without an image AND
> without a label is silently filtered; if nothing survives, the section
> vanishes. An unreachable/broken image URL renders as a blank area (React
> Native fails silently) — this is the prime suspect class for "my banner
> doesn't show" (item #4 of the change program).

### 3.3 Structure & navigation

**Category row** (`category_row`) — food worlds
- "What's on your mind?" craving circles; filters the page in place.
  Fills: Automatic (*this world's craving rail*, admin-managed table).

**Category tiles** (`category_tiles`)
- Tiles you hand-pick from the category tree (multi-select, optional "All"
  tile suppression). Tap → Category Browser at that node, or a custom page.
  This is the **building block for world sub-pages** (Fashion → Men/Women/
  Kids), per the locked decision: tiles that open one custom page per segment.

**Filter chips** (`filter_chips`)
- Sort/filter chip strip (comma-separated labels). Can be made **sticky**
  (pins to top on scroll). No title rendered — chips are the content.

---

## 4. Content deep-dive

### 4.1 Automatic rules — what actually feeds each

| Rule (wizard label) | Feeds on | Context it reacts to | Notes |
|---|---|---|---|
| Best converting offers | follower purchases (30d window) | city-first ranking, world, brand page | |
| Trending now | link clicks + conversions (7d default, window knob) | city, world, brand | |
| Biggest discounts | live offers by discount % | city, world; min-discount knob | |
| Ending soon | offer expiry timestamps (future only) | city, world | |
| New this week | newest live offers | city, world | |
| From creators you follow | the follower's follow graph | **empty for non-followers** — honest, never faked | |
| All live offers | every live offer (cap 30) | city-first | broad discovery |
| Shops in this world | approved brands with a live menu | world, distance/city, live-offer checkbox | no offer required |
| Trending shops | engagement-ranked brands **with live offers** | world, city, window | |
| Smart mix (creators) | followed → near → active → famous | scope-aware: on a business page only that brand's collaborators | |
| Top creators / in this world | creators with product picks | world, city | offer-independent |
| Restaurants near + featured | restaurants + featured dishes | GPS distance, world location mode | nested cards |
| Products in this world | pushed-to-store products, photo-first | world, distance/city | no offer required |

Unknown/broken rule keys degrade to an empty section — a bad row can never
crash the feed.

### 4.2 My rule — every filter, in evaluation order

A saved rule always starts from: approved brand + active product + pushed to
store + inside the section's world. Then, in order:

1. **Subcategory** — a node of the fashion/furniture tree, **including all
   its descendants** (pick "Men's T-shirts" → all its leaf types come along).
2. **Tags (include)** — product must carry **ALL** selected tags (AND).
   Works with both admin-vocabulary tags and brands' free-typed tags — a
   free tag like `monsoon` is targetable the moment one brand types it.
3. **Exclude tags** — product carrying **ANY** of these is removed (beats
   include).
4. **Hand-picked products** (≤50) — your pick order IS the display order;
   overrides sort/photo/distance ranking entirely.
5. **Price min / max** (₹).
6. **Creator allocation** — automatic on creator surfaces (§6).
7. **Brand** — the *catalogue* brand facet (Levi's, Puma), not the seller.
8. **Has offer** — only products with a live store-published offer.
9. **Min discount %** — satisfied by EITHER a struck-MRP markdown OR a live
   offer's discount (matches what the shopper's card displays).
10. **Sort** — newest / price ↑ / price ↓ (ignored when hand-picked).

**Check matches** previews the live count + samples before you publish.
Deleting/hiding a library rule that's still placed → the placement serves
empty (bannered ones disappear); it never falls back to the whole catalogue.

### 4.3 My images — the upload path

Choose file → admin gets a presigned R2 URL (via the stock-image endpoint)
→ browser PUTs the file straight to R2 → the permanent public URL is stored
in the section's config. The engine never touches the image again; the phone
loads the URL directly. (Failure modes live in three places: presign call,
R2 PUT, or a URL the phone can't reach — that triage is change-program
item #4.)

---

## 5. Display deep-dive

### 5.1 Pages you can compose today

| Page | How it resolves | Composable in App Builder? |
|---|---|---|
| World home (per vertical) | one stack per world | ✅ (the main tabs) |
| Offers hub | one stack | ✅ |
| Business page | one stack **per vertical**, content = that brand | ✅ |
| Creator store | ONE stack for all creators; content personalizes | ✅ |
| Custom page | one stack per page (`follower_pages` slug) | ✅ (create page → compose) |
| Follower home shell | seeded sections + Home Builder (worlds, craving) | ❌ by design — Home tab hidden in App Builder |

### 5.2 When it shows — schedule
- **Goes live / Disappears** (both optional). Outside the window the section
  simply isn't served; expired = page gets shorter, no "sale over" state.
- **Show countdown** (image designs): renders a timer bound to the section's
  own end time — timer and disappearance always agree.
- The admin list shows a ⏱ chip and warns when a section expires within 6h.

### 5.3 Where it shows — location (World Rules, per world + per section)
- **Location mode:** `boundary` (hard radius/city gate) · `rank_only`
  (nearness boosts order, never excludes — legacy default) · `off`.
- **Radius km** for boundary mode.
- **Empty fallback** when a boundary shelf finds nothing: *widen* (retry at
  2× radius) · *show nearest* (retry unbounded) · *show empty* (honest).
- Set per world in Admin → World Rules; any section can override just its own
  mode/radius/fallback.

### 5.4 The knobs on every section
| Knob | Range | Effect |
|---|---|---|
| Items | 0–50 (default 8) | rule LIMIT |
| Visible toggle | on/off | instant hide without deleting |
| Position ↑↓ | — | order in the stack |
| Sticky 📌 | on/off | pins (e.g. filter chips) to top on scroll |
| Trending window | 1–90 days | lookback for windowed rules |
| Min discount % | 0–100 | floor for offer rules |
| Live-offer only | checkbox | brands shelves |

### 5.5 Empty behavior — the full truth table
| Case | Who hides it | Follower sees |
|---|---|---|
| Data shelf, rule returns 0 | phone renderer | nothing |
| My-rule **banner/hero** matches 0 | **server** (never sent) | nothing |
| Image design, all tiles invalid | phone renderer | nothing |
| Schedule expired / not started | server | nothing |
| Disabled toggle | server | nothing |
| Library rule deleted but still placed | server serves empty | nothing (data shelves) |
| Boundary world, nothing in radius | fallback per §5.3 | widened / nearest / nothing |

**Net: a follower never sees an empty section.** The flip side: when
"nothing is showing," the cause can be any row of this table — check
schedule, toggle, rule matches, radius, and allocation in that order.

---

## 6. Context: the same section on different surfaces

| Surface | What the engine injects | Effect on content |
|---|---|---|
| World home | world + city + GPS + follow graph | world-filtered, near-first |
| City override stack | everything above, city stack wins | per-city merchandising |
| Business page | + brand id | offers/products/creators narrow to that brand |
| Creator store | + influencer + **live allocation** | products limited to what campaigns currently allocate to that creator (store-scope = whole store live, category-scope = live, hand-picked = frozen list); no allocation → empty, never leaks the catalogue |
| Signed-in follower | + follow graph | followed-first ranking, stories ring |

Titles interpolate `{city}`, `{category}`, `{creator}` — one row reads
"What's hot in Vijayawada" for one follower and "What's hot in Guntur" for
another.

Every offer item carries the 4-ID tracking block (campaign/set/offer/
influencer) when it reached the follower via a creator — attribution is
built into the payload, not bolted on.

---

## 7. Action deep-dive (what a tap opens)

| Action | Destination screen | What it shows |
|---|---|---|
| Product grid (default) | Section Results | re-runs the section's rule at a bigger limit; plain grid |
| Category browser | Category Browser | left rail of sibling subcategories + 2-col product grid + server-counted facet filters + sort (new / price ↑↓ / discount). Drill: branch → children, leaf → products |
| A page | Custom follower page | that page's own composed section stack |
| (implicit, per card) | — | offer/product → detail (PDP) · shop → Business page · creator → Creator store |

Per-tile/per-slide overrides beat the section-level Action. Validation
refuses to publish a category Action without a node or a page Action without
a page.

**Not possible today (parked):** deep-link a tile straight to a specific
brand store, a specific offer, or an external URL.

---

## 8. Admin surfaces cheat-sheet

| Button on a section row | Opens | Use when |
|---|---|---|
| ✏️ Edit | the 4-step wizard, pre-filled | changing design/content/action coherently |
| ⚙ Settings | inline expand panel (raw knobs: rule options, per-tile actions, schedule, caption, presentation) | quick tweak without the wizard |
| − n + | item limit stepper | resize a shelf |
| 📌 | sticky toggle | pin filter chips |
| toggle | enable/disable | instant hide |
| 🗑 | delete (confirm) | remove |

Both ✏️ and ⚙ are intentional today (guided vs expert editing) — whether to
keep two surfaces is change-program item #2, a product decision, not a bug.

---

## 9. Known quirks & gaps (feed the change program)

1. **Section name is mandatory everywhere** (wizard step 2, publish, backend)
   even for hero slider / full-width banner / announcement strip / split
   banner **which never display it**. The phone already hides absent titles
   gracefully — relaxing this is admin+backend-only work. *(item #3)*
2. **⚙ vs ✏️** — two deliberate editing surfaces; consolidation is a product
   call. *(item #2)*
3. **Banner image uploads** ride the master-dishes stock-image presign route;
   R2 PUT and URL reachability are the triage points for "uploaded but not
   showing". *(item #4)*
4. **Category Browser** matches the Blinkit model structurally (left rail +
   grid + facets + sort) but has **no Price-Drop chip** and the left rail is
   text-only, not thumbnail tiles. *(item #7)*
5. **Sub-world pages** (Fashion → All/Men/Women/Kids as tabs): the locked
   v1 answer is Category-tiles → one custom page per segment. Pages exist,
   tiles exist — but there's **no tab-bar binding** inside a world today.
   *(item #9)*
6. **Tags already work end-to-end** (fixed vocabulary + free brand tags,
   include/exclude, GIN-indexed) — "monsoon" collections are possible TODAY
   via My rule. The gap is curation/visibility of free tags, not plumbing.
   *(item #8)*
7. **Home shell** is deliberately not App-Builder-composable (Home Builder +
   seeded rows govern it).
8. **Creator store on device** is hybrid: legacy picks render by default;
   admin-composed creator sections render only when a creator_store stack is
   published. Prod `section_config` still needs its rebuild (owed).
9. `pinned_ref` column exists but nothing consumes it (legacy placeholder).
10. Trending Dishes / product-sales ranking is honestly empty (product-level
    attribution deferred) — don't place a "top-selling products" shelf yet.

---

## 10. Code pointers (verify-twice anchors)

| Piece | File |
|---|---|
| Wizard + design catalog + section list | `Packages/brand-web/app/admin/sections/page.js` (catalog @48–105, wizard @382+, buttons @1508–1524, title checks @497/501) |
| Save/validation API | `backend/src/controllers/adminSections.controller.js` (config_json validation @51–125, title @130) |
| Engine (scope merge, schedule, hide-empty, world rules, cache) | `backend/src/services/sectionEngine.service.js` (schedule @53, merge @93–136, banner probe @271–297, fallback @315–326) |
| Rule registry + My-rule executor | `backend/src/services/sectionRules.service.js` (registry @1317–1351, library_products @829–977) |
| Section Library + allocation | `backend/src/services/sectionLibrary.service.js` (rule validation @28–82, creator allocation @162–186) |
| Schema | migrations `083` (section_config) · `099` (tags) · `103` (library) · `119` (types+business) · `122` (pages) · `124` (schedule) · `125` (events) · `126` (world rules) |
| Renderer dispatch | `Packages/Mobile/src/components/follower/SectionRenderer.js` (tap routing @226–271, type switch @341+) |
| Tile designs | `Packages/Mobile/src/components/follower/TileSection.js` (tile filter @32) |
| Title hiding | `Packages/Mobile/src/components/follower/ShelfHeader.js` (@16) |
| Category browser | `Packages/Mobile/src/screens/follower/CategoryBrowserScreen.js` |
| Follower endpoints | `backend/src/controllers/follower.controller.js` (page sections @1375–1388) |
