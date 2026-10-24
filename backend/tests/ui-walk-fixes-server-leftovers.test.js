'use strict';

/**
 * ui-walk-fixes — slice CSRV: three server leftovers from wave 2, through the real endpoints.
 * Contract: features/ui-walk-fixes · spec U6(a), U11 · boards F3 / F6 / F2 · checks 19, 20, 23
 *
 * Wave 2 changed three things on the server (06-diff/drift/SF.md, F.md): a withdrawn agreement is
 * a "Your move" row again, the set row says whose turn a store visit is, and the phone now reaches
 * Withdraw. Each left one place still telling the old story:
 *
 *   1. the brand's Needs You number counted an agreement to send only while the contract read
 *      'draft' — so the row said "Send agreement" and the number said nothing was owed;
 *   2. the set row offered "Withdraw agreement" for an agreement that went out through the
 *      WEBSITE's Approve & Send, which the phone's withdraw endpoint refuses (it only takes back
 *      an agreement the phone's Send stamped);
 *   3. once she had asked for another visit time the row showed a Reply button under a sentence
 *      that still said the brand was waiting for HER.
 */

const { truncateAll } = require('./helpers/db');
const { query, api, creator, resetReference } = require('./helpers/item3');
const w10 = require('./helpers/item10');
const settings = require('../src/services/platformSettings.service');
const standardTerms = require('../src/services/standardTerms.service');
const remindersJob = require('../src/jobs/shoot-reminders.job');
const { NOTIFY } = require('../src/services/productionCopy');
const { MSG: MSG7 } = require('../src/services/agreementCopy');

beforeEach(async () => { await truncateAll(); await resetReference(); settings._resetCache(); standardTerms._resetCache(); });
afterEach(() => { settings._resetCache(); standardTerms._resetCache(); });

const okd = (r, status = 200) => { if (r.status !== status) throw new Error(`${r.status}: ${JSON.stringify(r.body)}`); return r; };
const at = (day, hhmm = '11:00') => new Date(`${day}T${hhmm}:00+05:30`).toISOString();
const PLAN = (day = w10.day(3)) => ({ contactName: 'Ravi Menon', contactPhone: '+91 98490 11223', visitAt: at(day), durationText: 'About 2 hours', notes: 'Parking is behind the building.' });

const send     = (w, ciId = w.ciId) => api.post(`${w.url}/invitations/${ciId}/agreement/send`, w.b.token);
const withdraw = (w, ciId = w.ciId) => api.post(`${w.url}/invitations/${ciId}/agreement/withdraw`, w.b.token);
const herSign  = (w) => api.post(`/influencers/me/invitations/${w.ciId}/agreement/sign`, w.cr.token, w10.SIG);
const brandSign= (w) => api.post(`${w.url}/invitations/${w.ciId}/agreement/sign`, w.b.token, w10.BSIG);
const con      = async (ciId) => (await query(`SELECT * FROM contracts WHERE campaign_influencer_id = $1`, [ciId])).rows[0];

/** The set's creators as the phone reads them. */
async function creatorsOf(w) {
  return okd(await api.get(`${w.url}/summary`, w.b.token)).body.data.creators;
}
/** One creator's row, wherever it sits. */
async function rowOf(w, ciId = w.ciId) {
  const creators = await creatorsOf(w);
  return creators.order.flatMap(k => creators.groups[k].rows).find(x => x.id === ciId) || null;
}
/** The brand's Needs You tree — the same read the phone's badge makes. */
const needsYou = async (w) => okd(await api.get('/brands/me/inbox-summary', w.b.token)).body.data.needs_you;
/** How many rows on the set screen carry "Send agreement". */
const sendRows = async (w) => {
  const creators = await creatorsOf(w);
  return creators.order.flatMap(k => creators.groups[k].rows).filter(x => x.actions.sendAgreement).length;
};

/* ───────────────────────────────────────────── 1 · the count */

