'use strict';

/**
 * Item 19 — Home and Needs You: the two lists across every stage of a collaboration, the rows the
 * set screen's rule cannot see, the cutoff, Delayed, the order, the count rows, money and the
 * fourth section, the first-day and quiet states, ownership, and a fixed number of queries.
 * Contract: features/item19-home · master rules v1.32 §24 · board BH1–BH6, CH1–CH5
 * Real API, real database; every state is reached through the doors a person uses.
 *
 * It also writes (WRITE_HOME19_FIXTURE=1) or checks the PARITY FIXTURE the phone's test reads:
 * the real rows seeded here with the server's verdict on each, so setRowStep / cardStep on the
 * phone are held to the same answer (Packages/Mobile/src/screens/__tests__/fixtures/home19-rows.json).
 */

const fs = require('fs');
const path = require('path');
const W = require('./helpers/item17');
const W14 = require('./helpers/item14');
const w10 = require('./helpers/item10');
const w12 = require('./helpers/item12');
const { brand, creator, setCreatorInvite } = require('./helpers/item3');
const { createAdminUser } = require('./helpers/factories');
const home = require('../src/services/home.service');
const db = require('../src/config/db');
const { todayInIndia, addDays } = require('../src/utils/indiaDay');

const { api, query } = W;
const day = (n) => addDays(todayInIndia(), n);

beforeAll(async () => {
  await W.fresh();
  W14.resetTree();
  await w12.startServer();
});
afterAll(() => w12.stopServer());

/* ───────────────────────────────────────────────────────── fixtures */

/** A campaign + set + creator + invitation under an EXISTING brand, so one brand has many rows. */
async function join(b, br, { goal = 'engagement', mode = 'visit', name = 'Tanvi Suresh', accept = true, posting = 12, terms = null } = {}) {
  const c = await w10.campaign(b, { name: `Campaign ${Math.random().toString(36).slice(2, 7)}` });
  const s = await w10.set(b, c.id, { goal, shoot_mode: mode, go_live_date: day(posting), ...(mode === 'visit' ? { branch_id: br.id } : {}) });
  const cr = await creator({ name });
  const t = await require('./helpers/sell').sellable(b.brandId, terms || (goal === 'engagement' ? w10.CONTENT : goal === 'hybrid' ? w10.HYBRID : w10.SALE));
  const r = await api.post(`/campaigns/${c.id}/sets/${s.id}/invitations`, b.token, { creators: [{ influencerId: cr.influencerId, terms: t }] });
  if (r.status !== 201) throw new Error(`invite: ${JSON.stringify(r.body)}`);
  const ciId = r.body.data.rows[0].id;
  if (accept) await api.post(`/influencers/me/invitations/${ciId}/accept`, cr.token);
  return { b, br, c, s, cr, ciId, brandId: b.brandId, url: `/campaigns/${c.id}/sets/${s.id}`, goal, mode };
}
async function brandWithBranch(wallet = 500000) {
  const b = await brand();
  const br = await w10.branch(b.brandId);
  await query(`UPDATE brands SET wallet_balance = $2 WHERE id = $1`, [b.brandId, wallet]);
  return { b, br };
}
async function setPostingDate(setId, d) {
  await query(`UPDATE campaign_sets SET go_live_date = $2::date, invites_close_at = ($2::date - 3) WHERE id = $1`, [setId, d]);
}
const at = (d, hh = 11) => `${d}T${String(hh).padStart(2, '0')}:00:00+05:30`;
const PLAN = (d = day(3)) => ({ contactName: 'Ravi Menon', contactPhone: '+91 98490 11223', visitAt: at(d), durationText: 'About 2 hours', notes: 'Parking is behind.' });

const bHome = async (b) => (await api.get('/brands/me/home', b.token)).body.data;
const cHome = async (c) => (await api.get('/influencers/me/home', c.token)).body.data;
const bList = async (b, list) => (await api.get(`/brands/me/home/${list}`, b.token)).body.data;
const cList = async (c, list) => (await api.get(`/influencers/me/home/${list}`, c.token)).body.data;
const kindsOf = (rows) => rows.map((r) => r.kind).sort();
const rowFor = (rows, w, kind) => rows.find((r) => r.open.ciId === w.ciId && (!kind || r.kind === kind));

/* ───────────────────────────────────────────────────────── the parity fixture */

const FIXTURE = path.join(__dirname, '..', '..', 'Packages', 'Mobile', 'src', 'screens', '__tests__', 'fixtures', 'home19-rows.json');
const FIXED_NOW = '2026-10-10T06:00:00.000Z';
const parity = [];
/** Only what setRowStep reads, with the visit time moved onto a fixed clock. */
function brandMin(row, now) {
  const sh = row.shoot ? { stage: row.shoot.stage, line: row.shoot.line ? 'x' : null, yourMove: row.shoot.yourMove,
    visitAt: row.shoot.visitAt ? (new Date(row.shoot.visitAt).getTime() < now ? '2026-10-09T06:00:00.000Z' : '2026-10-11T06:00:00.000Z') : null } : null;
  const step = (s) => (s ? { move: s.move, yourMove: s.yourMove, line: s.line ? 'x' : null, completed: !!s.completed } : null);
  return {
    group: row.group, status: row.status,
    actions: { signAgreement: !!row.actions.signAgreement, sendAgreement: !!row.actions.sendAgreement, withdrawAgreement: !!row.actions.withdrawAgreement },
    agreement: row.agreement ? { status: row.agreement.status } : null,
    negotiation: row.negotiation ? { open: row.negotiation.open, whoseMove: row.negotiation.whoseMove } : null,
    moveRequest: row.moveRequest ? { answer: row.moveRequest.answer } : null,
    content: step(row.content), goingLive: step(row.goingLive), shoot: sh,
    remote: row.remote ? { stage: row.remote.stage, line: row.remote.line ? 'x' : null } : null,
  };
}
/** Only what cardStep reads. */
function creatorMin(card) {
  const step = (s) => (s ? { move: s.move, yourMove: s.yourMove, line: s.line ? 'x' : null, completed: !!s.completed } : null);
  return {
    group: card.group, status: card.status, canAnswer: card.canAnswer,
    moveRequest: card.moveRequest ? { answer: card.moveRequest.answer } : null,
    content: step(card.content), goingLive: step(card.goingLive),
    shoot: card.shoot ? { stage: card.shoot.stage, line: card.shoot.line ? 'x' : null, yourMove: card.shoot.yourMove } : null,
    remote: card.remote ? { stage: card.remote.stage, line: card.remote.line ? 'x' : null } : null,
  };
}
/**
 * Record what the server decided for one collaboration, both sides. `label` names the state.
 * `addition` marks a verdict Home reaches from state the row rule cannot see (the phone's rule is
 * not expected to agree there): the brand's "book again", her "mark the visit" and "correct the
 * address", and a "make your posts" card that Home replaces with the "Shoppable post needed" row.
 */
