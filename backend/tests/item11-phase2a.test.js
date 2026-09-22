'use strict';

/**
 * Item 11, Phase 2a — the fix, the privacy, the retirements.
 * Contract: features/item11-remote · approval §3.1–§3.3, checks 40, 42, 43, 60
 *
 * This suite runs BEFORE the shipping layer and before any ship_to_* column exists. That is
 * deliberate: the approval puts the whitelists in first, "before any ship_to_* column exists",
 * so there is never a moment when a creator's street address sits on a row that two endpoints
 * spread wholesale.
 *
 * Four things are proved here:
 *   1. addParcelItems can actually add a product, and refuses anyone but the owning brand (40);
 *   2. no endpoint hands out a creator address, and no creator payload carries a branch street
 *      address (42, 43);
 *   3. every retired door answers a sentence, server-side, whatever the client shows (60);
 *   4. the one door that is NOT retired for a Store Visit still works (approval §2.9).
 */

const { query, api } = require('./helpers/item3');
const w10 = require('./helpers/item10');
const { createAdminUser } = require('./helpers/factories');
const { MSG } = require('../src/services/productionCopy');

/** A product in this brand's catalogue, available by item 11's test (is_active + pushed). */
async function product(brandId, name = 'Indigo Chanderi Saree') {
  const { rows: [p] } = await query(
    `INSERT INTO brand_products (brand_id, name, price, sku, is_active, pushed_to_store)
     VALUES ($1, $2, 2400, $3, true, true) RETURNING *`,
    [brandId, name, `SKU-${Math.random().toString(36).slice(2, 8).toUpperCase()}`]
  );
  return p;
}

/* ──────────────────────────────────────────── 1. the handover defect (check 40) */

describe('item 11 · finding 1 — addParcelItems could never work (check 40)', () => {
  it('the owning brand can put a product in the parcel; getContractParties now carries brand_id', async () => {
    const w = await w10.signedByBoth('conversion', { mode: 'shipment' });
    const p = await product(w.brandId);

    const r = await api.post(`/production-events/${w.pe.id}/items`, w.b.token, {
      items: [{ product_id: p.id, quantity: 2 }],
    });

    // Before the fix this was 422 "Some of those products are not in your catalogue." — for
    // EVERY product, because brand_id arrived as undefined and matched no row.
    expect(r.status).toBe(200);
    expect(r.body.data.items).toHaveLength(1);
    expect(r.body.data.items[0]).toMatchObject({ product_id: p.id, quantity: 2 });
    expect(r.body.data.items[0].name_at_dispatch).toBe(p.name);
  });

  it('another brand is refused, and cannot learn the parcel exists', async () => {
    const w = await w10.signedByBoth('conversion', { mode: 'shipment' });
    const other = await w10.signedByBoth('conversion', { mode: 'shipment' });
    const p = await product(other.brandId);

    const r = await api.post(`/production-events/${w.pe.id}/items`, other.b.token, {
      items: [{ product_id: p.id, quantity: 1 }],
    });
    expect(r.status).toBe(403);
  });

  it("a product from someone else's catalogue is still refused — the fix did not widen the check", async () => {
    const w = await w10.signedByBoth('conversion', { mode: 'shipment' });
    const other = await w10.signedByBoth('conversion', { mode: 'shipment' });
    const theirs = await product(other.brandId, 'Not Yours');

    const r = await api.post(`/production-events/${w.pe.id}/items`, w.b.token, {
      items: [{ product_id: theirs.id, quantity: 1 }],
    });
    expect(r.status).toBe(422);
    expect(r.body.error.message).toMatch(/not in your catalogue/i);
  });
});

/* ──────────────────────────────────────────── 2. privacy (checks 42, 43) */

