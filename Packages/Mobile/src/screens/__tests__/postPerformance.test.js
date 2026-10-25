/**
 * post-performance-v2 — the one line under every link, on both sides of a collaboration, on the
 * post screens and on the brand's set posts, in the board's words (S1, B1–B4, C1–C4); numbers in
 * full with Indian grouping (M1); Update now where the board puts it (M2); "Social links not added
 * yet" from the posting date (M3).
 * Contract: features/post-performance-v2 · master rules v1.35 §13A
 *
 * React Native has no compile step: a bad import or a typo fails on the DEVICE. Every screen is
 * mounted here with the server's real read shape (contentFlow.read with `stats` on every proof,
 * postLinks with `social`, shoppablePosts.getPost with `social`).
 */
import React from 'react';
import { StyleSheet } from 'react-native';
import { render, fireEvent, waitFor } from '@testing-library/react-native';

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (cb) => { const R = require('react'); R.useEffect(() => { const c = cb(); return typeof c === 'function' ? c : undefined; }, [cb]); },
}));
jest.mock('react-native-image-picker', () => ({ launchImageLibrary: jest.fn() }));
jest.mock('@react-native-clipboard/clipboard', () => ({ setString: jest.fn() }));
jest.mock('../../../App', () => ({ AuthContext: require('react').createContext({ setRole: () => {} }) }));
jest.mock('../../services/api', () => {
  const f = () => jest.fn();
  return {
    influencerApi: {
      myContent: f(), contentCaption: f(), contentSubmit: f(), contentSetProof: f(), contentClearProof: f(), contentPosted: f(), contentReport: f(),
      contentUploadUrl: f(), contentConfirmFile: f(), contentRemoveFile: f(), createPost: f(), saleAddRows: f(), saleRemoveRow: f(), saleAddOutside: f(),
      contentRefreshStats: f(), getPost: f(), postOptions: f(), postStats: f(), takeDownPost: f(), deletePost: f(), createOwnPost: f(),
      contentFileUrl: jest.fn(() => Promise.resolve({ success: true, data: { view: { url: 'https://x/y' } } })),
    },
    brandApi: {
      content: f(), contentApprove: f(), contentChanges: f(), contentConfirmLive: f(), contentReport: f(), contentRefreshStats: f(),
      setPosts: f(), setPostStats: f(),
      contentFileUrl: jest.fn(() => Promise.resolve({ success: true, data: { view: { url: 'https://x/y' } } })),
    },
    uploadContentFile: f(), clearSession: f(), uploadFile: f(),
  };
});
const api = require('../../services/api');
const ContentScreen = require('../influencer/ContentScreen').default;
const BrandContentScreen = require('../brand/BrandContentScreen').default;
const SaleLiveScreen = require('../influencer/SaleLiveScreen').default;
const BrandSaleLiveScreen = require('../brand/BrandSaleLiveScreen').default;
const PostStatusScreen = require('../create/PostStatusScreen').default;
const PostStatsScreen = require('../create/PostStatsScreen').default;
const BrandSetPostsScreen = require('../brand/BrandSetPostsScreen').default;
const { STATS, indian, whenWords, numbersLine, statLine, socialLine } = require('../../components/content/copyStats');

const nav = () => ({ navigate: jest.fn(), goBack: jest.fn(), replace: jest.fn(), push: jest.fn(), addListener: jest.fn(() => () => {}), setParams: jest.fn(), getParent: jest.fn(), getState: jest.fn() });
const HER = { params: { ciId: 'ci1' } };
const BRAND = { params: { campaignId: 'c1', setId: 's1', ciId: 'ci1' } };
const D = (d) => `2026-10-${String(d).padStart(2, '0')}T06:00:00.000Z`;
const ok = (data) => Promise.resolve({ success: true, data });
const no = (code, message) => Promise.resolve({ success: false, error: { code, message } });
/** Every string in an element's tree, in order (the bold numbers are a nested Text). */
const walk = (n, out) => {
  if (n == null || typeof n === 'boolean') return;
  if (typeof n === 'string' || typeof n === 'number') { out.text += String(n); return; }
  if (Array.isArray(n)) { n.forEach((x) => walk(x, out)); return; }
  if (n.props) { const st = StyleSheet.flatten(n.props.style) || {}; if (st.color) out.colors.push(st.color); walk(n.props.children, out); }
};
const textOf = (el) => { const o = { text: '', colors: [] }; walk(el, o); return o.text; };
/** The text and every colour in the tree, for one regex. */
const flat = (el) => { const o = { text: '', colors: [] }; walk(el, o); return `${o.text} ${o.colors.join(' ')}`; };

/* ── the server's `stats` shapes (postStats.statsFor) ── */
const todayAt = () => { const d = new Date(); d.setHours(6, 10, 0, 0); return d.toISOString(); };
const OK = (over = {}) => ({ state: 'ok', platform: 'instagram', kind: 'reel', url: 'https://www.instagram.com/reel/C9xK2abc/', views: 48200, likes: 3910, comments: 212, likesHidden: false, commentsOff: false,
  updatedAt: todayAt(), source: 'apify', sourceAt: null, ownerState: 'match', ownerHandle: 'priya.style', lastReadAt: todayAt(), stoppedAt: null, stopReason: null, publishedAt: D(10), trackedFrom: D(10), reads: 3, ...over });