const BRAND_ADDITIONS = ['rebook'];
async function record(label, w, { addition = [], replaced = false } = {}) {
  const now = Date.now();
  const bl = await home.brandLists(w.brandId, todayInIndia(), now);
  const mainB = [...bl.needs, ...bl.waiting].find((i) => i.ciId === w.ciId && i.row);
  // The row itself, whatever the verdict (a row in neither list is a verdict too).
  const { rows: [raw] } = await db.query(`${require('../src/services/invitationRows.service').rowSelect()} WHERE ci.id = $1`, [w.ciId]);
  const row = require('../src/services/invitationRows.service').brandRow(raw, w.goal);
  parity.push({ label, side: 'brand', now: FIXED_NOW, verdict: mainB ? { side: mainB.side, kind: mainB.kind } : null, addition: !!(mainB && BRAND_ADDITIONS.includes(mainB.kind)), row: brandMin(row, now) });

  const cl = await home.creatorLists(w.cr.influencerId, todayInIndia());
  const card = cl.cards.find((c) => c.id === w.ciId);
  const mainC = [...cl.needs, ...cl.waiting].find((i) => i.ciId === w.ciId && i.card);
  const verdict = mainC ? { side: mainC.side, kind: mainC.kind } : null;
  parity.push({ label, side: 'creator', verdict, addition: replaced || !!(verdict && addition.includes(verdict.kind)), row: creatorMin(card) });
}

afterAll(() => {
  parity.sort((a, b) => `${a.label}|${a.side}`.localeCompare(`${b.label}|${b.side}`));
  const text = `${JSON.stringify(parity, null, 1)}\n`;
  if (process.env.WRITE_HOME19_FIXTURE === '1') {
    fs.mkdirSync(path.dirname(FIXTURE), { recursive: true });
    fs.writeFileSync(FIXTURE, text);
  }
});

/* ═══════════════════════════════════════════ before both signatures (checks 3, 4, 7) */

describe('item 19 · before both signatures', () => {
  let b; let br; let A; let B; let C; let D; let E; let F;
  beforeAll(async () => {
    ({ b, br } = await brandWithBranch());
    A = await join(b, br, { name: 'Asha Invited', accept: false });                 // not answered
    B = await join(b, br, { name: 'Bina Accepted' });                               // agreement owed
    C = await join(b, br, { name: 'Chitra Sent' }); await w10.send(C);              // out for her signature
    D = await join(b, br, { name: 'Divya Signed' }); await w10.send(D); await w10.herSign(D);   // she signed
    E = await join(b, br, { name: 'Esha Counter', goal: 'conversion', mode: 'shipment', accept: false });
    const cnt = await api.post(`/influencers/me/invitations/${E.ciId}/counter`, E.cr.token, { terms: { commissionPct: 14 } });
    if (cnt.status !== 200 && cnt.status !== 201) throw new Error(`counter ${JSON.stringify(cnt.body)}`);
    F = await join(b, br, { name: 'Farah Moves', accept: false });
    const mv = await api.post(`/influencers/me/invitations/${F.ciId}/move-request`, F.cr.token, { goLiveDate: day(20) });
    if (mv.status !== 200 && mv.status !== 201) throw new Error(`move ${JSON.stringify(mv.body)}`);
    for (const [label, w] of [['pre · invited', A], ['pre · accepted, agreement owed', B], ['pre · agreement out', C], ['pre · she signed', D], ['pre · her counter', E], ['pre · date asked', F]]) {
      // eslint-disable-next-line no-await-in-loop
      await record(label, w);
    }
  });

  it('the brand: each row is in the right list with the set screen\'s action and screen', async () => {
    const needs = (await bList(b, 'needs')).rows;
    const waiting = (await bList(b, 'waiting')).rows;
    expect(rowFor(needs, D)).toMatchObject({ kind: 'sign', side: 'needs', open: { screen: 'agreement', campaignId: D.c.id, setId: D.s.id, ciId: D.ciId } });
    expect(rowFor(needs, D).line).toMatch(/^She signed\. Your signature is needed by \d+ \w{3}\.$/);
    expect(rowFor(needs, D).why).toMatch(/days left|Today|Tomorrow/);
    expect(rowFor(needs, D).who).toMatchObject({ type: 'creator', name: 'Divya Signed' });
    expect(rowFor(needs, D).context).toBe(`${D.c.name} · ${D.s.name}`);
    expect(rowFor(needs, B)).toMatchObject({ kind: 'send_agreement', open: { screen: 'agreementPreview' } });
    expect(rowFor(needs, E)).toMatchObject({ kind: 'reply', open: { screen: 'thread' } });
    expect(rowFor(needs, F)).toMatchObject({ kind: 'reply_move', open: { screen: 'thread' } });
    expect(rowFor(waiting, A)).toMatchObject({ kind: 'not_answered', tag: 'Not answered', group: 'creators', open: { screen: 'set' } });
    expect(rowFor(waiting, C)).toMatchObject({ kind: 'to_sign', tag: 'To sign', open: { screen: 'agreement' } });
    // nothing is in both lists (check 14)
    const ids = new Set(needs.map((r) => r.id));
    expect(waiting.some((r) => ids.has(r.id))).toBe(false);
    expect(rowFor(needs, A)).toBeUndefined();
    expect(rowFor(waiting, D)).toBeUndefined();
  });

  it('the brand: these are exactly the rows the set screen puts under "Your move" (check 3)', async () => {
    const needs = (await bList(b, 'needs')).rows.filter((r) => r.open.ciId);
    for (const w of [A, B, C, D, E, F]) {
      // eslint-disable-next-line no-await-in-loop
      const set = (await api.get(`${w.url}/summary`, b.token)).body.data;
      const yours = set.creators.groups.yourMove.rows.map((r) => r.id);
      expect(needs.filter((r) => r.open.setId === w.s.id).map((r) => r.open.ciId).sort()).toEqual(yours.sort());
    }
  });

  it('the creator: answer, sign and waiting, with her own words (check 4)', async () => {
    const a = await cHome(A.cr);
    expect(a.needs.total).toBe(1);
    expect(a.needs.rows[0]).toMatchObject({ kind: 'answer', who: { type: 'brand' }, open: { screen: 'invitation', ciId: A.ciId } });
    expect(a.needs.rows[0].line).toMatch(/^New invitation\. Pay for Content · Store Visit · ₹9,000\.$/);
    expect(a.needs.rows[0].why).toMatch(/^Reply by \d+ \w{3}$/);

    const c = await cHome(C.cr);
    expect(c.needs.rows[0]).toMatchObject({ kind: 'sign', open: { screen: 'agreement' } });
    expect(c.needs.rows[0].line).toMatch(/^The agreement is ready\. Review and sign by /);

    const d = await cHome(D.cr);
    expect(d.needs.total).toBe(0);
    expect(d.waiting.rows[0]).toMatchObject({ kind: 'brand_to_sign', tag: 'To sign', group: 'brands' });

    const e = await cHome(E.cr);
    expect(e.waiting.rows[0]).toMatchObject({ kind: 'counter_with_brand', open: { screen: 'thread' } });
    const f = await cHome(F.cr);
    expect(f.waiting.rows[0]).toMatchObject({ kind: 'date_request' });
    const bb = await cHome(B.cr);
    expect(bb.waiting.rows[0]).toMatchObject({ kind: 'agreement_coming' });
  });

  it('once the cutoff has passed, nothing before the signatures is offered or shown (check 7)', async () => {
    for (const w of [A, B, C, D, E, F]) {
      // eslint-disable-next-line no-await-in-loop
      await setPostingDate(w.s.id, day(1));   // invitations closed two days ago
    }
    const needs = (await bList(b, 'needs')).rows.filter((r) => r.open.ciId);
    const waiting = (await bList(b, 'waiting')).rows;
    expect(needs).toEqual([]);
    expect(waiting).toEqual([]);
    for (const w of [A, C]) {
      // eslint-disable-next-line no-await-in-loop
      const h = await cHome(w.cr);
      expect(h.needs.total).toBe(0);
    }
  });
});

