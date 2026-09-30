'use strict';

/**
 * Item 14 — Pay for Sale going live: two paths, the gate between them, the social version on item
 * 12's step, links, the live confirmation, self-confirmation, completion, Delayed, reports.
 * Contract: features/item14-sale-going-live · rules v1.30 §12.1/§19/§25 · board v2 · checks in 03-expected-outputs.md
 * Real API, real database, real signed uploads through the mock storage route.
 */

const { truncateAll } = require('./helpers/db');
const { createAdminUser } = require('./helpers/factories');
const w12 = require('./helpers/item12');
const W = require('./helpers/item14');
const saleLive = require('../src/services/saleLive.service');
const contentJobs = require('../src/services/contentJobs.service');
const platformSettings = require('../src/services/platformSettings.service');
const { MSG } = require('../src/services/contentCopy');
const { nextStepWords } = require('../src/services/productionCopy');
const { istDayOf, addDays, startOfIndiaDay } = require('../src/utils/indiaDay');

const { api, query, day } = W;
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
  await query(`UPDATE platform_settings SET value = 7 WHERE key = 'sale_live_autoconfirm_days'`);
  await query(`UPDATE platform_settings SET value = 2 WHERE key = 'content_change_rounds'`);
  platformSettings._resetCache();
});

/** A world with one post approved by INFLX (Path 1 done once). */
async function withApproved(opts = {}) {
  const w = await W.world(opts);
  const postId = await W.sentPost(w);
  await W.approvePost(admin, postId);
  return { w, postId };
}

/* ─────────────────────────────── 1. opening (check 1, 2) */

describe('item 14 · the step opens at shoot done, for Pay for Sale on the new terms (checks 1, 2)', () => {
  it('shoot not done: the read draws it; a write refuses', async () => {
    const w = await W.world({ shootDone: false });
    expect((await W.state(w)).stage).toBe('shoot_not_done');
    const r = await W.addRows(w, '00000000-0000-0000-0000-000000000000', ['reel']);
    expect(err(r).code).toBe('SHOOT_NOT_DONE');
  });

  it('old terms: the read says so plainly; every write refuses', async () => {
    const w = await w12.shotDone('conversion');
    // A collaboration signed before creator-terms-v2 (prod holds 22 of them): no sell_v2.
    await query(`UPDATE campaign_influencers SET sell_v2 = false WHERE id = $1`, [w.ciId]);
    const s = await W.state(w);
    expect(s).toMatchObject({ aim: 'sale', stage: 'old_terms' });
    const r = await api.post(`${W.C(w)}/submit`, w.cr.token, {});
    expect(err(r)).toMatchObject({ code: 'OLD_TERMS', message: MSG.SALE_OLD_TERMS });
  });

  it('Hybrid is still refused until item 15', async () => {
    const w = await w12.shotDone('hybrid');
    expect(err(await W.read(w)).code).toBe('NOT_PAY_FOR_CONTENT');
  });

  it('2 · the shoot-done notice names the step that opens for each Aim', () => {
    expect(nextStepWords('engagement', 'you')).toBe('Your content step is open.');
    expect(nextStepWords('conversion', 'you')).toBe('Time to go live: create your shoppable posts.');
    expect(nextStepWords('hybrid', 'her')).toBe('Next she creates her shoppable posts and goes live.');
  });
});

/* ─────────────────────────────── 2. Path 2 waits for Path 1 (checks 3, 4, 4a) */