const WAIT = { state: 'waiting' };
const LEVEL1 = OK({ views: 31200, likes: 2900, comments: 140, source: 'level1', sourceAt: '2026-10-12T04:00:00.000Z', updatedAt: '2026-10-12T04:00:00.000Z' });

/* ── the content read (Pay for Content) ── */
const reel = (proofs) => ({ key: 'reel', type: 'reel', count: 1, label: 'Instagram reel', platform: 'instagram', isStory: false, caption: '', files: [], have: 0, proofs });
const short = (proofs) => ({ key: 'youtube_short', type: 'youtube_short', count: 1, label: 'YouTube short', platform: 'youtube', isStory: false, caption: '', files: [], have: 0, proofs });
const story = (proofs) => ({ key: 'story', type: 'story', count: 2, label: 'Instagram story', platform: 'instagram', isStory: true, caption: '', files: [], have: 0, proofs });
function content(over = {}) {
  return {
    invitationId: 'ci1', contentId: 'cc1', campaignName: 'Winter Run', setName: 'Set B', mode: 'shipment',
    brand: { name: 'Zara India' }, creator: { name: 'Priya Sharma' },
    stage: 'posted', frozen: false, shootDoneAt: D(8), postingDate: '2026-10-11', daysToPosting: 0,
    rows: [
      reel([{ slot: 1, url: 'https://www.instagram.com/reel/DbnfYVVv8f-/', screenshotFileId: null, filled: true, stats: LEVEL1 }]),
      short([{ slot: 1, url: 'https://youtube.com/shorts/aJsb8a5IGKY', screenshotFileId: null, filled: true, stats: WAIT }]),
      story([{ slot: 1, url: null, screenshotFileId: 'f1', filled: true, stats: { state: 'story' } }, { slot: 2, url: null, screenshotFileId: 'f2', filled: true, stats: { state: 'story' } }]),
    ],
    missing: [], proofsLeft: [], round: { current: 1, allowed: 2, isLast: false, used: false, stamped: true }, rounds: [], changesAsked: 0,
    approvedAt: D(10), postedAt: D(11), reportFrom: D(18), liveConfirmedAt: null, finalDueAt: null, completedAt: null, proofCount: 4,
    money: { fee: 8000, waitDays: 7, stillLocked: 6000, campaignFee: 640, returned: 0, t1: { amount: 2000, paidAt: D(1), status: 'released' }, t2: { amount: 2000, paidAt: null, status: 'locked' }, t3: { amount: 4000, paidAt: null, status: 'locked', dueAt: null } },
    usageRights: null, reported: { brand: null, creator: null }, delayed: null, yourMove: false, move: { key: 'confirm_live', side: 'brand' },
    can: { confirmLive: true, reportPostedWrong: true }, settledByInflx: false, liveConfirmedBy: null,
    path1: null, path2Locked: false, finalHeldForPosts: false, postsShort: 0,
    social: { tracked: 2, canUpdate: true, lastUpdateNowAt: null },
    steps: [
      { key: 'signed', label: 'Agreement signed', state: 'done', at: D(1) },
      { key: 'shoot', label: 'Shoot', state: 'done', at: D(8) },
      { key: 'content', label: 'Content', state: 'now', at: null },
      { key: 'live', label: 'Live and paid', state: 'later', at: null, postingDate: '2026-10-11' },
    ],
    ...over,
  };
}
const withNumbers = (over = {}) => content({
  rows: [
    reel([{ slot: 1, url: 'https://www.instagram.com/reel/DbnfYVVv8f-/', screenshotFileId: null, filled: true, stats: OK({ views: 847937, likes: null, likesHidden: true, comments: 703 }) }]),
    short([{ slot: 1, url: 'https://youtube.com/shorts/aJsb8a5IGKY', screenshotFileId: null, filled: true, stats: OK({ platform: 'youtube', kind: 'short', views: 250137, likes: 7800, comments: 105 }) }]),
    story([{ slot: 1, url: null, screenshotFileId: 'f1', filled: true, stats: { state: 'story' } }, { slot: 2, url: null, screenshotFileId: 'f2', filled: true, stats: { state: 'story' } }]),
  ],
  ...over,
});
const her = (c, n = nav()) => { api.influencerApi.myContent.mockReturnValue(ok({ content: c })); return { r: render(<ContentScreen navigation={n} route={HER} />), n }; };
const brand = (c, n = nav()) => { api.brandApi.content.mockReturnValue(ok({ content: c })); return { r: render(<BrandContentScreen navigation={n} route={BRAND} />), n }; };

/* ── the sale read (Pay for Sale) ── */
const srow = (key, type, label, over = {}) => ({ key, type, label, count: 1, platform: type.startsWith('youtube') ? 'youtube' : type === 'facebook_post' ? 'facebook' : 'instagram', isStory: type === 'story', postId: 'p1', outside: false, caption: '', files: [], have: 0,
  proofs: [{ slot: 1, url: null, screenshotFileId: null, filled: false }], post: { id: 'p1', title: 'Festive Sarees', code: 'K7M2F9' }, ...over });
