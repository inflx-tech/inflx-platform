'use strict';

/**
 * Item 10 — Phase 2c: the shoot flow through the endpoints, the two jobs, the reminder lane,
 * Needs You, and the one sentence that makes the auto-confirm safe: NO MONEY MOVES.
 * Contract: features/item10-store-visit · checks 4–10, 15–29, 43, 45–47 (and 21)
 */

const { truncateAll } = require('./helpers/db');
const { query, api, resetReference, brand, creator } = require('./helpers/item3');
const w10 = require('./helpers/item10');
const settings = require('../src/services/platformSettings.service');
const standardTerms = require('../src/services/standardTerms.service');
const shootPlan = require('../src/services/shootPlan.service');
const delayedJob = require('../src/jobs/collab-delayed.job');
const remindersJob = require('../src/jobs/shoot-reminders.job');
const setExpiryJob = require('../src/jobs/set-expiry.job');
const { MSG, NOTIFY } = require('../src/services/productionCopy');
const { todayInIndia, addDays } = require('../src/utils/indiaDay');

beforeEach(async () => { await truncateAll(); await resetReference(); settings._resetCache(); standardTerms._resetCache(); });
afterEach(() => { settings._resetCache(); standardTerms._resetCache(); });

const at = (day, hhmm = '11:00') => new Date(`${day}T${hhmm}:00+05:30`).toISOString();
const PLAN = (day = w10.day(3)) => ({ contactName: 'Ravi Menon', contactPhone: '+91 98490 11223', visitAt: at(day), durationText: 'About 2 hours', notes: 'Parking is behind the building.' });

const bShoot  = (w) => api.get(`${w.url}/invitations/${w.ciId}/shoot`, w.b.token);
const bSend   = (w, body) => api.post(`${w.url}/invitations/${w.ciId}/shoot/plan`, w.b.token, body || PLAN());
const bCounter= (w, body) => api.post(`${w.url}/invitations/${w.ciId}/shoot/thread/counter`, w.b.token, body);
const bAccept = (w) => api.post(`${w.url}/invitations/${w.ciId}/shoot/thread/accept`, w.b.token);
const bMove   = (w, body) => api.post(`${w.url}/invitations/${w.ciId}/shoot/move`, w.b.token, body);
const bConfirm= (w) => api.post(`${w.url}/invitations/${w.ciId}/shoot/confirm`, w.b.token);
const hShoot  = (w) => api.get(`/influencers/me/invitations/${w.ciId}/shoot`, w.cr.token);
const hAccept = (w) => api.post(`/influencers/me/invitations/${w.ciId}/shoot/accept`, w.cr.token);
const hCounter= (w, body) => api.post(`/influencers/me/invitations/${w.ciId}/shoot/thread/counter`, w.cr.token, body);
const hAcceptC= (w) => api.post(`/influencers/me/invitations/${w.ciId}/shoot/thread/accept`, w.cr.token);
const hMove   = (w, body) => api.post(`/influencers/me/invitations/${w.ciId}/shoot/move`, w.cr.token, body);
const hAttend = (w) => api.post(`/influencers/me/invitations/${w.ciId}/shoot/attended`, w.cr.token);
const peRow   = (w) => query(`SELECT * FROM production_events WHERE id = $1`, [w.pe.id]).then(r => r.rows[0]);
const notifs  = (userId, type) => query(`SELECT type, body FROM notifications WHERE user_id = $1 ${type ? 'AND type = $2' : ''} ORDER BY created_at`, type ? [userId, type] : [userId]).then(r => r.rows);
const log     = (w) => query(`SELECT action, metadata FROM production_event_log WHERE production_event_id = $1 ORDER BY created_at`, [w.pe.id]).then(r => r.rows);
const code = (r) => r.body && r.body.error && r.body.error.code;

async function agreed(w) { await bSend(w); expect((await hAccept(w)).status).toBe(200); return w; }
/** Move the agreed time into the past by SQL — the visit day is today, the clock has passed. */
const timePassed = (w) => query(`UPDATE production_events SET visit_scheduled_at = now() - interval '2 hours' WHERE id = $1`, [w.pe.id]);
async function attended(w) { await agreed(w); await timePassed(w); expect((await hAttend(w)).status).toBe(200); return w; }

/* ───────────────────────────────────────────── V1 · the gate card and the plan (4–9, 25, 45, 46) */

