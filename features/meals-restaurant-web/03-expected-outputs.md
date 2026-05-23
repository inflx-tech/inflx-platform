# meals-restaurant-web — expected outputs

## UI (Playwright, stubbed APIs)
- `/dashboard/meals` renders with the **Offers & setup** tab active:
  party-size tabs visible, offer cards for the selected size, the
  editable **Your discount clock** panel, and the **Create your own
  offer type** box.
- Switching to **Today's orders** renders the stats row, the order-book
  fill bar, the incoming-orders table, kitchen prep, and unmatched
  requests.
- Screenshots captured: `meals-setup__offers.png`,
  `meals-setup__today.png` under `qa/artifacts/screenshots/after/`.

## Backend (Jest)
- `GET /meals/config` returns config (or null) for the brand.
- `GET /meals/offer-rules` lists the brand's rules; `?party_size=` and
  `?status=` filter.
- `PATCH /meals/offer-rules/:id` flips status (accept→active,
  reject→rejected) and edits fields; sets `accepted_at` on accept.
- `GET /meals/dashboard` returns stats (confirmed/capacity/revenue/
  meals), orders, prep_summary, unmatched.

## Test results to attach
`meals-p2.test.js` all green; `pnpm qa` GREEN (66 + new spec); zero
regression vs prior runs.
