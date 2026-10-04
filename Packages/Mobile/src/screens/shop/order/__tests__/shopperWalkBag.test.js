/**
 * shopper-walk-fixes — the deal pages and the bag (board S4, S7, G1, G2 and the table under G),
 * with the founder's own posts: the ₹5,000 set, the heels (buy one get one), the Henley tee
 * (buy more, save more).
 *
 *   O3  the deal page's product pop-up shows the listing's details block, not one grey line
 *   O6  Review your deal → Add to bag: one vibration, "Go to bag ›" for about a second, then the
 *       review AND the deal page close (opened from the Bag's Edit deal: she is back in the Bag);
 *       the bag icon with its count is on the deal page and the review
 *   O7  a deal made of fixed pieces — set, bundle, buy one get one — is ONE group in the bag: one
 *       tick, no − 1 +, nothing to press on a single item, Edit deal and Remove deal. Every other
 *       kind of group is exactly as it was
 *
 * Contract: features/shopper-walk-fixes · BUILD_API.md §1 (group.offer.sub_type)
 */
import React from 'react';
import { Vibration, StyleSheet } from 'react-native';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

jest.mock('../../../../services/api', () => ({
  followerApi: {
    deal: jest.fn(), dealPrice: jest.fn(), bagPrice: jest.fn(), getBag: jest.fn(), putBag: jest.fn(), mergeBag: jest.fn(),
    saveProduct: jest.fn(), unsaveProduct: jest.fn(), postEvents: jest.fn(() => Promise.resolve({ success: true })),
  },
  setDeviceHeader: jest.fn(), clearSession: jest.fn(() => Promise.resolve()),
}));
jest.mock('../../../../services/events', () => ({ track: jest.fn(), flush: jest.fn() }));
jest.mock('@react-navigation/native', () => ({ useFocusEffect: (cb) => { const React = require('react'); React.useEffect(() => cb(), [cb]); } }));

const { followerApi } = require('../../../../services/api');
const { shopStore } = require('../../../../components/shop/shopStore');
const { isLockedDeal, LOCKED_DEALS, ADDED_MS } = require('../../../../components/shop/orderBits');
const { saveBag } = require('../../../../components/shop/bag');
const Deal = require('../DealScreen').default;
const DealReview = require('../DealReviewScreen').default;
const Bag = require('../BagScreen').default;

const nav = () => ({ goBack: jest.fn(), navigate: jest.fn(), replace: jest.fn(), pop: jest.fn(), isFocused: jest.fn(() => true), addListener: jest.fn(() => () => {}) });
const ok = (data) => ({ success: true, data });
const bagNow = async () => JSON.parse(await AsyncStorage.getItem('inflx_bag_v1')) || [];
const texts = (node) => node.findAll((n) => typeof n.type === 'string' && n.type === 'Text').map((n) => [].concat(n.props.children).filter((c) => typeof c === 'string' || typeof c === 'number').join(''));

const AKSHAYA = { id: 'c1', name: 'Akshaya' };
const AVEEN = { id: 'b1', name: 'Aveen fashion boutique and desiner studio' };
const TIERS = 'Buy 1 → 10% · Buy 2 → 20% · Buy 3 → 30%';

/* ───────────────────────────── the bag's lines, and what the server prices them at */

const line = (ref, post_id, product_id, colour, size, extra = {}) => ({ ref, post_id, product_id, gift_item_id: null, colour, size, qty: 1, role: 'buy', ticked: true, price_seen: null, ...extra });
const SET_LINES = [line('s1', 'p-set', 'rt', 'Red', 'M'), line('s2', 'p-set', 'gk', 'Green', 'M'), line('s3', 'p-set', 'pw', 'Black', 'Free Size')];
const TEE_LINES = [line('t1', 'p-vol', 'tee', 'Blue', 'M', { qty: 2 })];
const HEELS_LINES = [line('h1', 'p-bogo', 'heels', 'Black', 'UK6'), line('h2', 'p-bogo', 'heels', 'Black', 'UK5', { role: 'free' })];

const NAMES = { s1: 'red t shirt', s2: 'green kurat', s3: 'police watch', t1: 'Classic Striped Henley Tee', h1: 'heels', h2: 'heels', k1: "Levi's 511 Slim", k2: 'Wrangler Regular', d1: 'Blue polo', d2: 'Casio vintage' };
const priced = (ref, paid, normal, extra = {}) => ({ ref, name: NAMES[ref], image_url: null, role: 'buy', qty: 1, paid_total: paid, normal_total: normal, problems: [], notes: [], ...extra });
const group = (post_id, offer, progress, lines, over = {}) => ({
  post_id, creator: AKSHAYA, brand: AVEEN, offer, progress, gift: null, problems: [], buyable: true,
  normal_total: lines.reduce((s, l) => s + l.normal_total, 0), paid_total: lines.reduce((s, l) => s + l.paid_total, 0),
  savings: lines.reduce((s, l) => s + l.normal_total - l.paid_total, 0), gift_value: 0, lines, ...over,
});
const SET = group('p-set', { id: 'o-set', type: 'bundle', sub_type: 'fixed', line: '3 items for ₹5,000' }, { text: '1 set', done: true },
  [priced('s1', 343, 500), priced('s2', 616, 899), priced('s3', 4041, 5899)]);
