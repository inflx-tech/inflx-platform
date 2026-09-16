# Subscriptions — the master switch

**Asked for:** founder, 2026-09-16, during the items 2–8 walk.
**Cause:** the walk stopped because the free plan allows one set per campaign. The limit was
correct; the question it raised was bigger than the limit.

> "In subscriptions in admin, is it possible to set one switch — if the platform wants to
> implement subscriptions, switch ON and set various things; if the feature itself needs to be
> switched off, then without restrictions we simply switch it off whenever we want."

---

## 1. What this is

**One switch in admin that decides whether plan limits apply at all.**

- **ON** — exactly what happens today. Tiers, quotas, feature gates, upgrade messages.
- **OFF** — every brand behaves as if it were on the unlimited plan. No quota can block, no
  feature is withheld, no "upgrade to continue" sentence can be produced anywhere.

Turning it off changes **nothing about the configuration**. Tiers, prices, per-tier quotas, the
feature catalogue and every per-brand override stay exactly as they are, asleep. Turn it back on
and the platform is restricting again on the same numbers, within a minute, with no deploy.

---

## 2. What it is NOT

**It does not stop billing.** Founder's decision, 2026-09-16: the switch governs *restrictions
only*. A brand already paying for Growth keeps its subscription, keeps its renewal date and
keeps being charged. Nothing is cancelled, refunded or paused.

> Mixing "stop restricting" with "stop charging" in one control is how a platform accidentally
> cancels its own revenue. If charging should stop too, that is a second, separate switch and a
> separate decision.

It is not a per-brand exemption — that already exists (Admin → Brands → a brand → Feature
Overrides) and is untouched. It is not a rewrite of tiers, quotas or the feature catalogue.
It is not a code deploy: it is a value in a table an admin can change.

---

## 3. Why it is small

Every plan restriction on the platform already runs through **one service**,
`backend/src/services/entitlements.service.js`, in exactly three ways:

| Restriction | Function | Used by |
|---|---|---|
| A quota that can run out | `quotaFor` | `middleware/quotaCheck.js` → `checkQuota('createSet' \| 'createCampaign' \| 'createProduct' \| 'inviteInfluencer')` |
| A feature withheld entirely | `hasFeature` / `requireFeature` | multi-branch, bulk outreach, advanced search filters |
| A capped setting | `configFor` | campaign controller's caps |

Surveyed 2026-09-16 — **nothing else enforces a plan.** The only two places that read
`subscription_tiers` outside these are `webhook.controller.js` and `pricing.service.js`, and
both are *charging money*, not restricting. They are deliberately left alone (§2).

So the switch is one flag honoured in three functions. Everything downstream inherits it.

---

## 4. Where the switch lives

`platform_settings` — the table behind **Admin → Settings → Platform**, which already holds
negotiation rounds, pool lifetime, the campaign fee and the pitch windows.

It comes with, at no cost:

- an **audit row on every change** (who, when, old value, new value), already displayed at the
  foot of that page;
- a **60-second in-process cache**, busted on write, so a change reaches every request within a
  minute without a restart;
- an admin page that already loads, validates and saves these keys.

New key:

| key | value | min | max | unit | label |
|---|---|---|---|---|---|
| `subscriptions_enforced` | `1` | 0 | 1 | `on/off` | Subscription plans |

It ships **ON (1)**, so applying this changes nothing until somebody turns it off.

> The table's `value` column is an `int` with `CHECK (value BETWEEN min_value AND max_value)`,
> so a 0/1 key needs no schema change — only a row.

---

## 5. What OFF does, precisely

| Question | ON (today) | OFF |
|---|---|---|
| `quotaFor(brand, feature)` | the tier's number | `-1` (unlimited) |
| `checkQuota(...)` | 422 QUOTA_EXCEEDED when used ≥ limit | never blocks |
| `hasFeature(brand, feature)` | the tier's answer | `true` |
| `requireFeature(...)` | 422 FEATURE_NOT_AVAILABLE | never throws |
| `configFor(brand, feature)` | the tier's cap | `{}` (uncapped) |
| `GET /brands/me/quota-preflight` | `would_block` per tier | `would_block: false`, `limit: -1` |
| `GET /brands/me/subscription` | plan + usage + entitlements | same, plus `plans_enforced: false` |
| Upgrade prompts in the apps | shown | hidden (the client reads `plans_enforced`) |
| Plan and pricing pages | shown | **still shown** (founder's decision) |
| Billing, renewals, Razorpay | charging | **unchanged — still charging** |
| Admin tiers / features / overrides pages | editable | **still editable**, with a banner saying limits are not in force |

Two invariants, both tested:

1. **OFF can only ever widen.** No call may return a smaller quota, fewer features or a tighter
   cap with the switch off than with it on.
2. **ON is byte-identical to today.** With the switch on, every existing entitlements and quota
   test passes unchanged — that is the regression proof.

---

## 6. Surfaces touched

- **backend** — `services/platformSettings.service.js` (one key), `services/entitlements.service.js`
  (three functions), `middleware/quotaCheck.js` (short-circuit), `controllers/subscription.controller.js`
  (expose `plans_enforced`), one migration (the settings row).
- **brand-web admin** — `app/admin/settings/platform/page.js` renders a switch for 0/1 keys
  instead of a number box; a banner on the subscriptions, pricing-tiers and pricing-features
  pages while it is off.
- **mobile (brand)** — hide upgrade prompts when `plans_enforced` is false.
- **Roles** — only an admin who can already edit platform settings may flip it.

## 7. Failure modes

| If | Then |
|---|---|
| The settings row is missing (pre-migration deploy) | Default **ON**. The platform keeps restricting exactly as it does today — a missing row must never silently unlock the product. |
| The settings read throws | Default **ON**, same reason. The existing service already falls back to defaults on a failed read. |
| The switch is flipped mid-request | The request in flight finishes on the value it read. Within 60 seconds every new request sees the change. |
| An admin flips it off and forgets | Every admin page that shows a limit carries a banner while it is off, and the audit line names who turned it off and when. |

## 8. Open questions

None. Both were answered by the founder on 2026-09-16: restrictions only (billing untouched),
and plan pages stay reachable with the upgrade prompts hidden.
