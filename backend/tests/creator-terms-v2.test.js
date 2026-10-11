'use strict';

/**
 * creator-terms-v2 — what a creator can sell in a collaboration (Level 2). Contract:
 * features/creator-terms-v2 · Docs/OFFER_TERMS_POSTS_RULES.md §2 · checks in 03-expected-outputs.md.
 * Real API, real database. Offers are built with the Level 1 builder (helpers/offersV2).
 */

const { truncateAll } = require('./helpers/db');
const H = require('./helpers/offersV2');
const { api, query, day } = H;
const terms = require('../src/services/creatorTerms.service');
const agreementTerms = require('../src/services/agreementTerms.service');
const publishGate = require('../src/services/publishGate.service');

let B, t, other;
beforeAll(async () => {
  await truncateAll();
  B = await H.brand();
  other = await H.brand();
  t = await H.tree();
});

async function campaignSet(b, over = {}) {
  const c = await api.post('/campaigns', b.token, { name: 'Diwali Denim' });
  const s = await api.post(`/campaigns/${c.body.data.campaign.id}/sets`, b.token,
    { name: 'Set A', goal: 'conversion', shoot_mode: 'shipment', go_live_date: day(10), ...over });
  if (s.status !== 201) throw new Error(JSON.stringify(s.body));
  return { cid: c.body.data.campaign.id, sid: s.body.data.set.id, url: `/campaigns/${c.body.data.campaign.id}/sets/${s.body.data.set.id}` };
}
const invite = (b, w, creators) => api.post(`${w.url}/invitations`, b.token, { creators });
const sale = (cr, sell, pct = 10) => ({ influencerId: cr.influencerId, terms: { commissionPct: pct, ...sell } });
const ciOf = async (w, cr) => (await query(`SELECT * FROM campaign_influencers WHERE set_id = $1 AND influencer_id = $2`, [w.sid, cr.influencerId])).rows[0];
const links = async (ciId) => (await query(`SELECT offer_id, dropped_at, dropped_reason FROM collab_offers WHERE campaign_influencer_id = $1 ORDER BY linked_at`, [ciId])).rows;

describe('the offers a brand can give for a set (check 1, 2)', () => {
  let w, valid, late, early, soon, drafted, ended;
  beforeAll(async () => {
    w = await campaignSet(B);              // posting day(10)
    const p = async (n) => H.prod(B.brandId, t.jeans, `Choice jeans ${n}`, 1500 + n);
    valid = await H.ready(B.token, { name: 'Runs over posting', ids: [await p(1)], from: day(1), to: day(30) });
    await H.ready(B.token, { name: 'Starts the day after', ids: [await p(2)], from: day(11), to: day(30) });
    late = await H.ready(B.token, { name: 'Starts too late', ids: [await p(3)], from: day(12), to: day(30) });
    early = await H.ready(B.token, { name: 'Over before posting', ids: [await p(4)], from: day(1), to: day(9) });
    await H.ready(B.token, { name: 'Ends on the posting day', ids: [await p(8)], from: day(1), to: day(10) });
    soon = await H.ready(B.token, { name: 'Ends soon', ids: [await p(5)], from: day(1), to: day(15) });
    drafted = await H.ready(B.token, { name: 'Just a draft', ids: [await p(6)], from: day(1), to: day(30), publishIt: false });
    ended = await H.ready(B.token, { name: 'Ended early', ids: [await p(7)], from: day(1), to: day(30) });
    await api.post(`/brands/me/offers/${ended}/end`, B.token);
    await H.ready(other.token, { name: 'Another brand', ids: [await H.prod(other.brandId, t.jeans, 'x', 900)], from: day(1), to: day(30) });
  });

  // BUSINESS-RULE DRIFT, posting-date-last-day (founder, 1 Oct 2026; rules v1.15 §2.3): was "valid on
  // the posting date or the day after". The posting date is now the last day to go live, so an offer
  // must start on or before it and end at least a day after it: "Starts the day after" left the list,
  // and one ending on the posting day itself is not offered either.
  test('starts on or before the posting date and ends after it; others are left out with the reason', async () => {
    const r = await api.get(`${w.url}/offer-choices`, B.token);
    expect(r.status).toBe(200);
    const names = r.body.data.offers.map((o) => o.name).sort();
    expect(names).toEqual(['Ends soon', 'Runs over posting']);
    const hidden = Object.fromEntries(r.body.data.hidden.map((h) => [h.name, h.why]));
    expect(hidden).toMatchObject({ 'Starts the day after': 'starts', 'Starts too late': 'starts', 'Over before posting': 'ends', 'Ends on the posting day': 'ends', 'Ended early': 'ended' });
    expect(hidden['Just a draft']).toBeUndefined();
    expect(names).not.toContain('Another brand');
    const row = r.body.data.offers.find((o) => o.name === 'Runs over posting');
    expect(row).toMatchObject({ type_label: 'BOGO', products: 1, deal: 'Buy one, get the same product free', ends_soon: null });
    expect(r.body.data.offers.find((o) => o.name === 'Ends soon').ends_soon).toEqual({ days_after_posting: 5 });
    expect([valid, late, early, soon, drafted]).toHaveLength(5);
  });

  test('another brand\'s set answers 404', async () => {
    expect((await api.get(`${w.url}/offer-choices`, other.token)).status).toBe(404);
  });
});