describe('1 · Needs You counts an agreement the brand took back (U6a, check 23)', () => {
  it('counts it while it is unsent, stops while it is out, and counts it again once withdrawn — the number and the "Send agreement" rows agree at every step', async () => {
    const w = await w10.world('engagement');

    // She accepted, nothing sent: one agreement to send.
    expect((await con(w.ciId)).status).toBe('draft');
    expect((await needsYou(w)).creators_tab).toBe(1);
    expect(await sendRows(w)).toBe(1);

    // Out for her signature: nothing is the brand's.
    okd(await send(w), 201);
    expect((await needsYou(w)).creators_tab).toBe(0);
    expect(await sendRows(w)).toBe(0);

    // Taken back: the row is "Send agreement" again, and the number says so too.
    okd(await withdraw(w));
    expect(await con(w.ciId)).toMatchObject({ status: 'withdrawn', sent_at: null });
    expect((await rowOf(w)).actions.sendAgreement).toBe(true);
    expect(await sendRows(w)).toBe(1);
    const tree = await needsYou(w);
    expect(tree.creators_tab).toBe(1);
    // The headline still reconciles: the creators tab plus everything under the campaigns.
    expect(tree.total).toBe(tree.creators_tab + tree.campaigns.reduce((n, c) => n + c.total, 0));

    // Sent again: gone from the number. She signs: it is back, as the brand's signature.
    okd(await send(w), 201);
    expect((await needsYou(w)).creators_tab).toBe(0);
    okd(await herSign(w));
    expect((await needsYou(w)).creators_tab).toBe(1);
    expect((await rowOf(w)).actions).toMatchObject({ sendAgreement: false, signAgreement: true });
    okd(await brandSign(w));
    expect((await needsYou(w)).creators_tab).toBe(0);
  });

  it('a contract marked withdrawn because she was removed or moved to the pool is not counted', async () => {
    const w = await w10.world('engagement');
    // Two more creators in the same set, both accepted.
    const others = await Promise.all(['Ritu Verma', 'Kavya Rao'].map(name => creator({ name })));
    const terms21 = await require('./helpers/sell').sellable(w.brandId, w10.CONTENT);   // item 21: posts + what she posts about
    const inv = okd(await api.post(`${w.url}/invitations`, w.b.token, {
      creators: others.map(c => ({ influencerId: c.influencerId, terms: terms21 })),
    }), 201);
    const ids = Object.fromEntries(inv.body.data.rows.map(x => [x.name, x.id]));
    for (const [i, name] of ['Ritu Verma', 'Kavya Rao'].entries()) okd(await api.post(`/influencers/me/invitations/${ids[name]}/accept`, others[i].token));
    // Three drafts: three agreements to send.
    expect((await needsYou(w)).creators_tab).toBe(3);

    // Tanvi: sent, then taken back by the brand — still the brand's to send.
    okd(await send(w), 201);
    okd(await withdraw(w));
    // Ritu: sent, then removed from the set — her unsigned contract reads 'withdrawn' too.
    okd(await send(w, ids['Ritu Verma']), 201);
    okd(await api.post(`${w.url}/invitations/${ids['Ritu Verma']}/remove`, w.b.token));
    // Kavya: moved to the pool, which leaves the same mark on her contract (negotiation.moveAnswer).
    await query(`UPDATE campaign_influencers SET status = 'deferred', deferred_at = now() WHERE id = $1`, [ids['Kavya Rao']]);
    await query(`UPDATE contracts SET status = 'withdrawn', withdrawn_at = now() WHERE campaign_influencer_id = $1`, [ids['Kavya Rao']]);
    const marks = await query(`SELECT status FROM contracts WHERE campaign_influencer_id = ANY($1::uuid[])`, [[w.ciId, ids['Ritu Verma'], ids['Kavya Rao']]]);
    expect(marks.rows.map(x => x.status)).toEqual(['withdrawn', 'withdrawn', 'withdrawn']);

    // Only the one the brand can actually send again.
    expect((await needsYou(w)).creators_tab).toBe(1);
    expect(await sendRows(w)).toBe(1);
    expect((await rowOf(w)).group).toBe('yourMove');
  });
});

/* ───────────────────────────────────────────── 2 · the Withdraw flag */