const TEE = group('p-vol', { id: 'o-vol', type: 'volume', sub_type: 'quantity', line: TIERS }, { text: '2 items · 20% off', done: true, next: '1 more → 30% off', tier: 2 },
  [priced('t1', 1118, 1398, { qty: 2 })]);
const HEELS = group('p-bogo', { id: 'o-bogo', type: 'bogo', sub_type: 'bogo', line: 'Buy one, get the same product free' }, { text: '1 pair', done: true },
  [priced('h1', 4599, 4599), priced('h2', 0, 4599, { role: 'free' })]);

/** The server's answer for whatever is in the bag: a group per post with a ticked line; unticked lines on their own. */
function serverPrices(groups) {
  return async (lines) => {
    const on = lines.filter((l) => l.ticked !== false);
    const gs = groups.filter((g) => on.some((l) => l.post_id === g.post_id))
      .map((g) => ({ ...g, lines: g.lines.filter((x) => on.some((l) => l.ref === x.ref)) }));
    return ok({
      groups: gs,
      unticked: lines.filter((l) => l.ticked === false).map((l) => ({ ...l, name: NAMES[l.ref], image_url: null, normal_unit: 0, problems: [] })),
      items_normal: gs.reduce((s, g) => s + g.normal_total, 0), savings: gs.reduce((s, g) => s + g.savings, 0),
      items_total: gs.reduce((s, g) => s + g.paid_total, 0), buyable: gs.length > 0 && gs.every((g) => g.buyable),
    });
  };
}
async function bagWith(lines, groups) {
  await AsyncStorage.setItem('inflx_bag_v1', JSON.stringify(lines));
  followerApi.bagPrice.mockImplementation(serverPrices(groups));
  const n = nav();
  const r = render(<Bag navigation={n} />);
  await waitFor(() => expect(followerApi.bagPrice).toHaveBeenCalled());
  await r.findByTestId('bag');
  return { ...r, n };
}

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  shopStore._reset();
  await act(async () => { await saveBag([]); });
});
afterEach(() => { jest.useRealTimers(); });

/* ═══════════════════════════════════════════ O7 */

