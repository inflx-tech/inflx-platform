# Feature Spec — fix D9: conversion invite needs offer_type (client validation)

> Step 1. GATED on `lock.json.approved = true`. PRODUCTION-IMPACTING
> (brand-web → Vercel). UI-governed → mockup-lock + 06-diff/notes
> required by gov-check (Rules 3+4). Founder GO 2026-05-22: "fix d9".
> First real feature change through the now-enforced Phase-2 cycle.

## Problem (D9 — found via E2E 2026-05-22)

In the brand-web new-campaign wizard, for a **conversion/hybrid** set
with a **handpick** influencer, the brand can reach "Review →" and
publish WITHOUT selecting an offer type. But the backend invite
**requires** `offer_type` for conversion/hybrid
(`campaign.controller.js:654` → 422), and publish does NOT block on
invite failure. Result: the invite silently 422s and the influencer
is dropped — the brand gets an **active campaign with 0 influencers**
and no error.

Verified: `POST /sets/:sid/invite 422` ×N in the dev log, campaign
published `active` with zero `campaign_influencers`. The
`qa/local-e2e/conversion-campaign.spec.ts` invite-2xx assertion was
added to guard it.

## Root cause

`validateSets` (Packages/brand-web/.../campaigns/new/page.js, the
per-influencer block ~758-786) validates `post_date`,
`influencer_budget` (engagement/hybrid), and `commission_pct`
(conversion/hybrid) — but **not `offer_type`**. The backend's
goal-conditional rule (conversion/hybrid require offer_type) is not
mirrored client-side.

## Fix (minimal, client-side validation)

In `validateSets`, inside the `needsOffer(s.goal)` per-influencer
block, require `offer_type`:
```js
if (!inf.offer_type) errs.offer_type = 'Pick an offer type';
```
+ display the error next to the Offer-type buttons in
`renderInfluencerConfig` (same `infErr`/`field-err` pattern as the
other fields) + `markTouched` when an offer type is tapped.

Net effect: "Review →" stays blocked (the error rolls into
`step2Errors`) until the brand picks an offer type for every
conversion/hybrid handpick influencer — so the invite can never
422-on-missing-offer_type, and no influencer is silently dropped.

## Success

- A conversion/hybrid handpick influencer with NO offer type → the
  wizard shows "Pick an offer type" + blocks Review/publish.
- With an offer type selected → unchanged (publishes, invite 201,
  influencer persists). The existing E2E spec stays green.
- Main `pnpm qa` 66/C1/gate 0 unchanged.

## Out of scope (recommended follow-up, not this fix)

D9 part (b): publish should also surface/block on ANY invite failure
(defense-in-depth for other 422 causes). This fix addresses the
direct cause (missing offer_type) client-side; the publish-time
hardening is a separate, larger change.

## Surfaces / deploy

- `Packages/brand-web/app/dashboard/campaigns/new/page.js` (UI-governed).
- PRODUCTION-IMPACTING: `git push` → Vercel redeploys brand-web.
  Surfaced explicitly; founder go required at push. Forward-only;
  rollback = revert the change.
