'use strict';

/**
 * ui-walk-fixes — board F (frames F2, F7), review fix: whose turn a shoot is, on the two lists.
 * Contract: features/ui-walk-fixes · spec U3, U11 · research C06 ("an explicit server flag is the
 * safer later step") · checks 19, 24
 *
 * Board F puts a button on a row when the step is yours and a tag when you are waiting. For a store
 * visit whose time is still being agreed the lists carried only the stage ('sent'), and 'sent'
 * covers both "the plan is with her" and "she asked for another time, it is with the brand" — the
 * turn lives on the visit's own conversation, which the lists never read. So the phone told each
 * side the opposite of the truth once she had countered.
 *
 * Two things are proved here, through the real endpoints:
 *   1. `shoot.yourMove` on the brand's set row and on her Active card says whose turn the visit
 *      is, at every stage, and follows the conversation's turn while the time is contested;
 *   2. the Remote line on both lists moves with the shoot (it was stuck on its first sentence:
 *      the query computed the parcel's facts and never handed them to the row).
 */

const { truncateAll } = require('./helpers/db');
const { query, api, resetReference } = require('./helpers/item3');
const { createAdminUser } = require('./helpers/factories');
const w10 = require('./helpers/item10');
const settings = require('../src/services/platformSettings.service');
const standardTerms = require('../src/services/standardTerms.service');

beforeEach(async () => { await truncateAll(); await resetReference(); settings._resetCache(); standardTerms._resetCache(); });
afterEach(() => { settings._resetCache(); standardTerms._resetCache(); });

const at = (day, hhmm = '11:00') => new Date(`${day}T${hhmm}:00+05:30`).toISOString();
const PLAN = (day = w10.day(3)) => ({ contactName: 'Ravi Menon', contactPhone: '+91 98490 11223', visitAt: at(day), durationText: 'About 2 hours', notes: 'Parking is behind the building.' });

const bSend    = (w) => api.post(`${w.url}/invitations/${w.ciId}/shoot/plan`, w.b.token, PLAN());
const bCounter = (w, body) => api.post(`${w.url}/invitations/${w.ciId}/shoot/thread/counter`, w.b.token, body);
const bAccept  = (w) => api.post(`${w.url}/invitations/${w.ciId}/shoot/thread/accept`, w.b.token);
const bConfirm = (w) => api.post(`${w.url}/invitations/${w.ciId}/shoot/confirm`, w.b.token);
const bShoot   = (w) => api.get(`${w.url}/invitations/${w.ciId}/shoot`, w.b.token);
const hShoot   = (w) => api.get(`/influencers/me/invitations/${w.ciId}/shoot`, w.cr.token);
const hAccept  = (w) => api.post(`/influencers/me/invitations/${w.ciId}/shoot/accept`, w.cr.token);
const hCounter = (w, body) => api.post(`/influencers/me/invitations/${w.ciId}/shoot/thread/counter`, w.cr.token, body);
const hAcceptC = (w) => api.post(`/influencers/me/invitations/${w.ciId}/shoot/thread/accept`, w.cr.token);
const hMove    = (w, body) => api.post(`/influencers/me/invitations/${w.ciId}/shoot/move`, w.cr.token, body);
const hAttend  = (w) => api.post(`/influencers/me/invitations/${w.ciId}/shoot/attended`, w.cr.token);
const okd = (r, status = 200) => { if (r.status !== status) throw new Error(`${r.status}: ${JSON.stringify(r.body)}`); return r; };

/** The creator's row on the brand's set screen — the same read the phone makes. */
async function brandRowOf(w) {
  const r = okd(await api.get(`/campaigns/${w.c.id}/sets/${w.s.id}/summary`, w.b.token));
  const groups = (r.body.data.creators && r.body.data.creators.groups) || {};
  for (const g of Object.values(groups)) for (const row of (g.rows || [])) if (row.id === w.ciId) return row;
  return null;
}
/** Her card under Active — the same read her Collabs tab makes. */
async function herCardOf(w) {
  const r = okd(await api.get('/influencers/me/invitations?tab=active', w.cr.token));
  return r.body.data.rows.find(x => x.id === w.ciId) || null;
}
const turns = async (w) => {
  const [row, card] = [await brandRowOf(w), await herCardOf(w)];
  return { stage: row.shoot.stage, brand: row.shoot.yourMove, her: card.shoot ? card.shoot.yourMove : null };
};