describe('O7 · a deal made of fixed pieces stays whole in the bag', () => {
  it('isLockedDeal: the set, the bundle (pick any, mix & match) and buy one get one — nothing else', () => {
    expect(LOCKED_DEALS).toEqual(['fixed', 'pick_any', 'mix_match', 'bogo']);
    for (const sub of ['fixed', 'pick_any', 'mix_match', 'bogo']) expect(isLockedDeal({ type: 'x', sub_type: sub })).toBe(true);
    for (const sub of ['percentage', 'flat', 'quantity', 'value', 'spend', 'buy_x', undefined, null, '']) expect(isLockedDeal({ type: 'x', sub_type: sub })).toBe(false);
    expect(isLockedDeal(null)).toBe(false);
    expect(isLockedDeal(undefined)).toBe(false);
  });

  it('G1: the set is one group — one tick, its three items, what it costs, Edit deal and Remove deal; the tee below keeps its − 1 +', async () => {
    const r = await bagWith([...SET_LINES, ...TEE_LINES], [SET, TEE]);
    await r.findByTestId('bag-group-p-set');
    r.getByText('Bag · 5 items');
    const set = r.getByTestId('bag-group-p-set');

    // ONE tick, in the group's header
    r.getByTestId('tick-group-p-set');
    expect(r.getByTestId('tick-group-p-set').props.accessibilityState.checked).toBe(true);
    for (const ref of ['s1', 's2', 's3']) {
      r.getByTestId(`bag-line-${ref}`);
      // nothing to press on a single item
      expect(r.queryByTestId(`tick-${ref}`)).toBeNull();
      expect(r.queryByTestId(`qty-${ref}-plus`)).toBeNull();
      expect(r.queryByTestId(`qty-${ref}-minus`)).toBeNull();
      expect(r.queryByTestId(`change-${ref}`)).toBeNull();
      expect(r.queryByTestId(`remove-${ref}`)).toBeNull();
      expect(r.queryByTestId(`save-${ref}`)).toBeNull();
      expect(r.queryByTestId(`deal-price-${ref}`)).toBeNull();        // a set's price belongs to the set, not to an item
    }
    expect(texts(r.getByTestId('bag-line-s1'))).toEqual(['red t shirt', 'Red · M']);
    expect(texts(r.getByTestId('bag-line-s3'))).toEqual(['police watch', 'Black · Free Size']);
    expect(texts(set)).not.toContain('Change');
    expect(texts(set)).not.toContain('Remove');
    expect(texts(set)).not.toContain('Move to Saved');
    // what it costs, the normal total struck because the set is cheaper, and one line saying how to change it
    expect(texts(r.getByTestId('deal-whole-p-set'))).toEqual(['1 set · ₹5,000', '  ₹7,298', 'Sold as a set. To change a size, or to buy two sets, tap Edit deal.']);
    r.getByTestId('edit-deal-p-set');
    expect(texts(r.getByTestId('remove-deal-p-set'))).toEqual(['Remove deal']);
    expect(r.queryByTestId('add-more-p-set')).toBeNull();           // more is added in Edit deal

    // buy more, save more: buying more IS the offer — exactly as it was
    expect(r.queryByTestId('tick-group-p-vol')).toBeNull();
    expect(r.queryByTestId('remove-deal-p-vol')).toBeNull();
    expect(r.queryByTestId('deal-whole-p-vol')).toBeNull();
    r.getByTestId('tick-t1'); r.getByTestId('qty-t1-minus'); r.getByTestId('qty-t1-plus');
    expect(r.getByTestId('qty-t1-value').props.children).toBe(2);
    r.getByTestId('change-t1'); r.getByTestId('remove-t1'); r.getByTestId('save-t1');
    r.getByTestId('edit-deal-p-vol'); r.getByTestId('add-more-p-vol');
    r.getByText('1 more → 30% off');
    r.getByText('Continue · ₹6,118');
  });

  it('a long creator and brand name never wraps a group\'s header', async () => {
    const r = await bagWith([...SET_LINES, ...TEE_LINES], [SET, TEE]);
    await r.findByTestId('bag-group-p-set');
    for (const head of r.getAllByText('Akshaya · Aveen fashion boutique and desiner studio')) expect(head.props.numberOfLines).toBe(1);
  });

  it('the one tick unticks every line of that post — and only that post', async () => {
    const r = await bagWith([...SET_LINES, ...TEE_LINES], [SET, TEE]);
    await r.findByTestId('tick-group-p-set');
    await act(async () => { fireEvent.press(r.getByTestId('tick-group-p-set')); });
    expect((await bagNow()).map((l) => [l.ref, l.ticked])).toEqual([['s1', false], ['s2', false], ['s3', false], ['t1', true]]);
    await waitFor(() => expect(r.queryByTestId('bag-group-p-set')).toBeNull());
    r.getByTestId('bag-unticked');                                  // they stay in the bag
    r.getByTestId('bag-group-p-vol');
    r.getByText('Continue · ₹1,118');
  });

  it('ticking one unticked piece of the set brings the whole set back', async () => {
    const r = await bagWith([...SET_LINES, ...TEE_LINES], [SET, TEE]);
    await r.findByTestId('tick-group-p-set');
    await act(async () => { fireEvent.press(r.getByTestId('tick-group-p-set')); });
    await r.findByTestId('bag-unticked');
    await act(async () => { fireEvent.press(r.getByTestId('tick-s2')); });
    expect((await bagNow()).map((l) => [l.ref, l.ticked])).toEqual([['s1', true], ['s2', true], ['s3', true], ['t1', true]]);
    await r.findByTestId('bag-group-p-set');
    expect(followerApi.deal).not.toHaveBeenCalled();                // this screen had seen the set: nothing to ask
  });

  it('…also when the bag is opened afresh with the set already unticked: the post\'s deal data says it stays whole', async () => {
    followerApi.deal.mockResolvedValue(ok({ deal_page: true, offer: { id: 'o-set', type: 'bundle', sub_type: 'fixed', line: '3 items for ₹5,000' }, products: [], gifts: [] }));
    const r = await bagWith([...SET_LINES.map((l) => ({ ...l, ticked: false })), ...TEE_LINES], [SET, TEE]);
    await r.findByTestId('bag-unticked');
    expect(r.queryByTestId('bag-group-p-set')).toBeNull();
    await act(async () => { fireEvent.press(r.getByTestId('tick-s3')); });
    expect(followerApi.deal).toHaveBeenCalledWith('p-set');
    expect((await bagNow()).map((l) => [l.ref, l.ticked])).toEqual([['s1', true], ['s2', true], ['s3', true], ['t1', true]]);
  });

  it('an unticked item of a deal that is NOT locked comes back alone, as it always did', async () => {
    followerApi.deal.mockResolvedValue(ok({ deal_page: true, offer: { id: 'o-vol', type: 'volume', sub_type: 'quantity', line: TIERS }, products: [], gifts: [] }));
    const two = [line('t1', 'p-vol', 'tee', 'Blue', 'M', { ticked: false }), line('t2', 'p-vol', 'tee', 'Blue', 'L', { ticked: false }), ...SET_LINES];
    const r = await bagWith(two, [SET, TEE]);
    await r.findByTestId('bag-unticked');
    await act(async () => { fireEvent.press(r.getByTestId('tick-t2')); });
    expect((await bagNow()).filter((l) => l.post_id === 'p-vol').map((l) => [l.ref, l.ticked])).toEqual([['t1', false], ['t2', true]]);
  });

  it('a single unticked item needs no question asked', async () => {
    const r = await bagWith([line('t1', 'p-vol', 'tee', 'Blue', 'M', { ticked: false }), ...SET_LINES], [SET, TEE]);
    await r.findByTestId('bag-unticked');
    await act(async () => { fireEvent.press(r.getByTestId('tick-t1')); });
    expect(followerApi.deal).not.toHaveBeenCalled();
    expect((await bagNow()).find((l) => l.ref === 't1').ticked).toBe(true);
  });

  it('Remove deal removes every line of that post, and nothing else', async () => {
    const r = await bagWith([...SET_LINES, ...TEE_LINES, ...HEELS_LINES], [SET, TEE, HEELS]);
    await r.findByTestId('remove-deal-p-set');
    await act(async () => { fireEvent.press(r.getByTestId('remove-deal-p-set')); });
    expect((await bagNow()).map((l) => l.ref)).toEqual(['t1', 'h1', 'h2']);
    await waitFor(() => expect(r.queryByTestId('bag-group-p-set')).toBeNull());
    r.getByTestId('bag-group-p-vol'); r.getByTestId('bag-group-p-bogo');
  });

  it('Remove deal takes the post\'s unticked lines with it too', async () => {
    const mixed = [SET_LINES[0], { ...SET_LINES[1], ticked: false }, SET_LINES[2], ...TEE_LINES];
    const r = await bagWith(mixed, [SET, TEE]);
    await r.findByTestId('remove-deal-p-set');
    await act(async () => { fireEvent.press(r.getByTestId('remove-deal-p-set')); });
    expect((await bagNow()).map((l) => l.ref)).toEqual(['t1']);
  });

  it('Edit deal opens the deal page with that post\'s items', async () => {
    const r = await bagWith([...SET_LINES, ...TEE_LINES], [SET, TEE]);
    await r.findByTestId('edit-deal-p-set');
    fireEvent.press(r.getByTestId('edit-deal-p-set'));
    expect(r.n.navigate).toHaveBeenCalledWith('Deal', { postId: 'p-set', editing: true, lines: [expect.objectContaining({ ref: 's1' }), expect.objectContaining({ ref: 's2' }), expect.objectContaining({ ref: 's3' })] });
  });

  it('G2: buy one get one, the same way — the pair stays a pair, the free one says so at ₹0', async () => {
    const r = await bagWith(HEELS_LINES, [HEELS]);
    await r.findByTestId('bag-group-p-bogo');
    r.getByText('Bag · 2 items');
    r.getByTestId('tick-group-p-bogo');
    expect(texts(r.getByTestId('bag-line-h1'))).toEqual(['heels', 'Black · UK6', '₹4,599']);
    expect(texts(r.getByTestId('bag-line-h2'))).toEqual(['heels · Free', 'Black · UK5', '₹0']);
    for (const ref of ['h1', 'h2']) {
      expect(r.queryByTestId(`tick-${ref}`)).toBeNull();
      expect(r.queryByTestId(`qty-${ref}-plus`)).toBeNull();          // "+" used to add a second pair at full price, with no free one
      expect(r.queryByTestId(`change-${ref}`)).toBeNull();
      expect(r.queryByTestId(`remove-${ref}`)).toBeNull();
    }
    expect(texts(r.getByTestId('deal-whole-p-bogo'))).toEqual(['1 pair · ₹4,599', 'To add another pair, tap Edit deal.']);   // nothing struck: the pair costs what one costs
    r.getByTestId('edit-deal-p-bogo'); r.getByTestId('remove-deal-p-bogo');
    r.getByText('Continue · ₹4,599');
  });

  it.each([['pick_any'], ['mix_match']])('a bundle (%s): one group, with the bundle\'s sentence', async (sub) => {
    const bundle = group('p-bun', { id: 'o-bun', type: 'bundle', sub_type: sub, line: 'Any 2 for ₹2,999' }, { text: 'Set complete · you save ₹1,299', done: true },
      [priced('k1', 1604, 2299), priced('k2', 1395, 1999)]);
    const r = await bagWith([line('k1', 'p-bun', 'l511', 'Blue', '32'), line('k2', 'p-bun', 'wr', 'Blue', '30')], [bundle]);
    await r.findByTestId('bag-group-p-bun');
    r.getByTestId('tick-group-p-bun'); r.getByTestId('remove-deal-p-bun');
    expect(r.queryByTestId('qty-k1-plus')).toBeNull();
    expect(r.queryByTestId('tick-k1')).toBeNull();
    expect(texts(r.getByTestId('deal-whole-p-bun'))).toEqual(['Set complete · you save ₹1,299 · ₹2,999', '  ₹4,298', 'A bundle is bought together. To change it, tap Edit deal.']);
  });

  it('two sets bought through Edit deal show as ×2 — there is still no − 1 +', async () => {
    const twice = group('p-set', SET.offer, { text: '2 sets', done: true }, SET.lines.map((l) => ({ ...l, qty: 2, paid_total: l.paid_total * 2, normal_total: l.normal_total * 2 })));
    const r = await bagWith(SET_LINES.map((l) => ({ ...l, qty: 2 })), [twice]);
    await r.findByTestId('bag-group-p-set');
    expect(texts(r.getByTestId('bag-line-s1'))).toEqual(['red t shirt', 'Red · M ×2']);
    expect(texts(r.getByTestId('deal-whole-p-set'))[0]).toBe('2 sets · ₹10,000');
    expect(r.queryByTestId('qty-s1-plus')).toBeNull();
  });

  it('what the server says is wrong with a locked deal is still said (a set broken before this update)', async () => {
    const broken = group('p-set', SET.offer, { text: '2 of 3 chosen', done: false }, SET.lines.slice(0, 2), { problems: [{ code: 'incomplete_set', text: 'Sold only as the whole set' }], buyable: false });
    const r = await bagWith(SET_LINES.slice(0, 2), [broken]);
    await r.findByTestId('bag-group-p-set');
    r.getByText('Sold only as the whole set');
    r.getByTestId('edit-deal-p-set'); r.getByTestId('remove-deal-p-set');          // the two ways out
    expect(r.getByTestId('bag-continue').props.accessibilityState.disabled).toBe(true);
  });

  /* the table under G: where − 1 + stays */
  it.each([
    ['a plain discount (percentage)', { id: 'o', type: 'discount', sub_type: 'percentage', line: '20% off each item' }, false],
    ['a plain discount (flat)', { id: 'o', type: 'discount', sub_type: 'flat', line: '₹200 off per item' }, false],
    ['buy more, save more by count', { id: 'o', type: 'volume', sub_type: 'quantity', line: TIERS }, true],
    ['buy more, save more by amount', { id: 'o', type: 'volume', sub_type: 'value', line: 'Spend ₹2,000 → 10%' }, true],
    ['spend for a gift', { id: 'o', type: 'free_gift', sub_type: 'spend', line: 'Spend ₹3,000 · 1 gift' }, true],
    ['buy for a gift', { id: 'o', type: 'free_gift', sub_type: 'buy_x', line: 'Buy 2 · 1 gift' }, true],
    ['no offer', null, false],
  ])('%s: not locked — its own tick, − 1 +, Change · Remove · Move to Saved, as today', async (_name, offer, editDeal) => {
    const g = group('p-x', offer, null, [priced('d1', 719, 899), priced('d2', 2800, 3500)]);
    const r = await bagWith([line('d1', 'p-x', 'polo', 'Blue', 'M'), line('d2', 'p-x', 'casio', null, null)], [g]);
    await r.findByTestId('bag-group-p-x');
    expect(r.queryByTestId('tick-group-p-x')).toBeNull();
    expect(r.queryByTestId('remove-deal-p-x')).toBeNull();
    expect(r.queryByTestId('deal-whole-p-x')).toBeNull();
    for (const ref of ['d1', 'd2']) {
      r.getByTestId(`tick-${ref}`); r.getByTestId(`qty-${ref}-minus`); r.getByTestId(`qty-${ref}-plus`);
      r.getByTestId(`change-${ref}`); r.getByTestId(`remove-${ref}`); r.getByTestId(`save-${ref}`);
    }
    r.getByTestId('add-more-p-x');
    expect(!!r.queryByTestId('edit-deal-p-x')).toBe(editDeal);
    // − 1 + still works
    await act(async () => { fireEvent.press(r.getByTestId('qty-d1-plus')); });
    expect((await bagNow()).find((l) => l.ref === 'd1').qty).toBe(2);
    // and one item is unticked on its own
    await act(async () => { fireEvent.press(r.getByTestId('tick-d2')); });
    expect((await bagNow()).map((l) => [l.ref, l.ticked])).toEqual([['d1', true], ['d2', false]]);
  });
});

