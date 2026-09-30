/**
 * follower-app-v2 — the shopper app's screens F1–F13, rendered with the board's data (Priya, Sneha,
 * Sri Lakshmi Silks, Urban Threads, K7M2F9, "My Dasara picks"). The words are the board's.
 * Contract: features/follower-app-v2 · rules v1.7 §5
 */
import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

jest.mock('../../../services/api', () => ({
  followerApi: {
    feed: jest.fn(), circles: jest.fn(), post: jest.fn(), more: jest.fn(), comments: jest.fn(), addComment: jest.fn(), reportComment: jest.fn(),
    like: jest.fn(), unlike: jest.fn(), save: jest.fn(), unsave: jest.fn(), saved: jest.fn(), resolveSaved: jest.fn(), saveProduct: jest.fn(), unsaveProduct: jest.fn(),
    search: jest.fn(), code: jest.fn(), follow: jest.fn(), unfollow: jest.fn(), following: jest.fn(), creatorStore: jest.fn(), creatorPosts: jest.fn(),
    creatorCollections: jest.fn(), collection: jest.fn(), brandStore: jest.fn(), brandPosts: jest.fn(), brandOffers: jest.fn(), filters: jest.fn(),
    welcome: jest.fn(), profile: jest.fn(), setPreferences: jest.fn(), merge: jest.fn(), nearestCity: jest.fn(), postEvents: jest.fn(() => Promise.resolve({ success: true })),
  },
  setDeviceHeader: jest.fn(), clearSession: jest.fn(() => Promise.resolve()),
}));
jest.mock('../../../services/events', () => ({ track: jest.fn(), flush: jest.fn() }));
jest.mock('../../../../App', () => ({ AuthContext: require('react').createContext({ setRole: () => {} }) }));
jest.mock('@react-navigation/native', () => ({ useFocusEffect: (cb) => { const React = require('react'); React.useEffect(() => cb(), [cb]); } }));

const { followerApi } = require('../../../services/api');
const { track } = require('../../../services/events');
const { shopStore } = require('../../../components/shop/shopStore');
const Home = require('../HomeScreen').default;
const Welcome = require('../WelcomeScreen').default;
const Post = require('../PostScreen').default;
const Play = require('../PlayScreen').default;
const Comments = require('../CommentsScreen').default;
const CreatorStore = require('../CreatorStoreScreen').default;
const Collection = require('../CollectionScreen').default;
const BrandStore = require('../BrandStoreScreen').default;
const BrandOffers = require('../BrandOffersScreen').default;
const Saved = require('../SavedScreen').default;
const Search = require('../SearchScreen').default;
const Profile = require('../ProfileScreen').default;
const Discover = require('../DiscoverScreen').default;

const nav = () => ({ goBack: jest.fn(), navigate: jest.fn(), replace: jest.fn(), addListener: jest.fn(() => () => {}) });
const ok = (data) => ({ success: true, data });

const PRIYA = { id: 'c-priya', name: 'Priya', handle: 'priya', avatar: null, city: 'Vijayawada' };
const SNEHA = { id: 'c-sneha', name: 'Sneha', handle: 'sneha', avatar: null, city: 'Hyderabad' };
const SLS = { id: 'b-sls', name: 'Sri Lakshmi Silks', logo: null, city: 'Vijayawada' };
const UT = { id: 'b-ut', name: 'Urban Threads', logo: null, city: 'Hyderabad' };
const POST = (over = {}) => ({
  id: 'p1', code: 'K7M2F9', title: 'Festive Sarees', caption: 'Festive sarees in Mangalagiri cotton 🧡', share_url: 'https://inflx.in/p/K7M2F9',
  creator: PRIYA, brand: SLS, media_kind: 'image', media_layout: 'single', media: [{ id: 'm1', url: 'https://x/m1.jpg' }],
  offer: { id: 'o1', badge: '20% OFF', line: '20% off applied', deal: '20% off each item', ends_on: '2026-10-31', how: 'Every product is 20% off when bought from your post.' },
  gift_line: null,
  products: [
    { id: 'pr1', name: 'Mangalagiri cotton saree', image_url: null, price: 1200, shopper_price: 960, struck: true, in_stock: true },
    { id: 'pr2', name: 'Chanderi saree', image_url: null, price: 1800, shopper_price: 1440, struck: true, in_stock: true },
  ],
  counts: { likes: 418, comments: 36, shares: 54, saves: 9 }, mine: { liked: false, saved: false, saved_products: [] },
  facets: { price_band: 'Under ₹999', theme: 'Festive', category: ['Women › Sarees'] },
  ...over,
});
const VIDEO = POST({ id: 'p2', code: 'P3W8HX', creator: SNEHA, brand: UT, media_kind: 'video', caption: 'Office-ready denim. Pick any 2 👖',
  offer: { id: 'o2', badge: 'ANY 2 FOR ₹2,999', line: 'Any 2 for ₹2,999', deal: 'Any 2 for ₹2,999', ends_on: '2026-10-25', how: 'They pick any 2…' },
  products: [1, 2, 3].map((i) => ({ id: `j${i}`, name: `Jeans ${i}`, image_url: null, price: 1999, shopper_price: 1999, struck: false, in_stock: true })),
  counts: { likes: 301, comments: 12, shares: 40, saves: 3 } });