describe('the plan — send, reveal, refusals (checks 4–9, 25, 45, 46)', () => {
  it('4 · V1 shows the real gate per Aim: PfC ticks with amounts; Pay for Sale shows the signature only', async () => {
    const w = await w10.signedByBoth('engagement');
    const r = await bShoot(w);
    expect(r.status).toBe(200);
    const s = r.body.data.shoot;
    expect(s.gate).toMatchObject({ open: true, money: { required: true, locked: 9720, released: 2250 } });
    expect(s.stage).toBe('not_sent'); expect(s.can.send).toBe(true); expect(s.plan.sentAt).toBeNull();
    expect(s.steps.map(x => x.state)).toEqual(['done', 'now', 'later', 'later']);
    expect(s.contactPrefill.phone).toBeTruthy();
    const ps = await w10.signedByBoth('conversion');
    expect((await bShoot(ps)).body.data.shoot.gate.money.required).toBe(false);
  });

  it('8 / 25 · before send she sees the city only; the send reveals the street address and the number', async () => {
    const w = await w10.signedByBoth('engagement');
    let h = await hShoot(w);
    expect(h.status).toBe(200);
    expect(h.body.data.shoot.plan.branch.city).toBe('Hyderabad');
    expect(h.body.data.shoot.plan.branch.address).toBeNull();
    expect(h.body.data.shoot.plan.contact).toBeNull();
    expect(JSON.stringify(h.body)).not.toMatch(/Road No\. 12|98490/);
    expect(h.body.data.shoot.contactPrefill).toBeUndefined();

    const s = await bSend(w);
    expect(s.status).toBe(201);
    expect(s.body.data.shoot.stage).toBe('sent');
    h = await hShoot(w);
    expect(h.body.data.shoot.plan.branch.address).toMatch(/Road No\. 12/);
    expect(h.body.data.shoot.plan.branch.mapsUrl).toMatch(/google\.com\/maps/);
    expect(h.body.data.shoot.plan.contact).toEqual({ name: 'Ravi Menon', phone: '+919849011223' });
    expect(h.body.data.shoot.plan.notes).toBe('Parking is behind the building.');
    expect(h.body.data.shoot.can).toMatchObject({ accept: true, counter: true, markAttended: false });
    // the row snapshotted the branch; the log and her notification say so
    const pe = await peRow(w);
    expect(pe.visit_branch_name).toBe('Banjara Hills'); expect(pe.visit_address).toMatch(/Banjara/); expect(pe.branch_id).toBe(w.br.id);
    expect((await notifs(w.cr.userId, NOTIFY.PLAN_SENT.type))).toHaveLength(1);
    // her Active card carries the line
    const list = await api.get('/influencers/me/invitations?tab=active', w.cr.token);
    const card = list.body.data.rows.find(x => x.id === w.ciId);
    expect(card.shoot.line).toMatch(/^Store visit planned for .*11:00 am$/);
  });

  it('5 / 9 · the branch and mode cannot be changed by the API, and a sent plan cannot be edited — only a new time', async () => {
    const w = await w10.signedByBoth('engagement');
    await bSend(w, { ...PLAN(), branchId: '00000000-0000-0000-0000-000000000000', mode: 'shipment' });
    const pe = await peRow(w);
    expect(pe.branch_id).toBe(w.br.id); expect(pe.mode).toBe('visit');
    const again = await bSend(w, { ...PLAN(), contactName: 'Someone Else' });
    expect(again.status).toBe(422); expect(code(again)).toBe('PLAN_ALREADY_SENT');
    expect(again.body.error.message).toBe(MSG.PLAN_ALREADY_SENT('Tanvi'));
    expect((await peRow(w)).visit_contact_name).toBe('Ravi Menon');
  });

  it('6 / 7 · a time after the posting day, or in the past, is refused; required fields are named', async () => {
    const w = await w10.signedByBoth('engagement');
    const posting = (await query(`SELECT go_live_date::text d FROM campaign_sets WHERE id = $1`, [w.s.id])).rows[0].d;
    let r = await bSend(w, PLAN(w10.day(13)));
    expect(r.status).toBe(422); expect(code(r)).toBe('TIME_AFTER_POSTING'); expect(r.body.error.message).toBe(MSG.TIME_AFTER_POSTING(posting));
    r = await bSend(w, { ...PLAN(), visitAt: new Date(Date.now() - 60000).toISOString() });
    expect(code(r)).toBe('TIME_IN_PAST');
    r = await bSend(w, { ...PLAN(), contactName: '' });
    expect(r.body.error.field).toBe('contactName'); expect(r.body.error.message).toBe(MSG.CONTACT_NAME);
    r = await bSend(w, { ...PLAN(), contactPhone: '12345' });
    expect(r.body.error.field).toBe('contactPhone');
    r = await bSend(w, { ...PLAN(), notes: 'x'.repeat(501) });
    expect(r.body.error.message).toBe(MSG.NOTES_LONG);
    expect((await peRow(w)).plan_sent_at).toBeNull();
    // 23:59 IST on the posting day is allowed
    r = await bSend(w, PLAN(posting));
    expect(r.status).toBe(201);
  });

  it('45 · a branch whose address was cleared after the set was made is refused at send, by name', async () => {
    const w = await w10.signedByBoth('engagement');
    await query(`UPDATE brand_branches SET formatted_address = NULL WHERE id = $1`, [w.br.id]);
    const r = await bSend(w);
    expect(r.status).toBe(422); expect(code(r)).toBe('BRANCH_NO_ADDRESS');
    expect(r.body.error.message).toBe(MSG.BRANCH_NO_ADDRESS('Banjara Hills'));
  });

  it('46 · a legacy collaboration with no posting date reads without crashing and refuses a plan', async () => {
    const w = await w10.signedByBoth('engagement');
    await query(`UPDATE campaign_sets SET go_live_date = NULL, invites_close_at = NULL WHERE id = $1`, [w.s.id]);
    const r = await bShoot(w);
    expect(r.status).toBe(200);
    expect(r.body.data.shoot).toMatchObject({ legacyNoPostingDate: true, postingDate: null, daysToPosting: null, can: { send: false } });
    const s = await bSend(w);
    expect(s.status).toBe(422); expect(code(s)).toBe('NO_POSTING_DATE'); expect(s.body.error.message).toBe(MSG.NO_POSTING_DATE);
  });

  it('26 / 27 · a Remote collaboration says why; another brand or creator gets 404 everywhere', async () => {
    const remote = await w10.signedByBoth('engagement', { mode: 'shipment' });
    const r = await bSend(remote);
    expect(r.status).toBe(422); expect(code(r)).toBe('WRONG_MODE'); expect(r.body.error.message).toBe(MSG.WRONG_MODE('Tanvi'));
    const w = await w10.signedByBoth('engagement');
    await bSend(w);
    const other = await w10.signedByBoth('engagement');
    expect((await api.get(`${w.url}/invitations/${w.ciId}/shoot`, other.b.token)).status).toBe(404);
    expect((await api.get(`${other.url}/invitations/${w.ciId}/shoot`, other.b.token)).status).toBe(404);
    expect((await api.get(`/influencers/me/invitations/${w.ciId}/shoot`, other.cr.token)).status).toBe(404);
    expect((await api.post(`/influencers/me/invitations/${w.ciId}/shoot/accept`, other.cr.token)).status).toBe(404);
    expect((await api.post(`${other.url}/invitations/${w.ciId}/shoot/confirm`, other.b.token)).status).toBe(404);
  });
});

