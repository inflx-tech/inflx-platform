/**
 * shopper-video-pauses-for-popup — a video stops while the products of its post are open over it,
 * and carries on when they close.
 * Contract: features/shopper-video-pauses-for-popup · 03-expected-outputs.md (H1–H9)
 *
 * What the founder saw (13 Oct 2026, the shopper app's video feed): he tapped the button under a
 * video — Build your deal, a discount, or a post with no offer — the products came up, and the
 * video went on playing with its sound behind them.
 *
 * Why: the products are a sheet drawn ON the video's own screen, so that screen is still "in
 * front", and "in front" was the only thing the video asked about. (A page that covers the screen
 * — the bag, a store, comments — already stopped it.)
 *
 * The player is native and absent in jest, so a stand-in keeps the props it was given, as in
 * shopperWalkVideo.test.js.
 */
import React from 'react';
import { FlatList } from 'react-native';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

jest.mock('../../../services/api', () => ({
  followerApi: {
    feed: jest.fn(), circles: jest.fn(), post: jest.fn(), more: jest.fn(), saved: jest.fn(), resolveSaved: jest.fn(),
    like: jest.fn(), unlike: jest.fn(), save: jest.fn(), unsave: jest.fn(), saveProduct: jest.fn(), unsaveProduct: jest.fn(),
    offerPosts: jest.fn(),
    getBag: jest.fn(), putBag: jest.fn(), postEvents: jest.fn(() => Promise.resolve({ success: true })),
  },
  setDeviceHeader: jest.fn(), clearSession: jest.fn(() => Promise.resolve()),
}));
jest.mock('../../../services/events', () => ({ track: jest.fn(), flush: jest.fn() }));
jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (cb) => { const R = require('react'); R.useEffect(() => cb(), [cb]); },
}));

const { followerApi } = require('../../../services/api');
const { track } = require('../../../services/events');
const { shopStore } = require('../shopStore');
const ShopVideo = require('../ShopVideo').default;
const { _setPlayerForTests } = require('../ShopVideo');
const { useShopNav } = require('../useShopNav');
const { useAutoplay } = require('../useAutoplay');
const Home = require('../../../screens/shop/HomeScreen').default;
const Post = require('../../../screens/shop/PostScreen').default;
const Play = require('../../../screens/shop/PlayScreen').default;

const nav = () => ({ goBack: jest.fn(), navigate: jest.fn(), push: jest.fn(), replace: jest.fn(), addListener: jest.fn(() => () => {}) });
const ok = (data) => ({ success: true, data });

const VIDEO = (over = {}) => ({
  id: 'v1', code: 'JD54B4', title: 'This is for BOGI', caption: 'This is for BOGI', share_url: 'https://inflx.in/p/JD54B4',
  creator: { id: 'c1', name: 'Akshaya Reddy', handle: 'akshaya', avatar: null }, brand: { id: 'b1', name: 'Aveen fashion boutique', logo: null },
  media_kind: 'video', media_layout: 'single',
  media: [{ id: 'm1', url: 'https://api/v1/media/post/m1', cover_url: 'https://api/v1/media/post/m1/cover' }],
  offer: { id: 'o1', type: 'BOGO', kind: 'bogo', badge: 'BUY 1 GET 1', line: 'Buy one, get the same product free', ends_on: '2026-10-31', how: 'Buy any product in this post and get the same one free.' },
  deal_page: true, gift_line: null,
  products: [{ id: 'h', name: 'heels', image_url: 'https://x/heels.jpg', price: 4599, shopper_price: 4599, struck: false, in_stock: true }],
  counts: { likes: 12, comments: 3, shares: 1, saves: 0 }, mine: { liked: false, saved: false, saved_products: [] },
  facets: { price_band: null, theme: null, category: [] },
  ...over,
});
// The three kinds of post he named: a deal she builds, a plain discount, and no offer at all.
const KINDS = [
  ['Build your deal', VIDEO()],
  ['a discount', VIDEO({ deal_page: false, offer: { id: 'o2', type: 'DISCOUNT', kind: 'discount', badge: '20% OFF', line: '20% off', ends_on: '2026-10-31', how: '20% off every product in this post.' },
    products: [{ id: 'h', name: 'heels', image_url: 'https://x/heels.jpg', price: 4599, shopper_price: 3679, struck: true, in_stock: true }] })],
  ['no offer', VIDEO({ deal_page: false, offer: null })],
];
const token = (item, index) => ({ item, index, isViewable: true, key: item.id });

