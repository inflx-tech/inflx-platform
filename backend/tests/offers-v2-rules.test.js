'use strict';

/**
 * offer-builder-v2 — the rules, with no database. Contract: features/offer-builder-v2
 * Checks 3, 14–23 of 03-expected-outputs.md. Numbers are the locked board's (O6, O7).
 */

const R = require('../src/services/offerRules');

const offer = (sub_type, cfg, over = {}) => ({
  offer_type: Object.keys(R.SUB_TYPES).find((t) => R.SUB_TYPES[t].includes(sub_type)),
  sub_type, name: 'Test offer', starts_on: '2026-10-01', ends_on: '2026-10-31', offer_config_json: cfg, ...over,
});
const P = (id, name, price, leaf = 'L1', leafName = 'Jeans') => ({ id, name, price, leaf_id: leaf, leaf_name: leafName });
const failing = (res) => res.checks.filter((c) => !c.ok).map((c) => c.text);
const TODAY = '2026-09-28';

describe('dates (checks 3, 22)', () => {
  test('both dates, end after start → ok', () => {
    const r = R.publishChecks(offer('bogo', {}), { buy: [P('a', 'A', 100)] }, TODAY);
    expect(r.ok).toBe(true);
    expect(r.checks.find((c) => c.key === 'dates').text).toBe('End date is after start date');
  });
  test('end on or before start → the board\'s words', () => {
    const r = R.publishChecks(offer('bogo', {}, { ends_on: '2026-10-01' }), { buy: [P('a', 'A', 100)] }, TODAY);
    expect(failing(r)).toContain('The end date must be after the start date.');
  });
  test('a missing date blocks', () => {
    const r = R.publishChecks(offer('bogo', {}, { ends_on: null }), { buy: [P('a', 'A', 100)] }, TODAY);
    expect(failing(r)).toContain('Set both the start and the end date.');
  });
  test('an end date already passed blocks (spec D15); ending today is fine', () => {
    const past = R.publishChecks(offer('bogo', {}, { starts_on: '2026-09-01', ends_on: '2026-09-27' }), { buy: [P('a', 'A', 100)] }, TODAY);
    expect(failing(past)).toContain("This offer's end date (27 Sep 2026) has already passed.");
    const today = R.publishChecks(offer('bogo', {}, { starts_on: '2026-09-01', ends_on: TODAY }), { buy: [P('a', 'A', 100)] }, TODAY);
    expect(today.ok).toBe(true);
  });
  test('an untitled offer can\'t publish', () => {
    const r = R.publishChecks(offer('bogo', {}, { name: 'Untitled offer' }), { buy: [P('a', 'A', 100)] }, TODAY);
    expect(failing(r)).toContain('Give the offer a name.');
  });
  test('an empty pool and a locked product both block, naming the product', () => {
    expect(failing(R.publishChecks(offer('bogo', {}), { buy: [] }, TODAY))).toContain('Add at least one product to the pool.');
    const r = R.publishChecks(offer('bogo', {}), { buy: [P('a', 'A', 100)], conflicts: [{ name: "Levi's 512", offer_name: 'Denim Days', ends_on: '2026-10-15' }] }, TODAY);
    expect(failing(r)).toContain('"Levi\'s 512" is in "Denim Days" until 15 Oct. Remove it from this pool or change the dates.');
  });
});

describe('discount % (check 14)', () => {
  test('0 < % < 100; max ₹ optional but above 0', () => {
    expect(R.numberProblems('percentage', { pct: 0 }).map((p) => p.text)).toContain('The discount must be more than 0% and less than 100%.');
    expect(R.numberProblems('percentage', { pct: 100 }).length).toBe(1);
    expect(R.numberProblems('percentage', { pct: 20 })).toEqual([]);
    expect(R.numberProblems('percentage', { pct: 20, max_off: 0 }).map((p) => p.text)).toContain('The max ₹ off must be more than ₹0.');
  });
  test('the example line from the costliest product, cap reached (O6)', () => {
    const o = offer('percentage', { pct: 20, max_off: 400 });
    const help = R.numbersHelp(o, { buy: [P('a', "Levi's 511", 2299), P('b', 'Other', 1999)] });
    expect(help.example).toBe("Levi's 511 ₹2,299 → shopper pays ₹1,899 (₹400 cap reached)");
    expect(R.dealLine(o)).toBe('20% off, max ₹400 per item');
  });
});

