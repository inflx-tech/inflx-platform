# Impact — billing-enforce-quota-features (A12.1)

## Changes
- 1 middleware rewritten (`quotaCheck.js`) — same exports, same call sites, different data source.
- 1 migration added (`M062`) — 1-line UPDATE; idempotent.
- 1 runner script (`run-062.js`).
- 1 test setup extended (`quotaCheck.test.js` beforeEach).
- 1 contract folder.

## Blast radius
- **All 4 quota gates change data source.** The middleware is called by the same 4 routes as before (campaigns POST, products POST, sets POST, invite POST). Same gate fires, same 422 envelope shape (with one additive field `feature_key`).
- **Real behaviour change on prod:** brands' quotas now match what admin configured in Section C, not the M058 seed defaults. This is intentional — closes the bug. But if admin's tier_features values diverge from legacy max_* values, brand experience changes the moment A12.1 deploys.
- **The defensive `limit == null` branch** lets the middleware pass through when neither tier_features nor catalog has a value. Same as today's `limit === -1` bypass.

## Rollback
Revert the commit. Middleware reverts to reading legacy columns. M062's `is_enforced=true` flip stays harmless (catalog admin UI shows the badge but doesn't change runtime).

## Risks
- **Admin's tier_features values today vs M058 seed defaults** — if they match (which they should after M061's backfill from max_* columns), brands see no change. If admin edited Section C earlier (e.g. founder's "Aveen food paradise" scenario), brands see the new limits immediately after deploy.
- **Test stub assumes legacy seed values** — extended beforeEach re-seeds tier_features matching the legacy values, so existing assertions hold. If a new test wants a custom quota, it can override the tier_features row directly.
- **60s cache window in entitlements service** — admin's edit takes up to 60s to propagate. Already true for L2/L3 cache patterns; brands rarely notice.

## Pre-push checklist
1. pnpm qa main GREEN (no spec changes; existing pass).
2. Backend boot smoke (`node -e require('./src/app')`) clean.
3. M062 applied to LOCAL dev DB; sanity probe shows is_enforced=true on the 4 features.
4. gov-check exit 0 with Rules 1+3+4.
5. M062 prod run gated on separate explicit founder go after push.
