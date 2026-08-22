# Impact

**One line: the collaboration request stops treating shipping as a place of work.**

## Deploy class

**production-impacting** — both phone apps via OTA. `backend/src` unchanged. No migration.

## Blast radius

| Area | Effect |
|---|---|
| Brand — Ask to collaborate | Working-style block reshaped. |
| Creator — Request detail | Working style reads as two lines. |
| Both — What happened here | Term label corrected. |
| Brand — Contract (item 2) | Two questions, pre-answered. **Founder go required.** |
| Backend, DB, contracts, PDFs, shipping flow, reminders, admin alerts | **Untouched.** |

## Why the risk is low

No database change. No change to money or timing. The stored vocabulary is identical to
today's, so every consumer downstream — validation, contracts, production events, the PDF,
the reminder job, the admin stall alert — sees exactly what it saw before.

Live data confirms nothing needs migrating: 11 requests and 6 agreements exist and all 11
and all 6 are `visit`. The retired option has never been used in a live conversation.

## What could still go wrong on the handset

1. Store visit showing the shipping question. Must never happen.
2. Switching Remote → Store visit → Remote re-revealing a stale "Yes".
3. An existing `shipment` request rendering blank on the creator's side under the new labels.

All three are on the device walk.

## Reversibility

Fully reversible by OTA. No data is written in a new shape, so a rollback leaves nothing
behind to clean up.
