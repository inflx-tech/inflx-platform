# item14-sale-going-live — expected outputs: the checks

Each check names the test that proves it. Status comes from the full run's compare against
`backend/baseline_item14.json`, never by hand. Backend suite: `tests/item14-sale.test.js` (S).
Mobile: `src/screens/__tests__/saleLiveScreens.test.js` (M), `src/navigation/__tests__/duplicateScreens.test.js` (D).
Item 12's suites (`item12-flow`, `item12-phase2a`, `item12-jobs`, `item12-storage`) prove check 18.

| # | Check | Proved by | Status |
|---|---|---|---|
| 1 | The step opens only when the shoot is done, for Pay for Sale on the new terms; old-terms collaborations are told plainly and every write refuses; Hybrid still refused until item 15 | S "shoot not done…", "old terms…", "Hybrid is still refused…" | pass |
| 2 | The shoot-done notice names the step that actually opens for the Aim; Pay for Content's words unchanged | S "2 · the shoot-done notice…" | pass |
| 3 | Posts progress against the stamped minimum, the same on both sides | S "no post, a post with INFLX…", "the first approval opens Path 2…"; M "S4", "S6" | pass |
| 4 | Path 2 refused by the server until INFLX approves one of her posts; only approved posts of THIS collaboration can be named | S "no post, a post with INFLX: stage posts, Path 2 refused by the server"; S "…only approved posts of THIS collaboration can be named"; M "S5, S7" | pass |
| 4a | A late approval still counts, marked late | S "4a · a late approval still counts, marked late" | pass |
| 4b | "Create a shoppable post" opens item 13's flow with this collaboration filled in | M "S4 · … create opens item 13 with this collaboration" | pass |
| 5 | At least one row; every row needs its file; file limits are item 12's (server) | S "5, 6 · every row needs a file…"; item 12 storage suite | pass |
| 6 | Sending locks it; rows and files cannot change while the brand reviews; the brand sees what was sent | S "5, 6 …" | pass |
| 7 | Changes need a reason; rounds stamped at first sending; last-round warning; beyond it only approve or report; a sent row taken out stays in history | S "7 · changes with a reason reopen it…"; M "S10, S13" | pass |
| 8 | Approval locks it; a link per row (Instagram, YouTube, Facebook shapes) or a screenshot for a Story before "posted" | S "8, 9 · a link per row…"; M "S14, S15" | pass |
| 9 | No confirmation before "posted"; confirmed once per collaboration | S "8, 9 …", "10, 12 … ALREADY_CONFIRMED" | pass |
| 10 | Confirmed + minimum → Completed; confirmed first → "live · waiting on posts" → Completed by the approval that reaches it | S "10, 12 · minimum met…", "10 · confirmed before the minimum…"; M "S17", "S18" | pass |
| 11 | Silence: confirms itself at the stamped date, never earlier, never while reported, not moved by a setting change | S "11 · brand silence…" | pass |
| 12 | No money moves anywhere in item 14 | S "10, 12 · … nothing about money moves" (wallets, pending, escrow, ledger rows identical); `scripts/run-199.js` money compare | pass |
| 13 | Selling continues after Completed; the collaboration's sales shown to both sides; a completed sale collaboration stays on her Active tab | S "13 · no orders yet…", "the creator card and the brand set row…" (Completed · selling on Active); M "S20" ×2 | pass |
| 14 | Posts outside the package take links only, even after Completed; the brand sees them; "not shared yet" after two days | S "14 · a post approved after the package…", "14 · … not shared yet…" | pass |
| 15 | A brand report freezes the step and self-confirmation; her shop posts stay in the shop; no creator report on Pay for Sale; "she hasn't posted" opens after approval + posting date | S "15 · a brand report freezes…", "15 · she hasn't posted…"; M "S22", "S24" | pass |
| 16 | Delayed at the posting date with its stage; the stage follows the collaboration | S "16 · Delayed at the posting date…" | pass |
| 17 | Only that brand and that creator see the files; never followers | item 12's gate + `fileUrl` (item12-storage, check 25/26 there), reused unchanged; outside-row screenshots opened to the brand only | pass (reuse) |
| 18 | Pay for Content (item 12) behaves exactly as before | item12-flow 42/42 and item12-phase2a with three assertion drifts recorded where item 14 changed a rule (Pay for Sale now reaches the step; Hybrid still 404; `live_confirmed_at` also written by the sale self-confirmation, sale only) | pass |
| 19 | No duplicate screen names; every import resolves | D; `importsResolve.test.js` | pass |

Full-run compare: see `06-diff/notes.md` (numbers filled from the run).