const destinations = [['reel', 'Instagram reel'], ['post', 'Instagram post'], ['story', 'Instagram story'], ['youtube_video', 'YouTube video'], ['youtube_short', 'YouTube Short'], ['facebook_post', 'Facebook post']].map(([type, label]) => ({ type, label, isStory: type === 'story' }));
const spost = (id, over = {}) => ({ id, title: 'Festive Sarees', code: 'K7M2F9', kind: 'offer', offerName: '20% off', state: 'live', counts: true, approvedAt: D(9), late: false, sharable: true, cover: null, inPackage: true, ...over });
function sale(over = {}) {
  return {
    aim: 'sale', hybrid: false, invitationId: 'ci1', contentId: 'cc1', campaignName: 'Diwali Denim', setName: 'Set A', mode: 'shipment',
    brand: { name: 'Sri Lakshmi Silks' }, creator: { name: 'Priya Sharma' },
    stage: 'live', frozen: false, shootDoneAt: D(8), postingDate: '2026-10-10', daysToPosting: 0,
    rows: [
      srow('s1', 'reel', 'Instagram reel', { proofs: [{ slot: 1, url: 'https://www.instagram.com/reel/C9xK2abc/', screenshotFileId: null, filled: true, stats: OK() }] }),
      srow('s2', 'youtube_video', 'YouTube video', { proofs: [{ slot: 1, url: 'https://youtu.be/Qm8xyz', screenshotFileId: null, filled: true, stats: OK({ platform: 'youtube', kind: 'long', url: 'https://youtu.be/Qm8xyz', views: 12700, likes: 880, comments: 41 }) }] }),
      srow('s3', 'post', 'Instagram post', { postId: 'p2', post: { id: 'p2', title: 'Weekend denim', code: 'T9QW4D' }, proofs: [{ slot: 1, url: 'https://www.instagram.com/p/Dc1GyQhhwFF/', screenshotFileId: null, filled: true, stats: OK({ state: 'other_account', kind: 'post', views: null, likes: 131923, comments: null, commentsOff: true, ownerState: 'other_account', ownerHandle: 'vishnu_singareddy', myHandle: 'priya.style' }) }] }),
      srow('s4', 'facebook_post', 'Facebook post', { postId: 'p2', post: { id: 'p2', title: 'Weekend denim', code: 'T9QW4D' }, proofs: [{ slot: 1, url: 'https://www.facebook.com/priya.style/posts/1', screenshotFileId: null, filled: true, stats: { state: 'facebook' } }] }),
    ],
    missing: [], proofsLeft: [], round: { current: 1, allowed: 2, isLast: false, used: false, stamped: true }, rounds: [],
    approvedAt: D(9), postedAt: D(10), liveConfirmedAt: D(12), completedAt: null, money: null,
    path1: { min: 2, approved: 2, short: 0, met: true, late: 0, inReview: 0, sentBack: 0, open: true, posts: [spost('p1'), spost('p2', { title: 'Weekend denim', code: 'T9QW4D' })] },
    notShared: [], sales: { orders: 37, sales: 41200, commission: 4120, pending: 0, inWallet: 4120, fee: 3296, brandNet: 33784 },
    autoconfirmAt: null, liveConfirmedAuto: false, liveConfirmedBy: 'brand', waitingOnPosts: false, paidInFull: false, settledByInflx: false,
    reported: { brand: null, creator: null }, delayed: null, yourMove: false, move: null,
    can: { addOutside: true }, destinations, outsideOpen: true,
    social: { tracked: 3, canUpdate: true, lastUpdateNowAt: null },
    steps: [
      { key: 'signed', label: 'Agreement signed', state: 'done', at: D(2) },
      { key: 'shoot', label: 'Shoot', state: 'done', at: D(8) },
      { key: 'posts', label: 'Shoppable posts', state: 'done', detail: '2 of 2' },
      { key: 'social', label: 'Social media', state: 'done', at: D(12) },
      { key: 'complete', label: 'Completed', state: 'later', at: null },
    ],
    ...over,
  };
}
const herSale = (c, n = nav()) => { api.influencerApi.myContent.mockReturnValue(ok({ content: c })); return { r: render(<SaleLiveScreen navigation={n} route={HER} />), n }; };
const brandSale = (c, n = nav()) => { api.brandApi.content.mockReturnValue(ok({ content: c })); return { r: render(<BrandSaleLiveScreen navigation={n} route={BRAND} />), n }; };

beforeEach(() => jest.clearAllMocks());

/* ───────────────────────────────────────────── the words and the numbers (S1, M1) */

