# Preview (Step 4) — setup-local-dev-environment

No UI here. The deliverable is local-dev tooling — `docker-compose`,
shell scripts, env templates, `LOCAL.md`. The "preview" the founder
sees is the **doctor output and the URL list** (above in `03-expected-
outputs.md`).

## Reviewer note (Step-5 lock)

- **DEPLOY-INERT.** Only adds root `package.json` scripts,
  `docker-compose.dev.yml`, `qa/scripts/*.mjs`, `.env.local.example`
  templates, and `LOCAL.md`. No governed-path code change → `git push`
  changes nothing in prod.
- Mirrors the existing `qa:db` ephemeral-Postgres mechanism (proven
  in 12 phases of the test-debt ladder), but persistent + on a
  separate port + with the full migration set so it doubles as the
  live dev backend's DB.
- Defensive choices: port `5433` (not `5432`, not `5544`); container
  name `inflx-dev-pg` (not `inflx-qa-pg`); volume `inflx-dev-pgdata`;
  honest loud failures throughout the doctor script.
- Mobile dev is intentionally OUT — flagged in `LOCAL.md` as a
  manual `USE_PRODUCTION=false` toggle until Phase 2.

## Approval (Step-5)

Self-locked under standing autonomy: the founder said "pls go" on
Phase 1 with Docker, the scope was discussed and agreed in the
preceding turn (six deliverables enumerated), and this contract is
deploy-inert. Founder will see the doctor output as the durable
"preview" once implementation completes; any disagreement on naming/
ports/scope can land as a follow-up edit to this contract.

## Step 7 — RESULT — GREEN 2026-05-20 (RELEASED)

```
fix       : 11 new files + 1 root-package.json scripts update +
            1 dev-doctor.mjs dbQuery bug fix (Windows shell-escape)
docker    : inflx-dev-pg @ localhost:5433, volume inflx-dev-pgdata ✓
migrate   : 54/54 applied to inflx_dev; 56 tables, 1 view
            (v_searchable_creators present) ✓
doctor    : infra 4 ✓ greens; 2 expected reds against the prod-
            pointing backend/.env (DATABASE_URL + ONESIGNAL_MOCK) —
            proves the no-silent-green safety net works; flips
            green on the founder's manual .env swap per LOCAL.md
regression: main pnpm qa GREEN (66/C1/gate 0, 01:34:31Z) +
            pnpm qa:db GREEN (382/382, 54/54 mig, 01:42:05Z) —
            ZERO regression on either lane
urls      : backend :3001 / brand-web :3002 / admin-web :3003 /
            db psql:5433/inflx_dev
deploy    : DEPLOY-INERT (no governed path; gov-check rule-1 n/a;
            rule-2 satisfied via this lock.json release evidence)
```