/* ═══════════════════════════════════════════ O6 · the review */

describe('O6 · Review your deal → Add to bag → back where she was', () => {
  const PICKS = [{ ref: 'a', product_id: 'rt', colour: 'Red', size: 'M', qty: 1, role: 'buy' }, { ref: 'b', product_id: 'gk', colour: 'Green', size: 'M', qty: 1, role: 'buy' }];
  const REVIEWED = group('p-set', { id: 'o-set', type: 'bundle', sub_type: 'fixed', line: '3 items for ₹5,000' }, { text: '1 set', done: true },
    [priced('a', 343, 500, { name: 'red t shirt', colour: 'Red', size: 'M' }), priced('b', 616, 899, { name: 'green kurat', colour: 'Green', size: 'M' })]);

  async function review(params = {}) {
    followerApi.dealPrice.mockResolvedValue(ok({ groups: [REVIEWED] }));
    const n = nav();
    const r = render(<DealReview navigation={n} route={{ params: { postId: 'p-set', lines: PICKS, ...params } }} />);
    await r.findByTestId('deal-review');
    return { ...r, n };
  }

  it('S7: one vibration, the green line, "Go to bag ›" — it does NOT open the Bag — and a second later the review and the deal page have both closed', async () => {
    const r = await review();
    r.getByText('Add to bag');
    jest.useFakeTimers();
    await act(async () => { fireEvent.press(r.getByTestId('review-add-to-bag')); });
    expect((await bagNow()).map((l) => [l.post_id, l.product_id])).toEqual([['p-set', 'rt'], ['p-set', 'gk']]);
    expect(Vibration.vibrate).toHaveBeenCalledTimes(1);
    expect(Vibration.vibrate).toHaveBeenCalledWith(40);
    r.getByText('✓ Added to your bag');
    const go = r.getByTestId('review-add-to-bag-go');
    expect(texts(go)).toEqual(['Go to bag ›']);
    expect(StyleSheet.flatten(go.props.style).backgroundColor).toBe('#1A1A17');
    expect(r.queryByTestId('review-add-to-bag')).toBeNull();
    r.getByTestId('review-buy-now');
    expect(r.n.navigate).not.toHaveBeenCalled();                    // today it opened the Bag here
    expect(r.n.pop).not.toHaveBeenCalled();
    act(() => { jest.advanceTimersByTime(ADDED_MS - 1); });
    expect(r.n.pop).not.toHaveBeenCalled();
    act(() => { jest.advanceTimersByTime(1); });
    expect(r.n.pop).toHaveBeenCalledTimes(1);
    expect(r.n.pop).toHaveBeenCalledWith(2);                        // the review, and the deal page under it
    expect(r.n.navigate).not.toHaveBeenCalled();                    // she is on the post she came from; nothing else opened
  });

  it('tapping "Go to bag ›" in that second closes both pages and opens the Bag', async () => {
    const r = await review();
    jest.useFakeTimers();
    await act(async () => { fireEvent.press(r.getByTestId('review-add-to-bag')); });
    fireEvent.press(r.getByTestId('review-add-to-bag-go'));
    expect(r.n.pop).toHaveBeenCalledWith(2);
    expect(r.n.navigate).toHaveBeenCalledWith('Bag');
    act(() => { jest.advanceTimersByTime(5000); });
    expect(r.n.pop).toHaveBeenCalledTimes(1);                       // the second does not fire after that
  });

  it('opened from the Bag\'s Edit deal: the post\'s items are replaced, and closing the two pages IS the Bag', async () => {
    await AsyncStorage.setItem('inflx_bag_v1', JSON.stringify([...SET_LINES, ...TEE_LINES]));
    const r = await review({ editing: true });
    jest.useFakeTimers();
    await act(async () => { fireEvent.press(r.getByTestId('review-add-to-bag')); });
    expect((await bagNow()).map((l) => [l.post_id, l.product_id])).toEqual([['p-vol', 'tee'], ['p-set', 'rt'], ['p-set', 'gk']]);
    expect(Vibration.vibrate).toHaveBeenCalledTimes(1);
    act(() => { jest.advanceTimersByTime(ADDED_MS); });
    expect(r.n.pop).toHaveBeenCalledWith(2);
    expect(r.n.navigate).not.toHaveBeenCalled();                    // no second Bag is opened on top of hers
  });

  it('…and "Go to bag ›" there does the same: back in the Bag, never a second one', async () => {
    const r = await review({ editing: true });
    jest.useFakeTimers();
    await act(async () => { fireEvent.press(r.getByTestId('review-add-to-bag')); });
    fireEvent.press(r.getByTestId('review-add-to-bag-go'));
    expect(r.n.pop).toHaveBeenCalledWith(2);
    expect(r.n.navigate).not.toHaveBeenCalled();
  });

  it('a navigator without pop still closes both pages', async () => {
    const r = await review();
    delete r.n.pop;
    jest.useFakeTimers();
    await act(async () => { fireEvent.press(r.getByTestId('review-add-to-bag')); });
    act(() => { jest.advanceTimersByTime(ADDED_MS); });
    expect(r.n.goBack).toHaveBeenCalledTimes(2);
  });

  it('the timer is cleared when the review goes: nothing is closed afterwards', async () => {
    const r = await review();
    jest.useFakeTimers();
    await act(async () => { fireEvent.press(r.getByTestId('review-add-to-bag')); });
    r.unmount();
    act(() => { jest.advanceTimersByTime(400); });                  // (a button fade of React Native's may still be finishing)
    expect(jest.getTimerCount()).toBe(0);
    act(() => { jest.advanceTimersByTime(5000); });
    expect(r.n.pop).not.toHaveBeenCalled();
    expect(r.n.goBack).not.toHaveBeenCalled();
  });

  it('she went to another page in that second (the bag icon): nothing is closed under her, and it cannot be added twice', async () => {
    const r = await review();
    jest.useFakeTimers();
    await act(async () => { fireEvent.press(r.getByTestId('review-add-to-bag')); });
    r.n.isFocused.mockReturnValue(false);
    act(() => { jest.advanceTimersByTime(ADDED_MS); });
    expect(r.n.pop).not.toHaveBeenCalled();
    r.getByTestId('review-add-to-bag-go');
    expect(r.queryByTestId('review-add-to-bag')).toBeNull();
  });

  it('Buy now is unchanged, and it calls off the return', async () => {
    const r = await review();
    jest.useFakeTimers();
    await act(async () => { fireEvent.press(r.getByTestId('review-add-to-bag')); });
    await act(async () => { fireEvent.press(r.getByTestId('review-buy-now')); });
    expect(r.n.navigate).toHaveBeenCalledWith('FollowerLogin', { onDone: expect.any(Function) });
    act(() => { jest.advanceTimersByTime(5000); });
    expect(r.n.pop).not.toHaveBeenCalled();
  });

  it('Buy now alone: no vibration, the bag untouched', async () => {
    const r = await review();
    await act(async () => { fireEvent.press(r.getByTestId('review-buy-now')); });
    expect(Vibration.vibrate).not.toHaveBeenCalled();
    expect(await bagNow()).toEqual([]);
    r.n.navigate.mock.calls[0][1].onDone();
    expect(r.n.navigate).toHaveBeenLastCalledWith('Checkout', { buyNow: true, lines: [expect.objectContaining({ post_id: 'p-set', product_id: 'rt' }), expect.objectContaining({ post_id: 'p-set', product_id: 'gk' })] });
  });

  it('a bag that could not be saved: it says so, with no vibration and no return', async () => {
    await AsyncStorage.setItem('inflx_token', 't');
    await AsyncStorage.setItem('inflx_user', JSON.stringify({ role: 'follower' }));
    followerApi.getBag.mockResolvedValue(ok({ lines: [] }));
    followerApi.putBag.mockResolvedValue({ success: false, error: { message: "Couldn't update your bag" } });
    const r = await review();
    jest.useFakeTimers();
    await act(async () => { fireEvent.press(r.getByTestId('review-add-to-bag')); });
    r.getByText("Couldn't update your bag");
    expect(Vibration.vibrate).not.toHaveBeenCalled();
    r.getByTestId('review-add-to-bag');                             // still "Add to bag"
    act(() => { jest.advanceTimersByTime(5000); });
    expect(r.n.pop).not.toHaveBeenCalled();
  });

  it('the review has the bag icon with its count', async () => {
    const r = await review();
    r.getByTestId('open-bag');
    expect(r.queryByTestId('open-search')).toBeNull();              // and no search button was added for it
    await act(async () => { fireEvent.press(r.getByTestId('review-add-to-bag')); });
    expect(r.getByTestId('bag-count').props.children).toBe(2);
  });
});

