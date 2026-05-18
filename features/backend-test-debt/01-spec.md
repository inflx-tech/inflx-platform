# Feature Spec — Backend jest suite debt (tracked finding from B2b)

> Status: BACKLOG. Recorded so it is NOT lost. NOT auto-fixed —
> each fix batch follows the full pipeline with its own Step-5 lock.
> Origin: B2b DB lane, 2026-05-18.

## Problem / goal
B2b stood up the real substrate and applied all 53 migrations
0-error, then ran the backend jest suite truthfully for the first
time. Result: **281 failed, 101 passed, 382 total** (28 suites,
2 passing). These tests have effectively never run against the
correct full schema (old `setup.js` applied only `001`), so the
suite has drifted badly from the current backend contract.

## Confirmed root-cause sample (from B2b run)
- `tests/helpers/factories.js:98` `registerBrand` →
  `VALIDATION_ERROR "name is required" (field: name)`. The factory
  posts a brand registration WITHOUT `name`, but the current
  backend requires it (the brand-web/login + /brands/register
  contract evolved; the test factory never did). This single stale
  factory cascades into many of the 281 (most suites build state
  via `factories.js`).
- Likely classes: (a) stale helper factories vs evolved
  validation/contracts, (b) tests asserting pre-rupees /
  pre-migration shapes, (c) seed/order assumptions.

## Scope (when scheduled — phased, NOT one big bang)
- Phase 1: fix `tests/helpers/factories.js` to current contracts
  (highest leverage — likely clears a large fraction).
- Phase 2+: re-run, triage the remaining real failures by suite,
  fix or quarantine-with-reason per the contract pipeline.
- Each phase: own contract/lock; DB lane (`pnpm qa:db`) is the
  verifier; target laneState PASS.

## Out of scope
- Not a B2b blocker. B2b's substrate contract succeeded (Docker +
  53/53 migrations 0-error + separate truthful lane). This is the
  *value B2b delivered*: the debt is now visible and measurable.

## Why backlog
Fixing 281 failures is substantial app/test work that must be
phased through the pipeline. Recorded here with a measurable
baseline (101/382) so progress is trackable and nothing is hidden
or force-greened.
