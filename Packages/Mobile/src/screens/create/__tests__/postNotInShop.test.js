/**
 * listing-shop-safety — the creator's post page while her live post is not in the shop (board C1,
 * check 27). Contract: features/listing-shop-safety
 *
 * A hidden or out-of-stock product is a pause now: her post stays hers and stays approved, but
 * shoppers cannot see it until the brand shows or restocks one. The page said "In the shop now."
 * all the same. It now says "Not in the shop right now", gives the server's reason, and the card
 * under it speaks of the post's sales, not of being in the shop.
 */
import React from 'react';
import { StyleSheet } from 'react-native';
import { render, waitFor } from '@testing-library/react-native';

jest.mock('../../../services/api', () => ({
  influencerApi: { getPost: jest.fn(), takeDownPost: jest.fn(), deletePost: jest.fn(), createPost: jest.fn(), createOwnPost: jest.fn(), postPlaces: jest.fn() },
  brandApi: {}, referenceApi: {}, clearSession: jest.fn(), uploadFile: jest.fn(), uploadContentFile: jest.fn(),
}));
jest.mock('../../../../App', () => ({ AuthContext: require('react').createContext({ setRole: () => {} }) }));
jest.mock('@react-navigation/native', () => ({ useFocusEffect: (cb) => { const React = require('react'); React.useEffect(() => cb(), [cb]); } }));

const { influencerApi } = require('../../../services/api');
const { settingsTokens: T } = require('../../../theme/tokens');
const PostStatus = require('../PostStatusScreen').default;

const nav = () => ({ goBack: jest.fn(), navigate: jest.fn(), replace: jest.fn(), setParams: jest.fn(), addListener: jest.fn(() => () => {}), dispatch: jest.fn() });
const ok = (data) => ({ success: true, data });
const yr = new Date().getFullYear();
const WHY = 'Every product in this post is hidden or out of stock. It is back by itself when the brand shows or restocks one.';
const SET_WHY = 'A piece of this set is hidden or out of stock. The post is back by itself when the set is whole.';
const POST = (over = {}) => ({
  id: 'p1', state: 'live', status: 'approved', title: 'Spider man x', caption: null, code: 'F53VBW',
  collaboration: { id: 'ci1', brand_id: 'b1', brand_name: 'Aveen fashion boutique and desiner studio', campaign_name: 'Sunrise sale', set_name: 'A', posting_date: `${yr}-10-17` },
  kind: 'offer', offer_id: 'o1', products: [], theme_tags: [], media: [], facets: {}, sent_back: null, removed: null,
  sales: { orders: 0, commission: 0 }, sales_words: 'No sales yet', can: { take_down: true }, not_in_shop: null, ...over,
});
const texts = (node) => node.findAll((n) => typeof n.type === 'string' && n.type === 'Text').map((n) => [].concat(n.props.children).filter((c) => typeof c === 'string' || typeof c === 'number').join(''));
const open = async (post) => {
  influencerApi.getPost.mockResolvedValue(ok({ post }));
  const r = render(<PostStatus navigation={nav()} route={{ params: { postId: 'p1' } }} />);
  await waitFor(() => r.getByTestId(`post-status-${post.state}`));
  return r;
};

beforeEach(() => jest.clearAllMocks());

describe('her live post', () => {
  it('in the shop: the page is as it was — "In the shop now." and no blue box', async () => {
    const r = await open(POST());
    expect(r.queryByTestId('not-in-shop')).toBeNull();
    r.getByText('In the shop now.'); r.getByText('No sales yet');
  });

  it('not in the shop right now: a blue box says so with the server\'s reason, and the page no longer says "In the shop now."', async () => {
    const r = await open(POST({ not_in_shop: WHY }));
    const box = r.getByTestId('not-in-shop');
    expect(texts(box)).toEqual(['Not in the shop right now', WHY]);
    expect(StyleSheet.flatten(box.props.style).backgroundColor).toBe(T.state.waiting.bg);     // waiting is blue
    expect(r.queryByText('In the shop now.')).toBeNull();                                      // it said both
    r.getByText('Sales while live'); r.getByText('No sales yet');
    r.getByTestId('share'); r.getByTestId('take-down');                                        // her post is still hers
  });

  it('a set with a piece missing: the same box, with the set\'s own sentence', async () => {
    const r = await open(POST({ not_in_shop: SET_WHY }));
    expect(texts(r.getByTestId('not-in-shop'))).toEqual(['Not in the shop right now', SET_WHY]);
  });

  it('a post that is not live never shows the box, whatever the server sends', async () => {
    const approved = await open(POST({ state: 'approved', goes_live_on: `${yr}-10-20`, not_in_shop: WHY }));
    expect(approved.queryByTestId('not-in-shop')).toBeNull();
    const inReview = await open(POST({ state: 'in_review', status: 'submitted', submitted_at: `${yr}-10-10T09:00:00Z`, not_in_shop: WHY }));
    expect(inReview.queryByTestId('not-in-shop')).toBeNull();
  });
});