describe('the words (S1) and the numbers in full with Indian grouping (M1)', () => {
  it('indian grouping: 847937 → 8,47,937; 48200 → 48,200; 703 → 703; null → —', () => {
    expect(indian(847937)).toBe('8,47,937');
    expect(indian(48200)).toBe('48,200');
    expect(indian(250137)).toBe('2,50,137');
    expect(indian(703)).toBe('703');
    expect(indian(1000)).toBe('1,000');
    expect(indian(12345678)).toBe('1,23,45,678');
    expect(indian(null)).toBe('—');
  });

  it('the clock words: today 6:10 am · yesterday · n days ago · a date past a month', () => {
    const now = new Date(2026, 9, 25, 9, 0, 0);
    const at = (y, m, d, h, mi) => new Date(y, m, d, h, mi, 0).toISOString();
    expect(whenWords(at(2026, 9, 25, 6, 10), now)).toBe('today 6:10 am');
    expect(whenWords(at(2026, 9, 24, 18, 5), now)).toBe('yesterday 6:05 pm');
    expect(whenWords(at(2026, 9, 22, 6, 10), now)).toBe('3 days ago');
    expect(whenWords(at(2026, 0, 14, 6, 10), now)).toBe('14 Jan');
  });

  it('every state of S1, brand and creator wording', () => {
    expect(statLine(WAIT, 'creator')).toEqual({ text: 'Numbers come the morning after you mark it posted', tone: 'wait' });
    expect(statLine(WAIT, 'brand')).toEqual({ text: 'Numbers come the morning after she marks it posted', tone: 'wait' });
    expect(statLine(OK(), 'brand')).toMatchObject({ numbers: '48,200 views · 3,910 likes · 212 comments', tone: 'plain' });
    expect(statLine(OK(), 'brand').text).toMatch(/^Updated today \d{1,2}:\d{2} (am|pm)$/);
    expect(numbersLine(OK({ kind: 'post', views: null }))).toBe('3,910 likes · 212 comments');
    expect(numbersLine(OK({ views: 847937, likes: null, likesHidden: true, comments: 703 }))).toBe('8,47,937 views · Likes hidden · 703 comments');
    expect(numbersLine(OK({ comments: null, commentsOff: true }))).toBe('48,200 views · 3,910 likes · Comments off');
    expect(statLine(LEVEL1, 'brand')).toMatchObject({ numbers: '31,200 views · 2,900 likes · 140 comments', text: 'From her channel numbers, 12 Oct' });
    expect(statLine(LEVEL1, 'creator').text).toBe('From your channel numbers, 12 Oct');
    expect(statLine({ state: 'unreadable' }, 'brand')).toEqual({ text: "Couldn't read this link · we'll try again tomorrow", tone: 'warn', numbers: null });
    expect(statLine({ state: 'gone' }, 'brand')).toEqual({ text: 'This post is no longer public', tone: 'gone' });
    expect(statLine(OK({ state: 'other_account', ownerHandle: 'vishnu_singareddy' }), 'brand')).toMatchObject({ text: 'Posted from @vishnu_singareddy, not her account', tone: 'warn' });
    expect(statLine(OK({ state: 'other_account', ownerHandle: 'vishnu_singareddy', myHandle: 'priya.style' }), 'creator').text)
      .toBe("This link isn't on your account @priya.style — it's @vishnu_singareddy's. If you're a co-author we'll see it on the next read; otherwise INFLX will ask.");
    expect(statLine({ state: 'story' }, 'brand')).toEqual({ text: "Screenshot · stories can't be tracked", tone: 'plain' });
    expect(statLine({ state: 'facebook' }, 'creator')).toEqual({ text: 'Facebook numbers come later', tone: 'plain' });
    expect(statLine(OK({ state: 'stopped', views: 52100, likes: 4020, comments: 230, updatedAt: '2026-01-14T00:40:00.000Z', stoppedAt: D(20) }), 'brand'))
      .toMatchObject({ numbers: '52,100 views · 4,020 likes · 230 comments', text: 'Last read 14 Jan' });
  });

  it('the post line (B3, C3): numbers and links, "Social links not added yet" in blue, "Last read" once stopped', () => {
    expect(socialLine({ views: 60900, likes: 4790, comments: 253, links: 2, read: 2, missing: false, stopped: false })).toEqual({ text: 'On social media', tail: '60,900 views · 4,790 likes · 253 comments · 2 links', tone: 'plain' });
    expect(socialLine({ views: 9300, likes: 410, comments: 12, links: 1, read: 1, missing: false, stopped: true, lastReadAt: '2026-01-14T00:40:00.000Z' }).tail).toBe('9,300 views · 410 likes · 12 comments · 1 link · Last read 14 Jan');
    expect(socialLine({ views: 0, likes: 0, comments: 0, links: 0, read: 0, missing: true })).toEqual({ text: 'Social links not added yet', tone: 'wait' });
    expect(socialLine({ views: 0, likes: 0, comments: 0, links: 0, read: 0, missing: false })).toBeNull();
    expect(socialLine({ views: 0, likes: 0, comments: 0, links: 2, read: 0, missing: false }, 'brand')).toEqual({ text: 'On social media', tail: '2 links · Numbers come the morning after she marks it posted', tone: 'wait' });
  });
});

/* ───────────────────────────────────────────── C1 · her content screen */

