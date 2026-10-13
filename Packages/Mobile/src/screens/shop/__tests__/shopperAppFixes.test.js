/**
 * shopper-app-fixes — browsing, account and engagement: the real screens, rendered with the shapes
 * the server sends (features/shopper-app-fixes · 01-spec.md · BUILD_API.md).
 *
 *   F5   coming back to Play she is on the video she left; a NEW tap still goes first
 *   F7   back from signing in, Comments shows her as signed in
 *   F8   a video opened from a pushed screen opens ON TOP (PlayOver, with Back); from a tab, in the Play tab
 *   F11  her Welcome choices reload the feed when she returns; a Welcome that cannot load has Try again and Skip
 *   F13  Profile: Orders as sent, Returns → My orders, Following → the list, "1 creator"
 *   F4   Profile shows "Add your name" when she has given none
 *   F14  a like, a bookmark or a heart stays done on every screen; collections show her hearts;
 *        every saved product has Remove
 *   F15  Profile › Notifications
 *   N1   an ended post says the server's own sentence; a failed load has Try again
 *   N5   stores, an offer's posts and comments load the next ones at the end of the list
 *   N8   the collection keeps only the sentence that is true
 *
 * (F2, F4's sign-in, N2: screens/follower/__tests__/followerLogin.test.js · F3: services/__tests__/
 * renewBeforeAsking.test.js · F15's tapped notification: components/shop/__tests__/notifications15.test.js)
 */
import React from 'react';
import { FlatList, StyleSheet } from 'react-native';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import fs from 'fs';
import path from 'path';

let mockNav = null;
// Every screen's "I am in front" callback, so a test can bring a screen in front again.
const mockInFront = new Set();
jest.mock('../../../services/api', () => ({
  followerApi: {
    feed: jest.fn(), circles: jest.fn(), post: jest.fn(), more: jest.fn(), comments: jest.fn(), addComment: jest.fn(), reportComment: jest.fn(),
    like: jest.fn(), unlike: jest.fn(), save: jest.fn(), unsave: jest.fn(), saved: jest.fn(), resolveSaved: jest.fn(), saveProduct: jest.fn(), unsaveProduct: jest.fn(),
    search: jest.fn(), code: jest.fn(), follow: jest.fn(), unfollow: jest.fn(), following: jest.fn(), creatorStore: jest.fn(), creatorPosts: jest.fn(),
    creatorCollections: jest.fn(), collection: jest.fn(), brandStore: jest.fn(), brandPosts: jest.fn(), brandOffers: jest.fn(), filters: jest.fn(),
    welcome: jest.fn(), profile: jest.fn(), setPreferences: jest.fn(), merge: jest.fn(), nearestCity: jest.fn(), postEvents: jest.fn(() => Promise.resolve({ success: true })),
    deal: jest.fn(), getBag: jest.fn(), putBag: jest.fn(), getMe: jest.fn(), updateMe: jest.fn(), notifications: jest.fn(), markNotificationsRead: jest.fn(),
  },
  authApi: { registerOneSignalPlayerId: jest.fn() },
  setDeviceHeader: jest.fn(), clearSession: jest.fn(() => Promise.resolve()),
}));
jest.mock('../../../services/events', () => ({ track: jest.fn(), flush: jest.fn() }));
jest.mock('../../../../App', () => ({ AuthContext: require('react').createContext({ setRole: () => {} }) }));
jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (cb) => {
    const React = require('react');
    const latest = React.useRef(cb);
    latest.current = cb;
    React.useEffect(() => { const off = cb(); return typeof off === 'function' ? off : undefined; }, [cb]);
    React.useEffect(() => { mockInFront.add(latest); return () => { mockInFront.delete(latest); }; }, []);
  },
  useNavigation: () => mockNav,
}));

const { followerApi } = require('../../../services/api');
const { shopStore } = require('../../../components/shop/shopStore');
const { engaged } = require('../../../components/shop/engaged');
const { ShopSheet, PostCard } = require('../../../components/shop/bitsShop');
const { useShopNav } = require('../../../components/shop/useShopNav');
const { whenLabel } = require('../../../components/shop/copyShop');
const Home = require('../HomeScreen').default;
const Welcome = require('../WelcomeScreen').default;
const Post = require('../PostScreen').default;
const Play = require('../PlayScreen').default;
// shopper-feed-sound-comments-sheet: comments are a sheet over the post now, not a page of their
// own. The checks written for the page run unchanged on the sheet, mounted open for that post.
const CommentsSheet = require('../../../components/shop/CommentsSheet').default;
const Comments = ({ navigation, route }) => <CommentsSheet post={{ id: route.params.postId }} visible onClose={navigation.goBack} navigation={navigation} />;
const CreatorStore = require('../CreatorStoreScreen').default;
const Collection = require('../CollectionScreen').default;
const BrandStore = require('../BrandStoreScreen').default;
const OfferPosts = require('../OfferPostsScreen').default;
const Saved = require('../SavedScreen').default;
const Search = require('../SearchScreen').default;
const Profile = require('../ProfileScreen').default;
const Product = require('../ProductScreen').default;
const Following = require('../FollowingScreen').default;
const Notifications = require('../NotificationsScreen').default;
const EditProfile = require('../../follower/EditProfileScreen').default;

const nav = () => ({ goBack: jest.fn(), navigate: jest.fn(), push: jest.fn(), replace: jest.fn(), pop: jest.fn(), isFocused: jest.fn(() => true), addListener: jest.fn(() => () => {}) });
const ok = (data) => ({ success: true, data });
const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
/** The screen comes in front again (she is back from another page). */
const comeBack = () => act(async () => { [...mockInFront].forEach((ref) => { ref.current(); }); });
const listOf = (r) => r.UNSAFE_getByType(FlatList);
const ids = (r) => listOf(r).props.data.map((p) => p.id);
const texts = (node) => node.findAll((n) => typeof n.type === 'string' && n.type === 'Text').map((n) => [].concat(n.props.children).filter((c) => typeof c === 'string' || typeof c === 'number').join(''));
const atEnd = { nativeEvent: { contentOffset: { y: 1500 }, contentSize: { height: 2000 }, layoutMeasurement: { height: 700 } } };
const atTop = { nativeEvent: { contentOffset: { y: 0 }, contentSize: { height: 4000 }, layoutMeasurement: { height: 700 } } };

const PRIYA = { id: 'c-priya', name: 'Priya', handle: 'priya', avatar: null, city: 'Vijayawada' };
const SNEHA = { id: 'c-sneha', name: 'Sneha', handle: 'sneha', avatar: null, city: 'Hyderabad' };
const SLS = { id: 'b-sls', name: 'Sri Lakshmi Silks', logo: null, city: 'Vijayawada' };
const POST = (over = {}) => ({
  id: 'p1', code: 'K7M2F9', title: 'Festive Sarees', caption: 'Festive sarees', share_url: 'https://inflx.in/p/K7M2F9',
  creator: PRIYA, brand: SLS, media_kind: 'image', media_layout: 'single', media: [{ id: 'm1', url: 'https://x/m1.jpg' }],
  offer: { id: 'o1', kind: 'discount', badge: '20% OFF', line: '20% off applied', deal: '20% off each item', ends_on: '2026-10-31', how: 'Every product is 20% off.' },
  deal_page: false, gift_line: null,
  products: [
    { id: 'pr1', name: 'Mangalagiri cotton saree', image_url: null, price: 1200, shopper_price: 960, struck: true, in_stock: true },
    { id: 'pr2', name: 'Chanderi saree', image_url: null, price: 1800, shopper_price: 1440, struck: true, in_stock: true },
  ],
  counts: { likes: 418, comments: 36, shares: 54, saves: 9 }, mine: { liked: false, saved: false, saved_products: [] },
  facets: { price_band: 'Under ₹999', theme: 'Festive', category: [] },
  ...over,
});
const VIDEO = (over = {}) => POST({ id: 'v1', code: 'P3W8HX', creator: SNEHA, media_kind: 'video', media: [{ id: 'mv', url: 'https://x/v.mp4', cover_url: 'https://x/v.jpg' }], caption: 'Denim', ...over });
const DEAL = (over = {}) => ({
  post: { id: 'p1', code: 'K7M2F9', title: 'Festive Sarees', creator: PRIYA, brand: SLS },
  offer: { id: 'o1', type: 'discount', sub_type: 'percentage', line: '20% off each item', ends_on: '2026-10-31' }, deal_page: false,
  returns: { line: 'Within 7 days of delivery' },
  products: [
    { id: 'pr1', name: 'Mangalagiri cotton saree', price: 1200, shopper_price: 960, image_url: null, images: [], in_deal: false, sold_out: false, colours: [{ colour: null, images: [], sizes: [{ size: 'Free', left: null, sold_out: false }] }], specs: [] },
    { id: 'pr2', name: 'Chanderi saree', price: 1800, shopper_price: 1440, image_url: null, images: [], in_deal: false, sold_out: false, colours: [], specs: [] },
  ],
  gifts: [], categories: [],
  ...over,
});
const ENDED = { success: false, error: { code: 'NOT_FOUND', message: 'This post is no longer in the shop' } };
const DOWN = { success: false, error: { code: 'NETWORK_ERROR', message: 'Cannot connect to server. Check your connection.' } };

async function guest() {
  await AsyncStorage.clear();
  shopStore._reset();
  await shopStore.set({ welcomed: true });
}
async function signedIn() {
  await AsyncStorage.setItem('inflx_token', 't');
  await AsyncStorage.setItem('inflx_user', JSON.stringify({ role: 'follower' }));
}
const liked = (r, id, prefix = 'post') => r.getByTestId(`${prefix}-like-${id}`).props.accessibilityState.selected;
const bookmarked = (r, id) => r.getByTestId(`post-save-${id}`).props.accessibilityState.selected;

beforeEach(async () => {
  jest.clearAllMocks();
  mockNav = null;
  mockInFront.clear();
  await guest();
  followerApi.circles.mockResolvedValue(ok({ creators: [], brands: [] }));
  followerApi.getBag.mockResolvedValue(ok({ lines: [] }));
});
afterEach(() => { jest.useRealTimers(); });

/* ═══════════════════════════════════════════ F5 */

