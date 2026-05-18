# Workflow Definition — API contract & permission invariants (B1)

> Step 3. Each workflow = a Playwright `request` (APIRequestContext)
> call against the live backend + an assertion on the response
> contract. No browser, no DB seed.

## Actor
An API client (no/!admin auth for W1/W3; a throwaway follower —
created via the proven `send-otp` + `verify-otp` `000000` flow,
OTP_MOCK=true on Render — for W2).

## W1 — RBAC: admin endpoint rejects unauthenticated
1. `GET /admin/queue/brands` with **no Authorization header**.
2. Response is a clean auth rejection: HTTP 401 (or 403), JSON
   `{ success:false, error:{ code: 'UNAUTHORIZED' | 'FORBIDDEN' } }`.
3. NOT 200, NOT 5xx.

## W2 — Attribution invariant: transaction refused without creator ids
1. Authenticate a throwaway follower (`+919` + 9 digits → valid
   E.164; `verify-otp` `000000`).
2. `POST /follower/pay-at-store` with a body that omits
   `campaign_id` / `set_id` / `campaign_influencer_id`.
3. The backend **refuses** with a clean client error
   (`4xx`, `success:false`, an error code — e.g. VALIDATION_ERROR
   / NOT_FOUND / a domain refusal), NOT a 200 and NOT a 5xx.
   (This is the "every follower transaction is creator-attributed"
   invariant — the API must never accept an unattributed txn.)

## W3 — Auth contract
1. `POST /auth/send-otp { phone: '12345' }` (non-E.164) →
   `422`, `error.code='VALIDATION_ERROR'`, `error.field='phone'`.
2. `POST /auth/verify-otp { phone:'+919…' }` (no `otp`) →
   `422 VALIDATION_ERROR` (field `otp`).
3. Control: `POST /auth/send-otp` with a valid `+91` E.164 →
   `success:true` (proves W3.1 fails on the rule, not the endpoint).

## Success definition
All three invariants hold exactly: W1 unauth → auth-error (not
open, not 5xx); W2 unattributed txn → clean refusal (not accepted,
not 5xx); W3 bad phone/missing otp → 422 VALIDATION_ERROR, valid
phone → success. Any deviation (endpoint open, 5xx, accepts
unattributed txn) = FAILURE.

## Failure / edge
- A 5xx anywhere = backend-contract regression (real finding).
- W2 accepting the txn = attribution-invariant breach (critical).
