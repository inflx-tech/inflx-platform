# Impact Analysis — Money-math invariants (B2a)

> Step 6. Generated BEFORE implementation. Reviewed at the lock.

## Affected files
- **New (test only):** `qa/unit/money-math.spec.ts`
- **Config (additive):** `qa/playwright.config.ts` testMatch gains
  `unit/**/*.spec.ts` (does not affect web/api projects).
- **Read, not changed:** `backend/src/services/transaction.service.js`
  (imports the exported `calcPayAtStore`,`calcOnlineOrder`).
- No application code. No migration, mobile, OTA. **Deploy-inert.**

## Affected routes / APIs
- None. Pure in-process function calls; no network, no DB, no
  Razorpay (calc* touch none of those — verified: only `r2` +
  arithmetic).

## Affected workflows (regression surface)
- This is THE regression net for the settlement identity. Any
  change to fee %, rounding, or the brand_net formula fails B2a.
- Complements W2 (B1, API refuses unattributed txn) — B1 proves the
  txn is attributed; B2a proves the money split is correct.

## Migration / deploy / OTA impact
- None. `test(qa)`-class, deploy-inert.

## Risk notes
- **Import side-effects:** `transaction.service.js` requires env /
  AppError / money and conditionally builds a Razorpay client
  (`env.RAZORPAY_MOCK`); it does NOT require `config/db` at module
  top and `calc*` never touch a client. Importing for the unit test
  is safe (no DB connect, no network). If an unexpected top-level
  side-effect appears at Step 7 it is a real finding → handled
  (e.g. import the function via a narrower require), not hidden.
- Float exactness: fixed cases use clean values; the I1 invariants
  are checked against an in-test r2 mirror so correctness does not
  rely on hand-precomputed fragile literals.
- B2b (Docker substrate) is the committed next contract — status
  transitions / full-flow coverage explicitly NOT attempted here.