describe('F5 · coming back to Play she is on the video she left', () => {
  const V = (id) => VIDEO({ id });

  it('the ▶ tab: the list is asked for once — coming back (from comments, a store, the bag) neither asks again nor moves her', async () => {
    followerApi.feed.mockResolvedValue(ok({ posts: [V('a'), V('b'), V('c')], more: false }));
    const r = render(<Play navigation={nav()} route={{ name: 'PlayTab' }} />);
    await waitFor(() => r.getByTestId('reel-a'));
    expect(followerApi.feed).toHaveBeenCalledTimes(1);
    const toTop = jest.spyOn(listOf(r).instance, 'scrollToOffset');
    followerApi.feed.mockResolvedValue(ok({ posts: [V('x'), V('y')], more: false }));     // what a fresh list would bring
    await comeBack();
    await comeBack();
    expect(followerApi.feed).toHaveBeenCalledTimes(1);               // it used to start again from the top each time
    expect(ids(r)).toEqual(['a', 'b', 'c']);
    expect(toTop).not.toHaveBeenCalled();                            // where she is in the list is left alone
  });

  it('a video she tapped goes first; coming back it is still first; a NEW tap asks again with the new one', async () => {
    followerApi.feed.mockImplementation((body) => Promise.resolve(ok({ posts: body.start ? [V(body.start), V('next')] : [V('t1'), V('t2')], more: false })));
    const n = nav();
    const r = render(<Play navigation={n} route={{ name: 'PlayTab', params: { start: 'v9', at: 1 } }} />);
    await waitFor(() => r.getByTestId('reel-v9'));
    expect(followerApi.feed).toHaveBeenCalledTimes(1);
    expect(followerApi.feed).toHaveBeenLastCalledWith(expect.objectContaining({ mode: 'play', start: 'v9', served: [] }));

    await comeBack();                                                // back from its comments
    expect(followerApi.feed).toHaveBeenCalledTimes(1);               // it used to ask again here — and without `start`
    expect(ids(r)).toEqual(['v9', 'next']);

    r.rerender(<Play navigation={n} route={{ name: 'PlayTab', params: { start: 'v3', at: 2 } }} />);      // she taps another video on Home
    await waitFor(() => r.getByTestId('reel-v3'));
    expect(followerApi.feed).toHaveBeenCalledTimes(2);
    expect(followerApi.feed).toHaveBeenLastCalledWith(expect.objectContaining({ start: 'v3', served: [] }));
    expect(ids(r)).toEqual(['v3', 'next']);

    r.rerender(<Play navigation={n} route={{ name: 'PlayTab', params: { start: 'v3', at: 3 } }} />);      // the same one, tapped again later
    await waitFor(() => expect(followerApi.feed).toHaveBeenCalledTimes(3));
    await comeBack();
    expect(followerApi.feed).toHaveBeenCalledTimes(3);
  });

  it('the tab was open already, then a video is tapped, then she comes back: the tapped list stays', async () => {
    followerApi.feed.mockImplementation((body) => Promise.resolve(ok({ posts: body.start ? [V(body.start), V('next')] : [V('t1'), V('t2')], more: false })));
    const n = nav();
    const r = render(<Play navigation={n} route={{ name: 'PlayTab' }} />);
    await waitFor(() => r.getByTestId('reel-t1'));
    r.rerender(<Play navigation={n} route={{ name: 'PlayTab', params: { start: 'v9', at: 5 } }} />);
    await waitFor(() => r.getByTestId('reel-v9'));
    await comeBack();
    await comeBack();
    expect(followerApi.feed).toHaveBeenCalledTimes(2);
    expect(ids(r)).toEqual(['v9', 'next']);
  });

  it('the next videos still load at the end of the list, carrying what was already shown', async () => {
    followerApi.feed.mockResolvedValueOnce(ok({ posts: [V('a'), V('b')], more: true })).mockResolvedValueOnce(ok({ posts: [V('c')], more: false }));
    const r = render(<Play navigation={nav()} route={{ name: 'PlayTab' }} />);
    await waitFor(() => r.getByTestId('reel-a'));
    await act(async () => { listOf(r).props.onEndReached(); });
    expect(followerApi.feed).toHaveBeenLastCalledWith(expect.objectContaining({ mode: 'play', served: ['a', 'b'] }));
    expect(ids(r)).toEqual(['a', 'b', 'c']);
    await act(async () => { listOf(r).props.onEndReached(); });
    expect(followerApi.feed).toHaveBeenCalledTimes(2);               // the server said there is no more
  });

  it('a new tap is never lost behind a page that is still on its way — and that late page is not added to the new list', async () => {
    let arrive;
    followerApi.feed
      .mockResolvedValueOnce(ok({ posts: [V('a'), V('b')], more: true }))
      .mockReturnValueOnce(new Promise((resolve) => { arrive = resolve; }))
      .mockResolvedValueOnce(ok({ posts: [V('v7'), V('z')], more: false }));
    const n = nav();
    const r = render(<Play navigation={n} route={{ name: 'PlayTab' }} />);
    await waitFor(() => r.getByTestId('reel-a'));
    await act(async () => { listOf(r).props.onEndReached(); });
    expect(followerApi.feed).toHaveBeenCalledTimes(2);               // the next page is on its way…
    r.rerender(<Play navigation={n} route={{ name: 'PlayTab', params: { start: 'v7', at: 9 } }} />);       // …when she taps a video
    await waitFor(() => r.getByTestId('reel-v7'));
    expect(followerApi.feed).toHaveBeenLastCalledWith(expect.objectContaining({ start: 'v7', served: [] }));
    await act(async () => { arrive(ok({ posts: [V('late')], more: false })); });
    expect(ids(r)).toEqual(['v7', 'z']);
  });

  it('a list that could not load: Try again asks for the tapped video again; coming back does not hammer the server', async () => {
    followerApi.feed.mockResolvedValueOnce(DOWN).mockResolvedValue(ok({ posts: [V('v9')], more: false }));
    const r = render(<Play navigation={nav()} route={{ name: 'PlayTab', params: { start: 'v9', at: 1 } }} />);
    await waitFor(() => r.getByText("Couldn't load. Check your connection."));
    await comeBack();
    expect(followerApi.feed).toHaveBeenCalledTimes(1);
    await act(async () => { fireEvent.press(r.getByText('Try again')); });
    expect(followerApi.feed).toHaveBeenLastCalledWith(expect.objectContaining({ start: 'v9' }));
    await waitFor(() => r.getByTestId('reel-v9'));
  });

  it('(F11) her Welcome choices changed while she was away: the list is asked for again with them — once', async () => {
    followerApi.feed.mockResolvedValue(ok({ posts: [V('a')], more: false }));
    const r = render(<Play navigation={nav()} route={{ name: 'PlayTab' }} />);
    await waitFor(() => r.getByTestId('reel-a'));
    await shopStore.set({ shopFor: ['men'] });
    await comeBack();
    await waitFor(() => expect(followerApi.feed).toHaveBeenCalledTimes(2));
    expect(followerApi.feed).toHaveBeenLastCalledWith(expect.objectContaining({ mode: 'play', shop_for: ['men'], served: [] }));
    await comeBack();
    expect(followerApi.feed).toHaveBeenCalledTimes(2);
  });
});

/* ═══════════════════════════════════════════ F7 · N5 (comments) */

describe('F7 · back from signing in, Comments shows her as signed in', () => {
  const SIGN_IN = { title: 'Sign in to like and comment', body: 'Your likes and comments are public. Saving and following work without signing in.' };
  const K = (i) => ({ id: `k${i}`, body: `comment ${i}`, at: new Date(Date.UTC(2026, 9, 5, 12, 0, 0) - i * 60000).toISOString(), ago: `${i}m`, author: { name: i % 2 ? 'Anusha' : 'INFLX shopper', creator: false }, can_report: true });
  const asGuest = { total: 2, signed_in: false, sign_in: SIGN_IN, comments: [K(1), K(2)] };
  const asHer = { total: 2, signed_in: true, sign_in: null, comments: [K(1), K(2)] };

  it('she signs in from Comments and lands back on it: the box to write is there, "Sign in to like and comment" is gone', async () => {
    followerApi.comments.mockResolvedValue(ok(asGuest));
    const n = nav();
    const r = render(<Comments navigation={n} route={{ params: { postId: 'p1' } }} />);
    await waitFor(() => r.getByTestId('comments-sign-in'));
    r.getByText('Sign in to like and comment');
    expect(r.queryByTestId('comment-input')).toBeNull();
    fireEvent.press(r.getByTestId('comments-sign-in-cta'));
    expect(n.navigate).toHaveBeenCalledWith('FollowerLogin', { reason: 'comment' });

    await signedIn();                                                // …she signs in there, and comes back
    followerApi.comments.mockResolvedValue(ok(asHer));
    await comeBack();
    await waitFor(() => r.getByTestId('comment-input'));
    expect(r.queryByTestId('comments-sign-in')).toBeNull();
    expect(r.queryByText('Sign in to like and comment')).toBeNull();
    expect(followerApi.comments).toHaveBeenCalledTimes(2);           // read once on opening, and again on coming back
    r.getByTestId('report-k1');                                      // and she can report, as a signed-in shopper can
  });

  // shopper-feed-sound-comments-sheet: the only way off the sheet is to sign in, so that is the
  // return on which it reads again (the page re-read on every return to it).
  it('a re-read that fails leaves what she was reading on the screen', async () => {
    followerApi.comments.mockResolvedValue(ok(asGuest));
    const r = render(<Comments navigation={nav()} route={{ params: { postId: 'p1' } }} />);
    await waitFor(() => r.getByTestId('comment-k1'));
    fireEvent.press(r.getByTestId('comments-sign-in-cta'));          // off to sign in…
    followerApi.comments.mockResolvedValue(DOWN);
    await comeBack();                                                // …and back, with no connection
    expect(followerApi.comments).toHaveBeenCalledTimes(2);
    r.getByTestId('comment-k1'); r.getByTestId('comments-sign-in');
    expect(r.queryByText("Couldn't load. Check your connection.")).toBeNull();
  });

  it('N1 · comments on a post that has ended say what the server says, with nothing to retry; a failed read still has Try again', async () => {
    followerApi.comments.mockResolvedValue({ success: false, error: { code: 'NOT_FOUND', message: 'This post is no longer in the shop' } });
    const r = render(<Comments navigation={nav()} route={{ params: { postId: 'p1' } }} />);
    await waitFor(() => r.getByTestId('comments-gone'));
    r.getByText('This post is no longer in the shop');
    expect(r.queryByText("Couldn't load. Check your connection.")).toBeNull();
    expect(r.queryByText('Try again')).toBeNull();

    followerApi.comments.mockResolvedValue({ success: false, error: { code: 'NETWORK_ERROR', message: 'Cannot connect' } });
    const r2 = render(<Comments navigation={nav()} route={{ params: { postId: 'p2' } }} />);
    await waitFor(() => r2.getByText("Couldn't load. Check your connection."));
    r2.getByText('Try again');
  });

  // shopper-feed-sound-comments-sheet: the comments are read again each time the sheet is opened.
  // For the same post, what she was writing is still in the box; for another post the box is empty.
  it('what she was writing is not lost when the comments are read again', async () => {
    followerApi.comments.mockResolvedValue(ok(asHer));
    const n = nav();
    const sheet = (post, visible) => <CommentsSheet post={post} visible={visible} onClose={n.goBack} navigation={n} />;
    const r = render(sheet({ id: 'p1' }, true));
    await waitFor(() => r.getByTestId('comment-input'));
    fireEvent.changeText(r.getByTestId('comment-input'), 'Is this cotton?');
    r.rerender(sheet({ id: 'p1' }, false));                          // she closes the comments…
    r.rerender(sheet({ id: 'p1' }, true));                           // …and opens them again
    await waitFor(() => expect(followerApi.comments).toHaveBeenCalledTimes(2));
    expect(r.getByTestId('comment-input').props.value).toBe('Is this cotton?');
    r.rerender(sheet({ id: 'p2' }, true));                           // another post's comments
    await waitFor(() => expect(followerApi.comments).toHaveBeenLastCalledWith('p2'));
    await waitFor(() => expect(r.getByTestId('comment-input').props.value).toBe(''));
  });

  it('a comment by someone who has given no name reads "INFLX shopper" (as the server sends it)', async () => {
    followerApi.comments.mockResolvedValue(ok(asGuest));
    const r = render(<Comments navigation={nav()} route={{ params: { postId: 'p1' } }} />);
    await waitFor(() => r.getByTestId('comment-k2'));
    expect(texts(r.getByTestId('comment-k2')).join(' ')).toMatch(/INFLX shopper/);
    expect(r.queryByText(/Follower/)).toBeNull();
  });

  it('N5 — the older comments load at the end of the list, 30 at a time, until all are shown; no button', async () => {
    followerApi.comments.mockImplementation((id, before) => Promise.resolve(ok(before
      ? { total: 45, signed_in: false, sign_in: SIGN_IN, comments: range(31, 45).map(K) }
      : { total: 45, signed_in: false, sign_in: SIGN_IN, comments: range(1, 30).map(K) })));
    const r = render(<Comments navigation={nav()} route={{ params: { postId: 'p1' } }} />);
    await waitFor(() => r.getByText('Comments · 45'));
    expect(listOf(r).props.data).toHaveLength(30);
    expect(r.queryByText(/load more/i)).toBeNull();
    await act(async () => { listOf(r).props.onEndReached(); });
    expect(followerApi.comments).toHaveBeenLastCalledWith('p1', K(30).at);        // before the oldest one shown
    expect(listOf(r).props.data.map((c) => c.id)).toEqual(range(1, 45).map((i) => `k${i}`));
    await act(async () => { listOf(r).props.onEndReached(); });
    expect(followerApi.comments).toHaveBeenCalledTimes(2);           // all 45 are on the screen: nothing more to ask
  });

  it('N5 — a comment that arrives twice is shown once; a server with none older stops the asking', async () => {
    followerApi.comments
      .mockResolvedValueOnce(ok({ total: 40, signed_in: false, sign_in: SIGN_IN, comments: range(1, 30).map(K) }))
      .mockResolvedValueOnce(ok({ total: 40, signed_in: false, sign_in: SIGN_IN, comments: [K(30), K(31)] }))
      .mockResolvedValueOnce(ok({ total: 40, signed_in: false, sign_in: SIGN_IN, comments: [] }));
    const r = render(<Comments navigation={nav()} route={{ params: { postId: 'p1' } }} />);
    await waitFor(() => r.getByText('Comments · 40'));
    await act(async () => { listOf(r).props.onEndReached(); });
    expect(listOf(r).props.data.map((c) => c.id)).toEqual(range(1, 31).map((i) => `k${i}`));
    await act(async () => { listOf(r).props.onEndReached(); });
    await act(async () => { listOf(r).props.onEndReached(); });
    expect(followerApi.comments).toHaveBeenCalledTimes(3);
  });
});

