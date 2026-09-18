'use strict';

/**
 * Item 10 — Phase 2b: the THIRD ANCHOR. Item 6's negotiation engine hanging off a shoot plan,
 * with one negotiable thing (the visit time), the same stamped round limit, no decline, and the
 * same thread reopening when either side moves an agreed time.
 * Contract: features/item10-store-visit · checks 11, 12, 13, 14, 38, 39, 40, 41, 42
 *
 * Engine-level: the plan is put on the row by SQL here (F3 is Phase 2c) so the engine is
 * proved before the feature that uses it.
 */

const { truncateAll } = require('./helpers/db');
const { query, resetReference } = require('./helpers/item3');
const w10 = require('./helpers/item10');
const settings = require('../src/services/platformSettings.service');
const standardTerms = require('../src/services/standardTerms.service');
const negotiation = require('../src/services/negotiation.service');
const { MSG } = require('../src/services/productionCopy');
const { MSG: MSG6 } = require('../src/services/negotiationCopy');

beforeEach(async () => { await truncateAll(); await resetReference(); settings._resetCache(); standardTerms._resetCache(); });
afterEach(() => { settings._resetCache(); standardTerms._resetCache(); });

const at = (day, hhmm = '11:00') => new Date(`${day}T${hhmm}:00+05:30`).toISOString();

/** A signed, funded Store Visit collaboration whose plan has been sent for day+3 at 11:00 IST. */
async function planned(goal = 'engagement') {
  const w = await w10.signedByBoth(goal);
  const visitAt = at(w10.day(3));
  await query(
    `UPDATE production_events SET plan_sent_at = now(), plan_sent_by = $2, visit_scheduled_at = $3,
            visit_contact_name = 'Ravi Menon', visit_contact_phone = '+919849011223',
            visit_address = 'Road No. 12, Banjara Hills', visit_city = 'Hyderabad', status = 'proposed'
      WHERE id = $1`, [w.pe.id, w.b.userId, visitAt]);
  return { ...w, visitAt };
}
const brandCtx = (w) => negotiation.loadShootContext(w.pe.id, { brandId: w.brandId });
const herCtx = (w) => negotiation.loadShootContext(w.pe.id, { influencerId: w.cr.influencerId });
const peRow = (w) => query(`SELECT * FROM production_events WHERE id = $1`, [w.pe.id]).then(r => r.rows[0]);
const negRow = (w) => query(`SELECT * FROM negotiations WHERE production_event_id = $1`, [w.pe.id]).then(r => r.rows[0] || null);
const err = (p) => p.then(() => null, (e) => e);

describe('canon — the change detector sees the time (check 38)', () => {
  it('two snapshots differing only in visitAt are DIFFERENT; the same instant written two ways is the same', () => {
    const a = negotiation.canon({ visitAt: '2026-10-18T05:30:00.000Z' });
    const b = negotiation.canon({ visitAt: '2026-10-19T10:30:00.000Z' });
    const c = negotiation.canon({ visitAt: '2026-10-18T11:00:00+05:30' });
    expect(a).not.toBe(b);
    expect(a).toBe(c);
    // and it still tells fee/commission apart as before
    expect(negotiation.canon({ fee: 9000 })).not.toBe(negotiation.canon({ fee: 9500 }));
    expect(negotiation.canon({ commissionPct: 12 })).toBe(negotiation.canon({ commissionPct: '12' }));
  });
});

describe('the shoot context', () => {
  it('loads for the brand and for her, and 404s for anyone else', async () => {
    const w = await planned();
    const b = await brandCtx(w);
    expect(b).toMatchObject({ kind: 'shoot', id: w.pe.id, campaign_influencer_id: w.ciId, allow_negotiation: true });
    expect(new Date(b.visit_at).toISOString()).toBe(w.visitAt);
    expect(b.go_live_date).toBeTruthy();
    const h = await herCtx(w);
    expect(h.kind).toBe('shoot');
    expect(await negotiation.loadShootContext(w.pe.id, { brandId: '00000000-0000-0000-0000-000000000000' })).toBeNull();
    expect(negotiation.termsOf(b)).toEqual({ visitAt: w.visitAt });
  });
});

