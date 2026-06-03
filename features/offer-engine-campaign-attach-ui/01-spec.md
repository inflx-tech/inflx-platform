# offer-engine-campaign-attach-ui — Sub-contract C (UI): wizard library picker

> **Sub-contract C of 4, UI portion.** Wires the saved-offer library into the
> campaign creation wizard so a brand can **attach a pre-built offer to an
> influencer** (handpick) instead of authoring a discount inline — activating the
> C-backend attach spine. UI-governed (brand-web). Builds on the live
> `/brands/me/offers` (B) + the invite/update `brand_offer_id` support (C-backend).

## Problem / goal
C-backend made invite/updateInfluencer accept `brand_offer_id` (snapshot +
allocation). But the wizard never sends it, so the capability is dormant. This
contract adds the in-wizard **"Use a saved offer"** picker on the per-influencer
offer step, so brands actually reuse library offers in campaigns.

## Scope
- **In scope:**
  - `campaigns/new/page.js`: load the brand's **active** library offers
    (`brandApi.getOffers({status:'active'})`); add `brand_offer_id` to the
    per-influencer model (`mkInf`) + draft hydration.
  - On the **handpick** per-influencer offer step (conversion/hybrid): a "Use a
    saved offer" `<select>`. Picking one sets `brand_offer_id` (+ mirrors the
    offer type into the existing `offer_type` label so validation passes) and
    shows a "Using saved offer" summary in place of the inline builder. Choosing
    "Author inline" clears it and restores the existing inline authoring
    (coexist — inline path unchanged).
  - Invite/update payload sends `brand_offer_id`; when set, `offer_config_json`
    is omitted (backend snapshots from the library row — client config ignored).
- **Explicitly out of scope:**
  - **Engagement-promotional** offer UI (showing the offer step for engagement) →
    deferred to **Sub-contract D**, because an engagement promotional offer is
    only follower-actionable via D's store-direct path; shipping it before D
    would attach offers followers can't act on.
  - Open-group **group-level** library offers (this is the handpick per-influencer
    path, per the locked mockup) → follow-up.
  - Any backend change (C-backend already shipped).

## Surfaces touched
- **App(s):** brand-web only (`app/dashboard/campaigns/new/page.js`), Vercel.
- **Roles:** brand (existing wizard auth).

## Data / contracts
- **No new endpoints.** Reads `GET /brands/me/offers?status=active` (B); sends
  `brand_offer_id` on `POST …/invite` + `PATCH …/influencers/:ciId` (C-backend).
- The picker maps a saved offer's `offer_type` key → the wizard's display label
  via `OFFER_KEY_TO_LABEL` so existing offer-step validation is satisfied.

## Non-functional
- **Auth/role gates:** inherited from the wizard.
- **Failure modes:** if the brand has no active offers, the picker is hidden and
  the inline builder shows exactly as today (zero change). Backend rejects a
  cross-brand/archived `brand_offer_id` (C-backend) → surfaced via the wizard's
  existing error handling.
- **Deploy posture:** PRODUCTION-IMPACTING (brand-web → Vercel) but **additive**:
  the saved-offer picker only appears when active offers exist and a brand opts
  into it; the inline authoring path is byte-unchanged. UI-governed → mockup-lock
  + before/after-diff gates apply.