/* ═══════════════════════════════════════════ the store visit (checks 5, 8, 9) */

describe('item 19 · the store visit', () => {
  let w;
  beforeAll(async () => { w = await w10.signedByBoth('engagement'); });

  it('signed: the plan is the brand\'s; she is waiting', async () => {
    await record('visit · plan not sent', w);
    const n = (await bList(w.b, 'needs')).rows;
    expect(rowFor(n, w)).toMatchObject({ kind: 'plan_visit', open: { screen: 'shoot' } });
    expect((await cHome(w.cr)).waiting.rows[0]).toMatchObject({ kind: 'brand_plan', open: { screen: 'shoot' } });
  });

  it('plan sent: hers to answer; once agreed and still to come, it is in neither list', async () => {
    const s = await api.post(`${w.url}/invitations/${w.ciId}/shoot/plan`, w.b.token, PLAN());
    expect([200, 201]).toContain(s.status);
    await record('visit · plan sent', w);
    expect((await cHome(w.cr)).needs.rows[0]).toMatchObject({ kind: 'answer_plan', open: { screen: 'shoot' } });
    expect(rowFor((await bList(w.b, 'waiting')).rows, w)).toMatchObject({ kind: 'her_time', tag: 'Her move' });

    const a = await api.post(`/influencers/me/invitations/${w.ciId}/shoot/accept`, w.cr.token);
    expect(a.status).toBe(200);
    await record('visit · agreed, still to come', w);
    expect(rowFor((await bList(w.b, 'needs')).rows, w)).toBeUndefined();
    expect(rowFor((await bList(w.b, 'waiting')).rows, w)).toBeUndefined();
    const h = await cHome(w.cr);
    // nothing about this collaboration in either list; her first 25% is in her wallet with nowhere
    // to send it, so the one row she has is the setup row for that
    expect([...(await cList(w.cr, 'needs')).rows, ...(await cList(w.cr, 'waiting')).rows].filter((r) => r.open.ciId === w.ciId)).toEqual([]);
    expect((await cList(w.cr, 'needs')).rows.map((r) => r.kind)).toEqual(['add_details']);
    expect(h.running.rows.map((r) => r.id)).toEqual([w.ciId]);   // it is in Running now
  });

  it('on the day of the visit she is asked to mark it; once the time passes the brand is asked for a new one (check 5)', async () => {
    await query(`UPDATE production_events SET visit_scheduled_at = now() + interval '30 minutes' WHERE id = $1`, [w.pe.id]);
    let h = await cHome(w.cr);
    // 30 minutes from now is "today" in India unless the suite runs in the last half hour of the day.
    if (h.needs.total) expect(h.needs.rows[0]).toMatchObject({ kind: 'mark_visit', open: { screen: 'shoot' } });
    await query(`UPDATE production_events SET visit_scheduled_at = now() - interval '2 hours' WHERE id = $1`, [w.pe.id]);
    await record('visit · time passed', w, { addition: ['mark_visit'] });
    h = await cHome(w.cr);
    expect(h.needs.rows[0]).toMatchObject({ kind: 'mark_visit' });
    const n = rowFor((await bList(w.b, 'needs')).rows, w);
    expect(n).toMatchObject({ kind: 'plan_visit' });
    expect(n.line).toMatch(/visit passed with nothing marked\. Send a new time\.$/);
  });

  it('she marks it: the brand confirms, and is told her next step waits', async () => {
    const m = await api.post(`/influencers/me/invitations/${w.ciId}/shoot/attended`, w.cr.token);
    expect(m.status).toBe(200);
    await record('visit · attended', w);
    const n = rowFor((await bList(w.b, 'needs')).rows, w);
    expect(n).toMatchObject({ kind: 'confirm_shoot', why: 'Her next step waits', open: { screen: 'shoot' } });
    expect((await cHome(w.cr)).waiting.rows[0]).toMatchObject({ kind: 'brand_confirm_visit' });
  });

  it('a collaboration past its posting date shows Delayed and comes first (checks 8, 9)', async () => {
    await query(`UPDATE campaign_influencers SET delayed_at = now(), delayed_stage = 'not_attended' WHERE id = $1`, [w.ciId]);
    const n = (await bList(w.b, 'needs')).rows;
    expect(rowFor(n, w).delayed).toBe(true);
    expect(n[0].open.ciId).toBe(w.ciId);
    // the set screen's own row is unchanged by item 19: it still does not say Delayed
    const set = (await api.get(`${w.url}/summary`, w.b.token)).body.data;
    expect(JSON.stringify(set)).not.toMatch(/"delayed":true/);
    await query(`UPDATE campaign_influencers SET delayed_at = NULL, delayed_stage = NULL WHERE id = $1`, [w.ciId]);
  });
});

