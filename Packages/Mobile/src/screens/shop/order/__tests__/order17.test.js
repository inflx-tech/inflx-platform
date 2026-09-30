/**
 * shopper-ordering — the ordering screens with the board's data: Shop this post with Add and the
 * size sheet (O1, O2), Build your deal (D1), the deal page and its product pop-up (P, B, K, G), the
 * review (D4), the bag (O6, O8), review and pay (O11, O12), order placed (O13), my orders, details,
 * cancel (O14–O17). The phone shows only the server's prices (C38).
 * Contract: features/shopper-ordering · rules v1.13 §6 · checks C37–C38
 */
import React from 'react';
import { Alert } from 'react-native';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

jest.mock('../../../../services/api', () => ({
  followerApi: {
    deal: jest.fn(), dealPrice: jest.fn(), bagPrice: jest.fn(), getBag: jest.fn(), putBag: jest.fn(), mergeBag: jest.fn(),
    checkoutReview: jest.fn(), placeOrder: jest.fn(), verifyPayment: jest.fn(), checkout: jest.fn(),
    orders: jest.fn(), orderLine: jest.fn(), cancelPreview: jest.fn(), cancelLine: jest.fn(),
    addresses: jest.fn(), addAddress: jest.fn(), updateAddress: jest.fn(), deleteAddress: jest.fn(), states: jest.fn(),
    saveProduct: jest.fn(), unsaveProduct: jest.fn(), postEvents: jest.fn(() => Promise.resolve({ success: true })),
  },
  setDeviceHeader: jest.fn(), clearSession: jest.fn(() => Promise.resolve()),
}));
jest.mock('../../../../services/events', () => ({ track: jest.fn(), flush: jest.fn() }));
jest.mock('@react-navigation/native', () => ({ useFocusEffect: (cb) => { const React = require('react'); React.useEffect(() => cb(), [cb]); } }));

const { followerApi } = require('../../../../services/api');
const { shopStore } = require('../../../../components/shop/shopStore');
const { ShopSheet } = require('../../../../components/shop/bitsShop');
const Deal = require('../DealScreen').default;
const DealReview = require('../DealReviewScreen').default;
const Bag = require('../BagScreen').default;
const Checkout = require('../CheckoutScreen').default;
const Addresses = require('../AddressesScreen').default;
const { OrderPlacedScreen, OrdersScreen, OrderDetailScreen, CancelScreen } = require('../OrderScreens');

const nav = () => ({ goBack: jest.fn(), navigate: jest.fn(), replace: jest.fn(), addListener: jest.fn(() => () => {}) });
const ok = (data) => ({ success: true, data });
const SIZES = [{ colour: 'Blue', images: [], sizes: [{ size: '30', left: null, sold_out: false }, { size: '32', left: 2, sold_out: false }, { size: '36', left: null, sold_out: true }] }];

async function guest() { await AsyncStorage.clear(); shopStore._reset(); }
async function signedIn() {
  await AsyncStorage.setItem('inflx_token', 't');
  await AsyncStorage.setItem('inflx_user', JSON.stringify({ role: 'follower' }));
  shopStore._reset();
}
beforeEach(async () => { jest.clearAllMocks(); await guest(); });

