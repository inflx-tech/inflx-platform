# 06 — Before / After diff notes

## Before
- Suggest emitted ~one offer per party-size; no "best pick"; no business advice.
- **Modify** button was dead (no `onClick`) on every offer card.
- AI suggest mock was biryani-only (empty suggestions for other cuisines).
- No owner cost capture; "low cost" advice ungrounded.

## After
- `meal_offer_rules.recommended` added (migration 082, idempotent). Applied to **local dev** + **test DB** (jest globalSetup auto-discovers `.sql`). Prod apply pending explicit founder go.
- Suggest prompt rewritten: multiple varied combos across sizes + low-cost/high-loyalty advisor reasoning + `recommended` flag; menu enriched with owner-confirmed costs. Mock made menu-generic + multi-size (test contract preserved).
- New `modifyOffer` (client + mock + dispatcher); `POST /meals/offer-rules/:id/modify-chat` returns a **preview** (no write); owner Applies via existing PATCH; offer stays `suggested` until Accept.
- Cost capture: `GET/PUT /meals/menu-costs` + `meal_restaurant_learnings (learning_type='cost', owner_confirmed=true)`.
- brand-web: ⭐ Best-pick badge, advisory reasoning line, per-offer modify-chat panel (preview→Apply), private dish-cost sidebar editor.

## Verification
- Backend syntax: `node --check` clean on all 7 changed/added files.
- Migration 082: applied local dev + test DB; sanity probe confirms `recommended` boolean/default false.
- **Meals suites: 10 suites / 42 tests PASS** (incl. `meals-suggest`, `meals-learning`, `meals-engine`, `meals-p4`) against the test DB with 082 applied.
- Full backend jest: re-run for zero-regression proof — result recorded in lock.json `release.deploy`.

## Mockup vs build
Mockup `04-preview/mockups/meals-offers.html` is the locked baseline. Build matches: same `.ml` palette, badge, advisory line, modify-chat preview card with "stays suggested" note, and private cost editor. Live prices come from `brand_products` (mockup shows representative numbers).
