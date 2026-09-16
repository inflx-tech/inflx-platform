# Expected outputs

| # | Expect |
|---|---|
| 1 | After `truncateAll()`, `features` holds the full catalogue (13 rows) |
| 2 | After `truncateAll()`, `tier_features` holds a row per tier per quota feature, carrying that tier's own number |
| 3 | An enterprise test brand reads `-1` (unlimited) for every quota |
| 4 | A free test brand reads the free numbers: 1 campaign, 1 set per campaign, 10 products, 5 invitations |
| 5 | `quotaCheck.test.js` passes in full — including "the 11th product → 422", the check that has been failing unseen |
| 6 | `features-and-entitlements.test.js` still passes in full |
| 7 | `subscriptions-master-switch.test.js` passes with its local seeding REMOVED |
| 8 | The whole-suite failure count is **lower** than the measured baseline, and **no test that passed before fails after** — proved by name, not by totals |
| 9 | Nothing under `backend/src/**` changed |