/* ═══════════════════════════════════════════ Remote (check 5) */

describe('item 19 · the Remote shoot', () => {
  let w; let parcelId;
  const B = (x) => `${x.url}/invitations/${x.ciId}/remote`;
  const C = (x) => `/influencers/me/invitations/${x.ciId}/remote`;
  async function courier(shipmentId, event, extra = {}) {
    const admin = await createAdminUser();
    const r = await api.post(`/admin/test-parcels/${shipmentId}/events`, admin.token, { event, ...extra });
    if (r.status !== 200) throw new Error(`courier ${event}: ${JSON.stringify(r.body)}`);
    return r.body.data;
  }
  beforeAll(async () => {
    w = await w10.signedByBoth('engagement', { mode: 'shipment', wallet: 500000 });
    const { rows: [city] } = await query(`SELECT id, state_id FROM ref_cities WHERE name = 'Guntur' LIMIT 1`);
    await query(`UPDATE influencers SET city_id = $2, state_id = $3 WHERE id = $1`, [w.cr.influencerId, city.id, city.state_id]);
    w.city = city;
  });

  it('her address first, then the brand books', async () => {
    await record('remote · address not sent', w);
    expect((await cHome(w.cr)).needs.rows[0]).toMatchObject({ kind: 'send_address', open: { screen: 'remoteAddress', ciId: w.ciId } });
    expect(rowFor((await bList(w.b, 'waiting')).rows, w)).toMatchObject({ kind: 'her_address', tag: 'Her move' });

    const a = await api.post(`${C(w)}/address`, w.cr.token, { name: 'Tanvi Suresh', phone: '9876511111', street: '11 Gandhi Road, Brodipet', pincode: '522002', stateId: w.city.state_id, cityId: w.city.id });
    expect(a.status).toBe(200);
    await record('remote · address sent', w);
    expect(rowFor((await bList(w.b, 'needs')).rows, w)).toMatchObject({ kind: 'book_parcel', open: { screen: 'remote' } });
    expect((await cHome(w.cr)).waiting.rows[0]).toMatchObject({ kind: 'brand_ship' });
  });

  it('delivered: she says what turned up; a difference gives the brand its own row', async () => {
    const { rows: [p1] } = await query(`INSERT INTO brand_products (brand_id, name, price, sku, is_active, pushed_to_store) VALUES ($1,'Indigo Saree',2400,$2,true,true) RETURNING *`, [w.brandId, `SKU-${Math.random().toString(36).slice(2, 8)}`]);
    const { rows: [p2] } = await query(`INSERT INTO brand_products (brand_id, name, price, sku, is_active, pushed_to_store) VALUES ($1,'Silk Dupatta',900,$2,true,true) RETURNING *`, [w.brandId, `SKU-${Math.random().toString(36).slice(2, 8)}`]);
    const save = await api.put(`${B(w)}/lines`, w.b.token, { lines: [{ productId: p1.id, quantity: 1, disposition: 'return' }, { productId: p2.id, quantity: 1, disposition: 'gift' }] });
    expect(save.status).toBe(200);
    const book = await api.post(`${B(w)}/book`, w.b.token, { branchId: w.br.id, boxPreset: 'medium', weightKg: 1.2 });
    expect(book.status).toBe(200);
    parcelId = book.body.data.shoot.parcel.id;
    await record('remote · booked', w);
    expect(rowFor((await bList(w.b, 'waiting')).rows, w)).toMatchObject({ kind: 'in_transit', tag: 'In transit' });
    await courier(parcelId, 'collected');
    await courier(parcelId, 'delivered');
    await record('remote · delivered', w);
    expect((await cHome(w.cr)).needs.rows[0]).toMatchObject({ kind: 'check_parcel', open: { screen: 'remote' } });

    const read = (await api.get(C(w), w.cr.token)).body.data.shoot;
    const ret = read.lines.find((l) => l.disposition === 'return');
    const gift = read.lines.find((l) => l.disposition === 'gift');
    const chk = await api.post(`${C(w)}/check`, w.cr.token, { answers: [{ lineId: ret.id, status: 'received' }, { lineId: gift.id, status: 'damaged', note: 'Torn' }] });
    expect(chk.status).toBe(200);
    await record('remote · checked', w);
    expect((await cHome(w.cr)).needs.rows[0]).toMatchObject({ kind: 'mark_shoot' });
    const n = (await bList(w.b, 'needs')).rows;
    expect(rowFor(n, w, 'difference')).toMatchObject({ kind: 'difference', open: { screen: 'remote' } });
  });

  it('shoot done: "send the products back" has a door, beside her content step (two rows, one collaboration)', async () => {
    const done = await api.post(`${C(w)}/done`, w.cr.token, {});
    expect(done.status).toBe(200);
    // Item 21 (rules v1.34 §12.2): the content step opens once INFLX approves her first shoppable
    // post; until then the row is "Shoppable post needed". This test is about the return's door.
    expect(kindsOf((await cList(w.cr, 'needs')).rows.filter((r) => r.open.ciId === w.ciId))).toEqual(['post_needed', 'send_back']);
    await w12.firstPostApproved(w);
    const needs = (await cList(w.cr, 'needs')).rows.filter((r) => r.open.ciId === w.ciId);
    expect(kindsOf(needs)).toEqual(['send_back', 'send_content']);
    expect(needs.find((r) => r.kind === 'send_back')).toMatchObject({ open: { screen: 'remote', ciId: w.ciId }, line: 'Shoot done. Send the products back.' });
    // her Collabs card for it carries no such move — the gap this row fills
    const active = (await api.get('/influencers/me/invitations?tab=active', w.cr.token)).body.data.rows.find((r) => r.id === w.ciId);
    expect(active.remote.stage).toBe('shot');
  });

  it('the return reaches the store: the brand confirms it, whatever the content step is doing', async () => {
    const bk = await api.post(`${C(w)}/return/book`, w.cr.token, { pickupDay: addDays(todayInIndia(), 1) });
    expect(bk.status).toBe(200);
    expect((await cList(w.cr, 'needs')).rows.some((r) => r.kind === 'send_back')).toBe(false);
    const { rows: [ret] } = await query(`SELECT id FROM shipments WHERE production_event_id = $1 AND direction = 'return' ORDER BY created_at DESC LIMIT 1`, [w.pe.id]);
    await courier(ret.id, 'collected');
    await courier(ret.id, 'delivered');
    const n = (await bList(w.b, 'needs')).rows.filter((r) => r.open.ciId === w.ciId);
    expect(kindsOf(n)).toEqual(['confirm_return', 'difference']);
    expect(n.find((r) => r.kind === 'confirm_return').line).toBe('The products are back with you. Confirm the return.');
    // and she is under Waiting for her content (the main step), never in both with the same row
    expect(rowFor((await bList(w.b, 'waiting')).rows, w)).toMatchObject({ kind: 'her_content' });
  });

  it('a parcel that came back: the brand books again, she may correct the address', async () => {
    const x = await w10.signedByBoth('engagement', { mode: 'shipment', wallet: 500000 });
    await query(`UPDATE influencers SET city_id = $2, state_id = $3 WHERE id = $1`, [x.cr.influencerId, w.city.id, w.city.state_id]);
    await api.post(`${C(x)}/address`, x.cr.token, { name: 'Tanvi Suresh', phone: '9876511111', street: '11 Gandhi Road', pincode: '522002', stateId: w.city.state_id, cityId: w.city.id });
    const { rows: [p] } = await query(`INSERT INTO brand_products (brand_id, name, price, sku, is_active, pushed_to_store) VALUES ($1,'Kurta',1200,$2,true,true) RETURNING *`, [x.brandId, `SKU-${Math.random().toString(36).slice(2, 8)}`]);
    await api.put(`${B(x)}/lines`, x.b.token, { lines: [{ productId: p.id, quantity: 1, disposition: 'gift' }] });
    const book = await api.post(`${B(x)}/book`, x.b.token, { branchId: x.br.id, boxPreset: 'medium', weightKg: 1.2 });
    if (book.status !== 200) throw new Error(`book: ${JSON.stringify(book.body)}`);
    await courier(book.body.data.shoot.parcel.id, 'collected');
    await courier(book.body.data.shoot.parcel.id, 'returned_to_store', { reason: 'Address not found' });
    await record('remote · parcel came back', x, { addition: ['correct_address'] });
    expect(rowFor((await bList(x.b, 'needs')).rows, x)).toMatchObject({ kind: 'rebook', line: 'The parcel came back to the store. Book it once more.' });
    expect((await cHome(x.cr)).needs.rows[0]).toMatchObject({ kind: 'correct_address', open: { screen: 'remoteAddressCorrect' } });
  });
});

