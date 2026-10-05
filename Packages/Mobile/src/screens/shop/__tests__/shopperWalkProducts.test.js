/**
 * shopper-walk-fixes — products in a post and adding to the bag (board S1–S6), with the founder's
 * own posts on it: Akshaya Reddy, Aveen fashion boutique and desiner studio.
 *
 *   O1  "Build your deal" never shows on a discount or price post — not even before the deal data
 *       has arrived (it used to flash for about two seconds)
 *   O2  "Products in this post": a grid of three; the bag icon is the quick add; the photo opens
 *       the product page
 *   O3  the product page: the listing's details in a fixed order, empty rows left out, and the
 *       bottom bar of a discount post (Buy now · Add to bag) or a deal post (Build your deal)
 *   O6  Add to bag → one short vibration → "Go to bag ›" for about a second → back where she was,
 *       with nothing left open; timers never outlive the screen; Buy now unchanged
 *
 * Contract: features/shopper-walk-fixes · BUILD_API.md
 */
import React from 'react';
import { Vibration, StyleSheet, Modal } from 'react-native';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import fs from 'fs';
import path from 'path';

let mockNav = null;
jest.mock('../../../services/api', () => ({
  followerApi: {
    deal: jest.fn(), dealPrice: jest.fn(), bagPrice: jest.fn(), getBag: jest.fn(), putBag: jest.fn(), mergeBag: jest.fn(),
    saveProduct: jest.fn(), unsaveProduct: jest.fn(), postEvents: jest.fn(() => Promise.resolve({ success: true })),
  },
  setDeviceHeader: jest.fn(), clearSession: jest.fn(() => Promise.resolve()),
}));
jest.mock('../../../services/events', () => ({ track: jest.fn(), flush: jest.fn() }));
jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (cb) => { const React = require('react'); React.useEffect(() => cb(), [cb]); },
  useNavigation: () => mockNav,
}));

const { followerApi } = require('../../../services/api');
const { track } = require('../../../services/events');
const { shopStore } = require('../../../components/shop/shopStore');
const { ShopSheet, isDealPost } = require('../../../components/shop/bitsShop');
const { BagButton, detailRows, ADDED_MS } = require('../../../components/shop/orderBits');
const { addToBag } = require('../../../components/shop/bag');
const Product = require('../ProductScreen').default;

/** A screen's navigation, with a way to press the phone's own Back (`beforeRemove`). */
function nav() {
  const listeners = {};
  return {
    goBack: jest.fn(), navigate: jest.fn(), replace: jest.fn(), pop: jest.fn(), isFocused: jest.fn(() => true),
    addListener: jest.fn((name, fn) => { (listeners[name] = listeners[name] || []).push(fn); return () => { listeners[name] = listeners[name].filter((x) => x !== fn); }; }),
    emit: (name, e) => (listeners[name] || []).forEach((fn) => fn(e)),
  };
}
const ok = (data) => ({ success: true, data });
const bagNow = async () => JSON.parse(await AsyncStorage.getItem('inflx_bag_v1')) || [];
/** The crossed-out prices under a node (a normal price the offer has lowered). */
const struckIn = (node) => node.findAll((n) => n.type === 'Text' && StyleSheet.flatten(n.props.style || {}).textDecorationLine === 'line-through')
  .map((n) => [].concat(n.props.children).join('').trim());
const texts = (node) => node.findAll((n) => typeof n.type === 'string' && n.type === 'Text').map((n) => [].concat(n.props.children).filter((c) => typeof c === 'string' || typeof c === 'number').join(''));

/** A page as the screens hold the sheet: its post is set to none when the sheet closes. */
function Host({ post, onClose, surface = 'home' }) {
  const [shown, setShown] = React.useState(post);
  return <ShopSheet post={shown} visible={!!shown} onClose={() => { onClose(); setShown(null); }} surface={surface} />;
}

const AKSHAYA = { id: 'c1', name: 'Akshaya Reddy' };
const AVEEN = { id: 'b1', name: 'Aveen fashion boutique and desiner studio' };

/* A plain discount post: "This is one shoppqble poat", 20% off. */
const DISCOUNT_POST = (over = {}) => ({
  id: 'p-disc', code: 'P4KGMB', title: 'This is one shoppqble poat', creator: AKSHAYA, brand: AVEEN, media_kind: 'video', media: [],
  offer: { id: 'o1', type: 'Discount', kind: 'discount', sub_type: 'percentage', badge: '20% OFF', line: '20% off applied', deal: '20% off each item', ends_on: '2026-10-31',
    how: 'Every product in this post is 20% off (at most ₹400 off an item).' },
  deal_page: false, gift_line: null,
  products: [
    { id: 'polo', name: 'Blue polo', image_url: 'https://x/polo.jpg', price: 899, shopper_price: 719, struck: true, in_stock: true },
    { id: 'casio', name: 'Casio vintage', image_url: 'https://x/casio.jpg', price: 3500, shopper_price: 2800, struck: true, in_stock: true },
    { id: 'tee', name: 'Classic Cotton Crew T-Shirt', image_url: null, price: 599, shopper_price: 479, struck: true, in_stock: false },
  ],
  mine: { saved_products: [] },
  ...over,
});
const POLO = (over = {}) => ({
  id: 'polo', name: 'Blue polo', price: 899, shopper_price: 719, image_url: 'https://x/polo.jpg',
  images: ['https://x/polo.jpg', 'https://x/polo-2.jpg', 'https://x/polo-3.jpg'], in_deal: false, category: { id: 'l1', name: 'Topwear' }, sold_out: false,
  colours: [
    { colour: 'Blue', images: [], sizes: [{ size: 'M', left: null, sold_out: false }, { size: 'L', left: 2, sold_out: false }, { size: 'XL', left: null, sold_out: true }] },
    { colour: 'Navy', images: ['https://x/polo-navy.jpg'], sizes: [{ size: 'M', left: null, sold_out: false }] },
  ],
  details: 'blue cotton polo t shirt', size_chart: null, set_qty: null,
  brand_label: 'Park Avenue', category_path: 'Men › Topwear', specs: [],
  ...over,
});
const DISCOUNT_DATA = (over = {}) => ({
  post: { id: 'p-disc', code: 'P4KGMB', title: 'This is one shoppqble poat', creator: AKSHAYA, brand: AVEEN },
  offer: { id: 'o1', type: 'discount', sub_type: 'percentage', config: { pct: 20 }, ends_on: '2026-10-31', line: '20% off each item',
    how: 'Every product in this post is 20% off (at most ₹400 off an item).', badge: '20% OFF' },
  deal_page: false,
  returns: { hours: 168, words: '7 days', line: 'Within 7 days of delivery' },
  products: [POLO(),
    { id: 'casio', name: 'Casio vintage', price: 3500, shopper_price: 2800, image_url: 'https://x/casio.jpg', images: ['https://x/casio.jpg'], in_deal: false, category: null, sold_out: false,
      colours: [], details: null, size_chart: null, set_qty: null, brand_label: null, category_path: null, specs: [] },
    { id: 'tee', name: 'Classic Cotton Crew T-Shirt', price: 599, shopper_price: 479, image_url: null, images: [], in_deal: false, category: null, sold_out: true,
      colours: [{ colour: null, images: [], sizes: [{ size: 'M', left: 0, sold_out: true }] }], details: null, size_chart: null, set_qty: null, brand_label: null, category_path: null, specs: [] }],
  gifts: [], categories: [],
  ...over,
});

