# item10-store-visit — impact

**Production-impacting. Money-adjacent but money-moving nowhere.** Explicit go required before
migrate, push and OTA.

## Database — migration 187, additive
`production_events` +13 columns and a 500-char CHECK on notes; `campaign_influencers`
`delayed_at`, `delayed_stage` (CHECK); `negotiations.production_event_id` + partial unique index;
`negotiations_one_anchor` rewritten as `num_nonnulls(...) = 1`; `platform_settings`
`shoot_auto_confirm_days` seeded. No backfill. **One data correction** behind `--fix-modes`: six
named `production_events` rows get `mode = cs.shoot_mode`, nothing else.

## Behaviour that changes for existing users
- Every path into the shoot now refuses an unsigned or unfunded paid collaboration. In
  production all seven signed collaborations pass the gate (three Pay for Sale, four funded).
- A Store Visit set can no longer be created or edited onto a branch with no street address.
  The three practice brands have none today — the founder adds them before the walk.
- The website's visit panel, the mode picker and flip-to-remote stop working server-side
  (422), replaced by a read-only card.
- The old slot dance endpoints stop; nothing in either app called them since 10 Sep.

## What does not change
Balances, escrow rows, ledger rows, contracts, invitations, sets, item 4's counts and expiry,
`shoot-plan.test.js`'s 29 assertions, Remote/shipment endpoints (item 11's, now behind the gate).

## Apps
Brand and creator OTA (JS only; `NATIVE_RUNTIME` stays 3). New screens, no new native module.

## Handover notes for item 11 (Remote)
Same table, gate, mode source, completion columns, Delayed flag and stage vocabulary, notification
namespace, Needs You rule, F1 shape. Item 11 must fix `addParcelItems`' undefined `brandId`
(`production.controller.js:696` vs `getContractParties`, which never selects `b.id`) — left as is
here. Pitch threads still get no 48-hour reminder — a separate piece of work.
