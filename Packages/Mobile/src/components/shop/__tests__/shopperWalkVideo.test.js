/**
 * shopper-walk-fixes — video (board V1, V2, V3).
 *
 *   V1  a tap on a video in a feed opens it full screen; tap-to-pause is in Play only
 *   V2  the video that plays changes the instant a swipe lands; 'impression' and 'dwell' still
 *       wait their second; only ever one video plays; Play has the bag icon beside the sound button
 *   V3  a still that stands for a video is the video's own picture (`media[0].cover_url`),
 *       the first product's photo only when there is none
 *
 * The player is native and absent in jest, so every check that needs it uses a stand-in — which is
 * exactly why V1 was never seen by a test: the layer that swallowed the tap is drawn only on a
 * phone that has the player.
 * Contract: features/shopper-walk-fixes · BUILD_API.md
 */
import React from 'react';
import { FlatList, StyleSheet } from 'react-native';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

jest.mock('../../../services/api', () => ({
  followerApi: {
    feed: jest.fn(), circles: jest.fn(), post: jest.fn(), more: jest.fn(), saved: jest.fn(), resolveSaved: jest.fn(),
    like: jest.fn(), unlike: jest.fn(), save: jest.fn(), unsave: jest.fn(), saveProduct: jest.fn(), unsaveProduct: jest.fn(),
    creatorStore: jest.fn(), creatorPosts: jest.fn(), creatorCollections: jest.fn(), brandStore: jest.fn(), brandPosts: jest.fn(),
    getBag: jest.fn(), putBag: jest.fn(), postEvents: jest.fn(() => Promise.resolve({ success: true })),
  },
  setDeviceHeader: jest.fn(), clearSession: jest.fn(() => Promise.resolve()),
}));
jest.mock('../../../services/events', () => ({ track: jest.fn(), flush: jest.fn() }));
// The screen's focus: the effect runs when it comes in front, its clean-up when another page covers it.
const mockBlurs = [];
jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (cb) => {
    const React = require('react');
    React.useEffect(() => { const off = cb(); if (typeof off === 'function') mockBlurs.push(off); return off; }, [cb]);
  },
}));

const { followerApi } = require('../../../services/api');
const { track } = require('../../../services/events');
const { shopStore } = require('../shopStore');
const ShopVideo = require('../ShopVideo').default;
const { _setPlayerForTests, videoStill } = require('../ShopVideo');
const { PostCard, Tile, TileGrid } = require('../bitsShop');
const { useShopNav } = require('../useShopNav');
const { useAutoplay, PLAY_CONFIG } = require('../useAutoplay');
const { SEEN_CONFIG } = require('../useSeen');
const { addToBag } = require('../bag');
const Home = require('../../../screens/shop/HomeScreen').default;
const Post = require('../../../screens/shop/PostScreen').default;
const Play = require('../../../screens/shop/PlayScreen').default;
const Saved = require('../../../screens/shop/SavedScreen').default;
const CreatorStore = require('../../../screens/shop/CreatorStoreScreen').default;
const BrandStore = require('../../../screens/shop/BrandStoreScreen').default;

const nav = () => ({ goBack: jest.fn(), navigate: jest.fn(), push: jest.fn(), replace: jest.fn(), addListener: jest.fn(() => () => {}) });
const ok = (data) => ({ success: true, data });

