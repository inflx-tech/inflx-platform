/**
 * Item 14 — both Going live screens, rendered at every stage they can be in (board v2 S4–S24).
 * Contract: features/item14-sale-going-live
 *
 * React Native has no compile step: a bad import or a typo fails on the DEVICE. Every stage is
 * mounted here with the server's real read shape (contentFlow.shapeSale).
 */
import React from 'react';
import { render, waitFor, fireEvent } from '@testing-library/react-native';

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (cb) => { const R = require('react'); R.useEffect(() => { const c = cb(); return typeof c === 'function' ? c : undefined; }, [cb]); },
}));
jest.mock('react-native-image-picker', () => ({ launchImageLibrary: jest.fn() }));
jest.mock('../../services/api', () => ({
  influencerApi: {
    myContent: jest.fn(), contentCaption: jest.fn(), contentSubmit: jest.fn(), contentSetProof: jest.fn(),
    contentClearProof: jest.fn(), contentPosted: jest.fn(), contentUploadUrl: jest.fn(), contentConfirmFile: jest.fn(),
    contentRemoveFile: jest.fn(), contentFileUrl: jest.fn(() => Promise.resolve({ success: true, data: { view: { url: 'https://x/y' } } })),
    createPost: jest.fn(), saleAddRows: jest.fn(), saleRemoveRow: jest.fn(), saleAddOutside: jest.fn(), contentReport: jest.fn(),
  },
  brandApi: {
    content: jest.fn(), contentApprove: jest.fn(), contentChanges: jest.fn(), contentConfirmLive: jest.fn(),
    contentReport: jest.fn(), contentFileUrl: jest.fn(() => Promise.resolve({ success: true, data: { view: { url: 'https://x/y' } } })),
  },
  uploadContentFile: jest.fn(),
}));
const api = require('../../services/api');
import SaleLiveScreen from '../influencer/SaleLiveScreen';
import BrandSaleLiveScreen from '../brand/BrandSaleLiveScreen';

const nav = { navigate: jest.fn(), goBack: jest.fn(), addListener: jest.fn(() => () => {}), setParams: jest.fn() };
const HER = { params: { ciId: 'ci1' } };
const BRAND = { params: { campaignId: 'c1', setId: 's1', ciId: 'ci1' } };
const D = (d) => `2026-10-${String(d).padStart(2, '0')}T06:00:00.000Z`;

const post = (id, over = {}) => ({ id, title: 'Festive Sarees', code: 'K7M2F9', kind: 'offer', offerName: '20% off', state: 'approved', counts: true, approvedAt: D(19), late: false, sharable: true, cover: null, inPackage: false, ...over });
const row = (key, type, label, over = {}) => ({ key, type, label, count: 1, platform: 'instagram', isStory: type === 'story', postId: 'p1', outside: false, caption: '', files: [], have: 0, proofs: [{ slot: 1, url: null, screenshotFileId: null, filled: false }], post: { id: 'p1', title: 'Festive Sarees', code: 'K7M2F9' }, ...over });
const destinations = [['reel', 'Instagram reel'], ['post', 'Instagram post'], ['story', 'Instagram story'], ['youtube_video', 'YouTube video'], ['youtube_short', 'YouTube Short'], ['facebook_post', 'Facebook post']]
  .map(([type, label]) => ({ type, label, isStory: type === 'story' }));

/** The server's real read (contentFlow.shapeSale), at whatever stage the test needs. */
function sale(over = {}) {
  return {
    aim: 'sale', invitationId: 'ci1', contentId: 'cc1', campaignName: 'Diwali Edit 2026', setName: 'Set B', mode: 'shipment',
    brand: { name: 'Urban Threads' }, creator: { name: 'Tanvi Suresh' },
    stage: 'posts', frozen: false, shootDoneAt: D(16), postingDate: '2026-10-24', daysToPosting: 8,
    rows: [], missing: [], proofsLeft: [], round: { current: 1, allowed: 2, isLast: false, used: false, stamped: false }, rounds: [],
    approvedAt: null, postedAt: null, liveConfirmedAt: null, completedAt: null, money: null,
    path1: { min: 2, approved: 0, short: 2, met: false, late: 0, inReview: 1, sentBack: 0, open: false, posts: [post('p1', { state: 'in_review', counts: false, sharable: false, code: null, approvedAt: null })] },
    notShared: [], sales: { orders: 0, sales: 0, commission: 0, pending: 0, inWallet: 0 },
    autoconfirmAt: null, liveConfirmedAuto: false, waitingOnPosts: false,
    reported: { brand: null, creator: null }, delayed: null, yourMove: true, move: { key: 'make_posts', side: 'creator' },
    can: {}, destinations,
    steps: [
      { key: 'signed', label: 'Agreement signed', state: 'done', at: D(2) },
      { key: 'shoot', label: 'Shoot', state: 'done', at: D(16) },
      { key: 'posts', label: 'Shoppable posts', state: 'now', detail: '0 of 2' },
      { key: 'social', label: 'Social media', state: 'later', at: null },
      { key: 'complete', label: 'Completed', state: 'later', at: null },
    ],
    ...over,
  };
}
const opened = { approved: 1, short: 1, open: true, inReview: 1, posts: [post('p1'), post('p2', { title: 'Weekend denim', state: 'in_review', counts: false, sharable: false, code: null })] };
const ok = (c) => Promise.resolve({ success: true, data: { content: c } });
const her = (c) => { api.influencerApi.myContent.mockReturnValue(ok(c)); return render(<SaleLiveScreen navigation={nav} route={HER} />); };
const brand = (c) => { api.brandApi.content.mockReturnValue(ok(c)); return render(<BrandSaleLiveScreen navigation={nav} route={BRAND} />); };
beforeEach(() => jest.clearAllMocks());

