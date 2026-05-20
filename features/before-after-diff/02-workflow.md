# Workflow — before-after-diff

## How a future contract uses this machinery (after sub-contract 2)

1. **Mockup-lock** as today (sub-contract 1): mockups in
   `04-preview/mockups/*.html` + workflow prediction. Founder
   reviews via `pnpm preview:open <slug>`, sets `mockup_locked:
   true` in lock.json.

2. **(Optional, at mockup-lock time) Capture the "before"
   baseline** — `pnpm diff:before <slug>`. Playwright renders each
   mockup HTML headlessly at its declared `<!-- preview-size: -->`
   viewport, writing
   `qa/artifacts/diff/<slug>/before/<mockup-name>.png`. This freezes
   the baseline.

3. **Author capture configs for any screen that has a "live"
   counterpart** — for each mockup that maps to a real URL after
   implementation, drop a sibling `04-preview/mockups/<name>.capture.json`:
   ```json
   {
     "url": "http://localhost:3002/influencers/search?city=Hyderabad",
     "viewport": { "width": 1200, "height": 720 },
     "wait_for_selector": "[data-test=\"creator-card\"]"
   }
   ```
   Mockups without a `*.capture.json` are "before-only" — the diff
   page just shows the locked mockup and a placeholder card for
   the "after" side.

4. **Implementation lands** in the contract (Step 6 of the cycle).

5. **Capture the "after"** — `pnpm diff:after <slug>`. Playwright
   visits each `*.capture.json` URL against the local dev stack
   (`pnpm dev:all` must be running), waits for the selector, takes
   a screenshot at the declared viewport, saves to
   `qa/artifacts/diff/<slug>/after/<mockup-name>.png`.

6. **Write the diff notes** — `features/<slug>/06-diff/notes.md`
   filled in by the agent: what was implemented, what matches the
   locked mockup, what (if anything) diverged and why, anything
   worth the founder's explicit attention.

7. **Review** — `pnpm diff:open <slug>`. Browser opens a single
   page with side-by-side panels per mockup plus the rendered
   notes. Founder scrolls, compares. Either says:
   - "Looks like the mockup — go" → deploy proceeds (next phase
     of the cycle).
   - "The button moved" or "the copy changed" → either the
     implementation is fixed and `diff:after` is re-run, or the
     mockup is updated and re-locked (mockup-lock-bumped). Drift
     is surfaced, never silent.

## How THIS sub-contract gets used in this turn

This is tooling — no UI to mockup. Cycle simplifies:

1. Spec + workflow + expected outputs + impact (this folder's
   docs).
2. Step-5 lock under standing autonomy (deploy-inert; sub-contract
   order agreed; founder said "Yes pls move to sub contract 2").
3. Implement the tooling + `_TEMPLATE/06-diff/` scaffold +
   `_demo-preview/06-diff/notes.md` showcase content + Playwright
   capture of the demo's two mockups (real "before" PNGs land).
4. Verify by running `pnpm diff:open _demo-preview` and confirming
   the page renders cleanly with both "before" PNGs + placeholder
   "after" cards (no live capture configured for the demo) +
   rendered notes.
5. Regression: `pnpm qa` (66/C1/gate 0) + `pnpm qa:db` (382/382) —
   expect zero impact.
6. Step-14 release: commit + push (deploy-inert; gov-check
   trivially passes).

## Commands

```bash
pnpm diff:before <slug>   # render each mockup HTML to a PNG (qa/artifacts/diff/<slug>/before/)
pnpm diff:after  <slug>   # Playwright-shoot each *.capture.json URL (qa/artifacts/diff/<slug>/after/)
pnpm diff:build  <slug>   # assemble qa/artifacts/diff/<slug>/index.html
pnpm diff:open   <slug>   # before + after (best-effort) + build + open in default browser
pnpm diff:open            # no slug → opens the _demo-preview showcase
```

## Failure paths (loud, never silent)

- Slug doesn't exist → exit 1 + list of available slugs (same
  format as preview-build).
- Mockup folder empty → "no mockups to capture; this contract has
  nothing to diff" exit 1.
- Playwright not installed / browsers missing → "Playwright Chromium
  not available; install browsers: `pnpm exec playwright install
  chromium`" exit 1.
- `*.capture.json` malformed → name the file + the JSON error + skip
  that one mockup (don't kill the whole run; other mockups still
  capture).
- Live URL unreachable (dev stack not running) → "GET <url>:
  ECONNREFUSED — is `pnpm dev:all` running?" — names the URL,
  doesn't fake a success, skips that mockup with a placeholder in
  the diff page.
- wait_for_selector times out → "timed out waiting for <selector>
  on <url>; selector wrong, or the screen didn't render" — exits
  with that mockup as failed; other mockups continue.
