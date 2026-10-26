/**
 * post-engagement-stats — the "In INFLX" block on Post stats (C4, B4), the one line on Post status
 * (C3) and the brand's Set posts rows (B3), and the Comments screen for her (C5) and the brand (B5).
 * The words are the board's. Contract: features/post-engagement-stats · rules §4.15 · E18–E20
 */
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';

jest.mock('../../../services/api', () => ({
  influencerApi: { postStats: jest.fn(), getPost: jest.fn(), postComments: jest.fn(), postReply: jest.fn(), commentHide: jest.fn(), commentUnhide: jest.fn(), postPlaces: jest.fn(), takeDownPost: jest.fn(), deletePost: jest.fn(), createPost: jest.fn(), createOwnPost: jest.fn(), contentRefreshStats: jest.fn() },
  brandApi: { setPosts: jest.fn(), setPostStats: jest.fn(), setPostComments: jest.fn() },
  referenceApi: {}, clearSession: jest.fn(), uploadFile: jest.fn(), uploadContentFile: jest.fn(),
}));
jest.mock('../../../../App', () => ({ AuthContext: require('react').createContext({ setRole: () => {} }) }));
jest.mock('@react-navigation/native', () => ({ useFocusEffect: (cb) => { const React = require('react'); React.useEffect(() => cb(), [cb]); } }));
jest.mock('@react-native-clipboard/clipboard', () => ({ setString: jest.fn(), getString: jest.fn(() => Promise.resolve('')) }));

const { influencerApi, brandApi } = require('../../../services/api');
const PostStats = require('../PostStatsScreen').default;
const PostStatus = require('../PostStatusScreen').default;
const PostComments = require('../PostCommentsScreen').default;
const BrandSetPosts = require('../../brand/BrandSetPostsScreen').default;

const nav = () => ({ goBack: jest.fn(), navigate: jest.fn(), replace: jest.fn(), addListener: jest.fn(() => () => {}), getParent: () => null });
const ok = (data) => ({ success: true, data });
const yr = new Date().getFullYear();
const INFLX = { since: `${yr}-10-10`, views: 1840, likes: 212, comments: 38, shares: 19, saves: 64, shop_taps: 97, bag_adds: 23, finished: 410 };
const ZERO = { since: `${yr}-10-10`, views: 0, likes: 0, comments: 0, shares: 0, saves: 0, shop_taps: 0, bag_adds: 0, finished: null };
const STATS = (inflx) => ({ post_id: 'p1', title: 'Festive Sarees', code: 'K7M2F9', brand_name: 'Sri Lakshmi Silks', live_since: `${yr}-10-10`, state: 'live',
  totals: { visits: 1284, orders: 37, sales: 41200, commission: 4120 }, visits: [], orders: [], social: [], social_summary: null, inflx });
const COLLAB = { id: 'ci1', brand_id: 'b1', brand_name: 'Sri Lakshmi Silks', brand_logo: null, campaign_name: 'Diwali Denim', set_name: 'B', posting_date: `${yr}-10-17` };
const POST = (over = {}) => ({
  id: 'p1', state: 'live', status: 'approved', title: 'Festive Sarees', caption: null, collaboration: COLLAB, kind: 'offer', offer_id: 'o1', code: 'K7M2F9',
  live_since: `${yr}-10-10`, submitted_at: `${yr}-10-09T09:00:00Z`, products: [], theme_tags: [], media: [], facets: {}, sent_back: null, removed: null,
  sales: { orders: 37, commission: 4120 }, sales_words: '37 orders · ₹4,120 to you', can: {}, social: null, ...over,
});
const COMMENT = (id, body, over = {}) => ({ id, body, at: `${yr}-10-20T10:00:00Z`, ago: '2h', author: { name: 'Meghana', initials: 'M', creator: false }, hidden: false, replies: [], ...over });
const THREAD = (over = {}) => ({
  read_only: false, creator_name: 'Priya Rao', post_title: 'Festive Sarees', total: 38,
  comments: [
    COMMENT('c2', 'dm for cheap copies', { hidden: true, author: { name: 'Sruthi', initials: 'S', creator: false }, ago: '5h' }),
    COMMENT('c1', 'Where is this available in Vijayawada?', { replies: [{ id: 'r1', body: 'Sri Lakshmi Silks, Besant Road — or tap Shop on the post.', at: `${yr}-10-20T11:00:00Z`, ago: '1h', author: { name: 'Priya Rao', initials: 'PR', creator: true } }] }),
  ],
  ...over,
});

beforeEach(() => jest.clearAllMocks());

