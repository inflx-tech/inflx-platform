'use strict';

/**
 * shopper-deal-orders, part A — My orders shows a deal as one (03-expected-outputs.md AS1–AS9).
 *
 *   A set, a bundle's set, a buy-one-get-one pair and the items a buy-more saving applied to are ONE
 *   card, one page, one Cancel, one Return. A plain-discount item and an item bought alone stay
 *   their own. Asked the old way (no `by=deal`) every item is on its own, exactly as before.
 * Real orders placed through live posts.
 */

const D = require('./helpers/dealWorld');
const rules = require('../src/services/offerRules');

const { api, query, line } = D;
const cards = async (sh, qs = '') => (await api.get(`/follower/orders?by=deal${qs}`, sh.token)).body.data;
const plain = async (sh, qs = '') => (await api.get(`/follower/orders${qs ? `?${qs.replace(/^&/, '')}` : ''}`, sh.token)).body.data;
const names = (c) => c.lines.map((l) => l.name);

const W = {};
let sh;            // Anusha: a bundle, a pair, a discount item, a buy-more deal, one item of the bundle post alone
const O = {};

beforeAll(async () => {
  await D.fresh();
  for (const kind of ['pick3', 'bogo', 'discount', 'quantity']) W[kind] = await D.world(kind, undefined, { brand: 'Aveen fashion boutique' });
  sh = await D.shopper();
  // one checkout each, oldest first — My orders lists the newest first
  O.bundle = await D.order(sh, [line(W.pick3, 0), line(W.pick3, 1), line(W.pick3, 2)], { method: 'online' });
  O.pair = await D.order(sh, [line(W.bogo, 0, { role: 'buy' }), line(W.bogo, 0, { role: 'free' })]);
  O.single = await D.order(sh, [line(W.discount, 0)]);
  O.volume = await D.order(sh, [line(W.quantity, 0), line(W.quantity, 1)]);
  O.alone = await D.order(sh, [line(W.pick3, 2)]);
  // spread them in time so the order of the list is certain
  let age = 50;
  for (const o of [O.bundle, O.pair, O.single, O.volume, O.alone]) {
    await query(`UPDATE order_lines SET created_at = now() - ($2 || ' minutes')::interval WHERE checkout_id = $1`, [o.checkoutId, String(age)]);
    age -= 10;
  }
});

describe('the deal\'s words on an order', () => {
  const offer = (sub, cfg) => ({ sub_type: sub, offer_config_json: cfg });
  test('each kind of deal is named shortly, to the shopper; what is not a deal has no words', () => {
    expect(rules.orderDealWords(offer('pick_any', { pick: 3, price: 2999 }), 3)).toBe('Any 3 for ₹2,999');
    expect(rules.orderDealWords(offer('mix_match', { pick: 2, price: 1999 }), 2)).toBe('Any 2 for ₹1,999');
    expect(rules.orderDealWords(offer('bogo', { max_free: 2 }), 2)).toBe('Buy 1 get 1');
    expect(rules.orderDealWords(offer('fixed', { price: 5000 }), 3)).toBe('3 items for ₹5,000');
    expect(rules.orderDealWords(offer('fixed', { price: 5000 }))).toBe('Set for ₹5,000');
    expect(rules.orderDealWords(offer('quantity', { reward: 'pct', tiers: [{ at: 2, value: 20 }, { at: 3, value: 30 }] }), 2)).toBe('Buy 2 → 20% · Buy 3 → 30%');
    for (const sub of ['percentage', 'flat', 'spend', 'buy_x']) expect(rules.orderDealWords(offer(sub, { pct: 20, amount: 100, min_spend: 3000, buy_qty: 2 }), 1)).toBeNull();
    expect(rules.orderDealWords(null)).toBeNull();
    expect(rules.orderDealWords(offer('pick_any', {}))).toBeNull();         // a deal with no numbers says nothing rather than "Any null"
  });
});

