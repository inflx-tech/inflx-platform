/**
 * shopper-deal-orders, part A — My orders shows a deal as one (board O1–O4 · the founder's rule D1).
 * The board's example: Akshaya Reddy's post for Aveen fashion boutique and desiner studio, "Any 3
 * for ₹2,999" — Premium Polo T-Shirt, Oxford Shirt, Slim Jeans; ₹4,797 at normal prices.
 *
 *   AP1  My orders: a deal is one card — status and date, the deal's words, its items, the brand, the
 *        deal's price; a pair says which one is free; a single item keeps its own row
 *   AP2  a tap opens the deal's page
 *   AP3  the deal's page before it ships: who it is from, the deal's words, every item, what was paid
 *        for the deal, one timeline, the address, the post, and one button — Cancel deal
 *   AP4  Cancel deal: the deal's words, its items, the reasons, the refund of the whole deal
 *   AP5  after delivery: one button to return the deal, with until when
 *   AP6  from a server that sends no cards, every item is on its own, as before
 *
 * Every word of the deal and every amount is the server's; the screens work nothing out.
 */
import React from 'react';
import { StyleSheet } from 'react-native';
import { render, fireEvent, act } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

jest.mock('../../../../services/api', () => ({
  followerApi: {
    orders: jest.fn(), orderLine: jest.fn(), cancelPreview: jest.fn(), cancelLine: jest.fn(), returnPreview: jest.fn(), returnLine: jest.fn(), checkout: jest.fn(),
  },
  setDeviceHeader: jest.fn(), clearSession: jest.fn(() => Promise.resolve()),
}));
jest.mock('../../../../services/events', () => ({ track: jest.fn(), flush: jest.fn() }));
jest.mock('@react-navigation/native', () => ({ useFocusEffect: (cb) => { const React = require('react'); React.useEffect(() => cb(), [cb]); } }));

const { followerApi } = require('../../../../services/api');
const { OrdersScreen, OrderDetailScreen, CancelScreen } = require('../OrderScreens');
const ReturnScreen = require('../ReturnScreen').default;

const nav = () => ({ goBack: jest.fn(), navigate: jest.fn(), replace: jest.fn(), addListener: jest.fn(() => () => {}) });
const ok = (data) => ({ success: true, data });
const texts = (node) => node.findAll((n) => typeof n.type === 'string' && n.type === 'Text').map((n) => [].concat(n.props.children).filter((c) => typeof c === 'string' || typeof c === 'number').join(''));
const said = (node) => texts(node).join('');
const struckIn = (node) => node.findAll((n) => n.type === 'Text' && StyleSheet.flatten(n.props.style || {}).textDecorationLine === 'line-through')
  .map((n) => [].concat(n.props.children).join('').trim());

