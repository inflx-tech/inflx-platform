'use strict';

/**
 * Item 6 — negotiation, the move request and the pool, against the real database: the per-Aim
 * snapshot, rounds stamped at the start, no automatic decline, accepting rewriting the invitation,
 * the switch, the move request (the defect fixed), the pool through all its states, the admin
 * settings and their audit, Needs You, privacy, and 404 for everyone else.
 * Contract: features/item6-negotiation · PROMPT §12.1 checks 1–35 · APPROVAL §5 (checks 36–44)
 */

const { truncateAll } = require('./helpers/db');
const { query, brand, creator, api, resetReference, setCreatorInvite } = require('./helpers/item3');
const { MSG: MSG5 } = require('../src/services/invitationCopy');
const { MSG: MSG6 } = require('../src/services/negotiationCopy');
const settings = require('../src/services/platformSettings.service');
const setExpiry = require('../src/jobs/set-expiry.job');
const housekeeping = require('../src/jobs/negotiation-housekeeping.job');
const negotiation = require('../src/services/negotiation.service');
const { todayInIndia, addDays } = require('../src/utils/indiaDay');
const state = require('../src/services/campaignState.service');

beforeEach(async () => { await truncateAll(); await resetReference(); settings._resetCache(); });
afterEach(() => settings._resetCache());

const today = () => todayInIndia();
const day = (n) => addDays(today(), n);
const LEAK = /brief|total_budget|set_budget|per_influencer_budget|coupon_prefix|minimum|minimums|warnings|BELOW_MIN|source_group|sourceGroup|invited_by/i;

async function campaign(b, over = {}) {
  const r = await api.post('/campaigns', b.token, { name: 'Diwali Edit 2026', ...over });
  if (r.status !== 201) throw new Error(`campaign: ${JSON.stringify(r.body)}`);
  return r.body.data.campaign;
}
async function set(b, campaignId, over = {}) {
  const r = await api.post(`/campaigns/${campaignId}/sets`, b.token, { name: 'Set A · Ethnic wear', goal: 'conversion', shoot_mode: 'shipment', go_live_date: day(10), ...over });
  if (r.status !== 201) throw new Error(`set: ${JSON.stringify(r.body)}`);
  return r.body.data.set;
}
const SALE = { commissionPct: 10, scope: 'store' };
const CONTENT = { fee: 8000, deliverables: [{ type: 'reel', count: 1 }, { type: 'story', count: 2 }] };

/** A brand, a campaign, a set, a creator and one sent invitation. */
async function world(goal = 'conversion', { terms = null, campaignOver = {}, setOver = {} } = {}) {
  const b = await brand();
  const c = await campaign(b, campaignOver);
  const s = await set(b, c.id, { goal, ...setOver });
  const cr = await creator({ name: 'Priya Sharma' });
  const t = terms || (goal === 'engagement' ? CONTENT : goal === 'hybrid' ? { fee: 5000, commissionPct: 10, scope: 'store' } : SALE);
  const r = await api.post(`/campaigns/${c.id}/sets/${s.id}/invitations`, b.token, { creators: [{ influencerId: cr.influencerId, terms: await require('./helpers/sell').sellable(b.brandId, t) }] });
  if (r.status !== 201) throw new Error(`invite: ${JSON.stringify(r.body)}`);
  const ciId = r.body.data.rows[0].id;
  return { b, c, s, cr, ciId, url: `/campaigns/${c.id}/sets/${s.id}`, goal };
}
const ciRow = async (id) => (await query(`SELECT * FROM campaign_influencers WHERE id = $1`, [id])).rows[0];
const negRow = async (ciId) => (await query(`SELECT * FROM negotiations WHERE campaign_influencer_id = $1`, [ciId])).rows[0];
const turns = async (negId) => (await query(`SELECT * FROM negotiation_turns WHERE negotiation_id = $1 ORDER BY created_at, id`, [negId])).rows;
const notifs = async (userId) => (await query(`SELECT type, body FROM notifications WHERE user_id = $1 ORDER BY created_at`, [userId])).rows;
const poolRows = async (brandId) => (await query(`SELECT * FROM brand_creator_pool WHERE brand_id = $1 ORDER BY created_at`, [brandId])).rows;
const moveSetTo = (setId, postingDay) => query(`UPDATE campaign_sets SET go_live_date = $2, invites_close_at = $3 WHERE id = $1`, [setId, postingDay, state.cutoffFor(postingDay)]);
const signBoth = (ciId) => query(`INSERT INTO contracts (campaign_influencer_id, influencer_fee, status, influencer_signed_at, brand_signed_at) VALUES ($1, 1000, 'active', now(), now())`, [ciId]);

const counter = (w, terms, note) => api.post(`/influencers/me/invitations/${w.ciId}/counter`, w.cr.token, { terms, note });
const brandCounter = (w, terms, note) => api.post(`${w.url}/invitations/${w.ciId}/thread/counter`, w.b.token, { terms, note });
const myThread = (w) => api.get(`/influencers/me/invitations/${w.ciId}/thread`, w.cr.token);
const brandThread = (w) => api.get(`${w.url}/invitations/${w.ciId}/thread`, w.b.token);

/* ─────────────────────────────────────────────────────── the counter */

