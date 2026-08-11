# Expected outputs — Part 1 Corrections

## Backend

**Offer validation** (`offerConfig.validator.js`)
- Rejects any referenced product not owned by the brand (existing behaviour, retained).
- **New:** rejects any referenced product with `pushed_to_store = false`, with a message
  naming the offending product(s), on field `offer_config_json.products`.
- Vocabulary and shape checks unchanged.

**Campaign offer attachment** (`campaign.controller.resolveOfferAttachment`)
- **New:** the inline path (no `brand_offer_id`) runs `validateOfferConfig`. Failures return
  `VALIDATION_ERROR` 422 with the validator's field.
- Library path unchanged — ownership and archived checks already existed, and the library
  offer was already validated when it was created.

**Product unpublish**
- Turning off `pushed_to_store` succeeds and returns the list of offers referencing that
  product so the caller can warn. No blocking, no mutation of the offers.

**Creator storefront / coupon resolve** (`follower.service.js`)
- Displayed discount value no longer falls back to `commission_pct`. A collaboration with a
  commission and no discount reports no discount.

**Offer-type normalisation**
- One canonical set: `discount | volume | bogo | bundle | free_gift`.
- A shared normaliser maps legacy values (`Discount`, `Volume discount`, `BOGO`, `Bundle`,
  `Free gift`, `flat`, `percentage`) to canonical, and is applied on read.
- Migration converts existing `campaign_influencers.offer_type` rows.

## Web (brand-web campaign creation)

- Step 1 money card: real wallet balance; hidden entirely when no set needs funding;
  checklist ticks reflect real state. No hardcoded ₹2,50,000, no pre-ticked "Wallet topped
  up".
- Start date: the 7-day minimum is gone.
- Offer payloads send canonical offer-type keys; display labels remain in the UI only.
- **Unchanged:** step order, step count, goal placement, layout, palette.

## Mobile (brand invite)

- Offer type sent as canonical `discount`; flat vs percentage carried in the config
  sub-type, matching the web wizard's stored shape.

## Migration

- One additive, idempotent migration converting legacy `campaign_influencers.offer_type`
  values to canonical. No column drops, no constraint that would reject historical rows
  before conversion.

## Verification

- `pnpm qa` green with no new failures.
- Maestro required only if `Packages/Mobile/src/**` ships in the same release.
- Before/after diff notes in `06-diff/notes.md` for the web UI change.

## Explicitly NOT in the output

- No change to sales / engagement / hybrid behaviour.
- No change to the budget model, dates, escrow, tranches, wallet locking, allocation, or
  the set-level offer table.
- No new screens, routes or concepts.
