'use strict';

/**
 * Item 11, Phase 2c — the Remote flow, end to end.
 * Contract: features/item11-remote · rules v1.27 §11.2 · checks 4–15, 20–29, 44–46, 50, 53–56
 *
 * Everything goes through the real API and the real shipping layer. Courier events arrive the
 * way Admin's Test parcels page sends them — through the SAME webhook a real provider will
 * reach — so the notifications, the wallet rows, the return clock and the Delayed flag are all
 * exercised by the machinery that will run in production.
 */

const { query, api, brand, creator } = require('./helpers/item3');
const { createAdminUser } = require('./helpers/factories');
const w10 = require('./helpers/item10');
const env = require('../src/config/env');
const { todayInIndia, addDays } = require('../src/utils/indiaDay');
const { MSG } = require('../src/services/productionCopy');

/* ─────────────────────────────────────────────────────── fixtures */

/** A signed Remote collaboration with a funded wallet, products, and her profile city set. */
async function world(goal = 'conversion', over = {}) {
  const w = await w10.signedByBoth(goal, { mode: 'shipment', wallet: 500000, ...over });
  // Her profile state and city — R3 pre-fills from these.
  const { rows: [city] } = await query(`SELECT id, state_id FROM ref_cities WHERE name = 'Guntur' LIMIT 1`);
  await query(`UPDATE influencers SET city_id = $2, state_id = $3 WHERE id = $1`,
    [w.cr.influencerId, city.id, city.state_id]);
  w.city = city;
  return w;
}

async function product(brandId, name = 'Indigo Chanderi Saree', price = 2400) {
  const { rows: [p] } = await query(
    `INSERT INTO brand_products (brand_id, name, price, sku, is_active, pushed_to_store)
     VALUES ($1, $2, $3, $4, true, true) RETURNING *`,
    [brandId, name, price, `SKU-${Math.random().toString(36).slice(2, 8).toUpperCase()}`]);
  // creator-terms-v2: her products are frozen when the invitation is sent; this one counts as
  // listed before it (tests/helpers/sell.js).
  await require('./helpers/sell').listedBeforeSending(brandId, p.id);
  return p;
}

const B = (w) => `${w.url}/invitations/${w.ciId}/remote`;
const C = (w) => `/influencers/me/invitations/${w.ciId}/remote`;

const ADDRESS = (w, over = {}) => ({
  name: 'Tanvi Suresh', phone: '9876511111',
  street: '11 Gandhi Road, Brodipet', pincode: '522002',
  stateId: w.city.state_id, cityId: w.city.id,
  note: 'Ring the bell twice', sizes: 'Top M, Bottom 28, Shoe 6',
  ...over,
});

/** Send her address and return the read. */
async function sendAddress(w, over = {}) {
  const r = await api.post(`${C(w)}/address`, w.cr.token, ADDRESS(w, over));
  if (r.status !== 200) throw new Error(`sendAddress: ${JSON.stringify(r.body)}`);
  return r.body.data.shoot;
}

/** Pick products and book a parcel. Returns { shoot, parcelId }. */
async function bookParcel(w, lines, body = {}) {
  const save = await api.put(`${B(w)}/lines`, w.b.token, { lines });
  if (save.status !== 200) throw new Error(`saveLines: ${JSON.stringify(save.body)}`);
  const book = await api.post(`${B(w)}/book`, w.b.token, { branchId: w.br.id, boxPreset: 'medium', weightKg: 1.2, ...body });
  if (book.status !== 200) throw new Error(`book: ${JSON.stringify(book.body)}`);
  return { shoot: book.body.data.shoot, parcelId: book.body.data.shoot.parcel.id };
}

/** A courier event, the way R18 sends one. */
async function courier(shipmentId, event, extra = {}) {
  const admin = await createAdminUser();
  const r = await api.post(`/admin/test-parcels/${shipmentId}/events`, admin.token, { event, ...extra });
  if (r.status !== 200) throw new Error(`courier ${event}: ${JSON.stringify(r.body)}`);
  return r.body.data;
}

