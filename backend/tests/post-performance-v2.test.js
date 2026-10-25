'use strict';

/**
 * post-performance-v2 — the campaign post's views, likes and comments on Instagram and YouTube,
 * read from the links she hands in, through the item 3b Apify runner, on the day curve, under the
 * US$5 budget. Contract: features/post-performance-v2 · master rules v1.35 §13A · checks E1–E27.
 *
 * Real API, real database. Apify is mocked through apifyRuns.setMockResolver and answers BY URL from
 * the two fixtures the Step-0 probe saved (tests/fixtures/apify/instagram-post-by-url.json,
 * youtube-video-by-url.json), re-keyed to the links the worlds paste: an Instagram /reel/ URL comes
 * back with its url in /p/ form and is matched by shortCode; an unknown Instagram URL answers an
 * error item (and is charged); an unknown YouTube id answers NO item; US$0.0027 per Instagram
 * result, US$0.004 per YouTube video, no per-run fee.
 */

const fs = require('fs');
const path = require('path');
const request = require('supertest');
const app = require('../src/app');
const { truncateAll } = require('./helpers/db');
const { createAdminUser } = require('./helpers/factories');
const w12 = require('./helpers/item12');
const F = require('./helpers/item14');
const apify = require('../src/services/apifyRuns.service');
const postStats = require('../src/services/postStats.service');
const postStatsJob = require('../src/jobs/post-stats.job');
const env = require('../src/config/env');

const { api, query, day } = F;
const err = (r) => (r.body && r.body.error) || {};
const one = async (sql, p) => (await query(sql, p)).rows[0];
const all = async (sql, p) => (await query(sql, p)).rows;
const count = async (sql, p) => Number((await one(`SELECT count(*)::int AS n FROM (${sql}) q`, p)).n);

/* ───────────────────────────────────────────── the mock: the probe's answers, by URL */

const IG_FIX = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/apify/instagram-post-by-url.json'), 'utf8'));
const YT_FIX = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/apify/youtube-video-by-url.json'), 'utf8'));
const IG_REEL = IG_FIX.items.find((i) => i.shortCode === 'DbnfYVVv8f-');          // a reel: likes hidden, 847,937 plays
const IG_PHOTO = IG_FIX.items.find((i) => i.shortCode === 'Dc1GyQhhwFF');         // a photo owned by another account, with co-authors
const YT_SHORT = YT_FIX.items.find((i) => i.id === 'aJsb8a5IGKY');

/** An Instagram item for shortcode `code`, shaped like the probe's reel, with the numbers the test states. */
const igItem = (code, over = {}) => ({ ...IG_REEL, shortCode: code, url: `https://www.instagram.com/p/${code}/`, inputUrl: `https://www.instagram.com/reel/${code}/`,
  likesCount: 3910, commentsCount: 212, videoPlayCount: 48200, videoViewCount: null, ownerUsername: 'priya.style', isCommentsDisabled: false, coauthorProducers: [], ...over });
/** A YouTube item for video `id`, shaped like the probe's Short, with the numbers the test states. */
const ytItem = (id, url, over = {}) => ({ ...YT_SHORT, id, url, viewCount: 12700, likes: 880, commentsCount: 41, commentsTurnedOff: false,
  channelUsername: 'priyastyle', channelUrl: 'https://www.youtube.com/@priyastyle', channelId: 'UCpriya1234567890abcdef', ...over });

const IG = {};            // shortCode → item | null (null = an error item, "Post does not exist")
const YT = {};            // video id → item (missing = no item at all)
const inputs = [];        // every actor input the mock saw (E7)
function resolver(actor, input) {
  inputs.push({ actor, input });
  if (/instagram-post-scraper/.test(actor)) {
    const items = (input.username || []).map((u) => {
      const id = (postStats.parseLink(u) || {}).id;
      return IG[id] ? IG[id] : { url: u, error: 'not_found', errorDescription: 'Post does not exist' };
    });
    return { items, usageTotalUsd: Math.round(items.length * 0.0027 * 10000) / 10000 };
  }
  if (/youtube-scraper/.test(actor)) {
    const items = (input.startUrls || []).map((s) => YT[(postStats.parseLink(s.url) || {}).id]).filter(Boolean);
    return { items, usageTotalUsd: Math.round(items.length * 0.004 * 10000) / 10000 };
  }
  return apify.defaultMock(actor, input);
}

let admin;
beforeAll(async () => { await w12.startServer(); });
afterAll(() => w12.stopServer());
beforeEach(async () => {
  await truncateAll();
  await query(`TRUNCATE post_stat_runs CASCADE`);
  F.resetTree();
  admin = await createAdminUser('superadmin');
  for (const k of Object.keys(IG)) delete IG[k];
  for (const k of Object.keys(YT)) delete YT[k];
  inputs.length = 0;
  apify.setMockResolver(resolver);
  apify.setMockUsage(0);
});
afterAll(() => { apify.setMockResolver(null); apify.setMockUsage(0); });

/* ───────────────────────────────────────────── fixtures */

/** Her confirmed accounts for the ownership check: Instagram @priya.style, YouTube @priyastyle. */
async function confirmedAccounts(w, { youtube = true, instagram = true } = {}) {
  if (instagram) {
    await query(`UPDATE creator_social_accounts SET handle_norm = 'priya.style', handle_raw = '@priya.style', ownership = 'confirmed', state = 'ok' WHERE influencer_id = $1 AND platform = 'instagram' AND replaced_at IS NULL`, [w.cr.influencerId]);
  } else {
    await query(`DELETE FROM creator_social_accounts WHERE influencer_id = $1 AND platform = 'instagram'`, [w.cr.influencerId]);
  }
  if (youtube) {
    await query(
      `INSERT INTO creator_social_accounts (influencer_id, platform, handle_raw, handle_norm, channel_url, platform_account_id, state, ownership)
       VALUES ($1, 'youtube', '@priyastyle', 'priyastyle', 'https://www.youtube.com/@priyastyle', 'UCpriya1234567890abcdef', 'ok', 'confirmed')`, [w.cr.influencerId]);
  }
}

const REEL = 'https://www.instagram.com/reel/C9xK2abc/';
const SHORT = 'https://youtube.com/shorts/Qm8xyz';
const CONTENT_TERMS = { fee: 9000, deliverables: [{ type: 'reel', count: 1 }, { type: 'story', count: 2 }, { type: 'youtube_short', count: 1 }] };

