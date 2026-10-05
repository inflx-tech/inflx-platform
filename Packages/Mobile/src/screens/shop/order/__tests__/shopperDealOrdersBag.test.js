/**
 * shopper-deal-orders, part C — the bag when one item of an offer was bought alone (board B5, B6).
 * The board's example: Akshaya's post, "Any 3 for ₹2,999" — Premium Polo T-Shirt ₹1,299, Oxford
 * Shirt ₹1,499, Slim Jeans ₹1,999 (and a fourth, a Linen Coat ₹2,499, for "more than the deal needs").
 *
 *   CP9   one item of the bundle: an ordinary row at its normal price, the server's nudge with
 *         "See offer ›", no "Edit deal" in the header
 *   CP10  the three complete the offer: one deal — one tick, Edit deal, nothing to press on an item,
 *         Remove deal; "The offer applied by itself." only when she had added one alone
 *   CP11  four items: the server's three are the deal, the fourth an ordinary row under it
 *   CP12  buy one get one, and a set sold only whole, are as they were
 *
 * The "server" here prices as the real engine does (the costliest fill the set first; a line of two
 * can sit half in the set) — the screen works nothing out.
 */
import React from 'react';
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
const bagStore = require('../../../../components/shop/bag');
const BagModule = require('../BagScreen');
const Bag = BagModule.default;
const { splitByDeal } = BagModule;

const nav = () => ({ goBack: jest.fn(), navigate: jest.fn(), replace: jest.fn(), pop: jest.fn(), isFocused: jest.fn(() => true), addListener: jest.fn(() => () => {}) });
const ok = (data) => ({ success: true, data });
const bagNow = async () => JSON.parse(await AsyncStorage.getItem('inflx_bag_v1')) || [];
const texts = (node) => node.findAll((n) => typeof n.type === 'string' && n.type === 'Text').map((n) => [].concat(n.props.children).filter((c) => typeof c === 'string' || typeof c === 'number').join(''));
const said = (node) => texts(node).join('');
const inr = (n) => `₹${Number(n).toLocaleString('en-IN')}`;

const AKSHAYA = { id: 'c1', name: 'Akshaya' };
const AVEEN = { id: 'b1', name: 'Aveen fashion boutique and desiner studio' };
const POST = 'p-any3';
const PRICE = { polo: 1299, shirt: 1499, jeans: 1999, coat: 2499, red: 500, blazer: 4298, chino: 2500 };
const NAME = { polo: 'Premium Polo T-Shirt', shirt: 'Oxford Shirt', jeans: 'Slim Jeans', coat: 'Linen Coat', red: 'red t shirt', blazer: 'Blazer', chino: 'Chino' };
const line = (ref, product_id, colour, size, extra = {}) => ({ ref, post_id: POST, product_id, gift_item_id: null, colour, size, qty: 1, role: 'buy', ticked: true, price_seen: PRICE[product_id], ...extra });
const JEANS = () => line('j', 'jeans', 'Indigo', '32');
const POLO = (extra) => line('p', 'polo', 'Navy', 'M', extra);
const SHIRT = () => line('s', 'shirt', 'White', 'M');
const COAT = () => line('c', 'coat', 'Sand', 'L');

