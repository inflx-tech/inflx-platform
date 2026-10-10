'use strict';

/**
 * Item 20 — a creator who owns a brand: the link (same number, or the brand's own code), posting for
 * his own brand with no collaboration, the money of a sale through such a post, the link removed,
 * where he shared it, stats, Home, and ownership.
 * Contract: features/item20-own-brand · master rules v1.33 §2D · board L1–L6, B1–B3, C1–C5, S1–S3, M1–M2
 * Real API, real database; every state is reached through the doors a person uses.
 */

const request = require('supertest');
const app = require('../src/app');
const W = require('./helpers/item17');
const H = require('./helpers/offersV2');
const { createBrandUser, createInfluencerUser, registerBrand, registerInfluencer } = require('./helpers/factories');
const settlementJob = require('../src/jobs/commerce-settlement.job');
const commissionConfirm = require('../src/jobs/commission-confirm.job');
const shopperPosts = require('../src/services/shopperPosts.service');
const completeness = require('../src/services/profileCompleteness.service');
const home = require('../src/services/home.service');
const ownBrand = require('../src/services/ownBrand.service');
const { MSG } = require('../src/services/ownBrandCopy');
const POSTS = require('../src/services/postsCopy').MSG;

const { api, query } = W;
const day = H.day;
const num = (v) => Math.round(Number(v) * 100) / 100;
const PP = '/influencers/me/shoppable-posts';
const LINK = '/influencers/me/brand-link';

let admin; let tree; let seq = 0;

beforeAll(async () => {
  admin = await W.fresh();
  tree = await H.tree();
});

/* ───────────────────────────────────────────────────────── fixtures */

const phoneOf = async (userId) => (await query(`SELECT phone FROM users WHERE id = $1`, [userId])).rows[0].phone;
const freshPhone = () => { seq += 1; return `+9197${String(10000000 + seq * 7919 + Math.floor(Math.random() * 1000)).slice(0, 8)}`; };

/** A brand and a creator account on ONE number (each approved on its own). */
async function sameNumberPair({ finishBrand = true } = {}) {
  const phone = freshPhone();
  const bu = await createBrandUser({ phone });
  let brandId = null;
  if (finishBrand) {
    const b = await registerBrand(bu.token, { business_name: `Kavya Fashions ${H.rnd()}`, city: 'Hyderabad', state: 'Telangana' });
    brandId = b.id;
    await query(`UPDATE users SET status = 'approved' WHERE id = $1`, [bu.user.id]);
  }
  const cu = await createInfluencerUser({ phone });
  const inf = await registerInfluencer(cu.token, { instagram_handle: `ravi_${H.rnd()}`, name: 'Ravi Teja', city: 'Hyderabad', state: 'Telangana' });
  await query(`UPDATE users SET status = 'approved' WHERE id = $1`, [cu.user.id]);
  return { phone, b: { token: bu.token, userId: bu.user.id, brandId }, cr: { token: cu.token, userId: cu.user.id, influencerId: inf.id } };
}

const codeFor = async (influencerId) => (await query(
  `SELECT code FROM brand_link_codes WHERE influencer_id = $1 AND used = false ORDER BY created_at DESC LIMIT 1`, [influencerId])).rows[0].code;
const wrongOf = (code) => (code === '111111' ? '222222' : '111111');

/** Link a creator to a brand on another number, with the code sent to the brand's number. */
async function linkByCode(cr, b) {
  const r = await api.post(`${LINK}/code`, cr.token, { phone: await phoneOf(b.userId) });
  if (r.status !== 200) throw new Error(`code: ${JSON.stringify(r.body)}`);
  const c = await api.post(`${LINK}/code/confirm`, cr.token, { otp: await codeFor(cr.influencerId) });
  if (c.status !== 200) throw new Error(`confirm: ${JSON.stringify(c.body)}`);
  return c.body.data.link;
}

/** A store: three products in a running 20% offer, two listed products in no offer, one not listed. */
async function store(b, { from = day(-5), to = day(40) } = {}) {
  seq += 1;
  const inOffer = [];
  for (const price of [2000, 1500, 1000]) inOffer.push(await H.prod(b.brandId, tree.jeans, `Jeans ${seq}-${price}`, price)); // eslint-disable-line no-await-in-loop
  const free = [await H.prod(b.brandId, tree.shirts, `Shirt ${seq}-a`, 899), await H.prod(b.brandId, tree.shirts, `Shirt ${seq}-b`, 1299)];
  const unlisted = await H.prod(b.brandId, tree.shirts, `Shirt ${seq}-hidden`, 700, null, { pushed_to_store: false });
  const offer = await H.ready(b.token, { type: 'discount', sub: 'percentage', name: `Festive 20 ${seq}`, cfg: { pct: 20 }, ids: inOffer, from, to });
  return { inOffer, free, unlisted, offer };
}

const patchPost = (cr, id, body) => api.patch(`${PP}/${id}`, cr.token, body);
const themeTag = async () => (await query(`SELECT id FROM theme_tags WHERE name = 'Festive'`)).rows[0].id;

/** A post for his own brand, up to the step asked: 'draft' | 'ready' (complete, not sent) | 'sent' | 'approved'. */
async function ownPost(cr, b, { kind = 'offer', offer = null, products = [], upTo = 'approved', caption = 'Festive cotton' } = {}) {
  const made = await api.post(PP, cr.token, { own_brand_id: b.brandId });
  if (made.status !== 200 && made.status !== 201) throw new Error(`create: ${JSON.stringify(made.body)}`);
  const id = made.body.data.post.id;
  if (upTo === 'draft') return id;
  let r = await patchPost(cr, id, { post_kind: kind });
  if (kind === 'offer') r = await patchPost(cr, id, { offer_id: offer });
  if (r.status !== 200) throw new Error(`kind/offer: ${JSON.stringify(r.body)}`);
  r = await patchPost(cr, id, { product_ids: products, theme_tag_ids: [await themeTag()], media_kind: 'image', media_layout: 'single' });
  if (r.status !== 200) throw new Error(`products: ${JSON.stringify(r.body)}`);
  const up = await api.post(`${PP}/${id}/upload-url`, cr.token, { content_type: 'image/jpeg', size_bytes: 1024 });
  const u = new URL(up.body.data.url);
  await request(app).put(`${u.pathname}${u.search}`).set('Content-Type', 'image/jpeg').send(Buffer.alloc(1024, 7));
  r = await patchPost(cr, id, { media: [{ r2_key: up.body.data.key, mime: 'image/jpeg' }], caption });
  if (r.status !== 200) throw new Error(`media: ${JSON.stringify(r.body)}`);
  if (upTo === 'ready') return id;
  const sub = await api.post(`${PP}/${id}/submit`, cr.token);
  if (sub.status !== 200) throw new Error(`submit: ${JSON.stringify(sub.body)}`);
  if (upTo === 'sent') return id;
  const ap = await api.post(`/admin/posts/${id}/approve`, admin.token);
  if (ap.status !== 200) throw new Error(`approve: ${JSON.stringify(ap.body)}`);
  return id;
}