async function guest() {
  await AsyncStorage.clear();
  shopStore._reset();
}
async function signedIn() {
  await AsyncStorage.setItem('inflx_token', 't');
  await AsyncStorage.setItem('inflx_user', JSON.stringify({ role: 'follower' }));
  shopStore._reset();
}

beforeEach(async () => { jest.clearAllMocks(); await guest(); await shopStore.set({ welcomed: true }); });

describe('F2 Home', () => {
  it('two rows of circles, then the feed: offer badge, Shop this post · 2 items, like · comment · share · save', async () => {
    followerApi.circles.mockResolvedValue(ok({ creators: [{ ...PRIYA, ring: true }, SNEHA], brands: [SLS, UT] }));
    followerApi.feed.mockResolvedValue(ok({ stage: 'A', posts: [POST(), VIDEO], more: false, caught_up_line: "You're all caught up" }));
    const n = nav();
    const { getByText, getByTestId, getAllByText } = render(<Home navigation={n} />);
    await waitFor(() => getByTestId('home-feed'));
    getByText('Creators'); getByText('Brands');
    getByTestId('circle-creator-c-priya'); getByTestId('circle-brand-b-ut');
    getByText('20% OFF'); getByText('Shop this post · 2 items');
    getByText('ANY 2 FOR ₹2,999'); getByText('Shop this video · 3 items');
    // counts sit beside plain icons (heart, comment, share, bookmark) — no emoji (mono rule)
    getByText('418'); getByText('36'); getByText('54');
    getByText('Sri Lakshmi Silks · Vijayawada');
    expect(getAllByText(/Festive sarees in Mangalagiri cotton/).length).toBe(1);
    // the phone sends what it has shown and her choices; nothing stored about where she is
    expect(followerApi.feed).toHaveBeenCalledWith(expect.objectContaining({ mode: 'home', served: [] }));
    fireEvent.press(getByTestId('post-creator-p1'));
    expect(n.navigate).toHaveBeenCalledWith('CreatorStore', { id: 'c-priya', name: 'Priya' });
    fireEvent.press(getByTestId('post-open-p2'));
    expect(n.navigate).toHaveBeenCalledWith('PlayTab', expect.objectContaining({ start: 'p2' }));
    fireEvent.press(getByTestId('post-open-p1'));
    expect(n.navigate).toHaveBeenCalledWith('Post', expect.objectContaining({ postId: 'p1' }));
    fireEvent.press(getByTestId('open-search'));
    expect(n.navigate).toHaveBeenCalledWith('Search');
  });

  it('"You\'re all caught up" appears once, before the first post coming back', async () => {
    followerApi.circles.mockResolvedValue(ok({ creators: [], brands: [] }));
    followerApi.feed.mockResolvedValue(ok({ posts: [POST({ id: 'a' }), POST({ id: 'b', again: true }), POST({ id: 'c', again: true })], more: false }));
    const { getAllByTestId, getByText } = render(<Home navigation={nav()} />);
    await waitFor(() => getByText("✓ You're all caught up"));
    expect(getAllByTestId('caught-up')).toHaveLength(1);
  });

  it('a guest liking is asked to sign in; a guest saving keeps it on the phone', async () => {
    followerApi.circles.mockResolvedValue(ok({ creators: [], brands: [] }));
    followerApi.feed.mockResolvedValue(ok({ posts: [POST()], more: false }));
    const n = nav();
    const { getByTestId, getByText } = render(<Home navigation={n} />);
    await waitFor(() => getByTestId('post-like-p1'));
    await act(async () => { fireEvent.press(getByTestId('post-like-p1')); });
    getByText('Sign in to like and comment');
    getByText('Your likes and comments are public. Saving and following work without signing in.');
    expect(followerApi.like).not.toHaveBeenCalled();
    fireEvent.press(getByTestId('sign-in-cta'));
    expect(n.navigate).toHaveBeenCalledWith('FollowerLogin');
    await act(async () => { fireEvent.press(getByTestId('post-save-p1')); });
    expect((await shopStore.get()).savedPosts).toEqual(['p1']);
    expect(followerApi.save).not.toHaveBeenCalled();
    expect(track).toHaveBeenCalledWith('save', 'p1', 'home');
  });

  it('first open: the optional Welcome, once', async () => {
    await guest();
    followerApi.circles.mockResolvedValue(ok({ creators: [], brands: [] }));
    followerApi.feed.mockResolvedValue(ok({ posts: [], more: false }));
    const n = nav();
    const { getByTestId } = render(<Home navigation={n} />);
    await waitFor(() => getByTestId('home-empty'));
    expect(n.navigate).toHaveBeenCalledWith('Welcome');
  });
});