/* ═══════════════════════════════════════════ F8 */

describe('F8 · a video opens on top of the screen she is on — Back returns her there', () => {
  function Probe({ navigation, tab, post }) {
    const sn = useShopNav(navigation, tab === undefined ? undefined : { tab });
    return <PostCard post={post} surface="home" position={0} onOpen={sn.openPost} onShop={sn.openShop} onComments={sn.openComments}
      onCreator={sn.openCreator} onBrand={sn.openBrand} onNeedSignIn={sn.needSignIn} />;
  }

  it('from a bottom tab: the Play tab, as now. From any pushed screen: PlayOver, pushed. A photo opens its page either way', () => {
    const tab = nav();
    const a = render(<Probe navigation={tab} tab post={VIDEO()} />);
    fireEvent.press(a.getByTestId('post-open-v1'));
    expect(tab.navigate).toHaveBeenCalledWith('PlayTab', { start: 'v1', at: expect.any(Number) });
    expect(tab.push).not.toHaveBeenCalled();
    a.unmount();

    const pushed = nav();
    const b = render(<Probe navigation={pushed} post={VIDEO()} />);
    fireEvent.press(b.getByTestId('post-open-v1'));
    expect(pushed.push).toHaveBeenCalledWith('PlayOver', { start: 'v1', at: expect.any(Number) });
    expect(pushed.navigate).not.toHaveBeenCalled();                  // never the tab: that threw this screen away
    b.unmount();

    for (const isTab of [true, false]) {
      const n = nav();
      const c = render(<Probe navigation={n} tab={isTab} post={POST()} />);
      fireEvent.press(c.getByTestId('post-open-p1'));
      expect(n.navigate).toHaveBeenCalledWith('Post', expect.objectContaining({ postId: 'p1' }));
      expect(n.push).not.toHaveBeenCalled();
      c.unmount();
    }
  });

  it('search: a code that is a video opens on top of Search', async () => {
    followerApi.search.mockResolvedValue(ok({ code_match: { state: 'live', post: VIDEO() }, creators: [], brands: [], posts: [] }));
    const n = nav();
    const r = render(<Search navigation={n} />);
    fireEvent.changeText(r.getByTestId('search-input'), 'P3W8HX');
    await waitFor(() => r.getByTestId('code-open'));
    fireEvent.press(r.getByTestId('code-open'));
    expect(n.push).toHaveBeenCalledWith('PlayOver', expect.objectContaining({ start: 'v1' }));
    expect(n.navigate).not.toHaveBeenCalled();
  });

  it('an offer\'s posts, and a collection of posts: their videos open on top too', async () => {
    followerApi.brandPosts.mockResolvedValue(ok({ posts: [VIDEO()], more: false }));
    const n = nav();
    const offer = render(<OfferPosts navigation={n} route={{ params: { brandId: 'b-sls', offerId: 'o1', title: '20% off' } }} />);
    await waitFor(() => offer.getByTestId('post-open-v1'));
    fireEvent.press(offer.getByTestId('post-open-v1'));
    expect(n.push).toHaveBeenCalledWith('PlayOver', expect.objectContaining({ start: 'v1' }));
    offer.unmount();

    followerApi.collection.mockResolvedValue(ok({ id: 'col1', name: 'Goa trip edit', kind: 'posts', count: 1, hidden: false, creator: PRIYA, line: 'Goa trip edit · 1 post', posts: [VIDEO()] }));
    const n2 = nav();
    const col = render(<Collection navigation={n2} route={{ params: { id: 'col1' } }} />);
    await waitFor(() => col.getByTestId('collection-tile-v1'));
    fireEvent.press(col.getByTestId('collection-tile-v1'));
    expect(n2.push).toHaveBeenCalledWith('PlayOver', expect.objectContaining({ start: 'v1' }));
  });

  it('Home is a bottom tab: its video still opens in the Play tab', async () => {
    followerApi.feed.mockResolvedValue(ok({ posts: [VIDEO()], more: false }));
    const n = nav();
    const r = render(<Home navigation={n} />);
    await waitFor(() => r.getByTestId('post-open-v1'));
    fireEvent.press(r.getByTestId('post-open-v1'));
    expect(n.navigate).toHaveBeenCalledWith('PlayTab', expect.objectContaining({ start: 'v1' }));
    expect(n.push).not.toHaveBeenCalled();
  });

  it('Play pushed on top has a Back arrow, top-left, that goes back; the Play tab has none. Nothing else differs', async () => {
    followerApi.feed.mockResolvedValue(ok({ posts: [VIDEO()], more: false }));
    const n = nav();
    const over = render(<Play navigation={n} route={{ name: 'PlayOver', params: { start: 'v1', at: 1 } }} />);
    await waitFor(() => over.getByTestId('reel-v1'));
    expect(followerApi.feed).toHaveBeenLastCalledWith(expect.objectContaining({ mode: 'play', start: 'v1' }));   // the tapped video first
    const back = over.getByTestId('play-back');
    expect(back.props.accessibilityLabel).toBe('Back');
    expect(StyleSheet.flatten(back.props.style)).toMatchObject({ position: 'absolute', top: 12, left: 12 });
    fireEvent.press(back);
    expect(n.goBack).toHaveBeenCalledTimes(1);
    over.getByTestId('reel-like-v1'); over.getByTestId('reel-shop-v1'); over.getByTestId('reel-bag-v1');
    const overTexts = texts(over.getByTestId('reel-v1'));
    over.unmount();

    const tab = render(<Play navigation={nav()} route={{ name: 'PlayTab', params: { start: 'v1', at: 2 } }} />);
    await waitFor(() => tab.getByTestId('reel-v1'));
    expect(tab.queryByTestId('play-back')).toBeNull();
    expect(texts(tab.getByTestId('reel-v1'))).toEqual(overTexts);    // the reel itself is the same
  });

  it('Back is there while the pushed Play is loading, and when it could not load', async () => {
    followerApi.feed.mockReturnValue(new Promise(() => {}));
    const n = nav();
    const loading = render(<Play navigation={n} route={{ name: 'PlayOver', params: { start: 'v1', at: 1 } }} />);
    fireEvent.press(loading.getByTestId('play-back'));
    expect(n.goBack).toHaveBeenCalledTimes(1);
    loading.unmount();
    followerApi.feed.mockResolvedValue(DOWN);
    const failed = render(<Play navigation={nav()} route={{ name: 'PlayOver', params: { start: 'v1', at: 1 } }} />);
    await waitFor(() => failed.getByText("Couldn't load. Check your connection."));
    failed.getByTestId('play-back');
  });

  it('from Play on top, a store opened and a video tapped there pushes ANOTHER Play — never a jump back to the one underneath', async () => {
    followerApi.creatorStore.mockResolvedValue(ok({ creator: SNEHA, followers: 1, following: false, brands: [], categories: [], tabs: {} }));
    followerApi.creatorPosts.mockResolvedValue(ok({ posts: [VIDEO({ id: 'v2' })], more: false }));
    const n = nav();
    const store = render(<CreatorStore navigation={n} route={{ params: { id: 'c-sneha' } }} />);
    await waitFor(() => store.getByTestId('creator-tile-v2'));
    fireEvent.press(store.getByTestId('creator-tile-v2'));
    expect(n.push).toHaveBeenCalledWith('PlayOver', expect.objectContaining({ start: 'v2' }));
    expect(n.navigate).not.toHaveBeenCalledWith('PlayOver', expect.anything());
  });

  it('PlayOver is the same screen as the Play tab, registered once under a name nothing else uses', () => {
    const src = fs.readFileSync(path.resolve(__dirname, '../../../navigation/FollowerNavigator.js'), 'utf8');
    expect(src.match(/<Stack\.Screen name="PlayOver" component=\{PlayScreen\} \/>/g)).toHaveLength(1);
    expect(src.match(/<Tab\.Screen name="PlayTab" component=\{PlayScreen\}/g)).toHaveLength(1);
    expect(src.match(/name="PlayOver"/g)).toHaveLength(1);
    expect(src.match(/import PlayScreen from/g)).toHaveLength(1);
    for (const other of ['BrandNavigator.js', 'InfluencerNavigator.js']) {
      expect(fs.readFileSync(path.resolve(__dirname, '../../../navigation', other), 'utf8')).not.toMatch(/PlayOver|ShopFollowing|ShopNotifications/);
    }
  });
});

/* ═══════════════════════════════════════════ F11 */