describe('flat (check 15)', () => {
  test('₹ off below the cheapest item, named when it is not (O6)', () => {
    const buy = [P('a', 'Linen shirt', 849), P('b', 'Oxford', 1299)];
    expect(failing(R.publishChecks(offer('flat', { amount: 900 }), { buy }, TODAY)))
      .toContain('Must be less than your cheapest item in the pool (Linen shirt, ₹849).');
    expect(R.publishChecks(offer('flat', { amount: 200 }), { buy }, TODAY).ok).toBe(true);
    expect(R.dealLine(offer('flat', { amount: 200 }))).toBe('₹200 off per item');
  });
});

describe('volume (check 16)', () => {
  test('1 to 4 tiers', () => {
    expect(R.numberProblems('quantity', { reward: 'pct', tiers: [] }).map((p) => p.text)).toContain('Add 1 to 4 tiers.');
    const five = Array.from({ length: 5 }, (_, i) => ({ at: i + 2, value: (i + 1) * 5 }));
    expect(R.numberProblems('quantity', { reward: 'pct', tiers: five }).map((p) => p.text)).toContain('Add 1 to 4 tiers.');
  });
  test('each tier bigger than the last, in quantity and in reward (the board\'s error)', () => {
    const ok = R.numberProblems('quantity', { reward: 'pct', tiers: [{ at: 2, value: 20 }, { at: 3, value: 30 }] });
    expect(ok).toEqual([]);
    const bad = R.numberProblems('value', { reward: 'amount', tiers: [{ at: 2000, value: 300 }, { at: 3000, value: 250 }] }).map((p) => p.text);
    expect(bad).toContain("Tier 2's reward must be bigger than tier 1's.");
    const badQty = R.numberProblems('quantity', { reward: 'pct', tiers: [{ at: 3, value: 20 }, { at: 3, value: 30 }] }).map((p) => p.text);
    expect(badQty).toContain("Tier 2's quantity must be bigger than tier 1's.");
  });
  test('a ₹ reward below its spend; a % below 100', () => {
    expect(R.numberProblems('value', { reward: 'amount', tiers: [{ at: 2000, value: 2000 }] }).map((p) => p.text))
      .toContain("Tier 1's ₹ off must be less than its spend (₹2,000).");
    expect(R.numberProblems('quantity', { reward: 'pct', tiers: [{ at: 2, value: 100 }] }).map((p) => p.text))
      .toContain("Tier 1's reward must be less than 100%.");
  });
  test('the deal in words', () => {
    expect(R.dealLine(offer('quantity', { reward: 'pct', tiers: [{ at: 2, value: 20 }, { at: 3, value: 30 }] }))).toBe('Buy 2 → 20% · Buy 3 → 30%');
    expect(R.dealLine(offer('value', { reward: 'pct', tiers: [{ at: 2000, value: 10 }] }))).toBe('Spend ₹2,000 → 10%');
  });
});

