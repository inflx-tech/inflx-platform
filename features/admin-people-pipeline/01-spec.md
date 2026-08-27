# Feature Spec — admin-people-pipeline

> Step 2 of the contract-driven workflow. Written and agreed BEFORE any code.
> This spec turns the founder-approved flow-diagram (influencer/brand
> pipeline + approval consolidation) into concrete screens. It introduces
> no idea the founder hasn't already seen in that diagram — it only maps
> it onto real nav items, real tabs, and the real database fields behind
> them.

## Problem / goal

Today the admin panel treats "a brand or creator joining the platform"
as four or five unrelated to-do lists scattered across two nav sections
(MANAGEMENT and MARKETING), instead of one pipeline with clear stages.
Concretely:

- **Same person, four places.** A creator who has been scraped but never
  signed up lives in Marketing → Triage. If a brand wants that same
  scraped creator for a campaign, a second, unrelated row for them shows
  up in Marketing → Invitations. Once they sign up and claim their
  handle, a third row appears in Marketing → Verifications. Once
  approved, they show up a fourth time in Management → Influencers. An
  admin cannot see "this one person's whole journey" anywhere — only
  four disconnected lists that happen to share a handle.
- **The same yes/no decision can be made from three different buttons.**
  Approving, rejecting, or suspending a brand or creator's account can
  be done from `/admin/approvals` (the dedicated queue), from an inline
  approve/reject/suspend popup inside the Brands directory list, and
  from a standalone approve/reject/suspend button on a creator's own
  detail page. These three places do not always agree with each other —
  there's already a code comment in `admin/brands/page.js` recording a
  real bug this caused: a suspended or rejected brand had no button,
  anywhere, that put them back to approved.

**Goal:** regroup the nav around the actual pipeline stage (Lead →
Invited/Requested → Pending Verification → Live) instead of around
which internal system produced the row, and make each yes/no decision
have exactly one place it can be made.

**Role:** admin only (all four admin capability tiers — superadmin,
reviewer, finance, marketing — see gating notes below).

## Scope

**In scope**
- Sidebar nav regroup in `Packages/brand-web/app/admin/layout.js`'s
  `NAV` array — new **PEOPLE** section, new **OUTREACH** section (see
  `03-expected-outputs.md` for the exact before/after list).
- Influencers page becomes 4 tabs: **Leads / Invited / Pending
  Verification / Live**.
- Brands page becomes 3 tabs: **Leads / Pending Verification / Live**.
- Approvals nav item becomes a lightweight combined "everything pending
  right now" dashboard that deep-links into the two Pending Verification
  tabs — it takes no decision itself any more.
- The "Add Lead" flow folds into the Leads tab as a button/modal instead
  of its own nav item.
- Static HTML mockups of the 4 changed screens for founder review.

**Explicitly out of scope (this contract)**
- No backend/API changes. No route changes. No React/JSX changes under
  `Packages/`. This is spec + mockup only — a later contract implements
  it.
- No change to how the *underlying* approve/reject/suspend logic works
  (which tables get written, in what order) — that's an implementation
  decision for the follow-up contract, informed by the "Data / contracts"
  section below.
- No change to Production Queue, Orders, or any of OVERVIEW / CONTENT /
  REFERRALS / FINANCE / PRICING / SETTINGS nav sections.
- No change to brand-side or creator-side (non-admin) apps.

## Surfaces touched

- App(s): **brand-web only** (`Packages/brand-web/app/admin/`) — this is
  the live admin surface (`project_admin_is_brandweb`). No mobile, no
  backend, no `admin-web`.
- Roles involved: admin (all four capability tiers). Nav visibility is
  already capability-scoped via `scopeNav()`/`cap` keys in `layout.js`;
  the regrouped PEOPLE/OUTREACH sections keep the existing `cap` values
  (`approvals`, `brands`, `influencers`, `production`, `orders`,
  `marketing`) unchanged per item, just reshuffled under new section
  headers.

## Data / contracts (for the record — no changes made in this contract)

Nothing below is modified here. This section exists so the next
(implementation) contract's impact analysis starts from a verified
inventory rather than a guess.

- **`brands`** — `status` (approved/pending/rejected/suspended),
  `business_name`, `contact_name`, `phone`, `category`, `city` (joined
  from `users`, per `project_inflx_overview` — brands have no `city`
  column of their own), `wallet_balance`, `platform_fee_pct`,
  `created_at`. Read by `admin/brands/page.js` today via
  `GET /admin/brands?status=&search=&page=`; pending rows specifically
  via `GET /admin/queue/brands`.
