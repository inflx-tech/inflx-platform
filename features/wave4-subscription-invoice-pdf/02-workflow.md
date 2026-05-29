# 02-workflow — wave4-subscription-invoice-pdf

1. Brand opens `/dashboard/settings/billing` → existing invoice list loads via
   `GET /me/billing/invoices`.
2. For each `paid` invoice the table now shows a "Download" link →
   `${API_BASE}/brands/me/billing/invoices/:id/pdf?download_token=<jwt>`.
3. The browser opens that URL in a new tab. `authenticateWithQuery` validates the
   `download_token`; `requireRole('brand')` confirms the caller is a brand.
4. `getInvoicePdf`:
   - resolves the caller's `brand_id`; loads the invoice by id **scoped to that
     brand** (join brands + users for buyer name/city/state) → 404 if not found.
   - if `status !== 'paid'` → 409 VALIDATION ("Invoice is not paid yet").
   - if `invoice_pdf_r2_key` is null → render the PDF buffer, `uploadPDF(buffer,
     'invoice_<id>.pdf', { keyPrefix:'invoices' })`, persist the returned key
     (best-effort; a failed UPDATE does not block the download).
   - streams the buffer: `Content-Type: application/pdf`, `Content-Disposition:
     inline; filename="invoice_<id>.pdf"`, `Cache-Control: private`.
5. The PDF renders: platform seller block, brand buyer block, invoice no. + dates,
   tier/period line, amount, GST (separate line), total.

## Notes
- Read-only to all money/charging paths. The only write is the best-effort
  `invoice_pdf_r2_key` backfill on first download.
- Mock mode: `uploadPDF` saves locally and returns a key; the stream still serves
  the freshly rendered buffer, so the download works without R2.
- Re-download: key already set → re-render + stream (cheap, single page). Prod
  keeps the stored key for any future presign use.
