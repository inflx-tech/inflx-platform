/**
 * listing-shop-safety — the shopper app's two parts (features/listing-shop-safety, checks 25–26).
 *
 *   C   Place order goes with a key for the attempt. A second tap after an answer that never came
 *       sends the SAME key, so the server answers with the order it already made (she used to get
 *       two cash-on-delivery orders, or "Sold out" from her own hold). An answered attempt, or a
 *       new review, starts a new key.
 *   D   a piece a set needs twice goes in as two, from one choice of colour and size (the set's
 *       pop-up has no quantity, so such a set could never be completed).
 */
import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

jest.mock('../../../../services/api', () => ({
  followerApi: {
    deal: jest.fn(), dealPrice: jest.fn(), bagPrice: jest.fn(), getBag: jest.fn(), putBag: jest.fn(), mergeBag: jest.fn(),
    checkoutReview: jest.fn(), placeOrder: jest.fn(), verifyPayment: jest.fn(), abandonCheckout: jest.fn(), checkout: jest.fn(),
    orders: jest.fn(), orderLine: jest.fn(), addresses: jest.fn(),
    saveProduct: jest.fn(), unsaveProduct: jest.fn(), postEvents: jest.fn(() => Promise.resolve({ success: true })),
  },
  setDeviceHeader: jest.fn(), clearSession: jest.fn(() => Promise.resolve()),
}));
jest.mock('../../../../services/events', () => ({ track: jest.fn(), flush: jest.fn() }));
jest.mock('@react-navigation/native', () => ({ useFocusEffect: (cb) => { const React = require('react'); React.useEffect(() => cb(), [cb]); } }));
jest.mock('react-native-razorpay', () => ({ __esModule: true, default: { open: jest.fn() } }));

const { followerApi } = require('../../../../services/api');
const { shopStore } = require('../../../../components/shop/shopStore');
const { _resetBag } = require('../../../../components/shop/bag');
const Deal = require('../DealScreen').default;
const Checkout = require('../CheckoutScreen').default;
const { newPlaceKey } = require('../CheckoutScreen');

const nav = () => ({ goBack: jest.fn(), navigate: jest.fn(), replace: jest.fn(), pop: jest.fn(), isFocused: jest.fn(() => true), addListener: jest.fn(() => () => {}) });
const ok = (data) => ({ success: true, data });
const no = (code, message) => ({ success: false, error: { code, message } });
const KEY = /^[A-Za-z0-9_-]{8,64}$/;                       // what the server accepts as a key

async function signedIn() {
  await AsyncStorage.clear();
  await AsyncStorage.setItem('inflx_token', 't');
  await AsyncStorage.setItem('inflx_user', JSON.stringify({ role: 'follower' }));
  shopStore._reset();
}
beforeEach(async () => { jest.clearAllMocks(); await signedIn(); _resetBag(); });

/* ═══════════════════════════════════════════ C · Place order once */

describe('C · Place order goes with a key for the attempt', () => {
  const ADDR = { id: 'a1', receiver_name: 'Anusha K', receiver_phone: '9876543210', house: 'Flat 4B', area: 'Banjara Hills', city: 'Hyderabad', state: 'Telangana', pincode: '500034', is_default: true, label: 'Home' };
  const RV = (over = {}) => ({
    address: ADDR, parcels: [{ brand: { id: 'b2', name: 'Urban Threads' }, arrives_by: '2026-10-14', groups: [], items_total: 1499 }],
    items_normal: 1499, savings: 0, delivery_fee: 0, cod_fee: 0, total: 1499, payment_method: 'cod',
    payment: { online: { allowed: true, total: 1499 }, cod: { allowed: true, fee: 0, total: 1499, max: 5000, reason: null } },
    buyable: true, problems: [], ...over,
  });
  const LINES = [{ ref: 'a', post_id: 'p1', product_id: 'sun', colour: 'White', size: 'Free Size', qty: 1, role: 'buy' }];
  const SLOW = no('TIMEOUT', 'Request timed out. Server may be starting up — please retry in a moment.');
  const keysSent = () => followerApi.placeOrder.mock.calls.map((c) => c[0].place_key);

  async function checkout() {
    followerApi.addresses.mockResolvedValue(ok({ addresses: [ADDR] }));
    followerApi.checkoutReview.mockResolvedValue(ok(RV()));
    followerApi.getBag.mockResolvedValue(ok({ lines: [] }));
    const n = nav();
    const r = render(<Checkout navigation={n} route={{ params: { lines: LINES, buyNow: true } }} />);
    await r.findByTestId('checkout');
    fireEvent.press(r.getByTestId('pay-cod'));
    await waitFor(() => expect(followerApi.checkoutReview).toHaveBeenLastCalledWith(expect.objectContaining({ payment_method: 'cod' })));
    return { ...r, n };
  }

  it('the key is one the server accepts, and no two are alike', () => {
    const made = Array.from({ length: 200 }, () => newPlaceKey());
    for (const k of made) expect(k).toMatch(KEY);
    expect(new Set(made).size).toBe(200);
  });

  it('the answer never came and she taps again: the SAME key goes, and the order the server already made is the one she gets', async () => {
    const r = await checkout();
    followerApi.placeOrder.mockResolvedValueOnce(SLOW);                                   // her first tap: the order was made, the answer was lost
    await act(async () => { fireEvent.press(r.getByTestId('place-order')); });
    await r.findByTestId('checkout-msg');
    expect(r.n.replace).not.toHaveBeenCalled();
    followerApi.placeOrder.mockResolvedValueOnce(ok({ checkout_id: 'co1', status: 'placed', total: 1499, payment_method: 'cod', repeated: true }));
    await act(async () => { fireEvent.press(r.getByTestId('place-order')); });
    const [first, second] = keysSent();
    expect(first).toMatch(KEY);
    expect(second).toBe(first);                                                           // no key went before: two orders
    expect(followerApi.placeOrder).toHaveBeenLastCalledWith({ address_id: 'a1', lines: LINES, payment_method: 'cod', expected_total: 1499, place_key: first });
    expect(r.n.replace).toHaveBeenCalledWith('OrderPlaced', { checkoutId: 'co1' });
  });

  it('a refusal that made nothing ("the total is now…") keeps the key; an answered attempt and a new review each start a new one', async () => {
    const r = await checkout();
    followerApi.placeOrder.mockResolvedValueOnce({ success: false, error: { code: 'PRICE_CHANGED', message: 'The total is now ₹1,599', details: RV({ total: 1599 }) } });
    await act(async () => { fireEvent.press(r.getByTestId('place-order')); });
    followerApi.placeOrder.mockResolvedValueOnce(SLOW);
    await act(async () => { fireEvent.press(r.getByTestId('place-order')); });
    expect(keysSent()[1]).toBe(keysSent()[0]);
    expect(followerApi.placeOrder.mock.calls[1][0].expected_total).toBe(1599);            // the new total, under the same attempt

    // she picks the other way to pay: the page reads the review again — another attempt, another key
    fireEvent.press(r.getByTestId('pay-online'));
    await waitFor(() => expect(followerApi.checkoutReview).toHaveBeenLastCalledWith(expect.objectContaining({ payment_method: 'online' })));
    followerApi.placeOrder.mockResolvedValueOnce(SLOW);
    await act(async () => { fireEvent.press(r.getByTestId('place-order')); });
    expect(keysSent()[2]).toMatch(KEY);
    expect(keysSent()[2]).not.toBe(keysSent()[0]);
  });
});

