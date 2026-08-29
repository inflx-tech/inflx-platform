# Expected outputs

| File | Change |
|---|---|
| `backend/src/services/production.service.js` | `getVisitDateRange` returns `impossible` + `reason` |
| `backend/src/controllers/influencer.controller.js` | the collab payload carries `production_event` |
| `Packages/Mobile/src/screens/influencer/CollabDetailScreen.js` | `logistics` and `tracking` get labels |
| `Packages/Mobile/src/screens/brand/BrandShootScreen.js` | unwrap the range properly |
| `Packages/Mobile/src/screens/influencer/ShootScreen.js` | unwrap the range properly |
| `Packages/Mobile/src/components/shoot/ShootParts.js` | an impossible window says so; a broken one draws nothing |

No migration.

## Verification

* `collabDetailModel.test.js` + `stage4Shoot.test.js` — **96 checks, 10 mutations, 10 caught**
* Mobile suite **48 suites / 565 tests**
* `getVisitDateRange` run against **her real contract**: `impossible: true`, with the sentence
  naming the posting date

Certified no-regression. Never claimed green.

## ⚠️ My four new checks passed while not existing

The block was inserted through a helper whose newline argument was `undefined`, so the whole
thing landed as **one line**. Everything after the first `//` was commented out. The file parsed,
the suite went green, and the four cases **never registered**.

The mutation run caught it: 9 mutations, **7 survived**. Nothing else would have — the test count
looked normal and no assertion failed, because there were no assertions.

Re-inserted line by line, with the script asserting the lines landed as separate lines before it
would write. Then re-mutated: 10 of 10 caught.

That is the eighth time this session a check has proved to be testing nothing, and the first time
the check did not exist at all. Every one was found by mutation.

## The check that existed and asked the wrong thing

Since Stage 3, `collabDetailModel.test.js` has asserted that **every hero action is wired**. It
passed the entire time `logistics` had no label, because a button can be perfectly wired and
still be a blank rectangle.

It now also asserts every emitted action **has words on it**, read out of the screen's own label
map.
