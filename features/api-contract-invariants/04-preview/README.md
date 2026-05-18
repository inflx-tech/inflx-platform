# Mock UI / Screen Preview (Step 4) — B1

L1 API contract layer — **no UI, no screens**. Nothing to mock.

Reviewer confirms at the Step-5 lock:
- The 3 invariants (W1 RBAC, W2 attribution-refusal, W3 auth
  contract) are the right deterministic first slice of Area B.
- It is accepted that B1 has no visual evidence — the QA report
  rows + self-describing test titles (asserted status/error code)
  are the evidence (recorded in 03).
- Deep calc/status-transition L1 (B2) is correctly deferred pending
  a substrate decision (local-DB harness / db-mock).
