# Workflow — billing-feature-support-tier-flags (A12.7)

## Actor
Admin viewing the `/admin/pricing/features` page after M068 applies on
prod. (No brand-facing or runtime gate workflow exists for these
features — they're human-delivered support tiers.)

## Preconditions
- A10/A12.1/A12.2/A12.3/A12.4/A12.5/A12.6 shipped.
- M068 applied (is_enforced=true on both feature rows).

## Workflow A — admin verifies catalog after M068

1. Admin opens `/admin/pricing/features`.
2. Page calls `GET /v1/admin/features` → `featuresController.list`.
3. Response includes all 13 catalog rows (11 enforced + 2 baseline
   `self_serve_onboarding`).
4. The two A12.7 rows now show `is_enforced: true`:
   - `dedicated_onboarding_call` — Dedicated onboarding call
   - `phone_support_24x7` — 24x7 phone support
5. Admin UI renders the "Enforced=yes" badge on both rows (whatever
   shape the existing component uses for that flag).
6. No other behaviour changes anywhere on the platform.

## Workflow B — brand reads tier descriptions (unchanged)

1. Brand opens `/dashboard/settings/subscription`.
2. Page calls `listTiers` (subscription.controller).
3. Response includes per-tier `entitlements[]` listing each tier's
   feature inclusion — `dedicated_onboarding_call` and
   `phone_support_24x7` were already in that response, sourced from
   the catalog row's `label` field.
4. The Subscription page already renders these as included/excluded
   bullets per tier. M068 changes nothing here.

## Workflow C — admin toggles a tier's inclusion (already works)

1. Admin opens `/admin/pricing/tiers/[tier_key]` Section C.
2. Toggles e.g. `dedicated_onboarding_call` to ON for the Growth tier.
3. Saves → existing PUT endpoint writes the `tier_features` row.
4. Brand on Growth sees the updated bullet on the Subscription page
   within 60s (entitlements cache TTL).
5. **There is no runtime gate**; the inclusion bullet is purely a
   contractual promise the INFLX team manually delivers.

## Success
- pnpm qa main lane GREEN.
- Local sanity probe shows both rows is_enforced=true after M068.
- gov-check exit 0.
- Admin Features page now uniformly shows enforced=yes across all 11
  catalog-enforced rows (10 from A12.1–A12.6 plus these 2).

## Failure modes
- M068 not applied → admin Features page still shows enforced=no on
  the two rows. Cosmetic only; no functional impact. Brand-facing
  pages unchanged.
- The `features` row missing entirely → migration's WHERE clause matches
  zero rows; idempotent no-op. (M061 seeded both rows, so this is
  defensive only.)
- Migration error mid-flight → BEGIN/COMMIT transaction rolls back;
  features rows unchanged.