/** A Pay for Content world at the content step, approved by the brand, her accounts confirmed. */
async function contentApproved() {
  const w = await w12.shotDone('engagement', { terms: CONTENT_TERMS });
  w.admin = admin;
  await confirmedAccounts(w);
  await w12.fillPackage(w);
  let r = await w12.submit(w); if (r.status !== 200) throw new Error(`submit ${JSON.stringify(r.body)}`);
  r = await w12.approve(w); if (r.status !== 200) throw new Error(`approve ${JSON.stringify(r.body)}`);
  IG.C9xK2abc = igItem('C9xK2abc');
  YT.Qm8xyz = ytItem('Qm8xyz', SHORT, { type: 'shorts' });
  return w;
}
const setLink = (w, rowKey, slot, url) => api.put(`${w12.C(w)}/proofs/${rowKey}/${slot}`, w.cr.token, { url });
async function proveStories(w) {
  for (const slot of [1, 2]) {
    // eslint-disable-next-line no-await-in-loop
    const f = await w12.upload(w, 'story', 'photo', { purpose: 'story_proof', mime: 'image/png' });
    // eslint-disable-next-line no-await-in-loop
    const r = await api.put(`${w12.C(w)}/proofs/story/${slot}`, w.cr.token, { screenshotFileId: f.id });
    if (r.status !== 200) throw new Error(`story ${JSON.stringify(r.body)}`);
  }
}
/** Links in, stories in, "I've posted everything". */
async function contentPosted(w) {
  expect((await setLink(w, 'reel', 1, REEL)).status).toBe(200);
  expect((await setLink(w, 'youtube_short', 1, SHORT)).status).toBe(200);
  await proveStories(w);
  const r = await w12.posted(w);
  if (r.status !== 200) throw new Error(`posted ${JSON.stringify(r.body)}`);
  return r;
}
const contentId = async (w) => (await one(`SELECT id FROM collab_content WHERE campaign_influencer_id = $1`, [w.ciId])).id;
const stats = async (w) => all(`SELECT ps.* FROM proof_stats ps JOIN collab_content cc ON cc.id = ps.content_id WHERE cc.campaign_influencer_id = $1 ORDER BY ps.platform, ps.created_at`, [w.ciId]);
const open = async (w) => (await stats(w)).filter((s) => !s.stopped_at);
const runs = () => all(`SELECT * FROM post_stat_runs ORDER BY started_at, platform`);
const proofOf = (content, rowKey, slot = 1) => content.rows.find((r) => r.key === rowKey).proofs.find((p) => p.slot === slot);
const brandRefresh = (w) => api.post(`${w12.B(w)}/stats/refresh`, w.b.token, {});
const creatorRefresh = (w) => api.post(`${w12.C(w)}/stats/refresh`, w.cr.token, {});

/* ───────────────────────────────────────────── A · Pay for Content: from her links to the brand's numbers */

describe('A · Pay for Content — tracking starts when the links are final (E1–E4)', () => {
  it('E1 · a link saved before posting creates no proof_stats row; E2 · "I\'ve posted everything" tracks one row per Instagram/YouTube link, none for a Story', async () => {
    const w = await contentApproved();
    expect((await setLink(w, 'reel', 1, REEL)).status).toBe(200);
    expect(await count(`SELECT 1 FROM proof_stats ps JOIN collab_content cc ON cc.id = ps.content_id WHERE cc.campaign_influencer_id = $1`, [w.ciId])).toBe(0);     // E1
    await contentPosted(w);
    const rows = await stats(w);
    expect(rows).toHaveLength(2);                                                                          // E2: reel + Short; the two Stories none
    const cc = await one(`SELECT posted_at FROM collab_content WHERE campaign_influencer_id = $1`, [w.ciId]);
    const ig = rows.find((r) => r.platform === 'instagram'); const yt = rows.find((r) => r.platform === 'youtube');
    expect(ig).toMatchObject({ row_key: 'reel', slot: 1, platform_post_id: 'C9xK2abc', url_sent: REEL, reads: 0, stopped_at: null });
    expect(yt).toMatchObject({ row_key: 'youtube_short', slot: 1, platform_post_id: 'Qm8xyz', url_sent: SHORT, reads: 0 });
    for (const r of rows) {
      expect(new Date(r.tracked_from).getTime()).toBe(new Date(cc.posted_at).getTime());
      expect(new Date(r.next_due_at).getTime()).toBe(new Date(r.tracked_from).getTime());
    }
  });

  it('E3 · her read says waiting under each link and story under each screenshot; nothing read yet', async () => {
    const w = await contentApproved();
    await contentPosted(w);
    const c = (await w12.read(w, 'creator')).body.data.content;
    expect(proofOf(c, 'reel').stats).toMatchObject({ state: 'waiting' });
    expect(proofOf(c, 'youtube_short').stats).toMatchObject({ state: 'waiting' });
    expect(proofOf(c, 'story', 1).stats).toEqual({ state: 'story' });
    expect(proofOf(c, 'story', 2).stats).toEqual({ state: 'story' });
    expect(c.social).toMatchObject({ tracked: 2, canUpdate: true, lastUpdateNowAt: null });
    expect(await runs()).toHaveLength(0);
  });

  it('E4 · a link Level 1 already measured is seeded for free, labelled level1 with Level 1\'s date, until the first paid read', async () => {
    const w = await contentApproved();
    const acc = await one(`SELECT id FROM creator_social_accounts WHERE influencer_id = $1 AND platform = 'instagram'`, [w.cr.influencerId]);
    const measured = new Date(Date.now() - 13 * 86400000);
    await query(
      `INSERT INTO creator_social_posts (account_id, platform_post_id, kind, published_at, likes, comments, views, url, owner_handle, updated_at)
       VALUES ($1, '3956268809291024382', 'reel', $2, 2900, 140, 31200, 'https://www.instagram.com/p/C9xK2abc/', 'priya.style', $3)`,
      [acc.id, new Date(Date.now() - 15 * 86400000), measured]);
    await contentPosted(w);
    const ig = (await stats(w)).find((r) => r.platform === 'instagram');
    expect(ig).toMatchObject({ last_source: 'level1', last_result: 'ok', reads: 0 });
    expect([Number(ig.views), Number(ig.likes), Number(ig.comments)]).toEqual([31200, 2900, 140]);
    expect(new Date(ig.last_read_at).getTime()).toBe(measured.getTime());
    const read = await one(`SELECT * FROM proof_stat_reads WHERE stat_id = $1`, [ig.id]);
    expect(read).toMatchObject({ source: 'level1', result: 'ok', run_id: null });
    const c = (await w12.read(w, 'creator')).body.data.content;
    expect(proofOf(c, 'reel').stats).toMatchObject({ state: 'ok', views: 31200, likes: 2900, comments: 140, source: 'level1' });
    expect(new Date(proofOf(c, 'reel').stats.sourceAt).getTime()).toBe(measured.getTime());
    expect(proofOf(c, 'youtube_short').stats.state).toBe('waiting');
  });
});

