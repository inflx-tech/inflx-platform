# Diff notes — referral-admin-controls (Contract 2)

## What was implemented
A new **Referrals** section in admin-web (3 routes, built static:
`/dashboard/referrals/settings`, `/relationships`, `/earnings`) backed by a new
admin API at `/admin/referrals/*` (`referralAdmin.controller.js` +
`referralAdmin.routes.js`, mounted in `routes/index.js`) and migration
`079_referral_settings.sql` (single-row global `default_pct`, seeded 25.00).
The pages call the new `referralApi` namespace in `lib/api.js`; the nav section
is registered in `app/dashboard/layout.js`. Edge creation routes through the
Contract-1 `referral.service.createEdge` (guards/dedup reused). Backend jest
13/13 green; admin-web `next build` compiled all 3 routes.

## What matches the locked mockup
- `01-settings.html` — matches: "🛠️ Referral Settings" header + subcopy; the
  big bordered **default %** input with `%` suffix; the override helper line;
  the two fixed-fact boxes (12-month window 🔒 / "platform slice only"); the
  "Last changed …" footer + gold **Save**; success toast; the superadmin-only
  role note (Save hidden + field disabled for non-superadmin).
- `02-relationships.html` — matches: "🤝 Referral Relationships" header +
  CTA; status filter chips (All/Active/Ended/Expired) + search; the edges table
  (Referrer → Referred with type tags, %, Started, Expires, Status badge,
  Source) with per-row **Edit %** / **End** for active rows; the **Create link**
  modal (referrer/referred type selectors, % defaulting note, 12-month hint);
  superadmin-only gating of create/edit/end.
- `03-earnings.html` — matches: "💰 Referral Earnings" header; the three
  summary stat cards (Total accrued / Paid / Pending); source+payout filter
  chips; the ledger table (Date, Referrer w/ tag, Referred, Source pill, Base,
  %, Amount, Payout badge); the "influencer auto-paid / agency pending" note;
  the empty-state placeholder (💸 "No referral earnings yet").

## What diverged from the mockup (and why)
- **Create-link modal: entity selection is an ID text field, not a populated
  dropdown.** The mockup showed illustrative dropdowns of named influencers /
  brands. There is no admin "entity picker" endpoint yet (listing all
  influencers/brands for a searchable select is its own feature), so for this
  contract the superadmin pastes the influencer/brand **ID** (copied from the
  Influencers / Brands admin pages) next to a type selector. Functionally
  identical for manual creation; a named picker can be a later polish. Reason:
  avoids scope creep into entity-search endpoints; keeps Contract 2 to config +
  manage + audit. Flagged here rather than shipped silently.
- **Edit % / End use a prompt / confirm dialog** rather than a bespoke inline
  editor. Lightweight + adequate for an internal superadmin tool; the API
  contract (PATCH pct / status) is unchanged.

## Things the founder should specifically check
- **Empty state** (the real prod state today): with the engine dormant, all
  three pages should render cleanly — Settings shows 25.00, Relationships shows
  "No referral links yet", Earnings shows ₹0 totals + the 💸 placeholder.
- **Role behaviour**: log in as a non-superadmin (reviewer/finance) — Settings
  field disabled + Save hidden, no Create/Edit/End on Relationships; the API
  also returns 403 on any write (defense in depth).
- **Create guards**: creating a second active link for an entity that already
  has one returns a friendly "already has an active referrer" (409), not a
  crash; self/circular returns a validation error inline.

## Out-of-band changes
- None. Shared-file edits (`layout.js`, `lib/api.js`, `routes/index.js`) are
  additive and staged by explicit path. No adjacent bug fixes were needed.

## After-shots
- "Before" = the three locked mockups in `04-preview/mockups/`.
- "After" = real admin-web routes captured against the deployed Vercel
  admin-web post-release (added at deploy verification; the routes require an
  authenticated admin session, so they are shot from the running app rather
  than a static render).
