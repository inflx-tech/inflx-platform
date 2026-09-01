# Impact — Stage A

## Deploy classification, split

| What | Class |
|---|---|
| The migration **files** in the repo | **deploy-inert** — they do not run themselves; production migrations are applied by hand |
| **Applying** 165 + 166 | **production-impacting** — needs an explicit go |
| The wizard and screens, once built | **production-impacting** — Render, Vercel, OTA |

## What applying 165 + 166 does

Adds five nullable columns and two CHECK constraints. **Changes no existing row.**
Proved by a dry run inside a rolled-back transaction: every count identical, and
four assertions that nothing was quietly filled in.

## What it cannot break

A campaign with no set keeps working. A set with no go-live day keeps working —
it falls back to `window_start`/`window_end` exactly as it does now. A creator
with no channels inherits the set's, which is what all 8 live rows do.

**Nothing is dropped and nothing is rewritten.**

## The one real risk

`campaign_sets` gains a CHECK on `shoot_mode`. All 11 live rows are NULL, and NULL
satisfies a SQL CHECK, so none of them is affected. The constraint exists to stop a
fourth value appearing later — not to validate history.

## What this stage does not touch

Escrow, wallets, withdrawals, shop posts, going live. All Stage D and E.
