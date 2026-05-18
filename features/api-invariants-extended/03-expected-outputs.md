# Expected Outputs — Extended API invariants (B1b)

> Step 3 (cont.). Asserted by the QA report. Defined BEFORE code.

| WF | Call | Expected |
|---|---|---|
| W4 | GET /admin/stats (no auth) | {401,403}; success:false; code∈{UNAUTHORIZED,FORBIDDEN} |
| W4 | GET /admin/queue/influencers (no auth) | as above |
| W4 | GET /admin/brands?status=all (no auth) | as above |
| W4 | PATCH /admin/brands/qa-nonexistent/status (no auth) | as above (auth before resource) |
| W5a | verify-otp fresh phone, otp 000000, no role | 422; code=VALIDATION_ERROR; field=role |
| W5b | verify-otp …, role:'wizard' | 422; code=VALIDATION_ERROR |
| W5c | POST /auth/refresh, no cookie | status≥400 & <500; success:false (exact code pinned Step 7) |
| W6 | GET /unknown-route-<ts> | status 404; JSON; success:false; error.code present; not HTML; not ≥500 |

## Invariants locked
- No protected admin endpoint (read OR mutation) is reachable
  unauthenticated.
- verify-otp enforces role presence + validity with a typed 422 on
  the correct field.
- refresh without a cookie fails clean (4xx, not 5xx).
- The API's 404 is a consistent JSON envelope, not HTML/5xx.

## Evidence
No screenshots (L1). QA-report rows + self-describing test titles
(asserted status/code) are the evidence; failures carry the
request/response in the Playwright trace.

## Implemented by (after lock)
`qa/api/invariants-extended.spec.ts`, Playwright `request` vs
`QA_API_BASE`. Green in `qa/reports/latest.md`; exact W5c code
pinned at Step 7.