/* ═══════════════════════════════════════════ content and going live (checks 3, 6) */

describe('item 19 · Pay for Content', () => {
  let w;
  beforeAll(async () => { w = await w12.shotDone('engagement'); });

  it('send → review → post → confirm live → the final payment, each on the right side', async () => {
    await record('content · to send', w);
    expect((await cHome(w.cr)).needs.rows[0]).toMatchObject({ kind: 'send_content', open: { screen: 'content' } });
    expect(rowFor((await bList(w.b, 'waiting')).rows, w)).toMatchObject({ kind: 'her_content' });

    await w12.fillPackage(w);
    expect((await w12.submit(w)).status).toBe(200);
    await record('content · with the brand', w);
    expect(rowFor((await bList(w.b, 'needs')).rows, w)).toMatchObject({ kind: 'review', line: 'Her content is ready. Review it.', open: { screen: 'content' } });
    expect((await cHome(w.cr)).waiting.rows[0]).toMatchObject({ kind: 'review_content', tag: 'In review' });

    expect((await w12.approve(w)).status).toBe(200);
    await record('content · approved', w);
    expect((await cHome(w.cr)).needs.rows[0]).toMatchObject({ kind: 'post_and_link' });

    await w12.proveAll(w);
    expect((await w12.posted(w)).status).toBe(200);
    await record('content · posted', w);
    const n = rowFor((await bList(w.b, 'needs')).rows, w);
    expect(n).toMatchObject({ kind: 'confirm_live', why: 'Her payment waits', open: { screen: 'content' } });
    expect((await cHome(w.cr)).waiting.rows[0]).toMatchObject({ kind: 'confirm_live' });

    expect((await w12.confirmLive(w)).status).toBe(200);
    await record('content · live', w);
    const bw = rowFor((await bList(w.b, 'waiting')).rows, w);
    expect(bw).toMatchObject({ kind: 'final_payment', tag: 'Automatic', group: 'inflx', tone: 'ended' });
    expect(bw.line).toMatch(/^The final payment goes out on \d+ \w{3}\.$/);
    expect((await cHome(w.cr)).waiting.rows[0]).toMatchObject({ kind: 'final_payment', group: 'inflx' });
  });
});