describe('My orders, by deal (AS1–AS6, AS9)', () => {
  test('AS1 five cards for nine items: the bundle, the pair, the discount item, the buy-more deal, the item bought alone', async () => {
    const { items, more } = await cards(sh);
    expect(more).toBe(false);
    expect(items.map((c) => [c.card, c.lines.length])).toEqual([['item', 1], ['deal', 2], ['item', 1], ['deal', 2], ['deal', 3]]);
    const [alone, volume, single, pair, bundle] = items;

    // the bundle: its words, its three items, one status, what the deal cost
    expect(bundle.deal).toEqual({ key: 'set-1', line: 'Any 3 for ₹2,999', count: 3 });
    expect(names(bundle).sort()).toEqual(O.bundle.lines.map((l) => l.name).sort());
    expect([bundle.paid, bundle.normal]).toEqual([2999, 4897]);
    expect(bundle.lines.reduce((s, l) => s + l.paid, 0)).toBe(2999);
    expect([bundle.status, bundle.status_word]).toEqual(['confirmed', 'Confirmed']);
    expect(bundle.brand.name).toBe('Aveen fashion boutique');
    expect(bundle.payment_method).toBe('online');
    expect(O.bundle.lines.map((l) => l.id)).toContain(bundle.id);       // the card is opened by one of its own items

    // the pair: the one she pays for and the free one
    expect(pair.deal).toEqual({ key: 'pair-1', line: 'Buy 1 get 1', count: 2 });
    expect(pair.lines.map((l) => [l.role, l.paid]).sort()).toEqual([['buy', 1399], ['free', 0]].sort());
    expect(pair.paid).toBe(1399);

    // the plain 20% off: a card of its own, with no deal
    expect([single.card, single.deal, single.paid, single.normal]).toEqual(['item', null, 1119, 1399]);
    expect(single.lines).toHaveLength(1);

    // buy more save more: the two items the 20% applied to
    expect(volume.deal).toEqual({ key: 'volume', line: 'Buy 2 → 20% · Buy 3 → 30%', count: 2 });
    expect(volume.paid).toBe(1119 + 1199);

    // AS9 — one item of the bundle post bought alone (part C) is a card of its own, at its normal price
    expect([alone.card, alone.deal, alone.paid, alone.normal]).toEqual(['item', null, 1999, 1999]);
  });

  test('every item on a card says its colour, size, quantity, what it cost — and nothing about anyone\'s money shares', async () => {
    const { items } = await cards(sh);
    for (const c of items) {
      for (const l of c.lines) {
        expect(Object.keys(l).sort()).toEqual(['colour', 'id', 'image_url', 'name', 'normal', 'paid', 'qty', 'role', 'size']);
      }
      expect(JSON.stringify(c)).not.toMatch(/commission|platform_fee|brand_net/);
    }
  });

  test('AS2 asked the old way, every item is on its own — nine rows, as before', async () => {
    const { items } = await plain(sh);
    expect(items).toHaveLength(9);
    for (const it of items) { expect(it.card).toBeUndefined(); expect(it.lines).toBeUndefined(); }
    expect(items.map((x) => x.id).sort()).toEqual([O.bundle, O.pair, O.single, O.volume, O.alone].flatMap((o) => o.lines.map((l) => l.id)).sort());
  });

  test('AS6 a search for one item\'s name brings the whole deal\'s card; a filter that matches none brings nothing', async () => {
    // The bundle's second product: in the bundle and in no other order of hers. (Named by its product, not by its
    // place among the order's lines — lines placed together are told apart only by a random id.)
    const one = O.bundle.lines.find((l) => l.product_id === W.pick3.ids[1]).name;
    const { items } = await cards(sh, `&q=${encodeURIComponent(one)}`);
    expect(items).toHaveLength(1);
    expect(items[0].deal.line).toBe('Any 3 for ₹2,999');
    expect(items[0].lines).toHaveLength(3);               // all three, not only the one that matched
    expect((await cards(sh, '&status=delivered')).items).toEqual([]);
    expect((await cards(sh, '&status=confirmed')).items).toHaveLength(5);
  });

  test('AS6 once the bundle is delivered it is under Delivered — one card — and no longer under Confirmed', async () => {
    await D.move(W.pick3, O.bundle.parcels[0].id, 'delivered');
    const done = (await cards(sh, '&status=delivered')).items;
    expect(done.map((c) => [c.card, c.status_word, c.lines.length])).toEqual([['deal', 'Delivered', 3]]);
    expect(done[0].can_return).toBe(true);
    expect(typeof done[0].return_until).toBe('string');
    expect((await cards(sh, '&status=confirmed')).items).toHaveLength(4);
  });
});

