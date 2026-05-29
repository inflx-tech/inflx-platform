# 06-diff — wave4-subscription-invoice-pdf (Wave 4 commit 2)

**Before:** Paid subscription invoices existed as DB rows and were listed on
`/dashboard/settings/billing`, but there was no actual tax-invoice document. The
`subscription_invoices.invoice_pdf_r2_key` column had shipped (M058) but was never
wired — a brand could see an invoice line but could not download a GST invoice for
its records or filing.

**After:**

*New `invoice.service.renderSubscriptionInvoicePdf(invoice, identity)`* renders a
single-page GST tax invoice with PDFKit: platform as seller-of-record (identity
from `tax.service.getInvoiceIdentity()` with INFLX fallbacks), the brand as buyer,
a deterministic invoice number (`INF-SUB-<id8>`), the tier/period line, and the
amount / GST / total with **GST on its own line**. Money is rendered as `Rs. …`
because PDFKit's built-in fonts can't draw `₹` (same convention as the contract PDF).

*New `GET /v1/brands/me/billing/invoices/:id/pdf`* (brand-scoped, paid-only,
`authenticateWithQuery` + `requireRole('brand')`) generates the PDF lazily on the
first request, stores the key under `invoices/` (extended `storage.uploadPDF` with
an optional `keyPrefix`), and streams it. Re-downloads re-stream.

*Brand UI:* a "Download" link now appears on each **paid** row of the existing
billing table, using `brandApi.invoicePdfUrl(id)` — the same `?download_token=`
browser mechanism already proven by the contract-PDF download.

**Reuse-existing-styling:** the only UI change is one extra cell/link inside the
existing billing table; no new design language, tokens, or layout — hence
`mockup_locked` is set with that justification rather than authoring new HTML
mockups (same approach as the wave4-tax-summary-report contract).

**Design choice — lazy generation:** six code sites create invoice rows (incl. the
live Razorpay webhook); generating at each would put a non-critical PDF in the
money path. Lazy on-first-download leaves every charging path untouched.

**Verified locally:** boot smoke clean; `invoice-pdf.test.js` green (service emits
a `%PDF` buffer containing the brand name + GST line; endpoint returns 200 for the
caller's own paid invoice, 404 for another brand's, 409 for a non-paid invoice);
brand-web build compiles; `pnpm qa` GREEN.