describe('products without offers for a set (check 3)', () => {
  // BUSINESS-RULE DRIFT, posting-date-last-day (rules v1.15 §2.4): was "not held by an offer on or after
  // the posting date", so a product whose offer ran day 1–5 was free for a day-10 posting. Her post at
  // normal price can now be live from its approval, so the product must be free from TODAY.
  test('only products not held by any offer from today on; an offer that is already over frees them', async () => {
    const X = await H.brand();
    const w = await campaignSet(X);
    const free = await H.prod(X.brandId, t.shirts, 'Free shirt', 1299);
    const later = await H.prod(X.brandId, t.shirts, 'Joins an offer later', 999);
    const before = await H.prod(X.brandId, t.shirts, 'Offer ended before posting', 899);
    await H.ready(X.token, { ids: [later], from: day(20), to: day(25) });
    await H.ready(X.token, { ids: [before], from: day(1), to: day(5) });
    const over = await H.prod(X.brandId, t.shirts, 'Offer already over', 799);
    await api.post(`/brands/me/offers/${await H.ready(X.token, { ids: [over], from: day(-3), to: day(5) })}/end`, X.token);
    const r = await api.get(`${w.url}/products-without-offers`, X.token);
    expect(r.body.data.products.map((p) => p.id).sort()).toEqual([free, over].sort());
  });
});

