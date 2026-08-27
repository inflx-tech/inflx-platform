# Workflow prediction — admin-people-pipeline

Before any code: what will this feature *do*, end to end? Discuss with
the founder, then lock alongside the mockups. This contract's "code" is
the mockups themselves — there is no backend/frontend change yet — so
this prediction is scoped to what happens when the founder (or an
admin, later) clicks through the 4 mockup files, and what the follow-up
implementation contract will need to make real.

## Trigger

The founder opens each mockup in `mockups/` (via `pnpm preview:open
admin-people-pipeline` once machinery is run, or directly in a browser)
and clicks through the controls that are wired up: nav rows, tabs,
status filter chips, row action buttons.

## Steps

1. `sidebar-nav.html` loads → founder sees the full admin sidebar with
   the new **PEOPLE** section (Approvals, Influencers, Brands,
   Production Queue, Orders) and **OUTREACH** section (Inbox, Funnel,
   Settings), with every other section (OVERVIEW, CONTENT, REFERRALS,
   FINANCE, PRICING, SETTINGS) rendered exactly as today, unchanged.
2. Founder opens `influencers-tabbed.html` → **Leads** tab is active by
   default, populated with representative scraped-creator rows,
   priority-score sorted, channel dots showing which have phone/email/
   WhatsApp on file → founder clicks **Invited**, **Pending
   Verification**, **Live** → each tab swaps its table/card content
   in place (client-side tab switch, no page reload in the mockup).
3. On **Pending Verification**, founder sees one plain card and one
   **⚠ CONFLICT — 2 candidates** card with an orange border, matching
   the real `ClusterCard` conflict-cluster behavior described in
   `02-workflow.md` scenario (b).
4. Founder opens `brands-tabbed.html` → same shape, 3 tabs (**Leads /
   Pending Verification / Live**), founder confirms no Invited tab
   exists here (brands aren't campaign-invited).
5. Founder opens `approvals-summary.html` → sees 3–4 count tiles
   (pending brand approvals, pending influencer verifications, pending
   invitations) and two "Review →" buttons that would deep-link into
   the two Pending Verification tabs — founder confirms there is no
   approve/reject button anywhere on this page.

## End state

- Founder has seen all 4 changed screens with realistic data and can
  say "yes, lock this" or ask for specific changes before any app code
  is touched.
- `lock.json` stays `mockup_locked: false` until the founder (or their
  delegate) explicitly reviews and flips it — this task does not do
  that.

## Edge cases

- **What if the founder wants the Approvals nav item removed
  entirely** instead of kept as a summary dashboard? Flagged as the one
  open design choice below — the mockup shows the "keep as summary"
  option since that was the brief's recommendation, but it's the
  single easiest thing to cut if the founder disagrees.
- **What if a tab has zero rows** (e.g., no conflict clusters today)?
  Not shown in these mockups per the "never lorem ipsum, never empty
  states as primary content" rule — the real implementation must still
  carry over each source page's existing empty-state copy (e.g. "Queue
  is empty", "No new invitations").
- **What if an admin lacks the `marketing` or `brands`/`influencers`
  capability?** Nav item doesn't render at all (existing `scopeNav()`
  behavior, unchanged) — not depicted in a static mockup, called out
  here for completeness.
- **What if the API split behind Leads/Invited/Pending
  Verification/Live doesn't cleanly match one tab to one endpoint** at
  implementation time (e.g. the merge gap on influencer verification →
  approval noted in `01-spec.md`)? That's explicitly deferred to the
  implementation contract's impact analysis; these mockups only lock
  the *visual/IA* shape, not the wiring.

## What changes vs current behaviour

- **Today:** 12 nav rows across MANAGEMENT + MARKETING; the same
  approve/reject/suspend decision reachable from 3 different screens;
  no single screen shows "everyone pending a decision right now."
- **After (once implemented from these mockups):** 8 nav rows across
  PEOPLE + OUTREACH; exactly one approve/reject surface per entity type
  (Influencers → Pending Verification, Brands → Pending Verification);
  Approvals becomes a read-only combined dashboard.
- **Files touched (preview, for the follow-up contract):**
  `Packages/brand-web/app/admin/layout.js` (NAV array),
  `Packages/brand-web/app/admin/influencers/page.js` (becomes tabbed
  shell wrapping Leads/Invited/Pending Verification/Live),
  `Packages/brand-web/app/admin/brands/page.js` (becomes tabbed shell,
  3 tabs), `Packages/brand-web/app/admin/approvals/page.js` (becomes
  summary-only), `Packages/brand-web/app/admin/influencers/[id]/page.js`
  (approve/reject/suspend action removed, status made read-only),
  `Packages/brand-web/app/admin/marketing/{leads,verifications,
  invitations,add}/page.js` (content absorbed into the tabs above;
  these standalone routes are retired or become internal to the tab
  components — implementation contract decides which).

## Blast radius

- **Production-impacting? NOT for this contract.** This contract is
  spec + static mockup HTML only — nothing under `Packages/*/(src|app|
  components|lib|screens|services)/` is touched. `git push` on this
  contract's changes is deploy-inert (docs + `features/**` only).
- The **follow-up implementation contract** will be production-
  impacting (Vercel redeploys brand-web) — flagged here so it isn't a
  surprise when that contract lands.
- **Rollback path:** N/A this contract (no runtime change). For the
  follow-up: revert the nav/page changes; old routes can stay mounted
  as redirects during a transition window if the founder wants a soft
  cutover.
- **Affected users:** admin role only, all four capability tiers see a
  reshuffled (not reduced-capability) nav.

## Open questions (clear before lock)

- **Approvals nav item — keep as a summary dashboard, or remove
  entirely?** The brief recommends keeping it as a lightweight
  cross-entity summary (total pending count, two deep-links, no
  action buttons) since admins may want one glance at total pending
  volume. `approvals-summary.html` mocks that recommendation. If the
  founder would rather admins just check the two Pending Verification
  tab badges directly, this screen and nav item can be cut with no
  loss of capability elsewhere — flag at mockup-lock review.
- **Influencer verify/approve merge** (the two-table gap in
  `01-spec.md`) — not a mockup-visible question (both tables produce
  the same visual "Verify"/"Reject" buttons either way) but the founder
  should know the follow-up contract carries this real backend
  decision, not just a UI reshuffle.