const AKSHAYA = { id: 'c1', name: 'Akshaya Reddy', handle: 'akshaya', avatar: null };
const AVEEN = { id: 'b1', name: 'Aveen fashion boutique and desiner studio', logo: null };
const VIDEO = (over = {}) => ({
  id: 'v1', code: 'JD54B4', title: 'This is for BOGI', caption: 'This is for BOGI', share_url: 'https://inflx.in/p/JD54B4',
  creator: AKSHAYA, brand: AVEEN, media_kind: 'video', media_layout: 'single',
  media: [{ id: 'm1', url: 'https://api/v1/media/post/m1', cover_url: 'https://api/v1/media/post/m1/cover' }],
  offer: { id: 'o1', type: 'BOGO', kind: 'bogo', badge: 'BUY 1 GET 1', line: 'Buy one, get the same product free', ends_on: '2026-10-31', how: 'Buy any product in this post and get the same one free, in any size or colour.' },
  deal_page: true, gift_line: null,
  products: [{ id: 'h', name: 'heels', image_url: 'https://x/heels.jpg', price: 4599, shopper_price: 4599, struck: false, in_stock: true }],
  counts: { likes: 12, comments: 3, shares: 1, saves: 0 }, mine: { liked: false, saved: false, saved_products: [] },
  facets: { price_band: null, theme: null, category: [] },
  ...over,
});
const PHOTO = (over = {}) => VIDEO({ id: 'ph1', media_kind: 'image', media: [{ id: 'm9', url: 'https://x/photo.jpg', cover_url: null }], deal_page: false, ...over });

// A stand-in for the native player: a View that keeps the props it was given.
const players = {};
function FakeVideo(props) {
  players[props.testID] = props;
  const { View } = require('react-native');
  return <View testID={`fake-${props.testID}`} />;
}

/** Everything under a node that would take a touch for itself. */
const touchCatchers = (node) => node.findAll((n) => typeof n.props.onPress === 'function'
  || typeof n.props.onClick === 'function' || typeof n.props.onStartShouldSetResponder === 'function');

// shopper-app-fixes F8: this stand-in is a card on Home, so it says what Home says — it is a bottom
// tab — and its video opens in the Play tab as before. (A pushed screen now opens Play on top instead.)
function Feed({ navigation, post }) {
  const sn = useShopNav(navigation, { tab: true });
  return (
    <PostCard post={post} surface="home" position={0} active onOpen={sn.openPost} onShop={sn.openShop} onComments={sn.openComments}
      onCreator={sn.openCreator} onBrand={sn.openBrand} onNeedSignIn={sn.needSignIn} />
  );
}

beforeEach(async () => {
  jest.clearAllMocks();
  for (const k of Object.keys(players)) delete players[k];
  mockBlurs.length = 0;
  _setPlayerForTests(null);
  await AsyncStorage.clear();
  shopStore._reset();
  await shopStore.set({ welcomed: true });
});
afterEach(() => { jest.useRealTimers(); });

/* ═══════════════════════════════════════════ V1 */

