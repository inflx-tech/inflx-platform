# offer-engine-store-publish — Sub-contract D, Phase 1: publish + surfacing (backend)

> **Sub-contract D of 4 — Phase 1 (backend).** Lets a brand **publish a library
> offer into its store**, and surfaces published offers in the brand-store feed
> as brand-direct (no-influencer) offers. Plus the additive provenance columns
> the store-direct purchase path will write. **Ships dormant** — store offers are
> returned in a distinct `store_offers` array that current follower-mobile
> ignores, and nothing transacts against them yet.
> Follow-ups: **D2** (store-direct purchase endpoints — the money path) and
> **D3** (follower-mobile STORE DEAL rendering + buy + the engagement-promotional
> offer UI in the wizard).

## Problem / goal
The Offer Engine's third distribution channel (Store) needs: (a) a way for the
brand to flip an offer to "in store", (b) those offers surfaced to followers, and
(c) the schema to attribute a future store-direct purchase to a `brand_offers`
row with no influencer. Phase 1 lands (a)+(b)+(c)-schema safely and dormant; the
actual purchase + mobile UI are D2/D3.

## Scope
- **In scope (D Phase 1, backend):**
  - Migration `085_offer_store_direct.sql` (+ `run-085.js`): additive columns on
    `follower_transactions` — `brand_offer_id` (FK→brand_offers, nullable) and
    `offer_source text NOT NULL DEFAULT 'influencer' CHECK in ('influencer','store')`.
    The 4 tracking IDs are already nullable (migration 001) — no relaxation needed.
  - `brandOffer.controller.updateOffer`: accept `published_to_store`,
    `store_starts_at`, `store_ends_at` (columns already exist from `084`).
  - `follower.service.resolveBusinessStore`: add a `store_offers` array — a query
    over `brand_offers` where `published_to_store=true AND status='active'` and
    within the optional store window. Brand-direct (no influencer), `offer_source:'store'`.
  - QA: publish persists; store feed surfaces published+active offers; unpublished
    excluded; migration columns present; **zero regression** to the existing store
    feed (`influencers[].offers` unchanged).
- **Explicitly out of scope (D2 / D3):**
  - The **store-direct purchase path** (new `/follower/store-offer/pay` + verify:
    skip `validateTracking`, query `brand_offers`, commission=0, `path='direct'`,
    insert with `brand_offer_id` + `offer_source='store'` + null tracking IDs) →
    **D2**. (The money path; the infra supports it — `classifyPath` already
    handles null `campaign_influencer_id`.)
  - Follower-mobile **STORE DEAL** rendering + buy wiring → **D3** (Mobile-governed;
    Maestro gate; OTA).
  - The **engagement-promotional** offer UI in the campaign wizard → D3 (its
    purchases land on the store-direct path).

## Surfaces touched
- **App(s):** backend only (migration + `brandOffer.controller` + `follower.service`).
- **Roles:** brand (publish, authenticated); follower (store read — public).

## Data / contracts
- Migration `085`: `follower_transactions.brand_offer_id` + `.offer_source`.
- `PATCH /brands/me/offers/:id` now accepts `published_to_store`,
  `store_starts_at`, `store_ends_at`.
- `GET /business/:brand_id/store` response gains `store_offers: [{ brand_offer_id,
  name, offer_type, offer_config_json, availing_modes, offer_source:'store' }]`.

## Non-functional
- **Auth/role gates:** publish via the existing brand-scoped offer CRUD; store
  read is public (unchanged).
- **Failure modes:** no published offers → `store_offers: []`; archived/draft or
  out-of-window offers excluded by the query.
- **Deploy posture:** PRODUCTION-IMPACTING (migration 085 + `backend/src`) but
  **DORMANT** — `store_offers` is a new array current mobile doesn't read; the new
  columns have no writer until D2; `resolveBusinessStore`'s existing output is
  unchanged. Backend-only → Render + a prod migration. Explicit go before deploy.
