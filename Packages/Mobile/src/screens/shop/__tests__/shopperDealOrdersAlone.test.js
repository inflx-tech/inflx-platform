/**
 * shopper-deal-orders, part C — one item of an offer can be bought alone (board B1–B4, C7).
 * The board's own example: Akshaya Reddy's post for Aveen fashion boutique and desiner studio,
 * "Any 3 for ₹2,999" — Premium Polo T-Shirt ₹1,299, Oxford Shirt ₹1,499, Slim Jeans ₹1,999.
 *
 *   CP1–CP3  the product page on a bundle post: "Buy this alone · ₹1,999" over Buy now · Add to bag,
 *            and "In an offer: Any 3 for ₹2,999 · See offer ›"
 *   CP4      on a buy-one-get-one post: one button, "Get this offer"
 *   CP5      on a set post: "Sold as a set." · Build your deal — unless the brand allows its pieces alone
 *   CP6      an older server (no `buy_alone`): Build your deal, as before
 *   CP7, CP8 "Products in this post": the bag icon opens the size sheet where a product can be bought
 *            alone, the deal page where it cannot
 *   CP13     Saved: a product that can still be bought opens its product page
 *
 * Contract: features/shopper-deal-orders · 03-expected-outputs.md
 */
import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

let mockNav = null;
jest.mock('../../../services/api', () => ({
  followerApi: {
    deal: jest.fn(), dealPrice: jest.fn(), bagPrice: jest.fn(), getBag: jest.fn(), putBag: jest.fn(), mergeBag: jest.fn(),
    saveProduct: jest.fn(), unsaveProduct: jest.fn(), saved: jest.fn(), resolveSaved: jest.fn(),
    postEvents: jest.fn(() => Promise.resolve({ success: true })),
  },
  setDeviceHeader: jest.fn(), clearSession: jest.fn(() => Promise.resolve()),
}));
jest.mock('../../../services/events', () => ({ track: jest.fn(), flush: jest.fn() }));
jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (cb) => { const React = require('react'); React.useEffect(() => cb(), [cb]); },
  useNavigation: () => mockNav,
}));

const { followerApi } = require('../../../services/api');
const { shopStore } = require('../../../components/shop/shopStore');
const { ShopSheet } = require('../../../components/shop/bitsShop');
const bag = require('../../../components/shop/bag');
const Product = require('../ProductScreen').default;
const Saved = require('../SavedScreen').default;

function nav() {
  return { goBack: jest.fn(), navigate: jest.fn(), replace: jest.fn(), pop: jest.fn(), isFocused: jest.fn(() => true), addListener: jest.fn(() => () => {}) };
}
const ok = (data) => ({ success: true, data });
const bagNow = async () => JSON.parse(await AsyncStorage.getItem('inflx_bag_v1')) || [];
const texts = (node) => node.findAll((n) => typeof n.type === 'string' && n.type === 'Text').map((n) => [].concat(n.props.children).filter((c) => typeof c === 'string' || typeof c === 'number').join(''));
const said = (node) => texts(node).join('');

const AKSHAYA = { id: 'c1', name: 'Akshaya Reddy' };
const AVEEN = { id: 'b1', name: 'Aveen fashion boutique and desiner studio' };
const size = (s, extra = {}) => ({ size: s, price: 1999, shopper_price: 1999, left: null, sold_out: false, ...extra });
const product = (id, name, price, colours, over = {}) => ({
  id, name, price, shopper_price: price, image_url: `https://x/${id}.jpg`, images: [`https://x/${id}.jpg`], in_deal: true,
  category: { id: 'l1', name: 'Bottomwear' }, sold_out: false, colours, details: null, size_chart: null, set_qty: null,
  brand_label: null, category_path: 'Men › Bottomwear', specs: [{ key: 'fit', label: 'Fit', value: 'Slim' }], ...over,
});
const JEANS = () => product('jeans', 'Slim Jeans', 1999, [
  { colour: 'Indigo', images: [], sizes: [size('30'), size('32'), size('34'), size('36', { left: 0, sold_out: true })] },
  { colour: 'Black', images: [], sizes: [size('32')] },
]);
const POLO = () => product('polo', 'Premium Polo T-Shirt', 1299, [{ colour: 'Navy', images: [], sizes: [size('M', { price: 1299, shopper_price: 1299 })] }]);
const SHIRT = () => product('shirt', 'Oxford Shirt', 1499, [{ colour: 'White', images: [], sizes: [size('M', { price: 1499, shopper_price: 1499 })] }]);