describe('A · the clock reads the due links, one run per platform (E5–E8)', () => {
  it('E5 · one run per platform with trigger, actor, Apify run id, cost, counts; one reading per link with the raw item · E6 · the latest numbers, reads = 1, next due day 2, owner match · E7 · the exact inputs', async () => {
    const w = await contentApproved();
    await contentPosted(w);
    const out = await postStatsJob.run();
    expect(out.skipped).toBeUndefined();
    expect(out).toMatchObject({ due: 2, ran: 2, read: 2 });
    const rs = await runs();
    expect(rs).toHaveLength(2);
    const ig = rs.find((r) => r.platform === 'instagram'); const yt = rs.find((r) => r.platform === 'youtube');
    expect(ig).toMatchObject({ trigger: 'schedule', actor: env.APIFY_IG_POSTS_ACTOR, result: 'success', urls_sent: 1, items_received: 1 });
    expect(yt).toMatchObject({ trigger: 'schedule', actor: env.APIFY_YOUTUBE_ACTOR, result: 'success', urls_sent: 1, items_received: 1 });
    expect(ig.apify_run_id).toMatch(/^mock-/); expect(yt.apify_run_id).toMatch(/^mock-/); expect(ig.apify_run_id).not.toBe(yt.apify_run_id);
    expect(Number(ig.usage_usd)).toBe(0.0027); expect(Number(yt.usage_usd)).toBe(0.004);
    expect(ig.finished_at).toBeTruthy();
    // E7 — the inputs, as she pasted them
    const igIn = inputs.find((x) => /instagram-post-scraper/.test(x.actor)).input;
    const ytIn = inputs.find((x) => /youtube-scraper/.test(x.actor)).input;
    expect(igIn).toEqual({ username: [REEL] });
    expect(ytIn).toEqual({ startUrls: [{ url: SHORT }], maxResults: 1, maxResultsShorts: 1, maxResultStreams: 0 });
    // the readings
    const st = await stats(w);
    const sIg = st.find((s) => s.platform === 'instagram'); const sYt = st.find((s) => s.platform === 'youtube');
    const reads = await all(`SELECT * FROM proof_stat_reads WHERE stat_id = ANY($1::uuid[]) ORDER BY measured_at`, [[sIg.id, sYt.id]]);
    expect(reads).toHaveLength(2);
    expect(reads.every((r) => r.source === 'apify' && r.result === 'ok' && r.run_id)).toBe(true);
    expect(reads.find((r) => r.stat_id === sIg.id).raw.shortCode).toBe('C9xK2abc');
    expect(reads.find((r) => r.stat_id === sYt.id).raw.id).toBe('Qm8xyz');
    // E6
    expect(sIg).toMatchObject({ reads: 1, owner_state: 'match', last_source: 'apify', last_result: 'ok', kind: 'reel', likes_hidden: false, comments_off: false, owner_handle: 'priya.style' });
    expect([Number(sIg.views), Number(sIg.likes), Number(sIg.comments)]).toEqual([48200, 3910, 212]);
    expect(sYt).toMatchObject({ reads: 1, owner_state: 'match', kind: 'short', owner_handle: 'priyastyle' });
    expect([Number(sYt.views), Number(sYt.likes), Number(sYt.comments)]).toEqual([12700, 880, 41]);
    for (const s of [sIg, sYt]) expect(new Date(s.next_due_at).getTime() - new Date(s.tracked_from).getTime()).toBe(86400000);
  });

  it('E8 · the brand reads the numbers under each link, the screenshot line under each Story', async () => {
    const w = await contentApproved();
    await contentPosted(w);
    await postStats.runDue();
    const c = (await w12.read(w, 'brand')).body.data.content;
    const reel = proofOf(c, 'reel').stats;
    expect(reel).toMatchObject({ state: 'ok', views: 48200, likes: 3910, comments: 212, likesHidden: false, commentsOff: false, source: 'apify', ownerState: 'match', kind: 'reel', platform: 'instagram', url: REEL });
    expect(reel.updatedAt).toBeTruthy();
    expect(proofOf(c, 'youtube_short').stats).toMatchObject({ state: 'ok', views: 12700, likes: 880, comments: 41, kind: 'short', platform: 'youtube' });
    expect(proofOf(c, 'story', 1).stats).toEqual({ state: 'story' });
    // confirming live changes nothing in tracking (P5: Pay for Content follows the curve)
    const before = await stats(w);
    expect((await w12.confirmLive(w)).status).toBe(200);
    expect(await stats(w)).toEqual(before);
  });
});