/** "Any 3 for ₹2,999", priced as the engine prices it. `alone` is what the server says of the offer. */
function bundleGroup(on, { alone = true } = {}) {
  const units = on.flatMap((l) => Array.from({ length: l.qty }, () => ({ ref: l.ref, pid: l.product_id, normal: PRICE[l.product_id], deal: null })));
  const sorted = [...units].sort((a, b) => b.normal - a.normal);
  const sets = Math.floor(sorted.length / 3);
  let saved = 0;
  for (let s = 0; s < sets; s += 1) {
    const us = sorted.slice(s * 3, s * 3 + 3);
    const sum = us.reduce((x, u) => x + u.normal, 0);
    let left = 2999;
    us.forEach((u, i) => { u.deal = `set-${s + 1}`; u.paid = i === us.length - 1 ? left : Math.round((u.normal * 2999) / sum); left -= u.paid; });
    saved += sum - 2999;
  }
  for (const u of sorted) if (!u.deal) u.paid = u.normal;
  const parts = new Map();
  for (const u of sorted) {
    const k = `${u.ref}|${u.deal}`;
    const p = parts.get(k) || { ref: u.ref, product_id: u.pid, name: NAME[u.pid], image_url: null, role: 'buy', qty: 0, deal_key: u.deal, paid_total: 0, normal_total: 0, problems: [], notes: [] };
    p.qty += 1; p.paid_total += u.paid; p.normal_total += u.normal;
    parts.set(k, p);
  }
  const lines = [...parts.values()];
  const n = sorted.length;
  const rest = n % 3;
  return {
    post_id: POST, creator: AKSHAYA, brand: AVEEN,
    offer: { id: 'o-any3', type: 'bundle', sub_type: 'pick_any', line: 'Any 3 for ₹2,999', alone },
    progress: !sets ? { text: `${n} of 3 picked`, done: false, next: `Pick ${3 - n} more to complete the set` }
      : rest ? { text: `${sets} set${sets > 1 ? 's' : ''} complete`, done: true, next: `Add ${3 - rest} more to complete another set of 3 for ₹2,999` }
        : { text: `Set complete · you save ${inr(saved)}`, done: true },
    alone_nudge: !sets ? `Add ${3 - n} more from this post and get all 3 for ₹2,999` : rest ? `Add ${3 - rest} more to complete another set of 3 for ₹2,999` : null,
    gift: null, problems: [], buyable: true, gift_value: 0, lines,
    normal_total: lines.reduce((s, l) => s + l.normal_total, 0), paid_total: lines.reduce((s, l) => s + l.paid_total, 0),
    savings: lines.reduce((s, l) => s + l.normal_total - l.paid_total, 0),
  };
}
function server(groupOf = bundleGroup) {
  return async (lines) => {
    const on = lines.filter((l) => l.ticked !== false);
    const gs = on.length ? [groupOf(on)] : [];
    return ok({
      groups: gs,
      unticked: lines.filter((l) => l.ticked === false).map((l) => ({ ...l, name: NAME[l.product_id], image_url: null, normal_unit: PRICE[l.product_id], problems: [] })),
      items_normal: gs.reduce((s, g) => s + g.normal_total, 0), savings: gs.reduce((s, g) => s + g.savings, 0),
      items_total: gs.reduce((s, g) => s + g.paid_total, 0), buyable: gs.length > 0,
    });
  };
}
async function bagWith(lines, groupOf) {
  await AsyncStorage.setItem('inflx_bag_v1', JSON.stringify(lines));
  followerApi.bagPrice.mockImplementation(server(groupOf));
  const n = nav();
  const r = render(<Bag navigation={n} />);
  await waitFor(() => expect(followerApi.bagPrice).toHaveBeenCalled());
  await r.findByTestId('bag');
  await r.findByTestId(`bag-group-${POST}`);
  return { ...r, n };
}
const press = async (r, id) => { await act(async () => { fireEvent.press(r.getByTestId(id)); }); };

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  shopStore._reset();
  bagStore._resetBag();
});

/* ═══════════════════════════════════════════ B5 */

