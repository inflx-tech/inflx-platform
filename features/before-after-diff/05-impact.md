# Impact analysis — before-after-diff

## What changes

- 4 new scripts in `qa/scripts/`: `diff-before.mjs`,
  `diff-after.mjs`, `diff-build.mjs`, `diff-open.mjs`
- 4 new root `pnpm` scripts: `diff:before`, `diff:after`,
  `diff:build`, `diff:open`
- `features/_TEMPLATE/06-diff/notes.md` template (new file)
- `features/_demo-preview/06-diff/notes.md` worked example (new
  file)
- Small addendum in `CLAUDE.md` (lifecycle line + cycle step
  callout)
- Small addendum in `GOVERNANCE.md` (§4a → mention 06-diff/ as the
  third advisory artifact alongside mockup_locked)

Nothing under `backend/src/`, `backend/migrations/`, or
`Packages/*/(src|app|components|lib|screens|services)/`. The
`gov-check` GOVERNED regex matches nothing in this changeset.

## Blast radius

- **Production:** zero. No governed change.
- **Local dev:** new opt-in commands (`pnpm diff:*`). Existing
  workflow untouched.
- **Existing contracts:** unchanged. The `06-diff/` folder is
  OPTIONAL — contracts without it continue to validate; no
  existing lock.json field is required.
- **`_TEMPLATE`:** new sub-folder is additive (copying `_TEMPLATE`
  for a new contract gets the new scaffold; ignoring it is
  harmless).
- **qa lanes:** unaffected — `diff-*` scripts are separate from
  `qa-db.mjs` / `run-qa.mjs` / `governance-check.mjs`.

## Reversibility

Purely additive. `git revert` removes all of it. No state or data
to migrate.

## Test plan (live, this turn)

1. `pnpm diff:open _demo-preview` opens an HTML page in the
   default browser showing:
   - 2 side-by-side panels (Q1 follower public browse, Q3 search
     verified tag), each with a real PNG on the "before" side and
     a placeholder card on the "after" side
   - Rendered `06-diff/notes.md`
   - Status badge "DEMO — never released"
2. `pnpm diff:open does-not-exist` exits 1 with the available
   slugs list.
3. `pnpm diff:before _demo-preview` produces 2 PNGs in
   `qa/artifacts/diff/_demo-preview/before/`.
4. `pnpm diff:after _demo-preview` reports "no *.capture.json
   sibling for any mockup — skipping" without failing.
5. `pnpm qa` — 66/C1/gate 0 unchanged.
6. `pnpm qa:db` — 382/382 unchanged.

## Regression risk

- **None on production / main qa / qa:db** — no overlap with
  governed code or qa lanes.
- **`@playwright/test` import** — already used elsewhere in
  `qa/`; the import path resolves. Browsers are installed (the
  66-spec qa lane proves it).
- **Headless Chromium launch** — same chromium version the
  existing qa Playwright config uses; no version skew.

## Affected systems checklist

- [x] Backend runtime (Render): unaffected
- [x] DB (Supabase): unaffected
- [x] Brand-web / admin-web (Vercel): unaffected
- [x] Mobile (OTA): unaffected
- [x] qa:db lane: unaffected
- [x] main pnpm qa: unaffected
- [x] dev:doctor / db:dev:* / preview:*: unaffected
- [x] gov-check: unaffected (sub-contract 5 will modify it)
- [x] Existing contracts: validate unchanged (additive)