describe('A · Update now, the curve, the website and the admin (E9–E12)', () => {
  it('E9 · Update now reads both links with trigger update_now (reads = 2); a second press within 24 h is 422 UPDATE_TOO_SOON with no run; admin is exempt', async () => {
    const w = await contentApproved();
    await contentPosted(w);
    await postStats.runDue();
    const r = await brandRefresh(w);
    expect(r.status).toBe(200);
    expect(r.body.data.refreshed).toMatchObject({ links: 2 });
    expect(proofOf(r.body.data.content, 'reel').stats.state).toBe('ok');
    const rs = await runs();
    expect(rs.filter((x) => x.trigger === 'update_now')).toHaveLength(2);
    expect((await stats(w)).every((s) => s.reads === 2)).toBe(true);
    const again = await brandRefresh(w);
    expect(again.status).toBe(422);
    expect(err(again).code).toBe('UPDATE_TOO_SOON');
    expect(err(again).message).toMatch(/^Numbers were updated \d+ minutes? ago\. Once a day\.$/);
    // once per COLLABORATION: her press counts against the same day
    const hers = await creatorRefresh(w);
    expect(hers.status).toBe(422); expect(err(hers).code).toBe('UPDATE_TOO_SOON');
    expect(await runs()).toHaveLength(4);
    expect(r.body.data.content.social.lastUpdateNowAt).toBeTruthy();
    // admin's Measure now on the collaboration is exempt from the day and the budget (P7)
    apify.setMockUsage(env.APIFY_MONTHLY_BUDGET_USD);
    const a = await api.post(`/admin/collabs/${w.ciId}/content/stats/refresh`, admin.token, {});
    expect(a.status).toBe(200);
    expect((await runs()).filter((x) => x.trigger === 'admin')).toHaveLength(2);
    // a brand press when the month is used up is refused, no run
    await query(`UPDATE post_stat_runs SET started_at = started_at - interval '25 hours'`);
    const b = await brandRefresh(w);
    expect(b.status).toBe(422); expect(err(b).code).toBe('BUDGET_USED');
    expect(await runs()).toHaveLength(6);
  });

  it('E10 · the curve: day 1, 2, 3, 5, 7, 10, 14, 21, 30, then every 14 days; day 91 stops the row; a stopped row is never read', async () => {
    const t0 = new Date('2026-10-01T08:30:00.000Z');
    const D = (n) => new Date(t0.getTime() + n * 86400000);
    // the first nine due dates, each read the morning after (day 1 … day 30)
    let due = t0; const seq = [];
    for (let i = 0; i < 9; i += 1) { seq.push((due.getTime() - t0.getTime()) / 86400000); due = postStats.nextDueAfter(t0, due, new Date(due.getTime() + 3600000)); }
    expect(seq).toEqual([0, 1, 2, 4, 6, 9, 13, 20, 29]);
    // after day 30 the next due is +14 d, then +14 d …, never past day 90
    expect((due.getTime() - t0.getTime()) / 86400000).toBe(43);
    due = postStats.nextDueAfter(t0, due, new Date(due.getTime() + 3600000)); expect((due.getTime() - t0.getTime()) / 86400000).toBe(57);
    due = postStats.nextDueAfter(t0, due, new Date(due.getTime() + 3600000)); expect((due.getTime() - t0.getTime()) / 86400000).toBe(71);
    due = postStats.nextDueAfter(t0, due, new Date(due.getTime() + 3600000)); expect((due.getTime() - t0.getTime()) / 86400000).toBe(85);
    due = postStats.nextDueAfter(t0, due, new Date(due.getTime() + 3600000)); expect((due.getTime() - t0.getTime()) / 86400000).toBe(90);
    // a skipped day is caught up with ONE read, then the curve continues from today
    expect((postStats.nextDueAfter(t0, D(1), D(12)).getTime() - t0.getTime()) / 86400000).toBe(13);

    // in the database: a row at the end of its curve stops on arrival; the job never reads it again
    const w = await contentApproved();
    await contentPosted(w);
    const [ig] = (await stats(w)).filter((s) => s.platform === 'instagram');
    await query(`UPDATE proof_stats SET tracked_from = now() - interval '91 days', next_due_at = now() - interval '1 day' WHERE id = $1`, [ig.id]);
    await query(`UPDATE proof_stats SET next_due_at = now() + interval '5 days' WHERE id <> $1`, [ig.id]);
    let out = await postStats.runDue();
    expect(out).toMatchObject({ due: 0, ran: 0, stopped: { day90: 1 } });
    const after = await one(`SELECT * FROM proof_stats WHERE id = $1`, [ig.id]);
    expect(after.stop_reason).toBe('day_90'); expect(after.stopped_at).toBeTruthy(); expect(after.reads).toBe(0);
    await query(`UPDATE proof_stats SET next_due_at = now() - interval '1 hour' WHERE id = $1`, [ig.id]);
    out = await postStats.runDue();
    expect(out.ran).toBe(0);
    expect(await runs()).toHaveLength(0);
    const c = (await w12.read(w, 'creator')).body.data.content;
    expect(proofOf(c, 'reel').stats).toMatchObject({ state: 'gone', stopReason: 'day_90' });
  });

  it('E11 · GET /brands/me/campaigns/:id/engagement — the new shape, no engagement rate, no deliverables; Update now once a day', async () => {
    const w = await contentApproved();
    await contentPosted(w);
    await postStats.runDue();
    const r = await api.get(`/brands/me/campaigns/${w.c.id}/engagement`, w.b.token);
    expect(r.status).toBe(200);
    const d = r.body.data;
    expect(Object.keys(d).sort()).toEqual(['bySet', 'byCreator', 'campaignId', 'campaignName', 'canUpdate', 'lastUpdateNowAt', 'links', 'totals'].sort());
    expect(d.totals).toMatchObject({ views: 60900, likes: 4790, comments: 253, links: 2, linksRead: 2, waiting: 0 });
    expect(d.totals.updatedAt).toBeTruthy();
    expect(d.bySet).toHaveLength(1);
    expect(d.bySet[0]).toMatchObject({ setId: w.s.id, aim: 'Pay for Content', creators: 1, views: 60900, likes: 4790, comments: 253, links: 2 });
    expect(d.byCreator).toHaveLength(1);
    expect(d.byCreator[0]).toMatchObject({ ciId: w.ciId, setId: w.s.id, views: 60900, likes: 4790, comments: 253, links: 2, read: 2, missing: false });
    expect(d.byCreator[0].handle).toMatch(/^@/);
    expect(d.links).toHaveLength(4);                              // reel, Short, two Stories
    const reel = d.links.find((l) => l.rowKey === 'reel');
    expect(reel).toMatchObject({ label: 'Instagram reel 1 of 1', url: REEL, platform: 'instagram', screenshot: false });
    expect(reel.stats).toMatchObject({ state: 'ok', views: 48200, likes: 3910, comments: 212 });
    expect(d.links.find((l) => l.rowKey === 'youtube_short').label).toBe('YouTube short 1 of 1');
    expect(d.links.filter((l) => l.rowKey === 'story').map((l) => [l.label, l.screenshot, l.stats.state])).toEqual([['Instagram story 1 of 2', true, 'story'], ['Instagram story 2 of 2', true, 'story']]);
    expect(JSON.stringify(d)).not.toMatch(/engagement_rate|avg_er|deliverables|reach|saves|shares/);
    // the website's one Update now for the campaign
    const u = await api.post(`/brands/me/campaigns/${w.c.id}/engagement/refresh`, w.b.token, {});
    expect(u.status).toBe(200);
    expect(u.body.data.refreshed).toMatchObject({ links: 2 });
    expect(u.body.data.totals.links).toBe(2);
    const again = await api.post(`/brands/me/campaigns/${w.c.id}/engagement/refresh`, w.b.token, {});
    expect(again.status).toBe(422); expect(err(again).code).toBe('UPDATE_TOO_SOON');
    // not the brand's campaign → 404; a creator → 403
    const other = await F.world({ shootDone: false });
    expect((await api.get(`/brands/me/campaigns/${w.c.id}/engagement`, other.b.token)).status).toBe(404);
    expect((await api.get(`/brands/me/campaigns/${w.c.id}/engagement`, w.cr.token)).status).toBe(403);
  });

  it('E12 · /admin/social/costs adds postRuns by platform and totalUsd = socialRunsUsd + postRuns.usd; existing keys unchanged; the run_log fallback sums both tables', async () => {
    const w = await contentApproved();
    await contentPosted(w);
    await postStats.runDue();
    const r = await api.get('/admin/social/costs', admin.token);
    expect(r.status).toBe(200);
    const d = r.body.data;
    for (const k of ['month', 'byPlatform', 'socialRunsUsd', 'accountMonthUsd', 'accountSource', 'budgetUsd']) expect(d).toHaveProperty(k);
    expect(d.postRuns.byPlatform).toEqual([{ platform: 'instagram', runs: 1, usd: 0.0027 }, { platform: 'youtube', runs: 1, usd: 0.004 }]);
    expect(d.postRuns.usd).toBe(0.0067);
    expect(d.totalUsd).toBe(Math.round((d.socialRunsUsd + 0.0067) * 10000) / 10000);
    expect(d.budgetUsd).toBe(env.APIFY_MONTHLY_BUDGET_USD);
    // the fallback when Apify's own figure cannot be read: both run tables
    const measure = require('../src/services/socialMeasure.service');
    const orig = apify.monthlyUsageUsd;
    apify.monthlyUsageUsd = async () => { throw new Error('offline'); };
    try {
      const spend = await measure.monthSpend();
      expect(spend.source).toBe('run_log');
      expect(spend.usd).toBeCloseTo(0.0067, 4);
    } finally { apify.monthlyUsageUsd = orig; }
  });
});