const LINE = 'Any 3 for ₹2,999';
const BUNDLE_DATA = (over = {}) => ({
  post: { id: 'p-any3', code: 'ANY3AA', title: 'Three for the season', creator: AKSHAYA, brand: AVEEN },
  offer: { id: 'o-any3', type: 'bundle', sub_type: 'pick_any', config: { pick: 3, price: 2999 }, ends_on: '2026-10-31', line: LINE,
    how: 'Pick any 3 of these 3 products and pay ₹2,999 for them together.', badge: 'ANY 3 · ₹2,999' },
  deal_page: true, buy_alone: true,
  returns: { hours: 168, words: '7 days', line: 'Within 7 days of delivery' },
  products: [POLO(), SHIRT(), JEANS()], gifts: [], categories: [],
  ...over,
});
const tile = (p) => ({ id: p.id, name: p.name, image_url: p.image_url, price: p.price, shopper_price: p.price, struck: false, in_stock: true });
const BUNDLE_POST = (over = {}) => ({
  id: 'p-any3', code: 'ANY3AA', title: 'Three for the season', creator: AKSHAYA, brand: AVEEN, media_kind: 'image', media: [],
  offer: { id: 'o-any3', type: 'Bundle', kind: 'bundle', sub_type: 'pick_any', badge: 'ANY 3 · ₹2,999', line: LINE, ends_on: '2026-10-31',
    how: 'Pick any 3 of these 3 products and pay ₹2,999 for them together.' },
  deal_page: true, buy_alone: true, gift_line: null,
  products: [tile(POLO()), tile(SHIRT()), tile(JEANS())],
  mine: { saved_products: [] },
  ...over,
});
const BOGO_OFFER = { id: 'o-bogo', type: 'bogo', sub_type: 'bogo', config: { max_free: 2 }, ends_on: '2026-10-31', line: 'Buy one, get the same product free',
  how: 'Buy any product in this post and get the same one free, in any size or colour.', badge: 'BUY 1 GET 1' };
const SET_OFFER = (alone) => ({ id: 'o-set', type: 'bundle', sub_type: 'fixed', config: { price: 5000, quantities: {}, pieces_alone: alone }, ends_on: '2026-10-31',
  line: '3 items for ₹5,000', how: 'Buy the whole set for ₹5,000. You only choose size and colour.', badge: 'SET · ₹5,000' });

const open = (params, n = nav()) => ({ n, ...render(<Product navigation={n} route={{ params }} />) });

beforeEach(async () => {
  jest.clearAllMocks();
  mockNav = null;
  await AsyncStorage.clear();
  shopStore._reset();
  bag._resetBag();
  await act(async () => { await bag.saveBag([]); });
});
afterEach(() => { jest.useRealTimers(); });

/* ═══════════════════════════════════════════ the product page */

