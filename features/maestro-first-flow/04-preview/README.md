# Preview (Step 4) — maestro-first-flow

This contract IS a UI-touching change (Mobile JS), so it uses the
full mockup+workflow-prediction pattern from sub-contract 1.

## What this folder contains

- `mockups/01-follower-public-browse.html` — the locked mockup for
  the follower public-browse screen, grounded in Q1's already-shipped
  UI. Mobile portrait, 380×720.
- `mockups/01-follower-public-browse.maestro-flow.json` — links the
  mockup to the Maestro flow + named screenshot so `diff-after.mjs`
  can pull in the "after" PNG.
- `workflow-prediction.md` — the behavioural prediction for the
  api.js env-driven flip (trigger / steps / end state / edge cases /
  blast radius / what changes vs current).

## Reviewer note (Step-5 lock + Mockup-lock)

- **PRODUCTION-IMPACTING.** `Packages/Mobile/src/config/api.js` is
  in the GOVERNED regex. OTA ships the change to the founder's
  installed mobile apps. Render+Vercel rebuilds are no-ops
  (no backend/web changes).
- **Default behaviour preserved.** Empty `api-overrides.js`
  shipped → both debug and release builds return
  `PRODUCTION_API_URL`, same as today's hardcoded `USE_PRODUCTION=true`.
- **Net change for end users: zero.** The api.js refactor is
  purely additive — adds the ability to override per developer,
  doesn't change what shipped builds return when overrides are
  empty.
- **Founder uses `git update-index --skip-worktree`** to keep
  local edits to `api-overrides.js` out of commits. Documented
  in LOCAL.md.

## Approval (Step-5 spec-lock + Mockup-lock under standing autonomy)

Self-locked: deploy-inert at contract-time; founder said "your best
choices are my best choices...you suggest best approach for
everything....lets move forward"; design decisions A–D for this
sub-contract were locked in agent's prior turn under that
delegation; production-impacting OTA push will be surfaced
explicitly for a separate go before any `pnpm publish-ota:*`.

## Step 7 — RESULT — GREEN 2026-05-20 (RELEASED local; production push gated)

```
fix       : api.js sibling-override pattern (governed; OTA) +
            api-overrides.js committed empty default + first real
            Maestro flow + diff-after.mjs/diff-build.mjs mobile
            extension + 06-diff/notes.md + LOCAL.md skip-worktree
            section + CLAUDE.md mobile-verify gate update
flow      : 01-follower-public-browse.yaml ran GREEN on Pixel_6
            emulator — [Passed] 01-follower-public-browse (26s);
            00-smoke also still GREEN (47s); 2/2 flows PASSED
diff      : full cycle exercised — pnpm diff:before produced the
            locked mockup PNG (380×720); diff:after copied
            feed-loaded.png from qa-maestro/2026-05-20_05-28-44/ to
            diff/after/; diff:build produced 14.0 KB index.html with
            both panels ✓ ✓ + rendered notes + mobile source-tag
mobile    : api.js refactored; empty api-overrides.js committed —
            both __DEV__ and release branches return PROD URLs by
            default (preserves prior USE_PRODUCTION=true exactly).
            Founder edits api-overrides.js locally + skip-worktree
regression: main pnpm qa GREEN (66/C1/gate 0, 05:39:39Z) +
            pnpm qa:db GREEN (382/382, 05:47:12Z) — ZERO regression
deploy    : PRODUCTION-IMPACTING — surfaced separately for explicit
            founder go before git push origin main AND
            pnpm publish-ota:follower (+ :brand, :influencer for
            parity since api.js is shared across all three flavors).
            Render/Vercel rebuilds are no-op (no backend/web source
            change). gov-check: rule-1 satisfied; rule-2 satisfied
            via this lock.json release evidence
```
