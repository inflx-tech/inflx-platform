# Impact — billing-feature-open-group-broadcast (A12.5)

## Changes
- `campaign.controller.publish`: pre-flight conditional on
  `hasOpenGroupSet`. Two gates (bulk_outreach + open_group_broadcast
  max_recipients=0). Resolves area_scope + max_recipients into local
  vars used by `materialiseOpenGroupInvites`.
- `materialiseOpenGroupInvites`: replaces hardcoded
  `OPEN_GROUP_BROADCAST_LIMIT = 1000` with effective tier cap
  (clamped to 1000 safety bound). Adds area_scope SQL filter to the
  matching query.
- 1 migration (M066) flips `is_enforced=true` on open_group_broadcast.
- 1 runner script.
- 1 contract folder.

## Blast radius
- `POST /v1/campaigns/:id/publish` — main brand publish endpoint.
  Affected only when the campaign contains an open-group set.
- Open-group campaign publishing for Free brands now blocked
  effectively (vs A12.4's gate on a dead endpoint).
- Per-tier recipient cap goes live — Growth=25, Pro=100, Enterprise=1000
  safety (vs the prior always-1000 ceiling).
- area_scope filter takes effect — Growth limited to brand's city,
  Pro to brand's state.

## Verify-twice fix landed here
A12.4 claimed `publishOpenGroup` "materializes campaign_influencer
rows" — code inspection showed it only sends push notifications and
has no frontend caller. M065 alone would have been a no-op on prod.
A12.5 moves the bulk_outreach gate to the real publish path
(`campaign.controller.publish`). The A12.4 gate on
`offer.controller.publishOpenGroup` is left untouched (defence-in-
depth — endpoint exists, tested by `negotiations.test.js`, may be
wired later).

## Rollback
Revert commit + revert M066 (`UPDATE features SET is_enforced=false
WHERE feature_key='open_group_broadcast'`). The legacy hardcoded
1000 ceiling returns; area_scope filter disappears. The
bulk_outreach gate on `publishOpenGroup` (A12.4 path) remains on
offer.controller as before (left in place).

## Risks
- **Frontend UI does not yet hide the Publish button for Free brands
  on open-group campaigns** — they will see the 422 in the existing
  error toast. UI polish is a follow-up; the QuotaWallModal predicate
  currently checks `QUOTA_EXCEEDED` only and would need extension to
  catch `FEATURE_NOT_AVAILABLE`. Mitigation: the error message is
  human-readable and includes upgrade_to so brand can act.
- **Brand has no city/state on their user row** → area_scope filter is
  defensively skipped (don't lock brand out due to incomplete profile).
  Cap still applies. Acceptable.
- **openGroupMatches preview** uses discover_filter, not
  open_group_broadcast — brand may see N matches but publish only
  invites `max_recipients`. UX polish (separate contract), not a
  gate correctness bug.
- **Gates fire before the transaction starts** — no partial-publish
  state on block.

## Pre-push checklist
1. pnpm qa main lane GREEN.
2. Backend boot smoke clean.
3. M066 applied locally + sanity probe shows is_enforced=true.
4. gov-check exit 0 (Rules 1+3+4).
5. M065 + M066 prod runs gated on separate explicit founder go after
   push (combined surface — single approval, two-step apply).
