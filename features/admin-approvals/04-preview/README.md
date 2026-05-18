# Mock UI / Screen Preview (Step 4) — Admin approvals

This contract covers an **already-implemented** screen
(`Packages/brand-web/app/admin/approvals/page.js`), so there is no
new design to mock. The "preview" baseline is the existing UI:

- Queue state: "Approval Queue" heading, Brands/Influencers tabs with
  counts, a row per pending application (avatar, name, sub, status
  badge, View / Approve / Reject).
- Post-approve: bottom-right dark toast "Brand approved successfully".

The real before/after screenshots captured during Step 9 land in
`qa/artifacts/screenshots/{before,after}/admin-approvals__*.png` and
become the visual baseline for future regression diffs.

No pre-coding mock required — reviewer confirms the above is the
intended behaviour at the Step-5 lock.
