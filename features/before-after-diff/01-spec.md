# Spec — before-after-diff (Phase 2 sub-contract 2 of 5)

## Problem

Phase 2 sub-contract 1 (`features/preview-machinery/`, commit
`5b7254d`) introduced the **mockup-lock gate**: HTML mockups +
workflow prediction reviewed and locked before code. But once code
ships, there's no machine-enforced way to confirm the implemented
screens **actually look and behave like the locked mockups**. The
founder's stated cycle calls this out explicitly:
"…then develop → before/after diff screenshots → final testing → all
green → prod."

Without machinery, the comparison is left to manual eyeballing or
silent drift between "what we agreed to build" and "what shipped."
That defeats the purpose of locking the mockup.

## Goal

A single command (`pnpm diff:open <slug>`) that opens, in the
founder's default browser, a side-by-side review page showing:

- **Per locked mockup, two PNG panels:**
  - **Before** — the locked mockup HTML rendered headlessly at its
    declared viewport (Playwright Chromium). This is captured at
    mockup-lock time and stays frozen.
  - **After** — the real implementation captured from the local
    dev stack via Playwright (per a sibling `*.capture.json`
    declaring URL + viewport + optional wait-for-selector). This
    is captured whenever the founder asks for it (typically after
    implementation completes).
- **Diff notes** (`features/<slug>/06-diff/notes.md`) — agent-
  authored plain-English notes on what was implemented, what
  matches the mockup, and what (if anything) diverged and why.
- **Spec excerpt + lock status** for context (same shell as the
  preview-machinery page so it feels consistent).

The founder reviews this page as the final-gate before saying "go"
on the production deploy. If the after diverges from the before in
a way the founder didn't agree to, the deploy doesn't happen until
either the mockup is updated (re-locked) or the implementation is
fixed.

## Non-goals (explicit scoping)

- **Pixel-perfect diff math** — for MVP, the founder eyeballs side
  by side. A pixel-diff overlay (via pixelmatch + canvas in the
  browser) can be added in a later iteration if eyeballing proves
  insufficient.
- **gov-check enforcement** of the diff artifact's presence —
  sub-contract 5. This sub-contract ships the machinery as
  ADVISORY.
- **Maestro mobile capture** — sub-contract 3 sets up Maestro;
  sub-contract 4 lands a real mobile flow. Phase-2-sub-2 captures
  via Playwright Chromium only (web side; the mobile UI tooling
  arrives in 3+4).
- **Auth-gated screens** — `*.capture.json` MVP supports url +
  viewport + wait_for_selector only. Capturing post-login screens
  (e.g. brand dashboard behind JWT) would need an auth bootstrap
  step; deferred to a follow-up if/when needed.
- **Capture against prod** — captures point at the local dev stack
  by default (`http://localhost:3001/3002/3003`). Prod-comparison
  is a different concept and out of scope.

## Constraints

- **DEPLOY-INERT.** Only `qa/scripts/diff-*.mjs`, root pnpm scripts,
  `features/_TEMPLATE/06-diff/` scaffold, `features/_demo-preview/
  06-diff/` showcase, and small CLAUDE.md / GOVERNANCE.md addenda.
  No governed-path touched.
- **Playwright Chromium** — already available via the root devDep
  `@playwright/test` (used by `pnpm qa`). Browsers are installed.
- **Headless** — no UI pops up during capture. The browser opens
  only at `diff:open` (review step).
- **Loud failures** — matches the preview-machinery / dev-doctor
  pattern. Missing mockup, missing capture config, Playwright launch
  failure, viewport-parse failure all produce clear actionable
  errors.
- **Captures land in `qa/artifacts/diff/<slug>/`** which is
  git-ignored (under `qa/artifacts/*`). Regenerable; never pollutes
  commits.
- **Notes file (`features/<slug>/06-diff/notes.md`) IS committed**
  — it's the durable agent-authored record of what the
  implementation does, in plain English, against the locked
  mockup. Reviewed by the founder at the final gate.
