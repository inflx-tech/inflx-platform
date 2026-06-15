# Feature Spec — Offer/discount section rules (Phase 3d)

> Adds an OFFER/DISCOUNT dimension to the Section Library rule-builder (extends 3a
> evaluator + 3b UI). UI-governed (brand-web admin) + backend. No migration.

## Problem / goal
The section rule today = category + sub-category + tags + price + sort. There's **no way to
build "products with ≥X% off" or "products that have a live offer"** — even though brands
create offers in the Offer Engine and publish them to store. **Goal:** two new rule selectors
— **Has a live offer** + **Minimum discount %** — evaluated by joining `brand_offers`
(published-to-store, live), stacking with all existing filters + surface context.

## Decisions (locked 2026-06-15)
- v1 filters = **has_offer** (toggle) + **min_discount_pct** (number).
- **Store-wide offers apply to ALL the brand's products** (also category-scoped → match
  `brand_products.section`; product-scoped → product in `offer_config_json.products[]`).
- Offer source v1 = **`brand_offers` published-to-store, live** (status='active' + temporal
  window). Creator-allocated-offer discount filtering = a documented fast-follow.

## Scope
- **In scope:**
  - `sectionLibrary.validateRule`: accept `has_offer` (bool) + `min_discount_pct` (number 0–100).
  - `sectionRules.libraryProducts`: when set, add a correlated EXISTS over `brand_offers`:
    - **live gate**: `status='active' AND published_to_store=true AND (store_starts_at IS NULL
      OR <=now()) AND (store_ends_at IS NULL OR >=now())`.
    - **applies-to-product** (effective scope): `store` → all the brand's products; `category`
      → `bp.section = offer_config_json->>'category'`; `products` → `bp.id` in
      `offer_config_json->'products'`. (Effective scope = `config.scope` else products-present
      ? 'products' : 'store'.)
    - **has_offer** = an applicable offer of ANY type exists.
    - **min_discount_pct** = an applicable `offer_type='discount'` offer with computed pct ≥ X
      (`sub_type='pct'` → value; `sub_type='flat'` → value/bp.price*100, price>0).
  - Rule-builder UI (`app/admin/section-library/page.js`): a **"Has a live offer"** toggle +
    **"Minimum discount %"** input; included in the rule + the live preview.
  - Extend the validation unit test.
- **Explicitly out of scope:**
  - Creator-allocated-offer discount filtering (uses brand_offers/store offers for v1) → fast-follow.
  - Non-discount offer types contributing a % (BOGO/bundle/volume count as has_offer, not toward %).
  - Migration (none — brand_offers exists). Templates/collections (done). Results page (next phase).

## Surfaces touched
- **App(s):** backend (`sectionRules`, `sectionLibrary`) + brand-web admin (section-library builder).
  No mobile, no migration.
- **Roles:** admin (builds rules); follower sees the resulting shelves.

## Data / contracts
- `rule_json` gains optional `has_offer: bool`, `min_discount_pct: number`. No schema change
  (jsonb). No new endpoint (preview already runs the evaluator).
- The offer join reads `brand_offers` (mig 084): `offer_type`, `offer_config_json`
  (`sub_type`/`value`/`scope`/`category`/`products`), `published_to_store`, `store_starts_at/ends_at`, `status`.

## Non-functional
- **Failure modes:** flat offer on a 0-price product → skip (no divide-by-zero); malformed
  offer_config_json → that offer simply doesn't match (no 500); has_offer + min_discount_pct
  both set → AND (must have an offer AND a ≥X% discount offer).
- **Reuse:** same gate/taxonomy/context as 3a; the offer predicate is additive EXISTS clauses.
- **Deploy:** backend (Render) + brand-web (Vercel). No mobile/OTA, no migration. released=false.
