# Feature Spec — Creator store auto-fills from live allocation

> Order: Phase **2b** of `_MERCH_ENGINE_ROADMAP.md` · Depends on: — · Status: **STUB (draft, not locked)**.
> Second of 3 Phase-2 (visibility gate) sub-contracts. **Backend-only** (not UI-governed).

## Problem / goal
The founder's locked model: a creator's store **auto-fills** from the products
inside their **live campaign offers** — **no hand-picking**. Today
`follower.service.resolveStore()` does the opposite: it shows **only** products
the creator hand-published via `influencer_product_notes`; the products actually
**allocated** to the creator (in the offer's `ci_offer_config` + the campaign's
`products_json`) are computed only to drive a *"still curating"* empty state and
are **never shown** unless the creator hand-picks them. Goal: show the
**allocated** products automatically; keep any creator note as an optional
annotation.

Roles: **follower** (sees a creator's allocated products in their store), **creator** (no action needed — products appear when their campaign goes live).

## Scope
- **In scope:**
  - In `resolveStore()`, replace the **notes-gated** product list (`publishedIds`) with the **allocated** product IDs derived from each live offer: `ci_offer_config` product arrays (`products`, `d_prods`, `v_prods`, `bnd_prods`, bogo `buy_product`/`get_product`, free_gift `offers[].main/gift`) ∪ the set's `products_json`.
  - Fetch those products (`is_active = true`) and show them automatically; keep `influencer_note` (from notes) as an optional per-product annotation when present.
  - Remove the "still curating" empty state's reason to exist for allocated offers (products now populate).
- **Explicitly out of scope:**
  - `pushed_to_store` does NOT gate the creator store — allocation is its own visibility path (a product allocated to a creator shows in *their* store even if the brand hasn't pushed it to the *brand* store).
  - Platform-page gate (Home/Category/deals) → **2c**.
  - The dormant `influencer_store_inventory` table (mig 094) — not used; allocation is derived from live offers.
  - No schema change, no migration, no mobile change (the mobile creator store already renders `offers[].products[]`).

## Surfaces touched
- backend only (`follower.service.resolveStore`).
- Roles: follower (read). No mobile/web file change.

## Data / contracts
- **Tables:** none new. Reads `campaign_influencers` (live, via `ACTIVE_CI_QUERY`), `campaign_offers.products_json`, the offer-config snapshot, `brand_products`.
- **Endpoints:** `GET /store/:influencer_handle` (resolveStore) — same response shape; `offers[].products[]` now populated from allocation instead of notes.
- **Money/attribution:** none changed (the 4-ID tracking on each offer is unchanged).

## Non-functional
- **Auth/role gates:** unchanged (public/auth store read as today).
- **Failure modes:**
  - An offer with no derivable allocated products → empty `products[]` (graceful; offer card still shows the deal).
  - Malformed `products_json` / config → caught, treated as no products (no crash).
  - Only **active** products shown; inactive allocated products are filtered out.
  - Behaviour change is intended (creator stores now show allocated products that were previously hidden behind the curation gate) — low live-data volume; the founder approved auto-fill.