describe('V1 · a tap on a video in a feed opens it full screen', () => {
  // shopper-feed-sound-comments-sheet (S1): a playing feed video now has ONE thing on it that
  // takes a tap — the sound button, bottom-left. Everything else about V1 holds: no pause layer,
  // the player's own layer takes no touch, and the block passes touches through to the card.
  it('on a phone WITH the player: nothing over the video takes the tap but its sound button — the card opens Play with this video first', () => {
    _setPlayerForTests(FakeVideo);
    const n = nav();
    const { getByTestId, queryByTestId } = render(<Feed navigation={n} post={VIDEO()} />);
    const video = getByTestId('video-v1');
    expect(queryByTestId('video-tap-v1')).toBeNull();              // the pause layer that swallowed the tap is gone
    const catchers = touchCatchers(video).map((c) => c.props.testID).filter(Boolean);
    expect([...new Set(catchers)]).toEqual(['video-sound-v1']);    // the sound button, and nothing else
    expect(video.props.pointerEvents).toBe('box-none');            // the block itself lets touches through
    let layer = getByTestId('fake-player-v1').parent;
    while (layer && layer.props.pointerEvents === undefined) layer = layer.parent;
    expect(layer.props.pointerEvents).toBe('none');                // and the player's own layer takes none
    fireEvent.press(getByTestId('fake-player-v1'));                // a tap anywhere on the video…
    expect(n.navigate).toHaveBeenCalledTimes(1);
    expect(n.navigate).toHaveBeenCalledWith('PlayTab', expect.objectContaining({ start: 'v1', at: expect.any(Number) }));
    expect(track).toHaveBeenCalledWith('open', 'v1', 'home', { position: 0 });
    expect(players['player-v1'].paused).toBe(false);               // …opens it; it never paused
    expect(track).not.toHaveBeenCalledWith('pause', 'v1', 'home');
  });

  it('on an older build (no player): the same tap opens Play', () => {
    const n = nav();
    const { getByTestId } = render(<Feed navigation={n} post={VIDEO()} />);
    fireEvent.press(getByTestId('video-placeholder'));
    expect(n.navigate).toHaveBeenCalledWith('PlayTab', expect.objectContaining({ start: 'v1' }));
  });

  it('the same in every feed: Home and an opened post hand their videos to Play', async () => {
    _setPlayerForTests(FakeVideo);
    followerApi.circles.mockResolvedValue(ok({ creators: [], brands: [] }));
    followerApi.feed.mockResolvedValue(ok({ posts: [VIDEO()], more: false }));
    const n = nav();
    const home = render(<Home navigation={n} />);
    await waitFor(() => home.getByTestId('video-v1'));
    expect(touchCatchers(home.getByTestId('video-v1'))).toEqual([]);
    fireEvent.press(home.getByTestId('fake-player-v1'));
    expect(n.navigate).toHaveBeenCalledWith('PlayTab', expect.objectContaining({ start: 'v1' }));
    home.unmount();

    followerApi.more.mockResolvedValue(ok({ posts: [VIDEO({ id: 'v2', from: 'creator' })], more: false }));
    const n2 = nav();
    const post = render(<Post navigation={n2} route={{ params: { postId: 'ph1', post: PHOTO() } }} />);
    await waitFor(() => post.getByTestId('video-v2'));
    expect(touchCatchers(post.getByTestId('video-v2'))).toEqual([]);
    fireEvent.press(post.getByTestId('fake-player-v2'));
    // shopper-app-fixes F8: a post's page is a pushed screen, so Play opens ON TOP of it (it was
    // navigate('PlayTab'), which threw the page away: Back went to Home).
    expect(n2.push).toHaveBeenCalledWith('PlayOver', expect.objectContaining({ start: 'v2' }));
    expect(n2.navigate).not.toHaveBeenCalled();
  });

  it('a video that is itself the opened post (from the bag\'s "Add more", a saved product, an order) goes full screen too; an opened photo stays put', async () => {
    _setPlayerForTests(FakeVideo);
    followerApi.more.mockResolvedValue(ok({ posts: [], more: false }));
    const n = nav();
    const opened = render(<Post navigation={n} route={{ params: { postId: 'v1', post: VIDEO() } }} />);
    await waitFor(() => opened.getByTestId('video-v1'));
    expect(touchCatchers(opened.getByTestId('video-v1'))).toEqual([]);
    fireEvent.press(opened.getByTestId('fake-player-v1'));
    // shopper-app-fixes F8: full screen ON TOP of the post's page (it was navigate('PlayTab')).
    expect(n.push).toHaveBeenCalledWith('PlayOver', expect.objectContaining({ start: 'v1' }));
    opened.unmount();

    const n2 = nav();
    const photo = render(<Post navigation={n2} route={{ params: { postId: 'ph1', post: PHOTO() } }} />);
    await waitFor(() => photo.getByTestId('post-open-ph1'));
    fireEvent.press(photo.getByTestId('post-open-ph1'));
    expect(n2.navigate).not.toHaveBeenCalled();                    // it is already open
    expect(n2.push).not.toHaveBeenCalled();
  });

  it('a store tile of a video opens Play too (creator store, brand store, Saved)', async () => {
    followerApi.creatorStore.mockResolvedValue(ok({ creator: AKSHAYA, followers: 1, following: false, brands: [], categories: [], tabs: {} }));
    followerApi.creatorPosts.mockResolvedValue(ok({ posts: [VIDEO()], more: false }));
    const n = nav();
    const store = render(<CreatorStore navigation={n} route={{ params: { id: 'c1' } }} />);
    await waitFor(() => store.getByTestId('creator-tile-v1'));
    fireEvent.press(store.getByTestId('creator-tile-v1'));
    // shopper-app-fixes F8: a store is a pushed screen — Play opens on top of it (it was navigate('PlayTab')).
    expect(n.push).toHaveBeenCalledWith('PlayOver', expect.objectContaining({ start: 'v1' }));
    store.unmount();

    followerApi.brandStore.mockResolvedValue(ok({ brand: AVEEN, line: '', categories: [], creators: [], offers_count: 0 }));
    followerApi.brandPosts.mockResolvedValue(ok({ posts: [VIDEO()], more: false }));
    const n2 = nav();
    const brand = render(<BrandStore navigation={n2} route={{ params: { id: 'b1' } }} />);
    await waitFor(() => brand.getByTestId('brand-tile-v1'));
    fireEvent.press(brand.getByTestId('brand-tile-v1'));
    expect(n2.push).toHaveBeenCalledWith('PlayOver', expect.objectContaining({ start: 'v1' }));
    brand.unmount();

    // Saved is a bottom tab: its video opens in the Play tab, as it always did.
    await shopStore.set({ savedPosts: ['v1'] });
    followerApi.resolveSaved.mockResolvedValue(ok({ posts: [VIDEO()], products: [] }));
    const n3 = nav();
    const saved = render(<Saved navigation={n3} />);
    await waitFor(() => saved.getByTestId('saved-tile-v1'));
    fireEvent.press(saved.getByTestId('saved-tile-v1'));
    expect(n3.navigate).toHaveBeenCalledWith('PlayTab', expect.objectContaining({ start: 'v1' }));
    expect(n3.push).not.toHaveBeenCalled();
  });

  it('in Play the tap pauses and resumes — it never opens anything', async () => {
    _setPlayerForTests(FakeVideo);
    followerApi.feed.mockResolvedValue(ok({ posts: [VIDEO()], more: false }));
    const n = nav();
    const { getByTestId, UNSAFE_getByType } = render(<Play navigation={n} route={{ params: {} }} />);
    await waitFor(() => getByTestId('reel-v1'));
    expect(getByTestId('video-v1').props.pointerEvents).toBe('auto');
    // the swipe has landed on it: it plays
    const [, play] = UNSAFE_getByType(FlatList).props.viewabilityConfigCallbackPairs;
    act(() => { play.onViewableItemsChanged({ viewableItems: [{ item: VIDEO(), index: 0, isViewable: true, key: 'v1' }], changed: [] }); });
    expect(players['player-v1'].paused).toBe(false);
    fireEvent.press(getByTestId('video-tap-v1'));
    expect(players['player-v1'].paused).toBe(true);
    expect(track).toHaveBeenCalledWith('pause', 'v1', 'play');
    fireEvent.press(getByTestId('video-tap-v1'));
    expect(players['player-v1'].paused).toBe(false);
    expect(n.navigate).not.toHaveBeenCalled();
  });
});

