# 06-diff — admin-people-pipeline

**Capture method:** hand-authored, not `pnpm diff:open`/`diff:after`. The
mockups are static HTML with sample data, but the real pages sit behind
admin phone+OTP auth (localStorage JWT + a short-lived cookie for
middleware) — `diff-after.mjs`'s `<name>.capture.json` sidecar only takes a
URL/viewport/selector, with no login step, so a headless Playwright hit on
`/admin/influencers` etc. would just land on `/login` and capture nothing
useful. Per the contract's own fallback clause, this file plainly describes
what was implemented vs. each locked mockup instead.

## sidebar-nav.html → `Packages/brand-web/app/admin/layout.js`

Implemented exactly as locked. `NAV`'s `MANAGEMENT` section header
renamed to `PEOPLE` with the same 5 items, reordered to match the mockup
(Approvals, Influencers, Brands, Production Queue, Orders — Influencers
now comes before Brands, swapped from the old array order). `MARKETING`
renamed to `OUTREACH`, trimmed from 7 items to 3 (Inbox, Funnel, Settings
— relabelled from "M-Settings"); Triage/Add Lead/Verifications/
Invitations no longer appear as nav rows. Every other section (OVERVIEW,
CONTENT, REFERRALS, FINANCE, PRICING, SETTINGS) untouched — confirmed by
diffing only the two edited blocks in `layout.js`. `cap` values kept
identical per item, so `scopeNav()`'s capability gating behaves the same
as before, just under new headers.

No divergence.

## influencers-tabbed.html → `Packages/brand-web/app/admin/influencers/page.js`

4 tabs implemented (Leads / Invited / Pending Verification / Live), tab
state driven by `?tab=` query param (defaults to `leads`) instead of the
mockup's plain JS `showTab()` — routes were explicitly left open by
`03-expected-outputs.md` ("client-side tab state on one page" was one of
the allowed shapes). Deep-linking from Approvals uses this same param.

- **Leads tab**: `marketingApi.listLeads({target_type:'influencer',...})`,
  same filter row and table columns as the mockup. "+ Add Lead" opens a
  modal with the same single-intake fields shown in the mockup (handle,
  full name, city, state, niche, sub-niche, phone, email, whatsapp,
  notes) via `marketingApi.intakeLead`. **Divergence:** the modal is
  single-intake only — the old `/admin/marketing/add` page's second
  "Bulk (CSV paste)" mode is not carried over, because the locked mockup
  only shows the single-intake form. `/admin/marketing/add` now redirects
  into this tab with `?add=1` (auto-opens the modal); bulk CSV lead
  import has no UI entry point after this contract. Flagging this as a
  real capability reduction, not an oversight — surfaced here per the
  "don't silently skip" instruction rather than adding UI the mockup
  never showed.
- **Invited tab**: unchanged content/behaviour from the old
  `/admin/marketing/invitations` page (New/Contacted/Converted/Expired/
  Declined sub-tabs, Mark contacted / Expire actions) — matches mockup.
- **Pending Verification tab**: unchanged content/behaviour from the old
  `/admin/marketing/verifications` page (claim-cluster cards, ⚠ CONFLICT
  banner, Verify/Reject with required-reason). Matches mockup's normal
  card + conflict-cluster card exactly. This is now the only influencer
  approve/reject surface — see the backend section below.
- **Live tab**: the page's original directory content (table, status
  filter chips, search, CSV bulk-upload panel — which predates this
  contract and isn't mentioned in the fold-in map, so it was kept).
  Status badge is already read-only here (no change needed — the old
  Live list never had inline actions, unlike Brands). Matches mockup.

## brands-tabbed.html → `Packages/brand-web/app/admin/brands/page.js`

3 tabs implemented (Leads / Pending Verification / Live), same `?tab=`
pattern.

- **Leads tab**: `marketingApi.listLeads({target_type:'brand',...})`,
  brand-specific fields (business name, industry/sub-industry). Add Lead
  modal mirrors the influencer one (business name instead of full name,
  industry/sub-industry instead of niche/sub-niche, plus website). Same
  bulk-CSV divergence noted above.
- **Pending Verification tab**: the brand half of the old
  `/admin/approvals/page.js` — same `Fact` grid (contact person, phone,
  where, GST, address, pincode, category, email), same rejection-reason
  picker, same Approve/Reject buttons, wired to
  `adminApi.getBrandQueue()` / `adminApi.updateBrandStatus()`. Matches
  mockup.
