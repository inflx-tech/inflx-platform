/**
 * shoppable-posts-v2 — the creator app's Create tab: P1 the tab, P2 brand, P3 collaboration, P4 post
 * type, P5 offer, P6/P7 products, P8 price post, P9 theme, P10 media, P11 review, P12/P13/P15 a sent
 * post, P14 her posts, P17–P20 collections. The words are the board's.
 * Contract: features/shoppable-posts-v2 · rules Docs/OFFER_TERMS_POSTS_RULES.md §4
 */
import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';

// React 19 (React Native 0.81) runs a screen's after-load effects later under test than React 18
// did. These screens copy the saved draft into their own state in such an effect, so a tap made
// before it runs is overwritten. On a phone the effect runs within a frame of the data arriving;
// settle() lets it run before the test acts, as it would for a person. Nothing asserted changes.
const settle = () => act(async () => {});

jest.mock('../../../services/api', () => ({
  influencerApi: {
    createHome: jest.fn(), postBrands: jest.fn(), postCollaborations: jest.fn(), myShoppablePosts: jest.fn(), createPost: jest.fn(),
    getPost: jest.fn(), postOptions: jest.fn(), updatePost: jest.fn(), postUploadUrl: jest.fn(), submitPost: jest.fn(),
    takeDownPost: jest.fn(), deletePost: jest.fn(), collectionOptions: jest.fn(), myCollections: jest.fn(), createCollection: jest.fn(),
    getCollection: jest.fn(), updateCollection: jest.fn(), deleteCollection: jest.fn(),
  },
  uploadContentFile: jest.fn(), brandApi: {}, referenceApi: {}, clearSession: jest.fn(), uploadFile: jest.fn(),
}));
jest.mock('../../../../App', () => ({ AuthContext: require('react').createContext({ setRole: () => {} }) }));
jest.mock('@react-navigation/native', () => ({ useFocusEffect: (cb) => { const React = require('react'); React.useEffect(() => cb(), [cb]); } }));
jest.mock('react-native-image-picker', () => ({ launchImageLibrary: jest.fn() }));

const { influencerApi, uploadContentFile } = require('../../../services/api');
const { launchImageLibrary } = require('react-native-image-picker');
const CreateHome = require('../CreateHomeScreen').default;
const PostBrand = require('../PostBrandScreen').default;
const PostCollab = require('../PostCollabScreen').default;
const PostType = require('../PostTypeScreen').default;
const PostOffer = require('../PostOfferScreen').default;
const PostProducts = require('../PostProductsScreen').default;
const PostPrice = require('../PostPriceScreen').default;
const PostTheme = require('../PostThemeScreen').default;
const PostMedia = require('../PostMediaScreen').default;
const PostReview = require('../PostReviewScreen').default;
const PostStatus = require('../PostStatusScreen').default;
const MyPosts = require('../MyPostsScreen').default;
const Collections = require('../CollectionsScreen').default;
const NewCollection = require('../NewCollectionScreen').default;
const Collection = require('../CollectionScreen').default;
const { routeFor } = require('../../../components/create/bitsCreate');
const { targetOf } = require('../../influencer/CreatorNotificationsScreen');

const nav = () => ({ goBack: jest.fn(), navigate: jest.fn(), replace: jest.fn(), setParams: jest.fn(), addListener: jest.fn(() => () => {}), dispatch: jest.fn() });
const ok = (data) => ({ success: true, data });
const yr = new Date().getFullYear();
const disabled = (el) => !!(el.props.accessibilityState && el.props.accessibilityState.disabled);

