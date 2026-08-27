# Workflow Definition — admin-people-pipeline

> Step 3. The executable contract: each numbered step becomes an
> assertion in the QA workflow test (once implemented). Defined BEFORE
> coding. Tab names quoted below are exact — they are what the tab
> label will read in the UI.

## Actor

Logged-in admin, any of the four capability tiers (superadmin,
reviewer, finance, marketing). Scenario (a) needs `marketing` cap;
(b) needs `marketing` cap (verify/reject) or falls back to read-only
for others; (c) needs `brands`/`influencers` cap (read-only for
everyone with that cap, decision buttons additionally need
`reviewer`/`superadmin`).

## Preconditions

- At least one scraped-not-signed-up influencer and one scraped brand
  exist in the unified leads table (`target_type` influencer/brand,
  `outreach_status = not_contacted`).
- At least one influencer signup row sits in `creator_profiles` with
  `verification_status = claimed`, including one **conflict cluster**
  (two `creator_profiles` rows sharing one `claim_user_id`).
- At least one approved brand and one approved influencer already exist
  (for the "who's live" scenario).

---

## Scenario (a) — admin browses new leads and adds one manually

1. Admin clicks **PEOPLE → Influencers** in the sidebar → lands on the
   Influencers page with the **Leads** tab active by default →
   sees a table of scraped-not-signed-up creators (handle, name, city,
   niche, tier, followers, priority score, outreach status, contact
   channel dots — 📞 ✉️ 💬), sorted by score descending.
2. Admin narrows using the filter row (type — already fixed to
   Influencers on this page; status; min score; city; niche/sub-niche;
   tier) or types a handle/name into search → table re-filters,
   pagination resets to page 1.
3. Admin clicks **+ Add Lead** (button, top-right of the Leads tab,
   folded in from the old standalone "Add Lead" nav item) → a modal
   opens with a single-intake form: handle, full name, city, state,
   niche, sub-niche, phone, email, whatsapp, website, notes.
4. Admin fills the form and submits → one of three outcomes:
   - **Created** — success message, modal closes, new row appears at
     the top of the Leads tab table.
   - **Conflict** (`action: requires_decision`) — modal shows the
     existing matching row and asks the admin to confirm which action
     to force (e.g. "revive" a dead lead) before resubmitting.
   - **Error** — inline error message in the modal, form stays open
     with entered values intact.
5. Admin repeats steps 1–4 with **PEOPLE → Brands → Leads** tab for a
   brand-side lead — identical shape, minus the Instagram-specific
   fields, using `target_type: brand` (business name instead of full
   name, industry/sub-industry instead of niche/sub-niche).

## Scenario (b) — admin verifies a pending-signup creator (incl. conflict cluster)

1. Admin clicks **PEOPLE → Influencers → Pending Verification** tab →
   sees creator rows grouped into cards by `claim_user_id`; a card with
   more than one row is visually flagged **⚠ CONFLICT — N candidates**
   with an orange border.
2. For a **normal (single-row) card**: admin reviews the claimant's
   name/phone, the profile they claimed (avatar, IG handle, follower
   tier, follower count, YouTube handle if given, bio email/phone,
   claim-requested timestamp) → clicks **✓ Verify** → confirms in the
   browser dialog → row moves out of Pending Verification;
   `creator_profiles.verification_status` becomes `verified`, and (per
   the merge decided in `01-spec.md`) the linked `influencers.status`
   becomes `approved` so the **Live** tab now shows this creator with a
   read-only Approved badge.
3. For a **conflict cluster (2+ rows under one claimant)**: admin reads
   the shared banner ("This user matched multiple scraped profiles.
   Verifying one will auto-reject the others.") then clicks **✓ Verify**
   on the one correct row → that row verifies, the sibling row(s) in the
   same cluster auto-reject with a system-generated reason, cluster
   disappears from Pending Verification.
4. Alternatively, admin clicks **Reject** on a row → an inline reason
   field appears → admin types a reason (required — Confirm Reject is
   disabled until non-empty) → clicks **Confirm reject** → row moves to
   the **Rejected** filter of this same tab (a card-level filter chip,
   not a separate nav item) with the reason shown in red.
5. Admin repeats the same shape on **PEOPLE → Brands → Pending
   Verification** for a brand signup — the row-level facts differ
   (business name, GST, address, category instead of IG/YouTube stats,
   per `admin/approvals/page.js`'s existing brand `Fact` grid) but the
   Approve / Reject buttons and the reason-required rejection flow are
   the same pattern.

## Scenario (c) — admin looks at "who's live" for both influencers and brands

1. Admin clicks **PEOPLE → Influencers → Live** tab → sees the full
   onboarded-influencer directory (same table shape as today's
   `admin/influencers/page.js`: creator, contact, city, INFLX
   followers, Instagram reach, YouTube reach, **status badge
   (read-only)**, joined date) with the All/Approved/Pending/
   Rejected/Suspended status filter chips and the search box.
2. Admin clicks a row → navigates to that influencer's detail page
   (unchanged route, `/admin/influencers/[id]`) — but the detail page's
   own standalone approve/reject/suspend button is gone; the status
   section there is now also read-only, with a link back to **PEOPLE →
   Influencers → Pending Verification** if the admin actually needs to
   change the decision.
3. Admin clicks **PEOPLE → Brands → Live** tab → sees the full brand
   directory (business, contact, category, city, **status badge
   (read-only)**, wallet balance, platform fee, joined date) with the
   same status filter chips and search.
4. Admin clicks a row → brand detail page opens; the inline
   approve/reject/suspend modal that used to live on the Brands list
   itself is gone from both the list and the detail page — status is
   read-only everywhere except the Pending Verification tab. The
   platform-fee-override action (finance-only, unrelated to approval
   status) stays exactly where it is today.

## Success definition

The workflow is SUCCESSFUL only if, after this contract's mockups are
reviewed and (eventually) implemented:

- Every place that today shows an approve/reject/suspend control for a
  brand or influencer, except the two Pending Verification tabs, shows
  a read-only status badge instead.
- The sidebar shows exactly one **PEOPLE** section and one **OUTREACH**
  section, each containing only the items listed in `03-expected-
  outputs.md`, with old items (Triage, Add Lead, Verifications,
  Invitations as standalone nav entries) no longer present as separate
  nav rows.
- Approvals nav item opens a page with zero decision buttons on it —
  only counts and deep-links.

## Failure / edge workflows

- **Add Lead conflict** (scenario a, step 4) — a lead with that handle
  already exists → modal must show the conflict, not silently create a
  duplicate or silently fail.
- **Verify a cluster row after a sibling was already verified**
  (race — two admins working the same cluster) → second verify attempt
  must show a clear error, not a silent no-op or a duplicate approval.
- **Reject with empty reason** — Confirm Reject stays disabled; no API
  call fires.
- **Not authenticated / capability missing** — nav item doesn't render
  (per existing `scopeNav()`); direct URL hit still 403s server-side
  (unchanged, not part of this contract).
- **Live tab shows a status that Pending Verification never set**
  (e.g., a legacy row) — badge still renders read-only using whatever
  `status` value is on record; no crash on an unexpected status string
  (existing `cfg[status] || 'bg-surface2 text-t3'` fallback pattern is
  preserved).
