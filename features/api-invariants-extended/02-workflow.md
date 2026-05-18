# Workflow Definition — Extended API invariants (B1b)

> Step 3. Playwright `request` vs live backend. No browser, no seed.

## W4 — RBAC breadth (parametrised, unauthenticated)
For each endpoint:
- `GET /admin/stats`
- `GET /admin/queue/influencers`
- `GET /admin/brands?status=all`
- `PATCH /admin/brands/qa-nonexistent/status` (mutation must also
  be gated — auth checked before the resource)
Call with NO Authorization header →
- status ∈ {401,403}, `success:false`, `error.code` ∈
  {UNAUTHORIZED,FORBIDDEN}; never 200; never ≥500.

## W5 — Auth-contract breadth
- **W5a:** fresh phone → `send-otp`; then `verify-otp { phone,
  otp:'000000' }` (NO role) → `422`, `error.code='VALIDATION_ERROR'`,
  `error.field='role'`.
- **W5b:** same flow, `verify-otp { …, otp:'000000', role:'wizard' }`
  (invalid) → `422 VALIDATION_ERROR`.
- **W5c:** `POST /auth/refresh` with no cookie → status 4xx
  (≥400, <500), `success:false`. (Exact code pinned at Step 7.)

## W6 — Not-found contract
- `GET /this-route-does-not-exist-<ts>` → status `404`, JSON body
  with `success:false` and an `error.code`. NOT an HTML page,
  NOT ≥500.

## Success definition
Every W4 endpoint gated (no open admin surface, incl. the mutation);
W5a/W5b → typed 422 on the right field/code; W5c → clean 4xx;
W6 → JSON 404 envelope. Any open endpoint / 5xx / HTML 404 / silent
accept = FAILURE.

## Failure / edge
- A 5xx on any path = backend-contract regression (real finding).
- An admin endpoint returning 200 unauth = critical security finding.
- HTML (not JSON) 404 = API-envelope inconsistency (finding, report).