const COLLAB = { id: 'ci1', brand_id: 'b1', brand_name: 'Urban Threads', brand_logo: null, campaign_name: 'Diwali Denim', set_name: 'Set A', posting_date: `${yr}-10-10` };
const POST = (over = {}) => ({
  id: 'p1', state: 'draft', status: 'draft', title: 'Weekend denim', caption: null, collaboration: COLLAB, kind: 'offer', offer_id: 'o1',
  offer: { type: 'Bundle', deal: 'Any 2 for ₹2,999', name: 'Any 2 Jeans for ₹2,999', ends_on: `${yr}-11-10` },
  products: [], theme_tags: [], media_kind: 'image', media_layout: 'carousel', tag_style: 'soft_editorial', media: [],
  facets: { category: ['Men › Bottomwear › Jeans'], offer: 'Bundle · Any 2 for ₹2,999', price_band: 'Under ₹2,999', top_price: 2499, theme: 'Winter · Office · Classic' },
  draft_step: 3, draft_state: {}, sent_back: null, removed: null, sales: { orders: 0, commission: 0 }, sales_words: 'No sales yet',
  can: { edit: true, fix: false, send: true, delete: true, take_down: false }, updated_at: `${yr}-10-01T10:00:00Z`, ...over,
});
const JEANS = [
  { id: 'j1', name: "Levi's 511 Slim", price: 2299, shopper_price: 2299 },
  { id: 'j2', name: 'Wrangler Regular', price: 1999, shopper_price: 1999 },
  { id: 'j3', name: "Levi's 512 Taper", price: 2499, shopper_price: 2499 },
];
const OPTIONS = (over = {}) => ({
  post_id: 'p1', collaboration: COLLAB,
  kinds: { offer: { available: true, count: 2, why: null }, price: { available: false, count: 0, why: 'Every product you have in this collaboration is in an offer.' } },
  offer_types: [{ key: 'discount', label: 'Discount', count: 1 }, { key: 'bundle', label: 'Bundle', count: 1 }],
  offer_types_hidden: "BOGO, Volume and Free gift aren't shown because this collaboration has none.",
  offers: [
    { id: 'o1', name: 'Any 2 Jeans for ₹2,999', offer_type: 'bundle', type_label: 'Bundle · Pick-any', products: 15, ends_on: `${yr}-11-10`, ends_soon: null },
    { id: 'o2', name: '20% off shirts', offer_type: 'discount', type_label: 'Discount · %', products: 4, ends_on: `${yr}-10-14`,
      ends_soon: `"20% off shirts" ends 14 Oct, 4 days after posting. The post leaves the shop when it ends.` },
  ],
  pool: { offer_id: 'o1', name: 'Any 2 Jeans for ₹2,999', type_label: 'Bundle · Pick-any', count: 3, products: JEANS, rule: { min: 2, auto: false, gifts: [] } },
  price_products: [
    { id: 'f1', name: 'Linen shirt · Sage', price: 849, shopper_price: 849, leaf_id: 'l-shirts', path: [{ id: 'm', name: 'Men' }, { id: 't', name: 'Topwear' }, { id: 'l-shirts', name: 'Shirts' }] },
    { id: 'f2', name: 'Crew tee · Black', price: 699, shopper_price: 699, leaf_id: 'l-tees', path: [{ id: 'm', name: 'Men' }, { id: 't', name: 'Topwear' }, { id: 'l-tees', name: 'T-shirts' }] },
    { id: 'f3', name: 'Chino', price: 1499, shopper_price: 1499, leaf_id: 'l-tr', path: [{ id: 'm', name: 'Men' }, { id: 'b', name: 'Bottomwear' }, { id: 'l-tr', name: 'Trousers' }] },
  ],
  price_bands: [
    { id: 'b499', label: 'Under ₹499', min_price: 0, max_price: 499 }, { id: 'b999', label: 'Under ₹999', min_price: 0, max_price: 999 },
    { id: 'b1999', label: 'Under ₹1,999', min_price: 0, max_price: 1999 }, { id: 'b2999', label: 'Under ₹2,999', min_price: 0, max_price: 2999 },
    { id: 'b3000', label: '₹3,000+', min_price: 3000, max_price: null },
  ],
  theme_tags: [
    { group: 'season', tags: [{ id: 's1', name: 'Summer' }, { id: 's2', name: 'Winter' }] },
    { group: 'occasion', tags: [{ id: 'o-1', name: 'Office' }, { id: 'o-2', name: 'Party' }] },
    { group: 'style', tags: [{ id: 'st1', name: 'Classic' }] },
    { group: 'use', tags: [{ id: 'u1', name: 'Everyday' }] },
  ],
  ...over,
});

beforeEach(() => {
  jest.clearAllMocks();
  influencerApi.getPost.mockResolvedValue(ok({ post: POST() }));
  influencerApi.postOptions.mockResolvedValue(ok(OPTIONS()));
  influencerApi.updatePost.mockImplementation((id, body) => Promise.resolve(ok({ post: POST(body) })));
});

