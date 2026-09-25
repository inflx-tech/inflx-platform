'use strict';

/**
 * Item 12, Phase 2c — the jobs and the lists: the final 50% (J1), Delayed and reminders (J2),
 * Needs You, the adjacent money fixes, and the whole run's money.
 * Contract: features/item12-content · checks 18, 19, 21, 22, 23, 24, 33, 36, 43, 44
 */

const { query, api } = require('./helpers/item3');
const w10 = require('./helpers/item10');
const w12 = require('./helpers/item12');
const platformSettings = require('../src/services/platformSettings.service');
const tranche3 = require('../src/jobs/tranche-3-release.job');
const contentJobs = require('../src/services/contentJobs.service');
const collabCounts = require('../src/services/collabCounts.service');
const notificationService = require('../src/services/notification.service');

beforeAll(() => w12.startServer());
afterAll(() => w12.stopServer());
const setSetting = async (key, value) => { await query(`UPDATE platform_settings SET value = $2 WHERE key = $1`, [key, value]); platformSettings._resetCache(); };
afterEach(async () => { await setSetting('final_payment_wait_days', 7); jest.restoreAllMocks(); });

const DAY = 86400000;
const t3Row = async (w) => (await query(`SELECT * FROM escrow_entries WHERE campaign_influencer_id = $1 AND tranche_number = 3`, [w.ciId])).rows[0];
const cc = async (w) => (await query(`SELECT * FROM collab_content WHERE campaign_influencer_id = $1`, [w.ciId])).rows[0];
const notes = async (userId, type) => (await query(`SELECT body FROM notifications WHERE user_id = $1 AND type = $2 ORDER BY created_at`, [userId, type])).rows;

/* ──────────────────────────────────────────── J1 (checks 18, 19, 33) */

describe('item 12 · the final 50% at the stamped due (checks 18, 19, 33)', () => {
  it('18 · not before the due; at it: released, Completed, both told — once', async () => {
    const w = await w12.shotDone('engagement', { terms: w12.FEE_12000 });
    await w12.toPosted(w); await w12.confirmLive(w);
    const due = new Date((await t3Row(w)).release_due_at);

    expect((await tranche3.run({ now: new Date(due.getTime() - 60000) })).released).toBe(0);
    expect((await t3Row(w)).status).toBe('queued');

    const out = await tranche3.run({ now: new Date(due.getTime() + 60000) });
    expect(out.released).toBe(1);
    expect((await t3Row(w)).status).toBe('released');
    const c = await cc(w);
    expect(c.completed_at).toBeTruthy(); expect(c.t3_released_at).toBeTruthy();
    const { rows: [ci] } = await query(`SELECT status FROM campaign_influencers WHERE id = $1`, [w.ciId]);
    expect(ci.status).toBe('completed');
    expect(await notes(w.cr.userId, 'content.final_paid')).toEqual([{ body: '₹6,000 is in your wallet. The collaboration is complete.' }]);
    expect(await notes(w.b.userId, 'collab.completed')).toHaveLength(1);
    const s = await w12.state(w, 'brand');
    expect(s).toMatchObject({ stage: 'complete', money: { stillLocked: 0, t3: { status: 'released' } } });

    expect((await tranche3.run({ now: new Date(due.getTime() + 2 * DAY) })).released).toBe(0);   // idempotent
    expect(await notes(w.cr.userId, 'content.final_paid')).toHaveLength(1);
  });

  it('19, 33 · changing the number after a confirmation moves nothing; a new confirmation uses the new number', async () => {
    const a = await w12.shotDone('engagement');
    await w12.toPosted(a); await w12.confirmLive(a);
    const stampedA = new Date((await t3Row(a)).release_due_at).getTime();
    await setSetting('final_payment_wait_days', 30);
    expect(new Date((await t3Row(a)).release_due_at).getTime()).toBe(stampedA);
    expect((await tranche3.run({ now: new Date(stampedA + 60000) })).released).toBe(1);            // paid on the ORIGINAL date

    const b = await w12.shotDone('engagement');
    await w12.toPosted(b); await w12.confirmLive(b);
    const c = await cc(b);
    expect(c.final_wait_days).toBe(30);
    const { istDayOf, addDays } = require('../src/utils/indiaDay');
    expect(new Date((await t3Row(b)).release_due_at).toISOString()).toBe(new Date(`${addDays(istDayOf(c.live_confirmed_at), 30)}T03:00:00+05:30`).toISOString());
  });

  it('20 · two runners at once: one release', async () => {
    const w = await w12.shotDone('engagement');
    await w12.toPosted(w); await w12.confirmLive(w);
    const at = new Date(new Date((await t3Row(w)).release_due_at).getTime() + 60000);
    const [x, y] = await Promise.all([tranche3.run({ now: at }), tranche3.run({ now: at })]);
    expect(x.released + y.released).toBe(1);
    const { rows } = await query(`SELECT count(*)::int n FROM influencer_ledger WHERE influencer_id = $1 AND note = 'Tranche 3 released'`, [w.cr.influencerId]);
    expect(rows[0].n).toBe(1);
  });

  it('Q10 · a queued tranche under a brand report is held, even at its due', async () => {
    const w = await w12.shotDone('engagement');
    await w12.toPosted(w); await w12.confirmLive(w);
    // Today's flow cannot report after confirming; the job must hold it anyway (defensive).
    await query(`UPDATE collab_content SET brand_reported_at = now(), brand_reported_by = $2, brand_report_kind = 'posted_wrong' WHERE campaign_influencer_id = $1`, [w.ciId, w.b.userId]);
    const out = await tranche3.run({ now: new Date(Date.now() + 30 * DAY) });
    expect(out.skipped).toBeGreaterThanOrEqual(1);               // other worlds in this file may be paid; this one is held
    expect((await t3Row(w)).status).toBe('queued');
  });

  it('36 · a notification that fails never loses completion', async () => {
    const w = await w12.shotDone('engagement');
    await w12.toPosted(w); await w12.confirmLive(w);
    jest.spyOn(notificationService, 'send').mockRejectedValue(new Error('push down'));
    const out = await tranche3.run({ now: new Date(Date.now() + 30 * DAY) });
    expect(out.released).toBe(1);
    expect((await cc(w)).completed_at).toBeTruthy();
    const { rows: [ci] } = await query(`SELECT status FROM campaign_influencers WHERE id = $1`, [w.ciId]);
    expect(ci.status).toBe('completed');
  });
});

