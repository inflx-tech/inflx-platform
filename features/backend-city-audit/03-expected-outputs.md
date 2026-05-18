# Expected Outputs — backend-city-audit

> Step 3. Defined BEFORE the audit runs. Measured vs the post-fix
> baseline (`backend-defect-city-column`, HEAD 39219e4):
> qa:db **190 passed / 192 failed / 382**, `city` 500s = **0**;
> main `pnpm qa` **66 GREEN**, C1 STATE=GREEN gate 0.

## Per-step expected outputs
| Step | Observable output | How QA verifies it |
|---|---|---|
| 1 Inventory | Complete file:line list of all runtime `city` SQL sites; equals the spec inventory, no silent omission | Grep over `backend/src/**` reconciled against the inventory in `lock.json` |
| 2 Static class | Every site labelled SAFE / DEFECT / UNPROVABLE with the resolving FROM/JOIN cited | Per-site notes in the audit report |
| 3 Dynamic | `db-jest.log` count of `column "city" does not exist` = **0** (baseline), each (if any) tied to an endpoint+statement | `pnpm qa:db`; grep the log |
| 4 Reconcile | Zero unaccounted `city` 500s; zero hypothetical (evidence-less) DEFECT labels | Cross-table: labels ↔ log lines |
| 5 Disposition | Class CLOSED, or minimal fix proven (count 1→0), or finding carved | `pnpm qa:db` re-run delta; carved folder if any |
| 6 Regression | main `pnpm qa` 66 GREEN + C1 gate 0; qa:db `passed` ≥ 190 | `pnpm qa`; `qa/artifacts/db-lane.json` delta |

## Data assertions (post-audit)
- `column "city" does not exist` in `qa/artifacts/db-jest.log`:
  **0** (proven, not assumed). If a fix was applied, the pre-fix
  log shows the exact count >0 and the post-fix log shows 0.
- qa:db migrations: **53/53, 0-error** (unchanged).
- qa:db backend jest: `passed` **≥ 190** (no net regression; if
  a real latent 500 was fixed, `passed` rises and the affected
  test(s)/endpoint go green **because the backend is correct**).
- Main `pnpm qa`: **66 GREEN**, C1 STATE=GREEN, gate **0**
  (unchanged — the audit must not touch the main lane).
- No money/attribution/status-machine value changes (the class
  is read-path SQL resolution only).

## Hard expectations
- Every disposition is grounded in **real qa:db evidence** for
  qa:db-covered sites; statically-only-classified sites are
  explicitly flagged as such with their FROM/JOIN proof, and any
  that cannot be proven safe are **carved**, not asserted safe.
- A genuine latent 500 is closed by a **minimal
  column-resolution backend fix** (result shape unchanged) or
  carved — **never** by `.skip` / deletion / assertion-weakening
  / test edit / fabricated data / force-pass.
- "Preliminary SAFE" claims in the spec for
  `creatorAnalytics.*`, `brandInbox:210`, `campaign.controller.*`
  are **re-proven**, not trusted — the carved hypotheses were
  unverified and this audit's value is verifying them.
- If 0 defects: the deliverable is the dispositioned inventory
  and the contract is **deploy-inert**. If a fix: **NOT
  deploy-inert** (backend → Render at Step 14).

## Visual evidence required
- None (no UI). Evidence is textual:
  - `qa/artifacts/db-jest.log` — pre (if fix) and post run.
  - `qa/artifacts/db-lane.json` — baseline→result delta.
  - `qa/reports/latest.md` — main lane unchanged (66 / C1 / 0).
  - The completed dispositioned inventory table recorded in
    this contract's `lock.json` and `04-preview/README.md`.

## Implemented by (after lock)
- The audit procedure (Steps 1–6) executed against qa:db.
- If a fix: the pinned backend file:line + minimal SQL diff
  summary recorded in `lock.json`; re-run `pnpm qa:db` +
  `pnpm qa`; close or carve each finding.
