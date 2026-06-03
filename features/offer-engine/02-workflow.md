# Workflow Definition — offer-engine Sub-contract A (backend CRUD)

> Step 3. Each numbered step becomes an assertion in the QA workflow test.
> Backend/API-level workflow (no UI this contract).

## Actor
Logged-in **brand**, approved, with a valid JWT. Has ≥1 `brand_products` row
(used to test product-scoped offers + ownership).

## Preconditions
- Migration `084_offer_engine.sql` applied (table + columns exist).
- Seeded: brand A with products P1, P2 (owned); brand B with product Q1.
- Zero pre-existing `brand_offers` rows.

## Workflow steps (API-observable)
1. Brand A `POST /brands/me/offers` with a valid **discount** config
   `{name, offer_type:'discount', offer_config_json:{sub_type:'pct',value:20,scope:'category',category:'Footwear',products:[]}}`
   → `201`, returns offer with `status='draft'`, `published_to_store=false`,
   `brand_id = A`. Row exists in `brand_offers`.
2. Brand A `POST /brands/me/offers` for each remaining type (volume / bogo /
   bundle / free_gift) with a well-formed config → each `201`; the stored
   `offer_config_json` round-trips byte-for-byte.
3. Brand A `GET /brands/me/offers` → returns all of A's offers (and only A's),
   with `counts` by status; brand B's offers (if any) never appear.
4. Brand A `PATCH /brands/me/offers/:id` `{status:'active'}` → `200`,
   `status='active'`; `updated_at` advanced.
5. Brand A `DELETE /brands/me/offers/:id` → `200`, `status='archived'` (row still
   present — soft archive, not removed).
6. Brand A `GET /brands/me/offers/:id` for **brand B's** offer id → `404`
   (no cross-brand read).
7. Brand A `POST /brands/me/offers` with `offer_type='nonsense'` → `400
   VALIDATION_ERROR`, `field='offer_type'`, no row written.
8. Brand A `POST /brands/me/offers` with a discount config whose `products`
   include brand **B's** product Q1 → `400 VALIDATION_ERROR`,
   `field='offer_config_json.products'`, no row written.
9. **Regression assertions:** an existing campaign-create flow and an existing
   follower-transaction read still succeed unchanged; `campaign_influencers`
   rows created before this migration have `brand_offer_id IS NULL` and
   `allocation IS NULL`; `resolveOfferDiscount` output for an existing
   `offer_config_json` is identical pre/post migration.

## Success definition
The workflow is SUCCESSFUL only if the final state is:
- A brand can create (all 5 types), list, fetch, update, and soft-archive offers
  scoped strictly to its own `brand_id`; every offer's `offer_config_json` passes
  the shared validator and round-trips unchanged; invalid type/shape and
  cross-brand product references are rejected with `400` and no row written;
  cross-brand id access returns `404`; and **no existing campaign or transaction
  behaviour changes** (the new columns are nullable/defaulted and unread by
  current code).

## Failure / edge workflows
- Unauthenticated request → `401`, API not executed.
- `requireBrand` fails (influencer/follower/admin token) → `403`.
- Malformed per-type config (e.g. bundle with no `bundle_price`, volume with no
  `tiers`) → `400 VALIDATION_ERROR` with the offending `field`; no row written.
- Archive of an offer referenced by a (future) live attachment → still succeeds;
  the snapshot on `campaign_influencers` keeps the attachment intact.
