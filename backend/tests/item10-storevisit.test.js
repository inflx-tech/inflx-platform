'use strict';

/**
 * Item 10 — the Store Visit shoot plan, against the real database.
 * Contract: features/item10-store-visit · GAP_CHECK_PROMPT §12.1 checks 1–30 · PROMPT §4.1 checks 31–48
 *
 * Phase 2a first: THE GATE. Rules §10 has always said the brand must be prevented from reaching
 * the shoot until the agreement is signed by both and, for Pay for Content and Hybrid, the funds
 * are locked and the first 25% released. Before item 10 the money half was enforced nowhere and
 * the signature half on two paths of eighteen. The proof here is a LOOP over the route table,
 * not a hand-written test per route, so a route added later without the guard fails this file.
 */

const fs = require('fs');
const path = require('path');
const { truncateAll } = require('./helpers/db');
const { query, api, resetReference, brand, creator } = require('./helpers/item3');
const { createAdminUser } = require('./helpers/factories');
const w10 = require('./helpers/item10');
const settings = require('../src/services/platformSettings.service');
const standardTerms = require('../src/services/standardTerms.service');
const db = require('../src/config/db');
const productionService = require('../src/services/production.service');
const { resolveProductionMode } = require('../src/services/productionMode.model');
const shootGate = require('../src/services/shootGate.service');
const { MSG } = require('../src/services/productionCopy');
const { MSG: MSG4 } = require('../src/services/campaignCopy');

beforeEach(async () => { await truncateAll(); await resetReference(); settings._resetCache(); standardTerms._resetCache(); });
afterEach(() => { settings._resetCache(); standardTerms._resetCache(); });

const src = (rel) => fs.readFileSync(path.join(__dirname, rel), 'utf8');

/* ───────────────────────────────────────────────────────────── the route table (§3.2) */

/**
 * Every surviving path into the shoot, as the gap report's §3.2 numbered them. Each row says how
 * to reach it for a given world and which side calls it. Paths that take an event id can only
 * be reached once a row exists, so the loop breaks the gate AFTER the row is born.
 */
const ROUTES = (w, ev) => [
  { n: 1,  who: 'brand',   m: 'get',  p: `/contracts/${w.con.id}/production` },
  { n: 1,  who: 'creator', m: 'get',  p: `/contracts/${w.con.id}/production` },
  { n: 2,  who: 'brand',   m: 'post', p: `/contracts/${w.con.id}/production/initialise`, body: { mode: 'visit' } },
  { n: 3,  who: 'brand',   m: 'get',  p: `/contracts/${w.con.id}/production/date-range` },
  { n: 3,  who: 'creator', m: 'get',  p: `/contracts/${w.con.id}/production/date-range` },
  { n: 4,  who: 'brand',   m: 'post', p: `/contracts/${w.con.id}/production/visit-details`, body: { visit_address: 'x' } },
  ...(ev ? [
    { n: 5,  who: 'creator', m: 'post', p: `/production-events/${ev}/propose-slot`, body: { visit_scheduled_at: new Date(Date.now() + 86400000).toISOString() } },
    { n: 6,  who: 'brand',   m: 'post', p: `/production-events/${ev}/accept` },
    { n: 6,  who: 'creator', m: 'post', p: `/production-events/${ev}/accept` },
    { n: 7,  who: 'brand',   m: 'post', p: `/production-events/${ev}/counter-propose`, body: {} },
    { n: 8,  who: 'brand',   m: 'post', p: `/production-events/${ev}/dispatch`, body: { courier: 'x', awb: '1' } },
    { n: 9,  who: 'creator', m: 'post', p: `/production-events/${ev}/confirm-received` },
    { n: 10, who: 'brand',   m: 'post', p: `/production-events/${ev}/complete` },
    { n: 10, who: 'creator', m: 'post', p: `/production-events/${ev}/complete` },
    { n: 11, who: 'brand',   m: 'post', p: `/production-events/${ev}/flip-to-remote` },
    { n: 12, who: 'admin',   m: 'post', p: `/production-events/${ev}/cancel`, body: { reason: 'x' } },
    { n: 13, who: 'brand',   m: 'get',  p: `/production-events/${ev}/items` },
    { n: 13, who: 'creator', m: 'get',  p: `/production-events/${ev}/items` },
    { n: 14, who: 'brand',   m: 'post', p: `/production-events/${ev}/items`, body: { items: [] } },
    { n: 15, who: 'brand',   m: 'del',  p: `/production-events/${ev}/items/00000000-0000-0000-0000-000000000000` },
    { n: 16, who: 'brand',   m: 'post', p: `/production-events/${ev}/items/00000000-0000-0000-0000-000000000000/drop` },
  ] : []),
];

