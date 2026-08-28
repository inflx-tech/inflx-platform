# Before / after

**Reported:** *"without doing anything from both it is saying shoot plan is done... all these are
absent... pls check entire stage 4 implementation what happened."*

## What happened to Stage 4

Most of it shipped and works. The slot proposal from either side, the counter, the reschedule
limits, the date window that explains itself, the shipment chain, the mutual switch to remote,
and one vocabulary shared by both phones — all present.

**None of it was reachable.** The event was created `completed`, and every one of those
transitions refuses to run on a completed event. Stage 4 was not missing; it was sealed shut on
the first line.

## The seal

```
contracts.production_mode  = NULL            approve was skipped by design
  -> mode = contract.production_mode || 'remote'
  -> 'remote'
  -> status = mode === 'remote' ? 'completed' : 'proposed'
  -> 'completed'
```

Her agreement said `visit`. The log recorded the whole thing in two lines, one second apart, both
by `system`:

```
system | mode_set  | Mode set to remote
system | completed | Remote mode auto-completed
```

## The one thing Stage 4 got wrong on its own

The founder's rule is that a store visit is marked done **by both**. What shipped closed it on the
first tap from either.

`MAY_COMPLETE = { visit: ['brand','influencer'] }` was the right answer to **who may mark it**,
read as the answer to **who is enough to close it**. Two questions, one constant.

**After:** two constants, `MAY_COMPLETE` and `REQUIRES_BOTH`, with a test asserting both are
identical on the phone and the server — by lifting the server's own code and running it.

## The screens

**Before** — two states: *mark it done*, or *it is done*.

**After** — three. The middle one is the honest half of a two-sided rule:

> *"You have marked the visit done. It closes once the brand marks it too — a visit is two people,
> so both of you say it happened."*

Without it the button stayed on screen after she tapped it, and tapping again did nothing.

## Her row

Repaired, after a dry run, matched on the audit-log signature rather than on timestamps — the
migration's backfill had already made the bugged row look legitimately finished.

| | before | after |
|---|---|---|
| `contracts.production_mode` | NULL | `visit` |
| `production_events.mode` | `remote` | `visit` |
| `production_events.status` | `completed` | `proposed` |

One row. Three genuinely completed practice visits untouched.

## Screenshots

Not captured. The proof is the founder opening Asha's shoot on his own phone and finding a store
visit with no time set yet — the exact screen that said it was done.

---

## One more door that was shut

The **Logistics** card in her section list was gated on `physical_delivery` — which means *goods
travel to her*. On a store visit nothing travels; **she** travels. So it was false, and the card
was hidden on exactly the collaborations with the most to arrange.

She could still reach the shoot through the big hero button, so it was not a dead end — but the
list she scans for "where do I go" had no entry for it. Now the shoot always has a door.
