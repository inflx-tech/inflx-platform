# offer-engine-engagement-ui — Sub-contract D3a: engagement-promotional offer UI (brand-web)

> **Part of Sub-contract D, brand-web slice.** Extends the campaign wizard's
> saved-offer picker (shipped in C-UI) to **engagement** campaigns, so a brand
> can attach a promotional offer for influencers to feature — no commission, no
> coupon. The backend already supports this (C-backend `allocation='promotional'`;
> D1/D2 store-direct purchase). UI-governed (Vercel, no Maestro).
> The follower-mobile STORE DEAL rendering + buy is the sibling **D3b** (mobile,
> Maestro + OTA).

## Problem / goal
C-UI deferred the engagement offer UI until the follower store-direct path
existed. With D1 (publish/surface) + D2 (store-direct purchase) now live, the
wizard can let brands attach a **promotional** offer to engagement-campaign
influencers: the influencer features it for awareness, and followers buy it
store-direct (no commission). This contract shows the offer picker for the
engagement goal and sends `brand_offer_id`/offer for engagement.

## Scope
- **In scope (brand-web):**
  - Show the per-influencer offer section for **engagement** goal (previously
    gated to conversion/hybrid only), with promotional copy ("no commission, no
    coupon; followers buy it as a store deal") and an **optional** offer.
  - Reuse the existing saved-offer picker (C-UI) + inline fallback.
  - Submit: send `offer_type` / `brand_offer_id` / `offer_config_json` for
    engagement (backend sets `allocation='promotional'`, rejects commission/coupon
    — which the engagement UI never sends).
- **Explicitly out of scope:**
  - Follower-mobile STORE DEAL render + store-direct buy wiring → **D3b**.
  - Open-group group-level offers → follow-up.
  - No backend change (C-backend + D2 already live).

## Surfaces touched
- **App(s):** brand-web only (`app/dashboard/campaigns/new/page.js`), Vercel.
- **Roles:** brand.

## Data / contracts
- No new endpoints. Engagement invite now carries `brand_offer_id` (+ optional
  inline `offer_type`/config) → `POST …/invite` (C-backend), which derives
  `allocation='promotional'` for the engagement goal.
- Commission/coupon are never sent for engagement (UI doesn't expose them;
  backend rejects them defensively).

## Non-functional
- **Auth/role gates:** inherited from the wizard.
- **Failure modes:** no active offers → picker hidden, engagement offer simply
  omitted (pure-engagement campaign, unchanged). Offer is optional for engagement
  (no validation requires it).
- **Deploy posture:** PRODUCTION-IMPACTING (brand-web → Vercel) but additive — the
  offer section now appears for engagement; conversion/hybrid behaviour unchanged;
  no backend/OTA. UI-governed → mockup-lock + before/after-diff gates apply.