describe('item 14 · Path 2 is locked until INFLX approves a post (checks 3, 4)', () => {
  it('no post, a post with INFLX: stage "posts", Path 2 refused by the server', async () => {
    const w = await W.world();
    let s = await W.state(w);
    expect(s).toMatchObject({ stage: 'posts', path1: { min: 1, approved: 0, open: false }, move: { key: 'make_posts', side: 'creator' } });
    expect(s.can.addRows).toBe(false);
    const postId = await W.sentPost(w);
    s = await W.state(w);
    expect(s.path1).toMatchObject({ approved: 0, inReview: 1, open: false });
    const r = await W.addRows(w, postId, ['reel']);
    expect(err(r)).toMatchObject({ code: 'PATH1_FIRST', message: MSG.SALE_PATH1_FIRST });
    const sub = await W.submit(w);
    expect(err(sub).code).toBe('NO_SOCIAL_ROWS');
  });

  it('the first approval opens Path 2; only approved posts of THIS collaboration can be named', async () => {
    const { w, postId } = await withApproved();
    const s = await W.state(w);
    expect(s).toMatchObject({ stage: 'draft', path1: { approved: 1, open: true, met: true }, move: { key: 'send_social' } });
    const second = await W.sentPost(w, 'Linen for the office');             // with INFLX, not approved
    expect(err(await W.addRows(w, second, ['reel'])).code).toBe('POST_NOT_APPROVED');
    const other = await withApproved();
    expect(err(await W.addRows(w, other.postId, ['reel'])).code).toBe('POST_NOT_APPROVED');
    expect(err(await W.addRows(w, postId, ['snapchat'])).code).toBe('UNKNOWN_TYPE');
    const ok = await W.addRows(w, postId, ['reel', 'story']);
    expect(ok.status).toBe(200);
    expect(ok.body.data.content.rows.map((r) => [r.type, r.postId, r.outside])).toEqual([['reel', postId, false], ['story', postId, false]]);
    expect(err(await W.addRows(w, postId, ['reel'])).code).toBe('ROW_EXISTS');
  });

  it('4a · a late approval still counts, marked late', async () => {
    const w = await W.world();
    const postId = await W.sentPost(w);
    await W.pastPosting(w, -2);
    await W.approvePost(admin, postId);
    const s = await W.state(w, 'brand');
    expect(s.path1).toMatchObject({ approved: 1, late: 1, met: true });
    expect(s.path1.posts[0]).toMatchObject({ id: postId, late: true, counts: true });
  });
});

/* ─────────────────────────────── 3. the social version (checks 5, 6, 7) */

describe('item 14 · the social version: one package, the brand\'s verdict and rounds (checks 5–7)', () => {
  it('5, 6 · every row needs a file; sending locks it; the brand sees what was sent', async () => {
    const { w, postId } = await withApproved();
    await W.addRows(w, postId, ['reel', 'story']);
    expect(err(await W.submit(w)).code).toBe('PACKAGE_INCOMPLETE');
    await W.fill(w);
    const r = await W.submit(w);
    expect(r.status).toBe(200);
    expect(r.body.data.content).toMatchObject({ stage: 'in_review', round: { current: 1, allowed: 2, stamped: true } });
    expect(err(await W.addRows(w, postId, ['post'])).code).toBe('PACKAGE_LOCKED');
    expect(err(await W.removeRow(w, 's1')).code).toBe('PACKAGE_LOCKED');
    const b = await W.state(w, 'brand');
    expect(b).toMatchObject({ stage: 'in_review', yourMove: true, move: { key: 'review_social' }, can: { approve: true, askChanges: true } });
    expect(b.rows.map((x) => [x.type, x.files.length, x.post.id])).toEqual([['reel', 1, postId], ['story', 1, postId]]);
  });

  it('7 · changes with a reason reopen it; a sent row taken out stays in history; the last round warns; then approve or report', async () => {
    const { w, postId } = await withApproved();
    await W.addRows(w, postId, ['reel', 'post']);
    await W.fill(w);
    await W.submit(w);
    expect(err(await api.post(`${W.B(w)}/changes`, w.b.token, { round: 1, reason: ' ' })).code).toBe('REASON_REQUIRED');
    let r = await W.changes(w);
    expect(r.body.data.content.stage).toBe('changes');
    r = await W.removeRow(w, 's2');
    expect(r.status).toBe(200);
    expect(r.body.data.content.rows.map((x) => x.key)).toEqual(['s1']);
    const { rows: [kept] } = await query(`SELECT removed_round FROM content_social_rows WHERE row_key = 's2'
       AND content_id = (SELECT id FROM collab_content WHERE campaign_influencer_id = $1)`, [w.ciId]);
    expect(kept.removed_round).toBe(2);
    await W.submit(w);
    let b = await W.state(w, 'brand');
    expect(b.round).toMatchObject({ current: 2, isLast: true });
    expect(b.rows.map((x) => x.key)).toEqual(['s1']);
    await W.changes(w, 'Once more.');
    await W.submit(w);
    b = await W.state(w, 'brand');
    expect(b.can).toMatchObject({ askChanges: false, reportRoundsUsed: true, approve: true });
    expect(err(await W.changes(w)).code).toBe('ROUNDS_USED');
    expect((await W.approve(w)).body.data.content.stage).toBe('approved');
  });
});