describe('F3 Shop this post', () => {
  // shopper-ordering (30 Sep, rules v1.9+): Shop this post now has Add on every product (O2); the
  // old 'no Add until checkout' line is gone. The ordering screens have their own checks (order17).
  it('products with the offer applied; the heart saves the product with its post; Add on each product', async () => {
    followerApi.circles.mockResolvedValue(ok({ creators: [], brands: [] }));
    followerApi.feed.mockResolvedValue(ok({ posts: [POST()], more: false }));
    const { getByTestId, getByText, queryByText } = render(<Home navigation={nav()} />);
    await waitFor(() => getByTestId('post-shop-p1'));
    fireEvent.press(getByTestId('post-shop-p1'));
    getByTestId('shop-sheet');
    getByText('20% off applied'); getByText('Priya · Sri Lakshmi Silks');
    getByText('Mangalagiri cotton saree'); getByText('₹960'); getByText('  ₹1,200');
    getByText('Chanderi saree'); getByText('₹1,440');
    getByText('No code needed. Buying here pays Priya her commission. The ♡ saves the product with this post, so it keeps this offer.');
    getByTestId('shop-add-pr1'); getByTestId('shop-add-pr2');
    expect(queryByText(/Go to bag/)).toBeNull();                         // nothing in the bag yet
    await act(async () => { fireEvent.press(getByTestId('shop-heart-pr2')); });
    expect((await shopStore.get()).savedProducts).toEqual([{ product_id: 'pr2', post_id: 'p1', collection_item_id: null }]);
    expect(track).toHaveBeenCalledWith('save_product', 'p1', 'home', { product_id: 'pr2' });
  });
});

describe('F1 Welcome', () => {
  it('Women / Men / Kids, the styles, "Use my location" or "Pick my city"; Skip; the choices stay on the phone', async () => {
    followerApi.welcome.mockResolvedValue(ok({
      shop_for: [{ key: 'women', label: 'Women' }, { key: 'men', label: 'Men' }, { key: 'kids', label: 'Kids' }],
      styles: ['Festive', 'Casual', 'Korean Style', 'Office', 'Street Style', 'Elegant', 'Minimal', 'Boho'].map((n, i) => ({ id: `t${i}`, name: n })),
      cities: [{ id: 7, name: 'Vijayawada', state: 'Andhra Pradesh' }, { id: 8, name: 'Visakhapatnam', state: 'Andhra Pradesh' }],
      location_line: "We use your phone's location to show creators and stores near you. We never store it.",
    }));
    const n = nav();
    const { getByText, getByTestId } = render(<Welcome navigation={n} route={{ params: {} }} />);
    await waitFor(() => getByText("Let's make your feed yours"));
    getByText('I shop for'); getByText('Styles I like'); getByText('My city'); getByText('Skip');
    getByText("We use your phone's location to show creators and stores near you. We never store it.");
    fireEvent.press(getByTestId('shop-for-women'));
    fireEvent.press(getByTestId('style-Korean Style'));
    fireEvent.press(getByTestId('pick-city'));
    fireEvent.changeText(getByTestId('city-search'), 'vija');
    await act(async () => { fireEvent.press(getByTestId('city-Vijayawada')); });
    await act(async () => { fireEvent.press(getByTestId('welcome-done')); });
    const st = await shopStore.get();
    expect(st).toMatchObject({ shopFor: ['women'], styles: ['t2'], cityId: 7, cityName: 'Vijayawada', useLocation: false, welcomed: true });
    expect(JSON.stringify(st)).not.toMatch(/lat|lng/);
    expect(n.goBack).toHaveBeenCalled();
  });
});

