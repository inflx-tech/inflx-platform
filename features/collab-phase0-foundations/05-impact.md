# Phase 0 — impact

**Verdict in one line:** a migration and backend only, with no screen touched and almost no
blast radius today — because the thing it changes has zero rows in production.

---

## What actually carries risk

### 1 · The acceptance correction is a real behaviour change

Brand acceptance stops settling the creator's original terms and starts settling the latest.

**Blast radius today: zero.** The new path needs a creator counter to exist, and nothing can
write one until this same phase ships the capability. Creator pitches hold **zero rows** in
production.

This is a correction landing *with* the capability that would otherwise make it a live bug —
deliberately, because shipping the counter first would arm it.

### 2 · The migration is additive

One new table. Three new columns. Nothing dropped, renamed or retyped. The backfill states a
fact — only a brand could have countered until now — rather than guessing.

### 3 · Six code paths start writing to the diary

The failure mode worth naming: a diary write that throws could take down the action it was
recording. **Writing to the diary must never be able to fail the thing it describes.** A
missing history line is a nuisance; a counter that didn't send because its history line failed
is a defect.

### 4 · The shoot now records in two places

It keeps its own existing record and also writes to the diary. Two writers for one truth is
usually a smell. It is accepted here because the existing record is load-bearing for the
production queue and rewriting that is not this phase's job — but the diary is the one a screen
reads, and if they ever disagree, the diary is wrong.

---

## What is untouched

Contracts, payments, the ledger, wallets, escrow, deliverables, discovery, allocation, offers,
campaigns, the follower app. This phase touches no money path: it records what was said and
calculates two numbers.

No screen in any app changes. No admin screen changes.

---

## Safe for phones that have not updated

Yes, and this matters because the two apps update on their own schedule.

- Nothing reads the diary until Phase 2.
- Nothing reads the new columns until Phase 2.
- The two calculations are new endpoints nobody calls yet.
- The corrections fire only in states no shipped app can produce.

An un-updated phone behaves exactly as it does today. That is check T22 and it is not
optional.

---

## Deploy class

**Production-impacting.** A migration plus backend code. Migration first, against production,
before the push. Explicit go required before the push, because pushing is the deploy here.

**Targets:** the database, then the backend. No web. No app store, no over-the-air update —
nothing in either app changed.

---

## Where this could still go wrong

- **The diary's shape.** It has to carry six different kinds of event without becoming a
  shapeless bag. If a rejection reason or a parcel shortfall doesn't fit the snapshot cleanly,
  I would rather widen the shape now than migrate it again in Phase 7.
- **Older collaborations.** A handful predate the handshake and have no negotiation to record.
  Their step number needs an agreed answer rather than a silently chosen one.
- **Nothing is visible, so nothing is obviously broken.** This phase can only be proven by
  reading data back, not by looking at the app. That is why the checks in
  `03-expected-outputs.md` are the deliverable, not a formality — if they are weak, the phase
  ships unverified and the failure surfaces in Phase 2 as a screen that shows the wrong thing.
