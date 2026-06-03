# offer-engine-campaign-attach — Sub-contract C (backend): per-influencer attach spine

> **Sub-contract C of 4, backend portion**, in the Offer Engine feature.
> Lets the campaign invite/update path **attach a library offer
> (`brand_offers`) to an influencer**, snapshot it onto `campaign_influencers`,
> derive `allocation` from the campaign goal, and **relax the engagement
> "no offer" rule** so engagement campaigns can carry a promotional offer.
> **Backend-only.** The campaign-wizard UI that drives this (library picker +
> per-influencer assignment) is the sibling follow-up `offer-engine-campaign-
> attach-ui`. Ships **dormant**: today's wizard never sends `brand_offer_id`,
> so behaviour is unchanged until the UI lands.

## Problem / goal
Sub-contract A built `brand_offers` + the dormant `campaign_influencers.
brand_offer_id`/`allocation` columns. B built the library UI. Now the
campaign flow must be able to **reference** a library offer when assigning an
influencer — instead of (or alongside) the inline-authored discount — and treat
it per the campaign goal:
- **Conversion / Hybrid** → `allocation='commissioned'` (tracked link + commission,
  the existing behaviour; now also attachable from the library).
- **Engagement** → `allocation='promotional'` (offer appears on the influencer for
  awareness; **no commission, no coupon, no tracking**). This **relaxes** the
  current rule that engagement sets forbid an offer (`campaign.controller.js:793`).

## Scope
- **In scope (backend):**
  - `invite` (`POST /campaigns/:id/sets/:sid/invite`) and `updateInfluencer`
    (`PATCH …/influencers/:ciId`) accept an optional **`brand_offer_id`**.
  - When present: fetch the `brand_offers` row, verify it belongs to the
    campaign's brand and is not archived, and **snapshot** its `offer_type` +
    `offer_config_json` onto the `campaign_influencers` row (authoritative —
    the library config wins; a later edit to the library never mutates this
    attachment). Also store `brand_offer_id` (provenance).
  - **`allocation`** is derived **server-side from the set goal**:
    `engagement → 'promotional'`, `conversion|hybrid → 'commissioned'`. Written
    whenever an offer is present (library OR inline); `NULL` when no offer.
  - **Relax engagement validation**: an engagement set may now carry an offer
    (`brand_offer_id` or inline `offer_type`), but **must not** carry
    `coupon_code` or `commission_pct` (promotional = no commission/tracking).
    Conversion/hybrid still require an offer (unchanged).
  - Inline (non-library) offers keep working exactly as today; they simply now
    also get the correct `allocation` stamped (dormant metadata).
  - QA: attach-from-library (conversion + engagement), cross-brand/archived
    rejection, engagement+commission rejection, and **regression** proof that
    existing inline invites (conversion/engagement/no-offer) behave identically.
- **Explicitly out of scope:**
  - The campaign-wizard UI (library picker, per-influencer assignment, showing
    the offer step for engagement) → sibling `offer-engine-campaign-attach-ui`.
  - Open-group set-level library offers (this contract is the handpick
    per-influencer path; group offers can extend later).
  - Follower-facing consequences of engagement/promotional offers + store-direct
    purchase → **Sub-contract D**.

## Surfaces touched
- **App(s):** backend only (`campaign.controller.js`). No migration (columns
  exist from `084`). No UI, no mobile.
- **Roles involved:** brand (existing campaign auth; `requireApproved`).

## Data / contracts
- **No new tables/columns** — uses `campaign_influencers.brand_offer_id` +
  `allocation` from migration `084`.
- **Changed request bodies** (additive optional field):
  - `invite` / `updateInfluencer` accept `brand_offer_id` (uuid, optional).
- **Writes:** `campaign_influencers.brand_offer_id`, `.allocation`, and snapshots
  `.offer_type` + `.offer_config_json` from the library row when `brand_offer_id`
  is given.
- Allocation values: `'commissioned' | 'promotional'` (per `084` CHECK).

## Non-functional
- **Auth/role gates:** unchanged (brand owns campaign; the brand_offer must
  belong to the same brand or → 404).
- **Failure modes handled:**
  - `brand_offer_id` not owned by this brand → 404.
  - archived `brand_offer_id` → 422.
  - engagement set with `coupon_code` or `commission_pct` → 422.
  - conversion/hybrid with no offer → 422 (unchanged).
- **Deploy posture:** PRODUCTION-IMPACTING (`backend/src`) but **DORMANT** — the
  only behavioural relaxation (engagement may carry an offer) is unreachable
  until the sibling UI sends `brand_offer_id`/offers for engagement; all existing
  requests produce identical results (plus harmless `allocation` metadata that no
  live reader consumes until D). Backend-only → Render redeploy, no migration.
