'use strict';

/**
 * Item 14 — shared fixtures for Pay for Sale going live.
 * Contract: features/item14-sale-going-live
 *
 * A new-terms Pay for Sale collaboration built through the real API (offers v2 → invitation with
 * her offers → accept → send → both sign), the shoot marked done the way items 10/11 write it,
 * and shoppable posts made and approved through item 13's own routes (Path 1). Path 2 then runs
 * over item 12's content routes, which is the point: item 14 reuses them.
 */

const request = require('supertest');
const app = require('../../src/app');
const H = require('./offersV2');
const w10 = require('./item10');
const w12 = require('./item12');

const { api, query, day } = H;
const P = '/influencers/me/shoppable-posts';

let T = null;
async function tree() { if (!T) T = await H.tree(); return T; }
function resetTree() { T = null; }

/**
 * A brand with a percentage discount on four shirts; a Pay for Sale set posting in `posting`
 * days (Remote); a creator given the offer, signed by both, the shoot done (unless shootDone:false).
 */
async function world({ shootDone = true, posting = 12, min = null, name = 'Tanvi Suresh' } = {}) {
  const t = await tree();
  const b = await H.brand();
  const shirts = [];
  for (const [n, p] of [['Oxford shirt', 1100], ['Linen shirt', 1400], ['Denim shirt', 1600], ['Kurta shirt', 1300]]) {
    // eslint-disable-next-line no-await-in-loop
    shirts.push(await H.prod(b.brandId, t.shirts, n, p));
  }
  const discount = await H.ready(b.token, { type: 'discount', sub: 'percentage', name: '20% off shirts', cfg: { pct: 20 }, ids: shirts, from: day(1), to: day(60) });
  const c = await w10.campaign(b);
  const s = await w10.set(b, c.id, { goal: 'conversion', shoot_mode: 'shipment', go_live_date: day(posting) });
  const cr = await H.creator({ name });
  const terms = { commissionPct: 10, offers: [discount], productsWithoutOffers: { mode: 'none' } };
  const inv = await api.post(`/campaigns/${c.id}/sets/${s.id}/invitations`, b.token, { creators: [{ influencerId: cr.influencerId, terms }] });
  if (inv.status !== 201) throw new Error(`invite: ${JSON.stringify(inv.body)}`);
  const ciId = inv.body.data.rows[0].id;
  const acc = await api.post(`/influencers/me/invitations/${ciId}/accept`, cr.token);
  if (acc.status >= 300) throw new Error(`accept: ${JSON.stringify(acc.body)}`);
  const w = { b, c, s, cr, ciId, brandId: b.brandId, url: `/campaigns/${c.id}/sets/${s.id}`, shirts, discount, mode: 'shipment' };
  for (const step of [w10.send, w10.herSign, w10.brandSign]) {
    // eslint-disable-next-line no-await-in-loop
    const r = await step(w);
    if (r.status >= 300) throw new Error(`sign: ${JSON.stringify(r.body)}`);
  }
  if (min != null) await query(`UPDATE campaign_influencers SET min_shoppable_posts = $2 WHERE id = $1`, [ciId, min]);
  const { rows: [con] } = await query(`SELECT id FROM contracts WHERE campaign_influencer_id = $1`, [ciId]);
  w.contractId = con.id;
  if (shootDone) await finishShoot(w);
  return w;
}

async function finishShoot(w) {
  await query(
    `INSERT INTO production_events (contract_id, mode, status, influencer_completed_at) VALUES ($1, 'shipment', 'completed', now())
     ON CONFLICT (contract_id) DO UPDATE SET status = 'completed', influencer_completed_at = now()`, [w.contractId]);
  w.pe = (await query(`SELECT * FROM production_events WHERE contract_id = $1`, [w.contractId])).rows[0];
}

const patch = (w, id, body) => request(app).patch(`/v1${P}/${id}`).set('Authorization', `Bearer ${w.cr.token}`).send(body);
const tagIds = async (names) => (await query(`SELECT id, name FROM theme_tags WHERE name = ANY($1::text[])`, [names])).rows.map((r) => r.id);

async function postMedia(w, postId) {
  const r = await api.post(`${P}/${postId}/upload-url`, w.cr.token, { content_type: 'image/jpeg', size_bytes: 2048 });
  if (r.status !== 200) throw new Error(`upload-url: ${JSON.stringify(r.body)}`);
  const u = new URL(r.body.data.url);
  const put = await request(app).put(`${u.pathname}${u.search}`).set('Content-Type', r.body.data.headers['Content-Type']).send(Buffer.alloc(2048, 7));
  if (put.status !== 200) throw new Error(`put: ${put.status}`);
  return { r2_key: r.body.data.key, mime: 'image/jpeg' };
}

/** Path 1: a complete offer post, sent to INFLX. Returns the post id. */
async function sentPost(w, caption = 'Festive shirts, three ways') {
  const d = await api.post(P, w.cr.token, { campaign_influencer_id: w.ciId });
  if (d.status !== 200) throw new Error(`draft: ${JSON.stringify(d.body)}`);
  const id = d.body.data.post.id;
  await patch(w, id, { post_kind: 'offer', draft_step: 4 });
  await patch(w, id, { offer_id: w.discount, draft_step: 5 });
  await patch(w, id, { product_ids: w.shirts.slice(0, 2), draft_step: 6 });
  await patch(w, id, { theme_tag_ids: await tagIds(['Winter', 'Office', 'Classic']), draft_step: 7 });
  const m = await postMedia(w, id);
  await patch(w, id, { media_kind: 'image', media_layout: 'single', media: [m], draft_step: 8 });
  await patch(w, id, { caption });
  const s = await api.post(`${P}/${id}/submit`, w.cr.token);
  if (s.status !== 200) throw new Error(`submit: ${JSON.stringify(s.body)}`);
  return id;
}

