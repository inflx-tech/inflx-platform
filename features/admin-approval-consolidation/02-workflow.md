# 02 — Workflow

## W1 — Reject a pending brand (the broken path)

1. Admin opens `/admin/approvals`, Brands tab.
2. Clicks **Reject** on a pending row → inline panel expands.
3. Picks a canned reason chip (or "Other" + free text).
4. Confirms.
5. **Today:** `PATCH /admin/brands/:id/status` with
   `{status:'rejected', rejection_reason:'…'}` → **422**, toast shows
   "reason is required when rejecting". Nothing is written.
6. **After:** body is `{status:'rejected', reason:'…'}` → 200. Row
   leaves the queue; `users.status='rejected'`;
   `brands.rejection_reason` set; `account.rejected` notification
   sent.

Identical for the Influencers tab.

## W2 — Approve (unchanged, regression guard)

Approve sends only `{status:'approved'}` and already works. It must
keep working after the rename.

## W3 — Decision surfaces after consolidation

- `/admin/approvals` — the only place to Approve/Reject. Queue is
  pending-only.
- `/admin/brands` — directory + lifecycle actions on non-pending
  rows: **Suspend** (approved), **Reinstate** (suspended/rejected),
  **Fee**. A pending row now shows no decision buttons; the admin is
  directed to the Approvals desk.

## W4 — Reinstate

1. Admin filters `/admin/brands` to Suspended (or Rejected).
2. Clicks **Reinstate** → confirm modal.
3. `PATCH /admin/brands/:id/status` `{status:'approved'}` → 200.
4. `users.status='approved'`, `rejection_reason` cleared,
   `approved_at`/`approved_by` re-stamped, `account.approved`
   notification sent.
5. The brand's dashboard clears its "under review" banner on next
   load — which only works once the sibling contract
   `brand-status-surface-fixes` lands, since the banner currently
   reads a non-existent key.

## W5 — Suspend keeps provenance

1. Admin suspends an approved brand with a note.
2. `users.status='suspended'`, `brands.rejection_reason` = note.
3. **`approved_at` / `approved_by` survive** (D4).

## Verification

- `pnpm qa` green.
- Live: reject a pending brand from `/admin/approvals` → 200, not
  422. (Founder's note: approve works there; reject only worked from
  `/admin/brands` — so plan the test on a disposable pending row.)
- DB spot-check after a suspend: `approved_at IS NOT NULL`.
