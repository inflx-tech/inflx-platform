'use strict';

/**
 * ownBrand.service.js — a creator links his account to the brand he runs (item 20).
 * Contract: features/item20-own-brand · rules v1.33 §2D · board L1–L6 (creator), B1–B3 (brand).
 *
 * The one rule: a brand is linked only by proving its OWN login number — either the creator is
 * signed in on that very number, or he types the code INFLX sent to it. Never from a list.
 * One live link per creator (O8); a brand may have several (O9). A link stores ids, so a later
 * change of either login number does not break it. Either side can remove it; the other is told.
 *
 * The code lives in brand_link_codes, apart from sign-in codes: it cannot sign anyone in.
 */

const db = require('../config/db');
const AppError = require('../utils/AppError');
const otpService = require('./otp.service');
const notificationService = require('./notification.service');
const { resolveAvatars } = require('../utils/avatarResolver');
const { istDayOf } = require('../utils/indiaDay');
const { MSG, BRAND_STATE, NOTIFY } = require('./ownBrandCopy');

const PHONE_REGEX = /^\+91[6-9]\d{9}$/;           // the same rule sign-in applies
const CODE_TTL_MINUTES = 15;
const MAX_WRONG_CODES = 5;
const MAX_SENDS_PER_DAY = 5;                      // per creator
const MAX_SENDS_PER_HOUR_TO_NUMBER = 3;           // per brand number, whoever asks
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const refuse = (code, message, status = 422, field = null) => new AppError(code, message, status, field);
const mask = (phone) => {
  const d = String(phone || '').replace(/\D/g, '').replace(/^91(?=\d{10}$)/, '');
  return d.length === 10 ? `+91 ${d.slice(0, 2)}••• ••${d.slice(7)}` : String(phone || '');
};
const normalise = (raw) => {
  const s = String(raw || '').replace(/[\s-]/g, '');
  if (/^[6-9]\d{9}$/.test(s)) return `+91${s}`;
  if (/^91[6-9]\d{9}$/.test(s)) return `+${s}`;
  return s;
};

/* ───────────────────────────────────────────── reading */

/** A brand as My brand shows it. `status` is its own approval, separate from the creator's. */
const BRAND_SQL = `
  SELECT b.id, b.business_name, b.logo_url, b.category, b.user_id, u.status::text AS status, u.phone,
         COALESCE((SELECT rc.name FROM brand_branches bb JOIN ref_cities rc ON rc.id = bb.city_id
                    WHERE bb.brand_id = b.id AND bb.is_main LIMIT 1), u.city) AS city
    FROM brands b JOIN users u ON u.id = b.user_id`;

function brandCard(b) {
  const st = BRAND_STATE[b.status] || BRAND_STATE.pending;
  return {
    id: b.id, name: b.business_name, logo_url: b.logo_url || null, category: b.category || null, city: b.city || null,
    status: b.status, status_chip: st.chip, note: st.note ? st.note(b.business_name) : null,
    can_post: b.status === 'approved',
  };
}

/** The creator behind this session. */
async function creatorOf(userId) {
  const { rows: [i] } = await db.query(
    `SELECT i.id, i.user_id, COALESCE(i.full_name, u.name) AS name, i.instagram_handle, u.phone, u.status::text AS status
       FROM influencers i JOIN users u ON u.id = i.user_id WHERE i.user_id = $1`, [userId]);
  if (!i) throw refuse('NOT_FOUND', 'Creator profile not found', 404);
  return i;
}

/** A FINISHED brand account on this number (a brand user who never completed registration has no brand). */
async function brandOnNumber(phone) {
  const { rows } = await db.query(`${BRAND_SQL} WHERE u.phone = $1 AND u.role = 'brand'`, [phone]);
  return rows[0] || null;
}

