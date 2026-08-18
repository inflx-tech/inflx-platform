# Phase 0 — Foundations nobody sees

**Programme:** `features/collab-programme/00-phase-plan.md`, phase 0 of 8.
**Mockups:** none. This phase has no screens.

Five things that five later phases stand on. Nothing a person can see changes. The reason to
do it first is that every alternative order means building something twice.

---

## 1 · A diary for every step

### What is wrong today

Kanchi Silks asks Asha for **15%, post by 24 August**. Asha counters **22%, 2 September**.
Kanchi counters **18%, 28 August**. Asha accepts.

Afterwards the system knows they settled on 18% and 28 August, that each side used one
counter, and when each message was sent, seen and answered. It does **not** know Kanchi ever
offered 15%, or that Asha ever asked 22%.

**Each counter writes over the one before it.** A month later, when Asha says *"didn't they
originally give me more time?"*, nobody can answer — not her, not the brand, not support.

The same hole exists twice more. A post sent back twice keeps only the second reason. A reel
that went two rounds of changes keeps only the second request.

**The shoot is the exception** — it already records every action, with who did it and when.
It is the only step that can settle an argument.

### What changes

Every step gets the diary the shoot already has. One line per action: **who did it, what they
did, when, and a snapshot of the terms at that moment.**

Six steps write to it: agreeing terms, signing, the shoot, shop posts, going live, and
completion. The shoot keeps its own existing record and also writes here, so one screen can
show any step's history.

### Why this blocks other work

The history screen drawn in FINAL 1 panel ⑧ cannot be implemented without it. Neither can the
per-step detail in FINAL 4 level 5. Building those screens first would mean building them over
four steps that keep no history.

---

## 2 · One step number, calculated on the server

### What is wrong today

Nothing calculates "step 3 of 6". Both apps would have to work it out from raw records.

### What changes

One calculation, on the server, returning the step a collaboration is on and whose turn it is.
Both apps read it.

### Why it matters

If the brand's app and the creator's app each work out the step independently, they will
eventually disagree about the same collaboration — and a brand ringing a creator to say "we're
stuck on step 3" is then talking about a different step. That is the exact failure this whole
spine exists to prevent.

---

## 3 · One needs-you count, calculated on the server

### What changes

One count per node: per collaboration, per set, per campaign, per tab. A parent's number is
everything beneath it plus anything owed at that level itself.

### Why it matters

FINAL 4's roll-up only works if the numbers reconcile at every level. Computed in the app, a
campaign could show 6 while its sets show 3 and 0 — and a badge that doesn't add up is a badge
people stop trusting.

---

## 4 · The creator can counter back on her own pitch

### What is wrong today

Asha pitches ₹20,000. The brand counters ₹8,000. **Her only replies are accept or walk away.**
She cannot say ₹14,000.

Meanwhile, when a *brand* starts the conversation, both sides get two counters each. So
"negotiate" currently means negotiate only when the brand started it.

There is also no limit at all on the brand's side of a pitch — a brand may counter forever.

### What changes

She can counter back, under the same round limits as the other direction. The brand's counters
get the same cap.

---

## 5 · Three corrections the above arms

Each of these is correct today only because the creator cannot counter. The moment she can,
each becomes a live defect — so they are fixed in the same phase that creates the capability,
not after.

| | Today | After |
|---|---|---|
| **Brand acceptance** | Only allowed on a pitch nobody has countered, and always settles the creator's **original** terms. Once she can counter back, the brand hits a **dead end** — it cannot accept her ₹14,000 at all. *(Corrected 2026-08-15 while reading the code: my first draft said it would silently agree ₹20,000. It refuses instead. Same fix, accurate reason.)* | Settles the **latest** terms, whoever moved them last — and can answer her counter. Still refuses to let a brand accept its own counter. |
| **Brand counters** | Unbounded. | Capped at the same admin-set number of rounds the creator has. |
| **Accepting a counter** | Checks only that the conversation is "countered" — which, once she can counter, is also true when **she** countered. She could accept her own counter. | Refused unless the other side is the one countering. |

---

## What we are deliberately not doing

- **Any screen.** No app changes in this phase at all.
- **Backfilling old history.** The diary starts from the day it ships. What was overwritten is
  gone and cannot be recovered — pretending otherwise would put invented history on a screen
  two people rely on to settle disagreements.
- **Making the brand's pitch settings visible.** That is Phase 1.

---

## The final output

Nothing a person can see. Afterwards:

- Every step records what happened, so a history screen becomes possible to build.
- Both apps can ask one question — "what step is this on, and how much is owed?" — and get the
  same answer.
- A creator can counter back on her own pitch, and a brand can no longer counter her forever.
- A brand can no longer accept terms nobody offered.

---

## Which layers move

| Layer | What |
|---|---|
| **Database** | One new table for the diary. Three new columns on creator pitches, to track rounds and who countered last. One migration. |
| **Backend** | Diary writers on six steps. Two new calculations. One new route so a creator can counter. Three corrections. |
| **Brand app** | Nothing. |
| **Creator app** | Nothing. |
| **Admin** | Nothing. |

---

## Deploy

Production-impacting: a migration plus backend. Migration runs against production **before**
the push, per the standing rule that pushing is the deploy.

**Safe for phones that have not updated.** Everything is additive. The three corrections fire
only in states no shipped app can currently produce, because no shipped app lets a creator
counter. Nothing reads the new columns or the new table until Phase 2.

**Current production state, which bounds the risk:** creator pitches hold **zero rows**, so
the round columns and the acceptance correction have nothing to affect. Brand requests hold
two rows, both untouched by this phase.
