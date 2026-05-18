# Feature Spec — API contract & permission invariants (B1)

> Contract B1 of Area B (L1 API). Step 2. Implementation GATED on
> `lock.json.approved = true`.

## Problem / goal
Area B is API workflow validation. The deterministic, highest-value
first slice is pinning the platform's **security & attribution
invariants at the API contract layer** — the rules that, if they
silently regress, expose data or break commission attribution.
These need NO DB seeding (error/authz paths), so they run reliably
against the live backend, prod-as-staging.

## Substrate finding (verified, drives scope)
- `backend/src/services/pricing.service.js` (commission / escrow-fee
  math) is **DB-coupled** — not cleanly pure-unit-testable.
- No local Postgres; backend jest `tests/setup.js` applies only
  migration 001 (structurally stale).
- ∴ Deep calculation / status-transition L1 (commission,
  platform-fee, brand_net, state machines) is **B2** — it needs a
  substrate decision (local-DB harness or db-mock) and gets its own
  contract. **Not in B1.**

## Scope (B1 — deterministic, live backend, no seed)
- **W1 RBAC:** a protected `/admin/*` endpoint rejects an
  unauthenticated request (`UNAUTHORIZED`/`FORBIDDEN`).
- **W2 Attribution invariant:** an authenticated throwaway follower
  calling a transaction endpoint with **missing creator-attribution
  ids** is correctly refused (not a 5xx; a clean validation/όrefusal)
  — locks "every follower transaction is creator-attributed".
- **W3 Auth contract:** `/auth/send-otp` rejects a non-E.164 phone
  with `422 VALIDATION_ERROR` (field `phone`) — the exact contract
  the smoke-harness bug exposed; `/auth/verify-otp` requires `otp`.

## Surfaces touched
- Live backend `https://inflx-platform.onrender.com/v1` (read/POST
  to error paths only — no mutations succeed; throwaway follower
  via the proven OTP_MOCK=true flow). No app code. No migration,
  mobile, OTA.

## Non-functional
- Deterministic: every assertion is an error/authz/contract path
  that needs no seeded campaign/brand/escrow.
- Exact status codes/paths pinned at Step 7 against the live API
  (contract defines the invariant; spec confirms the code) — same
  policy used for selectors in the A-series.
