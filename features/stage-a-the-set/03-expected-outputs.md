# Expected outputs — Stage A

## The walk that proves it

You, on your phone:

1. Create a campaign — **two fields only**, a name and a note.
2. Add **set 1** — pay per sale, go live 12 Sep, store visit.
3. Add **set 2** — pay for content, go live 19 Sep, we send the products.
4. Put different people in each.
5. Set terms once for each set, then **change one person's** commission.
6. Publish. A sale set asks for **₹0**; the content set names the exact
   shortfall and offers to fix it there.
7. She receives it and reads **exactly what you set** — with the go-live day and
   the shoot mode shown as the two things she cannot change.
8. She accepts. Both sign.

## Migrations — dry run against production

Already run. Nothing was changed.

```
$ node backend/scripts/run-165-166.js --dry

BEFORE   sets 11 · creators 8 · campaigns 13 · contracts 6
         window_start 8 · window_end 2 · goal 11

applied  165_set_carries_its_own_shape.sql
applied  166_terms_move_down_to_the_creator.sql

AFTER    every count identical
         sets with an unknown mode    0
         sets given a go-live day     0
         creators given channels      0
         creators given formats       0

ROLLED BACK — nothing was changed.
```

**The four zeros are the point.** They assert that the migration did *not*
quietly fill anything in. A migration that invents a launch day for a live
campaign would pass a row-count check and fail these.

## The dry runner is mutation-tested

| Mutation | Result |
|---|---|
| sneak in `UPDATE ... SET go_live_date = window_start` | **caught** — "sets given a go-live day 8, must be 0", rolled back, exit 1 |
| `ADD COLUMN must_break text NOT NULL` on 11 rows | **caught** — Postgres error, rolled back, exit 1 |
| restore | clean, exit 0 |

A third mutation — removing `IS NULL OR` from the shoot-mode CHECK — **did not
fail**, and that is correct rather than a gap. A SQL `CHECK` passes unless it
evaluates to FALSE, and `NULL IN (...)` is NULL. Verified against the live
database rather than assumed:

```
NULL IN ('visit','shipment')  ->  NULL  ->  CHECK is satisfied
```

So the `IS NULL OR` documents intent; it does not add safety. It stays for the
reader.

## Regression

`pnpm qa` after implementation. Every failure classified against the known
pre-existing set. **No-regression certified; never claimed green.**

## Deploy

| | |
|---|---|
| Migration files in the repo | **deploy-inert** — they do not run themselves |
| Applying 165 + 166 | **production-impacting** — needs an explicit go |
| Backend + web | push deploys Render and Vercel |
| Phone | OTA, applies on the **second** launch |
