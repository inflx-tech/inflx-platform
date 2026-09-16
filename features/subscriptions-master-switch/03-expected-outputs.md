# Expected outputs

Each is a test, and each runs **twice** — switch on, switch off.

## Backend — the service

| # | With the switch | Expect |
|---|---|---|
| 1 | ON | `quotaFor(free brand, 'sets_per_campaign')` → `1` |
| 2 | OFF | same call → `-1` |
| 3 | ON | `hasFeature(free brand, 'bulk_outreach')` → `false` |
| 4 | OFF | same call → `true` |
| 5 | ON | `requireFeature(...)` throws FEATURE_NOT_AVAILABLE |
| 6 | OFF | `requireFeature(...)` returns silently |
| 7 | OFF | `configFor(...)` → `{}` |
| 8 | row missing | behaves as ON (a missing row never unlocks the product) |
| 9 | read throws | behaves as ON |
| 10 | either | **OFF is never narrower than ON** — property test across every catalogue feature |

## Backend — the endpoints

| # | With the switch | Expect |
|---|---|---|
| 11 | ON | second set on a free brand → 422 QUOTA_EXCEEDED |
| 12 | OFF | second set on the same brand → 201, and the row exists |
| 13 | OFF | sixth campaign, eleventh product, sixth invitation → all succeed |
| 14 | OFF | `GET /brands/me/quota-preflight?action=createSet` → `would_block: false`, `limit: -1` |
| 15 | both | `GET /brands/me/subscription` carries `plans_enforced` matching the switch |
| 16 | OFF | **billing is untouched**: the brand's `brand_subscriptions` row, tier, cycle dates and renewal amount are byte-identical before and after the flip |
| 17 | OFF | `computeL1Renewal` still returns the paid tier's price — proof the switch did not reach billing |

## Backend — the switch itself

| # | Expect |
|---|---|
| 18 | Only an admin with platform-settings rights may change it; anyone else gets 403 |
| 19 | Flipping it writes one audit row: key, old, new, who, when |
| 20 | A change is visible to a new request within the 60-second cache window, and immediately after a bust |
| 21 | Values other than 0 and 1 are refused by the range check |

## Admin page

| # | Expect |
|---|---|
| 22 | The row renders as a switch, not a number box |
| 23 | Turning it off asks for confirmation naming what happens, and Cancel leaves it on |
| 24 | While off, Subscriptions, Pricing → Tiers and Pricing → Features each show the banner |
| 25 | While off, those pages still save normally |
| 26 | The audit line reads "on → off" in words, not "1 → 0" |

## Brand app

| # | Expect |
|---|---|
| 27 | While off, no upgrade prompt or usage meter is drawn |
| 28 | While off, the plan page still names the plan and its price |
| 29 | While on, every one of those is exactly as it is today |

## Regression

| # | Expect |
|---|---|
| 30 | With the switch ON, every existing entitlements, quota and subscription test passes unchanged |
