'use strict';

/**
 * Item 21 — Pay for Content gains shoppable posts; Entire store allocation for every Aim.
 * Contract: features/item21-content-posts · master rules v1.34 §7A, §7B, §12.2, §19, §21, §22, §25
 * Board T1–T5, C1–C5, G1–G8, P1–P5, W1 · checks E1–E26 in 03-expected-outputs.md
 *
 * Real API, real database. The terms go through the item 5 send; the posts through item 13's
 * routes and INFLX's approval; the package through item 12's routes; the money through item 9/12's
 * escrow rows; the sale through item 16's checkout. Nothing is reached by writing state the
 * doors could not produce — except the two production facts this item must keep working for:
 * an old-terms Pay for Content collaboration (E22), and a final-payment date that has passed (E18).
 */

const request = require('supertest');
const app = require('../src/app');
const W = require('./helpers/item17');
const H = require('./helpers/offersV2');
const w10 = require('./helpers/item10');
const w12 = require('./helpers/item12');
const F = require('./helpers/item14');
const contentJobs = require('../src/services/contentJobs.service');
const t3Job = require('../src/jobs/tranche-3-release.job');
const home = require('../src/services/home.service');
const settings = require('../src/services/platformSettings.service');
const { MSG: SELL } = require('../src/services/creatorTerms.service');

const { api, query, day } = W;
const num = (v) => Math.round(Number(v) * 100) / 100;
const err = (r) => (r.body && r.body.error) || {};
const PP = '/influencers/me/shoppable-posts';
const CONTENT = { fee: 8000, deliverables: [{ type: 'reel', count: 2 }, { type: 'story', count: 1 }] };

let admin; let tree;

beforeAll(async () => {
  admin = await W.fresh();
  tree = await H.tree();
  await w12.startServer();
});
afterAll(() => w12.stopServer());
afterEach(async () => {
  await query(`UPDATE platform_settings SET value = 7 WHERE key IN ('final_payment_wait_days', 'content_report_silence_days')`);
  settings._resetCache();
});

/* ───────────────────────────────────────────────────────── fixtures */

/** A brand with two listed products (one in a running 20% offer, one free), its campaign, a set of the given Aim, a creator. */
async function stage({ goal = 'engagement', posting = 12, mode = 'shipment', offer = true } = {}) {
  const b = await H.brand();
  const kurta = await H.prod(b.brandId, tree.shirts, `Kurta ${H.rnd()}`, 1299);
  const shirt = await H.prod(b.brandId, tree.shirts, `Shirt ${H.rnd()}`, 2000);
  const discount = offer ? await H.ready(b.token, { type: 'discount', sub: 'percentage', name: `20% off ${H.rnd()}`, cfg: { pct: 20 }, ids: [shirt], from: day(-2), to: day(60) }) : null;
  const c = await w10.campaign(b);
  const s = await w10.set(b, c.id, { goal, shoot_mode: mode, go_live_date: day(posting) });
  const cr = await H.creator({ name: 'Asha Menon' });
  await query(`UPDATE brands SET wallet_balance = 500000 WHERE id = $1`, [b.brandId]);
  return { b, c, s, cr, brandId: b.brandId, kurta, shirt, discount, url: `/campaigns/${c.id}/sets/${s.id}`, mode, admin };
}
const invite = (w, terms) => api.post(`${w.url}/invitations`, w.b.token, { creators: [{ influencerId: w.cr.influencerId, terms }] });
const ci = (w) => query(`SELECT * FROM campaign_influencers WHERE id = $1`, [w.ciId]).then((r) => r.rows[0]);
const escrow = (w) => query(`SELECT tranche_number AS n, status, release_due_at, release_held_for_posts FROM escrow_entries WHERE campaign_influencer_id = $1 ORDER BY tranche_number`, [w.ciId]).then((r) => r.rows);