/** A linked pair on two numbers with a store and one live own-brand offer post. Shaped for helpers/item17. */
async function ownWorld() {
  const b = await H.brand({ business_name: `Kavya Fashions ${H.rnd()}` });
  const cr = await H.creator({ name: 'Ravi Teja' });
  await linkByCode(cr, b);
  const s = await store(b);
  const post = await ownPost(cr, b, { offer: s.offer, products: s.inOffer });
  return { b, cr, brandId: b.brandId, s, post, ids: s.inOffer };
}

const getPost = async (cr, id) => (await api.get(`${PP}/${id}`, cr.token)).body.data.post;

/* ───────────────────────────────────────────────────────── linking */

describe('linking — only by the brand\'s own number', () => {
  it('the same number: the brand is offered, one tap links it, and the brand is told (L1, B1, B2)', async () => {
    const p = await sameNumberPair();
    const before = (await api.get(LINK, p.cr.token)).body.data;
    expect(before.link).toBeNull();
    expect(before.same_number).toMatchObject({ id: p.b.brandId, status: 'approved', status_chip: 'Approved', can_post: true, city: 'Hyderabad' });

    const r = await api.post(`${LINK}/same-number`, p.cr.token);
    expect(r.status).toBe(200);
    expect(r.body.data.link).toMatchObject({ via: 'same_number', brand: { id: p.b.brandId }, posts: { live: 0, in_review: 0 }, can_create: true, linked_on: H.T() });
    const after = (await api.get(LINK, p.cr.token)).body.data;
    expect(after.same_number).toBeNull();
    expect(after.link.brand.id).toBe(p.b.brandId);

    const [n] = await H.notices(p.b.userId, 'own_brand.linked');
    expect(n.title).toBe('Ravi Teja linked a creator account');
    expect(n.data_json).toMatchObject({ screen: 'linked_creators', influencer_id: p.cr.influencerId });
    const list = (await api.get('/brands/me/linked-creators', p.b.token)).body.data.linked;
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ influencerId: p.cr.influencerId, name: 'Ravi Teja' });
    expect(list[0].linkedOn).toBe(H.T());
  });

  it('a brand registration that was never finished is not a brand: nothing is offered and nothing links', async () => {
    const p = await sameNumberPair({ finishBrand: false });
    expect((await api.get(LINK, p.cr.token)).body.data).toEqual({ link: null, same_number: null });
    const r = await api.post(`${LINK}/same-number`, p.cr.token);
    expect(r.status).toBe(404);
    expect(r.body.error).toMatchObject({ code: 'NO_BRAND', message: MSG.NO_BRAND });
  });

  it('another number: only the code sent to the brand\'s number links it; a wrong code does not (L3, L4)', async () => {
    const b = await H.brand();
    const cr = await H.creator({ name: 'Ravi Teja' });
    const phone = await phoneOf(b.userId);
    const sent = await api.post(`${LINK}/code`, cr.token, { phone: phone.slice(3) });        // typed as ten digits
    expect(sent.status).toBe(200);
    expect(sent.body.data).toMatchObject({ linked: false, expires_in: 900 });
    expect(sent.body.data.sent_to).toBe(`+91 ${phone.slice(3, 5)}••• ••${phone.slice(-3)}`);
    expect(JSON.stringify(sent.body)).not.toContain(await codeFor(cr.influencerId));         // the code never comes back to him

    const code = await codeFor(cr.influencerId);
    const wrong = await api.post(`${LINK}/code/confirm`, cr.token, { otp: wrongOf(code) });
    expect(wrong.status).toBe(401);
    expect(wrong.body.error).toMatchObject({ code: 'WRONG_CODE', message: MSG.WRONG_CODE });
    expect((await api.get(LINK, cr.token)).body.data.link).toBeNull();

    const ok = await api.post(`${LINK}/code/confirm`, cr.token, { otp: code });
    expect(ok.status).toBe(200);
    expect(ok.body.data.link).toMatchObject({ via: 'code', brand: { id: b.brandId, name: b.name } });
    expect((await api.post(`${LINK}/code/confirm`, cr.token, { otp: code })).status).toBe(409);   // used; and he is linked
  });

  it('five wrong codes end the try; so does fifteen minutes', async () => {
    const b = await H.brand();
    const cr = await H.creator();
    await api.post(`${LINK}/code`, cr.token, { phone: await phoneOf(b.userId) });
    const code = await codeFor(cr.influencerId);
    for (let i = 0; i < 4; i += 1) expect((await api.post(`${LINK}/code/confirm`, cr.token, { otp: wrongOf(code) })).status).toBe(401); // eslint-disable-line no-await-in-loop
    const fifth = await api.post(`${LINK}/code/confirm`, cr.token, { otp: wrongOf(code) });
    expect(fifth.status).toBe(429);
    expect(fifth.body.error).toMatchObject({ code: 'TOO_MANY_ATTEMPTS', message: MSG.TOO_MANY_WRONG });
    const late = await api.post(`${LINK}/code/confirm`, cr.token, { otp: code });             // the right code, too late
    expect(late.status).toBe(401);
    expect(late.body.error).toMatchObject({ code: 'LINK_EXPIRED', message: MSG.EXPIRED });

    await api.post(`${LINK}/code`, cr.token, { phone: await phoneOf(b.userId) });
    const again = await codeFor(cr.influencerId);
    await query(`UPDATE brand_link_codes SET expires_at = now() - interval '1 minute' WHERE influencer_id = $1 AND used = false`, [cr.influencerId]);
    expect((await api.post(`${LINK}/code/confirm`, cr.token, { otp: again })).body.error.code).toBe('LINK_EXPIRED');
    expect((await api.get(LINK, cr.token)).body.data.link).toBeNull();
  });

  it('the link code cannot sign anyone in to the brand, and does not cancel a sign-in code in flight', async () => {
    const b = await H.brand();
    const cr = await H.creator();
    const phone = await phoneOf(b.userId);
    // the brand's owner has asked for a sign-in code and not used it yet
    await request(app).post('/v1/auth/send-otp').send({ phone });
    const { rows: [login] } = await query(`SELECT code FROM otp_codes WHERE phone = $1 AND used = false ORDER BY created_at DESC LIMIT 1`, [phone]);

    await api.post(`${LINK}/code`, cr.token, { phone });
    const linkCode = await codeFor(cr.influencerId);
    expect((await query(`SELECT count(*)::int AS n FROM otp_codes WHERE phone = $1 AND code = $2 AND used = false`, [phone, linkCode])).rows[0].n)
      .toBe(linkCode === login.code ? 1 : 0);                                                 // never written as a sign-in code
    if (linkCode !== login.code) {
      const tryLogin = await request(app).post('/v1/auth/verify-otp').send({ phone, otp: linkCode, role: 'brand' });
      expect(tryLogin.status).toBe(401);
    }
    const stillGood = await request(app).post('/v1/auth/verify-otp').send({ phone, otp: login.code, role: 'brand' });
    expect(stillGood.status).toBe(200);
  });

  it('a number with no brand, or not a number: refused, and nothing is sent', async () => {
    const cr = await H.creator();
    const other = await H.creator();                                                          // a number that has only a creator account
    for (const phone of [freshPhone(), await phoneOf(other.userId)]) {
      const r = await api.post(`${LINK}/code`, cr.token, { phone });                          // eslint-disable-line no-await-in-loop
      expect(r.status).toBe(404);
      expect(r.body.error).toMatchObject({ code: 'NO_BRAND', message: MSG.NO_BRAND, field: 'phone' });
    }
    const bad = await api.post(`${LINK}/code`, cr.token, { phone: '12345' });
    expect(bad.status).toBe(422);
    expect(bad.body.error.message).toBe(MSG.INVALID_PHONE);
    expect((await query(`SELECT count(*)::int AS n FROM brand_link_codes WHERE influencer_id = $1`, [cr.influencerId])).rows[0].n).toBe(0);
    expect((await api.post(`${LINK}/code/confirm`, cr.token, { otp: '12' })).status).toBe(422);
  });

  it('one brand per creator; more than one creator per brand (O8, O9)', async () => {
    const b = await H.brand();
    const b2 = await H.brand();
    const cr = await H.creator({ name: 'Ravi Teja' });
    const staff = await H.creator({ name: 'Sneha N' });
    await linkByCode(cr, b);
    await linkByCode(staff, b);
    expect((await api.get('/brands/me/linked-creators', b.token)).body.data.linked.map((x) => x.name).sort()).toEqual(['Ravi Teja', 'Sneha N']);

    const second = await api.post(`${LINK}/code`, cr.token, { phone: await phoneOf(b2.userId) });
    expect(second.status).toBe(409);
    expect(second.body.error).toMatchObject({ code: 'ALREADY_LINKED', message: MSG.ALREADY_LINKED(b.name) });
    expect((await api.post(`${LINK}/same-number`, cr.token)).status).toBe(409);
    expect((await api.get('/brands/me/linked-creators', b2.token)).body.data.linked).toEqual([]);
  });

  it('a creator has five sends a day; a brand\'s number takes three an hour, whoever asks', async () => {
    const b = await H.brand();
    const cr = await H.creator();
    const phone = await phoneOf(b.userId);
    await query(`INSERT INTO brand_link_codes (influencer_id, brand_id, phone, code, used, expires_at, created_at)
                 SELECT $1, $2, '+919000000000', '000000', true, now(), now() - interval '2 hours' FROM generate_series(1, 5)`, [cr.influencerId, b.brandId]);
    const sixth = await api.post(`${LINK}/code`, cr.token, { phone });
    expect(sixth.status).toBe(429);
    expect(sixth.body.error.message).toBe(MSG.TOO_MANY_SENDS);

    const b2 = await H.brand();
    const phone2 = await phoneOf(b2.userId);
    for (let i = 0; i < 3; i += 1) expect((await api.post(`${LINK}/code`, (await H.creator()).token, { phone: phone2 })).status).toBe(200); // eslint-disable-line no-await-in-loop
    const fourth = await api.post(`${LINK}/code`, (await H.creator()).token, { phone: phone2 });
    expect(fourth.status).toBe(429);
    expect(fourth.body.error.message).toBe(MSG.TOO_MANY_TO_NUMBER);
  });

  it('linking works under review, and never changes what is left on the profile (O1)', async () => {
    const b = await H.brand({ status: 'pending' });
    const cr = await H.creator({ status: 'pending' });
    const before = await completeness.forCreator(cr.influencerId);
    const link = await linkByCode(cr, b);
    expect(link.brand).toMatchObject({ status: 'pending', status_chip: 'Under review', can_post: false });
    expect(link.can_create).toBe(false);
    expect(link.brand.note).toBe(`${b.name} is under review. You can post for it once INFLX approves it.`);
    expect(await completeness.forCreator(cr.influencerId)).toEqual(before);
  });

  it('either side removes the link, the other is told, and he can link again (O3, B3)', async () => {
    const b = await H.brand();
    const other = await H.brand();
    const cr = await H.creator({ name: 'Ravi Teja' });
    await linkByCode(cr, b);

    expect((await api.del(`/brands/me/linked-creators/${cr.influencerId}`, other.token)).status).toBe(404);   // not that brand's creator
    expect((await api.get(LINK, cr.token)).body.data.link).not.toBeNull();

    expect((await api.del(`/brands/me/linked-creators/${cr.influencerId}`, b.token)).body.data).toEqual({ removed: true });
    expect((await api.get(LINK, cr.token)).body.data.link).toBeNull();
    const [told] = await H.notices(cr.userId, 'own_brand.removed');
    expect(told).toMatchObject({ title: `${b.name} removed your link`, data_json: { screen: 'my_brand' } });
    expect((await api.get('/brands/me/linked-creators', b.token)).body.data.linked).toEqual([]);
    expect((await api.del(`/brands/me/linked-creators/${cr.influencerId}`, b.token)).status).toBe(404);

    await linkByCode(cr, b);                                                                  // again
    expect((await api.del(LINK, cr.token)).body.data).toEqual({ removed: true });
    const [left] = await H.notices(b.userId, 'own_brand.unlinked');
    expect(left.title).toBe('Ravi Teja removed the link');
    expect((await api.del(LINK, cr.token)).status).toBe(404);
    const { rows } = await query(`SELECT removed_by FROM creator_brand_links WHERE influencer_id = $1 ORDER BY linked_at`, [cr.influencerId]);
    expect(rows.map((x) => x.removed_by)).toEqual(['brand', 'creator']);
  });
});

