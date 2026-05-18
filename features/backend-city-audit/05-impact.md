# Impact Analysis — backend-city-audit

> Step 6. Generated BEFORE implementation. Reviewed at the lock.

## ⚠️ Deploy posture (CONDITIONAL)
- **If the audit finds 0 genuine defects → DEPLOY-INERT.** The
  only artefacts are this contract, the dispositioned inventory,
  and qa:db evidence logs. No `backend/src/**` change → no
  Render deploy. Same inert class as tests/qa/features/docs.
- **If Step 7 proves a genuine latent 500 → NOT DEPLOY-INERT.**
  A minimal column-resolution fix edits backend runtime SQL; on
  Step-14 `git push origin main`, **Render auto-deploys the
  backend to production** (fixes a live 500 — desirable, but an
  explicit decision). No migration, no mobile, no OTA;
  brand-web/Vercel unaffected. Identical posture to
  `backend-defect-city-column`.

## Affected files (read or change)
- **Read (always):** every runtime `city` SQL site in
  `backend/src/controllers/**` and `backend/src/services/**`
  (full inventory in `01-spec.md`); the 53 migrations as the
  schema source of truth.
- **Change (only if a genuine defect is proven):** the pinned
  controller/service file at the exact failing statement —
  minimal alias/qualifier/JOIN edit, result shape unchanged.
  Highest preliminary suspicion (prove first at S7):
  `proposal.service.js` (brand-user + influencer-user joins),
  `follower.controller.js:967/1010`, `admin.controller.js` INSERT
  target, `follower.service.js` `u_b.city` joins.
- **No test files edited.** A carved RED test (if a defect is
  carved) is fixed only by correcting the backend, in its own
  contract.

## Affected routes / APIs
| Method | Path | Change | Consumers |
|---|---|---|---|
| (various read endpoints) | `/v1/influencers/analytics`, `/v1/brands/me/applications`, proposal / follower-feed / saved / lookbook / admin search paths | **No contract change.** A previously-500ing path instead returns its existing documented shape | brand-web, mobile, admin-web |

If 0 defects: **no route behaviour changes at all** (this just
proves they were already correct post-precedent-fix).

## Affected workflows (regression surface)
- Influencer analytics / search, open-group matching, proposal
  eligibility, follower feed/store, saved items, lookbooks,
  admin influencer import/search — all touch a `city` site. A
  *wrong* fix could change WHO matches / WHAT is listed.
  Mitigation: column-resolution-only changes (result shape
  preserved); any behaviour-affecting fix is carved, not done
  here. Covered by existing campaign/influencer/follower tests
  in the qa:db suite — watch the delta for **new** failures, not
  just the targeted −N.
- Main `pnpm qa` (66) + C1 + B2b substrate: unaffected by the
  audit itself (no main-lane/harness change; backend exercised
  only via qa:db). Re-run `pnpm qa` after any backend edit.

## Migration / deploy / OTA impact
- No migration (every `city` column already exists; the class is
  SQL referencing it unresolvably).
- No mobile JS / native change → no OTA, no APK.
- Backend code change **only if** a fix lands → Render redeploy
  at Step 14. Otherwise push is docs/features-only (inert).

## Risk notes
- **Behaviour-change risk:** the ONLY acceptable code change is
  making `city` resolve (alias/qualifier/JOIN, shape unchanged).
  Anything beyond → STOP, carve, re-scope.
- **False-closure risk:** asserting a site SAFE without real
  qa:db evidence (or, for uncovered sites, without an explicit
  static FROM/JOIN proof) would fake-green the class. Mitigation:
  uncertainty → carve as a finding, never assert safe.
- **Hidden-second-defect risk:** if a fix makes one test green
  but a different new failure appears, report honestly and carve
  it (no net-negative masking).
- **Scope-creep risk:** non-`city` bugs noticed in passing are
  carved separately, never fixed in this contract.
- Reproduced/verified on the real qa:db Postgres (full 53-mig
  schema) — same deterministic environment as the precedent.