describe('P1 · P16 — the Create tab', () => {
  it('collaborations still needing a post, Start makes a draft; her posts; the + asks post or collection', async () => {
    influencerApi.createHome.mockResolvedValue(ok({
      needs: [{ campaign_influencer_id: 'ci1', brand_id: 'b1', brand_name: 'Urban Threads', set_name: 'Set A', posting_date: `${yr}-10-10`, done: 0, min: 1 }],
      counts: { live: 1, in_review: 0 }, total: 1, collections: 2, can_post: true,
      recent: [POST({ id: 'p9', state: 'live', status: 'approved', title: 'Weekend denim', code: 'K7M2F9', sales_words: '12 sales · ₹3,420 to you' })],
      store_link: 'inflx.in/s/priya',
    }));
    influencerApi.createPost.mockResolvedValue(ok({ post: POST({ id: 'p2' }) }));
    const n = nav();
    const { getByText, getByTestId } = render(<CreateHome navigation={n} />);
    await waitFor(() => getByTestId('create-home'));
    getByText('Needs a shoppable post · 1');
    getByText('Urban Threads · Set A');
    getByText('0 of 1 · before 10 Oct');
    // post-links-codes (L1) changes P1: three cards, "My posts", each row with its code, Share and Stats.
    getByText('Create shoppable post'); getByText('Create collection'); getByText('My store and collection links'); getByText('inflx.in/s/priya');
    getByText('My posts');
    getByText(`Urban Threads · Code K7M2F9 · live since 10 Oct`);
    getByTestId('share-p9'); getByTestId('stats-p9');
    getByText('Collections · 2');
    fireEvent.press(getByTestId('start-ci1'));
    await waitFor(() => expect(n.navigate).toHaveBeenCalledWith('PostType', { postId: 'p2' }));
    fireEvent.press(getByTestId('create-plus'));
    getByText('What do you want to make?');
    fireEvent.press(getByTestId('make-collection'));
    fireEvent.press(getByTestId('make-next'));
    expect(n.navigate).toHaveBeenCalledWith('NewCollection');
  });

  it('before any collaboration can post, New shoppable post is off and says why', async () => {
    influencerApi.createHome.mockResolvedValue(ok({ needs: [], counts: {}, total: 0, recent: [], collections: 0, can_post: false }));
    const { getByText, getByTestId } = render(<CreateHome navigation={nav()} />);
    await waitFor(() => getByTestId('create-home'));
    expect(disabled(getByTestId('new-post'))).toBe(true);
    getByText('Posting opens after both signatures and your shoot plan.');
  });
});

describe('P2 · P3 — brand, then collaboration', () => {
  it('a brand waiting for its shoot is locked; the open one leads to its collaborations', async () => {
    influencerApi.postBrands.mockResolvedValue(ok({ brands: [
      { id: 'b1', name: 'Urban Threads', logo_url: null, open: true, line: '2 collaborations you can post for' },
      { id: 'b3', name: 'Label Fern', logo_url: null, open: false, line: 'Opens after your shoot plan' },
    ] }));
    const n = nav();
    const { getByText, getByTestId } = render(<PostBrand navigation={n} />);
    await waitFor(() => getByTestId('post-brand'));
    getByText('Step 1 of 8'); getByText('Which brand is this post for?');
    getByText('Opens after your shoot plan');
    expect(disabled(getByTestId('brand-b3'))).toBe(true);
    getByText('One brand per post. To show several brands together, make a collection.');
    fireEvent.press(getByTestId('next'));
    expect(n.navigate).toHaveBeenCalledWith('PostCollab', { brandId: 'b1' });
  });

  it('each collaboration says what she can sell, the posting date, posts done and earning; Next makes the draft', async () => {
    influencerApi.postCollaborations.mockResolvedValue(ok({ collaborations: [
      { id: 'ci1', campaign_name: 'Diwali Denim', set_name: 'Set A', sell_words: '2 offers + 12 products', posting_date: `${yr}-10-10`, posts_done: 0, posts_min: 1, earning: 'earning 10%', open: true },
      { id: 'ci2', campaign_name: 'Campus Fits', set_name: 'Set B', sell_words: '1 offer', posting_date: `${yr}-10-18`, posts_done: 0, posts_min: 1, earning: 'earning 8% + ₹5,000', open: true },
    ] }));
    influencerApi.createPost.mockResolvedValue(ok({ post: POST({ id: 'p5' }) }));
    const n = nav();
    const { getByText, getByTestId } = render(<PostCollab navigation={n} route={{ params: { brandId: 'b1' } }} />);
    await waitFor(() => getByTestId('post-collab'));
    getByText('2 offers + 12 products · live by 10 Oct');   // posting-date-last-day: was "posts on"
    getByText('0 of 1 posts done · earning 10%');
    getByText('0 of 1 posts done · earning 8% + ₹5,000');
    expect(disabled(getByTestId('next'))).toBe(true);
    fireEvent.press(getByTestId('collab-ci1'));
    fireEvent.press(getByTestId('next'));
    await waitFor(() => expect(n.navigate).toHaveBeenCalledWith('PostType', { postId: 'p5' }));
    expect(influencerApi.createPost).toHaveBeenCalledWith('ci1');
  });
});