/** Invited (accepted), signed by both, the shoot done — Path 2 still locked unless `open`. */
async function signed(w, terms, { shootDone = true, open = false } = {}) {
  const inv = await invite(w, terms);
  if (inv.status !== 201) throw new Error(`invite: ${JSON.stringify(inv.body)}`);
  w.ciId = inv.body.data.rows[0].id;
  const acc = await api.post(`/influencers/me/invitations/${w.ciId}/accept`, w.cr.token);
  if (acc.status >= 300) throw new Error(`accept: ${JSON.stringify(acc.body)}`);
  for (const step of [w10.send, w10.herSign, w10.brandSign]) {
    const r = await step(w); // eslint-disable-line no-await-in-loop
    if (r.status >= 300) throw new Error(`sign: ${JSON.stringify(r.body)}`);
  }
  w.con = await w10.con(w.ciId);
  w.pe = await w10.pe(w.con.id);
  if (shootDone) await w12.markShootDone(w, { openPath2: open });
  return w;
}
const contentTerms = (over = {}) => ({ ...CONTENT, shoppablePosts: 3, productsWithoutOffers: { mode: 'all' }, ...over });
const read = (w, side = 'creator') => F.read(w, side).then((r) => r.body.data.content);
const uploadUrl = (w) => api.post(`${F.C(w)}/files/upload-url`, w.cr.token, { rowKey: 'reel', kind: 'video', mime: 'video/mp4', sizeBytes: 4096, durationS: 28 });

/* ───────────────────────────────────────────────────────── the terms (E1–E9) */

describe('the terms: a Pay for Content invitation carries the posts number and what she posts about (T1, T4, C1; E1–E3)', () => {
  it('E1 · without the posts number it is refused; E2 · with nothing to post about it is refused in her name; 12 is refused', async () => {
    const w = await stage();
    let r = await invite(w, { ...CONTENT, productsWithoutOffers: { mode: 'all' } });
    expect(r.status).toBe(422);
    expect(err(r).field).toBe('shoppable_posts_n');
    expect(err(r).message).toBe(SELL.POSTS_N);
    r = await invite(w, { ...CONTENT, shoppablePosts: 3, offers: [], productsWithoutOffers: { mode: 'none' } });
    expect(r.status).toBe(422);
    expect(err(r).message).toBe(SELL.POST_ABOUT_NOTHING('Asha Menon'));
    r = await invite(w, contentTerms({ shoppablePosts: 12 }));
    expect(r.status).toBe(422);
    expect(err(r).field).toBe('shoppable_posts_n');
    // an app that knows nothing of posts or allocation is told to update, as a selling send is
    r = await invite(w, CONTENT);
    expect(r.status).toBe(422);
    expect(err(r).message).toBe(SELL.OLD_TERMS);
  });

  it('E3 · stored and shown: n=3, all products without offers frozen, no commission; the creator reads both rows (C1)', async () => {
    const w = await stage();
    const r = await invite(w, contentTerms({ offers: [w.discount] }));
    expect(r.status).toBe(201);
    w.ciId = r.body.data.rows[0].id;
    const row = await ci(w);
    expect(row).toMatchObject({ sell_v2: true, sell_mode: 'all', shoppable_posts_n: 3, commission_pct: null, min_shoppable_posts: null });
    expect(row.sell_product_ids).toEqual([w.kurta]);                 // the shirt is in the offer, so it comes through the offer
    const inv = (await api.get(`/influencers/me/invitations/${w.ciId}`, w.cr.token)).body.data.invitation;
    expect(inv.terms).toMatchObject({ shoppablePostsN: 3, shoppablePostsMin: null, fee: 8000, commissionPct: null });
    expect(inv.terms.sell.words).toBe('1 offer + 1 product');
    // what she posts about, read-only, says there is no commission
    const sell = (await api.get(`/influencers/me/invitations/${w.ciId}/sell`, w.cr.token)).body.data;
    expect(sell).toMatchObject({ no_commission: true, store: false, commission_pct: null });
    expect(sell.offers.map((o) => o.id)).toEqual([w.discount]);
  });
});