/* ───────────────────────────────────────────────────────── posting */

describe('posting for his own brand — no collaboration', () => {
  it('Create opens on the link alone; his brand is first in the list, marked as his own (C1, C2)', async () => {
    const b = await H.brand();
    const cr = await H.creator();
    expect((await api.get('/influencers/me/create', cr.token)).body.data).toMatchObject({ can_post: false, own_brand: null });
    await linkByCode(cr, b);
    const h = (await api.get('/influencers/me/create', cr.token)).body.data;
    expect(h).toMatchObject({ can_post: true, needs: [], own_brand: { id: b.brandId, name: b.name, open: true } });
    const list = (await api.get(`${PP}/brands`, cr.token)).body.data.brands;
    expect(list).toEqual([{ id: b.brandId, name: b.name, logo_url: null, own: true, open: true, line: MSG.OWN_LINE }]);
  });

  it('a brand INFLX has not approved is listed closed, and no post can be started for it', async () => {
    const b = await H.brand({ status: 'pending' });
    const cr = await H.creator();
    await linkByCode(cr, b);
    expect((await api.get('/influencers/me/create', cr.token)).body.data).toMatchObject({ can_post: false, own_brand: { open: false } });
    expect((await api.get(`${PP}/brands`, cr.token)).body.data.brands[0]).toMatchObject({ own: true, open: false, line: MSG.OWN_LINE_PENDING });
    const r = await api.post(PP, cr.token, { own_brand_id: b.brandId });
    expect(r.status).toBe(422);
    expect(r.body.error).toMatchObject({ code: 'NOT_POSTABLE', message: MSG.OWN_BRAND_NOT_APPROVED });
  });

  it('a brand he is not linked to cannot be posted for, by any id', async () => {
    const b = await H.brand();
    const cr = await H.creator();
    expect((await api.post(PP, cr.token, { own_brand_id: b.brandId })).status).toBe(404);
    expect((await api.post(PP, cr.token, { own_brand_id: 'not-an-id' })).status).toBe(404);
  });

  it('the choices are the store\'s own: every published offer not ended, and listed products in no offer (C3, O5)', async () => {
    const b = await H.brand();
    const cr = await H.creator();
    await linkByCode(cr, b);
    const s = await store(b);
    const soon = await H.ready(b.token, { type: 'discount', sub: 'percentage', name: 'Starts next week', cfg: { pct: 10 }, ids: [s.free[1]], from: day(5), to: day(30) });
    const draftOffer = await H.ready(b.token, { type: 'discount', sub: 'percentage', name: 'Still a draft', cfg: { pct: 10 }, ids: [], publishIt: false });
    const ended = await H.ready(b.token, { type: 'discount', sub: 'percentage', name: 'Ended', cfg: { pct: 10 }, ids: [s.unlisted], from: day(-20), to: day(-2) }).catch(() => null);
    const elsewhere = await H.brand();
    const theirs = await store(elsewhere);

    const id = await ownPost(cr, b, { upTo: 'draft' });
    const post = await getPost(cr, id);
    expect(post).toMatchObject({ own_brand: true, state: 'draft', for_line: `${b.name} · your brand`,
      collaboration: { id: null, brand_id: b.brandId, brand_name: b.name, campaign_name: null, set_name: null, posting_date: null } });

    const o = (await api.get(`${PP}/${id}/options`, cr.token)).body.data;
    expect(o.own_brand).toBe(true);
    expect(o.collaboration).toEqual({ id: null, brand_name: b.name, campaign_name: null, set_name: null, posting_date: null });
    const offered = o.offers.map((x) => x.id).sort();
    expect(offered).toEqual([s.offer, soon].sort());                                          // running + scheduled; never a draft, an ended one or another brand's
    for (const no of [draftOffer, ended, theirs.offer].filter(Boolean)) expect(offered).not.toContain(no);
    expect(o.offers.every((x) => x.ends_soon === null)).toBe(true);                           // no posting date to measure from
    // listed, and held by no offer TODAY: one free shirt. (The other is booked from day 5 — free today.)
    expect(o.price_products.map((x) => x.id).sort()).toEqual([...s.free].sort());
    expect(o.kinds).toMatchObject({ offer: { available: true, count: 2, why: null }, price: { available: true, count: 2, why: null } });
    expect(o.offer_types_hidden).toMatch(/shown because your store has none\.$/);
  });

  it('an empty store says so in its own words', async () => {
    const b = await H.brand();
    const cr = await H.creator();
    await linkByCode(cr, b);
    const o = (await api.get(`${PP}/${await ownPost(cr, b, { upTo: 'draft' })}/options`, cr.token)).body.data;
    expect(o.kinds).toMatchObject({ offer: { available: false, why: MSG.OWN_NO_OFFERS }, price: { available: false, why: MSG.OWN_NO_FREE_PRODUCTS } });
  });

  it('he cannot use another brand\'s offer or product, nor put a product that is in an offer into a price post (D1)', async () => {
    const b = await H.brand();
    const cr = await H.creator();
    await linkByCode(cr, b);
    const s = await store(b);
    const theirs = await store(await H.brand());

    const offerPost = await ownPost(cr, b, { upTo: 'draft' });
    await patchPost(cr, offerPost, { post_kind: 'offer' });
    const notHis = await patchPost(cr, offerPost, { offer_id: theirs.offer });
    expect(notHis.status).toBe(422);
    expect(notHis.body.error.message).toBe(MSG.OWN_OFFER_NOT_YOURS);
    expect((await patchPost(cr, offerPost, { offer_id: s.offer })).status).toBe(200);
    const outside = await patchPost(cr, offerPost, { product_ids: [s.free[0]] });           // his product, but not in this offer
    expect(outside.body.error.message).toBe(POSTS.PRODUCT_NOT_IN_OFFER);

    const pricePost = await ownPost(cr, b, { upTo: 'draft' });
    await patchPost(cr, pricePost, { post_kind: 'price' });
    for (const ids of [[s.inOffer[0]], [theirs.free[0]], [s.unlisted]]) {
      const r = await patchPost(cr, pricePost, { product_ids: ids });                        // eslint-disable-line no-await-in-loop
      expect(r.status).toBe(422);
      expect(r.body.error.message).toBe(POSTS.PRODUCT_NOT_YOURS);
    }
    expect((await patchPost(cr, pricePost, { product_ids: s.free })).status).toBe(200);
  });

  it('send, INFLX approves, it has its code and is in the shop — with no collaboration anywhere (C4, C5)', async () => {
    const b = await H.brand();
    const cr = await H.creator({ name: 'Ravi Teja' });
    await linkByCode(cr, b);
    const s = await store(b);
    const id = await ownPost(cr, b, { offer: s.offer, products: s.inOffer, upTo: 'sent' });
    expect(await getPost(cr, id)).toMatchObject({ state: 'in_review', code: null, own_brand: true });
    expect(await shopperPosts.isLive(id)).toBe(false);

    const ap = await api.post(`/admin/posts/${id}/approve`, admin.token);
    expect(ap.status).toBe(200);
    const p = await getPost(cr, id);
    expect(p).toMatchObject({ state: 'live', own_brand: true, sales_words: 'No sales yet', goes_live_on: null });
    expect(p.code).toMatch(/^[A-Z0-9]{4,10}$/);
    expect((await query(`SELECT campaign_influencer_id, own_brand, brand_id FROM creator_posts WHERE id = $1`, [id])).rows[0])
      .toEqual({ campaign_influencer_id: null, own_brand: true, brand_id: b.brandId });

    expect(await shopperPosts.isLive(id)).toBe(true);
    expect((await shopperPosts.livePool({ brandId: b.brandId })).map((x) => x.id)).toEqual([id]);             // the brand's store
    expect((await shopperPosts.livePool({ influencerId: cr.influencerId })).map((x) => x.id)).toEqual([id]); // his store
    const typed = (await request(app).get(`/v1/links/code/${p.code}`).set({ 'x-device-id': 'dev-20' })).body.data;
    expect(typed).toMatchObject({ state: 'live' });

    const mine = (await api.get(PP, cr.token)).body.data;
    expect(mine.counts.live).toBe(1);
    expect(mine.posts[0]).toMatchObject({ id, own_brand: true });
    const share = await api.get(`${PP}/${id}/share`, cr.token);
    expect(share.status).toBe(200);
    expect(share.body.data).toMatchObject({ code: p.code, brand_name: b.name });
    const told = await H.notices(cr.userId, 'post.approved');
    expect(told).toHaveLength(1);

    // the brand's own offer page counts it as a live post; it is on no creator's row
    const view = (await api.get(`/brands/me/offers/${s.offer}`, b.token)).body.data;
    expect(view.posts.live).toBe(1);
    expect(view.creators).toEqual([]);
  });

  it('a price post for his own store goes the same way', async () => {
    const b = await H.brand();
    const cr = await H.creator();
    await linkByCode(cr, b);
    const s = await store(b);
    const id = await ownPost(cr, b, { kind: 'price', products: s.free });
    expect(await getPost(cr, id)).toMatchObject({ state: 'live', kind: 'price', offer: null, own_brand: true });
    expect(await shopperPosts.isLive(id)).toBe(true);
  });

  it('beside his own brand he is an ordinary creator: the collaboration post is untouched, and the list holds both (O7)', async () => {
    const w = await W.saleWorld();                                                            // a signed Pay for Sale collaboration with a live post
    const b = await H.brand();
    await linkByCode(w.cr, b);
    const s = await store(b);
    const own = await ownPost(w.cr, b, { offer: s.offer, products: s.inOffer });

    const list = (await api.get(`${PP}/brands`, w.cr.token)).body.data.brands;
    expect(list.map((x) => [x.id, x.own, x.open])).toEqual([[b.brandId, true, true], [w.brandId, false, true]]);
    const collabPost = await getPost(w.cr, w.post);
    expect(collabPost).toMatchObject({ own_brand: false, state: 'live', collaboration: { id: w.ciId, campaign_name: 'Diwali Denim' } });
    expect(collabPost.for_line).toBe(`${collabPost.collaboration.brand_name} · Diwali Denim · ${collabPost.collaboration.set_name}`);
    const again = await api.post(PP, w.cr.token, { campaign_influencer_id: w.ciId });        // the old door still makes a collaboration post
    expect(again.body.data.post).toMatchObject({ own_brand: false, collaboration: { id: w.ciId } });
    const opts = (await api.get(`${PP}/${again.body.data.post.id}/options`, w.cr.token)).body.data;
    expect(opts.own_brand).toBe(false);
    expect(opts.offers.map((x) => x.id)).toEqual([w.deal]);                                   // the collaboration's offer only, never the other store's
    expect((await api.get(PP, w.cr.token)).body.data.posts.map((x) => x.id)).toEqual(expect.arrayContaining([own, w.post]));
  });
});

