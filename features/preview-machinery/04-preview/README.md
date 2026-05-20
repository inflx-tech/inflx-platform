# Preview (Step 4) — preview-machinery

Meta note: this sub-contract delivers the preview-machinery itself,
so its own "preview" is unusual:

- **Spec excerpt + workflow prediction** for this contract are in
  the sibling `01-spec.md` / `02-workflow.md`, NOT in a
  `workflow-prediction.md` here. The mockup-lock convention applies
  to **product-feature** contracts (UI-touching), not to tooling.
- **No mockups for the tooling itself** — the deliverable is
  `pnpm preview:open _demo-preview`, which the founder runs to see
  what the machinery produces for a real (demo) feature.
- The **`_demo-preview/`** sibling contract IS the visual proof of
  what this machinery delivers, and is intentionally separate so
  it stays as a permanent showcase.

## Reviewer note (Step-5 lock)

- **DEPLOY-INERT.** Only adds `qa/scripts/preview-build.mjs` and
  `preview-open.mjs`, two root `package.json` scripts, a `_TEMPLATE`
  scaffold update, the `_demo-preview` showcase contract, and small
  CLAUDE.md/GOVERNANCE.md addenda. No governed path touched.
- **Advisory, not enforced.** `mockup_locked` is a new optional
  lock.json field that has no effect on `gov-check` in this
  sub-contract. Sub-contract 5 will gate UI-touching commits on
  `mockup_locked=true`.
- **`marked` via CDN** in the generated HTML (zero Node deps; the
  founder's browser is online during review).
- **`_demo-preview` uses real recently-shipped features** (Q1
  follower public browse + Q3 verified tag) so the founder sees the
  machinery in action on familiar ground rather than synthetic
  demo content.

## Approval (Step-5)

Self-locked under standing autonomy: deploy-inert, sub-contract
order pre-agreed in the preceding turn (founder: "ok start phase 2"
following recommended order = mockup machinery → workflow prediction
→ before/after diff → Maestro infra → Maestro first-flow); founder
will see the machinery's actual output by running
`pnpm preview:open _demo-preview` after this commit lands; any
naming/structure disagreement lands as a follow-up edit.

## Step 7 — RESULT — GREEN 2026-05-20 (RELEASED)

```
fix       : 2 new qa scripts (preview-build.mjs, preview-open.mjs)
            + 2 root pnpm scripts + _TEMPLATE/04-preview update
            (mockups/, workflow-prediction.md template, README) +
            _demo-preview showcase (full structure + 2 mockups +
            workflow-prediction) + CLAUDE.md lifecycle update +
            GOVERNANCE.md §4a mockup-lock section (advisory)
demo      : pnpm preview:build _demo-preview ✓ — wrote 11615-byte
            index.html with DEMO badge, 2 iframes (380×720 mobile +
            1200×720 desktop), workflow + spec markdown rendered
            via marked@12 CDN; mockups copied (6820 + 12474 bytes)
loud-fail : pnpm preview:build does-not-exist → exit 1 + 45-slug
            list; pnpm preview:build <no-preview> → exit 1 + clear
            "no mockups or workflow-prediction" message (no silent)
regression: main pnpm qa GREEN (66/C1/gate 0, 02:34:27Z) +
            pnpm qa:db GREEN (382/382, 54/54 mig, 02:39:43Z) —
            ZERO regression on either lane
deploy    : DEPLOY-INERT (no governed paths; gov-check rule-1 n/a;
            rule-2 satisfied via this lock.json release evidence)
```