const walletOf = async (brandId) =>
  Number((await query(`SELECT wallet_balance FROM brands WHERE id = $1`, [brandId])).rows[0].wallet_balance);
const duesOf = async (brandId) =>
  (await query(`SELECT * FROM brand_dues WHERE brand_id = $1 AND settled_at IS NULL ORDER BY created_at`, [brandId])).rows;

/* ═══════════════════════════════════════════════ her address (checks 4–8) */

describe('her address (R2–R4b, checks 4–8)', () => {
  it('4 · name, number, state and city arrive pre-filled from her profile', async () => {
    const w = await world();
    const r = await api.get(C(w), w.cr.token);
    expect(r.status).toBe(200);
    expect(r.body.data.shoot.stage).toBe('not_sent');
    expect(r.body.data.shoot.prefill).toMatchObject({
      name: 'Tanvi Suresh', cityId: w.city.id, stateId: w.city.state_id,
    });
    expect(r.body.data.shoot.prefill.phone).toMatch(/^\d{10}$/);
  });

  it('5 · a pincode ending 999 cannot be sent, with the message; 998 can, and is flagged', async () => {
    const w = await world();
    const cov999 = await api.post(`${C(w)}/coverage`, w.cr.token, { pincode: '522999' });
    expect(cov999.body.data).toMatchObject({ delivers: false, returnPickup: false });
    expect(cov999.body.data.message).toBe(MSG.NOT_DELIVERABLE('522999'));

    const bad = await api.post(`${C(w)}/address`, w.cr.token, ADDRESS(w, { pincode: '522999' }));
    expect(bad.status).toBe(422);
    expect(bad.body.error.code).toBe('NOT_DELIVERABLE');
    expect(bad.body.error.message).toBe(MSG.NOT_DELIVERABLE('522999'));

    const cov998 = await api.post(`${C(w)}/coverage`, w.cr.token, { pincode: '522998' });
    expect(cov998.body.data).toMatchObject({ delivers: true, returnPickup: false });
    expect(cov998.body.data.message).toMatch(/can't collect returns/i);

    const ok = await api.post(`${C(w)}/address`, w.cr.token, ADDRESS(w, { pincode: '522998' }));
    expect(ok.status).toBe(200);
    expect(ok.body.data.shoot.address.coverage).toMatchObject({ delivers: true, returnPickup: false });
  });

  it('6 · sending locks it; a second send is refused; her profile changing changes nothing', async () => {
    const w = await world();
    await sendAddress(w);

    const again = await api.post(`${C(w)}/address`, w.cr.token, ADDRESS(w, { street: 'Somewhere else' }));
    expect(again.status).toBe(422);
    expect(again.body.error.message).toBe(MSG.ADDRESS_ALREADY_SENT(w.b.brandId ? (await query(`SELECT business_name FROM brands WHERE id=$1`, [w.brandId])).rows[0].business_name : ''));

    // §28 — a SNAPSHOT. Move her profile to another city entirely.
    const { rows: [other] } = await query(`SELECT id, state_id FROM ref_cities WHERE name = 'Kochi' LIMIT 1`);
    await query(`UPDATE influencers SET city_id = $2, state_id = $3 WHERE id = $1`, [w.cr.influencerId, other.id, other.state_id]);

    const after = await api.get(C(w), w.cr.token);
    expect(after.body.data.shoot.address.city).toBe('Guntur');
    expect(after.body.data.shoot.address.pincode).toBe('522002');
  });

  it('7 · the brand sees nothing of her address before she sends it, and another brand never does', async () => {
    const w = await world();
    const before = await api.get(B(w), w.b.token);
    expect(before.status).toBe(200);
    expect(before.body.data.shoot.address).toBeNull();
    expect(JSON.stringify(before.body)).not.toMatch(/Gandhi Road/);

    await sendAddress(w);
    const after = await api.get(B(w), w.b.token);
    expect(after.body.data.shoot.address).toMatchObject({
      street: '11 Gandhi Road, Brodipet', pincode: '522002', city: 'Guntur',
      sizes: 'Top M, Bottom 28, Shoe 6', note: 'Ring the bell twice',
    });

    // Another brand: 404, not 403 — it must not learn the collaboration exists.
    const other = await world();
    const theirs = await api.get(`${w.url}/invitations/${w.ciId}/remote`, other.b.token);
    expect(theirs.status).toBe(404);
  });

  it('7 · she never receives a branch street address', async () => {
    const w = await world();
    await sendAddress(w);
    await bookParcel(w, [{ productId: (await product(w.brandId)).id, quantity: 1, disposition: 'gift' }]);
    const hers = await api.get(C(w), w.cr.token);
    expect(hers.status).toBe(200);
    const body = JSON.stringify(hers.body);
    expect(body).not.toMatch(/Banjara Hills/);
    expect(body).not.toMatch(/500034/);
    expect(hers.body.data.shoot.parcel.from).toBeUndefined();
  });

  it('8 · she may correct it once, only after a back-to-store; a second correction is refused', async () => {
    const w = await world();
    await sendAddress(w);
    const p = await product(w.brandId);
    const { parcelId } = await bookParcel(w, [{ productId: p.id, quantity: 1, disposition: 'gift' }]);

    // Not yet — the parcel has not come back.
    const early = await api.post(`${C(w)}/address/correct`, w.cr.token, ADDRESS(w, { street: 'New street' }));
    expect(early.status).toBe(422);
    expect(early.body.error.message).toBe(MSG.CORRECTION_NOT_ALLOWED);

    await courier(parcelId, 'collected');
    await courier(parcelId, 'returned_to_store', { reason: 'Address not found' });

    const ok = await api.post(`${C(w)}/address/correct`, w.cr.token, ADDRESS(w, { street: '9 Lakshmipuram Main Road' }));
    expect(ok.status).toBe(200);
    expect(ok.body.data.shoot.address.street).toBe('9 Lakshmipuram Main Road');

    const twice = await api.post(`${C(w)}/address/correct`, w.cr.token, ADDRESS(w, { street: 'Third try' }));
    expect(twice.status).toBe(422);
    expect(twice.body.error.message).toBe(MSG.CORRECTION_USED);
  });

  it('the brand can do nothing until her address arrives (R1)', async () => {
    const w = await world();
    const r = await api.get(B(w), w.b.token);
    expect(r.body.data.shoot.can.pickProducts).toBe(false);
    const picker = await api.get(`${B(w)}/products`, w.b.token);
    expect(picker.status).toBe(422);
    expect(picker.body.error.message).toBe(MSG.ADDRESS_NOT_SENT('Tanvi'));
  });
});

/* ═══════════════════════════════════════════ products and booking (9–15, 53, 54) */

describe('the products (R5, checks 9, 10, 53, 54)', () => {
  it('9 · Pay for Sale shows only what she can sell; a product outside it is refused by the API', async () => {
    // creator-terms-v2: "her scope" is now her offers + products without offers (rules §2); the
    // helper gives her all products without offers.
    const w = await world('conversion');
    await sendAddress(w);
    const mine = await product(w.brandId, 'In scope');
    const other = await world('conversion');
    const theirs = await product(other.brandId, 'Not yours');
    const { rows: [later] } = await query(
      `INSERT INTO brand_products (brand_id, name, price, is_active, pushed_to_store) VALUES ($1, 'Listed after sending', 999, true, true) RETURNING id`, [w.brandId]);

    const list = await api.get(`${B(w)}/products`, w.b.token);
    expect(list.status).toBe(200);
    expect(list.body.data.scope).toMatchObject({ kind: 'offers', label: `${list.body.data.products.length} products she can sell` });
    expect(list.body.data.products.map((p) => p.id)).not.toContain(later.id);   // frozen at sending (Q2)
    expect(list.body.data.products.map((p) => p.id)).toContain(mine.id);
    expect(list.body.data.products.map((p) => p.id)).not.toContain(theirs.id);

    const save = await api.put(`${B(w)}/lines`, w.b.token, { lines: [{ productId: theirs.id, quantity: 1, disposition: 'gift' }] });
    expect(save.status).toBe(422);
    expect(save.body.error.message).toBe(MSG.OUT_OF_SCOPE('Tanvi'));
  });

  it('53 · SCOPE_NOT_SET for a sale collaboration with no scope — never the catalogue', async () => {
    // Only an old-kind collaboration can lack a scope: new terms refuse to send with nothing to
    // sell. So this one is turned back into an old-kind row with no scope.
    const w = await world('conversion');
    await sendAddress(w);
    await product(w.brandId, 'Something');
    await query(`UPDATE campaign_influencers SET sell_v2 = false, sell_mode = NULL, sell_product_ids = '{}', alloc_scope = NULL WHERE id = $1`, [w.ciId]);

    const list = await api.get(`${B(w)}/products`, w.b.token);
    expect(list.status).toBe(422);
    expect(list.body.error.code).toBe('SCOPE_NOT_SET');
    expect(list.body.error.message).toBe(MSG.SCOPE_NOT_SET('Tanvi'));
  });

  it('53 · Pay for Content always sees the whole published catalogue', async () => {
    const w = await world('engagement');
    await sendAddress(w);
    const p = await product(w.brandId, 'Any product');
    await query(`UPDATE campaign_influencers SET alloc_scope = NULL WHERE id = $1`, [w.ciId]);

    const list = await api.get(`${B(w)}/products`, w.b.token);
    expect(list.status).toBe(200);
    expect(list.body.data.scope).toMatchObject({ kind: 'catalogue', label: 'Your catalogue' });
    expect(list.body.data.products.map((x) => x.id)).toContain(p.id);
  });

  it('an unavailable product is hidden and refused (§13, §20)', async () => {
    const w = await world('engagement');
    await sendAddress(w);
    const p = await product(w.brandId, 'Pulled');
    await query(`UPDATE brand_products SET pushed_to_store = false WHERE id = $1`, [p.id]);

    const list = await api.get(`${B(w)}/products`, w.b.token);
    expect(list.body.data.products.map((x) => x.id)).not.toContain(p.id);
    const save = await api.put(`${B(w)}/lines`, w.b.token, { lines: [{ productId: p.id, quantity: 1, disposition: 'gift' }] });
    expect(save.status).toBe(422);
    expect(save.body.error.message).toBe(MSG.UNAVAILABLE);
  });

  it('10 · 0 lines, 21 lines and 6 of a variant are refused', async () => {
    const w = await world('engagement');
    await sendAddress(w);
    const p = await product(w.brandId);

    const none = await api.put(`${B(w)}/lines`, w.b.token, { lines: [] });
    expect(none.status).toBe(422);
    expect(none.body.error.message).toBe(MSG.NO_LINES);

    const many = [];
    for (let i = 0; i < 21; i += 1) many.push({ productId: (await product(w.brandId, `P${i}`)).id, quantity: 1, disposition: 'gift' });
    const over = await api.put(`${B(w)}/lines`, w.b.token, { lines: many });
    expect(over.status).toBe(422);
    expect(over.body.error.message).toBe(MSG.TOO_MANY_LINES);

    const six = await api.put(`${B(w)}/lines`, w.b.token, { lines: [{ productId: p.id, quantity: 6, disposition: 'gift' }] });
    expect(six.status).toBe(422);
    expect(six.body.error.message).toBe(MSG.TOO_MANY_OF_VARIANT);
  });

  it('54 · a product WITH variants needs one chosen; one without is sent as itself; 5 counts per (product, variant)', async () => {
    const w = await world('engagement');
    await sendAddress(w);
    const plain = await product(w.brandId, 'No sizes');
    const sized = await product(w.brandId, 'Has sizes');
    const { rows: vs } = await query(
      `INSERT INTO product_variants (product_id, size, is_active) VALUES ($1,'M',true), ($1,'L',true) RETURNING *`, [sized.id]);

    // Without a variant → refused.
    const bare = await api.put(`${B(w)}/lines`, w.b.token, { lines: [{ productId: sized.id, quantity: 1, disposition: 'gift' }] });
    expect(bare.status).toBe(422);
    expect(bare.body.error.message).toBe(MSG.VARIANT_REQUIRED);

    // The same product in two sizes is two legitimate lines, 5 of each.
    const ok = await api.put(`${B(w)}/lines`, w.b.token, {
      lines: [
        { productId: plain.id, quantity: 5, disposition: 'gift' },
        { productId: sized.id, variantId: vs[0].id, quantity: 5, disposition: 'return' },
        { productId: sized.id, variantId: vs[1].id, quantity: 5, disposition: 'return' },
      ],
    });
    expect(ok.status).toBe(200);
    expect(ok.body.data.shoot.lines).toHaveLength(3);
    expect(ok.body.data.shoot.lines.find((l) => l.variantId === vs[0].id).variantLabel).toBe('M');
    expect(ok.body.data.shoot.lines.find((l) => l.variantId === null).variantLabel).toBeNull();
  });
});

describe('booking (R6, R6b, R7 — checks 11–15)', () => {
  it('11 · the quote is GST-included, and the return lock appears only when a line is Return', async () => {
    const w = await world('engagement');
    await sendAddress(w);
    const p = await product(w.brandId);

    await api.put(`${B(w)}/lines`, w.b.token, { lines: [{ productId: p.id, quantity: 1, disposition: 'gift' }] });
    const gift = await api.post(`${B(w)}/quote`, w.b.token, { branchId: w.br.id, boxPreset: 'medium', weightKg: 1.2 });
    expect(gift.status).toBe(200);
    expect(gift.body.data.returnHold).toBe(0);
    expect(gift.body.data.gstIncluded).toBe(true);
    expect(gift.body.data.gst).toBeGreaterThan(0);
    expect(gift.body.data.gst).toBeLessThan(gift.body.data.outbound);
    expect(gift.body.data.total).toBe(gift.body.data.outbound);

    await api.put(`${B(w)}/lines`, w.b.token, { lines: [{ productId: p.id, quantity: 1, disposition: 'return' }] });
    const ret = await api.post(`${B(w)}/quote`, w.b.token, { branchId: w.br.id, boxPreset: 'medium', weightKg: 1.2 });
    expect(ret.body.data.returnHold).toBeGreaterThan(0);
    expect(ret.body.data.holdBasis).toBe('quoted');
    expect(ret.body.data.total).toBe(ret.body.data.outbound + ret.body.data.returnHold);
  });

  it('45 · when the provider will not quote a return, the lock is the OUTBOUND price', async () => {
    const w = await world('engagement');
    await sendAddress(w);
    const p = await product(w.brandId);
    await api.put(`${B(w)}/lines`, w.b.token, { lines: [{ productId: p.id, quantity: 1, disposition: 'return' }] });

    const was = env.SIMULATOR_NO_RETURN_QUOTE;
    try {
      env.SIMULATOR_NO_RETURN_QUOTE = true;
      const q = await api.post(`${B(w)}/quote`, w.b.token, { branchId: w.br.id, boxPreset: 'medium', weightKg: 1.2 });
      expect(q.body.data.holdBasis).toBe('outbound_fallback');
      expect(q.body.data.returnHold).toBe(q.body.data.outbound);
    } finally { env.SIMULATOR_NO_RETURN_QUOTE = was; }
  });

  it('12 · a short balance refuses booking with the exact shortfall; after adding money it succeeds', async () => {
    const w = await world('engagement');
    await sendAddress(w);
    const p = await product(w.brandId);
    await api.put(`${B(w)}/lines`, w.b.token, { lines: [{ productId: p.id, quantity: 1, disposition: 'return' }] });

    await query(`UPDATE brands SET wallet_balance = 10 WHERE id = $1`, [w.brandId]);
    const q = await api.post(`${B(w)}/quote`, w.b.token, { branchId: w.br.id, boxPreset: 'medium', weightKg: 1.2 });
    expect(q.body.data.enough).toBe(false);
    expect(q.body.data.shortfall).toBe(Math.round((q.body.data.total - 10) * 100) / 100);

    const short = await api.post(`${B(w)}/book`, w.b.token, { branchId: w.br.id, boxPreset: 'medium', weightKg: 1.2 });
    expect(short.status).toBe(422);
    expect(short.body.error.code).toBe('WALLET_INSUFFICIENT');
    expect(short.body.error.message).toMatch(/^Add ₹/);
    expect(await walletOf(w.brandId)).toBe(10);        // nothing moved

    await query(`UPDATE brands SET wallet_balance = 500000 WHERE id = $1`, [w.brandId]);
    const ok = await api.post(`${B(w)}/book`, w.b.token, { branchId: w.br.id, boxPreset: 'medium', weightKg: 1.2 });
    expect(ok.status).toBe(200);
  });

  it('13 · booking debits, locks, locks the list and produces a label; changing lines afterwards is refused', async () => {
    const w = await world('engagement');
    await sendAddress(w);
    const p = await product(w.brandId);
    await api.put(`${B(w)}/lines`, w.b.token, { lines: [{ productId: p.id, quantity: 2, disposition: 'return' }] });
    const q = await api.post(`${B(w)}/quote`, w.b.token, { branchId: w.br.id, boxPreset: 'medium', weightKg: 1.2 });

    const escrowCount = async () => Number((await query(
      `SELECT count(*)::int n FROM wallet_transactions
        WHERE brand_id = $1 AND type::text IN ('escrow_lock','escrow_release')`, [w.brandId])).rows[0].n);

    const before = await walletOf(w.brandId);
    const escrowRowsBefore = await escrowCount();
    const { shoot, parcelId } = await bookParcel(w, [{ productId: p.id, quantity: 2, disposition: 'return' }]);
    const after = await walletOf(w.brandId);
    const escrowRowsAfter = await escrowCount();

    expect(Math.round((before - after) * 100) / 100).toBe(q.body.data.total);
    expect(shoot.parcel.tracking).toMatch(/^TEST\d{10}$/);
    expect(shoot.parcel.charged).toBe(q.body.data.outbound);
    expect(shoot.parcel.returnHold).toBe(q.body.data.returnHold);
    expect(shoot.parcel.declaredValue).toBe(4800);      // 2 × 2400 (approval Q6)

    const label = await api.get(`${B(w)}/label`, w.b.token);
    expect(label.status).toBe(200);
    expect(label.body.data.url).toBeTruthy();

    const locked = await api.put(`${B(w)}/lines`, w.b.token, { lines: [{ productId: p.id, quantity: 1, disposition: 'gift' }] });
    expect(locked.status).toBe(422);
    expect(locked.body.error.message).toBe(MSG.LIST_LOCKED);

    // Two wallet rows, both the brand's, NEITHER an escrow value — Reserved on the wallet
    // screen means money committed to CREATORS and must not move because a courier was paid.
    // (`type` is an enum, so LIKE needs the cast; and both rows are written in one transaction,
    // so they share now() and must be compared as a set, not in order.)
    const { rows: tx } = await query(
      `SELECT type::text AS type, direction FROM wallet_transactions
        WHERE brand_id = $1 AND type::text LIKE 'courier%'`, [w.brandId]);
    expect(tx.map((t) => `${t.type}:${t.direction}`).sort())
      .toEqual(['courier_charge:debit', 'courier_lock:debit']);
    // …and booking added NONE of them. Counted before and after rather than by timestamp:
    // the signature's own escrow rows share now() with brand_signed_at, so "later than" is
    // not a question the data can answer.
    expect(escrowRowsAfter).toBe(escrowRowsBefore);
  });

  it('14 · cancel before collection returns both amounts and reopens the list; after collection it is refused', async () => {
    const w = await world('engagement');
    await sendAddress(w);
    const p = await product(w.brandId);
    const before = await walletOf(w.brandId);
    const { parcelId } = await bookParcel(w, [{ productId: p.id, quantity: 1, disposition: 'return' }]);
    expect(await walletOf(w.brandId)).toBeLessThan(before);

    const cancel = await api.post(`${B(w)}/cancel`, w.b.token, {});
    expect(cancel.status).toBe(200);
    expect(await walletOf(w.brandId)).toBe(before);

    const reopened = await api.put(`${B(w)}/lines`, w.b.token, { lines: [{ productId: p.id, quantity: 1, disposition: 'gift' }] });
    expect(reopened.status).toBe(200);

    // Q5: cancel and book again before collection may be REPEATED.
    const second = await bookParcel(w, [{ productId: p.id, quantity: 1, disposition: 'gift' }]);
    await courier(second.parcelId, 'collected');
    const late = await api.post(`${B(w)}/cancel`, w.b.token, {});
    expect(late.status).toBe(422);
    expect(late.body.error.message).toBe(MSG.ALREADY_COLLECTED);
  });

  it('15 · two simultaneous bookings produce ONE parcel and ONE debit', async () => {
    const w = await world('engagement');
    await sendAddress(w);
    const p = await product(w.brandId);
    await api.put(`${B(w)}/lines`, w.b.token, { lines: [{ productId: p.id, quantity: 1, disposition: 'gift' }] });

    const before = await walletOf(w.brandId);
    const body = { branchId: w.br.id, boxPreset: 'medium', weightKg: 1.2 };
    const [a, b] = await Promise.all([
      api.post(`${B(w)}/book`, w.b.token, body),
      api.post(`${B(w)}/book`, w.b.token, body),
    ]);
    const ok = [a, b].filter((x) => x.status === 200);
    expect(ok).toHaveLength(1);

    const { rows } = await query(
      `SELECT count(*)::int n FROM shipments s JOIN production_events pe ON pe.id = s.production_event_id
        WHERE pe.contract_id = $1 AND s.direction = 'outbound' AND s.cancelled_at IS NULL`, [w.con.id]);
    expect(rows[0].n).toBe(1);

    const charged = before - await walletOf(w.brandId);
    expect(charged).toBe(ok[0].body.data.shoot.parcel.charged);
  });

  it('57 · a branch with no street address cannot be booked from, in item 10’s words', async () => {
    const w = await world('engagement');
    await sendAddress(w);
    const p = await product(w.brandId);
    await api.put(`${B(w)}/lines`, w.b.token, { lines: [{ productId: p.id, quantity: 1, disposition: 'gift' }] });
    const bare = await w10.branch(w.brandId, { name: 'No Address Branch', address: null });

    const q = await api.post(`${B(w)}/quote`, w.b.token, { branchId: bare.id, boxPreset: 'medium', weightKg: 1.2 });
    expect(q.status).toBe(422);
    expect(q.body.error.code).toBe('BRANCH_NO_ADDRESS');
    expect(q.body.error.message).toBe(MSG.BRANCH_NO_ADDRESS('No Address Branch'));
  });
});