describe('P4 · P5 — post type, offer type, one offer', () => {
  it('a price post the collaboration cannot make shows greyed with the reason', async () => {
    const n = nav();
    const { getByText, getByTestId } = render(<PostType navigation={n} route={{ params: { postId: 'p1' } }} />);
    await waitFor(() => getByTestId('post-type'));
    getByText('2 offers in this collaboration');
    getByText('Every product you have in this collaboration is in an offer.');
    expect(disabled(getByTestId('kind-price'))).toBe(true);
    fireEvent.press(getByTestId('kind-offer'));
    fireEvent.press(getByTestId('next'));
    await waitFor(() => expect(n.navigate).toHaveBeenCalledWith('PostOffer', { postId: 'p1' }));
    expect(influencerApi.updatePost).toHaveBeenCalledWith('p1', { post_kind: 'offer', draft_step: 4 });
  });

  it('types with counts, empty types named as hidden; an offer ending soon warns; Next saves the offer', async () => {
    influencerApi.getPost.mockResolvedValue(ok({ post: POST({ offer_id: null }) }));
    const n = nav();
    const { getByText, getByTestId, queryByText } = render(<PostOffer navigation={n} route={{ params: { postId: 'p1' } }} />);
    await waitFor(() => getByTestId('post-offer'));
    getByText(/Discount \(1\)/); getByText(/Bundle \(1\)/);
    getByText("BOGO, Volume and Free gift aren't shown because this collaboration has none.");
    fireEvent.press(getByTestId('type-discount'));
    getByText('Pick one discount offer');
    getByText('% · 4 products · till 14 Oct');
    getByText(/⚠ "20% off shirts" ends 14 Oct, 4 days after posting\. The post leaves the shop when it ends\./);
    expect(queryByText('Any 2 Jeans for ₹2,999')).toBeNull();
    fireEvent.press(getByTestId('offer-o2'));
    fireEvent.press(getByTestId('next'));
    await waitFor(() => expect(influencerApi.updatePost).toHaveBeenCalledWith('p1', { offer_id: 'o2', draft_step: 5 }));
    expect(n.navigate).toHaveBeenCalledWith('PostProducts', { postId: 'p1' });
  });
});

describe('P6 · P7 · P8 — products', () => {
  it('pick-any: Next stays off until the pick count is met', async () => {
    const n = nav();
    const { getByText, getByTestId } = render(<PostProducts navigation={n} route={{ params: { postId: 'p1' } }} />);
    await waitFor(() => getByTestId('post-products'));
    await settle();
    getByText('Any 2 Jeans for ₹2,999 · 3 products');
    getByText('Pick at least 2 so a shopper can complete the bundle from this post.');
    fireEvent.press(getByTestId('pick-j1'));
    expect(disabled(getByTestId('next'))).toBe(true);
    fireEvent.press(getByTestId('pick-j2'));
    getByText('2 picked ✓');
    expect(disabled(getByTestId('next'))).toBe(false);
    fireEvent.press(getByTestId('next'));
    await waitFor(() => expect(influencerApi.updatePost).toHaveBeenCalledWith('p1', { product_ids: ['j1', 'j2'], draft_step: 6 }));
    expect(n.navigate).toHaveBeenCalledWith('PostTheme', { postId: 'p1' });
  });

  it('fixed bundle: every product is added; free gift: the gift shows by itself', async () => {
    influencerApi.getPost.mockResolvedValue(ok({ post: POST({ products: [{ id: 'j1' }, { id: 'j2' }] }) }));
    influencerApi.postOptions.mockResolvedValue(ok(OPTIONS({ pool: { offer_id: 'o3', name: 'Shirt + Trouser + Belt ₹2,499', count: 2, products: JEANS.slice(0, 2), rule: { min: 2, auto: true, gifts: [] } } })));
    const a = render(<PostProducts navigation={nav()} route={{ params: { postId: 'p1' } }} />);
    await waitFor(() => a.getByTestId('fixed-all'));
    a.getByText('All 2 products are added for you');
    a.unmount();
    influencerApi.postOptions.mockResolvedValue(ok(OPTIONS({ pool: { offer_id: 'o4', name: 'Jackets + gift', count: 3, products: JEANS,
      rule: { min: 1, auto: false, gifts: ['Leather cap', 'Canvas belt', 'Silver coin'], gift_words: 'Free with this: Leather cap, Canvas belt or Silver coin. The shopper chooses one when spending ₹3,000.' } } })));
    const g = render(<PostProducts navigation={nav()} route={{ params: { postId: 'p1' } }} />);
    await waitFor(() => g.getByTestId('gift-words'));
    g.getByText('Free with this: Leather cap, Canvas belt or Silver coin. The shopper chooses one when spending ₹3,000.');
  });

  it('price post: the band and categories only filter; the choice is remembered', async () => {
    influencerApi.getPost.mockResolvedValue(ok({ post: POST({ kind: 'price', offer_id: null, offer: null }) }));
    const n = nav();
    const { getByText, getByTestId, queryByTestId } = render(<PostPrice navigation={n} route={{ params: { postId: 'p1' } }} />);
    await waitFor(() => getByTestId('post-price'));
    await settle();
    getByText('Shows your products up to ₹999, including cheaper ones.');
    expect(queryByTestId('pick-f3')).toBeNull();      // ₹1,499 is above Under ₹999
    getByText('Men › Topwear');
    fireEvent.press(getByTestId('leaf-Shirts'));
    expect(queryByTestId('pick-f2')).toBeNull();
    fireEvent.press(getByTestId('pick-f1'));
    fireEvent.press(getByTestId('next'));
    await waitFor(() => expect(influencerApi.updatePost).toHaveBeenCalledWith('p1', { product_ids: ['f1'], draft_state: { band_id: 'b999', leaf_ids: ['l-shirts'] }, draft_step: 6 }));
  });
});