describe('item 11 · finding 2 — no endpoint spreads the shoot row (checks 42, 43)', () => {
  /** Every key any of these endpoints may return about a creator's address. */
  const FORBIDDEN_TO_BRAND_BEFORE_SEND = [
    'ship_to_name', 'ship_to_phone', 'ship_to_street', 'ship_to_pincode',
    'ship_to_state_name', 'ship_to_city_name', 'ship_to_note', 'ship_to_sizes',
    'shipment_to_address_line', 'shipment_to_pincode', 'shipment_to_city', 'shipment_to_state',
    'delivery_address',
  ];
  const BRANCH_STREET = ['visit_address', 'visit_pincode', 'visit_maps_url', 'visit_lat', 'visit_lng'];

  const deepKeys = (o, out = new Set()) => {
    if (!o || typeof o !== 'object') return out;
    for (const [k, v] of Object.entries(o)) { out.add(k); deepKeys(v, out); }
    return out;
  };

  it('42 · the brand receives no creator address from getProduction or the campaign roster', async () => {
    const w = await w10.signedByBoth('conversion', { mode: 'shipment' });

    const one = await api.get(`/contracts/${w.con.id}/production`, w.b.token);
    expect(one.status).toBe(200);
    const keys1 = deepKeys(one.body.data);
    for (const k of FORBIDDEN_TO_BRAND_BEFORE_SEND) expect([...keys1]).not.toContain(k);

    const roster = await api.get(`/campaigns/${w.c.id}/production`, w.b.token);
    expect(roster.status).toBe(200);
    const keys2 = deepKeys(roster.body.data);
    for (const k of FORBIDDEN_TO_BRAND_BEFORE_SEND) expect([...keys2]).not.toContain(k);
  });

  it("42 · the creator's own collaboration read carries no delivery_address", async () => {
    const w = await w10.signedByBoth('conversion', { mode: 'shipment' });
    // A value in the legacy column, so the test would catch a re-added SELECT rather than
    // passing because production happens to have none. (0 of 19 rows carry one today.)
    await query(`UPDATE campaign_influencers SET delivery_address = $2 WHERE id = $1`,
      [w.ciId, '11 Gandhi Road, Guntur 522002']);

    // The route keys on the collaboration, not the campaign.
    const r = await api.get(`/influencers/me/campaigns/${w.ciId}`, w.cr.token);
    expect(r.status).toBe(200);
    expect([...deepKeys(r.body.data)]).not.toContain('delivery_address');
    expect(JSON.stringify(r.body)).not.toMatch(/Gandhi Road/);
  });

  it('42 · the creator never receives a branch street address from a Remote shoot row', async () => {
    const w = await w10.signedByBoth('conversion', { mode: 'shipment' });
    // Put an address on the row the way item 10's visit path would, so "absent" means
    // "withheld", not "never written".
    await query(
      `UPDATE production_events SET visit_address = $2, visit_pincode = $3, visit_lat = 17.41, visit_lng = 78.44 WHERE id = $1`,
      [w.pe.id, 'Road No. 12, Banjara Hills, Hyderabad', '500034']);

    const hers = await api.get(`/contracts/${w.con.id}/production`, w.cr.token);
    expect(hers.status).toBe(200);
    const k = [...deepKeys(hers.body.data)];
    for (const f of BRANCH_STREET) expect(k).not.toContain(f);
    expect(JSON.stringify(hers.body)).not.toMatch(/Banjara Hills/);
    expect(JSON.stringify(hers.body)).not.toMatch(/500034/);

    // The brand's own branch address is the brand's own business — it still gets it.
    const theirs = await api.get(`/contracts/${w.con.id}/production`, w.b.token);
    expect(theirs.body.data.production_event.visit_address).toMatch(/Banjara Hills/);
  });

  it('43 · the delivery_address prefill no longer runs at the brand’s signature', async () => {
    const w = await w10.world('conversion', { mode: 'shipment' });
    await query(`UPDATE campaign_influencers SET delivery_address = $2 WHERE id = $1`,
      [w.ciId, '11 Gandhi Road, Guntur 522002']);

    await w10.send(w); await w10.herSign(w); await w10.brandSign(w);

    const con = await w10.con(w.ciId);
    const pe = await w10.pe(con.id);
    expect(pe).toBeTruthy();
    expect(pe.shipment_to_address_line).toBeNull();
    expect(pe.shipment_to_city).toBeNull();
    expect(pe.shipment_to_state).toBeNull();
    expect(pe.shipment_to_pincode).toBeNull();
  });
});

/* ──────────────────────────────────────────── 3. the retirements (check 60) */

