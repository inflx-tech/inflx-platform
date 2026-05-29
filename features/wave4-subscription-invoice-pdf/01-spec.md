# wave4-subscription-invoice-pdf — Wave 4 commit 2

> A downloadable GST tax-invoice PDF for each paid subscription invoice:
> platform as seller-of-record, brand as buyer, GST shown as a separate line.
> Generated lazily on first download, stored to R2, served via the proven
> `download_token` browser pattern. No schema change (the
> `subscription_invoices.invoice_pdf_r2_key` column already exists), no money
> movement, no change to any live charging path.

## What ships

### `invoice.service.renderSubscriptionInvoicePdf(invoice, identity)` (new)
PDFKit renderer (mirrors `pdf.service.js`). Produces a single-page tax invoice:
- **Seller** = platform identity from `tax.service.getInvoiceIdentity()`
  (business name, address, GSTIN, state code) — falls back to "INFLX" labels
  when payment_config identity fields are unset.
- **Buyer** = the brand (business/brand name + the brand owner's city/state).
- **Invoice no.** = `${identity.prefixSub}-${invoice.id.slice(0,8).toUpperCase()}`
  (deterministic, derived from the invoice id — no new sequence column).
- **Line items** = the subscription tier + period; **amount (excl GST)**, the
  **GST line shown separately** (`gst_amount_inr`), and the **total**
  (`total_inr`).
- Money rendered as `Rs. …` (PDFKit built-in fonts can't render `₹`, per the
  note in `pdf.service.js`).

### Backend endpoint
`GET /v1/brands/me/billing/invoices/:id/pdf` — brand-scoped, `paid` invoices only.
- Auth via `authenticateWithQuery` (accepts `?download_token=<jwt>`) + `requireRole('brand')`,
  so a browser tab / `<a>` can fetch the binary without an Authorization header
  (the exact mechanism the contract-PDF route uses).
- Loads the invoice scoped to the caller's brand → 404 if not theirs / missing.
- Non-`paid` invoice → 409 VALIDATION (a tax invoice is only for a completed charge).
- **Lazy generation:** if `invoice_pdf_r2_key` is null, render + `uploadPDF(buffer,
  filename, { keyPrefix: 'invoices' })` + persist the key (best-effort UPDATE).
- Streams the PDF buffer (`Content-Type: application/pdf`, `inline` disposition) —
  uniform across mock + prod, like the contract `/pdf` route.

### `storage.service.uploadPDF` extension
Add an optional `{ keyPrefix = 'contracts' }` argument so invoices store under
`invoices/…` instead of `contracts/…`. Additive, backward compatible (existing
callers unchanged).

### Brand UI
`/dashboard/settings/billing` — a "Download" link in the invoice table, shown only
for `paid` rows, pointing at `brandApi.invoicePdfUrl(id)` (mirrors `contractApi.pdfUrl`).

## Why lazy (design decision)
There are SIX sites that create `subscription_invoices` rows (renewal job, three
webhook paths, two mock-controller paths). Generating the PDF at each creation
site would touch live money paths (incl. the Razorpay webhook) for a non-critical
document. Lazy on-first-download keeps every charging path untouched and is fully
additive — the PDF is just-in-time and cached on the row after the first request.

## Verify-twice (done)
- `subscription_invoices.invoice_pdf_r2_key text` EXISTS (M058) — no migration.
- `tax.service.getInvoiceIdentity()` returns `{ gstin, businessName, address,
  stateCode, prefixSub, prefixCom }`.
- `storage.service.uploadPDF` returns an object KEY; `getPdfDownloadUrl` presigns
  (null in mock). `pdfkit` is a backend dep; `pdf.service.js` is the render precedent.
- `authenticateWithQuery` reads `?download_token=` (auth.js) — the proven
  browser-download mechanism (contract `/pdf`, brand-web `contractApi.pdfUrl`).
- `GET /me/billing/invoices` → `subCtrl.listInvoices` already returns
  `invoice_pdf_r2_key`; the billing page already lists invoices.

## Out of scope (later Wave 4 commit)
- Commerce invoice PDFs (brand as seller-of-record) — likely needs M078.

## Files
- `backend/src/services/invoice.service.js` (new)
- `backend/src/services/storage.service.js` (uploadPDF keyPrefix)
- `backend/src/controllers/subscription.controller.js` (getInvoicePdf + export)
- `backend/src/routes/brand.routes.js` (new route)
- `Packages/brand-web/lib/api.js` (invoicePdfUrl)
- `Packages/brand-web/app/dashboard/settings/billing/page.js` (Download link)
- `backend/tests/invoice-pdf.test.js` (new)
- This contract.

## Non-functional
- Deploy posture: **PRODUCTION-IMPACTING, NO migration**. Render + Vercel redeploy.
  No mobile change (no OTA). No live charging path touched.
- `pnpm qa` GREEN. Boot smoke clean. `invoice-pdf.test.js` green.