describe('SaleLiveScreen (her)', () => {
  it('loading, then couldn\'t load', async () => {
    let resolve;
    api.influencerApi.myContent.mockReturnValue(new Promise((r) => { resolve = r; }));
    const r = render(<SaleLiveScreen navigation={nav} route={HER} />);
    expect(r.getByTestId('skeleton')).toBeTruthy();
    resolve({ success: false });
    await waitFor(() => r.getByTestId('load-error'));
  });

  it('S4 · Path 1 first; Path 2 shown LOCKED with the reason; create opens item 13 with this collaboration', async () => {
    api.influencerApi.createPost.mockReturnValue(Promise.resolve({ success: true, data: { post: { id: 'new1' } } }));
    const r = her(sale());
    await waitFor(() => r.getByTestId('path1'));
    expect(r.getByText('0 of 2 approved')).toBeTruthy();
    expect(r.getByText('1 post is with INFLX for review.')).toBeTruthy();
    expect(r.getByTestId('path2-locked')).toBeTruthy();
    expect(r.getByText('Opens when INFLX approves your first shoppable post. Urban Threads checks this part.')).toBeTruthy();
    fireEvent.press(r.getByTestId('create-post'));
    // ASSERTION DRIFT — ui-walk-fixes D3 (drift/S0b.md): the jump now asks for the Create page to
    // sit under the post (`initial: false`), so the post has no bottom tabs and Back reaches it.
    await waitFor(() => expect(nav.navigate).toHaveBeenCalledWith('CreateTab', { screen: 'PostType', params: { postId: 'new1' }, initial: false }));
    expect(api.influencerApi.createPost).toHaveBeenCalledWith('ci1');
  });

  it('S5, S7 · the first approval opens Path 2; only approved posts can be picked; the place sheet adds rows', async () => {
    api.influencerApi.saleAddRows.mockReturnValue(ok(sale({ stage: 'draft', path1: { ...sale().path1, ...opened }, rows: [row('s1', 'reel', 'Instagram reel')], can: { addRows: true, removeRow: true, upload: true } })));
    const r = her(sale({ stage: 'draft', path1: { ...sale().path1, ...opened }, can: { addRows: true, removeRow: true, upload: true } }));
    await waitFor(() => r.getByTestId('path2'));
    expect(r.getByText('1 of 2 approved')).toBeTruthy();
    expect(r.getByTestId('sharable-p1')).toBeTruthy();
    expect(r.queryByTestId('sharable-p2')).toBeNull();           // with INFLX — never offered
    fireEvent.press(r.getByTestId('add-place-p1'));
    await waitFor(() => r.getByTestId('destination-sheet'));
    fireEvent.press(r.getByTestId('dest-reel'));
    fireEvent.press(r.getByTestId('dest-add'));
    await waitFor(() => expect(api.influencerApi.saleAddRows).toHaveBeenCalledWith('ci1', 'p1', ['reel']));
    await waitFor(() => r.getByTestId('row-s1'));
    expect(r.getByText('Festive Sarees · Instagram reel')).toBeTruthy();
  });

  it('S9 · sent: locked, with the round', async () => {
    const r = her(sale({ stage: 'in_review', path1: { ...sale().path1, ...opened }, rows: [row('s1', 'reel', 'Instagram reel', { files: [{ id: 'f1', kind: 'video', mime: 'video/mp4' }] })],
      rounds: [{ no: 1, submittedAt: D(20), verdict: null, rows: [], notes: [] }], round: { current: 1, allowed: 2, isLast: false, used: false, stamped: true } }));
    await waitFor(() => r.getByTestId('with-them'));
    expect(r.getByText('With Urban Threads since 20 Oct. You\'ll hear when they reply.')).toBeTruthy();
  });

  it('S14, S15 · approved: a link each, then the date it confirms itself', async () => {
    const r = her(sale({ stage: 'approved', approvedAt: D(22), path1: { ...sale().path1, ...opened }, rows: [row('s1', 'reel', 'Instagram reel'), row('s2', 'story', 'Instagram story')],
      proofsLeft: [{ rowKey: 's1', slot: 1, isStory: false }, { rowKey: 's2', slot: 1, isStory: true }], can: { markPosted: false } }));
    await waitFor(() => r.getByTestId('approved-box'));
    expect(r.getByTestId('link-s1')).toBeTruthy();
    expect(r.getByTestId('add-shot-s2')).toBeTruthy();
    expect(r.getByText('1 link and 1 screenshot to go.')).toBeTruthy();
    const p = her(sale({ stage: 'posted', postedAt: D(23), autoconfirmAt: D(30), path1: { ...sale().path1, ...opened } }));
    await waitFor(() => p.getByTestId('autoconfirm-date'));
    expect(p.getByText('30 Oct')).toBeTruthy();
  });

  it('S20 · completed and selling: the sales stay on the collaboration', async () => {
    const r = her(sale({ stage: 'complete', completedAt: D(25), liveConfirmedAt: D(25), path1: { ...sale().path1, ...opened, approved: 2, short: 0, met: true },
      sales: { orders: 14, sales: 21300, commission: 2130, pending: 1380, inWallet: 750 } }));
    await waitFor(() => r.getByTestId('completed-box'));
    expect(r.getByText('Completed on 25 Oct. Your posts keep selling.')).toBeTruthy();
    expect(r.getByText('₹21,300')).toBeTruthy();
    expect(r.getByText('₹1,380')).toBeTruthy();
  });

  it('S24 · old terms and a brand report', async () => {
    const r = her(sale({ stage: 'old_terms', path1: null, steps: [] }));
    await waitFor(() => r.getByText('Signed under the old terms. Shoppable posts need the new terms — a new collaboration.'));
    const f = her(sale({ stage: 'posted', frozen: true, reported: { brand: { at: D(26), kind: 'missing' }, creator: null }, path1: { ...sale().path1, ...opened } }));
    await waitFor(() => f.getByTestId('told-inflx'));
    expect(f.getByText('INFLX will contact you. Your shop posts keep selling.')).toBeTruthy();
  });
});

