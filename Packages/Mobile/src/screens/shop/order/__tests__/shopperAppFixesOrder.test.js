/**
 * shopper-app-fixes — ordering: the deal page, the review, the bag, review and pay, my orders.
 * Contract: features/shopper-app-fixes · 01-spec.md · BUILD_API.md. The real screens, rendered
 * with the server's data shapes; `followerApi` is the only thing mocked.
 *
 *   F1   cancelling or failing an online payment releases the held items at once and leaves her on
 *        the review with her bag as it was; a payment that lands after the items sold out says
 *        "It sold out while you were paying. Your payment is being refunded." — never "Order placed"
 *   F6   a product sold out in every size says so, and cannot be picked
 *   F9   a bag that could not be read is "Couldn't load your bag" with Try again — on the Bag and
 *        on Review order — never "Your bag is empty", and nothing is saved over it
 *   F10  a picked size shows that size's own price; changing a size in the bag records it
 *   F12  removing on "Your deal" is removing on the deal page; removing the last item goes back
 *        to the deal page with nothing picked (no spinner for ever)
 *   N1   an ended post says the server's sentence; a failed load has Try again (deal page)
 *   N3   cash on delivery: "To pay ₹X on delivery" until delivered, "Paid ₹X · Cash on delivery" after
 *   N4   "Nothing matches" for a filter or search with no match; Packed and Out for delivery filters
 *   N5   My orders goes on past the first 20
 *   N6   a chosen free gift shows once in the bag; no "Delivery · Free" written into the bag
 *   N7   "₹999" (not "₹999 · ") for a product with no sizes; "1 size"
 */
import React from 'react';
import { Alert, FlatList } from 'react-native';
import { render, fireEvent, waitFor, act, within } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const mockFocus = { again: null };       // the last screen's focus callback: calling it is "she came back to this screen"
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
jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (cb) => { const React = require('react'); React.useEffect(() => { mockFocus.again = cb; return cb(); }, [cb]); },
}));
jest.mock('react-native-razorpay', () => ({ __esModule: true, default: { open: jest.fn() } }));

const { followerApi } = require('../../../../services/api');
const { shopStore } = require('../../../../components/shop/shopStore');
const { _resetBag } = require('../../../../components/shop/bag');
const { CO } = require('../../../../components/shop/copyOrder');
const { CR } = require('../../../../components/shop/copyReturn');
const Razorpay = require('react-native-razorpay').default;
const Deal = require('../DealScreen').default;
const DealReview = require('../DealReviewScreen').default;
const Bag = require('../BagScreen').default;
const Checkout = require('../CheckoutScreen').default;
const { OrdersScreen, OrderDetailScreen, moneyLine } = require('../OrderScreens');

const nav = () => ({ goBack: jest.fn(), navigate: jest.fn(), replace: jest.fn(), pop: jest.fn(), isFocused: jest.fn(() => true), addListener: jest.fn(() => () => {}) });
const ok = (data) => ({ success: true, data });
const no = (code, message) => ({ success: false, error: { code, message } });
const OFFLINE = no('NETWORK_ERROR', 'Cannot connect to server. Check your connection.');
const texts = (node) => node.findAll((n) => typeof n.type === 'string' && n.type === 'Text').map((n) => [].concat(n.props.children).filter((c) => typeof c === 'string' || typeof c === 'number').join(''));
const off = (el) => el.props.accessibilityState.disabled;
const bagNow = async () => JSON.parse(await AsyncStorage.getItem('inflx_bag_v1')) || [];

async function guest() { await AsyncStorage.clear(); shopStore._reset(); }
async function signedIn() {
  await AsyncStorage.setItem('inflx_token', 't');
  await AsyncStorage.setItem('inflx_user', JSON.stringify({ role: 'follower' }));
  shopStore._reset();
}
beforeEach(async () => { jest.clearAllMocks(); mockFocus.again = null; await guest(); _resetBag(); });

/* ───────────────────────────── the server's shapes */

const SIZE = (size, extra = {}) => ({ size, price: 2299, shopper_price: 2299, left: null, sold_out: false, ...extra });
const SIZES = [{ colour: 'Blue', images: [], sizes: [SIZE('30'), SIZE('32', { left: 2 }), SIZE('36', { sold_out: true })] }];
const PRODUCT = (id, name, price, colours, extra = {}) => ({
  id, name, price, shopper_price: price, images: [], image_url: null, in_deal: true, category: null, colours, sold_out: false, details: null,
  brand_label: null, category_path: null, specs: [], size_chart: null, set_qty: null, ...extra,
});
const DEAL = (sub, products, extra = {}) => ({
  post: { id: 'p2', creator: { id: 'c1', name: 'Sneha' }, brand: { id: 'b2', name: 'Urban Threads' } },
  offer: { id: 'o2', type: { bogo: 'bogo', spend: 'free_gift', quantity: 'volume' }[sub] || 'bundle', sub_type: sub,
    config: sub === 'quantity' ? { tiers: [{ at: 2, value: 20 }], reward: 'percent' } : { pick: 2, price: 2999, gift_count: 1 },
    line: 'Any 2 jeans for ₹2,999', how: 'Pick any 2', ends_on: '2026-10-31' },
  deal_page: true, returns: { line: 'Within 7 days of delivery' },
  products, gifts: [], categories: [],
  ...extra,
});
const GROUP = (over = {}) => ({
  post_id: 'p2', creator: { id: 'c1', name: 'Sneha' }, brand: { id: 'b2', name: 'Urban Threads' },
  offer: { id: 'o2', type: 'bundle', sub_type: 'pick_any', line: 'Any 2 jeans for ₹2,999' },
  progress: { text: 'Set complete · you save ₹1,299', done: true }, gift: null, problems: [], buyable: true,
  normal_total: 4298, paid_total: 2999, savings: 1299, gift_value: 0, lines: [], ...over,
});
const PRICED = (ref, name, paid, normal, extra = {}) => ({
  ref, name, image_url: null, colour: 'Blue', size: '32', qty: 1, role: 'buy', deal_key: null, auto: false,
  normal_unit: normal, normal_total: normal, paid_total: paid, problems: [], notes: [], price_was: null, ...extra,
});

/* ═══════════════════════════════════════════ F1 · F9 · N6 — review and pay */