describe('B5 · one item of an offer, bought alone', () => {
  it('CP9 an ordinary row at its normal price, with the server\'s nudge and "See offer ›" — no Edit deal, no deal block', async () => {
    const r = await bagWith([JEANS()]);
    r.getByText('Bag · 1 item');
    // the header says who it is from, and no more: the offer is in the nudge
    expect(r.queryByTestId(`tick-group-${POST}`)).toBeNull();
    expect(r.queryByTestId(`edit-deal-${POST}`)).toBeNull();
    expect(r.queryByText('Any 3 for ₹2,999')).toBeNull();
    expect(r.queryByTestId(`deal-whole-${POST}`)).toBeNull();
    expect(r.queryByTestId(`remove-deal-${POST}`)).toBeNull();
    // the row: tick, − 1 +, Change, Remove, Move to Saved, ₹1,999
    r.getByTestId('tick-j'); r.getByTestId('qty-j-minus'); r.getByTestId('qty-j-plus');
    expect(r.getByTestId('qty-j-value').props.children).toBe(1);
    r.getByTestId('change-j'); r.getByTestId('remove-j'); r.getByTestId('save-j');
    r.getByText('Slim Jeans'); r.getByText('Indigo · 32');
    expect(said(r.getByTestId('alone-price-j'))).toBe('₹1,999');
    expect(said(r.getByTestId(`alone-nudge-${POST}`))).toBe('Add 2 more from this post and get all 3 for ₹2,999 · See offer ›');
    r.getByTestId(`add-more-${POST}`);
    expect(r.getByTestId('money-total').props.children).toBe('₹1,999');
    expect(r.getByTestId('bag-continue').props.accessibilityState ? r.getByTestId('bag-continue').props.accessibilityState.disabled : false).not.toBe(true);
    r.getByText('Continue · ₹1,999');
  });

  it('See offer › opens the deal page with what she has from that post already in it', async () => {
    const r = await bagWith([JEANS()]);
    await press(r, `alone-nudge-${POST}`);
    expect(r.n.navigate).toHaveBeenCalledWith('Deal', { postId: POST, lines: [expect.objectContaining({ ref: 'j', product_id: 'jeans', size: '32' })], editing: true });
  });

  it('− 1 + and Remove work on it as on any single item', async () => {
    const r = await bagWith([JEANS()]);
    await press(r, 'qty-j-plus');
    await waitFor(async () => expect((await bagNow())[0].qty).toBe(2));
    await waitFor(() => expect(said(r.getByTestId(`alone-nudge-${POST}`))).toBe('Add 1 more from this post and get all 3 for ₹2,999 · See offer ›'));
    await press(r, 'remove-j');
    await waitFor(async () => expect(await bagNow()).toEqual([]));
  });

  it('Change opens the size and colour pop-up here — not the deal page', async () => {
    const jeans = { id: 'jeans', name: 'Slim Jeans', price: 1999, shopper_price: 1999, image_url: null, images: [], in_deal: true, sold_out: false,
      colours: [{ colour: 'Indigo', images: [], sizes: [{ size: '32', price: 1999, shopper_price: 1999, left: null, sold_out: false }, { size: '34', price: 1999, shopper_price: 1999, left: null, sold_out: false }] }], specs: [] };
    followerApi.deal.mockResolvedValue(ok({ deal_page: true, buy_alone: true, offer: { type: 'bundle', sub_type: 'pick_any', line: 'Any 3 for ₹2,999' }, products: [jeans], returns: null }));
    const r = await bagWith([JEANS()]);
    await press(r, 'change-j');
    await r.findByTestId('bag-change');
    expect(r.n.navigate).not.toHaveBeenCalledWith('Deal', expect.anything());
    fireEvent.press(r.getByTestId('bag-change-size-34'));
    await press(r, 'bag-change-primary');
    await waitFor(async () => expect((await bagNow())[0]).toMatchObject({ ref: 'j', size: '34', qty: 1 }));
  });

  it('…while a deal that cannot be bought alone still changes on its deal page', async () => {
    followerApi.deal.mockResolvedValue(ok({ deal_page: true, buy_alone: true, offer: { type: 'volume', sub_type: 'quantity', line: 'Buy 2 → 20% off' }, products: [], returns: null }));
    const volume = (on) => ({ ...bundleGroup(on), offer: { id: 'o-v', type: 'volume', sub_type: 'quantity', line: 'Buy 2 → 20% off', alone: true }, alone_nudge: null,
      progress: { text: '1 item', done: false, next: '1 more → 20% off' } });
    const r = await bagWith([JEANS()], volume);
    await press(r, 'change-j');
    expect(r.n.navigate).toHaveBeenCalledWith('Deal', expect.objectContaining({ postId: POST, editing: true }));
  });

  it('a piece of a set whose brand allows its pieces alone is the same ordinary row, with the set\'s nudge', async () => {
    const openSet = (on) => ({ ...bundleGroup(on), offer: { id: 'o-set', type: 'bundle', sub_type: 'fixed', line: '3 items for ₹5,000', alone: true },
      progress: { text: '1 of 3 chosen', done: false }, alone_nudge: 'Take the whole set of 3 and pay ₹5,000',
      lines: on.map((l) => ({ ref: l.ref, name: NAME[l.product_id], image_url: null, role: 'buy', qty: l.qty, deal_key: null, paid_total: PRICE[l.product_id], normal_total: PRICE[l.product_id], problems: [], notes: [] })) });
    const r = await bagWith([line('r', 'red', 'Red', 'M')], openSet);
    r.getByTestId('qty-r-plus'); r.getByTestId('remove-r');
    expect(said(r.getByTestId('alone-price-r'))).toBe('₹500');
    expect(said(r.getByTestId(`alone-nudge-${POST}`))).toBe('Take the whole set of 3 and pay ₹5,000 · See offer ›');
    expect(r.queryByTestId(`deal-whole-${POST}`)).toBeNull();
  });
});