describe('2 · the set row offers "Withdraw agreement" exactly when the withdraw would be accepted (F3)', () => {
  it('sent from the phone: offered until she signs; the endpoint agrees at every step', async () => {
    const w = await w10.world('engagement');
    // Unsent: nothing to take back.
    expect((await rowOf(w)).actions.withdrawAgreement).toBe(false);
    expect((await withdraw(w)).status).toBe(404);

    const sent = okd(await send(w), 201);
    expect(sent.body.data.agreement.can.withdraw).toBe(true);
    expect((await rowOf(w)).actions).toMatchObject({ withdrawAgreement: true, viewAgreement: true });
    okd(await withdraw(w));
    expect((await rowOf(w)).actions.withdrawAgreement).toBe(false);
    expect((await withdraw(w)).status).toBe(404);

    okd(await send(w), 201);
    okd(await herSign(w));
    expect((await rowOf(w)).actions.withdrawAgreement).toBe(false);
    const late = await withdraw(w);
    expect(late.status).toBe(422);
    expect(late.body.error.message).toBe(MSG7.WITHDRAW_TOO_LATE('Tanvi Suresh'));
  });

  it('approved through the website door: the endpoint refuses, so the row does not offer it', async () => {
    const w = await w10.world('engagement');
    const draft = await con(w.ciId);
    // brand-web's "Approve & Send": the contract goes out for her signature WITHOUT the phone's
    // send — no snapshot, no reference, no sent_at.
    okd(await api.post(`/contracts/${draft.id}/approve`, w.b.token, {}));
    expect(await con(w.ciId)).toMatchObject({ status: 'pending_influencer', sent_at: null, influencer_signed_at: null });

    // The phone's withdraw has nothing it stamped to take back.
    const refused = await withdraw(w);
    expect(refused.status).toBe(404);
    expect(refused.body.error.message).toBe(MSG7.NO_AGREEMENT);
    expect((await con(w.ciId)).status).toBe('pending_influencer');           // and nothing was written

    // So the row must not offer it. It is still out with her (the group and the status say so),
    // and there is no phone agreement to open either.
    const row = await rowOf(w);
    expect(row.actions).toMatchObject({ withdrawAgreement: false, viewAgreement: false, sendAgreement: false, signAgreement: false, downloadAgreement: false });
    expect(row.group).toBe('waiting');
    expect(row.agreement).toMatchObject({ status: 'pending_influencer', sentAt: null });
    // The one-invitation read the row opens agrees with it.
    const one = okd(await api.get(`${w.url}/invitations/${w.ciId}`, w.b.token)).body.data.invitation;
    expect(one.actions.withdrawAgreement).toBe(false);
    // And so does the agreement screen behind the row: its read offers no Withdraw (nor a Send —
    // it is already out with her), so the phone never draws a button the endpoint refuses.
    const ag = okd(await api.get(`${w.url}/invitations/${w.ciId}/agreement`, w.b.token)).body.data.agreement;
    expect(ag).toMatchObject({ status: 'pending_influencer', sentAt: null });
    expect(ag.can).toEqual({ send: false, sign: false, withdraw: false, download: false });
  });
});

/* ───────────────────────────────────────────── 3 · the visit sentence */