/* ─────────────────────────────── 4. posting, confirming, completing (checks 8–12) */

describe('item 14 · posting, the live confirmation and Completed — and no money (checks 8–12)', () => {
  it('8, 9 · a link per row (Instagram, YouTube, Facebook shapes); no confirmation before "posted"; the self-confirmation date stamped', async () => {
    const { w, postId } = await withApproved();
    await W.addRows(w, postId, ['reel', 'facebook_post']);
    await W.fill(w); await W.submit(w); await W.approve(w);
    expect(err(await W.setLink(w, 's1', 'https://www.youtube.com/shorts/x')).code).toBe('LINK_INVALID');
    expect((await W.setLink(w, 's1', W.LINKS.reel)).status).toBe(200);
    expect(err(await W.posted(w)).code).toBe('PROOF_INCOMPLETE');
    expect((await W.setLink(w, 's2', W.LINKS.facebook_post)).status).toBe(200);
    expect(err(await W.confirmLive(w)).code).toBe('NOT_POSTED');
    const r = await W.posted(w);
    expect(r.status).toBe(200);
    const due = startOfIndiaDay(addDays(istDayOf(new Date()), 7)).toISOString();
    expect(new Date(r.body.data.content.autoconfirmAt).toISOString()).toBe(due);
    expect((await W.state(w, 'brand')).can).toMatchObject({ confirmLive: true, reportPosted: true });
  });

  it('10, 12 · minimum met: the confirmation completes it; nothing about money moves', async () => {
    const { w, postId } = await withApproved();
    await W.toPosted(w, postId);
    const money = async () => (await query(
      `SELECT (SELECT wallet_balance FROM brands WHERE id = $1) AS b, (SELECT wallet_balance FROM influencers WHERE id = $2) AS i,
              (SELECT pending_balance FROM influencers WHERE id = $2) AS p,
              (SELECT count(*)::int FROM escrow_entries WHERE campaign_influencer_id = $3) AS e,
              (SELECT count(*)::int FROM wallet_transactions) AS t`, [w.brandId, w.cr.influencerId, w.ciId])).rows[0];
    const before = await money();
    const r = await W.confirmLive(w);
    expect(r.status).toBe(200);
    expect(r.body.data.content).toMatchObject({ stage: 'complete', liveConfirmedAuto: false, waitingOnPosts: false });
    expect((await query(`SELECT status::text FROM campaign_influencers WHERE id = $1`, [w.ciId])).rows[0].status).toBe('completed');
    expect(await money()).toEqual(before);
    expect(err(await W.confirmLive(w)).code).toBe('ALREADY_CONFIRMED');
  });

  it('10 · confirmed before the minimum: "live · waiting on posts", then Completed by the approval that reaches it', async () => {
    const { w, postId } = await withApproved({ min: 2 });
    await W.toPosted(w, postId);
    let s = (await W.confirmLive(w)).body.data.content;
    expect(s).toMatchObject({ stage: 'live', waitingOnPosts: true, path1: { approved: 1, min: 2, short: 1 } });
    const second = await W.sentPost(w, 'Denim for weekends');
    await W.approvePost(admin, second);
    s = await W.state(w, 'brand');
    expect(s.stage).toBe('complete');
    expect((await query(`SELECT status::text FROM campaign_influencers WHERE id = $1`, [w.ciId])).rows[0].status).toBe('completed');
  });

  it('11 · brand silence: it confirms itself at the stamped date — never earlier, never while reported, never moved by the setting', async () => {
    const { w, postId } = await withApproved();
    await W.toPosted(w, postId);
    await query(`UPDATE platform_settings SET value = 30 WHERE key = 'sale_live_autoconfirm_days'`); platformSettings._resetCache();
    const { rows: [cc] } = await query(`SELECT autoconfirm_at, autoconfirm_days FROM collab_content WHERE campaign_influencer_id = $1`, [w.ciId]);
    expect(cc.autoconfirm_days).toBe(7);
    let out = await saleLive.autoConfirmDue({ now: new Date(new Date(cc.autoconfirm_at).getTime() - 60000) });
    expect(out.confirmed).toBe(0);
    out = await saleLive.autoConfirmDue({ now: new Date(new Date(cc.autoconfirm_at).getTime() + 1000) });
    expect(out.confirmed).toBeGreaterThanOrEqual(1);
    const s = await W.state(w, 'brand');
    expect(s).toMatchObject({ stage: 'complete', liveConfirmedAuto: true });

    const x = await withApproved();
    await W.toPosted(x.w, x.postId);
    await W.report(x.w, 'posted_wrong', 'The link opens another account.');
    const { rows: [cc2] } = await query(`SELECT autoconfirm_at FROM collab_content WHERE campaign_influencer_id = $1`, [x.w.ciId]);
    await saleLive.autoConfirmDue({ now: new Date(new Date(cc2.autoconfirm_at).getTime() + 1000) });
    expect((await W.state(x.w, 'brand')).stage).toBe('posted');
  });
});

