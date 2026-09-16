# Impact

## Verdict

**Deploy-inert, and it makes the suite honest.** Nothing ships. What changes is what the robot is
able to notice.

## What changes

| File | Change |
|---|---|
| `tests/helpers/db.js` | reseed `features` and `tier_features`; bust the entitlements and platform-settings caches |
| individual test files | fixtures that assumed a world with no limits, each fixed on its own merits |
| `tests/subscriptions-master-switch.test.js` | local catalogue seeding removed; the harness does it now |

## What does not change

`backend/src/**`. Not one line. If a test goes red because the product is wrong, it is carved as a
backend-defect contract and left red — a test that fails for a real reason is doing its job.

## Risk

| Risk | Guard |
|---|---|
| A fixture is "fixed" by weakening what it asserts | Every change is a plan or a quantity, never an assertion. No-fake-green is absolute |
| A real product defect is papered over as a fixture problem | Each failure classified in writing in `06-diff/notes.md`; anything genuine leaves RED with its own contract |
| The suite gets slower | Two small INSERTs per truncate |

## Why it matters

Plan limits are what a brand pays for. The moment someone pays for Growth to get 3 sets per
campaign, "does the limit actually hold?" is a money question — and today the suite cannot answer
it. After this it can.
