/**
 * shopper-app-fixes — the small faults found on the way (founder, 5 Oct 2026: "fix the small issues"),
 * the ones outside ordering:
 *   S4  a post link that is a video opens Play on top, once — it put a second copy of all the tabs
 *       on the stack
 *   S5  a collection that could not be read has Try again; one that has gone says the server's sentence
 *   S7  the creator app's createPost was written twice; the first could never run and is gone
 * The real screens, with the server's data shapes.
 */
import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import fs from 'fs';
import path from 'path';

let mockNav = null;
jest.mock('../../../services/api', () => ({
  followerApi: {
    post: jest.fn(), more: jest.fn(), code: jest.fn(), collection: jest.fn(), saveProduct: jest.fn(), unsaveProduct: jest.fn(),
    deal: jest.fn(), getBag: jest.fn(), putBag: jest.fn(), postEvents: jest.fn(() => Promise.resolve({ success: true })),
  },
  authApi: { registerOneSignalPlayerId: jest.fn() },
  setDeviceHeader: jest.fn(), clearSession: jest.fn(() => Promise.resolve()),
}));
jest.mock('../../../services/events', () => ({ track: jest.fn(), flush: jest.fn() }));
jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (cb) => { const React = require('react'); React.useEffect(() => { const off = cb(); return typeof off === 'function' ? off : undefined; }, [cb]); },
  useNavigation: () => mockNav,
}));

const { followerApi } = require('../../../services/api');
const { shopStore } = require('../../../components/shop/shopStore');
const Post = require('../PostScreen').default;
const Collection = require('../CollectionScreen').default;

const nav = () => ({ goBack: jest.fn(), navigate: jest.fn(), push: jest.fn(), replace: jest.fn(), pop: jest.fn(), isFocused: jest.fn(() => true), addListener: jest.fn(() => () => {}) });
const ok = (data) => ({ success: true, data });
const no = (code, message) => ({ success: false, error: { code, message } });
const OFFLINE = no('NETWORK_ERROR', 'Cannot connect to server. Check your connection.');
const LOST = "Couldn't load. Check your connection.";

beforeEach(async () => { jest.clearAllMocks(); await AsyncStorage.clear(); shopStore._reset(); mockNav = nav(); });

const POST = (extra = {}) => ({
  id: 'v1', code: 'K7M2F9', title: 'This is for BOGI', caption: 'This is for BOGI', share_url: 'https://inflx.in/p/K7M2F9',
  creator: { id: 'c1', name: 'Akshaya Reddy' }, brand: { id: 'b1', name: 'Aveen fashion boutique and desiner studio' },
  media_kind: 'video', media_layout: 'single', tag_style: null, media: [{ id: 'm1', url: 'https://x/v.mp4', mime: 'video/mp4', cover_url: 'https://x/c.jpg' }],
  offer: null, deal_page: false, gift_line: null, products: [{ id: 'pr1', name: 'Blue polo', image_url: null, price: 899, shopper_price: 899, struck: false, in_stock: true }],
  counts: { likes: 0, comments: 0, shares: 0 }, mine: { liked: false, saved: false, saved_products: [] }, ...extra,
});

describe('S4 · a link to a video opens Play on top, once', () => {
  it('the link\'s page is replaced by Play with that video first — never a second copy of the tabs', async () => {
    followerApi.code.mockResolvedValue(ok({ state: 'live', post: POST() }));
    const n = nav();
    render(<Post navigation={n} route={{ params: { code: 'K7M2F9', ch: 'wa' } }} />);
    await waitFor(() => expect(n.replace).toHaveBeenCalled());
    expect(n.replace).toHaveBeenCalledTimes(1);
    const [route, params] = n.replace.mock.calls[0];
    expect(route).toBe('PlayOver');
    expect(params).toMatchObject({ start: 'v1' });
    expect(typeof params.at).toBe('number');
    expect(n.replace).not.toHaveBeenCalledWith('Tabs', expect.anything());
    expect(n.navigate).not.toHaveBeenCalled();
  });

  it('the route it opens is registered, with the same Play screen', () => {
    const src = fs.readFileSync(path.join(__dirname, '../../../navigation/FollowerNavigator.js'), 'utf8');
    expect(src).toMatch(/<Stack\.Screen name="PlayOver" component=\{PlayScreen\}/);
  });

  it('a link to a photo post still opens the post\'s own page', async () => {
    followerApi.code.mockResolvedValue(ok({ state: 'live', post: POST({ id: 'p9', media_kind: 'image', media: [{ id: 'm2', url: 'https://x/p.jpg', mime: 'image/jpeg', cover_url: null }] }) }));
    followerApi.more.mockResolvedValue(ok({ posts: [], more: false }));
    const n = nav();
    const r = render(<Post navigation={n} route={{ params: { code: 'K7M2F9' } }} />);
    await waitFor(() => expect(followerApi.more).toHaveBeenCalled());
    expect(n.replace).not.toHaveBeenCalled();
    expect(r.getAllByText('Akshaya Reddy').length).toBeGreaterThan(0);          // the post's own page, with its creator
  });
});

describe('S5 · a collection that could not be read', () => {
  const COL = { id: 'col1', name: 'Denim picks', kind: 'products', count: 1, creator: { id: 'c1', name: 'Akshaya Reddy' }, hidden: false, posts: [],
    products: [{ collection_item_id: 'i1', id: 'pr1', name: 'Blue polo', image_url: null, brand: { id: 'b1', name: 'Aveen' }, price: 899, shopper_price: 899, struck: false, saved: false, offer: null, line: '₹899' }] };

  it('says so with Try again, and Try again reads it', async () => {
    followerApi.collection.mockResolvedValueOnce(OFFLINE);
    const r = render(<Collection navigation={nav()} route={{ params: { id: 'col1' } }} />);
    await r.findByTestId('collection-failed');
    r.getByText(LOST);
    followerApi.collection.mockResolvedValue(ok(COL));
    await act(async () => { fireEvent.press(r.getByText('Try again')); });
    await waitFor(() => r.getByText('Blue polo'));
    expect(followerApi.collection).toHaveBeenCalledTimes(2);
    expect(r.queryByTestId('collection-failed')).toBeNull();
  });

  it('one that has gone says what the server says, with nothing to retry', async () => {
    followerApi.collection.mockResolvedValue(no('NOT_FOUND', 'This collection is no longer in the shop'));
    const r = render(<Collection navigation={nav()} route={{ params: { id: 'col9' } }} />);
    await r.findByTestId('collection-gone');
    r.getByText('This collection is no longer in the shop');
    expect(r.queryByText('Try again')).toBeNull();
    expect(r.queryByText(LOST)).toBeNull();
  });
});

describe('S7 · one name, one call', () => {
  it('in the creator\'s calls createPost is written once, and it is the shoppable post', () => {
    const src = fs.readFileSync(path.join(__dirname, '../../../services/api.js'), 'utf8');
    const start = src.indexOf('export const influencerApi');
    const end = src.indexOf('\nexport ', start + 10);
    const block = src.slice(start, end > start ? end : undefined);
    const defs = block.match(/^\s*createPost\s*:/gm) || [];
    expect(defs.length).toBe(1);
    expect(block).toMatch(/createPost:\s*\(ciId\) => api\.post\('\/influencers\/me\/shoppable-posts'/);
  });
});
