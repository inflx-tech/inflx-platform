'use strict';

/**
 * Item 15 — Hybrid: item 14's two paths, plus the money. The live confirmation pays the second 25%
 * and stamps the final 50%; it never confirms itself; she may report silence; the final 50% is
 * paid on its date whatever Path 1 shows; Completed = paid in full AND the minimum approved.
 * Contract: features/item15-hybrid · rules v1.30 §12.1/§19/§23 · board S1–S9 · checks in 03-expected-outputs.md
 * Real API, real database, real escrow rows released through item 9/12's own path.
 */

const { truncateAll } = require('./helpers/db');
const { createAdminUser } = require('./helpers/factories');
const w12 = require('./helpers/item12');
const W = require('./helpers/item14');
const saleLive = require('../src/services/saleLive.service');
const contentJobs = require('../src/services/contentJobs.service');
const platformSettings = require('../src/services/platformSettings.service');
const t3Job = require('../src/jobs/tranche-3-release.job');
const { istDayOf, addDays } = require('../src/utils/indiaDay');

const { api, query } = W;
const err = (r) => (r.body && r.body.error) || {};
let admin;

beforeAll(async () => {
  await truncateAll();
  W.resetTree();
  admin = await createAdminUser();
  await w12.startServer();
});
afterAll(() => w12.stopServer());
afterEach(async () => {
  await query(`UPDATE platform_settings SET value = 7 WHERE key IN ('final_payment_wait_days', 'content_report_silence_days', 'sale_live_autoconfirm_days')`);
  platformSettings._resetCache();
});

const escrow = async (ciId) => (await query(
  `SELECT tranche_number AS n, amount::float AS amount, status, release_due_at FROM escrow_entries WHERE campaign_influencer_id = $1 ORDER BY tranche_number`, [ciId])).rows;
const wallets = async (w) => (await query(
  `SELECT (SELECT wallet_balance::float FROM brands WHERE id = $1) AS brand, (SELECT wallet_balance::float FROM influencers WHERE id = $2) AS her`,
  [w.brandId, w.cr.influencerId])).rows[0];
const ciStatus = async (ciId) => (await query(`SELECT status::text FROM campaign_influencers WHERE id = $1`, [ciId])).rows[0].status;

/** A new-terms Hybrid collaboration (₹8,500 fixed), shoot done, one post approved by INFLX. */
async function hybrid(opts = {}) {
  const w = await W.world({ goal: 'hybrid', ...opts });
  const postId = await W.sentPost(w);
  await W.approvePost(admin, postId);
  return { w, postId };
}

describe('item 15 · Hybrid runs item 14\'s two paths (checks 1, 2)', () => {
  it('signing paid the first 25%; Path 2 is locked until INFLX approves a post; the payments card is on both sides', async () => {
    const w = await W.world({ goal: 'hybrid' });
    expect((await escrow(w.ciId)).map((e) => [e.n, e.amount, e.status])).toEqual([[1, 2125, 'released'], [2, 2125, 'locked'], [3, 4250, 'locked']]);
    let s = await W.state(w);
    expect(s).toMatchObject({ aim: 'sale', hybrid: true, stage: 'posts', path1: { open: false } });
    expect(s.money).toMatchObject({ fee: 8500, t1: { amount: 2125, status: 'released' }, t2: { amount: 2125, status: 'locked' }, t3: { amount: 4250, status: 'locked' } });
    const b = await W.state(w, 'brand');
    expect(b.money).toMatchObject({ stillLocked: 6375, campaignFee: 0 });
    const postId = await W.sentPost(w);
    expect(err(await W.addRows(w, postId, ['reel'])).code).toBe('PATH1_FIRST');
    await W.approvePost(admin, postId);
    s = await W.state(w);
    expect(s).toMatchObject({ stage: 'draft', path1: { open: true } });
  });

  it('old-terms Hybrid is told plainly (H1: nothing else is built for it)', async () => {
    const w = await w12.shotDone('hybrid');
    await query(`UPDATE campaign_influencers SET sell_v2 = false WHERE id = $1`, [w.ciId]);
    expect(await W.state(w)).toMatchObject({ hybrid: true, stage: 'old_terms' });
  });
});

