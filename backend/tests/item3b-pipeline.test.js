'use strict';

/**
 * Item 3b — the pipeline end to end against the real database with Apify mocked from the
 * probe fixtures: registration (queues nothing), approval (first full run), the numbers
 * and the write-through, handle change/add/remove with the admin check, check again, the
 * brand-facing states, the scheduler, retries and flags, the budget guard, YouTube-only.
 * Contract: features/item3b-social-numbers · prompt §8.1
 */

const { truncateAll } = require('./helpers/db');
const { query, brand, creator, api, resetReference } = require('./helpers/item3');
const { createAdminUser, createInfluencerUser, registerInfluencer } = require('./helpers/factories');
const apify = require('../src/services/apifyRuns.service');
const accounts = require('../src/services/socialAccounts.service');
const measure = require('../src/services/socialMeasure.service');
const env = require('../src/config/env');

const IG = '_akshayareddyyy', YT = '@lakkireddyakshayareddy-30';
beforeEach(async () => { await truncateAll(); await resetReference(); apify.setMockResolver(null); apify.setMockUsage(0); });

const acc = (influencerId, platform) => accounts.current(influencerId, platform);
const legacy = async (id) => (await query(`SELECT followers_count, engagement_rate, scrape_last_run, youtube_subscribers, youtube_scrape_last_run FROM influencers WHERE id = $1`, [id])).rows[0];
const approveViaSql = async (c) => { await query(`UPDATE users SET status='approved' WHERE id=$1`, [c.userId]); return accounts.onCreatorApproved(c.influencerId, null); };

/** Register through the API (pending), like the app does. */
async function pendingCreator(handles) {
  const { token, user } = await createInfluencerUser();
  // registration-and-profile §2.1: state and city are required at registration; §6: approval
  // refuses an incomplete profile, so the rest of the checklist is filled the way she would.
  const body = { name: 'Akshaya Reddy', state: 'Telangana', city: 'Hyderabad', ...handles };
  const r = await api.post('/influencers/register', token, body);
  if (r.status !== 201) throw new Error(`register: ${JSON.stringify(r.body)}`);
  await require('./helpers/factories').completeCreatorProfile(r.body.data.influencer.id);
  return { token, userId: user.id, influencerId: r.body.data.influencer.id, res: r };
}

describe('A6 — registration', () => {
  it('needs at least one account, checks formats with the exact messages, saves normalised, measures nothing (check 1, 27)', async () => {
    const { token } = await createInfluencerUser();
    let r = await api.post('/influencers/register', token, { name: 'X' });
    expect(r.status).toBe(422); expect(r.body.error.message).toBe('Add at least one account.');
    r = await api.post('/influencers/register', token, { name: 'X', instagram_handle: 'priya styles!' });
    expect(r.status).toBe(422); expect(r.body.error.message).toBe('Enter a valid Instagram username.'); expect(r.body.error.field).toBe('instagram_handle');
    r = await api.post('/influencers/register', token, { name: 'X', youtube_handle: 'priya styles' });
    expect(r.status).toBe(422); expect(r.body.error.message).toBe('Enter a YouTube handle or channel link.');
    r = await api.post('/influencers/register', token, { name: 'X', state: 'Telangana', city: 'Hyderabad', instagram_handle: `https://www.instagram.com/${IG}/`, youtube_handle: `https://www.youtube.com/${YT}` });
    expect(r.status).toBe(201);
    const inf = r.body.data.influencer;
    expect(inf.instagram_handle).toBe(IG); expect(inf.youtube_handle).toBe(YT.slice(1));
    expect(inf.followers_count == null && inf.engagement_rate == null && inf.scrape_last_run == null).toBe(true);
    const ig = await acc(inf.id, 'instagram'), yt = await acc(inf.id, 'youtube');
    expect(ig).toMatchObject({ state: 'waiting_approval', ownership: 'pending', handle_norm: IG });
    expect(yt).toMatchObject({ state: 'waiting_approval', ownership: 'pending', handle_norm: YT.slice(1) });
    expect((await query(`SELECT count(*)::int n FROM creator_social_runs`)).rows[0].n).toBe(0);
    expect(r.body.data.claim.scrape_fired).toBe(false);
  });

  it('a YouTube-only creator registers and gets a claimed creator_profiles row without an Instagram handle (Q3)', async () => {
    const c = await pendingCreator({ youtube_handle: YT });
    const { rows } = await query(`SELECT ig_handle, youtube_handle, verification_status FROM creator_profiles WHERE linked_influencer_id = $1`, [c.influencerId]);
    expect(rows[0]).toEqual({ ig_handle: null, youtube_handle: YT.slice(1), verification_status: 'claimed' });
    expect(await acc(c.influencerId, 'instagram')).toBeNull();
    expect((await acc(c.influencerId, 'youtube')).state).toBe('waiting_approval');
  });
});

