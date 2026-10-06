/**
 * shopper-deal-orders, part B — Return or replace (board R1–R8 · the founder's rules D2, D3, D5).
 * The board's example: "Any 3 for ₹2,999" — Premium Polo T-Shirt, Oxford Shirt, Slim Jeans (Indigo · 32;
 * its share of the ₹2,999 is ₹1,250).
 *
 *   R1  Return or replace: "One item is not right" or "Return the whole deal"
 *   R2  which item, and what is wrong (three reasons — never "I changed my mind")
 *   R3  the size doesn't fit → another size in stock → Request replacement
 *   R7  …no other size in stock → keep it, or return the whole deal
 *   R4  damaged / not as shown, the store has one → the same item again
 *   R5  …the store has no more → refund of that item's share; she keeps the rest
 *   R8  the box on the deal's page: Replacement requested → approved → Replaced (or not accepted)
 *
 * Which sizes are in stock, each item's share and what a request becomes are the server's; the
 * screens work nothing out.
 */
import React from 'react';
import { render, fireEvent, act, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

jest.mock('../../../../services/api', () => ({
  followerApi: {
    orders: jest.fn(), orderLine: jest.fn(), cancelPreview: jest.fn(), cancelLine: jest.fn(), returnPreview: jest.fn(), returnLine: jest.fn(),
    replacePreview: jest.fn(), replaceLine: jest.fn(), checkout: jest.fn(),
  },
  setDeviceHeader: jest.fn(), clearSession: jest.fn(() => Promise.resolve()),
}));
jest.mock('../../../../services/events', () => ({ track: jest.fn(), flush: jest.fn() }));
jest.mock('@react-navigation/native', () => ({ useFocusEffect: (cb) => { const React = require('react'); React.useEffect(() => cb(), [cb]); } }));

const { followerApi } = require('../../../../services/api');
const { OrdersScreen, OrderDetailScreen } = require('../OrderScreens');
const ReturnScreen = require('../ReturnScreen').default;
const { ReturnBox } = require('../ReturnScreen');
const ReplaceScreen = require('../ReplaceScreen').default;
const { CR, boxLine } = require('../../../../components/shop/copyReturn');
const { dayLabel } = require('../../../../components/shop/copyOrder');
const { inr } = require('../../../../components/shop/copyShop');

const nav = () => ({ goBack: jest.fn(), navigate: jest.fn(), replace: jest.fn(), addListener: jest.fn(() => () => {}) });
const ok = (data) => ({ success: true, data });
const refuse = (message, extra = {}) => ({ success: false, error: { code: 'CONFLICT', message, ...extra } });
const texts = (node) => node.findAll((n) => typeof n.type === 'string' && n.type === 'Text').map((n) => [].concat(n.props.children).filter((c) => typeof c === 'string' || typeof c === 'number').join(''));
const said = (node) => texts(node).join('');
const disabled = (node) => node.props.accessibilityState.disabled;

const AVEEN = 'Aveen fashion boutique and desiner studio';
const sz = (size, current, in_stock) => ({ size, current, in_stock });
const item = (id, name, colour, size, share, over = {}) => ({
  id, name, image_url: null, colour, size, qty: 1, role: 'buy', can: true, why: null, replaced: false, pair: false,
  colours: [{ colour, sizes: [sz('S', false, true), sz(size, true, true), sz('L', false, true)] }],
  other_size: true, same_in_stock: true,
  refund: { amount: share, text: `Refund of ${inr(share)} to your original payment method once it is back.` }, ...over,
});
const JEANS = (over = {}) => item('l3', 'Slim Jeans', 'Indigo', '32', 1250, {
  colours: [
    { colour: 'Indigo', sizes: [sz('30', false, true), sz('32', true, true), sz('34', false, true), sz('36', false, false)] },
    { colour: 'Black', sizes: [sz('32', false, true)] },
  ], ...over });
const PV = (over = {}) => ({
  deal: { line: 'Any 3 for ₹2,999', creator: 'Akshaya Reddy', brand: AVEEN },
  until: '2026-10-11T11:00:00.000Z', window: '7 days',
  reasons: [{ key: 'wrong_size', label: "The size doesn't fit" }, { key: 'damaged', label: 'It arrived damaged' }, { key: 'not_as_described', label: "It isn't as shown" }],
  items: [item('l1', 'Premium Polo T-Shirt', 'Navy', 'M', 812), item('l2', 'Oxford Shirt', 'White', 'M', 937), JEANS()],
  whole: { can: true, count: 3, amount: 2999 }, ...over,
});
const NOTE = 'The stitching at the left pocket has come apart.';

async function open(pv = PV(), lineId = 'l2') {
  followerApi.replacePreview.mockResolvedValue(pv && pv.success === false ? pv : ok(pv));
  const n = nav();
  const r = render(<ReplaceScreen navigation={n} route={{ params: { lineId } }} />);
  await waitFor(() => expect(followerApi.replacePreview).toHaveBeenCalledWith(lineId));
  return { r, n };
}
/** R1 → R2 → pick the item and the reason → Continue. */
async function toStep(r, itemId, reason) {
  await r.findByTestId('replace-choose');
  fireEvent.press(r.getByTestId('replace-one-item'));
  fireEvent.press(r.getByTestId(`replace-item-${itemId}`));
  fireEvent.press(r.getByTestId(`replace-reason-${reason}`));
  fireEvent.press(r.getByTestId('replace-continue'));
}

beforeEach(async () => { jest.clearAllMocks(); await AsyncStorage.clear(); });

/* ═══════════════════════════════════════════ R1 */

describe('R1 · Return or replace — what does she want?', () => {
  it('the deal, two choices and until when', async () => {
    const { r } = await open();
    await r.findByTestId('replace-choose');
    r.getByText('Return or replace');
    expect(r.getByTestId('replace-deal-line').props.children).toBe('Any 3 for ₹2,999');
    r.getByText(`Akshaya Reddy · ${AVEEN}`);
    expect(texts(r.getByTestId('replace-one-item'))).toEqual(expect.arrayContaining(['One item is not right', 'Replace it. The deal stays.']));
    expect(texts(r.getByTestId('replace-whole'))).toEqual(expect.arrayContaining(['Return the whole deal', 'All 3 items go back. Refund of ₹2,999.']));
    expect(r.getByTestId('replace-until').props.children).toMatch(/^You can return this until \w{3}, 11 Oct, /);
  });

  it('"Return the whole deal" opens the Return screen she knows, in this screen\'s place', async () => {
    const { r, n } = await open();
    await r.findByTestId('replace-choose');
    fireEvent.press(r.getByTestId('replace-whole'));
    expect(n.replace).toHaveBeenCalledWith('ReturnItem', { lineId: 'l2' });
  });

  it('what cannot be asked is not offered: the whole deal when it cannot go back; one item when every item has had its answer', async () => {
    const a = await open(PV({ whole: { can: false, count: 3, amount: 2999 } }));
    await a.r.findByTestId('replace-choose');
    expect(disabled(a.r.getByTestId('replace-whole'))).toBe(true);
    expect(disabled(a.r.getByTestId('replace-one-item'))).toBe(false);
    a.r.unmount();
    const b = await open(PV({ items: PV().items.map((x) => ({ ...x, can: false, why: 'INFLX has already answered a request for this item. You can still return the whole deal.' })) }));
    await b.r.findByTestId('replace-choose');
    expect(disabled(b.r.getByTestId('replace-one-item'))).toBe(true);
    expect(disabled(b.r.getByTestId('replace-whole'))).toBe(false);
  });

  it('she cannot ask (the window has closed): the server\'s own sentence, no Try again; a lost connection has Try again', async () => {
    const a = await open(refuse('The return window (7 days from delivery) has closed.'));
    await a.r.findByTestId('replace-refused');
    a.r.getByText('The return window (7 days from delivery) has closed.');
    expect(a.r.queryByText('Try again')).toBeNull();
    a.r.unmount();
    followerApi.replacePreview.mockResolvedValue({ success: false, error: { code: 'NETWORK_ERROR', message: 'x' } });
    const b = render(<ReplaceScreen navigation={nav()} route={{ params: { lineId: 'l2' } }} />);
    await b.findByTestId('replace-refused');
    followerApi.replacePreview.mockResolvedValue(ok(PV()));
    await act(async () => { fireEvent.press(b.getByText('Try again')); });
    await b.findByTestId('replace-choose');
  });
});

/* ═══════════════════════════════════════════ R2 */

describe('R2 · which item, and what is wrong', () => {
  it('the deal\'s three items and three reasons — "I changed my mind" is not one of them; Continue needs both', async () => {
    const { r } = await open();
    await r.findByTestId('replace-choose');
    fireEvent.press(r.getByTestId('replace-one-item'));
    await r.findByTestId('replace-item');
    r.getByText('One item is not right'); r.getByText('Which item?'); r.getByText('What is wrong with it?');
    // (the radio mark is drawn by the icon set; the test renderer shows its name as text)
    expect(['l1', 'l2', 'l3'].map((id) => texts(r.getByTestId(`replace-item-${id}`)).filter((x) => x && !/^radiobox-/.test(x)))).toEqual([
      ['Premium Polo T-Shirt', 'Navy · M'], ['Oxford Shirt', 'White · M'], ['Slim Jeans', 'Indigo · 32']]);
    r.getByText("The size doesn't fit"); r.getByText('It arrived damaged'); r.getByText("It isn't as shown");
    expect(r.queryByText(/changed my mind/i)).toBeNull();
    expect(disabled(r.getByTestId('replace-continue'))).toBe(true);
    fireEvent.press(r.getByTestId('replace-item-l3'));
    expect(disabled(r.getByTestId('replace-continue'))).toBe(true);
    fireEvent.press(r.getByTestId('replace-reason-wrong_size'));
    expect(disabled(r.getByTestId('replace-continue'))).toBe(false);
    expect(r.getByTestId('replace-item-l3').props.accessibilityState.checked).toBe(true);
  });

  it('an item that has had INFLX\'s answer cannot be chosen, and says why', async () => {
    const why = 'INFLX has already answered a request for this item. You can still return the whole deal.';
    const { r } = await open(PV({ items: [PV().items[0], PV().items[1], JEANS({ can: false, why })] }));
    await r.findByTestId('replace-choose');
    fireEvent.press(r.getByTestId('replace-one-item'));
    expect(disabled(r.getByTestId('replace-item-l3'))).toBe(true);
    expect(texts(r.getByTestId('replace-item-l3'))).toContain(why);
    fireEvent.press(r.getByTestId('replace-item-l3'));
    expect(r.getByTestId('replace-item-l3').props.accessibilityState.checked).toBe(false);      // pressing it chooses nothing
    fireEvent.press(r.getByTestId('replace-reason-damaged'));
    expect(disabled(r.getByTestId('replace-continue'))).toBe(true);
  });

  it('Back goes one step back, then out', async () => {
    const { r, n } = await open();
    await toStep(r, 'l3', 'wrong_size');
    await r.findByTestId('replace-size');
    fireEvent.press(r.getByTestId('back'));
    await r.findByTestId('replace-item');
    fireEvent.press(r.getByTestId('back'));
    await r.findByTestId('replace-choose');
    fireEvent.press(r.getByTestId('back'));
    expect(n.goBack).toHaveBeenCalledTimes(1);
  });
});

/* ═══════════════════════════════════════════ R3, R7 */

describe('R3 · the size doesn\'t fit → another size', () => {
  it('the sizes: the one she has and a sold-out one cannot be chosen; picking 34 says what happens; Request replacement sends it', async () => {
    followerApi.replaceLine.mockResolvedValue(ok({ request_id: 'q1', kind: 'replace', status: 'requested', word: 'Replacement requested', line_id: 'l3' }));
    const { r, n } = await open();
    await toStep(r, 'l3', 'wrong_size');
    await r.findByTestId('replace-size');
    expect(texts(r.getByTestId('replace-about')).filter(Boolean)).toEqual(['Slim Jeans', 'Indigo · 32', "The size doesn't fit"]);
    r.getByText('Colour: Indigo');
    expect(['30', '32', '34', '36'].map((s) => disabled(r.getByTestId(`replace-size-${s}`)))).toEqual([false, true, false, true]);
    expect(r.getByTestId('replace-sizes-hint').props.children).toBe('32 is the one you have. 36 is sold out.');
    expect(r.queryByTestId('replace-what')).toBeNull();
    expect(disabled(r.getByTestId('replace-request'))).toBe(true);
    fireEvent.press(r.getByTestId('replace-size-34'));
    expect(texts(r.getByTestId('replace-what'))).toEqual(['Replacement: Slim Jeans · 34.', 'The deal stays and no money moves.']);
    r.getByText('The store brings it and collects the 32.');
    expect(said(r.getByTestId('replace-request'))).toBe('Request replacement');
    await act(async () => { fireEvent.press(r.getByTestId('replace-request')); });
    expect(followerApi.replaceLine).toHaveBeenCalledWith('l3', { reason: 'wrong_size', colour: 'Indigo', size: '34', expect: 'replace' });
    // then: Replacement requested
    await r.findByTestId('replace-requested');
    expect(r.getAllByText('Replacement requested')).toHaveLength(2);        // the title and the page
    r.getByText('INFLX is looking at it.');
    fireEvent.press(r.getByTestId('replace-orders'));
    expect(n.navigate).toHaveBeenCalledWith('Orders');
  });

  it('another colour of the same product: its sizes; the size she has is only "hers" in her own colour', async () => {
    followerApi.replaceLine.mockResolvedValue(ok({ kind: 'replace', word: 'Replacement requested' }));
    const { r } = await open();
    await toStep(r, 'l3', 'wrong_size');
    await r.findByTestId('replace-size');
    fireEvent.press(r.getByTestId('replace-colour-Black'));
    r.getByText('Colour: Black');
    expect(disabled(r.getByTestId('replace-size-32'))).toBe(false);
    expect(r.queryByTestId('replace-size-34')).toBeNull();
    fireEvent.press(r.getByTestId('replace-size-32'));
    await act(async () => { fireEvent.press(r.getByTestId('replace-request')); });
    expect(followerApi.replaceLine).toHaveBeenCalledWith('l3', { reason: 'wrong_size', colour: 'Black', size: '32', expect: 'replace' });
  });

  it('R7 no other size in stock: every size crossed, "No other size is in stock", and the whole deal — with the reason already "the size doesn\'t fit"', async () => {
    const none = JEANS({ other_size: false, colours: [{ colour: 'Indigo', sizes: [sz('30', false, false), sz('32', true, true), sz('34', false, false)] }] });
    const { r, n } = await open(PV({ items: [PV().items[0], PV().items[1], none] }));
    await toStep(r, 'l3', 'wrong_size');
    await r.findByTestId('replace-size');
    expect(texts(r.getByTestId('replace-none'))).toEqual(['No other size is in stock.', 'You can keep it, or return the whole deal.']);
    expect(r.queryByTestId('replace-request')).toBeNull();
    expect(r.queryByTestId('replace-size-30')).toBeNull();                  // nothing to press
    fireEvent.press(r.getByTestId('replace-whole-deal'));
    expect(n.replace).toHaveBeenCalledWith('ReturnItem', { lineId: 'l2', reason: 'wrong_size' });
    expect(followerApi.replaceLine).not.toHaveBeenCalled();
  });

  it('an item already replaced once: no second replacement — keep it, or return the whole deal', async () => {
    const { r } = await open(PV({ items: [PV().items[0], PV().items[1], JEANS({ replaced: true, other_size: false, same_in_stock: false })] }));
    await toStep(r, 'l3', 'wrong_size');
    await r.findByTestId('replace-size');
    expect(texts(r.getByTestId('replace-none'))).toEqual(['This item has already been replaced once.', 'You can keep it, or return the whole deal.']);
    expect(r.queryByTestId('replace-request')).toBeNull();
  });

  it('the Return screen it hands over to has that reason chosen already', async () => {
    followerApi.returnPreview.mockResolvedValue(ok({ lines: [{ id: 'l3', name: 'Slim Jeans', size: '32', colour: 'Indigo', qty: 1, role: 'buy' }],
      deal: { line: 'Any 3 for ₹2,999', creator: 'Akshaya Reddy', brand: AVEEN }, warning: null, until: '2026-10-11T11:00:00.000Z', window: '7 days',
      refund: { amount: 2999, text: 'Refund of ₹2,999 to your original payment method once the item is back.' }, how: 'x',
      reasons: [{ key: 'wrong_size', label: "The size doesn't fit" }, { key: 'changed_mind', label: 'I changed my mind' }] }));
    followerApi.returnLine.mockResolvedValue(ok({ request_id: 'r1' }));
    const r = render(<ReturnScreen navigation={nav()} route={{ params: { lineId: 'l2', reason: 'wrong_size' } }} />);
    await r.findByTestId('return');
    expect(r.getByTestId('reason-wrong_size').props.accessibilityState.checked).toBe(true);
    await act(async () => { fireEvent.press(r.getByTestId('confirm-return')); });
    expect(followerApi.returnLine).toHaveBeenCalledWith('l2', { reason: 'wrong_size', note: undefined });
  });
});

/* ═══════════════════════════════════════════ R4, R5 */

describe('R4 · it arrived damaged, or isn\'t as shown — the store has one', () => {
  it('"Replace with the same item", in stock; she must say what is wrong; Request replacement sends her words', async () => {
    followerApi.replaceLine.mockResolvedValue(ok({ kind: 'replace', word: 'Replacement requested' }));
    const { r } = await open();
    await toStep(r, 'l3', 'damaged');
    await r.findByTestId('replace-same');
    expect(texts(r.getByTestId('replace-about')).filter(Boolean)).toEqual(['Slim Jeans', 'Indigo · 32', 'It arrived damaged']);
    expect(texts(r.getByTestId('replace-what'))).toEqual(['Replace with the same item', 'In stock', 'Slim Jeans · Indigo · 32']);
    r.getByText('Tell us what is wrong');
    r.getByText('The deal stays and no money moves. The store brings it and collects the other.');
    expect(disabled(r.getByTestId('replace-request'))).toBe(true);
    fireEvent.changeText(r.getByTestId('replace-note'), '   ');
    expect(disabled(r.getByTestId('replace-request'))).toBe(true);
    fireEvent.changeText(r.getByTestId('replace-note'), `  ${NOTE} `);
    await act(async () => { fireEvent.press(r.getByTestId('replace-request')); });
    expect(followerApi.replaceLine).toHaveBeenCalledWith('l3', { reason: 'damaged', note: NOTE, expect: 'replace' });
    await r.findByTestId('replace-requested');
  });

  it('"It isn\'t as shown" opens the same screen', async () => {
    const { r } = await open();
    await toStep(r, 'l1', 'not_as_described');
    await r.findByTestId('replace-same');
    expect(texts(r.getByTestId('replace-about')).filter(Boolean)).toEqual(['Premium Polo T-Shirt', 'Navy · M', "It isn't as shown"]);
  });
});

describe('R5 · damaged, and the store has no more', () => {
  const noMore = () => PV({ items: [PV().items[0], PV().items[1], JEANS({ same_in_stock: false })] });

  it('INFLX refunds this item\'s share, she keeps the other two, and the button asks for that refund', async () => {
    followerApi.replaceLine.mockResolvedValue(ok({ kind: 'refund_item', word: 'Refund requested' }));
    const { r } = await open(noMore());
    await toStep(r, 'l3', 'damaged');
    await r.findByTestId('replace-refund');
    expect(texts(r.getByTestId('replace-share'))).toEqual(['The store has no more of this.', "INFLX refunds this item's share: ₹1,250. You keep the rest of the deal."]);
    expect(said(r.getByTestId('replace-refund-text'))).toBe('The store collects it. Refund of ₹1,250 to your original payment method once it is back.');
    r.getByText('You keep');
    expect(texts(r.getByTestId('replace-keep-l1')).filter(Boolean)).toEqual(['Premium Polo T-Shirt', 'Navy · M']);
    expect(texts(r.getByTestId('replace-keep-l2')).filter(Boolean)).toEqual(['Oxford Shirt', 'White · M']);
    expect(r.queryByTestId('replace-keep-l3')).toBeNull();
    expect(said(r.getByTestId('replace-request'))).toBe('Request refund for this item');
    expect(disabled(r.getByTestId('replace-request'))).toBe(true);           // her words first
    fireEvent.changeText(r.getByTestId('replace-note'), NOTE);
    await act(async () => { fireEvent.press(r.getByTestId('replace-request')); });
    expect(followerApi.replaceLine).toHaveBeenCalledWith('l3', { reason: 'damaged', note: NOTE, expect: 'refund_item' });
    await r.findByTestId('replace-requested');
    expect(r.getAllByText('Refund requested')).toHaveLength(2);
  });

  it('a pair (buy one get one) has no one-item refund: "A pair goes back together" and the whole deal', async () => {
    const pair = JEANS({ same_in_stock: false, refund: null, pair: true });
    const { r, n } = await open(PV({ deal: { line: 'Buy 1 get 1', creator: 'Akshaya Reddy', brand: AVEEN }, items: [pair], whole: { can: true, count: 2, amount: 1999 } }));
    await toStep(r, 'l3', 'damaged');
    await r.findByTestId('replace-pair');
    expect(texts(r.getByTestId('replace-none'))).toEqual(['The store has no more of this. A pair goes back together.', 'You can keep it, or return the whole deal.']);
    expect(r.queryByTestId('replace-request')).toBeNull();
    fireEvent.press(r.getByTestId('replace-whole-deal'));
    expect(n.replace).toHaveBeenCalledWith('ReturnItem', { lineId: 'l2', reason: 'damaged' });
  });
});

/* ═══════════════════════════════════════════ when the server says no */

describe('the stock moved while she was choosing, and other refusals', () => {
  it('the server answers "this changed": its sentence is shown, the choices are read again, and she is back at "which item"', async () => {
    followerApi.replaceLine.mockResolvedValue(refuse('This changed while you were choosing. Please look again.', { field: 'expect' }));
    const { r } = await open();
    await toStep(r, 'l3', 'damaged');
    await r.findByTestId('replace-same');
    fireEvent.changeText(r.getByTestId('replace-note'), NOTE);
    followerApi.replacePreview.mockResolvedValue(ok(PV({ items: [PV().items[0], PV().items[1], JEANS({ same_in_stock: false })] })));
    await act(async () => { fireEvent.press(r.getByTestId('replace-request')); });
    await r.findByTestId('replace-item');
    expect(r.getByTestId('replace-problem').props.children).toBe('This changed while you were choosing. Please look again.');
    expect(followerApi.replacePreview).toHaveBeenCalledTimes(2);
    // Continue now leads to the refund of its share — what the server says today
    fireEvent.press(r.getByTestId('replace-continue'));
    await r.findByTestId('replace-refund');
  });

  it('the size just sold out: the same — said, read again, choose again', async () => {
    followerApi.replaceLine.mockResolvedValue({ success: false, error: { code: 'STOCK_UNAVAILABLE', message: 'That size has just sold out. Choose another.', field: 'size' } });
    const { r } = await open();
    await toStep(r, 'l3', 'wrong_size');
    await r.findByTestId('replace-size');
    fireEvent.press(r.getByTestId('replace-size-34'));
    await act(async () => { fireEvent.press(r.getByTestId('replace-request')); });
    await r.findByTestId('replace-item');
    r.getByText('That size has just sold out. Choose another.');
    expect(followerApi.replacePreview).toHaveBeenCalledTimes(2);
  });

  it('any other refusal is said where she is, and nothing is "requested"', async () => {
    followerApi.replaceLine.mockResolvedValue(refuse('You have already asked about this deal. INFLX is looking at it.', { field: 'status' }));
    const { r } = await open();
    await toStep(r, 'l3', 'wrong_size');
    await r.findByTestId('replace-size');
    fireEvent.press(r.getByTestId('replace-size-30'));
    await act(async () => { fireEvent.press(r.getByTestId('replace-request')); });
    r.getByTestId('replace-size');
    expect(r.getByTestId('replace-problem').props.children).toBe('You have already asked about this deal. INFLX is looking at it.');
    expect(r.queryByTestId('replace-requested')).toBeNull();
    expect(followerApi.replacePreview).toHaveBeenCalledTimes(1);
  });

  it('a request that cannot reach the server says so, and nothing is "requested"', async () => {
    followerApi.replaceLine.mockRejectedValue(new Error('offline'));
    const { r } = await open();
    await toStep(r, 'l3', 'wrong_size');
    await r.findByTestId('replace-size');
    fireEvent.press(r.getByTestId('replace-size-30'));
    await act(async () => { fireEvent.press(r.getByTestId('replace-request')); });
    expect(r.getByTestId('replace-problem').props.children).toBe("Couldn't load. Check your connection.");
    expect(r.queryByTestId('replace-requested')).toBeNull();
  });
});

/* ═══════════════════════════════════════════ O4 → R1, and R8 */

const it3 = [
  { id: 'l1', name: 'Premium Polo T-Shirt', image_url: null, colour: 'Navy', size: 'M', qty: 1, role: 'buy', paid: 812, normal: 1299, state: null },
  { id: 'l2', name: 'Oxford Shirt', image_url: null, colour: 'White', size: 'M', qty: 1, role: 'buy', paid: 937, normal: 1499, state: null },
  { id: 'l3', name: 'Slim Jeans', image_url: null, colour: 'Indigo', size: '32', qty: 1, role: 'buy', paid: 1250, normal: 1999, state: null },
];
const DETAIL = (over = {}) => ({
  id: 'l2', name: 'Oxford Shirt', colour: 'White', size: 'M', qty: 1, role: 'buy', paid: 937, normal: 1499, status: 'delivered', status_word: 'Delivered',
  brand: { id: 'b1', name: AVEEN }, creator: { id: 'c1', name: 'Akshaya Reddy' }, payment_method: 'online', can_cancel: false, refund: null,
  timeline: [{ status: 'confirmed', word: 'Confirmed', at: '2026-10-01T09:00:00.000Z' }, { status: 'delivered', word: 'Delivered', at: '2026-10-04T09:00:00.000Z' }],
  courier: null, address: { name: 'Anusha K', house: 'Flat 302', city: 'Hyderabad', pincode: '500081' }, post: { id: 'p1', code: 'ANY3AA' }, parcel: null,
  deal: { key: 'set-1', line: 'Any 3 for ₹2,999', count: 3, paid: 2999, normal: 4797, lines: it3 }, deal_items: [],
  can_return: true, can_replace: true, return_until: '2026-10-11T11:00:00.000Z', return_closed: null, return: null, ...over,
});
const REQ = (over = {}) => ({
  kind: 'replace', status: 'requested', word: 'Replacement requested', reason: "The size doesn't fit", note: null, inflx_note: null, sold_out: false, amount: null, refund: null,
  requested_at: '2026-10-05T10:00:00.000Z', decided_at: null, refunded_at: null,
  replace: { name: 'Slim Jeans', from: { colour: 'Indigo', size: '32' }, to: { colour: 'Indigo', size: '34' }, state: null, delivered_at: null }, ...over,
});
async function detail(d) {
  followerApi.orderLine.mockResolvedValue(ok(d));
  const n = nav();
  const r = render(<OrderDetailScreen navigation={n} route={{ params: { lineId: d.id } }} />);
  await r.findByTestId('order-detail');
  return { r, n };
}

describe('O4 · the deal\'s one button is "Return or replace"', () => {
  it('it opens "Return or replace", with until when', async () => {
    const { r, n } = await detail(DETAIL());
    expect(said(r.getByTestId('order-return'))).toBe('Return or replace');
    expect(r.getByTestId('order-return-until').props.children).toMatch(/^You can return this until /);
    fireEvent.press(r.getByTestId('order-return'));
    expect(n.navigate).toHaveBeenCalledWith('ReplaceItem', { lineId: 'l2' });
  });

  it('it is there while one item can still be asked about, even if the whole deal can no longer be returned', async () => {
    const { r, n } = await detail(DETAIL({ can_return: false, can_replace: true }));
    fireEvent.press(r.getByTestId('order-return'));
    expect(n.navigate).toHaveBeenCalledWith('ReplaceItem', { lineId: 'l2' });
  });

  it('nothing can be asked (a request is open): no button', async () => {
    const { r } = await detail(DETAIL({ can_return: false, can_replace: false, return: REQ() }));
    expect(r.queryByTestId('order-return')).toBeNull();
  });

  it('an item in no deal keeps "Return" and the Return screen', async () => {
    const { r, n } = await detail(DETAIL({ deal: null, can_replace: undefined }));
    expect(said(r.getByTestId('order-return'))).toBe('Return');
    fireEvent.press(r.getByTestId('order-return'));
    expect(n.navigate).toHaveBeenCalledWith('ReturnItem', { lineId: 'l2' });
  });

  it('an item of the deal that went back says so, among the ones she keeps', async () => {
    const { r } = await detail(DETAIL({ deal: { ...DETAIL().deal, lines: [it3[0], it3[1], { ...it3[2], state: 'returned' }] } }));
    expect(said(r.getByTestId('order-deal-item-l3'))).toBe('Slim JeansIndigo · 32 · Returned');
    expect(said(r.getByTestId('order-deal-item-l1'))).toBe('Premium Polo T-ShirtNavy · M');
  });
});

describe('R8 · what she sees while her replacement is on its way', () => {
  const box = async (back) => { const { r } = await detail(DETAIL({ can_return: false, can_replace: false, return: back })); return r; };
  const lines = (r) => [r.getByTestId('return-head').props.children, r.getByTestId('return-word').props.children, r.getByTestId('return-line').props.children];

  it('1 of 3 — requested: "INFLX is looking at it", her reason, when she asked', async () => {
    const r = await box(REQ());
    expect(lines(r)).toEqual(['REPLACEMENT', 'Replacement requested', 'INFLX is looking at it.']);
    r.getByText("Your reason: The size doesn't fit");
    r.getByText('Asked on Mon, 5 Oct');
  });

  it('2 of 3 — approved: the store will bring the 34 and collect the 32; once sent, it is bringing it', async () => {
    const a = await box(REQ({ status: 'approved', word: 'Replacement approved', replace: { ...REQ().replace, state: 'to_send' } }));
    expect(lines(a)).toEqual(['REPLACEMENT', 'Replacement approved', 'The store will bring Slim Jeans · 34 and collect the 32.']);
    a.unmount();
    const b = await box(REQ({ status: 'approved', word: 'Replacement approved', replace: { ...REQ().replace, state: 'sent' } }));
    expect(lines(b)[2]).toBe('The store is bringing Slim Jeans · 34 and will collect the 32.');
  });

  it('3 of 3 — replaced: what was delivered and when', async () => {
    const r = await box(REQ({ status: 'replaced', word: 'Replaced', replace: { ...REQ().replace, state: 'delivered', delivered_at: '2026-10-07T10:00:00.000Z' } }));
    expect(lines(r)).toEqual(['REPLACEMENT', 'Replaced', 'Slim Jeans · 34 delivered Wed, 7 Oct.']);
  });

  it('not accepted: INFLX\'s note, and the order stays as it is; sold out before approval: the note says she can choose again', async () => {
    const a = await box(REQ({ status: 'rejected', word: 'Replacement not accepted', inflx_note: 'The photo shows wear, not damage.' }));
    expect(lines(a)).toEqual(['REPLACEMENT', 'Replacement not accepted', 'INFLX did not accept this replacement. Your order stays as it is.']);
    expect(said(a.getByTestId('return-note'))).toBe('INFLX: The photo shows wear, not damage.');
    a.unmount();
    const b = await box(REQ({ status: 'rejected', word: 'Replacement sold out', sold_out: true, inflx_note: 'It sold out before it could be sent. You can choose another size, or return the whole deal.' }));
    expect(lines(b)).toEqual(['REPLACEMENT', 'Replacement sold out', 'Your order stays as it is.']);
    expect(said(b.getByTestId('return-note'))).toBe('INFLX: It sold out before it could be sent. You can choose another size, or return the whole deal.');
  });

  it('a refund of one item: requested, approved with the amount, refunded with what happened to the money', async () => {
    const one = (over) => REQ({ kind: 'refund_item', replace: null, amount: 1250, reason: 'It arrived damaged', note: NOTE, ...over });
    const a = await box(one({ status: 'requested', word: 'Refund requested' }));
    expect(lines(a)).toEqual(['REFUND', 'Refund requested', 'INFLX is looking at it.']);
    a.getByText(`Your reason: It arrived damaged — ${NOTE}`);
    a.unmount();
    const b = await box(one({ status: 'approved', word: 'Refund approved' }));
    expect(lines(b)[2]).toBe('The store will collect the item. Your refund of ₹1,250 follows when it is back. You keep the rest of the deal.');
    b.unmount();
    const c = await box(one({ status: 'refunded', word: 'One item refunded', refund: { status: 'issued', amount: 1250 } }));
    expect(lines(c)).toEqual(['REFUND', 'One item refunded', 'The item went back to the store. You keep the rest of the deal.']);
    expect(c.getByTestId('return-refund').props.children).toBe('Refund of ₹1,250 to your original payment method in 5–7 working days.');
  });

  it('a return is the box it always was', () => {
    const r = render(<ReturnBox back={{ status: 'approved', word: 'Return approved', reason: 'I changed my mind', note: null, requested_at: '2026-10-05T10:00:00.000Z' }} />);
    expect([r.getByTestId('return-head').props.children, r.getByTestId('return-line').props.children]).toEqual(['RETURN', CR.box.approved]);
  });

  it('the same words are on the deal\'s card in My orders', async () => {
    followerApi.orders.mockResolvedValue(ok({ items: [{ ...DETAIL(), card: 'deal', deal: { key: 'set-1', line: 'Any 3 for ₹2,999', count: 3 }, lines: it3, paid: 2999, normal: 4797,
      delivered_at: '2026-10-04T09:00:00.000Z', return: REQ() }], more: false }));
    const r = render(<OrdersScreen navigation={nav()} />);
    await r.findByTestId('orders-list');
    expect(said(r.getByTestId('order-status-l2'))).toBe('Delivered · Replacement requested');
  });
});

describe('the sentence of the box, by kind and state', () => {
  const opts = { day: dayLabel, money: inr };
  it('a colour swap names the colour; the same item again says "another"', () => {
    const colour = REQ({ status: 'approved', replace: { name: 'Slim Jeans', from: { colour: 'Indigo', size: '32' }, to: { colour: 'Black', size: '32' }, state: 'to_send' } });
    expect(boxLine(colour, opts)).toBe('The store will bring Slim Jeans · Black and collect the Indigo one.');
    const same = REQ({ status: 'approved', replace: { name: 'Slim Jeans', from: { colour: 'Indigo', size: '32' }, to: { colour: 'Indigo', size: '32' }, state: 'to_send' } });
    expect(boxLine(same, opts)).toBe('The store will bring another Slim Jeans and collect this one.');
    expect(boxLine({ ...same, status: 'replaced', replace: { ...same.replace, delivered_at: '2026-10-07T10:00:00.000Z' } }, opts)).toBe('Slim Jeans delivered Wed, 7 Oct.');
  });
  it('a request from a server that sends no kind is a return', () => {
    expect(boxLine({ status: 'requested' }, opts)).toBe(CR.box.requested);
    expect(boxLine({ status: 'refunded' }, opts)).toBe(CR.box.refunded);
  });
});
