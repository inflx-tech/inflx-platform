# Expected Outputs — Admin role-gate matrix

> Step 3 (cont.). Asserted by the QA report. Defined BEFORE code.

## Per-case expected outputs
| ID | Assertion | How QA verifies |
|----|-----------|-----------------|
| M1 | URL → `/login` AND queue calls == 0 | `expect(page).toHaveURL(/\/login/)` + capture.queueCalls === 0 |
| M2 | URL → `/login` (client gate, wrong role) | `toHaveURL(/\/login/)` |
| M3 | URL → `/login` (client gate, no user) | `toHaveURL(/\/login/)` |
| M4 | URL stays `/admin/approvals`; "Approval Queue" heading visible | `toHaveURL(/\/admin\/approvals/)` + `getByRole('heading',{name:'Approval Queue'})` |
| M5 | `/dashboard` → `/login` (middleware breadth) | `toHaveURL(/\/login/)` |

## Security invariant asserted
No credential state short of (cookie present **and**
localStorage.inflx_user.role === 'admin') results in an admin page
rendering. M4 is the single positive control.

## Visual evidence required
- after: `screenshots/after/admin-role-gate__m2-redirected.png`
  (a representative blocked case landing on /login)
- after: `screenshots/after/admin-role-gate__m4-allowed.png`
  (valid admin on the queue)

## Implemented by (after lock)
`qa/web/admin/role-gate.spec.ts` (Step 7), reusing
`qa/web/_helpers/adminSession.ts` for M4 + `stubAdminApis` for the
queue-call counter. Green in `qa/reports/latest.md`.
