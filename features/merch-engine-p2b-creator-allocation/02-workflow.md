# Workflow Definition — Creator store auto-fills from live allocation

> Step 3. Backend-only; assertions are API-level.

## Actor
**Follower** opening a creator's store. Precondition: a creator with a **live**
campaign offer whose products are allocated via the offer config / set
`products_json`, and **no** hand-picked `influencer_product_notes`.

## Preconditions
- One influencer with an active `campaign_influencer` (live, date-gated) on an offer that carries allocated product IDs.

## Workflow steps (user-observable)
1. The brand's campaign goes **live** with an offer containing products → the creator does nothing.
2. **Follower** opens `GET /store/:handle` → the offer shows its **allocated products automatically** (not an empty "still curating" state).
3. If the creator happened to write a note for an allocated product, it appears as that product's `influencer_note`.
4. An offer with **no** derivable allocated products → the offer card still shows; `products` is empty (graceful).

## Success definition
- For each live offer, `products[]` = the **active** products allocated by that offer (config ∪ `products_json`), shown without any hand-pick.
- `influencer_note` is present only when a note exists; it never gates visibility.
- Malformed config / `products_json` → empty products, no crash.

## Failure / edge workflows
- Inactive allocated product → filtered out (`is_active = true`).
- Creator not found / no live offers → store resolves with empty offers (unchanged).
- `pushed_to_store=false` on an allocated product → **still shown** in the creator store (allocation is a separate visibility path from the brand-store push gate).
