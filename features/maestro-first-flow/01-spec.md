# Spec — maestro-first-flow (Phase 2 sub-contract 4 of 5)

## Problem

Phase 2 sub-contract 3 (`features/maestro-infrastructure/`, commit
`f0974a8`) stood up the Maestro lane and proved end-to-end with a
launch-and-screenshot smoke flow (`00-smoke.yaml`). But the lane has
**no real product-flow coverage yet** — the smoke only proves "the
app starts."

Additionally, `Packages/Mobile/src/config/api.js` hardcodes
`USE_PRODUCTION = true`, forcing every debug build to hit the prod
API. This means future Maestro flows that need to test mobile
against the local backend (after `pnpm dev:all`) can't — they're
always pointed at prod.

The founder's stated cycle's mobile-verify gate becomes meaningful
only when (a) there's at least one real flow exercising a user
journey, and (b) the api.js can be redirected to local dev when
needed.

## Goal

Two paired deliverables in one sub-contract:

1. **First real Maestro flow** — `01-follower-public-browse.yaml`
   exercises the Q1 follower public-browse feature (already shipped,
   commit `bfcd788`): launch the app → wait for the deal feed to
   render → assert known elements visible → take a screenshot.
   Read-only flow targeting the **production** API (Q1's
   `/v1/follower/feed?city=...` is public/anonymous), so the flow
   works against the existing release-served data without needing
   the local stack up.

2. **Mobile `api.js` env-driven flip** — replace the hardcoded
   `USE_PRODUCTION = true` with a sibling-override pattern:
   `Packages/Mobile/src/config/api-overrides.js` is committed with
   empty defaults (so behaviour is unchanged for the
   default-empty case), and developers edit it locally + use
   `git update-index --skip-worktree` to prevent accidental
   commits. In `__DEV__` builds with non-empty overrides, the app
   uses the override URL; otherwise, the app uses PROD (same as
   today). Release builds always use PROD.

Plus the small machinery extension needed to integrate Maestro
screenshots into the before/after-diff machinery from
sub-contract 2.

## Why this is PRODUCTION-IMPACTING

`Packages/Mobile/src/config/api.js` is in the
`Packages/*/(src|...)` GOVERNED regex per `gov-check`. The change
ships via OTA to your installed mobile apps (the JS bundle is
re-fetched on app open/close, per your existing OTA cycle). Net
behaviour change in **production release builds**: zero —
`api-overrides.js` is committed empty, so the new logic returns
`PRODUCTION_API_URL` (same as today's hardcoded `USE_PRODUCTION=true`
branch). Net behaviour change in **debug builds**: zero by default
— still hits PROD when overrides are empty. Change is therefore
forward-compatible.

Surfaced explicitly per the never-silent rule. Founder's explicit
go required before `pnpm publish-ota:follower` (and any other
flavors) and before `git push origin main`.

## Non-goals (explicit scoping)

- **Running the new flow as part of THIS release's verification.**
  Requires Metro running on the founder's machine + the new JS
  bundle loaded. The founder runs `pnpm qa:maestro` himself after
  the OTA + Metro start. Sub-contract 4's verification is: api.js
  read carefully (no behaviour regression in default debug or
  release), smoke flow still passes (Maestro lane unaffected),
  flow YAML syntactically valid, diff-after extension exercised on
  a copied screenshot from the earlier smoke run.
- **Mobile jest unit test for api.js logic.** No existing Mobile
  jest config; setting up jest + RN preset + mocking `__DEV__`
  would be more code than the api.js change itself. Deferred — the
  change is small enough to verify by reading. Future sub-contract
  can add Mobile jest infrastructure.
- **iOS** — not shipping iOS yet.
- **Auto-OTA push from CI** — manual `pnpm publish-ota:*` for now.
- **Mockup-lock enforcement** — sub-contract 5.

## Constraints

- **PRODUCTION-IMPACTING.** `Packages/Mobile/src/config/api.js`
  governed. OTA push surfaced + gated on explicit founder go.
- **Behaviour-preserving by default.** Empty `api-overrides.js`
  ships → debug AND release builds both hit PROD (same as today).
  Founder's existing dev workflow (debug APK on phone, hits prod)
  works unchanged after the OTA.
- **Loud failures.** Maestro flow asserts on a real element from
  the public-browse UI; if the feed doesn't render, the flow fails
  visibly with a screenshot of what it saw.
- **Diff machinery extension stays minimal.** Just add a
  `<mockup>.maestro-flow.json` sibling-file convention that
  `diff-after.mjs` reads to copy a named Maestro screenshot into
  the `qa/artifacts/diff/<slug>/after/` directory. No new pnpm
  script; folds into existing `diff:after`.
- **Rollback path stated.** Revert the api.js change + a follow-up
  OTA restores the prior hardcoded behaviour. Zero data risk
  (the change is in JS bundled into the app; no DB, no backend).
