# Expected outputs

## Backend

| File | Change |
|---|---|
| `src/services/productionMode.model.js` | **new** — `resolveProductionMode`, `initialStatusFor` |
| `src/services/production.service.js` | resolves the agreed mode; nothing born completed; the remote flip stops auto-completing; `completeShoot` records a side; `agreementModeFor` |
| `src/services/parcel.service.js` | **new** `REQUIRES_BOTH`, `needsBothToComplete`, `isShootComplete` |
| `src/services/contract.service.js` | `autoCreate` carries `terms_json->>'mode'` onto the contract |
| `src/controllers/production.controller.js` | auto-heal covers remote; flip notification no longer keys off completion; stale copy corrected |
| `migrations/164_shoot_two_sided_completion.sql` | **applied to production** |
| `scripts/run-164.js` · `scripts/repair-164-autocompleted-shoots.js` | migration + data repair, both with `--dry` |

## Mobile

| File | Change |
|---|---|
| `src/utils/shoot.js` | mirrors the new rule; `waitingOnOtherSide`, `WAITING_ON_OTHER` |
| `src/screens/influencer/ShootScreen.js` | the third state |
| `src/screens/brand/BrandShootScreen.js` | the third state |

## Verification

* `backend/tests/shoot-plan.test.js` — 29 checks, **13 mutations, 13 caught**
* `Packages/Mobile/src/screens/brand/__tests__/stage4Shoot.test.js` — 63 checks, **6 mutations, 6 caught**
* Mobile suite **48 suites / 558 tests**; backend 19/19, 19/19, 20/20, 25/25, 12/12, 11/11
* Migration **dry-run inside a rolled-back transaction** before it was applied: rows 5→5,
  completed 4→4, half-marked 0, marked-early 0
* Data repair **dry-run first**: exactly 1 row matched, and it was the right one
* Every live contract re-read afterwards

Certified no-regression. Never claimed green.

## The mirror is pinned, not copied

`stage4Shoot.test.js` **lifts `REQUIRES_BOTH` and `isShootComplete` out of the server's own source
and runs them** against the phone's. Drift on either side fails. Both directions were mutated to
prove it.

## One check that passed while testing nothing

`toContain('isShootComplete')` was satisfied by a `logAction` line two lines above the guard.
Replacing the guard with `if (false)` — closing every shoot on one mark, the exact Stage 4 bug —
left it green. Now it asserts the guard itself.

That is the seventh time this session a check has passed by matching something other than what it
meant to. Every one was found by mutation, none by reading.

## What is deliberately NOT changed

* The slot-proposal, counter and reschedule flows. They were correct; they were just unreachable.
* Shipment and remote stay one-sided.
* Nothing about how a collaboration leaves the shoot.
