# Workflow — billing-feature-open-group-broadcast (A12.5)

## Actor
Brand publishing a campaign that contains at least one open-group set.

## Preconditions
- A10/A12.1/A12.2/A12.3/A12.4 shipped.
- M066 applied (is_enforced=true on open_group_broadcast).
- M065 applied (is_enforced=true on bulk_outreach) — A12.5 moves this
  gate to the real publish path so M065 + M066 enforce together.
- Default seed: Free=(city, 0), Growth=(city, 25), Pro=(state, 100),
  Enterprise=(all_india, -1).

## Workflow A — Free brand tries to publish open-group campaign

1. Brand on Free creates a campaign, builds at least one open-group set,
   funds wallet, hits **Publish Campaign**.
2. Frontend calls `POST /campaigns/:id/publish`.
3. `campaign.controller.publish` runs: brand+campaign+status checks pass.
4. Pre-flight: `sets.some(s => s.influencer_mode === 'open_group')`
   returns true → both gates fire.
5. `requireFeature(db, brand.id, 'bulk_outreach')` →
   **422 FEATURE_NOT_AVAILABLE** with `feature_key: 'bulk_outreach'`,
   `upgrade_to: ['growth','pro','enterprise']`.
6. (Defence-in-depth) Even if bulk_outreach were granted, the next
   check `open_group_broadcast.max_recipients === 0` → same 422 with
   `feature_key: 'open_group_broadcast'`.

## Workflow B — Growth brand publishes (city scope, cap 25)

1. Same flow as A through step 4.
2. `requireFeature` returns silently (Growth includes bulk_outreach).
3. `configFor(open_group_broadcast)` returns `{area_scope: 'city',
   max_recipients: 25}`; `max_recipients > 0` → no entry block.
4. Publish proceeds into transaction.
5. `materialiseOpenGroupInvites` resolves effective cap = `min(25,
   1000)` = 25; resolves brand's city from users table.
6. Match query filters by existing open_group_filters PLUS
   `i.city = <brand city>`.
7. Up to 25 matching CI rows inserted, status='invited',
   offer_expires_at = now()+48h.
8. Push notifications fire for invited influencers (post-tx loop).

## Workflow C — Pro brand publishes (state scope, cap 100)

1. Same as B with `area_scope='state'` injecting `i.state = <brand
   state>` and cap = 100.

## Workflow D — Enterprise publishes (all_india, unlimited)

1. Same flow, no area_scope filter (`'all_india'` is pass-through).
2. Effective cap = `min(-1 → fallback 1000, 1000)` = 1000. Safety
   bound still in effect.

## Workflow E — campaign without any open-group set (handpick only)

1. Brand on any tier (including Free) publishes a campaign with only
   handpick sets.
2. `sets.some(open_group)` returns false → both A12.5 gates skipped.
3. Publish proceeds normally. Handpick invites were already on the
   set as `invited` rows from the wizard.

## Workflow F — admin promotes Free for open_group_broadcast

1. Admin opens `/admin/pricing/tiers/free` Section C.
2. Edits open_group_broadcast config blob: changes max_recipients
   from 0 to (e.g.) 10; optionally lifts area_scope.
3. Saves → existing PUT endpoint writes the row.
4. Within 60s (entitlements cache TTL), Free brands can publish
   open-group campaigns up to the new cap.

## Workflow G — feature not yet enforced (pre-M066)

1. Code is deployed but M066 not yet applied.
2. `configFor` returns `{}` (defensive fail-open when
   `is_enforced=false`).
3. Effective cap falls back to 1000 safety bound; area_scope skipped.
4. Behaviour identical to pre-A12.5 — no behavioural change until the
   flip.

## Success

- pnpm qa main lane GREEN.
- Free brand publishing a campaign with any open-group set →
  422 FEATURE_NOT_AVAILABLE.
- Growth/Pro/Enterprise brands publish, with materialise cap matching
  their tier and area_scope filter restricting to their city/state/
  all_india.
- Handpick-only campaigns unaffected on every tier.
- Admin toggle takes effect within 60s.

## Failure modes

- M066 not applied → both A12.5 gates are no-ops (defensive
  fail-open). Pre-M066 deploy is behaviour-inert.
- M065 not applied → bulk_outreach part of the gate is no-op; the
  max_recipients=0 part still blocks Free post-M066.
- Brand missing city/state on their user row → area_scope='city' or
  'state' filter is skipped (defensive — don't lock the brand out due
  to incomplete profile). Cap still applies.
- Gate fires before the transaction starts → no partial-publish risk.