describe('countering the time (checks 11, 12, 39, 42)', () => {
  it('11 · she counters: the thread opens with the PLAN as turn zero, round 1 of the stamped limit, whose move = brand', async () => {
    const w = await planned();
    const newAt = at(w10.day(4), '16:00');
    const negId = await negotiation.counter({ ctx: await herCtx(w), by: 'influencer', terms: { visitAt: newAt }, note: 'I have a shoot that morning.', actorUserId: w.cr.userId });
    const n = await negRow(w);
    expect(n.id).toBe(negId);
    expect(n.round_limit).toBe(2);
    expect(n.production_event_id).toBe(w.pe.id);
    expect(n.campaign_influencer_id).toBeNull(); expect(n.pitch_id).toBeNull();
    const t = await negotiation.thread(await brandCtx(w), 'brand');
    expect(t.negotiation).toMatchObject({ open: true, whoseMove: 'brand', roundLimit: 2, countersUsed: 1, isLastRound: true, noRoundsLeft: false });
    // turn zero is the plan, by the brand, at the time it was sent; newest first
    expect(t.turns.map(x => [x.by, x.kind])).toEqual([['influencer', 'counter'], ['brand', 'counter']]);
    expect(t.turns[1].terms).toEqual({ visitAt: w.visitAt });
    expect(t.turns[0].changes).toEqual([{ term: 'visitAt', from: expect.stringMatching(/11:00 am/), to: expect.stringMatching(/4:00 pm/) }]);
    expect(t.turns[0].note).toBe('I have a shoot that morning.');
    expect(t.can).toMatchObject({ counter: true, accept: true, decline: false, moveRequest: false, moveAnswer: false });
    // the row itself: still the sent time, no longer agreed
    const pe = await peRow(w);
    expect(new Date(pe.visit_scheduled_at).toISOString()).toBe(w.visitAt);
    expect(pe.time_agreed_at).toBeNull();
  });

  it('39 · turn zero does not consume a round; the brand counters back (round 2); a third counter is NO_ROUNDS_LEFT with the shoot sentence', async () => {
    const w = await planned();
    await negotiation.counter({ ctx: await herCtx(w), by: 'influencer', terms: { visitAt: at(w10.day(4), '16:00') } });
    await negotiation.counter({ ctx: await brandCtx(w), by: 'brand', terms: { visitAt: at(w10.day(4), '12:00') } });
    const e = await err(negotiation.counter({ ctx: await herCtx(w), by: 'influencer', terms: { visitAt: at(w10.day(5)) } }));
    expect(e).toMatchObject({ code: 'NO_ROUNDS_LEFT', statusCode: 422 });
    expect(e.message).toBe(MSG.NO_ROUNDS_LEFT);
    const t = await negotiation.thread(await herCtx(w), 'influencer');
    expect(t.negotiation).toMatchObject({ countersUsed: 2, noRoundsLeft: true, whoseMove: 'influencer' });
    expect(t.can.counter).toBe(false); expect(t.can.accept).toBe(true); expect(t.can.decline).toBe(false);
  });

  it('the stamped limit governs, not the live setting', async () => {
    const w = await planned();
    await negotiation.counter({ ctx: await herCtx(w), by: 'influencer', terms: { visitAt: at(w10.day(4), '16:00') } });
    await query(`UPDATE platform_settings SET value = 5 WHERE key = 'negotiation_rounds'`); settings._resetCache();
    const t = await negotiation.thread(await brandCtx(w), 'brand');
    expect(t.negotiation.roundLimit).toBe(2);
  });

  it('12 / WRONG_TURN · the side that just countered cannot counter again; a time equal to the current one is NOTHING_CHANGED', async () => {
    const w = await planned();
    const same = await err(negotiation.counter({ ctx: await herCtx(w), by: 'influencer', terms: { visitAt: w.visitAt } }));
    expect(same).toMatchObject({ code: 'VALIDATION_ERROR' }); expect(same.message).toBe(MSG6.NOTHING_CHANGED);
    await negotiation.counter({ ctx: await herCtx(w), by: 'influencer', terms: { visitAt: at(w10.day(4), '16:00') } });
    const again = await err(negotiation.counter({ ctx: await herCtx(w), by: 'influencer', terms: { visitAt: at(w10.day(5)) } }));
    expect(again.code).toBe('WRONG_TURN');
  });

  it('the time rule on every counter: after the posting day refused, in the past refused, 23:59 IST on the posting day allowed', async () => {
    const w = await planned();
    const posting = (await query(`SELECT go_live_date::text d FROM campaign_sets WHERE id = $1`, [w.s.id])).rows[0].d;
    let e = await err(negotiation.counter({ ctx: await herCtx(w), by: 'influencer', terms: { visitAt: at(w10.day(13)) } }));
    expect(e.code).toBe('TIME_AFTER_POSTING'); expect(e.message).toBe(MSG.TIME_AFTER_POSTING(posting));
    e = await err(negotiation.counter({ ctx: await herCtx(w), by: 'influencer', terms: { visitAt: new Date(Date.now() - 3600000).toISOString() } }));
    expect(e.code).toBe('TIME_IN_PAST'); expect(e.message).toBe(MSG.TIME_IN_PAST);
    e = await err(negotiation.counter({ ctx: await herCtx(w), by: 'influencer', terms: { visitAt: 'not a time' } }));
    expect(e.code).toBe('VALIDATION_ERROR');
    await expect(negotiation.counter({ ctx: await herCtx(w), by: 'influencer', terms: { visitAt: at(posting, '23:59') } })).resolves.toBeTruthy();
  });

  it('42 · the campaign\'s negotiation switch, OFF, does not stop her countering a visit time', async () => {
    const w = await planned();
    await query(`UPDATE campaigns SET allow_negotiation = false WHERE id = $1`, [w.c.id]);
    await expect(negotiation.counter({ ctx: await herCtx(w), by: 'influencer', terms: { visitAt: at(w10.day(4), '16:00') } })).resolves.toBeTruthy();
    const t = await negotiation.thread(await herCtx(w), 'influencer');
    expect(t.switchOn).toBe(true);
  });

  it('only the time is negotiable: a fee or deliverables in the body are ignored, not countered', async () => {
    const w = await planned();
    await negotiation.counter({ ctx: await herCtx(w), by: 'influencer', terms: { visitAt: at(w10.day(4), '16:00'), fee: 1, deliverables: [{ type: 'reel', count: 9 }] } });
    const t = await negotiation.thread(await brandCtx(w), 'brand');
    expect(t.turns[0].terms).toEqual({ visitAt: at(w10.day(4), '16:00') });
  });
});

