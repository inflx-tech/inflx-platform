# Spec — enforce-cycle-gates (Phase 2 sub-contract 5 of 5)

## Problem

Phase 2 sub-contracts 1–4 are all SHIPPED:
- 1 `preview-machinery` (mockups + workflow-prediction)
- 2 `before-after-diff` (side-by-side review + Maestro extension)
- 3 `maestro-infrastructure` (Maestro lane + doctor + smoke flow)
- 4 `maestro-first-flow` (first real flow + Mobile api.js flip)

All four are **advisory** — `governance-check.mjs` does not yet
reject a UI-touching commit that skips them. Any contract today
can ship `Packages/Mobile/src/**` code with `mockup_locked: false`,
no `06-diff/notes.md`, and no Maestro evidence — `gov-check` would
still exit 0.

The founder's stated cycle says: discuss → mockup-lock → impact →
implement → before/after diff → Playwright + Maestro green →
review → push. To make that loop **structurally unavoidable**, the
final gate must be machine-enforced, not policy-only.

## Goal

Modify `qa/scripts/governance-check.mjs` to add THREE new
enforced rules, layered onto the existing two (governed-path
contract + release evidence):

**Rule 3 — Mockup-lock required for UI-governed changes.** Any
changeset that touches `Packages/*/(src|app|components|lib|screens|
services)/**` MUST be backed by a contract whose `lock.json` has:
- `mockup_locked === true`
- `mockup_locked_by` truthy
- `mockup_locked_at` truthy

**Rule 4 — Diff notes required for UI-governed changes.** Same
trigger; backing contract MUST have a non-empty
`features/<slug>/06-diff/notes.md`.

**Rule 5 — Maestro green required for Mobile-governed changes.**
Any changeset that touches `Packages/Mobile/src/**` AND flips
`release.released === true` MUST have `release.maestro_green !==
false` (matches the existing `qa_all_green` pattern: opt-in by
declaration, never silent on omission).

Backend-only changesets (`backend/src/**`, `backend/migrations/**`)
keep their existing rule-1+2 treatment — no mockup/diff/Maestro
requirement (backend changes often have no UI to mockup or test
via Maestro). Sub-contract 5 narrowly scopes the new rules to UI
+ Mobile.

## Non-goals (explicit scoping)

- **No new lock.json fields beyond `maestro_green`.** The
  `mockup_locked` triplet already exists (sub-contract 1) and
  the `06-diff/notes.md` convention exists (sub-contract 2);
  this sub-contract only adds the enforcement.
- **No CI changes.** `.github/workflows/qa.yml` invokes the same
  `governance-check.mjs`; enforcement flows through transparently.
- **No retroactive validation of past commits.** gov-check runs
  on push against the changeset's lock.json fields; past commits
  are immutable.
- **No expansion of GOVERNED-path regex.** Scope is unchanged;
  this sub-contract narrows AND extends what's required for the
  UI subset only.
- **No bypass mechanism beyond the existing `GOVERNANCE_OVERRIDE`
  env var** (already loud, never silent, recorded).

## Why now

The four cycle pieces are shipped, exercised end-to-end on sub-
contract 4, and demonstrably work. Enforcement at this point
promotes proven mechanisms — not aspirational ones. After this
sub-contract, every future UI/Mobile change automatically goes
through the cycle the founder defined; there is no "we'll do it
properly next time" escape hatch (other than the explicit override
which prints loudly and is recorded).

## Constraints

- **DEPLOY-INERT.** Only modifies `qa/scripts/governance-check.mjs`,
  `GOVERNANCE.md`, `CLAUDE.md`. No GOVERNED path touched. No
  Render/Vercel/OTA impact.
- **Zero behavior change for backend-only commits.** The new rules
  fire only when UI/Mobile paths are in the changeset.
- **Self-test in this turn.** The modified script must run cleanly
  against THIS sub-contract's own changeset (which has no UI files)
  AND against a constructed "what-if" scenario simulating a UI
  change without mockup_locked (must exit 1 with clear message).
- **Override unchanged.** `GOVERNANCE_OVERRIDE="reason"` still
  bypasses everything, prints loudly, never silent.
- **Forward-compatible with future fields.** If a future contract
  adds `release.maestro_green: true`, gov-check passes; if absent,
  rule-5 only fires when MOBILE paths AND released=true coincide.
