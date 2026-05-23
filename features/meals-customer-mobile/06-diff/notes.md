# meals-customer-mobile — before/after notes

**Mockups (before):** `04-preview/mockups/03-restaurant-standing-offers.html`
(in-store Offers tab — store hero, slot cutoffs, party-size tabs, photo
offer cards, pay-before-cutoff, chat CTA) and
`02-customer-chat-to-offer.html` (memory-aware chat → clarify → ranked
offers with the AI's starred recommendation → pay-before-cutoff lock).

**Implementation (after):**
- `RestaurantDetailScreen.js` — new **Offers** sub-tab + `MealsOffersTab`
  (party-size sub-tabs, offer cards with items/price/freebies, plan-ahead
  note, chat CTA), fed by `GET /meals/store/:brandId`.
- `MealsChatScreen.js` — chat thread, clarify, engine offers with the
  AI's starred pick, pay-before-cutoff, order-locked confirmation.

## What matches the mockup
- Offers live **inside the existing store** as a new tab (the agreed
  integration), party-size sub-tabs, offer cards, pay-before-cutoff,
  fallback chat CTA.
- Chat → clarify → ranked offers → recommendation → pay → lock.

## What diverged (intentional, this phase)
- **Ordering goes through chat** for now: an offer's "Order this →" and
  the store's chat CTA both open `MealsChat` (which builds the intent →
  engine offer → pay). One-tap order of a *standing* offer (no chat) is
  a later refinement.
- Photos render where present; otherwise name/price cards (the mockup's
  food photos are placeholders).

## Verification status (honest)
- Backend journey (C0 store + C1–C5 chat→pay→track→deliver):
  **runtime-verified green** (`meals-p4.test.js`).
- Mobile JS: **compiles + integrates** (Metro Android bundle HTTP 200,
  `MealsChat`/`mealsApi` resolved).
- Full interactive **Maestro UI run: deferred** to a seeded local device
  (flow authored at `qa/maestro/local-flows/meals-customer-journey.yaml`
  with testIDs). `release.maestro_green` stays false until run green.

## What to check manually (on a seeded device)
Open a Meals-enabled restaurant → Offers tab shows party-size offers →
"Plan by chat" → type a family-lunch request → see the starred offer →
pay → "Order locked".