describe('a gift offer is not one deal (AS4)', () => {
  test('AS4 spend ₹3,000, get the coin: each item is its own card and so is the gift — no card is a "deal"', async () => {
    const w = await D.world('spend', undefined, { brand: 'Aveen fashion boutique' });
    const her = await D.shopper('Meera P');
    const o = await D.order(her, [line(w, 0), line(w, 1), line(w, 2)]);
    expect(o.lines.map((l) => l.deal_key).sort()).toEqual(['gift', 'gift-deal', 'gift-deal', 'gift-deal']);      // the engine's own marks: not a set, a pair or a ladder
    const { items } = await cards(her);
    expect(items).toHaveLength(4);
    for (const c of items) expect([c.card, c.deal, c.lines.length]).toEqual(['item', null, 1]);
    expect(items.filter((c) => c.role === 'gift').map((c) => c.paid)).toEqual([0]);
    // its page and its cancel are the item's own; the gift follows when the rest no longer earns it, with the warning as before
    const jeans = o.lines.find((l) => Number(l.paid_total) === 1999);
    expect((await api.get(`/follower/orders/lines/${jeans.id}`, her.token)).body.data.deal).toBeNull();
    const pv = (await api.get(`/follower/orders/lines/${jeans.id}/cancel`, her.token)).body.data;
    expect(pv.deal).toBeNull();
    expect(pv.lines.map((l) => l.role).sort()).toEqual(['buy', 'gift']);
    expect(pv.warning).toBe('This is part of a deal. Cancelling cancels 2 items together.');
  });
});

describe('20 cards a page, and no deal split (AS5)', () => {
  test('AS5 23 cards, the 20th a deal of three: page 1 has 20 whole cards, page 2 the other three, none repeated', async () => {
    const many = await D.shopper('Divya S');
    const placed = [];
    // 19 single items, then a bundle of three, then 3 more single items — 25 item rows, 23 cards
    for (let i = 0; i < 23; i += 1) {
      const lines = i === 19 ? [line(W.pick3, 0), line(W.pick3, 1), line(W.pick3, 2)] : [line(W.discount, i % 3)];
      placed.push(await D.order(many, lines)); // eslint-disable-line no-await-in-loop
    }
    for (let i = 0; i < placed.length; i += 1) {
      await query(`UPDATE order_lines SET created_at = now() - ($2 || ' minutes')::interval WHERE checkout_id = $1`, [placed[i].checkoutId, String(100 - i)]); // eslint-disable-line no-await-in-loop
    }
    const p1 = await cards(many);
    const p2 = await cards(many, '&page=2');
    expect([p1.items.length, p1.more]).toEqual([20, true]);
    expect([p2.items.length, p2.more]).toEqual([3, false]);
    const all = [...p1.items, ...p2.items];
    expect(new Set(all.map((c) => c.id)).size).toBe(23);
    const deal = all.filter((c) => c.card === 'deal');
    expect(deal).toHaveLength(1);
    expect(deal[0].lines).toHaveLength(3);                                 // whole, on one page
    expect(all.reduce((s, c) => s + c.lines.length, 0)).toBe(25);          // every item is on exactly one card
    // newest first: the three placed last are the first three cards
    expect(p1.items.slice(0, 3).map((c) => c.lines[0].id)).toEqual([placed[22], placed[21], placed[20]].map((o) => o.lines[0].id));
    // the old way still pages by item: 20, then 5
    expect((await plain(many)).items).toHaveLength(20);
    expect((await plain(many, 'page=2')).items).toHaveLength(5);
  });
});

describe('the deal\'s page (AS7)', () => {
  test('AS7 any item of the bundle opens the deal: its words, every item, what was paid for it, one timeline', async () => {
    for (const l of O.bundle.lines) {
      const d = (await api.get(`/follower/orders/lines/${l.id}`, sh.token)).body.data; // eslint-disable-line no-await-in-loop
      expect(d.deal.line).toBe('Any 3 for ₹2,999');
      expect([d.deal.key, d.deal.count, d.deal.paid, d.deal.normal]).toEqual(['set-1', 3, 2999, 4897]);
      expect(d.deal.lines.map((x) => x.id)).toEqual(O.bundle.lines.map((x) => x.id));
      expect(d.status_word).toBe('Delivered');
      expect(d.timeline.map((t) => t.word)).toEqual(['Confirmed', 'Packed', 'Shipped', 'Out for delivery', 'Delivered']);
      expect(d.can_return).toBe(true);
      expect(d.creator.name).toBe('Akshaya Reddy');
      expect(d.deal_items).toHaveLength(2);              // what an app not yet updated reads is still there
    }
  });

  test('an item that is in no deal has no `deal` — the discount item, and the one bought alone', async () => {
    for (const o of [O.single, O.alone]) {
      const d = (await api.get(`/follower/orders/lines/${o.lines[0].id}`, sh.token)).body.data; // eslint-disable-line no-await-in-loop
      expect(d.deal).toBeNull();
      expect(d.deal_items).toEqual([]);
    }
  });

  test('the pair\'s page: both items, the free one at ₹0, ₹1,399 for the deal', async () => {
    const d = (await api.get(`/follower/orders/lines/${O.pair.lines[0].id}`, sh.token)).body.data;
    expect([d.deal.line, d.deal.paid, d.deal.count]).toEqual(['Buy 1 get 1', 1399, 2]);
    expect(d.deal.lines.map((x) => x.role).sort()).toEqual(['buy', 'free']);
    expect(d.can_cancel).toBe(true);
  });

  test('another shopper cannot open it', async () => {
    const other = await D.shopper('Someone Else');
    expect((await api.get(`/follower/orders/lines/${O.bundle.lines[0].id}`, other.token)).status).toBe(404);
    expect((await cards(other)).items).toEqual([]);
  });
});