describe('P9 · P10 — theme and media', () => {
  it('at most one tag per group: another tag in the group swaps it', async () => {
    const n = nav();
    const { getByText, getByTestId } = render(<PostTheme navigation={n} route={{ params: { postId: 'p1' } }} />);
    await waitFor(() => getByTestId('post-theme'));
    getByText("Pick at least 1 tag, and at most 1 from each group. Tags can't be changed once the post is live.");
    fireEvent.press(getByTestId('tag-Summer'));
    fireEvent.press(getByTestId('tag-Winter'));
    fireEvent.press(getByTestId('tag-Office'));
    getByText('Season · 1 picked'); getByText('Use · optional');
    fireEvent.press(getByTestId('next'));
    await waitFor(() => expect(influencerApi.updatePost).toHaveBeenCalledWith('p1', { theme_tag_ids: ['s2', 'o-1'], draft_step: 7 }));
  });

  it('upload goes straight to storage; the music warning sits where she uploads; a video over 90 s is refused', async () => {
    influencerApi.postUploadUrl.mockResolvedValue(ok({ key: 'posts/i/p1/a.jpg', url: 'https://r2/put', method: 'PUT', headers: { 'Content-Type': 'image/jpeg' } }));
    uploadContentFile.mockResolvedValue({ ok: true });
    launchImageLibrary.mockResolvedValue({ assets: [{ uri: 'file:///a.jpg', type: 'image/jpeg', fileSize: 2048, width: 1080, height: 1350 }] });
    const n = nav();
    const { getByText, getByTestId } = render(<PostMedia navigation={n} route={{ params: { postId: 'p1' } }} />);
    await waitFor(() => getByTestId('post-media'));
    getByText(/No copyrighted music\. INFLX checks every post, and one with copyrighted music is sent back\./);
    fireEvent.press(getByTestId('add-media'));
    await waitFor(() => getByTestId('slide-0'));
    expect(influencerApi.postUploadUrl).toHaveBeenCalledWith('p1', { content_type: 'image/jpeg', size_bytes: 2048, filename: undefined });
    expect(uploadContentFile).toHaveBeenCalledWith(expect.objectContaining({ key: 'posts/i/p1/a.jpg' }), 'file:///a.jpg');
    fireEvent.press(getByTestId('next'));
    await waitFor(() => expect(influencerApi.updatePost).toHaveBeenCalledWith('p1', {
      media_kind: 'image', media_layout: 'carousel', tag_style: 'soft_editorial',
      media: [{ r2_key: 'posts/i/p1/a.jpg', mime: 'image/jpeg', width: 1080, height: 1350, duration_s: null }], draft_step: 8,
    }));
    expect(n.navigate).toHaveBeenCalledWith('PostReview', { postId: 'p1' });
    fireEvent.press(getByTestId('kind-video'));
    launchImageLibrary.mockResolvedValue({ assets: [{ uri: 'file:///v.mp4', type: 'video/mp4', fileSize: 4096, duration: 95 }] });
    fireEvent.press(getByTestId('add-media'));
    await waitFor(() => getByText('Each video can be up to 90 seconds.'));
  });
});

