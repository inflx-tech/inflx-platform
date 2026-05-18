# Mock UI / Screen Preview (Step 4) — backend-test-debt Phase 2

Harness + test-helper code — no UI, nothing to mock.

Reviewer confirms at the Step-5 lock:
- Phase 2 first makes triage evidence-based (`qa-db.mjs` persists
  `db-jest.log`) before classifying/fixing — not scope creep, it's
  the prerequisite for honest triage.
- Success = documented class breakdown + measured progress +
  honest re-baseline; NOT laneState=PASS.
- Genuine backend bugs (vs stale tests) get their own finding —
  Phase 2 never edits a test to mask a real bug.
- Same anti-force-green rules as Phase 1.