/* ───────────────────────────────────────────────────────── money */

describe('a sale through an own-brand post', () => {
  it('the offer price applies, there is no commission, INFLX takes the brand\'s usual share and the rest is the brand\'s (O6)', async () => {
    const w = await ownWorld();
    const before = await W.money(w);
    const o = await W.order(w, [0]);                                                          // ₹2,000 jeans at 20% off
    const ln = o.lines[0];
    expect(num(ln.paid_total)).toBe(1600);
    expect(ln).toMatchObject({ campaign_influencer_id: null, post_id: w.post, influencer_id: w.cr.influencerId, brand_id: w.brandId });
    expect(num(ln.commission)).toBe(0);
    expect(num(ln.commission_pct)).toBe(0);
    expect(num(ln.fee_pct)).toBeGreaterThan(0);
    expect(num(ln.platform_fee)).toBe(num(1600 * num(ln.fee_pct) / 100));
    expect(num(Number(ln.platform_fee) + Number(ln.brand_net))).toBe(1600);                   // two shares, to the paisa
    expect(o.tx).toMatchObject({ campaign_influencer_id: null, campaign_id: null, set_id: null, via_post_id: w.post });
    expect(num(o.tx.influencer_commission)).toBe(0);
    const after = await W.money(w);
    expect(after).toMatchObject({ her: before.her, her_pending: before.her_pending, brand: before.brand });   // nothing moves at the sale
  });

  it('the brand\'s Sales money shows it as its own post with no creator share; the share is added after delivery and the return window (M1, M2)', async () => {
    const w = await ownWorld();
    const o = await W.order(w, [0]);
    const ln = o.lines[0];
    const s = (await api.get('/brands/me/wallet/sales', w.b.token)).body.data;
    expect(s.totals).toMatchObject({ sales: 1, coming: num(ln.brand_net), comingCount: 1 });
    expect(s.sales).toHaveLength(1);
    expect(s.sales[0]).toMatchObject({ id: ln.id, ownBrand: true, paid: 1600, commissionPct: 0, creatorShare: 0, inflxShare: num(ln.platform_fee),
      brandShare: num(ln.brand_net), campaignName: null, setName: null, state: 'not_shipped' });
    expect(s.sales[0].post.code).toBeTruthy();

    const m0 = await W.money(w);
    await settlementJob.run(); await commissionConfirm.run();                                 // not delivered: nothing moves
    expect((await W.money(w)).brand).toBe(m0.brand);
    await W.closeWindow(o.tx.id);
    await W.deliver(w, o.parcel.id, 40);                                                      // delivered, and its window has closed
    await settlementJob.run(); await commissionConfirm.run();
    const m1 = await W.money(w);
    expect(num(m1.brand - m0.brand)).toBe(num(ln.brand_net));
    expect(m1).toMatchObject({ her: m0.her, her_pending: m0.her_pending });                   // never the creator's wallet
    await settlementJob.run(); await commissionConfirm.run();                                 // a second run adds nothing
    expect((await W.money(w)).brand).toBe(m1.brand);
    const done = (await api.get('/brands/me/wallet/sales?filter=added', w.b.token)).body.data;
    expect(done.totals).toMatchObject({ coming: 0, added: num(ln.brand_net) });
    expect(done.sales[0]).toMatchObject({ id: ln.id, state: 'added', ownBrand: true });
    // the brand's parcel list (the website's Orders) marks it too
    const parcels = (await api.get('/brands/me/parcels', w.b.token)).body.data.parcels;
    expect(parcels[0].items[0]).toMatchObject({ post: { id: w.post, own_brand: true }, money: { creator_share: 0, creator_pct: 0 } });
  });

  it('a cancelled item and a returned one go as any sale does: refunded, never added, and nothing touches the creator\'s wallet', async () => {
    const w = await ownWorld();
    const o = await W.order(w, [0, 1]);                                                       // ₹1,600 and ₹1,200
    const [kept, gone] = o.lines;
    const before = await W.money(w);
    const cancel = await api.post(`/follower/orders/lines/${gone.id}/cancel`, o.sh.token, { reason: 'Found a better price' });
    expect(cancel.status).toBe(200);
    let s = (await api.get('/brands/me/wallet/sales', w.b.token)).body.data;
    expect(s.sales.find((x) => x.id === gone.id)).toMatchObject({ state: 'cancelled', ownBrand: true, brandShare: 0, creatorShare: 0, inflxShare: 0 });
    expect(s.totals).toMatchObject({ sales: 1, coming: num(kept.brand_net) });

    await W.deliver(w, o.parcel.id);                                                          // the other item arrives, and is sent back
    const ask = await api.post(`/follower/orders/lines/${kept.id}/return`, o.sh.token, { reason: 'wrong_size', note: 'Too tight' });
    expect(ask.status).toBe(200);
    const { rows: [ret] } = await query(`SELECT id FROM follower_returns WHERE order_line_id = $1`, [kept.id]);
    expect((await api.post(`/admin/returns/${ret.id}/approve`, admin.token, {})).status).toBe(200);
    const refunded = await api.post(`/admin/returns/${ret.id}/mark-refunded`, admin.token, {});
    expect(refunded.status).toBe(200);
    expect(refunded.body.data).toMatchObject({ return_status: 'refunded', refund: { amount: num(kept.paid_total) } });

    await W.closeWindow(o.tx.id);
    await query(`UPDATE follower_orders SET delivered_at = now() - interval '40 days' WHERE id = $1`, [o.parcel.id]);
    await settlementJob.run(); await commissionConfirm.run();
    expect(await W.money(w)).toMatchObject({ brand: before.brand, her: before.her, her_pending: before.her_pending });
    s = (await api.get('/brands/me/wallet/sales', w.b.token)).body.data;
    expect(s.sales.find((x) => x.id === kept.id)).toMatchObject({ state: 'returned', ownBrand: true, brandShare: 0 });
    expect(s.totals).toMatchObject({ coming: 0, added: 0 });
  });

  it('the creator\'s wallet never holds an own-brand sale; his commission from another brand is as before (O6, O7)', async () => {
    const w = await W.saleWorld();                                                            // brand A: 10% commission
    const b = await H.brand();
    await linkByCode(w.cr, b);
    const s = await store(b);
    const own = { b, cr: w.cr, brandId: b.brandId, post: await ownPost(w.cr, b, { offer: s.offer, products: s.inOffer }), ids: s.inOffer };

    const collabSale = await W.order(w, [0]);
    await W.order(own, [0]);
    await W.order(own, [1]);

    const c = (await api.get('/influencers/me/wallet/commission', w.cr.token)).body.data;
    expect(c.totals).toMatchObject({ sales: 1, inWindow: num(collabSale.lines[0].commission) });
    expect(c.sales.map((x) => x.id)).toEqual([collabSale.lines[0].id]);
    expect(c.sales[0]).toMatchObject({ ownBrand: false, commissionPct: 10 });
    const fig = (await api.get('/influencers/me/wallet', w.cr.token)).body.data.figures;
    expect(fig).toMatchObject({ commissionCount: 1, commission: num(collabSale.lines[0].commission) });

    // brand A still sees its creator's share; brand B sees two own posts' sales
    expect((await api.get('/brands/me/wallet/sales', w.b.token)).body.data.sales[0]).toMatchObject({ ownBrand: false, commissionPct: 10, creatorShare: num(collabSale.lines[0].commission) });
    const mine = (await api.get('/brands/me/wallet/sales', b.token)).body.data;
    expect(mine.totals.sales).toBe(2);
    expect(mine.sales.every((x) => x.ownBrand && x.creatorShare === 0)).toBe(true);
    // his posts say what each is worth to him
    expect((await getPost(w.cr, own.post)).sales_words).toBe('2 sales · ₹2,800');
    expect((await getPost(w.cr, w.post)).sales_words).toMatch(/^1 sale · ₹[\d,.]+ to you$/);
  });
});

