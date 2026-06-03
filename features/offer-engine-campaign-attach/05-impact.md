# Impact Analysis — offer-engine-campaign-attach (Sub-contract C, backend)

## Verdict (terse)
**Additive + dormant — zero functional disturbance to live flows.** One optional
request field (`brand_offer_id`), a server-side snapshot, a goal-derived
`allocation` stamp, and a one-line relaxation that only *opens* a previously
forbidden path. No existing valid request changes outcome.

## Mechanics
- **`brand_offer_id` is optional.** Omitted (every caller today) → the invite/
  update path runs exactly as before, except it now also writes
  `allocation` (dormant metadata, no live reader until D) when an offer is
  present. Inline `offer_type`/`offer_config_json` still flow through unchanged.
- **Snapshot is server-authoritative.** When `brand_offer_id` is given, the
  library row's `offer_type`/`offer_config_json` are copied onto the CI; a later
  library edit can't mutate a live attachment. Ownership enforced (cross-brand →
  404; archived → 422).
- **Engagement relaxation is purely additive.** Old rule: engagement + any
  `offer_type` → 422. New rule: engagement may carry an offer but still rejects
  `coupon_code`/`commission_pct`. Every previously-valid engagement request (no
  offer) stays valid; every previously-invalid one (engagement + commission/
  coupon) stays invalid. The only newly-allowed case (engagement + offer) is
  unreachable until the sibling UI sends it.
- **Conversion/hybrid unchanged** — still require an offer; coupon/commission
  logic untouched.
- **No migration, no schema change** — columns exist from `084`.

## Blast radius if it failed
Confined to the campaign invite/update attach path. A bug in the new branch only
triggers when `brand_offer_id` is supplied (nothing supplies it yet) or for
engagement-with-offer (unreachable pre-UI). Existing conversion/engagement invites
take the same code paths as before.

## Regression guard
`offer-attach.test.js` + the existing `campaigns.test.js` invite/offer suites
GREEN on a real DB; assert inline conversion, engagement-no-offer, and validation
errors are byte-identical. `allocation`/`brand_offer_id` confirmed dormant (no
live reader until Sub-contract D).

## Deploy posture
PRODUCTION-IMPACTING (`backend/src`) but DORMANT. Backend-only → Render
auto-deploy on push; no migration, no OTA/web. Surfaced for explicit go.
