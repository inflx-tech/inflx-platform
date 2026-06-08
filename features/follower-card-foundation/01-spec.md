# Feature Spec — follower-card-foundation (Phase 0 of the follower-app rebuild)

> Step 2 of the contract-driven workflow. Written and agreed BEFORE any code.
> Part of the screen-by-screen follower-app rebuild program
> (`design/wave4-creator-vibe/NEXT-WINDOW-PROMPT.md`). This is Phase 0: the
> shared, mockup-accurate card library that every discovery screen reuses.

## Problem / goal
The follower app does NOT match the agreed Creator-Vibe mockups. Root cause
(verified in code): the Creator-Vibe work was a **color-only recolor shim**, not a
rebuild — `SectionRenderer.js` renders the OLD components (square `CategoryGrid`,
yellow-ring `InfluencerStoryRow`, brown-banner `NewOfferCard`, letter-logo brand
rail). The mockup's round gradient-ring stories, round category circles, gradient
deal cards, trust lines and ranked badges **were never built in React Native**.

Every discovery screen (Home, Category, Offers, Creator Store, Creator's Category)
is the same vertical stack of admin-controlled shelves over the same item shapes.
So the highest-leverage first step is to build the **mockup-accurate card kit ONCE**.
Phase 1 (Home) and every later screen then wire their renderer at this kit. This
contract builds and locks that kit. It wires it into **no screen** — it is inert
until Phase 1 imports it, so it ships nothing on its own.

Role: **follower**.

## Scope
- **In scope** — a new component library `Packages/Mobile/src/components/vibe/`:
  - `Gradient` — OTA-safe pure-JS linear gradient primitive (no native dep).
  - `ShelfHeader` — shelf title (serif) + sub-line + count badge + type tag
    (BRANDS/PRODUCTS/OFFERS) + optional "see all".
  - `StoryCircle` + `StoryRail` — round gradient-ring avatar (coral→amber), name
    `@handle`, "● LIVE" tag when `has_live_deal`.
  - `CategoryCircle` + `CategoryRail` — round rounded-square emoji tile + label,
    horizontal scroll (replaces the square grid-wrap).
  - `FeatureCard` — "What's Hot" gradient tile (category chip, serif title,
    via-creator pill, big emoji).
  - `DealCard` — gradient header band (big discount + emoji) + white body
    (item name, brand, via-creator chip) + optional "⏳ Nh left" clock.
  - `ShelfProductCard` — image hero (heart + optional offer badge), name, brand,
    price (+ struck MRP when discounted).
  - `ShelfBrandCard` — image hero, brand name, cuisine/category line.
  - `ViaCreatorChip` — "via @handle" mini-pill with avatar.
  - `RankBadge` — "#1 / #2" overlay driven by shelf position.
  - `index.js` — named-export hub (mirrors `components/restaurant/index.js`).
- **Explicitly out of scope**
  - Wiring any of this into `SectionRenderer` / `HomeScreenV2` / any screen → **Phase 1**.
  - Any backend / section-engine / endpoint change.
  - Detail-screen blocks (Business Page tabs, Product customize) → their own phases.
  - Adding a native gradient/SVG dependency (would break OTA — see Non-functional).
  - Any data change (offers/sub-cats/attribution) — separate data phases.

## Surfaces touched
- App(s): **mobile (follower)** only. New files under
  `Packages/Mobile/src/components/vibe/`. No existing file edited.
- Roles involved: follower (render-only).

## Data / contracts
- New or changed tables / columns / migrations: **none**.
- New or changed API endpoints: **none**. Components consume the EXISTING
  section-engine item shapes already returned by `sectionRules.service.js`:
  - brand: `{ id, name, category, city, score?, tracking? }`
  - product: `{ id, name, price, image_url, section, brand:{name,category,city}, discount_value?, via_creator? }`
  - offer: `{ id, offer_type, discount_value, availing_modes, brand:{…}, via_creator:{handle,name,avatar}, tracking, offer_expires_at? }`
  - creator: `{ id, handle, name, avatar, followers_count, has_live_deal }`
  - nav: `{ key, label, icon }`
- Money/units: rupees (`fmtMoney`/`fmtRupees` from tokens). Attribution: each card
  is a pure presenter — the **4-ID tracking block is passed through untouched** by
  the screen on navigation (Phase 1 wires `onPress`). No card mutates tracking.

## Non-functional
- **OTA-safety (hard constraint).** The whole rebuild ships via
  `pnpm publish-ota:follower` — pure JS only, no native rebuild. Bare RN 0.73.6:
  no `react-native-linear-gradient`, no SVG, not Expo. Therefore gradients are
  approximated **OTA-safe** via the pure-JS `Gradient` primitive (stacked,
  absolutely-positioned `View` slices interpolating start→end hex). Same precedent
  as Flow-52 decision D1 (serif font OTA fallback). Fidelity caveat recorded in
  `06-diff/notes.md`.
- **Backend-first tiles (mandatory).** Every card field traces to a real field in
  the item shapes above. The mockup's brand-card "★ 4.5 · 1.2 km" has **no backing
  data** today (`mapBrandItem` returns no rating/distance; restaurant reviews exist
  but are not in the section payload; distance is not computed) → `ShelfBrandCard`
  **omits** rating + distance rather than fabricate them. Wiring reviews is a later,
  explicit data step. Ranked `#1/#2` is legitimate (shelf position is real).
- Auth/role gates: none (presentational).
- Failure modes: every component renders nothing (never throws) on missing/empty
  props — a misconfigured shelf can never blank or crash a screen (mirrors the
  existing `SectionRenderer` defensive contract).
- Palette/fonts: `creatorVibe` tokens + Outfit / Plus Jakarta / JetBrains Mono /
  serif-display fallback already registered in `theme/tokens.js`.