/** His live link with its brand, or null. */
async function liveLink(influencerId, conn = db) {
  const { rows } = await conn.query(
    `SELECT l.id AS link_id, l.linked_at, l.linked_via, x.*
       FROM creator_brand_links l JOIN (${BRAND_SQL}) x ON x.id = l.brand_id
      WHERE l.influencer_id = $1 AND l.removed_at IS NULL`, [influencerId]);
  return rows[0] || null;
}

/** The brand he may post for, as the post service asks it: { linked, brand } for THIS brand. */
async function postingBrand(influencerId, brandId) {
  if (!UUID.test(String(brandId || ''))) return null;
  const { rows: [b] } = await db.query(`${BRAND_SQL} WHERE b.id = $1`, [brandId]);
  if (!b) return null;
  const { rows: [l] } = await db.query(
    `SELECT 1 FROM creator_brand_links WHERE influencer_id = $1 AND brand_id = $2 AND removed_at IS NULL`, [influencerId, brandId]);
  return { linked: !!l, brand_id: b.id, brand_name: b.business_name, brand_logo: b.logo_url || null, brand_status: b.status };
}

/** The brand he is linked to, for the brand picker — or null. */
async function linkedBrand(influencerId) {
  const l = await liveLink(influencerId);
  return l ? { brand_id: l.id, brand_name: l.business_name, brand_logo: l.logo_url || null, brand_status: l.status, linked: true } : null;
}

async function postCounts(influencerId, brandId) {
  const { rows: [n] } = await db.query(
    `SELECT count(*) FILTER (WHERE status = 'approved')::int AS live, count(*) FILTER (WHERE status = 'submitted')::int AS in_review
       FROM creator_posts WHERE influencer_id = $1 AND brand_id = $2 AND own_brand`, [influencerId, brandId]);
  return { live: n.live, in_review: n.in_review };
}

/** `can_create`: both approvals are in — his own (Create is locked until then) and the brand's. */
async function linkOut(me) {
  const l = await liveLink(me.id);
  if (!l) return null;
  const brand = brandCard(l);
  return { brand, linked_at: l.linked_at, linked_on: istDayOf(new Date(l.linked_at)), via: l.linked_via,
    posts: await postCounts(me.id, l.id), can_create: brand.can_post && me.status === 'approved' };
}

/**
 * L1 / L5 / L6 — what My brand shows: his link, or (when none) the brand found on his own number.
 */
async function status(userId) {
  const me = await creatorOf(userId);
  const link = await linkOut(me);
  if (link) return { link, same_number: null };
  const b = await brandOnNumber(me.phone);
  return { link: null, same_number: b ? brandCard(b) : null };
}

/* ───────────────────────────────────────────── linking */

async function tell(userId, m, data) {
  try { await notificationService.send({ userId, type: m.type, title: m.title, body: m.body, data, sendSms: false }); }
  catch (e) { console.error('[own-brand] notify failed:', e.message); }
}

async function makeLink(me, brand, via) {
  try {
    await db.query(
      `INSERT INTO creator_brand_links (influencer_id, brand_id, linked_via) VALUES ($1, $2, $3)`, [me.id, brand.id, via]);
  } catch (e) {
    // the partial unique index: he linked a brand in another tab a moment ago
    if (e.code === '23505') { const l = await liveLink(me.id); throw refuse('ALREADY_LINKED', MSG.ALREADY_LINKED(l ? l.business_name : 'a brand'), 409); }
    throw e;
  }
  await tell(brand.user_id, NOTIFY.linked(me.name || 'A creator', brand.business_name), { screen: 'linked_creators', influencer_id: me.id });
  return linkOut(me);
}

async function assertNoLink(me) {
  const l = await liveLink(me.id);
  if (l) throw refuse('ALREADY_LINKED', MSG.ALREADY_LINKED(l.business_name), 409);
}