const SIMPLE_POST = {
  id: 'p1', creator: { id: 'c1', name: 'Priya' }, brand: { id: 'b1', name: 'Sri Lakshmi Silks' },
  offer: { id: 'o1', type: 'discount', line: '20% off applied', how: 'Every product is 20% off when bought from your post.' },
  products: [{ id: 'pr1', name: 'Mangalagiri cotton saree', image_url: null, price: 1200, shopper_price: 960, struck: true, in_stock: true }],
  mine: { saved_products: [] },
};
const DEAL_DATA = (sub, extra = {}) => ({
  post: { id: 'p2', creator: { name: 'Sneha' }, brand: { name: 'Urban Threads' } },
  offer: { id: 'o2', type: sub === 'bogo' ? 'bogo' : sub === 'spend' ? 'free_gift' : 'bundle', sub_type: sub, config: { pick: 2, price: 2999, gift_count: 1 }, line: 'Any 2 jeans for ₹2,999', how: 'Pick any 2', ends_on: '2026-10-31' },
  deal_page: true,
  products: [
    { id: 'l511', name: "Levi's 511 Slim", price: 2299, shopper_price: 2299, images: [], image_url: null, in_deal: true, category: null, colours: SIZES, sold_out: false, details: 'Stretch denim' },
    { id: 'wr', name: 'Wrangler Regular', price: 1999, shopper_price: 1999, images: [], image_url: null, in_deal: true, category: null, colours: SIZES, sold_out: false },
  ],
  gifts: [], categories: [],
  ...extra,
});
const GROUP = (over = {}) => ({
  post_id: 'p2', creator: { name: 'Sneha' }, brand: { id: 'b2', name: 'Urban Threads' }, offer: { type: 'bundle', line: 'Any 2 jeans for ₹2,999' },
  progress: { text: 'Set complete · you save ₹1,299', done: true }, gift: null, problems: [], buyable: true,
  normal_total: 4298, paid_total: 2999, savings: 1299, gift_value: 0,
  lines: [], ...over,
});

/* ═══════════════════════════════════════════ O1 · O2 · D1 */

describe('Shop this post with Add (O1, O2) and Build your deal (D1)', () => {
  it('a simple post: Add opens the size sheet; the chosen size goes to the bag with its post', async () => {
    followerApi.deal.mockResolvedValue(ok({ ...DEAL_DATA('percentage'), deal_page: false, offer: null,
      products: [{ id: 'pr1', name: 'Mangalagiri cotton saree', price: 1200, shopper_price: 960, images: [], colours: SIZES }] }));
    const { getByTestId, getByText, findByTestId } = render(<ShopSheet post={SIMPLE_POST} visible onClose={jest.fn()} surface="home" />);
    await waitFor(() => expect(followerApi.deal).toHaveBeenCalledWith('p1'));
    fireEvent.press(getByTestId('shop-add-pr1'));
    await findByTestId('size-sheet');
    expect(getByTestId('size-sheet-add').props.accessibilityState.disabled).toBe(true);                        // no size, no add
    getByText('Choose a size');
    fireEvent.press(getByTestId('size-sheet-size-32'));
    getByText('Only 2 left');
    await act(async () => { fireEvent.press(getByTestId('size-sheet-add')); });
    const bag = JSON.parse(await AsyncStorage.getItem('inflx_bag_v1'));
    expect(bag).toEqual([expect.objectContaining({ post_id: 'p1', product_id: 'pr1', colour: 'Blue', size: '32', qty: 1, role: 'buy', ticked: true })]);
    await findByTestId('in-bag-pr1');
    getByText('✓ In your bag · 32');
    getByTestId('go-to-bag');
  });

  it('a deal post: Build your deal opens its deal page; Add on a product opens it with that product', async () => {
    followerApi.deal.mockResolvedValue(ok(DEAL_DATA('pick_any')));
    const n = { navigate: jest.fn() };
    const RN = require('@react-navigation/native');
    RN.useNavigation = () => n;
    const post = { ...SIMPLE_POST, id: 'p2', offer: { id: 'o2', type: 'bundle', line: 'Any 2 for ₹2,999' },
      products: [{ id: 'l511', name: "Levi's 511 Slim", price: 2299, shopper_price: 2299, in_stock: true }] };
    const onClose = jest.fn();
    const { getByTestId, findByTestId } = render(<ShopSheet post={post} visible onClose={onClose} surface="home" />);
    await findByTestId('deal-intro');
    fireEvent.press(getByTestId('build-deal'));
    expect(n.navigate).toHaveBeenCalledWith('Deal', { postId: 'p2', start: null });
    fireEvent.press(getByTestId('shop-add-l511'));
    expect(n.navigate).toHaveBeenCalledWith('Deal', { postId: 'p2', start: 'l511' });
    delete RN.useNavigation;
  });
});

/* ═══════════════════════════════════════════ P · K · B · G */