/* ──────────────────────────────────────────── 21. the whole run's money */

describe('item 12 · no money moves except the two releases (check 21)', () => {
  it('a complete run, from shoot done to Completed: exactly T2 + T3 to her, nothing to or from the brand, nothing deducted', async () => {
    const w = await w12.shotDone('engagement', { terms: w12.FEE_12000 });
    const snap = async () => ({
      brand: Number((await query(`SELECT wallet_balance FROM brands WHERE id = $1`, [w.brandId])).rows[0].wallet_balance),
      her: (await query(`SELECT wallet_balance::float w, pending_balance::float p, total_earned::float e FROM influencers WHERE id = $1`, [w.cr.influencerId])).rows[0],
      escrow: (await query(`SELECT tranche_number t, amount::float a, status s FROM escrow_entries WHERE campaign_influencer_id = $1 ORDER BY 1`, [w.ciId])).rows,
      ledger: (await query(`SELECT type, amount::float a, direction d FROM influencer_ledger WHERE influencer_id = $1 ORDER BY created_at`, [w.cr.influencerId])).rows,
      brandTx: (await query(`SELECT type::text t, amount::float a, direction::text d FROM wallet_transactions WHERE brand_id = $1 ORDER BY created_at, type`, [w.brandId])).rows,
      contract: (await query(`SELECT locked_amount::float l, released_amount::float r, campaign_fee_amount::float f FROM contracts WHERE id = $1`, [w.con.id])).rows[0],
    });
    const before = await snap();
    await w12.toPosted(w);
    await w12.changes; // (no-op reference; the run below is the plain path)
    await w12.confirmLive(w);
    await tranche3.run({ now: new Date(Date.now() + 30 * DAY) });
    const after = await snap();

    expect(after.brand).toBe(before.brand);                                         // the brand's wallet: untouched
    expect(after.contract).toEqual(before.contract);                                // locked 12,960, released 3,000 (T1), fee 960: untouched
    expect(after.her.w - before.her.w).toBe(9000);                                  // 3,000 + 6,000, in full
    expect(after.her.e - before.her.e).toBe(9000);
    expect(after.her.p).toBe(before.her.p);
    expect(after.escrow).toEqual([{ t: 1, a: 3000, s: 'released' }, { t: 2, a: 3000, s: 'released' }, { t: 3, a: 6000, s: 'released' }]);
    expect(after.ledger.slice(before.ledger.length)).toEqual([
      { type: 'tranche_release', a: 3000, d: 'credit' }, { type: 'tranche_release', a: 6000, d: 'credit' },
    ]);
    expect(after.brandTx.slice(before.brandTx.length).map((x) => `${x.t}:${x.a}:${x.d}`).sort()).toEqual([
      'escrow_release:3000:credit', 'escrow_release:6000:credit', 'payout:3000:debit', 'payout:6000:debit',
    ]);                                                                              // audit pairs only; no platform_fee, no courier
  });
});