/* ───────────────────────────────────────────── agreeing the time (10–14, 40) */

describe('agreeing the time (checks 10–14, 40)', () => {
  it('10 · she accepts the plan directly: both sides see it agreed, with no thread', async () => {
    const w = await w10.signedByBoth('engagement');
    await bSend(w);
    const a = await hAccept(w);
    expect(a.status).toBe(200);
    expect(a.body.data.shoot).toMatchObject({ stage: 'agreed', thread: expect.objectContaining({ negotiation: expect.objectContaining({ id: null }) }) });
    expect((await bShoot(w)).body.data.shoot.plan.agreedAt).toBeTruthy();
    expect((await peRow(w)).status).toBe('confirmed');
    expect(await notifs(w.b.userId, NOTIFY.TIME_AGREED.type)).toHaveLength(1);
    expect(code(await hAccept(w))).toBe('TIME_ALREADY_AGREED');
  });

  it('11 / 12 / 40 · she counters through the endpoint; the brand accepts; there is no decline route (404)', async () => {
    const w = await w10.signedByBoth('engagement');
    await bSend(w);
    const c = await hCounter(w, { visitAt: at(w10.day(4), '16:00'), note: 'Afternoon suits me better.' });
    expect(c.status).toBe(200);
    expect(c.body.data.shoot.thread.negotiation).toMatchObject({ open: true, whoseMove: 'brand', roundLimit: 2, countersUsed: 1 });
    expect(c.body.data.shoot.thread.can.decline).toBe(false);
    expect((await api.post(`${w.url}/invitations/${w.ciId}/shoot/thread/decline`, w.b.token, {})).status).toBe(404);
    expect((await api.post(`/influencers/me/invitations/${w.ciId}/shoot/thread/decline`, w.cr.token, {})).status).toBe(404);
    const b = await bAccept(w);
    expect(b.status).toBe(200);
    expect(b.body.data.shoot.stage).toBe('agreed');
    expect(b.body.data.shoot.plan.visitAt).toBe(at(w10.day(4), '16:00'));
    expect(await notifs(w.cr.userId, NOTIFY.TIME_AGREED.type)).toHaveLength(1);
  });

  it('13 / 14 · either side reschedules an agreed time on the SAME thread; after the posting date it is refused', async () => {
    const w = await agreed(await w10.signedByBoth('engagement'));
    const m = await hMove(w, { visitAt: at(w10.day(5), '15:00'), note: 'Family thing.' });
    expect(m.status).toBe(200);
    const neg1 = m.body.data.shoot.thread.negotiation.id;
    expect(m.body.data.shoot).toMatchObject({ stage: 'sent', thread: expect.objectContaining({ negotiation: expect.objectContaining({ open: true, whoseMove: 'brand', countersUsed: 1 }) }) });
    expect(await notifs(w.b.userId, NOTIFY.MOVED.type)).toHaveLength(1);
    expect((await bAccept(w)).body.data.shoot.stage).toBe('agreed');
    expect(code(await bMove(w, { visitAt: at(w10.day(20)) }))).toBe('TIME_AFTER_POSTING');   // 14 — still capped by the posting date
    const m2 = await bMove(w, { visitAt: at(w10.day(6), '10:00') });
    expect(m2.status).toBe(200);
    expect(m2.body.data.shoot.thread.negotiation.id).toBe(neg1);
    // the brand just proposed; he cannot propose again until she answers
    expect(code(await bMove(w, { visitAt: at(w10.day(7), '10:00') }))).toBe('WRONG_TURN');
    expect((await query(`SELECT count(*)::int n FROM negotiations WHERE production_event_id = $1`, [w.pe.id])).rows[0].n).toBe(1);
  });
});

/* ───────────────────────────────────────────── the visit (15–20, 43) */