describe('countering, per Aim (checks 1–5)', () => {
  it('a Pay for Sale counter: the thread carries 10% → 13% and her note, and the brand sees it (check 1)', async () => {
    const w = await world('conversion');
    const r = await counter(w, { commissionPct: 13 }, 'Ethnic wear takes a full day to shoot. 13% works for me.');
    expect(r.status).toBe(201);
    const t = r.body.data.thread;
    expect(t.negotiation).toMatchObject({ open: true, whoseMove: 'brand', countersUsed: 1, roundLimit: 2 });
    expect(t.turns[0]).toMatchObject({ by: 'influencer', kind: 'counter', note: 'Ethnic wear takes a full day to shoot. 13% works for me.' });
    expect(t.turns[0].changes).toEqual([{ term: 'commissionPct', from: '10%', to: '13%' }]);
    expect(t.invitation.terms).toEqual({ commissionPct: 10 });
    // The invitation itself is untouched until someone accepts; the row is answered.
    const row = await ciRow(w.ciId);
    expect(row.status).toBe('negotiating');
    expect(Number(row.commission_pct)).toBe(10);
    expect(row.answered_at).toBeTruthy();
    const bt = await brandThread(w);
    expect(bt.body.data.thread.turns[0].changes).toEqual([{ term: 'commissionPct', from: '10%', to: '13%' }]);
    expect(bt.body.data.thread.negotiation.whoseMove).toBe('brand');
    const n = await notifs(w.b.userId);
    expect(n[n.length - 1].type).toBe('negotiation.turn');
  });

  it('a Pay for Content counter carries fee, deliverables and usage rights together, each old → new (check 2)', async () => {
    const w = await world('engagement', { terms: { ...CONTENT, usageRights: { on: true, durationDays: 60, places: ['social', 'ads'] } } });
    const r = await counter(w, { fee: 12000, deliverables: [{ type: 'reel', count: 1 }, { type: 'story', count: 1 }], usageRights: null }, 'Happy to do this at ₹12,000 with one story.');
    expect(r.status).toBe(201);
    const ch = r.body.data.thread.turns[0].changes;
    expect(ch).toEqual(expect.arrayContaining([
      { term: 'fee', from: '₹8,000', to: '₹12,000' },
      { term: 'deliverables', from: '1 Instagram reel, 2 Instagram stories', to: '1 Instagram reel, 1 Instagram story' },
      { term: 'usageRights', from: '60 days · social and ads', to: 'Off' },
    ]));
    const stored = await turns((await negRow(w.ciId)).id);
    // Item 21: the fixture carries one shoppable post; a counter that does not name the number keeps it.
    expect(stored[0].terms_json).toEqual({ fee: 12000, deliverables: [{ type: 'reel', count: 1 }, { type: 'story', count: 1 }], usageRights: null, shoppablePostsN: 1 });
  });

  it('a Hybrid counter carries the fixed fee and the commission, and refuses ₹0 (check 3)', async () => {
    const w = await world('hybrid');
    let r = await counter(w, { fee: 0, commissionPct: 12 });
    expect(r.status).toBe(422); expect(r.body.error.message).toBe(MSG5.HYBRID_FEE);
    r = await counter(w, { fee: 7000, commissionPct: 12 });
    expect(r.status).toBe(201);
    expect(r.body.data.thread.turns[0].changes).toEqual(expect.arrayContaining([
      { term: 'fee', from: '₹5,000', to: '₹7,000' }, { term: 'commissionPct', from: '10%', to: '12%' },
    ]));
  });

  it('a counter that changes nothing is refused with the exact message (check 4)', async () => {
    const w = await world('conversion');
    const r = await counter(w, { commissionPct: 10 });
    expect(r.status).toBe(422); expect(r.body.error.message).toBe(MSG6.NOTHING_CHANGED);
    expect(await negRow(w.ciId)).toBeUndefined();
  });

  it("item 5's limits and messages apply identically from either side (check 5)", async () => {
    const w = await world('conversion');
    let r = await counter(w, { commissionPct: 0 });
    expect(r.status).toBe(422); expect(r.body.error.message).toBe(MSG5.COMMISSION_RANGE);
    r = await counter(w, { commissionPct: 140 });
    expect(r.status).toBe(422); expect(r.body.error.message).toBe(MSG5.COMMISSION_RANGE);
    r = await counter(w, {});
    expect(r.status).toBe(422); expect(r.body.error.message).toBe(MSG5.COMMISSION_REQUIRED);
    r = await counter(w, { commissionPct: 13 }, 'x'.repeat(301));
    expect(r.status).toBe(422); expect(r.body.error.message).toBe(MSG6.NOTE_LONG);
    expect((await counter(w, { commissionPct: 13 })).status).toBe(201);
    // …and from the brand's side, the same messages.
    r = await brandCounter(w, { commissionPct: 140 });
    expect(r.status).toBe(422); expect(r.body.error.message).toBe(MSG5.COMMISSION_RANGE);
    r = await brandCounter(w, { commissionPct: 13 });
    expect(r.status).toBe(422); expect(r.body.error.message).toBe(MSG6.NOTHING_CHANGED);
  });
});

/* ──────────────────────────────────────────────────────────── rounds */

describe('rounds (checks 6–8)', () => {
  it('with rounds at 2 a third counter is refused, and the thread says so before it (checks 6, 7)', async () => {
    const w = await world('conversion');
    expect((await counter(w, { commissionPct: 13 })).status).toBe(201);
    let t = (await brandThread(w)).body.data.thread;
    expect(t.negotiation).toMatchObject({ countersUsed: 1, roundLimit: 2, isLastRound: true, noRoundsLeft: false });
    expect(t.can.counter).toBe(true);
    expect((await brandCounter(w, { commissionPct: 11.5 })).status).toBe(201);
    t = (await myThread(w)).body.data.thread;
    expect(t.negotiation).toMatchObject({ countersUsed: 2, noRoundsLeft: true, whoseMove: 'influencer' });
    expect(t.can).toMatchObject({ counter: false, accept: true, decline: true });
    const r = await counter(w, { commissionPct: 12.5 });
    expect(r.status).toBe(422); expect(r.body.error.code).toBe('NO_ROUNDS_LEFT'); expect(r.body.error.message).toBe(MSG6.NO_ROUNDS_LEFT);
  });

  it('the limit is stamped at the start: changing the admin setting leaves an open negotiation alone and applies to the next (check 8)', async () => {
    const w = await world('conversion');
    await counter(w, { commissionPct: 13 });
    expect((await negRow(w.ciId)).round_limit).toBe(2);
    await query(`UPDATE platform_settings SET value = 3 WHERE key = 'negotiation_rounds'`);
    settings._resetCache();
    expect((await brandThread(w)).body.data.thread.negotiation.roundLimit).toBe(2);
    // a new negotiation, on another invitation, takes the new number
    const cr2 = await creator({ name: 'Tanvi S.' });
    const inv = await api.post(`${w.url}/invitations`, w.b.token, { creators: [{ influencerId: cr2.influencerId, terms: await require('./helpers/sell').sellable(w.b.brandId, SALE) }] });
    const r = await api.post(`/influencers/me/invitations/${inv.body.data.rows[0].id}/counter`, cr2.token, { terms: { commissionPct: 14 } });
    expect(r.status).toBe(201);
    expect(r.body.data.thread.negotiation.roundLimit).toBe(3);
  });
});

/* ───────────────────────────────────────────────── accept and decline */

