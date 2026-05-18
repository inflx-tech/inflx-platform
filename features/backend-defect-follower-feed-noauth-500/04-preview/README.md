# Preview (Step 4) — backend-defect-follower-feed-noauth-500

No UI. Backend correctness defect, carved from Phase 4.

Reviewer note:
- This is a **carved RED finding**, not a fix. The catching
  test (`tests/follower-feed.test.js:182`) is correctly RED and
  is intentionally left failing — it reports a real production
  bug (`GET /v1/follower/feed` 500s instead of 401 when
  unauthenticated).
- Phase 4 does NOT patch the backend or edit the test
  (no-fake-green; never mask a product bug).
- The fix is a **separate future contract**, production-
  impacting (Render), with its own lock + explicit release gate.
- This carve is **deploy-inert** (a tracked finding only).

Evidence (verify-twice):
- `backend/src/routes/follower.routes.js:27` — `/feed` uses
  `authenticateOptional` (no hard 401).
- `backend/src/controllers/follower.controller.js:299-303` —
  `getFeed` dereferences an undefined `follower` when no auth →
  throws → 500.