describe('review and pay', () => {
  const ADDR = { id: 'a1', receiver_name: 'Anusha K', receiver_phone: '9876543210', house: 'Flat 4B', area: 'Banjara Hills', city: 'Hyderabad', state: 'Telangana', pincode: '500034', is_default: true, label: 'Home' };
  const RV = (over = {}, line = {}) => ({
    address: ADDR,
    parcels: [{ brand: { id: 'b2', name: 'Urban Threads' }, arrives_by: '2026-10-08', items_total: 2999, delivery_fee: 0,
      groups: [GROUP({ lines: [PRICED('a', "Levi's 511", 2999, 4298, line)] })] }],
    items_normal: 4298, savings: 1299, delivery_fee: 0, cod_fee: 0, total: 2999, payment_method: 'online',
    payment: { online: { allowed: true, total: 2999 }, cod: { allowed: true, fee: 0, total: 2999, max: 5000, reason: null } },
    buyable: true, problems: [], ...over,
  });
  // Her bag as her account holds it (GET /follower/bag): the row's id is the line's ref.
  const BAG = [{ id: 'a', ref: 'a', post_id: 'p2', product_id: 'l511', gift_item_id: null, colour: 'Blue', size: '32', qty: 1, role: 'buy', ticked: true, price_seen: 2299 }];
  const PENDING = (orderId = 'order_mock_1') => ok({ checkout_id: 'co2', status: 'pending', total: 2999, payment_method: 'online', razorpay: { order_id: orderId, key_id: 'rzp_test_x', amount: 2999, expires_in_s: 900 } });
  const CANCEL = (t, m, buttons) => buttons[0].onPress();
  const CONFIRM = (t, m, buttons) => buttons[1].onPress();

  /** Review order opened from the Bag's Continue: the bag's ticked lines are what is ordered. */
  async function fromBag(review = RV()) {
    await signedIn();
    followerApi.getBag.mockResolvedValue(ok({ lines: BAG }));
    followerApi.addresses.mockResolvedValue(ok({ addresses: [ADDR] }));
    followerApi.checkoutReview.mockResolvedValue(ok(review));
    followerApi.abandonCheckout.mockResolvedValue(ok({ checkout_id: 'co2', status: 'expired' }));
    const n = nav();
    const r = render(<Checkout navigation={n} route={{ params: {} }} />);
    await r.findByTestId('checkout');
    return { ...r, n };
  }
  let alert;
  afterEach(() => { if (alert) alert.mockRestore(); alert = null; });

  it('F1 · she closes the payment sheet: the held items are released at once, she stays on the review, and her bag is as it was', async () => {
    const c = await fromBag();
    followerApi.placeOrder.mockResolvedValue(PENDING());
    let released;
    followerApi.abandonCheckout.mockReturnValue(new Promise((res) => { released = res; }));
    alert = jest.spyOn(Alert, 'alert').mockImplementation(CANCEL);
    const bagReads = followerApi.getBag.mock.calls.length;

    await act(async () => { fireEvent.press(c.getByTestId('place-order')); });
    expect(followerApi.abandonCheckout).toHaveBeenCalledTimes(1);
    expect(followerApi.abandonCheckout).toHaveBeenCalledWith('co2');
    expect(followerApi.verifyPayment).not.toHaveBeenCalled();
    expect(c.n.replace).not.toHaveBeenCalled();                               // never "Order placed"
    expect(c.getByTestId('checkout-msg').props.children).toBe('Payment cancelled. Nothing was charged.');
    c.getByTestId('checkout');                                                // still the review
    // Until the items are released she cannot press Place order again — her own retry would read "Sold out".
    expect(off(c.getByTestId('place-order'))).toBe(true);
    await act(async () => { released(ok({ checkout_id: 'co2', status: 'expired' })); });
    expect(off(c.getByTestId('place-order'))).toBe(false);
    // Her bag was never emptied: it is not read again and nothing is written to it.
    expect(followerApi.getBag.mock.calls.length).toBe(bagReads);
    expect(followerApi.putBag).not.toHaveBeenCalled();
  });

  it('F1 · the release failing changes nothing for her: the same sentence, and she can try again', async () => {
    const c = await fromBag();
    followerApi.placeOrder.mockResolvedValue(PENDING());
    followerApi.abandonCheckout.mockRejectedValue(new Error('offline'));
    alert = jest.spyOn(Alert, 'alert').mockImplementation(CANCEL);
    await act(async () => { fireEvent.press(c.getByTestId('place-order')); });
    expect(followerApi.abandonCheckout).toHaveBeenCalledWith('co2');
    expect(c.getByTestId('checkout-msg').props.children).toBe('Payment cancelled. Nothing was charged.');
    expect(off(c.getByTestId('place-order'))).toBe(false);
    followerApi.abandonCheckout.mockResolvedValue(OFFLINE);                   // or the server says no: the same
    await act(async () => { fireEvent.press(c.getByTestId('place-order')); });
    expect(followerApi.abandonCheckout).toHaveBeenCalledTimes(2);
    expect(c.getByTestId('checkout-msg').props.children).toBe('Payment cancelled. Nothing was charged.');
  });

  it('F1 · the payment could not be confirmed: released too, the server\'s sentence, no "Order placed"', async () => {
    const c = await fromBag();
    followerApi.placeOrder.mockResolvedValue(PENDING());
    followerApi.verifyPayment.mockResolvedValue(no('VALIDATION_ERROR', 'Payment could not be verified'));
    alert = jest.spyOn(Alert, 'alert').mockImplementation(CONFIRM);
    await act(async () => { fireEvent.press(c.getByTestId('place-order')); });
    expect(followerApi.verifyPayment).toHaveBeenCalledWith(expect.objectContaining({ razorpay_order_id: 'order_mock_1' }));
    expect(followerApi.abandonCheckout).toHaveBeenCalledWith('co2');
    expect(c.getByTestId('checkout-msg').props.children).toBe('Payment could not be verified');
    expect(c.n.replace).not.toHaveBeenCalled();
    expect(followerApi.putBag).not.toHaveBeenCalled();
  });

  it('F1 · she paid but INFLX could not be reached: nothing is released, she is told not to pay again, and "Check again" settles it', async () => {
    require('../CheckoutScreen')._setConfirmWaitForTests(0);
    const c = await fromBag();
    followerApi.placeOrder.mockResolvedValue(PENDING());
    followerApi.verifyPayment.mockResolvedValue(OFFLINE);
    alert = jest.spyOn(Alert, 'alert').mockImplementation(CONFIRM);
    await act(async () => { fireEvent.press(c.getByTestId('place-order')); });
    await waitFor(() => expect(followerApi.verifyPayment).toHaveBeenCalledTimes(3));   // tried three times
    await c.findByTestId('check-payment');
    expect(followerApi.abandonCheckout).not.toHaveBeenCalled();                    // her payment keeps its items
    expect(c.getByTestId('checkout-msg').props.children).toBe("We couldn't confirm your payment yet. Please don't pay again. Tap Check again, or look in My orders in a minute.");
    expect(c.queryByTestId('place-order')).toBeNull();                             // she cannot be made to pay twice
    expect(c.n.replace).not.toHaveBeenCalled();
    fireEvent.press(c.getByTestId('unconfirmed-orders'));
    expect(c.n.navigate).toHaveBeenCalledWith('Orders');

    // still no signal: the same sentence, still no Place order
    await act(async () => { fireEvent.press(c.getByTestId('check-payment')); });
    await waitFor(() => expect(followerApi.verifyPayment).toHaveBeenCalledTimes(6));
    await waitFor(() => expect(off(c.getByTestId('check-payment'))).toBeFalsy());
    expect(c.queryByTestId('place-order')).toBeNull();
    expect(followerApi.placeOrder).toHaveBeenCalledTimes(1);                       // never asked to pay again
    // the signal is back: the order had been placed all along
    followerApi.verifyPayment.mockResolvedValue(ok({ checkout_id: 'co2', status: 'placed', already: true }));
    await act(async () => { fireEvent.press(c.getByTestId('check-payment')); });
    await waitFor(() => expect(c.n.replace).toHaveBeenCalledWith('OrderPlaced', { checkoutId: 'co2' }));
    expect(followerApi.abandonCheckout).not.toHaveBeenCalled();
  });

  it('F1 · …and when "Check again" learns it sold out meanwhile: the refund sentence, and Place order is back', async () => {
    require('../CheckoutScreen')._setConfirmWaitForTests(0);
    const c = await fromBag();
    followerApi.placeOrder.mockResolvedValue(PENDING());
    followerApi.verifyPayment.mockResolvedValue(OFFLINE);
    alert = jest.spyOn(Alert, 'alert').mockImplementation(CONFIRM);
    await act(async () => { fireEvent.press(c.getByTestId('place-order')); });
    await c.findByTestId('check-payment');
    followerApi.verifyPayment.mockResolvedValue(ok({ checkout_id: 'co2', status: 'refunded', already: false }));
    await act(async () => { fireEvent.press(c.getByTestId('check-payment')); });
    await waitFor(() => expect(c.getByTestId('checkout-msg').props.children).toBe(CO.soldOutWhilePaying));
    expect(c.n.replace).not.toHaveBeenCalled();
    await c.findByTestId('place-order');
  });

  it('F1 · the real payment sheet: a failed payment and a dismissed one both release what was held', async () => {
    const c = await fromBag();
    followerApi.placeOrder.mockResolvedValue(PENDING('order_live_1'));
    Razorpay.open.mockRejectedValueOnce({ code: 1, description: 'Payment failed' });
    await act(async () => { fireEvent.press(c.getByTestId('place-order')); });
    expect(Razorpay.open).toHaveBeenCalledWith(expect.objectContaining({ order_id: 'order_live_1', amount: 299900, currency: 'INR' }));
    expect(c.getByTestId('checkout-msg').props.children).toBe("The payment didn't go through. Nothing was ordered.");
    expect(followerApi.abandonCheckout).toHaveBeenCalledTimes(1);
    expect(followerApi.verifyPayment).not.toHaveBeenCalled();

    Razorpay.open.mockRejectedValueOnce({ code: 2, description: 'Payment cancelled by user' });
    await act(async () => { fireEvent.press(c.getByTestId('place-order')); });
    expect(c.getByTestId('checkout-msg').props.children).toBe('Payment cancelled. Nothing was charged.');
    expect(followerApi.abandonCheckout).toHaveBeenCalledTimes(2);
    expect(c.n.replace).not.toHaveBeenCalled();
  });

  it('F1 · the payment landed after the items were released and they have sold out: she is told it is being refunded — never "Order placed"', async () => {
    const c = await fromBag();
    followerApi.placeOrder.mockResolvedValue(PENDING());
    followerApi.verifyPayment.mockResolvedValue(ok({ checkout_id: 'co2', status: 'refunded', already: false }));
    // What the review says now that it has gone.
    followerApi.checkoutReview.mockResolvedValue(ok(RV({ buyable: false }, { problems: [{ code: 'sold_out', text: 'Sold out in this size. Change size' }] })));
    alert = jest.spyOn(Alert, 'alert').mockImplementation(CONFIRM);
    const bagReads = followerApi.getBag.mock.calls.length;
    await act(async () => { fireEvent.press(c.getByTestId('place-order')); });
    expect(c.getByTestId('checkout-msg').props.children).toBe('It sold out while you were paying. Your payment is being refunded.');
    expect(c.n.replace).not.toHaveBeenCalled();
    expect(c.n.navigate).not.toHaveBeenCalled();
    expect(followerApi.abandonCheckout).not.toHaveBeenCalled();              // nothing is held any more
    expect(followerApi.getBag.mock.calls.length).toBe(bagReads);             // nothing was ordered: the bag is as it was
    c.getByText('Sold out in this size. Change size');                       // the review was read again
    expect(off(c.getByTestId('place-order'))).toBe(true);
  });

  it('F1 · a payment that arrives: the bag is read again (the server has emptied it), "Order placed" opens, nothing is released', async () => {
    const c = await fromBag();
    followerApi.placeOrder.mockResolvedValue(PENDING());
    followerApi.verifyPayment.mockResolvedValue(ok({ checkout_id: 'co2', status: 'placed', already: false }));
    alert = jest.spyOn(Alert, 'alert').mockImplementation(CONFIRM);
    const bagReads = followerApi.getBag.mock.calls.length;
    await act(async () => { fireEvent.press(c.getByTestId('place-order')); });
    expect(c.n.replace).toHaveBeenCalledWith('OrderPlaced', { checkoutId: 'co2' });
    expect(followerApi.getBag.mock.calls.length).toBe(bagReads + 1);
    expect(followerApi.abandonCheckout).not.toHaveBeenCalled();
  });

  it('F1 · cash on delivery is an order at once: nothing to release', async () => {
    const c = await fromBag();
    followerApi.placeOrder.mockResolvedValue(ok({ checkout_id: 'co1', status: 'placed', total: 2999, payment_method: 'cod', razorpay: null }));
    fireEvent.press(c.getByTestId('pay-cod'));
    await waitFor(() => expect(followerApi.checkoutReview).toHaveBeenLastCalledWith(expect.objectContaining({ payment_method: 'cod' })));
    await act(async () => { fireEvent.press(c.getByTestId('place-order')); });
    expect(c.n.replace).toHaveBeenCalledWith('OrderPlaced', { checkoutId: 'co1' });
    expect(followerApi.abandonCheckout).not.toHaveBeenCalled();
  });

  it('F9 · a bag that could not be read: "Couldn\'t load your bag" with Try again — it is not reviewed as an empty bag', async () => {
    await signedIn();
    followerApi.getBag.mockResolvedValue(OFFLINE);
    followerApi.addresses.mockResolvedValue(ok({ addresses: [ADDR] }));
    followerApi.checkoutReview.mockResolvedValue(ok(RV()));
    const r = render(<Checkout navigation={nav()} route={{ params: {} }} />);
    await r.findByTestId('checkout-error');
    r.getByText("Couldn't load your bag");
    expect(followerApi.checkoutReview).not.toHaveBeenCalled();
    expect(r.queryByTestId('place-order')).toBeNull();
    followerApi.getBag.mockResolvedValue(ok({ lines: BAG }));
    await act(async () => { fireEvent.press(r.getByText('Try again')); });
    await r.findByTestId('checkout');
    expect(followerApi.checkoutReview).toHaveBeenLastCalledWith(expect.objectContaining({ lines: [expect.objectContaining({ ref: 'a', product_id: 'l511', size: '32' })] }));
  });

  it('N6 · the delivery line is the server\'s amount: "Free" only when it is 0', async () => {
    const paid = await fromBag(RV({ delivery_fee: 49, total: 3048 }));
    expect(texts(paid.getByTestId('checkout'))).toEqual(expect.arrayContaining(['Delivery', '₹49']));
    expect(texts(paid.getByTestId('checkout'))).not.toContain('Free');
    expect(paid.getByTestId('money-total').props.children).toBe('₹3,048');
    paid.unmount();
    const free = await fromBag(RV());
    expect(texts(free.getByTestId('checkout'))).toEqual(expect.arrayContaining(['Delivery', 'Free']));
  });
});