describe('item 19 · Pay for Sale and Hybrid going live (check 6)', () => {
  it('posts owed, a post with INFLX, then the social version and the brand\'s confirmation', async () => {
    const w = await W14.world({ min: 1 });
    await record('sale · no post yet', w, { replaced: true });
    let h = await cList(w.cr, 'needs');
    // "Shoppable post needed" carries the count; the collaboration row does not repeat it
    expect(kindsOf(h.rows)).toEqual(['post_needed']);
    expect(h.rows[0]).toMatchObject({ who: { type: 'icon', name: 'Shoppable post needed' }, open: { screen: 'createPost', ciId: w.ciId } });
    expect(h.rows[0].line).toMatch(/You have made 0 of 1\.$/);
    expect(rowFor((await bList(w.b, 'waiting')).rows, w)).toMatchObject({ kind: 'her_posts' });

    const postId = await W14.sentPost(w);
    const wl = await cList(w.cr, 'waiting');
    expect(wl.rows.find((r) => r.kind === 'post_in_review')).toMatchObject({ group: 'inflx', tag: 'With INFLX', open: { screen: 'postStatus', postId } });

    const admin = await createAdminUser();
    await W14.approvePost(admin, postId);
    await record('sale · post approved', w);
    h = await cList(w.cr, 'needs');
    expect(h.rows.map((r) => r.kind)).toContain('send_social');
    expect(h.rows.map((r) => r.kind)).not.toContain('post_needed');

    await W14.toPosted(w, postId);
    await record('sale · posted', w);
    const n = rowFor((await bList(w.b, 'needs')).rows, w);
    expect(n).toMatchObject({ kind: 'confirm_live', open: { screen: 'goingLive' }, why: null });   // Pay for Sale: no payment rides on it
  });

  it('Hybrid: the brand\'s confirmation carries her payment', async () => {
    const w = await W14.world({ goal: 'hybrid', min: 1 });
    const postId = await W14.sentPost(w);
    await W14.approvePost(await createAdminUser(), postId);
    await W14.toPosted(w, postId);
    await record('hybrid · posted', w);
    expect(rowFor((await bList(w.b, 'needs')).rows, w)).toMatchObject({ kind: 'confirm_live', why: 'Her payment waits', open: { screen: 'goingLive' } });
  });
});

/* ═══════════════════════════════════════════ count rows and setup (checks 11, 12, 13) */

describe('item 19 · pitches, the pool, orders and setup', () => {
  it('a new pitch is one row for the brand; a counter makes it her row', async () => {
    const b = await brand({ business_name: 'Kalamkari Co' });
    const c = await creator({ name: 'Priya Sharma' });
    const r = await api.post('/influencers/me/pitches', c.token, { brandId: b.brandId, shootMode: 'shipment', proposedGoLiveDate: day(20),
      message: 'I shoot ethnic wear every week and my saves are strong. I would love to work with you.', goal: 'conversion', commissionPct: 12, scope: 'store' });
    expect(r.status).toBe(201);
    const id = r.body.data.pitch.id;
    let n = (await bList(b, 'needs')).rows;
    expect(n).toHaveLength(1);
    expect(n[0]).toMatchObject({ kind: 'pitches', count: 1, who: { type: 'icon', name: '1 new pitch' }, open: { screen: 'pitches' } });
    expect((await cList(c, 'waiting')).rows[0]).toMatchObject({ kind: 'pitch_waiting', group: 'pitches', tag: 'Sent', open: { screen: 'pitch', pitchId: id } });
    expect((await api.get('/brands/me/pitches', b.token)).body.data.total).toBe(1);

    const cnt = await api.post(`/brands/me/pitches/${id}/thread/counter`, b.token, { commissionPct: 10 });
    expect([200, 201]).toContain(cnt.status);
    n = (await bList(b, 'needs')).rows;
    expect(n.find((x) => x.kind === 'pitches')).toBeUndefined();
    expect((await cList(c, 'needs')).rows[0]).toMatchObject({ kind: 'pitch_reply', who: { type: 'brand', name: 'Kalamkari Co' }, open: { screen: 'pitchThread', pitchId: id } });
  });

  it('a creator who agreed and needs a set is one row, counted as the pool counts it', async () => {
    const { b, br } = await brandWithBranch();
    const w = await join(b, br, { accept: false });
    await api.post(`/influencers/me/invitations/${w.ciId}/move-request`, w.cr.token, { goLiveDate: day(20) });
    const ans = await api.post(`${w.url}/invitations/${w.ciId}/move-answer`, b.token, { answer: 'agreed' });
    expect(ans.status).toBe(200);
    const n = (await bList(b, 'needs')).rows;
    expect(n.find((x) => x.kind === 'pool')).toMatchObject({ count: 1, who: { name: '1 creator agreed, needs a set' }, open: { screen: 'pool' } });
    expect((await api.get('/brands/me/pool', b.token)).body.data.total).toBe(1);
    expect((await cList(w.cr, 'waiting')).rows[0]).toMatchObject({ kind: 'pooled' });
  });

  it('orders to pack is one row that opens the website; with sales and no bank account, "Add your bank account"', async () => {
    const w = await W.saleWorld();
    let n = (await bList(w.b, 'needs')).rows;
    expect(n.find((x) => x.kind === 'orders')).toBeUndefined();
    expect(n.find((x) => x.kind === 'add_bank')).toBeUndefined();   // a loaded wallet alone asks for nothing
    await W.order(w, [0]);
    n = (await bList(w.b, 'needs')).rows;
    expect(n.find((x) => x.kind === 'orders')).toMatchObject({ count: 1, who: { name: '1 order to pack' }, open: { screen: 'ordersWeb' }, context: 'Opens the website' });
    expect(n.find((x) => x.kind === 'add_bank')).toMatchObject({ open: { screen: 'walletDetails' } });
    const parcels = (await api.get('/brands/me/parcels?status=confirmed', w.b.token)).body.data.parcels;
    expect(parcels).toHaveLength(1);
    await W.brandBank(w);
    expect((await bList(w.b, 'needs')).rows.find((x) => x.kind === 'add_bank')).toBeUndefined();
  });

  it('the creator\'s setup rows appear only when true, and a failed withdrawal rises above them', async () => {
    const c = await creator({ name: 'Meera Rao' });
    let n = (await cList(c, 'needs')).rows;
    expect(n).toEqual([]);
    await query(`UPDATE influencers SET wallet_balance = 5000 WHERE id = $1`, [c.influencerId]);
    await setCreatorInvite(c.influencerId, { open: false });
    n = (await cList(c, 'needs')).rows;
    // "Add payment details" blocks money, so it sorts above a row that does not (H7)
    expect(n.map((r) => r.kind)).toEqual(['add_details', 'paused']);
    expect(n[0]).toMatchObject({ who: { type: 'icon', name: 'Add payment details' }, open: { screen: 'walletDetails' } });
    expect(n[1]).toMatchObject({ who: { type: 'icon', name: 'Invitations are paused' }, open: { screen: 'invitationSettings' } });
    expect((await cHome(c)).setup.invitations.state).toBe('paused');
    // paid by UPI: the row goes
    await W.creatorUpi({ cr: c });
    expect((await cList(c, 'needs')).rows.map((r) => r.kind)).toEqual(['paused']);
  });
});

