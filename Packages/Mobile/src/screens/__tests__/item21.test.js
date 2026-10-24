/**
 * Item 21 — Pay for Content with shoppable posts, and the Entire store: the brand's terms (T1–T4),
 * both content screens with Path 1, the lock on Path 2 and the final payment that waits (G1–G7).
 * Contract: features/item21-content-posts · master rules v1.34 §7A, §12.2
 *
 * React Native has no compile step: a bad import or a typo fails on the DEVICE. Every screen is
 * mounted here with the server's real read shape (contentFlow.shape with item 21's fields).
 */
import React from 'react';
import { render, fireEvent, waitFor, within } from '@testing-library/react-native';

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (cb) => { const R = require('react'); R.useEffect(() => { const c = cb(); return typeof c === 'function' ? c : undefined; }, [cb]); },
}));
jest.mock('react-native-image-picker', () => ({ launchImageLibrary: jest.fn() }));
jest.mock('../../../App', () => ({ AuthContext: require('react').createContext({ setRole: () => {} }) }));
jest.mock('../../services/api', () => ({
  influencerApi: {
    myContent: jest.fn(), contentCaption: jest.fn(), contentSubmit: jest.fn(), contentSetProof: jest.fn(),
    contentClearProof: jest.fn(), contentPosted: jest.fn(), contentReport: jest.fn(), contentUploadUrl: jest.fn(),
    contentConfirmFile: jest.fn(), contentRemoveFile: jest.fn(), createPost: jest.fn(),
    contentFileUrl: jest.fn(() => Promise.resolve({ success: true, data: { view: { url: 'https://x/y' } } })),
  },
  brandApi: {
    content: jest.fn(), contentApprove: jest.fn(), contentChanges: jest.fn(), contentConfirmLive: jest.fn(),
    contentReport: jest.fn(), checkEligibility: jest.fn(() => Promise.resolve({ success: true, data: { results: [] } })),
    offerChoices: jest.fn(), productsWithoutOffersForSet: jest.fn(),
    contentFileUrl: jest.fn(() => Promise.resolve({ success: true, data: { view: { url: 'https://x/y' } } })),
  },
  referenceApi: {}, uploadContentFile: jest.fn(), clearSession: jest.fn(), uploadFile: jest.fn(),
}));
const api = require('../../services/api');
const ContentScreen = require('../influencer/ContentScreen').default;
const BrandContentScreen = require('../brand/BrandContentScreen').default;
const BrandCreatorTermsScreen = require('../brand/BrandCreatorTermsScreen').default;
const draft = require('../../components/invitations/draft5');
const { MSG5, C5 } = require('../../components/invitations/copy5');
const { C12 } = require('../../components/content/copy12');

const nav = () => ({ navigate: jest.fn(), goBack: jest.fn(), push: jest.fn(), addListener: jest.fn(() => () => {}), setParams: jest.fn() });
const HER = { params: { ciId: 'ci1' } };
const BRAND = { params: { campaignId: 'c1', setId: 's1', ciId: 'ci1' } };
const D = (d) => `2026-10-${String(d).padStart(2, '0')}T06:00:00.000Z`;
const yr = new Date().getFullYear();
const SET = { id: 'sA', campaignId: 'c1', name: 'Autumn set', state: 'live', datePassed: false, locked: true, lockedFields: ['goal'], goal: 'engagement', shootMode: 'shipment',
  branch: null, postingDate: `${yr}-10-30`, cutoff: `${yr}-10-27`, daysToCutoff: 4, cutoffPassed: false, expiredAt: null,
  counts: { invited: 0, signed: 0, waiting: 0, declined: 0 }, canInvite: { ok: true }, isPast: false };

const reel = () => ({ key: 'reel', type: 'reel', count: 2, label: 'Instagram reel', platform: 'instagram', isStory: false, caption: '', files: [], have: 0, proofs: [] });
const story = () => ({ key: 'story', type: 'story', count: 1, label: 'Instagram story', platform: 'instagram', isStory: true, caption: '', files: [], have: 0, proofs: [] });
const post = (id, state, over = {}) => ({ id, title: `Post ${id}`, code: state === 'live' ? `BQ7K2${id}` : null, kind: 'price', offerName: null, state, goesLiveOn: null,
  counts: state === 'live', approvedAt: state === 'live' ? D(23) : null, late: false, sharable: state === 'live', cover: null, ...over });
