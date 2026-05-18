# Feature Spec — Extended API invariants (B1b)

> Contract B1b of Area B (L1 API). Step 2. Implementation GATED on
> `lock.json.approved = true`. Same proven pattern as B1:
> deterministic, vs live backend, no DB seed.

## Problem / goal
B1 locked 3 core invariants. B1b widens the deterministic net so a
larger slice of the security/contract surface can't silently
regress — without entering B2's DB-coupled territory.

## Scope (deterministic, no seed)
- **W4 RBAC breadth:** several protected endpoints (incl. a
  mutation `PATCH`) reject unauthenticated requests with a clean
  `401/403` + typed error envelope — NOT 200, NOT 5xx.
- **W5 Auth-contract breadth:**
  - verify-otp on a fresh phone (otp `000000`) **without role** →
    `422 VALIDATION_ERROR` (field `role`)
  - verify-otp with an **invalid role** → `422 VALIDATION_ERROR`
  - `POST /auth/refresh` with **no refresh cookie** → clean 4xx
    (not 5xx), `success:false`
- **W6 Not-found contract:** an unknown API path → `404` with the
  standard JSON `{success:false,error:{code}}` envelope (NOT HTML,
  NOT 5xx) — proves the API's 404 contract is consistent.

## Explicitly EXCLUDED (honest scoping)
- **Rate-limit (429):** triggering it needs ~100+ OTP calls —
  abusive, slow, pollutes the live limiter. Not a sound
  deterministic test here. (Could be a backend-unit test under B2's
  substrate.)
- **Negotiation/offer turn rules, idempotency:** need seeded
  entities → B2 (DB substrate decision pending).

## Surfaces touched
- Live backend error/authz/contract paths only. No app code. No
  migration, mobile, OTA. Deploy-inert. Footprint = a few throwaway
  otp_codes rows (same class as B1 / e2e-smoke).

## Non-functional
- Exact codes asserted; where a precise code is backend-internal
  (refusal/refresh) the invariant is contracted and the exact code
  is pinned at Step 7 against the live API (B1's accepted policy).