describe('F11 · her Welcome choices reach the feed when she returns', () => {
  const OPTS = {
    shop_for: [{ key: 'women', label: 'Women' }, { key: 'men', label: 'Men' }, { key: 'kids', label: 'Kids' }],
    styles: [{ id: 't1', name: 'Festive' }, { id: 't2', name: 'Casual' }],
    cities: [{ id: 7, name: 'Vijayawada', state: 'Andhra Pradesh' }],
    location_line: "We use your phone's location to show creators and stores near you. We never store it.",
  };

  it('"Show my feed" on Welcome, back on Home: the feed is loaded again with what she chose — without pulling to refresh', async () => {
    followerApi.feed.mockResolvedValue(ok({ posts: [POST()], more: false }));
    followerApi.welcome.mockResolvedValue(ok(OPTS));
    const r = render(<Home navigation={nav()} />);
    await waitFor(() => r.getByTestId('post-p1'));
    expect(followerApi.feed).toHaveBeenCalledTimes(1);
    expect(followerApi.feed).toHaveBeenLastCalledWith(expect.objectContaining({ mode: 'home', shop_for: [], styles: [] }));

    // Welcome is opened over Home; she picks Men and Casual and taps "Show my feed"
    const wn = nav();
    const w = render(<Welcome navigation={wn} route={{ params: { fromProfile: true } }} />);
    await waitFor(() => w.getByTestId('shop-for-men'));
    fireEvent.press(w.getByTestId('shop-for-men'));
    fireEvent.press(w.getByTestId('style-Casual'));
    await act(async () => { fireEvent.press(w.getByTestId('welcome-done')); });
    expect(wn.goBack).toHaveBeenCalledTimes(1);
    w.unmount();

    followerApi.feed.mockResolvedValue(ok({ posts: [POST({ id: 'm1' }), POST({ id: 'm2' })], more: false }));
    await comeBack();                                                // Home is in front again
    await waitFor(() => r.getByTestId('post-m1'));
    expect(followerApi.feed).toHaveBeenCalledTimes(2);
    expect(followerApi.feed).toHaveBeenLastCalledWith(expect.objectContaining({ mode: 'home', shop_for: ['men'], styles: ['t2'], served: [] }));
    expect(r.queryByTestId('post-p1')).toBeNull();                   // the old feed is replaced, not added to
  });

  it('coming back with the same choices changes nothing — not every return reloads', async () => {
    followerApi.feed.mockResolvedValue(ok({ posts: [POST()], more: false }));
    const r = render(<Home navigation={nav()} />);
    await waitFor(() => r.getByTestId('post-p1'));
    await comeBack();
    await comeBack();
    await shopStore.set({ follows: ['c-priya'], savedPosts: ['p1'], lastHome: new Date().toISOString() });   // things that are not her Welcome choices
    await comeBack();
    expect(followerApi.feed).toHaveBeenCalledTimes(1);
    expect(followerApi.circles).toHaveBeenCalledTimes(1);
  });

  it('a change of city, or of "use my location", is a change of choices too', async () => {
    followerApi.feed.mockResolvedValue(ok({ posts: [POST()], more: false }));
    const r = render(<Home navigation={nav()} />);
    await waitFor(() => r.getByTestId('post-p1'));
    await shopStore.set({ cityId: 7, cityName: 'Vijayawada' });
    await comeBack();
    await waitFor(() => expect(followerApi.feed).toHaveBeenCalledTimes(2));
    expect(followerApi.feed).toHaveBeenLastCalledWith(expect.objectContaining({ city_id: 7 }));
  });

  it('a reload for new choices is not dropped when the next page is still on its way', async () => {
    let arrive;
    followerApi.feed
      .mockResolvedValueOnce(ok({ posts: [POST({ id: 'a' })], more: true }))
      .mockReturnValueOnce(new Promise((resolve) => { arrive = resolve; }))
      .mockResolvedValueOnce(ok({ posts: [POST({ id: 'w1' })], more: false }));
    const r = render(<Home navigation={nav()} />);
    await waitFor(() => r.getByTestId('post-a'));
    await act(async () => { listOf(r).props.onEndReached(); });
    expect(followerApi.feed).toHaveBeenCalledTimes(2);
    await shopStore.set({ shopFor: ['women'] });
    await comeBack();
    await waitFor(() => r.getByTestId('post-w1'));
    await act(async () => { arrive(ok({ posts: [POST({ id: 'late' })], more: false })); });
    expect(ids(r)).toEqual(['w1']);
  });

  it('a Welcome that cannot load says so, with Try again and Skip — no endless spinner', async () => {
    await AsyncStorage.clear(); shopStore._reset();                  // first open: not welcomed yet
    followerApi.welcome.mockResolvedValueOnce(DOWN).mockResolvedValue(ok(OPTS));
    const n = nav();
    const r = render(<Welcome navigation={n} route={{ params: {} }} />);
    await waitFor(() => r.getByTestId('welcome-error'));
    r.getByText("Couldn't load. Check your connection."); r.getByText('Try again'); r.getByText('Skip');
    await act(async () => { fireEvent.press(r.getByText('Try again')); });
    expect(followerApi.welcome).toHaveBeenCalledTimes(2);
    await waitFor(() => r.getByText("Let's make your feed yours"));  // it loaded: the choices are there
    expect(r.queryByTestId('welcome-error')).toBeNull();
  });

  it('…Skip leaves it: first open is marked done so she is not sent back; from Profile her choices are untouched', async () => {
    await AsyncStorage.clear(); shopStore._reset();
    followerApi.welcome.mockResolvedValue(DOWN);
    const n = nav();
    const first = render(<Welcome navigation={n} route={{ params: {} }} />);
    await waitFor(() => first.getByTestId('welcome-error'));
    await act(async () => { fireEvent.press(first.getByTestId('welcome-skip')); });
    expect(n.goBack).toHaveBeenCalledTimes(1);
    expect((await shopStore.get()).welcomed).toBe(true);
    first.unmount();

    await shopStore.set({ shopFor: ['women'], styles: ['t1'], cityId: 7, cityName: 'Vijayawada' });
    const n2 = nav();
    const fromProfile = render(<Welcome navigation={n2} route={{ params: { fromProfile: true } }} />);
    await waitFor(() => fromProfile.getByTestId('welcome-error'));
    await act(async () => { fireEvent.press(fromProfile.getByTestId('welcome-skip')); });
    expect(n2.goBack).toHaveBeenCalledTimes(1);
    expect(await shopStore.get()).toMatchObject({ shopFor: ['women'], styles: ['t1'], cityId: 7 });
  });

  it('the server answering with something that is not the choices is a failed load too, not a crash', async () => {
    followerApi.welcome.mockResolvedValue(undefined);
    const r = render(<Welcome navigation={nav()} route={{ params: {} }} />);
    await waitFor(() => r.getByTestId('welcome-error'));
  });
});

/* ═══════════════════════════════════════════ F13 · F4 · F15 (Profile) */

describe('F13 · Profile', () => {
  const ME = (over = {}) => ({ name: 'Anusha', phone: '+91 98••• ••210', city: { id: 7, name: 'Vijayawada' }, name_needed: false,
    rows: { orders: '2 on the way', following: '1 creator', city: 'Vijayawada', shop_for: 'Women · Festive' }, ...over });

  it.each(['2 on the way', '3 orders', '1 order', 'No orders yet'])('Orders reads "%s" — the server\'s line, as sent', async (line) => {
    await signedIn();
    followerApi.profile.mockResolvedValue(ok(ME({ rows: { ...ME().rows, orders: line } })));
    const n = nav();
    const r = render(<Profile navigation={n} />);
    await waitFor(() => r.getByTestId('row-orders'));
    expect(texts(r.getByTestId('row-orders'))).toEqual(['Orders', line, '›']);
    fireEvent.press(r.getByTestId('row-orders'));
    expect(n.navigate).toHaveBeenCalledWith('Orders');
  });

  it('Returns reads "Return an item from My orders" and opens My orders — no "Coming next"', async () => {
    await signedIn();
    followerApi.profile.mockResolvedValue(ok(ME()));
    const n = nav();
    const r = render(<Profile navigation={n} />);
    await waitFor(() => r.getByTestId('row-returns'));
    expect(texts(r.getByTestId('row-returns'))).toEqual(['Returns', 'Return an item from My orders', '›']);
    expect(r.queryByText('Coming next')).toBeNull();
    expect(r.getByTestId('row-returns').props.accessibilityState.disabled).toBe(false);      // it was greyed and did nothing
    fireEvent.press(r.getByTestId('row-returns'));
    expect(n.navigate).toHaveBeenCalledWith('Orders');
  });

  it('Following shows the server\'s line ("1 creator") and opens the list of creators she follows', async () => {
    await signedIn();
    followerApi.profile.mockResolvedValue(ok(ME()));
    const n = nav();
    const r = render(<Profile navigation={n} />);
    await waitFor(() => r.getByTestId('profile-me'));
    expect(texts(r.getByTestId('row-following'))).toEqual(['Following', '1 creator', '›']);
    fireEvent.press(r.getByTestId('row-following'));                 // it did nothing
    expect(n.navigate).toHaveBeenCalledWith('ShopFollowing');
  });

  it.each([[[], '0 creators'], [['a'], '1 creator'], [['a', 'b'], '2 creators']])('a guest following %j reads "%s", and the row opens the list for her too', async (follows, line) => {
    await shopStore.set({ follows });
    const n = nav();
    const r = render(<Profile navigation={n} />);
    await waitFor(() => r.getByTestId('profile-guest'));
    expect(texts(r.getByTestId('row-following'))).toEqual(['Following', line, '›']);
    expect(r.queryByText('1 creators')).toBeNull();
    fireEvent.press(r.getByTestId('row-following'));
    expect(n.navigate).toHaveBeenCalledWith('ShopFollowing');
    expect(r.queryByTestId('row-notifications')).toBeNull();         // notifications are hers once signed in
  });

  it('F15 — a signed-in shopper has "Notifications", which opens the list', async () => {
    await signedIn();
    followerApi.profile.mockResolvedValue(ok(ME()));
    const n = nav();
    const r = render(<Profile navigation={n} />);
    await waitFor(() => r.getByTestId('row-notifications'));
    expect(texts(r.getByTestId('row-notifications'))).toEqual(['Notifications', '›']);
    fireEvent.press(r.getByTestId('row-notifications'));
    expect(n.navigate).toHaveBeenCalledWith('ShopNotifications');
  });

  it('F4 — she has given no name: "Add your name" in place of it, opening Edit profile — never "Follower"', async () => {
    await signedIn();
    followerApi.profile.mockResolvedValue(ok(ME({ name: 'Follower', name_needed: true })));
    const n = nav();
    const r = render(<Profile navigation={n} />);
    await waitFor(() => r.getByTestId('profile-add-name'));
    r.getByText('Add your name');
    expect(r.queryByText('Follower')).toBeNull();
    fireEvent.press(r.getByTestId('profile-add-name'));
    expect(n.navigate).toHaveBeenCalledWith('EditProfile');
  });

  it('F4 — she has a name: it shows, with no "Add your name"', async () => {
    await signedIn();
    followerApi.profile.mockResolvedValue(ok(ME()));
    const r = render(<Profile navigation={nav()} />);
    await waitFor(() => r.getByText('Anusha'));
    expect(r.queryByText('Add your name')).toBeNull();
  });

  it('F4 — Edit profile opens on an empty box when the name on her account is not one she gave', async () => {
    followerApi.getMe.mockResolvedValue(ok({ follower: { id: 'f1', name: 'Pending (3210)', phone: '+919876543210', email: null }, addresses: [], name_needed: true }));
    const r = render(<EditProfile navigation={nav()} />);
    const box = await waitFor(() => r.getByPlaceholderText('Your name'));
    expect(box.props.value).toBe('');
    r.unmount();
    followerApi.getMe.mockResolvedValue(ok({ follower: { id: 'f1', name: 'Anusha', phone: '+919876543210', email: null }, addresses: [], name_needed: false }));
    const named = render(<EditProfile navigation={nav()} />);
    expect((await waitFor(() => named.getByPlaceholderText('Your name'))).props.value).toBe('Anusha');
  });

  it('logging out forgets what was liked and saved in this session', async () => {
    await signedIn();
    followerApi.profile.mockResolvedValue(ok(ME()));
    engaged.setPost('p1', { liked: true, likes: 5 });
    engaged.setHeart('pr1', true, { post_id: 'p1' });
    const r = render(<Profile navigation={nav()} />);
    await waitFor(() => r.getByTestId('log-out'));
    await act(async () => { fireEvent.press(r.getByTestId('log-out')); });
    expect(engaged.post('p1')).toBeNull();
    expect(engaged.heartedInPost('p1', 'pr1', false)).toBe(false);
  });
});