describe('bundle pick-any / mix & match (check 17) — the board\'s ₹2,999 pair', () => {
  const jeans = [P('a', 'J1', 1699), P('b', 'J2', 1749), P('c', 'J3', 2499), P('d', 'J4', 1999)];
  test('band, saving and pool all pass at ₹2,999; the texts match the board', () => {
    const r = R.publishChecks(offer('pick_any', { pick: 2, price: 2999 }, { name: 'Any 2 Jeans' }), { buy: jeans }, TODAY);
    expect(r.ok).toBe(true);
    const t = r.checks.map((c) => c.text);
    expect(t).toContain('Price band: costliest ₹2,499 ≤ 1.5 × cheapest ₹1,699');
    expect(t).toContain('Cheapest pair ₹3,448 → ₹2,999 saves 13% (needs 10%)');
    expect(t).toContain('Pool has at least 2 products for "pick 2"');
  });
  test('the suggested safe price is ₹2,700 – ₹3,100', () => {
    expect(R.suggestedBundlePrice(jeans.map((j) => j.price), 2)).toEqual({ low: 2700, high: 3100, combo: 3448 });
  });
  test('at ₹3,200 it fails with the board\'s wording', () => {
    const r = R.publishChecks(offer('pick_any', { pick: 2, price: 3200 }), { buy: jeans }, TODAY);
    expect(failing(r)).toContain('The cheapest pair must save at least 10%. Try ₹3,100 or less.');
  });
  test('band broken: costliest above 1.5 × cheapest', () => {
    const r = R.publishChecks(offer('mix_match', { pick: 2, price: 2000 }), { buy: [P('a', 'A', 1699), P('b', 'B', 2799, 'L2', 'Shirts')] }, TODAY);
    expect(failing(r)).toContain('The costliest item (₹2,799) is more than 1.5 × the cheapest (₹1,699).');
  });
  test('pool below the pick count', () => {
    const r = R.publishChecks(offer('mix_match', { pick: 3, price: 3000 }), { buy: jeans.slice(0, 2) }, TODAY);
    expect(failing(r)).toContain('The pool needs at least 3 products for "pick 3".');
  });
  test('pick-any must be one category; mix & match need not', () => {
    const mixed = [P('a', 'A', 1699), P('b', 'B', 1749, 'L2', 'Shirts')];
    expect(failing(R.publishChecks(offer('pick_any', { pick: 2, price: 3000 }), { buy: mixed }, TODAY)).join(' ')).toMatch(/Pick-any bundles stay in one category/);
    expect(R.publishChecks(offer('mix_match', { pick: 2, price: 3000 }), { buy: mixed }, TODAY).checks.some((c) => c.key === 'one_category')).toBe(false);
  });
});

describe('bundle fixed (check 18)', () => {
  const items = [P('s', 'Oxford shirt', 1299), P('t', 'Chino', 1499), P('b', 'Belt', 399)];
  test('₹2,499 against a ₹3,197 total → saves ₹698 (22%)', () => {
    const r = R.publishChecks(offer('fixed', { price: 2499, quantities: {} }), { buy: items }, TODAY);
    expect(r.ok).toBe(true);
    expect(r.checks.map((c) => c.text)).toContain('Shopper saves ₹698 (22%). The bundle price is below the total (₹3,197)');
    expect(R.numbersHelp(offer('fixed', { price: 2499 }), { buy: items }).total).toBe(3197);
  });
  test('a price at or above the total is refused; quantities count', () => {
    expect(failing(R.publishChecks(offer('fixed', { price: 3197 }), { buy: items }, TODAY)))
      .toContain('The bundle price must be below the total price of its items (₹3,197).');
    const two = R.publishChecks(offer('fixed', { price: 3000, quantities: { b: 2 } }), { buy: items }, TODAY);
    expect(two.checks.find((c) => c.key === 'fixed_below_total').text).toMatch(/total \(₹3,596\)/);
  });
  test('one item with quantity 1 is not a bundle', () => {
    expect(failing(R.publishChecks(offer('fixed', { price: 100 }), { buy: [items[2]] }, TODAY))).toContain('A fixed bundle needs at least 2 items.');
  });
});