describe('Cancel deal and Return deal (AS8)', () => {
  test('AS8 the cancel preview of any item of the pair is the deal: its words, who it is from, both items, one refund', async () => {
    for (const l of O.pair.lines) {
      const pv = (await api.get(`/follower/orders/lines/${l.id}/cancel`, sh.token)).body.data; // eslint-disable-line no-await-in-loop
      expect(pv.deal).toEqual({ line: 'Buy 1 get 1', creator: 'Akshaya Reddy', brand: 'Aveen fashion boutique' });
      expect(pv.lines).toHaveLength(2);
      for (const x of pv.lines) expect(Object.keys(x).sort()).toEqual(['colour', 'id', 'image_url', 'name', 'qty', 'role', 'size']);
      expect(pv.warning).toBe('This is part of a deal. Cancelling cancels 2 items together.');     // still sent, for an app not yet updated
      expect(pv.reasons).toHaveLength(7);
    }
  });

  test('an item in no deal has no `deal` in its cancel preview', async () => {
    const pv = (await api.get(`/follower/orders/lines/${O.single.lines[0].id}/cancel`, sh.token)).body.data;
    expect(pv.deal).toBeNull();
    expect(pv.warning).toBeNull();
    expect(pv.lines).toHaveLength(1);
  });

  test('cancelling the buy-more deal from one of its items cancels both, and My orders then shows one Cancelled card', async () => {
    const online = await D.order(sh, [line(W.quantity, 0), line(W.quantity, 2)], { method: 'online' });
    const pv = (await api.get(`/follower/orders/lines/${online.lines[1].id}/cancel`, sh.token)).body.data;
    expect(pv.deal.line).toBe('Buy 2 → 20% · Buy 3 → 30%');
    expect(pv.refund.text).toBe(`Refund of ₹${(1119 + 1599).toLocaleString('en-IN')} to your original payment method in 5–7 working days`);
    const r = await api.post(`/follower/orders/lines/${online.lines[1].id}/cancel`, sh.token, { reason: 'Ordered by mistake' });
    expect(r.status).toBe(200);
    expect(r.body.data.cancelled.sort()).toEqual(online.lines.map((l) => l.id).sort());
    const gone = (await cards(sh, '&status=cancelled')).items;
    expect(gone.map((c) => [c.card, c.status_word, c.lines.length, c.paid])).toEqual([['deal', 'Cancelled', 2, 1119 + 1599]]);
    expect(gone[0].refund).toEqual({ status: 'issued', amount: expect.any(Number) });
  });

  test('the return preview of any item of the delivered bundle is the deal; asking returns the three together', async () => {
    const pv = (await api.get(`/follower/orders/lines/${O.bundle.lines[2].id}/return`, sh.token)).body.data;
    expect(pv.deal).toEqual({ line: 'Any 3 for ₹2,999', creator: 'Akshaya Reddy', brand: 'Aveen fashion boutique' });
    expect(pv.lines).toHaveLength(3);
    expect(pv.refund.amount).toBe(2999);
    const r = await api.post(`/follower/orders/lines/${O.bundle.lines[2].id}/return`, sh.token, { reason: 'changed_mind' });
    expect(r.status).toBe(200);
    const [card] = (await cards(sh, '&status=delivered')).items;
    expect(card.return.word).toBe('Return requested');
    expect(card.can_return).toBe(false);
    expect((await query(`SELECT count(*)::int AS n FROM follower_returns WHERE order_line_id = ANY($1::uuid[])`, [O.bundle.lines.map((l) => l.id)])).rows[0].n).toBe(3);
  });
});