/* ═══════════════════════════════════════════ O3 · O6 · the deal page */

describe('the deal page: the bag icon, and the product pop-up\'s details block', () => {
  const SIZES = [{ colour: 'Navy', images: [], sizes: [{ size: 'M', left: null, sold_out: false }, { size: 'L', left: 2, sold_out: false }] }];
  const PREMIUM = {
    id: 'prem', name: 'Premium Polo T-Shirt', price: 899, shopper_price: 899, images: [], image_url: null, in_deal: true, category: null, colours: SIZES, sold_out: false,
    details: 'Smart cotton-blend polo designed for casual business and weekend wear.', size_chart: null, set_qty: null,
    brand_label: 'ExecutiveWear', category_path: 'Men › Topwear',
    specs: [{ key: 'fit', label: 'Fit', value: 'Slim' }, { key: 'neck', label: 'Neck', value: 'Polo' }, { key: 'sleeve', label: 'Sleeve', value: 'Half' }, { key: 'care', label: 'Care', value: 'Machine wash' }],
  };
  const BARE = { id: 'bare', name: 'Henley Tee', price: 699, shopper_price: 699, images: [], image_url: null, in_deal: true, category: null, colours: SIZES, sold_out: false,
    details: null, size_chart: null, set_qty: null, brand_label: null, category_path: null, specs: [] };
  const DATA = (over = {}) => ({
    post: { id: 'p-vol', creator: AKSHAYA, brand: AVEEN },
    offer: { id: 'o-vol', type: 'volume', sub_type: 'quantity', config: { tiers: [{ at: 1, value: 10 }, { at: 2, value: 20 }, { at: 3, value: 30 }] }, line: TIERS,
      how: 'The more you buy from this post, the more you save.', ends_on: '2026-10-31' },
    deal_page: true, returns: { hours: 168, words: '7 days', line: 'Within 7 days of delivery' },
    products: [PREMIUM, BARE], gifts: [], categories: [],
    ...over,
  });
  const rowsOf = (r, id) => r.getAllByTestId(new RegExp(`^${id}-row-`)).map((row) => texts(row));

  beforeEach(() => {
    followerApi.dealPrice.mockResolvedValue(ok({ groups: [] }));
  });

  it('the deal page has the bag icon with its count, and no search button', async () => {
    followerApi.deal.mockResolvedValue(ok(DATA()));
    await act(async () => { await saveBag([line('t1', 'p-vol', 'tee', 'Blue', 'M', { qty: 3 })]); });
    const r = render(<Deal navigation={nav()} route={{ params: { postId: 'p-vol' } }} />);
    await r.findByTestId('deal-grid');
    r.getByTestId('open-bag');
    expect(r.getByTestId('bag-count').props.children).toBe(3);
    expect(r.queryByTestId('open-search')).toBeNull();
  });

  it('S4: the pop-up shows Brand · Category · every listed detail · Returns, then the description — not the one grey "Details · …" line', async () => {
    followerApi.deal.mockResolvedValue(ok(DATA()));
    const r = render(<Deal navigation={nav()} route={{ params: { postId: 'p-vol' } }} />);
    await r.findByTestId('deal-grid');
    fireEvent.press(r.getByTestId('deal-product-prem'));
    await r.findByTestId('product-popup');
    r.getByText('Product details');
    expect(rowsOf(r, 'product-popup-details')).toEqual([
      ['Brand', 'ExecutiveWear'], ['Category', 'Men › Topwear'], ['Fit', 'Slim'], ['Neck', 'Polo'], ['Sleeve', 'Half'], ['Care', 'Machine wash'],
      ['Returns', 'Within 7 days of delivery'],
    ]);
    r.getByText('Description');
    expect(r.getByTestId('product-popup-details-description').props.children).toBe('Smart cotton-blend polo designed for casual business and weekend wear.');
    expect(r.queryByText(/Details ·/)).toBeNull();
    for (const not of [/rating/i, /\d+ reviews?/i, /MRP/, /tax/i, /★/]) expect(r.queryByText(not)).toBeNull();
    // picking still works exactly as it did
    fireEvent.press(r.getByTestId('product-popup-size-M'));
    await act(async () => { fireEvent.press(r.getByTestId('product-popup-primary')); });
    await waitFor(() => expect(followerApi.dealPrice).toHaveBeenLastCalledWith('p-vol', [expect.objectContaining({ product_id: 'prem', colour: 'Navy', size: 'M', role: 'buy' })]));
  });

  it('a product listed with little: only what there is — here just the returns rule', async () => {
    followerApi.deal.mockResolvedValue(ok(DATA()));
    const r = render(<Deal navigation={nav()} route={{ params: { postId: 'p-vol' } }} />);
    await r.findByTestId('deal-grid');
    fireEvent.press(r.getByTestId('deal-product-bare'));
    await r.findByTestId('product-popup');
    expect(rowsOf(r, 'product-popup-details')).toEqual([['Returns', 'Within 7 days of delivery']]);
    expect(r.queryByText('Description')).toBeNull();
  });

  it('a free gift\'s pop-up has no details block (a gift is not a listing she is buying)', async () => {
    followerApi.deal.mockResolvedValue(ok(DATA({
      offer: { id: 'o-g', type: 'free_gift', sub_type: 'spend', config: { min_spend: 500, gift_count: 1 }, line: 'Spend ₹500 · 1 gift of 2', how: 'Spend ₹500 on these products and choose 1 free gift from 2.' },
      gifts: [{ kind: 'gift_item', id: 'coin', name: 'Silver coin', worth: 650, image_url: null, left: null, all_given: false, colours: [], images: [] },
        { kind: 'gift_item', id: 'cap', name: 'Leather cap', worth: 499, image_url: null, left: null, all_given: false, colours: [], images: [] }],
    })));
    followerApi.dealPrice.mockResolvedValue(ok({ groups: [group('p-vol', { type: 'free_gift', sub_type: 'spend', line: 'Spend ₹500' }, { text: 'Gift unlocked · choose 1', done: true }, [], { gift: { state: 'choose' } })] }));
    const r = render(<Deal navigation={nav()} route={{ params: { postId: 'p-vol' } }} />);
    await r.findByTestId('gift-steps');
    await waitFor(() => r.getByText('2 · Choose your gift'));
    fireEvent.press(r.getByTestId('step-gift'));
    await r.findByTestId('gift-grid');
    fireEvent.press(r.getByTestId('gift-coin'));
    await r.findByTestId('product-popup');
    expect(r.queryByTestId('product-popup-details')).toBeNull();
    expect(r.queryByText('Returns')).toBeNull();
  });

  it('the bag\'s "Change" pop-up on an item that is not locked shows the same block', async () => {
    const DISC = group('p-x', { id: 'o', type: 'discount', sub_type: 'percentage', line: '20% off each item' }, null, [priced('d1', 719, 899)]);
    followerApi.deal.mockResolvedValue(ok(DATA({ deal_page: false, products: [{ ...PREMIUM, id: 'polo' }] })));
    const r = await bagWith([line('d1', 'p-x', 'polo', 'Navy', 'M')], [DISC]);
    await r.findByTestId('change-d1');
    await act(async () => { fireEvent.press(r.getByTestId('change-d1')); });
    await r.findByTestId('bag-change');
    expect(rowsOf(r, 'bag-change-details').map((x) => x[0])).toEqual(['Brand', 'Category', 'Fit', 'Neck', 'Sleeve', 'Care', 'Returns']);
  });
});