describe('the Entire store (T2, T3, C4; E4, E5, E10–E12)', () => {
  it('E4 · on Pay for Sale: a rule, not a list — no linked offers, no frozen products; the agreement says so (E8 unchanged beside it)', async () => {
    const w = await stage({ goal: 'conversion' });
    const r = await invite(w, { commissionPct: 10, productsWithoutOffers: { mode: 'store' } });
    expect(r.status).toBe(201);
    w.ciId = r.body.data.rows[0].id;
    const row = await ci(w);
    expect(row).toMatchObject({ sell_v2: true, sell_mode: 'store', sell_product_ids: [], min_shoppable_posts: 1, shoppable_posts_n: null });
    expect((await query(`SELECT count(*)::int AS n FROM collab_offers WHERE campaign_influencer_id = $1`, [w.ciId])).rows[0].n).toBe(0);
    const inv = (await api.get(`/influencers/me/invitations/${w.ciId}`, w.cr.token)).body.data.invitation;
    expect(inv.terms.sell.words).toBe('Entire store · 1 offer + 1 product today');
    const sell = (await api.get(`/influencers/me/invitations/${w.ciId}/sell`, w.cr.token)).body.data;
    expect(sell).toMatchObject({ store: true, no_commission: false });
    expect(sell.offers.map((o) => o.id)).toEqual([w.discount]);
    expect(sell.products.count).toBe(1);
    await api.post(`/influencers/me/invitations/${w.ciId}/accept`, w.cr.token);
    await w10.send(w); await w10.herSign(w); await w10.brandSign(w);
    const con = await w10.con(w.ciId);
    expect(con.terms_json.sell).toMatchObject({ store: true, words: 'Everything in the store, now and later', products_count: 1 });
    expect(con.terms_json.sell.offers).toHaveLength(1);
  });

  it('E5 · a store with no published offer and no product without an offer cannot be given whole', async () => {
    const b = await H.brand();
    const c = await w10.campaign(b);
    const s = await w10.set(b, c.id, { goal: 'conversion', shoot_mode: 'shipment', go_live_date: day(12) });
    const cr = await H.creator({ name: 'Rhea Nair' });
    const r = await api.post(`/campaigns/${c.id}/sets/${s.id}/invitations`, b.token, { creators: [{ influencerId: cr.influencerId, terms: { commissionPct: 10, productsWithoutOffers: { mode: 'store' } } }] });
    expect(r.status).toBe(422);
    expect(err(r).message).toBe(SELL.STORE_EMPTY);
  });

  it('E10/E11 · living: a product listed and an offer published after signing are hers; a frozen "all" collaboration sees neither', async () => {
    const whole = await stage({ goal: 'conversion' });
    await signed(whole, { commissionPct: 10, productsWithoutOffers: { mode: 'store' } });
    const frozen = await stage({ goal: 'conversion' });
    await signed(frozen, { commissionPct: 10, productsWithoutOffers: { mode: 'all' } });
    // next week the brands list a new product and publish a new offer
    const newWhole = await H.prod(whole.brandId, tree.shirts, 'New kurta', 999);
    const newFrozen = await H.prod(frozen.brandId, tree.shirts, 'New kurta', 999);
    const trouser = await H.prod(whole.brandId, tree.shirts, 'Trousers', 1500);
    const later = await H.ready(whole.b.token, { type: 'discount', sub: 'percentage', name: 'Diwali later', cfg: { pct: 10 }, ids: [trouser], from: day(20), to: day(50) });
    const choices = async (w) => {
      const d = await api.post(PP, w.cr.token, { campaign_influencer_id: w.ciId });
      const o = await api.get(`${PP}/${d.body.data.post.id}/options`, w.cr.token);
      return o.body.data;
    };
    const a = await choices(whole);
    // the trousers are at normal price until their offer starts (item 20's own-brand rule, D1)
    expect(a.price_products.map((p) => p.id).sort()).toEqual([whole.kurta, newWhole, trouser].sort());
    expect(a.offers.map((o) => o.id).sort()).toEqual([whole.discount, later].sort());   // R1: published, even one that starts later
    const f = await choices(frozen);
    expect(f.price_products.map((p) => p.id)).toEqual([frozen.kurta]);
    expect(f.price_products.map((p) => p.id)).not.toContain(newFrozen);
    expect(f.offers).toEqual([]);                                                       // none were given
    // the creator's own read of the Entire store follows the store too, with the picker's own count
    const sell = (await api.get(`/influencers/me/invitations/${whole.ciId}/sell`, whole.cr.token)).body.data;
    expect(sell.products.count).toBe(3);
    expect(sell.offers).toHaveLength(2);
  });

  it('E12/R3 · the End-offer warning counts an unsigned Entire store invitation and a signed one with its live post', async () => {
    const w = await stage({ goal: 'conversion' });
    await signed(w, { commissionPct: 10, productsWithoutOffers: { mode: 'store' } });
    // a live offer post of hers on the discount
    const postId = await F.sentPost({ ...w, shirts: [w.shirt], discount: w.discount });
    await F.approvePost(admin, postId);
    // and a second creator invited whole, not yet signed
    const cr2 = await H.creator({ name: 'Diya Pillai' });
    const r2 = await api.post(`${w.url}/invitations`, w.b.token, { creators: [{ influencerId: cr2.influencerId, terms: { commissionPct: 10, productsWithoutOffers: { mode: 'store' } } }] });
    expect(r2.status).toBe(201);
    const view = (await api.get(`/brands/me/offers/${w.discount}`, w.b.token)).body.data;
    expect(view.unsigned_invitations).toBe(1);
    expect(view.store_collaborations).toEqual({ collaborations: 1, posts: 1 });
  });
});