describe('approval → first full run → numbers (checks 2, 3, 4, 5, 14)', () => {
  it('admin approval confirms ownership and queues; the run stores snapshot, posts, metrics, and writes through', async () => {
    const c = await pendingCreator({ instagram_handle: IG, youtube_handle: YT });
    const admin = await createAdminUser('superadmin');
    const { rows: [cp] } = await query(`SELECT id FROM creator_profiles WHERE linked_influencer_id = $1`, [c.influencerId]);
    const v = await api.post(`/admin/creator-verifications/${cp.id}/verify`, admin.token);
    expect(v.status).toBe(200);
    let ig = await acc(c.influencerId, 'instagram');
    expect(ig).toMatchObject({ state: 'measuring', ownership: 'confirmed' });
    expect(new Date(ig.profile_due_at).getTime()).toBeLessThanOrEqual(Date.now());
    // Under test nothing runs by itself; the scheduler tick does what approval would kick.
    const out = await measure.tick({ trigger: 'schedule' });
    expect(out.ran).toBe(2);
    expect(out.results.every(r => r.result === 'success')).toBe(true);

    ig = await acc(c.influencerId, 'instagram');
    const yt = await acc(c.influencerId, 'youtube');
    expect(ig.state).toBe('ok'); expect(yt.state).toBe('ok');
    expect(ig.last_profile_at && ig.last_posts_at && ig.profile_due_at && ig.posts_due_at).toBeTruthy();
    expect(Math.round((new Date(ig.profile_due_at) - new Date(ig.last_profile_at)) / 86400000)).toBe(7);
    expect(Math.round((new Date(ig.posts_due_at) - new Date(ig.last_posts_at)) / 86400000)).toBe(15);

    const snap = await accounts.latestSnapshot(ig.id);
    expect(snap).toMatchObject({ followers: '192011', verified: true });
    const posts = (await query(`SELECT count(*)::int n FROM creator_social_posts WHERE account_id = $1`, [ig.id])).rows[0].n;
    expect(posts).toBe(10);                                              // the trimmed fixture
    const m = await accounts.currentMetrics(ig.id);
    expect(m.ig_hidden_likes_count).toBe(2);
    const ym = await accounts.currentMetrics(yt.id);
    expect(ym).toMatchObject({ yt_long_count: 3, yt_short_count: 4, yt_uploads_90d: 7 });
    expect(Number(ym.yt_long_engagement)).toBeGreaterThan(0);

    const L = await legacy(c.influencerId);
    expect(Number(L.followers_count)).toBe(192011);
    expect(L.engagement_rate == null || Number(L.engagement_rate) >= 0).toBe(true);
    expect(Number(L.youtube_subscribers)).toBe(52000);
    expect(L.scrape_last_run && L.youtube_scrape_last_run).toBeTruthy();
    const runs = (await query(`SELECT result, run_type, trigger, apify_run_id FROM creator_social_runs ORDER BY started_at`)).rows;
    expect(runs).toHaveLength(2); expect(runs.every(r => r.result === 'success' && r.run_type === 'full' && r.apify_run_id)).toBe(true);
  });

  it('a pending creator is never measured; the scheduler ignores her', async () => {
    const c = await pendingCreator({ instagram_handle: IG });
    const out = await measure.tick({});
    expect(out.ran).toBe(0);
    expect((await acc(c.influencerId, 'instagram')).state).toBe('waiting_approval');
    expect((await legacy(c.influencerId)).followers_count).toBeNull();
  });

  it('YouTube-only: approved, measured, in Discover with Engagement "—" (check 28)', async () => {
    const c = await pendingCreator({ youtube_handle: YT });
    await approveViaSql(c);
    const out = await measure.tick({});
    expect(out.ran).toBe(1);
    const b = await brand();
    const r = await api.get('/brands/me/discover-creators?openOnly=0', b.token);
    const row = r.body.data.rows.find(x => x.id === c.influencerId);
    expect(row).toBeTruthy();
    expect(row.instagram).toBeNull(); expect(row.engagement).toBeNull(); expect(row.youtube).toBe(52000);
    const p = await api.get(`/influencers/${c.influencerId}`, b.token);
    expect(p.body.data.social.instagram).toBeNull();
    expect(p.body.data.social.youtube).toMatchObject({ state: 'ok', subscribers: 52000, uploads90d: 7 });
  });
});