describe('P11 — review and send', () => {
  it('the four facets, what it is for, then sent to INFLX', async () => {
    influencerApi.getPost.mockResolvedValue(ok({ post: POST({ products: JEANS.slice(0, 3), draft_step: 8 }) }));
    influencerApi.submitPost.mockResolvedValue(ok({ post: POST({ state: 'in_review' }) }));
    const n = nav();
    const { getByText, getByTestId } = render(<PostReview navigation={n} route={{ params: { postId: 'p1' } }} />);
    await waitFor(() => getByTestId('post-review'));
    await settle();
    getByText('How shoppers will find it');
    getByText('Men › Bottomwear › Jeans'); getByText('from your products');
    getByText('Bundle · Any 2 for ₹2,999'); getByText('from your offer');
    getByText('Under ₹2,999'); getByText('costliest item ₹2,499');
    getByText('Winter · Office · Classic');
    getByText('Urban Threads · Diwali Denim · Set A');
    fireEvent.changeText(getByTestId('caption'), 'Office-ready denim that works past 6 pm.');
    fireEvent.press(getByTestId('send'));
    await waitFor(() => expect(influencerApi.submitPost).toHaveBeenCalledWith('p1'));
    expect(influencerApi.updatePost).toHaveBeenCalledWith('p1', { caption: 'Office-ready denim that works past 6 pm.' });
    expect(n.navigate).toHaveBeenCalledWith('PostStatus', { postId: 'p1', justSent: true });
    getByText('Send to INFLX for review');
  });

  it("a refusal from the server is shown in its words", async () => {
    influencerApi.getPost.mockResolvedValue(ok({ post: POST({ draft_step: 8 }) }));
    influencerApi.submitPost.mockResolvedValue({ success: false, error: { message: 'Pick at least 1 theme tag.' } });
    const { getByText, getByTestId } = render(<PostReview navigation={nav()} route={{ params: { postId: 'p1' } }} />);
    await waitFor(() => getByTestId('post-review'));
    fireEvent.press(getByTestId('send'));
    await waitFor(() => getByText('Pick at least 1 theme tag.'));
  });
});

describe('P12 · P13 · P15 — a post after sending', () => {
  it('in review: INFLX checks it, not the brand; goes live as soon as it is approved', async () => {
    influencerApi.getPost.mockResolvedValue(ok({ post: POST({ state: 'in_review', status: 'submitted', submitted_at: `${yr}-10-08T09:00:00Z` }) }));
    const { getByText, getByTestId } = render(<PostStatus navigation={nav()} route={{ params: { postId: 'p1' } }} />);
    await waitFor(() => getByTestId('post-status-in_review'));
    getByText('WEEKEND DENIM'); getByText('In review since 8 Oct'); getByText('Usually within a day.');
    getByText("INFLX, not the brand. We check the products and offer match your collaboration, and that there's no copyrighted music.");
    getByText('As soon as INFLX approves it. Your last day to go live is 10 Oct.');
  });

  it('sent back: what INFLX said, what she can change, fix or start over', async () => {
    influencerApi.getPost.mockResolvedValue(ok({ post: POST({ state: 'sent_back', status: 'rejected', title: 'Festive picks',
      sent_back: { reason: 'The video on slide 2 has copyrighted music. Replace it with original audio or no music.', count: 1 }, can: { fix: true, delete: true } }) }));
    influencerApi.createPost.mockResolvedValue(ok({ post: POST({ id: 'p7' }) }));
    const n = nav();
    const { getByText, getByTestId } = render(<PostStatus navigation={n} route={{ params: { postId: 'p1' } }} />);
    await waitFor(() => getByTestId('post-status-sent_back'));
    getByText('“The video on slide 2 has copyrighted music. Replace it with original audio or no music.”');
    getByText('Photos and videos, caption, products, theme tags. Not the brand, collaboration, post type or offer. For those, start a new post.');
    getByText("Your posting date hasn't moved");
    fireEvent.press(getByTestId('fix'));
    expect(n.navigate).toHaveBeenCalledWith('PostReview', { postId: 'p1', fix: true });
    fireEvent.press(getByTestId('start-over'));
    await waitFor(() => expect(n.navigate).toHaveBeenCalledWith('PostType', { postId: 'p7' }));
    expect(influencerApi.createPost).toHaveBeenCalledWith('ci1');
  });

  it('removed: why it left the shop and what it earned', async () => {
    influencerApi.getPost.mockResolvedValue(ok({ post: POST({ state: 'removed', status: 'removed', title: 'T-shirt stack',
      removed: { reason: 'offer_ended', at: `${yr}-10-15T00:10:00Z`, why: 'The offer "Buy 2 T-shirts → 30%" ended. Your post promised it, so it can\'t stay up at full price.' },
      sales: { orders: 7, commission: 610 } }) }));
    const { getByText, getByTestId } = render(<PostStatus navigation={nav()} route={{ params: { postId: 'p1' } }} />);
    await waitFor(() => getByTestId('post-status-removed'));
    getByText('Removed from the shop on 15 Oct');
    getByText('The offer "Buy 2 T-shirts → 30%" ended. Your post promised it, so it can\'t stay up at full price.');
    getByText('7'); getByText('₹610');
    getByText('Commission on its sales still follows the usual return window before you can withdraw it.');
  });

  it('approved: no edits, and she can take it down', async () => {
    influencerApi.getPost.mockResolvedValue(ok({ post: POST({ state: 'approved', status: 'approved', can: { take_down: true } }) }));
    const { getByText, getByTestId } = render(<PostStatus navigation={nav()} route={{ params: { postId: 'p1' } }} />);
    await waitFor(() => getByTestId('post-status-approved'));
    getByText('Approved by INFLX. It goes live on 10 Oct, when its offer starts.');   // only an offer post waiting for its offer is still "approved"
    getByText("An approved post can't be changed. You can take it down: it leaves the shop and keeps its earnings history.");
    getByTestId('take-down');
  });
});

