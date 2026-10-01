'use strict';

/**
 * postLinks.service.js — post codes, post / store / collection links, the visits they bring (Level 4).
 * Contract: features/post-links-codes · rules v1.5 §4.14 · boards L1–L8 · spec D1–D11
 *
 *   inflx.in/p/<code>/<ch>     a post         (code given when INFLX approves; never changes)
 *   inflx.in/s/<handle>/<ch>   her store      (an old handle keeps working: store_handles)
 *   inflx.in/c/<code>          a collection   (one link, no endings)
 *   a code typed in search     "Post code" visit
 *
 * Channels: ig · yt · wa · fb · o (Other). The ending only says where a visit came from; every
 * ending opens the same thing. Visits are reporting only: they never change who is paid.
 */

const db = require('../config/db');
const AppError = require('../utils/AppError');
const { calendarDay, todayInIndia } = require('../utils/indiaDay');
const rules = require('./offerRules');
const posts = require('./shoppablePosts.service');
const settings = require('./platformSettings.service');

const CHANNELS = [
  { key: 'ig', label: 'Instagram', where: 'story link sticker', store: 'Instagram bio' },
  { key: 'yt', label: 'YouTube', where: 'description or pinned comment', store: 'YouTube' },
  { key: 'wa', label: 'WhatsApp', where: 'status, chats, groups', store: 'WhatsApp' },
  { key: 'fb', label: 'Facebook', where: 'post or story', store: 'Facebook' },
  { key: 'o', label: 'Other', where: 'X, LinkedIn, Telegram, SMS', store: 'Other' },
];
const CHANNEL_LABEL = { ig: 'Instagram', yt: 'YouTube', wa: 'WhatsApp', fb: 'Facebook', o: 'Other', code: 'Post code', inflx: 'In INFLX' };
const ORDER = ['ig', 'yt', 'wa', 'fb', 'o', 'code', 'inflx'];
const CODE_RE = /^[BCDFGHJKMNPQRSTVWXYZ2-9]{6}$/;
const HANDLE_RE = /^[a-z0-9._]{1,60}$/;
const SOURCE_OF = [
  [/(^|\.)instagram\.com$|(^|\.)l\.instagram\.com$/, 'ig'],
  [/(^|\.)youtube\.com$|(^|\.)youtu\.be$/, 'yt'],
  [/(^|\.)whatsapp\.com$|(^|\.)wa\.me$/, 'wa'],
  [/(^|\.)facebook\.com$|(^|\.)fb\.com$|(^|\.)l\.facebook\.com$/, 'fb'],
];
// Link previews and crawlers fetch a page without a person behind them (D4).
const BOT_RE = /bot|crawl|spider|slurp|facebookexternalhit|facebot|whatsapp|telegram|twitter|slack|discord|linkedin|embedly|preview|headless|curl|wget|python-requests/i;