describe('what a brand sees (A1, A2, check 10, 15, 19)', () => {
  async function measured() {
    const c = await pendingCreator({ instagram_handle: IG, youtube_handle: YT });
    await approveViaSql(c); await measure.tick({});
    return c;
  }
  it('S1 cards carry the three numbers per platform and the coarse state; S2/S3 detail carries every §3.6 number and no internal words', async () => {
    const c = await measured(); const b = await brand();
    const p = await api.get(`/influencers/${c.influencerId}`, b.token);
    expect(p.body.data.social.instagram).toMatchObject({ state: 'ok', handle: IG, verified: true, followers: 192011, posts90d: 10 });
    expect(p.body.data.social.youtube).toMatchObject({ state: 'ok', uploads90d: 7, subscribers: 52000 });
    const d = await api.get(`/influencers/${c.influencerId}/social/instagram`, b.token);
    expect(d.status).toBe(200);
    expect(d.body.data.account.numbers).toMatchObject({ followers: 192011, following: 327, totalPosts: 238, posts90d: 10, hiddenLikesCount: 2 });
    expect(d.body.data.account.window.start && d.body.data.account.window.end).toBeTruthy();
    const y = await api.get(`/influencers/${c.influencerId}/social/youtube`, b.token);
    expect(y.body.data.account.numbers.long.count).toBe(3); expect(y.body.data.account.numbers.short.count).toBe(4);
    expect(JSON.stringify(p.body) + JSON.stringify(d.body) + JSON.stringify(y.body)).not.toMatch(/waiting_check|measuring|not_found|"private"|rejected|failing|lastError|usage_usd|ownership|apify_run/);
  });

  it('updating / unavailable / stale mapping; a pending creator stays 404 to brands', async () => {
    const c = await measured(); const b = await brand();
    const ig = await acc(c.influencerId, 'instagram');
    for (const [internal, brandState] of [['waiting_check', 'updating'], ['measuring', 'updating'], ['not_found', 'unavailable'], ['private', 'unavailable'], ['rejected', 'unavailable'], ['failing', 'stale']]) {
      await query(`UPDATE creator_social_accounts SET state = $2 WHERE id = $1`, [ig.id, internal]);
      const p = await api.get(`/influencers/${c.influencerId}`, b.token);
      expect(p.body.data.social.instagram.state).toBe(brandState);
      if (brandState === 'stale') expect(p.body.data.social.instagram.followers).toBe(192011);
      else expect(p.body.data.social.instagram.followers).toBeUndefined();
    }
    const pend = await pendingCreator({ instagram_handle: 'someone_else' });
    expect((await api.get(`/influencers/${pend.influencerId}/social/instagram`, b.token)).status).toBe(404);
  });
});