describe('the counter (C2; E6, E7)', () => {
  it('E6 · she counters the posts number alone; the brand accepts; the agreement carries 2', async () => {
    const w = await stage();
    const inv = await invite(w, contentTerms());
    w.ciId = inv.body.data.rows[0].id;
    const r = await api.post(`/influencers/me/invitations/${w.ciId}/counter`, w.cr.token, { terms: { ...CONTENT, shoppablePostsN: 2 } });
    expect(r.status).toBe(201);
    const thread = (await api.get(`/influencers/me/invitations/${w.ciId}/thread`, w.cr.token)).body.data.thread;
    expect(thread.current.shoppablePostsN).toBe(2);
    expect(thread.currentLine).toContain('2 shoppable posts');
    expect(thread.turns[0].changes.some((c) => c.term === 'shoppablePostsN' && c.from === '3' && c.to === '2')).toBe(true);
    const acc = await api.post(`${w.url}/invitations/${w.ciId}/thread/accept`, w.b.token);
    expect(acc.status).toBe(200);
    expect((await ci(w)).shoppable_posts_n).toBe(2);
    // the counter that changes nothing (an app that does not know the number sends none)
    const same = await api.post(`/influencers/me/invitations/${w.ciId}/counter`, w.cr.token, { terms: CONTENT });
    expect(same.status).toBe(422);
  });

  it('E7 · what she posts about is the brand\'s: a counter that carries offers or the store is refused', async () => {
    const w = await stage();
    const inv = await invite(w, contentTerms());
    w.ciId = inv.body.data.rows[0].id;
    const r = await api.post(`/influencers/me/invitations/${w.ciId}/counter`, w.cr.token, { terms: { ...CONTENT, shoppablePostsN: 2, offers: [w.discount] } });
    expect(r.status).toBe(422);
    expect(err(r).message).toBe(SELL.CANT_COUNTER_SELL);
    const r2 = await api.post(`/influencers/me/invitations/${w.ciId}/counter`, w.cr.token, { terms: { ...CONTENT, shoppablePostsN: 2, productsWithoutOffers: { mode: 'store' } } });
    expect(r2.status).toBe(422);
  });
});

/* ───────────────────────────────────────────────────────── going live (E14–E23) */