describe('C4 · B4 — the In INFLX block on Post stats (E18, E20)', () => {
  it('eight boxes for a video, the hint with the date, the comments box opens Comments; the money row and the channels stay', async () => {
    influencerApi.postStats.mockResolvedValue(ok(STATS(INFLX)));
    const n = nav();
    const { getByText, getAllByText, getByTestId } = render(<PostStats navigation={n} route={{ params: { postId: 'p1' } }} />);
    await waitFor(() => getByTestId('inflx-block'));
    getByText('1,284'); getByText('to you');                                   // the money row, as locked by Level 3
    expect(getAllByText('In INFLX').length).toBeGreaterThanOrEqual(1);
    getByText('1,840'); getByText('views'); getByText('212'); getByText('likes'); getByText('38 ›'); getByText('comments');
    getByText('19'); getByText('shares'); getByText('64'); getByText('saves'); getByText('97'); getByText('shop taps');
    getByText('23'); getByText('added to bag'); getByText('410'); getByText('finished');
    getByText('Shoppers inside INFLX since 10 Oct. Guests count for views, shares and taps; likes, comments and saves need an account.');
    fireEvent.press(getByTestId('inflx-comments'));
    expect(n.navigate).toHaveBeenCalledWith('PostComments', { postId: 'p1', title: 'Festive Sarees', brand: undefined });
    getByText('Visits by channel');
  });

  it('a photo post has no "finished" box; a post nobody opened shows zeros', async () => {
    influencerApi.postStats.mockResolvedValue(ok(STATS(ZERO)));
    const { getByTestId, queryByTestId, getAllByText } = render(<PostStats navigation={nav()} route={{ params: { postId: 'p1' } }} />);
    await waitFor(() => getByTestId('inflx-block'));
    expect(queryByTestId('inflx-finished')).toBeNull();
    expect(getAllByText('0').length).toBeGreaterThanOrEqual(6);
  });

  it('the brand sees the same block; its comments box opens the read-only Comments', async () => {
    brandApi.setPostStats.mockResolvedValue(ok(STATS(INFLX)));
    const n = nav();
    const { getByTestId, getByText } = render(<PostStats navigation={n} route={{ params: { postId: 'p1', brand: { campaignId: 'c1', setId: 's1' } } }} />);
    await waitFor(() => getByTestId('inflx-block'));
    getByText('commission');
    fireEvent.press(getByTestId('inflx-comments'));
    expect(n.navigate).toHaveBeenCalledWith('BrandPostComments', { postId: 'p1', title: 'Festive Sarees', brand: { campaignId: 'c1', setId: 's1' } });
  });

  it('an older server with no numbers draws no block', async () => {
    influencerApi.postStats.mockResolvedValue(ok(STATS(undefined)));
    const { getByTestId, queryByTestId } = render(<PostStats navigation={nav()} route={{ params: { postId: 'p1' } }} />);
    await waitFor(() => getByTestId('post-stats'));
    expect(queryByTestId('inflx-block')).toBeNull();
  });
});

describe('C3 — the one line on Post status (E18)', () => {
  it('"In INFLX · views · likes · comments" under Share and Stats; "nothing yet" in grey when none', async () => {
    influencerApi.getPost.mockResolvedValue(ok({ post: POST({ inflx: { views: 1840, likes: 212, comments: 38 } }) }));
    const { getByText, getByTestId } = render(<PostStatus navigation={nav()} route={{ params: { postId: 'p1' } }} />);
    await waitFor(() => getByTestId('inflx-line'));
    getByText('In INFLX · 1,840 views · 212 likes · 38 comments');
    getByText('Stats');
  });
  it('nothing yet', async () => {
    influencerApi.getPost.mockResolvedValue(ok({ post: POST({ inflx: { views: 0, likes: 0, comments: 0 } }) }));
    const { getByText, getByTestId } = render(<PostStatus navigation={nav()} route={{ params: { postId: 'p1' } }} />);
    await waitFor(() => getByTestId('inflx-line'));
    getByText('In INFLX · nothing yet');
  });
});

