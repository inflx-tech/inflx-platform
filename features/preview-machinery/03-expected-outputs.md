# Expected outputs — preview-machinery

## Files created

```
qa/scripts/preview-build.mjs               build preview HTML for a slug
qa/scripts/preview-open.mjs                build then open in default browser
features/_TEMPLATE/04-preview/mockups/.gitkeep
features/_TEMPLATE/04-preview/workflow-prediction.md   template
features/_demo-preview/                    showcase contract (full structure)
  01-spec.md
  02-workflow.md
  03-expected-outputs.md
  04-preview/README.md
  04-preview/mockups/01-follower-public-browse.html
  04-preview/mockups/02-search-with-verified-tag.html
  04-preview/workflow-prediction.md
  05-impact.md
  lock.json                                 approved: false  (demo, never a real release)
```

## Files modified

```
package.json (root)                        +preview:build, +preview:open
features/_TEMPLATE/04-preview/README.md    add reference to mockups/ + workflow-prediction.md
CLAUDE.md                                  small addendum on the cycle's mockup-lock gate
GOVERNANCE.md                              new lock.json optional-fields note
```

## Files NOT modified (out of scope)

- Any `backend/src/**`, `backend/migrations/**`, or
  `Packages/*/(src|app|components|lib|screens|services)/**`.
- `qa/scripts/governance-check.mjs` — the enforcement of
  `mockup_locked` for UI changes is sub-contract 5, not this one.

## Visible runtime behaviour

```
$ pnpm preview:open _demo-preview
[preview-build] reading features/_demo-preview/ ...
[preview-build]   spec      : present (66-line)
[preview-build]   lock      : approved=false (demo)
[preview-build]   mockups   : 2 found (01-follower-public-browse, 02-search-with-verified-tag)
[preview-build]   workflow  : workflow-prediction.md present
[preview-build] wrote qa/artifacts/preview/_demo-preview/index.html
[preview-open] opening file:///C:/WORK/inflx-platform/qa/artifacts/preview/_demo-preview/index.html
```

The opened HTML page shows:
- Header: contract name + lock status badge ("DEMO — not for release")
- Section: spec excerpt (first 30 lines of 01-spec.md, rendered as
  markdown via marked CDN)
- Section: workflow prediction (full workflow-prediction.md
  rendered markdown)
- Section: mockups — each in a labelled card, embedded in a
  sandboxed iframe sized roughly like the target device
  (mobile-portrait for follower app screens; desktop-wide for
  brand/admin screens), with a "open full" link
- Footer: how to lock the mockup (sets `mockup_locked: true` in
  the contract's lock.json) and where to go next in the cycle

Browser console is clean. The page works offline once the marked
CDN script is cached.

## Failure-path output (loud, not silent)

```
$ pnpm preview:open does-not-exist
[preview-build] FAIL — features/does-not-exist/ does not exist
                available contract slugs:
                  - backend-defect-*
                  - fix-*
                  - setup-local-dev-environment
                  - preview-machinery
                  - _demo-preview
exit 1
```

```
$ pnpm preview:open some-slug-with-no-preview
[preview-build] FAIL — features/some-slug-with-no-preview/04-preview/ exists but
                contains neither mockups/*.html nor workflow-prediction.md.
                Add at least one to use the preview tooling.
exit 1
```

## What the founder reviews

Two artifacts, side by side, in one browser tab:

1. **Mockups** — pixel-approximate HTML of the screens the
   feature will produce. Click around. See the actual layout.
2. **Workflow prediction** — "if user does X → backend does Y →
   end state is Z; here are the edge cases and what changes."

Locking the mockup means: "yes, build this, and if the final
result diverges from this preview I want to know why." That is
the anchor sub-contract 2 (before/after diff) will check against.