describe('sending the new terms (checks 4–8)', () => {
  let X, w, o1, o2, p1, p2, fresh;
  beforeAll(async () => {
    X = await H.brand();
    w = await campaignSet(X);
    o1 = await H.ready(X.token, { name: '20% off jeans', type: 'discount', sub: 'percentage', cfg: { pct: 20, max_off: 400 }, ids: [await H.prod(X.brandId, t.jeans, 'Levi 511', 2299)], from: day(1), to: day(30) });
    o2 = await H.ready(X.token, { type: 'bundle', sub: 'pick_any', name: 'Any 2 for 2999', cfg: { pick: 2, price: 2999 },
      ids: [await H.prod(X.brandId, t.trousers, 'T1', 1699), await H.prod(X.brandId, t.trousers, 'T2', 1749)], from: day(10), to: day(40) });
    p1 = await H.prod(X.brandId, t.shirts, 'Oxford white', 1299);
    p2 = await H.prod(X.brandId, t.shirts, 'Oxford blue', 1299);
  });

  test('offers linked (not copied), products frozen, nothing of the old scope or code written', async () => {
    const cr = await H.creator({ name: 'Priya Sharma' });
    const r = await invite(X, w, [sale(cr, { offers: [o1, o2], productsWithoutOffers: { mode: 'chosen', productIds: [p1] } })]);
    expect(r.status).toBe(201);
    const ci = await ciOf(w, cr);
    expect(ci).toMatchObject({ sell_v2: true, sell_mode: 'chosen', sell_product_ids: [p1], alloc_scope: null, offer_type: null, brand_offer_id: null, coupon_code: null });
    expect((await links(ci.id)).map((l) => l.offer_id).sort()).toEqual([o1, o2].sort());
  });

  test('"All products without offers" is the list on the day of sending — later products don\'t join (founder Q2)', async () => {
    const cr = await H.creator({ name: 'Divya R.' });
    await invite(X, w, [sale(cr, { offers: [], productsWithoutOffers: { mode: 'all' } })]);
    const ci = await ciOf(w, cr);
    expect(ci.sell_mode).toBe('all');
    expect(ci.sell_product_ids.sort()).toEqual([p1, p2].sort());
    fresh = await H.prod(X.brandId, t.shirts, 'Listed after sending', 1099);
    const read = await api.get(`/influencers/me/invitations/${ci.id}/sell`, cr.token);
    expect(read.body.data.products.list.map((p) => p.id)).not.toContain(fresh);
    expect(read.body.data.words).toBe('2 products at normal price');
  });

  test('refused: nothing to sell (her first name), an offer not running on the day, another brand\'s offer, a product held by an offer, the old scope', async () => {
    const cr = await H.creator({ name: 'Sneha N.' });
    const say = async (sell) => (await invite(X, w, [sale(cr, sell)])).body.error.message;
    expect(await say({ offers: [], productsWithoutOffers: { mode: 'none' } })).toBe('Give Sneha at least one offer or one product without an offer.');
    const late = await H.ready(X.token, { name: 'Late start', ids: [await H.prod(X.brandId, t.jackets, 'J', 3000)], from: day(15), to: day(30) });
    expect(await say({ offers: [late] })).toMatch(/^"Late start" has to start by \d+ \w+ and end after it\. It can't be given for this set\.$/);
    const foreign = await H.ready(other.token, { ids: [await H.prod(other.brandId, t.jackets, 'Oj', 3000)], from: day(1), to: day(30) });
    expect(await say({ offers: [foreign] })).toBe("One of those offers isn't one of yours.");
    const held = (await query(`SELECT product_id FROM offer_pool_items WHERE offer_id = $1`, [o1])).rows[0].product_id;
    expect(await say({ productsWithoutOffers: { mode: 'chosen', productIds: [held] } })).toBe('"Levi 511" is in an offer, now or later. To give it, give its offer.');
    const old = await invite(X, w, [{ influencerId: cr.influencerId, terms: { commissionPct: 10, scope: 'store' } }]);
    expect(old.status).toBe(422);
    expect(old.body.error.details.failures[0].message).toBe('What a creator can sell has changed. Update the app, then set her terms again.');
  });

  test('Pay for Sale commission must be above 0 (rules 2.2)', async () => {
    const cr = await H.creator();
    const r = await invite(X, w, [sale(cr, { offers: [o1] }, 0)]);
    expect(r.status).toBe(422);
  });

  test('the brand reads "10% · 2 offers + 1 product"; the invitation carries the sell block', async () => {
    const r = await api.get(`${w.url}/summary`, X.token);
    const rows = JSON.stringify(r.body);
    expect(rows).toContain('10% · 2 offers + 1 product');
    const ci = (await query(`SELECT id FROM campaign_influencers WHERE set_id = $1 AND sell_mode = 'chosen'`, [w.sid])).rows[0];
    const d = await api.get(`${w.url}/invitations/${ci.id}`, X.token);
    expect(d.body.data.invitation.terms.sell.words).toBe('2 offers + 1 product');
    expect(d.body.data.invitation.terms.scope).toBeNull();
    expect(d.body.data.invitation.terms.offer).toBeNull();
  });
});

describe('what the creator sees (checks 9–12)', () => {
  let X, w, cr, ci, o1, o2;
  beforeAll(async () => {
    X = await H.brand();
    w = await campaignSet(X);
    o1 = await H.ready(X.token, { name: '20% off Levi\'s Jeans', type: 'discount', sub: 'percentage', cfg: { pct: 20, max_off: 400 },
      ids: [await H.prod(X.brandId, t.jeans, 'Levi 511', 2299), await H.prod(X.brandId, t.jeans, 'Levi 512', 2499)], from: day(1), to: day(30) });
    o2 = await H.ready(X.token, { type: 'bundle', sub: 'pick_any', name: 'Any 2 Jeans for ₹2,999', cfg: { pick: 2, price: 2999 },
      ids: [await H.prod(X.brandId, t.trousers, 'T1', 1699), await H.prod(X.brandId, t.trousers, 'T2', 1749)], from: day(10), to: day(40) });
    const p = await H.prod(X.brandId, t.shirts, 'Shirt', 1299);
    cr = await H.creator({ name: 'Priya Sharma' });
    await invite(X, w, [sale(cr, { offers: [o1, o2], productsWithoutOffers: { mode: 'chosen', productIds: [p] } })]);
    ci = (await ciOf(w, cr)).id;
  });

  test('the invitation (C1): one row "2 offers + 1 product", no old scope or shopper offer', async () => {
    const r = await api.get(`/influencers/me/invitations/${ci}`, cr.token);
    expect(r.body.data.invitation.terms.sell.words).toBe('2 offers + 1 product');
    expect(r.body.data.invitation.terms.scope).toBeNull();
    expect(r.body.data.invitation.terms.offer).toBeNull();
  });

  test('what you can sell (C2): each offer\'s deal, products, dates, thumbnails and what she earns', async () => {
    const r = await api.get(`/influencers/me/invitations/${ci}/sell`, cr.token);
    const d = r.body.data;
    expect(d.commission_pct).toBe(10);
    const pct = d.offers.find((o) => o.id === o1);
    expect(pct).toMatchObject({ deal: '20% off each item, up to ₹400', products: 2, type_label: 'Discount · %' });
    expect(pct.thumbs).toHaveLength(2);
    expect(pct.you_earn).toEqual({ pays: 2099, earns: 210, line: '10% of ₹2,099 = ₹210' });
    const bun = d.offers.find((o) => o.id === o2);
    expect(bun.deal).toBe('Shopper picks any 2 of 2 for ₹2,999');
    expect(bun.you_earn.line).toBe('10% of ₹2,999 = ₹300');
    expect(d.products).toMatchObject({ mode: 'chosen', count: 1 });
  });

  test('one offer (C3): how it works for shoppers, runs, you earn, every product', async () => {
    const r = await api.get(`/influencers/me/invitations/${ci}/offers/${o2}`, cr.token);
    const o = r.body.data.offer;
    expect(o.how).toBe('They pick any 2 of these 2 products from your post and pay ₹2,999 together. All 2 must come from the same post.');
    expect(o.you_earn.line).toBe('10% of ₹2,999 = ₹300');
    expect(o.products.map((p) => p.name).sort()).toEqual(['T1', 'T2']);
  });

  test('another creator, or an offer not in her collaboration, answers 404', async () => {
    const them = await H.creator();
    expect((await api.get(`/influencers/me/invitations/${ci}/sell`, them.token)).status).toBe(404);
    expect((await api.get(`/influencers/me/invitations/${ci}/offers/${o2}`, them.token)).status).toBe(404);
    const notHers = await H.ready(X.token, { ids: [await H.prod(X.brandId, t.jackets, 'Jk', 3000)], from: day(1), to: day(30) });
    expect((await api.get(`/influencers/me/invitations/${ci}/offers/${notHers}`, cr.token)).status).toBe(404);
  });

  test('the agreement lists her offers as of signing, with the end rule (2.7, C4)', async () => {
    const snap = await agreementTerms.buildSnapshot(await agreementTerms.loadContext(ci));
    expect(snap.sell.words).toBe('2 offers + 1 product');
    expect(snap.sell.offers.map((o) => o.name).sort()).toEqual(['20% off Levi\'s Jeans', 'Any 2 Jeans for ₹2,999']);
    expect(snap.sell.offers[0]).toEqual(expect.objectContaining({ deal: expect.any(String), starts_on: expect.any(String), ends_on: expect.any(String) }));
    expect(snap.sell.offers_end_line).toBe('Offers end on their end date; when an offer ends, posts using it are removed from the shop.');
  });

  test('countering changes money only — her offers stay as sent (2.6)', async () => {
    const r = await api.post(`/influencers/me/invitations/${ci}/counter`, cr.token, { terms: { commissionPct: 13 } });
    expect([200, 201]).toContain(r.status);
    const th = await api.get(`/influencers/me/invitations/${ci}/thread`, cr.token);
    expect(th.body.data.thread.invitation.scopeWords).toBe('2 offers + 1 product');
    expect(th.body.data.thread.invitation.offerName).toBeNull();
    expect((await links(ci)).length).toBe(2);
  });
});

describe('ending an offer that sits in invitations (2.8, founder Q1; checks 13–15)', () => {
  test('dropped from unsigned invitations with a notice; an invitation left empty is withdrawn; signed keep it; the brand is warned first', async () => {
    const X = await H.brand();
    const w = await campaignSet(X);
    const shared = await H.ready(X.token, { name: 'Festive 15%', type: 'discount', sub: 'percentage', cfg: { pct: 15 }, ids: [await H.prod(X.brandId, t.jeans, 'Saree', 2400)], from: day(1), to: day(30) });
    const keep = await H.ready(X.token, { name: 'Second offer', ids: [await H.prod(X.brandId, t.shirts, 'Kurta', 999)], from: day(1), to: day(30) });
    const onlyThis = await H.creator({ name: 'Asha M.' });
    const withMore = await H.creator({ name: 'Meera S.' });
    const signed = await H.creator({ name: 'Kabir M.' });
    await invite(X, w, [sale(onlyThis, { offers: [shared] }), sale(withMore, { offers: [shared, keep] }), sale(signed, { offers: [shared] })]);
    const ciA = (await ciOf(w, onlyThis)).id, ciM = (await ciOf(w, withMore)).id, ciK = (await ciOf(w, signed)).id;
    await query(`INSERT INTO contracts (campaign_influencer_id, influencer_fee, status, influencer_signed_at, brand_signed_at) VALUES ($1, 0, 'active', now(), now())`, [ciK]);
    await query(`UPDATE campaign_influencers SET status = 'contracted' WHERE id = $1`, [ciK]);

    const view = await api.get(`/brands/me/offers/${shared}`, X.token);
    expect(view.body.data.unsigned_invitations).toBe(2);

    const r = await api.post(`/brands/me/offers/${shared}/end`, X.token);
    expect(r.body.data).toMatchObject({ invitations_dropped: 2, invitations_withdrawn: 1 });

    expect(await ciOf(w, onlyThis)).toMatchObject({ status: 'withdrawn', withdrawn_reason: 'offer_ended' });
    expect((await ciOf(w, withMore)).status).toBe('invited');
    expect((await links(ciM)).find((l) => l.offer_id === shared)).toMatchObject({ dropped_reason: 'offer_ended' });
    expect((await links(ciK))[0].dropped_at).toBeNull();

    expect((await H.notices(onlyThis.userId)).map((n) => n.type)).toContain('invitation.withdrawn');
    expect((await H.notices(withMore.userId, 'offer_dropped'))[0].title).toBe('"Festive 15%" was taken out of your invitation');
    expect((await H.notices(signed.userId, 'offer_ended'))[0].title).toBe('"Festive 15%" has ended');
    const m = await api.get(`/influencers/me/invitations/${ciM}/sell`, withMore.token);
    expect(m.body.data.offers.map((o) => o.name)).toEqual(['Second offer']);
    expect(ciA).toBeTruthy();
  });

  test('an offer that had already ended is not something left to sell: ending the last live one withdraws the invitation', async () => {
    const X = await H.brand();
    const w = await campaignSet(X);
    const gone = await H.ready(X.token, { name: 'Gone offer', ids: [await H.prod(X.brandId, t.jeans, 'Bootcut', 1999)], from: day(1), to: day(30) });
    const last = await H.ready(X.token, { name: 'Last offer', ids: [await H.prod(X.brandId, t.shirts, 'Linen', 1299)], from: day(1), to: day(30) });
    const cr = await H.creator({ name: 'Riya K.' });
    await invite(X, w, [sale(cr, { offers: [gone, last] })]);
    // the first offer ended without its link being dropped (found in the 28 Sep walk)
    await query(`UPDATE brand_offers SET status = 'ended', ended_at = now() WHERE id = $1`, [gone]);

    const r = await api.post(`/brands/me/offers/${last}/end`, X.token);
    expect(r.body.data).toMatchObject({ invitations_dropped: 1, invitations_withdrawn: 1 });
    expect(await ciOf(w, cr)).toMatchObject({ status: 'withdrawn', withdrawn_reason: 'offer_ended' });
  });
});

describe('products changing (2.8, 2.11; checks 16–17)', () => {
  test('out of stock, off sale, and a new normal price reach the creators who can sell it', async () => {
    const X = await H.brand();
    const w = await campaignSet(X);
    const p = await H.prod(X.brandId, t.shirts, 'Linen shirt', 849, null, { stock: 5 });
    const cr = await H.creator();
    await invite(X, w, [sale(cr, { productsWithoutOffers: { mode: 'chosen', productIds: [p] } })]);
    await api.patch(`/brands/me/products/${p}`, X.token, { price: 999 });
    await api.patch(`/brands/me/products/${p}`, X.token, { stock: 0 });
    await api.patch(`/brands/me/products/${p}`, X.token, { pushed_to_store: false });
    const types = (await H.notices(cr.userId)).map((n) => [n.type, n.title]);
    expect(types).toEqual(expect.arrayContaining([
      ['offer_price_changed', 'Price changed: Linen shirt'],
      ['product_out_of_stock', 'Linen shirt is out of stock'],
      // listing-shop-safety (rules v1.22, founder 11 Oct 2026): taken off sale is a pause — the notice
      // was 'product_unavailable' / "is no longer available", which is now said only for a Remove.
      ['product_paused', 'Linen shirt is not on sale right now'],
    ]));
    const ci = (await ciOf(w, cr)).id;
    expect(await terms.sellableProductIds(ci)).toEqual([]);   // off sale → out of what she can sell
    // shown again she is told, and can sell it; removed for good she is told that instead
    await api.patch(`/brands/me/products/${p}`, X.token, { pushed_to_store: true });
    expect((await H.notices(cr.userId)).map((n) => [n.type, n.title])).toEqual(expect.arrayContaining([['product_back_on_sale', 'Linen shirt is back on sale']]));
    expect(await terms.sellableProductIds(ci)).toEqual([p]);
    expect((await api.del(`/brands/me/products/${p}`, X.token)).status).toBe(200);
    expect((await H.notices(cr.userId)).map((n) => [n.type, n.title])).toEqual(expect.arrayContaining([['product_unavailable', 'Linen shirt is no longer available']]));
  });
});

describe('the old readers accept the new terms (check 18)', () => {
  test('the publish check doesn\'t call a new-terms creator "nothing to sell"; her sellable list is offers + products', async () => {
    const X = await H.brand();
    const w = await campaignSet(X);
    const o = await H.ready(X.token, { ids: [await H.prod(X.brandId, t.jeans, 'J1', 1500)], from: day(1), to: day(30) });
    const p = await H.prod(X.brandId, t.shirts, 'S1', 999);
    const cr = await H.creator();
    await invite(X, w, [sale(cr, { offers: [o], productsWithoutOffers: { mode: 'chosen', productIds: [p] } })]);
    const gate = await publishGate.evaluate(w.cid, X.brandId);
    expect(gate.blockers.filter((b) => b.code === 'NO_ALLOCATION')).toEqual([]);
    expect(gate.warnings.filter((x) => x.code === 'NO_SHOPPER_OFFER')).toEqual([]);
    const ci = (await ciOf(w, cr)).id;
    expect((await terms.sellableProductIds(ci)).length).toBe(2);
  });
});