/* ═══════════════════════════════════════════ B6 */

describe('B6 · her items complete the offer', () => {
  it('CP10 the three are one deal: one tick, Edit deal, nothing to press on an item, the deal\'s price with the normal total struck, Remove deal', async () => {
    const r = await bagWith([JEANS(), POLO(), SHIRT()]);
    r.getByText('Bag · 3 items');
    r.getByTestId(`tick-group-${POST}`); r.getByTestId(`edit-deal-${POST}`);
    r.getByText('Any 3 for ₹2,999');
    for (const ref of ['j', 'p', 's']) {
      r.getByTestId(`deal-line-${ref}`);
      for (const id of [`tick-${ref}`, `qty-${ref}-plus`, `change-${ref}`, `remove-${ref}`, `save-${ref}`, `bag-line-${ref}`]) expect(r.queryByTestId(id)).toBeNull();
    }
    expect(texts(r.getByTestId(`deal-whole-${POST}`))).toEqual(expect.arrayContaining(['A bundle is bought together. To change it, tap Edit deal.']));
    expect(said(r.getByTestId(`deal-whole-${POST}`))).toContain('Set complete · you save ₹1,798 · ₹2,999');
    expect(said(r.getByTestId(`deal-whole-${POST}`))).toContain('₹4,797');
    r.getByTestId(`remove-deal-${POST}`);
    expect(r.queryByTestId(`alone-nudge-${POST}`)).toBeNull();
    expect(r.queryByTestId(`add-more-${POST}`)).toBeNull();
    expect(r.getByTestId('money-total').props.children).toBe('₹2,999');
    r.getByText('Continue · ₹2,999');
  });

  it('"The offer applied by itself." shows only when she had added one of them alone', async () => {
    const built = await bagWith([JEANS(), POLO(), SHIRT()]);
    expect(built.queryByTestId(`offer-applied-${POST}`)).toBeNull();           // a deal built on its deal page says nothing of the kind
    built.unmount();
    bagStore.noteAddedAlone(POST);
    const r = await bagWith([JEANS(), POLO(), SHIRT()]);
    expect(r.getByTestId(`offer-applied-${POST}`).props.children).toBe('The offer applied by itself.');
  });

  it('adding the third item alone turns the two ordinary rows into the deal — and taking one out turns it back', async () => {
    const r = await bagWith([JEANS(), POLO()]);
    r.getByTestId('qty-j-plus'); r.getByTestId('qty-p-plus');
    expect(said(r.getByTestId(`alone-nudge-${POST}`))).toBe('Add 1 more from this post and get all 3 for ₹2,999 · See offer ›');
    r.unmount();
    bagStore.noteAddedAlone(POST);
    const three = await bagWith([JEANS(), POLO(), SHIRT()]);
    three.getByTestId(`deal-whole-${POST}`);
    three.getByTestId(`offer-applied-${POST}`);
    // Remove deal: the three go, and the mark with them
    await press(three, `remove-deal-${POST}`);
    await waitFor(async () => expect(await bagNow()).toEqual([]));
    expect(bagStore.wasAddedAlone(POST)).toBe(false);
  });

  it('the one tick unticks the three together, and ticking one of them again brings the three back', async () => {
    const r = await bagWith([JEANS(), POLO(), SHIRT()]);
    await press(r, `tick-group-${POST}`);
    await waitFor(async () => expect((await bagNow()).map((l) => l.ticked)).toEqual([false, false, false]));
    await r.findByTestId('bag-unticked');
    await press(r, 'tick-p');
    await waitFor(async () => expect((await bagNow()).map((l) => l.ticked)).toEqual([true, true, true]));
    await r.findByTestId(`deal-whole-${POST}`);
  });

  it('Edit deal opens the deal page with the post\'s items', async () => {
    const r = await bagWith([JEANS(), POLO(), SHIRT()]);
    await press(r, `edit-deal-${POST}`);
    expect(r.n.navigate).toHaveBeenCalledWith('Deal', { postId: POST, lines: expect.arrayContaining([expect.objectContaining({ ref: 'j' }), expect.objectContaining({ ref: 'p' }), expect.objectContaining({ ref: 's' })]), editing: true });
  });
});

