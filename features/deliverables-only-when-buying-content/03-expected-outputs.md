# Expected outputs

| File | Change |
|---|---|
| `backend/src/services/deliverables.model.js` | **new** — `buysContent`, `plannedDeliverables` |
| `backend/src/controllers/contract.controller.js` | `brandSign` asks the rule; both hard-coded refusals deleted |
| `backend/src/controllers/influencer.controller.js` | the backfill stops inventing a reel; now selects `cs.goal` |
| `backend/scripts/run-test-file.js` | `toThrow` added to the shim |
| `Packages/Mobile/src/utils/collabDetailModel.js` | the shoot hero tells a commission creator she is live |
| `Packages/Mobile/src/screens/influencer/CollabDetailScreen.js` | supplies `sellsOnly` and `hasShoot` |

No migration. No schema change.

## Verification

* `backend/tests/deliverables-when-buying-content.test.js` — 19 checks, **10 mutations, 10 caught**
* Mobile suite **48 suites / 545 tests**; backend 19/19, 19/19, 20/20, 25/25, 12/12, 11/11
* **Every set in production** run through the new rule: 10 sets, 9 pass, 1 correctly still refuses
* Asha's exact row: **countersign passes**, 0 deliverables

Certified no-regression. Never claimed green.

## Two things this found in my own work

* **A zero count silently became one.** `Math.max(1, parseInt(count) || 1)` turned a format the
  brand had explicitly set to zero into one deliverable, and made the "everything is zero" branch
  unreachable. Caught by its own test failing, not by reading.
* **A check that passed while testing nothing.** `toContain('plannedDeliverables')` was satisfied
  by the function merely being *named* — hardcoding the goal at the call site left it green while
  refusing every commission countersign exactly as before. Now the arguments are pinned.

That is the fifth and sixth time in this session a check has passed by matching something other
than what it meant to.

## `toThrow` added to the runner

A check needed it and the runner did not have it. Added to the **runner**, not worked around — a
runner that quietly lacks what tests want to say pushes people towards weaker tests. Proved in
both directions: three passing cases and four that must fail, including a non-function argument.

## One creator is still blocked, correctly

Ravi K. sits at `pending_brand` on the practice set *"Reels"* — goal `engagement`, no formats.
The brand is paying a fee and has not said what content, so the refusal stands. It is recoverable:
`formats_json` is editable on a live set.
