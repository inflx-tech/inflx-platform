# subscriptions-master-switch — workflow prediction

Mockups: `mockups/subscriptions-master-switch.html` (M1–M6).

| Screen | Predicted | To be built as |
|---|---|---|
| M1 The switch in place | one row above the numbers on Settings → Platform, with the long description and an On/Off switch | `Packages/brand-web/app/admin/settings/platform/page.js` — a 0/1 key renders a switch instead of a number box |
| M2 Editing | the switch stays a switch while the numbers become boxes; nothing applies until Save | same page, existing edit mode |
| M3 The confirm | the only setting on the page that asks before it saves; names the three things that stop and the one that does not (billing) | a confirm dialog in the same page |
| M4 Saved | banner at the top of the page, audit line in words — "subscription plans on → off" | banner in the page; the audit line is the existing one, taught to read a 0/1 key as off/on |
| M5 The other admin pages | one banner at the top of Subscriptions, Pricing → Tiers and Pricing → Features; everything still editable and still saving | a small shared component reading the same flag |
| M6 The brand's plan screen | plan and price stay; usage meters and Upgrade go | brand app plan screen, gated on `plans_enforced` from `GET /brands/me/subscription` |

**Not drawn, because nothing is drawn:** the whole backend half. With the switch off the refusals
simply never get made — `quotaFor` answers unlimited, `hasFeature` answers yes, `configFor` answers
uncapped, and `checkQuota` never throws. There is no screen for that; there are tests 1–17 in
`03-expected-outputs.md`.

**Deliberate departure from the ask.** The founder asked for the switch "in subscriptions in admin".
It is proposed for **Settings → Platform** instead, because that page already has the audit trail, the
cache-busting write path and the admin role gate this needs; building a second settings mechanism
inside the Subscriptions page would duplicate all three. The Subscriptions page gets the banner (M5)
and a line pointing at the switch, so it is still findable from where she looked for it first.

**One behaviour worth reading twice before locking.** While the switch is off, a brand can go past
what its plan allows — four sets on a three-set plan, say. When the switch goes back on, nothing is
deleted and nothing stops working: quotas are *counted*, not stamped, so she simply cannot add a
fifth. That is the only place this switch can surprise anyone, and it is stated in `02-workflow.md`.