const players = {};
function FakeVideo(props) {
  players[props.testID] = props;
  const { View } = require('react-native');
  return <View testID={`fake-${props.testID}`} />;
}

/** Play, with `posts`, and the swipe landed on the first of them. */
async function openPlay(posts) {
  _setPlayerForTests(FakeVideo);
  followerApi.feed.mockResolvedValue(ok({ posts, more: false }));
  const r = render(<Play navigation={nav()} route={{ params: {} }} />);
  await waitFor(() => r.getByTestId(`reel-${posts[0].id}`));
  const [, play] = r.UNSAFE_getByType(FlatList).props.viewabilityConfigCallbackPairs;
  act(() => { play.onViewableItemsChanged({ viewableItems: [token(posts[0], 0)], changed: [] }); });
  return { r, land: (i) => act(() => { play.onViewableItemsChanged({ viewableItems: [token(posts[i], i)], changed: [] }); }) };
}

beforeEach(async () => {
  jest.clearAllMocks();
  for (const k of Object.keys(players)) delete players[k];
  _setPlayerForTests(null);
  await AsyncStorage.clear();
  shopStore._reset();
  await shopStore.set({ welcomed: true });
});

/* ═══════════════════════════════════════════ Play — the full-screen video feed */

describe('Play · the products open over the video', () => {
  it.each(KINDS)('H1 · %s: the video stops when the products come up, and carries on when they close', async (name, post) => {
    const { r } = await openPlay([post]);
    expect(players['player-v1'].paused).toBe(false);

    fireEvent.press(r.getByTestId('reel-shop-v1'));
    await waitFor(() => r.getByTestId('shop-sheet'));
    expect(players['player-v1'].paused).toBe(true);           // picture and sound: a paused player is silent

    fireEvent.press(r.getByTestId('shop-sheet-close'));
    await waitFor(() => expect(r.queryByTestId('shop-sheet')).toBeNull());
    expect(players['player-v1'].paused).toBe(false);
  });

  it('H2 · closing by tapping outside the products carries it on too', async () => {
    const { r } = await openPlay([VIDEO()]);
    fireEvent.press(r.getByTestId('reel-shop-v1'));
    await waitFor(() => r.getByTestId('shop-sheet'));
    expect(players['player-v1'].paused).toBe(true);
    fireEvent.press(r.getByTestId('shop-sheet-dim'));
    await waitFor(() => expect(players['player-v1'].paused).toBe(false));
  });

  it('H3 · her sound choice is not touched: on before, on after', async () => {
    await AsyncStorage.setItem('inflx_video_sound', '1');
    const { r } = await openPlay([VIDEO()]);
    await waitFor(() => expect(players['player-v1'].muted).toBe(false));
    fireEvent.press(r.getByTestId('reel-shop-v1'));
    await waitFor(() => r.getByTestId('shop-sheet'));
    expect(players['player-v1']).toMatchObject({ paused: true, muted: false });
    fireEvent.press(r.getByTestId('shop-sheet-close'));
    await waitFor(() => expect(players['player-v1']).toMatchObject({ paused: false, muted: false }));
    expect(await AsyncStorage.getItem('inflx_video_sound')).toBe('1');
    expect(track).not.toHaveBeenCalledWith('sound_off', 'v1', 'play');
  });

  it('H4 · a video she had paused herself stays paused after the products close', async () => {
    const { r } = await openPlay([VIDEO()]);
    fireEvent.press(r.getByTestId('video-tap-v1'));
    expect(players['player-v1'].paused).toBe(true);
    fireEvent.press(r.getByTestId('reel-shop-v1'));
    await waitFor(() => r.getByTestId('shop-sheet'));
    fireEvent.press(r.getByTestId('shop-sheet-close'));
    await waitFor(() => expect(r.queryByTestId('shop-sheet')).toBeNull());
    expect(players['player-v1'].paused).toBe(true);           // not started behind her back
    fireEvent.press(r.getByTestId('video-tap-v1'));           // her own tap starts it again
    expect(players['player-v1'].paused).toBe(false);
    // a stop for the products is not counted as her pausing it
    expect(track.mock.calls.filter((c) => c[0] === 'pause')).toHaveLength(1);
  });

  it('H5 · the same video carries on — never the one before or after it', async () => {
    const A = VIDEO({ id: 'a' });
    const B = VIDEO({ id: 'b' });
    const { r, land } = await openPlay([A, B]);
    land(1);
    expect([players['player-a'].paused, players['player-b'].paused]).toEqual([true, false]);
    fireEvent.press(r.getByTestId('reel-shop-b'));
    await waitFor(() => r.getByTestId('shop-sheet'));
    expect([players['player-a'].paused, players['player-b'].paused]).toEqual([true, true]);
    fireEvent.press(r.getByTestId('shop-sheet-close'));
    await waitFor(() => expect(players['player-b'].paused).toBe(false));
    expect(players['player-a'].paused).toBe(true);
  });

  it('H6 · the sign-in prompt is over the video too: it stops, and carries on when the prompt closes', async () => {
    const { r } = await openPlay([VIDEO()]);
    fireEvent.press(r.getByTestId('reel-like-v1'));           // not signed in → the prompt
    await waitFor(() => expect(players['player-v1'].paused).toBe(true));
    expect(followerApi.like).not.toHaveBeenCalled();
  });
});

