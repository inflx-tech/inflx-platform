# Feature Spec — Mobile taxonomy cleanup (Phase 2.5b)

> Foundation step 2 (of 3). Follows 2.5a (backend "one brain"). UI-governed
> (mobile + web registration). Written and agreed BEFORE code.

## Problem / goal
2.5a made the backend serve one source of truth (5 launch tiles, fashion merged).
Two small client-side leftovers remain that should match that truth:
1. Brand signup still *saves* the legacy `fashion_walkin` value (the alias covers it,
   but new brands should record the clean `fashion`).
2. The mobile category screen treats only `eat`/`dining` as a restaurant layout, so the
   new `food` tile key renders in the wrong (product-grid) layout.
3. The offline fallback category list in the app is the old 7-vertical list.

**Goal:** finish the client side of the foundation — registration emits the clean value,
the Food tile renders its (existing) dining layout, and the offline fallback matches the
5 tiles. No new visual design.

## Scope
- **In scope:**
  - `BrandRegisterScreen.js` + brand-web `login/page.js`: signup category value
    `fashion_walkin` → `fashion` (label unchanged "Fashion & Apparel").
  - `CategoryListScreen.js`: `isDining` includes `food` (so the Food tile uses the
    existing restaurant/dining layout, not the product-grid one).
  - `CategoryGrid.js`: offline fallback `DEFAULT_CATEGORIES` → the 5 launch tiles;
    `SUPERCAT_ACCENT` gains the new tile keys (tile tint).
- **Explicitly out of scope:**
  - **FindScreen** (search/browse) restructure → **deferred to Phase 5 visual rebuild**
    (founder decision 2026-06-15 — it gets re-skinned then anyway; avoid double work).
    It stays as-is; its old keys still resolve via the backend alias from 2.5a.
  - Scattered `CATEGORY_EMOJI` fallback maps (cosmetic; merged brands show 📦 instead of
    👗 only when a product has no image) → deferred to 2.5c polish.
  - Deleting legacy follower screens + `fashion_walkin/online` schema stubs + removing
    the transition aliases → **2.5c**.

## Surfaces touched
- **App(s):** mobile (follower `CategoryGrid`/`CategoryListScreen`, auth
  `BrandRegisterScreen`), brand-web (`login/page.js` signup).
- **Roles involved:** follower (category browse), brand (signup).

## Data / contracts
- No DB / migration / API changes. Pure client wiring on top of 2.5a's backend + data.
- No money/attribution/status-machine impact.

## Non-functional
- **Auth/role gates:** unchanged.
- **Failure modes:** API-down on Home → fallback now shows the 5 tiles (was 7 stale);
  a legacy key arriving from an old cache still resolves (backend alias + SUPERCAT_ACCENT
  legacy keys kept).
- **Visual:** no NEW design. The only visible delta is the Food tile rendering the
  EXISTING dining layout (already used for restaurants) instead of the product grid —
  hence no new mockup; documented in 06-diff/notes.md.
- **Deploy:** mobile = OTA (no native change); brand-web = Vercel on push. released stays
  false (founder verifies); not flipping released → Maestro gate (Rule 5) not triggered.