describe('B3 — the line on each Set posts row (E20)', () => {
  it('under visits and orders, above the social line', async () => {
    brandApi.setPosts.mockResolvedValue(ok({
      campaign_name: 'Diwali Denim', set_name: 'Set B', creators: 2, live: 2,
      posts: [
        { id: 'a', title: 'Festive Sarees', code: 'K7M2F9', state: 'live', creator_name: 'Priya Rao', totals: { visits: 1284, orders: 37, sales: 41200, commission: 4120 }, inflx: { views: 1840, likes: 212, comments: 37 } },
        { id: 'b', title: 'Office Edit', code: 'Q8RT2M', state: 'live', creator_name: 'Anusha K', totals: { visits: 0, orders: 0, sales: 0, commission: 0 }, inflx: { views: 0, likes: 0, comments: 0 } },
      ],
      totals: { orders: 37, sales: 41200, commission: 4120, inflx_fee: 3296, you_receive: 33784 }, copy_text: null,
    }));
    const { getByText, getByTestId } = render(<BrandSetPosts navigation={nav()} route={{ params: { campaignId: 'c1', setId: 's1', setName: 'Set B' } }} />);
    await waitFor(() => getByTestId('set-posts'));
    getByText('In INFLX · 1,840 views · 212 likes · 37 comments');
    getByText('In INFLX · nothing yet');
    getByTestId('inflx-a'); getByTestId('inflx-b');
  });
});

describe('C5 — her Comments (E19)', () => {
  it('newest first with her reply nested; the hidden one greyed with its line and Unhide; Reply opens the box; Send and Hide call the server', async () => {
    influencerApi.postComments.mockResolvedValue(ok(THREAD()));
    influencerApi.postReply.mockResolvedValue(ok({ comment: { id: 'r2' } }));
    influencerApi.commentHide.mockResolvedValue(ok({ id: 'c1', hidden: true }));
    influencerApi.commentUnhide.mockResolvedValue(ok({ id: 'c2', hidden: false }));
    const { getByText, getByTestId, queryByTestId } = render(<PostComments navigation={nav()} route={{ params: { postId: 'p1', title: 'Festive Sarees' } }} />);
    await waitFor(() => getByTestId('post-comments'));
    getByText('Comments · Festive Sarees');
    getByText('38 comments · newest first');
    getByText('Meghana'); getByText('Where is this available in Vijayawada?');
    getByText('You'); getByText('Sri Lakshmi Silks, Besant Road — or tap Shop on the post.');
    getByText('Hidden · only you see this'); getByTestId('unhide-c2');
    expect(queryByTestId('reply-c2')).toBeNull();
    expect(queryByTestId('reply-bar')).toBeNull();
    fireEvent.press(getByTestId('reply-c1'));
    getByTestId('reply-bar');
    fireEvent.changeText(getByTestId('reply-input'), 'Thank you!');
    getByText('10/300');
    fireEvent.press(getByTestId('reply-send'));
    await waitFor(() => expect(influencerApi.postReply).toHaveBeenCalledWith('p1', { reply_to: 'c1', body: 'Thank you!' }));
    await waitFor(() => expect(influencerApi.postComments).toHaveBeenCalledTimes(2));
    fireEvent.press(getByTestId('hide-c1'));
    await waitFor(() => expect(influencerApi.commentHide).toHaveBeenCalledWith('c1'));
    fireEvent.press(getByTestId('unhide-c2'));
    await waitFor(() => expect(influencerApi.commentUnhide).toHaveBeenCalledWith('c2'));
  });

  it('the server\'s refusal is shown in its words', async () => {
    influencerApi.postComments.mockResolvedValue(ok(THREAD()));
    influencerApi.commentUnhide.mockResolvedValue({ success: false, error: { message: 'INFLX removed this comment.' } });
    const { getByText, getByTestId } = render(<PostComments navigation={nav()} route={{ params: { postId: 'p1', title: 'Festive Sarees' } }} />);
    await waitFor(() => getByTestId('post-comments'));
    fireEvent.press(getByTestId('unhide-c2'));
    await waitFor(() => getByText('INFLX removed this comment.'));
  });
});

describe('B5 — the brand\'s Comments, read only (E20)', () => {
  it('visible comments and her replies with the creator tag; no Reply, Hide or box; the read-only line', async () => {
    brandApi.setPostComments.mockResolvedValue(ok(THREAD({ read_only: true, total: 37, comments: [THREAD().comments[1]] })));
    const { getByText, getByTestId, queryByTestId, queryByText } = render(<PostComments navigation={nav()} route={{ params: { postId: 'p1', title: 'Festive Sarees', brand: { campaignId: 'c1', setId: 's1' } } }} />);
    await waitFor(() => getByTestId('post-comments'));
    expect(brandApi.setPostComments).toHaveBeenCalledWith('c1', 's1', 'p1');
    getByText('37 comments · newest first · Only Priya Rao can reply or hide');
    getByText('Where is this available in Vijayawada?');
    getByText('Priya Rao'); getByText('creator');
    expect(queryByTestId('reply-c1')).toBeNull(); expect(queryByTestId('hide-c1')).toBeNull(); expect(queryByTestId('reply-bar')).toBeNull();
    expect(queryByText('You')).toBeNull();
  });
});
