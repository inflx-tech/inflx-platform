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
    await waitFor(() => expect(nav.navigate).toHaveBeenCalledWith('CreateTab', { screen: 'PostType', params: { postId: 'new1' } }));
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