/* A deal post: buy more, save more on the Premium Polo (board S4), and the BOGO post (board S2). */
const TIERS = 'Buy 1 → 10% · Buy 2 → 20% · Buy 3 → 30%';
const PREMIUM = (over = {}) => ({
  id: 'prem', name: 'Premium Polo T-Shirt', price: 899, shopper_price: 899, image_url: 'https://x/prem.jpg', images: ['https://x/prem.jpg'], in_deal: true,
  category: { id: 'l1', name: 'Topwear' }, sold_out: false,
  colours: ['Navy', 'Black', 'White', 'Maroon'].map((c) => ({ colour: c, images: [], sizes: [{ size: 'M', left: null, sold_out: false }] })),
  details: 'Smart cotton-blend polo designed for casual business and weekend wear.', size_chart: 'https://x/chart.png', set_qty: null,
  brand_label: 'ExecutiveWear', category_path: 'Men › Topwear',
  specs: [{ key: 'fit', label: 'Fit', value: 'Slim' }, { key: 'neck', label: 'Neck', value: 'Polo' }, { key: 'sleeve', label: 'Sleeve', value: 'Half' },
    { key: 'care', label: 'Care', value: 'Machine wash' }, { key: 'unisex', label: 'Unisex', value: 'Yes' }],
  ...over,
});
const DEAL_DATA = (over = {}) => ({
  post: { id: 'p-deal', code: 'SHNCZW', title: 'This good offer', creator: AKSHAYA, brand: AVEEN },
  offer: { id: 'o2', type: 'volume', sub_type: 'quantity', config: { tiers: [{ at: 1, value: 10 }, { at: 2, value: 20 }, { at: 3, value: 30 }] }, ends_on: '2026-10-31', line: TIERS,
    how: 'The more you buy from this post, the more you save: buy 1 → 10% off, buy 2 → 20% off, buy 3 → 30% off. Only the highest one applies.', badge: 'BUY 1 → 10%' },
  deal_page: true,
  returns: { hours: 168, words: '7 days', line: 'Within 7 days of delivery' },
  products: [PREMIUM()], gifts: [], categories: [],
  ...over,
});
const BOGO_POST = (over = {}) => ({
  id: 'p-bogo', code: 'JD54B4', title: 'This is for BOGI', creator: AKSHAYA, brand: AVEEN, media_kind: 'video', media: [],
  offer: { id: 'o3', type: 'BOGO', kind: 'bogo', sub_type: 'bogo', badge: 'BUY 1 GET 1', line: 'Buy one, get the same product free', ends_on: '2026-10-31',
    how: 'Buy any product in this post and get the same one free, in any size or colour.' },
  deal_page: true, gift_line: null,
  products: [
    { id: 'heels', name: 'heels', image_url: 'https://x/heels.jpg', price: 4599, shopper_price: 4599, struck: false, in_stock: true },
    { id: 'bag', name: 'red leather bag for women', image_url: 'https://x/bag.jpg', price: 3999, shopper_price: 3999, struck: false, in_stock: true },
  ],
  mine: { saved_products: [] },
  ...over,
});

beforeEach(async () => {
  jest.clearAllMocks();
  mockNav = null;
  await AsyncStorage.clear();
  shopStore._reset();
  await act(async () => { await require('../../../components/shop/bag').saveBag([]); });      // the count starts at 0
});
afterEach(() => { jest.useRealTimers(); });

/* ═══════════════════════════════════════════ O1 */

describe('O1 · "Build your deal" never shows on a discount or price post', () => {
  it('a discount post (deal_page: false): not shown while the deal data is still on its way, nor after it arrives', async () => {
    let arrive;
    followerApi.deal.mockReturnValue(new Promise((resolve) => { arrive = resolve; }));
    const { queryByTestId, queryByText, getByTestId, findByTestId } = render(<ShopSheet post={DISCOUNT_POST()} visible onClose={jest.fn()} surface="home" />);
    await findByTestId('shop-sheet');
    // the two seconds in which it used to flash
    expect(queryByTestId('build-deal')).toBeNull();
    expect(queryByText('Build your deal')).toBeNull();
    expect(queryByTestId('deal-intro')).toBeNull();
    await act(async () => { arrive(ok(DISCOUNT_DATA())); });
    expect(queryByTestId('build-deal')).toBeNull();
    expect(queryByText('Build your deal')).toBeNull();
    getByTestId('shop-add-polo');                                   // it is a quick-add post
  });

  it('an older server answer (no deal_page, no kind — only the display name "Discount"): still not a deal', async () => {
    followerApi.deal.mockReturnValue(new Promise(() => {}));
    const old = DISCOUNT_POST({ deal_page: undefined, offer: { id: 'o1', type: 'Discount', line: '20% off applied' } });
    const { queryByTestId, findByTestId } = render(<ShopSheet post={old} visible onClose={jest.fn()} surface="home" />);
    await findByTestId('shop-sheet');
    expect(queryByTestId('build-deal')).toBeNull();                 // `type !== 'discount'` was true for "Discount": the old flash
  });

  it('a price post with no offer at all: not a deal', async () => {
    followerApi.deal.mockReturnValue(new Promise(() => {}));
    const { queryByTestId, findByTestId } = render(<ShopSheet post={DISCOUNT_POST({ offer: null })} visible onClose={jest.fn()} surface="home" />);
    await findByTestId('shop-sheet');
    expect(queryByTestId('build-deal')).toBeNull();
  });

  it('a deal post (deal_page: true): there from the first moment, without waiting for the deal data', async () => {
    followerApi.deal.mockReturnValue(new Promise(() => {}));
    const { getByTestId, findByTestId } = render(<ShopSheet post={BOGO_POST()} visible onClose={jest.fn()} surface="home" />);
    await findByTestId('shop-sheet');
    getByTestId('build-deal');
  });

  it('once the deal data has arrived, it is the one that says', async () => {
    followerApi.deal.mockResolvedValue(ok(DISCOUNT_DATA({ deal_page: false })));
    // the card said "deal", the deal data says it is not one (the offer ended meanwhile)
    const { queryByTestId, findByTestId } = render(<ShopSheet post={BOGO_POST()} visible onClose={jest.fn()} surface="home" />);
    await findByTestId('shop-sheet');
    await waitFor(() => expect(queryByTestId('build-deal')).toBeNull());
  });

  it('isDealPost: the server\'s word, then the fallback of BUILD_API — never the display name', () => {
    expect(isDealPost({ deal_page: false, offer: { type: 'BOGO', kind: 'bogo' } })).toBe(false);
    expect(isDealPost({ deal_page: true, offer: { type: 'Discount', kind: 'discount' } })).toBe(true);
    expect(isDealPost({ offer: { type: 'Discount' } })).toBe(false);
    expect(isDealPost({ offer: { type: 'BOGO' } })).toBe(false);                        // no kind: NOT a deal unless told so
    expect(isDealPost({ offer: { type: 'Discount', kind: 'discount' } })).toBe(false);
    for (const kind of ['bogo', 'volume', 'bundle', 'free_gift']) expect(isDealPost({ offer: { kind } })).toBe(true);
    expect(isDealPost({ offer: null })).toBe(false);
    expect(isDealPost(null)).toBe(false);
    expect(isDealPost({ deal_page: false }, { deal_page: true })).toBe(true);
    expect(isDealPost({ deal_page: true }, { deal_page: false })).toBe(false);
  });
});

