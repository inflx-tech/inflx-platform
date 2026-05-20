# Workflow — fix qa:db PDF pool leak

> Step 2. Verifier: `pnpm qa:db` × 2 (determinism standard)
> + main `pnpm qa` regression + gov-check rules 1+2.

## Actor

Agent under standing autonomy; founder GO 2026-05-20 explicit.

## Preconditions

- Diagnosis verify-twice complete:
  - 14/14 `timeout exceeded when trying to connect` events at
    `contract.controller.js:1157`.
  - `_generateAndStorePdf(...).catch(...)` on :1153 is the only
    fire-and-forget out of 6 call-sites in the file.
  - lock_timeout='8s' diagnostic never fired → block is upstream
    of TRUNCATE (pool starvation, not lock contention).
- `env` import already present at `contract.controller.js:19`.
- `env.NODE_ENV` exposed at `backend/src/config/env.js:26`.
- Founder go on record (chat 2026-05-20: "Go with your
  recommendation" → option 3, NODE_ENV-gated await).

## Steps

1. Edit `contract.controller.js:1153` — replace the bare
   fire-and-forget with the `pdfRegen` reference + conditional
   `await` per spec.
2. Verify-twice: read the diff; confirm env.NODE_ENV access
   parses; confirm the `else` (prod) branch is byte-identical to
   today's behaviour.
3. `pnpm qa:db` **run #1** — must hit 382/382 GREEN. Capture log
   to `qa/artifacts/_fixpdf_qadb_run1.log`.
4. `pnpm qa:db` **run #2** — must again hit 382/382 GREEN to
   prove determinism. Capture log to
   `qa/artifacts/_fixpdf_qadb_run2.log`.
5. `pnpm qa` — main lane must stay 66 / C1 / gate 0. Capture log
   to `qa/artifacts/_fixpdf_qa.log`.
6. Author `06-diff/notes.md` (no UI to diff, but document the
   before/after pool behaviour).
7. Finalize `lock.json`: `status` `locked→released`,
   `release.qa_all_green: true`, `release.released: true`,
   `released_by` + `released_at` populated.
8. Step-14 RELEASE — PRODUCTION-IMPACTING (per path
   classification; zero prod runtime delta); commit with this
   approved contract so gov-check rules 1+2 pass; push origin
   main → Render deploys.

## Success definition

- 2 consecutive qa:db runs land 382/382 with the same suite
  counts (28/28, migrations 54/54), no new RED, no new flakes.
- Pool-saturation symptoms gone: zero "timeout exceeded when
  trying to connect" originating at controller.js:1157; zero
  hook timeouts on the 5 previously-affected suites.
- Main qa lane unchanged.
- gov-check clean on the changeset (rule 1: contract approved +
  complete; rule 2: release evidence self-consistent; rules
  3/4/5 don't fire — not UI/Mobile).

## Failure / edge

- Run #1 still RED → re-classify. Most likely sub-causes:
  - **Class 1 box-load**: kill heavy processes / restart; retry
    once. If still RED, hold + report.
  - **Different root cause than diagnosed**: stop, do not patch.
    The 14/14 stack-trace pinning to :1157 is strong, but if a
    new failure pattern emerges, treat it as new evidence.
- Run #1 GREEN, Run #2 RED → flake; classify, do not call done.
- Main qa regression → revert immediately; the prod branch
  cannot land with web regression.