describe('C1 · her content screen, just after "I\'ve posted everything"', () => {
  it('the reel shows her channel numbers with their date, the Short waits in blue, the stories say screenshots; the note is said once; no Update now (M2)', async () => {
    const { r } = her(content());
    await waitFor(() => r.getByTestId('content-posted'));
    expect(textOf(r.getByTestId('stat-reel-1'))).toBe('31,200 views · 2,900 likes · 140 comments · From your channel numbers, 12 Oct');
    const wait = r.getByTestId('stat-youtube_short-1');
    expect(textOf(wait)).toBe('Numbers come the morning after you mark it posted');
    expect(flat(wait)).toMatch(/#1D5FBF/);
    expect(textOf(r.getByTestId('stat-story'))).toBe("Screenshots · stories can't be tracked");
    expect(r.getByTestId('stats-note').props.children).toBe(STATS.note);
    expect(r.queryByTestId('update-now')).toBeNull();
    expect(r.getByTestId('link-reel-1')).toBeTruthy();
  });

  it('once read: the numbers in full, hidden likes said as such; the links stay on the live and complete screens', async () => {
    let { r } = her(withNumbers({ stage: 'live', liveConfirmedAt: D(12), liveConfirmedBy: 'brand', finalDueAt: D(19) }));
    await waitFor(() => r.getByTestId('content-live'));
    expect(textOf(r.getByTestId('stat-reel-1'))).toMatch(/^8,47,937 views · Likes hidden · 703 comments · Updated today/);
    expect(textOf(r.getByTestId('stat-youtube_short-1'))).toMatch(/^2,50,137 views · 7,800 likes · 105 comments · Updated today/);
    r.unmount();
    ({ r } = her(withNumbers({ stage: 'complete', liveConfirmedAt: D(12), liveConfirmedBy: 'brand', completedAt: D(19) })));
    await waitFor(() => r.getByTestId('content-complete'));
    expect(r.getByTestId('stat-reel-1')).toBeTruthy();
  });

  it('before posting (approved) nothing new is drawn: the link boxes as before, no state line', async () => {
    const { r } = her(content({ stage: 'approved', postedAt: null, can: { markPosted: false }, rows: [reel([{ slot: 1, url: null, screenshotFileId: null, filled: false, stats: null }]), story([{ slot: 1, url: null, screenshotFileId: null, filled: false, stats: null }, { slot: 2, url: null, screenshotFileId: null, filled: false, stats: null }])], proofsLeft: [{ rowKey: 'reel', slot: 1, isStory: false }], social: { tracked: 0, canUpdate: false, lastUpdateNowAt: null } }));
    await waitFor(() => r.getByTestId('content-approved'));
    expect(r.queryByTestId('stat-reel-1')).toBeNull();
    expect(r.queryByTestId('stats-note')).toBeNull();
  });
});

/* ───────────────────────────────────────────── B1 · the brand's content screen */

describe('B1 · the brand\'s content screen', () => {
  it('posted: the three numbers under each link, "Updated today", the stories line; her channel numbers labelled as hers; no Update now before live', async () => {
    const { r } = brand(content());
    await waitFor(() => r.getByTestId('brand-content-posted'));
    expect(flat(r.getByTestId('stat-reel-1'))).toMatch(/31,200/);
    expect(r.getByTestId('stat-reel-1-when').props.children).toBe('From her channel numbers, 12 Oct');
    expect(textOf(r.getByTestId('stat-youtube_short-1'))).toBe('Numbers come the morning after she marks it posted');
    expect(textOf(r.getByTestId('stat-story'))).toBe("Screenshots · stories can't be tracked");
    expect(r.getByTestId('confirm-live')).toBeTruthy();
    expect(r.queryByTestId('update-now')).toBeNull();
  });

  it('live: the links with their numbers (8,47,937 · likes hidden · 703) stay; Update now at the foot with its hint; a second press answers in the server\'s words', async () => {
    const { r } = brand(withNumbers({ stage: 'live', liveConfirmedAt: D(12), liveConfirmedBy: 'brand', finalDueAt: D(19), can: {} }));
    await waitFor(() => r.getByTestId('brand-content-live'));
    const nums = flat(r.getByTestId('stat-reel-1'));
    expect(nums).toMatch(/8,47,937/); expect(nums).toMatch(/likes hidden/); expect(nums).toMatch(/703/);
    expect(r.getByTestId('stat-reel-1-when').props.children).toMatch(/^Updated today/);
    expect(r.getByTestId('update-hint').props.children).toBe('Reads her links once · once a day');
    api.brandApi.contentRefreshStats.mockReturnValueOnce(no('UPDATE_TOO_SOON', 'Numbers were updated 2 hours ago. Once a day.'));
    fireEvent.press(r.getByTestId('update-now'));
    await waitFor(() => expect(api.brandApi.contentRefreshStats).toHaveBeenCalledWith('c1', 's1', 'ci1'));
    await waitFor(() => r.getByText('Numbers were updated 2 hours ago. Once a day.'));
  });

  it('complete: the links stay under the record; Update now still offered while a link is open', async () => {
    const { r } = brand(withNumbers({ stage: 'complete', liveConfirmedAt: D(12), liveConfirmedBy: 'brand', completedAt: D(19), can: {} }));
    await waitFor(() => r.getByTestId('brand-content-complete'));
    expect(r.getByTestId('stat-reel-1')).toBeTruthy();
    expect(r.getByTestId('update-now')).toBeTruthy();
  });

  it('another account: "Posted from @vishnu_singareddy, not her account" under the numbers (brand), in orange', async () => {
    const c = content({ rows: [reel([{ slot: 1, url: 'https://www.instagram.com/p/Dc1GyQhhwFF/', screenshotFileId: null, filled: true, stats: OK({ state: 'other_account', kind: 'post', views: null, likes: 131923, comments: 0, ownerState: 'other_account', ownerHandle: 'vishnu_singareddy' }) }])] });
    const { r } = brand(c);
    await waitFor(() => r.getByTestId('brand-content-posted'));
    expect(r.getByTestId('stat-reel-1-when').props.children).toBe('Posted from @vishnu_singareddy, not her account');
    expect(flat(r.getByTestId('stat-reel-1-when'))).toMatch(/#B04600/);
  });
});

/* ───────────────────────────────────────────── C2 · B2 · Going live */

describe('C2 · her Going live screen, after the brand confirmed', () => {
  it('her links with one line each: numbers, the other-account sentence with her handle, Facebook later; Update now with "Once a day"', async () => {
    const { r } = herSale(sale());
    await waitFor(() => r.getByTestId('path2-live'));
    expect(r.getByTestId('my-links')).toBeTruthy();
    expect(textOf(r.getByTestId('stat-s1'))).toMatch(/^48,200 views · 3,910 likes · 212 comments · Updated today/);
    expect(textOf(r.getByTestId('stat-s2'))).toMatch(/^12,700 views · 880 likes · 41 comments/);
    expect(textOf(r.getByTestId('stat-s3'))).toBe("This link isn't on your account @priya.style — it's @vishnu_singareddy's. If you're a co-author we'll see it on the next read; otherwise INFLX will ask.");
    expect(flat(r.getByTestId('stat-s3'))).toMatch(/#B04600/);
    expect(textOf(r.getByTestId('stat-s4'))).toBe('Facebook numbers come later');
    expect(r.getByTestId('update-hint').props.children).toBe('Once a day');
    api.influencerApi.contentRefreshStats.mockReturnValueOnce(ok({ content: sale() }));
    fireEvent.press(r.getByTestId('update-now'));
    await waitFor(() => expect(api.influencerApi.contentRefreshStats).toHaveBeenCalledWith('ci1'));
  });

  it('posted, not yet confirmed: the links wait in blue; no Update now yet (M2)', async () => {
    const c = sale({ stage: 'posted', liveConfirmedAt: null, autoconfirmAt: D(17), rows: [srow('s1', 'reel', 'Instagram reel', { proofs: [{ slot: 1, url: 'https://www.instagram.com/reel/C9zA1/', screenshotFileId: null, filled: true, stats: WAIT }] })], can: {} });
    const { r } = herSale(c);
    await waitFor(() => r.getByTestId('path2-posted'));
    expect(textOf(r.getByTestId('stat-s1'))).toBe('Numbers come the morning after you mark it posted');
    expect(r.queryByTestId('update-now')).toBeNull();
  });

  it('an outside row\'s link shows its line under the box as soon as it is saved', async () => {
    const c = sale({ rows: [srow('s9', 'reel', 'Instagram reel', { outside: true, postId: 'p2', post: { id: 'p2', title: 'Weekend denim', code: 'T9QW4D' }, proofs: [{ slot: 1, url: 'https://www.instagram.com/reel/LATE1/', screenshotFileId: null, filled: true, stats: WAIT }] })] });
    const { r } = herSale(c);
    await waitFor(() => r.getByTestId('outside'));
    expect(textOf(r.getByTestId('stat-s9'))).toBe('Numbers come the morning after you mark it posted');
  });
});

describe('B2 · the brand\'s Going live screen', () => {
  it('posted: each row\'s link gets its line; the one yellow button is still Confirm; no Update now before confirming', async () => {
    const c = sale({ stage: 'posted', liveConfirmedAt: null, autoconfirmAt: D(17), can: { confirmLive: true, reportPosted: true },
      rows: [srow('s1', 'reel', 'Instagram reel', { proofs: [{ slot: 1, url: 'https://www.instagram.com/reel/C9xK2abc/', screenshotFileId: null, filled: true, stats: OK() }] }),
        srow('s2', 'facebook_post', 'Facebook post', { proofs: [{ slot: 1, url: 'https://www.facebook.com/priya/posts/1', screenshotFileId: null, filled: true, stats: { state: 'facebook' } }] })] });
    const { r } = brandSale(c);
    await waitFor(() => r.getByTestId('brand-sale-posted'));
    expect(textOf(r.getByTestId('stat-s1'))).toMatch(/^48,200 views · 3,910 likes · 212 comments · Updated today/);
    expect(textOf(r.getByTestId('stat-s2'))).toBe('Facebook numbers come later');
    expect(r.getByTestId('confirm-live')).toBeTruthy();
    expect(r.queryByTestId('update-now')).toBeNull();
  });

  it('live: her links kept with their numbers; "Posted from @…, not her account"; Update now appears after confirming', async () => {
    const { r } = brandSale(sale({ can: {} }));
    await waitFor(() => r.getByTestId('brand-sale-live'));
    expect(r.getByTestId('her-links')).toBeTruthy();
    expect(textOf(r.getByTestId('stat-s1'))).toMatch(/^48,200 views/);
    expect(textOf(r.getByTestId('stat-s3'))).toBe('1,31,923 likes · Comments off · Posted from @vishnu_singareddy, not her account');
    expect(r.getByTestId('update-hint').props.children).toBe('Reads her links once · once a day');
    api.brandApi.contentRefreshStats.mockReturnValueOnce(no('BUDGET_USED', "This month's budget for reading social numbers is used up. It comes back on the 1st."));
    fireEvent.press(r.getByTestId('update-now'));
    await waitFor(() => r.getByText("This month's budget for reading social numbers is used up. It comes back on the 1st."));
  });
});

/* ───────────────────────────────────────────── C3 · B3 · B4 · C4 · the post screens */

const POST = (over = {}) => ({
  id: 'p1', title: 'Festive Sarees', code: 'K7M2F9', state: 'live', own_brand: false, not_in_shop: null, sales_words: '37 orders · ₹4,120 to you',
  collaboration: { id: 'ci1', brand_id: 'b1', brand_name: 'Sri Lakshmi Silks', campaign_name: 'Diwali Denim', set_name: 'Set A', posting_date: '2026-10-10' },
  goes_live_on: null, live_since: '2026-10-10', sales: { orders: 37, sales: 41200, commission: 4120 }, for_line: null,
  social: { views: 60900, likes: 4790, comments: 253, links: 2, read: 2, missing: false, stopped: false, updatedAt: todayAt(), lastReadAt: todayAt(),
    items: [{ rowKey: 's1', type: 'reel', label: 'Instagram reel', platform: 'instagram', url: 'https://www.instagram.com/reel/C9xK2abc/', date: D(10), views: 48200, state: 'ok' }, { rowKey: 's2', type: 'youtube_video', label: 'YouTube video', platform: 'youtube', url: 'https://youtu.be/Qm8xyz', date: D(11), views: 12700, state: 'ok' }] },
  ...over,
});
const STATS_READ = (over = {}) => ({
  post_id: 'p1', title: 'Festive Sarees', code: 'K7M2F9', brand_name: 'Sri Lakshmi Silks', own_brand: false, live_since: '2026-10-10', state: 'live', collaboration_id: 'ci1',
  totals: { visits: 1284, orders: 37, sales: 41200, commission: 4120 },
  visits: [{ channel: 'ig', label: 'Instagram', visits: 812 }, { channel: 'yt', label: 'YouTube', visits: 301 }, { channel: 'code', label: 'Post code', visits: 171 }],
  orders: [{ channel: 'ig', label: 'Instagram', orders: 24, sales: 26000, commission: 2600 }],
  social: [
    { rowKey: 's1', type: 'reel', label: 'Instagram reel', platform: 'instagram', url: 'https://www.instagram.com/reel/C9xK2abc/', date: D(10), outside: false, stats: OK() },
    { rowKey: 's2', type: 'youtube_video', label: 'YouTube video', platform: 'youtube', url: 'https://youtu.be/Qm8xyz', date: D(11), outside: false, stats: OK({ platform: 'youtube', kind: 'long', url: 'https://youtu.be/Qm8xyz', views: 12700, likes: 880, comments: 41 }) },
  ],
  social_summary: { views: 60900, likes: 4790, comments: 253, links: 2, read: 2, missing: false, stopped: false },
  ...over,
});

describe('C3 · Post status', () => {
  it('one line under Share and Stats: "On social media · 60,900 views · 4,790 likes · 253 comments · 2 links"; where she shared it with the views', async () => {
    api.influencerApi.getPost.mockReturnValue(ok({ post: POST() }));
    const r = render(<PostStatusScreen navigation={nav()} route={{ params: { postId: 'p1' } }} />);
    await waitFor(() => r.getByTestId('post-status-live'));
    expect(flat(r.getByTestId('social-line'))).toMatch(/On social media/);
    expect(flat(r.getByTestId('social-line'))).toMatch(/60,900 views · 4,790 likes · 253 comments · 2 links/);
    expect(flat(r.getByTestId('shared-s1'))).toMatch(/Instagram reel · 10 Oct/);
    expect(flat(r.getByTestId('shared-s1'))).toMatch(/48,200 views/);
    expect(flat(r.getByTestId('shared-s2'))).toMatch(/YouTube video · 11 Oct/);
    expect(r.getByTestId('stats')).toBeTruthy();
  });

  it('a post whose links are not yet handed in says nothing until the posting date; then "Social links not added yet"', async () => {
    api.influencerApi.getPost.mockReturnValue(ok({ post: POST({ social: { views: 0, likes: 0, comments: 0, links: 0, read: 0, missing: false, items: [] } }) }));
    let r = render(<PostStatusScreen navigation={nav()} route={{ params: { postId: 'p1' } }} />);
    await waitFor(() => r.getByTestId('post-status-live'));
    expect(r.queryByTestId('social-line')).toBeNull();
    expect(r.queryByTestId('where-shared')).toBeNull();
    r.unmount();
    api.influencerApi.getPost.mockReturnValue(ok({ post: POST({ social: { views: 0, likes: 0, comments: 0, links: 0, read: 0, missing: true, items: [] } }) }));
    r = render(<PostStatusScreen navigation={nav()} route={{ params: { postId: 'p1' } }} />);
    await waitFor(() => r.getByTestId('social-line'));
    expect(r.getByTestId('social-line').props.children).toBe('Social links not added yet');
  });
});

describe('B3 · the brand\'s set posts list', () => {
  it('the set\'s views on social media beside orders; one more line per post; "Social links not added yet" in blue; "Last read" for a post that left the shop', async () => {
    api.brandApi.setPosts.mockReturnValue(ok({
      campaign_name: 'Diwali Denim', set_name: 'Set A', creators: 3, live: 2, social: { views: 61800 },
      posts: [
        { id: 'p1', title: 'Festive Sarees', code: 'K7M2F9', state: 'live', creator_name: 'Priya Sharma', goes_live_on: null, totals: { visits: 1284, orders: 37, sales: 41200, commission: 4120 }, social: { views: 60900, likes: 4790, comments: 253, links: 2, read: 2, missing: false, stopped: false } },
        { id: 'p2', title: 'Weekend denim', code: 'T9QW4D', state: 'live', creator_name: 'Sneha Rao', goes_live_on: null, totals: { visits: 400, orders: 12, sales: 18400, commission: 1840 }, social: { views: 0, likes: 0, comments: 0, links: 0, read: 0, missing: true, stopped: false } },
        { id: 'p3', title: 'Kurta edit', code: 'P4RT7Q', state: 'removed', creator_name: 'Arjun Mehta', goes_live_on: null, totals: { visits: 90, orders: 0, sales: 0, commission: 0 }, social: { views: 9300, likes: 410, comments: 12, links: 1, read: 1, missing: false, stopped: true, lastReadAt: '2026-01-14T00:40:00.000Z' } },
      ],
      totals: { orders: 49, sales: 59600, commission: 5960, inflx_fee: 4768, you_receive: 48872 }, copy_text: 'K7M2F9 · Festive Sarees by Priya',
    }));
    const r = render(<BrandSetPostsScreen navigation={nav()} route={{ params: { campaignId: 'c1', setId: 's1', setName: 'Set A' } }} />);
    await waitFor(() => r.getByTestId('set-social'));
    expect(flat(r.getByTestId('set-social'))).toMatch(/61,800/);
    expect(flat(r.getByTestId('set-social'))).toMatch(/views on social media/);
    expect(flat(r.getByTestId('social-p1'))).toMatch(/60,900 views · 4,790 likes · 253 comments · 2 links/);
    expect(r.getByTestId('social-p2').props.children).toBe('Social links not added yet');
    expect(flat(r.getByTestId('social-p2'))).toMatch(/#1D5FBF/);
    expect(flat(r.getByTestId('social-p3'))).toMatch(/9,300 views · 410 likes · 12 comments · 1 link · Last read 14 Jan/);
  });
});

describe('B4 · C4 · a post\'s stats', () => {
  it('hers (C4): "On social media" above the channels, one card per link with the three numbers, Open, and Update now; pressed twice today, the server\'s blue answer', async () => {
    api.influencerApi.postStats.mockReturnValue(ok(STATS_READ()));
    const r = render(<PostStatsScreen navigation={nav()} route={{ params: { postId: 'p1' } }} />);
    await waitFor(() => r.getByTestId('on-social'));
    expect(flat(r.getByTestId('social-s1'))).toMatch(/Instagram reel · 10 Oct/);
    expect(flat(r.getByTestId('social-s1-nums'))).toMatch(/48,200/);
    expect(r.getByTestId('social-s1-nums-when').props.children).toMatch(/^Updated today/);
    expect(flat(r.getByTestId('social-s2'))).toMatch(/YouTube video · 11 Oct/);
    expect(flat(r.getByTestId('social-s2-nums'))).toMatch(/12,700/);
    expect(r.getByTestId('social-s1-open')).toBeTruthy();
    expect(r.getByTestId('visits-ig')).toBeTruthy();                                 // the channel breakdown stays, below
    api.influencerApi.contentRefreshStats.mockReturnValueOnce(no('UPDATE_TOO_SOON', 'Numbers were updated 2 hours ago. Once a day.'));
    fireEvent.press(r.getByTestId('update-now'));
    await waitFor(() => expect(api.influencerApi.contentRefreshStats).toHaveBeenCalledWith('ci1'));
    await waitFor(() => r.getByText('Numbers were updated 2 hours ago. Once a day.'));
  });

  it('the brand\'s (B4): the same block, read-only — no Update now (M2)', async () => {
    api.brandApi.setPostStats.mockReturnValue(ok(STATS_READ()));
    const r = render(<PostStatsScreen navigation={nav()} route={{ params: { postId: 'p1', brand: { campaignId: 'c1', setId: 's1' } } }} />);
    await waitFor(() => r.getByTestId('on-social'));
    expect(flat(r.getByTestId('social-s1-nums'))).toMatch(/48,200/);
    expect(r.queryByTestId('update-now')).toBeNull();
    expect(r.getByTestId('social-s1-open')).toBeTruthy();
  });

  it('a post with no links yet draws no block; an own-brand post never does', async () => {
    api.influencerApi.postStats.mockReturnValue(ok(STATS_READ({ social: [], social_summary: null })));
    const r = render(<PostStatsScreen navigation={nav()} route={{ params: { postId: 'p1' } }} />);
    await waitFor(() => r.getByTestId('visits-ig'));
    expect(r.queryByTestId('on-social')).toBeNull();
  });
});

/* ───────────────────────────────────────────── the api wrappers */

describe('the api: Update now on both bases; the deliverable refresh is gone', () => {
  it('names the routes the server mounts', () => {
    jest.resetModules();
    jest.unmock('../../services/api');
    const src = require('fs').readFileSync(require.resolve('../../services/api.js'), 'utf8');
    expect(src).toMatch(/contentRefreshStats: \(c, s2, ciId\) => api\.post\(`\/campaigns\/\$\{c\}\/sets\/\$\{s2\}\/invitations\/\$\{ciId\}\/content\/stats\/refresh`, \{\}\)/);
    expect(src).toMatch(/contentRefreshStats: \(id\) => api\.post\(`\/influencers\/me\/invitations\/\$\{id\}\/content\/stats\/refresh`, \{\}\)/);
    expect(src).not.toMatch(/refresh-stats/);
  });
});
