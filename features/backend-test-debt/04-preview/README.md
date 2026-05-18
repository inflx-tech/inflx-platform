# Mock UI / Screen Preview (Step 4) — backend-test-debt Phase 1

Test-helper code — no UI, nothing to mock.

Reviewer confirms at the Step-5 lock:
- Phase 1 = align `tests/helpers/factories.js` to the real
  controllers (highest-leverage; `registerBrand` missing `name`
  confirmed cascading).
- Success is **measured progress + honest re-baseline**, NOT
  laneState=PASS and NOT zero failures (debt is phased).
- Hard rule: only add fields the controllers actually require; no
  `.skip`/deletion to inflate pass rate. Residual failures stay
  tracked for Phase 2.