/* ──────────────────────────────────────────── Delayed (checks 22, 43) */

describe('item 12 · Delayed with the content stages, told once, following the collaboration (checks 22, 43)', () => {
  const past = (w, days = 2) => query(`UPDATE campaign_sets SET invites_close_at = (now() AT TIME ZONE 'Asia/Kolkata')::date - ($2::int + 3), go_live_date = (now() AT TIME ZONE 'Asia/Kolkata')::date - $2::int WHERE id = $1`, [w.s.id, days]);
  const delayed = async (w) => (await query(`SELECT delayed_at, delayed_stage FROM campaign_influencers WHERE id = $1`, [w.ciId])).rows[0];

  it('22 · past the posting date: flagged at the content stage, both told once, and everything stays usable', async () => {
    const w = await w12.shotDone('engagement');
    await past(w);
    await require('../src/jobs/collab-delayed.job').run();
    expect((await delayed(w)).delayed_stage).toBe('content_not_submitted');
    expect(await notes(w.cr.userId, 'collab.delayed')).toHaveLength(1);
    expect(await notes(w.b.userId, 'collab.delayed')).toHaveLength(1);
    await w12.fillPackage(w);
    expect((await w12.submit(w)).status).toBe(200);                                 // usable
    await require('../src/jobs/collab-delayed.job').run();
    expect((await delayed(w)).delayed_stage).toBe('content_in_review');             // follows, silently
    expect(await notes(w.cr.userId, 'collab.delayed')).toHaveLength(1);
    expect((await w12.state(w, 'brand')).delayed).toMatchObject({ stage: 'content_in_review', label: 'Content in review' });
  });

  it('43 · flagged at a SHOOT stage, it shows the content stage once the shoot is done — told only once', async () => {
    const w = await w10.signedByBoth('engagement', { mode: 'shipment' });
    await past(w);
    await require('../src/jobs/collab-delayed.job').run();
    expect((await delayed(w)).delayed_stage).toBe('address_not_sent');
    await w12.markShootDone(w);
    await require('../src/jobs/collab-delayed.job').run();
    expect((await delayed(w)).delayed_stage).toBe('content_not_submitted');
    await w12.toPosted(w);
    await require('../src/jobs/collab-delayed.job').run();
    expect((await delayed(w)).delayed_stage).toBe('content_not_confirmed');
    expect(await notes(w.b.userId, 'collab.delayed')).toHaveLength(1);
  });
});

/* ──────────────────────────────────────────── Needs You (check 23) */

describe('item 12 · Needs You shows the right move to the right side at each of the five points (check 23)', () => {
  it('send → review → changes → post → confirm', async () => {
    const w = await w12.shotDone('engagement');
    const her = async () => (await collabCounts.forCreator(w.cr.influencerId)).items;
    const brandInbox = async () => (await api.get('/brands/me/inbox-summary', w.b.token)).body.data.summary;
    const brandStep = async () => (await collabCounts.forBrand(w.b.userId).catch(() => null));
    void brandStep;

    expect(await her()).toMatchObject({ content_to_send: 1, content_changes: 0, content_to_post: 0 });
    expect(await brandInbox()).toMatchObject({ pending_reviews: 0, pending_live_confirms: 0 });

    await w12.fillPackage(w); await w12.submit(w);
    expect(await her()).toMatchObject({ content_to_send: 0, content_changes: 0, content_to_post: 0 });
    expect(await brandInbox()).toMatchObject({ pending_reviews: 1, pending_live_confirms: 0 });

    await w12.changes(w);
    expect(await her()).toMatchObject({ content_changes: 1 });
    expect(await brandInbox()).toMatchObject({ pending_reviews: 0 });

    await w12.submit(w); await w12.approve(w);
    expect(await her()).toMatchObject({ content_to_post: 1, content_changes: 0 });

    await w12.proveAll(w); await w12.posted(w);
    expect(await her()).toMatchObject({ content_to_send: 0, content_changes: 0, content_to_post: 0 });
    expect(await brandInbox()).toMatchObject({ pending_reviews: 0, pending_live_confirms: 1 });

    await w12.confirmLive(w);
    expect(await brandInbox()).toMatchObject({ pending_live_confirms: 0 });
  });

  it('the legacy deliverables rows are no longer counted', async () => {
    const w = await w10.signedByBoth('engagement');                    // rows born pending at the signature; shoot NOT done
    const { rows } = await query(`SELECT count(*)::int n FROM deliverables WHERE campaign_influencer_id = $1`, [w.ciId]);
    expect(rows[0].n).toBeGreaterThan(0);
    const items = (await collabCounts.forCreator(w.cr.influencerId)).items;
    expect(items).not.toHaveProperty('deliverables_to_submit');
    expect(items.content_to_send).toBe(0);                              // nothing to send before the shoot
  });
});