describe('item 11 · the retired doors answer a sentence, server-side (check 60)', () => {
  it('dispatch, confirm-received, drop, accept and counter-propose are switched off on a Remote shoot', async () => {
    const w = await w10.signedByBoth('conversion', { mode: 'shipment' });
    const p = await product(w.brandId);
    const add = await api.post(`/production-events/${w.pe.id}/items`, w.b.token, {
      items: [{ product_id: p.id, quantity: 1 }],
    });
    expect(add.status).toBe(200);
    const itemId = add.body.data.items[0].id;

    const table = [
      ['dispatch',         () => api.post(`/production-events/${w.pe.id}/dispatch`, w.b.token, { courier: 'Delhivery', awb: 'DL1' }), 'RETIRED_DISPATCH',        MSG.RETIRED_DISPATCH],
      ['confirm-received', () => api.post(`/production-events/${w.pe.id}/confirm-received`, w.cr.token, {}),                          'RETIRED_CONFIRM_RECEIVED', MSG.RETIRED_CONFIRM_RECEIVED],
      ['complete',         () => api.post(`/production-events/${w.pe.id}/complete`, w.cr.token, {}),                                  'RETIRED_COMPLETE_REMOTE',  MSG.RETIRED_COMPLETE_REMOTE],
      ['drop',             () => api.post(`/production-events/${w.pe.id}/items/${itemId}/drop`, w.b.token, {}),                       'RETIRED_DROP',             MSG.RETIRED_DROP],
      ['accept',           () => api.post(`/production-events/${w.pe.id}/accept`, w.cr.token, {}),                                    'RETIRED_SHIPMENT_SLOT',    MSG.RETIRED_SHIPMENT_SLOT],
      ['counter-propose',  () => api.post(`/production-events/${w.pe.id}/counter-propose`, w.b.token, {}),                            'RETIRED_SHIPMENT_SLOT',    MSG.RETIRED_SHIPMENT_SLOT],
    ];

    for (const [name, call, code, message] of table) {
      const r = await call();
      expect(`${name}:${r.status}`).toBe(`${name}:422`);
      expect(`${name}:${r.body.error.code}`).toBe(`${name}:${code}`);
      expect(r.body.error.message).toBe(message);
    }
  });

  it('the mode picker and flip-to-remote stay refused (item 10, re-proved)', async () => {
    const w = await w10.signedByBoth('conversion', { mode: 'shipment' });
    const init = await api.post(`/contracts/${w.con.id}/production/initialise`, w.b.token, { mode: 'visit' });
    expect(init.status).toBe(422);
    expect(init.body.error.code).toBe('RETIRED_MODE_CHOICE');
    const flip = await api.post(`/production-events/${w.pe.id}/flip-to-remote`, w.b.token, {});
    expect(flip.status).toBe(422);
    expect(flip.body.error.code).toBe('RETIRED_MODE_CHOICE');
  });

  it('§2.9 · `complete` is NOT retired for a Store Visit — the website’s live caller still works', async () => {
    const w = await w10.signedByBoth('conversion');   // a visit
    expect(w.pe.mode).toBe('visit');

    // The brand's "Mark visit done" is the live caller the audit found. It must not meet an
    // item 11 sentence. It meets item 10's own rule instead: only the creator may say a shoot
    // happened when she is the only one who can see it — on a visit the brand was there, so
    // this is allowed through to the service.
    const r = await api.post(`/production-events/${w.pe.id}/complete`, w.b.token, {});
    expect(r.body.error && r.body.error.code).not.toBe('RETIRED_COMPLETE_REMOTE');
    expect([200, 422]).toContain(r.status);   // 422 only for an item 10 state rule, never a retirement
  });

  it('the shipment reminder job is no longer scheduled', () => {
    const src = require('fs').readFileSync(require.resolve('../src/jobs/index.js'), 'utf8');
    expect(src).not.toMatch(/cron\.schedule\([^)]*productionReminderJob/);
    expect(src).toMatch(/RETIRED by item 11/);
  });

  it('the admin production-queue page is gone, and the endpoint no longer reads the dead shipment bucket', async () => {
    const fs = require('fs');
    expect(fs.existsSync(require('path').join(__dirname, '../../Packages/brand-web/app/admin/production-queue'))).toBe(false);
    const src = fs.readFileSync(require.resolve('../src/controllers/admin.controller.js'), 'utf8');
    expect(src).not.toMatch(/days_since_dispatch/);
    expect(src).not.toMatch(/Shipment unconfirmed for/);

    // …and it still answers, because item 10's own tests read it.
    const admin = await createAdminUser();
    const q = await api.get('/admin/production/queue', admin.token);
    expect(q.status).toBe(200);
  });
});

/* ──────────────────────────────────────────── 4. the mode mirror */

describe('item 11 · the mode refusals are mirrors', () => {
  it('both sentences exist, and neither is the other', () => {
    expect(MSG.WRONG_MODE('Tanvi')).toBe('This is a Remote collaboration. Products are shipped to Tanvi.');
    expect(MSG.WRONG_MODE_VISIT('Kanchi Silks')).toBe('This is a Store Visit collaboration. Kanchi Silks send a time and the store address.');
  });

  it('assertRemoteMode refuses a visit and lets a shipment, a remote and a NULL mode through', () => {
    const { assertRemoteMode } = require('../src/services/productionCopy');
    expect(() => assertRemoteMode('visit', 'Kanchi Silks')).toThrow(/Store Visit collaboration/);
    expect(() => assertRemoteMode('shipment', 'Kanchi Silks')).not.toThrow();
    expect(() => assertRemoteMode('remote', 'Kanchi Silks')).not.toThrow();
    expect(() => assertRemoteMode(null, 'Kanchi Silks')).not.toThrow();
  });
});