describe('accepting and declining (checks 9–11)', () => {
  it('the brand accepts: the invitation is rewritten, the row is accepted, a contract is drafted and she is told (check 9)', async () => {
    const w = await world('engagement', { terms: { ...CONTENT, usageRights: { on: true, durationDays: 60, places: ['social'] } } });
    await counter(w, { fee: 12000, deliverables: [{ type: 'reel', count: 2 }], usageRights: { on: true, durationDays: 30, places: ['ads'] } });
    const r = await api.post(`${w.url}/invitations/${w.ciId}/thread/accept`, w.b.token);
    expect(r.status).toBe(200);
    const row = await ciRow(w.ciId);
    expect(row.status).toBe('accepted');
    expect(Number(row.agreed_fee)).toBe(12000);
    expect(row.formats_json).toEqual([{ type: 'reel', count: 2 }]);
    expect(row.usage_rights_json).toEqual({ on: true, duration_days: 30, places: ['ads'] });
    expect(row.answered_at).toBeTruthy();
    const neg = await negRow(w.ciId);
    expect(neg).toMatchObject({ outcome: 'agreed', current_turn: null });
    expect(neg.ended_at).toBeTruthy();
    expect((await turns(neg.id)).map(t => t.kind)).toEqual(['counter', 'accept']);
    expect((await query(`SELECT count(*)::int n FROM contracts WHERE campaign_influencer_id = $1`, [w.ciId])).rows[0].n).toBe(1);
    const n = await notifs(w.cr.userId);
    expect(n[n.length - 1].type).toBe('negotiation.agreed');
    // The thread reads as agreed, and nothing more can be countered.
    const t = (await brandThread(w)).body.data.thread;
    expect(t.ending).toMatchObject({ outcome: 'agreed' });
    expect(t.ending.text).toContain('Send the agreement next.');
    expect((await counter(w, { fee: 13000, deliverables: [{ type: 'reel', count: 2 }] })).body.error.message).toBe(MSG6.AGREED);
  });

  it('the brand declines with a reason: she sees it, the invitation ends, and she can be invited again (check 10)', async () => {
    const w = await world('conversion');
    await counter(w, { commissionPct: 13 });
    const r = await api.post(`${w.url}/invitations/${w.ciId}/thread/decline`, w.b.token, { note: "We can't go above 11.5% on this campaign." });
    expect(r.status).toBe(200);
    const row = await ciRow(w.ciId);
    expect(row.status).toBe('rejected_by_brand');
    expect(row.declined_note).toBe("We can't go above 11.5% on this campaign.");
    expect((await negRow(w.ciId)).outcome).toBe('declined_by_brand');
    const n = await notifs(w.cr.userId);
    expect(n[n.length - 1].type).toBe('negotiation.declined');
    expect(n[n.length - 1].body).toContain("We can't go above 11.5% on this campaign.");
    const mine = (await myThread(w)).body.data.thread;
    expect(mine.ending.text).toContain('was told');
    // Re-invitable before the cutoff — the dead status is outside item 5's live unique index.
    const again = await api.post(`${w.url}/invitations`, w.b.token, { creators: [{ influencerId: w.cr.influencerId, terms: await require('./helpers/sell').sellable(w.b.brandId, { commissionPct: 11.5, scope: 'store' }) }] });
    expect(again.status).toBe(201);
  });

  it('the creator declines mid-negotiation with one of the five reasons, and the brand sees it (check 11)', async () => {
    const w = await world('conversion');
    await counter(w, { commissionPct: 13 });
    await brandCounter(w, { commissionPct: 11.5 });
    let r = await api.post(`/influencers/me/invitations/${w.ciId}/thread/decline`, w.cr.token, {});
    expect(r.status).toBe(422); expect(r.body.error.message).toBe(MSG5.DECLINE_REASON);
    r = await api.post(`/influencers/me/invitations/${w.ciId}/thread/decline`, w.cr.token, { reason: 'fee_too_low', note: 'Not for this one.' });
    expect(r.status).toBe(200);
    const row = await ciRow(w.ciId);
    expect(row).toMatchObject({ status: 'declined', declined_reason: 'fee_too_low' });
    expect((await negRow(w.ciId)).outcome).toBe('declined_by_creator');
    const n = await notifs(w.b.userId);
    expect(n[n.length - 1].body).toContain('Fee too low');
    const t = (await brandThread(w)).body.data.thread;
    expect(t.turns[0]).toMatchObject({ kind: 'decline', declineReasonLabel: 'Fee too low' });
    expect(t.ending.text).toContain('fee too low');
  });
});

/* ───────────────────────────────────────────────────────────── time */

describe('time: the cutoff is the only deadline (checks 12–14)', () => {
  it('no negotiation is auto-declined after 48 hours, and the old job is gone (check 12)', async () => {
    const w = await world('conversion');
    await counter(w, { commissionPct: 13 });
    await query(`UPDATE negotiations SET created_at = now() - interval '5 days', turn_changed_at = now() - interval '5 days' WHERE campaign_influencer_id = $1`, [w.ciId]);
    expect(() => require('../src/jobs/negotiation-expiry.job')).toThrow();
    const out = await housekeeping.run({});
    expect(out.reminders.sent7d + out.reminders.sent48h).toBe(1);
    const neg = await negRow(w.ciId);
    expect(neg.outcome).toBeNull();
    expect((await ciRow(w.ciId)).status).toBe('negotiating');
  });

  it('at the cutoff an open negotiation ends with its invitation, both are told, the thread is readable (check 13)', async () => {
    const w = await world('conversion');
    await counter(w, { commissionPct: 13 });
    await moveSetTo(w.s.id, day(2));   // cutoff was yesterday
    const out = await setExpiry.run({ today: today() });
    expect(out.expired).toBe(1);
    expect(out.negotiationsEnded).toBe(1);
    expect((await ciRow(w.ciId)).status).toBe('expired');
    expect((await negRow(w.ciId)).outcome).toBe('expired');
    for (const uid of [w.b.userId, w.cr.userId]) {
      const n = await notifs(uid);
      expect(n[n.length - 1].type).toBe('negotiation.expired');
      expect(n[n.length - 1].body).toContain('ended unfinished');
    }
    const t = (await myThread(w)).body.data.thread;
    expect(t.turns).toHaveLength(1);
    expect(t.ending).toMatchObject({ outcome: 'expired' });
  });

  it('a counter after the cutoff is refused from either side (check 14)', async () => {
    const w = await world('conversion');
    await counter(w, { commissionPct: 13 });
    await moveSetTo(w.s.id, day(2));
    let r = await brandCounter(w, { commissionPct: 11.5 });
    expect(r.status).toBe(422); expect(r.body.error.message).toBe(MSG6.CLOSED(day(-1)));
    r = await api.post(`${w.url}/invitations/${w.ciId}/thread/accept`, w.b.token);
    expect(r.status).toBe(422); expect(r.body.error.message).toBe(MSG6.CLOSED(day(-1)));
    r = await counter(w, { commissionPct: 14 });
    expect(r.status).toBe(422); expect(r.body.error.message).toBe(MSG6.CLOSED(day(-1)));
  });

  it('reminders go only to the side whose move it is, and stop when the move changes hands (check 43)', async () => {
    const w = await world('conversion');
    await counter(w, { commissionPct: 13 });
    await query(`UPDATE negotiations SET turn_changed_at = now() - interval '3 days' WHERE campaign_influencer_id = $1`, [w.ciId]);
    let out = await housekeeping.run({});
    expect(out.reminders.sent48h).toBe(1);
    const bn = await notifs(w.b.userId);
    expect(bn[bn.length - 1].type).toBe('negotiation.reminder');
    expect((await notifs(w.cr.userId)).filter(x => x.type === 'negotiation.reminder')).toHaveLength(0);
    // once is enough while nothing changes
    out = await housekeeping.run({});
    expect(out.reminders.sent48h).toBe(0);
    // the move changes hands → the clock and the flags reset, and the next reminder is hers
    await brandCounter(w, { commissionPct: 11.5 });
    const neg = await negRow(w.ciId);
    expect(neg.reminder_48h_sent_at).toBeNull();
    await query(`UPDATE negotiations SET turn_changed_at = now() - interval '3 days' WHERE id = $1`, [neg.id]);
    out = await housekeeping.run({});
    expect(out.reminders.sent48h).toBe(1);
    expect((await notifs(w.cr.userId)).filter(x => x.type === 'negotiation.reminder')).toHaveLength(1);
    expect((await notifs(w.b.userId)).filter(x => x.type === 'negotiation.reminder')).toHaveLength(1);
  });
});

/* ─────────────────────────────────────────────────────────── the switch */