describe('B1 · the product page on a bundle post', () => {
  it('CP1 two choices: "Buy this alone · ₹1,999" over Buy now and Add to bag, and the offer beside it — no "Build your deal"', async () => {
    const r = open({ postId: 'p-any3', productId: 'jeans', data: BUNDLE_DATA() });
    await r.findByTestId('product-page');
    expect(said(r.getByTestId('product-price'))).toBe('₹1,999');                 // its normal price, nothing struck
    expect(said(r.getByTestId('product-counts'))).toBe('Counts toward Any 3 for ₹2,999');
    expect(r.getByTestId('product-buy-alone').props.children).toBe('Buy this alone · ₹1,999');
    r.getByTestId('product-buy-now'); r.getByTestId('product-add');
    expect(said(r.getByTestId('product-see-offer'))).toBe('In an offer: Any 3 for ₹2,999 · See offer ›');
    expect(r.queryByTestId('product-build-deal')).toBeNull();
    expect(r.queryByTestId('product-offer-note')).toBeNull();
  });

  it('a size is needed first, exactly as on a simple post', async () => {
    const r = open({ postId: 'p-any3', productId: 'jeans', data: BUNDLE_DATA() });
    await r.findByTestId('product-page');
    expect(r.getByTestId('product-buy-now').props.accessibilityState.disabled).toBe(true);
    expect(said(r.getByTestId('product-add'))).toBe('Choose a size');
    fireEvent.press(r.getByTestId('product-size-32'));
    expect(r.getByTestId('product-buy-now').props.accessibilityState.disabled).toBe(false);
    expect(said(r.getByTestId('product-add'))).toBe('Add to bag');
  });

  it('CP2 Add to bag puts that one item in her bag — its colour, its size, one of it, the price she saw', async () => {
    const r = open({ postId: 'p-any3', productId: 'jeans', data: BUNDLE_DATA() });
    await r.findByTestId('product-page');
    fireEvent.press(r.getByTestId('product-size-32'));
    await act(async () => { fireEvent.press(r.getByTestId('product-add')); });
    await waitFor(async () => expect(await bagNow()).toHaveLength(1));
    expect((await bagNow())[0]).toMatchObject({ post_id: 'p-any3', product_id: 'jeans', colour: 'Indigo', size: '32', qty: 1, role: 'buy', price_seen: 1999 });
    expect(bag.wasAddedAlone('p-any3')).toBe(true);        // so the bag can say "The offer applied by itself." later
    expect(r.n.replace).not.toHaveBeenCalled();            // the deal page did not open
  });

  it('Buy now goes to checkout with that one item, and leaves the bag alone', async () => {
    await AsyncStorage.setItem('inflx_token', 't');
    await AsyncStorage.setItem('inflx_user', JSON.stringify({ role: 'follower' }));
    followerApi.getBag.mockResolvedValue(ok({ lines: [] }));
    const r = open({ postId: 'p-any3', productId: 'jeans', data: BUNDLE_DATA() });
    await r.findByTestId('product-page');
    fireEvent.press(r.getByTestId('product-size-34'));
    await act(async () => { fireEvent.press(r.getByTestId('product-buy-now')); });
    expect(r.n.navigate).toHaveBeenCalledWith('Checkout', { lines: [{ post_id: 'p-any3', product_id: 'jeans', colour: 'Indigo', size: '34', qty: 1, price_seen: 1999 }], buyNow: true });
    expect(followerApi.putBag).not.toHaveBeenCalled();
  });

  it('CP3 See offer › opens the deal page in this page\'s place, with this product started', async () => {
    const onDone = jest.fn();
    const r = open({ postId: 'p-any3', productId: 'jeans', data: BUNDLE_DATA(), onDone });
    await r.findByTestId('product-page');
    fireEvent.press(r.getByTestId('product-see-offer'));
    expect(r.n.replace).toHaveBeenCalledWith('Deal', { postId: 'p-any3', start: 'jeans' });
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(await bagNow()).toEqual([]);                    // nothing was added
  });

  it('a product of the post that the offer does not count is bought alone with no offer strip', async () => {
    const r = open({ postId: 'p-any3', productId: 'jeans', data: BUNDLE_DATA({ products: [POLO(), SHIRT(), { ...JEANS(), in_deal: false }] }) });
    await r.findByTestId('product-page');
    r.getByTestId('product-buy-alone'); r.getByTestId('product-add');
    expect(r.queryByTestId('product-see-offer')).toBeNull();
  });

  it('buy more save more and a gift offer get the same two choices (the server says so)', async () => {
    const volume = { id: 'o-v', type: 'volume', sub_type: 'quantity', config: { tiers: [{ at: 2, value: 20 }] }, line: 'Buy 2 → 20% off', how: '' };
    const r = open({ postId: 'p-any3', productId: 'jeans', data: BUNDLE_DATA({ offer: volume }) });
    await r.findByTestId('product-page');
    expect(said(r.getByTestId('product-see-offer'))).toBe('In an offer: Buy 2 → 20% off · See offer ›');
    r.getByTestId('product-add');
  });
});