describe('F13 · Profile › Following', () => {
  it('a signed-in shopper: the creators she follows — avatar and name; each opens that creator\'s store', async () => {
    await signedIn();
    await shopStore.set({ follows: ['left-on-the-phone'] });
    followerApi.following.mockResolvedValue(ok({ creators: [PRIYA, SNEHA] }));
    const n = nav();
    const r = render(<Following navigation={n} />);
    await waitFor(() => r.getByTestId('following-list'));
    expect(followerApi.following).toHaveBeenCalledWith([]);          // hers are on her account, not sent from the phone
    expect(texts(r.getByTestId('following-c-priya'))).toEqual(expect.arrayContaining(['Priya']));
    r.getByText('Sneha'); r.getByText('Following');
    fireEvent.press(r.getByTestId('following-c-sneha'));
    expect(n.navigate).toHaveBeenCalledWith('CreatorStore', { id: 'c-sneha', name: 'Sneha' });
    fireEvent.press(r.getByTestId('back'));
    expect(n.goBack).toHaveBeenCalledTimes(1);
  });

  it('a guest: her follows are on the phone, so they go with the request', async () => {
    await shopStore.set({ follows: ['c-priya', 'c-sneha'] });
    followerApi.following.mockResolvedValue(ok({ creators: [PRIYA, SNEHA] }));
    const r = render(<Following navigation={nav()} />);
    await waitFor(() => r.getByTestId('following-c-priya'));
    expect(followerApi.following).toHaveBeenCalledWith(['c-priya', 'c-sneha']);
  });

  it('following no one: "You don\'t follow anyone yet"', async () => {
    followerApi.following.mockResolvedValue(ok({ creators: [] }));
    const r = render(<Following navigation={nav()} />);
    await waitFor(() => r.getByTestId('following-empty'));
    r.getByText("You don't follow anyone yet");
  });

  it('it could not load: said plainly, with Try again', async () => {
    followerApi.following.mockResolvedValueOnce(DOWN).mockResolvedValue(ok({ creators: [PRIYA] }));
    const r = render(<Following navigation={nav()} />);
    await waitFor(() => r.getByTestId('following-error'));
    await act(async () => { fireEvent.press(r.getByText('Try again')); });
    await waitFor(() => r.getByTestId('following-c-priya'));
  });

  it('she unfollows someone in a store opened from here: back on the list, it is read again', async () => {
    followerApi.following.mockResolvedValue(ok({ creators: [PRIYA, SNEHA] }));
    const r = render(<Following navigation={nav()} />);
    await waitFor(() => r.getByTestId('following-c-sneha'));
    followerApi.following.mockResolvedValue(ok({ creators: [PRIYA] }));
    await comeBack();
    await waitFor(() => expect(r.queryByTestId('following-c-sneha')).toBeNull());
    r.getByTestId('following-c-priya');
  });

  it('is a screen of its own, registered once', () => {
    const src = fs.readFileSync(path.resolve(__dirname, '../../../navigation/FollowerNavigator.js'), 'utf8');
    expect(src.match(/<Stack\.Screen name="ShopFollowing" component=\{FollowingScreen\} \/>/g)).toHaveLength(1);
    expect(src.match(/<Stack\.Screen name="ShopNotifications" component=\{NotificationsScreen\} \/>/g)).toHaveLength(1);
    expect(src).toMatch(/import FollowingScreen from '\.\.\/screens\/shop\/FollowingScreen';/);
    expect(src).toMatch(/import NotificationsScreen from '\.\.\/screens\/shop\/NotificationsScreen';/);
  });
});

/* ═══════════════════════════════════════════ F15 (the list) */

describe('F15 · Profile › Notifications', () => {
  const N = (over = {}) => ({ id: 'n1', type: 'order_update', title: 'Out for delivery', body: 'Your Chanderi saree arrives today.',
    data_json: { screen: 'order', line_id: 'line-7' }, is_read: false, created_at: '2026-10-04T09:30:00.000Z', ...over });
  const bold = (r, id) => /Bold/.test(StyleSheet.flatten(r.getByTestId(`notification-title-${id}`).props.style).fontFamily);

  it('the latest ones, newest first as sent: title, words, when; unread ones bold; opening the list reads them all', async () => {
    followerApi.notifications.mockResolvedValue(ok({ unread_count: 1, notifications: [
      N(),
      N({ id: 'n2', title: 'Order placed', body: '2 items · ₹2,400', data_json: { screen: 'orders', checkout_id: 'co-1' }, is_read: true, created_at: '2026-10-03T08:00:00.000Z' }),
      N({ id: 'n3', title: 'Welcome to INFLX', body: null, data_json: null, is_read: true, created_at: '2026-09-28T08:00:00.000Z' }),
    ] }));
    followerApi.markNotificationsRead.mockResolvedValue(ok({ marked_read: true }));
    const n = nav();
    const r = render(<Notifications navigation={n} />);
    await waitFor(() => r.getByTestId('notifications-list'));
    r.getByText('Notifications');
    expect(listOf(r).props.data.map((x) => x.id)).toEqual(['n1', 'n2', 'n3']);
    expect(texts(r.getByTestId('notification-n1'))).toEqual(['Out for delivery', 'Your Chanderi saree arrives today.', whenLabel('2026-10-04T09:30:00.000Z'), '›']);
    expect(texts(r.getByTestId('notification-n3'))).toEqual(['Welcome to INFLX', whenLabel('2026-09-28T08:00:00.000Z')]);
    expect([bold(r, 'n1'), bold(r, 'n2'), bold(r, 'n3')]).toEqual([true, false, false]);
    expect(followerApi.markNotificationsRead).toHaveBeenCalledTimes(1);
    // tapping one about an order opens that order; one about a placed order opens My orders
    fireEvent.press(r.getByTestId('notification-n1'));
    expect(n.navigate).toHaveBeenLastCalledWith('OrderDetail', { lineId: 'line-7' });
    fireEvent.press(r.getByTestId('notification-n2'));
    expect(n.navigate).toHaveBeenLastCalledWith('Orders', undefined);
    // any other leads here, where she already is
    fireEvent.press(r.getByTestId('notification-n3'));
    expect(n.navigate).toHaveBeenCalledTimes(2);
    fireEvent.press(r.getByTestId('back'));
    expect(n.goBack).toHaveBeenCalledTimes(1);
  });

  it('what a notification carries may arrive as text: it opens the same', async () => {
    followerApi.notifications.mockResolvedValue(ok({ unread_count: 0, notifications: [N({ data_json: '{"screen":"order","line_id":"line-9"}', is_read: true })] }));
    const n = nav();
    const r = render(<Notifications navigation={n} />);
    await waitFor(() => r.getByTestId('notification-n1'));
    fireEvent.press(r.getByTestId('notification-n1'));
    expect(n.navigate).toHaveBeenCalledWith('OrderDetail', { lineId: 'line-9' });
  });

  it('none: "Nothing yet"', async () => {
    followerApi.notifications.mockResolvedValue(ok({ unread_count: 0, notifications: [] }));
    const r = render(<Notifications navigation={nav()} />);
    await waitFor(() => r.getByTestId('notifications-empty'));
    r.getByText('Nothing yet');
  });

  it('it could not load: Try again; nothing is marked read for a list she never saw', async () => {
    followerApi.notifications.mockResolvedValueOnce(DOWN).mockResolvedValue(ok({ unread_count: 1, notifications: [N()] }));
    const r = render(<Notifications navigation={nav()} />);
    await waitFor(() => r.getByTestId('notifications-error'));
    expect(followerApi.markNotificationsRead).not.toHaveBeenCalled();
    await act(async () => { fireEvent.press(r.getByText('Try again')); });
    await waitFor(() => r.getByTestId('notification-n1'));
    expect(followerApi.markNotificationsRead).toHaveBeenCalledTimes(1);
  });

  it('reading them failing does not disturb the list', async () => {
    followerApi.notifications.mockResolvedValue(ok({ unread_count: 1, notifications: [N()] }));
    followerApi.markNotificationsRead.mockRejectedValue(new Error('down'));
    const r = render(<Notifications navigation={nav()} />);
    await waitFor(() => r.getByTestId('notification-n1'));
    r.getByText('Out for delivery');
  });

  it('whenLabel: today is a time, another day is its date, another year says the year', () => {
    const now = new Date(2026, 9, 5, 18, 0, 0);
    expect(whenLabel(new Date(2026, 9, 5, 15, 40).toISOString(), now)).toBe('3:40 pm');
    expect(whenLabel(new Date(2026, 9, 5, 0, 5).toISOString(), now)).toBe('12:05 am');
    expect(whenLabel(new Date(2026, 9, 4, 23, 59).toISOString(), now)).toBe('4 Oct');
    expect(whenLabel(new Date(2025, 11, 31, 10, 0).toISOString(), now)).toBe('31 Dec 2025');
    expect(whenLabel(null, now)).toBe('');
    expect(whenLabel('not a date', now)).toBe('');
  });
});

/* ═══════════════════════════════════════════ F14 */

