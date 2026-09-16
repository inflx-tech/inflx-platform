# Workflow — the master switch

## The admin's walk

1. Admin signs in → **Settings → Platform**.
2. Top of the page, above the numbers, sits one row: **Subscription plans**, with a switch and
   the sentence *"When this is off, no plan limit applies to any brand. Tiers, prices and your
   per-brand overrides are kept exactly as they are; nothing is charged differently."*
3. They press **Edit**, flip the switch **off**, press **Save**.
4. A confirm step appears, because this one is not a number: *"Turn subscription plans off?
   Every brand becomes unlimited until you turn it back on. Billing is not affected."*
   → **Turn off** / Cancel.
5. Saved. The audit line at the foot reads *"Last changed by <name> on <date> · subscription
   plans on → off."*
6. Within one minute, every brand on the platform stops hitting limits.

## What the brand sees, while it is off

- A second set in the same campaign saves.
- An eleventh product saves.
- Advanced search filters work.
- The plan page still shows which plan they are on and what it costs; the **Upgrade** buttons
  and the "X of Y used" meters are gone, because there is nothing to be short of.
- Their card is still charged on the same date for the same amount.

## What the admin sees, while it is off

- Subscriptions, Pricing → Tiers and Pricing → Features all still open and save normally.
- Each carries one line at the top: *"Plan limits are switched off platform-wide. What you
  change here is stored and will apply when you switch them back on."*

## Turning it back on

The same switch. Nothing to restore — the tiers never changed. A brand that went over a limit
while it was off is **not** retroactively punished: quotas are counted, not stamped, so a brand
with 4 sets in a campaign on a 3-set plan simply cannot add a fifth. Nothing is deleted and no
existing row stops working.

> This is the one behaviour worth being explicit about, because it is the only place the switch
> can surprise someone. Going over is possible while off; what is over stays.

## Order of build

1. Migration: the settings row, value 1.
2. `platformSettings.service.js` — the key, its label, its description, its 0/1 range.
3. `entitlements.service.js` — one `enforced()` read, honoured in `hasFeature`, `quotaFor`,
   `configFor`.
4. `quotaCheck.js` — `evaluateQuota` short-circuits to `would_block: false`.
5. `subscription.controller.js` — `plans_enforced` on the subscription and preflight payloads.
6. Admin page — switch control, confirm step, banners.
7. Brand app — hide upgrade prompts on `plans_enforced: false`.
8. Tests at every layer, both states.