describe('item 15 · the live confirmation pays (checks 3, 4, 5, 9)', () => {
  it('3, 9 · confirming releases exactly the second 25% to her, stamps the final 50% at IST day + 7; the brand wallet is untouched', async () => {
    const { w, postId } = await hybrid();
    await W.toPosted(w, postId);
    const s = await W.state(w);
    expect(s.autoconfirmAt).toBeNull();                         // 4 · never a self-confirmation date on Hybrid
    const before = await wallets(w);
    expect(err(await W.confirmLive(w, { amount: 999 })).code).toBe('AMOUNT_CHANGED');
    expect((await escrow(w.ciId))[1].status).toBe('locked');    // nothing moved on the mismatch
    const r = await W.confirmLive(w, { amount: 2125 });
    expect(r.status).toBe(200);
    expect(r.body.data.content).toMatchObject({ stage: 'live', money: { t2: { status: 'released' } }, paidInFull: false });
    const e = await escrow(w.ciId);
    expect(e.map((x) => [x.n, x.status])).toEqual([[1, 'released'], [2, 'released'], [3, 'queued']]);
    expect(istDayOf(new Date(e[2].release_due_at))).toBe(addDays(istDayOf(new Date()), 7));
    const after = await wallets(w);
    expect(after.brand).toBe(before.brand);
    expect(after.her).toBeCloseTo(before.her + 2125, 2);
    expect(await ciStatus(w.ciId)).not.toBe('completed');
  });

  it('4 · no job ever confirms Hybrid by itself, however long the brand is silent', async () => {
    const { w, postId } = await hybrid();
    await W.toPosted(w, postId);
    await query(`UPDATE collab_content SET posted_at = now() - interval '60 days' WHERE campaign_influencer_id = $1`, [w.ciId]);
    await saleLive.autoConfirmDue({ now: new Date(Date.now() + 90 * 86400000) });
    await require('../src/jobs/collab-delayed.job').run();
    expect((await query(`SELECT live_confirmed_at, autoconfirm_at FROM collab_content WHERE campaign_influencer_id = $1`, [w.ciId])).rows[0])
      .toEqual({ live_confirmed_at: null, autoconfirm_at: null });
    expect((await escrow(w.ciId))[1].status).toBe('locked');
  });

  it('5 · she may tell INFLX only from the stamped date; it freezes nothing and the brand can still confirm and pay', async () => {
    const { w, postId } = await hybrid();
    await W.toPosted(w, postId);
    const tell = () => api.post(`${W.C(w)}/report`, w.cr.token, { kind: 'brand_silent', note: 'No answer.' });
    expect(err(await tell()).code).toBe('REPORT_TOO_EARLY');
    await query(`UPDATE collab_content SET report_after_at = now() - interval '1 minute' WHERE campaign_influencer_id = $1`, [w.ciId]);
    const r = await tell();
    expect(r.status).toBe(200);
    expect(r.body.data.content).toMatchObject({ frozen: false, reported: { creator: { at: expect.any(String) } } });
    expect((await W.confirmLive(w, { amount: 2125 })).status).toBe(200);
  });
});

describe('item 15 · the final 50% and Completed (checks 6, 7, 8)', () => {
  it('7 · minimum met: the job pays the final 50% on its date and completes the collaboration', async () => {
    const { w, postId } = await hybrid();
    await W.toPosted(w, postId);
    await W.confirmLive(w, { amount: 2125 });
    const due = (await escrow(w.ciId))[2].release_due_at;
    let out = await t3Job.run({ now: new Date(new Date(due).getTime() - 60000) });
    expect((await escrow(w.ciId))[2].status).toBe('queued');
    out = await t3Job.run({ now: new Date(new Date(due).getTime() + 1000) });
    expect(out.released).toBeGreaterThanOrEqual(1);
    expect((await escrow(w.ciId)).every((e) => e.status === 'released')).toBe(true);
    expect(await ciStatus(w.ciId)).toBe('completed');
    expect(await W.state(w, 'brand')).toMatchObject({ stage: 'complete', paidInFull: true });
  });

  it('6 · minimum short: the final 50% is still paid on its date (H2); Completed waits for the approval that reaches it', async () => {
    const { w, postId } = await hybrid({ min: 2 });
    await W.toPosted(w, postId);
    await W.confirmLive(w, { amount: 2125 });
    const due = (await escrow(w.ciId))[2].release_due_at;
    await t3Job.run({ now: new Date(new Date(due).getTime() + 1000) });
    expect((await escrow(w.ciId)).every((e) => e.status === 'released')).toBe(true);
    expect(await ciStatus(w.ciId)).not.toBe('completed');
    expect(await W.state(w)).toMatchObject({ stage: 'live', paidInFull: true, path1: { approved: 1, min: 2 }, move: { key: 'make_posts' } });
    const second = await W.sentPost(w, 'Denim for weekends');
    await W.approvePost(admin, second);
    expect(await ciStatus(w.ciId)).toBe('completed');
  });

  it('8 · a brand report freezes the step; the job never pays a reported collaboration', async () => {
    const { w, postId } = await hybrid();
    await W.toPosted(w, postId);
    expect((await W.report(w, 'posted_wrong', 'Not what I approved.')).status).toBe(200);
    expect(err(await W.confirmLive(w, { amount: 2125 })).code).toBe('REPORTED_HOLD');
    expect((await escrow(w.ciId)).map((e) => e.status)).toEqual(['released', 'locked', 'locked']);
  });

  it('the card and the set row say "final payment" while it waits; Delayed follows Hybrid too', async () => {
    const { w, postId } = await hybrid();
    await W.toPosted(w, postId);
    await W.confirmLive(w, { amount: 2125 });
    const mine = await api.get('/influencers/me/invitations?tab=active', w.cr.token);
    expect(mine.body.data.rows.find((x) => x.id === w.ciId).goingLive).toMatchObject({ move: 'final_payment', line: 'Live. Your last payment is on its way.' });

    const d = await hybrid();
    await W.pastPosting(d.w, -1);
    await saleLive.flagDelayedSale();
    expect((await query(`SELECT delayed_stage FROM campaign_influencers WHERE id = $1`, [d.w.ciId])).rows[0].delayed_stage).toBe('social_not_sent');
    await W.addRows(d.w, d.postId, ['reel']); await W.fill(d.w); await W.submit(d.w);
    await contentJobs.refreshDelayedStages();
    expect((await query(`SELECT delayed_stage FROM campaign_influencers WHERE id = $1`, [d.w.ciId])).rows[0].delayed_stage).toBe('social_in_review');
  });
});