describe('F14 · what she liked, bookmarked or hearted stays so on every screen', () => {
  it('a like on Home shows on the post\'s page, which was handed the post as the feed first sent it — and an unlike there shows back on Home', async () => {
    await signedIn();
    followerApi.feed.mockResolvedValue(ok({ posts: [POST()], more: false }));
    followerApi.more.mockResolvedValue(ok({ posts: [], more: false }));
    followerApi.like.mockResolvedValue(ok({ liked: true, likes: 419 }));
    followerApi.unlike.mockResolvedValue(ok({ liked: false, likes: 418 }));
    const hn = nav();
    const home = render(<Home navigation={hn} />);
    await waitFor(() => home.getByTestId('post-like-p1'));
    expect(liked(home, 'p1')).toBe(false);
    await act(async () => { fireEvent.press(home.getByTestId('post-like-p1')); });
    expect(liked(home, 'p1')).toBe(true);
    home.getByText('419');

    // she opens the post: its page gets the card as the feed sent it (not liked, 418)
    fireEvent.press(home.getByTestId('post-open-p1'));
    const handed = hn.navigate.mock.calls.find((c) => c[0] === 'Post')[1];
    expect(handed.post.mine.liked).toBe(false);
    expect(handed.post.counts.likes).toBe(418);
    const page = render(<Post navigation={nav()} route={{ params: handed }} />);
    await waitFor(() => page.getByTestId('post-like-p1'));
    expect(liked(page, 'p1')).toBe(true);                            // it looked undone here
    page.getByText('419');

    // she takes the like off on the post's page; Home, still underneath, follows
    await act(async () => { fireEvent.press(page.getByTestId('post-like-p1')); });
    expect(followerApi.unlike).toHaveBeenCalledWith('p1');
    expect(liked(page, 'p1')).toBe(false);
    expect(liked(home, 'p1')).toBe(false);
    home.getByText('418');
  });

  it('the same in Play: a video liked in a feed is liked on its reel, and a like on the reel shows on the card', async () => {
    await signedIn();
    followerApi.feed.mockResolvedValue(ok({ posts: [VIDEO()], more: false }));
    followerApi.like.mockResolvedValue(ok({ liked: true, likes: 419 }));
    followerApi.unlike.mockResolvedValue(ok({ liked: false, likes: 418 }));
    const home = render(<Home navigation={nav()} />);
    await waitFor(() => home.getByTestId('post-like-v1'));
    await act(async () => { fireEvent.press(home.getByTestId('post-like-v1')); });
    const play = render(<Play navigation={nav()} route={{ name: 'PlayTab', params: { start: 'v1', at: 1 } }} />);
    await waitFor(() => play.getByTestId('reel-v1'));
    expect(texts(play.getByTestId('reel-like-v1'))).toEqual(['heart', '419']);       // filled, with the new count
    await act(async () => { fireEvent.press(play.getByTestId('reel-like-v1')); });
    expect(texts(play.getByTestId('reel-like-v1'))).toEqual(['heart-outline', '418']);
    expect(liked(home, 'v1')).toBe(false);
  });

  it('a bookmark given on one screen shows on the next (signed in) — and "Saved" on the reel', async () => {
    await signedIn();
    followerApi.feed.mockResolvedValue(ok({ posts: [VIDEO()], more: false }));
    followerApi.more.mockResolvedValue(ok({ posts: [], more: false }));
    followerApi.save.mockResolvedValue(ok({ saved: true }));
    const home = render(<Home navigation={nav()} />);
    await waitFor(() => home.getByTestId('post-save-v1'));
    await act(async () => { fireEvent.press(home.getByTestId('post-save-v1')); });
    expect(followerApi.save).toHaveBeenCalledWith('v1');
    const page = render(<Post navigation={nav()} route={{ params: { postId: 'v1', post: VIDEO() } }} />);
    await waitFor(() => page.getByTestId('post-save-v1'));
    expect(bookmarked(page, 'v1')).toBe(true);
    const play = render(<Play navigation={nav()} route={{ name: 'PlayTab', params: { start: 'v1', at: 1 } }} />);
    await waitFor(() => play.getByTestId('reel-v1'));
    expect(texts(play.getByTestId('reel-save-v1'))).toEqual(['bookmark', 'Saved']);
  });

  it('a guest\'s bookmark does too, and is still kept on the phone', async () => {
    followerApi.feed.mockResolvedValue(ok({ posts: [POST()], more: false }));
    followerApi.more.mockResolvedValue(ok({ posts: [], more: false }));
    const home = render(<Home navigation={nav()} />);
    await waitFor(() => home.getByTestId('post-save-p1'));
    const page = render(<Post navigation={nav()} route={{ params: { postId: 'p1', post: POST() } }} />);
    await waitFor(() => page.getByTestId('post-save-p1'));
    await act(async () => { fireEvent.press(page.getByTestId('post-save-p1')); });       // on the post's page…
    expect(bookmarked(home, 'p1')).toBe(true);                       // …and the card under it shows it
    expect((await shopStore.get()).savedPosts).toEqual(['p1']);
    expect(followerApi.save).not.toHaveBeenCalled();
  });

  it('a like her account could not keep goes back — on every card of that post', async () => {
    await signedIn();
    followerApi.feed.mockResolvedValue(ok({ posts: [POST()], more: false }));
    followerApi.more.mockResolvedValue(ok({ posts: [], more: false }));
    followerApi.like.mockResolvedValue(DOWN);
    followerApi.save.mockResolvedValue(DOWN);
    const home = render(<Home navigation={nav()} />);
    await waitFor(() => home.getByTestId('post-like-p1'));
    const page = render(<Post navigation={nav()} route={{ params: { postId: 'p1', post: POST() } }} />);
    await waitFor(() => page.getByTestId('post-like-p1'));
    await act(async () => { fireEvent.press(page.getByTestId('post-like-p1')); });
    expect([liked(page, 'p1'), liked(home, 'p1')]).toEqual([false, false]);
    expect(home.getAllByText('418')).toHaveLength(1);
    await act(async () => { fireEvent.press(page.getByTestId('post-save-p1')); });
    expect([bookmarked(page, 'p1'), bookmarked(home, 'p1')]).toEqual([false, false]);
    // and nothing false is remembered for the next screen
    const again = render(<Post navigation={nav()} route={{ params: { postId: 'p1', post: POST() } }} />);
    await waitFor(() => again.getByTestId('post-like-p1'));
    expect(liked(again, 'p1')).toBe(false);
  });

  it('a post she has not touched shows what the server said about it', async () => {
    await signedIn();
    followerApi.more.mockResolvedValue(ok({ posts: [], more: false }));
    const page = render(<Post navigation={nav()} route={{ params: { postId: 'p1', post: POST({ mine: { liked: true, saved: true, saved_products: [] } }) } }} />);
    await waitFor(() => page.getByTestId('post-like-p1'));
    expect([liked(page, 'p1'), bookmarked(page, 'p1')]).toEqual([true, true]);
    page.getByText('418');
  });

  function Sheet({ post }) { return <ShopSheet post={post} visible={!!post} onClose={() => {}} surface="home" />; }
  const hearted = (r, id) => r.getByTestId(`shop-heart-${id}`).props.accessibilityState.selected;

  it('a heart in "Products in this post" is still there when the sheet is opened again — it was rebuilt from the feed\'s old answer', async () => {
    await signedIn();
    followerApi.deal.mockResolvedValue(ok(DEAL()));
    followerApi.saveProduct.mockResolvedValue(ok({ saved: true }));
    followerApi.unsaveProduct.mockResolvedValue(ok({ saved: false }));
    const post = POST();                                             // the card as the feed sent it: nothing hearted
    const r = render(<Sheet post={post} />);
    await r.findByTestId('shop-sheet');
    expect(hearted(r, 'pr2')).toBe(false);
    await act(async () => { fireEvent.press(r.getByTestId('shop-heart-pr2')); });
    expect(followerApi.saveProduct).toHaveBeenCalledWith({ product_id: 'pr2', post_id: 'p1' });
    r.rerender(<Sheet post={null} />);                               // she closes the sheet…
    await act(async () => { r.rerender(<Sheet post={post} />); });   // …and opens it again on the same card
    await r.findByTestId('shop-sheet');
    await waitFor(() => expect(hearted(r, 'pr2')).toBe(true));
    expect(hearted(r, 'pr1')).toBe(false);

    // taken off, it stays off — even on a card that still says it was saved
    await act(async () => { fireEvent.press(r.getByTestId('shop-heart-pr2')); });
    expect(followerApi.unsaveProduct).toHaveBeenCalledWith('pr2');
    r.rerender(<Sheet post={null} />);
    await act(async () => { r.rerender(<Sheet post={POST({ mine: { liked: false, saved: false, saved_products: ['pr2'] } })} />); });
    await r.findByTestId('shop-sheet');
    await waitFor(() => expect(followerApi.deal).toHaveBeenCalledTimes(3));
    expect(hearted(r, 'pr2')).toBe(false);
  });

  it('hearts the server sent with the card still show; a heart her account refused is not remembered', async () => {
    await signedIn();
    followerApi.deal.mockResolvedValue(ok(DEAL()));
    followerApi.saveProduct.mockResolvedValue(DOWN);
    const r = render(<Sheet post={POST({ mine: { liked: false, saved: false, saved_products: ['pr1'] } })} />);
    await r.findByTestId('shop-sheet');
    await waitFor(() => expect(hearted(r, 'pr1')).toBe(true));
    await act(async () => { fireEvent.press(r.getByTestId('shop-heart-pr2')); });
    expect(hearted(r, 'pr2')).toBe(false);                           // it went back
    r.rerender(<Sheet post={null} />);
    await act(async () => { r.rerender(<Sheet post={POST({ mine: { liked: false, saved: false, saved_products: ['pr1'] } })} />); });
    await r.findByTestId('shop-sheet');
    await waitFor(() => expect(hearted(r, 'pr1')).toBe(true));
    expect(hearted(r, 'pr2')).toBe(false);
  });

  it('a product is saved with ONE post: hearted in another post, it is no longer hearted in the first', async () => {
    await signedIn();
    followerApi.deal.mockResolvedValue(ok(DEAL()));
    followerApi.saveProduct.mockResolvedValue(ok({ saved: true }));
    const a = render(<Sheet post={POST()} />);
    await a.findByTestId('shop-sheet');
    await act(async () => { fireEvent.press(a.getByTestId('shop-heart-pr2')); });
    a.unmount();
    const b = render(<Sheet post={POST({ id: 'p9' })} />);           // another post carrying the same product
    await b.findByTestId('shop-sheet');
    expect(hearted(b, 'pr2')).toBe(false);                           // saved with p1, not with this one
    await act(async () => { fireEvent.press(b.getByTestId('shop-heart-pr2')); });
    expect(followerApi.saveProduct).toHaveBeenLastCalledWith({ product_id: 'pr2', post_id: 'p9' });
    b.unmount();
    const again = render(<Sheet post={POST()} />);
    await again.findByTestId('shop-sheet');
    await waitFor(() => expect(followerApi.deal).toHaveBeenCalledTimes(3));
    expect(hearted(again, 'pr2')).toBe(false);
  });

  it('the product page opened on its own shows the heart she gave in this session', async () => {
    await signedIn();
    followerApi.saveProduct.mockResolvedValue(ok({ saved: true }));
    const first = render(<Product navigation={nav()} route={{ params: { postId: 'p1', productId: 'pr2', data: DEAL() } }} />);
    await first.findByTestId('product-page');
    expect(first.getByTestId('product-heart').props.accessibilityState.selected).toBe(false);
    await act(async () => { fireEvent.press(first.getByTestId('product-heart')); });
    first.unmount();
    const again = render(<Product navigation={nav()} route={{ params: { postId: 'p1', productId: 'pr2', data: DEAL() } }} />);
    await again.findByTestId('product-page');
    expect(again.getByTestId('product-heart').props.accessibilityState.selected).toBe(true);
  });

  const COLLECTION = (over = {}) => ({ id: 'col2', name: 'My Dasara picks', kind: 'products', count: 2, hidden: false, creator: PRIYA, line: 'My Dasara picks · 2 products',
    products: [
      { collection_item_id: 'ci1', id: 'pr2', name: 'Chanderi saree', image_url: null, brand: SLS, price: 1800, shopper_price: 1440, struck: true, offer: { line: '20% off applied' }, saved: true },
      { collection_item_id: 'ci2', id: 'pr9', name: 'Cotton kurta', image_url: null, brand: SLS, price: 999, shopper_price: 999, struck: false, offer: null, saved: false },
    ], ...over });
  const inCollection = (r, id) => r.getByTestId(`collection-heart-${id}`).props.accessibilityState.selected;

  it('a collection shows a signed-in shopper her hearts (the server\'s `saved` on each product) — she never saw them', async () => {
    await signedIn();
    followerApi.collection.mockResolvedValue(ok(COLLECTION()));
    followerApi.saveProduct.mockResolvedValue(ok({ saved: true }));
    followerApi.unsaveProduct.mockResolvedValue(ok({ saved: false }));
    const r = render(<Collection navigation={nav()} route={{ params: { id: 'col2' } }} />);
    await waitFor(() => r.getByTestId('collection-title'));
    await waitFor(() => expect(inCollection(r, 'pr2')).toBe(true));
    expect(inCollection(r, 'pr9')).toBe(false);
    // she hearts the other and takes the first off; opened again from an answer that is a moment old, both hold
    await act(async () => { fireEvent.press(r.getByTestId('collection-heart-pr9')); });
    expect(followerApi.saveProduct).toHaveBeenCalledWith({ product_id: 'pr9', collection_item_id: 'ci2' });
    await act(async () => { fireEvent.press(r.getByTestId('collection-heart-pr2')); });
    expect(followerApi.unsaveProduct).toHaveBeenCalledWith('pr2');
    r.unmount();
    const again = render(<Collection navigation={nav()} route={{ params: { id: 'col2' } }} />);
    await waitFor(() => again.getByTestId('collection-title'));
    await waitFor(() => expect(inCollection(again, 'pr9')).toBe(true));
    expect(inCollection(again, 'pr2')).toBe(false);
  });

  it('a guest\'s collection hearts are the phone\'s, as before (the server always sends saved: false for her)', async () => {
    await shopStore.set({ savedProducts: [{ product_id: 'pr9', post_id: null, collection_item_id: 'ci2' }] });
    followerApi.collection.mockResolvedValue(ok(COLLECTION({ products: COLLECTION().products.map((p) => ({ ...p, saved: false })) })));
    const r = render(<Collection navigation={nav()} route={{ params: { id: 'col2' } }} />);
    await waitFor(() => r.getByTestId('collection-title'));
    await waitFor(() => expect(inCollection(r, 'pr9')).toBe(true));
    expect(inCollection(r, 'pr2')).toBe(false);
  });

  it('N8 — the collection keeps only the sentence that is true', async () => {
    followerApi.collection.mockResolvedValue(ok(COLLECTION()));
    const r = render(<Collection navigation={nav()} route={{ params: { id: 'col2' } }} />);
    await waitFor(() => r.getByTestId('collection-title'));
    expect(r.getByTestId('collection-how-to-buy').props.children).toBe("To buy one, open it from a creator's post. Save what you like here for now.");
    expect(r.queryByText(/one-product post/)).toBeNull();
    expect(r.queryByText(/A collection can mix brands/)).toBeNull();
    expect(fs.readFileSync(path.resolve(__dirname, '../../../components/shop/copyShop.js'), 'utf8')).not.toMatch(/collectionFoot:/);
  });

  const SAVED = () => ({ posts: [], products: [
    { product_id: 'pr2', post_id: 'p1', name: 'Chanderi saree', price: 1800, shopper_price: 1440, struck: true, available: true, from: "From Priya's post · 20% off till 31 Oct" },
    { product_id: 'tee', post_id: 'pd', name: 'Classic crew tee', price: 699, available: false, gone_line: "No longer available with this offer. Divya's post ended on 15 Oct.", other_posts: [], other_line: null },
  ] });

  it('Saved › Products: every saved product has Remove — one that can be bought, and one whose post has ended (signed in)', async () => {
    await signedIn();
    followerApi.saved.mockResolvedValue(ok(SAVED()));
    followerApi.unsaveProduct.mockResolvedValue(ok({ saved: false }));
    const r = render(<Saved navigation={nav()} />);
    await waitFor(() => r.getByText('Products · 2'));
    fireEvent.press(r.getByTestId('saved-tab-products'));
    expect(texts(r.getByTestId('saved-remove-pr2'))).toEqual(['Remove']);
    expect(texts(r.getByTestId('saved-remove-tee'))).toEqual(['Remove']);
    // the one whose post has ended could never be taken out
    await act(async () => { fireEvent.press(r.getByTestId('saved-remove-tee')); });
    expect(followerApi.unsaveProduct).toHaveBeenCalledWith('tee');
    expect(r.queryByTestId('saved-product-tee')).toBeNull();
    r.getByText('Products · 1');
    await act(async () => { fireEvent.press(r.getByTestId('saved-remove-pr2')); });
    expect(followerApi.unsaveProduct).toHaveBeenCalledWith('pr2');
    r.getByText('Products · 0');
    r.getByText('Tap the heart on a product in Shop this post to keep it here, with its offer.');
  });

  it('Saved › Products: a guest\'s is removed from the phone', async () => {
    await shopStore.set({ savedProducts: [{ product_id: 'pr2', post_id: 'p1', collection_item_id: null }, { product_id: 'tee', post_id: 'pd', collection_item_id: null }] });
    followerApi.resolveSaved.mockResolvedValue(ok(SAVED()));
    const r = render(<Saved navigation={nav()} />);
    await waitFor(() => r.getByText('Products · 2'));
    fireEvent.press(r.getByTestId('saved-tab-products'));
    await act(async () => { fireEvent.press(r.getByTestId('saved-remove-tee')); });
    expect((await shopStore.get()).savedProducts).toEqual([{ product_id: 'pr2', post_id: 'p1', collection_item_id: null }]);
    expect(followerApi.unsaveProduct).not.toHaveBeenCalled();
    expect(r.queryByTestId('saved-product-tee')).toBeNull();
    r.getByTestId('saved-product-pr2');
  });

  it('Saved › Products: it could not be removed from her account — the list shows what is really saved', async () => {
    await signedIn();
    followerApi.saved.mockResolvedValue(ok(SAVED()));
    followerApi.unsaveProduct.mockResolvedValue(DOWN);
    const r = render(<Saved navigation={nav()} />);
    await waitFor(() => r.getByText('Products · 2'));
    fireEvent.press(r.getByTestId('saved-tab-products'));
    await act(async () => { fireEvent.press(r.getByTestId('saved-remove-pr2')); });
    await waitFor(() => r.getByTestId('saved-product-pr2'));
    r.getByText('Products · 2');
  });

  it('removed from Saved, its heart is off in the post\'s sheet too', async () => {
    await signedIn();
    followerApi.saved.mockResolvedValue(ok(SAVED()));
    followerApi.unsaveProduct.mockResolvedValue(ok({ saved: false }));
    followerApi.deal.mockResolvedValue(ok(DEAL()));
    const saved = render(<Saved navigation={nav()} />);
    await waitFor(() => saved.getByText('Products · 2'));
    fireEvent.press(saved.getByTestId('saved-tab-products'));
    await act(async () => { fireEvent.press(saved.getByTestId('saved-remove-pr2')); });
    const sheet = render(<Sheet post={POST({ mine: { liked: false, saved: false, saved_products: ['pr2'] } })} />);   // an older card still says it is saved
    await sheet.findByTestId('shop-sheet');
    await waitFor(() => expect(followerApi.deal).toHaveBeenCalled());
    expect(hearted(sheet, 'pr2')).toBe(false);
  });
});

