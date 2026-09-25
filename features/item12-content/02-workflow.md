# item12-content — workflow

The order is the approval's. **Nothing in 2c starts until 2a and 2b are finished and proved.**

## Phase 0 — the baseline (done in Phase 1)
`backend/baseline_item12.json` — 131 suites / 1545 tests / 1323 passed / 220 failed / 2 skipped.
Three `item3b-pipeline` tests red from date drift, no code change.

## Phase 2a — close the money door and the privacy holes
1. Migration **192** (additive; the whole item's schema, applied twice to the test database).
2. `contentGate.service.js` — `assertContentOpen`; `contentCopy.js`.
3. Retire all eight `/v1/deliverables` routes for every Aim (`RETIRED_12_*`, data kept);
   `/refresh-stats` stays.
4. Retire the Store Visit branch of `POST /production-events/:id/complete`.
5. Admin manual escrow release: required reason stored, audit row, refuses `disputed`/`refunded`.
6. Campaign-cancel guard for a queued tranche.
7. Brand website: the content review panel, the inbox "Content reviews" tab, the CommandRail prime
   action and "Mark visit done" become read-only.
8. Tests: the gate matrix over every route; the retirement loop, one case per Aim.

## Phase 2b — storage and uploads (its own commit)
Presigned PUT with `Content-Length` signed; confirm with `headObject`; delete on mismatch; the
24-hour sweep (never a file referenced by a round); 300-second signed GETs; the phone's streaming
`{uri}` PUT. **Proved with a real 200 MB video on a real phone before any screen is written.**

## Phase 2c — the flow
Package, rounds, posting and proof, confirm live, `contentMoney` (T2), J1 (the tranche-3 job with
the stamped due), J2a (Delayed arm + silent stage), J2b (reminders + sweep), Admin numbers,
notifications, Needs You, the adjacent money fixes.

## Phase 3 — the screens
Creator C1, C3–C5, C8, C10, C12, C15; Brand C2, C6, C7, C9, C11, C13, C14, C16; Admin C17 (no page
change). The duplicate-screen-name test for both navigators.

## Phase 4 — tests and release evidence
Checks 1–46 (`03-expected-outputs.md`), `compare-tests.js` against `baseline_item12.json`,
governance check, `06-diff/notes.md`, `run-192.js`. **Production-impacting — explicit go before
migrate / push / OTA.**
