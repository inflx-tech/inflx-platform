# Impact — billing-feature-support-tier-flags (A12.7)

## Changes
- 1 migration (M068) flips `is_enforced=true` on two rows in a single
  UPDATE.
- 1 runner script.
- 1 contract folder.
- **Zero backend code changes.**

## Blast radius
- `features` table: two rows updated. Single UPDATE with `IN (...)`.
- Admin Features page: the two rows' "Enforced" badge flips.
- Brand-facing pages: nothing changes (no runtime gate consults these
  flags).
- Tier upgrade flow: nothing changes.
- Entitlements cache: not invalidated (catalog read is by feature_key,
  the cache holds the row including is_enforced; cache TTL is 60s so
  any admin/brand request after that window picks up the new flag).

## Rollback
Revert M068 (`UPDATE features SET is_enforced=false WHERE feature_key
IN ('dedicated_onboarding_call','phone_support_24x7')`). Admin
Features page shows enforced=no again. No data loss.

## Risks
- **None functional.** The flags don't gate any runtime path.
- **Cosmetic only**: the admin badge is the sole user-visible side
  effect.
- **No regression surface**: backend code unchanged → pnpm qa
  behaviour identical → 76/76 GREEN guaranteed (modulo Render
  cold-start flakes which would affect any run).
- M068 prod run still surfaced for explicit founder go per the
  hard carve-out rule (production-impacting governance category,
  even if behaviour-inert).

## Pre-push checklist
1. pnpm qa main lane GREEN (baseline confirmation).
2. M068 applied locally + sanity probe shows both rows
   is_enforced=true.
3. gov-check exit 0 (Rule 1: only governed change is the migration,
   backed by this contract).
4. M068 prod run gated on separate explicit founder go after push.