describe('BrandSaleLiveScreen', () => {
  it('S6 · her two paths: the brand watches Path 1 and waits on Path 2', async () => {
    const r = brand(sale({ stage: 'draft', move: { key: 'send_social', side: 'creator' }, yourMove: false, path1: { ...sale().path1, ...opened } }));
    await waitFor(() => r.getByTestId('path1'));
    expect(r.getByText('INFLX checks')).toBeTruthy();
    expect(r.getByTestId('her-move')).toBeTruthy();
    expect(r.queryByTestId('approve')).toBeNull();
  });

  it('S10, S13 · reviewing, and the last round warned before deciding', async () => {
    const r = brand(sale({ stage: 'in_review', path1: { ...sale().path1, ...opened }, rows: [row('s1', 'reel', 'Instagram reel', { files: [{ id: 'f1', kind: 'video', mime: 'video/mp4' }] })],
      rounds: [{ no: 1, submittedAt: D(20), verdict: 'changes', verdictAt: D(21), reason: 'x', rows: [], notes: [] }, { no: 2, submittedAt: D(22), verdict: null, rows: [], notes: [] }],
      round: { current: 2, allowed: 2, isLast: true, used: false, stamped: true }, can: { approve: true, askChanges: true } }));
    await waitFor(() => r.getByTestId('review'));
    expect(r.getByTestId('last-round')).toBeTruthy();
    expect(r.getByText('Festive Sarees · K7M2F9 · Instagram reel')).toBeTruthy();
    expect(r.getByText('Ask for changes — last time')).toBeTruthy();
  });

  it('S17 · confirming: what it does is said before the tap; no money; the self-confirmation date', async () => {
    api.brandApi.contentConfirmLive.mockReturnValue(ok(sale({ stage: 'complete', completedAt: D(25), path1: { ...sale().path1, ...opened, approved: 2, short: 0, met: true } })));
    const r = brand(sale({ stage: 'posted', postedAt: D(23), autoconfirmAt: D(30), path1: { ...sale().path1, ...opened, approved: 2, short: 0, met: true },
      rows: [row('s1', 'reel', 'Instagram reel', { proofs: [{ slot: 1, url: 'https://www.instagram.com/reel/C9xK2/', filled: true }] })],
      can: { confirmLive: true, reportPosted: true, reportNotPosted: true } }));
    await waitFor(() => r.getByTestId('confirm-preview'));
    expect(r.getByText('Confirming completes the collaboration')).toBeTruthy();
    expect(r.getByText("No money moves. Her sales and commission keep running. If you don't answer, it confirms itself on 30 Oct.")).toBeTruthy();
    fireEvent.press(r.getByTestId('confirm-live'));
    await waitFor(() => expect(api.brandApi.contentConfirmLive).toHaveBeenCalledWith('c1', 's1', 'ci1', undefined));
    await waitFor(() => r.getByTestId('completed-box'));
  });

  it('S18 · live, waiting on posts', async () => {
    const r = brand(sale({ stage: 'live', liveConfirmedAt: D(25), path1: { ...sale().path1, ...opened } }));
    await waitFor(() => r.getByTestId('waiting-posts'));
    expect(r.getByText('Completes by itself when 1 more post is approved.')).toBeTruthy();
  });

  it('S22 · telling INFLX offers only the reasons the server accepts now', async () => {
    api.brandApi.contentReport.mockReturnValue(ok(sale({ stage: 'posted', frozen: true, reported: { brand: { at: D(26), kind: 'not_posted' }, creator: null }, path1: { ...sale().path1, ...opened } })));
    const r = brand(sale({ stage: 'posted', postedAt: D(23), path1: { ...sale().path1, ...opened }, can: { confirmLive: true, reportPosted: true, reportNotPosted: true } }));
    await waitFor(() => r.getByTestId('something-wrong'));
    fireEvent.press(r.getByTestId('something-wrong'));
    await waitFor(() => r.getByTestId('sale-report-sheet'));
    expect(r.getByTestId('reason-not_posted')).toBeTruthy();
    expect(r.getByTestId('reason-posted_wrong')).toBeTruthy();
    expect(r.getByTestId('reason-missing')).toBeTruthy();
    expect(r.queryByTestId('reason-rounds_used')).toBeNull();
    fireEvent.press(r.getByTestId('sale-report-confirm'));
    await waitFor(() => expect(api.brandApi.contentReport).toHaveBeenCalledWith('c1', 's1', 'ci1', { kind: 'not_posted', note: null }));
    await waitFor(() => r.getByTestId('reported-card'));
  });

  it('S20 · completed: the split as item 16 records it', async () => {
    const r = brand(sale({ stage: 'complete', completedAt: D(25), path1: { ...sale().path1, ...opened, approved: 2, short: 0, met: true },
      sales: { orders: 14, sales: 21300, commission: 2130, fee: 1065, brandNet: 18105 } }));
    await waitFor(() => r.getByTestId('sales'));
    expect(r.getByText('14 · ₹21,300')).toBeTruthy();
    expect(r.getByText('₹18,105')).toBeTruthy();
  });
});

/* ───────────────────────────── item 15 · Hybrid (board S1–S9) */

const money = (over = {}) => ({ fee: 8500, waitDays: 7, stillLocked: 6375, campaignFee: 0,
  t1: { amount: 2125, pct: 25, status: 'released', paidAt: D(2) }, t2: { amount: 2125, pct: 25, status: 'locked', paidAt: null }, t3: { amount: 4250, pct: 50, status: 'locked', paidAt: null, dueAt: null }, ...over });
const hyb = (over = {}) => sale({ hybrid: true, money: money(), path1: { ...sale().path1, ...opened, approved: 1, min: 1, short: 0, met: true }, ...over });

describe('item 15 · Hybrid on both screens', () => {
  it('S1, S5 · her payments card; posted names what confirming pays; she may ask INFLX to look', async () => {
    api.influencerApi.contentReport.mockReturnValue(ok(hyb({ stage: 'posted', postedAt: D(23), reported: { brand: null, creator: { at: D(31) } } })));
    const r = her(hyb({ stage: 'posted', postedAt: D(23), reportFrom: D(30), can: { report: true } }));
    await waitFor(() => r.getByTestId('payments'));
    expect(r.getByText("Urban Threads confirms it's live, and that pays your second ₹2,125.")).toBeTruthy();
    expect(r.getByText('No answer by 30 Oct? You can ask INFLX to look. It never stops them paying you.')).toBeTruthy();
    expect(r.queryByTestId('autoconfirm-date')).toBeNull();
    fireEvent.press(r.getByTestId('ask-inflx'));
    await waitFor(() => r.getByTestId('report-sheet'));
    fireEvent.press(r.getByTestId('report-confirm'));
    await waitFor(() => expect(api.influencerApi.contentReport).toHaveBeenCalledWith('ci1', { kind: 'brand_silent', note: null }));
  });

  it('S6, S7 · second payment in with the date of the last; paid in full while waiting on posts', async () => {
    const r = her(hyb({ stage: 'live', liveConfirmedAt: D(24), finalDueAt: D(31), money: money({ t2: { amount: 2125, status: 'released', paidAt: D(24) } }) }));
    await waitFor(() => r.getByTestId('second-in'));
    expect(r.getByText("Urban Threads confirmed it's live on 24 Oct. ₹2,125 is in your wallet.")).toBeTruthy();
    expect(r.getByText('The last ₹4,250 arrives on 31 Oct.')).toBeTruthy();
    const p = her(hyb({ stage: 'live', paidInFull: true, liveConfirmedAt: D(24), path1: { ...sale().path1, ...opened, approved: 1, min: 2, short: 1, met: false } }));
    await waitFor(() => p.getByTestId('paid-in-full'));
    expect(p.getByText('Completes by itself when 1 more post is approved.')).toBeTruthy();
  });

  it("S3 · the brand's button names the money and sends it with the tap", async () => {
    api.brandApi.contentConfirmLive.mockReturnValue(ok(hyb({ stage: 'live', liveConfirmedAt: D(24) })));
    const r = brand(hyb({ stage: 'posted', postedAt: D(23), rows: [row('s1', 'reel', 'Instagram reel', { proofs: [{ slot: 1, url: 'https://www.instagram.com/reel/C9xK2/', filled: true }] })], can: { confirmLive: true, reportPosted: true } }));
    await waitFor(() => r.getByTestId('confirm-preview'));
    expect(r.getByText('Confirming releases ₹2,125')).toBeTruthy();
    expect(r.getByText('The second 25% of her ₹8,500. The last ₹4,250 follows 7 days later. Her sales and commission run separately.')).toBeTruthy();
    expect(r.getByText("Confirm it's live · ₹2,125")).toBeTruthy();
    fireEvent.press(r.getByTestId('confirm-live'));
    await waitFor(() => expect(api.brandApi.contentConfirmLive).toHaveBeenCalledWith('c1', 's1', 'ci1', 2125));
  });

  it('S9 · reported: the locked money stays locked; she told INFLX, and the brand can still confirm', async () => {
    const r = brand(hyb({ stage: 'posted', frozen: true, reported: { brand: { at: D(26), kind: 'posted_wrong' }, creator: null } }));
    await waitFor(() => r.getByTestId('reported-card'));
    expect(r.getByText('Nothing moves until INFLX settles it. ₹6,375 of her fixed amount stays locked. Her posts stay in the shop.')).toBeTruthy();
    const t = brand(hyb({ stage: 'posted', postedAt: D(23), reported: { brand: null, creator: { at: D(31) } }, can: { confirmLive: true } }));
    await waitFor(() => t.getByTestId('she-told-inflx'));
    expect(t.getByTestId('confirm-live')).toBeTruthy();
  });
});