const AVEEN = { id: 'b1', name: 'Aveen fashion boutique and desiner studio' };
const AKSHAYA = { id: 'c1', name: 'Akshaya Reddy' };
const it3 = [
  { id: 'l1', name: 'Premium Polo T-Shirt', image_url: 'https://x/polo.jpg', colour: 'Navy', size: 'M', qty: 1, role: 'buy', paid: 812, normal: 1299 },
  { id: 'l2', name: 'Oxford Shirt', image_url: null, colour: 'White', size: 'M', qty: 1, role: 'buy', paid: 937, normal: 1499 },
  { id: 'l3', name: 'Slim Jeans', image_url: null, colour: 'Indigo', size: '32', qty: 1, role: 'buy', paid: 1250, normal: 1999 },
];
const BUNDLE = (over = {}) => ({
  id: 'l1', name: 'Premium Polo T-Shirt', colour: 'Navy', size: 'M', qty: 1, role: 'buy', paid: 2999, normal: 4797,
  status: 'delivered', status_word: 'Delivered', arrives_by: '2026-10-05', delivered_at: '2026-10-04T10:30:00.000Z', placed_at: '2026-10-01T09:00:00.000Z',
  brand: AVEEN, creator: AKSHAYA, payment_method: 'online', can_cancel: false, refund: null,
  card: 'deal', deal: { key: 'set-1', line: 'Any 3 for ₹2,999', count: 3 }, lines: it3, ...over,
});
const PAIR = () => ({
  id: 'p1', name: 'Classic Cotton Crew T-Shirt', colour: 'White', size: 'L', qty: 1, role: 'buy', paid: 599, normal: 1198,
  status: 'dispatched', status_word: 'Shipped', arrives_by: '2026-10-06', delivered_at: null, brand: AVEEN, creator: AKSHAYA, payment_method: 'cod', can_cancel: false, refund: null,
  card: 'deal', deal: { key: 'pair-1', line: 'Buy 1 get 1', count: 2 },
  lines: [
    { id: 'p1', name: 'Classic Cotton Crew T-Shirt', image_url: null, colour: 'White', size: 'L', qty: 1, role: 'buy', paid: 599, normal: 599 },
    { id: 'p2', name: 'Classic Cotton Crew T-Shirt', image_url: null, colour: 'Green', size: 'L', qty: 1, role: 'free', paid: 0, normal: 599 },
  ],
});
const SINGLE = (over = {}) => ({
  id: 's1', name: 'Blue polo', image_url: null, colour: 'Blue', size: 'M', qty: 1, role: 'buy', paid: 719, normal: 899,
  status: 'confirmed', status_word: 'Confirmed', arrives_by: '2026-10-08', delivered_at: null, brand: AVEEN, creator: AKSHAYA, payment_method: 'online', can_cancel: true, refund: null,
  card: 'item', deal: null, lines: [{ id: 's1', name: 'Blue polo', image_url: null, colour: 'Blue', size: 'M', qty: 1, role: 'buy', paid: 719, normal: 899 }], ...over,
});
const TIMELINE = (upTo) => ['confirmed', 'packed', 'dispatched', 'out_for_delivery', 'delivered'].map((s, i) => ({
  status: s, word: ['Confirmed', 'Packed', 'Shipped', 'Out for delivery', 'Delivered'][i], at: i < upTo ? `2026-10-0${i + 1}T09:00:00.000Z` : null }));
const DETAIL = (over = {}) => ({
  id: 'l2', order_id: 'o1', name: 'Oxford Shirt', image_url: null, colour: 'White', size: 'M', qty: 1, role: 'buy', paid: 937, normal: 1499,
  status: 'confirmed', status_word: 'Confirmed', arrives_by: '2026-10-05', brand: AVEEN, creator: AKSHAYA, payment_method: 'online', can_cancel: true, refund: null,
  timeline: TIMELINE(1), courier: null, address: { name: 'Anusha K', house: 'Flat 302, Lake View Residency', area: 'Madhapur', city: 'Hyderabad', state: 'Telangana', pincode: '500081' },
  post: { id: 'p-any3', code: 'ANY3AA' }, parcel: { items: 3, items_total: 2999, delivery_fee: 0, cod_fee: 0, to_pay: 0, says: null },
  deal: { key: 'set-1', line: 'Any 3 for ₹2,999', count: 3, paid: 2999, normal: 4797, lines: it3 },
  deal_items: [{ id: 'l1', name: 'Premium Polo T-Shirt', size: 'M' }, { id: 'l3', name: 'Slim Jeans', size: '32' }],
  can_return: false, return_until: null, return_closed: null, return: null, ...over,
});

beforeEach(async () => { jest.clearAllMocks(); await AsyncStorage.clear(); });

/* ═══════════════════════════════════════════ O1 */

