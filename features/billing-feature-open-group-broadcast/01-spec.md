# billing-feature-open-group-broadcast — Phase A12.5

> Fourth per-feature enforcement after A12.2/A12.3/A12.4. Two-part gate
> on the **campaign-publish** path (the real materialisation site —
> verify-twice caught that A12.4's bulk_outreach gate was wired on a
> dead notify-only endpoint with no frontend caller, so A12.5 also
> moves the bulk_outreach gate to where it actually bites).

## What ships

**Backend — gates moved to the real publish path**

The campaign-level publish endpoint (`POST /v1/campaigns/:id/publish` →
`campaign.controller.publish`) is where open-group sets materialise
`campaign_influencers` rows. Two gates are added at the top of that
function, conditional on the campaign containing at least one
`influencer_mode='open_group'` set:

1. **`bulk_outreach`** (boolean) — re-applied here from A12.4. Free
   tier blocked from publishing any campaign that contains an
   open-group set. Uses the reusable `requireFeature` helper.
2. **`open_group_broadcast.max_recipients == 0`** (config) — Free tier
   also blocked at this layer (defence-in-depth — same intent, different
   config). Throws 422 FEATURE_NOT_AVAILABLE with `feature_key:
   'open_group_broadcast'`.

**Backend — per-tier cap + scope inside materialiseOpenGroupInvites**

Inside `materialiseOpenGroupInvites` the legacy hardcoded
`OPEN_GROUP_BROADCAST_LIMIT = 1000` is replaced with an effective cap
derived from the brand's `open_group_broadcast.max_recipients`:

- `-1` (unlimited) or feature-not-enforced → fall back to the 1000
  safety bound.
- Any positive value → `min(max_recipients, 1000)`.

The brand's `open_group_broadcast.area_scope` injects an SQL filter
into the matching query:

- `'city'` → `i.city = <brand city>`.
- `'state'` → `i.state = <brand state>`.
- `'all_india'` or feature-not-enforced → no scope filter.

Mirrors the `_applyDiscoverFilter` helper pattern from A12.2 but
sourced from `open_group_broadcast` config rather than
`discover_filter`.

**Backend — bulk_outreach gate also LEFT on the notify endpoint**

The A12.4 gate on `offer.controller.publishOpenGroup` is left
untouched (defensive — the endpoint exists and may be wired later;
existing `negotiations.test.js` tests it).

**Migration M066**
- `UPDATE features SET is_enforced=true WHERE feature_key='open_group_broadcast'`.
- Idempotent. Same flip pattern as M062/M063/M064/M065.

## Tier defaults (M061 seed for open_group_broadcast)

| Tier | area_scope  | max_recipients |
|------|-------------|----------------|
| Free | city        | **0**          |
| Growth | city      | 25             |
| Pro    | state     | 100            |
| Enterprise | all_india | -1 (unlimited up to 1000 safety) |

Admin can flip any tier's config blob in `/admin/pricing/tiers/[tier_key]`
Section C; takes effect within 60s entitlements cache.

## Verify-twice catch fixed in this contract

A12.4's contract claimed `publishOpenGroup` "materializes
campaign_influencer rows in one call". Code inspection found the
endpoint only fires push notifications — it doesn't materialise. The
real materialisation runs inside `materialiseOpenGroupInvites`, called
from `campaign.controller.publish` (campaign-level publish endpoint).
Frontend grep returned zero callers of `/sets/:sid/publish-open`. So
M065's `bulk_outreach is_enforced=true` would have been a no-op on
prod.

A12.5 corrects this by **moving the bulk_outreach gate to
`campaign.controller.publish`** (the path the brand UI actually hits).
M065 + M066 together now enforce as the catalog claims.

## Out of scope

- Frontend UI hide for tiers without `open_group_broadcast` capacity
  (small follow-up — extend QuotaWallModal to recognise
  `FEATURE_NOT_AVAILABLE` on the publish flow).
- Surface the per-tier cap in `openGroupMatches` preview (preview
  currently uses discover_filter; brand may see N matches but publish
  invites only `max_recipients`). UX polish — not a gate-correctness
  bug.
- `negotiations.test.js`'s use of `publishOpenGroup` (Free brand path)
  — backend-defect contract already tracks the unrelated assignment-
  mode mismatch; A12.5 changes nothing there.

## Files
- `backend/src/controllers/campaign.controller.js` — top of `publish`
  gets bulk_outreach + open_group_broadcast gates (conditional);
  `materialiseOpenGroupInvites` gets per-tier cap + area_scope filter.
- `backend/migrations/066_enforce_open_group_broadcast.sql` +
  `backend/scripts/run-066.js`.
- This contract.

## Non-functional
- Deploy posture: PRODUCTION-IMPACTING — Render redeploys backend; M066
  needs separate explicit founder go.
- Backward compatible: pre-M066 the config gate is no-op (`configFor`
  returns `{}` when `is_enforced=false`); pre-M065 the bulk_outreach
  gate is no-op (same). All deploys behaviour-inert until the flag
  flips.
- The bulk_outreach gate move is also flag-gated by `bulk_outreach.is_enforced`.
- API JSON shape unchanged on success; new 422 envelopes on block.
