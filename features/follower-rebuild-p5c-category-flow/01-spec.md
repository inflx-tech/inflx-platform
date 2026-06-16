# 01 — Spec: Phase 5c — Category Flow

**Contract:** `follower-rebuild-p5c-category-flow`
**Track:** Follower visual rebuild (Phase 5), step 3 (Category flow).
**Surface:** Follower mobile only (OTA). No backend/DB/migration.
**Locked reference:** `04-preview/mockups/categories-recolored.html` (founder's
recolored mockup — "All Categories" + per-vertical reuse).

## Context (verified in code)
- The per-vertical `CategoryListScreen` renders through `SectionRenderer`, so it
  already inherited Phase 5b's layout (clean shelf headers, hero banner, circular
  sub-category bubbles via `CategoryCircle`).
- The app has **no dedicated "Categories" tab** (bottom tabs = Home/Offers/Reels/
  Orders/Profile). The mockup's "All Categories" hub maps to `FindScreen`, which is
  **explicitly deferred** (2.5b — reskinned later to avoid double work).
- Therefore the Category flow's remaining 5c work is the **white-on-gold sweep**
  (per the 5a carry-over list) for Category-flow screens.

## In scope
1. `CreatorCategoryScreen`: sub-type chip active text `#fff` → `onGold` (ink) —
   the one live white-on-gold remnant on this flow.
2. `CategoryListScreen`: remove the dead pill `subchip*` styles (incl. a
   white-on-gold `subchipTxtOn`) — the sub-bar renders `CategoryCircle` now.

## Out of scope (deferred — noted)
- `FindScreen` ("All Categories" hub) — deferred to its own flow (2.5b decision).
- Per-business **accent** badges in the legacy dining/inline-product fallback
  (`diningBadgeText`, `storeLogoText`, `offerBadgeInitial`): white text sits on a
  per-business ACCENT color (not gold) and is intentional wayfinding — left as is.
- Legacy fallback layout restyle (safety net; retired during screen cleanup).

## Acceptance
- `pnpm qa` GREEN gate 0 (mobile-only, inert to web/db lanes).
- No white-on-gold remnant on the live Category-flow surfaces.
- `released:false` until the joint 5→6 founder verify.
