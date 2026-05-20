# Preview (Step 4) — before-after-diff

Meta note: this sub-contract delivers diff machinery — tooling, no
UI. Its own "preview" is unusual:

- **No mockups for this tooling** — the deliverable is
  `pnpm diff:open _demo-preview`, which the founder runs to see what
  the diff page produces.
- The `_demo-preview/06-diff/` sibling content (notes + the 2
  generated "before" PNGs from sub-contract 1's mockups) is the
  visual proof of what this machinery delivers for a real contract.

## Reviewer note (Step-5 lock)

- **DEPLOY-INERT.** Only adds `qa/scripts/diff-*.mjs`, root pnpm
  scripts, `_TEMPLATE/06-diff/` scaffold, `_demo-preview/06-diff/`
  showcase notes, and small CLAUDE.md/GOVERNANCE.md addenda. No
  governed path touched.
- **Advisory.** `gov-check` is unchanged. Sub-contract 5 will gate
  UI-touching commits on the presence of `06-diff/notes.md` and
  the `qa/artifacts/diff/<slug>/` PNGs (or their release-evidence
  equivalent).
- **Playwright Chromium via `@playwright/test`** — already
  available; no new root dep.
- **Browser-only "diff overlay"** — for MVP, side-by-side review;
  a pixel-diff highlight (pixelmatch CDN + canvas) can be added in
  a later iteration if eyeballing isn't enough.
- **Captures land in `qa/artifacts/diff/`** which is gitignored —
  no commit pollution, regenerable.

## Approval (Step-5)

Self-locked under standing autonomy: deploy-inert, sub-contract
order pre-agreed in earlier turns; founder said "Yes pls move to
sub contract 2" after reviewing the end-to-end Phase-2 walk-through;
founder will see the actual machinery output by running
`pnpm diff:open _demo-preview` after this commit lands.

## Step 7 — RESULT — GREEN 2026-05-20 (RELEASED)

```
fix       : 4 new qa scripts (diff-before.mjs, diff-after.mjs,
            diff-build.mjs, diff-open.mjs) + 4 root pnpm scripts +
            _TEMPLATE/06-diff/notes.md scaffold + _demo-preview/
            06-diff/notes.md worked-example + CLAUDE.md lifecycle
            update + GOVERNANCE.md §4b new section
demo      : pnpm diff:before _demo-preview ✓ — Playwright launched,
            2 PNGs rendered (380×720 + 1200×720, 69602 + 79772 bytes,
            full Tailwind-styled screenshots)
            pnpm diff:after _demo-preview → honest "no captures
            configured — skipping" (no fake success)
            pnpm diff:build _demo-preview → 13925-byte index.html
            with both before-image embeds, both per-mockup
            after-placeholders, rendered notes, DEMO badge
loud-fail : pnpm diff:build does-not-exist → exit 1 + 42-slug list;
            (other failure paths verified inline)
regression: main pnpm qa GREEN (66/C1/gate 0, 03:38:20Z) +
            pnpm qa:db GREEN (382/382, 54/54 mig, 03:44:01Z) —
            ZERO regression on either lane
deploy    : DEPLOY-INERT (no governed paths; gov-check rule-1 n/a;
            rule-2 satisfied via this lock.json release evidence)
```
