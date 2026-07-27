# Feature Spec — Fix the fragile contract↔influencer join (backend batch, item 1)

> First item of the end backend batch. A genuine correctness bug found in the
> brand-web audit, not a cosmetic change.

## Problem / goal
The brand hub matched **pending contracts to creators by Instagram-handle string**:
`pendingByHandle[handle]`, where the handle came from a coalesce of
`ci.instagram_handle || ci.handle || ci.influencer_name || ci.name`, lower-cased and
@-stripped. That silently mis-matches or loses a contract when a handle is missing, renamed,
or duplicated — on a surface that **locks brand funds** when signed.

Root cause: `GET /contracts/brand/pending` already JOINs `campaign_influencers` but never
**selected** `campaign_influencer_id`, so the client had no real key to match on.

## Scope
**In scope**
- Backend: add `con.campaign_influencer_id` to the `listBrandPending` SELECT (purely
  additive — no filter, shape or behaviour change for existing consumers).
- brand-web hub: match by `campaign_influencer_id`, falling back to the handle map only if
  an older payload lacks the id (safe during rollout).

**Out of scope** — the campaigns-list signature strip (cross-campaign inbox) still displays
by handle for its row labels; it signs by contract id, so it is unaffected.

## Surfaces touched
- backend (`contract.controller.js`) + brand-web hub. **Backend change = Render deploy on push.**

## Data / contracts
- No migration. One extra column in an existing response.

## Non-functional
- Money-adjacent correctness: the Contracts tab drives counter-signing, which locks wallet funds.