/* ═══════════════════════════════════════════ the order (check 9) */

describe('item 19 · the order of the list', () => {
  it('dates in the next three days and Delayed first, then what holds someone up, then the rest; oldest first inside', () => {
    const today = todayInIndia();
    const items = [
      { id: 'rest-old', side: 'needs', blocks: false, since: '2026-01-01T00:00:00Z' },
      { id: 'blocks-new', side: 'needs', blocks: true, since: '2026-06-01T00:00:00Z' },
      { id: 'blocks-old', side: 'needs', blocks: true, since: '2026-02-01T00:00:00Z' },
      { id: 'far-date', side: 'needs', blocks: true, date: addDays(today, 9), since: '2026-01-15T00:00:00Z' },
      { id: 'soon-2', side: 'needs', blocks: false, date: addDays(today, 2) },
      { id: 'soon-0', side: 'needs', blocks: true, date: today },
      { id: 'delayed', side: 'needs', blocks: true, delayed: true, date: addDays(today, -4) },
      { id: 'day-4', side: 'needs', blocks: false, date: addDays(today, 4), since: '2026-03-01T00:00:00Z' },
    ];
    expect(home.sortNeeds(items, today).map((i) => i.id)).toEqual(['delayed', 'soon-0', 'soon-2', 'far-date', 'blocks-old', 'blocks-new', 'rest-old', 'day-4']);
  });

  it('on a real brand: the signature closing in two days is first, a pitch last', async () => {
    const { b, br } = await brandWithBranch();
    const far = await join(b, br, { name: 'Far Away', posting: 30 });                          // agreement owed, weeks away
    const near = await join(b, br, { name: 'Near Cutoff' }); await w10.send(near); await w10.herSign(near);
    await setPostingDate(near.s.id, day(5));                                                    // its cutoff is now two days away
    const c = await creator({ name: 'Pitcher' });
    await api.post('/influencers/me/pitches', c.token, { brandId: b.brandId, shootMode: 'shipment', proposedGoLiveDate: day(25),
      message: 'I shoot ethnic wear every week and my saves are strong. I would love to work with you.', goal: 'conversion', commissionPct: 12, scope: 'store' });
    const n = (await bList(b, 'needs')).rows;
    expect(n.map((r) => r.kind)).toEqual(['sign', 'send_agreement', 'pitches']);
    expect(n[0].open.ciId).toBe(near.ciId);
    expect(n[1].open.ciId).toBe(far.ciId);
    // Home shows the first three; the count is the whole list (check 2)
    const h = await bHome(b);
    expect(h.needs.total).toBe(3);
    expect(h.needs.rows.map((r) => r.id)).toEqual(n.slice(0, 3).map((r) => r.id));
  });
});

/* ═══════════════════════════════════════════ money, the fourth section, states (checks 2, 15, 16, 17) */

