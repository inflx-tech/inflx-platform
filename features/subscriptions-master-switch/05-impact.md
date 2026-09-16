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