describe('P14 — her posts', () => {
  it('Live · In review · Sent back · Removed · Drafts; a draft carries on where she stopped', async () => {
    influencerApi.myShoppablePosts.mockResolvedValue(ok({
      counts: { live: 1, approved: 0, in_review: 1, sent_back: 0, removed: 1, draft: 1 },
      posts: [
        POST({ id: 'a', state: 'live', status: 'approved', title: 'Weekend denim', sales_words: '12 sales · ₹3,420 to you' }),
        POST({ id: 'c', state: 'removed', status: 'removed', title: 'T-shirt stack', removed: { reason: 'offer_ended', offer_ended_on: `${yr}-10-15` }, sales_words: '7 sales · ₹610 to you' }),
        POST({ id: 'd', state: 'draft', status: 'draft', title: 'Kurtis for work', draft_step: 6, updated_at: `${yr}-10-14T10:00:00Z` }),
      ],
    }));
    const n = nav();
    const { getByText, getByTestId } = render(<MyPosts navigation={n} />);
    await waitFor(() => getByTestId('my-posts'));
    getByText(/Live 1/); getByText(/In review 1/); getByText(/Removed 1/); getByText(/Drafts 1/);
    getByText('Weekend denim');
    fireEvent.press(getByTestId('tab-removed'));
    getByText('Offer ended 15 Oct · 7 sales · ₹610 to you');
    fireEvent.press(getByTestId('tab-draft'));
    getByText('Saved at step 6 · 14 Oct');
    fireEvent.press(getByTestId('post-d'));
    expect(n.navigate).toHaveBeenCalledWith('PostTheme', { postId: 'd' });
  });

  it('where a post opens, and where her post notices go', () => {
    expect(routeFor(POST({ draft_step: 3, kind: null }))).toEqual({ name: 'PostType', params: { postId: 'p1' } });
    expect(routeFor(POST({ draft_step: 5, kind: 'price' }))).toEqual({ name: 'PostPrice', params: { postId: 'p1' } });
    expect(routeFor(POST({ draft_step: 8 }))).toEqual({ name: 'PostReview', params: { postId: 'p1' } });
    expect(routeFor(POST({ state: 'live' }))).toEqual({ name: 'PostStatus', params: { postId: 'p1' } });
    // ASSERTION DRIFT — ui-walk-fixes D3 (drift/S0b.md): the jump now asks for the Create page to
    // sit under the post (`initial: false`), so the post has no bottom tabs and Back reaches it.
    expect(targetOf({ data_json: { screen: 'post', post_id: 'p1' } })).toEqual({ name: 'CreateTab', params: { screen: 'PostStatus', params: { postId: 'p1' }, initial: false } });
  });
});

