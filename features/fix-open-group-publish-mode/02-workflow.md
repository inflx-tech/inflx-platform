# Workflow — fix open-group publish mode mismatch

> Step 2. Verifier: `pnpm qa:db` (the carved RED test → GREEN by
> the backend fix) + main `pnpm qa` regression.

## Actor
Engineer applying the verified-twice minimal backend fix.

## Preconditions
Carve `backend-defect-open-group-publish-assignment-mode-
mismatch` open RED. `influencer_mode` confirmed canonical
(createSet writes it; campaign.controller.js:66/1300/1435 read
it). Founder GO 2026-05-19.

## Steps
1. Edit `offer.controller.js:835,838`: `set.assignment_mode` →
   `set.influencer_mode` (+ message text).
2. `pnpm qa:db`: confirm `'publishes the open-group set and
   returns 200'` RED→GREEN; `'returns 422 when set is not
   open_group'` still GREEN; no regression vs the post-P12
   baseline; no new 500s.
3. main `pnpm qa`: 66 GREEN / C1 / gate 0 (web flows unaffected).
4. Step-14 RELEASE — PRODUCTION-IMPACTING, surfaced explicitly;
   commit with this approved contract; push → Render deploy.
5. Close the carve (mark resolved, link this fix commit).

## Success definition
The catching test passes via the BACKEND change only; sibling
open_group negative test stays GREEN; zero main-lane
regression; deploy surfaced, not silent.

## Failure / edge
- If the test still RED after the change → reclassify, do not
  force; investigate (verify-twice).
- qa:db substrate fail → retry; no static-only claim.
