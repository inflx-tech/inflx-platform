# Expected Outputs — Admin approvals: approve a pending brand

> Step 3 (cont.). What the QA report asserts. Defined BEFORE code.

## Per-step expected outputs
| Step | Observable output | How QA verifies |
|---|---|---|
| 1 | "Approval Queue" heading visible; URL still `/admin/approvals` | `toBeVisible` + `expect(page).toHaveURL(/\/admin\/approvals/)` |
| 2 | Row text "QA Diner" + a `pending` badge + "Approve" button | `getByText` / role=button name=Approve |
| 3 | `PATCH /admin/brands/br_1/status` body `{status:'approved'}` | route handler captures request; assert body |
| 4 | Toast "Brand approved successfully" visible | `getByText(/approved successfully/i)` |

## Data assertions (post-workflow)
- Exactly one PATCH to `/admin/brands/br_1/status`, JSON body
  `{ status: 'approved' }` (no `rejection_reason`).
- `GET /admin/queue/brands` called at least once on load (reload after
  approve is acceptable but not required to assert).

## Negative / edge expected outputs
- No-session run: lands on `/login`; `/admin/queue/brands` NOT called.
- PATCH `{success:false}`: error toast present; "approved
  successfully" toast absent.

## Visual evidence required
- before: `qa/artifacts/screenshots/before/admin-approvals__queue.png`
  (queue with the pending brand)
- after: `qa/artifacts/screenshots/after/admin-approvals__approved.png`
  (success toast)

## Implemented by (after lock)
`qa/web/admin/approvals.spec.ts` (to be created in Step 7) — must show
green in `qa/reports/latest.md`.