/* ───────────────────────────────────────────── B · Pay for Sale: the post's performance screen */

async function saleWorld() {
  const w = await F.world();
  w.admin = admin;
  await confirmedAccounts(w);
  const postId = await F.sentPost(w);
  await F.approvePost(admin, postId);
  IG.C9xK2abc = igItem('C9xK2abc');
  YT.Qm8abc = ytItem('Qm8abc', F.LINKS.youtube_video, { type: 'video' });
  return { w, postId };
}

describe('B · Pay for Sale — the shoppable post\'s social numbers (E13–E16, E23, E24)', () => {
  it('E13 · her post stats list the links under social[] with rowKey, type, label, url, stats; the post read carries the one line', async () => {
    const { w, postId } = await saleWorld();
    await F.toPosted(w, postId, ['reel', 'youtube_video']);
    expect(await count(`SELECT 1 FROM proof_stats ps JOIN content_social_rows sr ON sr.content_id = ps.content_id AND sr.row_key = ps.row_key WHERE sr.post_id = $1`, [postId])).toBe(2);
    await postStats.runDue();
    const r = await api.get(`/influencers/me/shoppable-posts/${postId}/stats`, w.cr.token);
    expect(r.status).toBe(200);
    const social = r.body.data.social;
    expect(social).toHaveLength(2);
    expect(social[0]).toMatchObject({ rowKey: 's1', type: 'reel', label: 'Instagram reel', platform: 'instagram', url: F.LINKS.reel });
    expect(social[0].stats).toMatchObject({ state: 'ok', views: 48200, likes: 3910, comments: 212 });
    expect(social[1]).toMatchObject({ rowKey: 's2', type: 'youtube_video', label: 'YouTube video', url: F.LINKS.youtube_video });
    expect(social[1].stats).toMatchObject({ state: 'ok', views: 12700, likes: 880, comments: 41, kind: 'long' });
    expect(r.body.data.social_summary).toMatchObject({ views: 60900, likes: 4790, comments: 253, links: 2, read: 2, missing: false });
    expect(r.body.data.collaboration_id).toBe(w.ciId);
    // the brand's post stats: the same block
    const b = await api.get(`${w.url}/posts/${postId}/stats`, w.b.token);
    expect(b.status).toBe(200);
    expect(b.body.data.social.map((l) => l.stats.views)).toEqual([48200, 12700]);
    // the post read (Post status): "On social media · 60,900 views · 4,790 likes · 253 comments · 2 links"
    const p = await api.get(`/influencers/me/shoppable-posts/${postId}`, w.cr.token);
    expect(p.body.data.post.social).toMatchObject({ views: 60900, likes: 4790, comments: 253, links: 2, missing: false });
    expect(p.body.data.post.social.items.map((i) => [i.label, i.views])).toEqual([['Instagram reel', 48200], ['YouTube video', 12700]]);
  });

  it('E14 · the set posts list: social on every post; a post with no links after the posting date → missing (M3: nothing before it)', async () => {
    const { w, postId } = await saleWorld();
    await F.toPosted(w, postId, ['reel']);
    await postStats.runDue();
    const second = await F.sentPost(w, 'Another look');
    await F.approvePost(admin, second);
    let r = await api.get(`${w.url}/posts`, w.b.token);
    expect(r.status).toBe(200);
    const first = r.body.data.posts.find((p) => p.id === postId);
    expect(first.social).toMatchObject({ views: 48200, likes: 3910, comments: 212, links: 1, read: 1, missing: false });
    expect(r.body.data.social.views).toBe(48200);
    // the posting date is still ahead: no "not added yet" line yet (M3)
    expect(r.body.data.posts.find((p) => p.id === second).social).toMatchObject({ links: 0, missing: false });
    await F.pastPosting(w);
    r = await api.get(`${w.url}/posts`, w.b.token);
    expect(r.body.data.posts.find((p) => p.id === second).social).toMatchObject({ links: 0, missing: true });
  });

  it('E15 · an outside row\'s link is tracked at save · E24 · a replaced link closes the old row (link_changed) and tracks the new one', async () => {
    const { w, postId } = await saleWorld();
    await F.toPosted(w, postId, ['reel']);
    const late = await F.sentPost(w, 'Late post');
    await F.approvePost(admin, late);
    const o = await F.addOutside(w, late, 'reel');
    expect(o.status).toBe(200);
    const key = (await one(`SELECT row_key FROM content_social_rows WHERE post_id = $1 AND outside`, [late])).row_key;
    const url1 = 'https://www.instagram.com/reel/LATE1abc/';
    expect((await F.setLink(w, key, url1)).status).toBe(200);
    let rows = await all(`SELECT * FROM proof_stats WHERE row_key = $1 ORDER BY created_at`, [key]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ platform_post_id: 'LATE1abc', url_sent: url1, stopped_at: null });        // E15: no posting needed
    const url2 = 'https://www.instagram.com/p/LATE2def/';
    expect((await F.setLink(w, key, url2)).status).toBe(200);
    rows = await all(`SELECT * FROM proof_stats WHERE row_key = $1 ORDER BY created_at`, [key]);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ platform_post_id: 'LATE1abc', stop_reason: 'link_changed' });
    expect(rows[0].stopped_at).toBeTruthy();
    expect(rows[1]).toMatchObject({ platform_post_id: 'LATE2def', url_sent: url2, stopped_at: null, reads: 0 });  // E24
    // saving the same link again changes nothing
    expect((await F.setLink(w, key, url2)).status).toBe(200);
    expect(await count(`SELECT 1 FROM proof_stats WHERE row_key = $1`, [key])).toBe(2);
    // the brand's read shows the new link waiting, never the closed one
    const c = (await F.read(w, 'brand')).body.data.content;
    expect(proofOf(c, key).stats).toMatchObject({ state: 'waiting' });
  });

  it('E16 · the shoppable post taken down → its rows stop (post_left_shop) on the next run; the lines keep their numbers', async () => {
    const { w, postId } = await saleWorld();
    await F.toPosted(w, postId, ['reel', 'youtube_video']);
    await postStats.runDue();
    expect((await api.post(`/influencers/me/shoppable-posts/${postId}/take-down`, w.cr.token, {})).status).toBe(200);
    await query(`UPDATE proof_stats SET next_due_at = now() - interval '1 minute'`);
    const out = await postStats.runDue();
    expect(out.stopped.leftShop).toBe(2); expect(out.ran).toBe(0);
    const rows = await all(`SELECT * FROM proof_stats ORDER BY platform`);
    expect(rows.every((r) => r.stop_reason === 'post_left_shop' && r.stopped_at && Number(r.views) > 0)).toBe(true);
    const r = await api.get(`/influencers/me/shoppable-posts/${postId}/stats`, w.cr.token);
    expect(r.body.data.social[0].stats).toMatchObject({ state: 'stopped', views: 48200, stopReason: 'post_left_shop' });
    expect(r.body.data.social_summary.stopped).toBe(true);
  });

  it('E23 · a Facebook link makes no proof_stats row; its stats say facebook', async () => {
    const { w, postId } = await saleWorld();
    await F.toPosted(w, postId, ['reel', 'facebook_post']);
    const rows = await all(`SELECT row_key, platform FROM proof_stats`);
    expect(rows).toEqual([{ row_key: 's1', platform: 'instagram' }]);
    const c = (await F.read(w, 'brand')).body.data.content;
    expect(proofOf(c, 's2').stats).toEqual({ state: 'facebook' });
    expect(proofOf(c, 's1').stats.state).toBe('waiting');
  });
});

