# Workflow — preview-machinery

## How a future contract uses the machinery (post-this-sub-contract)

1. **Discuss + spec-lock** as today: write `01-spec.md`,
   `02-workflow.md`, `03-expected-outputs.md`, `05-impact.md`,
   set `lock.json` `approved: true`. (Step-5 lock — unchanged.)

2. **Author the preview package:**
   - One or more HTML files in
     `features/<slug>/04-preview/mockups/<screen>.html` (any naming;
     suggested: numbered like `01-login.html`, `02-feed.html`).
     Each is a self-contained HTML document using Tailwind via CDN
     so it visually approximates the real Next.js / RN screen
     without needing a running app.
   - `features/<slug>/04-preview/workflow-prediction.md` —
     plain markdown with sections (trigger / steps / end state /
     edge cases / blast radius / what changes vs current).
   - `features/<slug>/04-preview/README.md` — kept as the
     reviewer-facing summary (already part of the convention).

3. **Run `pnpm preview:open <slug>`** to open the preview page in
   the default browser. The page shows spec excerpt, all mockups
   (embedded iframes + click-to-open-full links), and the rendered
   workflow prediction.

4. **Discuss + mockup-lock** (NEW gate, advisory):
   - Founder reviews; agent edits mockups/workflow until founder
     approves.
   - On approval, set `lock.json` `mockup_locked: true`,
     `mockup_locked_by: "<who/how>"`, `mockup_locked_at: "<date>"`.
   - This is **advisory now** — sub-contract 5 will make
     `gov-check` require it for any contract touching
     `Packages/*/(app|components)/**`.

5. **Implement** (Step 6 onwards) — unchanged. Code is now anchored
   to the locked mockup + workflow prediction rather than imagined.

6. **Before/after diff** (sub-contract 2 will deliver) — captured
   automatically from Playwright + Maestro runs and placed in
   `06-diff/`.

7. **Verify, review, release** — unchanged.

## How THIS sub-contract gets used in this turn

This sub-contract has no UI — it's tooling. So the cycle simplifies:

1. Spec → workflow → expected outputs → impact (the docs in this
   folder).
2. Step-5 lock under standing autonomy (founder said "ok start
   phase 2" with the sub-contract order pre-agreed; deploy-inert).
3. Implement the tooling + the `_demo-preview/` showcase.
4. Verify by running `pnpm preview:open _demo-preview` and
   confirming the page renders cleanly with mockups + workflow.
5. Regression: `pnpm qa` + `pnpm qa:db` — expect zero impact
   (advisory addition, no governed path touched).
6. Step-14 release: commit + push (deploy-inert; gov-check rule-1
   trivially satisfied; rule-2 satisfied via this contract's
   release evidence).

## Commands

```bash
pnpm preview:build <slug>   # build qa/artifacts/preview/<slug>/index.html
pnpm preview:open  <slug>   # build then open in default browser
pnpm preview:open           # no slug → open the _demo-preview showcase
```

## Failure paths

- Slug doesn't exist (`features/<slug>/` missing) → loud error +
  list of available contract slugs.
- `04-preview/` folder missing → "this contract has no preview
  package; create 04-preview/mockups/ + 04-preview/workflow-
  prediction.md to use preview tooling".
- No mockups in `04-preview/mockups/` AND no `workflow-prediction.md`
  → same loud error (one or the other is required).
- Either one alone is acceptable (some contracts may be workflow-
  only, e.g., backend refactors; others may be mockup-only for
  small UI tweaks). The page renders whichever exists.