describe('3 · she asked for another visit time: the brand\'s row says she is waiting for him (F2, U11)', () => {
  const bSend    = (w) => api.post(`${w.url}/invitations/${w.ciId}/shoot/plan`, w.b.token, PLAN());
  const bCounter = (w, body) => api.post(`${w.url}/invitations/${w.ciId}/shoot/thread/counter`, w.b.token, body);
  const bAccept  = (w) => api.post(`${w.url}/invitations/${w.ciId}/shoot/thread/accept`, w.b.token);
  const hCounter = (w, body) => api.post(`/influencers/me/invitations/${w.ciId}/shoot/thread/counter`, w.cr.token, body);
  const hAcceptC = (w) => api.post(`/influencers/me/invitations/${w.ciId}/shoot/thread/accept`, w.cr.token);
  const hMove    = (w, body) => api.post(`/influencers/me/invitations/${w.ciId}/shoot/move`, w.cr.token, body);
  const herCard  = async (w) => okd(await api.get('/influencers/me/invitations?tab=active', w.cr.token)).body.data.rows.find(x => x.id === w.ciId);
  const shootOf  = async (w) => (await rowOf(w)).shoot;
  const WAITING_ON_HIM = 'Tanvi is waiting for your answer on the store visit time.';
  const WAITING_ON_HER = /^Plan sent for .* — waiting for Tanvi to answer$/;

  it('the sentence follows the turn while the time is contested, and only then', async () => {
    const w = await w10.signedByBoth('engagement');
    // Every other line is what it was.
    expect(await shootOf(w)).toEqual({ stage: 'not_sent', line: 'Signed — plan the store visit', visitAt: null, yourMove: true });

    // The plan is with her: the old sentence, and it is true.
    okd(await bSend(w), 201);
    let s = await shootOf(w);
    expect(s).toMatchObject({ stage: 'sent', yourMove: false });
    expect(s.line).toMatch(WAITING_ON_HER);

    // She asks for another time. Same stage — the turn is the brand's, and now the line says so.
    okd(await hCounter(w, { visitAt: at(w10.day(4), '16:00'), note: 'Afternoon suits me better.' }));
    s = await shootOf(w);
    expect(s).toMatchObject({ stage: 'sent', yourMove: true, line: WAITING_ON_HIM });
    expect(Object.keys(s).sort()).toEqual(['line', 'stage', 'visitAt', 'yourMove']);
    // Her card is untouched by this: her own sentence, and not her move.
    const card = await herCard(w);
    expect(card.shoot.yourMove).toBe(false);
    expect(card.shoot.line).toMatch(/^Store visit planned for /);

    // He answers with a third time: back with her, back to the old sentence.
    okd(await bCounter(w, { visitAt: at(w10.day(5), '10:00') }));
    s = await shootOf(w);
    expect(s).toMatchObject({ stage: 'sent', yourMove: false });
    expect(s.line).toMatch(WAITING_ON_HER);

    // She accepts: a time is agreed — and the row SAYS it is agreed, in the words the locked
    // frame F1 draws on Divya's row and spec U11 quotes ("Store visit agreed for …"). Until the
    // final review this read "Store visit Sun 18 Oct, 11:00 am": only the green tag hinted at it.
    okd(await hAcceptC(w));
    s = await shootOf(w);
    expect(s).toMatchObject({ stage: 'agreed', yourMove: false });
    expect(s.line).toMatch(/^Store visit agreed for \w{3} \d{1,2} \w{3,4}, 10:00 am$/);
    // Her card says the same thing in the same words.
    expect((await herCard(w)).shoot.line).toBe(s.line);

    // She asks to move the agreed time: the same conversation reopens on him.
    okd(await hMove(w, { visitAt: at(w10.day(6), '15:00'), note: 'Family thing.' }));
    expect(await shootOf(w)).toMatchObject({ stage: 'sent', yourMove: true, line: WAITING_ON_HIM });
    okd(await bAccept(w));
    s = await shootOf(w);
    expect(s).toMatchObject({ stage: 'agreed', yourMove: false });
    expect(s.line).toMatch(/^Store visit agreed for \w{3} \d{1,2} \w{3,4}, 3:00 pm$/);
  });

  it('it is the reminder\'s own sentence: the nudge he gets for this moment starts with the row\'s line, word for word', async () => {
    const w = await w10.signedByBoth('engagement');
    okd(await bSend(w), 201);
    okd(await hCounter(w, { visitAt: at(w10.day(4), '16:00') }));
    const line = (await shootOf(w)).line;
    expect(line).toBe(WAITING_ON_HIM);

    const turnAt = (await query(`SELECT turn_changed_at FROM negotiations WHERE production_event_id = $1`, [w.pe.id])).rows[0].turn_changed_at;
    expect((await remindersJob.run({ now: new Date(turnAt.getTime() + 49 * 3600000) })).sent).toBe(1);
    const nudges = (await query(`SELECT body FROM notifications WHERE user_id = $1 AND type = $2`, [w.b.userId, NOTIFY.REMINDER.type])).rows;
    expect(nudges).toHaveLength(1);
    // The reminder is unchanged — and its first sentence is the row's.
    expect(nudges[0].body).toBe(`${line} Nothing happens until you reply.`);
  });

  it('the line function alone: the new sentence needs the plan out AND the turn on the brand; nothing else moved', () => {
    const shootPlan = require('../src/services/shootPlan.service');
    const when = new Date(Date.now() + 3 * 86400000);
    const sent = { id: 'pe1', status: 'proposed', visit_scheduled_at: when, plan_sent_at: new Date() };
    // A caller that does not say whose turn it is gets exactly what it got before.
    expect(shootPlan.brandLineFor(sent, 'Tanvi Suresh')).toMatch(WAITING_ON_HER);
    expect(shootPlan.brandLineFor(sent, 'Tanvi Suresh', null)).toMatch(WAITING_ON_HER);
    expect(shootPlan.brandLineFor(sent, 'Tanvi Suresh', 'influencer')).toMatch(WAITING_ON_HER);
    expect(shootPlan.brandLineFor(sent, 'Tanvi Suresh', 'brand')).toBe(WAITING_ON_HIM);
    // The turn changes no other stage's line.
    const agreedPe = { ...sent, time_agreed_at: new Date() };
    expect(shootPlan.brandLineFor(agreedPe, 'Tanvi Suresh', 'brand')).toBe(shootPlan.brandLineFor(agreedPe, 'Tanvi Suresh'));
    // An agreed time reads "agreed for" on his row, word for word what her card says (frame F1,
    // U11) — the board's own example, composed from a fixed moment.
    const sun18 = { ...agreedPe, visit_scheduled_at: new Date('2099-10-18T11:00:00+05:30') };
    expect(shootPlan.brandLineFor(sun18, 'Divya R.')).toBe('Store visit agreed for Sun 18 Oct, 11:00 am');
    expect(shootPlan.brandLineFor(sun18, 'Divya R.')).toBe(shootPlan.lineFor(sun18));
    // The other half of that line — the time came and went with nothing marked — did not move.
    const passedPe = { ...agreedPe, visit_scheduled_at: new Date('2020-10-18T11:00:00+05:30') };
    expect(shootPlan.brandLineFor(passedPe, 'Tanvi Suresh')).toBe('The 18 Oct visit passed with nothing marked — send a new time');
    const attendedPe = { ...agreedPe, influencer_completed_at: new Date() };
    expect(shootPlan.brandLineFor(attendedPe, 'Tanvi Suresh', 'brand')).toBe('Tanvi says she visited — confirm the shoot is done');
    const notSent = { id: 'pe1', status: 'proposed' };
    expect(shootPlan.brandLineFor(notSent, 'Tanvi Suresh', 'brand')).toBe('Signed — plan the store visit');
    expect(shootPlan.brandLineFor(null, 'Tanvi Suresh', 'brand')).toBeNull();
  });
});
