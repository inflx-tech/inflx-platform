'use strict';

/**
 * invoice.service.js — Wave 4 commit 2 of the Tax/Settlement Roadmap.
 *
 * Renders a GST tax-invoice PDF for a paid subscription invoice:
 *   - Platform = seller-of-record (identity from tax.service.getInvoiceIdentity)
 *   - Brand    = buyer
 *   - GST shown on its own line (never folded into the amount)
 *
 * Mirrors pdf.service.js (PDFKit, buffer out). Money is rendered as "Rs. …"
 * because PDFKit's built-in WinAnsi fonts cannot draw the Rupee sign (U+20B9) —
 * see the note in pdf.service.js.
 *
 * Generation is LAZY (on first download) — this service is pure rendering; the
 * caller (subscription.controller.getInvoicePdf) handles load + upload + persist.
 *
 * Contract: features/wave4-subscription-invoice-pdf/.
 */

const PDFDocument = require('pdfkit');

function fmtMoney(rupees) {
  const n = parseFloat(rupees || 0);
  return `Rs. ${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(value) {
  if (!value) return '—';
  const d = value instanceof Date ? value : new Date(value);
  if (isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function invoiceNumber(invoice, identity) {
  const prefix = (identity && identity.prefixSub) || 'INF-SUB';
  const short = String(invoice.id || '').replace(/-/g, '').slice(0, 8).toUpperCase();
  return `${prefix}-${short}`;
}

/**
 * Render a subscription tax-invoice PDF buffer.
 *
 * @param {object} invoice  — a subscription_invoices row plus joined buyer
 *   fields: { id, tier_key, amount_inr, gst_amount_inr, total_inr,
 *             period_start, period_end, paid_at, razorpay_payment_id,
 *             brand_name, buyer_city, buyer_state }
 * @param {object} identity — tax.service.getInvoiceIdentity() result
 * @returns {Promise<Buffer>}
 */
async function renderSubscriptionInvoicePdf(invoice, identity = {}) {
  return new Promise((resolve, reject) => {
    // compress:false keeps the content stream as plain text — invoices are a
    // single small page, so the size cost is negligible, and it makes the PDF
    // greppable/auditable (and verifiable in tests without a PDF parser).
    const doc = new PDFDocument({ margin: 50, compress: false });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const amount = parseFloat(invoice.amount_inr || 0);
    const gst    = parseFloat(invoice.gst_amount_inr || 0);
    const total  = invoice.total_inr != null
      ? parseFloat(invoice.total_inr)
      : amount + gst;
    const gstPct = amount > 0 ? Math.round((gst / amount) * 100) : null;

    const sellerName = identity.businessName || 'INFLX Technologies Pvt. Ltd.';

    // ── Header ──────────────────────────────────────────────────────────────
    doc.fontSize(20).font('Helvetica-Bold').text('TAX INVOICE', { align: 'center' });
    doc.moveDown(0.3);
    doc.fontSize(10).font('Helvetica').text('INFLX Platform — inflx.in', { align: 'center' });
    doc.moveDown(1.5);

    // ── Invoice meta ──────────────────────────────────────────────────────────
    doc.fontSize(10).font('Helvetica');
    doc.text(`Invoice No:   ${invoiceNumber(invoice, identity)}`);
    doc.text(`Invoice Date: ${fmtDate(invoice.paid_at)}`);
    doc.text(`Billing Period: ${fmtDate(invoice.period_start)}  to  ${fmtDate(invoice.period_end)}`);
    doc.moveDown(1.5);

    // ── Seller (platform) ──────────────────────────────────────────────────────
    doc.fontSize(13).font('Helvetica-Bold').text('SELLER');
    doc.moveDown(0.3);
    doc.fontSize(10).font('Helvetica');
    doc.text(sellerName);
    if (identity.address)   doc.text(identity.address);
    if (identity.gstin)     doc.text(`GSTIN: ${identity.gstin}`);
    if (identity.stateCode) doc.text(`State Code: ${identity.stateCode}`);
    doc.moveDown(1.2);

    // ── Buyer (brand) ──────────────────────────────────────────────────────────
    doc.fontSize(13).font('Helvetica-Bold').text('BILL TO');
    doc.moveDown(0.3);
    doc.fontSize(10).font('Helvetica');
    doc.text(invoice.brand_name || 'Brand');
    const buyerLoc = [invoice.buyer_city, invoice.buyer_state].filter(Boolean).join(', ');
    if (buyerLoc) doc.text(buyerLoc);
    doc.moveDown(1.5);

    // ── Line item ──────────────────────────────────────────────────────────────
    doc.fontSize(13).font('Helvetica-Bold').text('DETAILS');
    doc.moveDown(0.3);
    doc.fontSize(10).font('Helvetica');
    const tier = String(invoice.tier_key || 'subscription').toUpperCase();
    doc.text(`Plan:               ${tier} subscription`);
    doc.text(`Amount (excl GST):  ${fmtMoney(amount)}`);
    doc.text(`GST${gstPct != null ? ` (${gstPct}%)` : ''}:           ${fmtMoney(gst)}`);
    doc.moveDown(0.3);
    doc.font('Helvetica-Bold').text(`Total:              ${fmtMoney(total)}`);
    doc.moveDown(0.3);
    doc.fontSize(9).font('Helvetica');
    if (invoice.razorpay_payment_id) {
      doc.text(`Payment Ref: ${invoice.razorpay_payment_id}`);
    }
    doc.text('Status: PAID');
    doc.moveDown(2);

    // ── Footer ─────────────────────────────────────────────────────────────────
    doc.fontSize(8).fillColor('#888888');
    doc.text(
      'This is a system-generated tax invoice and does not require a signature.',
      { align: 'center' }
    );
    doc.moveDown(0.3);
    doc.fillColor('#333333').text(
      `Invoice ID: ${invoice.id} | Generated ${new Date().toLocaleDateString('en-IN')} | INFLX Platform — inflx.in`,
      { align: 'center' }
    );

    doc.end();
  });
}

module.exports = { renderSubscriptionInvoicePdf, invoiceNumber, fmtMoney };