const LINK_HOST = () => (process.env.PUBLIC_LINK_HOST || 'inflx.in').replace(/^https?:\/\//, '').replace(/\/+$/, '');
const display = (path) => `${LINK_HOST()}${path}`;
const url = (path) => `https://${display(path)}`;

const channelOf = (raw) => {
  const k = String(raw || '').toLowerCase();
  return CHANNELS.some((c) => c.key === k) ? k : 'o';
};
const cleanCode = (raw) => String(raw || '').trim().toUpperCase();
const cleanHandle = (raw) => String(raw || '').trim().replace(/^@/, '').toLowerCase();
const notFound = () => new AppError('NOT_FOUND', 'Not found', 404);

/* ───────────────────────────────────────────── codes (D1, D2) */

async function issuePostCode(postId, conn = db) {
  const { rows } = await conn.query(
    `UPDATE creator_posts SET post_code = COALESCE(post_code, inflx_new_code('post')), code_issued_at = COALESCE(code_issued_at, now())
      WHERE id = $1 RETURNING post_code`, [postId]);
  return rows[0] ? rows[0].post_code : null;
}

async function issueCollectionCode(collectionId, conn = db) {
  const { rows } = await conn.query(
    `UPDATE creator_collections SET link_code = COALESCE(link_code, inflx_new_code('collection')) WHERE id = $1 RETURNING link_code`, [collectionId]);
  return rows[0] ? rows[0].link_code : null;
}

const captionLine = (code) => `Shop this look on INFLX: search code ${code}`;

/* ───────────────────────────────────────────── visits (D4, D5) */

function realSource(referer, channel) {
  try {
    if (!referer) return null;
    const host = new URL(referer).hostname.toLowerCase();
    if (!host || host === LINK_HOST()) return null;
    const hit = SOURCE_OF.find(([re]) => re.test(host));
    if (hit && hit[1] === channel) return null;
    return host.slice(0, 120);
  } catch { return null; }
}

async function recordVisit({ kind, channel, influencerId, postId = null, collectionId = null, handleUsed = null, visitor = {} }) {
  if (!influencerId) return false;
  if (visitor.ua && BOT_RE.test(visitor.ua)) return false;
  try {
    const days = await settings.get('link_channel_window_days');
    await db.query(
      `INSERT INTO link_visits (kind, channel, influencer_id, post_id, collection_id, handle_used, real_source, device_id, counts_until)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now() + ($9::int * interval '1 day'))`,
      [kind, channel, influencerId, postId, collectionId, handleUsed, channel === 'code' ? null : realSource(visitor.referer, channel),
        visitor.deviceId ? String(visitor.deviceId).slice(0, 100) : null, Number(days) || 30]);
    return true;
  } catch (e) {
    console.error('[links] visit not recorded:', e.message);
    return false;
  }
}

/**
 * The channel an order counts under (D5): the latest tap on THAT creator's links (store or the
 * post's own) by this device within its window, else null ("In INFLX"). Checkout calls this with
 * the shopper app; it never decides who is paid.
 */
async function channelForOrder({ deviceId, influencerId, postId, at = null }) {
  if (!deviceId || !influencerId) return null;
  const { rows } = await db.query(
    `SELECT channel FROM link_visits
      WHERE device_id = $1 AND influencer_id = $2
        AND visited_at <= COALESCE($4::timestamptz, now()) AND counts_until >= COALESCE($4::timestamptz, now())
        AND (kind = 'store' OR post_id = $3)
      ORDER BY visited_at DESC, id DESC LIMIT 1`, [String(deviceId), influencerId, postId || null, at]);
  return rows[0] ? rows[0].channel : null;
}

/* ───────────────────────────────────────────── what a link opens (D7) */

async function storeOf(influencerId) {
  const { rows } = await db.query(
    `SELECT i.id, i.instagram_handle, i.profile_image_url, COALESCE(i.full_name, u.name) AS name
       FROM influencers i JOIN users u ON u.id = i.user_id WHERE i.id = $1`, [influencerId]);
  const r = rows[0];
  if (!r) return null;
  const handle = cleanHandle(r.instagram_handle);
  return { name: r.name, handle, avatar: r.profile_image_url || null, url: handle ? url(`/s/${handle}`) : null };
}

/** A post as a link shows it: what it is, never who made the sales. */
function publicPost(p) {
  return {
    code: p.code, title: p.title, caption: p.caption,
    brand_name: p.collaboration.brand_name,
    offer: p.offer ? `${p.offer.type} · ${p.offer.deal}` : null,
    price_band: p.facets.price_band,
    cover: p.media[0] ? { url: p.media[0].url, kind: p.media_kind } : null,
    products: p.products.filter((x) => x.on_sale !== false).map((x) => ({ name: x.name, price: x.price })),
  };
}

async function postByCode(code) {
  const c = cleanCode(code);
  if (!CODE_RE.test(c)) return null;
  const { rows } = await db.query(`SELECT id, influencer_id FROM creator_posts WHERE post_code = $1 AND v2`, [c]);
  return rows[0] || null;
}

async function resolvePost(code, { channel = 'o', visitor = {} } = {}) {
  const hit = await postByCode(code);
  if (!hit) return { kind: 'post', state: 'unknown', store: null };
  const p = (await posts.getAny(hit.id));
  const store = await storeOf(hit.influencer_id);
  const state = p.state === 'live' ? 'live' : p.state === 'approved' ? 'upcoming' : 'gone';
  await recordVisit({ kind: 'post', channel, influencerId: hit.influencer_id, postId: hit.id, visitor });
  return {
    kind: 'post', state, store,
    goes_live_on: state === 'upcoming' ? p.goes_live_on : null,
    creator: store ? { name: store.name, handle: store.handle } : null,
    post: state === 'gone' ? { code: p.code, title: p.title } : publicPost(p),
  };
}

async function influencerByHandle(handle) {
  const h = cleanHandle(handle);
  if (!HANDLE_RE.test(h)) return null;
  const { rows } = await db.query(
    // Someone's CURRENT handle wins over an old handle another creator once had.
    `SELECT id FROM (
       SELECT i.id, 0 AS rank FROM influencers i WHERE lower(regexp_replace(i.instagram_handle, '^@', '')) = $1
       UNION ALL SELECT sh.influencer_id, 1 FROM store_handles sh WHERE sh.handle = $1) x
     ORDER BY rank LIMIT 1`, [h]);
  return rows[0] ? rows[0].id : null;
}

async function resolveStore(handle, { channel = 'o', visitor = {} } = {}) {
  const id = await influencerByHandle(handle);
  if (!id) return { kind: 'store', state: 'unknown' };
  const store = await storeOf(id);
  const { posts: mine } = await posts.listMine(id);
  const live = mine.filter((p) => p.state === 'live');
  const { rows: cols } = await db.query(`SELECT id FROM creator_collections WHERE influencer_id = $1 ORDER BY updated_at DESC`, [id]);
  const collections = [];
  const coll = require('./creatorCollections.service');
  for (const c of cols) {
    const x = await coll.get(id, c.id);
    if (!x.hidden) collections.push({ name: x.name, url: x.link ? x.link.url : null, count: x.in_shop });
  }
  await recordVisit({ kind: 'store', channel, influencerId: id, handleUsed: cleanHandle(handle), visitor });
  return {
    kind: 'store', state: 'live', store, renamed: store.handle !== cleanHandle(handle),
    posts: live.map((p) => ({ ...publicPost(p), url: url(`/p/${p.code}`) })),
    collections,
  };
}

async function resolveCollection(code, { visitor = {} } = {}) {
  const c = cleanCode(code);
  if (!CODE_RE.test(c)) return { kind: 'collection', state: 'unknown' };
  const { rows } = await db.query(`SELECT id, influencer_id FROM creator_collections WHERE link_code = $1`, [c]);
  if (!rows[0]) return { kind: 'collection', state: 'unknown' };
  const coll = require('./creatorCollections.service');
  const x = await coll.get(rows[0].influencer_id, rows[0].id);
  const store = await storeOf(rows[0].influencer_id);
  await recordVisit({ kind: 'collection', channel: 'o', influencerId: rows[0].influencer_id, collectionId: rows[0].id, visitor });
  if (x.hidden) return { kind: 'collection', state: 'hidden', name: x.name, store };
  return {
    kind: 'collection', state: 'live', name: x.name, store,
    items: x.items.filter((it) => it.in_shop).map((it) => (it.kind === 'post'
      ? { kind: 'post', title: it.title, brand_name: it.brand_name, cover: it.cover }
      : { kind: 'product', title: it.title, brand_name: it.brand_name, price: it.price, image_url: it.image_url })),
  };
}

/** A code typed in INFLX search (the shopper app): exactly that post, as a "Post code" visit. */
async function lookupCode(code, { visitor = {} } = {}) {
  return resolvePost(code, { channel: 'code', visitor });
}

/* ───────────────────────────────────────────── the creator's screens (L2–L6) */

function linksFor(path) {
  return CHANNELS.map((c) => ({ channel: c.key, label: c.label, where: c.where, url: url(`${path}/${c.key}`), display: display(`${path}/${c.key}`) }));
}

/** L2 / L3 — a post's code, caption line and five links. From approval; never for drafts or posts in review. */
async function shareFor(influencerId, postId) {
  const p = await posts.getPost(influencerId, postId);
  if (!['approved', 'live'].includes(p.state) || !p.code) {
    throw new AppError('NO_LINKS_YET', p.state === 'removed' ? 'This post has left the shop.' : 'A post gets its code and links when INFLX approves it.', 409);
  }
  return {
    post_id: p.id, title: p.title, state: p.state, brand_name: p.collaboration.brand_name,
    offer_line: p.offer ? p.offer.deal : 'Normal price',
    live_since: p.state === 'live' ? p.live_since : null,
    goes_live_on: p.state === 'approved' ? p.goes_live_on : null,
    code: p.code, caption_line: captionLine(p.code),
    links: linksFor(`/p/${p.code}`),
    follower_view: url(`/p/${p.code}`),
    where: [
      { title: 'Reel or post caption · Instagram, Facebook', body: "Links can't be tapped in captions, so end with your caption line and post code.", sample: captionLine(p.code) },
      { title: 'Story · Instagram, Facebook', body: 'Add a link sticker with the post link for that app.', sample: display(`/p/${p.code}/ig`) },
      { title: 'Bio · Instagram, YouTube', body: 'Put your store link, not a post link. It always shows everything you have live.', sample: null },
      { title: 'YouTube video or Short', body: 'Paste the link in the description or a pinned comment.', sample: display(`/p/${p.code}/yt`) },
      { title: 'WhatsApp', body: 'Status, chats or groups. The link opens the post straight away.', sample: display(`/p/${p.code}/wa`) },
      { title: 'Anywhere else', body: 'X, LinkedIn, Telegram, SMS, a blog. Use the Other link.', sample: display(`/p/${p.code}/o`) },
    ],
  };
}

const MONTH_START = `date_trunc('month', now() AT TIME ZONE 'Asia/Kolkata') AT TIME ZONE 'Asia/Kolkata'`;

/** L5 — her store link per channel with this month's visits, and each collection's link. */
async function myLinks(influencerId) {
  const store = await storeOf(influencerId);
  const { rows: v } = await db.query(
    `SELECT channel, count(*)::int AS n FROM link_visits WHERE influencer_id = $1 AND kind = 'store' AND visited_at >= ${MONTH_START} GROUP BY 1`, [influencerId]);
  const visits = new Map(v.map((r) => [r.channel, r.n]));
  const { rows: cols } = await db.query(
    `SELECT c.id, c.name, c.kind, c.link_code,
            (SELECT count(*)::int FROM creator_collection_items i WHERE i.collection_id = c.id) AS items,
            (SELECT count(*)::int FROM link_visits lv WHERE lv.collection_id = c.id) AS visits
       FROM creator_collections c WHERE c.influencer_id = $1 ORDER BY c.updated_at DESC`, [influencerId]);
  return {
    store: store && store.handle ? {
      handle: store.handle, url: store.url, display: display(`/s/${store.handle}`),
      links: CHANNELS.map((c) => ({ channel: c.key, label: c.store, url: url(`/s/${store.handle}/${c.key}`), display: display(`/s/${store.handle}/${c.key}`), visits: visits.get(c.key) || 0 })),
    } : null,
    collections: cols.map((c) => ({ id: c.id, name: c.name, kind: c.kind, items: c.items, visits: c.visits,
      url: c.link_code ? url(`/c/${c.link_code}`) : null, display: c.link_code ? display(`/c/${c.link_code}`) : null })),
  };
}

/** L6 — a post's visits and orders by channel, sales and her commission. Never who bought. */
async function statsOf(p) {
  const { rows: v } = await db.query(`SELECT channel, count(*)::int AS n FROM link_visits WHERE post_id = $1 GROUP BY 1`, [p.id]);
  const { rows: o } = await db.query(
    `SELECT COALESCE(link_channel, 'inflx') AS channel, count(*)::int AS orders, COALESCE(SUM(net_amount), 0) AS sales,
            COALESCE(SUM(influencer_commission), 0) AS commission
       FROM follower_transactions WHERE via_post_id = $1 AND status = 'completed' GROUP BY 1`, [p.id]);
  const visits = v.map((r) => ({ channel: r.channel, label: CHANNEL_LABEL[r.channel], visits: r.n })).sort((a, b) => b.visits - a.visits || ORDER.indexOf(a.channel) - ORDER.indexOf(b.channel));
  const orders = o.map((r) => ({ channel: r.channel, label: CHANNEL_LABEL[r.channel], orders: r.orders, sales: Number(r.sales), commission: Number(r.commission) }))
    .sort((a, b) => b.orders - a.orders || ORDER.indexOf(a.channel) - ORDER.indexOf(b.channel));
  const sum = (xs, k) => xs.reduce((n, x) => n + x[k], 0);
  return {
    post_id: p.id, title: p.title, code: p.code, brand_name: p.collaboration.brand_name,
    live_since: p.state === 'live' ? p.live_since : null, state: p.state,
    totals: { visits: sum(visits, 'visits'), orders: sum(orders, 'orders'), sales: sum(orders, 'sales'), commission: Math.round(sum(orders, 'commission') * 100) / 100 },
    visits, orders,
  };
}

async function myStats(influencerId, postId) {
  return statsOf(await posts.getPost(influencerId, postId));
}

/* ───────────────────────────────────────────── the brand (L7, L8) */

async function ownSet(brandUserId, campaignId, setId) {
  const { rows } = await db.query(
    `SELECT cs.id, cs.name AS set_name, c.id AS campaign_id, c.name AS campaign_name, c.brand_id
       FROM campaign_sets cs JOIN campaigns c ON c.id = cs.campaign_id JOIN brands b ON b.id = c.brand_id
      WHERE cs.id = $1 AND c.id = $2 AND b.user_id = $3`, [setId, campaignId, brandUserId]);
  if (!rows[0]) throw notFound();
  return rows[0];
}

const firstName = (name) => String(name || '').trim().split(/\s+/)[0] || '';

async function setPosts(brandUserId, campaignId, setId, { ciId = null } = {}) {
  const set = await ownSet(brandUserId, campaignId, setId);
  const params = [setId];
  let extra = '';
  if (ciId) { params.push(ciId); extra = ` AND cp.campaign_influencer_id = $2`; }
  const { rows } = await db.query(
    `SELECT cp.id FROM creator_posts cp JOIN campaign_influencers ci ON ci.id = cp.campaign_influencer_id
      WHERE cp.v2 AND ci.set_id = $1 AND cp.post_code IS NOT NULL${extra} ORDER BY cp.approved_at`, params);
  const all = await posts.getMany(rows.map((r) => r.id));
  const out = [];
  for (const p of all) {
    const s = await statsOf(p);
    const creator = await storeOf(p.influencer_id);
    out.push({ id: p.id, title: p.title, code: p.code, state: p.state, creator_name: creator ? creator.name : '',
      goes_live_on: p.state === 'approved' ? p.goes_live_on : null, totals: s.totals });
  }
  const live = out.filter((p) => p.state === 'live');
  const { rows: [t] } = await db.query(
    `SELECT count(*)::int AS orders, COALESCE(SUM(ft.net_amount), 0) AS sales, COALESCE(SUM(ft.influencer_commission), 0) AS commission,
            COALESCE(SUM(ft.marketplace_fee_amount), 0) AS fee, COALESCE(SUM(ft.brand_net), 0) AS brand_net
       FROM follower_transactions ft JOIN creator_posts cp ON cp.id = ft.via_post_id JOIN campaign_influencers ci ON ci.id = cp.campaign_influencer_id
      WHERE ci.set_id = $1 AND ft.status = 'completed'`, [setId]);
  const sales = Number(t.sales); const commission = Number(t.commission); const fee = Number(t.fee);
  // What the brand receives is what settlement stores (brand_net), never worked out here.
  const brandNet = Number(t.brand_net);
  const creators = new Set(out.map((p) => p.creator_name));
  return {
    campaign_name: set.campaign_name, set_name: set.set_name, creators: creators.size, live: live.length,
    posts: out,
    totals: { orders: t.orders, sales, commission, inflx_fee: fee, you_receive: brandNet },
    copy_text: live.length
      ? [`Shop our ${set.campaign_name} looks on INFLX. Search a code:`, ...live.map((p) => `${p.code} · ${p.title} by ${firstName(p.creator_name)}`)].join('\n')
      : null,
  };
}

async function brandPostStats(brandUserId, campaignId, setId, postId) {
  await ownSet(brandUserId, campaignId, setId);
  const [p] = await posts.getMany([postId]);
  if (!p || p.set_id !== setId || !p.code) throw notFound();
  return statsOf(p);
}

module.exports = {
  CHANNELS, CHANNEL_LABEL, CODE_RE, channelOf, cleanCode, captionLine, BOT_RE,
  issuePostCode, issueCollectionCode, recordVisit, channelForOrder, realSource,
  resolvePost, resolveStore, resolveCollection, lookupCode,
  shareFor, myLinks, myStats, setPosts, brandPostStats,
};