/* ═══════════════════════════════════════════ more than the deal needs */

describe('CP11 · four items of "any 3"', () => {
  it('the server\'s three are the deal; the fourth is an ordinary row under it, with the nudge to complete another', async () => {
    const r = await bagWith([JEANS(), POLO(), SHIRT(), COAT()]);
    for (const ref of ['c', 'j', 's']) r.getByTestId(`deal-line-${ref}`);          // the three costliest
    expect(r.queryByTestId('deal-line-p')).toBeNull();
    r.getByTestId('bag-line-p'); r.getByTestId('tick-p'); r.getByTestId('qty-p-plus'); r.getByTestId('change-p'); r.getByTestId('remove-p'); r.getByTestId('save-p');
    expect(said(r.getByTestId('alone-price-p'))).toBe('₹1,299');
    expect(said(r.getByTestId(`deal-whole-${POST}`))).toContain('1 set complete · ₹2,999');
    expect(said(r.getByTestId(`deal-whole-${POST}`))).toContain('₹5,997');                 // the three's normal total, not the four's
    expect(said(r.getByTestId(`alone-nudge-${POST}`))).toBe('Add 2 more to complete another set of 3 for ₹2,999 · See offer ›');
    expect(r.getByTestId('money-total').props.children).toBe('₹4,298');
  });

  it('Remove deal takes the three and leaves the fourth; the tick unticks the three only', async () => {
    const r = await bagWith([JEANS(), POLO(), SHIRT(), COAT()]);
    await press(r, `tick-group-${POST}`);
    await waitFor(async () => expect((await bagNow()).filter((l) => l.ticked === false).map((l) => l.ref).sort()).toEqual(['c', 'j', 's']));
    r.unmount();
    const again = await bagWith([JEANS(), POLO(), SHIRT(), COAT()]);
    await press(again, `remove-deal-${POST}`);
    await waitFor(async () => expect((await bagNow()).map((l) => l.ref)).toEqual(['p']));
  });

  it('removing the fourth leaves the deal as it was', async () => {
    const r = await bagWith([JEANS(), POLO(), SHIRT(), COAT()]);
    await press(r, 'remove-p');
    await waitFor(async () => expect((await bagNow()).map((l) => l.ref).sort()).toEqual(['c', 'j', 's']));
    await waitFor(() => expect(r.queryByTestId('bag-line-p')).toBeNull());
    r.getByTestId(`deal-whole-${POST}`);
  });

  it('two of one size where one is in the set and one is not: it shows in both, and the row below acts on the one outside only', async () => {
    const r = await bagWith([POLO({ qty: 2 }), JEANS(), COAT()]);
    r.getByTestId('deal-line-p'); r.getByTestId('bag-line-p');
    expect(r.getByTestId('qty-p-value').props.children).toBe(1);          // one outside the set
    expect(said(r.getByTestId('alone-price-p'))).toBe('₹1,299');
    for (const id of ['tick-p', 'change-p', 'save-p']) expect(r.queryByTestId(id)).toBeNull();   // those would act on the set's one too
    await press(r, 'qty-p-plus');
    await waitFor(async () => expect((await bagNow()).find((l) => l.ref === 'p').qty).toBe(3));
    r.unmount();
    const again = await bagWith([POLO({ qty: 2 }), JEANS(), COAT()]);
    await press(again, 'remove-p');                                       // only the one outside goes
    await waitFor(async () => expect((await bagNow()).find((l) => l.ref === 'p').qty).toBe(1));
  });

  it('Remove deal on that bag takes one of the two, the one in the set', async () => {
    const r = await bagWith([POLO({ qty: 2 }), JEANS(), COAT()]);
    await press(r, `remove-deal-${POST}`);
    await waitFor(async () => expect((await bagNow()).map((l) => [l.ref, l.qty])).toEqual([['p', 1]]));
  });
});