describe('"Buy this alone · ₹X" says what one really costs', () => {
  // The founder's own buy-more ladder starts at "Buy 1 → 10%": one tee alone is ₹629, not ₹699.
  const LADDER = { id: 'o-v', type: 'volume', sub_type: 'quantity', config: { tiers: [{ at: 1, value: 10 }, { at: 2, value: 20 }, { at: 3, value: 30 }] },
    line: 'Buy 1 → 10% · Buy 2 → 20% · Buy 3 → 30%', how: '' };
  const TEE = () => product('tee', 'Classic Striped Henley Tee', 699, [{ colour: 'Blue', images: [], sizes: [
    { size: 'M', price: 699, shopper_price: 699, alone_price: 629, left: null, sold_out: false },
    { size: 'XL', price: 899, shopper_price: 899, alone_price: 809, left: null, sold_out: false }] }], { alone_price: 629 });
  const data = () => BUNDLE_DATA({ offer: LADDER, products: [TEE()] });

  it('before a size is chosen: the product\'s own alone price, with its normal price struck', async () => {
    const r = open({ postId: 'p-any3', productId: 'tee', data: data() });
    await r.findByTestId('product-page');
    expect(r.getByTestId('product-buy-alone').props.children).toBe('Buy this alone · ₹629');
    expect(said(r.getByTestId('product-price'))).toBe('₹629  ₹699');
  });

  it('a size with its own price says that size\'s alone price — and the bag is told the size\'s normal price, as always', async () => {
    const r = open({ postId: 'p-any3', productId: 'tee', data: data() });
    await r.findByTestId('product-page');
    fireEvent.press(r.getByTestId('product-size-XL'));
    expect(r.getByTestId('product-buy-alone').props.children).toBe('Buy this alone · ₹809');
    expect(said(r.getByTestId('product-price'))).toBe('₹809  ₹899');
    await act(async () => { fireEvent.press(r.getByTestId('product-add')); });
    await waitFor(async () => expect(await bagNow()).toHaveLength(1));
    expect((await bagNow())[0]).toMatchObject({ product_id: 'tee', size: 'XL', price_seen: 899 });
  });

  it('the size sheet in "Products in this post" says the same', async () => {
    followerApi.deal.mockResolvedValue(ok(data()));
    mockNav = nav();
    const post = BUNDLE_POST({ offer: { ...BUNDLE_POST().offer, kind: 'volume', sub_type: 'quantity', line: LADDER.line }, products: [tile(TEE())] });
    const r = render(<ShopSheet post={post} visible onClose={jest.fn()} surface="post" />);
    await r.findByTestId('shop-sheet');
    await waitFor(() => expect(followerApi.deal).toHaveBeenCalled());
    await act(async () => { fireEvent.press(r.getByTestId('shop-add-tee')); });
    await r.findByTestId('size-sheet');
    expect(said(r.getByTestId('size-sheet-price'))).toBe('₹629  ₹699');
    fireEvent.press(r.getByTestId('size-sheet-size-XL'));
    expect(said(r.getByTestId('size-sheet-price'))).toBe('₹809  ₹899');
  });

  it('a server that sends no alone price: the price it always showed', async () => {
    const r = open({ postId: 'p-any3', productId: 'jeans', data: BUNDLE_DATA() });      // no `alone_price` anywhere
    await r.findByTestId('product-page');
    expect(r.getByTestId('product-buy-alone').props.children).toBe('Buy this alone · ₹1,999');
    expect(said(r.getByTestId('product-price'))).toBe('₹1,999');
  });

  it('a post where a product cannot be bought alone never uses it (buy one get one)', async () => {
    const r = open({ postId: 'p-any3', productId: 'tee', data: BUNDLE_DATA({ offer: BOGO_OFFER, buy_alone: false, products: [TEE()] }) });
    await r.findByTestId('product-page');
    expect(said(r.getByTestId('product-price'))).toBe('₹699');
  });
});

describe('B2 · the product page on a buy-one-get-one post', () => {
  it('CP4 no "alone": the line about the free one, and one button, "Get this offer"', async () => {
    const r = open({ postId: 'p-any3', productId: 'jeans', data: BUNDLE_DATA({ offer: BOGO_OFFER, buy_alone: false }) });
    await r.findByTestId('product-page');
    expect(r.getByTestId('product-offer-note').props.children).toBe('Buy one, get one free. Pick your free one next.');
    expect(said(r.getByTestId('product-build-deal'))).toBe('Get this offer');
    for (const id of ['product-buy-alone', 'product-buy-now', 'product-add', 'product-see-offer']) expect(r.queryByTestId(id)).toBeNull();
    fireEvent.press(r.getByTestId('product-build-deal'));
    expect(r.n.replace).toHaveBeenCalledWith('Deal', { postId: 'p-any3', start: 'jeans' });
  });
});