describe('the negotiation switch (checks 15–17)', () => {
  it('with the switch off there is no Counter and the API refuses one (check 15)', async () => {
    const w = await world('conversion', { campaignOver: { allow_negotiation: false } });
    const r = await counter(w, { commissionPct: 13 });
    expect(r.status).toBe(403); expect(r.body.error.message).toBe(MSG6.SWITCH_OFF(w.b.name));
    const inv = await api.get(`/influencers/me/invitations/${w.ciId}`, w.cr.token);
    expect(inv.body.data.invitation).toMatchObject({ canCounter: false, counterHiddenReason: 'switch_off', switchOn: false });
    expect((await myThread(w)).body.data.thread.can.counter).toBe(false);
  });

  it('turning it off does not stop an open negotiation, and turning it back on works (check 16)', async () => {
    const w = await world('conversion');
    await counter(w, { commissionPct: 13 });
    let r = await api.patch(`/campaigns/${w.c.id}`, w.b.token, { allow_negotiation: false });
    expect(r.status).toBe(200);
    // the open thread runs to its end
    expect((await brandCounter(w, { commissionPct: 11.5 })).status).toBe(201);
    expect((await myThread(w)).body.data.thread.can.counter).toBe(false); // rounds, not the switch
    r = await api.post(`/influencers/me/invitations/${w.ciId}/thread/accept`, w.cr.token);
    expect(r.status).toBe(200);
    expect(Number((await ciRow(w.ciId)).commission_pct)).toBe(11.5);
    // back on, and a fresh invitation may be countered again
    expect((await api.patch(`/campaigns/${w.c.id}`, w.b.token, { allow_negotiation: true })).status).toBe(200);
    expect((await api.get(`/campaigns/${w.c.id}/summary`, w.b.token)).body.data.campaign.allowNegotiation).toBe(true);
  });

  it('a move request costs no round and is still possible with the switch off (check 17)', async () => {
    const w = await world('conversion', { campaignOver: { allow_negotiation: false } });
    const r = await api.post(`/influencers/me/invitations/${w.ciId}/move-request`, w.cr.token, { goLiveDate: day(17), note: "I'm travelling that week." });
    expect(r.status).toBe(201);
    expect(await negRow(w.ciId)).toBeUndefined();  // no thread, no round consumed
    const t = r.body.data.thread;
    expect(t.moveRequest).toMatchObject({ goLiveDate: day(17), note: "I'm travelling that week.", answer: null });
    expect(t.negotiation.countersUsed).toBe(0);
  });
});

/* ─────────────────────────────────────────────── the move request (the fix) */

describe('the move request (checks 18–20, 36–38)', () => {
  it('asking does NOT change the invitation, and the brand sees it under "Your move" (check 36 — the defect fixed)', async () => {
    // Before item 6, POST /offers/:id/defer set status='deferred' the moment she asked, ending the
    // invitation with nobody having agreed to anything.
    const w = await world('conversion');
    const r = await api.post(`/influencers/me/invitations/${w.ciId}/move-request`, w.cr.token, { goLiveDate: day(17) });
    expect(r.status).toBe(201);
    const row = await ciRow(w.ciId);
    expect(row.status).toBe('invited');            // NOT 'deferred'
    expect(row.move_requested_at).toBeTruthy();
    expect(row.move_answer).toBeNull();
    const summary = await api.get(`${w.url}/summary`, w.b.token);
    const g = summary.body.data.creators.groups;
    expect(g.yourMove.count).toBe(1);
    expect(g.yourMove.rows[0]).toMatchObject({ name: 'Priya Sharma', moveRequest: { goLiveDate: day(17) } });
    expect(g.waiting.count).toBe(0);
    expect(summary.body.data.set.counts).toMatchObject({ invited: 1, waiting: 1 });
    const n = await notifs(w.b.userId);
    expect(n[n.length - 1].type).toBe('move.requested');
    // The legacy door behaves the same way now (check 44).
    const w2 = await world('conversion');
    const legacy = await api.post(`/offers/${w2.ciId}/defer`, w2.cr.token, { go_live_date: day(20) });
    expect(legacy.status).toBe(200);
    expect((await ciRow(w2.ciId)).status).toBe('invited');
  });

  it('"Keep the date" leaves the invitation untouched, tells her, and she cannot ask twice (checks 18, 37)', async () => {
    const w = await world('conversion');
    await api.post(`/influencers/me/invitations/${w.ciId}/move-request`, w.cr.token, { goLiveDate: day(17) });
    const r = await api.post(`${w.url}/invitations/${w.ciId}/move-answer`, w.b.token, { answer: 'kept' });
    expect(r.status).toBe(200);
    const row = await ciRow(w.ciId);
    expect(row).toMatchObject({ status: 'invited', move_answer: 'kept' });
    const n = await notifs(w.cr.userId);
    expect(n[n.length - 1].type).toBe('move.kept');
    expect(n[n.length - 1].body).toContain('You can still accept or decline');
    // Once means once (rules v1.18 §7B).
    const again = await api.post(`/influencers/me/invitations/${w.ciId}/move-request`, w.cr.token, { goLiveDate: day(20) });
    expect(again.status).toBe(409); expect(again.body.error.message).toBe(MSG6.MOVE_TWICE);
    // …and she can still accept what she has.
    expect((await api.post(`/influencers/me/invitations/${w.ciId}/accept`, w.cr.token)).status).toBe(200);
  });

  it('agreeing closes the invitation, keeps the terms and creates a pool entry; the counts stay honest (checks 19, 20)', async () => {
    const w = await world('conversion');
    await api.post(`/influencers/me/invitations/${w.ciId}/move-request`, w.cr.token, { goLiveDate: day(17), note: 'Travelling.' });
    const r = await api.post(`${w.url}/invitations/${w.ciId}/move-answer`, w.b.token, { answer: 'agreed' });
    expect(r.status).toBe(200);
    expect(r.body.data.poolEntryId).toBeTruthy();
    const row = await ciRow(w.ciId);
    expect(row).toMatchObject({ status: 'deferred', move_answer: 'agreed' });
    const [entry] = await poolRows(w.b.brandId);
    expect(entry).toMatchObject({ goal: 'conversion', state: 'waiting', lifetime_days: 30, from_ci_id: w.ciId });
    expect(entry.agreed_terms_json).toEqual({ commissionPct: 10 });
    expect(new Date(entry.expires_at).getTime()).toBeGreaterThan(Date.now());
    const n = await notifs(w.cr.userId);
    expect(n[n.length - 1].type).toBe('pool.entered');
    // The set's counts: she is out of waiting, and the group is "Moved to your pool".
    const summary = await api.get(`${w.url}/summary`, w.b.token);
    expect(summary.body.data.set.counts).toMatchObject({ invited: 1, waiting: 0, declined: 0 });
    expect(summary.body.data.creators.groups.deferred.count).toBe(1);
    expect(summary.body.data.creators.groups.deferred.title).toBe('Moved to your pool');
  });

  it('a move agreed while a counter is on the table ends the thread as moved and carries the invitation terms, not the counter (check 38)', async () => {
    const w = await world('conversion');
    await counter(w, { commissionPct: 13 });          // she asked 13%, the brand never agreed
    await api.post(`/influencers/me/invitations/${w.ciId}/move-request`, w.cr.token, { goLiveDate: day(17) });
    const r = await api.post(`${w.url}/invitations/${w.ciId}/move-answer`, w.b.token, { answer: 'agreed' });
    expect(r.status).toBe(200);
    expect((await negRow(w.ciId)).outcome).toBe('moved');
    const [entry] = await poolRows(w.b.brandId);
    expect(entry.agreed_terms_json).toEqual({ commissionPct: 10 });   // the row's 10%, never the 13%
    expect(r.body.data.thread.ending).toMatchObject({ outcome: 'moved' });
  });

  it('the brand declines the request: the invitation ends and she is told', async () => {
    const w = await world('conversion');
    await api.post(`/influencers/me/invitations/${w.ciId}/move-request`, w.cr.token, { shootMode: 'visit' });
    const r = await api.post(`${w.url}/invitations/${w.ciId}/move-answer`, w.b.token, { answer: 'declined' });
    expect(r.status).toBe(200);
    expect((await ciRow(w.ciId)).status).toBe('rejected_by_brand');
    expect(await poolRows(w.b.brandId)).toHaveLength(0);
    const n = await notifs(w.cr.userId);
    expect(n[n.length - 1].type).toBe('move.declined');
  });

  it('the same date, nothing chosen, and a date inside the seven-day floor are refused', async () => {
    const w = await world('conversion');
    let r = await api.post(`/influencers/me/invitations/${w.ciId}/move-request`, w.cr.token, {});
    expect(r.status).toBe(422); expect(r.body.error.message).toBe(MSG6.MOVE_NOTHING);
    r = await api.post(`/influencers/me/invitations/${w.ciId}/move-request`, w.cr.token, { goLiveDate: day(10) });
    expect(r.status).toBe(422); expect(r.body.error.message).toBe(MSG6.MOVE_SAME_DATE);
    r = await api.post(`/influencers/me/invitations/${w.ciId}/move-request`, w.cr.token, { goLiveDate: day(3) });
    expect(r.status).toBe(422);
  });
});