/** L1 — the number he is signed in with also has a brand account: one tap. */
async function linkSameNumber(userId) {
  const me = await creatorOf(userId);
  await assertNoLink(me);
  const brand = await brandOnNumber(me.phone);
  if (!brand) throw refuse('NO_BRAND', MSG.NO_BRAND, 404, 'phone');
  return { link: await makeLink(me, brand, 'same_number') };
}

/** L3 — the brand's number: a code goes to it. His own number needs no code (it is L1). */
async function sendCode(userId, rawPhone) {
  const me = await creatorOf(userId);
  await assertNoLink(me);
  const phone = normalise(rawPhone);
  if (!PHONE_REGEX.test(phone)) throw refuse('VALIDATION_ERROR', MSG.INVALID_PHONE, 422, 'phone');
  const brand = await brandOnNumber(phone);
  if (!brand) throw refuse('NO_BRAND', MSG.NO_BRAND, 404, 'phone');
  if (phone === me.phone) return { linked: true, link: await makeLink(me, brand, 'same_number') };

  const { rows: [n] } = await db.query(
    `SELECT count(*) FILTER (WHERE influencer_id = $1 AND created_at > now() - interval '24 hours')::int AS mine,
            count(*) FILTER (WHERE phone = $2 AND created_at > now() - interval '1 hour')::int AS to_number
       FROM brand_link_codes WHERE influencer_id = $1 OR phone = $2`, [me.id, phone]);
  if (n.mine >= MAX_SENDS_PER_DAY) throw refuse('RATE_LIMITED', MSG.TOO_MANY_SENDS, 429);
  if (n.to_number >= MAX_SENDS_PER_HOUR_TO_NUMBER) throw refuse('RATE_LIMITED', MSG.TOO_MANY_TO_NUMBER, 429);

  const code = await otpService.sendCodeFor(phone);
  await db.query(`UPDATE brand_link_codes SET used = true WHERE influencer_id = $1 AND used = false`, [me.id]);
  await db.query(
    `INSERT INTO brand_link_codes (influencer_id, brand_id, phone, code, expires_at)
     VALUES ($1, $2, $3, $4, now() + ($5 || ' minutes')::interval)`, [me.id, brand.id, phone, code, String(CODE_TTL_MINUTES)]);
  return { linked: false, sent_to: mask(phone), expires_in: CODE_TTL_MINUTES * 60 };
}

/** L4 — the code from the brand's phone. Five wrong codes end the try. */
async function confirmCode(userId, rawOtp) {
  const me = await creatorOf(userId);
  const otp = String(rawOtp || '').trim();
  if (!/^\d{6}$/.test(otp)) throw refuse('VALIDATION_ERROR', MSG.CODE_NEEDED, 422, 'otp');
  await assertNoLink(me);
  const { rows: [c] } = await db.query(
    `SELECT id, brand_id, code, wrong FROM brand_link_codes
      WHERE influencer_id = $1 AND used = false AND expires_at > now() ORDER BY created_at DESC LIMIT 1`, [me.id]);
  if (!c) throw refuse('LINK_EXPIRED', MSG.EXPIRED, 401);
  if (c.code !== otp) {
    const wrong = c.wrong + 1;
    await db.query(`UPDATE brand_link_codes SET wrong = $2, used = $3 WHERE id = $1`, [c.id, wrong, wrong >= MAX_WRONG_CODES]);
    if (wrong >= MAX_WRONG_CODES) throw refuse('TOO_MANY_ATTEMPTS', MSG.TOO_MANY_WRONG, 429);
    throw refuse('WRONG_CODE', MSG.WRONG_CODE, 401, 'otp');
  }
  await db.query(`UPDATE brand_link_codes SET used = true WHERE id = $1`, [c.id]);
  const { rows: [brand] } = await db.query(`${BRAND_SQL} WHERE b.id = $1`, [c.brand_id]);
  if (!brand) throw refuse('NO_BRAND', MSG.NO_BRAND, 404);
  return { link: await makeLink(me, brand, 'code') };
}

