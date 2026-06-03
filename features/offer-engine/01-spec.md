# offer-engine — Sub-contract A: standalone offer library spine (backend)

> **Sub-contract A of 4** in the Offer Engine feature.
> The backend foundation: the `brand_offers` library table, the
> per-influencer attachment + store-publish columns (additive, dormant),
> the shared offer-config validator, and the brand-facing CRUD API.
> Sub-contracts B (library UI), C (campaign-wizard per-influencer attach,
> goal-keyed) and D (publish-to-store + store-direct transaction path +
> follower mobile) build on this. **Backend-only — no UI in this contract.**
> Ships **dormant**: with zero `brand_offers` rows and no caller wiring,
> nothing in production behaves differently until B/C/D land.

## Problem / goal
Today a discount/offer exists only as a child of a campaign — it is authored
inline in the campaign wizard and stored on `campaign_offers` (set-level) +
`campaign_influencers.offer_type/offer_config_json` (per-influencer edge). A
brand cannot design an offer once and reuse it. This feature promotes "offer"
to a **brand-owned, catalogue-scoped, reusable library object**, without
disturbing the existing in-campaign discount builder (they **coexist**).

The engine that *applies* an offer already exists and is reused unchanged:
`backend/src/services/offer.service.js` `resolveOfferDiscount(...)` + the
`offer_config_json` shapes (discount / volume / bogo / bundle / free_gift) +
the 3-tier scope model (store / category / products). This contract adds the
**ownership + storage** layer that produces the *same* config the engine
already consumes.

Locked model (founder, 2026-06-03) — a library offer reaches followers through
**3 channels**; the campaign **goal** decides behaviour:
- **① Store** — `brand_offers.published_to_store=true` (set on the offer page).
  All followers buy **direct**: no influencer, **no commission, no tracking**.
  (Store-direct transaction path = Sub-contract D.)
- **② Conversion campaign** — offer attached to influencers **inside campaign
  creation**, per influencer; tracked link (4 IDs) + commission.
  `allocation='commissioned'`. (Wizard wiring = Sub-contract C.)
- **③ Engagement campaign** — same per-influencer attach but **no commission,
  no tracking**; the offer simply appears on the influencer as promotional
  content driving awareness to the store. `allocation='promotional'`. Relaxes
  today's rule "engagement → offer_type must be null". (Wizard = Sub-contract C.)

Influencer distribution is **campaign-mediated only** (never a standalone
assign); the offer page carries only the Store toggle.

## Scope
- **In scope (this contract):**
  - Migration `084_offer_engine.sql` (+ prod runner `scripts/run-084.js`),
    additive + idempotent:
    - new table `brand_offers` (the library);
    - additive columns on `campaign_influencers`: `brand_offer_id`,
      `allocation` (dormant until Sub-contract C writes them);
    - additive store-publish columns on `brand_offers`
      (`published_to_store`, `store_starts_at`, `store_ends_at`) — dormant
      until Sub-contract D reads them.
  - **Shared offer-config validator** extracted into
    `backend/src/services/offerConfig.validator.js`: one function validating
    `offer_type` ∈ the canonical set + the per-type `offer_config_json` shape +
    that every referenced product/section belongs to the brand. Both the new
    library CRUD and (later, Sub-contract C) the campaign path call it — one
    validator, no drift.
  - **CRUD API** under `/brands/me/offers` (`brandOffer.controller.js` +
    `brandOffer.routes.js`): list / create / get / update / archive. Brand owns
    its offers; cross-brand access blocked.
  - QA: API/DB tests proving CRUD, validation rejections, brand-ownership
    enforcement, product-ownership enforcement, and **zero regression** to the
    existing campaign-create and follower-transaction read paths (new columns
    are nullable/defaulted and unread by current code).
- **Explicitly out of scope (later sub-contracts):**
  - `/dashboard/offers` library UI + the shared `<OfferBuilder/>` component
    extracted from the campaign wizard → **Sub-contract B** (UI-governed).
  - Campaign-wizard "attach an offer → open library picker → assign per
    influencer", the `allocation` write, and relaxing the engagement-no-offer
    rule → **Sub-contract C** (UI + backend).
  - `published_to_store` consumption: `resolveBusinessStore()` union, the
    **store-direct (nullable tracking IDs, no-commission) transaction path**,
    `offer_source`, and follower-mobile STORE DEAL rendering → **Sub-contract D**
    (backend + mobile, heaviest; engagement purchases also land here).