describe('O1 · My orders: a deal is one card', () => {
  async function list(items) {
    followerApi.orders.mockResolvedValue(ok({ items, more: false }));
    const n = nav();
    const r = render(<OrdersScreen navigation={n} />);
    await r.findByTestId('orders-list');
    return { r, n };
  }

  it('AP1 the bundle is one card: Delivered and when, the deal\'s words, its three items, the brand, ₹2,999', async () => {
    const { r } = await list([BUNDLE(), PAIR(), SINGLE()]);
    expect(r.getAllByTestId(/^order-(l1|p1|s1)$/)).toHaveLength(3);                // three cards, not six rows
    const card = r.getByTestId('order-l1');
    expect(said(r.getByTestId('order-status-l1'))).toBe('Delivered');
    expect(r.getByTestId('order-when-l1').props.children).toBe('Sun, 4 Oct');       // the day it was delivered, never "Arrives by"
    expect(said(r.getByTestId('order-deal-l1'))).toBe('Any 3 for ₹2,999');
    expect(['l1', 'l2', 'l3'].map((id) => texts(r.getByTestId(`order-item-${id}`)).filter(Boolean))).toEqual([
      ['Premium Polo T-Shirt', 'Navy · M'], ['Oxford Shirt', 'White · M'], ['Slim Jeans', 'Indigo · 32']]);
    expect(texts(card)).toContain('Aveen fashion boutique and desiner studio');
    expect(r.getByTestId('order-paid-l1').props.children).toBe('₹2,999');
    // a bundle's items do not each say a price: the deal has one
    expect(said(card)).not.toMatch(/₹812|₹937|₹1,250/);
  });

  it('AP1 the buy-one-get-one pair is one card: the one she pays for with its price, the free one "Free"; shipped → "Arrives by"', async () => {
    const { r } = await list([BUNDLE(), PAIR(), SINGLE()]);
    expect(said(r.getByTestId('order-status-p1'))).toBe('Shipped');
    expect(r.getByTestId('order-when-p1').props.children).toBe('Arrives by Tue, 6 Oct');
    expect(said(r.getByTestId('order-deal-p1'))).toBe('Buy 1 get 1');
    expect(said(r.getByTestId('order-item-p1'))).toBe('Classic Cotton Crew T-ShirtWhite · L · ₹599');
    expect(said(r.getByTestId('order-item-p2'))).toBe('Classic Cotton Crew T-ShirtGreen · L · Free');
    expect(r.getByTestId('order-paid-p1').props.children).toBe('₹599');
  });

  it('AP1 a plain-discount item stays its own row, with the normal price struck beside what it cost', async () => {
    const { r } = await list([BUNDLE(), PAIR(), SINGLE()]);
    const row = r.getByTestId('order-s1');
    expect(texts(row)).toContain('Confirmed · Arrives by Thu, 8 Oct');
    expect(texts(row)).toContain('Blue polo');
    expect(r.queryByTestId('order-deal-s1')).toBeNull();
    expect(said(r.getByTestId('order-paid-s1'))).toBe('₹719  ₹899');
    expect(struckIn(row)).toEqual(['₹899']);
  });

  it('an item that cost its normal price has nothing struck', async () => {
    const { r } = await list([SINGLE({ paid: 899, normal: 899 })]);
    expect(said(r.getByTestId('order-paid-s1'))).toBe('₹899');
    expect(struckIn(r.getByTestId('order-s1'))).toEqual([]);
  });

  it('AP2 tapping a deal\'s card opens the deal\'s page, by the card\'s own id', async () => {
    const { r, n } = await list([BUNDLE(), PAIR(), SINGLE()]);
    fireEvent.press(r.getByTestId('order-l1'));
    expect(n.navigate).toHaveBeenLastCalledWith('OrderDetail', { lineId: 'l1' });
    fireEvent.press(r.getByTestId('order-s1'));
    expect(n.navigate).toHaveBeenLastCalledWith('OrderDetail', { lineId: 's1' });
  });

  it('a return that is being decided is said on the deal\'s card; a cancelled deal says Cancelled, with no date', async () => {
    const { r } = await list([
      BUNDLE({ return: { status: 'requested', word: 'Return requested' } }),
      BUNDLE({ id: 'x1', status: 'cancelled', status_word: 'Cancelled', delivered_at: null, lines: it3.map((l) => ({ ...l, id: `x${l.id}` })) }),
    ]);
    expect(said(r.getByTestId('order-status-l1'))).toBe('Delivered · Return requested');
    expect(said(r.getByTestId('order-status-x1'))).toBe('Cancelled');
    expect(r.queryByTestId('order-when-x1')).toBeNull();
  });

  it('a deal of two of one item says ×2', async () => {
    const { r } = await list([BUNDLE({ lines: [{ ...it3[2], qty: 2 }, it3[0]] })]);
    expect(said(r.getByTestId('order-item-l3'))).toBe('Slim JeansIndigo · 32 ×2');
  });

  it('AP6 a server that sends no cards: every item on its own row, as before', async () => {
    const old = it3.map((l) => ({ ...l, status: 'confirmed', status_word: 'Confirmed', arrives_by: '2026-10-05', brand: AVEEN }));
    const { r } = await list(old);
    for (const id of ['l1', 'l2', 'l3']) {
      r.getByTestId(`order-${id}`);
      expect(r.queryByTestId(`order-deal-${id}`)).toBeNull();
      expect(r.queryByTestId(`order-item-${id}`)).toBeNull();
    }
    expect(texts(r.getByTestId('order-l3'))).toContain('Indigo · 32 · Aveen fashion boutique and desiner studio');
  });

  it('a card marked "deal" with no items (a broken answer) falls back to the plain row rather than an empty card', async () => {
    const { r } = await list([BUNDLE({ lines: [] })]);
    r.getByTestId('order-l1');
    expect(r.queryByTestId('order-deal-l1')).toBeNull();
    expect(texts(r.getByTestId('order-l1'))).toContain('Premium Polo T-Shirt');
  });
});