/* ───────────────────────────────────────────── C · the guard rails */

describe('C · the guard rails (E17–E22)', () => {
  it('E17 · month usage at the budget → the job skips, writes no run, flags budget once; Level 1 keeps its exempt runs', async () => {
    const w = await contentApproved();
    await contentPosted(w);
    apify.setMockUsage(env.APIFY_MONTHLY_BUDGET_USD);
    let out = await postStatsJob.run();
    expect(out).toMatchObject({ ran: 0, skipped: 'budget' });
    out = await postStatsJob.run();
    expect(out.skipped).toBe('budget');
    expect(await runs()).toHaveLength(0);
    expect(await count(`SELECT 1 FROM social_admin_flags WHERE kind = 'budget'`)).toBe(1);
    expect((await stats(w)).every((s) => new Date(s.next_due_at).getTime() === new Date(s.tracked_from).getTime())).toBe(true);
    // next day the month is under the budget again: the overdue links are read first
    apify.setMockUsage(4.1);
    out = await postStatsJob.run();
    expect(out).toMatchObject({ ran: 2, read: 2 });
  });

  it('E18 · Apify refuses the run for credit → the run is `budget`, every link keeps its due date, no reading', async () => {
    const w = await contentApproved();
    await contentPosted(w);
    apify.setMockResolver(() => ({ __refuse: true }));
    const before = await stats(w);
    const out = await postStats.runDue();
    expect(out.ran).toBe(2); expect(out.read).toBe(0);
    const rs = await runs();
    expect(rs.map((r) => r.result)).toEqual(['budget', 'budget']);
    expect(rs.every((r) => r.error && r.finished_at)).toBe(true);
    expect(await count(`SELECT 1 FROM proof_stat_reads`)).toBe(0);
    const after = await stats(w);
    expect(after.map((s) => s.next_due_at)).toEqual(before.map((s) => s.next_due_at));
    expect(after.every((s) => s.reads === 0)).toBe(true);
    // Apify down → technical_failure, same rule
    apify.setMockResolver(() => ({ __fail: 'network down' }));
    await postStats.runDue();
    expect((await runs()).slice(2).map((r) => r.result)).toEqual(['technical_failure', 'technical_failure']);
    expect((await stats(w)).map((s) => s.next_due_at)).toEqual(before.map((s) => s.next_due_at));
  });

  it('E19 · an Instagram not_found item and a YouTube id with no item back stop their links; the others in the batch are read, matched by shortCode / id', async () => {
    const { w, postId } = await saleWorld();
    await F.toPosted(w, postId, ['reel', 'youtube_video']);
    const late = await F.sentPost(w, 'Late post');
    await F.approvePost(admin, late);
    await F.addOutside(w, late, 'post');
    const key2 = (await one(`SELECT row_key FROM content_social_rows WHERE post_id = $1 AND outside`, [late])).row_key;
    expect((await F.setLink(w, key2, 'https://www.instagram.com/p/GONEabc12/')).status).toBe(200);
    await F.addOutside(w, late, 'youtube_short');
    const key3 = (await one(`SELECT row_key FROM content_social_rows WHERE post_id = $1 AND outside AND type = 'youtube_short'`, [late])).row_key;
    expect((await F.setLink(w, key3, 'https://youtube.com/shorts/GONEyt123')).status).toBe(200);
    // GONEabc12 answers an error item; GONEyt123 answers nothing — the mock's defaults for an unknown id.
    // The answers come back in another order than the questions, so position can never match.
    const base = resolver;
    apify.setMockResolver((actor, input) => { const r = base(actor, input); r.items.reverse(); return r; });
    const out = await postStats.runDue();
    expect(out).toMatchObject({ due: 4, ran: 2, read: 4 });
    const rs = await runs();
    expect(rs.find((r) => r.platform === 'instagram')).toMatchObject({ urls_sent: 2, items_received: 2 });
    expect(rs.find((r) => r.platform === 'youtube')).toMatchObject({ urls_sent: 2, items_received: 1 });
    const st = await all(`SELECT * FROM proof_stats ORDER BY row_key`);
    expect(st.find((s) => s.row_key === 's1')).toMatchObject({ last_result: 'ok', stopped_at: null });
    expect(Number(st.find((s) => s.row_key === 's1').views)).toBe(48200);
    expect(st.find((s) => s.row_key === 's2')).toMatchObject({ last_result: 'ok', stopped_at: null });
    expect(Number(st.find((s) => s.row_key === 's2').views)).toBe(12700);
    expect(st.find((s) => s.row_key === key2)).toMatchObject({ last_result: 'not_found', stop_reason: 'not_found', reads: 1 });
    expect(st.find((s) => s.row_key === key2).stopped_at).toBeTruthy();
    expect(st.find((s) => s.row_key === key3)).toMatchObject({ last_result: 'not_found', stop_reason: 'not_found', reads: 1 });
    const c = (await F.read(w, 'creator')).body.data.content;
    expect(proofOf(c, key2).stats).toMatchObject({ state: 'gone', stopReason: 'not_found' });
    expect(proofOf(c, key3).stats.state).toBe('gone');
    // the not-found Instagram result was charged too (probe): the run's own figure counts both items
    expect(Number(rs.find((r) => r.platform === 'instagram').usage_usd)).toBe(0.0054);
  });

  it('E20 · likesCount −1 → likes NULL, likes_hidden; commentsTurnedOff → comments NULL, comments_off', async () => {
    const w = await contentApproved();
    IG.C9xK2abc = igItem('C9xK2abc', { likesCount: -1 });
    YT.Qm8xyz = ytItem('Qm8xyz', SHORT, { commentsTurnedOff: true, commentsCount: 0 });
    await contentPosted(w);
    await postStats.runDue();
    const st = await stats(w);
    const ig = st.find((s) => s.platform === 'instagram'); const yt = st.find((s) => s.platform === 'youtube');
    expect(ig.likes).toBeNull(); expect(ig.likes_hidden).toBe(true); expect(Number(ig.comments)).toBe(212);
    expect(yt.comments).toBeNull(); expect(yt.comments_off).toBe(true); expect(Number(yt.likes)).toBe(880);
    const c = (await w12.read(w, 'brand')).body.data.content;
    expect(proofOf(c, 'reel').stats).toMatchObject({ state: 'ok', views: 48200, likes: null, likesHidden: true, comments: 212 });
    expect(proofOf(c, 'youtube_short').stats).toMatchObject({ state: 'ok', comments: null, commentsOff: true, likes: 880 });
    // the real probe item: hidden likes on the reel DbnfYVVv8f-, 847,937 plays, 703 comments
    const reading = postStats.readingOf('instagram', IG_REEL);
    expect(reading).toMatchObject({ result: 'ok', likes: null, likesHidden: true, views: 847937, comments: 703, kind: 'reel' });
  });

  it('E21 · another account owns the post → numbers kept, owner_state other_account, ONE flag across two reads; a co-author counts as her', async () => {
    const w = await contentApproved();
    IG.C9xK2abc = igItem('C9xK2abc', { ownerUsername: 'someone_else' });
    await contentPosted(w);
    await postStats.runDue();
    let ig = (await stats(w)).find((s) => s.platform === 'instagram');
    expect(ig).toMatchObject({ owner_state: 'other_account', owner_handle: 'someone_else' });
    expect(Number(ig.views)).toBe(48200);
    let flags = await all(`SELECT * FROM social_admin_flags WHERE kind = 'owner_mismatch'`);
    expect(flags).toHaveLength(1);
    expect(flags[0].detail).toMatchObject({ ciId: w.ciId, rowKey: 'reel', slot: 1, expected: 'priya.style', found: 'someone_else', platform: 'instagram', url: REEL });
    expect(flags[0].account_id).toBeTruthy();
    const b = (await w12.read(w, 'brand')).body.data.content;
    expect(proofOf(b, 'reel').stats).toMatchObject({ state: 'other_account', ownerState: 'other_account', ownerHandle: 'someone_else', views: 48200 });
    const c = (await w12.read(w, 'creator')).body.data.content;
    expect(proofOf(c, 'reel').stats).toMatchObject({ state: 'other_account', ownerHandle: 'someone_else' });
    // a second read raises no second flag while the first is unresolved
    await query(`UPDATE proof_stats SET next_due_at = now() - interval '1 minute'`);
    await postStats.runDue();
    flags = await all(`SELECT * FROM social_admin_flags WHERE kind = 'owner_mismatch'`);
    expect(flags).toHaveLength(1);
    // the admin's flags list shows it with the creator and the platform
    const fl = await api.get('/admin/social/flags', admin.token);
    expect(fl.body.data.flags.find((f) => f.kind === 'owner_mismatch')).toMatchObject({ platform: 'instagram', handle_norm: 'priya.style' });
    // a collaborative post owned by another account, with her among the co-authors, is hers (the probe's Dc1GyQhhwFF)
    const acc = { handle_norm: '_akshayareddyyy' };
    expect(postStats.ownerState('instagram', IG_PHOTO, acc)).toBe('match');
    expect(postStats.ownerState('instagram', IG_PHOTO, { handle_norm: 'priya.style' })).toBe('other_account');
    // YouTube: the channel id or the handle
    expect(postStats.ownerState('youtube', YT_SHORT, { handle_norm: 'lakkireddyakshayareddy-30', channel_url: 'https://www.youtube.com/@LakkireddyAkshayaReddy-30', platform_account_id: null })).toBe('match');
    expect(postStats.ownerState('youtube', YT_SHORT, { handle_norm: 'other', channel_url: null, platform_account_id: 'UCLbs1qmAgK6p6_jIgj0gSlg' })).toBe('match');
    expect(postStats.ownerState('youtube', YT_SHORT, { handle_norm: 'other', channel_url: 'https://www.youtube.com/@other', platform_account_id: 'UCzzz' })).toBe('other_account');
    // after the first read, a match on the next read clears the state
    ig = (await stats(w)).find((s) => s.platform === 'instagram');
    expect(ig.owner_state).toBe('other_account');
  });

  it('E22 · no confirmed account on that platform → owner_unknown, no flag, numbers shown', async () => {
    const w = await contentApproved();
    await query(`DELETE FROM creator_social_accounts WHERE influencer_id = $1 AND platform = 'youtube'`, [w.cr.influencerId]);
    await query(`UPDATE creator_social_accounts SET ownership = 'pending' WHERE influencer_id = $1`, [w.cr.influencerId]);
    await contentPosted(w);
    await postStats.runDue();
    const st = await stats(w);
    expect(st.map((s) => s.owner_state)).toEqual(['owner_unknown', 'owner_unknown']);
    expect(await count(`SELECT 1 FROM social_admin_flags WHERE kind = 'owner_mismatch'`)).toBe(0);
    const c = (await w12.read(w, 'brand')).body.data.content;
    expect(proofOf(c, 'reel').stats).toMatchObject({ state: 'ok', ownerState: 'owner_unknown', views: 48200 });
  });
});

