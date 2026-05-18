# Feature Spec — Admin approvals: reject a pending brand with a reason

> Contract A3 of Area A. Step 2. Implementation GATED on
> `lock.json.approved = true`.

## Problem / goal
The approve path (A1) is covered. The other half of clearing the
queue is **rejection**, which is richer: the admin must pick a
structured reason (or type a custom "Other" reason) before the
rejection is allowed. This branch has zero automated coverage and is
where a regression would silently let unreasoned rejections through.

## Scope
- In scope: the **reject a pending brand** path on
  `/admin/approvals` (brands tab) — reason chips, the "Other" →
  custom-text sub-flow, the Confirm-Reject guard, and the resulting
  `PATCH … {status:'rejected', rejection_reason}` + success toast.
- Out of scope: approve path (A1, done); influencer rejection (same
  code path, different tab — A3.1 if wanted later); A2/A4/A5.

## Surfaces touched (verified — same as A1)
- App: brand-web (port 3002), route `/admin/approvals`
- Component: `ApprovalRow` reject sub-panel in
  `Packages/brand-web/app/admin/approvals/page.js`
- Gates: `middleware.js` (cookie) + `app/admin/layout.js` (localStorage role)

## Data / contracts (observed, no changes)
- Reject UI: clicking "Reject" toggles a panel of
  `REJECTION_REASONS`. Selecting "Other" reveals a `<textarea>`.
- "Confirm Reject" is disabled while
  `!reason || (reason==='Other' && !customReason)`.
- On confirm → `PATCH /admin/brands/:id/status` body
  `{ status:'rejected', rejection_reason:<finalReason> }`
  → success toast `"Brand rejected successfully"` + queue reload.

## Non-functional
- Deterministic: reuse the cookie + localStorage + API-stub pattern
  from A1, extracted into a shared helper (see impact).
- Failure mode in scope: confirm with no reason selected must NOT
  fire a PATCH (button-disabled guard).