/* ────────────────────────────────────────────────────────────── the pool */

describe('the pool (checks 21–28, 39–41)', () => {
  /** A brand with `n` pool entries, from separate campaigns when asked. */
  async function pooled(b, { names = ['Ritu V.'], wants = day(17), goal = 'conversion', terms = SALE, separateCampaign = false } = {}) {
    const out = [];
    let c = null, s = null;
    for (const name of names) {
      if (!c || separateCampaign) { c = await campaign(b, { name: `Campaign ${out.length}` }); s = await set(b, c.id, { goal }); }
      const cr = await creator({ name });
      const inv = await api.post(`/campaigns/${c.id}/sets/${s.id}/invitations`, b.token, { creators: [{ influencerId: cr.influencerId, terms: await require('./helpers/sell').sellable(b.brandId, terms) }] });
      const ciId = inv.body.data.rows[0].id;
      await api.post(`/influencers/me/invitations/${ciId}/move-request`, cr.token, { goLiveDate: wants });
      await api.post(`/campaigns/${c.id}/sets/${s.id}/invitations/${ciId}/move-answer`, b.token, { answer: 'agreed' });
      out.push({ cr, ciId, campaignId: c.id, setId: s.id });
    }
    return out;
  }

  it('the pool is brand-level: an entry made in one campaign shows when building in another, grouped, with days left (checks 21, 22)', async () => {
    const b = await brand();
    await pooled(b, { names: ['Ritu V.', 'Priya Sharma'], wants: day(17), separateCampaign: true });
    await pooled(b, { names: ['Divya R.'], wants: null, goal: 'conversion' }).catch(() => {});
    const r = await api.get('/brands/me/pool', b.token);
    expect(r.status).toBe(200);
    expect(r.body.data.total).toBeGreaterThanOrEqual(2);
    const g = r.body.data.groups.find(x => x.key === `date:${day(17)}`);
    expect(g.count).toBe(2);
    expect(g.rows[0]).toMatchObject({ goal: 'conversion', termsLine: '10%', state: 'waiting' });
    expect(g.rows[0].daysLeft).toBeGreaterThan(20);
    expect(g.rows.map(x => x.creator.name).sort()).toEqual(['Priya Sharma', 'Ritu V.']);
    // another brand sees nothing of it
    const other = await brand();
    expect((await api.get('/brands/me/pool', other.token)).body.data.total).toBe(0);
  });

  it('two Aims in one set is refused with the exact message (check 23)', async () => {
    const b = await brand();
    const [a] = await pooled(b, { names: ['Ritu V.'], goal: 'conversion', terms: SALE, separateCampaign: true });
    const [c2] = await pooled(b, { names: ['Sneha N.'], goal: 'engagement', terms: CONTENT, separateCampaign: true });
    const pool = (await api.get('/brands/me/pool', b.token)).body.data;
    const ids = pool.groups.flatMap(g => g.rows).map(x => x.entryId);
    const r = await api.post('/brands/me/pool/set-defaults', b.token, { entryIds: ids });
    expect(r.status).toBe(422); expect(r.body.error.message).toBe(MSG6.POOL_MIXED_AIMS);
    expect(a && c2).toBeTruthy();
  });

  it('set-defaults pre-fills Aim, mode and date, and the terms travel to the new invitation (checks 24, 25)', async () => {
    const b = await brand();
    const [p] = await pooled(b, { names: ['Ritu V.'], wants: day(20) });
    const pool = (await api.get('/brands/me/pool', b.token)).body.data;
    const entry = pool.groups[0].rows[0];
    const d = await api.post('/brands/me/pool/set-defaults', b.token, { entryIds: [entry.entryId] });
    expect(d.status).toBe(200);
    expect(d.body.data).toMatchObject({ goal: 'conversion', go_live_date: day(20), dateNoLongerPossible: false });
    expect(d.body.data.creators[0]).toMatchObject({ influencerId: p.cr.influencerId, terms: { commissionPct: 10 }, termsLine: '10%' });
    // Build the set and send from the pool: she gets an ordinary invitation, marked.
    const c2 = await campaign(b, { name: 'New campaign' });
    const s2 = await set(b, c2.id, { goal: 'conversion', go_live_date: day(20) });
    const sent = await api.post(`/campaigns/${c2.id}/sets/${s2.id}/invitations`, b.token, { creators: [{ influencerId: p.cr.influencerId, terms: await require('./helpers/sell').sellable(b.brandId, entry.terms), poolEntryId: entry.entryId }] });
    expect(sent.status).toBe(201);
    const row = await ciRow(sent.body.data.rows[0].id);
    expect(row.source).toBe('pool');
    expect(row.pool_entry_id).toBe(entry.entryId);
    expect(Number(row.commission_pct)).toBe(10);
    // used the moment she is invited, whatever she then answers
    expect((await poolRows(b.brandId))[0].state).toBe('used');
    const mine = await api.get(`/influencers/me/invitations/${row.id}`, p.cr.token);
    expect(mine.body.data.invitation.fromPool).toMatchObject({ sameDate: true });
    expect(mine.body.data.invitation.canAnswer).toBe(true);
    expect(JSON.stringify(mine.body)).not.toMatch(LEAK);
  });

  it('a pool creator invited into a different date is told about the terms only, never the date (check 40)', async () => {
    const b = await brand();
    const [p] = await pooled(b, { names: ['Ritu V.'], wants: day(20) });
    const entry = (await api.get('/brands/me/pool', b.token)).body.data.groups[0].rows[0];
    const c2 = await campaign(b, { name: 'Another' });
    const s2 = await set(b, c2.id, { goal: 'conversion', go_live_date: day(30) });   // not her date
    const sent = await api.post(`/campaigns/${c2.id}/sets/${s2.id}/invitations`, b.token, { creators: [{ influencerId: p.cr.influencerId, terms: await require('./helpers/sell').sellable(b.brandId, entry.terms), poolEntryId: entry.entryId }] });
    expect(sent.status).toBe(201);
    const mine = await api.get(`/influencers/me/invitations/${sent.body.data.rows[0].id}`, p.cr.token);
    expect(mine.body.data.invitation.fromPool).toMatchObject({ sameDate: false });
  });

  it('a declined invitation sent from the pool leaves the entry used (check 41)', async () => {
    const b = await brand();
    const [p] = await pooled(b, { names: ['Ritu V.'], wants: day(20) });
    const entry = (await api.get('/brands/me/pool', b.token)).body.data.groups[0].rows[0];
    const c2 = await campaign(b, { name: 'Another' });
    const s2 = await set(b, c2.id, { goal: 'conversion', go_live_date: day(20) });
    const sent = await api.post(`/campaigns/${c2.id}/sets/${s2.id}/invitations`, b.token, { creators: [{ influencerId: p.cr.influencerId, terms: await require('./helpers/sell').sellable(b.brandId, entry.terms), poolEntryId: entry.entryId }] });
    await api.post(`/influencers/me/invitations/${sent.body.data.rows[0].id}/decline`, p.cr.token, { reason: 'other' });
    expect((await poolRows(b.brandId))[0].state).toBe('used');
    expect((await api.get('/brands/me/pool', b.token)).body.data.total).toBe(0);
  });

  it('a creator who became ineligible since joining the pool is caught at send (check 26)', async () => {
    const b = await brand();
    const [p] = await pooled(b, { names: ['Ritu V.'], wants: day(20) });
    const entry = (await api.get('/brands/me/pool', b.token)).body.data.groups[0].rows[0];
    await setCreatorInvite(p.cr.influencerId, { open: false });
    const c2 = await campaign(b, { name: 'Another' });
    const s2 = await set(b, c2.id, { goal: 'conversion', go_live_date: day(20) });
    const sent = await api.post(`/campaigns/${c2.id}/sets/${s2.id}/invitations`, b.token, { creators: [{ influencerId: p.cr.influencerId, terms: await require('./helpers/sell').sellable(b.brandId, entry.terms), poolEntryId: entry.entryId }] });
    expect(sent.status).toBe(422);
    // ui-walk-fixes, founder decision D2 (2 Oct 2026): the refusal now says why. It used to be
    // MSG5.INELIGIBLE('Ritu V.') — "Ritu V. can no longer be invited to this set."
    // (drift: features/ui-walk-fixes/06-diff/drift/SB.md)
    expect(sent.body.error.details.failures[0]).toMatchObject({
      code: 'NOT_ACCEPTING', message: "Ritu isn't taking invitations right now.", label: 'Not taking invitations', detail: 'not_accepting',
    });
    expect((await poolRows(b.brandId))[0].state).toBe('waiting');
  });

  it('an entry expires at its lifetime and both sides are told; seven days out they are warned once (checks 27, 39)', async () => {
    const b = await brand();
    const [p] = await pooled(b, { names: ['Ritu V.'], wants: day(20) });
    let entryRow = (await poolRows(b.brandId))[0];
    // seven days out → one "closing soon" each, once
    await query(`UPDATE brand_creator_pool SET expires_at = now() + interval '3 days' WHERE id = $1`, [entryRow.id]);
    let out = await housekeeping.run({});
    expect(out.pool.closingNotified).toBe(1);
    expect((await notifs(p.cr.userId)).filter(x => x.type === 'pool.closing')).toHaveLength(1);
    out = await housekeeping.run({});
    expect(out.pool.closingNotified).toBe(0);
    // …and the pool marks her closing soon
    const soon = (await api.get('/brands/me/pool', b.token)).body.data.groups[0].rows[0];
    expect(soon.closingSoon).toBe(true);
    // past the lifetime → expired, both told, gone from the pool
    await query(`UPDATE brand_creator_pool SET expires_at = now() - interval '1 hour' WHERE id = $1`, [entryRow.id]);
    out = await housekeeping.run({});
    expect(out.pool.expired).toBe(1);
    entryRow = (await poolRows(b.brandId))[0];
    expect(entryRow.state).toBe('expired');
    expect((await notifs(p.cr.userId)).filter(x => x.type === 'pool.closed')).toHaveLength(1);
    expect((await api.get('/brands/me/pool', b.token)).body.data.total).toBe(0);
    // her own card reads as closed
    const mine = await api.get('/influencers/me/invitations', p.cr.token);
    const card = mine.body.data.rows.find(x => x.id === p.ciId);
    expect(card.group).toBe('closed');
  });

  it('a wanted date now inside seven days shows as no longer possible and pre-fills no date (check 39)', async () => {
    const b = await brand();
    await pooled(b, { names: ['Ritu V.'], wants: day(20) });
    const entry = (await poolRows(b.brandId))[0];
    // Time passes: the date she asked for is now inside item 4's seven-day floor.
    await query(`UPDATE brand_creator_pool SET wants_go_live_date = $2 WHERE id = $1`, [entry.id, day(3)]);
    const pool = (await api.get('/brands/me/pool', b.token)).body.data;
    const g = pool.groups[0];
    expect(g.title).toContain('no longer possible');
    expect(g.rows[0].noLongerPossible).toBe(true);
    const d = await api.post('/brands/me/pool/set-defaults', b.token, { entryIds: [g.rows[0].entryId] });
    expect(d.body.data).toMatchObject({ go_live_date: null, dateNoLongerPossible: true, wantedDate: day(3) });
  });

  it('either side may remove an entry early, and it blocks nothing (check 28)', async () => {
    const b = await brand();
    const [p] = await pooled(b, { names: ['Ritu V.'], wants: day(20) });
    const entry = (await api.get('/brands/me/pool', b.token)).body.data.groups[0].rows[0];
    // an entry never blocks a fresh invitation
    const c2 = await campaign(b, { name: 'Unrelated' });
    const s2 = await set(b, c2.id, { goal: 'conversion' });
    expect((await api.post(`/campaigns/${c2.id}/sets/${s2.id}/invitations`, b.token, { creators: [{ influencerId: p.cr.influencerId, terms: await require('./helpers/sell').sellable(b.brandId, SALE) }] })).status).toBe(201);
    // she leaves
    const mine = await api.get('/influencers/me/pool', p.cr.token);
    expect(mine.body.data.entries[0].entryId).toBe(entry.entryId);
    const left = await api.del(`/influencers/me/pool/${entry.entryId}`, p.cr.token);
    expect(left.status).toBe(200); expect(left.body.data.state).toBe('removed_by_creator');
    expect((await api.get('/brands/me/pool', b.token)).body.data.total).toBe(0);
    // and a brand may remove one too
    const [p2] = await pooled(b, { names: ['Tanvi S.'], wants: day(21), separateCampaign: true });
    const e2 = (await api.get('/brands/me/pool', b.token)).body.data.groups[0].rows[0];
    const gone = await api.del(`/brands/me/pool/${e2.entryId}`, b.token);
    expect(gone.status).toBe(200); expect(gone.body.data.state).toBe('removed_by_brand');
    expect(p2).toBeTruthy();
  });

  it('the pool is a source inside any set picker, with terms only when the Aim matches', async () => {
    const b = await brand();
    await pooled(b, { names: ['Ritu V.'], wants: day(20), goal: 'conversion', separateCampaign: true });
    const c2 = await campaign(b, { name: 'Sale set' });
    const sale = await set(b, c2.id, { goal: 'conversion' });
    let r = await api.get(`/campaigns/${c2.id}/sets/${sale.id}/pickable?tab=pool`, b.token);
    expect(r.status).toBe(200);
    expect(r.body.data.rows[0].pool).toMatchObject({ sameAim: true, termsLine: '10%' });
    expect(r.body.data.rows[0].pool.terms).toEqual({ commissionPct: 10 });
    const content = await set(b, c2.id, { name: 'Set B', goal: 'engagement' });
    r = await api.get(`/campaigns/${c2.id}/sets/${content.id}/pickable?tab=pool`, b.token);
    expect(r.body.data.rows[0].pool).toMatchObject({ sameAim: false, terms: null });
  });
});

