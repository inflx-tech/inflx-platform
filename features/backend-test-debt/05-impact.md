# Impact Analysis — backend-test-debt Phase 1

> Step 6. Generated BEFORE implementation. Reviewed at the lock.

## Affected files
- **Changed (test-infra):** `backend/tests/helpers/factories.js`
  — `registerBrand` (add `name`, +`city`/`state`/`address_line`
  ONLY if `brand.controller.js` requires them, verified at Step 7);
  audit `registerInfluencer`/`loginUser` against
  `/influencers/register` + `/auth/verify-otp` (likely already
  aligned — `loginUser` sends phone/otp/role/name).
- No application/runtime code. No migration, mobile, OTA, web.
  **Deploy-inert** — `tests/helpers/` is jest-only, never imported
  by `node src/index.js`.

## Verified contract facts (Step 6)
- `brand.controller.js:115-123` requires `business_name`,
  `category`, `name` (throws 422 VALIDATION_ERROR). Factory
  currently omits `name` → the observed cascade. Exact necessity
  of `city`/`state`/`address_line` pinned by reading the full
  validation block at Step 7 (do not guess).

## Affected workflows (regression surface)
- Touches the shared factory backing ~most backend suites — high
  leverage, but also high blast radius WITHIN the test suite only
  (no runtime impact). Verified solely via `pnpm qa:db` delta.
- B2b substrate + main `pnpm qa` (66) + C1: unaffected (this is
  backend-test-only; the DB lane is separate by design).

## Migration/deploy/OTA
- None. `test`-class, deploy-inert.

## Risk notes
- Over-fix risk: adding fields the controller does NOT require, or
  `.skip`-ing, to inflate pass rate → explicitly forbidden (02/03).
  Only real contract alignment.
- The factory fix may not clear all 281 (other classes:
  pre-rupees assertions, seed/order). Residual is RE-BASELINED and
  tracked for Phase 2 — honest, not hidden.
- Determinism preserved: DB lane already DROP/CREATEs schema +
  applies all migrations per run; factory change doesn't alter that.
