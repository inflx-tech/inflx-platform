'use strict';

/**
 * Item 12 — shared fixtures for the content-step suites.
 * Contract: features/item12-content
 *
 * Built on item 10's worlds (real API: invite → accept → send → both sign; money locked and
 * tranche 1 out for real). The shoot is then marked done the way items 10 and 11 write it —
 * `status = 'completed'` plus the moments — straight into the row, because the shoot flows are
 * items 10 and 11's to prove and item 12 only READS their answer.
 */

const { query } = require('./item3');
const w10 = require('./item10');

/**
 * Mark the shoot done exactly as item 10 (visit confirm) or item 11 (Remote shoot done) writes it.
 *
 * Item 21 (rules v1.34 §12.2, D4): a Pay for Content collaboration on the new terms reaches the
 * content package only once INFLX has approved her first shoppable post. The content suites are
 * about the package, so `markShootDone` makes and approves that first post through the real API
 * (item 13's routes, item 13's admin approval) unless told `openPath2: false`.
 */
async function markShootDone(w, { at = null, openPath2 = true } = {}) {
  const ts = at || new Date().toISOString();
  if (w.mode === 'visit') {
    await query(
      `UPDATE production_events
          SET status = 'completed', influencer_completed_at = $2, brand_completed_at = $2,
              visit_completed_at = $2, time_agreed_at = COALESCE(time_agreed_at, $2)
        WHERE id = $1`, [w.pe.id, ts]);
  } else {
    await query(
      `UPDATE production_events SET status = 'completed', influencer_completed_at = $2 WHERE id = $1`,
      [w.pe.id, ts]);
  }
  w.pe = (await query(`SELECT * FROM production_events WHERE id = $1`, [w.pe.id])).rows[0];
  if (openPath2) await firstPostApproved(w);
  return w;
}

/**
 * Item 21 — her first shoppable post, approved by INFLX: a price post on one of the products she
 * was given, through item 13's own routes. Does nothing for a collaboration without a posts term.
 * Returns the post id, or null.
 */
async function firstPostApproved(w) {
  const { rows: [ci] } = await query(
    `SELECT ci.sell_v2, ci.shoppable_posts_n, cs.goal FROM campaign_influencers ci JOIN campaign_sets cs ON cs.id = ci.set_id WHERE ci.id = $1`, [w.ciId]);
  if (!ci || ci.goal !== 'engagement' || !ci.sell_v2 || ci.shoppable_posts_n == null) return null;
  const id = await sendPricePost(w);
  await approvePost(w, id);
  return id;
}

/** A complete PRICE post on the first product she may sell, sent to INFLX. Returns the post id. */
async function sendPricePost(w, caption = 'The kurta I wore all week') {
  const { api, app } = require('./item3');
  const request = require('supertest');
  const P = '/influencers/me/shoppable-posts';
  const patch = (id, body) => request(app).patch(`/v1${P}/${id}`).set('Authorization', `Bearer ${w.cr.token}`).send(body);
  const d = await api.post(P, w.cr.token, { campaign_influencer_id: w.ciId });
  if (d.status !== 200) throw new Error(`draft: ${JSON.stringify(d.body)}`);
  const id = d.body.data.post.id;
  const o = await api.get(`${P}/${id}/options`, w.cr.token);
  if (o.status !== 200) throw new Error(`options: ${JSON.stringify(o.body)}`);
  const free = (o.body.data.price_products || o.body.data.products_without_offers || []).map((p) => p.id);
  if (!free.length) throw new Error('firstPostApproved: she has no product without an offer to post about');
  await patch(id, { post_kind: 'price', draft_step: 4 });
  await patch(id, { product_ids: free.slice(0, 1), draft_step: 6 });
  const tags = (await query(`SELECT id FROM theme_tags ORDER BY tag_group, name LIMIT 1`)).rows.map((r) => r.id);
  await patch(id, { theme_tag_ids: tags, draft_step: 7 });
  const u = await api.post(`${P}/${id}/upload-url`, w.cr.token, { content_type: 'image/jpeg', size_bytes: 2048 });
  if (u.status !== 200) throw new Error(`upload-url: ${JSON.stringify(u.body)}`);
  const url = new URL(u.body.data.url);
  const put = await request(app).put(`${url.pathname}${url.search}`).set('Content-Type', u.body.data.headers['Content-Type']).send(Buffer.alloc(2048, 7));
  if (put.status !== 200) throw new Error(`put: ${put.status}`);
  await patch(id, { media_kind: 'image', media_layout: 'single', media: [{ r2_key: u.body.data.key, mime: 'image/jpeg' }], draft_step: 8 });
  await patch(id, { caption });
  const s = await api.post(`${P}/${id}/submit`, w.cr.token);
  if (s.status !== 200) throw new Error(`submit: ${JSON.stringify(s.body)}`);
  return id;
}