describe('going live: two paths (G1–G8; E14–E23)', () => {
  it('E14/E15 · shoot done: Path 1 "0 of 3", Path 2 locked on both sides; an upload is refused by the server; Needs You says make the posts', async () => {
    const w = await signed(await stage(), contentTerms());
    const hers = await read(w);
    expect(hers).toMatchObject({ stage: 'posts', path2Locked: true, path1: { min: 3, approved: 0, short: 3, met: false, open: false }, finalHeldForPosts: false });
    expect(hers.steps.map((s) => s.key)).toEqual(['signed', 'shoot', 'posts', 'content', 'live']);
    expect(hers.steps[2]).toMatchObject({ state: 'now', detail: '0 of 3' });
    expect(hers.move).toMatchObject({ key: 'make_posts', side: 'creator' });
    const theirs = await read(w, 'brand');
    expect(theirs).toMatchObject({ stage: 'posts', path2Locked: true, yourMove: false });
    expect(theirs.can.reportPostsNotMade).toBe(false);
    const up = await uploadUrl(w);
    expect(up.status).toBe(422);
    expect(err(up).code).toBe('PATH2_LOCKED');
    const sub = await api.post(`${F.C(w)}/submit`, w.cr.token, { round: 1 });
    expect(err(sub).code).toBe('PATH2_LOCKED');
    // Home: the post row says what she owes; the content row does not repeat it
    const lists = await home.creatorLists(w.cr.influencerId);
    const posts = lists.needs.filter((n) => n.kind === 'post_needed');
    expect(posts).toHaveLength(1);
    expect(posts[0]).toMatchObject({ done: 0, min: 3 });
    // the brand's Home reads the lock as her move
    expect(JSON.stringify(await home.brandLists(w.brandId))).toContain('is making her shoppable posts');
  });

  it('E16 · the first approval opens Path 2: the rows are the agreement\'s deliverables, item 12 from here', async () => {
    const w = await signed(await stage(), contentTerms());
    const id = await w12.sendPricePost(w);
    expect((await read(w)).path1).toMatchObject({ approved: 0, inReview: 1, open: false });
    await w12.approvePost(w, id);
    const hers = await read(w);
    expect(hers).toMatchObject({ stage: 'draft', path2Locked: false, path1: { approved: 1, short: 2, open: true, met: false } });
    expect(hers.rows.map((r) => [r.type, r.count])).toEqual([['reel', 2], ['story', 1]]);
    expect(hers.path1.posts[0]).toMatchObject({ id, state: 'live', counts: true, late: false });
    expect((await uploadUrl(w)).status).toBe(200);
    // the old content Delayed vocabulary still applies from here (R8 is only while short)
    expect(hers.move).toMatchObject({ key: 'send_content', side: 'creator' });
  });

  it('E17–E19 · confirm live pays 25%; the final 50% waits past its date for the posts; the third approval releases it and completes (G4–G6)', async () => {
    const w = await signed(await stage(), contentTerms(), { open: true });
    await w12.fillPackage(w);
    expect((await F.submit(w)).status).toBe(200);
    expect((await F.approve(w)).status).toBe(200);
    await w12.proveAll(w);
    expect((await F.posted(w)).status).toBe(200);
    const before = await W.money(w);
    const c = await F.confirmLive(w, { amount: 2000 });
    expect(c.status).toBe(200);
    expect(c.body.data.content).toMatchObject({ stage: 'live', finalHeldForPosts: true, postsShort: 2 });
    expect(c.body.data.content.can.confirmLive).toBe(false);
    const after = await W.money(w);
    expect(num(after.her - before.her)).toBe(2000);
    expect((await escrow(w)).map((e) => e.status)).toEqual(['released', 'released', 'queued']);
    // E18: the date passes; the job holds it and says why; Needs You names the amount it unlocks
    await query(`UPDATE escrow_entries SET release_due_at = now() - interval '1 hour' WHERE campaign_influencer_id = $1 AND tranche_number = 3`, [w.ciId]);
    const job = await t3Job.run();
    expect(job.released).toBe(0);
    expect(job.skipped).toBe(1);
    expect((await escrow(w))[2]).toMatchObject({ status: 'queued', release_held_for_posts: true });
    expect((await W.money(w)).her).toBe(after.her);
    const lists = await home.creatorLists(w.cr.influencerId);
    const row = lists.needs.find((n) => n.kind === 'post_needed');
    expect(row.line).toContain('2 more release ₹4,000');
    expect((await read(w, 'brand')).finalHeldForPosts).toBe(true);
    // E19: posts 2 and 3 — the third approval pays the final 50% and completes, in the approval
    const p2 = await w12.sendPricePost(w, 'Second look');
    await w12.approvePost(w, p2);
    expect((await escrow(w))[2].status).toBe('queued');
    const p3 = await w12.sendPricePost(w, 'Third look');
    await w12.approvePost(w, p3);
    expect((await escrow(w))[2]).toMatchObject({ status: 'released', release_held_for_posts: false });
    expect(num((await W.money(w)).her - after.her)).toBe(4000);
    expect((await ci(w)).status).toBe('completed');
    const done = await read(w);
    expect(done).toMatchObject({ stage: 'complete', finalHeldForPosts: false, path1: { approved: 3, met: true } });
    expect(done.steps.find((s) => s.key === 'posts')).toMatchObject({ state: 'done', detail: '3 of 3' });
    // the campaign completed with its one collaboration
    expect((await query(`SELECT status FROM campaigns WHERE id = $1`, [w.c.id])).rows[0].status).toBe('completed');
  });

  it('E20 · posts approved before the date: the job pays on the date as item 12 always has', async () => {
    const w = await signed(await stage(), contentTerms({ shoppablePosts: 1 }), { open: true });
    await w12.fillPackage(w); await F.submit(w); await F.approve(w); await w12.proveAll(w); await F.posted(w);
    expect((await F.confirmLive(w, { amount: 2000 })).body.data.content.finalHeldForPosts).toBe(false);
    await query(`UPDATE escrow_entries SET release_due_at = now() - interval '1 hour' WHERE campaign_influencer_id = $1 AND tranche_number = 3`, [w.ciId]);
    const job = await t3Job.run();
    expect(job.released).toBe(1);
    expect((await ci(w)).status).toBe('completed');
  });

  it('E21 · past the posting date and short: Delayed, stage "shoppable posts not approved"; later, live and still short, the same', async () => {
    const w = await signed(await stage(), contentTerms());
    await F.pastPosting(w);
    const out = await contentJobs.flagDelayedContent();
    expect(out.flagged).toBe(1);
    expect((await ci(w)).delayed_stage).toBe('posts_not_approved');
    const hers = await read(w);
    expect(hers.delayed).toMatchObject({ stage: 'posts_not_approved', label: 'Shoppable posts not approved' });
    // she makes one post, uploads, the brand confirms — still short, so the recorded stage stays on the posts
    const id = await w12.sendPricePost(w); await w12.approvePost(w, id);
    expect(await contentJobs.currentDelayedStage({ ci_id: w.ciId, goal: 'engagement', contract_id: w.con.id })).toBe('content_not_submitted');
    await w12.fillPackage(w); await F.submit(w); await F.approve(w); await w12.proveAll(w); await F.posted(w); await F.confirmLive(w, { amount: 2000 });
    expect(await contentJobs.currentDelayedStage({ ci_id: w.ciId, goal: 'engagement', contract_id: w.con.id })).toBe('posts_not_approved');
  });

  it('E22 · an old-terms Pay for Content collaboration keeps the single path: no Path 1, no lock, the posts door closed', async () => {
    const w = await signed(await stage(), contentTerms());
    // the twelve in production were signed before this item: no allocation, no number
    await query(`UPDATE campaign_influencers SET sell_v2 = false, sell_mode = NULL, sell_product_ids = '{}', shoppable_posts_n = NULL WHERE id = $1`, [w.ciId]);
    const hers = await read(w);
    expect(hers).toMatchObject({ stage: 'draft', path2Locked: false, path1: null, finalHeldForPosts: false });
    expect(hers.steps.map((s) => s.key)).toEqual(['signed', 'shoot', 'content', 'live']);
    expect((await uploadUrl(w)).status).toBe(200);
    const d = await api.post(PP, w.cr.token, { campaign_influencer_id: w.ciId });
    expect(d.status).toBe(404);
    const cols = (await api.get(`${PP}/collaborations?brand_id=${w.brandId}`, w.cr.token)).body.data;
    expect(cols.collaborations || []).toHaveLength(0);
  });

  it('E23 · the brand may report "she hasn\'t made her posts" only past the posting date; it freezes the step', async () => {
    const w = await signed(await stage(), contentTerms());
    let r = await F.report(w, 'posts_not_made');
    expect(r.status).toBe(422);
    expect(err(r).code).toBe('REPORT_NOT_OPEN');
    await F.pastPosting(w);
    expect((await read(w, 'brand')).can.reportPostsNotMade).toBe(true);
    r = await F.report(w, 'posts_not_made', 'Nothing in the shop two days after the date.');
    expect(r.status).toBe(200);
    expect(r.body.data.content.reported.brand).toMatchObject({ kind: 'posts_not_made' });
    expect((await read(w)).frozen).toBe(true);
    // frozen: a post may still be made (INFLX's path), but the package cannot move
    const id = await w12.sendPricePost(w); await w12.approvePost(w, id);
    expect((await uploadUrl(w)).status).toBe(422);
  });
});