/* ──────────────────────────────────────────── admin, Needs You, privacy */

describe('admin settings, Needs You, privacy and access (checks 29–35, 42, 44)', () => {
  async function admin() {
    const { createAdminUser } = require('./helpers/factories');
    return createAdminUser('superadmin');
  }

  it('the settings read with their ranges; a change is audited; out of range is refused (check 29)', async () => {
    const a = await admin();
    let r = await api.get('/admin/platform-settings', a.token);
    expect(r.status).toBe(200);
    // Items 7, 8, 10 and 11 added more numbers to the same screen (rules v1.20 §9, v1.21 §8,
    // v1.24 §11.1, v1.27 §11.2), and the subscriptions master switch leads the list because it
    // governs whether the plan limits apply at all (features/subscriptions-master-switch).
    //
    // ASSERTION DRIFT, item 11 (R17): remote_return_autoconfirm_days is the one new number —
    // how long a brand has to confirm a Remote return before it confirms itself. The list is
    // asserted exactly on purpose, so a number appearing on this screen is never a surprise.
    //
    // ASSERTION DRIFT, item 12 (C17, approval Q4): three more — content_change_rounds and
    // content_report_silence_days (new), and final_payment_wait_days (moved here from the Payments
    // page, with its audit).
    //
    // ASSERTION DRIFT, post-links-codes (rules v1.6 §4.14): link_channel_window_days is the one new
    // number — how long a tap on a creator's links decides the channel an order counts under.
    expect(r.body.data.settings.map(x => x.key)).toEqual(
      // ASSERTION DRIFT, product-approval-switch (26 Oct 2026): the second switch — whether a brand's
      // published product waits for INFLX before it is live. Ships off.
      ['subscriptions_enforced', 'product_approval_required', 'negotiation_rounds', 'pool_lifetime_days', 'min_shoppable_posts',
        'campaign_fee_pct', 'remote_return_days', 'pitch_response_days', 'pitch_cooldown_days',
        // ASSERTION DRIFT, item 10 walk fix 5 (founder, 1 Oct 2026): shoot_auto_confirm_days left
        // this list — a store visit no longer confirms itself, so the number decides nothing.
        'remote_return_autoconfirm_days', 'content_change_rounds', 'content_report_silence_days', 'final_payment_wait_days',
        // ASSERTION DRIFT, item 14 (rules v1.30 §12.1, A1): how long a Pay for Sale live
        // confirmation waits before it confirms itself.
        'sale_live_autoconfirm_days',
        // ASSERTION DRIFT, item 17 (rules v1.31 §17A, AM12): what a person is told when she asks to withdraw.
        'withdrawal_process_hours',
        'link_channel_window_days',
        // ASSERTION DRIFT, follower-app-v2 (mig 197): the shopper feed's nine numbers. They were
        // never added here, so this check had been red since 29 Sep; corrected 1 Oct 2026.
        'feed_near_km', 'feed_new_share_pct', 'feed_new_hours', 'feed_repeat_days', 'feed_learning_on',
        'feed_w_does', 'feed_w_recent', 'feed_w_near', 'feed_w_performs']
    );
    const rounds = r.body.data.settings.find(x => x.key === 'negotiation_rounds');
    expect(rounds).toMatchObject({ value: 2, min: 1, max: 5, unit: 'rounds' });
    expect(rounds.description).toContain('never affects one already running');
    expect(r.body.data.lastChange).toBeNull();
    r = await api.patch('/admin/platform-settings', a.token, { negotiation_rounds: 9 });
    expect(r.status).toBe(422); expect(r.body.error.message).toBe(MSG6.RANGE(1, 5)); expect(r.body.error.field).toBe('negotiation_rounds');
    r = await api.patch('/admin/platform-settings', a.token, { negotiation_rounds: 3, pool_lifetime_days: 45 });
    expect(r.status).toBe(200);
    expect(r.body.data.changed.map(c => c.key).sort()).toEqual(['negotiation_rounds', 'pool_lifetime_days']);
    // Two keys changed in the same instant, so either is "last"; both are recorded.
    expect(['negotiation_rounds', 'pool_lifetime_days']).toContain(r.body.data.lastChange.key);
    expect(r.body.data.lastChange.changedBy).toBeTruthy();
    const audit = (await query(`SELECT key, old_value, new_value, changed_by FROM platform_settings_audit ORDER BY key`)).rows;
    expect(audit).toHaveLength(2);
    expect(audit[0]).toMatchObject({ key: 'negotiation_rounds', old_value: 2, new_value: 3, changed_by: a.user.id });
    // a brand and a creator cannot read or write it
    const b = await brand(); const cr = await creator();
    expect((await api.get('/admin/platform-settings', b.token)).status).toBe(403);
    expect((await api.patch('/admin/platform-settings', cr.token, { negotiation_rounds: 1 })).status).toBe(403);
  });

  it('min_shoppable_posts is stamped at send and never moves a live invitation (check 42)', async () => {
    const a = await admin();
    const w = await world('conversion');
    expect((await ciRow(w.ciId)).min_shoppable_posts).toBe(1);
    await api.patch('/admin/platform-settings', a.token, { min_shoppable_posts: 3 });
    settings._resetCache();
    // the live one is untouched, on the row and on her screen
    expect((await ciRow(w.ciId)).min_shoppable_posts).toBe(1);
    const mine = await api.get(`/influencers/me/invitations/${w.ciId}`, w.cr.token);
    expect(mine.body.data.invitation.terms.shoppablePostsMin).toBe(1);
    // the next one takes the new number
    const cr2 = await creator({ name: 'Tanvi S.' });
    const sent = await api.post(`${w.url}/invitations`, w.b.token, { creators: [{ influencerId: cr2.influencerId, terms: await require('./helpers/sell').sellable(w.b.brandId, SALE) }] });
    expect((await ciRow(sent.body.data.rows[0].id)).min_shoppable_posts).toBe(3);
  });

  it('the set groups creators with "Your move" first (check 30)', async () => {
    const w = await world('conversion');
    const [t, s2, d] = [await creator({ name: 'Tanvi S.' }), await creator({ name: 'Sneha N.' }), await creator({ name: 'Divya R.' })];
    const SALE_V2 = await require('./helpers/sell').sellable(w.b.brandId, SALE);
    const more = await api.post(`${w.url}/invitations`, w.b.token, { creators: [t, s2, d].map(c => ({ influencerId: c.influencerId, terms: SALE_V2 })) });
    const ids = Object.fromEntries(more.body.data.rows.map(r => [r.name, r.id]));
    await counter(w, { commissionPct: 13 });                                              // her counter → the brand's move
    await api.post(`/influencers/me/invitations/${ids['Tanvi S.']}/counter`, t.token, { terms: { commissionPct: 12 } });
    await api.post(`${w.url}/invitations/${ids['Tanvi S.']}/thread/counter`, w.b.token, { terms: { commissionPct: 11 } }); // waiting on her
    const summary = await api.get(`${w.url}/summary`, w.b.token);
    const g = summary.body.data.creators.groups;
    expect(summary.body.data.creators.order[0]).toBe('yourMove');
    expect(g.yourMove.count).toBe(1);
    expect(g.yourMove.rows[0].name).toBe('Priya Sharma');
    expect(g.negotiating.count).toBe(1);
    expect(g.negotiating.rows[0]).toMatchObject({ name: 'Tanvi S.' });
    expect(g.negotiating.rows[0].negotiation.lastCounter).toMatchObject({ by: 'brand', line: '11%' });
    expect(g.waiting.count).toBe(2);
  });

  it('Needs You shows exactly one side per open negotiation (check 31)', async () => {
    const w = await world('conversion');
    await counter(w, { commissionPct: 13 });
    let creatorNeeds = await api.get('/influencers/me/needs-you', w.cr.token);
    expect(creatorNeeds.body.data.items.counters_to_answer).toBe(0);
    let brandNeeds = await api.get('/brands/me/inbox-summary', w.b.token);
    expect(brandNeeds.body.data.summary.pending_negotiations).toBe(1);
    const step = creatorNeeds.body.data.collaborations.find(x => x.campaign_influencer_id === w.ciId);
    expect(step.own).toBeFalsy();   // it is the brand's move, not hers
    await brandCounter(w, { commissionPct: 11.5 });
    creatorNeeds = await api.get('/influencers/me/needs-you', w.cr.token);
    expect(creatorNeeds.body.data.items.counters_to_answer).toBe(1);
    expect(creatorNeeds.body.data.collaborations.find(x => x.campaign_influencer_id === w.ciId).own).toBeTruthy();
    brandNeeds = await api.get('/brands/me/inbox-summary', w.b.token);
    expect(brandNeeds.body.data.summary.pending_negotiations).toBe(0);
  });

  it('another brand, creator or non-admin is 404 or 403 everywhere (check 32)', async () => {
    const w = await world('conversion');
    await counter(w, { commissionPct: 13 });
    const other = await brand(); const stranger = await creator();
    expect((await api.get(`${w.url}/invitations/${w.ciId}/thread`, other.token)).status).toBe(404);
    expect((await api.post(`${w.url}/invitations/${w.ciId}/thread/accept`, other.token)).status).toBe(404);
    expect((await api.post(`${w.url}/invitations/${w.ciId}/move-answer`, other.token, { answer: 'kept' })).status).toBe(404);
    expect((await api.get(`/influencers/me/invitations/${w.ciId}/thread`, stranger.token)).status).toBe(404);
    expect((await api.post(`/influencers/me/invitations/${w.ciId}/counter`, stranger.token, { terms: { commissionPct: 20 } })).status).toBe(404);
    const b2 = await brand();
    await api.post(`/influencers/me/invitations/${w.ciId}/move-request`, w.cr.token, { goLiveDate: day(17) }).catch(() => {});
    expect((await api.get('/brands/me/pool', b2.token)).body.data.total).toBe(0);
  });

  it('no creator response carries the brand note, a warning, the campaign description or another creator (check 33)', async () => {
    const w = await world('conversion');
    await query(`UPDATE campaigns SET brief = 'SECRET brief' WHERE id = $1`, [w.c.id]);
    await setCreatorInvite(w.cr.influencerId, { categories: ['WOMEN'] });
    await query(`INSERT INTO creator_min_commissions (influencer_id, aim, category_code, pct) VALUES ($1, 'conversion', 'WOMEN', 12)`, [w.cr.influencerId]);
    await counter(w, { commissionPct: 13 });
    const mine = await myThread(w);
    expect(JSON.stringify(mine.body)).not.toMatch(LEAK);
    expect(JSON.stringify(mine.body)).not.toContain('SECRET');
    expect(mine.body.data.thread.minimums).toBeUndefined();
    expect(mine.body.data.thread.warnings).toBeUndefined();
    // the brand's own view keeps the warning
    const theirs = await brandThread(w);
    expect(theirs.body.data.thread.warnings).toEqual([]);
    expect(theirs.body.data.thread.minimums).toMatchObject({ commissionPct: 12 });
  });

  it('the legacy routes and the new endpoints enforce identical rules, because they call the same service (check 44)', async () => {
    const w = await world('conversion');
    // rounds, through the legacy doors
    let r = await api.post(`/offers/${w.ciId}/negotiate`, w.cr.token, { proposed_commission_pct: 13 });
    expect(r.status).toBe(201);
    const negId = r.body.data.negotiation.id;
    expect(r.body.data.negotiation.round_limit).toBe(2);
    r = await api.post(`/negotiations/${negId}/respond`, w.b.token, { action: 'counter', proposed_commission_pct: 11.5 });
    expect(r.status).toBe(200);
    r = await api.post(`/negotiations/${negId}/respond`, w.cr.token, { action: 'counter', proposed_commission_pct: 12.5 });
    expect(r.status).toBe(422); expect(r.body.error.code).toBe('NO_ROUNDS_LEFT');
    // the cutoff, through the legacy door
    await moveSetTo(w.s.id, day(2));
    r = await api.post(`/negotiations/${negId}/respond`, w.cr.token, { action: 'accept' });
    expect(r.status).toBe(422); expect(r.body.error.message).toBe(MSG6.CLOSED(day(-1)));
  });

  it('loading a thread that never started still answers with the invitation as turn zero (check 34)', async () => {
    const w = await world('conversion');
    const r = await myThread(w);
    expect(r.status).toBe(200);
    expect(r.body.data.thread.turns).toEqual([]);
    expect(r.body.data.thread.invitation.terms).toEqual({ commissionPct: 10 });
    expect(r.body.data.thread.negotiation).toMatchObject({ id: null, open: false, countersUsed: 0 });
    expect(r.body.data.thread.can).toMatchObject({ counter: true, moveRequest: true, accept: false });
  });

  it('nothing here moves money, and a signed collaboration is never touched', async () => {
    const w = await world('conversion');
    await counter(w, { commissionPct: 13 });
    await signBoth(w.ciId);
    const r = await api.post(`${w.url}/invitations/${w.ciId}/thread/decline`, w.b.token, {});
    expect(r.status).toBe(422);
    expect((await query(`SELECT count(*)::int n FROM contracts WHERE campaign_influencer_id = $1`, [w.ciId])).rows[0].n).toBe(1);
    expect((await query(`SELECT count(*)::int n FROM escrow_entries`)).rows[0].n).toBe(0);
    expect((await query(`SELECT count(*)::int n FROM wallet_transactions`)).rows[0].n).toBe(0);
  });
});
