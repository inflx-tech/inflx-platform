# Workflow Definition — backend-city-audit

> Step 2. The executable contract. Verified via the B2b DB lane
> (`pnpm qa:db`) — the real Postgres + all 53 migrations, the
> same environment in which the precedent defect was found and
> fixed. Each numbered step is an assertion in the audit's QA
> evidence.

## Actor
The QA/audit operator running `pnpm qa:db` against the Docker
Postgres substrate (all 53 migrations applied), reviewing the
backend jest run + a static SQL inventory.

## Preconditions
- Docker Desktop up; qa:db substrate green (53/53 migrations,
  0-error) per the post-fix baseline.
- Baseline (post `backend-defect-city-column`, HEAD 39219e4):
  backend jest **190 passed / 192 failed / 382**;
  `column "city" does not exist` 500s = **0**.
- Main `pnpm qa` = **66 GREEN**, C1 STATE=GREEN, gate 0.

## Workflow steps (auditor-observable)
1. **Build the inventory** → enumerate every runtime SQL site
   referencing `city` in `backend/src/**` (grep + read). Output:
   a complete site list with file:line. Expected: matches the
   spec inventory (no site silently missed).
2. **Static classification** → for each site, read the query's
   FROM/JOIN/CTE and resolve the `city` reference against the
   authoritative schema. Label each: SAFE (column exists on the
   targeted relation/alias/view), DEFECT (referenced where
   unresolvable), or UNPROVABLE-STATICALLY (must rely on S4).
3. **Dynamic confirmation** → run `pnpm qa:db`; from
   `db-jest.log` collect every `column "city" does not exist`
   occurrence and the exact failing statement + the endpoint
   that produced it. Expected per baseline: **0** such errors.
4. **Reconcile** → cross-check S2 labels against S3 evidence.
   Any DEFECT label must correspond to a real failing statement
   (no hypothetical defects); any new `city` 500 in the log
   must map to an inventory site (no unaccounted crash).
5. **Disposition**:
   - All sites SAFE and 0 `city` 500s → class **CLOSED**;
     produce the dispositioned inventory (deploy-inert outcome).
   - A genuine latent 500 that is a pure column-resolution bug
     → apply the **minimal** fix (alias/qualifier/JOIN, result
     shape unchanged), re-run `pnpm qa:db`, prove it 1→0.
   - A site that 500s but needs a behaviour change → **carve**
     `features/backend-defect-<slug>/`, leave it RED, do **not**
     fix here.
   - A site unprovable statically and uncovered by qa:db →
     carve as a finding (uncertainty → fail; never assert safe).
6. **Regression gate** → re-run main `pnpm qa`; confirm **66
   GREEN + C1 STATE=GREEN gate 0** unchanged, and qa:db
   passed/failed did not net-regress (no masking).

## Success definition
The audit is SUCCESSFUL only if the final state is:
- A **complete dispositioned inventory** of every `city` SQL
  site, each labelled SAFE / FIXED / CARVED, with the
  classification grounded in real qa:db evidence (S3/S4) — never
  a guess; AND
- `column "city" does not exist` 500s = **0** in qa:db (either
  already 0 and proven, or driven to 0 by a minimal fix); AND
- main `pnpm qa` **66 GREEN** + C1 STATE=GREEN gate 0 unchanged;
  qa:db `passed` not net-decreased; AND
- every deviation from "preliminary SAFE" is explained by real
  DB evidence, and any genuine non-trivial defect is carved
  (not silently fixed, not fake-greened).

A "0 new defects, class CLOSED" result **is a valid success** —
the contract proves closure, it does not require finding bugs.

## Failure / edge workflows
- A preliminary-SAFE site turns out to 500 → reclassify from
  real evidence (the real stack trace beats the static read),
  fix-minimal or carve per S5; never edit the test to hide it.
- A fix would change matching/result behaviour → STOP, carve,
  re-scope (this contract is column-resolution only).
- qa:db unavailable (Docker down) → audit is **blocked**, not
  passed by static reads alone for covered sites; report blocked.
- New `city` 500 unmapped to any inventory site → inventory is
  incomplete; return to S1 (no silent gaps).
