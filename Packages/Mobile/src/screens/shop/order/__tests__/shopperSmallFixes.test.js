/**
 * shopper-app-fixes — the small faults found on the way (founder, 5 Oct 2026: "fix the small issues"),
 * the ones on the ordering screens:
 *   S1  Review order: addresses that could not be READ are an error with Try again, not "Add an address"
 *   S2  Order placed, Order details, Cancel and Return: a read that failed has Try again; a refusal
 *       keeps the server's own sentence
 *   S3  a cash parcel with several items or a fee: the item's line is its price, and the server says
 *       what the courier collects for the parcel
 * The real screens, with the server's data shapes.
 */
import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

jest.mock('../../../../services/api', () => ({
  followerApi: {
    getBag: jest.fn(), putBag: jest.fn(), mergeBag: jest.fn(), bagPrice: jest.fn(),
    checkoutReview: jest.fn(), placeOrder: jest.fn(), verifyPayment: jest.fn(), abandonCheckout: jest.fn(), checkout: jest.fn(),
    orders: jest.fn(), orderLine: jest.fn(), addresses: jest.fn(),
    cancelPreview: jest.fn(), cancelLine: jest.fn(), returnPreview: jest.fn(), returnLine: jest.fn(),
    postEvents: jest.fn(() => Promise.resolve({ success: true })),
  },
  setDeviceHeader: jest.fn(), clearSession: jest.fn(() => Promise.resolve()),
}));
jest.mock('../../../../services/events', () => ({ track: jest.fn(), flush: jest.fn() }));
jest.mock('@react-navigation/native', () => ({ useFocusEffect: (cb) => { const React = require('react'); React.useEffect(() => cb(), [cb]); } }));
jest.mock('react-native-razorpay', () => ({ __esModule: true, default: { open: jest.fn() } }));

const { followerApi } = require('../../../../services/api');
const { shopStore } = require('../../../../components/shop/shopStore');
const { _resetBag } = require('../../../../components/shop/bag');
const Checkout = require('../CheckoutScreen').default;
const Return = require('../ReturnScreen').default;
const { OrderPlacedScreen, OrderDetailScreen, CancelScreen, moneyLine, parcelLine } = require('../OrderScreens');

const nav = () => ({ goBack: jest.fn(), navigate: jest.fn(), replace: jest.fn(), pop: jest.fn(), isFocused: jest.fn(() => true), addListener: jest.fn(() => () => {}) });
const ok = (data) => ({ success: true, data });
const no = (code, message) => ({ success: false, error: { code, message } });
const OFFLINE = no('NETWORK_ERROR', 'Cannot connect to server. Check your connection.');
const LOST = "Couldn't load. Check your connection.";

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  await AsyncStorage.setItem('inflx_token', 't');
  await AsyncStorage.setItem('inflx_user', JSON.stringify({ role: 'follower' }));
  shopStore._reset(); _resetBag();
});

const ADDR = { id: 'a1', receiver_name: 'Anusha K', receiver_phone: '9876543210', house: 'Flat 4B', area: 'Banjara Hills', city: 'Hyderabad', state: 'Telangana', pincode: '500034', is_default: true, label: 'Home' };
const RV = {
  address: ADDR,
  parcels: [{ brand: { id: 'b2', name: 'Urban Threads' }, arrives_by: '2026-10-08', items_total: 899, delivery_fee: 0,
    groups: [{ post_id: 'p2', creator: { id: 'c1', name: 'Sneha' }, brand: { id: 'b2', name: 'Urban Threads' }, offer: null, progress: null, gift: null, problems: [], buyable: true,
      normal_total: 899, paid_total: 899, savings: 0, gift_value: 0,
      lines: [{ ref: 'a', name: 'Blue polo', image_url: null, colour: 'Blue', size: 'M', qty: 1, role: 'buy', deal_key: null, auto: false, normal_unit: 899, normal_total: 899, paid_total: 899, problems: [], notes: [], price_was: null }] }] }],
  items_normal: 899, savings: 0, delivery_fee: 0, cod_fee: 0, total: 899, payment_method: 'online',
  payment: { online: { allowed: true, total: 899 }, cod: { allowed: true, fee: 0, total: 899, max: 5000, reason: null } },
  buyable: true, problems: [],
};
const LINES = [{ post_id: 'p2', product_id: 'bp', colour: 'Blue', size: 'M', qty: 1 }];

