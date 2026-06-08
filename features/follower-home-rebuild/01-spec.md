# Feature Spec — follower-home-rebuild (Phase 1 of the follower-app rebuild)

> Step 2. Written and agreed BEFORE code. Phase 1 of the screen-by-screen rebuild
> (`design/wave4-creator-vibe/NEXT-WINDOW-PROMPT.md`). Builds on Phase 0
> (`features/follower-card-foundation/` — the `components/vibe` kit).

## Problem / goal
The follower Home does not match the agreed mockup
(`design/wave4-creator-vibe/home-comprehensive.html`). Verified gaps:
- Header lacks the **profile avatar** and proper location block; thin chrome.
- No **serif greeting** line; search has **no filter button**.
- `SectionRenderer` renders OLD generic cards (square categories, yellow-ring
  stories, brown banner deals, letter-logo brands) — not the mockup's round
  gradient-ring stories, round category circles, gradient deal cards, image-hero
  brand/product cards, serif shelf headers.
- The **Eat** tile routes to the legacy `DiningHome` (vibe-tiles), bypassing the
  agreed Category screen.

Make Home render AS its mockup, driven by the live listing-driven section engine,
4-ID chain intact, Eat → the agreed Category landing.

Role: **follower**.

## Scope
- **In scope**
  - `HomeScreenV2.js` — rebuild the header (location + **profile avatar** + bell),
    add the **serif greeting + tagline**, add the **search filter button**; fix the
    hardcoded-fallback category routing (Eat → `CategoryList`).
  - `SectionRenderer.js` — render every shelf with the Phase-0 `components/vibe`
    kit; **re-point Eat/dining → `CategoryList`** (not `DiningHome`); preserve all
    other navigation targets, `hasEngineContent`, and the controls/hero/grid
    variants used by other screens.
- **Explicitly out of scope**
  - Backend / section-engine / endpoint / migration / data changes (none).
  - The offer-source data fix (Phase 3 — offer shelves stay honestly empty).
  - Sub-category chips data (Phase 2), creator picks (Phase 4), detail screens.
  - Per-vertical Home zones beyond what the seed already configures.
  - Reels (Phase 10).

## Surfaces touched
- App(s): **mobile (follower)** — `HomeScreenV2.js`, `SectionRenderer.js`.
  `SectionRenderer` is shared by 6 engine screens (Home, Category, Offers, Creator
  Store, Creator's Category, SchemaDetail) → the card upgrade improves all of them
  at once; each screen's bespoke chrome is refined in its own later phase. No
  navigation **targets** change except the intentional Eat re-point.
- Roles involved: follower (render + navigation only).

## Data / contracts
- New/changed tables, columns, endpoints, migrations: **none**. Consumes the
  existing `GET /v1/follower/home → { sections }` payload (shelves seeded in
  migrations 083/088/089). Item shapes per `sectionRules.service.js`.
- 4-ID attribution: each card passes `item.tracking` through untouched on
  navigation (offers/products → ProductDetail with tracking; brands → BrandStore
  with tracking). No card mutates the chain.
- Money: rupees via `fmtMoney`.

## Non-functional
- **OTA-only** (no native rebuild): pure JS + the Phase-0 OTA-safe `Gradient`.
- **Backend-first tiles:** header shows no fabricated notification count (no
  unread-count endpoint exists); brand cards omit rating/distance (Phase 0). City
  = "Vijayawada" is the real default from `useLocation`. Avatar initial read from
  the stored `inflx_user`.
- **Honest empty states:** offer-dependent shelves (What's Hot, Best Deals,
  Because-You-Follow, Biggest-Discounts, Ending-Soon, Top-Picks) are offer-gated
  and currently empty platform-wide → they render nothing (no fake deals). Visible
  Home today = Stories + Categories + Top Eats (brands) + Trending Dishes
  (products), matching the verified live payload.
- Defensive: unknown/empty shelves render nothing (never throw) — unchanged
  contract from the current `SectionRenderer`.
- Auth/role gates: none (follower tab).