/* ───────────────────────────────────────────── the legacy, the token, the migration (E25–E27) */

describe('the legacy is retired (E25, E26) and migration 210 is additive (E27)', () => {
  it('E25 · refresh-stats answers 404; jobs/index.js exports no apifyEngagementJob; apify.service exports no scrapePostEngagement; the engagement mock is gone', async () => {
    const w = await F.world({ shootDone: false });
    const r = await api.post('/deliverables/00000000-0000-0000-0000-000000000000/refresh-stats', w.b.token, {});
    expect(r.status).toBe(404);
    const jobs = require('../src/jobs');
    expect(jobs.apifyEngagementJob).toBeUndefined();
    expect(typeof jobs.postStatsJob.run).toBe('function');
    expect(fs.existsSync(path.join(__dirname, '../src/jobs/apify-engagement.job.js'))).toBe(false);
    const apifyService = require('../src/services/apify.service');
    expect(apifyService.scrapePostEngagement).toBeUndefined();
    expect(typeof apifyService.scrapeProfile).toBe('function');
    expect(fs.existsSync(path.join(__dirname, '../mocks/apify_engagement.json'))).toBe(false);
    const idx = fs.readFileSync(path.join(__dirname, '../src/jobs/index.js'), 'utf8');
    expect(idx).not.toMatch(/require\('\.\/apify-engagement|apifyEngagementJob/);
    expect(idx).toMatch(/cron\.schedule\('10 6 \* \* \*', \(\) => postStatsJob\.run\(\), \{ timezone: tz \}\)/);
    // a brand's campaign with only pre-item-12 deliverables: empty links, zero tiles, no error (C9)
    const e = await api.get(`/brands/me/campaigns/${w.c.id}/engagement`, w.b.token);
    expect(e.status).toBe(200);
    expect(e.body.data.totals).toMatchObject({ views: 0, likes: 0, comments: 0, links: 0, linksRead: 0, waiting: 0, updatedAt: null });
    expect(e.body.data.links).toEqual([]);
  });

  it('E26 · no Apify URL anywhere in backend/src carries token=', () => {
    const src = path.join(__dirname, '../src');
    const files = [];
    const walk = (d) => { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) walk(p); else if (p.endsWith('.js')) files.push(p); } };
    walk(src);
    const hits = files.filter((f) => /apify\.com[^\n]*[?&]token=|[?&]token=\$\{token\}/.test(fs.readFileSync(f, 'utf8')));
    expect(hits).toEqual([]);
    // and both older sync helpers now send the token in the Authorization header
    for (const f of ['services/apify.service.js', 'services/youtube.service.js']) {
      expect(fs.readFileSync(path.join(src, f), 'utf8')).toMatch(/Authorization: `Bearer \$\{token\}`/);
    }
  });

  it('E27 · migration 210 is additive: the new tables and the widened CHECK exist; a second run changes nothing; the dry-run script counts', async () => {
    const tables = await all(`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('post_stat_runs','proof_stats','proof_stat_reads') ORDER BY 1`);
    expect(tables.map((t) => t.table_name)).toEqual(['post_stat_runs', 'proof_stat_reads', 'proof_stats']);
    const chk = await one(`SELECT pg_get_constraintdef(oid) AS d FROM pg_constraint WHERE conname = 'social_admin_flags_kind_check'`);
    expect(chk.d).toMatch(/owner_mismatch/);
    expect(chk.d).toMatch(/failing_3/);
    const before = await one(`SELECT (SELECT count(*) FROM content_proofs)::int AS a, (SELECT count(*) FROM collab_content)::int AS b, (SELECT count(*) FROM deliverable_stats)::int AS c`);
    await query(fs.readFileSync(path.join(__dirname, '../migrations/210_post_performance_v2.sql'), 'utf8'));
    const after = await one(`SELECT (SELECT count(*) FROM content_proofs)::int AS a, (SELECT count(*) FROM collab_content)::int AS b, (SELECT count(*) FROM deliverable_stats)::int AS c`);
    expect(after).toEqual(before);
    const script = fs.readFileSync(path.join(__dirname, '../scripts/run-210.js'), 'utf8');
    for (const t of ['content_proofs', 'collab_content', 'deliverable_stats']) expect(script).toMatch(new RegExp(`count\\(\\*\\)::int AS n FROM ${t}`));
    expect(script).toMatch(/--dry/); expect(script).toMatch(/--apply/);
  });
});