describe('the deal page (P1–P3, K, B, G)', () => {
  it('P: tap → the pop-up → a size → Pick → the card shows it picked; the server prices every change', async () => {
    followerApi.deal.mockResolvedValue(ok(DEAL_DATA('pick_any')));
    followerApi.dealPrice.mockImplementation(async (postId, lines) => ok({ groups: lines.length ? [GROUP({
      progress: lines.length > 1 ? { text: 'Set complete · you save ₹1,299', done: true } : { text: '1 of 2 picked', done: false, next: 'Pick 1 more to complete the set' },
      buyable: lines.length > 1, lines: lines.map((l) => ({ ...l, name: 'x', paid_total: 1500, normal_total: 2000 })) })] : [] }));
    const n = nav();
    const { getByTestId, getByText, findByTestId } = render(<Deal navigation={n} route={{ params: { postId: 'p2' } }} />);
    await findByTestId('deal-grid');
    getByText('Any 2 jeans for ₹2,999');
    fireEvent.press(getByTestId('deal-product-l511'));
    await findByTestId('product-popup');
    getByText(/Stretch denim/);
    expect(getByTestId('product-popup-primary').props.accessibilityState.disabled).toBe(true);
    fireEvent.press(getByTestId('product-popup-size-30'));
    await act(async () => { fireEvent.press(getByTestId('product-popup-primary')); });
    await waitFor(() => expect(followerApi.dealPrice).toHaveBeenLastCalledWith('p2', [expect.objectContaining({ product_id: 'l511', colour: 'Blue', size: '30', role: 'buy' })]));
    await waitFor(() => getByText('1 of 2 picked'));
    getByText('✓ In set · 30');
    expect(getByTestId('sticky-button').props.accessibilityState.disabled).toBe(true);
    fireEvent.press(getByTestId('deal-product-wr'));
    fireEvent.press(getByTestId('product-popup-size-32'));
    await act(async () => { fireEvent.press(getByTestId('product-popup-primary')); });
    await waitFor(() => getByText('Set complete · you save ₹1,299'));
    fireEvent.press(getByTestId('sticky-button'));
    expect(n.navigate).toHaveBeenCalledWith('DealReview', expect.objectContaining({ postId: 'p2', lines: expect.arrayContaining([expect.objectContaining({ product_id: 'wr' })]) }));
  });

  it('B: the pop-up in two parts — the paid one, then the free one — makes a pair', async () => {
    followerApi.deal.mockResolvedValue(ok(DEAL_DATA('bogo')));
    followerApi.dealPrice.mockResolvedValue(ok({ groups: [GROUP({ offer: { type: 'bogo', line: 'Buy one get one' }, progress: { text: '1 pair', done: true } })] }));
    const { getByTestId, getByText, findByTestId } = render(<Deal navigation={nav()} route={{ params: { postId: 'p2' } }} />);
    await findByTestId('deal-grid');
    fireEvent.press(getByTestId('deal-product-l511'));
    getByText('1 · The one you pay for');
    fireEvent.press(getByTestId('product-popup-size-32'));
    fireEvent.press(getByTestId('product-popup-primary'));                    // Next: your free one
    getByText('2 · Your free one'); getByText('The same product, any colour or size');
    fireEvent.press(getByTestId('product-popup-size-30'));
    await act(async () => { fireEvent.press(getByTestId('product-popup-primary')); });
    await waitFor(() => expect(followerApi.dealPrice).toHaveBeenLastCalledWith('p2', [
      expect.objectContaining({ product_id: 'l511', size: '32', role: 'buy' }),
      expect.objectContaining({ product_id: 'l511', size: '30', role: 'free' })]));
    await findByTestId('pair-0');
    getByText('30 · Free ₹0'.replace('30', 'Blue · 30'));
  });

  it('G: step 2 stays locked until the server unlocks it; a chosen gift joins the deal as a gift', async () => {
    followerApi.deal.mockResolvedValue(ok(DEAL_DATA('spend', {
      gifts: [{ kind: 'gift_item', id: 'coin', name: 'Silver coin', worth: 650, image_url: null, left: null, all_given: false, colours: [], images: [] },
        { kind: 'gift_item', id: 'cap', name: 'Leather cap', worth: 499, image_url: null, left: 3, all_given: false, colours: [], images: [] }],
    })));
    let unlocked = false;
    followerApi.dealPrice.mockImplementation(async () => ok({ groups: [GROUP({ offer: { type: 'free_gift', line: 'Spend ₹3,000' },
      gift: { state: unlocked ? 'choose' : 'locked' }, progress: unlocked ? { text: 'Gift unlocked · choose 1', done: true } : { text: '₹2,299 of ₹3,000 · spend ₹701 more to unlock your gift', done: false } })] }));
    const { getByTestId, getByText, findByTestId, queryByTestId } = render(<Deal navigation={nav()} route={{ params: { postId: 'p2' } }} />);
    await findByTestId('gift-steps');
    fireEvent.press(getByTestId('deal-product-l511'));
    fireEvent.press(getByTestId('product-popup-size-30'));
    await act(async () => { fireEvent.press(getByTestId('product-popup-primary')); });
    await waitFor(() => getByText('₹2,299 of ₹3,000 · spend ₹701 more to unlock your gift'));
    fireEvent.press(getByTestId('step-gift'));
    expect(queryByTestId('gift-grid')).toBeNull();                              // locked
    unlocked = true;
    fireEvent.press(getByTestId('deal-product-wr'));
    fireEvent.press(getByTestId('product-popup-size-30'));
    await act(async () => { fireEvent.press(getByTestId('product-popup-primary')); });
    await waitFor(() => getByText('Next: choose your gift'));
    await act(async () => { fireEvent.press(getByTestId('sticky-button')); });
    await findByTestId('gift-grid');
    getByText('worth ₹650'); getByText('worth ₹499 · 3 left');
    fireEvent.press(getByTestId('gift-coin'));
    await act(async () => { fireEvent.press(getByTestId('product-popup-primary')); });
    await waitFor(() => expect(followerApi.dealPrice).toHaveBeenLastCalledWith('p2', expect.arrayContaining([expect.objectContaining({ gift_item_id: 'coin', role: 'gift' })])));
  });
});

