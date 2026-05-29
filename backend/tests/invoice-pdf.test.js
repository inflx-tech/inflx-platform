'use strict';

/**
 * invoice-pdf.test.js — Wave 4 commit 2 (subscription invoice PDF).
 *
 * Covers:
 *   • invoice.service.renderSubscriptionInvoicePdf — pure render (no DB)
 *   • GET /v1/brands/me/billing/invoices/:id/pdf
 *       - 200 + application/pdf for the caller's own PAID invoice (+ lazy
 *         backfill of invoice_pdf_r2_key)
 *       - 404 for another brand's invoice
 *       - 409 for a non-paid invoice
 */

const request = require('supertest');
const app = require('../src/app');
const { truncateAll, query } = require('./helpers/db');
const { createBrandUser, registerBrand } = require('./helpers/factories');
const invoiceService = require('../src/services/invoice.service');

/**
 * PDFKit writes visible text as hex-encoded glyph strings inside TJ arrays,
 * e.g. `[<54> 90 <415820494e56> 50 <4f494345>] TJ` → "T"+"AX INV"+"OICE".
 * The kerning offsets sit OUTSIDE the angle brackets, so concatenating every
 * <hex> token's decoded bytes reconstructs the rendered text contiguously.
 * (renderSubscriptionInvoicePdf uses compress:false so the stream is plain.)
 */
function decodePdfText(buf) {
  const raw = buf.toString('latin1');
  let out = '';
  const re = /<([0-9A-Fa-f]+)>/g;
  let m;
  while ((m = re.exec(raw)) !== null) {
    const hex = m[1];
    if (hex.length % 2 !== 0) continue;            // skip non-glyph hex (e.g. /ID)
    out += Buffer.from(hex, 'hex').toString('latin1');
  }
  return out;
}

beforeEach(async () => {
  await truncateAll();
  // truncateAll's users-CASCADE clears subscription_tiers — re-seed (canonical reset).
  await query(`DELETE FROM subscription_tiers`);
  await query(
    `INSERT INTO subscription_tiers
       (tier_key, name, monthly_price_inr, max_campaigns, max_sets_per_campaign, max_influencers_per_cycle, max_products, is_enterprise, sort_order)
     VALUES
       ('free',       'Free',           0.00,  1,  1,   5,  10, false, 1),
       ('growth',     'Growth',      2499.00,  3,  3,  25, 100, false, 2),
       ('pro',        'Pro',         9999.00, 10, 10, 100, 500, false, 3),
       ('enterprise', 'Enterprise', 29999.00, -1, -1,  -1,  -1, true,  4)`
  );
});

describe('invoice.service.renderSubscriptionInvoicePdf (pure)', () => {
  test('renders a PDF buffer containing the brand name + GST line', async () => {
    const inv = {
      id: '11111111-2222-3333-4444-555555555555', tier_key: 'growth',
      amount_inr: 2499, gst_amount_inr: 449.82, total_inr: 2948.82,
      period_start: '2026-05-01', period_end: '2026-05-31', paid_at: '2026-05-15',
      razorpay_payment_id: 'pay_mock_123',
      brand_name: 'Aveen Food Paradise', buyer_city: 'Hyderabad', buyer_state: 'Telangana',
    };
    const identity = {
      gstin: '36ABCDE1234F1Z5', businessName: 'INFLX Technologies Pvt. Ltd.',
      address: 'Hyderabad, India', stateCode: '36', prefixSub: 'INF-SUB',
    };
    const buf = await invoiceService.renderSubscriptionInvoicePdf(inv, identity);
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.slice(0, 5).toString('latin1')).toBe('%PDF-');
    const txt = decodePdfText(buf);
    expect(txt).toContain('TAX INVOICE');
    expect(txt).toContain('Aveen Food Paradise');   // buyer (brand) name
    expect(txt).toContain('GST');                    // GST shown on its own line
    expect(invoiceService.invoiceNumber(inv, identity)).toBe('INF-SUB-11111111');
  });

  test('renders with empty identity (fallback) + zero amount', async () => {
    const buf = await invoiceService.renderSubscriptionInvoicePdf(
      { id: 'abc-def', tier_key: 'free', amount_inr: 0, gst_amount_inr: 0, total_inr: 0 }, {});
    expect(buf.slice(0, 5).toString('latin1')).toBe('%PDF-');
    expect(invoiceService.invoiceNumber({ id: 'abc-def' }, {})).toBe('INF-SUB-ABCDEF');
  });
});

describe('GET /v1/brands/me/billing/invoices/:id/pdf', () => {
  async function paidInvoiceFor(token) {
    const br = await registerBrand(token);
    await request(app)
      .post('/v1/brands/me/subscription/upgrade')
      .set('Authorization', `Bearer ${token}`)
      .send({ tier_key: 'growth' })
      .expect(201);
    const { rows } = await query(
      `SELECT id FROM subscription_invoices WHERE brand_id = $1 AND status = 'paid' LIMIT 1`,
      [br.id]
    );
    return { brandId: br.id, invoiceId: rows[0].id };
  }

  test('200 + application/pdf for own paid invoice, and backfills the R2 key', async () => {
    const u = await createBrandUser();
    const { invoiceId } = await paidInvoiceFor(u.token);

    const res = await request(app)
      .get(`/v1/brands/me/billing/invoices/${invoiceId}/pdf`)
      .set('Authorization', `Bearer ${u.token}`);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/application\/pdf/);
    expect(res.body.slice(0, 5).toString('latin1')).toBe('%PDF-');

    const { rows } = await query(
      `SELECT invoice_pdf_r2_key FROM subscription_invoices WHERE id = $1`,
      [invoiceId]
    );
    expect(rows[0].invoice_pdf_r2_key).toMatch(/^invoices\//);
  });

  test('404 when fetching another brand\'s invoice', async () => {
    const owner = await createBrandUser();
    const { invoiceId } = await paidInvoiceFor(owner.token);

    const other = await createBrandUser();
    await registerBrand(other.token);

    const res = await request(app)
      .get(`/v1/brands/me/billing/invoices/${invoiceId}/pdf`)
      .set('Authorization', `Bearer ${other.token}`);
    expect(res.status).toBe(404);
  });

  test('409 for a non-paid invoice', async () => {
    const u = await createBrandUser();
    const br = await registerBrand(u.token);
    // brand registration already creates an active brand_subscription (free
    // tier); the partial-unique index forbids a second active row, so reuse
    // the existing one as the FK parent for the pending invoice.
    const { rows: sub } = await query(
      `SELECT id FROM brand_subscriptions WHERE brand_id = $1 ORDER BY created_at LIMIT 1`,
      [br.id]
    );
    const { rows: inv } = await query(
      `INSERT INTO subscription_invoices
         (brand_subscription_id, brand_id, tier_key, amount_inr, gst_amount_inr,
          period_start, period_end, status)
       VALUES ($1, $2, 'growth', 2499, 449.82, current_date, current_date + 30, 'pending')
       RETURNING id`,
      [sub[0].id, br.id]
    );

    const res = await request(app)
      .get(`/v1/brands/me/billing/invoices/${inv[0].id}/pdf`)
      .set('Authorization', `Bearer ${u.token}`);
    expect(res.status).toBe(409);
  });
});
