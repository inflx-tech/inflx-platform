# 01 — Spec: admin-approval-consolidation

Founder-directed. Four defects across the two admin decision
surfaces, plus the audit-trail bug found while implementing.

## D1 — Reject always 422 from `/admin/approvals`

`Packages/brand-web/app/admin/approvals/page.js:139` sends
`rejection_reason`. `backend/src/controllers/admin.controller.js:97`
destructures `reason`, and line 103 throws
`VALIDATION_ERROR / reason is required when rejecting` (422) when it
is falsy. There is **no validation middleware anywhere in the
backend** (no express-validator / zod / joi — confirmed by grep over
`backend/src` and `backend/package.json`), so nothing normalises the
two names.

**Every reject from the Approvals desk fails, always.** Approve is
unaffected — it sends only `{ status }`.

The same `handleAction` also drives the **influencer** tab
(`adminApi.updateInfluencerStatus`), whose handler has the identical
guard at `admin.controller.js:167-169`. So influencer rejection is
broken too — not in the original report.

**Fix:** rename the frontend key to `reason`. `/admin/brands` already
sends `reason` correctly (`brands/page.js:98`) and is the reference.

## D2 — Duplicate decision surfaces

`/admin/brands` renders its own Approve/Reject for `pending` rows
(`brands/page.js:249-260`). Two desks can make the same decision with
different reason-capture UX (canned chips vs free textarea).

**Fix:** remove Approve/Reject from `/admin/brands`. Approvals is the
single decision desk. **Keep Suspend** — it acts on `approved` rows,
which never appear in the Approvals queue.

> Sequencing note: D1 must land **before** D2. Removing the working
> buttons first would leave no functioning reject anywhere.

## D3 — `suspended` and `rejected` are dead ends

Brand status is `users.status`
(`001_initial_schema.sql:12`, enum `pending|approved|rejected|
suspended`). **`brands` has no `status` column.**

- `/admin/brands` gates Approve/Reject on `pending` and Suspend on
  `approved`, so a suspended or rejected row renders only the Fee
  button — nothing for a reviewer.
- `/admin/approvals` queues hard-filter `WHERE u.status = 'pending'`
  (`admin.controller.js:41,48,74,81`), so those rows never appear.
- The `[id]` detail page has no status actions at all.

`suspended` has **zero** exit path system-wide. `rejected` escapes
only via brand self-service `POST /brands/resubmit`
(`brand.controller.js:371-380`), which an admin cannot invoke.

The backend already accepts `{status:'approved'}` unconditionally —
it does not check the current status — so this is **UI-only**.

**Fix:** add a Reinstate button on `/admin/brands` for `suspended`
and `rejected` rows, writing `status:'approved'`.

## D4 — Suspend erases the approval audit trail

`admin.controller.js:121-126` shared one `else` branch between
`rejected` and `suspended`, so suspending nulled `approved_at` and
`approved_by`. By the time you want to reinstate, the provenance of
the original approval is already gone.

**Fix:** split into three branches. `suspended` keeps
`approved_at`/`approved_by` and only records the note. Applied to the
influencer handler identically.

## Out of scope (flagged, not fixed)

`updateBrandStatus` writes `brands` then `users` as two separate
queries with no transaction (`admin.controller.js:117-128`). A
failure between them leaves `approved_at` set while `users.status`
stays `pending`. Surfaced to the founder; deliberately not changed
here to keep this contract reviewable.