## Surfaces touched
- **App(s):** backend only.
- **Roles involved:** brand (CRUD over its own offer library, authenticated).
  No follower/influencer-facing surface in this contract.

## Data / contracts

### New table (migration `084_offer_engine.sql`, additive, idempotent)
**`brand_offers`** — a brand's reusable, catalogue-scoped offer.
- `id uuid pk default gen_random_uuid()`
- `brand_id uuid not null references brands(id)`
- `name varchar(150) not null` (internal label + shown on store)
- `offer_type text not null check in ('discount','volume','bogo','bundle','free_gift')`
- `offer_config_json jsonb not null` (the exact shape `resolveOfferDiscount`
  consumes — see offer.service.js header; validated by the shared validator)
- `availing_modes text[] not null default '{pay_at_store,online_order}'`
  (mirrors `campaign_offers.availing_modes`)
- `status text not null default 'draft' check in ('draft','active','archived')`
- `published_to_store boolean not null default false`  *(dormant → Sub-contract D)*
- `store_starts_at timestamptz null`, `store_ends_at timestamptz null` *(dormant → D)*
- `created_at timestamptz default now()`, `updated_at timestamptz default now()`
- index `idx_brand_offers_brand on brand_offers (brand_id, status)`

### Additive columns on existing tables
**`campaign_influencers`** (dormant until Sub-contract C):
- `brand_offer_id uuid null references brand_offers(id) on delete set null`
  — provenance pointer. The offer config is still **snapshotted** into the
  existing `offer_type` + `offer_config_json` columns at attach time, so editing
  a library offer never mutates a live/contracted attachment.
- `allocation text null check in ('commissioned','promotional')` — set by the
  wizard in C: `commissioned` (conversion) vs `promotional` (engagement).
  NULL on every existing row → no behaviour change.

### New API endpoints (all `requireBrand`, scoped to the caller's brand)
| Method + path | Request | Response |
|---|---|---|
| `GET /brands/me/offers` | `?status=&type=&q=` (optional filters) | `{ offers: [BrandOffer], counts: {...} }` |
| `POST /brands/me/offers` | `{ name, offer_type, offer_config_json, availing_modes? }` | `201 { offer: BrandOffer }` |
| `GET /brands/me/offers/:id` | — | `{ offer: BrandOffer }` (404 if not this brand) |
| `PATCH /brands/me/offers/:id` | partial `{ name?, offer_config_json?, availing_modes?, status? }` | `{ offer: BrandOffer }` |
| `DELETE /brands/me/offers/:id` | — | `{ offer: BrandOffer }` (soft → `status='archived'`; never hard-deleted while referenced) |

`offer_config_json` is validated by `offerConfig.validator.js` on create/update;
invalid type or shape, or a referenced product not owned by the brand →
`400 VALIDATION_ERROR` with the offending `field`.

### Money / units / attribution
- All rupees `numeric(x,2)` per platform convention; offer values live inside
  `offer_config_json` exactly as the campaign path stores them today.
- No attribution / commission / transaction logic in this contract — the new
  `campaign_influencers` columns are written by C and read by C/D; the
  store-publish columns are read by D. Existing money paths untouched.

## Non-functional
- **Auth/role gates:** all endpoints `requireBrand`; every query filtered by the
  authenticated `brand_id`. A brand can never read/modify another brand's offers
  or reference another brand's products.
- **Failure modes handled:**
  - Invalid `offer_type` or malformed per-type `offer_config_json` → 400, no row
    written.
  - Referenced product/section not owned by the brand → 400 with `field`.
  - Archive of an offer referenced by live `campaign_influencers` → allowed
    (soft archive); the FK is `on delete set null` and config is snapshotted, so
    live attachments are unaffected.
  - Cross-brand id in path → 404 (not 403, to avoid id enumeration).
- **Deploy posture:** PRODUCTION-IMPACTING but **DORMANT** — migration 084 + the
  CRUD service ship live; with zero `brand_offers` rows and no caller wiring, no
  existing flow changes. Activates only when B/C/D land. (Same dormant-ship
  pattern as `referral-engine` Contract 1.)
