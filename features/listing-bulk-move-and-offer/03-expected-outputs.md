# Expected outputs — Bulk Move category + Attach offer

## Move endpoint

| # | Expectation |
|---|---|
| M1 | `POST /brands/me/listing-products/move` requires brand auth; another brand's product id is excluded, never moved. |
| M2 | Target must exist and be a leaf; a non-leaf target is a `VALIDATION_ERROR`. |
| M3 | A moved product has `category_node_id`, `category_key`, `super_category` and `section` all rewritten from the target node. |
| M4 | SKU, `variants_json`, photos, price and stock are unchanged by a move. |
| M5 | A product missing a facet the target leaf requires is refused with that facet named. |
| M6 | A product whose source and target `size_system` differ, and which carries size values, is refused with a re-pick-sizes message. |
| M7 | Response shape is per-product: `{ moved: [...], skipped: [{ id, name, reason }] }`. |

## Attach endpoint

| # | Expectation |
|---|---|
| A1 | `POST /brands/me/offers/:id/products` requires brand auth; the offer must belong to the caller. |
| A2 | Only `discount` and `volume` offers are accepted; `bundle`, `bogo`, `free_gift` are rejected with the reason. |
| A3 | An offer explicitly scoped `store` or `category` is rejected — attaching there would be a silent no-op. |
| A4 | Products are merged into `offer_config_json.products` as `{id, name, price}`, deduped by id. |
| A5 | Attaching the same products twice is idempotent and reports how many were already present. |
| A6 | Nothing else in `offer_config_json` is altered — type, value, tiers, availing modes survive untouched. |

## UI

| # | Expectation |
|---|---|
| U1 | Bulk bar shows Move category and Attach offer alongside the existing four actions. |
| U2 | The move modal shows the category tree with only leaves selectable, and disables the confirm button until one is picked. |
| U3 | The offer modal separates eligible from ineligible offers and states why each ineligible one cannot take products. |
| U4 | Both report per-product outcomes, naming skipped products. Never a bare "done". |
| U5 | After either action the table and tree counts refetch from the server. |

## Tests

| # | Expectation |
|---|---|
| T1 | New `qa/unit/listing-bulk-rules.spec.ts` covers the pure eligibility rules: facet-missing refusal, size-system refusal, happy path, and each offer-type / scope rejection. |
| T2 | `pnpm qa` stays GREEN with zero regression against the 98-test baseline. |
