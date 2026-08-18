# Phase 0 — what changed, and how it was checked

No screenshots. This phase has no screens; the before/after is in behaviour and in data.

---

## Fail-first, honestly

The contract's own rule: each correction gets a check written first, failing, then the fix.

**I wrote the fixes first.** To make the claim true rather than asserted, the
implementation was stashed and the new spec re-run against the pre-Phase-0 source:

| | Result |
|---|---|
| Against pre-Phase-0 source | **16 failed / 0 passed** |
| Against Phase 0 source | **16 passed** |

That is a genuine red-then-green, produced in the wrong order. Recorded rather than
tidied away.

---

## Checks

| Lane | Before | After |
|---|---|---|
| Unit | 303 passed | **319 passed** |
| Governance | exit 0 | exit 0 |

Nothing weakened, skipped or deleted. The one failure during the run was my own
assertion — a regex missing an escaped apostrophe — fixed in the check, not the code.

---

## Two things found while building, and what was done

**1 · A shop post has no collaboration to attach to.**
`creator_posts` carries no `campaign_influencer_id` — deliberately, because a post
belongs to the creator and may span several brands or her whole shelf. The diary's four
anchors could not hold a step-4 event.

The contract flagged this exact risk: *"if a rejection reason does not fit cleanly,
widen the shape now rather than migrate again in Phase 7."* So a fifth anchor, `post_id`,
was added to migration 152 before it ran anywhere. A mixed-brand post anchors to the post
alone; an exclusive one may also carry its collaboration.

**2 · An offer has no expiry, so "your offer is expiring" cannot be counted.**
`campaign_offers` carries only `is_active`. Verified against production: **no offer table
anywhere has a valid-until column.** FINAL 4 draws an expiring-offer item at set level and
it is not computable today.

It is excluded from the count with the reason written at the point of exclusion. An
earlier draft had a `.catch(() => ({ rows: [] }))` on that query, which would have
swallowed the missing-column error and reported "nothing owed" forever — removed.

---

## A correction to the spec, made mid-build

The spec said brand acceptance would *"silently agree ₹20,000"* after she moved to
₹14,000. Reading the code: `acceptProposal` refuses anything not `sent|viewed`, so it
would have been a **dead end**, not a silent wrong number. Same fix, accurate reason. The
spec now carries the correction visibly rather than a quiet rewrite.

---

## What is NOT verified

**The migration has not run against any database.** Staging is gone — its Supabase host
no longer resolves — Docker is not available locally, and there are no local database
credentials. So the DDL is reviewed but unexecuted.

The count service was probed against production read-only and failed exactly as it should:
`column p.counter_by does not exist`. That proves the code depends on the migration; it
does not prove the migration works.

**Consequence for the deploy:** migration 152 will be executed against production for the
first time, with no prior run anywhere. It is additive and idempotent, the diary ships
empty, and the backfill touches only rows that already carry a counter — of which
production has none, because `influencer_proposals` holds zero rows. Small, but it is a
first run in production and should be named as one, not glossed.
