# Impact Analysis — referral-agency-role (Contract 3a)

> Generated BEFORE implementation. Reviewed against the lock before Step 7.

## Chat verdict (terse)
**New `agency` role + wallet + settlement + withdrawal (TDS 194H 5%) + code-redeem
endpoint — backend only.** Activates the engine's agency referrers (their ledger
rows now settle into a real wallet instead of parking as `pending`). Additive
migration (new enum value + 2 tables + 1 config column), no change to influencer/
brand money math. Production-impacting (Render API + 1 migration); no web, no
mobile, no OTA. The agency mobile app is the separate Mobile-governed 3b.

## Affected files (read or change)
- **backend (new):**
  - `backend/migrations/080_agency_role.sql` + `backend/scripts/run-080.js`
    (enum ADD VALUE committed standalone, then tables + config column).
  - `backend/src/controllers/agency.controller.js` (register, me, withdraw,
    withdrawals list).
  - `backend/src/routes/agency.routes.js` (mounted `/agencies`).
  - `backend/src/controllers/referralRedeem.controller.js` (or add to an
    existing referral controller) — `POST /referrals/redeem`.
  - `backend/tests/referral-agency.test.js`.
- **backend (changed, additive):**
  - `backend/src/controllers/auth.controller.js` — add `'agency'` to
    `VALID_ROLES` (1 line).
  - `backend/src/services/referral.service.js` — add the `agency` branch in
    `_accrueOnClient` (settlement); export nothing new (internal).
  - `backend/src/services/withdrawal.service.js` — add `initiateAgencyWithdrawal`
    (mirrors influencer path; TDS pct from `payment_config.agency_tds_pct`).
  - `backend/src/controllers/admin.controller.js` — add agency queue + status
    handlers (mirror brand).
  - `backend/src/routes/index.js` — mount `/agencies`; admin agency routes added
    to the admin router (mirror brand routes).
  - `backend/src/services/paymentConfig.service.js` (or wherever cfg is read) —
    surface `agency_tds_pct` (default 5.00) alongside `tdsPct`.

## Affected routes / APIs
| Method | Path | Change | Consumers |
|---|---|---|---|
| POST | `/agencies/register` | new | agency (3b app / API) |
| GET | `/agencies/me` | new | agency |
| POST | `/agencies/me/withdraw` | new | agency |
| GET | `/agencies/me/withdrawals` | new | agency |
| GET | `/admin/queue/agencies` | new | admin |
| PATCH | `/admin/agencies/:id/status` | new | admin |
| POST | `/referrals/redeem` | new | brand / influencer |

## Affected workflows (regression surface)
- Influencer + brand withdrawal suites (shared `withdrawal.service.js`) must
  stay GREEN with UNCHANGED TDS (influencer 10%, brand 0).
- Referral engine suites (C1) must stay GREEN; the new agency branch must not
  change the influencer/no-edge/dedup behaviour.
- Auth/OTP suites (shared `auth.controller.js`) — additive `VALID_ROLES` entry.

## Migration / deploy / OTA impact
- **Migration 080** is the tricky one: `ALTER TYPE user_role ADD VALUE` must be
  committed before any statement uses `'agency'`. `run-080.js` runs the ALTER
  standalone (auto-commit / separate statement), THEN the table + config DDL —
  per run-071/run-075 precedent. Idempotent (`ADD VALUE IF NOT EXISTS`,
  `CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`).
- **`git push`** → Render (backend) only. **No web build, no OTA, no mobile.**
- **Deploy posture: PRODUCTION-IMPACTING.** Surfaced for explicit go. Low blast
  radius: until an agency exists + has edges, nothing changes; existing roles
  unaffected.

## Risk notes
- **Settlement parity:** the agency branch mirrors the influencer branch exactly;
  risk is a typo crediting the wrong table/amount — covered by a jest assertion
  that the agency wallet == Σ paid agency ledger amounts and influencer accrual
  is untouched.
- **TDS:** agency 194H 5% is a NEW rate path; influencer 10% / brand 0 must not
  drift — asserted explicitly.
- **Enum migration:** the classic "cannot use new enum value in same txn" trap —
  mitigated by the standalone-commit runner; verified by the runner sanity-check
  selecting the enum label before creating dependent objects.
- Shared-file edits (auth.controller, withdrawal.service, admin.controller,
  routes/index, referral.service) are additive, staged by explicit path
  (parallel-window git hygiene).
- Reversibility: additive; an enum value can't be dropped but is inert without
  agency rows; tables/columns are drop-in. Rollback = stop creating agencies.