/* ─────────────────────────────── 5. outside the package, reports, Delayed (checks 14–16) */

describe('item 14 · posts outside the package, reports and Delayed (checks 14–16)', () => {
  it('14 · a post approved after the package takes a link only, even after Completed; the brand sees it', async () => {
    const { w, postId } = await withApproved();
    const late = await W.sentPost(w, 'Kurta for festive evenings');
    expect(err(await W.addOutside(w, postId, 'post')).code).toBe('OUTSIDE_NOT_OPEN');
    await W.toPosted(w, postId);
    await W.confirmLive(w);
    await W.approvePost(admin, late);
    expect(err(await W.addOutside(w, postId, 'post')).code).toBe('IN_PACKAGE');
    const r = await W.addOutside(w, late, 'youtube_short');
    expect(r.status).toBe(200);
    const key = r.body.data.rowKey;
    expect((await W.setLink(w, key, W.LINKS.youtube_short)).status).toBe(200);
    const b = await W.state(w, 'brand');
    const row = b.rows.find((x) => x.key === key);
    expect(row).toMatchObject({ outside: true, post: { id: late } });
    expect(row.proofs[0]).toMatchObject({ filled: true, url: W.LINKS.youtube_short });
  });

  it('14 · an approved post with no link two days after the posting date is "not shared yet" to the brand', async () => {
    const { w, postId } = await withApproved();
    await W.pastPosting(w, -3);
    // Approved before the posting date, so the two days count from the posting date.
    await query(`UPDATE creator_posts SET approved_at = now() - interval '5 days' WHERE id = $1`, [postId]);
    const b = await W.state(w, 'brand');
    expect(b.notShared.map((n) => n.postId)).toEqual([postId]);
    expect(b.notShared[0].overdue).toBe(true);
  });

  it('15 · a brand report freezes the step; her report is not a thing on Pay for Sale', async () => {
    const { w, postId } = await withApproved();
    await W.toPosted(w, postId);
    expect(err(await api.post(`${W.C(w)}/report`, w.cr.token, { kind: 'brand_silent' })).code).toBe('REPORT_NOT_OPEN');
    expect(err(await W.report(w, 'rounds_used')).code).toBe('REPORT_NOT_OPEN');
    const r = await W.report(w, 'missing', 'The story is not there.');
    expect(r.status).toBe(200);
    expect(r.body.data.content).toMatchObject({ frozen: true, reported: { brand: { kind: 'missing' } } });
    expect(err(await W.confirmLive(w)).code).toBe('REPORTED_HOLD');
    const s = await W.state(w);
    expect(s.move).toBeNull();
    // Her shop post stays in the shop (§13): approved, not removed.
    expect((await query(`SELECT status FROM creator_posts WHERE id = $1`, [postId])).rows[0].status).toBe('approved');
  });

  it('15 · "she hasn\'t posted" opens once she is approved and the posting date has passed', async () => {
    const { w, postId } = await withApproved();
    await W.addRows(w, postId, ['reel']); await W.fill(w); await W.submit(w); await W.approve(w);
    expect(err(await W.report(w, 'not_posted')).code).toBe('REPORT_NOT_OPEN');
    await W.pastPosting(w, -1);
    expect((await W.report(w, 'not_posted')).status).toBe(200);
  });

  it('16 · Delayed at the posting date with its stage; the stage follows the collaboration', async () => {
    const { w, postId } = await withApproved();
    await W.pastPosting(w, -1);
    await saleLive.flagDelayedSale();
    let { rows: [ci] } = await query(`SELECT delayed_at, delayed_stage FROM campaign_influencers WHERE id = $1`, [w.ciId]);
    expect(ci.delayed_stage).toBe('social_not_sent');
    await W.addRows(w, postId, ['reel']); await W.fill(w); await W.submit(w);
    await contentJobs.refreshDelayedStages();
    ({ rows: [ci] } = await query(`SELECT delayed_stage FROM campaign_influencers WHERE id = $1`, [w.ciId]));
    expect(ci.delayed_stage).toBe('social_in_review');
    expect((await W.state(w, 'brand')).delayed).toMatchObject({ stage: 'social_in_review', label: 'Social version in review' });

    const nothing = await W.world();
    await W.pastPosting(nothing, -1);
    await saleLive.flagDelayedSale();
    ({ rows: [ci] } = await query(`SELECT delayed_stage FROM campaign_influencers WHERE id = $1`, [nothing.ciId]));
    expect(ci.delayed_stage).toBe('posts_not_approved');
  });
});

