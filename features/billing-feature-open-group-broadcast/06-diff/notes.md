# 06-diff — billing-feature-open-group-broadcast (A12.5)

**Before:** every approved brand on any tier could publish a campaign
containing an open-group set. The `materialiseOpenGroupInvites`
helper used a hardcoded `OPEN_GROUP_BROADCAST_LIMIT = 1000` ceiling
on how many influencers got invited per open-group set. There was no
geographic restriction — any approved influencer was a candidate.

A12.4 had ostensibly gated this behaviour behind `bulk_outreach`, but
verify-twice this session caught that A12.4 wired the gate on
`offer.controller.publishOpenGroup` — a push-notify endpoint with no
frontend caller. M065 would have been a no-op against the real
publish flow.

**After (A12.5):** the gate goes on the real publish path
(`campaign.controller.publish`). When the campaign contains at least
one `influencer_mode='open_group'` set, two gates fire before the
transaction starts:

1. `bulk_outreach` boolean (re-applied here — the A12.4 helper now
   actually bites). Free tier blocked.
2. `open_group_broadcast.max_recipients === 0` block (Free tier
   blocked again via the config layer — defence-in-depth).

Inside `materialiseOpenGroupInvites`, the legacy `1000` ceiling is
replaced with an effective cap derived from
`open_group_broadcast.max_recipients`:

| Tier | max_recipients | Effective cap (with 1000 safety bound) |
|------|----------------|----------------------------------------|
| Free | 0  | (blocked at entry — never reaches materialise)         |
| Growth     | 25         | 25                              |
| Pro        | 100        | 100                             |
| Enterprise | -1         | 1000 (safety bound)             |

And the SQL match query now injects an `area_scope` filter:

| area_scope | SQL injection                          |
|------------|----------------------------------------|
| `'city'`     | `AND i.city = <brand_city>`         |
| `'state'`    | `AND i.state = <brand_state>`       |
| `'all_india'`| (no filter — pass-through)          |

If `open_group_broadcast.is_enforced=false` (pre-M066), `configFor`
returns `{}` and behaviour falls back exactly to the pre-A12.5 code
path (1000 ceiling, no scope filter). M066 activates the cap + scope.

**Error envelopes** (returned by `campaign.controller.publish` before
the transaction is even opened):

```json
{ "code": "FEATURE_NOT_AVAILABLE",
  "message": "Bulk influencer outreach is not available on your current plan. Upgrade to use it.",
  "field": "bulk_outreach",
  "details": {
    "feature_key": "bulk_outreach",
    "upgrade_to": ["growth", "pro", "enterprise"]
  } }
```

```json
{ "code": "FEATURE_NOT_AVAILABLE",
  "message": "Open-group broadcast is not available on your current plan. Upgrade to publish open-group campaigns.",
  "field": "open_group_broadcast",
  "details": {
    "feature_key": "open_group_broadcast",
    "upgrade_to": ["growth", "pro", "enterprise"]
  } }
```

**Defensive fail-open (matches A12.2/A12.3/A12.4 pattern):**
- `open_group_broadcast.is_enforced=false` → `configFor` returns `{}`
  → effective cap=1000, no scope filter, max_recipients=0 check
  doesn't fire. Pre-M066 the change is behaviour-inert.
- Brand has no city/state → area_scope filter skipped, cap still
  applies.
- All-handpick campaign → both A12.5 gates skipped entirely.

**Frontend UI hide is intentionally NOT in this contract.** Hiding
the Publish button for Free brands on open-group campaigns lives in
the campaigns/new wizard (Window B redesign territory) and the
QuotaWallModal predicate needs to learn `FEATURE_NOT_AVAILABLE` —
separate UI polish contract.

**Verified locally:** code edit boot-smokes clean; M066 applied to
dev DB; sanity probe shows open_group_broadcast.is_enforced=true.