/** INFLX approves a post (item 13's admin route — every hook runs, item 21's included). */
async function approvePost(w, postId) {
  const { api } = require('./item3');
  if (!w.admin) w.admin = await require('./factories').createAdminUser();
  const r = await api.post(`/admin/posts/${postId}/approve`, w.admin.token);
  if (r.status !== 200) throw new Error(`approve: ${JSON.stringify(r.body)}`);
  return r;
}

/** Signed by both, funded, and the shoot done — the state the content step opens on. */
async function shotDone(goal = 'engagement', opts = {}) {
  const w = await w10.signedByBoth(goal, opts);
  if (!w.pe) throw new Error('shotDone: no production_events row was born at the signature');
  return markShootDone(w);
}

/** The scopes the content service takes, for each party of a world. */
const brandScope = (w) => ({ side: 'brand', userId: w.b.userId, campaignId: w.c.id, setId: w.s.id });
const creatorScope = (w) => ({ side: 'creator', userId: w.cr.userId });

/** Base paths (item 10/11 naming). */
const B = (w) => `${w.url}/invitations/${w.ciId}/content`;
const C = (w) => `/influencers/me/invitations/${w.ciId}/content`;

module.exports = { markShootDone, shotDone, brandScope, creatorScope, B, C, firstPostApproved, sendPricePost, approvePost };

/* ── Uploads through the real mock storage route (a real port, streamed like a phone) ── */

const http = require('http');
const { Readable } = require('stream');
const { api, app } = require('./item3');

let _server = null; let _base = null;
async function startServer() {
  if (_server) return _base;
  _server = http.createServer(app);
  await new Promise((r) => _server.listen(0, r));
  _base = `http://127.0.0.1:${_server.address().port}`;
  return _base;
}
async function stopServer() {
  if (!_server) return;
  await new Promise((r) => _server.close(r));
  _server = null; _base = null;
}

/** PUT `n` bytes of `type` to a signed URL, in 64 KB chunks. */
function put(url, n, type) {
  const u = new URL(url);
  return new Promise((resolve) => {
    const req = http.request(`${_base}${u.pathname}${u.search}`, { method: 'PUT', headers: { 'Content-Type': type, 'Content-Length': n } },
      (res) => { res.resume(); res.on('end', () => resolve(res.statusCode)); });
    req.on('error', () => resolve(0));
    const chunk = Buffer.alloc(65536, 3); let left = n;
    Readable.from((function* gen() { while (left > 0) { const k = Math.min(left, chunk.length); left -= k; yield chunk.subarray(0, k); } })()).pipe(req);
  });
}

const FILE = {
  photo: { kind: 'photo', mime: 'image/jpeg', sizeBytes: 2048 },
  video: { kind: 'video', mime: 'video/mp4', sizeBytes: 4096, durationS: 28 },
};