/* ─────────────────────────────── 6. the lists (S2) and the sales (check 13) */

describe('item 14 · the rows and cards say what is next; the sales are on the collaboration (S2, check 13)', () => {
  it('the creator card and the brand set row carry the going-live move', async () => {
    const { w, postId } = await withApproved();
    await W.addRows(w, postId, ['reel']); await W.fill(w); await W.submit(w);
    const set = await api.get(`${w.url}/summary`, w.b.token);
    const row = Object.values(set.body.data.creators.groups).flatMap((g) => g.rows).find((x) => x.id === w.ciId);
    expect(row.goingLive).toMatchObject({ move: 'review_social', yourMove: true, line: 'Your move. Review what she will share.' });
    const mine = await api.get('/influencers/me/invitations?tab=active', w.cr.token);
    const card = mine.body.data.rows.find((x) => x.id === w.ciId);
    expect(card.goingLive).toMatchObject({ move: 'review_social', yourMove: false });
    expect(card.goingLive.line).toMatch(/^With .+ for review.$/);
    // Completed and selling: still on her Active tab (S20).
    await W.approve(w); await W.proveAll(w); await W.posted(w); await W.confirmLive(w);
    const after = await api.get('/influencers/me/invitations?tab=active', w.cr.token);
    expect(after.body.data.rows.find((x) => x.id === w.ciId).goingLive).toMatchObject({ move: 'completed', completed: true, line: 'Completed · selling' });
  });

  it('13 · no orders yet: the sales read zero on both sides, and the brand sees its own columns', async () => {
    const { w } = await withApproved();
    expect((await W.state(w)).sales).toEqual({ orders: 0, sales: 0, commission: 0, pending: 0, inWallet: 0 });
    expect((await W.state(w, 'brand')).sales).toEqual({ orders: 0, sales: 0, commission: 0, fee: 0, brandNet: 0 });
  });
});