/* ═══════════════════════════════════════════ V2 */

describe('V2 · the video that plays changes the instant a swipe lands', () => {
  const A = VIDEO({ id: 'a' });
  const B = VIDEO({ id: 'b' });
  const P = PHOTO({ id: 'p' });
  const token = (item, index, isViewable = true) => ({ item, index, isViewable, key: item.id });

  function probe(posts, surface = 'play') {
    const out = { current: null, all: [] };
    function Probe({ list }) { out.current = useAutoplay(surface, list); out.all.push(out.current.seenProps); return null; }
    const r = render(<Probe list={posts} />);
    return { out, rerender: (list) => r.rerender(<Probe list={list} />), unmount: r.unmount };
  }

  it('a list carries two rules: "seen" keeps its one second, "play" has no waiting time', () => {
    const { out } = probe([A, B]);
    const pairs = out.current.seenProps.viewabilityConfigCallbackPairs;
    expect(pairs).toHaveLength(2);
    expect(pairs[0].viewabilityConfig).toBe(SEEN_CONFIG);
    expect(SEEN_CONFIG).toEqual({ itemVisiblePercentThreshold: 50, minimumViewTime: 1000 });   // exactly as it was
    expect(pairs[1].viewabilityConfig).toBe(PLAY_CONFIG);
    expect(PLAY_CONFIG.minimumViewTime).toBeUndefined();
    expect(PLAY_CONFIG.itemVisiblePercentThreshold).toBe(50);
    // FlatList takes pairs OR a single callback, never both
    expect(out.current.seenProps.onViewableItemsChanged).toBeUndefined();
    expect(out.current.seenProps.viewabilityConfig).toBeUndefined();
  });

  it('the pairs are the same objects for the list\'s whole life (FlatList refuses a new list of them)', () => {
    const { out, rerender } = probe([A, B]);
    const first = out.current.seenProps.viewabilityConfigCallbackPairs;
    act(() => { first[1].onViewableItemsChanged({ viewableItems: [token(A, 0)], changed: [] }); });
    rerender([A, B, VIDEO({ id: 'c' })]);
    expect(out.current.seenProps.viewabilityConfigCallbackPairs).toBe(first);
    expect(out.current.seenProps.viewabilityConfigCallbackPairs[0]).toBe(first[0]);
    expect(out.current.seenProps.viewabilityConfigCallbackPairs[1].onViewableItemsChanged).toBe(first[1].onViewableItemsChanged);
    expect(new Set(out.all).size).toBe(1);
  });

  it('the playing id follows the play callback at once, and only ever one video plays', () => {
    const { out } = probe([A, P, B]);
    const [, play] = out.current.seenProps.viewabilityConfigCallbackPairs;
    expect(out.current.playingId).toBeNull();
    act(() => { play.onViewableItemsChanged({ viewableItems: [token(A, 0)], changed: [token(A, 0)] }); });
    expect(out.current.playingId).toBe('a');
    // mid-swipe both are half on screen: still one, the first
    act(() => { play.onViewableItemsChanged({ viewableItems: [token(A, 0), token(B, 2)], changed: [token(B, 2)] }); });
    expect(out.current.playingId).toBe('a');
    // the swipe lands: the old one stops and the new one starts in the same breath
    act(() => { play.onViewableItemsChanged({ viewableItems: [token(B, 2)], changed: [token(A, 0, false)] }); });
    expect(out.current.playingId).toBe('b');
    // a photo on screen plays nothing
    act(() => { play.onViewableItemsChanged({ viewableItems: [token(P, 1)], changed: [] }); });
    expect(out.current.playingId).toBeNull();
    expect(track).not.toHaveBeenCalled();                          // deciding what plays records nothing
  });

  it('with React Native\'s own viewability rules: play switches on the swipe, impressions and dwell still wait their second', () => {
    jest.useFakeTimers();
    const ViewabilityHelper = (m => m.default || m)(require('react-native/Libraries/Lists/ViewabilityHelper'));
    const data = [A, B];
    const { out } = probe(data);
    const pairs = out.current.seenProps.viewabilityConfigCallbackPairs;
    const helpers = pairs.map((p) => new ViewabilityHelper(p.viewabilityConfig));
    const props = { data, getItemCount: (d) => d.length };
    const metrics = { getCellMetrics: (i) => ({ index: i, length: 800, offset: 800 * i, isMounted: true }) };
    const view = (index, isViewable) => token(data[index], index, isViewable);
    const scrollTo = (offset) => act(() => {
      helpers.forEach((h, k) => h.onUpdate(props, offset, 800, metrics, view, pairs[k].onViewableItemsChanged));
    });

    scrollTo(0);
    expect(out.current.playingId).toBe('a');                       // at once
    expect(track).not.toHaveBeenCalled();                          // not counted as seen yet
    act(() => { jest.advanceTimersByTime(999); });
    expect(track).not.toHaveBeenCalled();
    act(() => { jest.advanceTimersByTime(1); });
    expect(track).toHaveBeenCalledWith('impression', 'a', 'play', { position: 0 });
    expect(track).toHaveBeenCalledTimes(1);

    act(() => { jest.advanceTimersByTime(5000); });                // she watches for five seconds
    scrollTo(800);                                                 // the swipe lands on the next video
    expect(out.current.playingId).toBe('b');                       // the old one has stopped NOW — no second of its sound
    expect(track).toHaveBeenCalledTimes(1);                        // …while the counting has not moved
    act(() => { jest.advanceTimersByTime(1000); });
    expect(track).toHaveBeenCalledWith('impression', 'b', 'play', { position: 1 });
    expect(track).toHaveBeenCalledWith('dwell', 'a', 'play', expect.objectContaining({ dwell_ms: expect.any(Number), position: 0 }));
    expect(track.mock.calls.find((c) => c[0] === 'dwell')[3].dwell_ms).toBeGreaterThanOrEqual(5000);
    helpers.forEach((h) => h.dispose());
  });

  it('a video flicked past in under a second never counts as seen, but it did play', () => {
    jest.useFakeTimers();
    const ViewabilityHelper = (m => m.default || m)(require('react-native/Libraries/Lists/ViewabilityHelper'));
    const data = [A, B, VIDEO({ id: 'c' })];
    const { out } = probe(data);
    const pairs = out.current.seenProps.viewabilityConfigCallbackPairs;
    const helpers = pairs.map((p) => new ViewabilityHelper(p.viewabilityConfig));
    const props = { data, getItemCount: (d) => d.length };
    const metrics = { getCellMetrics: (i) => ({ index: i, length: 800, offset: 800 * i, isMounted: true }) };
    const view = (index, isViewable) => token(data[index], index, isViewable);
    const scrollTo = (offset) => act(() => {
      helpers.forEach((h, k) => h.onUpdate(props, offset, 800, metrics, view, pairs[k].onViewableItemsChanged));
    });
    scrollTo(0);
    act(() => { jest.advanceTimersByTime(1000); });
    scrollTo(800);
    expect(out.current.playingId).toBe('b');
    act(() => { jest.advanceTimersByTime(400); });
    scrollTo(1600);
    expect(out.current.playingId).toBe('c');
    act(() => { jest.advanceTimersByTime(1000); });
    const seen = track.mock.calls.filter((c) => c[0] === 'impression').map((c) => c[1]);
    expect(seen).toEqual(['a', 'c']);
    helpers.forEach((h) => h.dispose());
  });

  it('nothing plays while another page is in front (the bag, the deal page, the product page)', () => {
    const { out } = probe([A]);
    const [, play] = out.current.seenProps.viewabilityConfigCallbackPairs;
    act(() => { play.onViewableItemsChanged({ viewableItems: [token(A, 0)], changed: [] }); });
    expect(out.current.playingId).toBe('a');
    act(() => { mockBlurs.forEach((off) => off()); });             // another page covers this one
    expect(out.current.focused).toBe(false);
    expect(out.current.playingId).toBeNull();
  });

  it('Home, an opened post and Play all hand the list the two rules — fixed in one place', async () => {
    followerApi.circles.mockResolvedValue(ok({ creators: [], brands: [] }));
    followerApi.feed.mockResolvedValue(ok({ posts: [VIDEO()], more: false }));
    followerApi.more.mockResolvedValue(ok({ posts: [VIDEO({ id: 'v2', from: 'creator' })], more: false }));
    const check = (list) => {
      expect(list.props.viewabilityConfigCallbackPairs.map((p) => p.viewabilityConfig)).toEqual([SEEN_CONFIG, PLAY_CONFIG]);
      expect(list.props.onViewableItemsChanged).toBeUndefined();
      expect(list.props.viewabilityConfig).toBeUndefined();
    };
    const home = render(<Home navigation={nav()} />);
    await waitFor(() => home.getByTestId('home-feed'));
    check(home.UNSAFE_getByType(FlatList));
    home.unmount();
    const post = render(<Post navigation={nav()} route={{ params: { postId: 'ph1', post: PHOTO() } }} />);
    await waitFor(() => post.getByTestId('post-v2'));
    check(post.UNSAFE_getByType(FlatList));
    post.unmount();
    const play = render(<Play navigation={nav()} route={{ params: {} }} />);
    await waitFor(() => play.getByTestId('reel-v1'));
    check(play.UNSAFE_getByType(FlatList));
  });

  it('in Play only the video the swipe landed on plays; the one before it is paused in the same render', async () => {
    _setPlayerForTests(FakeVideo);
    followerApi.feed.mockResolvedValue(ok({ posts: [A, B], more: false }));
    const { getByTestId, UNSAFE_getByType } = render(<Play navigation={nav()} route={{ params: {} }} />);
    await waitFor(() => getByTestId('reel-a'));
    const [, play] = UNSAFE_getByType(FlatList).props.viewabilityConfigCallbackPairs;
    act(() => { play.onViewableItemsChanged({ viewableItems: [token(A, 0)], changed: [] }); });
    expect([players['player-a'].paused, players['player-b'].paused]).toEqual([false, true]);
    act(() => { play.onViewableItemsChanged({ viewableItems: [token(B, 1)], changed: [] }); });
    expect([players['player-a'].paused, players['player-b'].paused]).toEqual([true, false]);
  });

  it('Play has the bag with its count beside the sound button', async () => {
    _setPlayerForTests(FakeVideo);
    followerApi.feed.mockResolvedValue(ok({ posts: [VIDEO()], more: false }));
    const n = nav();
    const RN = require('@react-navigation/native');
    RN.useNavigation = () => n;
    const { getByTestId, queryByTestId, findByTestId } = render(<Play navigation={n} route={{ params: {} }} />);
    await waitFor(() => getByTestId('reel-v1'));
    const holder = getByTestId('reel-bag-v1');
    expect(StyleSheet.flatten(holder.props.style)).toMatchObject({ position: 'absolute', top: 12, right: 56 });   // the sound button is at right: 12
    expect(queryByTestId('bag-count')).toBeNull();                 // an empty bag shows no count
    await act(async () => { await addToBag([{ post_id: 'v1', product_id: 'h', colour: 'Black', size: 'UK6', qty: 2 }]); });
    expect((await findByTestId('bag-count')).props.children).toBe(2);
    // on a video the count is the board's yellow with dark figures — a black one is lost there
    expect(StyleSheet.flatten(getByTestId('bag-count').props.style).color).toBe('#1A1A17');
    fireEvent.press(getByTestId('open-bag'));
    expect(n.navigate).toHaveBeenCalledWith('Bag');
    delete RN.useNavigation;
  });

  it('on an older build there is no sound button, so the bag takes its place', async () => {
    followerApi.feed.mockResolvedValue(ok({ posts: [VIDEO()], more: false }));
    const { getByTestId } = render(<Play navigation={nav()} route={{ params: {} }} />);
    await waitFor(() => getByTestId('reel-v1'));
    expect(StyleSheet.flatten(getByTestId('reel-bag-v1').props.style).right).toBe(12);
  });
});

