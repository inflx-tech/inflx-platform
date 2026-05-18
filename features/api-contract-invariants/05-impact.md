# Impact Analysis — API contract & permission invariants (B1)

> Step 6. Generated BEFORE implementation. Reviewed at the lock.

## Affected files
- **New (test only):** `qa/api/contract-invariants.spec.ts`
  (Playwright `request` fixture; no browser, no webServer needed by
  the spec — though the shared config still starts brand-web; that
  is a known minor inefficiency, candidate for Area C, not a blocker).
- **Read, not changed:** backend route/validation for `/admin/*`,
  `/follower/pay-at-store`, `/auth/*`.
- No application code. No migration, mobile, OTA. **Deploy-inert.**
- Possible config touch: none required (testMatch already includes
  `api/**/*.spec.ts`; base via env `QA_API_BASE`).

## Affected routes / APIs (exercised, error paths only)
| Method | Path | Why | Mutates? |
|---|---|---|---|
| GET | /admin/queue/brands | W1 unauth rejection | no |
| POST | /auth/send-otp, /auth/verify-otp | W2 throwaway follower auth + W3 contract | creates a throwaway follower row only |
| POST | /follower/pay-at-store | W2 unattributed-txn refusal | **no** (must be refused) |

## Affected workflows (regression surface)
- This is the API-layer regression net for security/attribution
  invariants — complements L2 A2 (gate at the web layer) and the
  mobile L3 attribution tests (UI layer). Same invariant, three
  layers.
- Creates throwaway follower rows on the prod DB (prod-as-staging).
  Same footprint as the existing `e2e-smoke.js` — acceptable,
  non-destructive, no mutation succeeds beyond user creation.

## Migration / deploy / OTA impact
- None. `test(qa)`-class, deploy-inert.

## Risk notes
- Live-backend dependency: a cold Render start can 502 the first
  call — the spec will warm/retry (mirrors e2e-smoke), else a
  transient failure is reported honestly (not retried infinitely).
- W2 depends on OTP_MOCK=true on Render (confirmed this session).
  If that ever flips, W2 SKIPs with a clear reason (W1/W3 still
  run) — same proactive-signal pattern as e2e-smoke; recorded so a
  SKIP is not mistaken for a pass.
- Exact status codes (401 vs 403; the W2 refusal code) are pinned
  at Step 7 against the live API — the invariant (not-open /
  not-5xx / not-accepted) is contracted; the precise code is
  observed, not guessed.