describe('handle change · add · remove (A5, R6, checks 12, 13, 14)', () => {
  it('after approval: change clears the numbers, waits for admin; confirm re-measures; reject shows rejected', async () => {
    const c = await pendingCreator({ instagram_handle: IG, youtube_handle: YT });
    await approveViaSql(c); await measure.tick({});
    expect(Number((await legacy(c.influencerId)).youtube_subscribers)).toBe(52000);
    const r = await api.patch('/influencers/me', c.token, { youtube_handle: '@someothername' });
    expect(r.status).toBe(200);
    expect(r.body.data.social.changed).toEqual([{ platform: 'youtube', action: 'change' }]);
    let yt = await acc(c.influencerId, 'youtube');
    expect(yt).toMatchObject({ state: 'waiting_check', ownership: 'pending', handle_norm: 'someothername' });
    expect((await legacy(c.influencerId)).youtube_subscribers).toBeNull();
    expect((await legacy(c.influencerId)).youtube_scrape_last_run).toBeNull();
    expect(Number((await legacy(c.influencerId)).followers_count)).toBe(192011);   // Instagram untouched
    const old = (await query(`SELECT * FROM creator_social_accounts WHERE influencer_id = $1 AND platform = 'youtube' AND replaced_at IS NOT NULL`, [c.influencerId])).rows;
    expect(old).toHaveLength(1); expect(old[0].replaced_by).toBe(yt.id);
    // Brand sees "updating"; creator sees waiting_check and the Waiting chip.
    const b = await brand();
    expect((await api.get(`/influencers/${c.influencerId}`, b.token)).body.data.social.youtube.state).toBe('updating');
    const mine = await api.get('/influencers/me/social', c.token);
    expect(mine.body.data.youtube.state).toBe('waiting_check'); expect(mine.body.data.chip).toBe('waiting');
    // Admin queue → confirm.
    const admin = await createAdminUser('superadmin');
    const q = await api.get('/admin/social/handle-checks', admin.token);
    expect(q.body.data.checks.map(x => x.id)).toEqual([yt.id]);
    expect(q.body.data.checks[0].old_handle).toBe(YT.slice(1));
    const cf = await api.post(`/admin/social/accounts/${yt.id}/confirm`, admin.token);
    expect(cf.status).toBe(200); expect(cf.body.data.account.state).toBe('measuring');
    // Change it back the same way → waiting_check again; reject this time.
    await measure.tick({});
    const back = await api.patch('/influencers/me', c.token, { youtube_handle: YT });
    expect(back.body.data.social.changed[0].action).toBe('change');
    yt = await acc(c.influencerId, 'youtube');
    const rj = await api.post(`/admin/social/accounts/${yt.id}/reject`, admin.token, { reason: 'not hers' });
    expect(rj.status).toBe(200); expect(rj.body.data.account.state).toBe('rejected');
    const mine2 = await api.get('/influencers/me/social', c.token);
    expect(mine2.body.data.youtube.state).toBe('rejected'); expect(mine2.body.data.chip).toBe('fix_youtube');
    expect((await api.get(`/influencers/${c.influencerId}`, b.token)).body.data.social.youtube.state).toBe('unavailable');
  });

  it('same handle re-entered → nothing happens; add after approval → waiting_check; remove → not added; last handle cannot go', async () => {
    const c = await pendingCreator({ instagram_handle: IG });
    await approveViaSql(c); await measure.tick({});
    let r = await api.patch('/influencers/me', c.token, { instagram_handle: `@${IG}` });
    expect(r.body.data.social.changed).toEqual([]);
    r = await api.patch('/influencers/me', c.token, { youtube_handle: YT });
    expect(r.body.data.social.changed).toEqual([{ platform: 'youtube', action: 'add' }]);
    expect((await acc(c.influencerId, 'youtube')).state).toBe('waiting_check');
    r = await api.patch('/influencers/me', c.token, { youtube_handle: null });
    expect(r.body.data.social.changed).toEqual([{ platform: 'youtube', action: 'remove' }]);
    expect(await acc(c.influencerId, 'youtube')).toBeNull();
    r = await api.patch('/influencers/me', c.token, { instagram_handle: '' });
    expect(r.status).toBe(422); expect(r.body.error.message).toBe('Keep at least one account.');
    expect((await acc(c.influencerId, 'instagram')).state).toBe('ok');
  });

  it('before approval a handle edit just saves — no admin check', async () => {
    const c = await pendingCreator({ instagram_handle: IG });
    const r = await api.patch('/influencers/me', c.token, { instagram_handle: 'newname_1' });
    expect(r.status).toBe(200);
    expect((await acc(c.influencerId, 'instagram'))).toMatchObject({ state: 'waiting_approval', handle_norm: 'newname_1' });
    expect((await api.get('/admin/social/handle-checks', (await createAdminUser('superadmin')).token)).body.data.checks).toEqual([]);
  });
});

