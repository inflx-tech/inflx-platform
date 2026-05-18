# Workflow Definition — backend-defect-city-column fix

> Step 3. Verified via the B2b DB lane (`pnpm qa:db`) — a real
> Postgres to reproduce + prove the fix.

## Actor
Backend serving a campaign request whose set uses an
`open_group` filter with `cities` (and/or the influencer-search /
creator-analytics paths that reference `city`).

## Preconditions
qa:db substrate (Docker PG + all 53 migrations — `influencers.city`
exists via `003`, `users.city` via `001`). Carved test(s)
currently RED with `column "city" does not exist` → 500.

## Workflow
1. Run `pnpm qa:db`; from `db-jest.log` extract the EXACT failing
   statement + Postgres error (which relation/column, statement
   text) for the `/v1/campaigns/*` 500. Pin file:line.
2. Identify why `city` is unresolvable there (candidate:
   `materialiseOpenGroupInvites` query campaign.controller.js
   :76-84 + `buildOpenGroupMatchClauses` :139-145; or the
   influencer-search query ~:1516; or unqualified `city` in
   creatorAnalytics:96 / admin:535).
3. Apply the minimal SQL fix so `city` resolves (correct
   alias/qualifier/JOIN). No other behaviour change.
4. Re-run `pnpm qa:db`.

## Success definition
SUCCESSFUL iff: (a) the exact defective statement was identified
from real DB evidence (not guessed); (b) a minimal SQL fix is
applied; (c) the previously-RED carved campaign test(s) are now
GREEN via qa:db; (d) overall passed rises vs 188/194/382 with the
`city` 500s eliminated; (e) main `pnpm qa` (66) + C1 unaffected.
The defect is CLOSED by fixing the backend — never by editing the
test.

## Failure / edge
- If the fix would change matching behaviour (not just resolve the
  column) → stop, re-scope; this contract is a minimal correctness
  fix, not a feature change.
- If more than one distinct `city` defect exists → fix the
  campaign-path one (in scope); carve any other as its own finding.
