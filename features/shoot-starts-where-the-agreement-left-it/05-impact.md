# Impact

**One line:** the shoot now opens in the mode the two of them agreed, waits for a real person to
plan it, and closes only when the people who were there say it happened.

## Production-impacting

* **Render** — `backend/src/**`
* **Migration 164** — applied, dry-run first
* **Data repair** — one row, dry-run first
* **OTA influencer** and **OTA brand** — both shoot screens

## Behaviour that changes

| Who | Before | After |
|---|---|---|
| A creator briefed straight to signing | shoot invented as remote, already finished | opens in the agreed mode, waiting to be planned |
| Either party planning a visit | unreachable | propose · counter · accept, as Stage 4 built it |
| A store visit | first tap closed it for both | both must mark it |
| A remote shoot | finished before it started | she marks it done |
| Whoever marks first on a visit | button stayed, tapping did nothing | told they are waiting on the other side |
| A brand on a remote shoot | told "no shoot needed" | told she will mark it when she has shot it |

## Rows already in production

Migration 164 is additive. Its one `UPDATE` touches only rows already `completed`, and only to
fill the two new columns so they do not read as half-marked. It cannot un-complete anything —
proved in a rolled-back transaction before it ran.

The data repair changed **one** row, matched on an audit-log signature no backfill can imitate:
Asha's, `remote/completed` → `visit/proposed`.

Three genuinely completed practice visits were left alone.

## Risk

* A collaboration with **no** agreement still falls back to `remote` — as before, but now
  `resolveProductionMode` labels it `source: 'default'` rather than passing a guess off as a
  decision.
* `contracts.production_mode` is still NULL on the four older practice contracts. They already
  have events, so nothing re-reads it. New contracts carry it from creation.
* A remote shoot now needs one more tap than it did. That is the point.

## Carried, not fixed

* `cancelInfluencer` still writes an invalid `contract_status`. Confirmed live, unrelated.
* A commission collaboration still cannot reach `done` on its own.
