# Expected Outputs — backend-test-debt Phase 10

> Step 3. Measured vs **353 passed / 29 failed / 382** (post-P9,
> deterministic instrument → noise-free delta).

## Per-step expected outputs
| Step | Observable output | Verified by |
|---|---|---|
| 1 Inventory | The 8 influencer-search failing tests (suite › test + signature) | jest summary cross-check |
| 2 Verify-twice | Real `res.body` shape/fields from a reverted instrumented run | `_p10_diag.log`; test byte-clean post-revert |
| 3 Align | Shape/field renames traceable to the verified live response | `git diff backend/tests/influencer-search.test.js` |
| 4 Carve | `features/backend-defect-onboarded-creator-city-search/`; `'filters by city'` RED | new carve folder |
| 5 Re-measure | Honest delta vs 353/29 + inventory in `lock.json` | fresh `pnpm qa:db` |
| 6 Regression | main `pnpm qa` 66 GREEN / C1 / gate 0; gov-check OK | `pnpm qa`; `qa/reports/latest.md` |

## Verified live response (instrumented, real qa:db PG)
- `res.status` **200**; `res.body.data` keys = **["creators"]**;
  `res.body.meta` = **{page,limit,total}** (total correct);
  creators = onboarded influencers with `ig_handle`,
  `followers_count`, `niche`, `view_based_er`; sensitive fields
  (pan_number/bank_account_no/upi_id/fcm_token) **absent** →
  `undefined` (sensitive-field test still passes after rename).
- City defect: every onboarded creator `city: null` →
  `'filters by city'` returns 0 (genuine, carved).

## Hard expectations (GOVERNANCE.md §8)
- No `.skip`/delete/assertion-weakening/fabricated-data/
  force-pass. Negative tests (401 no-auth; 403 influencer-role)
  left intact. The `registerInfluencer({ instagram_handle })`
  payload key is NOT renamed (only response-read assertions).
- The genuine city defect carved RED, test not weakened —
  exposed via the real assertion, not hidden behind a stale
  TypeError. (no-fake-green: a carve, not a mask.)
- Delta reported truthfully. Determinism → exact. Expected
  shape: ~7 fixed + 1 carved-RED ⇒ ~29→~22 (the deterministic
  re-measure is authoritative; `'does NOT include pending'`
  outcome decided by measurement, not assumption).
- migrations stay 53/53 0-error; main lane unchanged
  (Phase 10 = one test file + carve; deploy-inert).

## Evidence
- `qa/artifacts/_p9b_remeasure_qadb.log` (post-P9 inventory) +
  `qa/artifacts/_p10_diag.log` (reverted instrumented run) +
  fresh `pnpm qa:db` (post-P10), classified inventory + delta
  in `lock.json` + `04-preview/README.md`, `qa/reports/
  latest.md` (main lane), gov-check pass on push.