- **`influencers`** — `status`, `full_name`, `phone`,
  `instagram_handle`, `youtube_handle`, `city`, `inflx_followers`,
  `followers_count`, `scrape_last_run`, `youtube_scrape_last_run`,
  `youtube_subscribers`, `created_at`. Read via
  `GET /admin/influencers?status=&search=&page=`; pending rows via
  `GET /admin/queue/influencers`.
- **`creator_profiles`** — the scraped-and-claim table:
  `verification_status` (unclaimed/claimed/verified/rejected),
  `ig_handle`, `full_name`, `followers_count`, `follower_tier`,
  `youtube_handle`, `bio_email`, `bio_phone`, `profile_pic_url`,
  `claim_user_id`, `claim_user_name`, `claim_user_phone`,
  `claim_requested_at`, `rejection_reason`. Read via
  `GET /admin/creator-verifications?status=claimed|verified|rejected`;
  decided via `verifyCreator(id)` / `rejectCreator(id, reason)` /
  `resetCreator(id)`.
- **`creator_invitations`** — `ig_handle`, `full_name`, `brand_name`,
  `proposed_fee`, `brand_message`, `status`
  (pending/contacted/converted/expired/declined), `invited_at`,
  `contacted_at`, `follower_tier`, `followers_count`, `bio_email`,
  `bio_phone`. Read via
  `GET /admin/creator-invitations?status=`; actioned via
  `markInvitationContacted(id)` / `expireInvitation(id)`.
- **Unified lead/triage rows** — `target_type` (influencer/brand),
  `handle`, `name`, `city`, `category`/`sub_category`, `tier`,
  `followers_count`, `priority_score`, `outreach_status`
  (not_contacted/contacted/replied/interested/negotiating/registered/
  dead/paused), `phone`/`email`/`whatsapp`, `last_scraped_at`. Read via
  `marketingApi.listLeads({...})`; new rows created via
  `marketingApi.intakeLead(...)` (single) / `intakeLeadBulk(...)`.
- **`admin/stats`** already returns
  `pending_approvals.{brands,influencers}`, `pending_verifications`,
  `pending_invitations` — the exact counts the nav badges use today and
  the ones the new Approvals summary dashboard will combine.

**A real gap this spec surfaces, not invents:** `creator_profiles`
(verification, claimed→verified/rejected) and `influencers.status`
(pending→approved/rejected/suspended) are **two separate fields on two
separate tables today.** The brief's instruction that Pending
Verification becomes "the ONLY approve/reject action for influencers
going forward" means the implementation contract must decide how
`verifyCreator()` also resolves `influencers.status`, so the Live tab's
read-only badge (sourced from "what Pending Verification decided," per
the brief) is actually true. Flagging this now so it isn't discovered
as a surprise mid-implementation. Brands don't have this problem —
today's Approvals-queue brand half already writes straight to
`brands.status`, so Brands → Pending Verification is a direct fold, no
new merge logic needed.

**Resolution (locked with this contract):** `verifyCreator()` writes
both fields in one transaction. Verify → `creator_profiles
.verification_status = 'verified'` AND `influencers.status =
'approved'` (via `linked_influencer_id`) — this is also the only
remaining path to `'approved'`, closing the 3-way duplicate. Reject →
`creator_profiles.verification_status = 'rejected'` AND
`influencers.status = 'rejected'`, same `rejection_reason` mirrored to
both rows — a rejected identity check means the account doesn't go
live, it isn't left dangling in `'pending'`. If a conflict-cluster
verify auto-rejects sibling `creator_profiles` rows (per existing
behaviour), those siblings have no `linked_influencer_id` of their own
to touch, so only the winning row's influencer status changes.

## Non-functional

- **Auth/role gates:** unchanged. `canAction` (reviewer/superadmin) and
  `canFee` (finance/superadmin) checks currently gating the
  approve/reject/suspend/fee buttons carry over unchanged to whichever
  tab now hosts that action.
- **Failure modes to preserve:** empty-queue state ("queue is empty"),
  loading state, and per-row error surfacing (e.g. reject requires a
  reason) all exist today per-page and must be preserved per-tab —
  nothing about tabbing changes what happens when an API call fails.
- **This contract's own failure mode:** if the founder doesn't agree
  with the Approvals-dashboard framing in Scope, that's an open
  question for mockup-lock, not a blocker to writing the mockups (see
  `04-preview/workflow-prediction.md` → Open questions).