/* ═══════════════════════════════════════════ what the split is made of */

describe('splitByDeal', () => {
  const g = (lines) => ({ lines });
  const part = (ref, qty, deal_key, paid, normal) => ({ ref, role: 'buy', qty, deal_key, paid_total: paid, normal_total: normal });

  it('units inside a completed set are the deal; units outside are loose; a line can be in both', () => {
    const mine = [POLO({ qty: 2 }), JEANS()];
    const { deal, loose } = splitByDeal(g([part('p', 1, 'set-1', 812, 1299), part('p', 1, null, 1299, 1299), part('j', 1, 'set-1', 1250, 1999)]), mine);
    expect(deal.map((d) => [d.l.ref, d.qty, d.paid])).toEqual([['p', 1, 812], ['j', 1, 1250]]);
    expect(loose.map((d) => [d.l.ref, d.qty, d.inQty, d.paid])).toEqual([['p', 1, 1, 1299]]);
  });

  it('"volume" and "gift-deal" are not sets: those items stay loose; a line the server did not price is loose too', () => {
    const { deal, loose } = splitByDeal(g([part('j', 1, 'volume', 1599, 1999)]), [JEANS(), POLO()]);
    expect(deal).toEqual([]);
    expect(loose.map((d) => [d.l.ref, d.qty, d.paid])).toEqual([['j', 1, 1599], ['p', 1, null]]);
  });
});

/* ═══════════════════════════════════════════ CP12 */

describe('CP12 · what cannot be bought alone is as it was', () => {
  it('a set sold only whole (`alone: false`): one group, no − 1 +, even when the server has not put it in a set', async () => {
    const shut = (on) => ({ ...bundleGroup(on, { alone: false }), offer: { id: 'o-set', type: 'bundle', sub_type: 'fixed', line: '3 items for ₹5,000', alone: false },
      progress: { text: '1 of 3 chosen', done: false }, alone_nudge: null, problems: [{ code: 'incomplete_set', text: 'Sold only as the whole set' }], buyable: false });
    const r = await bagWith([line('r', 'red', 'Red', 'M')], shut);
    r.getByTestId(`tick-group-${POST}`); r.getByTestId(`remove-deal-${POST}`); r.getByTestId(`deal-whole-${POST}`);
    for (const id of ['qty-r-plus', 'change-r', 'remove-r', `alone-nudge-${POST}`]) expect(r.queryByTestId(id)).toBeNull();
    r.getByText('Sold only as the whole set');
  });

  it('a bundle from an older server (no `alone`): the whole group, as before this change', async () => {
    const old = (on) => { const x = bundleGroup(on); delete x.offer.alone; delete x.alone_nudge; return x; };
    const r = await bagWith([JEANS()], old);
    r.getByTestId(`tick-group-${POST}`); r.getByTestId(`remove-deal-${POST}`);
    expect(r.queryByTestId('qty-j-plus')).toBeNull();
    expect(r.queryByTestId(`alone-nudge-${POST}`)).toBeNull();
  });
});