describe('passed, attended, confirmed (checks 15–20, 43)', () => {
  it('15 · the agreed time passes: nothing changes, nothing is recorded against anyone, the brand can send a new time', async () => {
    const w = await agreed(await w10.signedByBoth('engagement'));
    const before = await peRow(w);
    await timePassed(w);
    const r = await bShoot(w);
    expect(r.body.data.shoot).toMatchObject({ stage: 'agreed', passed: true, can: { move: true, confirm: false } });
    expect(r.body.data.shoot.steps[1].detail).toMatch(/Time passed/);
    const after = await peRow(w);
    expect(after.status).toBe(before.status); expect(after.time_agreed_at.toISOString()).toBe(before.time_agreed_at.toISOString());
    expect((await log(w)).map(l => l.action)).not.toContain('missed');
    expect((await bMove(w, { visitAt: at(w10.day(6)) })).status).toBe(200);
  });

  // Founder, 1 Oct 2026 (overrides Q9 "only from the agreed day"): once the time is agreed they
  // meet when it suits them, so she may mark the visit straight away. This check used to expect
  // TOO_EARLY before the day, and a due date stamped from the admin number. Both are gone: what
  // opens the next step is the brand's confirmation — never her mark, never a date.
  it('16 · she marks attended any time once the time is agreed; nothing is stamped that could confirm it later', async () => {
    const sent = await w10.signedByBoth('engagement');
    await bSend(sent);
    expect(code(await hAttend(sent))).toBe('TIME_NOT_AGREED');         // a plan she has not answered is not a visit
    const w = await agreed(await w10.signedByBoth('engagement'));      // visit is day+3
    expect((await bShoot(w)).body.data.shoot.can.markAttended).toBe(false);     // never the brand's
    expect((await hShoot(w)).body.data.shoot.can.markAttended).toBe(true);      // three days before the agreed time
    const a = await hAttend(w);
    expect(a.status).toBe(200);
    const pe = await peRow(w);
    expect(pe.status).not.toBe('completed');                           // her mark alone opens nothing
    expect(pe.auto_confirm_days).toBeNull(); expect(pe.auto_confirm_due_at).toBeNull();
    expect(a.body.data.shoot).toMatchObject({ stage: 'attended', plan: { autoConfirmDays: null, autoConfirmDueAt: null } });
    expect((await bShoot(w)).body.data.shoot).toMatchObject({ stage: 'attended', can: { confirm: true }, plan: { autoConfirmDueAt: null } });
    const told = await notifs(w.b.userId, NOTIFY.ATTENDED.type);
    expect(told).toHaveLength(1);
    expect(told[0].body).toMatch(/^Tanvi says she visited on .+\. Confirm the shoot is done — her next step stays closed until you do\.$/);
    expect(code(await bMove(w, { visitAt: at(w10.day(6)) }))).not.toBe('SHOOT_COMPLETE');   // the brand may still move (Q3)
  });

  // Was: "19 · changing the admin number afterwards moves no due date already stamped". There is
  // no number and no due date any more (founder, 1 Oct 2026).
  it('19 · the old admin number decides nothing: whatever it says, a marked visit carries no due date', async () => {
    await query(`UPDATE platform_settings SET value = 1 WHERE key = 'shoot_auto_confirm_days'`); settings._resetCache();
    const w = await attended(await w10.signedByBoth('hybrid'));
    const pe = await peRow(w);
    expect(pe.auto_confirm_days).toBeNull(); expect(pe.auto_confirm_due_at).toBeNull(); expect(pe.status).not.toBe('completed');
  });

  it('17 / 20 · the brand confirms once; before she marks it is refused; twice, or two at once, produce exactly one', async () => {
    const w = await agreed(await w10.signedByBoth('engagement'));
    let r = await bConfirm(w);
    expect(r.status).toBe(422); expect(code(r)).toBe('NOT_MARKED_YET'); expect(r.body.error.message).toBe(MSG.NOT_MARKED_YET('Tanvi'));
    await timePassed(w);
    const [a1, a2] = await Promise.all([hAttend(w), hAttend(w)]);
    expect([a1.status, a2.status].sort()).toEqual([200, 422]);
    const [c1, c2] = await Promise.all([bConfirm(w), bConfirm(w)]);
    expect([c1.status, c2.status].sort()).toEqual([200, 422]);
    const pe = await peRow(w);
    expect(pe.status).toBe('completed'); expect(pe.brand_completed_by).toBe(w.b.userId); expect(pe.auto_confirmed_at).toBeNull();
    const s = (await bShoot(w)).body.data.shoot;
    expect(s.stage).toBe('complete');
    expect(s.steps.map(x => x.state)).toEqual(['done', 'done', 'now', 'later']);          // the content step opens
    expect(await notifs(w.cr.userId, NOTIFY.CONFIRMED.type)).toHaveLength(1);
    expect(code(await bMove(w, { visitAt: at(w10.day(6)) }))).toBe('SHOOT_COMPLETE');
    expect(code(await hAttend(w))).toBe('ALREADY_MARKED');
  });

  it('43 · the brand moves the time after she marked: her mark and the clock are cleared and logged, the thread reopens, she is told once', async () => {
    const w = await attended(await w10.signedByBoth('engagement'));
    const before = await peRow(w);
    const m = await bMove(w, { visitAt: at(w10.day(6), '11:00'), note: 'The store is closed on Sunday.' });
    expect(m.status).toBe(200);
    const pe = await peRow(w);
    expect(pe.influencer_completed_at).toBeNull(); expect(pe.auto_confirm_due_at).toBeNull(); expect(pe.auto_confirm_days).toBeNull();
    const cleared = (await log(w)).find(l => l.action === 'attended_cleared');
    expect(cleared).toBeTruthy();
    expect(new Date(cleared.metadata.influencer_completed_at).toISOString()).toBe(before.influencer_completed_at.toISOString());
    expect(m.body.data.shoot).toMatchObject({ stage: 'sent', thread: expect.objectContaining({ negotiation: expect.objectContaining({ open: true, whoseMove: 'influencer' }) }) });
    expect(await notifs(w.cr.userId, NOTIFY.MOVED.type)).toHaveLength(1);
    // she cannot move after marking; only the brand can
    const w2 = await attended(await w10.signedByBoth('engagement'));
    expect(code(await hMove(w2, { visitAt: at(w10.day(6)) }))).toBe('ALREADY_MARKED');
  });
});