/* ───────────────────────────── item 17 · INFLX settled it by hand (features/item17-wallet) */

describe('item 17 · Hybrid, when INFLX settles a payment by hand', () => {
  const paid2 = { t2: { amount: 2125, pct: 25, status: 'released', paidAt: D(24) } };

  it('INFLX stood in for a silent brand: the wording says INFLX, on both screens', async () => {
    const r = her(hyb({ stage: 'live', liveConfirmedAt: D(24), liveConfirmedBy: 'inflx', finalDueAt: D(31), money: money({ ...paid2, returned: 0 }) }));
    await waitFor(() => r.getByTestId('second-in'));
    expect(r.getByText("INFLX confirmed it's live on 24 Oct. ₹2,125 is in your wallet.")).toBeTruthy();
    expect(r.getByText('The last ₹4,250 arrives on 31 Oct.')).toBeTruthy();
    const b = brand(hyb({ stage: 'live', liveConfirmedAt: D(24), liveConfirmedBy: 'inflx', money: money({ ...paid2, returned: 0 }), path1: { ...sale().path1, ...opened, approved: 0, min: 1, short: 1, met: false } }));
    await waitFor(() => b.getByTestId('you-confirmed'));
    expect(b.getByText("INFLX confirmed it's live on 24 Oct and released ₹2,125 to Tanvi.")).toBeTruthy();
    expect(b.queryByText(/You confirmed/)).toBeNull();
  });

  it('INFLX returned the locked final payment: no date is promised to her, and the brand is told it is back in its wallet', async () => {
    const back = money({ ...paid2, stillLocked: 0, returned: 4250, t3: { amount: 4250, pct: 50, status: 'refunded', paidAt: null, dueAt: null } });
    const r = her(hyb({ stage: 'live', liveConfirmedAt: D(24), liveConfirmedBy: 'brand', finalDueAt: null, money: back }));
    await waitFor(() => r.getByTestId('returned-box'));
    expect(r.getByText('INFLX returned the locked ₹4,250 to the brand. No more payments are to come for this collaboration.')).toBeTruthy();
    expect(r.queryByTestId('last-on')).toBeNull();
    const b = brand(hyb({ stage: 'live', liveConfirmedAt: D(24), liveConfirmedBy: 'brand', money: back, path1: { ...sale().path1, ...opened, approved: 0, min: 1, short: 1, met: false } }));
    await waitFor(() => b.getByTestId('returned-box'));
    expect(b.getByText('INFLX returned the locked ₹4,250 to your wallet. No more payments will be made for this collaboration.')).toBeTruthy();
  });
});

describe('item 17 · Hybrid, posted, and INFLX settled the payment before the brand confirmed', () => {
  it("her screen does not say the brand's confirmation will pay her; the brand is not offered Confirm", async () => {
    const m = money({ t2: { amount: 2125, pct: 25, status: 'released', paidAt: D(25) }, returned: 0 });
    const r = her(hyb({ stage: 'posted', postedAt: D(22), settledByInflx: true, money: m }));
    await waitFor(() => r.getByTestId('settled-box'));
    expect(r.getByText('INFLX has settled this payment and will settle the rest of this collaboration with you.')).toBeTruthy();
    expect(r.queryByTestId('posted-waiting')).toBeNull();
    const b = brand(hyb({ stage: 'posted', postedAt: D(22), settledByInflx: true, can: { confirmLive: false }, money: m }));
    await waitFor(() => b.getByTestId('settled-box'));
    expect(b.getByText('INFLX has settled this payment and will settle the rest of this collaboration.')).toBeTruthy();
    expect(b.queryByTestId('confirm-live')).toBeNull();
  });
});

/* ───────────────────────────── ui-walk-fixes · board H · a file opens inside the app
 * Contract: features/ui-walk-fixes · checks 30, 33 · frames H1–H8
 * (the viewer itself: components/content/__tests__/mediaViewer12.test.js) */