/* ═══════════════════════════════════════════ V3 */

describe('V3 · a video shows its own picture', () => {
  const src = (node) => node.props.source.uri;

  it('videoStill: the picture taken from the video; the first product\'s photo only when there is none', () => {
    expect(videoStill(VIDEO())).toBe('https://api/v1/media/post/m1/cover');
    expect(videoStill(VIDEO({ media: [{ id: 'm1', url: 'u', cover_url: null }] }))).toBe('https://x/heels.jpg');
    expect(videoStill(VIDEO({ media: [{ id: 'm1', url: 'u' }] }))).toBe('https://x/heels.jpg');           // an older server answer
    expect(videoStill(VIDEO({ media: [], products: [] }))).toBeNull();
  });

  it('the 2 × 2 tile: a video\'s own picture with the ▶ mark; a photo post is unchanged', () => {
    const { getByTestId, getByText, rerender } = render(<Tile post={VIDEO()} onPress={jest.fn()} testID="t" />);
    expect(src(getByTestId('t-img'))).toBe('https://api/v1/media/post/m1/cover');
    getByText('play');                                             // the ▶ mark (the icon stand-in prints its name)
    getByText('BUY 1 GET 1');
    rerender(<Tile post={VIDEO({ media: [{ id: 'm1', url: 'u', cover_url: null }] })} onPress={jest.fn()} testID="t" />);
    expect(src(getByTestId('t-img'))).toBe('https://x/heels.jpg');   // uploaded before 4 Oct: as today
    rerender(<Tile post={PHOTO()} onPress={jest.fn()} testID="t" />);
    expect(src(getByTestId('t-img'))).toBe('https://x/photo.jpg');
  });

  it('Saved, the creator\'s store and the brand\'s store all draw that tile', async () => {
    await shopStore.set({ savedPosts: ['v1'] });
    followerApi.resolveSaved.mockResolvedValue(ok({ posts: [VIDEO()], products: [] }));
    const saved = render(<Saved navigation={nav()} />);
    await waitFor(() => saved.getByTestId('saved-tile-v1'));
    expect(src(saved.getByTestId('saved-tile-v1-img'))).toBe('https://api/v1/media/post/m1/cover');
    saved.unmount();

    followerApi.creatorStore.mockResolvedValue(ok({ creator: AKSHAYA, followers: 1, following: false, brands: [], categories: [], tabs: {} }));
    followerApi.creatorPosts.mockResolvedValue(ok({ posts: [VIDEO()], more: false }));
    const creator = render(<CreatorStore navigation={nav()} route={{ params: { id: 'c1' } }} />);
    await waitFor(() => creator.getByTestId('creator-tile-v1'));
    expect(src(creator.getByTestId('creator-tile-v1-img'))).toBe('https://api/v1/media/post/m1/cover');
    creator.unmount();

    followerApi.brandStore.mockResolvedValue(ok({ brand: AVEEN, line: '', categories: [], creators: [], offers_count: 0 }));
    followerApi.brandPosts.mockResolvedValue(ok({ posts: [VIDEO()], more: false }));
    const brand = render(<BrandStore navigation={nav()} route={{ params: { id: 'b1' } }} />);
    await waitFor(() => brand.getByTestId('brand-tile-v1'));
    expect(src(brand.getByTestId('brand-tile-v1-img'))).toBe('https://api/v1/media/post/m1/cover');
  });

  it('TileGrid passes it through for every post of a row', () => {
    const { getByTestId } = render(<TileGrid posts={[VIDEO(), PHOTO()]} onOpen={jest.fn()} testIDPrefix="g" />);
    expect(src(getByTestId('g-v1-img'))).toBe('https://api/v1/media/post/m1/cover');
    expect(src(getByTestId('g-ph1-img'))).toBe('https://x/photo.jpg');
  });

  it('the player\'s poster, and the "Update INFLX" placeholder of an older build, are that picture too', () => {
    _setPlayerForTests(FakeVideo);
    const withPlayer = render(<ShopVideo post={VIDEO()} height={400} />);
    expect(players['player-v1'].poster).toBe('https://api/v1/media/post/m1/cover');
    withPlayer.unmount();
    _setPlayerForTests(null);
    const { getByTestId, getByText, UNSAFE_getAllByType } = render(<ShopVideo post={VIDEO()} height={400} />);
    getByTestId('video-placeholder');
    getByText('Update INFLX to play videos');
    const { Image } = require('react-native');
    expect(UNSAFE_getAllByType(Image).map((i) => i.props.source.uri)).toEqual(['https://api/v1/media/post/m1/cover']);
  });

  it('a video with no picture of its own: the first product\'s photo, as before', () => {
    _setPlayerForTests(FakeVideo);
    render(<ShopVideo post={VIDEO({ media: [{ id: 'm1', url: 'https://api/v1/media/post/m1', cover_url: null }] })} height={400} />);
    expect(players['player-v1'].poster).toBe('https://x/heels.jpg');
  });
});