async function hit(r, w, admin) {
  const token = r.who === 'brand' ? w.b.token : r.who === 'creator' ? w.cr.token : admin.token;
  if (r.m === 'get') return api.get(r.p, token);
  if (r.m === 'del') return api.del(r.p, token);
  return api.post(r.p, token, r.body || {});
}

const gateCode = (res) => (res.body && res.body.error && res.body.error.code) || null;

describe('the gate — every path (checks 1, 2, 3, 31, 32, 33)', () => {
  it('31 · a signed-but-unfunded Pay for Content collaboration is refused on EVERY path, event routes included', async () => {
    const w = await w10.signedByBoth('engagement');
    expect(w.pe).toBeTruthy();                                   // the row was born with the gate open
    const admin = await createAdminUser();
    // Break the money half after birth: the same contract, both signatures intact, tranche 1 no longer released.
    await query(`UPDATE escrow_entries SET status = 'locked', released_at = NULL WHERE campaign_influencer_id = $1 AND tranche_number = 1`, [w.ciId]);
    const g = await shootGate.shootGate(w.ciId);
    expect(g.open).toBe(false); expect(g.reason).toBe('NOT_FUNDED'); expect(g.signed.at).toBeTruthy();

    const refused = [];
    const leaked = [];
    for (const r of ROUTES(w, w.pe.id)) {
      const res = await hit(r, w, admin);
      if (res.status === 422 && gateCode(res) === 'NOT_FUNDED' && res.body.error.message === MSG.NOT_FUNDED) refused.push(`${r.n}:${r.who}:${r.m} ${r.p}`);
      else leaked.push(`${r.n}:${r.who}:${r.m} ${r.p} → ${res.status} ${gateCode(res)}`);
    }
    expect(leaked).toEqual([]);
    expect(refused.length).toBe(ROUTES(w, w.pe.id).length);
  });

  it('1 · …and when money_at is missing, or the escrow set is short, it is equally closed', async () => {
    const w = await w10.signedByBoth('hybrid');
    await query(`UPDATE contracts SET money_at = NULL WHERE id = $1`, [w.con.id]);
    expect((await shootGate.shootGate(w.ciId)).reason).toBe('NOT_FUNDED');
    await query(`UPDATE contracts SET money_at = now() WHERE id = $1`, [w.con.id]);
    await query(`DELETE FROM escrow_entries WHERE campaign_influencer_id = $1 AND tranche_number = 3`, [w.ciId]);
    expect((await shootGate.shootGate(w.ciId)).reason).toBe('NOT_FUNDED');
  });

  it('32 · an UNSIGNED collaboration is refused on every path with the signature sentence', async () => {
    const w = await w10.signedByBoth('engagement');
    const admin = await createAdminUser();
    await query(`UPDATE contracts SET brand_signed_at = NULL WHERE id = $1`, [w.con.id]);
    const leaked = [];
    for (const r of ROUTES(w, w.pe.id)) {
      const res = await hit(r, w, admin);
      if (!(res.status === 422 && gateCode(res) === 'NOT_SIGNED' && res.body.error.message === MSG.NOT_SIGNED)) leaked.push(`${r.n}:${r.who} ${r.p} → ${res.status} ${gateCode(res)}`);
    }
    expect(leaked).toEqual([]);
  });

  it('3 · a collaboration she signed and the brand has not reaches the shoot from no path, and has no row', async () => {
    const w = await w10.signedByHer('engagement');
    const admin = await createAdminUser();
    expect(await w10.pe(w.con.id)).toBeNull();
    for (const r of ROUTES(w, null)) {
      const res = await hit(r, w, admin);
      expect([r.p, res.status, gateCode(res)]).toEqual([r.p, 422, 'NOT_SIGNED']);
    }
  });

  it('2 / 32 · Pay for Sale opens on the two signatures alone, money.required = false', async () => {
    const w = await w10.signedByBoth('conversion');
    expect(await w10.escrow(w.ciId)).toEqual([]);
    const g = await shootGate.shootGate(w.ciId);
    expect(g).toMatchObject({ open: true, reason: null, money: { required: false, locked: 0, released: 0 } });
    const r = await api.get(`/contracts/${w.con.id}/production`, w.b.token);
    expect(r.status).toBe(200);
    expect(r.body.data.production_event.mode).toBe('visit');
    const h = await api.get(`/contracts/${w.con.id}/production`, w.cr.token);
    expect(h.status).toBe(200);
  });

  it('33 · autoCreateForContract itself refuses to create a row when the gate is closed', async () => {
    const w = await w10.signedByHer('engagement');
    const { rows: [full] } = await query(`SELECT * FROM contracts WHERE id = $1`, [w.con.id]);
    await expect(productionService.autoCreateForContract(db, full)).rejects.toMatchObject({ code: 'NOT_SIGNED' });
    expect(await w10.pe(w.con.id)).toBeNull();
    // and the auto-heal on the read door cannot sneak one in either
    const r = await api.get(`/contracts/${w.con.id}/production`, w.b.token);
    expect(r.status).toBe(422);
    expect(await w10.pe(w.con.id)).toBeNull();
  });

  it('34 · the gate\'s money is contracts.locked_amount / released_amount — the numbers item 7 shows', async () => {
    const w = await w10.signedByBoth('engagement');
    const g = await shootGate.shootGate(w.ciId);
    expect(g.money.required).toBe(true);
    expect(g.money.locked).toBe(Number(w.con.locked_amount));
    expect(g.money.released).toBe(Number(w.con.released_amount));
    expect(g.money.locked).toBe(9720);          // 9000 + 8% campaign fee
    expect(g.money.released).toBe(2250);        // the first 25%
    expect(g.signed.at.toISOString()).toBe(w.con.brand_signed_at.toISOString());
  });

  it('Q4 · a paid collaboration with nothing locked is BLOCKED whatever its age', async () => {
    const w = await w10.signedByBoth('engagement');
    await query(`DELETE FROM escrow_entries WHERE campaign_influencer_id = $1`, [w.ciId]);
    await query(`UPDATE contracts SET locked_amount = 0, money_at = NULL WHERE id = $1`, [w.con.id]);
    const g = await shootGate.shootGate(w.ciId);
    expect(g.open).toBe(false); expect(g.reason).toBe('NOT_FUNDED');
  });

  it('17 / 18 / 20 · the brand list filters on the gate, the roster and the admin queue carry it as a column', async () => {
    const open = await w10.signedByBoth('engagement');
    const closed = await w10.signedByBoth('engagement');
    await query(`UPDATE escrow_entries SET status = 'locked', released_at = NULL WHERE campaign_influencer_id = $1 AND tranche_number = 1`, [closed.ciId]);

    const listOpen = await api.get('/brands/me/shoots', open.b.token);
    expect(listOpen.status).toBe(200);
    expect(listOpen.body.data.shoots.map(s => s.contract_id)).toEqual([open.con.id]);
    const listClosed = await api.get('/brands/me/shoots', closed.b.token);
    expect(listClosed.body.data.shoots).toEqual([]);

    const roster = await api.get(`/campaigns/${closed.c.id}/production`, closed.b.token);
    expect(roster.status).toBe(200);
    expect(roster.body.data.production[0].gate).toMatchObject({ open: false, reason: 'NOT_FUNDED' });

    const admin = await createAdminUser();
    // make it show in the exception queue: stale proposed
    await query(`UPDATE production_events SET created_at = now() - interval '4 days' WHERE contract_id = $1`, [closed.con.id]);
    const q = await api.get('/admin/production/queue', admin.token);
    expect(q.status).toBe(200);
    const row = q.body.data.items.find(i => i.contract_id === closed.con.id);
    expect(row.gate).toEqual({ open: false, reason: 'NOT_FUNDED' });
    expect(row.reasons).toContain('Money not locked');
  });
});

