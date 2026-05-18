# Mock UI / Screen Preview (Step 4) — Admin reject-with-reason

Already-implemented UI (`ApprovalRow` reject sub-panel in
`Packages/brand-web/app/admin/approvals/page.js`) — no new design to
mock. Baseline behaviour the reviewer confirms at the Step-5 lock:

- Clicking "Reject" on a row expands an inline panel:
  "Select rejection reason" + a wrap of reason chips.
- Selecting "Other" reveals a custom-reason `<textarea>`.
- "Confirm Reject" is disabled until a reason (or custom text) exists;
  "Cancel" collapses the panel.
- On confirm: bottom-right toast "Brand rejected successfully".

Real before/after screenshots captured at Step 9 →
`qa/artifacts/screenshots/{before,after}/admin-reject__*.png` become
the regression baseline.
