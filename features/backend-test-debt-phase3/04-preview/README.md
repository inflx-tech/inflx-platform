# Mock UI / Screen Preview (Step 4) — backend-test-debt Phase 3

Test-infra + triage — no UI, nothing to mock.

Reviewer confirms at the Step-5 lock:
- Phase 3 = business-contract alignment, NOT force-green cleanup.
- The defining discipline: split the status-drift cluster into
  stale-payload (fix the test) vs **genuine backend defect**
  (carve out as a finding, LEAVE THE TEST RED).
- Success = documented sub-classification + measured progress on
  the stale-payload batch + every genuine defect tracked, not
  hidden. laneState=PASS not required.
- Same anti-masking rules as P1/P2 (no skip/delete/fabricate/
  weaken).