- **Live tab**: original directory content, but the inline
  approve/reject/suspend modal (`actionModal` state, "Reinstate"/
  "Suspend" row buttons) is removed — status is now a read-only badge.
  The `canFee` platform-fee override button is kept, per
  `03-expected-outputs.md`'s explicit "must not remove" instruction.
  Matches mockup's footnote ("Fee override stays available").
  **Divergence worth flagging explicitly:** neither the mockup nor any
  workflow scenario gives Suspend (for an already-approved brand) a new
  home anywhere in the locked design — Pending Verification only ever
  shows `pending`-status rows, so it has no Suspend action either. After
  this contract, suspending a live brand has no UI entry point at all
  (the backend `PATCH /admin/brands/:id/status` endpoint still accepts
  `status: 'suspended'` — capability-gated, left alone per the brief —
  it's just not wired to any button). This matches what was locked
  (Live tab's own note says "read-only... to change it, go to Pending
  Verification", and Pending Verification's row shape has no suspend
  control), so it was implemented as specified rather than inventing a
  new affordance outside the lock. Worth a follow-up contract if Suspend
  needs to come back.

## approvals-summary.html → `Packages/brand-web/app/admin/approvals/page.js`

Rebuilt as a pure summary: 4 count tiles (Total pending / Brands /
Influencers / Invitations, from `adminApi.getStats()`'s
`pending_approvals.brands`, `pending_verifications`,
`pending_invitations`) and two deep-link cards to
`/admin/brands?tab=pending` and `/admin/influencers?tab=pending`. Zero
approve/reject controls, matching the mockup and
`03-expected-outputs.md`'s "no row-level data, no action buttons"
requirement.

**Divergence:** the mockup's card copy is illustrative sample text ("1
pending", "Includes 1 conflict cluster (Neha Joshi...)") wired to nothing
real. The implementation uses the live `getStats()` counts with a
generic, always-true sentence ("N brand applications are waiting for a
decision") instead of naming specific applicants or conflict clusters —
`getStats()` doesn't return per-cluster detail, and fabricating that
copy would violate the "computed is not delivered" / no-fake-data rule.
The "no approve/reject buttons" explainer paragraph is reproduced
near-verbatim from the mockup.

## Backend — 05 — the two-table verification gap

`backend/src/controllers/creatorVerification.controller.js`'s `verify`
and `reject` now each run in one transaction and mirror onto the linked
`influencers` row (via `creator_profiles.linked_influencer_id`, which
`influencer.controller.js` already sets on every row that can actually
reach `verification_status='claimed'`) and the underlying `users` row —
verified against `backend/migrations/001_initial_schema.sql`, which
confirmed neither `brands` nor `influencers` has its own `status`
column; the field every admin list actually reads is `users.status`
joined through `user_id`. `01-spec.md`'s shorthand ("influencers.status")
is the conceptual status, not a literal column — implemented against the
real schema per this repo's verify-twice rule, no migration needed
(matches the "fields already exist" instruction).

- `verify`: sets `creator_profiles.verification_status='verified'`
  (unchanged), auto-rejects conflict-cluster siblings (unchanged), then
  — new — sets `influencers.rejection_reason=NULL, approved_at=NOW(),
  approved_by=<admin>` and `users.status='approved'` for the linked row.
  This replaces the old code path, which updated `users.status` via
  `claim_user_id` unconditionally; the new code gates on
  `linked_influencer_id`, which is strictly narrower and matches
  `01-spec.md`'s "via linked_influencer_id" resolution — every row that
  can reach `'claimed'` already carries `linked_influencer_id` (set in
  the same statement as the claim in `influencer.controller.js`), so
  this is not a regression, just the more precise FK.
- `reject`: previously touched only `creator_profiles` — a rejected
  claim left the influencer's `users.status` stuck at `'pending'`
  forever, silently contradicting the "closes the 3-way duplicate"
  intent. Now mirrors the same `rejection_reason` onto `influencers` and
  sets `users.status='rejected'`, gated the same way as `verify`.
- `PATCH /admin/influencers/:id/status` (the old duplicate approval
  path) was left in place on the backend — per the brief, other things
  may still depend on the capability-gated route — but no frontend
  button calls it anymore after removing the decision block from
  `admin/influencers/[id]/page.js` and rewriting
  `admin/approvals/page.js`. Verified by grepping the whole
  `Packages/brand-web` tree for `updateInfluencerStatus` after the
  change: zero call sites remain.

## Detail pages (not separately mocked, but named in 02-workflow.md scenario c)

- `admin/influencers/[id]/page.js`: standalone approve/reject/suspend
  block removed, replaced with a read-only status badge and a link to
  Influencers → Pending Verification. TDS controls (unrelated to
  approval status) kept.
- `admin/brands/[id]/page.js`: same treatment — decision block removed,
  read-only badge + link to Brands → Pending Verification. Platform fee
  override and L3 commerce-commission override (both finance-only,
  unrelated to approval status) kept.

## 2026-08-27 — follow-up: Bulk CSV lead import + Suspend/Reinstate restored

Founder asked for the two capabilities flagged as gaps above (Risk notes in
`05-impact.md`) to come back. The mockups were updated first
(`influencers-tabbed.html`, `brands-tabbed.html` now show a "Bulk Import
(CSV)" button next to "+ Add Lead" on the Leads tab, and Suspend/Reinstate
buttons in an Actions column on the Live tab) and this change implements
exactly those mockup elements — no other page or nav item touched.

### Bulk CSV lead import — Leads tab, both pages

Restored the old `/admin/marketing/add` page's Bulk (CSV paste) mode as a
`BulkImportModal` component, defined identically in both
`app/admin/influencers/page.js` and `app/admin/brands/page.js` (duplicated
rather than shared, matching how `AddLeadModal` was already duplicated
per-page in this contract). Opens from a new "Bulk Import (CSV)" button
placed before "+ Add Lead" on the Leads tab filter bar, per the mockup's
button order and copy.

- Rows are parsed client-side from the pasted textarea
  (`type,handle,name,city,category,subcategory,phone,email` — 8 columns,
  matching the mockup's format string and placeholder exactly) into the
  object shape `marketingApi.intakeLeadBulk` already sends: `POST
  /admin/marketing/leads/intake/bulk` with `{ rows: [...] }`, each row
  `{ target_type, handle, business_name|full_name, city, industry|niche,
  sub_industry|sub_niche, phone, email }`. This is the same endpoint and
  payload shape the old `/admin/marketing/add` bulk mode used before it
  was rewritten into a redirect stub — verified by reading
  `backend/src/controllers/marketingAdmin.controller.js`'s
  `intakeLeadBulk` (untouched by this contract, still registered at
  `backend/src/routes/marketingAdmin.routes.js:19`) and
  `Packages/brand-web/lib/api.js`'s `marketingApi.intakeLeadBulk`
  (`api.post('/admin/marketing/leads/intake/bulk', { rows })`) — neither
  needed any change.
- **Divergence from the old page's format:** the old bulk textarea took 9
  columns (`type,handle,name,city,state,category,subcategory,phone,email`
  — with a `state` column). The locked mockup's format string and
  placeholder both drop `state` (8 columns). Followed the mockup exactly
  rather than the old page — `state` is optional on the backend (only
  used to tag city/state on an already-known handle), so omitting it just
  means bulk-imported leads don't get a state until edited individually.
  Not a functional loss for new leads (the field is empty either way);
  worth a follow-up if bulk state-tagging specifically is wanted back.
- Per-row feedback matches the old page: after import, the modal shows
  total/created/re-tagged/duplicates/invalid counts and an expandable
  per-row error list (`result.errors[].row` / `.message`), sourced
  directly from the controller's response — no fabricated success text.
  The Leads tab list reloads after a successful import.
- `/admin/marketing/add`'s redirect-stub comment ("bulk CSV lead import
  has no UI entry point after this contract") is now stale — left as-is
  since the redirect itself still works and rewriting historical
  commentary isn't this change's job; this section is the correction of
  record.

### Suspend / Reinstate — Live tab, both pages

Restored as an Actions-column button per row, wired to the same
`adminApi.updateBrandStatus` / `adminApi.updateInfluencerStatus` helpers
(`PATCH /admin/brands/:id/status` / `PATCH /admin/influencers/:id/status`)
the old inline modals used — both endpoints and helpers were left
untouched by the original contract specifically so this restoration
wouldn't need backend or `lib/api.js` changes. Confirmed by reading
`backend/src/controllers/admin.controller.js`'s `updateBrandStatus` /
`updateInfluencerStatus` (unchanged; both accept
`{ status: 'approved'|'rejected'|'suspended', reason }`, `reason` only
required when `status === 'rejected'`).

- **Influencers Live tab** had no inline actions at all before this
  change (per the original diff note: "the old Live list never had
  inline actions, unlike Brands"). Added a 9th grid column ("Actions") to
  the header and each row, plus a `SuspendCreator`/`ReinstateCreator`
  modal pair matching the mockup's copy and layout exactly (reason
  textarea required to enable "Confirm Suspension"; Reinstate has no
  reason field, just a confirm).
- **Brands Live tab** already had an Actions column (holding the `canFee`
  "Fee" button, kept per the original contract's explicit "must not
  remove" instruction). Suspend/Reinstate buttons were added into the
  same cell, before Fee.
- **Single-gate rule verified:** in both pages, the button rendered for a
  row is driven by that row's own `status` field, not by which Live-tab
  filter chip is selected — `Suspend` renders only when
  `status === 'approved'`, `Reinstate` only when `status === 'suspended'`.
  A `pending` (or `rejected`) row gets neither button, so there is no path
  from this UI that reaches `PATCH .../status` with `status: 'approved'`
  for a row that hasn't already been through Pending Verification once.
  Pending Verification remains the only surface that can move a `pending`
  row to `approved` for the first time. Manually re-read both new
  row-render blocks after writing them to confirm no other condition
  gates the buttons.
- Reinstate calls `updateBrandStatus`/`updateInfluencerStatus` with
  `{ status: 'approved' }` (no `reason`) — matches the backend's own
  branch for "approve, or reinstate a suspended/rejected [row]" and the
  mockup's Reinstate modal, which has no reason field.
- Both Live tabs' footer notes were reworded to match the mockup's
  "Approving or rejecting a NEW signup still happens only in ... Pending
  Verification ... Suspend/Reinstate here is a different, narrower
  action" copy, replacing the older "Status is read-only here" line.

### QA

`pnpm qa` after these changes: 466 passed / 18 failed / 1 skipped — same
counts as the pre-existing baseline, and the 18 failures are the same
known-unrelated set (verify-otp role validation W5a/W5b, campaign-end B9,
the 10 collab-terms-model cases, 3 handshake-service cases, 2
proposal-acceptance-agreement cases). Zero new failures introduced by
this change. No qa spec in `qa/web/admin/` asserts on the Leads-tab
button row or the Live-tab grid column count, so none needed updating.

### Files touched

- `Packages/brand-web/app/admin/influencers/page.js` — `BulkImportModal`
  added; Leads tab gets the "Bulk Import (CSV)" button; Live tab gets an
  Actions column with Suspend/Reinstate buttons + modals.
- `Packages/brand-web/app/admin/brands/page.js` — same three additions.
- No backend, `lib/api.js`, migration, nav, or other admin page changes.

### 2026-08-27 — backend hardening (found in review, not part of the
### implementing agent's own pass)

The implementing agent verified the single-gate rule only at the
frontend: Suspend/Reinstate buttons render conditionally on a row's
`status`, so no *button* reaches `PATCH .../status` with
`status: 'approved'` for a pending row. That's necessary but not
sufficient — `updateBrandStatus`/`updateInfluencerStatus` in
`backend/src/controllers/admin.controller.js` had **no server-side
guard at all**, so reconnecting them to live UI (for Suspend/Reinstate)
meant the endpoint itself could still be called directly with
`status: 'approved'` against any influencer regardless of current
status — silently reopening the exact 3-way-duplicate-approval bug
this whole contract exists to close, just reachable by API call
instead of by button.

Fixed directly in `admin.controller.js`:
- `updateInfluencerStatus`: `status: 'approved'` now requires the
  influencer's current `user_status` to be `'suspended'` — this
  endpoint can only ever reinstate now; a pending signup can only
  reach `'approved'` through `creatorVerification.controller.js`'s
  `verify()`, which is also the only path that keeps
  `creator_profiles.verification_status` in sync. `status: 'suspended'`
  now requires current status `'approved'`.
- `updateBrandStatus`: added the same `'suspended'` guard (requires
  current status `'approved'`). The `'approved'` transition is
  deliberately left unguarded for brands — unlike influencers, brands
  have no separate verification transaction, so Pending Verification's
  new-signup approve and the Live tab's reinstate both legitimately
  use this same write; there is no second table to fall out of sync.

Both throw `VALIDATION_ERROR` (422) with a message pointing at the
correct surface, rather than failing silently. Re-ran `pnpm qa` after
this fix — see result below.

## Old routes

`/admin/marketing/leads`, `/admin/marketing/add`,
`/admin/marketing/verifications`, `/admin/marketing/invitations` are now
server-side redirects (`redirect()` from `next/navigation`) into the
corresponding tab, per `03-expected-outputs.md`'s fold-in map — no
orphaned pages left behind. `/admin/marketing/leads` inspects
`?target_type=` to route to the Brands or Influencers Leads tab.
`/admin/marketing/inbox`, `/admin/marketing/funnel`,
`/admin/marketing/settings` are untouched (OUTREACH, unchanged per
scope). The lead detail route
(`/admin/marketing/leads/[type]/[id]/page.js`) and
`/admin/marketing/inbox/page.js`'s internal links to `/admin/marketing/leads`
were left as-is — not named in the fold-in map, and they still resolve
correctly through the new redirect.
