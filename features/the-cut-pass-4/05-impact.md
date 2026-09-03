# Impact — pass 4

**One-line verdict: nothing changes for anyone; 74 records of never-connected design
data are gone, with a copy on disk.**

| Who | What changes |
|---|---|
| Everyone | **Nothing.** No dropped table was read by any code. |

Verified immediately after the drop: people 129 · businesses 9 · products 48 ·
campaigns 12 · contracts 6 · sales 16 · browse tree 333 · live app shelves 6. All
unchanged.

## Deploy classification

**DATABASE-ONLY.** No code changed, so nothing to deploy. The tables were dropped
directly against production, inside one transaction, after export.

## Reversibility

**This is the one irreversible step in the plan** — but the data is not lost. Every row
sits in `backend/exports/2026-09-02-pass4/`, committed to the repository. If a decision
reverses, the rows come back from those files even though the tables are gone.

## What remains, deliberately

Twenty of the 21 blocked tables plus `experience_templates` are still in place. They are
harmless — nothing displays them — and leaving them means a reversed decision needs no
restore at all. They can be dropped later, or never.