/* ───────────────────────────────────────────── only the brand confirms (18, 21) */

// Founder, 1 Oct 2026: "if it is store visit then brand should confirm store visit is done… dont
// let next step open unless brand confirm the shoot is done." Check 18 used to prove the visit
// confirmed itself at a due date; that job and its admin number are retired. It now proves the
// opposite, and that the brand keeps being asked.
describe('only the brand confirms a store visit, and the money (checks 18, 21)', () => {
  const contentStage = async (w) => (await api.get(`/influencers/me/invitations/${w.ciId}/content`, w.cr.token)).body.data.content.stage;

  it('18 · the brand does nothing: nothing ever confirms it — the next step stays shut and he is asked every 48 hours until he confirms', async () => {
    const w = await attended(await w10.signedByBoth('engagement'));
    const markedAt = (await peRow(w)).influencer_completed_at;
    const later = (hours) => new Date(markedAt.getTime() + hours * 3600000);
    expect(require('fs').existsSync(require('path').join(__dirname, '../src/jobs/shoot-auto-confirm.job.js'))).toBe(false);
    expect(require('../src/jobs').shootAutoConfirmJob).toBeUndefined();

    // 47 hours: not yet. 49: asked once. 60: not again. 98: asked again.
    expect((await remindersJob.run({ now: later(47) })).visit.sent).toBe(0);
    expect((await remindersJob.run({ now: later(49) })).visit.sent).toBe(1);
    expect((await remindersJob.run({ now: later(60) })).visit.sent).toBe(0);
    expect((await remindersJob.run({ now: later(98) })).visit.sent).toBe(1);
    const asked = await notifs(w.b.userId, NOTIFY.REMINDER.type);
    expect(asked).toHaveLength(2);
    expect(asked[0].body).toMatch(/^Tanvi says she visited on .+\. Confirm the shoot is done, or send a new time if she didn't come\. Her next step stays closed until you do\.$/);
    expect(await notifs(w.cr.userId, NOTIFY.REMINDER.type)).toHaveLength(0);          // never her

    // Thirty days on, and past the posting date: every hourly job has run and nothing confirmed it.
    await query(`UPDATE campaign_sets SET go_live_date = $2, invites_close_at = $2 WHERE id = $1`, [w.s.id, addDays(todayInIndia(), -1)]);
    await delayedJob.run();
    expect((await remindersJob.run({ now: later(30 * 24) })).visit.sent).toBe(1);      // still asking, posting date or not
    const pe = await peRow(w);
    expect(pe.status).not.toBe('completed'); expect(pe.auto_confirmed_at).toBeNull(); expect(pe.brand_completed_at).toBeNull();
    expect((await hShoot(w)).body.data.shoot.stage).toBe('attended');
    expect((await bShoot(w)).body.data.shoot.can.confirm).toBe(true);
    expect(await contentStage(w)).toBe('shoot_not_done');

    // He confirms: it completes, her next step opens, and the asking stops.
    expect((await bConfirm(w)).status).toBe(200);
    expect((await peRow(w)).status).toBe('completed');
    expect(await contentStage(w)).not.toBe('shoot_not_done');
    expect((await remindersJob.run({ now: later(40 * 24) })).visit.sent).toBe(0);
  });

  it('21 · NO MONEY MOVES anywhere in item 10 — balances, escrow and ledgers byte-equal before the plan and after the confirmation', async () => {
    const w = await w10.signedByBoth('hybrid');
    const before = await w10.moneySnapshot(w);
    await bSend(w);
    await hCounter(w, { visitAt: at(w10.day(4), '16:00') });
    await bMove(w, { visitAt: at(w10.day(4), '12:00') });     // brand counters (a move on an open plan is a counter)
    await hAcceptC(w);
    await bMove(w, { visitAt: at(w10.day(5), '12:00') });
    await hAcceptC(w);
    await timePassed(w);
    await hAttend(w);
    await remindersJob.run({ now: new Date(Date.now() + 4 * 86400000) });
    expect(await w10.moneySnapshot(w)).toBe(before);              // asked, not confirmed: still nothing
    await bConfirm(w);
    expect((await peRow(w)).status).toBe('completed');
    expect(await w10.moneySnapshot(w)).toBe(before);
    const w2 = await attended(await w10.signedByBoth('engagement'));
    const b2 = await w10.moneySnapshot(w2);
    await bConfirm(w2);
    expect(await w10.moneySnapshot(w2)).toBe(b2);
  });
});

/* ───────────────────────────────────────────── Delayed (22, 23, 24) */

describe('Delayed (checks 22, 23, 24)', () => {
  const yesterday = () => addDays(todayInIndia(), -1);
  // The posting day was yesterday. The cutoff rides with it (the CHECK insists invites close on or before the posting day).
  const backdate = (w) => query(`UPDATE campaign_sets SET go_live_date = $2, invites_close_at = $2 WHERE id = $1`, [w.s.id, yesterday()]);

  it('22 · the day after the posting date the collaboration is flagged with the right stage, both told once, and a re-run flags nothing', async () => {
    const notSent = await w10.signedByBoth('engagement');
    const sentOnly = await w10.signedByBoth('engagement'); await bSend(sentOnly);
    const agreedW = await agreed(await w10.signedByBoth('engagement'));
    const attendedW = await attended(await w10.signedByBoth('engagement'));
    const done = await attended(await w10.signedByBoth('engagement')); await bConfirm(done);
    const future = await w10.signedByBoth('engagement');
    const remote = await w10.signedByBoth('conversion', { mode: 'shipment' });
    for (const w of [notSent, sentOnly, agreedW, attendedW, done, remote]) await backdate(w);
    const out = await delayedJob.run();

    // ASSERTION DRIFT, item 11 (features/item11-remote, Phase 2c).
    //
    // This line used to read `{ flagged: 4 }` with the Remote collaboration marked "item 11's;
    // not flagged here" — because item 10's lane filtered on `mode = 'visit'` and had no
    // vocabulary for a Remote stage. It has one now: the same :05 job runs both halves, and a
    // Remote shoot past its posting date is flagged exactly as a visit is. FIVE, not four.
    //
    // The visit half is asserted separately below, so a future change to either half cannot
    // hide inside the total.
    //
    // ASSERTION DRIFT, item 12 (features/item12-content, rules v1.29 §12.2): SIX, not five. `done`
    // is a Pay for Content collaboration whose shoot is complete but whose content is not live by
    // the posting date — which §12.2 flags Delayed at `content_not_submitted`. Item 12's content
    // arm runs in the same :05 job. Each half is still asserted on its own.
    expect(out).toMatchObject({ flagged: 6, failed: 0 });
    expect(out.visit).toMatchObject({ flagged: 4, failed: 0 });
    expect(out.remote).toMatchObject({ flagged: 1, failed: 0 });
    expect(out.content).toMatchObject({ flagged: 1, failed: 0 });
    expect((await query(`SELECT delayed_stage FROM campaign_influencers WHERE id = $1`, [done.ciId])).rows[0].delayed_stage).toBe('content_not_submitted');
    const remoteRow = (await query(`SELECT delayed_at, delayed_stage FROM campaign_influencers WHERE id = $1`, [remote.ciId])).rows[0];
    expect(remoteRow.delayed_at).toBeTruthy();
    expect(remoteRow.delayed_stage).toBe('address_not_sent');   // she never sent one
    const stage = async (w) => (await query(`SELECT delayed_at, delayed_stage FROM campaign_influencers WHERE id = $1`, [w.ciId])).rows[0];
    expect((await stage(notSent)).delayed_stage).toBe('plan_not_sent');
    expect((await stage(sentOnly)).delayed_stage).toBe('time_not_agreed');
    expect((await stage(agreedW)).delayed_stage).toBe('not_attended');
    expect((await stage(attendedW)).delayed_stage).toBe('not_confirmed');
    // Item 12 (v1.29 §12.2): the shoot is done but the content is not live — the CONTENT lane's flag.
    expect((await stage(done)).delayed_stage).toBe('content_not_submitted');
    expect((await stage(future)).delayed_at).toBeNull();
    expect(await notifs(agreedW.b.userId, NOTIFY.DELAYED.type)).toHaveLength(1);
    expect(await notifs(agreedW.cr.userId, NOTIFY.DELAYED.type)).toHaveLength(1);
    expect((await delayedJob.run()).flagged).toBe(0);
    expect(await notifs(agreedW.cr.userId, NOTIFY.DELAYED.type)).toHaveLength(1);
    const s = (await bShoot(agreedW)).body.data.shoot;
    expect(s.delayed).toMatchObject({ stage: 'not_attended', stageLabel: 'Time agreed, not visited' });
  });

  it('23 / 24 · a delayed collaboration can still be planned, agreed, attended and confirmed; nothing else changed; set-expiry and item 4 are unaffected', async () => {
    const w = await w10.signedByBoth('engagement');
    await backdate(w);
    const ciBefore = (await query(`SELECT status, agreed_fee FROM campaign_influencers WHERE id = $1`, [w.ciId])).rows[0];
    const money = await w10.moneySnapshot(w);
    await delayedJob.run();
    const ci = (await query(`SELECT status, agreed_fee, set_id, delayed_at FROM campaign_influencers WHERE id = $1`, [w.ciId])).rows[0];
    expect(ci.delayed_at).toBeTruthy(); expect(ci.status).toBe(ciBefore.status); expect(ci.set_id).toBe(w.s.id);
    expect(await w10.moneySnapshot(w)).toBe(money);
    // set-expiry keeps the set (someone signed) and touches nothing
    const se = await setExpiryJob.run();
    expect(se.expired).toBe(0);
    expect((await query(`SELECT expired_at FROM campaign_sets WHERE id = $1`, [w.s.id])).rows[0].expired_at).toBeNull();
    // still fully usable — the plan goes out for TODAY (the posting day has passed, so the cap is now the past day…)
    // …which means a delayed collaboration needs the posting date moved to plan a visit. That is the founder's
    // "You can still plan a visit" — the brand moves the set date first (item 4 allows it while nobody new is invited).
    await query(`UPDATE campaign_sets SET go_live_date = $2, invites_close_at = $3 WHERE id = $1`, [w.s.id, w10.day(10), w10.day(7)]);
    expect((await bSend(w)).status).toBe(201);
    expect((await hAccept(w)).status).toBe(200);
    await timePassed(w);
    expect((await hAttend(w)).status).toBe(200);
    expect((await bConfirm(w)).status).toBe(200);
    expect((await query(`SELECT delayed_at FROM campaign_influencers WHERE id = $1`, [w.ciId])).rows[0].delayed_at).toBeTruthy();   // the flag stays; it is a label
  });
});

/* ───────────────────────────────────────────── the walk fix (20 Sep) */

describe('the walk fix — her number when the time passes, and the shoot on the brand\'s row', () => {
  it('V13: the brand gets her number ONLY once the time has passed, and never on her side', async () => {
    const w = await agreed(await w10.signedByBoth('engagement'));
    const creatorPhone = (await query(`SELECT u.phone FROM influencers i JOIN users u ON u.id = i.user_id WHERE i.id = $1`, [w.cr.influencerId])).rows[0].phone;
    // agreed but not yet passed — nothing
    expect((await bShoot(w)).body.data.shoot.creatorPhone).toBeUndefined();
    await timePassed(w);
    const passed = (await bShoot(w)).body.data.shoot;
    expect(passed.passed).toBe(true);
    expect(passed.creatorPhone).toBe(creatorPhone);
    // her own screen never carries it, at any stage
    expect((await hShoot(w)).body.data.shoot.creatorPhone).toBeUndefined();
    expect(JSON.stringify((await hShoot(w)).body)).not.toContain(creatorPhone);
    // and once the visit is marked it is gone again
    await hAttend(w);
    expect((await bShoot(w)).body.data.shoot.creatorPhone).toBeUndefined();
  });

  it('the brand\'s set-detail row says where the visit is, and chips Your move when he owes the confirmation', async () => {
    const w = await w10.signedByBoth('engagement');
    const rowOf = async () => {
      const r = await api.get(`/campaigns/${w.c.id}/sets/${w.s.id}/summary`, w.b.token);
      expect(r.status).toBe(200);
      // creators.groups is keyed by group name, each { count, rows[], more }.
      const groups = (r.body.data.creators && r.body.data.creators.groups) || {};
      for (const g of Object.values(groups)) for (const row of (g.rows || [])) if (row.id === w.ciId) return row;
      return null;
    };
    // Walk fix (1 Oct 2026): this used to be null until the plan was sent, which left the brand
    // with no way from the set to the plan. Signed with nothing sent is now a row he can open.
    expect((await rowOf()).shoot).toEqual({ stage: 'not_sent', line: 'Signed — plan the store visit', visitAt: null });
    await bSend(w);
    expect((await rowOf()).shoot).toMatchObject({ stage: 'sent', line: expect.stringMatching(/^Plan sent for .* waiting for Tanvi to answer$/) });
    await hAccept(w);
    expect((await rowOf()).shoot).toMatchObject({ stage: 'agreed', line: expect.stringMatching(/^Store visit /) });
    await timePassed(w);
    expect((await rowOf()).shoot.line).toMatch(/passed with nothing marked — send a new time$/);
    await hAttend(w);
    expect((await rowOf()).shoot).toMatchObject({ stage: 'attended', line: 'Tanvi says she visited — confirm the shoot is done' });
    await bConfirm(w);
    expect((await rowOf()).shoot).toMatchObject({ stage: 'complete', line: expect.stringMatching(/^Shoot done /) });
  });
});

/* ───────────────────────────────────────────── Needs You (28) and reminders (47) */

describe('Needs You and reminders (checks 28, 47)', () => {
  const brandTotal = async (w) => (await api.get('/brands/me/inbox-summary', w.b.token)).body.data.needs_you;
  const herNeeds = async (w) => (await api.get('/influencers/me/needs-you', w.cr.token)).body.data;
  const brandStep = async (w) => { const n = await brandTotal(w); const c = n.campaigns.find(c => c.campaign_id === w.c.id); return c.sets[0].creators.find(x => x.campaign_influencer_id === w.ciId); };

  it('28 · the four moves land on the right side at each point', async () => {
    const w = await w10.signedByBoth('engagement');
    // 1 — the brand owes a plan
    expect(await brandStep(w)).toMatchObject({ step: 3, turn: 'brand', own: 1 });
    expect((await herNeeds(w)).items.shoot_to_answer).toBe(0);
    // 2 — she owes an answer on the time
    await bSend(w);
    expect(await brandStep(w)).toMatchObject({ turn: 'creator', own: 0 });
    expect((await herNeeds(w)).items.shoot_to_answer).toBe(1);
    // 3 — the brand owes an answer on her counter
    await hCounter(w, { visitAt: at(w10.day(4), '16:00') });
    expect(await brandStep(w)).toMatchObject({ turn: 'brand', own: 1 });
    expect((await herNeeds(w)).items.shoot_to_answer).toBe(0);
    await bAccept(w);
    expect(await brandStep(w)).toMatchObject({ turn: 'nobody', own: 0 });
    // 4 — the brand owes a confirmation
    await timePassed(w); await hAttend(w);
    expect(await brandStep(w)).toMatchObject({ turn: 'brand', own: 1 });
    await bConfirm(w);
    expect((await brandStep(w)).step).toBeGreaterThan(3);
    // her collaborations list carries the same step
    const mine = (await herNeeds(w)).collaborations.find(c => c.campaign_influencer_id === w.ciId);
    expect(mine.step).toBeGreaterThan(3);
  });

  it('47 · one nudge at 48 hours, not again within 48, nothing after the posting date, nothing whose gate is closed', async () => {
    const w = await w10.signedByBoth('engagement');
    await bSend(w);
    const sentAt = (await peRow(w)).plan_sent_at;
    expect((await remindersJob.run({ now: new Date(sentAt.getTime() + 47 * 3600000) })).sent).toBe(0);
    expect((await remindersJob.run({ now: new Date(sentAt.getTime() + 49 * 3600000) })).sent).toBe(1);
    expect(await notifs(w.cr.userId, NOTIFY.REMINDER.type)).toHaveLength(1);
    expect((await remindersJob.run({ now: new Date(sentAt.getTime() + 60 * 3600000) })).sent).toBe(0);
    expect((await remindersJob.run({ now: new Date(sentAt.getTime() + 98 * 3600000) })).sent).toBe(1);
    // a thread turn: the brand's move sits 48h
    await hCounter(w, { visitAt: at(w10.day(4), '16:00') });
    const turnAt = (await query(`SELECT turn_changed_at FROM negotiations WHERE production_event_id = $1`, [w.pe.id])).rows[0].turn_changed_at;
    expect((await remindersJob.run({ now: new Date(turnAt.getTime() + 49 * 3600000) })).sent).toBe(1);
    expect(await notifs(w.b.userId, NOTIFY.REMINDER.type)).toHaveLength(1);
    // after the posting date: nothing
    await query(`UPDATE campaign_sets SET go_live_date = $2, invites_close_at = $2 WHERE id = $1`, [w.s.id, addDays(todayInIndia(), -1)]);
    expect((await remindersJob.run({ now: new Date(turnAt.getTime() + 200 * 3600000) })).sent).toBe(0);
    // gate closed: nothing
    const w2 = await w10.signedByBoth('engagement'); await bSend(w2);
    await query(`UPDATE escrow_entries SET status = 'locked', released_at = NULL WHERE campaign_influencer_id = $1 AND tranche_number = 1`, [w2.ciId]);
    expect((await remindersJob.run({ now: new Date(Date.now() + 49 * 3600000) })).sent).toBe(0);
  });
});

/* ───────────────────────────────────────────── the admin number (F10) and the lists */

describe('the admin number and the lists', () => {
  // Was: "shoot_auto_confirm_days is on the settings page, 3 by default, 1–30". The number is
  // retired with the auto-confirm (founder, 1 Oct 2026): its row stays in the table, unlisted.
  it('shoot_auto_confirm_days is gone from the settings page and can no longer be changed', async () => {
    const { createAdminUser } = require('./helpers/factories');
    const admin = await createAdminUser();
    const r = await api.get('/admin/platform-settings', admin.token);
    expect(r.body.data.settings.find(s => s.key === 'shoot_auto_confirm_days')).toBeUndefined();
    await api.patch('/admin/platform-settings', admin.token, { shoot_auto_confirm_days: 9 });
    expect((await query(`SELECT value::int AS v FROM platform_settings WHERE key = 'shoot_auto_confirm_days'`)).rows[0].v).toBe(3);
  });

  it('the brand list and the admin queue carry the stage and the Delayed flag', async () => {
    const w = await agreed(await w10.signedByBoth('engagement'));
    const list = await api.get('/brands/me/shoots', w.b.token);
    expect(list.body.data.shoots[0]).toMatchObject({ stage: 'agreed', delayed: null });
    const { createAdminUser } = require('./helpers/factories');
    const admin = await createAdminUser();
    await query(`UPDATE campaign_influencers SET delayed_at = now(), delayed_stage = 'not_attended' WHERE id = $1`, [w.ciId]);
    await query(`UPDATE production_events SET created_at = now() - interval '4 days', status = 'proposed' WHERE id = $1`, [w.pe.id]);
    const q = await api.get('/admin/production/queue', admin.token);
    const row = q.body.data.items.find(i => i.contract_id === w.con.id);
    expect(row.delayed_stage).toBe('not_attended');
    expect(row.reasons.join(' ')).toMatch(/Delayed since/);
  });
});