describe('ui-walk-fixes H · Pay for Sale / Hybrid: one tap on a tile opens the file in the viewer — never the browser', () => {
  const { Linking } = require('react-native');
  const { _setPlayerForTests } = require('../../utils/videoPlayer');
  let openURL;
  let errors;
  beforeEach(() => {
    jest.useFakeTimers();                               // a touchable's press animation stays inside act()
    _setPlayerForTests(null);                           // jest has no native player: "an older app build"
    openURL = jest.spyOn(Linking, 'openURL').mockImplementation(() => Promise.resolve());
    errors = jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    const said = errors.mock.calls.map((args) => args.map(String).join(' ').split('\n')[0]);
    errors.mockRestore(); openURL.mockRestore(); _setPlayerForTests(undefined);
    jest.useRealTimers();
    expect(said).toEqual([]);                           // key clashes, a ref on a function component, act() …
  });

  const p1open = { ...sale().path1, ...opened };
  const shot = (id) => [{ slot: 1, url: null, screenshotFileId: id, filled: true }];
  const pic = { id: 'f2', kind: 'photo', mime: 'image/jpeg', pinnedNote: 'Full length, please.' };

  it('30 · 33 · H7 · her screen, editing: the viewer, the brand\'s pinned note, and "Remove", which closes it back to the row', async () => {
    api.influencerApi.contentRemoveFile.mockReturnValue(Promise.resolve({ success: true, data: {} }));
    const r = her(sale({ stage: 'draft', path1: p1open, rows: [row('s1', 'post', 'Instagram post', { files: [{ id: 'f1', kind: 'photo', mime: 'image/jpeg' }, pic] })], can: { addRows: true, removeRow: true, upload: true } }));
    await waitFor(() => r.getByTestId('row-s1'));
    fireEvent.press(r.getByTestId('file-f2'));
    await waitFor(() => r.getByTestId('viewer-photo'));
    expect(r.getByText('Festive Sarees · Instagram post · 2 of 2')).toBeTruthy();
    expect(api.influencerApi.contentFileUrl).toHaveBeenLastCalledWith('ci1', 'f2');
    expect(r.queryByTestId('action-sheet')).toBeNull();                   // no "View" menu in between
    expect(r.queryByText('View')).toBeNull();
    expect(r.getByTestId('viewer-note')).toBeTruthy();
    expect(r.queryByTestId('viewer-add-note')).toBeNull();
    expect(openURL).not.toHaveBeenCalled();
    fireEvent.press(r.getByTestId('viewer-remove'));
    expect(r.queryByTestId('media-viewer')).toBeNull();
    await waitFor(() => expect(api.influencerApi.contentRemoveFile).toHaveBeenCalledWith('ci1', 'f2'));
    expect(api.influencerApi.contentRemoveFile).toHaveBeenCalledTimes(1);
  });

  it('33 · her screen, while the brand is reviewing: she can only look', async () => {
    const r = her(sale({ stage: 'in_review', path1: p1open, rows: [row('s1', 'post', 'Instagram post', { files: [pic] })],
      rounds: [{ no: 1, submittedAt: D(20), verdict: null, rows: [], notes: [] }], round: { current: 1, allowed: 2, isLast: false, used: false, stamped: true } }));
    await waitFor(() => r.getByTestId('with-them'));
    fireEvent.press(r.getByTestId('file-f2'));
    await waitFor(() => r.getByTestId('viewer-photo'));
    expect(r.getByText('Festive Sarees · Instagram post · 1 of 1')).toBeTruthy();
    expect(r.queryByTestId('viewer-actions')).toBeNull();
    expect(r.queryByTestId('viewer-prev')).toBeNull();                    // one file: no arrows
    expect(openURL).not.toHaveBeenCalled();
  });

  it('30 · H8 · her own Story screenshots — in the package and outside it — open in the viewer with nothing under them', async () => {
    const r = her(sale({ stage: 'approved', approvedAt: D(22), path1: p1open,
      rows: [row('s2', 'story', 'Instagram story', { proofs: shot('sh1') }), row('o1', 'story', 'Instagram story', { outside: true, proofs: shot('sh2') })],
      can: { markPosted: true, addOutside: true } }));
    await waitFor(() => r.getByTestId('proof-row-s2'));
    fireEvent.press(r.getByTestId('file-sh1'));
    await waitFor(() => r.getByTestId('viewer-photo'));
    expect(r.getByText('Festive Sarees · Instagram story · 1 of 1')).toBeTruthy();
    expect(api.influencerApi.contentFileUrl).toHaveBeenLastCalledWith('ci1', 'sh1');
    expect(r.queryByTestId('viewer-actions')).toBeNull();
    fireEvent.press(r.getByTestId('viewer-close'));
    expect(r.queryByTestId('media-viewer')).toBeNull();

    fireEvent.press(r.getByTestId('file-sh2'));
    await waitFor(() => r.getByTestId('viewer-photo'));
    expect(api.influencerApi.contentFileUrl).toHaveBeenLastCalledWith('ci1', 'sh2');
    expect(r.queryByTestId('viewer-actions')).toBeNull();
    expect(openURL).not.toHaveBeenCalled();
  });

  it('30 · 33 · the brand\'s review: the tile opens the viewer and NOTHING is under the file — this review has no notes on files', async () => {
    const r = brand(sale({ stage: 'in_review', path1: p1open, rows: [row('s1', 'reel', 'Instagram reel', { files: [{ id: 'f1', kind: 'video', mime: 'video/mp4' }, pic] })],
      rounds: [{ no: 1, submittedAt: D(20), verdict: null, rows: [], notes: [] }], round: { current: 1, allowed: 2, isLast: false, used: false, stamped: true },
      can: { approve: true, askChanges: true } }));
    await waitFor(() => r.getByTestId('review'));
    fireEvent.press(r.getByTestId('file-f2'));
    await waitFor(() => r.getByTestId('viewer-photo'));
    expect(r.getByText('Festive Sarees · K7M2F9 · Instagram reel · 2 of 2')).toBeTruthy();
    expect(api.brandApi.contentFileUrl).toHaveBeenLastCalledWith('c1', 's1', 'ci1', 'f2');
    expect(r.queryByTestId('viewer-add-note')).toBeNull();                // although it can still ask for changes
    expect(r.queryByTestId('viewer-remove')).toBeNull();
    expect(r.queryByTestId('viewer-note')).toBeNull();                    // her pinned note is not the brand's to see here
    expect(r.queryByTestId('viewer-actions')).toBeNull();
    fireEvent.press(r.getByTestId('viewer-prev'));                        // the video, on a build without the player (31)
    await waitFor(() => r.getByTestId('viewer-needs-update'));
    expect(r.getByText('Update INFLX to play videos')).toBeTruthy();
    expect(r.queryByTestId('viewer-actions')).toBeNull();
    expect(openURL).not.toHaveBeenCalled();
  });

  it('30 · the Story screenshot the brand sees opens in the viewer; her link still opens outside the app', async () => {
    const r = brand(sale({ stage: 'posted', postedAt: D(23), autoconfirmAt: D(30), path1: { ...p1open, approved: 2, short: 0, met: true },
      rows: [row('s1', 'reel', 'Instagram reel', { proofs: [{ slot: 1, url: 'https://www.instagram.com/reel/C9xK2/', filled: true }] }), row('s2', 'story', 'Instagram story', { proofs: shot('sh1') })],
      can: { confirmLive: true, reportPosted: true } }));
    await waitFor(() => r.getByTestId('posted-row-s2'));
    fireEvent.press(r.getByTestId('file-sh1'));
    await waitFor(() => r.getByTestId('viewer-photo'));
    expect(r.getByText('Festive Sarees · K7M2F9 · Instagram story · 1 of 1')).toBeTruthy();
    expect(api.brandApi.contentFileUrl).toHaveBeenLastCalledWith('c1', 's1', 'ci1', 'sh1');
    expect(r.queryByTestId('viewer-actions')).toBeNull();
    expect(openURL).not.toHaveBeenCalled();
    fireEvent.press(r.getByTestId('viewer-close'));
    fireEvent.press(r.getByTestId('link-s1'));
    expect(openURL).toHaveBeenCalledWith('https://www.instagram.com/reel/C9xK2/');
  });
});

/* ───────────────────────────── ui-walk-fixes · board J · a pasted link turns the button on
 * Contract: features/ui-walk-fixes · checks 34–37 · frames J6, J7 · decisions U13, D5
 * (the box and the line of saves themselves: components/content/__tests__/linkBox12.test.js) */