/* ═══════════════════════════════════════════ D4 · O6 · O8 */

describe('the review (D4) and the bag (O6, O8)', () => {
  const LINES = [{ ref: 'a', product_id: 'l511', colour: 'Blue', size: '32', qty: 1, role: 'buy' }, { ref: 'b', product_id: 'wr', colour: 'Blue', size: '30', qty: 1, role: 'buy' }];

  it('D4: every item, what she pays and saves; Add to bag keeps the post; Buy now asks a guest to sign in first', async () => {
    followerApi.dealPrice.mockResolvedValue(ok({ groups: [GROUP({ lines: [
      { ref: 'a', name: "Levi's 511 Slim", colour: 'Blue', size: '32', qty: 1, role: 'buy', paid_total: 1604, normal_total: 2299, problems: [], notes: [] },
      { ref: 'b', name: 'Wrangler Regular', colour: 'Blue', size: '30', qty: 1, role: 'buy', paid_total: 1395, normal_total: 1999, problems: [], notes: [] }] })] }));
    const n = nav();
    const { getByTestId, getByText, findByTestId } = render(<DealReview navigation={n} route={{ params: { postId: 'p2', lines: LINES } }} />);
    await findByTestId('deal-review');
    getByText('You save ₹1,299');
    expect(getByTestId('money-total').props.children).toBe('₹2,999');       // the server's total, as sent
    await act(async () => { fireEvent.press(getByTestId('review-buy-now')); });
    expect(n.navigate).toHaveBeenCalledWith('FollowerLogin', expect.objectContaining({ onDone: expect.any(Function) }));
    await act(async () => { fireEvent.press(getByTestId('review-add-to-bag')); });
    expect(JSON.parse(await AsyncStorage.getItem('inflx_bag_v1')).map((l) => [l.post_id, l.product_id])).toEqual([['p2', 'l511'], ['p2', 'wr']]);
    expect(n.navigate).toHaveBeenCalledWith('Bag');
  });

  it('O6: grouped by post with its deal and Edit deal; unticking keeps an item; a guest is asked to sign in at Continue', async () => {
    await AsyncStorage.setItem('inflx_bag_v1', JSON.stringify(LINES.map((l) => ({ ...l, post_id: 'p2', ticked: true }))));
    followerApi.bagPrice.mockResolvedValue(ok({ groups: [GROUP({ lines: [
      { ref: 'a', name: "Levi's 511 Slim", role: 'buy', paid_total: 1604, normal_total: 2299, problems: [], notes: [] },
      { ref: 'b', name: 'Wrangler Regular', role: 'buy', paid_total: 1395, normal_total: 1999, problems: [], notes: [{ code: 'price_changed', text: 'Price changed from ₹1,899' }] }] })],
    unticked: [], items_normal: 4298, savings: 1299, items_total: 2999, buyable: true }));
    const n = nav();
    const { getByTestId, getByText, findByTestId } = render(<Bag navigation={n} />);
    await findByTestId('bag-group-p2');
    getByText('Any 2 jeans for ₹2,999'); getByText('Price changed from ₹1,899');
    getByText('Continue · ₹2,999');
    fireEvent.press(getByTestId('edit-deal-p2'));
    expect(n.navigate).toHaveBeenCalledWith('Deal', expect.objectContaining({ postId: 'p2', editing: true }));
    await act(async () => { fireEvent.press(getByTestId('tick-b')); });
    expect(JSON.parse(await AsyncStorage.getItem('inflx_bag_v1')).find((l) => l.ref === 'b').ticked).toBe(false);
    await act(async () => { fireEvent.press(getByTestId('bag-continue')); });
    await findByTestId('bag-sign-in');
    getByText('Sign in to place your order');
  });
});