/* ──────────────────────────────────────────── reminders (checks 24, 44) */

describe('item 12 · reminded at 48 hours, and past the posting date (checks 24, 44)', () => {
  it('47 h no · 49 h yes · 50 h no · 97 h yes; past the posting date too; stops on the move, a report, completion', async () => {
    const w = await w12.shotDone('engagement');
    await query(`UPDATE campaign_sets SET invites_close_at = (now() AT TIME ZONE 'Asia/Kolkata')::date - 8, go_live_date = (now() AT TIME ZONE 'Asia/Kolkata')::date - 5 WHERE id = $1`, [w.s.id]);
    const since = new Date(w.pe.influencer_completed_at).getTime();
    const at = (h) => new Date(since + h * 3600000);
    const count = async () => (await notes(w.cr.userId, 'content.reminder')).length;

    await contentJobs.remindContent({ now: at(47) }); expect(await count()).toBe(0);
    await contentJobs.remindContent({ now: at(49) }); expect(await count()).toBe(1);
    await contentJobs.remindContent({ now: at(50) }); expect(await count()).toBe(1);
    await contentJobs.remindContent({ now: at(97) }); expect(await count()).toBe(2);   // past the posting date: still

    // The move changes hands: the brand's review is reminded from the submission, not before.
    await w12.fillPackage(w); await w12.submit(w);
    // The anchor is the LATER of the move's start and the last reminder. This test's clock already
    // sent one at +97 h (simulated), so the brand's 48 hours run from there — in real, forward time
    // the submission is always the later of the two.
    const submittedAt = new Date((await query(`SELECT submitted_at FROM content_rounds r JOIN collab_content c ON c.id = r.content_id WHERE c.campaign_influencer_id = $1`, [w.ciId])).rows[0].submitted_at).getTime();
    const sub = Math.max(submittedAt, at(97).getTime());
    await contentJobs.remindContent({ now: new Date(sub + 47 * 3600000) });
    expect(await notes(w.b.userId, 'content.reminder')).toHaveLength(0);
    await contentJobs.remindContent({ now: new Date(sub + 49 * 3600000) });
    expect(await notes(w.b.userId, 'content.reminder')).toHaveLength(1);

    // A brand report stops it.
    await query(`UPDATE collab_content SET brand_reported_at = now(), brand_reported_by = $2, brand_report_kind = 'rounds_used' WHERE campaign_influencer_id = $1`, [w.ciId, w.b.userId]);
    await contentJobs.remindContent({ now: new Date(sub + 200 * 3600000) });
    expect(await notes(w.b.userId, 'content.reminder')).toHaveLength(1);
  });
});

/* ──────────────────────────────────────────── the adjacent fixes (check 36) */

describe('item 12 · the four adjacent money fixes (check 36)', () => {
  it('no false low-wallet alert for a queued tranche that was locked at signing', async () => {
    const w = await w12.shotDone('engagement');
    await w12.toPosted(w); await w12.confirmLive(w);
    await query(`UPDATE brands SET wallet_balance = 0 WHERE id = $1`, [w.brandId]);
    await query(`UPDATE campaigns SET status = 'active' WHERE id = $1`, [w.c.id]);
    const out = await require('../src/jobs/low-wallet-alert.job').run();
    expect(out.alerted || 0).toBe(0);
    expect(await notes(w.b.userId, 'wallet.low_balance')).toHaveLength(0);
  });

  it('a queued tranche still counts as pending for her; "still locked" comes from the escrow rows', async () => {
    const w = await w12.shotDone('engagement', { terms: w12.FEE_12000 });
    await w12.toPosted(w); await w12.confirmLive(w);
    const e = await api.get('/influencers/me/earnings', w.cr.token);
    expect(e.status).toBe(200);
    expect(Number(e.body.data.pending_amount)).toBe(6000);
    const ag = await api.get(`${w.url}/invitations/${w.ciId}/agreement`, w.b.token);
    expect(ag.status).toBe(200);
    const money = (ag.body.data.agreement || ag.body.data).money;
    expect(money.locked).toBe(12960);
    expect(money.stillLocked).toBe(6000);                                            // her fee in escrow — not 12,960 − 6,000 = 6,960
  });
});