describe('a store visit: whose turn it is, on the brand\'s row and on her card', () => {
  it('follows the visit from the plan to the confirmation — and the conversation\'s turn while the time is contested', async () => {
    const w = await w10.signedByBoth('engagement');

    // Signed, nothing sent: the plan is the brand's. Her card carries no visit yet.
    expect(await turns(w)).toEqual({ stage: 'not_sent', brand: true, her: null });

    // The plan is with her.
    okd(await bSend(w), 201);
    expect(await turns(w)).toEqual({ stage: 'sent', brand: false, her: true });

    // She asks for another time. The stage is still 'sent' — and the turn is now the brand's.
    okd(await hCounter(w, { visitAt: at(w10.day(4), '16:00'), note: 'Afternoon suits me better.' }));
    expect(await turns(w)).toEqual({ stage: 'sent', brand: true, her: false });
    // The two lists agree with the two shoot screens (one rule: the conversation's turn).
    expect((await bShoot(w)).body.data.shoot.thread.negotiation.whoseMove).toBe('brand');
    expect((await hShoot(w)).body.data.shoot.can.accept).toBe(false);

    // The brand answers with a third time: back to her.
    okd(await bCounter(w, { visitAt: at(w10.day(5), '10:00') }));
    expect(await turns(w)).toEqual({ stage: 'sent', brand: false, her: true });
    expect((await hShoot(w)).body.data.shoot.can.accept).toBe(true);

    // She accepts it. A time is agreed: nobody owes a step until the visit.
    okd(await hAcceptC(w));
    expect(await turns(w)).toEqual({ stage: 'agreed', brand: false, her: false });

    // She asks to move the agreed time: the same conversation reopens, on the brand.
    okd(await hMove(w, { visitAt: at(w10.day(6), '15:00'), note: 'Family thing.' }));
    expect(await turns(w)).toEqual({ stage: 'sent', brand: true, her: false });
    okd(await bAccept(w));
    expect(await turns(w)).toEqual({ stage: 'agreed', brand: false, her: false });

    // The agreed time passes with nothing marked: the brand's row asks him for a new time.
    await query(`UPDATE production_events SET visit_scheduled_at = now() - interval '2 hours' WHERE id = $1`, [w.pe.id]);
    const passed = await brandRowOf(w);
    expect(passed.shoot.line).toMatch(/passed with nothing marked — send a new time$/);
    expect(passed.shoot.yourMove).toBe(true);
    expect((await herCardOf(w)).shoot.yourMove).toBe(false);

    // She marks the visit: the confirmation is his, and nobody else's.
    okd(await hAttend(w));
    expect(await turns(w)).toEqual({ stage: 'attended', brand: true, her: false });

    // Confirmed: the visit owes nobody anything.
    okd(await bConfirm(w));
    expect(await turns(w)).toEqual({ stage: 'complete', brand: false, her: false });
  });

  it('she accepts the plan directly (no conversation ever opens): hers until she does, nobody\'s after', async () => {
    const w = await w10.signedByBoth('conversion');
    okd(await bSend(w), 201);
    expect((await query(`SELECT count(*)::int n FROM negotiations WHERE production_event_id = $1`, [w.pe.id])).rows[0].n).toBe(0);
    expect(await turns(w)).toEqual({ stage: 'sent', brand: false, her: true });
    okd(await hAccept(w));
    expect(await turns(w)).toEqual({ stage: 'agreed', brand: false, her: false });
  });

  it('the flag is additive: the stage, the sentence and the visit time on both lists are what they were', async () => {
    const w = await w10.signedByBoth('engagement');
    expect((await brandRowOf(w)).shoot).toEqual({ stage: 'not_sent', line: 'Signed — plan the store visit', visitAt: null, yourMove: true });
    okd(await bSend(w), 201);
    const row = await brandRowOf(w);
    expect(Object.keys(row.shoot).sort()).toEqual(['line', 'stage', 'visitAt', 'yourMove']);
    expect(row.shoot.line).toMatch(/^Plan sent for .* waiting for Tanvi to answer$/);
    const card = await herCardOf(w);
    expect(Object.keys(card.shoot).sort()).toEqual(['delayed', 'line', 'stage', 'visitAt', 'yourMove']);
    expect(card.shoot.line).toMatch(/^Store visit planned for .*11:00 am$/);
  });
});

