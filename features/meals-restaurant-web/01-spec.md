# meals-restaurant-web — restaurant Meals control surface (P2)

> **Phase P2.** The restaurant-facing **web UI** (brand-web) for Meals,
> realising the two locked mockups: `01-restaurant-offer-setup.html`
> and `04-restaurant-meals-dashboard.html`. Plus the backend read/
> manage/dashboard endpoints the UI needs. Deterministic only — the AI
> co-pilot's *suggested* offers arrive in X1; P2 manages real offer
> rules + config and shows the live order book.

## UI — `/dashboard/meals` (one route, two tabs)
**Offers & setup** (mockup 01):
- Party-size **tabs** (Single / For 2 / For 3 / Family / Office) with
  per-tab counts.
- Offer cards: photo (or "no photo"), name, computed price (strike +
  discounted), Accept / Modify / Reject (Accept→`active`,
  Reject→`rejected`, Remove→`archived`).
- **Editable discount clock** (per-step n + unit + %, add/remove, save).
- Limits panel (radius / max-discount / never-below-cost / auto-offer).
- **Create your own offer** — name, your price, plain-English
  description, optional photo → a `custom` active rule.

**Today's orders** (mockup 04):
- Stats (orders / capacity-left / locked revenue / meals).
- Order-book fill bar toward capacity.
- Incoming-orders table (customer / party / amount / status + "Mark
  delivered").
- Kitchen prep aggregation; unmatched-request signals.

## Backend (added this phase)
`GET /meals/config`, `GET /meals/slots`, `GET /meals/offer-rules`,
`PATCH /meals/offer-rules/:id`, `GET /meals/dashboard`. (Create/PUT
config/slots/offer-rules already exist from P1.)

## Success
Playwright spec `qa/web/brand/meals-setup.spec.ts` renders both tabs
against stubbed APIs and captures screenshots; backend endpoints covered
by `backend/tests/meals-p2.test.js`; `pnpm qa` GREEN (zero regression).
