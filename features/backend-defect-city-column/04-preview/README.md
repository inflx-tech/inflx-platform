# Mock UI / Screen Preview (Step 4) — backend-defect-city-column

Backend SQL correctness fix — no UI, nothing to mock.

Reviewer confirms at the Step-5 lock:
- This is a real production bug (campaign endpoints 500 on a real
  open-group/city path) — fixing it is desirable.
- ⚠️ NOT deploy-inert: release → Render auto-deploys the backend.
  Step-14 must be a conscious deploy decision.
- Minimal SQL correctness fix only (resolve `city`), no
  influencer-matching behaviour change, no refactor.
- Verified by the carved RED test going GREEN via qa:db **because
  the backend is fixed** — never by editing the test.
- Exact file:line pinned at Step 7 from the real Postgres error.
