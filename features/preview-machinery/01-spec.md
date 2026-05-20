# Spec — preview-machinery (Phase 2 sub-contract 1 of ~5)

## Problem

The founder's stated cycle (2026-05-19) requires, between spec-lock
and code-write, **a reviewable "mock HTML look with clear workflows"
that gets locked after discussion**. The current System-A pipeline
has an `04-preview/` folder convention but no machinery for
generating a browseable preview from it — the founder has to read
markdown files in an editor to imagine what a feature will look
like.

This sub-contract delivers the machinery: convention + tooling +
docs + a working demo + lock.json schema additions for the new
mockup-lock gate.

## Goal

A single command (`pnpm preview:open <slug>`) that opens, in the
founder's default browser, a clear page showing:

- The contract's spec excerpt (so context is grounded)
- The locked design as **HTML mockups** of the actual screens, side
  by side (embedded iframes; click to open full)
- A rendered **workflow prediction** (trigger → steps → end state →
  edge cases → blast radius → what changes vs current behaviour)
- The current lock status (spec approved? mockup locked? released?)

The founder reviews this page, says "lock the mockup" (or asks for
changes), and then code begins. Same review loop as today's
discussion+lock cycle, but anchored to real visual+behavioural
artifacts instead of imagined ones.

## Non-goals (explicit scoping)

- **gov-check ENFORCEMENT** of `mockup_locked=true` for UI changes
  — that's sub-contract 5. This sub-contract ships the convention
  + tooling as ADVISORY only. Existing contracts continue to work
  without `mockup_locked`.
- **Auto-generation** of mockups from specs (agent + founder
  author them by hand for now; an AI-generation step can come
  later if useful).
- **Markdown-to-HTML rendering inside Node** — use `marked` via
  CDN in the generated page (zero Node deps, no root devDep
  pollution; the founder's browser is online during review).
- **Before/after diff** — sub-contract 2.
- **Maestro mobile** — sub-contracts 3 and 4.

## Constraints

- DEPLOY-INERT. Only adds root `package.json` scripts, `qa/scripts/`
  files, `features/_TEMPLATE/` scaffold updates, `features/_demo-
  preview/` showcase, and small CLAUDE.md / GOVERNANCE.md addenda
  documenting the new convention. No governed path touched.
- The `_demo-preview` slug uses the `_` prefix that
  `governance-check.mjs` already skips when iterating contracts
  (line 90: `if (slug.startsWith('_')) continue;`) — neutral, never
  trips the approved-contract check.
- Preview output goes to `qa/artifacts/preview/<slug>/` —
  `qa/artifacts/*` is gitignored, so previews are regenerable +
  never pollute commits.
- Loud failures (matches the dev-doctor design philosophy) — if a
  contract has no `04-preview/mockups/` or no
  `workflow-prediction.md`, the build prints a clear "this contract
  needs a mockup/workflow before review" message, exits non-zero.
- Lock.json schema is **additive**: introduce `mockup_locked`,
  `mockup_locked_by`, `mockup_locked_at` as OPTIONAL fields.
  Existing contracts without these fields continue to validate.

## Why now

Phase 1 (local-dev environment, commit 1c75df4) gave us an isolated
stack to verify in. Phase 2 sub-contract 1 makes the *design review
before code* step real — the moment we have machinery for visual
mockups, every future feature contract gains a concrete pre-code
gate. The remaining Phase 2 sub-contracts (before/after diff,
Maestro infra, Maestro first-flow, gov-check enforcement) all
depend on or build on this convention.