describe('B3 · the product page on a set post', () => {
  it('CP5 a set sold only whole: "Sold as a set." and Build your deal', async () => {
    const r = open({ postId: 'p-any3', productId: 'jeans', data: BUNDLE_DATA({ offer: SET_OFFER(false), buy_alone: false }) });
    await r.findByTestId('product-page');
    expect(r.getByTestId('product-offer-note').props.children).toBe('Sold as a set.');
    expect(said(r.getByTestId('product-build-deal'))).toBe('Build your deal');
    for (const id of ['product-buy-alone', 'product-buy-now', 'product-add', 'product-see-offer']) expect(r.queryByTestId(id)).toBeNull();
  });

  it('CP5 a set whose brand allows its pieces alone: the two choices of B1', async () => {
    const r = open({ postId: 'p-any3', productId: 'jeans', data: BUNDLE_DATA({ offer: SET_OFFER(true), buy_alone: true }) });
    await r.findByTestId('product-page');
    expect(r.getByTestId('product-buy-alone').props.children).toBe('Buy this alone · ₹1,999');
    r.getByTestId('product-buy-now'); r.getByTestId('product-add');
    expect(said(r.getByTestId('product-see-offer'))).toBe('In an offer: 3 items for ₹5,000 · See offer ›');
    expect(r.queryByTestId('product-build-deal')).toBeNull();
  });
});

describe('an older server, and posts that are not deals', () => {
  it('CP6 no `buy_alone` in the deal data: today\'s one button, with no new line on a bundle', async () => {
    const data = BUNDLE_DATA();
    delete data.buy_alone;
    const r = open({ postId: 'p-any3', productId: 'jeans', data });
    await r.findByTestId('product-page');
    expect(said(r.getByTestId('product-build-deal'))).toBe('Build your deal');
    for (const id of ['product-buy-alone', 'product-buy-now', 'product-add', 'product-see-offer', 'product-offer-note']) expect(r.queryByTestId(id)).toBeNull();
  });

  it('a plain discount post has none of this: Buy now and Add to bag, no "alone" label, no strip', async () => {
    const discount = { id: 'o-d', type: 'discount', sub_type: 'percentage', config: { pct: 20 }, line: '20% off each item', how: '' };
    const r = open({ postId: 'p-any3', productId: 'jeans', data: BUNDLE_DATA({ offer: discount, deal_page: false, buy_alone: false }) });
    await r.findByTestId('product-page');
    r.getByTestId('product-buy-now'); r.getByTestId('product-add');
    for (const id of ['product-buy-alone', 'product-see-offer', 'product-build-deal', 'product-offer-note']) expect(r.queryByTestId(id)).toBeNull();
  });
});

/* ═══════════════════════════════════════════ Products in this post */