/* ═══════════════════════════════════════════ O2, O4 */

describe('O2 · the deal\'s page before it ships', () => {
  async function open(detail) {
    followerApi.orderLine.mockResolvedValue(ok(detail));
    const n = nav();
    const r = render(<OrderDetailScreen navigation={n} route={{ params: { lineId: detail.id } }} />);
    await r.findByTestId('order-detail');
    return { r, n };
  }

  it('AP3 who it is from, the deal\'s words, all three items, what was paid for the DEAL, one timeline, the address, the post, Cancel deal', async () => {
    const { r, n } = await open(DETAIL());
    expect(r.getAllByText('Confirmed')).toHaveLength(2);                     // the page's title (the deal's status) and the timeline's first step
    expect(r.getByTestId('order-deal-from').props.children).toBe('Akshaya · Aveen fashion boutique and desiner studio');
    expect(r.getByTestId('order-deal-line').props.children).toBe('Any 3 for ₹2,999');
    expect(['l1', 'l2', 'l3'].map((id) => texts(r.getByTestId(`order-deal-item-${id}`)).filter(Boolean))).toEqual([
      ['Premium Polo T-Shirt', 'Navy · M'], ['Oxford Shirt', 'White · M'], ['Slim Jeans', 'Indigo · 32']]);
    expect(r.getByTestId('order-money').props.children).toBe('Paid ₹2,999 · UPI, cards, net banking');    // not this item's ₹937
    expect(said(r.getByTestId('order-deal'))).not.toMatch(/₹937/);
    expect(r.getAllByTestId('timeline')).toHaveLength(1);
    r.getByText('Anusha K');
    r.getByText('Flat 302, Lake View Residency, Madhapur, Hyderabad, Telangana, 500081');
    expect(said(r.getByTestId('order-post'))).toBe("See the post · from Akshaya's post");
    expect(said(r.getByTestId('order-cancel'))).toBe('Cancel deal');
    fireEvent.press(r.getByTestId('order-cancel'));
    expect(n.navigate).toHaveBeenCalledWith('CancelItem', { lineId: 'l2' });
  });

  it('cash on delivery, the deal is the whole parcel: "To pay ₹2,999 on delivery"', async () => {
    const { r } = await open(DETAIL({ payment_method: 'cod', parcel: { items: 3, items_total: 2999, delivery_fee: 0, cod_fee: 0, to_pay: 2999, says: 'For this parcel you pay ₹2,999 on delivery.' } }));
    expect(r.getByTestId('order-money').props.children).toBe('To pay ₹2,999 on delivery');
    expect(r.queryByTestId('order-parcel-pay')).toBeNull();
  });

  it('cash on delivery with a fee on the parcel: the deal\'s price, and under it what the courier collects', async () => {
    const says = 'For this parcel you pay ₹3,049 on delivery: 3 items ₹2,999 + cash on delivery fee ₹50.';
    const { r } = await open(DETAIL({ payment_method: 'cod', parcel: { items: 3, items_total: 2999, delivery_fee: 0, cod_fee: 50, to_pay: 3049, says } }));
    expect(r.getByTestId('order-money').props.children).toBe('₹2,999 · Cash on delivery');
    expect(r.getByTestId('order-parcel-pay').props.children).toBe(says);
  });

  it('the pair\'s page says which one is free, and what the pair cost', async () => {
    const pair = PAIR();
    const { r } = await open(DETAIL({ id: 'p1', deal: { key: 'pair-1', line: 'Buy 1 get 1', count: 2, paid: 599, normal: 1198, lines: pair.lines } }));
    expect(said(r.getByTestId('order-deal-item-p2'))).toBe('Classic Cotton Crew T-ShirtGreen · L · Free');
    expect(r.getByTestId('order-money').props.children).toBe('Paid ₹599 · UPI, cards, net banking');
  });

  it('an item in no deal is the page it always was: its own name, its own price, "Cancel"', async () => {
    const { r } = await open(DETAIL({ deal: null, deal_items: [] }));
    expect(r.queryByTestId('order-deal')).toBeNull();
    r.getByText('Oxford Shirt');
    expect(r.getByTestId('order-money').props.children).toBe('Paid ₹937 · UPI, cards, net banking');
    expect(said(r.getByTestId('order-cancel'))).toBe('Cancel');
  });

  it('AP6 an older server (no `deal` at all): the item\'s own page', async () => {
    const d = DETAIL(); delete d.deal;
    const { r } = await open(d);
    expect(r.queryByTestId('order-deal')).toBeNull();
    expect(r.getByTestId('order-money').props.children).toBe('Paid ₹937 · UPI, cards, net banking');
  });
});