describe('accepting, and no decline (checks 10, 13, 40)', () => {
  it('13 · the brand accepts her time: the row carries the agreed time, time_agreed_at, status confirmed; the thread ends agreed', async () => {
    const w = await planned();
    const newAt = at(w10.day(4), '16:00');
    await negotiation.counter({ ctx: await herCtx(w), by: 'influencer', terms: { visitAt: newAt } });
    const r = await negotiation.accept({ ctx: await brandCtx(w), by: 'brand', actorUserId: w.b.userId });
    expect(r.agreedTerms).toEqual({ visitAt: newAt });
    const pe = await peRow(w);
    expect(new Date(pe.visit_scheduled_at).toISOString()).toBe(newAt);
    expect(pe.time_agreed_at).toBeTruthy();
    expect(pe.status).toBe('confirmed');
    const n = await negRow(w);
    expect(n.outcome).toBe('agreed'); expect(n.current_turn).toBeNull();
    const t = await negotiation.thread(await herCtx(w), 'influencer');
    expect(t.negotiation.open).toBe(false);
    expect(t.ending.outcome).toBe('agreed');
    expect(t.can.accept).toBe(false); expect(t.can.decline).toBe(false);
    expect(t.can.move).toBe(true);                       // either side may still move it
  });

  it('40 · there is no decline: the engine refuses it on a shoot thread, whoever asks', async () => {
    const w = await planned();
    await negotiation.counter({ ctx: await herCtx(w), by: 'influencer', terms: { visitAt: at(w10.day(4), '16:00') } });
    const e = await err(negotiation.decline({ ctx: await brandCtx(w), by: 'brand', note: 'no' }));
    expect(e).toMatchObject({ code: 'NO_DECLINE', statusCode: 422 });
    expect(e.message).toBe(MSG.NO_DECLINE);
    expect((await negotiation.thread(await brandCtx(w), 'brand')).can.decline).toBe(false);
  });

  it('accepting with no thread is refused (F4 stamps that directly, in 2c); countering after agreement is a MOVE, not a counter', async () => {
    const w = await planned();
    expect((await err(negotiation.accept({ ctx: await brandCtx(w), by: 'brand' }))).message).toBe(MSG6.NO_THREAD);
  });
});

