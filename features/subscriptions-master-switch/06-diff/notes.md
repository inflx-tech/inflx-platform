# Before / after — the master switch

Mockups: `04-preview/mockups/subscriptions-master-switch.html` (M1–M6).

## What matches the mockup

| Mockup | Built | Note |
|---|---|---|
| M1 the switch row | Admin → Settings → Platform, **first row**, above the numbers | The key is declared first in `DEFAULTS`, which is the order the page draws. It governs the rest, so it leads. |
| M2 editing | the switch stays a switch while the numbers become boxes | `kind: 'switch'` on the setting, read by the page; a 0/1 range draws as a switch even without the hint |
| M3 the confirm | shown only when turning it **off**, listing the three things that stop and the one that does not | the only save on this page that asks |
| M4 saved | amber banner at the top of the page while it is off; the audit line reads **on → off**, not 1 → 0 | |
| M5 the other admin pages | `components/PlansOffBanner.js` on Subscriptions, Pricing → Tiers and Pricing → Features. All three still fully editable and still saving | |

## Where it departs from the mockup, and why

**M6 was drawn as a phone screen. It is built on the website.**

The mockup showed the brand's plan page on a phone. There is no plan or subscription screen in the
brand mobile app — checked, not assumed: nothing under `Packages/Mobile/src` reads a subscription,
a tier or a quota. The brand's plan lives at **brand-web → Dashboard → Settings → Subscription**,
and the upgrade wall that quotas actually trigger is `components/QuotaWallModal.js` on the products
and campaigns pages.

So M6 is built there, with the same behaviour the mockup promised:

- the plan card still names her plan, its price, her cycle and her next charge — she is still on
  that plan and still paying for it;
- "Usage this cycle" is replaced by one line, *"No limits are being applied at the moment."*;
- every other tier's **Choose** button reads *"Not needed right now"* and is inert;
- the quota wall on products and campaigns cannot open at all, because the preflight it asks can
  no longer answer `would_block: true`.

Nothing was drawn for the mobile app, because there is nothing there to change. Building a plan
screen on the phone to match a mockup would be inventing scope the contract never asked for.

## What has no mockup at all

The backend half — and it is most of the work. With the switch off the refusals simply never get
made: `quotaFor` answers unlimited, `hasFeature` answers yes, `configFor` answers uncapped, and
`checkQuota` never throws. There is no screen for that. It is proved by
`backend/tests/subscriptions-master-switch.test.js`, 14 tests covering expected outputs 1–21,
each run with the switch on AND off.

Two of those matter more than the rest:

- **Billing is untouched.** The `brand_subscriptions` row and the renewal price are compared
  before and after a flip and must be identical.
- **A missing row, or a failed read, enforces.** A settings failure must never silently unlock
  the product.

## Two harness defects found while building this

Neither is part of the feature; both were fixed because the feature's tests could not be trusted
without them, and they were making other people's tests lie.

1. **`features` was being truncated and never reseeded.** After `truncateAll()` the catalogue held
   zero rows, so `getEntitlements` saw an empty catalogue, every quota read back `null`, and the
   middleware treated that as "not configured" and passed. Any test asserting that a plan limit
   *blocks* was asserting against a platform with no limits at all.
2. **The reseeded catalogue gets new ids, and two services cache the old ones.** The entitlements
   catalogue and the platform settings are both cached for 60 seconds, so after a truncate the
   cached rows pointed at feature ids that no longer existed. That is what made
   "enterprise bypasses all quotas" fail against perfectly good code.

With both fixed, `quotaCheck.test.js` and `features-and-entitlements.test.js` pass in full.