/* ───────────────────────────────────────────── data assertions, and no money */

describe('data assertions — every reading has its run; no money moves', () => {
  it('reads = apify readings per link; every apify reading has a run with an Apify run id; level1 readings have none; the month\'s cost is the sum of the runs; no money row changes', async () => {
    const w = await contentApproved();
    const acc = await one(`SELECT id FROM creator_social_accounts WHERE influencer_id = $1 AND platform = 'instagram'`, [w.cr.influencerId]);
    await query(
      `INSERT INTO creator_social_posts (account_id, platform_post_id, kind, published_at, likes, comments, views, url, owner_handle)
       VALUES ($1, '1', 'reel', now() - interval '15 days', 2900, 140, 31200, 'https://www.instagram.com/p/C9xK2abc/', 'priya.style')`, [acc.id]);
    const money = () => one(`SELECT (SELECT count(*) FROM escrow_entries)::int AS e, (SELECT coalesce(sum(amount),0) FROM escrow_entries) AS ea,
      (SELECT count(*) FROM wallet_transactions)::int AS w, (SELECT count(*) FROM follower_transactions)::int AS f`);
    const m0 = await money();
    await contentPosted(w);
    await postStats.runDue();
    await brandRefresh(w);
    const rows = await all(
      `SELECT ps.id, ps.reads, (SELECT count(*) FROM proof_stat_reads r WHERE r.stat_id = ps.id AND r.source = 'apify')::int AS apify_reads,
              (SELECT count(*) FROM proof_stat_reads r WHERE r.stat_id = ps.id AND r.source = 'level1')::int AS seeds
         FROM proof_stats ps`);
    expect(rows.every((r) => r.reads === r.apify_reads)).toBe(true);
    expect(rows.reduce((n, r) => n + r.seeds, 0)).toBe(1);
    const bad = await count(`SELECT 1 FROM proof_stat_reads r LEFT JOIN post_stat_runs run ON run.id = r.run_id WHERE r.source = 'apify' AND (run.id IS NULL OR run.apify_run_id IS NULL)`);
    expect(bad).toBe(0);
    expect(await count(`SELECT 1 FROM proof_stat_reads WHERE source = 'level1' AND run_id IS NOT NULL`)).toBe(0);
    const sum = await one(`SELECT sum(usage_usd)::float AS usd FROM post_stat_runs WHERE date_trunc('month', started_at) = date_trunc('month', now())`);
    expect(Math.round(sum.usd * 10000) / 10000).toBe(Math.round(2 * (0.0027 + 0.004) * 10000) / 10000);
    // nothing in proof_stats for a Story, a Facebook link, or an unposted package row
    expect(await count(`SELECT 1 FROM proof_stats ps JOIN content_proofs cp ON cp.content_id = ps.content_id AND cp.row_key = ps.row_key AND cp.slot = ps.slot WHERE cp.url IS NULL`)).toBe(0);
    expect(await count(`SELECT 1 FROM proof_stats ps JOIN collab_content cc ON cc.id = ps.content_id LEFT JOIN content_social_rows sr ON sr.content_id = ps.content_id AND sr.row_key = ps.row_key WHERE cc.posted_at IS NULL AND NOT COALESCE(sr.outside, false)`)).toBe(0);
    expect(await money()).toEqual(m0);
  });
});