/* ═══════════════════════════════════════════ N1 */

describe('N1 · an ended post says so in the server\'s words; a failed load has Try again', () => {
  function Sheet({ post, onClose = () => {} }) { return <ShopSheet post={post} visible={!!post} onClose={onClose} surface="home" />; }

  it('Products in this post — the post has ended: "This post is no longer in the shop", and nothing to buy', async () => {
    followerApi.deal.mockResolvedValue(ENDED);
    const onClose = jest.fn();
    const r = render(<Sheet post={POST()} onClose={onClose} />);
    await r.findByTestId('shop-sheet-ended');
    expect(r.getByTestId('shop-sheet-ended').props.children).toBe('This post is no longer in the shop');
    r.getByText('Products in this post');
    expect(r.queryByText("Couldn't load. Check your connection.")).toBeNull();     // it is not a failed load
    expect(r.queryByText('Try again')).toBeNull();
    expect(r.queryByTestId('shop-grid')).toBeNull();
    expect(r.queryByTestId('shop-add-pr1')).toBeNull();
    expect(r.queryByTestId('build-deal')).toBeNull();
    fireEvent.press(r.getByTestId('shop-sheet-close'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('whatever sentence the server gives is the one shown', async () => {
    followerApi.deal.mockResolvedValue({ success: false, error: { code: 'NOT_FOUND', message: 'This offer has ended' } });
    const r = render(<Sheet post={POST()} />);
    await r.findByTestId('shop-sheet-ended');
    r.getByText('This offer has ended');
  });

  it('Products in this post — a real failed load: "Couldn\'t load", with Try again that asks once more', async () => {
    followerApi.deal.mockResolvedValueOnce(DOWN).mockResolvedValue(ok(DEAL()));
    const r = render(<Sheet post={POST()} />);
    await r.findByTestId('shop-sheet-failed');
    r.getByText("Couldn't load. Check your connection."); r.getByText('Try again');
    expect(r.queryByTestId('shop-sheet-ended')).toBeNull();
    r.getByTestId('shop-grid');                                      // the products of the card are still shown
    await act(async () => { fireEvent.press(r.getByTestId('shop-sheet-retry')); });
    expect(followerApi.deal).toHaveBeenCalledTimes(2);
    await waitFor(() => expect(r.queryByTestId('shop-sheet-failed')).toBeNull());
    // and now a size can be chosen
    fireEvent.press(r.getByTestId('shop-add-pr1'));
    await r.findByTestId('size-sheet');
    expect(r.queryByTestId('size-sheet-problem')).toBeNull();
    r.getByTestId('size-sheet-size-Free');
  });

  it('the sheet opened again on a live post is not left saying "ended"', async () => {
    followerApi.deal.mockResolvedValueOnce(ENDED).mockResolvedValue(ok(DEAL()));
    const r = render(<Sheet post={POST()} />);
    await r.findByTestId('shop-sheet-ended');
    r.rerender(<Sheet post={null} />);
    await act(async () => { r.rerender(<Sheet post={POST({ id: 'p2' })} />); });
    await r.findByTestId('shop-grid');
    expect(r.queryByTestId('shop-sheet-ended')).toBeNull();
  });

  it('the product page — the post has ended: the server\'s sentence, no Try again', async () => {
    followerApi.deal.mockResolvedValue(ENDED);
    const n = nav();
    const r = render(<Product navigation={n} route={{ params: { postId: 'p1', productId: 'pr1' } }} />);
    await r.findByTestId('product-gone');
    r.getByText('This post is no longer in the shop');
    expect(r.queryByText("Couldn't load. Check your connection.")).toBeNull();
    expect(r.queryByText('Try again')).toBeNull();
    fireEvent.press(r.getByTestId('back'));
    expect(n.goBack).toHaveBeenCalledTimes(1);
  });

  it('the product page — a real failed load: Try again loads it', async () => {
    followerApi.deal.mockResolvedValueOnce(DOWN).mockResolvedValue(ok(DEAL()));
    const r = render(<Product navigation={nav()} route={{ params: { postId: 'p1', productId: 'pr1' } }} />);
    await r.findByTestId('product-gone');
    r.getByText("Couldn't load. Check your connection.");
    await act(async () => { fireEvent.press(r.getByText('Try again')); });
    expect(followerApi.deal).toHaveBeenCalledTimes(2);
    await r.findByTestId('product-page');
    expect(r.getByTestId('product-name').props.children).toBe('Mangalagiri cotton saree');
  });

  it('the product page — failed, then ended on the second try: the sentence replaces "Couldn\'t load"', async () => {
    followerApi.deal.mockResolvedValueOnce(DOWN).mockResolvedValue(ENDED);
    const r = render(<Product navigation={nav()} route={{ params: { postId: 'p1', productId: 'pr1' } }} />);
    await r.findByTestId('product-gone');
    await act(async () => { fireEvent.press(r.getByText('Try again')); });
    await waitFor(() => r.getByText('This post is no longer in the shop'));
    expect(r.queryByText('Try again')).toBeNull();
  });
});

/* ═══════════════════════════════════════════ N5 */

describe('N5 · the next ones load as she reaches the end of the list — no button', () => {
  const P = (i) => POST({ id: `p${i}` });
  const STORE = { creator: PRIYA, followers: 12, following: false, brands: [], categories: [{ id: 'l1', name: 'Sarees', posts: 3 }], tabs: {} };

  it('a creator\'s store: the next 20 at the end of the page, sent the server\'s `next`; nothing asked before the end; none after the last', async () => {
    followerApi.creatorStore.mockResolvedValue(ok(STORE));
    followerApi.creatorPosts.mockImplementation((id, params) => Promise.resolve(ok(params.offset === 20
      ? { posts: range(21, 25).map(P), more: false, next: 25 }
      : { posts: range(1, 20).map(P), more: true, next: 20 })));
    const r = render(<CreatorStore navigation={nav()} route={{ params: { id: 'c-priya' } }} />);
    await waitFor(() => r.getByTestId('creator-tile-p20'));
    expect(followerApi.creatorPosts).toHaveBeenCalledTimes(1);
    expect(r.queryByText(/load more/i)).toBeNull();
    fireEvent.scroll(r.getByTestId('creator-store'), atTop);         // still near the top
    expect(followerApi.creatorPosts).toHaveBeenCalledTimes(1);
    await act(async () => { fireEvent.scroll(r.getByTestId('creator-store'), atEnd); });
    expect(followerApi.creatorPosts).toHaveBeenLastCalledWith('c-priya', { tab: 'posts', category: undefined, offset: 20 });
    await waitFor(() => r.getByTestId('creator-tile-p25'));
    r.getByTestId('creator-tile-p1');                                // added to, not replaced
    await act(async () => { fireEvent.scroll(r.getByTestId('creator-store'), atEnd); });
    expect(followerApi.creatorPosts).toHaveBeenCalledTimes(2);       // the server said there is no more
  });

  it('a creator\'s store: the tab and category on screen go with it, and changing them starts again from the first', async () => {
    followerApi.creatorStore.mockResolvedValue(ok(STORE));
    followerApi.creatorPosts.mockImplementation((id, params) => Promise.resolve(ok({ posts: [P(`${params.tab}-${params.category || 'all'}-${params.offset || 0}`)], more: true, next: (params.offset || 0) + 20 })));
    const r = render(<CreatorStore navigation={nav()} route={{ params: { id: 'c-priya' } }} />);
    await waitFor(() => r.getByTestId('creator-tile-pposts-all-0'));
    fireEvent.press(r.getByTestId('tab-videos'));
    await waitFor(() => r.getByTestId('creator-tile-pvideos-all-0'));
    fireEvent.press(r.getByTestId('cat-Sarees'));
    await waitFor(() => r.getByTestId('creator-tile-pvideos-l1-0'));
    await act(async () => { fireEvent.scroll(r.getByTestId('creator-store'), atEnd); });
    expect(followerApi.creatorPosts).toHaveBeenLastCalledWith('c-priya', { tab: 'videos', category: 'l1', offset: 20 });
    await waitFor(() => r.getByTestId('creator-tile-pvideos-l1-20'));
    expect(r.queryByTestId('creator-tile-pposts-all-0')).toBeNull();
  });

  it('a creator\'s store: Collections has no more to load, and a second reach of the end while one is on its way asks once', async () => {
    let arrive;
    followerApi.creatorStore.mockResolvedValue(ok(STORE));
    followerApi.creatorPosts
      .mockResolvedValueOnce(ok({ posts: range(1, 20).map(P), more: true, next: 20 }))
      .mockReturnValueOnce(new Promise((resolve) => { arrive = resolve; }));
    followerApi.creatorCollections.mockResolvedValue(ok({ collections: [] }));
    const r = render(<CreatorStore navigation={nav()} route={{ params: { id: 'c-priya' } }} />);
    await waitFor(() => r.getByTestId('creator-tile-p20'));
    await act(async () => { fireEvent.scroll(r.getByTestId('creator-store'), atEnd); });
    await act(async () => { fireEvent.scroll(r.getByTestId('creator-store'), atEnd); });
    expect(followerApi.creatorPosts).toHaveBeenCalledTimes(2);
    await act(async () => { arrive(ok({ posts: [P(21)], more: false, next: 21 })); });
    await waitFor(() => r.getByTestId('creator-tile-p21'));
    fireEvent.press(r.getByTestId('tab-collections'));
    await waitFor(() => r.getByText('No collections yet.'));
    await act(async () => { fireEvent.scroll(r.getByTestId('creator-store'), atEnd); });
    expect(followerApi.creatorPosts).toHaveBeenCalledTimes(2);
  });

  it('a brand\'s store: the same, with the category and creator on screen', async () => {
    followerApi.brandStore.mockResolvedValue(ok({ brand: SLS, line: 'Vijayawada · 2 creators', categories: [{ id: 'l1', name: 'Sarees' }], creators: [PRIYA], offers_count: 0 }));
    followerApi.brandPosts.mockImplementation((id, params) => Promise.resolve(ok(params.offset
      ? { posts: range(21, 23).map(P), more: false, next: 23 }
      : { posts: range(1, 20).map(P), more: true, next: 20 })));
    const r = render(<BrandStore navigation={nav()} route={{ params: { id: 'b-sls' } }} />);
    await waitFor(() => r.getByTestId('brand-tile-p20'));
    fireEvent.scroll(r.getByTestId('brand-store'), atTop);
    expect(followerApi.brandPosts).toHaveBeenCalledTimes(1);
    await act(async () => { fireEvent.scroll(r.getByTestId('brand-store'), atEnd); });
    expect(followerApi.brandPosts).toHaveBeenLastCalledWith('b-sls', { category: undefined, creator: undefined, offset: 20 });
    await waitFor(() => r.getByTestId('brand-tile-p23'));
    r.getByTestId('brand-tile-p1');
    await act(async () => { fireEvent.scroll(r.getByTestId('brand-store'), atEnd); });
    expect(followerApi.brandPosts).toHaveBeenCalledTimes(2);
    // a category chosen starts from the first again
    fireEvent.press(r.getByTestId('brand-cat-Sarees'));
    await waitFor(() => expect(followerApi.brandPosts).toHaveBeenLastCalledWith('b-sls', { category: 'l1', creator: undefined }));
  });

  it('an offer\'s posts: the next ones at the end of the list, for that offer', async () => {
    followerApi.brandPosts.mockImplementation((id, params) => Promise.resolve(ok(params.offset
      ? { posts: range(21, 22).map(P), more: false, next: 22 }
      : { posts: range(1, 20).map(P), more: true, next: 20 })));
    const r = render(<OfferPosts navigation={nav()} route={{ params: { brandId: 'b-sls', offerId: 'o1', title: '20% off festive sarees' } }} />);
    await waitFor(() => r.getByTestId('offer-posts'));
    expect(ids(r)).toHaveLength(20);
    expect(followerApi.brandPosts).toHaveBeenLastCalledWith('b-sls', { offer: 'o1' });
    await act(async () => { listOf(r).props.onEndReached(); });
    expect(followerApi.brandPosts).toHaveBeenLastCalledWith('b-sls', { offer: 'o1', offset: 20 });
    expect(ids(r)).toEqual(range(1, 22).map((i) => `p${i}`));
    await act(async () => { listOf(r).props.onEndReached(); });
    expect(followerApi.brandPosts).toHaveBeenCalledTimes(2);
  });

  it('a page that could not load is asked for again at the next reach of the end; a post sent twice shows once', async () => {
    followerApi.brandPosts
      .mockResolvedValueOnce(ok({ posts: range(1, 20).map(P), more: true, next: 20 }))
      .mockResolvedValueOnce(DOWN)
      .mockResolvedValueOnce(ok({ posts: [P(20), P(21)], more: false, next: 22 }));
    const r = render(<OfferPosts navigation={nav()} route={{ params: { brandId: 'b-sls', offerId: 'o1', title: 'x' } }} />);
    await waitFor(() => r.getByTestId('offer-posts'));
    await act(async () => { listOf(r).props.onEndReached(); });
    expect(ids(r)).toHaveLength(20);
    await act(async () => { listOf(r).props.onEndReached(); });
    expect(followerApi.brandPosts).toHaveBeenLastCalledWith('b-sls', { offer: 'o1', offset: 20 });
    expect(ids(r)).toEqual(range(1, 21).map((i) => `p${i}`));
  });

  it('an older server that sends no `next`: the count of what is shown is the next offset', async () => {
    followerApi.brandPosts
      .mockResolvedValueOnce(ok({ posts: range(1, 20).map(P), more: true }))
      .mockResolvedValueOnce(ok({ posts: range(21, 40).map(P), more: true }))
      .mockResolvedValueOnce(ok({ posts: [], more: true }));
    const r = render(<OfferPosts navigation={nav()} route={{ params: { brandId: 'b-sls', offerId: 'o1', title: 'x' } }} />);
    await waitFor(() => r.getByTestId('offer-posts'));
    await act(async () => { listOf(r).props.onEndReached(); });
    expect(followerApi.brandPosts).toHaveBeenLastCalledWith('b-sls', { offer: 'o1', offset: 20 });
    await act(async () => { listOf(r).props.onEndReached(); });
    expect(followerApi.brandPosts).toHaveBeenLastCalledWith('b-sls', { offer: 'o1', offset: 40 });
    await act(async () => { listOf(r).props.onEndReached(); });      // an empty page ends it, whatever `more` says
    expect(followerApi.brandPosts).toHaveBeenCalledTimes(3);
  });
});