describe('ui-walk-fixes J · Going live: the links save by themselves, and only the package\'s links hold the button', () => {
  const { act } = require('@testing-library/react-native');
  const { Keyboard } = require('react-native');
  let errors;
  let dismiss;
  beforeEach(() => {
    jest.useFakeTimers();                               // the 0.7 s pause, and a touchable's press animation
    dismiss = jest.spyOn(Keyboard, 'dismiss').mockImplementation(() => {});
    errors = jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    const said = errors.mock.calls.map((args) => args.map(String).join(' ').split('\n')[0]);
    errors.mockRestore(); dismiss.mockRestore();
    jest.useRealTimers();
    expect(said).toEqual([]);                           // act() warnings, key clashes …
  });

  const IG = 'https://www.instagram.com/reel/C9xK2';
  const YT = 'https://youtube.com/shorts/Xk3f9';
  const p1open = { ...sale().path1, ...opened };
  const link = (url = null) => [{ slot: 1, url, screenshotFileId: null, filled: !!url }];
  const shot = (id = null) => [{ slot: 1, url: null, screenshotFileId: id, filled: !!id }];
  const denim = { id: 'p3', title: 'Weekend denim', code: 'H4TN8W' };
  /**
   * Approved. The package: a reel (s1), a Story (s2), a YouTube Short (s3). Outside it: a reel (o1).
   * `has` says what INFLX holds: { s1: url, s2: screenshot id, s3: url, o1: url }.
   */
  const live = (has = {}, over = {}) => {
    const rows = [
      row('s1', 'reel', 'Instagram reel', { proofs: link(has.s1) }),
      row('s2', 'story', 'Instagram story', { proofs: shot(has.s2) }),
      row('s3', 'youtube_short', 'YouTube Short', { platform: 'youtube', postId: 'p3', post: denim, proofs: link(has.s3) }),
      row('o1', 'reel', 'Instagram reel', { outside: true, proofs: link(has.o1) }),
    ];
    const left = [has.s1 ? null : { rowKey: 's1', slot: 1, isStory: false }, has.s2 ? null : { rowKey: 's2', slot: 1, isStory: true }, has.s3 ? null : { rowKey: 's3', slot: 1, isStory: false }].filter(Boolean);
    return sale({ stage: 'approved', approvedAt: D(22), path1: p1open, rows, proofsLeft: left, can: { markPosted: left.length === 0, addOutside: true }, ...over });
  };
  const refusal = { success: false, error: { code: 'LINK_INVALID', message: 'Paste the full link to the post.', field: 'url' } };
  const pending = () => { let resolve; const promise = new Promise((x) => { resolve = x; }); return { promise, resolve }; };
  const settle = () => act(async () => { for (let i = 0; i < 25; i += 1) await Promise.resolve(); });   // eslint-disable-line no-await-in-loop
  const type = (box, text) => { for (let i = 1; i <= text.length; i += 1) fireEvent.changeText(box, text.slice(0, i)); };
  const off = (r) => r.getByTestId('posted').props.accessibilityState.disabled;
  const line = (r) => r.getByTestId('to-go').props.children;

  it('34 · J6 · one link saved, one saving, the Story without its screenshot: the button waits and the line names the one thing left', async () => {
    const save = pending();
    api.influencerApi.contentSetProof.mockReturnValue(save.promise);
    const r = her(live({ s1: IG }));
    await waitFor(() => r.getByTestId('path2-approved'));
    expect(r.getByTestId('link-s1-saved')).toBeTruthy();
    // ASSERTION DRIFT (drift/C1c.md): the short form is DRAWN over the box, it is no longer the
    // box's own text — that text stays the real link, so a stray edit can never save the short form.
    expect(r.getByTestId('link-s1-short').props.children).toBe('instagram.com/reel/C9xK2');
    expect(r.getByTestId('link-s1').props.value).toBe(IG);
    expect(line(r)).toBe('1 link and 1 screenshot to go.');
    expect(off(r)).toBe(true);

    fireEvent.changeText(r.getByTestId('link-s3'), YT);                    // pasted: sent without leaving the box
    expect(api.influencerApi.contentSetProof).toHaveBeenCalledTimes(1);
    expect(api.influencerApi.contentSetProof).toHaveBeenCalledWith('ci1', 's3', 1, { url: YT });
    expect(r.getByTestId('link-s3-saving').props.children).toBe('Saving…');
    expect(line(r)).toBe('1 screenshot to go.');
    expect(off(r)).toBe(true);                                              // every Story needs its screenshot

    await act(async () => { save.resolve({ success: true, data: { content: live({ s1: IG, s3: YT }) } }); });
    await settle();
    expect(r.getByTestId('link-s3-saved')).toBeTruthy();
    expect(line(r)).toBe('1 screenshot to go.');
    expect(off(r)).toBe(true);
    expect(r.getByTestId('add-shot-s2')).toBeTruthy();
    expect(r.getByText('Stories disappear in a day.')).toBeTruthy();
  });

  it('34 · with the Story\'s screenshot in, pasting the last link turns the button on while it saves; a refusal turns it off again', async () => {
    const save = pending();
    api.influencerApi.contentSetProof.mockReturnValueOnce(save.promise);
    const r = her(live({ s1: IG, s2: 'sh1' }));
    await waitFor(() => r.getByTestId('path2-approved'));
    expect(line(r)).toBe('1 link to go.');
    expect(off(r)).toBe(true);
    fireEvent.changeText(r.getByTestId('link-s3'), 'youtube.com/shorts/Xk3f9');             // D5: no "https://" in front
    expect(api.influencerApi.contentSetProof).toHaveBeenCalledWith('ci1', 's3', 1, { url: YT });
    expect(off(r)).toBe(false);
    expect(line(r)).toBe('Saving your link…');
    await act(async () => { save.resolve(refusal); });
    await settle();
    expect(r.getByText('Paste the full link to the post.')).toBeTruthy();
    expect(off(r)).toBe(true);
    expect(line(r)).toBe('One link needs fixing — see above.');
  });

  it('35 · J7 · a link outside the package saves by itself and shows the tick — no "Save link" button — and never counts toward the button', async () => {
    const save = pending();
    api.influencerApi.contentSetProof.mockReturnValueOnce(save.promise);
    const all = { s1: IG, s2: 'sh1', s3: YT };
    const r = her(live(all, { notShared: [{ postId: 'p1', inPackage: false, dueBy: D(28) }] }));
    await waitFor(() => r.getByTestId('outside'));
    expect(off(r)).toBe(false);                                             // the package is complete; the outside box is empty
    expect(r.queryByTestId('to-go')).toBeNull();
    expect(r.queryByText('Save link')).toBeNull();
    expect(r.getByTestId('add-where-p1')).toBeTruthy();                     // choosing the place first: as it was

    fireEvent.changeText(r.getByTestId('link-o1'), IG);
    expect(api.influencerApi.contentSetProof).toHaveBeenCalledWith('ci1', 'o1', 1, { url: IG });
    expect(r.getByTestId('link-o1-saving')).toBeTruthy();
    expect(off(r)).toBe(false);
    expect(r.queryByTestId('to-go')).toBeNull();                            // not "Saving your link…": it is not the package's
    await act(async () => { save.resolve({ success: true, data: { content: live({ ...all, o1: IG }) } }); });
    await settle();
    expect(r.getByTestId('link-o1-saved')).toBeTruthy();
    // ASSERTION DRIFT (drift/C1c.md): the short form is drawn over the box; the box holds the link.
    expect(r.getByTestId('link-o1-short').props.children).toBe('instagram.com/reel/C9xK2');
    expect(r.getByTestId('link-o1').props.value).toBe(IG);

    // Refused outside the package: the red line on its row, and the button is not held back.
    api.influencerApi.contentSetProof.mockReturnValue(Promise.resolve(refusal));
    api.influencerApi.contentPosted.mockReturnValue(ok(sale({ stage: 'posted', postedAt: D(23), autoconfirmAt: D(30), path1: p1open })));
    fireEvent(r.getByTestId('link-o1'), 'focus');
    fireEvent.changeText(r.getByTestId('link-o1'), '');
    fireEvent.changeText(r.getByTestId('link-o1'), 'https://youtu.be/dQ7vL2');
    await settle();
    expect(r.getByText('Paste the full link to the post.')).toBeTruthy();
    expect(off(r)).toBe(false);
    expect(r.queryByTestId('to-go')).toBeNull();
    fireEvent.press(r.getByTestId('posted'));
    await waitFor(() => r.getByTestId('autoconfirm-date'));
    expect(api.influencerApi.contentPosted).toHaveBeenCalledTimes(1);
  });

  it('35 · an outside link does not stand in for a package link: with one package box empty the button stays grey', async () => {
    const r = her(live({ s2: 'sh1', s3: YT, o1: IG }));
    await waitFor(() => r.getByTestId('outside'));
    expect(r.getByTestId('link-o1-saved')).toBeTruthy();
    expect(off(r)).toBe(true);
    expect(line(r)).toBe('1 link to go.');
    fireEvent.press(r.getByTestId('posted'));
    await settle();
    expect(api.influencerApi.contentPosted).not.toHaveBeenCalled();
  });

  it('35 · pressing the button with a package link not saved yet: the keypad closes, the link is saved, then it is marked posted', async () => {
    const save = pending();
    const order = [];
    api.influencerApi.contentSetProof.mockImplementation(() => { order.push('link'); return save.promise; });
    api.influencerApi.contentPosted.mockImplementation(() => { order.push('posted'); return ok(sale({ stage: 'posted', postedAt: D(23), autoconfirmAt: D(30), path1: p1open })); });
    const r = her(live({ s1: IG, s2: 'sh1' }));
    await waitFor(() => r.getByTestId('path2-approved'));
    type(r.getByTestId('link-s3'), YT);                                     // typed, the 0.7 s not yet over
    expect(order).toEqual([]);
    expect(off(r)).toBe(false);

    fireEvent.press(r.getByTestId('posted'));
    expect(dismiss).toHaveBeenCalledTimes(1);
    expect(order).toEqual(['link']);
    await settle();
    expect(order).toEqual(['link']);                                        // nothing is posted before INFLX answers
    await act(async () => { save.resolve({ success: true, data: { content: live({ s1: IG, s2: 'sh1', s3: YT }) } }); });
    await waitFor(() => r.getByTestId('autoconfirm-date'));
    expect(order).toEqual(['link', 'posted']);
    expect(api.influencerApi.contentPosted).toHaveBeenCalledWith('ci1');
  });

  it('35 · J4 · pressed with a package link INFLX then refuses: it stops on that row and nothing is marked posted', async () => {
    api.influencerApi.contentSetProof.mockReturnValue(Promise.resolve(refusal));
    const r = her(live({ s1: IG, s2: 'sh1' }));
    await waitFor(() => r.getByTestId('path2-approved'));
    type(r.getByTestId('link-s3'), 'https://www.instagram.com/reel/wrong-place');
    fireEvent.press(r.getByTestId('posted'));
    await settle();
    expect(api.influencerApi.contentPosted).not.toHaveBeenCalled();
    expect(r.getByText('Paste the full link to the post.')).toBeTruthy();
    expect(off(r)).toBe(true);
    expect(line(r)).toBe('One link needs fixing — see above.');
    expect(r.getByText("I've posted everything")).toBeTruthy();             // not left reading "Sending"
  });

  it('36 · a package link and an outside link pasted together: one at a time, in order, and the first answer does not empty the second box', async () => {
    const a = pending();
    const b = pending();
    api.influencerApi.contentSetProof.mockReturnValueOnce(a.promise).mockReturnValueOnce(b.promise);
    const r = her(live({ s1: IG, s2: 'sh1' }));
    await waitFor(() => r.getByTestId('outside'));
    fireEvent.changeText(r.getByTestId('link-s3'), YT);
    fireEvent.changeText(r.getByTestId('link-o1'), IG);
    await settle();
    expect(api.influencerApi.contentSetProof).toHaveBeenCalledTimes(1);
    await act(async () => { a.resolve({ success: true, data: { content: live({ s1: IG, s2: 'sh1', s3: YT }) } }); });
    await settle();
    expect(r.getByTestId('link-s3-saved')).toBeTruthy();
    expect(r.getByTestId('link-o1').props.value).toBe(IG);                  // still filled, still saving
    expect(r.getByTestId('link-o1-saving')).toBeTruthy();
    expect(api.influencerApi.contentSetProof).toHaveBeenLastCalledWith('ci1', 'o1', 1, { url: IG });
    await act(async () => { b.resolve({ success: true, data: { content: live({ s1: IG, s2: 'sh1', s3: YT, o1: IG }) } }); });
    await settle();
    expect(r.getByTestId('link-s3-saved')).toBeTruthy();
    expect(r.getByTestId('link-o1-saved')).toBeTruthy();
  });

  it('37 · a caption typed just before "Send": saved first, then the sheet; refused, it shows on the row and the sheet stays shut', async () => {
    const editing = (caption = '') => sale({ stage: 'draft', path1: p1open, can: { addRows: true, removeRow: true, upload: true, submit: true },
      rows: [row('s1', 'post', 'Instagram post', { caption, files: [{ id: 'f1', kind: 'photo', mime: 'image/jpeg' }] })] });
    const save = pending();
    api.influencerApi.contentCaption.mockReturnValueOnce(save.promise);
    const r = her(editing());
    await waitFor(() => r.getByTestId('row-s1'));
    fireEvent.changeText(r.getByTestId('caption-s1'), 'Festive drop, out now.');
    fireEvent.press(r.getByTestId('send'));                                 // she never left the caption box
    expect(dismiss).toHaveBeenCalledTimes(1);
    expect(api.influencerApi.contentCaption).toHaveBeenCalledWith('ci1', 's1', 'Festive drop, out now.');
    await settle();
    expect(r.queryByTestId('send-sheet')).toBeNull();
    await act(async () => { save.resolve({ success: true, data: { content: editing('Festive drop, out now.') } }); });
    await waitFor(() => r.getByTestId('send-sheet'));
    expect(r.getByTestId('caption-s1').props.value).toBe('Festive drop, out now.');
    fireEvent.press(r.getByTestId('send-cancel'));

    api.influencerApi.contentCaption.mockReturnValue(Promise.resolve({ success: false, error: { code: 'CAPTION_TOO_LONG', message: 'Keep it under 500 characters.', field: 'caption' } }));
    fireEvent.changeText(r.getByTestId('caption-s1'), 'x'.repeat(501));
    fireEvent.press(r.getByTestId('send'));
    await settle();
    expect(r.getByText('Keep it under 500 characters.')).toBeTruthy();
    expect(r.queryByTestId('send-sheet')).toBeNull();
    expect(api.influencerApi.contentSubmit).not.toHaveBeenCalled();
  });

  /* A row she takes out before sending is deleted on the server with its caption, and the next row
   * she adds is handed the SAME key (saleLive.service.js: removeRow, nextRowKey = highest + 1). What
   * the phone remembered about the old "s1" must not be believed about the new one. */
  describe('a row taken out and added again is handed the same key', () => {
    const pic = (id) => ({ id, kind: 'photo', mime: 'image/jpeg' });
    const draft = (rows) => sale({ stage: 'draft', path1: p1open, rows, can: { addRows: true, removeRow: true, upload: true, submit: rows.length > 0 } });
    const asReel = (caption = '') => row('s1', 'reel', 'Instagram reel', { caption, files: [pic('f1')] });
    const asPost = (caption = '') => row('s1', 'post', 'Instagram post', { caption, files: [pic('f2')] });   // its file already on it, to keep this to the caption
    /** "Remove" on s1, then the same post added again as an Instagram post — which INFLX calls s1 too. */
    const takeOutAndAddAgain = async (r) => {
      api.influencerApi.saleRemoveRow.mockReturnValue(ok(draft([])));
      api.influencerApi.saleAddRows.mockReturnValue(ok(draft([asPost()])));
      fireEvent.press(r.getByTestId('remove-s1'));
      await waitFor(() => expect(!!r.queryByTestId('row-s1')).toBe(false));   // (a boolean: a row that is still there is slow to print)
      expect(api.influencerApi.saleRemoveRow).toHaveBeenCalledWith('ci1', 's1');
      fireEvent.press(r.getByTestId('add-place-p1'));
      await waitFor(() => r.getByTestId('destination-sheet'));
      fireEvent.press(r.getByTestId('dest-post'));
      fireEvent.press(r.getByTestId('dest-add'));
      await waitFor(() => r.getByText('Festive Sarees · Instagram post'));
      await settle();
    };

    it('37 · the same caption typed again on the new row is sent again — on "Send" and on leaving the box — and is never wiped from the box', async () => {
      api.influencerApi.contentCaption.mockReset();
      api.influencerApi.contentCaption.mockReturnValueOnce(ok(draft([asReel('Festive drop')])));
      const r = her(draft([asReel()]));
      await waitFor(() => r.getByTestId('row-s1'));
      fireEvent.changeText(r.getByTestId('caption-s1'), 'Festive drop');
      fireEvent(r.getByTestId('caption-s1'), 'endEditing');                 // she leaves the box: saved
      await settle();
      expect(api.influencerApi.contentCaption).toHaveBeenCalledTimes(1);
      expect(r.getByTestId('caption-s1').props.value).toBe('Festive drop');

      await takeOutAndAddAgain(r);
      expect(r.getByTestId('caption-s1').props.value).toBe('');             // the new row: INFLX has no caption for it

      const save = pending();
      api.influencerApi.contentCaption.mockReturnValueOnce(save.promise);
      fireEvent.changeText(r.getByTestId('caption-s1'), 'Festive drop');    // the very same words
      fireEvent.press(r.getByTestId('send'));
      expect(api.influencerApi.contentCaption).toHaveBeenCalledTimes(2);
      expect(api.influencerApi.contentCaption).toHaveBeenLastCalledWith('ci1', 's1', 'Festive drop');
      expect(r.getByTestId('caption-s1').props.value).toBe('Festive drop');
      await settle();
      expect(r.queryByTestId('send-sheet')).toBeNull();                     // not before INFLX has the caption
      await act(async () => { save.resolve({ success: true, data: { content: draft([asPost('Festive drop')]) } }); });
      await waitFor(() => r.getByTestId('send-sheet'));
      expect(r.getByTestId('caption-s1').props.value).toBe('Festive drop');
      fireEvent.press(r.getByTestId('send-cancel'));

      // … and once more, this time by leaving the box instead of pressing Send.
      await takeOutAndAddAgain(r);
      api.influencerApi.contentCaption.mockReturnValueOnce(ok(draft([asPost('Festive drop')])));
      fireEvent.changeText(r.getByTestId('caption-s1'), 'Festive drop');
      fireEvent(r.getByTestId('caption-s1'), 'endEditing');
      expect(api.influencerApi.contentCaption).toHaveBeenCalledTimes(3);
      await settle();
      expect(r.getByTestId('caption-s1').props.value).toBe('Festive drop');
    });

    it('a caption she was still typing when she took the row out goes with it: the new row opens empty and nothing is sent for it', async () => {
      api.influencerApi.contentCaption.mockReset();
      api.influencerApi.contentCaption.mockReturnValue(Promise.resolve({ success: false, error: { code: 'UNKNOWN_ROW', message: 'Not a row of this package.', field: 'rowKey' } }));
      const r = her(draft([asReel()]));
      await waitFor(() => r.getByTestId('row-s1'));
      fireEvent.changeText(r.getByTestId('caption-s1'), 'Words for the reel');   // never left the box, never saved
      await takeOutAndAddAgain(r);
      expect(r.getByTestId('caption-s1').props.value).toBe('');
      fireEvent.press(r.getByTestId('send'));
      await waitFor(() => r.getByTestId('send-sheet'));
      expect(api.influencerApi.contentCaption).not.toHaveBeenCalled();
    });

    it('a caption box she leaves while "Remove" is still on its way: nothing is sent for the row that is gone', async () => {
      api.influencerApi.contentCaption.mockReset();
      api.influencerApi.contentCaption.mockReturnValue(Promise.resolve({ success: false, error: { code: 'UNKNOWN_ROW', message: 'Not a row of this package.', field: 'rowKey' } }));
      const gone = pending();
      api.influencerApi.saleRemoveRow.mockReturnValue(gone.promise);
      const r = her(draft([asReel()]));
      await waitFor(() => r.getByTestId('row-s1'));
      fireEvent.changeText(r.getByTestId('caption-s1'), 'Words for the reel');
      fireEvent.press(r.getByTestId('remove-s1'));
      fireEvent(r.getByTestId('caption-s1'), 'endEditing');                 // the save waits its turn, behind the remove
      await settle();
      expect(api.influencerApi.contentCaption).not.toHaveBeenCalled();
      await act(async () => { gone.resolve({ success: true, data: { content: draft([]) } }); });
      await settle();
      expect(!!r.queryByTestId('row-s1')).toBe(false);
      expect(api.influencerApi.contentCaption).not.toHaveBeenCalled();
      expect(r.queryByText('Not a row of this package.')).toBeNull();
    });

    it('a "Remove" INFLX refuses takes nothing away: the caption she was typing is still in the box and is still sent', async () => {
      api.influencerApi.contentCaption.mockReset();
      api.influencerApi.contentCaption.mockReturnValue(ok(draft([asReel('Words for the reel')])));
      api.influencerApi.saleRemoveRow.mockReturnValue(Promise.resolve({ success: false, error: { code: 'PACKAGE_LOCKED', message: 'Urban Threads is reviewing it.' } }));
      const r = her(draft([asReel()]));
      await waitFor(() => r.getByTestId('row-s1'));
      fireEvent.changeText(r.getByTestId('caption-s1'), 'Words for the reel');
      fireEvent.press(r.getByTestId('remove-s1'));
      await settle();
      expect(r.getByTestId('caption-s1').props.value).toBe('Words for the reel');
      fireEvent.press(r.getByTestId('send'));
      await waitFor(() => r.getByTestId('send-sheet'));
      expect(api.influencerApi.contentCaption).toHaveBeenCalledWith('ci1', 's1', 'Words for the reel');
    });
  });
});