/* ═══════════════════════════════════════════ N1 · N7 · F10 · F6 — the deal page */

describe('the deal page', () => {
  const open = async (data, params = {}) => {
    followerApi.deal.mockResolvedValue(data);
    const n = nav();
    const r = render(<Deal navigation={n} route={{ params: { postId: 'p2', ...params } }} />);
    return { ...r, n };
  };
  beforeEach(() => { followerApi.dealPrice.mockResolvedValue(ok({ groups: [] })); });

  it('N1 · a post that has ended says the server\'s own sentence — not "Couldn\'t load", and no Try again', async () => {
    const r = await open(no('NOT_FOUND', 'This post is no longer in the shop'));
    await r.findByTestId('deal-ended');
    r.getByText('This post is no longer in the shop');
    expect(r.queryByText("Couldn't load. Check your connection.")).toBeNull();
    expect(r.queryByText('Try again')).toBeNull();
    r.getByTestId('back');                                                    // the way out
  });

  it('N1 · a load that failed says so, with Try again — and trying again loads the page', async () => {
    const r = await open(OFFLINE);
    await r.findByTestId('deal-error');
    r.getByText("Couldn't load. Check your connection.");
    followerApi.deal.mockResolvedValue(ok(DEAL('pick_any', [PRODUCT('l511', "Levi's 511 Slim", 2299, SIZES)])));
    await act(async () => { fireEvent.press(r.getByText('Try again')); });
    await r.findByTestId('deal-grid');
    expect(followerApi.deal).toHaveBeenCalledTimes(2);
  });

  it('N7 · a card reads "₹999" for a product with no sizes, "1 size" for one, and counts the rest as before', async () => {
    const r = await open(ok(DEAL('pick_any', [
      PRODUCT('belt', 'Leather belt', 999, []),
      PRODUCT('stole', 'Silk stole', 1499, [{ colour: null, images: [], sizes: [SIZE('Free Size', { price: 1499, shopper_price: 1499 })] }]),
      PRODUCT('l511', "Levi's 511 Slim", 2299, SIZES),
      PRODUCT('tee', 'Henley tee', 799, [{ colour: 'Blue', images: [], sizes: [SIZE('M'), SIZE('L')] }, { colour: 'Red', images: [], sizes: [SIZE('M'), SIZE('L')] }]),
    ])));
    await r.findByTestId('deal-grid');
    const price = (id) => within(r.getByTestId(`deal-product-${id}`)).getByTestId(`deal-card-price-${id}`);
    expect(texts(price('belt'))).toEqual(['₹999']);                           // it read "₹999 · "
    expect(texts(price('stole'))).toEqual(['₹1,499 · 1 size']);               // it read "1 sizes"
    expect(texts(price('l511'))).toEqual(['₹2,299 · 3 sizes']);
    expect(texts(price('tee'))).toEqual(['₹799 · 2 colours · 2 sizes']);
    expect(CO.sizesCount(1, 0)).toBe('');
    expect(CO.sizesCount(1, 1)).toBe('1 size');
    expect(CO.sizesCount(2, 1)).toBe('2 colours · 1 size');
    expect(CO.sizesCount(3, 4)).toBe('3 colours · 4 sizes');
  });

  it('F10 · a size with its own price: the pop-up shows it once chosen, and the card shows it once picked', async () => {
    const TEE = PRODUCT('tee', 'Henley tee', 999, [{ colour: 'Blue', images: [], sizes: [SIZE('M', { price: 999, shopper_price: 999 }), SIZE('XL', { price: 1199, shopper_price: 1199 })] }]);
    const r = await open(ok(DEAL('quantity', [TEE])));
    await r.findByTestId('deal-grid');
    expect(texts(r.getByTestId('deal-card-price-tee'))).toEqual(['₹999 · 2 sizes']);      // before a size: the product's own price
    fireEvent.press(r.getByTestId('deal-product-tee'));
    await r.findByTestId('product-popup');
    expect(texts(r.getByTestId('product-popup-price'))).toEqual(['₹999']);
    fireEvent.press(r.getByTestId('product-popup-size-XL'));
    expect(texts(r.getByTestId('product-popup-price'))).toEqual(['₹1,199']);              // it stayed ₹999
    fireEvent.press(r.getByTestId('product-popup-size-M'));
    expect(texts(r.getByTestId('product-popup-price'))).toEqual(['₹999']);
    fireEvent.press(r.getByTestId('product-popup-size-XL'));
    await act(async () => { fireEvent.press(r.getByTestId('product-popup-primary')); });
    await waitFor(() => expect(followerApi.dealPrice).toHaveBeenLastCalledWith('p2', [expect.objectContaining({ product_id: 'tee', size: 'XL' })]));
    expect(texts(r.getByTestId('deal-card-price-tee'))).toEqual(['₹1,199']);
  });

  it('F10 · …and when the deal makes it cheaper, the price struck through is that size\'s, as the server priced it', async () => {
    const TEE = PRODUCT('tee', 'Henley tee', 999, [{ colour: 'Blue', images: [], sizes: [SIZE('M', { price: 999, shopper_price: 999 }), SIZE('XL', { price: 1199, shopper_price: 1199 })] }]);
    followerApi.dealPrice.mockImplementation(async (postId, lines) => ok({ groups: lines.length ? [GROUP({
      offer: { id: 'o2', type: 'volume', sub_type: 'quantity', line: 'Buy 2 → 20%' }, progress: { text: '1 item', done: true, tier: null },
      lines: lines.map((l) => PRICED(l.ref, 'Henley tee', 959, 1199, { size: l.size })) })] : [] }));
    const r = await open(ok(DEAL('quantity', [TEE])));
    await r.findByTestId('deal-grid');
    fireEvent.press(r.getByTestId('deal-product-tee'));
    fireEvent.press(r.getByTestId('product-popup-size-XL'));
    await act(async () => { fireEvent.press(r.getByTestId('product-popup-primary')); });
    await waitFor(() => expect(texts(r.getByTestId('deal-card-price-tee'))).toContain('₹959'));
    expect(texts(r.getByTestId('deal-card-price-tee'))).toContain('₹1,199');             // struck: the XL's price
    expect(texts(r.getByTestId('deal-card-price-tee'))).not.toContain('₹999');           // not the product's base price
  });

  it('F6 · a set\'s item that has sold out in every size says so, and cannot be chosen', async () => {
    const GONE = PRODUCT('kurta', 'Green kurta', 899, [{ colour: 'Green', images: [], sizes: [SIZE('M', { sold_out: true }), SIZE('L', { sold_out: true })] }], { sold_out: true, set_qty: 1 });
    const r = await open(ok(DEAL('fixed', [GONE])));
    await r.findByTestId('set-list');
    fireEvent.press(r.getByTestId('set-item-kurta'));
    await r.findByTestId('product-popup');
    expect(r.getByTestId('product-popup-sold-out').props.children).toBe('Sold out in every size');
    expect(off(r.getByTestId('product-popup-primary'))).toBe(true);
    expect(texts(r.getByTestId('product-popup-primary'))).toEqual(['Sold out']);         // it read "Choose a size", with nothing to choose
  });
});