describe('P17 · P18 · P19 · P20 — collections', () => {
  it('her collections, with what is hidden from shoppers', async () => {
    influencerApi.myCollections.mockResolvedValue(ok({ collections: [
      { id: 'c1', name: 'Goa trip edit', kind: 'posts', line: '4 posts · Urban Threads, Kaya Studio', hidden: false, hidden_line: null, sales_words: '6 sales · ₹1,240 to you' },
      { id: 'c3', name: 'Summer whites', kind: 'posts', line: '3 posts · Kaya Studio', hidden: true, hidden_line: '0 of 3 posts still in the shop', sales_words: 'No sales yet' },
    ] }));
    const { getByText, getByTestId } = render(<Collections navigation={nav()} />);
    await waitFor(() => getByTestId('collections'));
    getByText('Shoppers see these in your store.');
    getByText('4 posts · Urban Threads, Kaya Studio'); getByText('6 sales · ₹1,240 to you');
    getByText('0 of 3 posts still in the shop'); getByText('Hidden from shoppers');
    getByText('A collection is hidden when nothing in it is still in the shop. Add something new and it shows again.');
  });

  it('a new collection of products, grouped by collaboration, each product with its collaboration', async () => {
    influencerApi.collectionOptions.mockImplementation((kind) => Promise.resolve(ok(kind === 'posts'
      ? { kind, posts: [] }
      : { kind, groups: [{ campaign_influencer_id: 'ci1', brand_name: 'Urban Threads', campaign_name: 'Diwali Denim', set_name: 'Set A',
        products: [{ id: 'f1', name: 'Linen shirt · Sage', line: '₹849 · normal price' }, { id: 'j1', name: "Levi's 511 Slim", line: '₹1,899 with 20% off' }] }] })));
    influencerApi.createCollection.mockResolvedValue(ok({ collection: { id: 'c9' } }));
    const n = nav();
    const { getByText, getByTestId } = render(<NewCollection navigation={n} route={{ params: {} }} />);
    await waitFor(() => getByText('Only your live posts. Posts that leave the shop drop out of the collection by themselves.'));
    getByText('No live posts yet. Posts join once INFLX approves them.');
    fireEvent.changeText(getByTestId('collection-name'), 'Under ₹1,000 office');
    fireEvent.press(getByTestId('kind-products'));
    await waitFor(() => getByText('Urban Threads · Diwali Denim · Set A'));
    getByText("Levi's 511 Slim · ₹1,899 with 20% off");
    fireEvent.press(getByTestId('pick-product-f1'));
    getByText('Create collection · 1 product');
    fireEvent.press(getByTestId('create'));
    await waitFor(() => expect(influencerApi.createCollection).toHaveBeenCalledWith({ name: 'Under ₹1,000 office', kind: 'products', items: [{ product_id: 'f1', campaign_influencer_id: 'ci1' }] }));
    expect(n.replace).toHaveBeenCalledWith('Collection', { collectionId: 'c9' });
  });

  it('one collection: a post that left the shop stays greyed; remove an item; add; rename', async () => {
    influencerApi.getCollection.mockResolvedValue(ok({ collection: { id: 'c1', name: 'Goa trip edit', kind: 'posts', hidden: false, line: '2 posts · Urban Threads, Kaya Studio', hidden_line: null,
      items: [
        { id: 'i1', kind: 'post', title: 'Weekend denim', brand_name: 'Urban Threads', line: 'Bundle', in_shop: true },
        { id: 'i2', kind: 'post', title: 'T-shirt stack', brand_name: 'Kaya Studio', line: 'Left the shop 15 Oct', in_shop: false },
      ] } }));
    influencerApi.updateCollection.mockImplementation((id, body) => Promise.resolve(ok({ collection: { id, name: body.name || 'Goa trip edit', kind: 'posts', hidden: false, line: '1 post', items: [] } })));
    const n = nav();
    const { getByText, getByTestId } = render(<Collection navigation={n} route={{ params: { collectionId: 'c1' } }} />);
    await waitFor(() => getByTestId('collection'));
    getByText('Kaya Studio · Left the shop 15 Oct');
    getByText('A post that leaves the shop drops out for shoppers but stays greyed here, so you can see what happened. Deleting a collection never touches the posts in it.');
    fireEvent.press(getByTestId('add-items'));
    expect(n.navigate).toHaveBeenCalledWith('NewCollection', { collectionId: 'c1', kind: 'posts' });
    fireEvent.press(getByTestId('remove-i2'));
    await waitFor(() => expect(influencerApi.updateCollection).toHaveBeenCalledWith('c1', { remove: ['i2'] }));
    fireEvent.press(getByTestId('rename'));
    fireEvent.changeText(getByTestId('rename-input'), 'Goa edit');
    fireEvent.press(getByTestId('rename-save'));
    await waitFor(() => expect(influencerApi.updateCollection).toHaveBeenCalledWith('c1', { name: 'Goa edit' }));
  });
});