/* ───────────────────────────────────────────────────────────── the mode (checks 35, 36) */

describe('the mode — the set comes first (checks 35, 36)', () => {
  it('resolveProductionMode: set → contract → agreement → remote, and SAYS which', () => {
    expect(resolveProductionMode({ setMode: 'visit', contractMode: 'remote', agreementMode: 'shipment' })).toEqual({ mode: 'visit', source: 'set' });
    expect(resolveProductionMode({ setMode: null, contractMode: 'shipment', agreementMode: 'visit' })).toEqual({ mode: 'shipment', source: 'contract' });
    expect(resolveProductionMode({ setMode: null, contractMode: null, agreementMode: 'visit' })).toEqual({ mode: 'visit', source: 'agreement' });
    expect(resolveProductionMode({})).toEqual({ mode: 'remote', source: 'default' });
    expect(resolveProductionMode({ setMode: 'junk' })).toEqual({ mode: 'remote', source: 'default' });
  });

  it('35 · a visit set produces a visit shoot at countersign; a shipment set a shipment shoot — the §4.3 regression', async () => {
    const v = await w10.signedByBoth('engagement', { mode: 'visit' });
    expect(v.pe.mode).toBe('visit');
    expect(v.pe.status).toBe('proposed');
    expect(v.pe.branch_id).toBe(v.br.id);
    expect(v.pe.visit_address).toBeNull();          // the address is NOT copied at birth — only at send
    expect(v.con.production_mode).toBeNull();       // the stale copy stays untouched; the set is the source
    const s = await w10.signedByBoth('conversion', { mode: 'shipment' });
    expect(s.pe.mode).toBe('shipment');
    expect(s.pe.branch_id).toBeNull();
    const log = (await query(`SELECT action, notes FROM production_event_log WHERE production_event_id = $1 ORDER BY created_at, seq`, [v.pe.id])).rows;
    expect(log[0].notes).toBe('Mode set to visit (from the set)');
  });

  it('the shoot row is born AFTER the money in the countersign transaction', async () => {
    const w = await w10.signedByBoth('hybrid');
    const e = await w10.escrow(w.ciId);
    expect(e.map(x => x.status)).toEqual(['released', 'locked', 'locked']);
    expect(w.pe).toBeTruthy();
    expect(new Date(w.pe.created_at).getTime()).toBeGreaterThanOrEqual(new Date(e[0].released_at).getTime() - 5);
  });
});