describe('S1 · Review order: addresses that could not be read', () => {
  it('is an error with Try again — she is not told to add an address she already has; Try again reads them', async () => {
    followerApi.addresses.mockResolvedValueOnce(OFFLINE);
    followerApi.checkoutReview.mockResolvedValue(ok(RV));
    const r = render(<Checkout navigation={nav()} route={{ params: { lines: LINES, buyNow: true } }} />);
    await waitFor(() => r.getByText('Try again'));
    expect(r.queryByTestId('checkout-no-address')).toBeNull();
    expect(r.queryByText('Add an address')).toBeNull();
    followerApi.addresses.mockResolvedValue(ok({ addresses: [ADDR] }));
    await act(async () => { fireEvent.press(r.getByText('Try again')); });
    await r.findByTestId('checkout');
    r.getByTestId('place-order');
  });

  it('a shopper who really has no address is still asked to add one', async () => {
    followerApi.addresses.mockResolvedValue(ok({ addresses: [] }));
    const r = render(<Checkout navigation={nav()} route={{ params: { lines: LINES, buyNow: true } }} />);
    await r.findByTestId('checkout-no-address');
  });
});

describe('S2 · a read that failed has Try again', () => {
  const D = (extra = {}) => ({
    id: 'l1', name: 'Blue polo', colour: 'Blue', size: 'M', qty: 1, paid: 899, role: 'buy', status: 'confirmed', status_word: 'Confirmed',
    brand: { name: 'Urban Threads' }, creator: { id: 'c', name: 'Akshaya Reddy' }, can_cancel: true, can_return: false, return: null, payment_method: 'online',
    timeline: [{ status: 'confirmed', word: 'Confirmed', at: '2026-10-05T10:00:00Z' }], address: { name: 'Anusha K', city: 'Hyderabad' }, post: null, refund: null, parcel: null, ...extra,
  });

  it('Order placed: the order IS placed; its details that could not be read say so, with Try again — no endless spinner', async () => {
    followerApi.checkout.mockResolvedValueOnce(OFFLINE);
    const n = nav();
    const r = render(<OrderPlacedScreen navigation={n} route={{ params: { checkoutId: 'co1' } }} />);
    await r.findByTestId('placed-failed');
    r.getByText('Order placed');
    r.getByText("Your order is placed. We couldn't load its details just now.");
    r.getByTestId('placed-orders');                                              // she can still go to My orders
    followerApi.checkout.mockResolvedValue(ok({ id: 'co1', total: 899, payment_method: 'online', parcels: [{ id: 'o1', brand: 'Urban Threads', items: 1, arrives_by: '2026-10-08' }] }));
    await act(async () => { fireEvent.press(r.getByTestId('placed-retry')); });
    await waitFor(() => r.getByText('Urban Threads'));
    expect(r.queryByTestId('placed-failed')).toBeNull();
  });

  it('Order details: Try again reads it', async () => {
    followerApi.orderLine.mockResolvedValueOnce(OFFLINE);
    const r = render(<OrderDetailScreen navigation={nav()} route={{ params: { lineId: 'l1' } }} />);
    await r.findByTestId('order-detail-failed');
    followerApi.orderLine.mockResolvedValue(ok(D()));
    await act(async () => { fireEvent.press(r.getByText('Try again')); });
    await r.findByTestId('order-detail');
  });

  it('Cancel: no signal → Try again; a refusal → the server\'s sentence and nothing to retry', async () => {
    followerApi.cancelPreview.mockResolvedValueOnce(OFFLINE);
    const r = render(<CancelScreen navigation={nav()} route={{ params: { lineId: 'l1' } }} />);
    await waitFor(() => r.getByText(LOST));
    followerApi.cancelPreview.mockResolvedValue(ok({ lines: [{ id: 'l1', name: 'Blue polo', size: 'M', role: 'buy' }], warning: null, refund: { amount: 899, text: 'Refund of ₹899' }, reasons: ['Not needed any more', 'Other'] }));
    await act(async () => { fireEvent.press(r.getByText('Try again')); });
    await r.findByTestId('cancel');

    followerApi.cancelPreview.mockResolvedValue(no('CONFLICT', 'It has shipped. You can return it once delivered.'));
    const r2 = render(<CancelScreen navigation={nav()} route={{ params: { lineId: 'l2' } }} />);
    await waitFor(() => r2.getByText('It has shipped. You can return it once delivered.'));
    expect(r2.queryByText('Try again')).toBeNull();
  });

  it('Return: the same — no signal → Try again; "the window has closed" → that sentence only', async () => {
    followerApi.returnPreview.mockResolvedValueOnce(OFFLINE);
    const r = render(<Return navigation={nav()} route={{ params: { lineId: 'l1' } }} />);
    await waitFor(() => r.getByText(LOST));
    followerApi.returnPreview.mockResolvedValue(ok({ lines: [{ id: 'l1', name: 'Blue polo', size: 'M', role: 'buy' }], warning: null, until: new Date(2026, 9, 11, 16, 30).toISOString(), window: '7 days',
      refund: { amount: 899, text: 'Refund of ₹899 to your original payment method once the item is back.' }, how: 'INFLX looks at every return.', reasons: [{ key: 'other', label: 'Other' }] }));
    await act(async () => { fireEvent.press(r.getByText('Try again')); });
    await r.findByTestId('return');

    followerApi.returnPreview.mockResolvedValue(no('CONFLICT', 'The return window (7 days from delivery) has closed.'));
    const r2 = render(<Return navigation={nav()} route={{ params: { lineId: 'l2' } }} />);
    await waitFor(() => r2.getByText('The return window (7 days from delivery) has closed.'));
    expect(r2.queryByText('Try again')).toBeNull();
  });
});

