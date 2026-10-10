'use strict';

/**
 * postPlaces.service.js — where a creator shared a post he made for his own brand (item 20).
 * Contract: features/item20-own-brand · rules v1.33 §2D · board S1–S3 · decisions O12, D2, D3.
 *
 * His own record: the place (one of the six the collaboration social step uses) and its link.
 * NOBODY approves it and nothing depends on it. It sits beside the post's numbers so he can see
 * which channel sells. Numbers stay per CHANNEL — nothing is counted against one reel, and nothing
 * is read from the social networks.
 */

const db = require('../config/db');
const AppError = require('../utils/AppError');
const { todayInIndia, calendarDay } = require('../utils/indiaDay');
const { SALE_TYPES, HOSTS } = require('./contentCopy');
const posts = require('./shoppablePosts.service');
const { MSG } = require('./ownBrandCopy');

const MAX_PLACES = 20;
const CHANNEL_OF = { instagram: 'ig', youtube: 'yt', facebook: 'fb' };
const SITE = { instagram: 'Instagram', youtube: 'YouTube', facebook: 'Facebook' };
const SHORT = { reel: 'Reel', post: 'Post', story: 'Story', youtube_video: 'Video', youtube_short: 'Short', facebook_post: 'Post' };
const ORDER = Object.keys(SALE_TYPES);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const refuse = (code, message, status = 422, field = null) => new AppError(code, message, status, field);
const OPTIONS = ORDER.map((key) => ({ key, label: SALE_TYPES[key].label, link: key === 'story' ? 'optional' : 'needed' }));

/** A public link on the place's own site. Shape only, never fetched. A missing "https://" is added. */
function cleanLink(raw, platform) {
  let s = String(raw || '').trim();
  if (!s) return null;
  if (/^http:\/\//i.test(s)) s = `https://${s.slice(7)}`;
  else if (!/^https:\/\//i.test(s)) s = `https://${s}`;
  if (s.length > 500) return false;
  let u;
  try { u = new URL(s); } catch { return false; }
  if (!(HOSTS[platform] || []).includes(u.hostname.toLowerCase())) return false;
  if (!u.pathname || u.pathname === '/') return false;
  return u.toString();
}

const display = (link) => (link ? String(link).replace(/^https?:\/\/(www\.|m\.)?/i, '').replace(/\?.*$/, '').replace(/\/+$/, '') : null);

function out(r) {
  const t = SALE_TYPES[r.place];
  return { id: r.id, place: r.place, label: t.label, short: SHORT[r.place], channel: CHANNEL_OF[t.platform],
    link: r.link || null, link_display: display(r.link), shared_on: calendarDay(r.shared_on) };
}

/** His own post, and only one made for his own brand (D3). */
async function ownPost(influencerId, postId) {
  const p = await posts.getPost(influencerId, postId);       // 404 when it is not his
  if (!p.own_brand) throw refuse('NOT_OWN_BRAND', MSG.PLACE_OWN_ONLY, 422);
  return p;
}
const canEdit = (p) => ['approved', 'live'].includes(p.state);

function read(body, { partial = false } = {}) {
  const b = body && typeof body === 'object' ? body : {};
  const place = String(b.place || '');
  if (!SALE_TYPES[place]) { if (partial && b.place === undefined) return null; throw refuse('VALIDATION_ERROR', MSG.PLACE_UNKNOWN, 422, 'place'); }
  const platform = SALE_TYPES[place].platform;
  const link = cleanLink(b.link, platform);
  if (link === false) throw refuse('VALIDATION_ERROR', MSG.PLACE_LINK_BAD(SITE[platform]), 422, 'link');
  if (!link && place !== 'story') throw refuse('VALIDATION_ERROR', MSG.PLACE_LINK_NEEDED, 422, 'link');
  return { place, link };
}

async function rowsOf(postId) {
  const { rows } = await db.query(
    `SELECT id, place, link, shared_on FROM post_share_places WHERE post_id = $1 ORDER BY shared_on, created_at`, [postId]);
  return rows.map(out);
}

/** S1 — the card on the post's page. */
async function list(influencerId, postId) {
  const p = await ownPost(influencerId, postId);
  return { post_id: p.id, can_edit: canEdit(p), places: await rowsOf(p.id), options: OPTIONS };
}

/** S2 — add a place. From approval on; never on a draft or a post still with INFLX. */
async function add(influencerId, postId, body) {
  const p = await ownPost(influencerId, postId);
  if (!canEdit(p)) throw refuse('PLACE_NOT_YET', MSG.PLACE_NOT_YET, 409);
  const v = read(body);
  const { rows: [n] } = await db.query(`SELECT count(*)::int AS n FROM post_share_places WHERE post_id = $1`, [p.id]);
  if (n.n >= MAX_PLACES) throw refuse('VALIDATION_ERROR', MSG.PLACE_MAX, 422);
  await db.query(`INSERT INTO post_share_places (post_id, place, link, shared_on) VALUES ($1, $2, $3, $4::date)`, [p.id, v.place, v.link, todayInIndia()]);
  return list(influencerId, p.id);
}

async function ownPlace(p, placeId) {
  if (!UUID.test(String(placeId || ''))) throw refuse('NOT_FOUND', 'Not found', 404);
  const { rows: [r] } = await db.query(`SELECT id FROM post_share_places WHERE id = $1 AND post_id = $2`, [placeId, p.id]);
  if (!r) throw refuse('NOT_FOUND', 'Not found', 404);
  return r;
}

async function update(influencerId, postId, placeId, body) {
  const p = await ownPost(influencerId, postId);
  if (!canEdit(p)) throw refuse('PLACE_NOT_YET', MSG.PLACE_NOT_YET, 409);
  const r = await ownPlace(p, placeId);
  const v = read(body);
  await db.query(`UPDATE post_share_places SET place = $2, link = $3, updated_at = now() WHERE id = $1`, [r.id, v.place, v.link]);
  return list(influencerId, p.id);
}

/** Removing is always his to do, whatever became of the post. */
async function remove(influencerId, postId, placeId) {
  const p = await ownPost(influencerId, postId);
  const r = await ownPlace(p, placeId);
  await db.query(`DELETE FROM post_share_places WHERE id = $1`, [r.id]);
  return list(influencerId, p.id);
}

/** S3 — for Stats: the places under their channel. channel → [{ id, short, label, link, shared_on }] */
async function byChannel(postId) {
  const m = new Map();
  for (const x of await rowsOf(postId)) { if (!m.has(x.channel)) m.set(x.channel, []); m.get(x.channel).push(x); }
  return m;
}

module.exports = { MAX_PLACES, OPTIONS, cleanLink, list, add, update, remove, byChannel };
