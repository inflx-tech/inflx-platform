# 05-impact — wave4-subscription-invoice-pdf

**Verdict: additive + zero functional disturbance to money paths. A new render
service, one brand-scoped read-mostly endpoint, a one-line optional arg on the
storage util, and a "Download" link on an existing table. No schema, no change to
any subscription-charging flow.**

## Mechanics
- The PDF is generated **lazily on first download**, NOT at invoice-creation time,
  so none of the six `subscription_invoices` insert sites (renewal job, three
  webhook paths, two mock-controller paths) are touched. The live Razorpay
  webhook is untouched.
- The only write is an idempotent best-effort backfill of `invoice_pdf_r2_key`
  the first time a brand downloads; a failed UPDATE does not break the download.
- Brand-scoped + `paid`-only + auth-gated (`authenticateWithQuery` +
  `requireRole('brand')`), so a brand can only ever fetch its own paid invoices.
- `uploadPDF` gains an optional `keyPrefix` (default `'contracts'`) — existing
  callers behave identically.

## Regression
`pnpm qa` GREEN (no workflow drives this download). Boot smoke clean.
`invoice-pdf.test.js` green (service renders a `%PDF` buffer containing brand +
GST; endpoint streams 200 for own paid invoice, 404 for another brand's, 409 for
non-paid). brand-web build compiles.

## Deploy posture
PRODUCTION-IMPACTING, NO migration. Render (backend) + Vercel (brand-web) redeploy.
No mobile change → no OTA. Because Window B carries any commit on shared `main` to
prod on its next push, this is surfaced for explicit founder go before commit.
