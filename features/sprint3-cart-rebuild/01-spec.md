# Sprint 3 — Cart Rebuild + Variant Cart + Organic Delivery

> Contract slug: `sprint3-cart-rebuild`. Closes walkthrough **W9(e)**
> ("Add to Cart → cart page pay disabled") and the online-order silent-loss
> funnel-killer from the journey map. Founder go: "Ok pls proceed" +
> decision "**build organic delivery now**" (2026-06-12).

## Problem (verified at the data layer, 2026-06-12)

`OnlineOrderScreen` (the cart) and the online-order backend never agreed,
so **every** online order 422'd or silently lost data.

### Defect 1 — Cart payload is wrong on six counts
`OnlineOrderScreen.js:53-60` vs backend `placeOrder`
(`transaction.controller.js:1119-1122`, which hard-requires
`campaign_id && set_id && campaign_influencer_id && items`):

| Screen sends | Backend reads | Effect |
|---|---|---|
| `campaign_set_id` | `set_id` | undefined → **422** |
| *(omitted)* | `campaign_influencer_id` (required) | undefined → **422** |
| `delivery_address_id` | `address_id` | address dropped |
| `items[].qty` | `items[].quantity` | `parseInt(undefined)` → NaN |
| *(omitted)* | `items[].variant_id` | variant never priced |
| `offer_id: offer.id` (brand_offers **library** id) | passed to `validateTracking` | wrong id space |

### Defect 2 — Address add never refreshes the cart
`OnlineOrderScreen.js:121` passes `onSave: () => {}` (a no-op), and the
address list is fetched **once on mount** (`:29-37`). After a follower
adds an address it never appears, can't be selected, and Place Order
stays disabled forever.

### Defect 3 — No organic path (backend gap, not just the screen)
`placeOrder` calls `validateTracking` (`transaction.service.js:139`),
which hard-joins a real `campaign_influencer` row. There is **no branch**
for a follower ordering for delivery without a creator deal. Organic
delivery is impossible today.

### Variant data model (verified on prod 2026-06-12 — corrects the plan)
Fashion/furniture products store their matrix in **`variants_json.colors[]`**
— `[{ color, sizes:[{ sku, size, price, stock }], images }]` — and have
**zero `product_variants` table rows** (the wizard never writes them). So:
- Variant identity = the **SKU string** (e.g. `CHAR-0001-WHI-XS`), not a
  `product_variants` uuid. `variant_id` stays **null**.
- Per-size `price` is null everywhere → variant price = base product price.
  No variant-level pricing to resolve today.
- The existing size block reads `variants_json.sizes`/`.options`, which
  real products never have (they use `colors[].sizes`) — that's the true
  reason the picker "never renders". Fix = read `colors[]` (colour-first).
- Carry chosen **colour·size + SKU** as display/fulfillment metadata in
  `items_json`; no `product_variants` backfill needed this sprint.

### Variant model — what's actually missing
Verify-twice correction: the prompt's "variant-picker/add-ons UI never
rendered" is **stale** — `ProductDetailScreen.js:453-485` already renders
the add-on rows and a single-select **size** chip row, and threads
`selected_size`/`selected_addons` into checkout (`:337-338`). The real
gaps are:
- **No colour selector** — only `selectedSize` exists.
- **No `variant_id` mapping** — `selected_size` is a cosmetic label
  string; it never resolves to a priced `variant_id`. The backend already
  supports variants (`fetchVariantPriceMap`, `items_json.variant_id`),
  so this is pure frontend wiring.
- **Cart drops variants** — `OnlineOrderScreen` ignores the passed
  `selected_size`/`selected_addons` and rebuilds bare `{product_id,qty}`.

## Goal / end state

1. A creator-mediated online order places successfully end-to-end
   (correct payload, variant priced, address selectable).
2. An **organic** online order (no creator/offer) places end-to-end via a
   new brand-direct backend path — zero discount, zero commission,
   L3 brand-direct fee, `follower_transactions` row with
   campaign/set/CI/offer all NULL. Mirrors the already-shipped
   `store-offer/pay` organic path.
3. Fashion + furniture products expose **size and colour**, mapped to a
   priced `variant_id` carried all the way into the order.
4. Adding a delivery address refreshes the list and auto-selects it.

## Scope

- **Backend** (`transaction.controller.js`): organic branch in
  `placeOrder` (when no `campaign_influencer_id`: skip `validateTracking`,
  approved-brand lookup, no offer, no commission, brand-direct L3 fee,
  variant pricing via `fetchVariantPriceMap`); `verifyOrder` tolerates
  null CI (guard coupon/`getInfluencerByCiId`, skip influencer
  attribution). New journey test: organic online order E2E.
- **Frontend** (`OnlineOrderScreen.js`): correct payload keys; real
  `onSave` refresh; variant lines (size/colour/add-ons displayed +
  `variant_id`+`quantity` forwarded); organic branch (send `brand_id`,
  no CI) when `tracking` is absent.
- **Frontend** (`ProductDetailScreen.js`): colour selector beside size;
  size×colour → priced `variant_id` from `variants_json`; forward
  `variant_id`.

## Non-goals

- Made-to-order furniture lead-time handling (CTA_SPEC open flag — defer).
- Restaurant dish cart (separate meals flow; this sprint is retail
  fashion/furniture).
- Razorpay live settlement (Wave 3, gated).

## Verification

`pnpm qa` GREEN + `journey-phase-a.js` on LOCAL dev (Docker `db:dev:up`,
`SECTION_ENGINE_OFFERS=true`) including the new organic online-order
assertion; esbuild parse-check on touched screens; founder device verify
before `released=true`.
