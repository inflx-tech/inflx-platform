# Impact Analysis — backend-defect-city-column fix

> Step 6. Generated BEFORE implementation. Reviewed at the lock.

## ⚠️ Deploy posture (NOT deploy-inert)
Edits **backend runtime SQL**. On Step-14 release: `git push
origin main` → **Render auto-deploys the backend to production**.
First non-deploy-inert contract since A5b. No migration, no
mobile, no OTA. Brand-web/Vercel unaffected. The deploy fixes a
live 500 — desirable — but Step-14 is an explicit decision.

## Affected files
- The pinned backend controller (most likely
  `backend/src/controllers/campaign.controller.js` — the
  `materialiseOpenGroupInvites` query :76-84 +
  `buildOpenGroupMatchClauses` :139-145; or the influencer-search
  query ~:1516). Exact file:line pinned at Step 7 from the real
  Postgres error in `db-jest.log` (no pre-guessing).
- Possibly a sibling unqualified-`city` site if the SAME root
  cause (creatorAnalytics.controller.js:96 / admin.controller.js
  :535) — only if it is the same defect; otherwise carved separate.
- No test files edited (the carved test must pass via the backend
  fix). Ledger: this lock + the Phase-3 ledger reference.

## Affected workflows (regression surface)
- Influencer open-group matching / influencer search by city — the
  fix must keep matching semantics identical (only make `city`
  resolvable). Risk: a wrong fix could change WHO matches.
  Mitigation: minimal column-resolution change; the carved test
  asserts the endpoint works; broader matching correctness is
  covered by existing campaign/invite tests in the suite (watch
  the qa:db delta for any NEW failures, not just the −3).
- Main `pnpm qa` (66) + C1 + B2b substrate: unaffected (no
  test/qa-harness change; backend is exercised only via qa:db).

## Migration/deploy/OTA
- Backend code only → Render redeploy on release. No DB migration
  (the column already exists; the bug is the SQL referencing it).

## Risk notes
- **Behaviour-change risk:** the ONLY acceptable change is making
  `city` resolve (alias/qualifier/JOIN). If the true fix needs a
  logic change, STOP and re-scope — not in this contract.
- **Hidden-second-defect risk:** if the qa:db delta shows the
  carved test green but a DIFFERENT new failure appears, report it
  honestly (no net-negative masking) and carve it.
- Reproduced + verified on the real qa:db Postgres (full 53-mig
  schema) — same environment the defect was found in. Deterministic.