/* ───────────────────────────────────────────────────────── the link removed */

describe('when the link is removed (O10)', () => {
  it('live posts stay and keep selling; a new post, a draft and a post in review go no further', async () => {
    const w = await ownWorld();
    const draft = await ownPost(w.cr, w.b, { offer: w.s.offer, products: w.s.inOffer, upTo: 'ready' });
    const sent = await ownPost(w.cr, w.b, { kind: 'price', products: w.s.free, upTo: 'sent' });

    await api.del(`/brands/me/linked-creators/${w.cr.influencerId}`, w.b.token);

    expect(await shopperPosts.isLive(w.post)).toBe(true);
    const o = await W.order(w, [1]);                                                          // it still sells
    expect(num(o.lines[0].paid_total)).toBe(1200);
    expect((await getPost(w.cr, w.post)).state).toBe('live');

    expect((await api.get('/influencers/me/create', w.cr.token)).body.data).toMatchObject({ can_post: false, own_brand: null });
    expect((await api.get(`${PP}/brands`, w.cr.token)).body.data.brands).toEqual([]);
    expect((await api.post(PP, w.cr.token, { own_brand_id: w.brandId })).status).toBe(404);

    const send = await api.post(`${PP}/${draft}/submit`, w.cr.token);
    expect(send.status).toBe(422);
    expect(send.body.error.message).toBe(MSG.OWN_NOT_LINKED);

    const ap = await api.post(`/admin/posts/${sent}/approve`, admin.token);
    expect(ap.status).toBe(422);
    expect(ap.body.error).toMatchObject({ code: 'POST_STALE', message: POSTS.STALE(MSG.OWN_NOT_LINKED) });
    expect((await getPost(w.cr, sent)).state).toBe('in_review');
    expect((await api.post(`/admin/posts/${sent}/reject`, admin.token, { reason: 'The link was removed' })).status).toBe(200);   // INFLX can still send it back
  });
});

