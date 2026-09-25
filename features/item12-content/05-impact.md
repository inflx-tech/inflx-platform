# item12-content — impact

**Production-impacting.** Backend (Render), brand website + admin (Vercel), phone apps (OTA,
native runtime unchanged at `'3'`), migration 192. Explicit go required before migrate, push or OTA.

## What changes for people
- **Brands (website):** the content review panel, the inbox "Content reviews" tab, the CommandRail
  "Review N deliverables" action and the Store Visit "Mark visit done" button become read-only
  cards pointing to the app. Nothing on the website can approve content or release money.
- **Brands (app):** a content screen after the shoot: review, ask for changes, confirm live, report.
- **Creators (app):** a content screen after the shoot: upload, send, make changes, post and prove,
  see both payments and the date of the last one, report brand silence.
- **Admin:** two new numbers and the moved waiting period on Platform settings; the Payments page
  shows the waiting period read-only; the manual escrow release needs a reason and refuses disputed
  and refunded rows.

## Money
Two releases only: the second 25% of her fee at the brand's confirmation, the final 50% by job at
the stamped date. Both through item 9's `processTrancheRelease`, unchanged. Nothing deducted. The
legacy door that could release them unguarded is closed first.

## Data
Migration 192 is additive: six new tables, one nullable column on `escrow_entries`, a widened
Delayed CHECK, three `platform_settings` rows (the waiting period copied from `payment_config`), an
admin escrow-release audit table. No backfill. Legacy `deliverables` rows and
`contracts.revision_limit` are left in place and unread by the new flow.

## Risk
- A 200 MB upload from a phone — proved on a device before any screen (2b).
- Videos open in the phone's own player through a signed URL; no in-app player until the next APK.
- The tranche-3 job changes its selection: rows without a stamped due keep the old rule; no
  production row is queued today.