/* ═══════════════════════════════════════════ O2 */

describe('O2 · "Products in this post"', () => {
  it('a discount post (S1): the title and ✕, one line of who, the offer chip, a grid of three', async () => {
    followerApi.deal.mockResolvedValue(ok(DISCOUNT_DATA()));
    const onClose = jest.fn();
    const { getByTestId, getByText, queryByTestId, queryByText, findByTestId } = render(<ShopSheet post={DISCOUNT_POST()} visible onClose={onClose} surface="home" />);
    await findByTestId('shop-sheet');
    getByText('Products in this post');
    expect(queryByText('Shop this post')).toBeNull();
    const who = getByTestId('shop-sheet-who');
    expect(who.props.children).toBe('3 items · Akshaya · Aveen fashion boutique and desiner studio');
    expect(who.props.numberOfLines).toBe(1);                        // a long name is cut with "…", never wrapped
    getByText('20% off applied');                                   // the chip
    // three tiles in one grid
    const grid = getByTestId('shop-grid');
    expect(StyleSheet.flatten(grid.props.style)).toMatchObject({ flexDirection: 'row', flexWrap: 'wrap' });
    for (const id of ['polo', 'casio', 'tee']) { getByTestId(`shop-tile-${id}`); getByTestId(`shop-product-${id}`); getByTestId(`shop-heart-${id}`); }
    const tile = StyleSheet.flatten(getByTestId('shop-tile-polo').props.style).width;
    const photo = StyleSheet.flatten(getByTestId('shop-product-polo').findByType(require('react-native').Image).props.style);
    expect(photo.height / photo.width).toBeCloseTo(1.25, 1);         // a large photo, 4 : 5
    expect(tile * 3).toBeLessThanOrEqual(require('react-native').Dimensions.get('window').width - 28 - 16);
    // name, price, and the normal price struck only because the offer lowers it
    getByText('Blue polo'); getByText('₹719');
    expect(struckIn(getByTestId('shop-tile-polo'))).toEqual(['₹899']);
    getByText('Casio vintage'); getByText('₹2,800');
    expect(struckIn(getByTestId('shop-tile-casio'))).toEqual(['₹3,500']);
    // sold out: the line stays, and there is no bag button on it
    getByText('Out of stock');
    expect(queryByTestId('shop-add-tee')).toBeNull();
    getByTestId('shop-add-polo'); getByTestId('shop-add-casio');
    // the old list's "Add" is gone
    expect(queryByText('Add')).toBeNull();
    // the hint stays
    getByText('No code needed. Buying here pays Akshaya her commission. The ♡ saves the product with this post, so it keeps this offer.');
    expect(queryByTestId('go-to-bag')).toBeNull();                  // nothing in the bag yet
    fireEvent.press(getByTestId('shop-sheet-close'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('a struck price shows only where the offer lowers the price', async () => {
    followerApi.deal.mockResolvedValue(ok(DEAL_DATA()));
    const { getByText, getByTestId, findByTestId } = render(<ShopSheet post={BOGO_POST()} visible onClose={jest.fn()} surface="home" />);
    await findByTestId('shop-sheet');
    getByText('₹4,599'); getByText('₹3,999');
    expect(struckIn(getByTestId('shop-grid'))).toEqual([]);          // nothing crossed out: no MRP is ever drawn
  });

  it('a deal post (S2): the deal and how it works, said to the shopper, with "Till 31 Oct." — then the grid, then Build your deal', async () => {
    followerApi.deal.mockReturnValue(new Promise(() => {}));
    mockNav = nav();
    const onClose = jest.fn();
    const { getByTestId, getByText, queryByText, queryByTestId, findByTestId } = render(<ShopSheet post={BOGO_POST()} visible onClose={onClose} surface="play" />);
    await findByTestId('shop-sheet');
    expect(getByTestId('shop-sheet-who').props.children).toBe('2 items · Akshaya · Aveen fashion boutique and desiner studio');
    const box = getByTestId('deal-intro');
    expect(texts(box)).toEqual(['Buy one, get the same product free',
      'Buy any product in this post and get the same one free, in any size or colour. Till 31 Oct.']);
    expect(queryByText(/They buy/)).toBeNull();                     // never the creator's sentence
    expect(queryByText(/\d+ products?/)).toBeNull();                // the old "2 products" line is gone
    getByTestId('shop-tile-heels'); getByTestId('shop-tile-bag');
    getByText('No code needed. Buying here pays Akshaya her commission. The ♡ saves the product with this post, so it keeps this offer.');
    // on a deal post the bag icon opens the deal page with that product started…
    fireEvent.press(getByTestId('shop-add-heels'));
    expect(mockNav.navigate).toHaveBeenCalledWith('Deal', { postId: 'p-bogo', start: 'heels' });
    expect(queryByTestId('size-sheet')).toBeNull();
    // …and Build your deal opens it empty
    fireEvent.press(getByTestId('build-deal'));
    expect(mockNav.navigate).toHaveBeenCalledWith('Deal', { postId: 'p-bogo', start: null });
    expect(onClose).toHaveBeenCalledTimes(2);
    expect(queryByTestId('go-to-bag')).toBeNull();
  });

  it('the deal data sharpens the sentence when it arrives (the real number of products and gifts)', async () => {
    followerApi.deal.mockResolvedValue(ok(DEAL_DATA({ deal_page: true,
      offer: { id: 'o3', type: 'bogo', sub_type: 'bogo', config: {}, ends_on: '2026-10-31', line: 'Buy one, get the same product free',
        how: 'Buy any of these 2 products and get the same one free, in any size or colour.' } })));
    const { getByTestId, findByTestId } = render(<ShopSheet post={BOGO_POST()} visible onClose={jest.fn()} surface="home" />);
    await findByTestId('shop-sheet');
    await waitFor(() => expect(texts(getByTestId('deal-intro'))[1]).toBe('Buy any of these 2 products and get the same one free, in any size or colour. Till 31 Oct.'));
  });

  it('the bag icon on a discount post is the quick add: it opens the size sheet', async () => {
    followerApi.deal.mockResolvedValue(ok(DISCOUNT_DATA()));
    mockNav = nav();
    const { getByTestId, getByText, findByTestId } = render(<ShopSheet post={DISCOUNT_POST()} visible onClose={jest.fn()} surface="home" />);
    await findByTestId('shop-sheet');
    await waitFor(() => expect(followerApi.deal).toHaveBeenCalledWith('p-disc'));
    fireEvent.press(getByTestId('shop-add-polo'));
    await findByTestId('size-sheet');
    getByText('Choose a size');
    expect(mockNav.navigate).not.toHaveBeenCalled();
    expect(track).toHaveBeenCalledWith('tap_product', 'p-disc', 'home', { product_id: 'polo' });
  });

  it('until the sizes have arrived nothing can be added without one', async () => {
    let arrive;
    followerApi.deal.mockReturnValue(new Promise((resolve) => { arrive = resolve; }));
    const { getByTestId, queryByTestId, findByTestId } = render(<ShopSheet post={DISCOUNT_POST()} visible onClose={jest.fn()} surface="home" />);
    await findByTestId('shop-sheet');
    fireEvent.press(getByTestId('shop-add-polo'));
    await findByTestId('size-sheet');
    getByTestId('size-sheet-waiting');
    expect(getByTestId('size-sheet-add').props.accessibilityState.disabled).toBe(true);
    await act(async () => { arrive(ok(DISCOUNT_DATA())); });
    expect(queryByTestId('size-sheet-waiting')).toBeNull();
    fireEvent.press(getByTestId('size-sheet-size-M'));
    expect(getByTestId('size-sheet-add').props.accessibilityState.disabled).toBe(false);
  });

  it('the sizes could not be fetched: it says so, and nothing is added without one', async () => {
    followerApi.deal.mockResolvedValue({ success: false, error: { message: 'down' } });
    const { getByTestId, getByText, queryByTestId, findByTestId } = render(<ShopSheet post={DISCOUNT_POST()} visible onClose={jest.fn()} surface="home" />);
    await findByTestId('shop-sheet');
    await waitFor(() => expect(followerApi.deal).toHaveBeenCalled());
    fireEvent.press(getByTestId('shop-add-polo'));
    await findByTestId('size-sheet-problem');
    getByText("Couldn't load. Check your connection.");
    expect(queryByTestId('size-sheet-waiting')).toBeNull();
    expect(getByTestId('size-sheet-add').props.accessibilityState.disabled).toBe(true);
    await act(async () => { fireEvent.press(getByTestId('size-sheet-add')); });
    expect(await bagNow()).toEqual([]);
  });

  it('the photo opens the product page; the sheet steps aside without closing, and Back brings it back, open', async () => {
    followerApi.deal.mockResolvedValue(ok(DISCOUNT_DATA()));
    mockNav = nav();
    const onClose = jest.fn();
    const { getByTestId, queryByTestId, findByTestId } = render(<ShopSheet post={DISCOUNT_POST()} visible onClose={onClose} surface="post" />);
    await findByTestId('shop-sheet');
    await waitFor(() => expect(followerApi.deal).toHaveBeenCalled());
    await act(async () => { fireEvent.press(getByTestId('shop-heart-casio')); });
    fireEvent.press(getByTestId('shop-product-casio'));
    expect(mockNav.navigate).toHaveBeenCalledTimes(1);
    const [route, params] = mockNav.navigate.mock.calls[0];
    expect(route).toBe('ShopProduct');
    expect(params).toMatchObject({ postId: 'p-disc', productId: 'casio', surface: 'post', saved: true });
    expect(params.post.id).toBe('p-disc');
    expect(params.data.products.map((p) => p.id)).toEqual(['polo', 'casio', 'tee']);   // the deal data it already holds
    expect(queryByTestId('shop-sheet')).toBeNull();                 // not drawn over the product page…
    expect(onClose).not.toHaveBeenCalled();                         // …but not closed either
    act(() => { params.onHeart(false); });                          // she took the heart off on the product page
    act(() => { params.onBack(); });                                // Back
    getByTestId('shop-sheet');                                      // the sheet, open, on the page she came from
    expect(getByTestId('shop-heart-casio').props.accessibilityState.selected).toBe(false);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('after an add (or Buy now, or Build your deal) on the product page the sheet does NOT come back', async () => {
    followerApi.deal.mockResolvedValue(ok(DISCOUNT_DATA()));
    mockNav = nav();
    const onClose = jest.fn();
    const { getByTestId, queryByTestId, findByTestId } = render(<Host post={DISCOUNT_POST()} onClose={onClose} />);
    await findByTestId('shop-sheet');
    fireEvent.press(getByTestId('shop-product-polo'));
    expect(queryByTestId('shop-sheet')).toBeNull();
    act(() => { mockNav.navigate.mock.calls[0][1].onDone(); });
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(queryByTestId('shop-sheet')).toBeNull();                 // nothing left open on the page she is returned to
    act(() => { mockNav.emit('focus'); });                          // that page comes in front again
    expect(queryByTestId('shop-sheet')).toBeNull();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('she left the product page some other way (an order placed): when this page is in front again nothing is left open', async () => {
    followerApi.deal.mockResolvedValue(ok(DISCOUNT_DATA()));
    mockNav = nav();
    const onClose = jest.fn();
    const { getByTestId, findByTestId } = render(<ShopSheet post={DISCOUNT_POST()} visible onClose={onClose} surface="home" />);
    await findByTestId('shop-sheet');
    act(() => { mockNav.emit('focus'); });
    expect(onClose).not.toHaveBeenCalled();                         // an ordinary focus changes nothing
    fireEvent.press(getByTestId('shop-product-polo'));
    act(() => { mockNav.emit('focus'); });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('"Go to bag · N" stays on a discount post when the bag is not empty; "✓ In your bag · M" is read from her bag', async () => {
    await addToBag([{ post_id: 'p-disc', product_id: 'polo', colour: 'Blue', size: 'M', qty: 1 }, { post_id: 'other', product_id: 'casio', colour: null, size: null, qty: 2 }]);
    followerApi.deal.mockResolvedValue(ok(DISCOUNT_DATA()));
    mockNav = nav();
    const onClose = jest.fn();
    const { getByTestId, getByText, queryByTestId, findByTestId } = render(<ShopSheet post={DISCOUNT_POST()} visible onClose={onClose} surface="home" />);
    await findByTestId('in-bag-polo');
    getByText('✓ In your bag · M');
    expect(queryByTestId('in-bag-casio')).toBeNull();               // that one is in the bag from another post
    getByText('Go to bag · 3');
    fireEvent.press(getByTestId('go-to-bag'));
    expect(onClose).toHaveBeenCalled();
    expect(mockNav.navigate).toHaveBeenCalledWith('Bag');
  });

  it('the heart saves the product with its post, as it did', async () => {
    followerApi.deal.mockResolvedValue(ok(DISCOUNT_DATA()));
    const { getByTestId, findByTestId } = render(<ShopSheet post={DISCOUNT_POST()} visible onClose={jest.fn()} surface="home" />);
    await findByTestId('shop-sheet');
    await act(async () => { fireEvent.press(getByTestId('shop-heart-casio')); });
    expect((await shopStore.get()).savedProducts).toEqual([{ product_id: 'casio', post_id: 'p-disc', collection_item_id: null }]);
    expect(track).toHaveBeenCalledWith('save_product', 'p-disc', 'home', { product_id: 'casio' });
    expect(getByTestId('shop-heart-casio').props.accessibilityState.selected).toBe(true);
    await act(async () => { fireEvent.press(getByTestId('shop-heart-casio')); });
    expect((await shopStore.get()).savedProducts).toEqual([]);
  });
});

/* ═══════════════════════════════════════════ O3 */

describe('O3 · the product page', () => {
  const open = (params, n = nav()) => ({ n, ...render(<Product navigation={n} route={{ params }} />) });
  const rowsOf = (r, id = 'product-details') => r.getAllByTestId(new RegExp(`^${id}-row-`)).map((row) => texts(row));

  it('is a full screen registered once, with its import, under a name nothing else uses', () => {
    const src = fs.readFileSync(path.resolve(__dirname, '../../../navigation/FollowerNavigator.js'), 'utf8');
    expect(src.match(/<Stack\.Screen name="ShopProduct" component=\{ProductScreen\} \/>/g)).toHaveLength(1);
    expect(src).toMatch(/import ProductScreen from '\.\.\/screens\/shop\/ProductScreen';/);
    expect(src.match(/import ProductScreen from/g)).toHaveLength(1);
    expect(fs.existsSync(path.resolve(__dirname, '../ProductScreen.js'))).toBe(true);   // the import points at a real file…
    expect(typeof Product).toBe('function');                                             // …that exports the screen
    expect(src.match(/name="ShopProduct"/g)).toHaveLength(1);
    // and the sheet sends her to that very name
    expect(fs.readFileSync(path.resolve(__dirname, '../../../components/shop/bitsShop.js'), 'utf8')).toMatch(/nav\.navigate\('ShopProduct',/);
    for (const other of ['BrandNavigator.js', 'InfluencerNavigator.js']) {
      expect(fs.readFileSync(path.resolve(__dirname, '../../../navigation', other), 'utf8')).not.toMatch(/ShopProduct/);
    }
  });

  it('a discount post (S3): photos, name, its brand, the price with the offer, colour, size, the details in order, the description, who sells it', async () => {
    followerApi.deal.mockResolvedValue(ok(DISCOUNT_DATA()));
    const r = open({ postId: 'p-disc', productId: 'polo', post: DISCOUNT_POST() });
    await r.findByTestId('product-page');
    expect(followerApi.deal).toHaveBeenCalledWith('p-disc');
    expect(r.getByTestId('product-photos-count').props.children).toBe('1 / 3');
    expect(r.getAllByTestId(/^product-photos-\d$/).map((i) => i.props.source.uri)).toEqual(['https://x/polo.jpg', 'https://x/polo-2.jpg', 'https://x/polo-3.jpg']);
    expect(r.getByTestId('product-name').props.children).toBe('Blue polo');
    expect(r.getByTestId('product-brand').props.children).toBe('Park Avenue');
    expect(texts(r.getByTestId('product-price')).join('')).toBe('₹719  ₹899');     // the normal price struck: the offer lowers it
    expect(texts(r.getByTestId('product-offer'))).toEqual(['20% off applied']);
    expect(r.queryByTestId('product-counts')).toBeNull();
    r.getByText('Colour: Blue'); r.getByText('Size');
    // the details: Brand, Category, Returns — this product was listed with little, so little shows
    r.getByText('Product details');
    expect(rowsOf(r)).toEqual([['Brand', 'Park Avenue'], ['Category', 'Men › Topwear'], ['Returns', 'Within 7 days of delivery']]);
    r.getByText('Description');
    expect(r.getByTestId('product-details-description').props.children).toBe('blue cotton polo t shirt');
    expect(r.getByTestId('product-sold-by').props.children).toBe("Sold by Aveen fashion boutique and desiner studio · from Akshaya's post");
    // nothing INFLX does not hold
    for (const not of [/rating/i, /review/i, /MRP/, /tax/i, /★/]) expect(r.queryByText(not)).toBeNull();
    // the bottom bar: the same two actions the size sheet has
    r.getByTestId('product-buy-now'); r.getByTestId('product-add');
    expect(r.queryByTestId('product-build-deal')).toBeNull();
    // back, heart and the bag with its count, over the photo
    r.getByTestId('back'); r.getByTestId('product-heart'); r.getByTestId('open-bag');
  });

  it('a size is needed before either button works; "Only N left"; a sold-out size is crossed', async () => {
    const r = open({ postId: 'p-disc', productId: 'polo', post: DISCOUNT_POST(), data: DISCOUNT_DATA() });
    await r.findByTestId('product-page');
    expect(followerApi.deal).not.toHaveBeenCalled();                // the sheet handed over what it had
    r.getByText('Choose a size');
    expect(r.getByTestId('product-add').props.accessibilityState.disabled).toBe(true);
    expect(r.getByTestId('product-buy-now').props.accessibilityState.disabled).toBe(true);
    expect(r.getByTestId('product-size-XL').props.accessibilityState.disabled).toBe(true);
    fireEvent.press(r.getByTestId('product-size-L'));
    r.getByText('Only 2 left');
    r.getByText('Add to bag');
    expect(r.getByTestId('product-add').props.accessibilityState.disabled).toBe(false);
    expect(r.getByTestId('product-buy-now').props.accessibilityState.disabled).toBe(false);
  });

  it('a colour that has its own photos shows them', async () => {
    const r = open({ postId: 'p-disc', productId: 'polo', post: DISCOUNT_POST(), data: DISCOUNT_DATA() });
    await r.findByTestId('product-page');
    fireEvent.press(r.getByTestId('product-colour-Navy'));
    expect(r.getAllByTestId(/^product-photos-\d$/).map((i) => i.props.source.uri)).toEqual(['https://x/polo-navy.jpg']);
    expect(r.getByTestId('product-photos-count').props.children).toBe('1 / 1');
    fireEvent.press(r.getByTestId('product-colour-Blue'));          // Blue has none of its own: the product's
    expect(r.getAllByTestId(/^product-photos-\d$/)).toHaveLength(3);
  });

  it('a deal post (S4): a fuller listing in the order sent, "Counts toward …", and ONE button — Build your deal', async () => {
    const onDone = jest.fn();
    const onBack = jest.fn();
    const r = open({ postId: 'p-deal', productId: 'prem', data: DEAL_DATA(), onDone, onBack });
    await r.findByTestId('product-page');
    expect(r.getByTestId('product-brand').props.children).toBe('ExecutiveWear');
    expect(texts(r.getByTestId('product-price')).join('')).toBe('₹899');             // nothing struck: no offer has lowered it yet
    expect(r.queryByTestId('product-offer')).toBeNull();
    expect(texts(r.getByTestId('product-counts'))).toEqual([`Counts toward ${TIERS}`]);
    expect(rowsOf(r)).toEqual([
      ['Brand', 'ExecutiveWear'], ['Category', 'Men › Topwear'],
      ['Fit', 'Slim'], ['Neck', 'Polo'], ['Sleeve', 'Half'], ['Care', 'Machine wash'], ['Unisex', 'Yes'],
      ['Returns', 'Within 7 days of delivery'],
    ]);
    expect(r.getByTestId('product-details-description').props.children).toBe('Smart cotton-blend polo designed for casual business and weekend wear.');
    r.getByText('Size chart ›');
    for (const c of ['Navy', 'Black', 'White', 'Maroon']) r.getByTestId(`product-colour-${c}`);
    // one main button; a deal item is never added alone
    expect(r.queryByTestId('product-buy-now')).toBeNull();
    expect(r.queryByTestId('product-add')).toBeNull();
    fireEvent.press(r.getByTestId('product-build-deal'));
    expect(r.n.replace).toHaveBeenCalledWith('Deal', { postId: 'p-deal', start: 'prem' });   // the deal page with this product started
    expect(onDone).toHaveBeenCalledTimes(1);                        // the sheet stays closed
    expect(onBack).not.toHaveBeenCalled();
    expect(Vibration.vibrate).not.toHaveBeenCalled();
  });

  it('the specs keep the order the server sent, whatever their names', async () => {
    const specs = [{ key: 'z', label: 'Occasion', value: 'Festive' }, { key: 'a', label: 'Material', value: 'Cotton' }, { key: 'm', label: 'Fit', value: 'Regular' }];
    const r = open({ postId: 'p-deal', productId: 'prem', data: DEAL_DATA({ products: [PREMIUM({ specs })] }) });
    await r.findByTestId('product-page');
    expect(rowsOf(r).map((x) => x[0])).toEqual(['Brand', 'Category', 'Occasion', 'Material', 'Fit', 'Returns']);
  });

  it('a row with nothing to say is left out — and a heading with nothing under it', async () => {
    const bare = PREMIUM({ brand_label: null, category_path: '  ', details: '', size_chart: null,
      specs: [{ key: 'fit', label: 'Fit', value: 'Slim' }, { key: 'neck', label: 'Neck', value: '' }, { key: 'care', label: 'Care', value: null }, { key: 'x', label: '', value: 'orphan' }] });
    const r = open({ postId: 'p-deal', productId: 'prem', data: DEAL_DATA({ products: [bare], returns: null }) });
    await r.findByTestId('product-page');
    expect(rowsOf(r)).toEqual([['Fit', 'Slim']]);
    expect(r.queryByTestId('product-brand')).toBeNull();
    expect(r.queryByText('Description')).toBeNull();
    expect(r.queryByText('Returns')).toBeNull();
    expect(r.queryByText('Size chart ›')).toBeNull();

    const nothing = PREMIUM({ brand_label: null, category_path: null, details: null, specs: [] });
    const r2 = open({ postId: 'p-deal', productId: 'prem', data: DEAL_DATA({ products: [nothing], returns: null }) });
    await r2.findByTestId('product-page');
    expect(r2.queryByText('Product details')).toBeNull();
    expect(r2.queryByText('Description')).toBeNull();
    expect(r2.queryByTestId('product-details')).toBeNull();
  });

  it('detailRows: Brand · Category · every listed detail · Returns, in that order', () => {
    expect(detailRows(PREMIUM(), 'Within 7 days of delivery').map((x) => x.label)).toEqual(['Brand', 'Category', 'Fit', 'Neck', 'Sleeve', 'Care', 'Unisex', 'Returns']);
    expect(detailRows({ brand_label: 'Park Avenue' }, null)).toEqual([{ key: 'brand', label: 'Brand', value: 'Park Avenue' }]);
    expect(detailRows({}, '')).toEqual([]);
    expect(detailRows(null, null)).toEqual([]);
  });

  it('a sold-out product cannot be bought; on a deal post Build your deal opens the deal page empty', async () => {
    const r = open({ postId: 'p-disc', productId: 'tee', post: DISCOUNT_POST(), data: DISCOUNT_DATA() });
    await r.findByTestId('product-page');
    r.getByText('Sold out');
    expect(r.getByTestId('product-add').props.accessibilityState.disabled).toBe(true);
    expect(r.getByTestId('product-buy-now').props.accessibilityState.disabled).toBe(true);
    const d = open({ postId: 'p-deal', productId: 'prem', data: DEAL_DATA({ products: [PREMIUM({ sold_out: true })] }) });
    await d.findByTestId('product-page');
    fireEvent.press(d.getByTestId('product-build-deal'));
    expect(d.n.replace).toHaveBeenCalledWith('Deal', { postId: 'p-deal', start: null });
  });

  it('Back returns her to the sheet: the page tells it once, by its own button or the phone\'s', async () => {
    const onBack = jest.fn();
    const onDone = jest.fn();
    const r = open({ postId: 'p-disc', productId: 'polo', data: DISCOUNT_DATA(), onBack, onDone });
    await r.findByTestId('product-page');
    fireEvent.press(r.getByTestId('back'));
    expect(onBack).toHaveBeenCalledTimes(1);
    expect(r.n.goBack).toHaveBeenCalledTimes(1);
    act(() => { r.n.emit('beforeRemove', { data: { action: { type: 'GO_BACK' } } }); });     // the removal that follows
    expect(onBack).toHaveBeenCalledTimes(1);
    expect(onDone).not.toHaveBeenCalled();

    const onBack2 = jest.fn();
    const p = open({ postId: 'p-disc', productId: 'polo', data: DISCOUNT_DATA(), onBack: onBack2 });
    await p.findByTestId('product-page');
    act(() => { p.n.emit('beforeRemove', { data: { action: { type: 'NAVIGATE' } } }); });    // swept away by something else: not Back
    expect(onBack2).not.toHaveBeenCalled();
    act(() => { p.n.emit('beforeRemove', { data: { action: { type: 'GO_BACK' } } }); });     // the phone's own Back
    expect(onBack2).toHaveBeenCalledTimes(1);
  });

  it('the heart saves the product with its post and tells the sheet', async () => {
    const onHeart = jest.fn();
    const r = open({ postId: 'p-disc', productId: 'polo', data: DISCOUNT_DATA(), surface: 'home', saved: false, onHeart });
    await r.findByTestId('product-page');
    expect(r.getByTestId('product-heart').props.accessibilityState.selected).toBe(false);
    await act(async () => { fireEvent.press(r.getByTestId('product-heart')); });
    expect(r.getByTestId('product-heart').props.accessibilityState.selected).toBe(true);
    expect((await shopStore.get()).savedProducts).toEqual([{ product_id: 'polo', post_id: 'p-disc', collection_item_id: null }]);
    expect(track).toHaveBeenCalledWith('save_product', 'p-disc', 'home', { product_id: 'polo' });
    expect(onHeart).toHaveBeenCalledWith(true);
  });

  it('it could not be loaded, or the product has left the post: said plainly, with a way back', async () => {
    followerApi.deal.mockResolvedValue({ success: false, error: { message: 'no' } });
    const r = open({ postId: 'p-disc', productId: 'polo' });
    await r.findByTestId('product-gone');
    r.getByText("Couldn't load. Check your connection.");
    fireEvent.press(r.getByTestId('back'));
    expect(r.n.goBack).toHaveBeenCalled();
    const g = open({ postId: 'p-disc', productId: 'not-here', data: DISCOUNT_DATA() });
    await g.findByTestId('product-gone');
    g.getByText('This product is no longer in this post.');
  });

  it('Buy now is unchanged: a guest signs in first, then straight to paying with this one item; the bag is untouched', async () => {
    const onDone = jest.fn();
    const r = open({ postId: 'p-disc', productId: 'polo', data: DISCOUNT_DATA(), onDone });
    await r.findByTestId('product-page');
    fireEvent.press(r.getByTestId('product-size-M'));
    await act(async () => { fireEvent.press(r.getByTestId('product-buy-now')); });
    // shopper-app-fixes N2: the sign-in screen is now told why she is signing in (reason: 'order').
    expect(r.n.navigate).toHaveBeenCalledWith('FollowerLogin', { onDone: expect.any(Function), reason: 'order' });
    r.n.navigate.mock.calls[0][1].onDone();
    expect(r.n.navigate).toHaveBeenLastCalledWith('Checkout', { buyNow: true, lines: [{ post_id: 'p-disc', product_id: 'polo', colour: 'Blue', size: 'M', qty: 1, price_seen: 899 }] });
    expect(await bagNow()).toEqual([]);
    expect(Vibration.vibrate).not.toHaveBeenCalled();
    expect(onDone).toHaveBeenCalledTimes(1);
  });
});

/* ═══════════════════════════════════════════ O6 */

describe('O6 · after Add to bag she carries on shopping', () => {
  async function sizeSheet(onClose = jest.fn()) {
    followerApi.deal.mockResolvedValue(ok(DISCOUNT_DATA()));
    mockNav = nav();
    const r = render(<Host post={DISCOUNT_POST()} onClose={onClose} />);
    await r.findByTestId('shop-sheet');
    await waitFor(() => expect(followerApi.deal).toHaveBeenCalled());
    fireEvent.press(r.getByTestId('shop-add-polo'));
    await r.findByTestId('size-sheet');
    fireEvent.press(r.getByTestId('size-sheet-size-L'));
    return { ...r, onClose };
  }

  it('the size sheet (S5, S6): one vibration, the green line, a black "Go to bag ›" — and a second later both sheets have closed by themselves', async () => {
    const r = await sizeSheet();
    jest.useFakeTimers();
    await act(async () => { fireEvent.press(r.getByTestId('size-sheet-add')); });
    expect(await bagNow()).toEqual([expect.objectContaining({ post_id: 'p-disc', product_id: 'polo', colour: 'Blue', size: 'L', qty: 1 })]);
    expect(Vibration.vibrate).toHaveBeenCalledTimes(1);
    expect(Vibration.vibrate).toHaveBeenCalledWith(40);
    r.getByText('✓ Added to your bag');
    const go = r.getByTestId('size-sheet-add-go');
    expect(texts(go)).toEqual(['Go to bag ›']);
    expect(StyleSheet.flatten(go.props.style).backgroundColor).toBe('#1A1A17');      // black = done; no second yellow button
    expect(r.queryByTestId('size-sheet-add')).toBeNull();
    r.getByTestId('size-sheet-buy');                                // Buy now is still there
    expect(r.onClose).not.toHaveBeenCalled();
    act(() => { jest.advanceTimersByTime(ADDED_MS - 1); });
    expect(r.onClose).not.toHaveBeenCalled();
    act(() => { jest.advanceTimersByTime(1); });
    expect(r.onClose).toHaveBeenCalledTimes(1);                     // the products sheet is closed…
    expect(r.queryByTestId('shop-sheet')).toBeNull();
    expect(r.queryByTestId('size-sheet')).toBeNull();               // …and so is the size sheet
    expect(mockNav.navigate).not.toHaveBeenCalled();                // she is where she was: nothing was opened
    expect(Vibration.vibrate).toHaveBeenCalledTimes(1);
    expect(track).toHaveBeenCalledWith('add_to_bag', 'p-disc', 'home', { product_id: 'polo' });
  });

  it('"about one second" is about one second', () => {
    expect(ADDED_MS).toBeGreaterThanOrEqual(900);
    expect(ADDED_MS).toBeLessThanOrEqual(1300);
  });

  it('tapping "Go to bag ›" in that second opens the Bag, once, and nothing closes a second time', async () => {
    const r = await sizeSheet();
    jest.useFakeTimers();
    await act(async () => { fireEvent.press(r.getByTestId('size-sheet-add')); });
    fireEvent.press(r.getByTestId('size-sheet-add-go'));
    expect(mockNav.navigate).toHaveBeenCalledTimes(1);
    expect(mockNav.navigate).toHaveBeenCalledWith('Bag');
    expect(r.onClose).toHaveBeenCalledTimes(1);
    expect(r.queryByTestId('size-sheet')).toBeNull();
    act(() => { jest.advanceTimersByTime(5000); });
    expect(r.onClose).toHaveBeenCalledTimes(1);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('she closes the size sheet herself in that second: everything is closed, at once and only once', async () => {
    const r = await sizeSheet();
    jest.useFakeTimers();
    await act(async () => { fireEvent.press(r.getByTestId('size-sheet-add')); });
    const openOne = r.UNSAFE_getAllByType(Modal).find((m) => m.props.visible);
    act(() => { openOne.props.onRequestClose(); });                 // the phone's Back on the size sheet
    expect(r.queryByTestId('size-sheet')).toBeNull();
    expect(r.queryByTestId('shop-sheet')).toBeNull();
    expect(r.onClose).toHaveBeenCalledTimes(1);
    act(() => { jest.advanceTimersByTime(5000); });
    expect(r.onClose).toHaveBeenCalledTimes(1);
  });

  it('the timer is cleared when the screen goes: nothing fires afterwards', async () => {
    const r = await sizeSheet();
    jest.useFakeTimers();
    await act(async () => { fireEvent.press(r.getByTestId('size-sheet-add')); });
    expect(jest.getTimerCount()).toBeGreaterThanOrEqual(1);         // the second is running
    r.unmount();
    // React Native's own button fade may still be finishing; the one-second timer must not be:
    // well inside that second, nothing at all is left waiting.
    act(() => { jest.advanceTimersByTime(400); });
    expect(jest.getTimerCount()).toBe(0);
    act(() => { jest.advanceTimersByTime(5000); });
    expect(r.onClose).not.toHaveBeenCalled();
  });

  it('a phone that cannot vibrate still adds and still returns', async () => {
    Vibration.vibrate.mockImplementationOnce(() => { throw new Error('no vibrator'); });
    const r = await sizeSheet();
    jest.useFakeTimers();
    await act(async () => { fireEvent.press(r.getByTestId('size-sheet-add')); });
    expect(await bagNow()).toHaveLength(1);
    r.getByText('✓ Added to your bag');
    act(() => { jest.advanceTimersByTime(ADDED_MS); });
    expect(r.onClose).toHaveBeenCalledTimes(1);
  });

  it('Buy now from the size sheet is unchanged: no vibration, no return — straight to paying', async () => {
    const r = await sizeSheet();
    await act(async () => { fireEvent.press(r.getByTestId('size-sheet-buy')); });
    expect(Vibration.vibrate).not.toHaveBeenCalled();
    expect(r.onClose).toHaveBeenCalledTimes(1);
    // shopper-app-fixes N2: the sign-in screen is now told why she is signing in (reason: 'order').
    expect(mockNav.navigate).toHaveBeenCalledWith('FollowerLogin', { onDone: expect.any(Function), reason: 'order' });
    expect(await bagNow()).toEqual([]);
  });

  async function productPage(extra = {}) {
    const onBack = jest.fn();
    const onDone = jest.fn();
    const n = nav();
    const r = render(<Product navigation={n} route={{ params: { postId: 'p-disc', productId: 'polo', post: DISCOUNT_POST(), data: DISCOUNT_DATA(), surface: 'home', onBack, onDone, ...extra } }} />);
    await r.findByTestId('product-page');
    fireEvent.press(r.getByTestId('product-size-M'));
    return { ...r, n, onBack, onDone };
  }

  it('the product page: the same second — then the page closes by itself and the sheet does NOT reopen', async () => {
    const r = await productPage();
    jest.useFakeTimers();
    await act(async () => { fireEvent.press(r.getByTestId('product-add')); });
    expect(await bagNow()).toEqual([expect.objectContaining({ post_id: 'p-disc', product_id: 'polo', colour: 'Blue', size: 'M', qty: 1, price_seen: 899 })]);
    expect(Vibration.vibrate).toHaveBeenCalledTimes(1);
    expect(Vibration.vibrate).toHaveBeenCalledWith(40);
    r.getByText('✓ Added to your bag');
    expect(texts(r.getByTestId('product-add-go'))).toEqual(['Go to bag ›']);
    expect(r.getByTestId('bag-count').props.children).toBe(1);      // the bag icon's count is what changed
    expect(r.n.goBack).not.toHaveBeenCalled();
    act(() => { jest.advanceTimersByTime(ADDED_MS); });
    expect(r.n.goBack).toHaveBeenCalledTimes(1);                    // the page closes…
    expect(r.onDone).toHaveBeenCalledTimes(1);                      // …the sheet is told to stay closed…
    expect(r.onBack).not.toHaveBeenCalled();                        // …and is never told "Back"
    act(() => { r.n.emit('beforeRemove', { data: { action: { type: 'GO_BACK' } } }); });
    expect(r.onBack).not.toHaveBeenCalled();
    expect(r.n.navigate).not.toHaveBeenCalled();
    expect(track).toHaveBeenCalledWith('add_to_bag', 'p-disc', 'home', { product_id: 'polo' });
  });

  it('the product page: "Go to bag ›" closes the page and opens the Bag', async () => {
    const r = await productPage();
    jest.useFakeTimers();
    await act(async () => { fireEvent.press(r.getByTestId('product-add')); });
    fireEvent.press(r.getByTestId('product-add-go'));
    expect(r.n.goBack).toHaveBeenCalledTimes(1);
    expect(r.n.navigate).toHaveBeenCalledWith('Bag');
    expect(r.onDone).toHaveBeenCalledTimes(1);
    act(() => { jest.advanceTimersByTime(5000); });
    expect(r.n.goBack).toHaveBeenCalledTimes(1);                    // the second never fires after that
  });

  it('the product page: she went to another page in that second (the bag icon) — nothing is closed under her', async () => {
    const r = await productPage();
    jest.useFakeTimers();
    await act(async () => { fireEvent.press(r.getByTestId('product-add')); });
    r.n.isFocused.mockReturnValue(false);
    act(() => { jest.advanceTimersByTime(ADDED_MS); });
    expect(r.n.goBack).not.toHaveBeenCalled();
    r.getByTestId('product-add-go');                                // still "Go to bag ›": it is already in her bag
  });

  it('the product page: its timers are cleared when it goes', async () => {
    const r = await productPage();
    jest.useFakeTimers();
    await act(async () => { fireEvent.press(r.getByTestId('product-add')); });
    expect(jest.getTimerCount()).toBeGreaterThanOrEqual(1);
    r.unmount();
    act(() => { jest.advanceTimersByTime(400); });                  // (a button fade of React Native's may still be finishing)
    expect(jest.getTimerCount()).toBe(0);                           // neither the second nor the bag icon's mark is left waiting
    act(() => { jest.advanceTimersByTime(5000); });
    expect(r.n.goBack).not.toHaveBeenCalled();
    expect(r.onDone).not.toHaveBeenCalled();
  });

  it('the bag icon is marked for a moment when its count goes up (S6), and the mark clears itself', async () => {
    const { getByTestId, unmount } = render(<BagButton />);
    const ringed = () => StyleSheet.flatten(getByTestId('open-bag').props.style).borderWidth === 1.5;
    expect(ringed()).toBe(false);
    jest.useFakeTimers();
    await act(async () => { await addToBag([{ post_id: 'p-disc', product_id: 'polo', colour: 'Blue', size: 'M', qty: 1 }]); });
    expect(getByTestId('bag-count').props.children).toBe(1);
    expect(ringed()).toBe(true);
    act(() => { jest.advanceTimersByTime(1500); });
    expect(ringed()).toBe(true);                                    // still there when she is returned, a second later
    act(() => { jest.advanceTimersByTime(1500); });
    expect(ringed()).toBe(false);
    await act(async () => { await addToBag([{ post_id: 'p-disc', product_id: 'polo', colour: 'Blue', size: 'L', qty: 1 }]); });
    expect(ringed()).toBe(true);
    unmount();
    act(() => { jest.advanceTimersByTime(400); });
    expect(jest.getTimerCount()).toBe(0);                           // the mark's timer went with the icon
  });
});