describe('S3 · what she pays the courier is the parcel\'s amount', () => {
  const COD = (extra = {}) => ({ id: 'l1', name: 'Blue polo', paid: 899, role: 'buy', status: 'confirmed', payment_method: 'cod',
    timeline: [{ status: 'confirmed', word: 'Confirmed', at: '2026-10-05T10:00:00Z' }], ...extra });

  it('one item, no fee: "To pay ₹899 on delivery", as before, and no second line', () => {
    const d = COD({ parcel: { items: 1, items_total: 899, delivery_fee: 0, cod_fee: 0, to_pay: 899, says: 'For this parcel you pay ₹899 on delivery.' } });
    expect(moneyLine(d)).toBe('To pay ₹899 on delivery');
    expect(parcelLine(d)).toBeNull();
  });

  it('two items and a fee: the item\'s line is its price; the server says what the parcel collects', () => {
    const says = 'For this parcel you pay ₹1,548 on delivery: 2 items ₹1,498 + cash on delivery fee ₹50.';
    const d = COD({ parcel: { items: 2, items_total: 1498, delivery_fee: 0, cod_fee: 50, to_pay: 1548, says } });
    expect(moneyLine(d)).toBe('₹899 · Cash on delivery');                        // it said "To pay ₹899 on delivery"
    expect(parcelLine(d)).toBe(says);
  });

  it('on Order details the parcel\'s sentence shows under the item\'s line; once delivered there is none', async () => {
    const says = 'For this parcel you pay ₹1,548 on delivery: 2 items ₹1,498 + cash on delivery fee ₹50.';
    const base = { colour: 'Blue', size: 'M', qty: 1, status_word: 'Confirmed', brand: { name: 'Urban Threads' }, creator: null, can_cancel: false, can_return: false, return: null,
      address: { name: 'Anusha K', city: 'Hyderabad' }, post: null, refund: null };
    followerApi.orderLine.mockResolvedValue(ok({ ...COD({ parcel: { items: 2, items_total: 1498, delivery_fee: 0, cod_fee: 50, to_pay: 1548, says } }), ...base }));
    const r = render(<OrderDetailScreen navigation={nav()} route={{ params: { lineId: 'l1' } }} />);
    await r.findByTestId('order-detail');
    expect(r.getByTestId('order-money').props.children).toBe('₹899 · Cash on delivery');
    expect(r.getByTestId('order-parcel-pay').props.children).toBe(says);

    followerApi.orderLine.mockResolvedValue(ok({ ...COD({ status: 'delivered', parcel: { items: 2, items_total: 1498, delivery_fee: 0, cod_fee: 50, to_pay: 1548, says: null },
      timeline: [{ status: 'delivered', word: 'Delivered', at: '2026-10-08T10:00:00Z' }] }), ...base, status_word: 'Delivered' }));
    const r2 = render(<OrderDetailScreen navigation={nav()} route={{ params: { lineId: 'l2' } }} />);
    await r2.findByTestId('order-detail');
    expect(r2.getByTestId('order-money').props.children).toBe('Paid ₹899 · Cash on delivery');
    expect(r2.queryByTestId('order-parcel-pay')).toBeNull();
  });

  it('an order paid online, and one from an older server that sends no parcel, are unchanged', () => {
    expect(moneyLine({ paid: 899, role: 'buy', status: 'confirmed', payment_method: 'online', parcel: { to_pay: 0, says: null } })).toBe('Paid ₹899 · UPI, cards, net banking');
    expect(moneyLine(COD())).toBe('To pay ₹899 on delivery');
    expect(parcelLine(COD())).toBeNull();
  });
});
