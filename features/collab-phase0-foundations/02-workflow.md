# Phase 0 — the order of work

Five slices. The order matters in two places only: the migration comes first, and the three
corrections must land with the counter-back capability, never after it.

---

## Slice 1 · The migration

One migration, run against production **before** the push.

- A table for the diary: which collaboration, which step, who acted, what they did, a snapshot
  of the terms at that moment, and when.
- Three columns on creator pitches: rounds used by each side, and who countered last.
- A backfill that states a fact rather than guessing: any pitch that already carries a counter
  was countered by the brand, because until now nobody else could.

**Why first.** Everything else writes to it.

**Risk check before running:** creator pitches hold zero rows in production, so the new columns
and the backfill affect nothing. Brand requests hold two rows and are not touched.

---

## Slice 2 · The diary, and its writers

The table alone is useless. Six places start writing to it:

| Step | Writes when |
|---|---|
| Agreeing terms | asked · opened · countered · accepted · declined · expired |
| Signing | invited · accepted · creator signed · brand countersigned |
| The shoot | keeps its own record **and** writes here, so one screen shows any step |
| Shop posts | submitted · sent back with the fault · resubmitted · approved · live |
| Going live | submitted · changes asked, each round · approved · posted · confirmed |
| Completion | each condition, as it is met |

**The rule for an entry:** it records **what changed**, not that something did. "15% → 22%"
is the information; "countered" is not.

**No backfill.** The diary starts the day it ships. What was overwritten is gone, and inventing
it would put fiction on a screen two people use to settle disagreements.

---

## Slice 3 · The two calculations

**The step number.** One function, on the server, answering: what step is this collaboration
on, and whose turn is it. Aware of the track — a content collaboration has no shop-posts step.

**The needs-you count.** One function, answering: how much is owed here, and beneath here. A
parent is its children plus its own.

**Both must be single-sourced.** If either is ever computed in an app, the two apps will
eventually disagree about the same collaboration. Nothing in this phase renders them — they
exist so Phases 2 and 4 can read them.

---

## Slice 4 · The creator counters back

A new route so she can counter a brand's counter on her own pitch. It validates through the
same rules the other direction already uses, so a must-have stays uncounterable and the round
limits are the admin-set ones, not new numbers.

The brand is notified, and sees what moved as a change rather than a fresh proposal.

---

## Slice 5 · The three corrections

Land with slice 4, in the same push. Each one is only a defect once she can counter — shipping
the capability without them would mean shipping three known bugs.

1. **Brand acceptance settles the latest terms**, whoever moved them last.
2. **The brand's counters are capped** at the same rounds the creator has.
3. **Nobody can accept their own counter** — the check must look at who countered, not just
   that someone did.

**Each correction gets a check written first, failing, then the fix.** A check written after
the fix proves only that the code does what it does.

---

## How we verify

Run everything in `03-expected-outputs.md`. In particular:

- **T19 is the one to run first** — pitch, counter, counter back, accept, and read the agreed
  amount. It should say ₹14,000 and today says ₹20,000. If that passes before the fix, the
  check is wrong.
- **T1** proves the diary: play a four-move negotiation and read all four moves back.
- **T22** proves nothing broke: an un-updated phone behaves exactly as before.
- Full suite green against a baseline of 386, nothing weakened to get there.

**Assert what comes back, not what the query does.** A diary entry computed and then dropped
by a serialiser is a feature that does not exist — that has happened here before.

---

## Deploy

1. Run the migration against production
2. Confirm it applied — table present, columns present, backfill correct on the rows that exist
3. Commit
4. Ask for the go
5. Push — which deploys the backend
6. No OTA. Nothing in either app changed.

**Deploy class:** production-impacting — a migration and backend code. Explicit go required
before the push.

**No device pass needed.** Nothing on a phone changed. The first phase that needs one is
Phase 4, which adds routes to native stacks.

---

## What would make me stop and come back to you

- If the diary's snapshot turns out to need more than the terms — for instance if a rejection
  reason doesn't fit the shape — I would rather change the shape now than ship a diary that
  needs a second migration in Phase 7.
- If the step calculation can't cleanly answer for a collaboration that predates the handshake.
  There are a small number of older records, and I would rather agree what they should read than
  pick something silently.