const path1 = (approved, posts = []) => ({ min: 3, approved, short: 3 - approved, met: approved >= 3, late: 0, inReview: posts.filter((p) => p.state === 'in_review').length, sentBack: 0, open: approved >= 1, posts });

/** The server's G1 shape (contentFlow.shape), with item 21's fields. */
function content(over = {}) {
  return {
    invitationId: 'ci1', contentId: 'cc1', campaignName: 'Autumn 2026', setName: 'Autumn set', mode: 'shipment',
    brand: { name: 'Zara India' }, creator: { name: 'Asha Menon' },
    stage: 'posts', frozen: false, shootDoneAt: D(20), postingDate: '2026-10-30', daysToPosting: 6,
    rows: [reel(), story()], missing: [], proofsLeft: [], round: { current: 1, allowed: 2, isLast: false, used: false, stamped: false }, rounds: [], changesAsked: 0,
    approvedAt: null, postedAt: null, reportFrom: null, liveConfirmedAt: null, finalDueAt: null, completedAt: null, proofCount: 0,
    money: { fee: 8000, waitDays: 7, stillLocked: 6000, campaignFee: 640, t1: { amount: 2000, paidAt: D(10), status: 'released' }, t2: { amount: 2000, paidAt: null, status: 'locked' }, t3: { amount: 4000, paidAt: null, status: 'locked', dueAt: null } },
    usageRights: null, reported: { brand: null, creator: null }, delayed: null, yourMove: true, move: { key: 'make_posts', side: 'creator' },
    can: {},
    path1: path1(0), path2Locked: true, finalHeldForPosts: false, postsShort: 3,
    steps: [
      { key: 'signed', label: 'Agreement signed', state: 'done', at: D(10) },
      { key: 'shoot', label: 'Shoot', state: 'done', at: D(20) },
      { key: 'posts', label: 'Shoppable posts', state: 'now', detail: '0 of 3' },
      { key: 'content', label: 'Content', state: 'later', at: null },
      { key: 'live', label: 'Live and paid', state: 'later', at: null, postingDate: '2026-10-30' },
    ],
    ...over,
  };
}
const ok = (c) => Promise.resolve({ success: true, data: { content: c } });
const her = (c, n = nav()) => { api.influencerApi.myContent.mockReturnValue(ok(c)); return { r: render(<ContentScreen navigation={n} route={HER} />), n }; };
const brand = (c, n = nav()) => { api.brandApi.content.mockReturnValue(ok(c)); return { r: render(<BrandContentScreen navigation={n} route={BRAND} />), n }; };
beforeEach(() => jest.clearAllMocks());

/* ───────────────────────────── T1–T4 · the brand's terms */

