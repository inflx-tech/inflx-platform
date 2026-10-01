# offer-add-products — workflow

Website, Listings → Offers → open a Scheduled or Live offer.

## W1 · Add products (no creator has the offer)
1. **Add products** → a panel opens above the pool: Browse by category, or Search products.
2. The brand ticks products. A product in another offer on these days shows 🔒 with that offer's name
   and end date and can't be ticked; a product already here shows "In pool".
3. **Add N products** → the server checks again (A2–A5) and adds them.
4. End state: the products are in the pool, locked to this offer until its end date; the pool count
   goes up; a toast says "N products added. They're locked to this offer until 6 Oct."
5. Refused → the reason shows in the panel in plain words; nothing is added.

## W2 · Remove products (no creator has the offer)
Unchanged from offer-builder-v2 W3, minus everything about creators: tick → confirm → the products are
free at once.

## W3 · The offer has been given to a creator
1. The page shows the notice (spec) under the title. **Add products** and **Remove products** are
   greyed out and do nothing. **End offer now** works as before.
2. The Pool tile reads "products · frozen".
3. If a creator is given the offer while the page is open and the brand then tries to add or remove:
   the server refuses, the page shows the refusal and reloads into the frozen state.

## Build path
Founder instruction (chat + screenshot) → this contract → server rule + page → tests
(`tests/offer-add-products.test.js`, two drifted checks rewritten) → rules doc v1.14 → walk on a
local preview → **explicit go** → push (Render + Vercel). No migration, no OTA.