/* ───────────────────────────────────────────────────────────── the branch address (check 45) */

describe('a Store Visit needs a branch with a street address (check 45, founder Q6)', () => {
  it('set create and update refuse an address-less branch by name; an addressed one is accepted', async () => {
    const b = await brand();
    const bad = await w10.branch(b.brandId, { name: 'Kondapur', address: null });
    const good = await w10.branch(b.brandId, { name: 'Banjara Hills' });
    const c = await w10.campaign(b);
    let r = await api.post(`/campaigns/${c.id}/sets`, b.token, { name: 'Set A', goal: 'engagement', shoot_mode: 'visit', go_live_date: w10.day(12), branch_id: bad.id });
    expect(r.status).toBe(422);
    expect(r.body.error.field).toBe('branch_id');
    expect(r.body.error.message).toBe(MSG4.BRANCH_NO_ADDRESS('Kondapur'));
    r = await api.post(`/campaigns/${c.id}/sets`, b.token, { name: 'Set A', goal: 'engagement', shoot_mode: 'visit', go_live_date: w10.day(12), branch_id: good.id });
    expect(r.status).toBe(201);
    const setId = r.body.data.set.id;
    r = await api.patch(`/campaigns/${c.id}/sets/${setId}`, b.token, { branch_id: bad.id });
    expect(r.status).toBe(422);
    expect(r.body.error.message).toBe(MSG4.BRANCH_NO_ADDRESS('Kondapur'));
    // a Remote set never needs one
    r = await api.post(`/campaigns/${c.id}/sets`, b.token, { name: 'Set B', goal: 'engagement', shoot_mode: 'shipment', go_live_date: w10.day(12) });
    expect(r.status).toBe(201);
  });
});

/* ───────────────────────────────────────────────────────────── a typed address (founder, 18 Sep) */

