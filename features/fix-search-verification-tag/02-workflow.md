# Workflow — search verification tag

> Step 2. Verifier: `pnpm qa:db` (realigned test GREEN by the
> backend) + main `pnpm qa` regression.

## Preconditions
Carve `backend-defect-search-includes-pending-influencers` open
RED (uncertain-intent). Founder product decision 2026-05-19:
intended behaviour + explicit tag. Migration 055 already
authored (shared with fix-onboarded-creator-city-search).

## Steps
1. Migration 055 onboarded branch: `is_inflx_verified` →
   `(u.status='approved')`, `internal_verification_status` →
   `u.status` (done; pending stays visible, not verified-tagged).
2. `influencer.controller.js`: add `is_verified` per result
   (additive) (done).
3. Realign the carved test → both appear; is_verified
   true(approved)/false(pending); rename (done).
4. `pnpm qa:db`: realigned test GREEN; all other
   influencer-search GREEN; 55/55 migrations 0-error; no
   regression vs post-P12 baseline; no new 500s.
5. main `pnpm qa`: 66 GREEN / C1 / gate 0.
6. Step-14 RELEASE — PRODUCTION-IMPACTING, surfaced; commit
   with this approved contract; push → Render.
7. Close the carve `backend-defect-search-includes-pending-
   influencers` (resolved: working-as-intended + explicit tag).

## Success definition
The realigned test asserts the product-confirmed contract and
passes via the BACKEND (migration + controller field) — not a
fake-green test weakening (the rule itself was the founder's
decision; the test now encodes the correct rule). Zero
main-lane regression; deploy surfaced.

## Failure / edge
- If is_verified semantics break another reader → the
  deterministic qa:db + main pnpm qa catch it; fix or reclassify.
- Uncertain deeper-taxonomy scope → recorded follow-up, not
  silently built.
