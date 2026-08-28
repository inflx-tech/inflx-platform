# The shoot starts where the agreement left it, and finishes when people say so

**Founder, 2026-08-28, after counter-signing Asha's contract:**

> *"till, contract signing by both parties done, next logical step is shooting plan, this is
> already we did in stage 4. But I am not able to see the shoot plan... **without doing anything
> from both it is saying shoot plan is done.** Shoot plan needs to propose from either parties and
> negotiations needs to be done... if it is remote (agreed on initial agreement) then product
> shipping needs to be done... also we designed in stage 4 that if it is store visit then both
> will mark it as done... if it is remote then creator mark it as done... **all these are absent.
> Pls check entire stage 4 implementation what happened.**"*

---

## 1 · Her actual row, read from production

| | |
|---|---|
| `collab_agreements.terms_json->>'mode'` | **`visit`** — both sides agreed a store visit |
| `contracts.production_mode` | **`NULL`** — never carried across |
| `production_events.mode` | **`remote`** — invented |
| `production_events.status` | **`completed`** — at birth |

And the audit log, which says it plainly:

```
2026-08-28T10:01:36Z | system | mode_set  | Mode set to remote
2026-08-28T10:01:36Z | system | completed | Remote mode auto-completed
```

Two entries, one second apart, both by `system`. **Nobody did anything.**

## 2 · Two faults, one after the other

**The mode was settled and then thrown away.** `contracts.production_mode` is written in exactly
one place — the brand's *Approve & Send* step. Briefing a creator straight to signing skips that
step by design, so nothing ever set it, and `contract.production_mode || 'remote'` did the rest.

The agreement had the answer the whole time. This is the same fault as asking her to agree twice:
something settled at the handshake, re-guessed later in a different vocabulary.

**Remote was born completed.** `mode === 'remote' ? 'completed' : 'proposed'`, on the reasoning
that remote has *"nothing to coordinate"*. There is nothing to **coordinate** — no slot, no
parcel. There is still a shoot to **do**.

A second place said the same thing: confirming a remote flip also wrote `status = 'completed'`.
Fixing one would not have been enough.

## 3 · What Stage 4 actually did build

Worth stating plainly, because the founder asked what happened to it. Most of it is there:

| | |
|---|---|
| Either party proposes a slot | ✅ brand via visit details, creator via propose-slot |
| Counter / negotiate the slot | ✅ `counterPropose`, 2 reschedules per side |
| Date window with a stated reason | ✅ `getVisitDateRange`, four bases |
| Shipment: address → dispatch → AWB → received | ✅ |
| Receiving ≠ shooting | ✅ fixed in Stage 4 itself |
| Mutual switch to remote | ✅ either requests, the other confirms |
| Both phones, one vocabulary | ✅ `utils/shoot.js` mirrors `parcel.service` |

**None of it was reachable**, because the event was `completed` from the moment it existed.

## 4 · The one thing Stage 4 got wrong on its own

The founder's rule, stated at Stage 4 and again now: **a store visit is marked done by both
sides.** What shipped closes it on the first tap from either.

`MAY_COMPLETE = { visit: ['brand','influencer'] }` answers **who is allowed to mark it**. It was
read as **who is enough to close it**. Those are different questions, and collapsing them let one
side close a visit the other says never happened.

`REQUIRES_BOTH = ['visit']` is now a second, separately named constant. Remote and shipment stay
one-sided on purpose — the brand cannot see whether she has shot anything, so they are not
permitted to assert it at all. And her mark is required in **every** mode: a visit closed on the
brand's mark alone would be the brand reporting her work for her.

## 5 · The third screen state nobody had drawn

Once both marks are needed there is a state between "not done" and "done": *I have marked it, and
I am waiting for you.* Both shoot screens had two states. Without the third, the button would
still read **Mark the shoot done** after she tapped it, and tapping again does nothing — which
reads as broken.

## 6 · Her row was repaired

The code fix stops this happening again; it does not un-happen for a row that already exists, and
that is the row being tested on.

⚠️ Migration 164's backfill had already made the bugged row *look* legitimately finished, so
timestamps could not tell it apart. **The audit log could** — the only completion entry was by
`system`. `scripts/repair-164-autocompleted-shoots.js` matches on that, and on nothing else.

One row changed: Asha's, from `remote/completed` to `visit/proposed`.

## 7 · Out of scope

* Moving a collaboration past the shoot — unchanged
* The admin production queue
* Anything about Stage 5 content submission
