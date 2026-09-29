/**
 * post-links-codes — the creator's Share (L2, L3), Where to share what (L4), Store and collection
 * links (L5), a post's Stats (L6); the brand's posts and codes (L7) and Copy all codes (L8).
 * The words are the board's. Contract: features/post-links-codes · rules §4.14
 */
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Share, Linking } from 'react-native';

jest.mock('../../../services/api', () => ({
  influencerApi: { postShare: jest.fn(), postStats: jest.fn(), myLinks: jest.fn(), getPost: jest.fn() },
  brandApi: { setPosts: jest.fn(), setPostStats: jest.fn() },
  referenceApi: {}, clearSession: jest.fn(), uploadFile: jest.fn(),
}));
jest.mock('../../../../App', () => ({ AuthContext: require('react').createContext({ setRole: () => {} }) }));
jest.mock('@react-navigation/native', () => ({ useFocusEffect: (cb) => { const React = require('react'); React.useEffect(() => cb(), [cb]); } }));
jest.mock('@react-native-clipboard/clipboard', () => ({ setString: jest.fn(), getString: jest.fn(() => Promise.resolve('')) }));

const Clipboard = require('@react-native-clipboard/clipboard');
const { influencerApi, brandApi } = require('../../../services/api');
const PostShare = require('../PostShareScreen').default;
const WhereToShare = require('../WhereToShareScreen').default;
const StoreLinks = require('../StoreLinksScreen').default;
const PostStats = require('../PostStatsScreen').default;
const BrandSetPosts = require('../../brand/BrandSetPostsScreen').default;

const nav = () => ({ goBack: jest.fn(), navigate: jest.fn(), replace: jest.fn(), addListener: jest.fn(() => () => {}) });
const ok = (data) => ({ success: true, data });
const yr = new Date().getFullYear();
const CH = [['ig', 'Instagram', 'story link sticker'], ['yt', 'YouTube', 'description or pinned comment'], ['wa', 'WhatsApp', 'status, chats, groups'], ['fb', 'Facebook', 'post or story'], ['o', 'Other', 'X, LinkedIn, Telegram, SMS']];
const SHARE = (over = {}) => ({
  post_id: 'p1', title: 'Festive Sarees', state: 'live', brand_name: 'Sri Lakshmi Silks', offer_line: 'Flat 20% off',
  live_since: `${yr}-10-12`, goes_live_on: null, code: 'K7M2F9', caption_line: 'Shop this look on INFLX: search code K7M2F9',
  links: CH.map(([c, label, where]) => ({ channel: c, label, where, url: `https://inflx.in/p/K7M2F9/${c}`, display: `inflx.in/p/K7M2F9/${c}` })),
  follower_view: 'https://inflx.in/p/K7M2F9',
  where: [
    { title: 'Reel or post caption · Instagram, Facebook', body: "Links can't be tapped in captions, so end with your caption line and post code.", sample: 'Shop this look on INFLX: search code K7M2F9' },
    { title: 'Story · Instagram, Facebook', body: 'Add a link sticker with the post link for that app.', sample: 'inflx.in/p/K7M2F9/ig' },
    { title: 'Bio · Instagram, YouTube', body: 'Put your store link, not a post link. It always shows everything you have live.', sample: null },
    { title: 'YouTube video or Short', body: 'Paste the link in the description or a pinned comment.', sample: 'inflx.in/p/K7M2F9/yt' },
    { title: 'WhatsApp', body: 'Status, chats or groups. The link opens the post straight away.', sample: 'inflx.in/p/K7M2F9/wa' },
    { title: 'Anywhere else', body: 'X, LinkedIn, Telegram, SMS, a blog. Use the Other link.', sample: 'inflx.in/p/K7M2F9/o' },
  ],
  ...over,
});
const LINKS = {
  store: { handle: 'priya', display: 'inflx.in/s/priya', url: 'https://inflx.in/s/priya',
    links: [['ig', 'Instagram bio', 412], ['yt', 'YouTube', 96], ['wa', 'WhatsApp', 58], ['fb', 'Facebook', 12], ['o', 'Other', 7]]
      .map(([c, label, v]) => ({ channel: c, label, visits: v, url: `https://inflx.in/s/priya/${c}`, display: `inflx.in/s/priya/${c}` })) },
  collections: [{ id: 'c1', name: 'My Dasara picks', kind: 'products', items: 4, visits: 31, url: 'https://inflx.in/c/DSR4K2', display: 'inflx.in/c/DSR4K2' }],
};

beforeEach(() => jest.clearAllMocks());

