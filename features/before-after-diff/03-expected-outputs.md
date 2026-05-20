# Expected outputs — before-after-diff

## Files created

```
qa/scripts/diff-before.mjs                Playwright-render mockup HTMLs → PNGs
qa/scripts/diff-after.mjs                 Playwright-shoot live URLs from *.capture.json
qa/scripts/diff-build.mjs                 assemble side-by-side index.html
qa/scripts/diff-open.mjs                  before + after + build + open in browser
features/_TEMPLATE/06-diff/notes.md       template for the diff-notes file
features/_demo-preview/06-diff/notes.md   worked example of diff notes (Q1 + Q3)
```

## Files modified

```
package.json (root)              +diff:before, +diff:after, +diff:build, +diff:open
CLAUDE.md                        small addendum on the diff step
GOVERNANCE.md                    small addendum on the 06-diff/ convention
```

## Files NOT modified (out of scope)

- Any `backend/src/**`, `backend/migrations/**`, or `Packages/*/(src
  |app|components|lib|screens|services)/**`.
- `qa/scripts/governance-check.mjs` — sub-contract 5 enforces; this
  one is advisory.

## Visible runtime behaviour

```
$ pnpm diff:open _demo-preview
[diff-before] reading features/_demo-preview/04-preview/mockups/ ...
[diff-before]   01-follower-public-browse.html → before/01-follower-public-browse.png (380×720)
[diff-before]   02-search-with-verified-tag.html → before/02-search-with-verified-tag.png (1200×720)
[diff-before] OK — 2/2 before PNGs written
[diff-after]  no *.capture.json sibling for any mockup — skipping live capture
              (this is normal for the showcase; real contracts will declare URLs)
[diff-build]  reading qa/artifacts/diff/_demo-preview/{before,after}/ ...
[diff-build]    01-follower-public-browse : before ✓  after ⓘ no capture
[diff-build]    02-search-with-verified-tag: before ✓  after ⓘ no capture
[diff-build]  notes: features/_demo-preview/06-diff/notes.md present (rendered)
[diff-build]  wrote qa/artifacts/diff/_demo-preview/index.html (~12 KB)
[diff-open]   opening file:///C:/.../qa/artifacts/diff/_demo-preview/index.html
```

The opened HTML page shows:

- **Header:** "_demo-preview" feature + slug + DEMO badge (same
  shell/styling as preview-machinery).
- **Per-mockup section:** two side-by-side panels —
  - **Before** (locked mockup, declared viewport): PNG with caption
    "Locked mockup · 380×720" or "1200×720".
  - **After** (live implementation): either a PNG with caption
    "Captured 2026-05-20 14:23 from http://localhost:3002/..." OR a
    placeholder card explaining "no `<mockup>.capture.json` sibling
    found; create one to enable live capture for this mockup."
- **Diff notes section:** rendered markdown from
  `features/<slug>/06-diff/notes.md` — agent-authored, plain
  English, what-matches / what-diverged-and-why.
- **Footer:** instructions on the diff sign-off step (founder either
  says "go" or directs a fix).

## Expected demo content

The `_demo-preview` showcase has:
- 2 mockups (from sub-contract 1) → 2 "before" PNGs auto-rendered.
- No `*.capture.json` siblings → both "after" panels show
  placeholder cards (intentional; the demo is a showcase, not tied
  to a live local feature).
- `06-diff/notes.md` worked-example explaining what diff notes look
  like for a real shipped feature (Q1 + Q3 retrospectively).

## Failure-path output (loud, not silent)

```
$ pnpm diff:open does-not-exist
[diff-before] FAIL — features/does-not-exist/ does not exist
              available slugs: ... (45)
exit 1
```

```
$ pnpm diff:after <slug>      # with dev stack NOT running
[diff-after]  capturing search-with-verified-tag.html → http://localhost:3002/influencers/search
[diff-after]  FAIL — GET http://localhost:3002/...: ECONNREFUSED
              is `pnpm dev:all` running? Skipping this mockup; placeholder will be used.
              (other mockups continue)
```