/* ═══════════════════════════════════════════ O11 · O12 · O13 */

describe('review and pay (O11, O12) and order placed (O13)', () => {
  const ADDR = { id: 'a1', receiver_name: 'Anusha K', receiver_phone: '9876543210', house: 'Flat 4B', area: 'Banjara Hills', city: 'Hyderabad', state: 'Telangana', pincode: '500034', is_default: true, label: 'Home' };
  const RV = (over = {}) => ({
    address: ADDR, parcels: [{ brand: { id: 'b2', name: 'Urban Threads' }, arrives_by: '2026-10-04', groups: [GROUP({ lines: [{ ref: 'a', name: "Levi's 511", role: 'buy', paid_total: 2999, normal_total: 4298, problems: [], notes: [] }] })], items_total: 2999, delivery_fee: 0 }],
    items_normal: 4298, savings: 1299, delivery_fee: 0, cod_fee: 0, total: 2999, payment_method: 'online',
    payment: { online: { allowed: true, total: 2999 }, cod: { allowed: true, fee: 0, total: 2999, max: 5000, reason: null } },
    buyable: true, problems: [], ...over,
  });
  const LINES = [{ ref: 'a', post_id: 'p2', product_id: 'l511', colour: 'Blue', size: '32', qty: 1, role: 'buy' }];

  it('cash on delivery: Place order with the total she saw → Order placed', async () => {
    await signedIn();
    followerApi.addresses.mockResolvedValue(ok({ addresses: [ADDR] }));
    followerApi.checkoutReview.mockResolvedValue(ok(RV()));
    followerApi.placeOrder.mockResolvedValue(ok({ checkout_id: 'co1', status: 'placed', total: 2999, payment_method: 'cod' }));
    followerApi.getBag.mockResolvedValue(ok({ lines: [] }));
    const n = nav();
    const { getByTestId, getByText, findByTestId } = render(<Checkout navigation={n} route={{ params: { lines: LINES, buyNow: true } }} />);
    await findByTestId('checkout');
    getByText('Arrives by Sun, 4 Oct'); getByText("You're saving ₹1,299");
    fireEvent.press(getByTestId('pay-cod'));
    await waitFor(() => expect(followerApi.checkoutReview).toHaveBeenLastCalledWith(expect.objectContaining({ payment_method: 'cod' })));
    await act(async () => { fireEvent.press(getByTestId('place-order')); });
    expect(followerApi.placeOrder).toHaveBeenCalledWith({ address_id: 'a1', lines: LINES, payment_method: 'cod', expected_total: 2999 });
    expect(n.replace).toHaveBeenCalledWith('OrderPlaced', { checkoutId: 'co1' });
  });

  it('a changed total: nothing is taken, the new review shows; COD above the limit is greyed with the reason', async () => {
    await signedIn();
    followerApi.addresses.mockResolvedValue(ok({ addresses: [ADDR] }));
    followerApi.checkoutReview.mockResolvedValue(ok(RV({ payment: { online: { allowed: true, total: 5200 }, cod: { allowed: false, fee: 0, total: 5200, max: 5000, reason: 'Not available above ₹5,000' } } })));
    followerApi.placeOrder.mockResolvedValue({ success: false, error: { code: 'PRICE_CHANGED', message: 'The total is now ₹3,199', details: RV({ total: 3199 }) } });
    const { getByTestId, getByText, findByTestId } = render(<Checkout navigation={nav()} route={{ params: { lines: LINES } }} />);
    await findByTestId('checkout');
    getByText('Not available above ₹5,000');
    expect(getByTestId('pay-cod').props.accessibilityState.disabled).toBe(true);
    await act(async () => { fireEvent.press(getByTestId('place-order')); });
    await findByTestId('checkout-msg');
    getByText('Place order · ₹3,199');
  });

  it('online: Razorpay (test mode prompt) → verify → Order placed; a cancelled payment orders nothing', async () => {
    await signedIn();
    followerApi.addresses.mockResolvedValue(ok({ addresses: [ADDR] }));
    followerApi.checkoutReview.mockResolvedValue(ok(RV()));
    followerApi.placeOrder.mockResolvedValue(ok({ checkout_id: 'co2', status: 'pending', total: 2999, razorpay: { order_id: 'order_mock_1', key_id: null, amount: 2999 } }));
    followerApi.verifyPayment.mockResolvedValue(ok({ checkout_id: 'co2', status: 'placed' }));
    followerApi.getBag.mockResolvedValue(ok({ lines: [] }));
    const spy = jest.spyOn(Alert, 'alert').mockImplementation((t, m, buttons) => buttons[1].onPress());
    const n = nav();
    const { getByTestId, findByTestId } = render(<Checkout navigation={n} route={{ params: { lines: LINES } }} />);
    await findByTestId('checkout');
    await act(async () => { fireEvent.press(getByTestId('place-order')); });
    expect(followerApi.verifyPayment).toHaveBeenCalledWith(expect.objectContaining({ razorpay_order_id: 'order_mock_1' }));
    expect(n.replace).toHaveBeenCalledWith('OrderPlaced', { checkoutId: 'co2' });
    spy.mockImplementation((t, m, buttons) => buttons[0].onPress());
    followerApi.verifyPayment.mockClear(); n.replace.mockClear();
    await act(async () => { fireEvent.press(getByTestId('place-order')); });
    expect(followerApi.verifyPayment).not.toHaveBeenCalled();
    expect(n.replace).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('O13: each parcel and its date, the total and how she paid', async () => {
    followerApi.checkout.mockResolvedValue(ok({ id: 'co1', status: 'placed', total: 8197, payment_method: 'online', parcels: [
      { id: 'o1', brand: 'Sri Lakshmi Silks', arrives_by: '2026-10-03', items: 2 }, { id: 'o2', brand: 'Urban Threads', arrives_by: '2026-10-04', items: 3 }] }));
    const { getByText, findByTestId } = render(<OrderPlacedScreen navigation={nav()} route={{ params: { checkoutId: 'co1' } }} />);
    await findByTestId('order-placed');
    await waitFor(() => getByText('₹8,197 paid online'));
    getByText('Sri Lakshmi Silks'); getByText('3 items · Arrives by Sun, 4 Oct');
  });

  it('O9: a guest-free address list; Deliver here hands the address back to checkout', async () => {
    followerApi.addresses.mockResolvedValue(ok({ addresses: [ADDR] }));
    const onPick = jest.fn();
    const n = nav();
    const { getByTestId, getByText, findByTestId } = render(<Addresses navigation={n} route={{ params: { pick: true, onPick } }} />);
    await findByTestId('address-a1');
    getByText('Default'); getByText('Flat 4B, Banjara Hills, Hyderabad, Telangana, 500034');
    fireEvent.press(getByTestId('deliver-here-a1'));
    expect(onPick).toHaveBeenCalledWith(ADDR);
    expect(n.goBack).toHaveBeenCalled();
  });
});

/* ═══════════════════════════════════════════ O14 – O17 */

describe('my orders, details, cancel (O14–O17)', () => {
  it('O14 → O15 → O16 → O17: a reason is required; deal items go together; the refund is said plainly', async () => {
    followerApi.orders.mockResolvedValue(ok({ items: [{ id: 'l1', name: 'Wrangler Regular', colour: 'Blue', size: '32', qty: 1, paid: 1395, status: 'confirmed', status_word: 'Confirmed', arrives_by: '2026-10-04', brand: { name: 'Urban Threads' }, role: 'buy' }], more: false }));
    const n = nav();
    const list = render(<OrdersScreen navigation={n} />);
    await list.findByTestId('order-l1');
    list.getByText('Confirmed · Arrives by Sun, 4 Oct');
    fireEvent.press(list.getByTestId('order-l1'));
    expect(n.navigate).toHaveBeenCalledWith('OrderDetail', { lineId: 'l1' });

    followerApi.orderLine.mockResolvedValue(ok({ id: 'l1', name: 'Wrangler Regular', colour: 'Blue', size: '32', qty: 1, paid: 1395, role: 'buy', status: 'confirmed', status_word: 'Confirmed',
      brand: { name: 'Urban Threads' }, creator: { id: 'c', name: 'Sneha' }, can_cancel: true, payment_method: 'online',
      timeline: [{ status: 'confirmed', word: 'Confirmed', at: '2026-09-30T10:00:00Z' }, { status: 'packed', word: 'Packed', at: null }, { status: 'dispatched', word: 'Shipped', at: null }],
      address: { name: 'Anusha K', house: 'Flat 4B', city: 'Hyderabad', pincode: '500034' }, post: { id: 'p2', code: 'P3W8HX' }, refund: null }));
    const d = render(<OrderDetailScreen navigation={n} route={{ params: { lineId: 'l1' } }} />);
    await d.findByTestId('order-detail');
    fireEvent.press(d.getByTestId('order-cancel'));
    expect(n.navigate).toHaveBeenCalledWith('CancelItem', { lineId: 'l1' });

    followerApi.cancelPreview.mockResolvedValue(ok({ lines: [{ id: 'l1', name: 'Wrangler Regular', size: '32', role: 'buy' }, { id: 'l2', name: "Levi's 511", size: '32', role: 'buy' }],
      warning: 'This is part of a deal. Cancelling cancels 2 items together.', refund: { amount: 2999, text: 'Refund of ₹2,999 to your original payment method in 5–7 working days' },
      reasons: ['Incorrect size ordered', 'Not needed any more', 'Other'] }));
    followerApi.cancelLine.mockResolvedValue(ok({ cancelled: ['l1', 'l2'], parcel_cancelled: true, refund: { amount: 2999, status: 'issued' } }));
    const c = render(<CancelScreen navigation={n} route={{ params: { lineId: 'l1' } }} />);
    await c.findByTestId('cancel');
    c.getByText('⚠ This is part of a deal. Cancelling cancels 2 items together.');
    expect(c.getByTestId('confirm-cancel').props.accessibilityState.disabled).toBe(true);
    fireEvent.press(c.getByTestId('reason-Other'));
    expect(c.getByTestId('confirm-cancel').props.accessibilityState.disabled).toBe(true);                   // Other needs a note
    fireEvent.changeText(c.getByTestId('cancel-note'), 'Changed my mind');
    await act(async () => { fireEvent.press(c.getByTestId('confirm-cancel')); });
    expect(followerApi.cancelLine).toHaveBeenCalledWith('l1', { reason: 'Other', note: 'Changed my mind' });
    await c.findByTestId('cancelled');
    c.getByText('Refund of ₹2,999 to your original payment method in 5–7 working days.');
  });
});
