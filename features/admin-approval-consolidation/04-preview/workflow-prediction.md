# 04 — Workflow prediction

What a reviewer should observe after implementation, stated before
the diff is captured.

## `/admin/approvals` — reject a pending brand

1. Brands tab, pending row → **Reject** → inline panel opens.
2. Pick a canned chip (or Other + text) → confirm.
3. **Predicted:** toast "Brand rejected successfully"; row leaves the
   queue.
4. **Today:** red toast "reason is required when rejecting"; row
   stays. This is the single observable that proves D1.

No visual change on this page — only the request body key.

## `/admin/brands` — action cell

| Status | Predicted buttons |
|---|---|
| pending | `In Approvals →` · Fee |
| approved | Suspend · Fee |
| suspended | **Reinstate** · Fee |
| rejected | **Reinstate** · Fee |

- Clicking `In Approvals →` routes to `/admin/approvals` and does
  **not** trigger the row's navigate-to-detail handler (the action
  cell stops propagation).
- Reinstate opens the shared modal titled "Reinstate Brand" with
  teal confirm copy naming the prior state, and a
  "Confirm Reinstate" button.
- A reviewer-role admin sees Reinstate; a finance-only admin sees
  Fee only. `canAction` / `canFee` gates are untouched.

## Backend-observable

- Suspend an approved brand, then read the row: `approved_at` and
  `approved_by` are **unchanged**. Before this contract they were
  nulled.
- Reinstate: `users.status='approved'`, `rejection_reason=null`,
  `approved_at` re-stamped.

## Known non-observable

The brand-side effect of a reinstate — the "under review" banner
clearing — is **not** verifiable from this contract. The banner reads
a key the API never returns; that is fixed in the sibling contract
`brand-status-surface-fixes`. Do not treat a still-visible banner as
a failure of this contract.