/* ───────────────────────────────────────────────────────── the Create tab and the sale (P1–P5; E24–E26) */

describe('her posts and a sale through one (P1, P3, P5; E24–E26)', () => {
  it('P1 · the collaboration is in Create with "fixed fee · no commission" and its count against the brand\'s number', async () => {
    const w = await signed(await stage(), contentTerms());
    const cols = (await api.get(`${PP}/collaborations?brand_id=${w.brandId}`, w.cr.token)).body.data.collaborations;
    expect(cols).toHaveLength(1);
    expect(cols[0]).toMatchObject({ id: w.ciId, open: true, posts_done: 0, posts_min: 3, earning: 'fixed fee · no commission' });
    const brands = (await api.get(`${PP}/brands`, w.cr.token)).body.data.brands;
    expect(brands.find((b) => b.id === w.brandId).open).toBe(true);
    const homeCreate = (await api.get('/influencers/me/create', w.cr.token)).body.data;
    expect(homeCreate.needs.find((n) => n.campaign_influencer_id === w.ciId)).toMatchObject({ done: 0, min: 3 });
  });

  it('E24–E26 · a shopper buys through her post: her share ₹0, INFLX\'s rate, the brand the rest; nothing in her wallet; her stats say what sold', async () => {
    const w = await signed(await stage(), contentTerms({ shoppablePosts: 1 }));
    const postId = await w12.sendPricePost(w);
    await w12.approvePost(w, postId);
    await query(`UPDATE campaign_sets SET invites_close_at = $2::date - 3, go_live_date = $2 WHERE id = $1`, [w.s.id, day(-1)]);
    const before = await W.money(w);
    const o = await W.order({ ...w, post: postId, ids: [w.kurta] }, [0]);
    const ln = o.lines[0];
    expect(num(ln.paid_total)).toBe(1299);
    expect(ln).toMatchObject({ campaign_influencer_id: w.ciId, post_id: postId, influencer_id: w.cr.influencerId, brand_id: w.brandId });
    expect(num(ln.commission)).toBe(0);
    expect(num(ln.commission_pct)).toBe(0);
    expect(num(ln.fee_pct)).toBeGreaterThan(0);
    expect(num(Number(ln.platform_fee) + Number(ln.brand_net))).toBe(1299);
    expect(num(o.tx.influencer_commission)).toBe(0);
    expect(await W.money(w)).toMatchObject({ her: before.her, her_pending: before.her_pending });
    // her post says "1 sale · ₹1,299", never "to you"
    const post = (await api.get(`${PP}/${postId}`, w.cr.token)).body.data.post;
    expect(post.sales_words).toBe('1 sale · ₹1,299');
    expect(post.no_commission).toBe(true);
    // the brand's sales list shows the three shares with no creator share
    const s = (await api.get('/brands/me/wallet/sales', w.b.token)).body.data;
    expect(s.sales[0]).toMatchObject({ id: ln.id, paid: 1299, commissionPct: 0, creatorShare: 0, brandShare: num(ln.brand_net) });
  });
});

/* ───────────────────────────────────────────────────────── ownership */

describe('doors', () => {
  it('another creator cannot read or move the step; the brand cannot upload', async () => {
    const w = await signed(await stage(), contentTerms());
    const other = await H.creator({ name: 'Someone Else' });
    expect((await api.get(F.C(w), other.token)).status).toBe(404);
    expect((await api.post(`/influencers/me/invitations/${w.ciId}/sell`, other.token)).status).toBeGreaterThanOrEqual(404);
    expect((await request(app).post(`/v1${F.C(w)}/upload-url`).set('Authorization', `Bearer ${w.b.token}`).send({})).status).toBeGreaterThanOrEqual(401);
  });
});