/* ───────────────────────────────────────────────────────── where he shared it */

describe('where he shared it — his own record, nobody approves (O12)', () => {
  const places = (cr, id) => `${PP}/${id}/places`;

  it('add, change and remove a place; a link must be the right site; a story needs none (S1, S2)', async () => {
    const w = await ownWorld();
    const url = places(w.cr, w.post);
    const empty = (await api.get(url, w.cr.token)).body.data;
    expect(empty).toMatchObject({ post_id: w.post, can_edit: true, places: [] });
    expect(empty.options.map((x) => x.key)).toEqual(['reel', 'post', 'story', 'youtube_video', 'youtube_short', 'facebook_post']);
    expect(empty.options.find((x) => x.key === 'story').link).toBe('optional');

    const reel = await api.post(url, w.cr.token, { place: 'reel', link: 'instagram.com/reel/C9xK2abc/?igsh=zz' });   // typed without https
    expect(reel.status).toBe(200);
    expect(reel.body.data.places[0]).toMatchObject({ place: 'reel', label: 'Instagram reel', short: 'Reel', channel: 'ig',
      link: 'https://instagram.com/reel/C9xK2abc/?igsh=zz', link_display: 'instagram.com/reel/C9xK2abc' });
    expect((await api.post(url, w.cr.token, { place: 'story' })).status).toBe(200);
    expect((await api.post(url, w.cr.token, { place: 'youtube_short', link: 'https://youtube.com/shorts/aB3f' })).status).toBe(200);
    const all = (await api.get(url, w.cr.token)).body.data.places;
    expect(all.map((x) => [x.place, x.channel, !!x.link])).toEqual([['reel', 'ig', true], ['story', 'ig', false], ['youtube_short', 'yt', true]]);

    for (const [body, message] of [
      [{ place: 'reel' }, MSG.PLACE_LINK_NEEDED],
      [{ place: 'reel', link: 'https://youtube.com/shorts/aB3f' }, MSG.PLACE_LINK_BAD('Instagram')],
      [{ place: 'facebook_post', link: 'https://example.com/post/1' }, MSG.PLACE_LINK_BAD('Facebook')],
      [{ place: 'youtube_video', link: 'https://youtube.com' }, MSG.PLACE_LINK_BAD('YouTube')],
      [{ place: 'tiktok', link: 'https://tiktok.com/x' }, MSG.PLACE_UNKNOWN],
    ]) {
      const r = await api.post(url, w.cr.token, body);                                        // eslint-disable-line no-await-in-loop
      expect(r.status).toBe(422);
      expect(r.body.error.message).toBe(message);
    }

    const changed = await api.patch(`${url}/${all[1].id}`, w.cr.token, { place: 'post', link: 'https://www.instagram.com/p/Cabc/' });
    expect(changed.body.data.places.find((x) => x.id === all[1].id)).toMatchObject({ place: 'post', label: 'Instagram post', link_display: 'instagram.com/p/Cabc' });
    const gone = await api.del(`${url}/${all[0].id}`, w.cr.token);
    expect(gone.body.data.places.map((x) => x.place).sort()).toEqual(['post', 'youtube_short']);
    expect((await api.del(`${url}/${all[0].id}`, w.cr.token)).status).toBe(404);
  });

  it('only on an approved post for his own brand, and only his own', async () => {
    const w = await ownWorld();
    const draft = await ownPost(w.cr, w.b, { upTo: 'draft' });
    const sent = await ownPost(w.cr, w.b, { kind: 'price', products: w.s.free, upTo: 'sent' });
    for (const id of [draft, sent]) {
      const r = await api.post(places(w.cr, id), w.cr.token, { place: 'story' });             // eslint-disable-line no-await-in-loop
      expect(r.status).toBe(409);
      expect(r.body.error.message).toBe(MSG.PLACE_NOT_YET);
    }
    expect((await api.get(places(w.cr, draft), w.cr.token)).body.data.can_edit).toBe(false);

    const collab = await W.saleWorld();                                                       // a collaboration post: it has its own social step
    const no = await api.post(places(collab.cr, collab.post), collab.cr.token, { place: 'story' });
    expect(no.status).toBe(422);
    expect(no.body.error).toMatchObject({ code: 'NOT_OWN_BRAND', message: MSG.PLACE_OWN_ONLY });

    const stranger = await H.creator();
    expect((await api.get(places(w.cr, w.post), stranger.token)).status).toBe(404);
    expect((await api.post(places(w.cr, w.post), stranger.token, { place: 'story' })).status).toBe(404);
  });

  it('Stats lists the places under their channel and carries sales; nothing is counted per place (S3)', async () => {
    const w = await ownWorld();
    const url = places(w.cr, w.post);
    await api.post(url, w.cr.token, { place: 'reel', link: 'https://www.instagram.com/reel/C9xK2/' });
    await api.post(url, w.cr.token, { place: 'story' });
    await api.post(url, w.cr.token, { place: 'youtube_short', link: 'https://youtube.com/shorts/aB3f' });
    const code = (await getPost(w.cr, w.post)).code;
    await request(app).get(`/v1/links/p/${code}?ch=ig`).set({ 'x-visitor-ua': 'Mozilla/5.0' });   // one tap on his Instagram link
    await W.order(w, [0]);

    const st = (await api.get(`${PP}/${w.post}/stats`, w.cr.token)).body.data;
    expect(st).toMatchObject({ own_brand: true, totals: { visits: 1, orders: 1, sales: 1600, commission: 0 } });
    const ig = st.visits.find((x) => x.channel === 'ig');
    expect(ig).toMatchObject({ label: 'Instagram', visits: 1 });
    expect(ig.places.map((x) => x.short)).toEqual(['Reel', 'Story']);
    const yt = st.visits.find((x) => x.channel === 'yt');                                     // shared there, no visit yet: shown at 0
    expect(yt).toMatchObject({ label: 'YouTube', visits: 0 });
    expect(yt.places.map((x) => x.short)).toEqual(['Short']);
    for (const pl of [...ig.places, ...yt.places]) for (const k of ['visits', 'orders', 'sales']) expect(pl).not.toHaveProperty(k);

    const collab = await W.saleWorld();                                                       // a collaboration post's stats are as they were
    const cs = (await api.get(`${PP}/${collab.post}/stats`, collab.cr.token)).body.data;
    expect(cs.own_brand).toBe(false);
    expect(cs.visits.every((x) => x.places === undefined)).toBe(true);
  });
});