/* ───────────────────────────────────────────── the Remote line */

describe('a Remote shoot: the line on both lists moves with the shoot', () => {
  const B = (w) => `${w.url}/invitations/${w.ciId}/remote`;
  const C = (w) => `/influencers/me/invitations/${w.ciId}/remote`;

  async function remoteWorld() {
    const w = await w10.signedByBoth('conversion', { mode: 'shipment', wallet: 500000 });
    const { rows: [city] } = await query(`SELECT id, state_id FROM ref_cities WHERE name = 'Guntur' LIMIT 1`);
    await query(`UPDATE influencers SET city_id = $2, state_id = $3 WHERE id = $1`, [w.cr.influencerId, city.id, city.state_id]);
    return { ...w, city };
  }
  async function product(brandId) {
    const { rows: [p] } = await query(
      `INSERT INTO brand_products (brand_id, name, price, sku, is_active, pushed_to_store)
       VALUES ($1, 'Indigo Chanderi Saree', 2400, $2, true, true) RETURNING *`,
      [brandId, `SKU-${Math.random().toString(36).slice(2, 8).toUpperCase()}`]);
    await require('./helpers/sell').listedBeforeSending(brandId, p.id);
    return p;
  }
  async function courier(shipmentId, event) {
    const admin = await createAdminUser();
    okd(await api.post(`/admin/test-parcels/${shipmentId}/events`, admin.token, { event }));
  }
  const lines = async (w) => {
    const [row, card] = [await brandRowOf(w), await herCardOf(w)];
    return { stage: row.remote.stage, hers: card.remote.stage, brand: row.remote.line, her: card.remote.line };
  };

  it('address → products → on its way → delivered → checked → shot: each list says where it is, and agrees with the Remote screen', async () => {
    const w = await remoteWorld();
    expect(await lines(w)).toEqual({ stage: 'not_sent', hers: 'not_sent', brand: 'Waiting for her delivery address', her: 'Send your delivery address' });

    okd(await api.post(`${C(w)}/address`, w.cr.token, {
      name: 'Tanvi Suresh', phone: '9876511111', street: '11 Gandhi Road, Brodipet', pincode: '522002',
      stateId: w.city.state_id, cityId: w.city.id, note: 'Ring the bell twice', sizes: 'Top M, Bottom 28, Shoe 6',
    }));
    expect(await lines(w)).toEqual({ stage: 'sent', hers: 'sent', brand: 'Her address is here — pick the products', her: 'Address sent — waiting for your products' });

    const p = await product(w.brandId);
    okd(await api.put(`${B(w)}/lines`, w.b.token, { lines: [{ productId: p.id, quantity: 1, disposition: 'gift' }] }));
    const book = okd(await api.post(`${B(w)}/book`, w.b.token, { branchId: w.br.id, boxPreset: 'medium', weightKg: 1.2 }));
    const parcelId = book.body.data.shoot.parcel.id;
    expect(await lines(w)).toEqual({ stage: 'in_transit', hers: 'in_transit', brand: 'The parcel is on its way to her', her: 'Your products are on the way' });

    await courier(parcelId, 'collected');
    await courier(parcelId, 'delivered');
    expect(await lines(w)).toEqual({ stage: 'delivered', hers: 'delivered', brand: 'Delivered — she is checking it', her: 'Your parcel arrived — say what turned up' });
    const screen = okd(await api.get(C(w), w.cr.token)).body.data.shoot;
    expect(screen.stage).toBe('delivered');                                  // the card and the screen behind it agree

    okd(await api.post(`${C(w)}/check`, w.cr.token, { answers: screen.lines.map(l => ({ lineId: l.id, status: 'received' })) }));
    expect(await lines(w)).toEqual({ stage: 'checked', hers: 'checked', brand: 'Checked — waiting for her to shoot', her: 'Mark the shoot done when you have shot' });

    okd(await api.post(`${C(w)}/done`, w.cr.token, {}));
    expect(await lines(w)).toEqual({ stage: 'shot', hers: 'shot', brand: 'Shoot done', her: 'Shoot done' });
  });
});