/** L6 — he removes his link. Live posts stay (O10); the brand is told. */
async function removeMine(userId) {
  const me = await creatorOf(userId);
  const l = await liveLink(me.id);
  if (!l) throw refuse('NOT_LINKED', MSG.NOT_LINKED, 404);
  await db.query(`UPDATE creator_brand_links SET removed_at = now(), removed_by = 'creator' WHERE id = $1 AND removed_at IS NULL`, [l.link_id]);
  await tell(l.user_id, NOTIFY.removedByCreator(me.name || 'A creator', l.business_name), { screen: 'linked_creators' });
  return { removed: true };
}

/* ───────────────────────────────────────────── the brand's side */

async function brandOf(userId) {
  const { rows: [b] } = await db.query(`SELECT id, business_name FROM brands WHERE user_id = $1`, [userId]);
  if (!b) throw refuse('NOT_FOUND', 'Brand profile not found', 404);
  return b;
}

/** B2 — everyone linked to this brand. */
async function linkedCreators(userId) {
  const brand = await brandOf(userId);
  const { rows } = await db.query(
    `SELECT i.id AS influencer_id, COALESCE(i.full_name, u.name) AS name, i.instagram_handle,
            i.profile_image_url, i.profile_image_r2_key, l.linked_at
       FROM creator_brand_links l JOIN influencers i ON i.id = l.influencer_id JOIN users u ON u.id = i.user_id
      WHERE l.brand_id = $1 AND l.removed_at IS NULL ORDER BY l.linked_at DESC`, [brand.id]);
  await resolveAvatars(rows, { urlField: 'profile_image_url', keyField: 'profile_image_r2_key' });
  return { linked: rows.map((r) => ({ influencerId: r.influencer_id, name: r.name, instagramHandle: r.instagram_handle,
    avatarUrl: r.profile_image_url || null, linkedAt: r.linked_at, linkedOn: istDayOf(new Date(r.linked_at)) })) };
}

/** B3 — the brand removes one. His live posts stay (O10); he is told. */
async function removeByBrand(userId, influencerId) {
  const brand = await brandOf(userId);
  if (!UUID.test(String(influencerId || ''))) throw refuse('NOT_FOUND', MSG.NOT_YOUR_CREATOR, 404);
  const { rows: [l] } = await db.query(
    `UPDATE creator_brand_links SET removed_at = now(), removed_by = 'brand'
      WHERE brand_id = $1 AND influencer_id = $2 AND removed_at IS NULL RETURNING id`, [brand.id, influencerId]);
  if (!l) throw refuse('NOT_FOUND', MSG.NOT_YOUR_CREATOR, 404);
  const { rows: [u] } = await db.query(`SELECT user_id FROM influencers WHERE id = $1`, [influencerId]);
  if (u) await tell(u.user_id, NOTIFY.removedByBrand(brand.business_name), { screen: 'my_brand' });
  return { removed: true };
}

/** INFLX's review of a creator shows the brand he is linked to (admin). influencerId → brand name. */
async function linkedBrandNames(influencerIds) {
  const ids = (influencerIds || []).filter((x) => UUID.test(String(x)));
  if (!ids.length) return new Map();
  const { rows } = await db.query(
    `SELECT l.influencer_id, b.business_name FROM creator_brand_links l JOIN brands b ON b.id = l.brand_id
      WHERE l.influencer_id = ANY($1::uuid[]) AND l.removed_at IS NULL`, [ids]);
  return new Map(rows.map((r) => [r.influencer_id, r.business_name]));
}

module.exports = {
  CODE_TTL_MINUTES, MAX_WRONG_CODES, MAX_SENDS_PER_DAY, MAX_SENDS_PER_HOUR_TO_NUMBER,
  status, linkSameNumber, sendCode, confirmCode, removeMine, linkedCreators, removeByBrand,
  postingBrand, linkedBrand, liveLink, linkedBrandNames, brandCard,
};
