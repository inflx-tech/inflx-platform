/**
 * shopper-feed-sound-comments-sheet — two things in the shopper app.
 * Contract: features/shopper-feed-sound-comments-sheet · 03-expected-outputs.md (S1–S7, C1–C9)
 *
 *   S  A video playing in a feed card had no sound and no way to turn it on. It still starts
 *      silent; a button at its bottom-left turns the sound on or off.
 *   C  A tap on the comment mark opened a page of its own. The comments now rise from the bottom
 *      of the screen she is on, as a sheet, and closing them leaves her where she was.
 *
 * The player is native and absent in jest, so a stand-in keeps the props it was given.
 */
import React from 'react';
import fs from 'fs';
import path from 'path';
import { FlatList, Modal, StyleSheet, Dimensions } from 'react-native';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

jest.mock('../../../services/api', () => ({
  followerApi: {
    feed: jest.fn(), circles: jest.fn(), post: jest.fn(), more: jest.fn(), saved: jest.fn(), resolveSaved: jest.fn(),
    like: jest.fn(), unlike: jest.fn(), save: jest.fn(), unsave: jest.fn(), saveProduct: jest.fn(), unsaveProduct: jest.fn(),
    comments: jest.fn(), addComment: jest.fn(), reportComment: jest.fn(),
    getBag: jest.fn(), putBag: jest.fn(), postEvents: jest.fn(() => Promise.resolve({ success: true })),
  },
  setDeviceHeader: jest.fn(), clearSession: jest.fn(() => Promise.resolve()),
}));
jest.mock('../../../services/events', () => ({ track: jest.fn(), flush: jest.fn() }));
// The screen's focus: the effect runs when it comes in front; `comeBack()` is her return to it.
const mockInFront = new Set();
jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (cb) => {
    const R = require('react');
    const latest = R.useRef(cb);
    latest.current = cb;
    R.useEffect(() => { const off = cb(); return typeof off === 'function' ? off : undefined; }, [cb]);
    R.useEffect(() => { mockInFront.add(latest); return () => { mockInFront.delete(latest); }; }, []);
  },
}));

const { followerApi } = require('../../../services/api');
const { track } = require('../../../services/events');
const { shopStore } = require('../shopStore');
const { engaged } = require('../engaged');
const { feedSound } = require('../feedSound');
const { _setPlayerForTests } = require('../ShopVideo');
const { PostCard } = require('../bitsShop');
const { useShopNav } = require('../useShopNav');
const CommentsSheet = require('../CommentsSheet').default;
const { SHEET_PART } = require('../CommentsSheet');
const Home = require('../../../screens/shop/HomeScreen').default;
const Post = require('../../../screens/shop/PostScreen').default;
const Play = require('../../../screens/shop/PlayScreen').default;

const nav = () => ({ goBack: jest.fn(), navigate: jest.fn(), push: jest.fn(), replace: jest.fn(), addListener: jest.fn(() => () => {}) });
const ok = (data) => ({ success: true, data });
const comeBack = () => act(async () => { [...mockInFront].forEach((ref) => { ref.current(); }); });
const flat = (node) => StyleSheet.flatten(node.props.style) || {};
const token = (item, index) => ({ item, index, isViewable: true, key: item.id });

const VIDEO = (over = {}) => ({
  id: 'v1', code: 'JD54B4', title: 'This is for BOGI', caption: 'This is for BOGI', share_url: 'https://inflx.in/p/JD54B4',
  creator: { id: 'c1', name: 'Akshaya Reddy', handle: 'akshaya', avatar: null }, brand: { id: 'b1', name: 'Aveen fashion boutique', logo: null },
  media_kind: 'video', media_layout: 'single',
  media: [{ id: 'm1', url: 'https://api/v1/media/post/m1', cover_url: 'https://api/v1/media/post/m1/cover' }],
  offer: null, deal_page: false, gift_line: null,
  products: [{ id: 'h', name: 'heels', image_url: 'https://x/heels.jpg', price: 4599, shopper_price: 4599, struck: false, in_stock: true }],
  counts: { likes: 12, comments: 3, shares: 1, saves: 0 }, mine: { liked: false, saved: false, saved_products: [] },
  facets: { price_band: null, theme: null, category: [] },
  ...over,
});
const PHOTO = (over = {}) => VIDEO({ id: 'ph1', media_kind: 'image', media: [{ id: 'm9', url: 'https://x/photo.jpg', cover_url: null }], ...over });

