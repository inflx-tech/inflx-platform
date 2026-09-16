# Workflow

1. **Measure the baseline first**, per test name, not just totals: `jest --runInBand --json`.
2. Reseed the catalogue and `tier_features` in `tests/helpers/db.js`, and bust both 60-second
   caches at the end of the reseed.
3. Re-run and **diff by test name**. Three buckets, and every failure goes in one of them:
   - **fixed** — it was failing because nothing was enforced, and now passes.
   - **stale fixture** — the test's brand is on a plan that cannot do what the test needs. Fix the
     fixture: say which plan, or raise what it needs. Never weaken the assertion.
   - **genuine backend defect** — the product is wrong. Carve `features/backend-defect-<slug>/`,
     leave it RED, do not touch it here.
4. Remove the local catalogue seeding from `subscriptions-master-switch.test.js` — the harness now
   does it — and prove that suite still passes.
5. Re-run the whole suite and publish the before/after by name.
