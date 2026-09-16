# Before / after

No mockups: nothing is drawn. What changed is what the robot can notice.

## Measured, by test name, not by totals

Two full runs of the backend suite, `jest --runInBand --json`, diffed per test:

| | suites failed | tests failed | tests passed | total |
|---|---|---|---|---|
| Before | 46 | 222 | 1084 | 1306 |
| After | **45** | **221** | **1085** | 1306 |

**Fixed (was failing, now passes): 1**

- `quotaCheck.test.js :: createProduct on free tier (10-product wall) — 11th product → 422 QUOTA_EXCEEDED with rich payload`

That is the check that has been lying. It is the whole point of this contract: the suite now
actually proves that a plan limit blocks.

**Newly broken: 0.** No test that passed before fails after.

## The 23 never happened, and the reason matters

`05-impact.md` of the master-switch contract predicted 23 green tests going red, measured on
2026-09-16 when the features catalogue alone was reseeded. It was a real measurement of an
incomplete fix.

The missing half was **`tier_features`**. `subscription_tiers` was already being reseeded, but that
is not the table entitlements reads. With a catalogue present and no tier rows, every brand fell
back to the *catalogue defaults* — 1 campaign, 1 set, 10 products, 5 invitations — no matter which
plan it was on. `registerBrand` puts test brands on **enterprise**, which is meant to be unlimited,
so 23 tests that legitimately create several things were suddenly capped at the free numbers.

Seed both halves and those 23 read `-1` (unlimited), which is what their plan always said. Nothing
needed fixing test-by-test. The prediction was honest and wrong, in the good direction.

## What was actually changed

| File | Change |
|---|---|
| `tests/helpers/db.js` | reseed the 13-row features catalogue; reseed `tier_features` from each tier's own `max_*` columns; bust the entitlements catalogue cache and the platform-settings cache at the end of the reseed |
| `tests/harness-reference-data.test.js` | **new** — four checks that watch the floor every quota test stands on |
| `tests/subscriptions-master-switch.test.js` | local catalogue seeding removed; the harness does it now |

Nothing under `backend/src/**`. Not one line.

## Why the new guard test exists

The defect went unnoticed because nothing was watching the floor the other tests stand on. A
silently empty catalogue does not announce itself — it turns assertions into theatre, and the
suite reports the same comfortable number of failures it always has.

`harness-reference-data.test.js` asserts the four things that were untrue: the catalogue survives a
truncate, every tier carries its own number, an enterprise brand reads unlimited, and a free brand
reads real numbers rather than `null`. **Validated by breaking it**: with the reseed removed all
four fail; with it restored all four pass.