describe('L2 · L3 — Share your post', () => {
  it('live: the code with Copy → "Copied", the caption line, one link per channel with where it goes', async () => {
    influencerApi.postShare.mockResolvedValue(ok(SHARE()));
    const n = nav();
    const { getByText, getByTestId, queryByTestId } = render(<PostShare navigation={n} route={{ params: { postId: 'p1' } }} />);
    await waitFor(() => getByTestId('post-share'));
    getByText('Festive Sarees'); getByText('Sri Lakshmi Silks · Flat 20% off · since 12 Oct');
    getByText('K7M2F9');
    getByText("For captions, where links can't be tapped. Followers type it in INFLX search. It never changes.");
    fireEvent.press(getByTestId('copy-code'));
    expect(Clipboard.setString).toHaveBeenCalledWith('K7M2F9');
    getByText('✓ Copied');
    getByText('Shop this look on INFLX: search code K7M2F9');
    for (const [c, label, where] of CH) { getByText(label); getByText(`inflx.in/p/K7M2F9/${c}`); getByText(where); }
    fireEvent.press(getByTestId('link-wa-copy'));
    expect(Clipboard.setString).toHaveBeenCalledWith('https://inflx.in/p/K7M2F9/wa');
    expect(queryByTestId('goes-live')).toBeNull();
    fireEvent.press(getByTestId('where'));
    expect(n.navigate).toHaveBeenCalledWith('WhereToShare', { postId: 'p1' });
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    fireEvent.press(getByTestId('follower-view'));
    expect(open).toHaveBeenCalledWith('https://inflx.in/p/K7M2F9');
  });

  it('approved, not live yet: the banner says when the links start working', async () => {
    influencerApi.postShare.mockResolvedValue(ok(SHARE({ title: 'Festive kurtis', state: 'approved', live_since: null, goes_live_on: `${yr}-10-20`, code: 'P3W8HX', caption_line: 'Shop this look on INFLX: search code P3W8HX' })));
    const { getByText, getByTestId } = render(<PostShare navigation={nav()} route={{ params: { postId: 'p1' } }} />);
    await waitFor(() => getByTestId('goes-live'));
    getByText('Goes live on 20 Oct');
    getByText('Your code and links are ready so you can prepare captions. Anyone who taps before 20 Oct sees "This post goes live on 20 Oct" and your store.');
    getByText('P3W8HX');
  });

  it('a link opens the phone\'s Share sheet', async () => {
    influencerApi.postShare.mockResolvedValue(ok(SHARE()));
    const share = jest.spyOn(Share, 'share').mockResolvedValue({});
    const { getByText, getByTestId } = render(<PostShare navigation={nav()} route={{ params: { postId: 'p1' } }} />);
    await waitFor(() => getByTestId('post-share'));
    fireEvent.press(getByText('inflx.in/p/K7M2F9/yt'));
    expect(share).toHaveBeenCalledWith({ message: 'https://inflx.in/p/K7M2F9/yt' });
  });
});

describe('L4 — Where to share what', () => {
  it('each place with its line or link; the bio uses her store link', async () => {
    influencerApi.postShare.mockResolvedValue(ok(SHARE()));
    influencerApi.myLinks.mockResolvedValue(ok(LINKS));
    const { getByText, getByTestId } = render(<WhereToShare navigation={nav()} route={{ params: { postId: 'p1' } }} />);
    await waitFor(() => getByTestId('where-to-share'));
    getByText('Reel or post caption · Instagram, Facebook');
    getByText("Links can't be tapped in captions, so end with your caption line and post code.");
    getByText('Put your store link, not a post link. It always shows everything you have live.');
    getByText('inflx.in/s/priya/ig');
    getByText('X, LinkedIn, Telegram, SMS, a blog. Use the Other link.');
  });
});

describe('L5 — Store and collection links', () => {
  it('the store link per channel with visits, the collection link, the handle line', async () => {
    influencerApi.myLinks.mockResolvedValue(ok(LINKS));
    const { getByText, getByTestId } = render(<StoreLinks navigation={nav()} />);
    await waitFor(() => getByTestId('store-links'));
    getByText('inflx.in/s/priya');
    getByText('Opens your INFLX store with every live post and collection. Best for your bio.');
    getByText('Instagram bio'); getByText('412 visits this month'); getByText('96 visits'); getByText('7 visits');
    getByText('My Dasara picks'); getByText('inflx.in/c/DSR4K2'); getByText('4 products · 31 visits');
    getByText('Each order from a collection still pays you under the collaboration its product came from.');
    getByText('Changed your handle? Your old store links keep working and open your store.');
    fireEvent.press(getByTestId('store-ig-copy'));
    expect(Clipboard.setString).toHaveBeenCalledWith('https://inflx.in/s/priya/ig');
  });
});