describe('F4 · F5 · F6', () => {
  it('F4 a photo opened: that creator next, then similar posts', async () => {
    followerApi.more.mockResolvedValue(ok({ posts: [POST({ id: 'x1', from: 'creator' }), POST({ id: 'x2', from: 'similar', creator: SNEHA })], more: false }));
    const { getByText, getByTestId } = render(<Post navigation={nav()} route={{ params: { postId: 'p1', post: POST() } }} />);
    await waitFor(() => getByText('More from Priya'));
    getByText('Similar posts');
    getByTestId('post-p1'); getByTestId('post-x1'); getByTestId('post-x2');
    expect(followerApi.more).toHaveBeenCalledWith('p1', ['p1']);
  });

  it('F4 a link to a post that left the shop: "no longer available" and her store', async () => {
    followerApi.code.mockResolvedValue(ok({ state: 'gone', message: 'This post is no longer available', creator: PRIYA, title: 'Festive Sarees' }));
    const n = nav();
    const { getByText } = render(<Post navigation={n} route={{ params: { code: 'K7M2F9', ch: 'wa' } }} />);
    await waitFor(() => getByText('This post is no longer available'));
    expect(followerApi.code).toHaveBeenCalledWith('K7M2F9', 'wa');
    fireEvent.press(getByText("See Priya's store"));
    expect(n.replace).toHaveBeenCalledWith('CreatorStore', { id: 'priya', name: 'Priya' });
  });

  it('F5 Play: full-screen videos with creator · brand, the offer, Shop this video; until the update, a clear note', async () => {
    followerApi.feed.mockResolvedValue(ok({ posts: [VIDEO], more: false }));
    const { getByTestId, getByText } = render(<Play navigation={nav()} route={{ params: {} }} />);
    await waitFor(() => getByTestId('reel-p2'));
    getByText('Sneha · Urban Threads'); getByText('Office-ready denim. Pick any 2 👖'); getByText('ANY 2 FOR ₹2,999');
    getByText('Shop this video · 3 items');
    getByText('Update INFLX to play videos');
    expect(followerApi.feed).toHaveBeenCalledWith(expect.objectContaining({ mode: 'play' }));
  });

  it('F6 Comments as a guest: anyone reads; sign in to comment; comments show who and when', async () => {
    followerApi.comments.mockResolvedValue(ok({ total: 36, signed_in: false,
      sign_in: { title: 'Sign in to like and comment', body: 'Your likes and comments are public. Saving and following work without signing in.' },
      comments: [
        { id: 'k1', body: 'Is the maroon one available in cotton?', ago: '2h', author: { name: 'Anusha', creator: false }, can_report: true },
        { id: 'k2', body: 'Yes! The Mangalagiri one is cotton 🧡', ago: '1h', author: { name: 'Priya', creator: true }, can_report: true },
      ] }));
    const n = nav();
    const { getByText, getByTestId, queryByTestId } = render(<Comments navigation={n} route={{ params: { postId: 'p1' } }} />);
    await waitFor(() => getByText('Comments · 36'));
    getByText('Anusha Is the maroon one available in cotton?'); getByText('Priya · creator ');
    getByTestId('comments-sign-in'); getByText('Sign in with your number');
    expect(queryByTestId('comment-input')).toBeNull();
    fireEvent.press(getByTestId('comments-sign-in-cta'));
    expect(n.navigate).toHaveBeenCalledWith('FollowerLogin');
  });

  it('F6 signed in: write (300 at most), send, report', async () => {
    await signedIn();
    followerApi.comments.mockResolvedValue(ok({ total: 1, signed_in: true, sign_in: null,
      comments: [{ id: 'k1', body: 'Love this', ago: 'now', author: { name: 'Anusha', creator: false }, can_report: true }] }));
    followerApi.addComment.mockResolvedValue(ok({ id: 'k9' }));
    followerApi.reportComment.mockResolvedValue(ok({ reported: true }));
    const { getByTestId, getByText } = render(<Comments navigation={nav()} route={{ params: { postId: 'p1' } }} />);
    await waitFor(() => getByTestId('comment-input'));
    fireEvent.changeText(getByTestId('comment-input'), 'x'.repeat(320));
    getByText('300/300');
    await act(async () => { fireEvent.press(getByTestId('comment-send')); });
    expect(followerApi.addComment).toHaveBeenCalledWith('p1', 'x'.repeat(300));
    await act(async () => { fireEvent.press(getByTestId('report-k1')); });
    expect(followerApi.reportComment).toHaveBeenCalledWith('k1');
  });
});