/** Path 1: INFLX approves it (item 13's admin route — the real hook runs). */
async function approvePost(admin, postId) {
  const r = await api.post(`/admin/posts/${postId}/approve`, admin.token);
  if (r.status !== 200) throw new Error(`approve: ${JSON.stringify(r.body)}`);
  return r;
}

const C = (w) => `/influencers/me/invitations/${w.ciId}/content`;
const B = (w) => `${w.url}/invitations/${w.ciId}/content`;
const read = (w, side = 'creator') => api.get(side === 'creator' ? C(w) : B(w), side === 'creator' ? w.cr.token : w.b.token);
const state = async (w, side = 'creator') => (await read(w, side)).body.data.content;
const addRows = (w, postId, types) => api.post(`${C(w)}/social-rows`, w.cr.token, { postId, types });
const removeRow = (w, rowKey) => request(app).delete(`/v1${C(w)}/social-rows/${rowKey}`).set('Authorization', `Bearer ${w.cr.token}`);
const addOutside = (w, postId, type) => api.post(`${C(w)}/outside-rows`, w.cr.token, { postId, type });
const submit = async (w) => api.post(`${C(w)}/submit`, w.cr.token, { round: (await state(w)).round.current });
const approve = async (w) => api.post(`${B(w)}/approve`, w.b.token, { round: (await state(w)).round.current });
const changes = async (w, reason = 'Show the price in the first seconds.') => api.post(`${B(w)}/changes`, w.b.token, { round: (await state(w)).round.current, reason });
const setLink = (w, rowKey, url) => api.put(`${C(w)}/proofs/${rowKey}/1`, w.cr.token, { url });
const posted = (w) => api.post(`${C(w)}/posted`, w.cr.token, {});
const confirmLive = (w) => api.post(`${B(w)}/confirm-live`, w.b.token, {});
const report = (w, kind, note = null) => api.post(`${B(w)}/report`, w.b.token, { kind, note });

const LINKS = {
  reel: 'https://www.instagram.com/reel/C9xK2abc/',
  post: 'https://www.instagram.com/p/C9xK2def/',
  youtube_short: 'https://youtube.com/shorts/Qm8abc',
  youtube_video: 'https://www.youtube.com/watch?v=Qm8abc',
  facebook_post: 'https://www.facebook.com/tanvi/posts/12345',
};

/** Every package row filled with one file (video for reels/YouTube, photo otherwise). */
async function fill(w) {
  const s = await state(w);
  for (const row of s.rows.filter((r) => !r.outside)) {
    // eslint-disable-next-line no-await-in-loop
    if (row.files.length < 1) await w12.upload(w, row.key, ['reel', 'youtube_video', 'youtube_short'].includes(row.type) ? 'video' : 'photo');
  }
}

/** Every package slot proved: a link, or a Story screenshot. */
async function proveAll(w) {
  const s = await state(w);
  for (const row of s.rows.filter((r) => !r.outside)) {
    if (row.isStory) {
      // eslint-disable-next-line no-await-in-loop
      const f = await w12.upload(w, row.key, 'photo', { purpose: 'story_proof', mime: 'image/png' });
      // eslint-disable-next-line no-await-in-loop
      const r = await api.put(`${C(w)}/proofs/${row.key}/1`, w.cr.token, { screenshotFileId: f.id });
      if (r.status !== 200) throw new Error(`proof: ${JSON.stringify(r.body)}`);
    } else {
      // eslint-disable-next-line no-await-in-loop
      const r = await setLink(w, row.key, LINKS[row.type]);
      if (r.status !== 200) throw new Error(`link: ${JSON.stringify(r.body)}`);
    }
  }
}

/** From an approved post to "posted": rows, files, sent, approved by the brand, linked, posted. */
async function toPosted(w, postId, types = ['reel']) {
  let r = await addRows(w, postId, types); if (r.status !== 200) throw new Error(`rows: ${JSON.stringify(r.body)}`);
  await fill(w);
  r = await submit(w); if (r.status !== 200) throw new Error(`submit: ${JSON.stringify(r.body)}`);
  r = await approve(w); if (r.status !== 200) throw new Error(`approve: ${JSON.stringify(r.body)}`);
  await proveAll(w);
  r = await posted(w); if (r.status !== 200) throw new Error(`posted: ${JSON.stringify(r.body)}`);
  return r;
}

/** The posting date moves into the past (the invite deadline with it, as the set's rule requires). */
const pastPosting = (w, n = -3) => query(`UPDATE campaign_sets SET invites_close_at = $2::date - 3, go_live_date = $2 WHERE id = $1`, [w.s.id, day(n)]);

module.exports = {
  api, query, day, world, finishShoot, sentPost, approvePost, resetTree,
  C, B, read, state, addRows, removeRow, addOutside, submit, approve, changes, setLink, posted, confirmLive, report,
  fill, proveAll, toPosted, pastPosting, LINKS,
};
