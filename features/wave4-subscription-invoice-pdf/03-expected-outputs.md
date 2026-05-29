# 03-expected-outputs — wave4-subscription-invoice-pdf

## GET /v1/brands/me/billing/invoices/:id/pdf  (paid invoice, own brand)
- `200 OK`, `Content-Type: application/pdf`, body starts with `%PDF-`.
- `Content-Disposition: inline; filename="invoice_<id>.pdf"`.
- First call backfills `subscription_invoices.invoice_pdf_r2_key` (key under
  `invoices/`); subsequent calls re-stream.

PDF content (worked example from the test — a paid Growth invoice):
- Seller: platform identity (business name / address / `GSTIN: …` / state) or the
  "INFLX" fallbacks when identity is unset.
- Buyer: the brand business name + the brand owner's city/state.
- `Invoice No: INF-SUB-XXXXXXXX`, period start → end, paid date.
- `Plan: GROWTH (monthly)`, `Amount (excl GST): Rs. 2,499.00`,
  `GST (18%): Rs. 449.82`, `Total: Rs. 2,948.82`.

## Error / edge behaviour
- Invoice belongs to another brand, or unknown id → `404 NOT_FOUND`.
- Invoice `status !== 'paid'` (pending/failed) → `409 VALIDATION_ERROR`
  (field `status`).
- No / invalid `download_token` and no Bearer → `401 UNAUTHORIZED`.
- Non-brand JWT → `403 FORBIDDEN`.

## invoice.service.renderSubscriptionInvoicePdf(invoice, identity)
- Returns a `Buffer` whose first bytes are `%PDF`.
- The rendered text includes the brand/seller names, the tier, and the GST
  amount as a distinct line.

## Invariant
No write to any charging path. The single side effect is the idempotent
`invoice_pdf_r2_key` backfill (only when previously null). GST is always shown as
its own line, never folded into the amount.