describe('O4 · the deal\'s page after delivery', () => {
  it('AP5 one button to return the deal, with until when; it opens the Return screen', async () => {
    followerApi.orderLine.mockResolvedValue(ok(DETAIL({ status: 'delivered', status_word: 'Delivered', timeline: TIMELINE(5), can_cancel: false, can_return: true, return_until: '2026-10-11T11:00:00.000Z' })));
    const n = nav();
    const r = render(<OrderDetailScreen navigation={n} route={{ params: { lineId: 'l2' } }} />);
    await r.findByTestId('order-detail');
    expect(said(r.getByTestId('order-return'))).toBe('Return deal');
    expect(r.getByTestId('order-return-until').props.children).toMatch(/^You can return this until \w{3}, \d{1,2} Oct, /);
    expect(r.queryByTestId('order-cancel')).toBeNull();
    fireEvent.press(r.getByTestId('order-return'));
    expect(n.navigate).toHaveBeenCalledWith('ReturnItem', { lineId: 'l2' });
  });

  it('the Return screen for a deal: titled "Return deal", the deal\'s words, who it is from, its items — no "part of a deal" warning', async () => {
    followerApi.returnPreview.mockResolvedValue(ok({
      lines: it3.map(({ id, name, colour, size, qty, role, image_url }) => ({ id, name, colour, size, qty, role, image_url })),
      deal: { line: 'Any 3 for ₹2,999', creator: 'Akshaya Reddy', brand: AVEEN.name },
      warning: 'This is part of a deal. Returning it returns 3 items together.', until: '2026-10-11T11:00:00.000Z', window: '7 days',
      refund: { amount: 2999, text: 'Refund of ₹2,999 to your original payment method once the item is back.' },
      how: 'INFLX looks at every return. Once it is approved, the store collects the item; your refund follows when it is back.',
      reasons: [{ key: 'wrong_size', label: "The size doesn't fit" }, { key: 'changed_mind', label: 'I changed my mind' }, { key: 'other', label: 'Other' }],
    }));
    followerApi.returnLine.mockResolvedValue(ok({ request_id: 'r1' }));
    const r = render(<ReturnScreen navigation={nav()} route={{ params: { lineId: 'l2' } }} />);
    await r.findByTestId('return');
    r.getByText('Return deal');
    expect(r.getByTestId('return-deal-line').props.children).toBe('Any 3 for ₹2,999');
    expect(r.getByTestId('return-deal-from').props.children).toBe('Akshaya Reddy · Aveen fashion boutique and desiner studio');
    expect(['l1', 'l2', 'l3'].map((id) => said(r.getByTestId(`return-item-${id}`)))).toEqual(['Premium Polo T-Shirt  Navy · M', 'Oxford Shirt  White · M', 'Slim Jeans  Indigo · 32']);
    expect(r.queryByText(/This is part of a deal/)).toBeNull();
    r.getByText('Refund of ₹2,999 to your original payment method once the item is back.');
    fireEvent.press(r.getByTestId('reason-changed_mind'));
    await act(async () => { fireEvent.press(r.getByTestId('confirm-return')); });
    expect(followerApi.returnLine).toHaveBeenCalledWith('l2', { reason: 'changed_mind', note: undefined });
    await r.findByTestId('return-requested');
  });

  it('the Return screen for an item in no deal is as it was', async () => {
    followerApi.returnPreview.mockResolvedValue(ok({ lines: [{ id: 's1', name: 'Blue polo', size: 'M', colour: 'Blue', role: 'buy' }], deal: null, warning: null,
      until: '2026-10-11T11:00:00.000Z', window: '7 days', refund: { amount: 719, text: 'Refund of ₹719 to your original payment method once the item is back.' }, how: 'x', reasons: [{ key: 'other', label: 'Other' }] }));
    const r = render(<ReturnScreen navigation={nav()} route={{ params: { lineId: 's1' } }} />);
    await r.findByTestId('return');
    expect(r.queryByTestId('return-deal')).toBeNull();
    r.getByText('Blue polo · M');
  });
});