describe('the brand\'s terms for a Pay for Content creator (T1, T2, T4)', () => {
  const start = () => { draft.clearDraft('sA'); return draft.startDraft('sA', { set: SET, campaignName: 'Autumn 2026', creators: [{ id: 'p', name: 'Asha Menon' }, { id: 's', name: 'Rhea Nair' }], sourceGroupId: null }); };

  it('T1/T4 · the posts number and what she posts about are required; 12 is refused; Entire store satisfies it in one tap, and the summary says no commission', async () => {
    start();
    const n = nav();
    const r = render(<BrandCreatorTermsScreen navigation={n} route={{ params: { campaignId: 'c1', setId: 'sA', index: 0 } }} />);
    within(r.getByTestId('posts-field')).getAllByText(C5.terms.postsN, { exact: false }); within(r.getByTestId('sell-field')).getAllByText(C5.terms.postsAbout, { exact: false });
    r.getByText(C5.sell.store); r.getByText(C5.sell.storeSub);
    fireEvent.changeText(r.getByTestId('fee'), '8000');
    fireEvent.changeText(r.getByTestId('posts'), '12');
    fireEvent.press(r.getByTestId('terms-next'));
    r.getByText(MSG5.POSTS_N);
    r.getByText(`⚠ ${MSG5.POST_ABOUT_NOTHING('Asha')}`);
    expect(n.push).not.toHaveBeenCalled();
    fireEvent.changeText(r.getByTestId('posts'), '3');
    fireEvent.press(r.getByTestId('sell-store'));
    r.getByText(C5.sell.storeSet);
    expect(within(r.getByTestId('sell-offers')).getByText(C5.sell.storeCovers)).toBeTruthy();   // the two rows are covered by it
    r.getByText('She posts about: your entire store · 3 shoppable posts');
    r.getByText(C5.sell.noCommission);
    fireEvent.press(r.getByTestId('terms-next'));
    expect(n.push).toHaveBeenCalledWith('BrandCreatorTerms', { campaignId: 'c1', setId: 'sA', index: 1 });
    const t = draft.getDraft('sA').terms.p;
    expect(draft.toServer('engagement', t)).toMatchObject({ fee: 8000, shoppablePosts: 3, offers: [], productsWithoutOffers: { mode: 'store' } });
  });

  it('T2 · tapping Entire store again lets it go; opening a row leaves it as well', async () => {
    start();
    const r = render(<BrandCreatorTermsScreen navigation={nav()} route={{ params: { campaignId: 'c1', setId: 'sA', index: 0 } }} />);
    fireEvent.press(r.getByTestId('sell-store'));
    r.getByText(C5.sell.storeSet);
    fireEvent.press(r.getByTestId('sell-store'));
    r.getByText(C5.sell.storeSub);
    expect(r.queryByText(C5.sell.storeCovers)).toBeNull();
    fireEvent.press(r.getByTestId('sell-store'));
    api.brandApi.offerChoices.mockReturnValue(Promise.resolve({ success: true, data: { posting_date: `${yr}-10-30`, offers: [], hidden: [] } }));
    fireEvent.press(r.getByTestId('sell-offers'));                                   // opens the offers sheet, and the store lets go
    await waitFor(() => r.getByTestId('offers-sheet'));
    expect(r.queryByText(C5.sell.storeCovers)).toBeNull();
  });
});

/* ───────────────────────────── G1–G7 · her screen */

describe('ContentScreen (her) — two paths', () => {
  it('G1 · shoot done, nothing approved: Path 1 with its count and the button, Path 2 locked with the reason, the steps', async () => {
    const { r, n } = her(content());
    await waitFor(() => r.getByTestId('path1'));
    r.getByText(C12.path1WhoHers);
    r.getByText('0 of 3 approved');
    r.getByTestId('path2-locked');
    r.getByText(C12.path2Locked('Zara India'));
    r.getByTestId('what-you-agreed');
    expect(r.queryByTestId('start-uploading')).toBeNull();                          // nothing to upload yet
    api.influencerApi.createPost.mockReturnValue(Promise.resolve({ success: true, data: { post: { id: 'p9' } } }));
    fireEvent.press(r.getByTestId('create-post'));
    await waitFor(() => expect(n.navigate).toHaveBeenCalledWith('CreateTab', { screen: 'PostType', params: { postId: 'p9' }, initial: false }));
  });

  it('G2 · first post approved: Path 2 opens as item 12\'s intro, Path 1 keeps counting', async () => {
    const { r } = her(content({ stage: 'draft', path2Locked: false, path1: path1(1, [post('a', 'live'), post('b', 'in_review')]), postsShort: 2, move: { key: 'send_content', side: 'creator' },
      missing: [{ key: 'reel', label: 'Instagram reel', need: 2, have: 0, short: 2 }, { key: 'story', label: 'Instagram story', need: 1, have: 0, short: 1 }] }));
    await waitFor(() => r.getByTestId('start-uploading'));
    r.getByText('1 of 3 approved');
    r.getByText('Post a'); r.getByText('Post b');
    expect(r.queryByTestId('path2-locked')).toBeNull();
    r.getByTestId('create-post');
  });

  it('G5 · live, the final payment waits on her posts: the amber line names the amount and the posts', async () => {
    const { r } = her(content({ stage: 'live', path2Locked: false, liveConfirmedAt: D(24), finalDueAt: D(31), finalHeldForPosts: true, postsShort: 2,
      path1: path1(1, [post('a', 'live')]), move: { key: 'make_posts', side: 'creator' },
      money: { fee: 8000, waitDays: 7, stillLocked: 4000, t1: { amount: 2000, paidAt: D(10), status: 'released' }, t2: { amount: 2000, paidAt: D(24), status: 'released' }, t3: { amount: 4000, paidAt: null, status: 'queued', dueAt: D(31) } } }));
    await waitFor(() => r.getByTestId('final-held'));
    r.getByText(C12.finalHeldHers(2, 4000));
    expect(r.queryByTestId('in-wallet')).toBeNull();
    within(r.getByTestId('path1-progress')).getByText(C12.finalWaitsPosts(2, 4000));
  });

  it('G8 · old terms: no Path 1, no lock — item 12 exactly as it was', async () => {
    const { r } = her(content({ stage: 'draft', path1: null, path2Locked: false, postsShort: 0, move: { key: 'send_content', side: 'creator' },
      steps: [{ key: 'signed', label: 'Agreement signed', state: 'done', at: D(10) }, { key: 'shoot', label: 'Shoot', state: 'done', at: D(20) }, { key: 'content', label: 'Content', state: 'now', at: null }, { key: 'live', label: 'Live and paid', state: 'later', at: null }] }));
    await waitFor(() => r.getByTestId('start-uploading'));
    expect(r.queryByTestId('path1')).toBeNull();
    expect(r.queryByTestId('path2-locked')).toBeNull();
  });
});

