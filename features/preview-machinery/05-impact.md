# Impact analysis — preview-machinery

## What changes

- 2 new scripts in `qa/scripts/`
- 2 new root `pnpm` scripts (`preview:build`, `preview:open`)
- `features/_TEMPLATE/04-preview/` scaffold update (adds `mockups/`
  + `workflow-prediction.md` template)
- New `features/_demo-preview/` showcase contract (never released —
  `approved: false`, lives forever as a worked example)
- Small addendum in `CLAUDE.md` documenting the mockup-lock cycle
  step (advisory)
- Small addendum in `GOVERNANCE.md` documenting the lock.json
  schema additions (`mockup_locked`, `mockup_locked_by`,
  `mockup_locked_at` — optional fields)

Nothing under `backend/src/`, `backend/migrations/`, or
`Packages/*/(src|app|components|lib|screens|services)/`. The
`gov-check` GOVERNED regex matches nothing in this changeset.

## Blast radius

- **Production:** zero. No governed change, no behavioural code.
- **Local dev:** no day-to-day impact. The `preview:open` command
  is new + opt-in; existing dev workflow (`pnpm dev:all`,
  `pnpm dev:doctor`) is untouched.
- **Existing contracts:** unchanged. The `mockup_locked` field is
  OPTIONAL — `gov-check` does not check it. Contracts without
  the field keep validating as before.
- **`_TEMPLATE`:** the new sub-files (`mockups/.gitkeep`,
  `workflow-prediction.md`) are additive. If someone copies
  `_TEMPLATE` to start a new contract, they get the scaffold;
  ignoring the new files is harmless.
- **CLAUDE.md / GOVERNANCE.md:** addenda are descriptive of a new
  advisory convention; existing rules unchanged.

## Reversibility

Purely additive. `git revert <commit>` removes all of it. No data
or state to migrate. Founder loses access to `pnpm preview:open`
but otherwise unaffected.

## Test plan (live, this turn)

1. `pnpm preview:open _demo-preview` opens an HTML page in the
   default browser showing:
   - Spec excerpt
   - 2 mockups (follower public browse + search verified tag),
     each in a labelled card / iframe
   - Rendered workflow prediction
   - "DEMO" badge
2. `pnpm preview:open does-not-exist` exits 1 with a clear error
   listing available slugs.
3. `pnpm preview:open setup-local-dev-environment` works partially
   — that contract has a `04-preview/README.md` but no `mockups/`
   or `workflow-prediction.md`; the script gracefully reports
   what's missing and offers to render just the README (or exits
   with a clear "no preview package" message).
4. `pnpm qa` — 66/C1/gate 0 unchanged.
5. `pnpm qa:db` — 382/382 unchanged.

## Regression risk

- **None on production / main qa / qa:db** — no overlap with
  governed code or qa lanes.
- **gov-check unchanged** — `governance-check.mjs` is not modified
  in this sub-contract. Sub-contract 5 will modify it (and itself
  needs an approved contract to do so).
- **Lock.json schema additions are forward-compatible** — JSON
  parsers ignore unknown fields; `gov-check` reads only the fields
  it knows.

## Affected systems checklist

- [x] Backend runtime (Render): unaffected
- [x] DB (Supabase): unaffected
- [x] Brand-web / admin-web (Vercel): unaffected
- [x] Mobile (OTA): unaffected
- [x] qa:db lane: unaffected
- [x] main pnpm qa: unaffected
- [x] dev:doctor / db:dev:*: unaffected
- [x] gov-check: unaffected (sub-contract 5 will modify it)
- [x] Existing contracts: validate unchanged (additive schema)