describe('run outcomes, retries, flags, budget (checks 9, 20, 21, 26)', () => {
  async function approved(handles = { instagram_handle: IG }) { const c = await pendingCreator(handles); await approveViaSql(c); return c; }

  it('not found → not_found, columns cleared, creator copy state; private → private; check again only there and once a day (A4)', async () => {
    const c = await approved({ instagram_handle: 'nobody_here_123' });
    await measure.tick({});
    const ig = await acc(c.influencerId, 'instagram');
    expect(ig.state).toBe('not_found');
    expect((await legacy(c.influencerId)).followers_count).toBeNull();
    let r = await api.post('/influencers/me/social/instagram/check-again', c.token);
    expect(r.status).toBe(409);
    await query(`UPDATE creator_social_accounts SET state = 'private' WHERE id = $1`, [ig.id]);
    r = await api.post('/influencers/me/social/instagram/check-again', c.token);
    expect(r.status).toBe(200);
    r = await api.post('/influencers/me/social/instagram/check-again', c.token);
    expect(r.status).toBe(429); expect(r.body.error.message).toBe('You can check again once a day.');
    const mine = await api.get('/influencers/me/social', c.token);
    expect(mine.body.data.instagram.checkAgainAvailableAt).toBeTruthy(); expect(mine.body.data.chip).toBe('fix_instagram');
  });

  it('technical failure with good numbers → failing (stale to brands, numbers kept), retry next day, admin flagged after 3; success resets', async () => {
    const c = await approved();
    await measure.tick({});
    apify.setMockResolver(() => ({ __fail: 'network down' }));
    let ig = await acc(c.influencerId, 'instagram');
    for (let i = 1; i <= 3; i += 1) {
      await query(`UPDATE creator_social_accounts SET retry_at = NULL, profile_due_at = now() - interval '1 hour' WHERE id = $1`, [ig.id]);
      const out = await measure.tick({});
      expect(out.ran).toBe(1); expect(out.results[0].result).toBe('technical_failure');
      ig = await acc(c.influencerId, 'instagram');
      expect(ig.state).toBe('failing'); expect(ig.failure_count).toBe(i);
      expect(new Date(ig.retry_at).getTime()).toBeGreaterThan(Date.now() + 20 * 3600000);
    }
    expect(Number((await legacy(c.influencerId)).followers_count)).toBe(192011);      // last good numbers stay
    const b = await brand();
    expect((await api.get(`/influencers/${c.influencerId}`, b.token)).body.data.social.instagram).toMatchObject({ state: 'stale', followers: 192011 });
    const flags = (await query(`SELECT kind FROM social_admin_flags WHERE resolved_at IS NULL`)).rows.map(f => f.kind);
    expect(flags).toEqual(['failing_3']);
    apify.setMockResolver(null);
    await query(`UPDATE creator_social_accounts SET retry_at = now() - interval '1 minute' WHERE id = $1`, [ig.id]);
    const out = await measure.tick({});
    expect(out.results[0].result).toBe('success');
    ig = await acc(c.influencerId, 'instagram');
    expect(ig.state).toBe('ok'); expect(ig.failure_count).toBe(0); expect(ig.retry_at).toBeNull();
  });

  it('technical failure with no good numbers yet → stays measuring', async () => {
    const c = await approved();
    apify.setMockResolver(() => ({ __fail: 'boom' }));
    await measure.tick({});
    const ig = await acc(c.influencerId, 'instagram');
    expect(ig.state).toBe('measuring'); expect(ig.failure_count).toBe(1);
  });

  it('an Apify credit refusal is `budget`: no failure count, no failing, retried later (check 26)', async () => {
    const c = await approved();
    await measure.tick({});
    apify.setMockResolver(() => ({ __refuse: true }));
    let ig = await acc(c.influencerId, 'instagram');
    await query(`UPDATE creator_social_accounts SET profile_due_at = now() - interval '1 hour' WHERE id = $1`, [ig.id]);
    const out = await measure.tick({});
    expect(out.results[0].result).toBe('budget');
    ig = await acc(c.influencerId, 'instagram');
    expect(ig.state).toBe('ok'); expect(ig.failure_count).toBe(0); expect(ig.retry_at).toBeTruthy();
    const run = (await query(`SELECT result FROM creator_social_runs ORDER BY started_at DESC LIMIT 1`)).rows[0];
    expect(run.result).toBe('budget');
  });

  it('budget guard: scheduled runs stop at the monthly budget and admin is flagged once; approval/confirm/measure-now still go (check 20)', async () => {
    const c = await approved();
    apify.setMockUsage(env.APIFY_MONTHLY_BUDGET_USD);
    let out = await measure.tick({ trigger: 'schedule' });
    expect(out.ran).toBe(0); expect(out.skipped).toBe('budget');
    out = await measure.tick({ trigger: 'schedule' });
    expect((await query(`SELECT count(*)::int n FROM social_admin_flags WHERE kind = 'budget'`)).rows[0].n).toBe(1);
    const ig = await acc(c.influencerId, 'instagram');
    const r = await measure.runAccount(ig.id, 'full', 'approval');
    expect(r.result).toBe('success');
    const admin = await createAdminUser('superadmin');
    const mn = await api.post(`/admin/social/accounts/${ig.id}/measure-now?wait=1`, admin.token);
    expect(mn.status).toBe(200); expect(mn.body.data.result).toBe('success');
  });

  it('safety ceiling: a run that returns the ceiling flags admin (check 21)', async () => {
    const c = await approved();
    const items = apify.loadFixture('instagram-posts.json');
    apify.setMockResolver((actor, input) => (/post-scraper/.test(actor)
      ? Array.from({ length: env.SOCIAL_CEILING }, (_, i) => ({ ...items[i % items.length], id: `x${i}` }))
      : apify.defaultMock(actor, input)));
    await measure.tick({});
    const flags = (await query(`SELECT kind, detail FROM social_admin_flags`)).rows;
    expect(flags.map(f => f.kind)).toContain('ceiling');
    const run = (await query(`SELECT ceiling_hit, items_received FROM creator_social_runs ORDER BY started_at DESC LIMIT 1`)).rows[0];
    expect(run.ceiling_hit).toBe(true);
  });

  it('scheduler: profile due → profile run; posts due → posts run; both → full; no double run when two ticks race; suspended creator paused', async () => {
    const c = await approved();
    await measure.tick({});
    let ig = await acc(c.influencerId, 'instagram');
    await query(`UPDATE creator_social_accounts SET profile_due_at = now() - interval '1 minute' WHERE id = $1`, [ig.id]);
    let out = await measure.tick({});
    expect((await query(`SELECT run_type FROM creator_social_runs ORDER BY started_at DESC LIMIT 1`)).rows[0].run_type).toBe('profile');
    await query(`UPDATE creator_social_accounts SET posts_due_at = now() - interval '1 minute' WHERE id = $1`, [ig.id]);
    await measure.tick({});
    expect((await query(`SELECT run_type FROM creator_social_runs ORDER BY started_at DESC LIMIT 1`)).rows[0].run_type).toBe('posts');
    await query(`UPDATE creator_social_accounts SET posts_due_at = now() - interval '1 minute', profile_due_at = now() - interval '1 minute' WHERE id = $1`, [ig.id]);
    const [a, b] = await Promise.all([measure.tick({}), measure.tick({})]);
    expect(a.ran + b.ran).toBe(1);
    expect((await query(`SELECT run_type FROM creator_social_runs ORDER BY started_at DESC LIMIT 1`)).rows[0].run_type).toBe('full');
    await query(`UPDATE users SET status = 'suspended' WHERE id = $1`, [c.userId]);
    await query(`UPDATE creator_social_accounts SET profile_due_at = now() - interval '1 minute' WHERE id = $1`, [ig.id]);
    out = await measure.tick({});
    expect(out.ran).toBe(0);
    await query(`UPDATE users SET status = 'approved' WHERE id = $1`, [c.userId]);
    out = await measure.tick({});
    expect(out.ran).toBe(1);
  });

  it('idempotent: re-running the same posts twice changes nothing; the run log carries the cost; costs endpoint answers', async () => {
    const c = await approved();
    await measure.tick({});
    const ig = await acc(c.influencerId, 'instagram');
    const before = (await query(`SELECT count(*)::int n, max(updated_at) u FROM creator_social_posts WHERE account_id = $1`, [ig.id])).rows[0];
    await measure.runAccount(ig.id, 'posts', 'measure_now');
    const after = (await query(`SELECT count(*)::int n FROM creator_social_posts WHERE account_id = $1`, [ig.id])).rows[0];
    expect(after.n).toBe(before.n);
    const admin = await createAdminUser('superadmin');
    const costs = await api.get('/admin/social/costs', admin.token);
    expect(costs.status).toBe(200); expect(costs.body.data.budgetUsd).toBe(env.APIFY_MONTHLY_BUDGET_USD);
    const panel = await api.get(`/admin/influencers/${c.influencerId}/social`, admin.token);
    expect(panel.body.data.runs.length).toBe(2);
  });

  it('the old paths are gone: nothing outside the pipeline writes the number columns (check 22)', () => {
    const fs = require('fs'); const path = require('path');
    const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
    // Any UPDATE influencers … SET or INSERT INTO influencers … ON CONFLICT … SET that names one of the five columns.
    const re = /(UPDATE\s+influencers\b|INSERT\s+INTO\s+influencers\b)[\s\S]{0,1200}?\b(followers_count|engagement_rate|youtube_subscribers|scrape_last_run|youtube_scrape_last_run)\s*=/;
    const offenders = walk(path.join(__dirname, '../src')).filter(f => f.endsWith('.js') && !/socialAccounts\.service\.js$/.test(f))
      .filter(f => re.test(fs.readFileSync(f, 'utf8')));
    expect(offenders.map(f => path.relative(path.join(__dirname, '..'), f))).toEqual([]);
  });
});