describe('L6 — a post\'s stats', () => {
  const STATS = { post_id: 'p1', title: 'Festive Sarees', code: 'K7M2F9', brand_name: 'Sri Lakshmi Silks', live_since: `${yr}-10-12`, state: 'live',
    totals: { visits: 1284, orders: 37, sales: 41200, commission: 4120 },
    visits: [['ig', 'Instagram', 812], ['code', 'Post code', 214], ['wa', 'WhatsApp', 146], ['yt', 'YouTube', 82], ['o', 'Other', 30]].map(([c, l, v]) => ({ channel: c, label: l, visits: v })),
    orders: [{ channel: 'ig', label: 'Instagram', orders: 21, sales: 24600 }, { channel: 'code', label: 'Post code', orders: 8, sales: 9100 }, { channel: 'inflx', label: 'In INFLX', orders: 3, sales: 2200 }] };

  it('visits, orders and what she earned; by channel; "In INFLX" explained; never who bought', async () => {
    influencerApi.postStats.mockResolvedValue(ok(STATS));
    const { getByText, getAllByText, getByTestId } = render(<PostStats navigation={nav()} route={{ params: { postId: 'p1' } }} />);
    await waitFor(() => getByTestId('post-stats'));
    getByText('Stats · Festive Sarees');
    getByText('Sri Lakshmi Silks · Code K7M2F9 · live since 12 Oct');
    getByText('1,284'); getByText('37'); getByText('₹4,120'); getByText('to you');
    getByText('812'); expect(getAllByText('Post code')).toHaveLength(2); getByText('214');
    getByText('21 · ₹24,600 sales'); getByText('8 · ₹9,100'); getByText('In INFLX'); getByText('3 · ₹2,200');
    getByText('"In INFLX" = the shopper found your post inside INFLX, with no tap on your links in the 30 days before buying. You earn on every one of these orders either way.');
  });

  it('the brand opens the same breakdown for a post made for its set', async () => {
    brandApi.setPostStats.mockResolvedValue(ok({ ...STATS, visits: [], orders: [], totals: { visits: 0, orders: 0, sales: 0, commission: 0 } }));
    const { getByText, getByTestId } = render(<PostStats navigation={nav()} route={{ params: { postId: 'p1', brand: { campaignId: 'c1', setId: 's1' } } }} />);
    await waitFor(() => getByTestId('post-stats'));
    expect(brandApi.setPostStats).toHaveBeenCalledWith('c1', 's1', 'p1');
    getByText('commission');
    getByText('No visits yet. Share your code and links to bring shoppers here.');
    getByText('No orders yet.');
  });
});

describe('L7 · L8 — the brand\'s posts and codes', () => {
  it('each post with its code and numbers; the set so far; Copy all codes copies the live list and offers Share', async () => {
    const text = 'Shop our Diwali Denim looks on INFLX. Search a code:\nK7M2F9 · Festive Sarees by Priya\nT9QW4D · Weekend denim by Sneha';
    brandApi.setPosts.mockResolvedValue(ok({
      campaign_name: 'Diwali Denim', set_name: 'Set A', creators: 3, live: 2,
      posts: [
        { id: 'a', title: 'Festive Sarees', code: 'K7M2F9', state: 'live', creator_name: 'Priya Rao', totals: { visits: 1284, orders: 37, sales: 41200, commission: 4120 } },
        { id: 'b', title: 'Weekend denim', code: 'T9QW4D', state: 'live', creator_name: 'Sneha K', totals: { visits: 640, orders: 12, sales: 18400, commission: 1470 } },
        { id: 'c', title: 'Festive kurtis', code: 'P3W8HX', state: 'approved', creator_name: 'Priya Rao', goes_live_on: `${yr}-10-20`, totals: { visits: 0, orders: 0, sales: 0, commission: 0 } },
      ],
      totals: { orders: 49, sales: 59600, commission: 5590, inflx_fee: 4768, you_receive: 49242 },
      copy_text: text,
    }));
    const share = jest.spyOn(Share, 'share').mockResolvedValue({});
    const n = nav();
    const { getByText, getByTestId } = render(<BrandSetPosts navigation={n} route={{ params: { campaignId: 'c1', setId: 's1', setName: 'Set A' } }} />);
    await waitFor(() => getByTestId('set-posts'));
    getByText('Posts · Set A');
    getByText('Diwali Denim · Set A · 3 creators · 2 live posts');
    getByText('Festive Sarees · Priya'); getByText('K7M2F9');
    getByText('1284 visits · 37 orders · ₹41,200 sales · ₹4,120 commission');
    getByText('Goes live 20 Oct');
    getByText('49 · ₹59,600'); getByText('₹5,590'); getByText('₹4,768'); getByText('₹49,242');
    fireEvent.press(getByTestId('copy-all'));
    expect(Clipboard.setString).toHaveBeenCalledWith(text);
    getByText('Copied 2 post codes');
    getByText('Paste it into WhatsApp, a poster or your own posts. Orders through these codes still pay each creator her commission.');
    fireEvent.press(getByTestId('share-codes'));
    expect(share).toHaveBeenCalledWith({ message: text });
    fireEvent.press(getByTestId('post-a'));
    expect(n.navigate).toHaveBeenCalledWith('BrandPostStats', { postId: 'a', brand: { campaignId: 'c1', setId: 's1' } });
  });
});
