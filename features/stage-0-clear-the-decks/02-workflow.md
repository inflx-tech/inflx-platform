# Stage 0 — workflow

## A · The two doorways

1. Extend `brandInbox.controller.getSummary` — add a `needs_you` block sourced from
   `collabCounts.forBrand(brandId)`. The five existing counters are returned unchanged, at the
   same keys, in the same envelope.
2. Add `influencer.controller.getNeedsYou` → `GET /v1/influencers/me/needs-you`, returning
   `collabCounts.forCreator(influencerId)` plus `collaborations[]`, each carrying the
   server-derived `step` and `turn` from `collabStep`.
3. Add `collabCounts.stepsForCreator(influencerId)` — her assignments with the step calculation
   already run, mirroring what `forBrand` returns per creator.
4. Tests: `tests/collab-spine.test.js` covering both doorways plus the step and roll-up rules.

## B · The practice world

5. `backend/scripts/seed-practice-world.js` — idempotent, tagged, reversible.
6. `backend/scripts/remove-practice-world.js` — removes everything the seeder tagged.
7. Run against production, then read back and assert the counts.

## C · Clearing the decks

8. Delete `features/follower-shoppable-reels/` and `backend/migrations/081_*.sql`.
9. Correct `release.released` on the four contracts.
10. Rewrite `Docs/TEST_ACCOUNTS.md`.
11. Device check on the owed v224 path.

## Expected end state

A brand asking *"what needs me"* and a creator asking *"what needs me"* both get an answer from
the same calculation, and every collaboration reports one step number that both apps read.
Both phones show a full, working world.
