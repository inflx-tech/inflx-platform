# Expected Outputs — Admin approvals: reject with a reason

> Step 3 (cont.). Asserted by the QA report. Defined BEFORE code.

## Per-workflow expected outputs
| WF | Step | Observable output | How QA verifies |
|---|---|---|---|
| A | 2 | Reason panel + chips visible after "Reject" | `getByText('Select rejection reason')` |
| A | 3 | "Duplicate account" chip selectable | click chip |
| A | 4 | PATCH body `{status:'rejected',rejection_reason:'Duplicate account'}` | route captures request body, deep-equal |
| A | 5 | Toast "Brand rejected successfully" | `getByText(/rejected successfully/i)` |
| B | 3 | "Other" → `<textarea>` appears | textarea visible |
| B | 4 | Confirm Reject disabled until text entered | `toBeDisabled` then `toBeEnabled` |
| B | 5 | PATCH body `rejection_reason:'Spam signup'` | captured body deep-equal |
| C | 3 | Confirm Reject disabled w/ no reason; no PATCH | `toBeDisabled` + patch-call-count == 0 |

## Data assertions
- WF A: exactly one PATCH, body
  `{ status:'rejected', rejection_reason:'Duplicate account' }`.
- WF B: PATCH body `rejection_reason === 'Spam signup'`,
  `status === 'rejected'`.
- WF C: zero PATCH calls to `/admin/brands/br_1/status`.

## Visual evidence required
- before: `screenshots/before/admin-reject__reason-panel.png`
- after:  `screenshots/after/admin-reject__rejected.png`

## Implemented by (after lock)
`qa/web/admin/approvals-reject.spec.ts` (Step 7) — green in
`qa/reports/latest.md`. Introduces shared helper
`qa/web/_helpers/adminSession.ts`.
