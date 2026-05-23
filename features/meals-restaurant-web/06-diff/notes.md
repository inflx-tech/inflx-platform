# meals-restaurant-web — before/after notes

**Mockups (before):** `04-preview/mockups/01-restaurant-offer-setup.html`
(party-size tabs, offer cards with photo + Accept/Modify/Reject,
editable discount clock, limits, create-your-own) and
`04-restaurant-meals-dashboard.html` (slot stats, order-book fill,
incoming orders, kitchen prep, unmatched requests).

**Implementation (after):** `app/dashboard/meals/page.js` renders both
as two tabs ("Offers & setup", "Today's orders"). Captured by
`qa/web/brand/meals-setup.spec.ts` → `qa/artifacts/screenshots/after/
meals-setup__offers.png` + `meals-setup__today.png`.

## What matches the mockup
- Party-size tabs with counts; offer cards show photo/no-photo, name,
  computed price (strike + discounted), Accept/Modify/Reject.
- Editable discount-clock panel (per-step n/unit/%, add/remove, save).
- Limits panel; create-your-own offer box (name, price, plain-English,
  photo).
- Today tab: 4 stat cards, order-book fill bar, incoming-orders table,
  kitchen-prep aggregation, unmatched requests.

## What diverged (intentional, this phase)
- The AI **suggested-offers** feed (mockup 01's "6 of 24" co-pilot
  cards + rough-margin hint + modify-by-chat + learning note) is
  **deferred to X1** — P2 manages real offer rules deterministically.
  The Setup tab will gain the AI feed in that phase.
- Photo upload is a URL field for now (real R2 upload is a later
  refinement); the slot countdown/auto-freeze on the dashboard becomes
  live in P3 (the clock/freeze engine).

## What to check manually
- Accept an offer → card turns green, status `active`.
- Edit the discount clock + Save → persists.
- Create-your-own → new active card appears under the party-size tab.
- Today tab reflects real orders once P1 orders exist for the date.