describe('F7 – F10 stores', () => {
  it('F7 creator store: details, followers on INFLX, Follow (a guest keeps it on the phone), brands, categories, tabs', async () => {
    followerApi.creatorStore.mockResolvedValue(ok({ creator: { ...PRIYA, bio: 'Festive and everyday sarees' }, followers: 12400, following: false,
      brands: [SLS, UT], categories: [{ id: 'l1', name: 'Sarees', posts: 3 }, { id: 'l2', name: 'Kurtis', posts: 1 }], tabs: { posts: 4, videos: 1, collections: 2 } }));
    followerApi.creatorPosts.mockResolvedValue(ok({ posts: [POST(), VIDEO], more: false }));
    followerApi.creatorCollections.mockResolvedValue(ok({ collections: [{ id: 'col1', name: 'Goa trip edit', kind: 'posts', count: 4, cover: null }, { id: 'col2', name: 'Dasara picks', kind: 'products', count: 4, cover: null }] }));
    const n = nav();
    const { getByText, getByTestId } = render(<CreatorStore navigation={n} route={{ params: { id: 'c-priya' } }} />);
    await waitFor(() => getByTestId('creator-name'));
    getByText('Priya'); getByText('Festive and everyday sarees · Vijayawada'); getByText('12.4K followers on INFLX');
    getByText('Brands she works with'); getByText('Sarees'); getByText('Kurtis');
    await waitFor(() => getByTestId('creator-tile-p1'));
    await act(async () => { fireEvent.press(getByTestId('follow')); });
    getByText('Following'); getByText('12.4K followers on INFLX');
    expect((await shopStore.get()).follows).toEqual(['c-priya']);
    fireEvent.press(getByTestId('tab-videos'));
    await waitFor(() => expect(followerApi.creatorPosts).toHaveBeenLastCalledWith('c-priya', { tab: 'videos', category: undefined }));
    fireEvent.press(getByTestId('tab-collections'));
    await waitFor(() => getByText('Goa trip edit · 4'));
    fireEvent.press(getByTestId('collection-col2'));
    expect(n.navigate).toHaveBeenCalledWith('Collection', { id: 'col2' });
    fireEvent.press(getByTestId('store-brand-b-sls'));
    expect(n.navigate).toHaveBeenCalledWith('BrandStore', { id: 'b-sls', name: 'Sri Lakshmi Silks' });
  });

  it('F8 a collection of products: each with its own offer; the heart keeps it with the collection', async () => {
    followerApi.collection.mockResolvedValue(ok({ id: 'col2', name: 'My Dasara picks', kind: 'products', count: 2, hidden: false, creator: PRIYA, line: 'My Dasara picks · 2 products',
      products: [
        { collection_item_id: 'ci1', id: 'pr2', name: 'Chanderi saree', image_url: null, brand: SLS, price: 1800, shopper_price: 1440, struck: true, offer: { line: '20% off applied' } },
        { collection_item_id: 'ci2', id: 'pr9', name: 'Cotton kurta · Ivory', image_url: null, brand: { id: 'b-k', name: 'Kaya Studio' }, price: 999, shopper_price: 999, struck: false, offer: null },
      ] }));
    const { getByText, getByTestId } = render(<Collection navigation={nav()} route={{ params: { id: 'col2' } }} />);
    await waitFor(() => getByTestId('collection-title'));
    getByText('My Dasara picks · 2 products'); getByText('Chanderi saree'); getByText('₹1,440'); getByText('Kaya Studio');
    getByText('A collection can mix brands. Each product sells like a one-product post: its own offer, and Priya earns her commission.');
    await act(async () => { fireEvent.press(getByTestId('collection-heart-pr9')); });
    expect((await shopStore.get()).savedProducts).toEqual([{ product_id: 'pr9', post_id: null, collection_item_id: 'ci2' }]);
  });

  it('F9 brand store: its line, categories, creators, posts; the floating Offers button', async () => {
    followerApi.brandStore.mockResolvedValue(ok({ brand: SLS, line: 'Vijayawada · 18 creators · 64 live posts',
      categories: [{ id: 'l1', name: 'Sarees' }, { id: 'l3', name: 'Dupattas' }], creators: [PRIYA, SNEHA], offers_count: 3 }));
    followerApi.brandPosts.mockResolvedValue(ok({ posts: [POST()], more: false }));
    const n = nav();
    const { getByText, getByTestId } = render(<BrandStore navigation={n} route={{ params: { id: 'b-sls' } }} />);
    await waitFor(() => getByTestId('brand-line'));
    getByText('Vijayawada · 18 creators · 64 live posts'); getByText('Dupattas');
    await waitFor(() => getByTestId('brand-tile-p1'));
    fireEvent.press(getByTestId('brand-offers'));
    expect(n.navigate).toHaveBeenCalledWith('BrandOffers', { id: 'b-sls', name: 'Sri Lakshmi Silks' });
    fireEvent.press(getByTestId('brand-cat-Sarees'));
    await waitFor(() => expect(followerApi.brandPosts).toHaveBeenLastCalledWith('b-sls', { category: 'l1', creator: undefined }));
  });

  it('F10 Offers: the offer types, the filters, each offer with how many posts carry it; tap → its posts', async () => {
    followerApi.filters.mockResolvedValue(ok({ types: [{ key: 'bogo', label: 'BOGO' }, { key: 'bundle', label: 'Bundle' }, { key: 'discount', label: 'Discount' }, { key: 'volume', label: 'Buy more save more' }, { key: 'free_gift', label: 'Free gift' }],
      price_bands: [{ id: 'pb1', label: 'Under ₹999' }], themes: [{ id: 'th1', name: 'Festive' }] }));
    followerApi.brandStore.mockResolvedValue(ok({ brand: SLS, line: '', categories: [{ id: 'l1', name: 'Sarees' }], creators: [], offers_count: 2 }));
    followerApi.brandOffers.mockResolvedValue(ok({ offers: [
      { id: 'o1', name: '20% off festive sarees', badge: '20% OFF', line: 'Till 31 Oct · in 9 posts by 6 creators' },
      { id: 'o3', name: 'Spend ₹3,000 → free silver coin', badge: 'FREE GIFT', line: 'Till 25 Oct · in 3 posts' },
    ] }));
    const n = nav();
    const { getByText, getByTestId } = render(<BrandOffers navigation={n} route={{ params: { id: 'b-sls', name: 'Sri Lakshmi Silks' } }} />);
    await waitFor(() => getByText('Till 31 Oct · in 9 posts by 6 creators'));
    getByText('Offers · Sri Lakshmi Silks'); getByText('All'); getByText('Buy more save more'); getByText('Price ▾'); getByText('Category ▾'); getByText('Theme ▾');
    getByText('Tapping an offer shows the posts that carry it. You shop from a post, so the creator is credited. Offers with no live posts aren’t listed.');
    fireEvent.press(getByTestId('type-bogo'));
    await waitFor(() => expect(followerApi.brandOffers).toHaveBeenLastCalledWith('b-sls', { type: 'bogo', band: undefined, category: undefined, theme: undefined }));
    fireEvent.press(getByTestId('offer-o1'));
    expect(n.navigate).toHaveBeenCalledWith('OfferPosts', { brandId: 'b-sls', offerId: 'o1', title: '20% off festive sarees' });
  });
});

