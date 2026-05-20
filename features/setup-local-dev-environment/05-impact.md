# Impact analysis — setup-local-dev-environment

## What changes

11 new deploy-inert files + 5 new scripts in root `package.json`.
Nothing under `backend/src/`, `backend/migrations/`, or
`Packages/*/(src|app|components|lib|screens|services)/` — i.e. nothing
the `governance-check.mjs` GOVERNED regex matches. `git push` is a
behavioural no-op for prod after this lands.

## Blast radius

- **Production:** zero. No governed-path change. Render/Vercel
  deploys see only new tooling files in repo, which don't affect any
  serving process.
- **Local dev:** changes the founder's daily workflow. Specifically:
  - Old: `pnpm dev:backend` connected to PROD Supabase.
  - New: `pnpm db:dev:up && pnpm dev:all` brings up an isolated
    local stack; backend connects to local Docker Postgres.
- **Existing `qa:db` lane:** unaffected. Different container
  (`inflx-qa-pg`), different port (`5544`), different volume
  (ephemeral). They can coexist.
- **OTA / mobile:** untouched. Mobile dev wiring is explicitly
  deferred (USE_PRODUCTION flag in `Packages/Mobile/src/config/api.js`
  remains true; documented).

## Reversibility / rollback

- The contract is purely additive (new files + new scripts). To roll
  back: `git revert <commit>` removes all of it; the founder's
  `backend/.env` they personally maintain is unaffected by revert
  (it's gitignored). Worst case, the founder just stops using
  `pnpm db:dev:up` and goes back to manually pointing
  `backend/.env` at prod (the bad-old-way).
- The Docker container/volume can be destroyed with
  `pnpm db:dev:reset` or `docker rm -f inflx-dev-pg &&
  docker volume rm inflx-dev-pgdata`.

## Test plan

Live verification in the implementing turn:

1. `docker ps -a` — confirm `inflx-dev-pg` absent (clean slate).
2. `pnpm db:dev:up` — container starts, Postgres ready on `:5433`.
3. `pnpm db:dev:init` — all migrations 001–055 apply 0-error;
   smoke probe confirms `users`, `influencers`, `campaigns`,
   `v_searchable_creators` (the view 055 just shipped).
4. `pnpm dev:doctor` — exit 0, all green checks.
5. Manual sanity: `pnpm dev:doctor` (without `backend/.env` actually
   switched) shows the loud warning for the prod-pointing
   `DATABASE_URL` — i.e. the failure mode is real, not silent.
6. `pnpm dev:doctor` again after the founder's `backend/.env` is
   switched to local: all green.

(Note: step 5/6 is a manual confirmation by the founder; the
contract delivers the tooling, the founder makes the local config
choice when ready.)

## Regression risk

- **None on production / main `pnpm qa` / `pnpm qa:db` lanes** —
  no overlap with governed code or the qa:db scripts; new files in
  `qa/scripts/dev-*` are name-spaced.
- **Possible local friction:** if the founder's machine already has
  a Postgres on `:5433`, `pnpm db:dev:up` will fail loudly with a
  port-clash message. Defensive (loud) by design.
- **Docker dependency:** same as `qa:db`. If Docker isn't running,
  doctor fails with a clear instruction.

## Affected systems checklist

- [x] Backend runtime (Render): unaffected (no src/ change)
- [x] DB schema (Supabase prod): unaffected (no migration)
- [x] Brand-web (Vercel): unaffected (no app/ change)
- [x] Admin-web (Vercel): unaffected (no app/ change)
- [x] Mobile (OTA): unaffected (no Mobile/src change)
- [x] qa:db ephemeral lane: unaffected (separate container/port/volume)
- [x] main pnpm qa gate: unaffected (no Playwright spec touched)
- [x] gov-check: passes (deploy-inert paths only)