/* ───────────────────────────── G3, G4, G7 · the brand's screen */

describe('BrandContentScreen — two paths', () => {
  it('G3 · the brand watches Path 1 and reads the lock; it cannot approve shop posts', async () => {
    const { r } = brand(content({ yourMove: false, can: { approve: false, askChanges: false, confirmLive: false, reportRoundsUsed: false, reportPostedWrong: false, reportPostsNotMade: false } }));
    await waitFor(() => r.getByTestId('path1'));
    r.getByText(C12.path1WhoBrand);
    r.getByText(C12.path2LockedBrand('Asha Menon'));
    expect(r.queryByTestId('approve')).toBeNull();
    expect(r.queryByTestId('report-posts')).toBeNull();
  });

  it('G4 · confirming names what still waits for the posts', async () => {
    const { r } = brand(content({ stage: 'posted', path2Locked: false, postedAt: D(24), postsShort: 2, path1: path1(1, [post('a', 'live')]),
      rows: [{ ...reel(), proofs: [{ slot: 1, url: 'https://www.instagram.com/reel/x/', filled: true }, { slot: 2, url: 'https://www.instagram.com/reel/y/', filled: true }] }, { ...story(), proofs: [{ slot: 1, url: null, screenshotFileId: 'f1', filled: true }] }],
      can: { confirmLive: true, reportPostedWrong: true, reportPostsNotMade: false }, yourMove: true, move: { key: 'confirm_live', side: 'brand' } }));
    await waitFor(() => r.getByTestId('confirm-preview'));
    expect(r.getByTestId('confirm-preview').props.children[1].props.children.join('')).toContain(C12.confirmWaitsPosts(2));
    r.getByTestId('confirm-live');
  });

  it('G7 · past the posting date and short: "she hasn\'t made her posts" is offered and sends the right reason; live waits on the posts', async () => {
    api.brandApi.contentReport.mockReturnValue(ok(content({ stage: 'live', frozen: true })));
    const { r } = brand(content({ stage: 'live', path2Locked: false, liveConfirmedAt: D(24), finalDueAt: D(31), finalHeldForPosts: true, postsShort: 2, postingDate: '2026-10-20', daysToPosting: -4,
      path1: path1(1, [post('a', 'live')]), delayed: { at: D(21), stage: 'posts_not_approved', label: 'Shoppable posts not approved' },
      can: { reportPostsNotMade: true }, yourMove: false,
      money: { fee: 8000, waitDays: 7, stillLocked: 4000, t1: { amount: 2000, paidAt: D(10), status: 'released' }, t2: { amount: 2000, paidAt: D(24), status: 'released' }, t3: { amount: 4000, paidAt: null, status: 'queued', dueAt: D(31) } } }));
    await waitFor(() => r.getByTestId('last-waits-posts'));
    r.getByText(C12.lastWaitsPosts(4000, 2));
    fireEvent.press(r.getByTestId('report-posts'));
    await waitFor(() => r.getByTestId('report-sheet'));
    r.getByText(C12.reportPostsBody);
    fireEvent.press(r.getByTestId('report-confirm'));
    await waitFor(() => expect(api.brandApi.contentReport).toHaveBeenCalledWith('c1', 's1', 'ci1', { kind: 'posts_not_made', note: null }));
  });
});