describe('reopening — the same thread (checks 14, 41)', () => {
  it('41 · after agreement the brand moves the time: SAME negotiations.id, outcome null, budget counted from the last accept', async () => {
    const w = await planned();
    await negotiation.counter({ ctx: await herCtx(w), by: 'influencer', terms: { visitAt: at(w10.day(4), '16:00') } });
    await negotiation.counter({ ctx: await brandCtx(w), by: 'brand', terms: { visitAt: at(w10.day(4), '12:00') } });   // both rounds spent
    await negotiation.accept({ ctx: await herCtx(w), by: 'influencer' });
    const before = await negRow(w);
    expect(before.outcome).toBe('agreed');

    const moved = at(w10.day(6), '11:00');
    const negId = await negotiation.counter({ ctx: await brandCtx(w), by: 'brand', terms: { visitAt: moved }, note: 'Closed on Sunday.', reopen: true });
    expect(negId).toBe(before.id);
    const after = await negRow(w);
    expect(after.outcome).toBeNull(); expect(after.ended_at).toBeNull(); expect(after.current_turn).toBe('influencer');
    expect(after.round_limit).toBe(2);                    // never re-read
    const t = await negotiation.thread(await herCtx(w), 'influencer');
    expect(t.negotiation).toMatchObject({ open: true, whoseMove: 'influencer', countersUsed: 1, roundLimit: 2 });   // a fresh episode
    expect(t.turns[0].changes[0]).toMatchObject({ term: 'visitAt', from: expect.stringMatching(/12:00 pm/), to: expect.stringMatching(/11:00 am/) });
    const pe = await peRow(w);
    expect(pe.time_agreed_at).toBeNull(); expect(pe.status).toBe('proposed');
    expect(new Date(pe.visit_scheduled_at).toISOString()).toBe(at(w10.day(4), '12:00'));   // the last AGREED time stays until a new one is agreed

    // she can counter once more in this episode, then must accept
    await negotiation.counter({ ctx: await herCtx(w), by: 'influencer', terms: { visitAt: at(w10.day(6), '15:00') } });
    const e = await err(negotiation.counter({ ctx: await brandCtx(w), by: 'brand', terms: { visitAt: at(w10.day(7)) } }));
    expect(e.code).toBe('NO_ROUNDS_LEFT');
    await negotiation.accept({ ctx: await brandCtx(w), by: 'brand' });
    expect(new Date((await peRow(w)).visit_scheduled_at).toISOString()).toBe(at(w10.day(6), '15:00'));
    expect((await query(`SELECT count(*)::int n FROM negotiations WHERE production_event_id = $1`, [w.pe.id])).rows[0].n).toBe(1);
  });

  it('14 · a rescheduled time after the posting date is refused; a reopen is refused once the shoot is complete', async () => {
    const w = await planned();
    await negotiation.counter({ ctx: await herCtx(w), by: 'influencer', terms: { visitAt: at(w10.day(4), '16:00') } });
    await negotiation.accept({ ctx: await brandCtx(w), by: 'brand' });
    let e = await err(negotiation.counter({ ctx: await brandCtx(w), by: 'brand', terms: { visitAt: at(w10.day(20)) }, reopen: true }));
    expect(e.code).toBe('TIME_AFTER_POSTING');
    await query(`UPDATE production_events SET status = 'completed', influencer_completed_at = now(), brand_completed_at = now() WHERE id = $1`, [w.pe.id]);
    e = await err(negotiation.counter({ ctx: await brandCtx(w), by: 'brand', terms: { visitAt: at(w10.day(6)) }, reopen: true }));
    expect(e).toMatchObject({ code: 'SHOOT_COMPLETE' }); expect(e.message).toBe(MSG.SHOOT_COMPLETE);
  });

  it('a move with NO thread yet (she accepted the plan directly) starts one with the agreed time as turn zero', async () => {
    const w = await planned();
    await query(`UPDATE production_events SET time_agreed_at = now(), status = 'confirmed' WHERE id = $1`, [w.pe.id]);
    const negId = await negotiation.counter({ ctx: await brandCtx(w), by: 'brand', terms: { visitAt: at(w10.day(5)) }, reopen: true });
    const t = await negotiation.thread(await herCtx(w), 'influencer');
    expect(t.negotiation).toMatchObject({ id: negId, open: true, whoseMove: 'influencer', countersUsed: 1 });
    expect(t.turns[1].terms).toEqual({ visitAt: w.visitAt });
    expect((await peRow(w)).time_agreed_at).toBeNull();
  });
});
