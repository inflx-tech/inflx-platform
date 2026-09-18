# item10-store-visit — expected outputs

The gap-check prompt's checks 1–30 and the approval's 31–48 are the acceptance list. Each becomes
an assertion in `backend/tests/item10-storevisit.test.js` (or a Jest test in `Packages/Mobile`
for 44); the build summary reports every one with its result.

**The gate** — 1, 2, 3, 31, 32, 33, 34.
**The mode** — 35, 36, 37.
**The plan** — 5, 6, 7, 8, 9, 25, 45, 46.
**The time and the thread** — 10, 11, 12, 13, 14, 38, 39, 40, 41, 42.
**Passed, attended, confirmed** — 15, 16, 17, 18, 19, 20, 43.
**Money** — 21 (balances and escrow byte-equal before and after a complete shoot).
**Delayed** — 22, 23, 24.
**Access and mode** — 26, 27.
**Needs You and states** — 28, 29.
**Reminders** — 47.
**Small defects** — 44 (`DangerButton`), 48 (no `status='active'` signature test anywhere).
**Regression** — 30 (`compare.js` against `baseline_item10.json`: 1330 / 1109 / 221, 0 new failures).

Deploy evidence: 187 dry-run and apply output; `--fix-modes` before/after for exactly six ids;
route existence on Render (401 vs 404 on `GET /v1/influencers/me/invitations/:ciId/shoot`);
OTA version numbers; a production read showing 0 money rows changed.