const SIGN_IN = { title: 'Sign in to like and comment', body: 'Your likes and comments are public. Saving and following work without signing in.' };
const K = (i) => ({ id: `k${i}`, body: `comment ${i}`, at: `2026-10-05T12:0${i}:00Z`, ago: `${i}m`, author: { name: 'Anusha', creator: false }, can_report: true });
const asGuest = (total = 2) => ({ total, signed_in: false, sign_in: SIGN_IN, comments: [K(1), K(2)] });
const asHer = (total = 2) => ({ total, signed_in: true, sign_in: null, comments: [K(1), K(2)] });

const players = {};
function FakeVideo(props) {
  players[props.testID] = props;
  const { View } = require('react-native');
  return <View testID={`fake-${props.testID}`} />;
}

async function openHome(posts) {
  _setPlayerForTests(FakeVideo);
  followerApi.circles.mockResolvedValue(ok({ creators: [], brands: [] }));
  followerApi.feed.mockResolvedValue(ok({ posts, more: false }));
  const n = nav();
  const r = render(<Home navigation={n} />);
  await waitFor(() => r.getByTestId(`post-${posts[0].id}`));
  const [, play] = r.UNSAFE_getByType(FlatList).props.viewabilityConfigCallbackPairs;
  const land = (i) => act(() => { play.onViewableItemsChanged({ viewableItems: [token(posts[i], i)], changed: [] }); });
  land(0);
  return { r, n, land };
}

beforeEach(async () => {
  jest.clearAllMocks();
  for (const k of Object.keys(players)) delete players[k];
  mockInFront.clear();
  _setPlayerForTests(null);
  feedSound._reset();
  await AsyncStorage.clear();
  shopStore._reset();
  await shopStore.set({ welcomed: true });
});

/* ═══════════════════════════════════════════ S · sound on a feed video */

describe('S · a video in a feed card: silent to begin with, with a sound button', () => {
  it('S1 · it starts silent, and the button is on the video, bottom-left, clear of the shop bar', async () => {
    const { r } = await openHome([VIDEO()]);
    expect(players['player-v1']).toMatchObject({ paused: false, muted: true });
    const b = r.getByTestId('video-sound-v1');
    expect(b.props.accessibilityLabel).toBe('Sound off');
    expect(flat(b)).toMatchObject({ position: 'absolute', left: 10, bottom: 54 });
    expect(flat(b).right).toBeUndefined();
    expect(flat(b).top).toBeUndefined();
  });

  it('S2 · one tap turns the sound on, another turns it off — and neither opens the video', async () => {
    const { r, n } = await openHome([VIDEO()]);
    fireEvent.press(r.getByTestId('video-sound-v1'));
    expect(players['player-v1'].muted).toBe(false);
    expect(r.getByTestId('video-sound-v1').props.accessibilityLabel).toBe('Sound on');
    expect(track).toHaveBeenCalledWith('sound_on', 'v1', 'home');
    fireEvent.press(r.getByTestId('video-sound-v1'));
    expect(players['player-v1'].muted).toBe(true);
    expect(track).toHaveBeenCalledWith('sound_off', 'v1', 'home');
    expect(n.navigate).not.toHaveBeenCalled();
    expect(n.push).not.toHaveBeenCalled();
  });

  it('S3 · a tap anywhere else on the video still opens it full screen', async () => {
    const { r, n } = await openHome([VIDEO()]);
    fireEvent.press(r.getByTestId('fake-player-v1'));
    expect(n.navigate).toHaveBeenCalledWith('PlayTab', expect.objectContaining({ start: 'v1' }));
  });

  it('S4 · turned on once, it is on for the next video too; only the video that is playing has the button', async () => {
    const A = VIDEO({ id: 'a' });
    const B = VIDEO({ id: 'b' });
    const { r, land } = await openHome([A, B]);
    expect(r.queryByTestId('video-sound-b')).toBeNull();
    fireEvent.press(r.getByTestId('video-sound-a'));
    land(1);
    expect([players['player-a'].paused, players['player-b'].paused]).toEqual([true, false]);
    expect(players['player-b'].muted).toBe(false);                 // she did not have to turn it on again
    expect(r.queryByTestId('video-sound-a')).toBeNull();
    r.getByTestId('video-sound-b');
  });

  it('S5 · the choice is for the feeds only and only until the app closes: Play keeps its own, and nothing is saved', async () => {
    const { r } = await openHome([VIDEO()]);
    fireEvent.press(r.getByTestId('video-sound-v1'));
    expect(await AsyncStorage.getItem('inflx_video_sound')).toBeNull();
    r.unmount();
    // Play: her saved setting (none → off), whatever the feed button says.
    followerApi.feed.mockResolvedValue(ok({ posts: [VIDEO()], more: false }));
    const play = render(<Play navigation={nav()} route={{ params: {} }} />);
    await waitFor(() => play.getByTestId('reel-v1'));
    expect(players['player-v1'].muted).toBe(true);
    play.unmount();
    // the app opened again: the feed is silent
    feedSound._reset();
    const again = await openHome([VIDEO()]);
    expect(players['player-v1'].muted).toBe(true);
    again.r.unmount();
  });

  it('S6 · the same in an opened post\'s feed, sharing the one choice', async () => {
    feedSound.set(true);
    _setPlayerForTests(FakeVideo);
    const NEXT = VIDEO({ id: 'v2', from: 'creator' });
    followerApi.more.mockResolvedValue(ok({ posts: [NEXT], more: false }));
    const r = render(<Post navigation={nav()} route={{ params: { postId: 'ph1', post: PHOTO() } }} />);
    await waitFor(() => r.getByTestId('video-v2'));
    const [, play] = r.UNSAFE_getByType(FlatList).props.viewabilityConfigCallbackPairs;
    act(() => { play.onViewableItemsChanged({ viewableItems: [token(NEXT, 0)], changed: [] }); });
    expect(players['player-v2']).toMatchObject({ paused: false, muted: false });
    fireEvent.press(r.getByTestId('video-sound-v2'));
    expect(players['player-v2'].muted).toBe(true);
    expect(feedSound.isOn()).toBe(false);
  });

  it('S7 · an older app build (no player) and a photo post have no sound button; Play\'s button is where it was', async () => {
    followerApi.circles.mockResolvedValue(ok({ creators: [], brands: [] }));
    followerApi.feed.mockResolvedValue(ok({ posts: [VIDEO(), PHOTO()], more: false }));
    const old = render(<Home navigation={nav()} />);
    await waitFor(() => old.getByTestId('post-v1'));
    expect(old.queryByTestId('video-sound-v1')).toBeNull();
    expect(old.queryByTestId('video-sound-ph1')).toBeNull();
    old.unmount();

    _setPlayerForTests(FakeVideo);
    followerApi.feed.mockResolvedValue(ok({ posts: [VIDEO()], more: false }));
    const play = render(<Play navigation={nav()} route={{ params: {} }} />);
    await waitFor(() => play.getByTestId('reel-v1'));
    expect(flat(play.getByTestId('video-sound-v1'))).toMatchObject({ top: 12, right: 12 });
    expect(play.getByTestId('video-v1').props.pointerEvents).toBe('auto');
  });
});