describe('a branch address may be typed as well as searched', () => {
  it('typing an address onto an address-less main branch unblocks the Store Visit set; the city and state stay', async () => {
    const b = await brand({ mainAddress: null });
    // The three practice brands in production were seeded with no address at all; make this one the same.
    await query(`UPDATE brand_branches SET formatted_address = NULL, pincode = NULL, lat = NULL, lng = NULL, google_place_id = NULL WHERE brand_id = $1 AND is_main`, [b.brandId]);
    const main = (await query(`SELECT * FROM brand_branches WHERE brand_id = $1 AND is_main`, [b.brandId])).rows[0];
    expect(main.formatted_address).toBeNull();
    const c = await w10.campaign(b);
    let r = await api.post(`/campaigns/${c.id}/sets`, b.token, { name: 'Set A', goal: 'engagement', shoot_mode: 'visit', go_live_date: w10.day(12), branch_id: main.id });
    expect(r.status).toBe(422);
    // too long, a bad PIN, empty — each named
    r = await api.put(`/brands/me/branches/${main.id}`, b.token, { address_text: 'x'.repeat(201) });
    expect(r.status).toBe(422); expect(r.body.error.field).toBe('address_text');
    r = await api.put(`/brands/me/branches/${main.id}`, b.token, { address_text: 'Shop 4, MG Road', pincode: '12' });
    expect(r.status).toBe(422); expect(r.body.error.field).toBe('pincode');
    r = await api.put(`/brands/me/branches/${main.id}`, b.token, { address_text: '   ' });
    expect(r.status).toBe(422); expect(r.body.error.field).toBe('address_text');
    // typed
    r = await api.put(`/brands/me/branches/${main.id}`, b.token, { address_text: 'Shop 4,  MG Road, Labbipet', pincode: '520010' });
    expect(r.status).toBe(200);
    expect(r.body.data.branch).toMatchObject({ formattedAddress: 'Shop 4, MG Road, Labbipet', pincode: '520010', lat: null, lng: null, cityName: main.city_id ? expect.any(String) : null });
    const after = (await query(`SELECT * FROM brand_branches WHERE id = $1`, [main.id])).rows[0];
    expect(after.google_place_id).toBeNull(); expect(after.city_id).toBe(main.city_id); expect(after.state_id).toBe(main.state_id);
    r = await api.post(`/campaigns/${c.id}/sets`, b.token, { name: 'Set A', goal: 'engagement', shoot_mode: 'visit', go_live_date: w10.day(12), branch_id: main.id });
    expect(r.status).toBe(201);
  });

  it('a new branch is created from its four parts — street, pincode, state, city (registration-and-profile §1.1)', async () => {
    const b = await brand({ city: 'Hyderabad', state: 'Telangana' });
    const { rows: [hyd] } = await query(`SELECT c.id AS city_id, c.state_id FROM ref_cities c JOIN ref_states s ON s.id = c.state_id WHERE s.name = 'Telangana' AND c.name = 'Hyderabad'`);
    const r = await api.post('/brands/me/branches', b.token, { name: 'Kondapur', address_text: '2nd floor, Botanical Garden Rd, Kondapur', pincode: '500084', state_id: hyd.state_id, city_id: hyd.city_id, is_main: false });
    expect(r.status).toBe(201);
    expect(r.body.data.branch).toMatchObject({ name: 'Kondapur', formattedAddress: '2nd floor, Botanical Garden Rd, Kondapur', cityName: 'Hyderabad', stateName: 'Telangana', isMain: false });
    // no street → refused with the four-part wording; the Google search is gone
    const none = await api.post('/brands/me/branches', b.token, { name: 'Nowhere' });
    expect(none.status).toBe(422); expect(none.body.error.message).toBe('Enter the street address.');
  });
});

/* ───────────────────────────────────────────────────────────── the retired doors (Phase 2d, founder Q12) */

