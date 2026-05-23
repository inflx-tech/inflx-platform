# INFLX Meals — mockups (for review → lock)

> **Status: mockup/review (showcase).** These are the HTML mockups for
> the INFLX Meals feature, produced during the design cycle (discuss →
> plan → **mockups** → lock → build). NOT yet locked features. The `_`
> prefix excludes this from gov-check. On lock, each mockup migrates
> into its real feature contract's `04-preview/mockups/`.

## Decisions these mockups reflect (locked 2026-05-22)
1. Customer-initiated (respond-only); two entry points — restaurant
   page (standing offers) + chat (composed-to-request).
2. No-match → simple "no match for your request" message.
3. Revenue = commission on each sale (separate from influencer);
   exact structure later.
4. Launch narrow (one city + one cuisine).

## Mockups
- `01-restaurant-offer-setup.html` — the AI co-pilot: offer ideas as
  Accept / Modify / Reject cards (built from the owner's own prices),
  rough-margin hint (clearly AI's guess, ignorable), modify-by-chat,
  the learning note, + side panels (limits/floor, auto-offer toggle).
  Reads menu from existing `brand_products` + context from
  registration — does NOT ask for them. **Iteration 3 (founder
  changes applied):** party size is now its **own tabs**
  (Single / For 2 / For 3 / Family / Office) — not stacked groups;
  every offer card has a **photo slot** (uploaded thumbnail OR a
  "📷 Add photo" upload affordance) so offers look good in the store;
  the **discount clock is an editable restaurant setting** (per-step
  time + % inputs, "+ Add a step", save state) — not hardcoded; a
  **"create your own offer type"** box lets the owner describe an
  offer in plain English (+ add a photo) and the AI previews the
  structured rule before accept.
- `02-customer-chat-to-offer.html` — the customer journey: intent
  chat → item clarification → ranked offer shortlist with **AI's
  recommendation** → pay-before-cutoff to lock. **Iteration 2 (founder
  changes applied):** chat now opens with a **memory banner** (recalls
  usual spice, budget band, favourite restaurant), marks "your usual"
  chips, **confirms** remembered facts instead of re-asking, and asks
  only **meaningful missing-field questions** (occasion → which pack
  type wins; drop-off → the 5 km radius) — each with a small "why I'm
  asking" line; the recommended offer cites the memory it matched.
- `03-restaurant-standing-offers.html` — **entry point (a) =
  a new "Offers" tab INSIDE the existing restaurant store**
  (`RestaurantDetailScreen`: Overview / Menu / **Offers** / Reviews /
  Photos). Mirrors the real store's look (lightColors yellow palette,
  Outfit/Jakarta/mono, hero carousel, sticky sub-tabs, sticky bottom
  CTA). The customer visits the store directly and orders from here —
  Meals offers are NOT a standalone page. Inside the Offers tab:
  lunch/dinner slot cutoffs, **party-size sub-tabs** (Single / 2 / 3 /
  Family / Office), **offer cards with photos**, a "pay-before-cutoff"
  explainer, and a fallback chat CTA bridging to entry point (b).
  > **Integration decision (founder, 2026-05-22):** Meals offers live
  > in the brand's current store as a separate Offers tab; restaurants
  > upload offer photos (managed in 01); customers browse + order in
  > the store they already have.
- `04-restaurant-meals-dashboard.html` — **R5 operations view:**
  lunch/dinner slot tabs + live cutoff countdown + auto-freeze banner,
  headline stats (orders / capacity / locked revenue / meals),
  order-book fill bar toward capacity, incoming-orders table (party
  size + items + delivery distance + paid/locking/new), kitchen
  prep-summary aggregation, and an "unmatched requests" panel that
  turns demand signals (Jain, late dinner) into new offers/slots.

## View
```
pnpm preview:open _meals-mockups
```

## Next (still pre-build)
All 4 mockups built + founder change-sets applied. Founder review →
iterate if needed → **LOCK** (migrate each into its real feature
contract's `04-preview/mockups/`) → P0 (decisions + Postgres schema).
