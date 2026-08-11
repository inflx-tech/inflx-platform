# Expected outputs — Part 4 Offers and allocation

## Schema (additive)

- A per-creator **allocation** carrying `scope` (`store` | `category` | `products`), the
  category reference for category scope, and the product list for product scope.
- An **expiry** for a campaign-level offer.
- Migration backfilling allocation scope for the 19 existing production collaborations from
  their offer's current scope. Additive, idempotent, nothing dropped, no constraint that could
  reject historical rows before conversion.

## Backend

**Allocation resolution**
- `resolveAllocatedProductIds` reads **the allocation**, never `offer_config_json.scope`.
- `store` → every active, published product of the brand. `category` → the recursive subtree.
  `products` → the stored list. Store and category resolve live, so new published products
  auto-join.
- No allocation → no products, and the creator is not surfaced.

**Offer-required gates removed (7)**
`follower.service.js:114,162` · `follower.controller.js:729,752` and the `resolveCoupon`
throw at `:1773` · `brandOffers.adapter.js:390` · `transaction.service.js:165`.
A creator with an allocation and a commission but no offer must pass all of: discovery,
storefront render, coupon resolve, tracking validation, and sale recording.

**Offer resolution (new)**
- Gathers candidates: the creator-specific offer(s) plus every **published and live** global
  library offer for that brand.
- Scores each candidate against the whole cart using the **existing, unmodified**
  `resolveOfferDiscount`.
- Applies the single best result. Never combines, never stacks.
- Returns which offer won and why, so storefront and receipts can say so.
- Caps and logs if a brand accumulates many offers — never degrades silently.
- **`offer.service.js` money maths unchanged.** Any diff inside it is out of scope for this
  contract.

**Display resolution**
- A product tile shows the best *simple* discount applicable to that product for that creator.
- Cart-shaped offers (volume, bundle, BOGO) surface as an availability badge, not a price — a
  tile has no cart to evaluate.

**Offer expiry**
- A campaign-level offer past its expiry stops discounting; allocation, storefront and
  commission continue.
- Library offers' `store_starts_at`/`store_ends_at` honoured on the coupon path, where they are
  currently ignored.

**Set-level table retired from read paths**
- Each of the 49 references removed with a before/after equivalence check. Zero rows in prod
  makes each removal provably inert.

## Web (brand-web campaign creation)

- A **scope chooser per creator**, separate from the offer builder: entire store / category /
  specific products, reusing the existing category and product pickers.
- Requires its own mockup + `mockup_locked` before any `Packages/**` commit (gov-check Rule 3).
- Step order, step count and goal placement unchanged — the founder ruled out structural change.

## Verification

- `pnpm qa` green, run twice: after §4.1/4.2/4.4/4.5, and again after §4.3.
- New tests must cover W7 (full-price commission-only sale end to end), W10–W13 (resolution and
  no-stacking), W2/W3/W4 (auto-join behaviour per scope), and W6 (migrated collabs resolve to
  the same product set as before).
- Before/after diff notes in `06-diff/notes.md` for the wizard change.
- Maestro only if `Packages/Mobile/src/**` is touched.

## Explicitly NOT in the output

- No change to commission maths, attribution, settlement, return windows or TDS.
- No change to the pure pricing engine's calculations.
- No cart splitting, per-line offer assignment or group subtotals — the design that created
  §5.2/§5.3 and was dropped.
- No stock decrement. No explicit per-creator product picker beyond the three scope shapes.
- Nothing from Parts 2, 3, 6 or 7.