describe('the retired doors answer with a sentence, server-side (Phase 2d, Q12)', () => {
  it('the mode picker, flip-to-remote and the visit slot dance are switched off; the shipment half is not', async () => {
    const v = await w10.signedByBoth('engagement');
    const r1 = await api.post(`/contracts/${v.con.id}/production/initialise`, v.b.token, { mode: 'visit' });
    expect(r1.status).toBe(422); expect(r1.body.error.code).toBe('RETIRED_MODE_CHOICE'); expect(r1.body.error.message).toBe(MSG.RETIRED_MODE_CHOICE);
    const r2 = await api.post(`/production-events/${v.pe.id}/flip-to-remote`, v.cr.token, {});
    expect(r2.status).toBe(422); expect(r2.body.error.code).toBe('RETIRED_MODE_CHOICE');
    for (const [who, m, p, body] of [
      ['brand', 'post', `/contracts/${v.con.id}/production/visit-details`, { visit_address: 'x' }],
      ['creator', 'post', `/production-events/${v.pe.id}/propose-slot`, { visit_scheduled_at: new Date(Date.now() + 86400000).toISOString() }],
      ['creator', 'post', `/production-events/${v.pe.id}/accept`, {}],
      ['brand', 'post', `/production-events/${v.pe.id}/counter-propose`, {}],
    ]) {
      const r = await api.post(p, who === 'brand' ? v.b.token : v.cr.token, body);
      expect([p, r.status, r.body.error && r.body.error.code]).toEqual([p, 422, 'RETIRED_SLOT_DANCE']);
      expect(r.body.error.message).toBe(MSG.RETIRED_SLOT_DANCE);
    }
    expect((await w10.pe(v.con.id)).mode).toBe('visit');                 // nothing moved
    // the read door and the date range still answer, and the range is capped by the posting day inclusive
    expect((await api.get(`/contracts/${v.con.id}/production`, v.b.token)).status).toBe(200);
    const range = await api.get(`/contracts/${v.con.id}/production/date-range`, v.cr.token);
    expect(range.status).toBe(200);
    expect(range.body.data.range).toMatchObject({ basis: 'posting_date', earliest: w10.day(0), latest: w10.day(12), impossible: false });
    // a shipment event's accept is item 11's and is NOT retired here
    const s = await w10.signedByBoth('conversion', { mode: 'shipment' });
    const r3 = await api.post(`/production-events/${s.pe.id}/accept`, s.cr.token, {});
    expect(r3.body.error ? r3.body.error.code : 'ok').not.toBe('RETIRED_SLOT_DANCE');
  });
});

/* ───────────────────────────────────────────────────────────── the small defects (checks 48, §2.1, §2.3) */

describe('nothing reads contracts.status = \'active\' as a signature (check 48, approval §2.1)', () => {
  it('the deliverable heal does not invent deliverables for a seeded active-with-no-signatures contract', async () => {
    const b = await brand();
    const cr = await creator();
    const { rows: [c] } = await query(`INSERT INTO campaigns (brand_id, name, status) VALUES ($1,'Seeded','active') RETURNING id`, [b.brandId]);
    const { rows: [s] } = await query(`INSERT INTO campaign_sets (campaign_id, name, goal, assignment_mode, formats_json) VALUES ($1,'Set','engagement','handpick','[{"type":"reel","count":1}]') RETURNING id`, [c.id]);
    const { rows: [ci] } = await query(`INSERT INTO campaign_influencers (set_id, influencer_id, status, agreed_fee) VALUES ($1,$2,'contracted',9000) RETURNING id`, [s.id, cr.influencerId]);
    await query(`INSERT INTO contracts (campaign_influencer_id, status) VALUES ($1, 'active')`, [ci.id]);   // the seeded shape: active, no signatures
    const r = await api.get(`/influencers/me/campaigns/${ci.id}`, cr.token);
    expect(r.status).toBe(200);
    expect((await query(`SELECT count(*)::int n FROM deliverables WHERE campaign_influencer_id = $1`, [ci.id])).rows[0].n).toBe(0);
    // and a genuinely signed one still heals
    await query(`UPDATE contracts SET influencer_signed_at = now(), brand_signed_at = now() WHERE campaign_influencer_id = $1`, [ci.id]);
    const r2 = await api.get(`/influencers/me/campaigns/${ci.id}`, cr.token);
    expect(r2.status).toBe(200);
    expect((await query(`SELECT count(*)::int n FROM deliverables WHERE campaign_influencer_id = $1`, [ci.id])).rows[0].n).toBeGreaterThan(0);
  });

  it('48 · the source no longer carries the old test, and the only status=\'active\' WRITE is the countersign CAS', () => {
    expect(src('../src/controllers/influencer.controller.js')).not.toMatch(/contract\.status === 'active'/);
    expect(src('../src/controllers/production.controller.js')).not.toMatch(/status\s*=\s*'active'/);
    expect(src('../src/services/contractSign.service.js')).toMatch(/SET status = 'active', brand_signed_at = now\(\)/);
    // the roster's status list is real enum values only (approval §2.3)
    expect(src('../src/controllers/production.controller.js')).not.toMatch(/'live'/);
    expect(src('../src/controllers/production.controller.js')).toContain("ci.status IN ('contracted', 'active', 'completed')");
  });
});