describe('item 19 · money, Campaigns / Running now, and the two special states', () => {
  it('the money lines are the Wallet\'s own figures, to the rupee (check 15)', async () => {
    const w = await w12.shotDone('engagement');
    const h = await bHome(w.b);
    const wallet = (await api.get('/brands/me/wallet', w.b.token)).body.data.figures;
    expect(h.money.lines).toEqual([
      { key: 'available', amount: wallet.available },
      { key: 'locked', amount: wallet.locked, count: wallet.lockedCount },
      { key: 'sales', amount: wallet.salesComing, count: wallet.salesComingCount },
    ]);
    expect(h.money.lines[1].amount).toBeGreaterThan(0);

    const c = await cHome(w.cr);
    const hers = (await api.get('/influencers/me/wallet', w.cr.token)).body.data.figures;
    expect(c.money.lines).toEqual([
      { key: 'available', amount: hers.available },
      { key: 'payments', amount: hers.payments, count: hers.paymentsCount, nextAt: hers.nextPaymentAt },
      { key: 'commission', amount: hers.commission, count: hers.commissionCount },
    ]);
    expect(c.money.lines[0].amount).toBeGreaterThan(0);   // her first 25%
  });

  it('Campaigns is the Campaigns tab\'s Live cards; Running now is Collabs › Active (check 16)', async () => {
    const { b, br } = await brandWithBranch();
    const one = await join(b, br, { name: 'One', posting: 20 });
    const two = await join(b, br, { name: 'Two', posting: 10 });
    await w10.campaign(b, { name: 'An empty draft' });
    const h = await bHome(b);
    const live = (await api.get('/campaigns/summary?state=live', b.token)).body.data;
    expect(h.running.kind).toBe('campaigns');
    expect(h.running.total).toBe(live.total);
    expect(h.running.counts).toEqual({ live: 2, draft: 1 });
    // nearest posting date first
    expect(h.running.rows.map((r) => r.id)).toEqual([two.c.id, one.c.id]);
    for (const r of h.running.rows) {
      const card = live.campaigns.find((c) => c.id === r.id);
      expect(r).toEqual({ id: card.id, name: card.name, state: 'live', setCount: card.setCount, nextPostingDate: card.nextPostingDate, counts: card.counts });
    }

    const s = await w10.signedByBoth('hybrid');
    const c = await cHome(s.cr);
    const active = (await api.get('/influencers/me/invitations?tab=active', s.cr.token)).body.data;
    expect(c.running).toMatchObject({ kind: 'collaborations', total: active.total });
    expect(c.running.rows[0]).toMatchObject({ id: s.ciId, aim: 'Hybrid', earn: '₹5,000 + 10%', chip: 'Active', postingDate: active.rows[0].postingDate, open: { ciId: s.ciId } });
    expect(c.running.rows[0].brand.name).toBe(active.rows[0].brand.name);
  });

  it('first day: nothing at all, and the screen is told so; a quiet day is not a first day (check 17)', async () => {
    const b = await brand();
    const h = await bHome(b);
    expect(h).toMatchObject({ firstDay: true, needs: { total: 0, rows: [] }, waiting: { total: 0 }, running: { total: 0 } });
    expect(h.me.name).toBe(b.name);

    const c = await creator({ name: 'Ananya Rao', handle: 'ananyarao' });
    const ch = await cHome(c);
    expect(ch).toMatchObject({ firstDay: true, me: { name: 'Ananya' }, storeLink: 'inflx.in/s/ananyarao' });
    expect(ch.setup.invitations.state).toBe('open');

    // a brand with a campaign and nothing owed is quiet, not new
    await w10.campaign(b, { name: 'Just a draft' });
    expect((await bHome(b)).firstDay).toBe(false);
  });

  it('the tab count is the list\'s count, with the bell\'s unread (check 18, 19)', async () => {
    const w = await w10.signedByHer('engagement');
    const count = (await api.get('/brands/me/home/count', w.b.token)).body.data;
    const list = await bList(w.b, 'needs');
    expect(count.needs).toBe(list.total);
    const notes = (await api.get('/notifications', w.b.token)).body.data;
    expect(count.unread).toBe(notes.unread_count);
    expect(count.unread).toBeGreaterThan(0);          // "she signed" was sent to the brand
    // …and the notice names the screen the brand's list opens
    expect(notes.notifications.some((n) => n.data_json && n.data_json.screen)).toBe(true);
    const hers = (await api.get('/influencers/me/home/count', w.cr.token)).body.data;
    expect(hers.needs).toBe((await cList(w.cr, 'needs')).total);
  });
});

/* ═══════════════════════════════════════════ ownership and load (checks 22, 23) */

describe('item 19 · whose rows, and how many queries', () => {
  it('one brand never sees another\'s rows; one creator never sees another\'s (check 22)', async () => {
    const mine = await w10.signedByHer('engagement');
    const other = await w10.signedByHer('engagement');
    const n = (await bList(mine.b, 'needs')).rows;
    expect(n.some((r) => r.open.ciId === other.ciId)).toBe(false);
    expect(n.some((r) => r.open.ciId === mine.ciId)).toBe(true);
    const w = (await cList(mine.cr, 'waiting')).rows;
    expect(w.every((r) => r.open.ciId === mine.ciId)).toBe(true);
    // the wrong role is refused outright
    expect((await api.get('/brands/me/home', mine.cr.token)).status).toBe(403);
    expect((await api.get('/influencers/me/home', mine.b.token)).status).toBe(403);
    expect((await api.get('/brands/me/home')).status).toBe(401);
  });

  it('the read runs the same number of queries for one collaboration as for five (check 23)', async () => {
    const { b, br } = await brandWithBranch();
    await join(b, br, { name: 'First' });
    const spy = jest.spyOn(db, 'query');
    await home.brandLists(b.brandId);
    const one = spy.mock.calls.length;
    spy.mockClear();
    for (const name of ['Second', 'Third', 'Fourth', 'Fifth']) {
      // eslint-disable-next-line no-await-in-loop
      await join(b, br, { name });
    }
    spy.mockClear();
    await home.brandLists(b.brandId);
    const five = spy.mock.calls.length;
    spy.mockRestore();
    expect(five).toBe(one);
    expect(one).toBeLessThanOrEqual(8);
  });
});

/* ═══════════════════════════════════════════ the phone's parity fixture */

describe('item 19 · the parity fixture', () => {
  it('the verdicts recorded here are the ones the phone\'s test was built on', () => {
    const now = parity.map((p) => `${p.label} | ${p.side} | ${p.verdict ? `${p.verdict.side}:${p.verdict.kind}` : 'neither'}`).sort();
    expect(now.length).toBeGreaterThan(30);
    if (process.env.WRITE_HOME19_FIXTURE === '1') return;
    const saved = JSON.parse(fs.readFileSync(FIXTURE, 'utf8')).map((p) => `${p.label} | ${p.side} | ${p.verdict ? `${p.verdict.side}:${p.verdict.kind}` : 'neither'}`).sort();
    expect(now).toEqual(saved);
  });
});