/* ═══════════════════════════════════════════ O3 */

describe('O3 · Cancel deal', () => {
  const PREVIEW = (over = {}) => ({
    lines: it3.map(({ id, name, colour, size, qty, role, image_url }) => ({ id, name, colour, size, qty, role, image_url })),
    deal: { line: 'Any 3 for ₹2,999', creator: 'Akshaya Reddy', brand: AVEEN.name },
    warning: 'This is part of a deal. Cancelling cancels 3 items together.',
    refund: { amount: 2999, text: 'Refund of ₹2,999 to your original payment method in 5–7 working days' },
    reasons: ['Incorrect size ordered', 'Not needed any more', 'Ordered by mistake', 'Want a different style or colour', 'Delivery is taking too long', 'Found a better price', 'Other'],
    ...over,
  });

  it('AP4 the deal\'s words, who it is from, its three items, the reasons, the refund of the whole deal, and the button "Cancel deal"', async () => {
    followerApi.cancelPreview.mockResolvedValue(ok(PREVIEW()));
    followerApi.cancelLine.mockResolvedValue(ok({ cancelled: ['l1', 'l2', 'l3'], parcel_cancelled: true, refund: { amount: 2999, status: 'issued' } }));
    const r = render(<CancelScreen navigation={nav()} route={{ params: { lineId: 'l2' } }} />);
    await r.findByTestId('cancel');
    expect(r.getAllByText('Cancel deal')).toHaveLength(2);                               // the title and the button
    expect(r.getByTestId('cancel-deal-line').props.children).toBe('Any 3 for ₹2,999');
    expect(r.getByTestId('cancel-deal-from').props.children).toBe('Akshaya Reddy · Aveen fashion boutique and desiner studio');
    expect(['l1', 'l2', 'l3'].map((id) => texts(r.getByTestId(`cancel-item-${id}`)).filter(Boolean))).toEqual([
      ['Premium Polo T-Shirt', 'Navy · M'], ['Oxford Shirt', 'White · M'], ['Slim Jeans', 'Indigo · 32']]);
    expect(r.queryByText(/This is part of a deal/)).toBeNull();                          // said once, up front, by the page itself
    r.getByText('Why are you cancelling?');
    r.getByText('Refund of ₹2,999 to your original payment method in 5–7 working days');
    expect(said(r.getByTestId('confirm-cancel'))).toBe('Cancel deal');
    expect(r.getByTestId('confirm-cancel').props.accessibilityState.disabled).toBe(true);    // a reason first
    fireEvent.press(r.getByTestId('reason-Ordered by mistake'));
    await act(async () => { fireEvent.press(r.getByTestId('confirm-cancel')); });
    expect(followerApi.cancelLine).toHaveBeenCalledWith('l2', { reason: 'Ordered by mistake', note: undefined });
    await r.findByTestId('cancelled');
    r.getByText('Refund of ₹2,999 to your original payment method in 5–7 working days.');
  });

  it('an item in no deal: "Cancel", "Cancel item", and a warning when the server sends one (a gift that goes with it)', async () => {
    followerApi.cancelPreview.mockResolvedValue(ok(PREVIEW({ deal: null, lines: [{ id: 's1', name: 'Blue polo', size: 'M', role: 'buy' }, { id: 'g1', name: 'Silver coin', size: null, role: 'gift' }] })));
    const r = render(<CancelScreen navigation={nav()} route={{ params: { lineId: 's1' } }} />);
    await r.findByTestId('cancel');
    expect(r.queryByTestId('cancel-deal')).toBeNull();
    r.getByText('⚠ This is part of a deal. Cancelling cancels 3 items together.');
    r.getByText('Free gift: Silver coin');
    expect(said(r.getByTestId('confirm-cancel'))).toBe('Cancel item');
  });
});