/** Ask, upload, confirm one file into a row. Returns the file. */
async function upload(w, rowKey, what = 'photo', extra = {}) {
  const body = { rowKey, ...FILE[what], ...extra };
  const a = await api.post(`${C(w)}/files/upload-url`, w.cr.token, body);
  if (a.status !== 200) throw new Error(`upload-url ${a.status} ${JSON.stringify(a.body)}`);
  const st = await put(a.body.data.upload.url, body.sizeBytes, body.mime);
  if (st !== 200) throw new Error(`put ${st}`);
  const c = await api.post(`${C(w)}/files/${a.body.data.upload.fileId}/confirm`, w.cr.token, {});
  if (c.status !== 200) throw new Error(`confirm ${c.status} ${JSON.stringify(c.body)}`);
  return c.body.data.file;
}

/** Fill every row of the package to its count (video for reels/YouTube, photo otherwise). */
async function fillPackage(w) {
  const r = await api.get(C(w), w.cr.token);
  const out = [];
  for (const row of r.body.data.content.rows) {
    for (let i = row.have; i < row.count; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      out.push(await upload(w, row.key, ['reel', 'youtube_video', 'youtube_short'].includes(row.type) ? 'video' : 'photo'));
    }
  }
  return out;
}

const read = (w, side = 'creator') => api.get(side === 'creator' ? C(w) : B(w), side === 'creator' ? w.cr.token : w.b.token);
const state = async (w, side) => (await read(w, side)).body.data.content;
const roundNo = async (w) => (await state(w, 'creator')).round.current;
const submit = async (w) => api.post(`${C(w)}/submit`, w.cr.token, { round: await roundNo(w) });
const approve = async (w) => api.post(`${B(w)}/approve`, w.b.token, { round: await roundNo(w) });
const changes = async (w, reason = 'Too dark at the end.', notes = []) => api.post(`${B(w)}/changes`, w.b.token, { round: await roundNo(w), reason, notes });

/** Every proof slot: a real-shaped link, or a Story screenshot uploaded as proof. */
async function proveAll(w) {
  const s = await state(w, 'creator');
  for (const row of s.rows) {
    for (let slot = 1; slot <= row.count; slot += 1) {
      if (row.isStory) {
        // eslint-disable-next-line no-await-in-loop
        const f = await upload(w, row.key, 'photo', { purpose: 'story_proof', mime: 'image/png' });
        // eslint-disable-next-line no-await-in-loop
        const r = await api.put(`${C(w)}/proofs/${row.key}/${slot}`, w.cr.token, { screenshotFileId: f.id });
        if (r.status !== 200) throw new Error(`proof ${JSON.stringify(r.body)}`);
      } else {
        const host = row.platform === 'youtube' ? 'https://www.youtube.com/watch?v=' : 'https://www.instagram.com/reel/';
        // eslint-disable-next-line no-await-in-loop
        const r = await api.put(`${C(w)}/proofs/${row.key}/${slot}`, w.cr.token, { url: `${host}C8x${slot}K2` });
        if (r.status !== 200) throw new Error(`proof ${JSON.stringify(r.body)}`);
      }
    }
  }
}
const posted = (w) => api.post(`${C(w)}/posted`, w.cr.token, {});
const confirmLive = async (w, amount) => {
  const s = await state(w, 'brand');
  return api.post(`${B(w)}/confirm-live`, w.b.token, { amount: amount === undefined ? s.money.t2.amount : amount });
};

/** A Pay for Content world whose fee is ₹12,000 — the reissued mockups' own numbers. */
const FEE_12000 = { fee: 12000, deliverables: [{ type: 'reel', count: 1 }, { type: 'story', count: 2 }] };

/** All the way to "posted", ready for the brand's confirmation. */
async function toPosted(w) {
  await fillPackage(w);
  let r = await submit(w); if (r.status !== 200) throw new Error(`submit ${JSON.stringify(r.body)}`);
  r = await approve(w); if (r.status !== 200) throw new Error(`approve ${JSON.stringify(r.body)}`);
  await proveAll(w);
  r = await posted(w); if (r.status !== 200) throw new Error(`posted ${JSON.stringify(r.body)}`);
  return w;
}

Object.assign(module.exports, {
  startServer, stopServer, put, upload, fillPackage, read, state, submit, approve, changes, proveAll, posted, confirmLive, FEE_12000, toPosted,
});