/* ───────────────────────────────────────────────────────── Home, and who may see what */

describe('Home and ownership', () => {
  it('an own-brand post sent back is in Needs you, one in review in Waiting on others, with the brand named', async () => {
    const w = await ownWorld();
    const sent = await ownPost(w.cr, w.b, { kind: 'price', products: w.s.free, upTo: 'sent' });
    let lists = await home.creatorLists(w.cr.influencerId);
    const waiting = lists.waiting.find((x) => x.kind === 'post_in_review');
    expect(waiting).toMatchObject({ postId: sent, context: `${w.b.name} · your brand` });
    await api.post(`/admin/posts/${sent}/reject`, admin.token, { reason: 'Show the product in the first frame' });
    lists = await home.creatorLists(w.cr.influencerId);
    expect(lists.needs.find((x) => x.kind === 'post_sent_back')).toMatchObject({ postId: sent, context: `${w.b.name} · your brand` });
    expect(lists.needs.some((x) => x.kind === 'post_needed')).toBe(false);                    // nothing is owed: there is no minimum
    expect((await api.get('/influencers/me/home', w.cr.token)).status).toBe(200);
  });

  it('INFLX\'s reviewer sees which brand a creator is linked to', async () => {
    const w = await ownWorld();
    const names = await ownBrand.linkedBrandNames([w.cr.influencerId, (await H.creator()).influencerId]);
    expect([...names.entries()]).toEqual([[w.cr.influencerId, w.b.name]]);
  });

  it('each side has its own doors; nobody reads or changes another\'s link', async () => {
    const w = await ownWorld();
    const stranger = await H.creator();
    const otherBrand = await H.brand();
    expect((await api.get(LINK, w.b.token)).status).toBe(403);
    expect((await api.post(`${LINK}/same-number`, w.b.token)).status).toBe(403);
    expect((await api.get('/brands/me/linked-creators', w.cr.token)).status).toBe(403);
    expect((await request(app).get(`/v1${LINK}`)).status).toBe(401);
    expect((await request(app).get('/v1/brands/me/linked-creators')).status).toBe(401);
    expect((await api.get(LINK, stranger.token)).body.data).toEqual({ link: null, same_number: null });
    expect((await api.get('/brands/me/linked-creators', otherBrand.token)).body.data.linked).toEqual([]);
    expect((await api.get(`${PP}/${w.post}`, stranger.token)).status).toBe(404);
    expect((await api.get(`${PP}/${w.post}/options`, stranger.token)).status).toBe(404);
  });
});
