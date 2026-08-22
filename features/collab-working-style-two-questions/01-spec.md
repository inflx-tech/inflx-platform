# How you'd work together — two questions, not three answers

## The instruction

Founder, 2026-08-22:

> while sending collabration request from brand, How youd work together, we have three
> that is store visit, we ship products and remote. so actually it is two one is store
> visit and remote...remote selected then ask for product shipping involved..if yes then
> that flow will continue.

## What is wrong today

`HOW YOU'D WORK TOGETHER` offers three chips — Store visit · We ship products · Remote —
as three answers to one question. They are not the same kind of thing.

* Store visit and Remote answer **where she works**.
* We ship products answers **whether a box moves**.

Putting them side by side does two harms. A brand that ships product *and* wants a store
visit must pick one and silently lose the other. And a brand working remotely is never
asked the shipping question at all, which is exactly the case where it matters.

## What it becomes

Two questions, the second conditional on the first.

1. **Where they'd work** — Not stated · Store visit · Remote
2. **Are you sending her products?** — Yes, we'll ship · No — **shown only when Remote**

Store visit never asks question 2: she is standing in the shop.

## What is stored

Unchanged. The existing three values stay exactly as they are on the wire and in the
database:

| Answer on screen | Stored |
|---|---|
| Store visit | `visit` |
| Remote + No | `remote` |
| Remote + Yes, we'll ship | `shipment` |

This is deliberate. `shipment` is the word the **production machinery** already keys off:
address confirmation, courier and AWB, delivery confirmation, the daily reminder job for
unconfirmed parcels, the 14-day stall alert to admin, and the contract PDF. Renaming it
would mean touching all of that for no gain, plus a migration. The screen changes shape;
the record does not.

## "then that flow will continue"

The shipping flow the founder refers to **already exists and runs in production**:
address confirmed → dispatched with courier + AWB → arrival confirmed → shoot and post,
with a daily nudge and an admin stall alert. One shipping collaboration has completed
through it.

This change does not build it and does not start it early. A parcel is dispatched only
after the agreement becomes a signed contract. Answering "yes" at handshake **records the
intention** so it is not re-decided later, and so the creator knows a box is coming before
she agrees.

## Item 2 — the same question asked twice (founder go required)

Found during the survey, raised rather than silently fixed because it changes behaviour
that was not asked for.

After both sides agree "remote, we're shipping", `BrandContractScreen` asks the same
question again — three cards, **not pre-filled**, in a different vocabulary (Visit /
Shipment / Remote). The brand can answer differently from what was agreed and nothing
objects; the creator then signs a contract contradicting the request she accepted.

Proposed: same two questions, same words, pre-answered from the agreement, changeable.

Doing item 1 alone leaves a brand who chose "Remote · we'll ship" seeing a "Shipment" card
two screens later. Recommendation: both in one pass.

## Live data checked (verify-twice, 2026-08-22)

* `brand_collab_requests` — 11 rows, `terms_json->>'mode'` = `visit` on all 11.
* `collab_agreements` — 6 rows, all `visit`.
* **Zero** live conversations use the option being retired. Nothing to migrate.
* `production_events` — 1 `shipment` (confirmed), 3 `visit` (completed). The downstream
  flow is real and has been used.

## Out of scope

* The creator's own pitch (`SendProposalScreen`) does not state a working style and is
  not touched.
* No change to aim, money, time, or what-they'd-promote.
* No database migration.