/* ═══════════════════════════════════════════ C · comments as a sheet */

describe('C · comments come up from the bottom of the screen she is on', () => {
  it('C1 · Home: the comment mark opens the sheet over the feed — no new page', async () => {
    followerApi.comments.mockResolvedValue(ok(asGuest(3)));
    const { r, n } = await openHome([VIDEO()]);
    expect(r.queryByTestId('comments-sheet')).toBeNull();
    fireEvent.press(r.getByTestId('post-comments-v1'));
    await waitFor(() => r.getByTestId('comment-k1'));
    expect(n.navigate).not.toHaveBeenCalled();
    expect(n.push).not.toHaveBeenCalled();
    expect(followerApi.comments).toHaveBeenCalledWith('v1');
    expect(r.getByTestId('comments-title').props.children).toBe('Comments · 3');
    r.getByTestId('post-v1');                                      // the post is still there underneath
  });

  it('C2 · it is a sheet from the bottom: slides up, about three-quarters of the screen, the post in sight above', async () => {
    followerApi.comments.mockResolvedValue(ok(asGuest()));
    const r = render(<CommentsSheet post={VIDEO()} visible onClose={jest.fn()} navigation={nav()} />);
    await waitFor(() => r.getByTestId('comment-k1'));
    const modal = r.UNSAFE_getByType(Modal);
    expect(modal.props).toMatchObject({ transparent: true, animationType: 'slide', visible: true });
    const sheet = flat(r.getByTestId('comments-sheet'));
    expect(SHEET_PART).toBeGreaterThan(0.6);
    expect(SHEET_PART).toBeLessThan(0.85);
    expect(sheet.height).toBe(Math.round(Dimensions.get('window').height * SHEET_PART));
    expect(sheet.maxHeight).toBe('100%');                          // with the keypad up it takes what room is left
    expect(sheet.borderTopLeftRadius).toBeGreaterThan(0);
    expect(flat(r.getByTestId('comments-sheet').parent).justifyContent || 'flex-end').toBe('flex-end');
  });

  it('C3 · three ways to close it — ✕, a tap above it, the phone\'s Back — each leaves her where she was', async () => {
    followerApi.comments.mockResolvedValue(ok(asGuest()));
    const onClose = jest.fn();
    const r = render(<CommentsSheet post={VIDEO()} visible onClose={onClose} navigation={nav()} />);
    await waitFor(() => r.getByTestId('comment-k1'));
    fireEvent.press(r.getByTestId('comments-sheet-close'));
    fireEvent.press(r.getByTestId('comments-sheet-dim'));
    act(() => { r.UNSAFE_getByType(Modal).props.onRequestClose(); });
    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it('C4 · a video waits while its comments are open, and carries on when they close', async () => {
    followerApi.comments.mockResolvedValue(ok(asGuest()));
    const { r } = await openHome([VIDEO()]);
    expect(players['player-v1'].paused).toBe(false);
    fireEvent.press(r.getByTestId('post-comments-v1'));
    await waitFor(() => r.getByTestId('comment-k1'));
    expect(players['player-v1'].paused).toBe(true);
    fireEvent.press(r.getByTestId('comments-sheet-close'));
    await waitFor(() => expect(r.queryByTestId('comments-sheet')).toBeNull());
    expect(players['player-v1'].paused).toBe(false);
  });

  it('C5 · the full-screen video feed: the same sheet, and the video waits for it', async () => {
    _setPlayerForTests(FakeVideo);
    followerApi.feed.mockResolvedValue(ok({ posts: [VIDEO()], more: false }));
    followerApi.comments.mockResolvedValue(ok(asGuest()));
    const n = nav();
    const r = render(<Play navigation={n} route={{ params: {} }} />);
    await waitFor(() => r.getByTestId('reel-v1'));
    const [, play] = r.UNSAFE_getByType(FlatList).props.viewabilityConfigCallbackPairs;
    act(() => { play.onViewableItemsChanged({ viewableItems: [token(VIDEO(), 0)], changed: [] }); });
    fireEvent.press(r.getByTestId('reel-comments-v1'));
    await waitFor(() => r.getByTestId('comments-sheet'));
    expect(n.navigate).not.toHaveBeenCalled();
    expect(players['player-v1'].paused).toBe(true);
    fireEvent.press(r.getByTestId('comments-sheet-dim'));
    await waitFor(() => expect(players['player-v1'].paused).toBe(false));
  });

  it('C6 · signed in: she writes and sends without leaving the post, and the number on the card follows', async () => {
    await shopStore.set({ welcomed: true });
    followerApi.comments.mockResolvedValueOnce(ok(asHer(5)));
    followerApi.addComment.mockResolvedValue(ok({ id: 'k9' }));
    const { r, n } = await openHome([VIDEO()]);
    expect(r.getByTestId('post-comments-n-v1').props.children).toBe('3');     // the feed's own, older number
    fireEvent.press(r.getByTestId('post-comments-v1'));
    await waitFor(() => r.getByTestId('comment-input'));
    expect(r.getByTestId('post-comments-n-v1').props.children).toBe('5');     // what the sheet just read
    fireEvent.changeText(r.getByTestId('comment-input'), 'Is this cotton?');
    followerApi.comments.mockResolvedValue(ok(asHer(6)));
    await act(async () => { fireEvent.press(r.getByTestId('comment-send')); });
    expect(followerApi.addComment).toHaveBeenCalledWith('v1', 'Is this cotton?');
    expect(track).toHaveBeenCalledWith('comment', 'v1', 'home');
    await waitFor(() => expect(r.getByTestId('comments-title').props.children).toBe('Comments · 6'));
    expect(r.getByTestId('comment-input').props.value).toBe('');
    expect(r.getByTestId('post-comments-n-v1').props.children).toBe('6');
    fireEvent.press(r.getByTestId('comments-sheet-close'));
    await waitFor(() => expect(r.queryByTestId('comments-sheet')).toBeNull());
    expect(r.getByTestId('post-comments-n-v1').props.children).toBe('6');     // still right with the sheet closed
    expect(n.navigate).not.toHaveBeenCalled();
  });

  it('C7 · a guest: reads, and "Sign in" takes her to sign in — the sheet steps aside and is back, ready to write, when she returns', async () => {
    followerApi.comments.mockResolvedValue(ok(asGuest()));
    const { r, n } = await openHome([VIDEO()]);
    fireEvent.press(r.getByTestId('post-comments-v1'));
    await waitFor(() => r.getByTestId('comments-sign-in'));
    expect(r.queryByTestId('comment-input')).toBeNull();
    fireEvent.press(r.getByTestId('comments-sign-in-cta'));
    expect(n.navigate).toHaveBeenCalledWith('FollowerLogin', { reason: 'comment' });
    // A Modal lies over every page, so it must not stay up over the sign-in page.
    expect(r.UNSAFE_getAllByType(Modal).some((m) => m.props.visible && m.findAllByProps({ testID: 'comments-sheet' }).length)).toBe(false);

    followerApi.comments.mockResolvedValue(ok(asHer()));
    await comeBack();
    await waitFor(() => r.getByTestId('comment-input'));
    expect(r.queryByTestId('comments-sign-in')).toBeNull();
  });

  it('C8 · a post that has ended, and a failed read, say what the page said', async () => {
    followerApi.comments.mockResolvedValue({ success: false, error: { code: 'NOT_FOUND', message: 'This post is no longer in the shop' } });
    const gone = render(<CommentsSheet post={VIDEO()} visible onClose={jest.fn()} navigation={nav()} />);
    await waitFor(() => gone.getByTestId('comments-gone'));
    gone.getByText('This post is no longer in the shop');
    expect(gone.queryByText('Try again')).toBeNull();
    gone.getByTestId('comments-sheet-close');                      // and it can always be closed
    gone.unmount();

    followerApi.comments.mockResolvedValue({ success: false, error: { code: 'NETWORK_ERROR', message: 'Cannot connect' } });
    const down = render(<CommentsSheet post={VIDEO({ id: 'v9' })} visible onClose={jest.fn()} navigation={nav()} />);
    await waitFor(() => down.getByText('Try again'));
    followerApi.comments.mockResolvedValue(ok(asGuest()));
    await act(async () => { fireEvent.press(down.getByText('Try again')); });
    await waitFor(() => down.getByTestId('comment-k1'));
  });

  it('C9 · there is no comments page any more: every screen with a comment mark draws the sheet, and nothing is sent to "Comments"', () => {
    const SRC = path.join(__dirname, '../../..');
    expect(fs.existsSync(path.join(SRC, 'screens/shop/CommentsScreen.js'))).toBe(false);
    expect(fs.readFileSync(path.join(SRC, 'navigation/FollowerNavigator.js'), 'utf8')).not.toMatch(/Comments/);
    const dir = path.join(SRC, 'screens/shop');
    const marks = fs.readdirSync(dir).filter((f) => f.endsWith('.js') && /nav\.openComments/.test(fs.readFileSync(path.join(dir, f), 'utf8')));
    expect(marks.sort()).toEqual(['HomeScreen.js', 'OfferPostsScreen.js', 'PlayScreen.js', 'PostScreen.js']);
    for (const f of marks) expect(fs.readFileSync(path.join(dir, f), 'utf8')).toMatch(/<CommentsSheet post=\{nav\.commentsPost\} visible=\{!!nav\.commentsPost\} onClose=\{nav\.closeComments\} navigation=\{navigation\}/);
    // nowhere in the shopper app is anyone sent to a page called Comments
    const all = [];
    (function walk(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) { if (e.name !== '__tests__') walk(p); } else if (e.name.endsWith('.js')) all.push(p); } }(SRC));
    const senders = all.filter((p) => /navigate\(\s*['"]Comments['"]/.test(fs.readFileSync(p, 'utf8')));
    expect(senders).toEqual([]);

    let sn;
    const n = nav();
    function Probe() { sn = useShopNav(n, { tab: true }); return null; }
    render(<Probe />);
    act(() => sn.openComments(VIDEO()));
    expect(n.navigate).not.toHaveBeenCalled();
    expect(sn.commentsPost).toMatchObject({ id: 'v1' });
    expect(sn.covered).toBe(true);
    act(() => sn.closeComments());
    expect(sn.commentsPost).toBeNull();
    expect(sn.covered).toBe(false);
  });

  it('the number on a card with no sheet opened is the feed\'s own, as before', () => {
    engaged.setPost('zz', {});
    const r = render(<PostCard post={PHOTO({ counts: { likes: 1, comments: 1200, shares: 0, saves: 0 } })} surface="home" position={0}
      onOpen={jest.fn()} onShop={jest.fn()} onComments={jest.fn()} onCreator={jest.fn()} onBrand={jest.fn()} />);
    expect(r.getByTestId('post-comments-n-ph1').props.children).toBe('1.2K');
  });
});