describe('F11 · F12 · F13 · Discover', () => {
  it('F11 Saved (guest): posts and products from the phone; a gone product points to other live posts', async () => {
    await shopStore.set({ savedPosts: ['p1'], savedProducts: [{ product_id: 'pr2', post_id: 'p1' }, { product_id: 'tee', post_id: 'pd' }] });
    followerApi.resolveSaved.mockResolvedValue(ok({ posts: [POST()], products: [
      { product_id: 'pr2', post_id: 'p1', name: 'Chanderi saree', price: 1800, shopper_price: 1440, struck: true, available: true, from: "From Priya's post · 20% off till 31 Oct" },
      { product_id: 'tee', post_id: 'pd', name: 'Classic crew tee · Black', price: 699, available: false, gone_line: "No longer available with this offer. Divya's post ended on 15 Oct.", other_posts: ['q1', 'q2'], other_line: 'Live in 2 other posts' },
    ] }));
    const n = nav();
    const { getByText, getByTestId } = render(<Saved navigation={n} />);
    await waitFor(() => getByText('Posts · 1'));
    getByText('Products · 2');
    expect(followerApi.resolveSaved).toHaveBeenCalledWith({ posts: ['p1'], products: [{ product_id: 'pr2', post_id: 'p1' }, { product_id: 'tee', post_id: 'pd' }] });
    getByTestId('saved-guest');
    getByText('Not signed in? Your saves stay on this phone and move to your account when you sign in.');
    fireEvent.press(getByTestId('saved-tab-products'));
    getByText("From Priya's post · 20% off till 31 Oct"); getByText('₹1,440');
    getByText("No longer available with this offer. Divya's post ended on 15 Oct.");
    fireEvent.press(getByTestId('saved-others-tee'));
    expect(n.navigate).toHaveBeenCalledWith('Post', { postId: 'q1' });
  });

  it('F12 Search: a code (any case) shows exactly that post; Open post', async () => {
    followerApi.search.mockResolvedValue(ok({ code_match: { state: 'live', post: POST() }, creators: [], brands: [], posts: [] }));
    const n = nav();
    const { getByText, getByTestId } = render(<Search navigation={n} />);
    getByText("Search or enter a post code. Capitals don't matter.");
    fireEvent.changeText(getByTestId('search-input'), 'k7m2f9');
    await waitFor(() => getByText('POST CODE MATCH'));
    expect(followerApi.search).toHaveBeenCalledWith('k7m2f9');
    getByText('Festive Sarees · 20% off each item'); getByText('Priya · Sri Lakshmi Silks · 2 items');
    fireEvent.press(getByTestId('code-open'));
    expect(n.navigate).toHaveBeenCalledWith('Post', expect.objectContaining({ postId: 'p1' }));
  });

  it('F13 Profile (guest): sign in first; following, city, what she shops for; returns greyed (coming next)', async () => {
    await shopStore.set({ follows: ['a', 'b'], cityName: 'Vijayawada', shopFor: ['women'] });
    const n = nav();
    const { getByText, getByTestId, queryByTestId } = render(<Profile navigation={n} />);
    await waitFor(() => getByTestId('profile-guest'));
    getByText('Browsing as guest'); getByText('2 creators'); getByText('Vijayawada'); getByText('Women');
    getByText('Returns'); getByText('Coming next');
    expect(queryByTestId('row-addresses')).toBeNull();                  // addresses are hers once signed in
    expect(queryByTestId('log-out')).toBeNull();
    expect(queryByTestId('row-orders')).toBeNull();
    fireEvent.press(getByTestId('profile-sign-in'));
    expect(n.navigate).toHaveBeenCalledWith('FollowerLogin');
  });

  it('F13 Profile (signed in): orders, following, city, what she shops for; no wallet', async () => {
    await signedIn();
    followerApi.profile.mockResolvedValue(ok({ name: 'Anusha', phone: '+91 98••• ••210', city: { id: 7, name: 'Vijayawada' },
      rows: { orders: '2 on the way', following: '8 creators', city: 'Vijayawada', shop_for: 'Women · Festive, Korean Style' } }));
    const { getByText, queryByText } = render(<Profile navigation={nav()} />);
    await waitFor(() => getByText('Anusha'));
    getByText('+91 98••• ••210'); getByText('2 on the way'); getByText('8 creators'); getByText('Women · Festive, Korean Style');
    getByText('Policies and help'); getByText('Log out');
    expect(queryByText(/Wallet/)).toBeNull();
  });

  it('Discover: coming soon', () => {
    const { getByText } = render(<Discover navigation={nav()} />);
    getByText('Discover is coming soon');
  });
});