/* ═══════════════════════════════════════════ F12 — Your deal */

describe('F12 · Your deal: removing', () => {
  const A = { ref: 'a', product_id: 'l511', colour: 'Blue', size: '32', qty: 1, role: 'buy' };
  const B = { ref: 'b', product_id: 'wr', colour: 'Blue', size: '30', qty: 1, role: 'buy' };
  const NAMES = { a: "Levi's 511 Slim", b: 'Wrangler Regular', g: 'Silver coin' };
  // The server prices what it is sent — and with no lines it sends no deal at all.
  const prices = async (postId, lines) => ok({ groups: lines.length ? [GROUP({
    lines: lines.map((l) => PRICED(l.ref, NAMES[l.ref], l.role === 'gift' ? 0 : 1500, l.role === 'gift' ? 650 : 2000, { role: l.role, size: l.size })) })] : [] });
  const review = async (lines, extra = {}) => {
    followerApi.dealPrice.mockImplementation(prices);
    const n = nav();
    const onChange = jest.fn();
    const r = render(<DealReview navigation={n} route={{ params: { postId: 'p2', lines, onChange, ...extra } }} />);
    await r.findByTestId('deal-review');
    return { ...r, n, onChange };
  };

  it('removing the only item goes back to the deal page with nothing picked — it used to spin for ever', async () => {
    const r = await review([A]);
    await act(async () => { fireEvent.press(r.getByTestId('review-remove-0')); });
    expect(r.onChange).toHaveBeenCalledTimes(1);
    expect(r.onChange).toHaveBeenCalledWith([]);                               // the deal page: nothing picked
    expect(r.n.goBack).toHaveBeenCalledTimes(1);
    expect(followerApi.dealPrice).toHaveBeenCalledTimes(1);                    // nothing left to price: the server is not asked
    expect(await bagNow()).toEqual([]);
  });

  it('removing one of two: the review shows what is left, and the deal page is handed the same', async () => {
    const r = await review([A, B]);
    r.getByText(/Levi's 511 Slim/); r.getByText(/Wrangler Regular/);
    await act(async () => { fireEvent.press(r.getByTestId('review-remove-0')); });
    expect(r.onChange).toHaveBeenCalledWith([B]);
    await waitFor(() => expect(r.queryByText(/Levi's 511 Slim/)).toBeNull());
    r.getByText(/Wrangler Regular/);
    expect(followerApi.dealPrice).toHaveBeenLastCalledWith('p2', [expect.objectContaining({ ref: 'b', product_id: 'wr' })]);
    expect(r.n.goBack).not.toHaveBeenCalled();
  });

  it('a pair goes together; and with no item left a gift is not left behind on its own', async () => {
    const PAIR = [{ ...A, ref: 'x1a', pair: 'x1' }, { ...A, ref: 'x1b', pair: 'x1', role: 'free', size: '30' }];
    const pair = await review(PAIR);
    await act(async () => { fireEvent.press(pair.getByTestId('review-remove-0')); });
    expect(pair.onChange).toHaveBeenCalledWith([]);
    expect(pair.n.goBack).toHaveBeenCalledTimes(1);
    pair.unmount();

    const gift = await review([A, { ref: 'g', gift_item_id: 'coin', product_id: null, colour: null, size: null, qty: 1, role: 'gift' }]);
    gift.getByText('Free gift: Silver coin');
    await act(async () => { fireEvent.press(gift.getByTestId('review-remove-0')); });
    expect(gift.onChange).toHaveBeenCalledWith([]);
    expect(gift.n.goBack).toHaveBeenCalledTimes(1);
  });

  it('opened with nothing to review (it cannot be, from the deal page): back at once, never a spinner for ever', async () => {
    followerApi.dealPrice.mockImplementation(prices);
    const n = nav();
    render(<DealReview navigation={n} route={{ params: { postId: 'p2', lines: [] } }} />);
    await waitFor(() => expect(n.goBack).toHaveBeenCalledTimes(1));
    expect(followerApi.dealPrice).not.toHaveBeenCalled();
  });

  it('a price that could not be fetched says so, with Try again', async () => {
    followerApi.dealPrice.mockResolvedValue(OFFLINE);
    const r = render(<DealReview navigation={nav()} route={{ params: { postId: 'p2', lines: [A] } }} />);
    await r.findByTestId('deal-review-error');
    r.getByText("Couldn't load. Check your connection.");
    followerApi.dealPrice.mockImplementation(prices);
    await act(async () => { fireEvent.press(r.getByText('Try again')); });
    await r.findByTestId('deal-review');
  });

  it('the deal page keeps what the review hands back: the removed item is not picked there any more', async () => {
    followerApi.deal.mockResolvedValue(ok(DEAL('pick_any', [PRODUCT('l511', "Levi's 511 Slim", 2299, SIZES), PRODUCT('wr', 'Wrangler Regular', 1999, SIZES)])));
    followerApi.dealPrice.mockImplementation(prices);
    const n = nav();
    const r = render(<Deal navigation={n} route={{ params: { postId: 'p2', lines: [A, B], editing: true } }} />);
    await r.findByTestId('deal-grid');
    await waitFor(() => r.getByText('✓ In set · 32'));
    r.getByText('✓ In set · 30');
    await waitFor(() => expect(off(r.getByTestId('sticky-button'))).toBe(false));
    fireEvent.press(r.getByTestId('sticky-button'));
    const [route, params] = n.navigate.mock.calls[0];
    expect(route).toBe('DealReview');
    expect(params).toEqual(expect.objectContaining({ postId: 'p2', editing: true, onChange: expect.any(Function) }));
    expect(params.lines.map((l) => l.ref)).toEqual(['a', 'b']);

    // On the review she removes the Levi's: the review hands back what is left.
    await act(async () => { params.onChange(params.lines.filter((l) => l.ref !== 'a')); });
    await waitFor(() => expect(followerApi.dealPrice).toHaveBeenLastCalledWith('p2', [expect.objectContaining({ ref: 'b', product_id: 'wr' })]));
    expect(r.queryByText('✓ In set · 32')).toBeNull();                         // it used to still be picked here
    r.getByText('✓ In set · 30');
    expect(within(r.getByTestId('deal-product-l511')).getByText('Tap to choose')).toBeTruthy();

    // …and then the last one: nothing picked.
    await act(async () => { params.onChange([]); });
    await waitFor(() => r.getByText('Nothing picked yet'));
    expect(r.queryByText('✓ In set · 30')).toBeNull();
    r.getByText('0 items');
    expect(off(r.getByTestId('sticky-button'))).toBe(true);
  });
});

/* ═══════════════════════════════════════════ F9 · N6 · F10 — the bag */

describe('the bag', () => {
  const line = (ref, product_id, extra = {}) => ({ ref, post_id: 'p-x', product_id, gift_item_id: null, colour: 'Blue', size: 'M', qty: 1, role: 'buy', ticked: true, price_seen: null, ...extra });
  const GIFT_OFFER = { id: 'o-g', type: 'free_gift', sub_type: 'spend', line: 'Spend ₹500 · 1 gift of 2' };
  const bagPriced = (groups) => ok({ groups, unticked: [], items_normal: groups.reduce((s, g) => s + g.normal_total, 0), savings: groups.reduce((s, g) => s + g.savings, 0),
    items_total: groups.reduce((s, g) => s + g.paid_total, 0), buyable: groups.every((g) => g.buyable) });
  const openBag = async () => {
    const n = nav();
    const r = render(<Bag navigation={n} />);
    return { ...r, n };
  };

  it('F9 · her bag could not be read: "Couldn\'t load your bag" with Try again — not "Your bag is empty"; nothing is written', async () => {
    await signedIn();
    followerApi.getBag.mockResolvedValue(OFFLINE);
    const r = await openBag();
    await r.findByTestId('bag-load-failed');
    r.getByText("Couldn't load your bag");
    r.getByText('Bag');                                                       // not "Bag · 0 items"
    expect(r.queryByText('Your bag is empty')).toBeNull();
    expect(r.queryByTestId('bag-empty')).toBeNull();
    expect(followerApi.putBag).not.toHaveBeenCalled();
    expect(followerApi.bagPrice).not.toHaveBeenCalled();

    followerApi.getBag.mockResolvedValue(ok({ lines: [{ id: 'd1', ...line('d1', 'polo') }] }));
    followerApi.bagPrice.mockResolvedValue(bagPriced([GROUP({ post_id: 'p-x', offer: null, progress: null, normal_total: 899, paid_total: 899, savings: 0,
      lines: [PRICED('d1', 'Blue polo', 899, 899, { size: 'M' })] })]));
    await act(async () => { fireEvent.press(r.getByText('Try again')); });
    await r.findByTestId('bag-line-d1');
    r.getByText('Bag · 1 item');
    expect(followerApi.putBag).not.toHaveBeenCalled();
  });

  it('F9 · a bag that really is empty still says so', async () => {
    await signedIn();
    followerApi.getBag.mockResolvedValue(ok({ lines: [] }));
    const r = await openBag();
    await r.findByTestId('bag-empty');
    r.getByText('Your bag is empty');
    expect(r.queryByTestId('bag-load-failed')).toBeNull();
  });

  it('N6 · the gift she chose shows once — its own row, marked "Free gift" — and can be removed', async () => {
    await AsyncStorage.setItem('inflx_bag_v1', JSON.stringify([line('d1', 'polo'), line('g1', null, { gift_item_id: 'coin', colour: null, size: null, role: 'gift' })]));
    followerApi.bagPrice.mockResolvedValue(bagPriced([GROUP({ post_id: 'p-x', offer: GIFT_OFFER, progress: { text: 'Gift unlocked', done: true }, gift: { state: 'chosen', count: 1, available: 2 },
      normal_total: 899, paid_total: 899, savings: 0, gift_value: 650,
      lines: [PRICED('d1', 'Blue polo', 899, 899, { size: 'M', deal_key: 'gift-deal' }),
        PRICED('g1', 'Silver coin', 0, 650, { role: 'gift', gift_item_id: 'coin', colour: null, size: null, deal_key: 'gift' })] })]));
    const r = await openBag();
    await r.findByTestId('bag-line-g1');
    expect(r.getAllByText(/Silver coin/)).toHaveLength(1);                     // it was said twice: a row and a green line
    expect(texts(r.getByTestId('bag-line-g1'))).toEqual(expect.arrayContaining(['Free gift: Silver coin', '₹0', '  ₹650', 'Remove']));
    expect(r.queryByTestId('bag-gift-p-x-0')).toBeNull();
    expect(r.queryByText('Delivery')).toBeNull();                              // "Delivery · Free" was written into the app
    expect(texts(r.getByTestId('bag'))).not.toContain('Free');
    expect(r.getByTestId('money-total').props.children).toBe('₹899');          // the server's total, as sent
    r.getByText('Continue · ₹899');
  });

  it('N6 · a gift added by itself (it is in no bag line) is said once too — as the green line', async () => {
    await AsyncStorage.setItem('inflx_bag_v1', JSON.stringify([line('d1', 'polo')]));
    followerApi.bagPrice.mockResolvedValue(bagPriced([GROUP({ post_id: 'p-x', offer: GIFT_OFFER, progress: { text: 'Gift unlocked', done: true }, gift: { state: 'chosen', count: 1, available: 1 },
      normal_total: 899, paid_total: 899, savings: 0, gift_value: 650,
      lines: [PRICED('d1', 'Blue polo', 899, 899, { size: 'M', deal_key: 'gift-deal' }),
        PRICED('auto-gift', 'Silver coin', 0, 650, { role: 'gift', gift_item_id: 'coin', colour: null, size: null, deal_key: 'gift', auto: true })] })]));
    const r = await openBag();
    await r.findByTestId('bag-line-d1');
    expect(r.getAllByText(/Silver coin/)).toHaveLength(1);
    expect(texts(r.getByTestId('bag-gift-p-x-0'))).toEqual(['Free gift: Silver coin · ₹0 · worth ₹650']);
    expect(r.queryByTestId('bag-line-auto-gift')).toBeNull();
  });

  it('F10 · changing to a size with its own price shows that price and records it — no false "Price changed"', async () => {
    const POLO = PRODUCT('polo', 'Blue polo', 999, [{ colour: 'Blue', images: [], sizes: [SIZE('M', { price: 999, shopper_price: 799 }), SIZE('XL', { price: 1199, shopper_price: 959 })] }], { shopper_price: 799, in_deal: false });
    await AsyncStorage.setItem('inflx_bag_v1', JSON.stringify([line('d1', 'polo', { price_seen: 999 })]));
    followerApi.bagPrice.mockResolvedValue(bagPriced([GROUP({ post_id: 'p-x', offer: { id: 'o', type: 'discount', sub_type: 'percentage', line: '20% off each item' }, progress: null,
      normal_total: 999, paid_total: 799, savings: 200, lines: [PRICED('d1', 'Blue polo', 799, 999, { size: 'M' })] })]));
    followerApi.deal.mockResolvedValue(ok({ ...DEAL('quantity', [POLO]), deal_page: false, offer: { id: 'o', type: 'discount', sub_type: 'percentage', line: '20% off each item' } }));
    const r = await openBag();
    await r.findByTestId('change-d1');
    await act(async () => { fireEvent.press(r.getByTestId('change-d1')); });
    await r.findByTestId('bag-change');
    expect(texts(r.getByTestId('bag-change-price'))).toEqual(['₹799', '  ₹999']);          // the size she has: M
    fireEvent.press(r.getByTestId('bag-change-size-XL'));
    expect(texts(r.getByTestId('bag-change-price'))).toEqual(['₹959', '  ₹1,199']);        // what she pays for XL, as the server sent it
    await act(async () => { fireEvent.press(r.getByTestId('bag-change-primary')); });
    expect((await bagNow()).map((l) => [l.ref, l.size, l.price_seen])).toEqual([['d1', 'XL', 1199]]);   // it kept 999: "Price changed from ₹999"
    expect(followerApi.bagPrice).toHaveBeenLastCalledWith([expect.objectContaining({ ref: 'd1', size: 'XL', price_seen: 1199 })]);
  });
});

/* ═══════════════════════════════════════════ N4 · N5 — My orders */

describe('My orders', () => {
  const ROW = (extra) => ({ id: 'l1', name: 'Wrangler Regular', colour: 'Blue', size: '32', qty: 1, paid: 1395, role: 'buy', status: 'confirmed', status_word: 'Confirmed',
    arrives_by: '2026-10-08', brand: { name: 'Urban Threads' }, return: null, ...extra });
  const rows = (from, n, extra = {}) => Array.from({ length: n }).map((_, i) => ROW({ id: `l${from + i}`, ...extra }));
  const shown = (list) => list.UNSAFE_getByType(FlatList).props.data.map((x) => x.id);
  const ids = (from, n) => Array.from({ length: n }).map((_, i) => `l${from + i}`);

  it('N4 · Packed and Out for delivery are filters, in the order a parcel moves; Returned is still there', async () => {
    expect([...CO.filters, CR.filter].map(([k, label]) => `${k}:${label}`)).toEqual([
      ':All', 'confirmed:Confirmed', 'packed:Packed', 'dispatched:Shipped', 'out_for_delivery:Out for delivery', 'delivered:Delivered', 'cancelled:Cancelled', 'returned:Returned']);
    followerApi.orders.mockResolvedValue(ok({ items: rows(1, 2), more: false }));
    const list = render(<OrdersScreen navigation={nav()} />);
    await list.findByTestId('order-l1');
    fireEvent.press(list.getByTestId('orders-filter-packed'));
    await waitFor(() => expect(followerApi.orders).toHaveBeenLastCalledWith({ status: 'packed', q: undefined }));
    fireEvent.press(list.getByTestId('orders-filter-out_for_delivery'));
    await waitFor(() => expect(followerApi.orders).toHaveBeenLastCalledWith({ status: 'out_for_delivery', q: undefined }));
    list.getByTestId('orders-filter-returned');
  });

  it('N4 · "No orders yet" only when she has none; a filter or a search with no match says "Nothing matches" and what did not', async () => {
    followerApi.orders.mockResolvedValue(ok({ items: [], more: false }));
    const list = render(<OrdersScreen navigation={nav()} />);
    await list.findByTestId('orders-empty');
    list.getByText('No orders yet');
    expect(list.queryByText('Nothing matches')).toBeNull();

    fireEvent.press(list.getByTestId('orders-filter-packed'));
    await list.findByTestId('orders-no-match');
    list.getByText('Nothing matches');
    list.getByText('You have no orders under “Packed”.');
    expect(list.queryByText('No orders yet')).toBeNull();                     // it said this, with orders on the way

    fireEvent.changeText(list.getByTestId('orders-search'), 'saree');
    await waitFor(() => list.getByText('No order under “Packed” matches “saree”.'));
    expect(followerApi.orders).toHaveBeenLastCalledWith({ status: 'packed', q: 'saree' });

    fireEvent.press(list.getByTestId('orders-filter-all'));
    await waitFor(() => list.getByText('No order matches “saree”.'));
    list.getByText('Nothing matches');
    expect(list.queryByText('No orders yet')).toBeNull();

    fireEvent.changeText(list.getByTestId('orders-search'), '');
    await list.findByTestId('orders-empty');
  });

  it('N4 · orders that could not be read are not "No orders yet": Try again', async () => {
    followerApi.orders.mockResolvedValue(OFFLINE);
    const list = render(<OrdersScreen navigation={nav()} />);
    await list.findByTestId('orders-error');
    list.getByText("Couldn't load. Check your connection.");
    expect(list.queryByText('No orders yet')).toBeNull();
    followerApi.orders.mockResolvedValue(ok({ items: rows(1, 1), more: false }));
    await act(async () => { fireEvent.press(list.getByText('Try again')); });
    await list.findByTestId('order-l1');
  });

  it('N5 · the next 20 load when she reaches the end, and it stops asking when there are no more', async () => {
    // page 2 repeats l20: an order placed meanwhile pushed it down a page — it is not shown twice
    followerApi.orders.mockImplementation(async ({ page }) => (page === 2 ? ok({ items: rows(20, 6), more: false }) : ok({ items: rows(1, 20), more: true })));
    const list = render(<OrdersScreen navigation={nav()} />);
    await list.findByTestId('orders-list');
    expect(followerApi.orders).toHaveBeenCalledTimes(1);
    expect(followerApi.orders).toHaveBeenLastCalledWith({ status: undefined, q: undefined });
    expect(shown(list)).toEqual(ids(1, 20));                                  // it stopped here
    await act(async () => { fireEvent(list.getByTestId('orders-list'), 'endReached'); });
    expect(followerApi.orders).toHaveBeenLastCalledWith({ status: undefined, q: undefined, page: 2 });
    expect(shown(list)).toEqual(ids(1, 25));
    await act(async () => { fireEvent(list.getByTestId('orders-list'), 'endReached'); });
    expect(followerApi.orders).toHaveBeenCalledTimes(2);                      // no more: not asked again
  });

  it('N5 · a filter pages too, and changing the filter starts again from its first page', async () => {
    followerApi.orders.mockImplementation(async ({ status, page }) => (status === 'delivered'
      ? (page === 2 ? ok({ items: rows(121, 3, { status: 'delivered', status_word: 'Delivered' }), more: false }) : ok({ items: rows(101, 20, { status: 'delivered', status_word: 'Delivered' }), more: true }))
      : ok({ items: rows(1, 20), more: true })));
    const list = render(<OrdersScreen navigation={nav()} />);
    await list.findByTestId('orders-list');
    fireEvent.press(list.getByTestId('orders-filter-delivered'));
    await waitFor(() => expect(shown(list)).toEqual(ids(101, 20)));
    await act(async () => { fireEvent(list.getByTestId('orders-list'), 'endReached'); });
    expect(followerApi.orders).toHaveBeenLastCalledWith({ status: 'delivered', q: undefined, page: 2 });
    expect(shown(list)).toEqual(ids(101, 23));
    fireEvent.press(list.getByTestId('orders-filter-all'));
    await waitFor(() => expect(shown(list)).toEqual(ids(1, 20)));
    expect(followerApi.orders).toHaveBeenLastCalledWith({ status: undefined, q: undefined });
  });

  it('N5 · a next page that could not be read keeps what she has, and can be asked for again', async () => {
    let broken = true;
    followerApi.orders.mockImplementation(async ({ page }) => (page === 2 ? (broken ? OFFLINE : ok({ items: rows(21, 2), more: false })) : ok({ items: rows(1, 20), more: true })));
    const list = render(<OrdersScreen navigation={nav()} />);
    await list.findByTestId('orders-list');
    await act(async () => { fireEvent(list.getByTestId('orders-list'), 'endReached'); });
    expect(shown(list)).toEqual(ids(1, 20));
    list.getByTestId('orders-more-retry');
    expect(list.queryByText('No orders yet')).toBeNull();
    broken = false;
    await act(async () => { fireEvent.press(list.getByTestId('orders-more-retry')); });
    expect(shown(list)).toEqual(ids(1, 22));
    expect(list.queryByTestId('orders-more-retry')).toBeNull();
  });

  it('N5 · coming back from an item reads again every page she had — she is where she was, with the item\'s new status', async () => {
    let cancelled = false;
    followerApi.orders.mockImplementation(async ({ page }) => (page === 2
      ? ok({ items: rows(21, 5, cancelled ? { status: 'cancelled', status_word: 'Cancelled' } : {}), more: false })
      : ok({ items: rows(1, 20), more: true })));
    const list = render(<OrdersScreen navigation={nav()} />);
    await list.findByTestId('orders-list');
    await act(async () => { fireEvent(list.getByTestId('orders-list'), 'endReached'); });
    expect(shown(list)).toEqual(ids(1, 25));
    followerApi.orders.mockClear();
    cancelled = true;                                                         // she cancelled l21 on its own screen
    await act(async () => { mockFocus.again(); });                            // …and came back
    await waitFor(() => expect(followerApi.orders).toHaveBeenCalledTimes(2));
    expect(followerApi.orders.mock.calls.map(([a]) => a.page)).toEqual([undefined, 2]);
    await waitFor(() => expect(list.UNSAFE_getByType(FlatList).props.data.find((x) => x.id === 'l21').status_word).toBe('Cancelled'));
    expect(shown(list)).toEqual(ids(1, 25));                                  // not cut back to the first 20
  });
});

/* ═══════════════════════════════════════════ N3 — Order details */

describe('N3 · Order details: cash on delivery is paid when it is delivered', () => {
  const LINE = (extra = {}) => ({
    id: 'l1', name: 'Wrangler Regular', colour: 'Blue', size: '32', qty: 1, paid: 1395, role: 'buy',
    status: 'dispatched', status_word: 'Shipped', brand: { name: 'Urban Threads' }, creator: { id: 'c', name: 'Sneha' },
    can_cancel: false, can_return: false, return_until: null, return_closed: null, return: null, payment_method: 'cod',
    timeline: [{ status: 'confirmed', word: 'Confirmed', at: '2026-10-01T10:00:00Z' }, { status: 'packed', word: 'Packed', at: '2026-10-02T10:00:00Z' },
      { status: 'dispatched', word: 'Shipped', at: '2026-10-03T10:00:00Z' }, { status: 'out_for_delivery', word: 'Out for delivery', at: null }, { status: 'delivered', word: 'Delivered', at: null }],
    address: { name: 'Anusha K', house: 'Flat 4B', city: 'Hyderabad', pincode: '500034' }, post: null, refund: null, ...extra,
  });
  const DELIVERED = { status: 'delivered', status_word: 'Delivered',
    timeline: [{ status: 'confirmed', word: 'Confirmed', at: '2026-10-01T10:00:00Z' }, { status: 'delivered', word: 'Delivered', at: '2026-10-04T10:00:00Z' }] };
  const money = async (line) => {
    followerApi.orderLine.mockResolvedValue(ok(line));
    const d = render(<OrderDetailScreen navigation={nav()} route={{ params: { lineId: 'l1' } }} />);
    await d.findByTestId('order-detail');
    const said = d.getByTestId('order-money').props.children;
    d.unmount();
    return said;
  };

  it('until it is delivered: "To pay ₹1,395 on delivery" — it read "Paid ₹1,395 · Cash on delivery" before she had paid', async () => {
    expect(await money(LINE())).toBe('To pay ₹1,395 on delivery');
    expect(await money(LINE({ status: 'confirmed', status_word: 'Confirmed' }))).toBe('To pay ₹1,395 on delivery');
    expect(await money(LINE({ status: 'out_for_delivery', status_word: 'Out for delivery' }))).toBe('To pay ₹1,395 on delivery');
  });

  it('once delivered: "Paid ₹1,395 · Cash on delivery" — and it stays so when the item is later returned', async () => {
    expect(await money(LINE(DELIVERED))).toBe('Paid ₹1,395 · Cash on delivery');
    expect(await money(LINE({ ...DELIVERED, status: 'returned', status_word: 'Returned' }))).toBe('Paid ₹1,395 · Cash on delivery');
  });

  it('paid online reads as it always did, delivered or not', async () => {
    expect(await money(LINE({ payment_method: 'online' }))).toBe('Paid ₹1,395 · UPI, cards, net banking');
    expect(await money(LINE({ ...DELIVERED, payment_method: 'online' }))).toBe('Paid ₹1,395 · UPI, cards, net banking');
  });

  it('cancelled before it was delivered: neither paid nor owed — the price and the method; a free gift is ₹0 as before', () => {
    const cancelled = LINE({ status: 'cancelled', status_word: 'Cancelled', timeline: [{ status: 'confirmed', word: 'Confirmed', at: '2026-10-01T10:00:00Z' }, { status: 'cancelled', word: 'Cancelled', at: '2026-10-02T10:00:00Z' }] });
    expect(moneyLine(cancelled)).toBe('₹1,395 · Cash on delivery');
    expect(moneyLine(LINE({ role: 'gift', paid: 0 }))).toBe('Paid ₹0 · Cash on delivery');
    expect(moneyLine(LINE({ role: 'gift', paid: 0, payment_method: 'online' }))).toBe('Paid ₹0 · UPI, cards, net banking');
  });
});