describe('B4 · Products in this post on an offer post', () => {
  it('CP7 the bag icon opens the size sheet: the normal price, whose post it is, Buy now, Add to bag, and the line that opens the offer', async () => {
    followerApi.deal.mockResolvedValue(ok(BUNDLE_DATA()));
    mockNav = nav();
    const onClose = jest.fn();
    const r = render(<ShopSheet post={BUNDLE_POST()} visible onClose={onClose} surface="post" />);
    await r.findByTestId('shop-sheet');
    await waitFor(() => expect(followerApi.deal).toHaveBeenCalledWith('p-any3'));
    r.getByTestId('build-deal');                                   // still at the foot
    await act(async () => { fireEvent.press(r.getByTestId('shop-add-jeans')); });
    expect(mockNav.navigate).not.toHaveBeenCalled();               // NOT the deal page
    const sheet = await r.findByTestId('size-sheet');
    expect(said(r.getByTestId('size-sheet-price'))).toBe('₹1,999');
    expect(r.getByTestId('size-sheet-from').props.children).toBe("from Akshaya's post");
    expect(texts(sheet)).not.toContain(`${LINE} · from Akshaya's post`);    // the offer's line is not put beside a price it has not touched
    r.getByTestId('size-sheet-buy'); r.getByTestId('size-sheet-add');
    expect(said(r.getByTestId('size-sheet-offer'))).toBe('Or get it in the offer: Any 3 for ₹2,999 ›');
  });

  it('CP7 Add to bag in that sheet adds the one product, alone', async () => {
    followerApi.deal.mockResolvedValue(ok(BUNDLE_DATA()));
    mockNav = nav();
    const r = render(<ShopSheet post={BUNDLE_POST()} visible onClose={jest.fn()} surface="post" />);
    await r.findByTestId('shop-sheet');
    await waitFor(() => expect(followerApi.deal).toHaveBeenCalled());
    await act(async () => { fireEvent.press(r.getByTestId('shop-add-jeans')); });
    await r.findByTestId('size-sheet');
    fireEvent.press(r.getByTestId('size-sheet-size-32'));
    await act(async () => { fireEvent.press(r.getByTestId('size-sheet-add')); });
    await waitFor(async () => expect(await bagNow()).toHaveLength(1));
    expect((await bagNow())[0]).toMatchObject({ post_id: 'p-any3', product_id: 'jeans', colour: 'Indigo', size: '32', qty: 1, price_seen: 1999 });
    expect(bag.wasAddedAlone('p-any3')).toBe(true);
    expect(mockNav.navigate).not.toHaveBeenCalledWith('Deal', expect.anything());
  });

  it('CP7 "Or get it in the offer ›" opens the deal page with that product started, and adds nothing', async () => {
    followerApi.deal.mockResolvedValue(ok(BUNDLE_DATA()));
    mockNav = nav();
    const onClose = jest.fn();
    const r = render(<ShopSheet post={BUNDLE_POST()} visible onClose={onClose} surface="post" />);
    await r.findByTestId('shop-sheet');
    await waitFor(() => expect(followerApi.deal).toHaveBeenCalled());
    await act(async () => { fireEvent.press(r.getByTestId('shop-add-jeans')); });
    await r.findByTestId('size-sheet');
    await act(async () => { fireEvent.press(r.getByTestId('size-sheet-offer')); });
    expect(mockNav.navigate).toHaveBeenCalledWith('Deal', { postId: 'p-any3', start: 'jeans' });
    expect(onClose).toHaveBeenCalled();
    expect(await bagNow()).toEqual([]);
  });

  it('CP7 Build your deal at the foot still opens the deal page, empty', async () => {
    followerApi.deal.mockResolvedValue(ok(BUNDLE_DATA()));
    mockNav = nav();
    const r = render(<ShopSheet post={BUNDLE_POST()} visible onClose={jest.fn()} surface="post" />);
    await r.findByTestId('shop-sheet');
    fireEvent.press(r.getByTestId('build-deal'));
    expect(mockNav.navigate).toHaveBeenCalledWith('Deal', { postId: 'p-any3', start: null });
  });

  it('CP8 buy one get one, and a set sold only whole: the bag icon opens the deal page, as before', async () => {
    for (const [offer, kind] of [[BOGO_OFFER, 'bogo'], [SET_OFFER(false), 'bundle']]) {
      followerApi.deal.mockResolvedValue(ok(BUNDLE_DATA({ offer, buy_alone: false })));
      mockNav = nav();
      const post = BUNDLE_POST({ buy_alone: false, offer: { ...BUNDLE_POST().offer, kind, sub_type: offer.sub_type, line: offer.line } });
      const r = render(<ShopSheet post={post} visible onClose={jest.fn()} surface="post" />);
      await r.findByTestId('shop-sheet');
      await waitFor(() => expect(followerApi.deal).toHaveBeenCalled());
      fireEvent.press(r.getByTestId('shop-add-jeans'));
      expect(mockNav.navigate).toHaveBeenCalledWith('Deal', { postId: 'p-any3', start: 'jeans' });
      expect(r.queryByTestId('size-sheet')).toBeNull();
      r.unmount();
      jest.clearAllMocks();
    }
  });

  it('CP8 an older server (no `buy_alone` on the card or in the deal data): the deal page, as before', async () => {
    const data = BUNDLE_DATA(); delete data.buy_alone;
    const post = BUNDLE_POST(); delete post.buy_alone;
    followerApi.deal.mockResolvedValue(ok(data));
    mockNav = nav();
    const r = render(<ShopSheet post={post} visible onClose={jest.fn()} surface="post" />);
    await r.findByTestId('shop-sheet');
    await waitFor(() => expect(followerApi.deal).toHaveBeenCalled());
    fireEvent.press(r.getByTestId('shop-add-jeans'));
    expect(mockNav.navigate).toHaveBeenCalledWith('Deal', { postId: 'p-any3', start: 'jeans' });
  });

  it('once the deal data has come, it is the one that says: the card said "alone", the deal data says no → the deal page', async () => {
    followerApi.deal.mockResolvedValue(ok(BUNDLE_DATA({ offer: SET_OFFER(false), buy_alone: false })));
    mockNav = nav();
    const r = render(<ShopSheet post={BUNDLE_POST({ buy_alone: true })} visible onClose={jest.fn()} surface="post" />);
    await r.findByTestId('shop-sheet');
    await waitFor(() => expect(followerApi.deal).toHaveBeenCalled());
    await act(async () => {});
    fireEvent.press(r.getByTestId('shop-add-jeans'));
    expect(mockNav.navigate).toHaveBeenCalledWith('Deal', { postId: 'p-any3', start: 'jeans' });
  });
});