describe('free gift (checks 19, 20)', () => {
  const buy = [P('j1', 'Jacket 1', 2500), P('j2', 'Jacket 2', 3200)];
  const cap = { kind: 'product', id: 'cap', name: 'Leather cap', value: 599 };
  const coin = { kind: 'gift_item', id: 'coin', name: 'Silver coin 5g', value: 650, stock: 50 };
  test('spend: costliest gift below the minimum spend (the board\'s words)', () => {
    const r = R.publishChecks(offer('spend', { min_spend: 3000, gift_count: 1, gift_limits: { cap: 40 } }), { buy, gift: [cap, coin] }, TODAY);
    expect(r.ok).toBe(true);
    expect(r.checks.map((c) => c.text)).toContain('Costliest gift (₹650) is below the minimum spend (₹3,000)');
  });
  test('spend: two gifts adding up above the minimum is refused', () => {
    const r = R.publishChecks(offer('spend', { min_spend: 1000, gift_count: 2, gift_limits: { cap: 40 } }), { buy, gift: [cap, coin] }, TODAY);
    expect(failing(r)).toContain('Costliest 2 gifts (₹1,249) must be below the minimum spend (₹1,000).');
  });
  test('buy X: the minimum purchase is X × the cheapest buy product', () => {
    const r = R.publishChecks(offer('buy_x', { buy_qty: 1, gift_count: 1 }), { buy: [P('s', 'Saree', 600)], gift: [coin] }, TODAY);
    expect(failing(r)).toContain('Costliest gift (₹650) must be below the minimum purchase (₹600).');
    const ok = R.publishChecks(offer('buy_x', { buy_qty: 2, gift_count: 1 }), { buy: [P('s', 'Saree', 600)], gift: [coin] }, TODAY);
    expect(ok.ok).toBe(true);
  });
  test('a store-product gift needs a limit; a gift item needs stock; pools can\'t share', () => {
    const r = R.publishChecks(offer('spend', { min_spend: 3000, gift_count: 1 }),
      { buy: [...buy, P('cap', 'Leather cap', 599)], gift: [cap, { ...coin, stock: 0 }] }, TODAY);
    const f = failing(r);
    expect(f).toContain('Set a gift stock limit for "Leather cap".');
    expect(f).toContain('"Silver coin 5g" has no stock. Restock it in Gift items.');
    expect(f).toContain('"Leather cap" is in both the buy pool and the gift pool.');
  });
  test('number of gifts between 1 and the gift pool; a gift pool is needed', () => {
    expect(failing(R.publishChecks(offer('spend', { min_spend: 3000, gift_count: 3 }), { buy, gift: [coin] }, TODAY)))
      .toContain('Gifts the shopper gets must be between 1 and 1.');
    expect(failing(R.publishChecks(offer('spend', { min_spend: 3000, gift_count: 1 }), { buy, gift: [] }, TODAY)))
      .toContain('Add at least one gift.');
  });
});

describe('BOGO (check 21)', () => {
  test('no price checks; optional max free', () => {
    const r = R.publishChecks(offer('bogo', { max_free: 2 }), { buy: [P('a', 'A', 10), P('b', 'B', 99999)] }, TODAY);
    expect(r.ok).toBe(true);
    expect(r.checks.map((c) => c.text)).toContain('BOGO has no price checks');
    expect(R.numberProblems('bogo', { max_free: 0 }).map((p) => p.text)).toContain('Max free items must be at least 1.');
    expect(R.dealLine(offer('bogo', { max_free: 2 }))).toBe('Buy one, get the same product free · max 2 free per order');
  });
});

describe('status (check 23)', () => {
  const o = { status: 'published', starts_on: '2026-10-01', ends_on: '2026-10-31' };
  test('Scheduled before the start, Live on the start and end days, Ended after', () => {
    expect(R.displayStatus(o, '2026-09-30')).toBe('scheduled');
    expect(R.displayStatus(o, '2026-10-01')).toBe('live');
    expect(R.displayStatus(o, '2026-10-31')).toBe('live');
    expect(R.displayStatus(o, '2026-11-01')).toBe('ended');
  });
  test('Draft stays draft; an early end is Ended whatever the dates', () => {
    expect(R.displayStatus({ ...o, status: 'draft' }, '2026-10-10')).toBe('draft');
    expect(R.displayStatus({ ...o, status: 'ended' }, '2026-10-10')).toBe('ended');
  });
});

describe('the numbers keep only what the sub-type uses', () => {
  test('stray fields are dropped; blanks stay null', () => {
    expect(R.normaliseConfig('percentage', { pct: '20', max_off: '', availing_modes: ['x'], scope: 'store' })).toEqual({ pct: 20, max_off: null });
    // shopper-deal-orders (C3, 5 Oct 2026): a set's numbers now also say whether its pieces can be bought
    // alone. Missing = off, so every set offer that exists stays sold only whole. (Was: { price, quantities }.)
    expect(R.normaliseConfig('fixed', { price: 2499, quantities: { a: 2, b: 0, c: 'x' } })).toEqual({ price: 2499, quantities: { a: 2 }, pieces_alone: false });
  });
  test('type labels', () => {
    expect(R.typeLabel('bundle', 'pick_any')).toBe('Bundle · Pick-any');
    expect(R.typeLabel('bogo', 'bogo')).toBe('BOGO');
    expect(R.typeLabel('discount', 'percentage')).toBe('Discount · %');
  });
});
