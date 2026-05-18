# Expected Outputs — API contract & permission invariants (B1)

> Step 3 (cont.). Asserted by the QA report. Defined BEFORE code.

## Per-workflow expected outputs
| WF | Call | Expected |
|---|---|---|
| W1 | `GET /admin/queue/brands` no auth | status ∈ {401,403}; `success:false`; `error.code` ∈ {UNAUTHORIZED,FORBIDDEN} |
| W2 | follower auth ok | `verify-otp` → 200 + `data.access_token` |
| W2 | `POST /follower/pay-at-store` (no campaign/set/influencer) | status 4xx (NOT 200, NOT ≥500); `success:false`; an `error.code` present |
| W3a | `POST /auth/send-otp {phone:'12345'}` | status 422; `error.code='VALIDATION_ERROR'`; `error.field='phone'` |
| W3b | `POST /auth/verify-otp {phone:'+919…'}` no otp | status 422; `error.code='VALIDATION_ERROR'` |
| W3c | `POST /auth/send-otp` valid `+91` E.164 | `success:true` |

## Invariants locked
- No protected admin endpoint is reachable unauthenticated.
- No follower transaction is accepted without creator attribution.
- The auth phone/otp contract rejects malformed input with a typed
  422 (not a 5xx, not silent acceptance).

## Evidence
- API tests have no screenshots. Evidence = the structured QA report
  rows + (on failure) Playwright's request/response in the trace.
  Each workflow logs the asserted status + error code in the test
  title so the QA report is self-describing. (Deliberate: L1 has no
  visual surface — recorded so it's not read as a gap.)

## Implemented by (after lock)
`qa/api/contract-invariants.spec.ts` using Playwright's `request`
fixture against `QA_API_BASE` (default
`https://inflx-platform.onrender.com/v1`). Green in
`qa/reports/latest.md`. Exact codes pinned here at Step 7.