/* ═══════════════════════════════════════════ the feeds — videos that play in a card */

describe('a feed · the products open over a video playing in its card', () => {
  it('H7 · Home: it stops while the products are open and carries on after', async () => {
    _setPlayerForTests(FakeVideo);
    followerApi.circles.mockResolvedValue(ok({ creators: [], brands: [] }));
    followerApi.feed.mockResolvedValue(ok({ posts: [VIDEO()], more: false }));
    const r = render(<Home navigation={nav()} />);
    await waitFor(() => r.getByTestId('video-v1'));
    const [, play] = r.UNSAFE_getByType(FlatList).props.viewabilityConfigCallbackPairs;
    act(() => { play.onViewableItemsChanged({ viewableItems: [token(VIDEO(), 0)], changed: [] }); });
    expect(players['player-v1'].paused).toBe(false);
    fireEvent.press(r.getByTestId('post-shop-v1'));
    await waitFor(() => r.getByTestId('shop-sheet'));
    expect(players['player-v1'].paused).toBe(true);
    fireEvent.press(r.getByTestId('shop-sheet-close'));
    await waitFor(() => expect(players['player-v1'].paused).toBe(false));
  });

  it('H7 · an opened post\'s feed: the same', async () => {
    _setPlayerForTests(FakeVideo);
    const PHOTO = VIDEO({ id: 'ph1', media_kind: 'image', media: [{ id: 'm9', url: 'https://x/photo.jpg', cover_url: null }], deal_page: false });
    const NEXT = VIDEO({ id: 'v2', from: 'creator' });
    followerApi.more.mockResolvedValue(ok({ posts: [NEXT], more: false }));
    const r = render(<Post navigation={nav()} route={{ params: { postId: 'ph1', post: PHOTO } }} />);
    await waitFor(() => r.getByTestId('video-v2'));
    const [, play] = r.UNSAFE_getByType(FlatList).props.viewabilityConfigCallbackPairs;
    act(() => { play.onViewableItemsChanged({ viewableItems: [token(NEXT, 0)], changed: [] }); });
    expect(players['player-v2'].paused).toBe(false);
    fireEvent.press(r.getByTestId('post-shop-v2'));
    await waitFor(() => r.getByTestId('shop-sheet'));
    expect(players['player-v2'].paused).toBe(true);
    fireEvent.press(r.getByTestId('shop-sheet-close'));
    await waitFor(() => expect(players['player-v2'].paused).toBe(false));
  });

  it('H7 · every screen that plays a video and opens the products hands the rule its "covered"', () => {
    const fs = require('fs');
    const path = require('path');
    const dir = path.join(__dirname, '../../../screens/shop');
    const using = fs.readdirSync(dir).filter((f) => f.endsWith('.js') && /useAutoplay\(/.test(fs.readFileSync(path.join(dir, f), 'utf8')));
    expect(using.sort()).toEqual(['HomeScreen.js', 'OfferPostsScreen.js', 'PlayScreen.js', 'PostScreen.js']);
    for (const f of using) expect(fs.readFileSync(path.join(dir, f), 'utf8')).toMatch(/useAutoplay\('[a-z]+', \w+, nav\.covered\)/);
  });
});

/* ═══════════════════════════════════════════ the three pieces, each on its own */

describe('the pieces', () => {
  it('H8 · useShopNav says "covered" while the products or the sign-in prompt are open', () => {
    let sn;
    function Probe() { sn = useShopNav(nav(), { tab: true }); return null; }
    render(<Probe />);
    expect(sn.covered).toBe(false);
    act(() => sn.openShop(VIDEO()));
    expect(sn.covered).toBe(true);
    act(() => sn.closeShop());
    expect(sn.covered).toBe(false);
    act(() => sn.needSignIn());
    expect(sn.covered).toBe(true);
    act(() => sn.closeSignIn());
    expect(sn.covered).toBe(false);
  });

  it('H8 · useAutoplay: held → nothing plays, but it still knows which video is on screen; lifted → that one', () => {
    const A = VIDEO({ id: 'a' });
    let out;
    function Probe({ held }) { out = useAutoplay('play', [A], held); return null; }
    const r = render(<Probe held={false} />);
    act(() => { out.seenProps.viewabilityConfigCallbackPairs[1].onViewableItemsChanged({ viewableItems: [token(A, 0)], changed: [] }); });
    expect(out).toMatchObject({ playingId: 'a', shownId: 'a', held: false });
    const rules = out.seenProps;
    r.rerender(<Probe held />);
    expect(out).toMatchObject({ playingId: null, shownId: 'a', held: true });
    r.rerender(<Probe held={false} />);
    expect(out).toMatchObject({ playingId: 'a', shownId: 'a', held: false });
    expect(out.seenProps).toBe(rules);                       // the list's rules are never remade
  });

  it('H9 · the player: held stops it, and the seconds watched are sent when it stops, once', () => {
    _setPlayerForTests(FakeVideo);
    const now = jest.spyOn(Date, 'now');
    now.mockReturnValue(1000000);
    const r = render(<ShopVideo post={VIDEO()} height={400} active surface="play" tapToPause soundToggle muted={false} />);
    expect(players['player-v1'].paused).toBe(false);
    now.mockReturnValue(1000000 + 4200);
    r.rerender(<ShopVideo post={VIDEO()} height={400} active held surface="play" tapToPause soundToggle muted={false} />);
    expect(players['player-v1'].paused).toBe(true);
    expect(track).toHaveBeenCalledWith('watch', 'v1', 'play', expect.objectContaining({ dwell_ms: 4200 }));
    now.mockReturnValue(1000000 + 60000);                     // a minute among the products is not watching
    r.rerender(<ShopVideo post={VIDEO()} height={400} active surface="play" tapToPause soundToggle muted={false} />);
    expect(players['player-v1'].paused).toBe(false);
    expect(track.mock.calls.filter((c) => c[0] === 'watch')).toHaveLength(1);
    now.mockRestore();
  });

  it('H9 · a player that is not held behaves exactly as before', () => {
    _setPlayerForTests(FakeVideo);
    const r = render(<ShopVideo post={VIDEO()} height={400} active surface="home" />);
    expect(players['player-v1'].paused).toBe(false);
    r.rerender(<ShopVideo post={VIDEO()} height={400} active={false} surface="home" />);
    expect(players['player-v1'].paused).toBe(true);
  });
});
