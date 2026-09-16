# Impact

## Verdict

**Small and reversible. One flag, three functions, one admin control.** The risk is not the
size of the change — it is that the switch reaches further than intended, so every guard here
is about keeping it inside "restrictions".

## What changes

| Layer | File | Change |
|---|---|---|
| DB | new migration | one `platform_settings` row, value **1** |
| Backend | `services/platformSettings.service.js` | one key + label + description |
| Backend | `services/entitlements.service.js` | one `enforced()` read honoured in `hasFeature`, `quotaFor`, `configFor` |
| Backend | `middleware/quotaCheck.js` | `evaluateQuota` short-circuits |
| Backend | `controllers/subscription.controller.js` | `plans_enforced` on two payloads |
| Admin | `app/admin/settings/platform/page.js` | switch for 0/1 keys, confirm step |
| Admin | subscriptions + pricing pages | one banner while off |
| Mobile | brand app | hide upgrade prompts on `plans_enforced: false` |

## What does NOT change

`webhook.controller.js` and `pricing.service.js` — the two places that read tiers to **charge
money** — are not touched, and test 17 proves the switch cannot reach them. Tiers, prices,
per-tier quotas, the feature catalogue and per-brand overrides are all untouched data.

## Risks

| Risk | Severity | Guard |
|---|---|---|
| The switch accidentally stops billing | **High** | It is never read by the billing path; test 16 compares the subscription row before and after a flip, test 17 pins the renewal price |
| A missing row or a failed read silently unlocks the product | **High** | Both default to ON. Tests 8 and 9 |
| OFF turns out to be narrower than ON somewhere | Medium | Property test 10 across every catalogue feature |
| Brands exceed limits while off and break when it is back on | Medium | Quotas are counted, not stamped: over is over, nothing is deleted, nothing stops working. Written into 02-workflow |
| An admin forgets it is off | Medium | Banner on every admin page that shows a limit, plus the audit line |
| The 60-second cache confuses someone testing the switch | Low | Stated on the page; the write busts the cache |

## Release classification

**Production-impacting** — backend, admin website and brand app. Migration + push (Render +
Vercel) + one OTA. Explicit go required, as always.

Shipping it is inert by construction: the row arrives set to **ON**, which is exactly today's
behaviour. Nothing changes until somebody flips it.

## What it unblocks

The walk's Act 3 needs two sets in one campaign, which the free tier forbids. With this, the
whole subscription layer can be switched off for the walk and switched back on afterwards,
without touching a single tier number or inventing practice-brand exceptions.

---

## Found while building, and deliberately NOT fixed here

**The test harness makes every quota test vacuous.** `truncateAll()` empties the `features`
catalogue and never puts it back, so `getEntitlements` sees an empty catalogue, every quota reads
back `null`, and the middleware treats `null` as "not configured" and passes. A test that means to
prove a limit *blocks* is proving nothing. (There is a second layer: the reseeded rows get new ids
while the entitlements catalogue and the platform settings are cached for 60 seconds, so even a
correct reseed is read stale.)

I fixed it in `tests/helpers/db.js` on 2026-09-16 and measured the result honestly:

| | suites | tests failed | tests passed |
|---|---|---|---|
| HEAD, before this contract | 46 | 222 | 1070 |
| with the global reseed | 47 | 245 | 1061 |

The 14 new tests all passed, so the reseed turned **23 previously-green tests red**. Those tests
were green only because nothing was being enforced; with a real catalogue they meet real limits
and their fixtures have never set up entitlements. That is a genuine finding and a real piece of
work — and it is **not this contract's**. Fixing 23 unrelated tests inside a feature commit would
bury both.

So the reseed was reverted, and this suite seeds its own catalogue in its own `beforeEach`, where
it cannot touch anybody else. The harness defect is written up at the top of
`tests/subscriptions-master-switch.test.js` and should be carved as its own contract:
**"the quota tests do not test quotas"**. Until then, every existing assertion of the form
"this plan limit blocks" should be read as unproven.