/* ═══════════════════════════════════════════ Saved */

describe('C7 · a saved product opens its product page', () => {
  const SAVED = () => ({ posts: [], products: [
    { product_id: 'jeans', post_id: 'p-any3', name: 'Slim Jeans', image_url: 'https://x/jeans.jpg', price: 1999, shopper_price: 1999, struck: false, available: true, from: "From Akshaya's post · Any 3 for ₹2,999" },
    { product_id: 'tee', post_id: 'p-gone', name: 'Classic crew tee', price: 699, available: false, gone_line: "No longer available with this offer. Divya's post ended on 15 Oct.", other_posts: [], other_line: null },
  ] });
  async function openSaved() {
    await shopStore.set({ savedProducts: [{ product_id: 'jeans', post_id: 'p-any3', collection_item_id: null }, { product_id: 'tee', post_id: 'p-gone', collection_item_id: null }] });
    followerApi.resolveSaved.mockResolvedValue(ok(SAVED()));
    const n = nav();
    mockNav = n;
    const r = render(<Saved navigation={n} />);
    await waitFor(() => r.getByText('Products · 2'));
    fireEvent.press(r.getByTestId('saved-tab-products'));
    return { r, n };
  }

  it('CP13 tapping its photo, or its name, opens the product page on the post it was saved with', async () => {
    const { r, n } = await openSaved();
    fireEvent.press(r.getByTestId('saved-photo-jeans'));
    expect(n.navigate).toHaveBeenLastCalledWith('ShopProduct', { postId: 'p-any3', productId: 'jeans', surface: 'saved', saved: true });
    n.navigate.mockClear();
    fireEvent.press(r.getByTestId('saved-name-jeans'));
    expect(n.navigate).toHaveBeenLastCalledWith('ShopProduct', { postId: 'p-any3', productId: 'jeans', surface: 'saved', saved: true });
  });

  it('"Open post ›" still opens the post', async () => {
    const { r, n } = await openSaved();
    fireEvent.press(r.getByTestId('saved-open-jeans'));
    expect(n.navigate).toHaveBeenLastCalledWith('Post', { postId: 'p-any3' });
  });

  it('a product whose post has ended opens nothing: it cannot be bought there', async () => {
    const { r, n } = await openSaved();
    expect(r.getByTestId('saved-photo-tee').props.accessibilityState.disabled).toBe(true);
    fireEvent.press(r.getByTestId('saved-name-tee'));
    expect(n.navigate).not.toHaveBeenCalled();
    r.getByTestId('saved-remove-tee');                    // it can still be removed
  });

  it('the page it opens is the product page above, asked from the server by itself', async () => {
    followerApi.deal.mockResolvedValue(ok(BUNDLE_DATA()));
    const r = open({ postId: 'p-any3', productId: 'jeans', surface: 'saved', saved: true });
    await r.findByTestId('product-page');
    expect(followerApi.deal).toHaveBeenCalledWith('p-any3');
    expect(r.getByTestId('product-heart').props.accessibilityState.selected).toBe(true);
    r.getByTestId('product-buy-alone'); r.getByTestId('product-see-offer');
  });
});