/* ═══════════════════════════════════════════ D · a piece the set needs twice */

describe('D · a set that needs two of one piece', () => {
  const SIZE = (size) => ({ size, price: 799, shopper_price: 799, left: null, sold_out: false });
  const PIECE = (id, name, price, setQty) => ({
    id, name, price, shopper_price: price, images: [], image_url: null, in_deal: true, category: null, sold_out: false, details: null,
    colours: [{ colour: 'Blue', images: [], sizes: [SIZE('M'), SIZE('L')] }],
    brand_label: null, category_path: null, specs: [], size_chart: null, set_qty: setQty,
  });
  const SET = {
    post: { id: 'p2', creator: { id: 'c1', name: 'Sneha' }, brand: { id: 'b2', name: 'Urban Threads' } },
    offer: { id: 'o2', type: 'bundle', sub_type: 'fixed', config: { price: 1999, quantities: { tee: 2 } }, line: '3 items for ₹1,999', how: 'Buy the whole set', ends_on: '2026-10-31' },
    deal_page: true, returns: { line: 'Within 7 days of delivery' },
    products: [PIECE('tee', 'Cotton T-shirt', 799, 2), PIECE('jeans', 'Slim jeans', 1499, 1)], gifts: [], categories: [],
  };
  const texts = (node) => node.findAll((n) => typeof n.type === 'string' && n.type === 'Text').map((n) => [].concat(n.props.children).filter((c) => typeof c === 'string' || typeof c === 'number').join(''));

  it('one choice of colour and size puts both in: the line the server prices is a line of 2, and the chosen row says ×2', async () => {
    followerApi.deal.mockResolvedValue(ok(SET));
    followerApi.dealPrice.mockResolvedValue(ok({ groups: [] }));
    const r = render(<Deal navigation={nav()} route={{ params: { postId: 'p2' } }} />);
    await r.findByTestId('set-list');
    expect(texts(r.getByTestId('set-item-tee'))).toContain('Cotton T-shirt ×2');

    fireEvent.press(r.getByTestId('set-item-tee'));
    await r.findByTestId('product-popup');
    fireEvent.press(r.getByTestId('product-popup-size-M'));
    await act(async () => { fireEvent.press(r.getByTestId('product-popup-primary')); });
    await waitFor(() => expect(followerApi.dealPrice.mock.calls.some((c) => (c[1] || []).some((l) => l.product_id === 'tee'))).toBe(true));
    const sent = followerApi.dealPrice.mock.calls.map((c) => c[1]).filter((ls) => ls.some((l) => l.product_id === 'tee')).pop();
    expect(sent.find((l) => l.product_id === 'tee')).toMatchObject({ colour: 'Blue', size: 'M', qty: 2, role: 'buy' });   // it was 1: "Sold only as the whole set"
    expect(texts(r.getByTestId('set-item-tee')).join(' ')).toContain('Blue · M · ×2');

    // a piece the set needs once is a line of 1, and says nothing more
    fireEvent.press(r.getByTestId('set-item-jeans'));
    await r.findByTestId('product-popup');
    fireEvent.press(r.getByTestId('product-popup-size-L'));
    await act(async () => { fireEvent.press(r.getByTestId('product-popup-primary')); });
    await waitFor(() => expect(followerApi.dealPrice.mock.calls.some((c) => (c[1] || []).some((l) => l.product_id === 'jeans'))).toBe(true));
    const both = followerApi.dealPrice.mock.calls.map((c) => c[1]).filter((ls) => ls.some((l) => l.product_id === 'jeans')).pop();
    expect(both.find((l) => l.product_id === 'jeans').qty).toBe(1);
    expect(texts(r.getByTestId('set-item-jeans')).join(' ')).not.toContain('×');
  });
});
