/**
 * Item 12, Phase 3 — both content screens, rendered at every stage they can be in.
 * Contract: features/item12-content · checks 27, 28 (and the screens' copy, C1–C16)
 *
 * React Native has no compile step: a bad import or a typo fails on the DEVICE, in a bundle that
 * has already shipped. Every stage is mounted here with the server's real G1 shape.
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
    contentClearProof: jest.fn(), contentPosted: jest.fn(), contentReport: jest.fn(), contentUploadUrl: jest.fn(),
    contentConfirmFile: jest.fn(), contentRemoveFile: jest.fn(), contentFileUrl: jest.fn(() => Promise.resolve({ success: true, data: { view: { url: 'https://x/y' } } })),
  },
  brandApi: {
    content: jest.fn(), contentApprove: jest.fn(), contentChanges: jest.fn(), contentConfirmLive: jest.fn(),
    contentReport: jest.fn(), contentFileUrl: jest.fn(() => Promise.resolve({ success: true, data: { view: { url: 'https://x/y' } } })),
  },
  uploadContentFile: jest.fn(),
}));
const api = require('../../services/api');
import ContentScreen from '../influencer/ContentScreen';
import BrandContentScreen from '../brand/BrandContentScreen';

const nav = { navigate: jest.fn(), goBack: jest.fn(), addListener: jest.fn(() => () => {}), setParams: jest.fn() };
const HER = { params: { ciId: 'ci1' } };
const BRAND = { params: { campaignId: 'c1', setId: 's1', ciId: 'ci1' } };
const D = (d) => `2026-10-${String(d).padStart(2, '0')}T06:00:00.000Z`;

const reel = (files = [], proofs = []) => ({ key: 'reel', type: 'reel', count: 1, label: 'Instagram reel', platform: 'instagram', isStory: false, caption: 'Diwali in the new linen co-ord.', files, have: files.length, proofs });
const story = (files = [], proofs = []) => ({ key: 'story', type: 'story', count: 2, label: 'Instagram story', platform: 'instagram', isStory: true, caption: '', files, have: files.length, proofs });
const video = { id: 'v1', kind: 'video', mime: 'video/mp4', durationS: 28, notes: [], pinnedNote: null };
const photo = (id, note = null) => ({ id, kind: 'photo', mime: 'image/jpeg', notes: [], pinnedNote: note });

/** The server's real G1 shape (contentFlow.shape), at whatever stage the test needs. */
function content(over = {}) {
  return {
    invitationId: 'ci1', contentId: 'cc1', campaignName: 'Diwali Edit 2026', setName: 'Set A', mode: 'visit',
    brand: { name: 'Urban Threads' }, creator: { name: 'Tanvi Suresh' },
    stage: 'draft', frozen: false, shootDoneAt: D(19), postingDate: '2026-10-24', daysToPosting: 5,
    rows: [reel(), story()], missing: [{ key: 'reel', label: 'Instagram reel', need: 1, have: 0, short: 1 }, { key: 'story', label: 'Instagram story', need: 2, have: 0, short: 2 }],
    proofsLeft: [], round: { current: 1, allowed: 2, isLast: false, used: false, stamped: false }, rounds: [], changesAsked: 0,
    approvedAt: null, postedAt: null, reportFrom: null, liveConfirmedAt: null, finalDueAt: null, completedAt: null, proofCount: 0,
    money: { fee: 12000, waitDays: 7, stillLocked: 9000, campaignFee: 960, t1: { amount: 3000, paidAt: '2026-09-14T06:00:00Z', status: 'released' }, t2: { amount: 3000, paidAt: null, status: 'locked' }, t3: { amount: 6000, paidAt: null, status: 'locked', dueAt: null } },
    usageRights: { on: true, durationDays: 90, places: ['social'], words: '90 days · social' },
    reported: { brand: null, creator: null }, delayed: null, yourMove: true, move: { key: 'send_content', side: 'creator' },
    can: {},
    steps: [
      { key: 'signed', label: 'Agreement signed', state: 'done', at: '2026-09-14T06:00:00Z' },
      { key: 'shoot', label: 'Shoot', state: 'done', at: D(19) },
      { key: 'content', label: 'Content', state: 'now', at: null },
      { key: 'live', label: 'Live and paid', state: 'later', at: null, postingDate: '2026-10-24' },
    ],
    ...over,
  };
}
const ok = (c) => Promise.resolve({ success: true, data: { content: c } });
const her = (c) => { api.influencerApi.myContent.mockReturnValue(ok(c)); return render(<ContentScreen navigation={nav} route={HER} />); };
const brand = (c) => { api.brandApi.content.mockReturnValue(ok(c)); return render(<BrandContentScreen navigation={nav} route={BRAND} />); };
beforeEach(() => jest.clearAllMocks());

/* ───────────────────────────── her screen */

describe('ContentScreen (her)', () => {
  it('27 · loading, then couldn\'t load', async () => {
    let resolve;
    api.influencerApi.myContent.mockReturnValue(new Promise((r) => { resolve = r; }));
    const r = render(<ContentScreen navigation={nav} route={HER} />);
    expect(r.getByTestId('skeleton')).toBeTruthy();
    resolve({ success: false });
    await waitFor(() => r.getByTestId('load-error'));
  });

  it('C15 · shoot not done', async () => {
    const r = her(content({ stage: 'shoot_not_done', rows: [], shootDoneAt: null }));
    await waitFor(() => r.getByText('Shoot not done yet'));
    expect(r.getByText('This opens once your visit is confirmed.')).toBeTruthy();
  });

  it('C1 → C3 · what she owes, then the empty rows with the limits named', async () => {
    const r = her(content());
    await waitFor(() => r.getByText('Shoot done on 19 Oct. Now the content.'));
    expect(r.getByTestId('what-you-agreed')).toBeTruthy();
    expect(r.getByText('90 days · social')).toBeTruthy();
    expect(r.getByText('Go live by 24 Oct · 5 days')).toBeTruthy();
    expect(r.getByText('Upload everything here first. Urban Threads see it before it goes anywhere, and you post once they approve.')).toBeTruthy();
    fireEvent.press(r.getByTestId('start-uploading'));
    await waitFor(() => r.getByText('Nothing uploaded yet'));
    expect(r.getByText('Add the 1 reel and 2 stories you agreed. Photos up to 10 MB, videos up to 200 MB.')).toBeTruthy();
    expect(r.getByText('Every row has to be filled before you can send.')).toBeTruthy();
    expect(r.getByTestId('add-reel')).toBeTruthy();
  });

  it('C4 · filling it: counts, the tiles with the duration badge, and exactly what is missing', async () => {
    const r = her(content({ rows: [reel([video]), story([photo('p1')])], missing: [{ key: 'story', label: 'Instagram story', need: 2, have: 1, short: 1 }] }));
    await waitFor(() => r.getByTestId('edit-row-reel'));
    expect(r.getByText('0:28')).toBeTruthy();
    expect(r.getByText('1 of 1')).toBeTruthy();
    expect(r.getByText('1 of 2')).toBeTruthy();
    expect(r.getByText('1 more story to add.')).toBeTruthy();
    expect(r.getByText('Captions are what you suggest. Urban Threads can ask for changes to any of it.')).toBeTruthy();
  });

  it('C5 · 28 · the send sheet says the lock and "don\'t post yet"; its Send honours busy', async () => {
    let resolve;
    api.influencerApi.contentSubmit.mockReturnValue(new Promise((x) => { resolve = x; }));
    const full = content({ rows: [reel([video]), story([photo('p1'), photo('p2')])], missing: [], can: { submit: true, upload: true } });
    const r = her(full);
    await waitFor(() => r.getByTestId('send'));
    fireEvent.press(r.getByTestId('send'));
    await waitFor(() => r.getByTestId('send-sheet'));
    expect(r.getByText('Send this to Urban Threads?')).toBeTruthy();
    expect(r.getByText("You can't change anything while they are reviewing it.")).toBeTruthy();
    expect(r.getByText("Don't post any of this yet. They approve it first, then you post and they confirm it is live.")).toBeTruthy();
    fireEvent.press(r.getByTestId('send-confirm'));
    fireEvent.press(r.getByTestId('send-confirm'));
    expect(api.influencerApi.contentSubmit).toHaveBeenCalledTimes(1);
    resolve({ success: true, data: { content: { ...full, stage: 'in_review' } } });
    await waitFor(() => r.getByTestId('with-them'));
  });

  it('C8 · their words, the round, the pinned note, the package open again', async () => {
    const r = her(content({
      stage: 'changes', round: { current: 2, allowed: 2, isLast: true, used: false, stamped: true },
      rounds: [{ no: 1, verdict: 'changes', verdictAt: D(21), reason: 'The second reel is too dark at the end.', submittedAt: D(20), rows: [], notes: [] }],
      rows: [reel([{ ...video, pinnedNote: 'Replace this one — too dark at the end.' }]), story([photo('p1'), photo('p2')])], missing: [], can: { submit: true, upload: true },
    }));
    await waitFor(() => r.getByText('Urban Threads asked for changes on 21 Oct.'));
    expect(r.getByText('ROUND 1 OF 2')).toBeTruthy();
    expect(r.getByText('"The second reel is too dark at the end."')).toBeTruthy();
    expect(r.getByText('Replace this one — too dark at the end.')).toBeTruthy();
    expect(r.getByText('Send the changes')).toBeTruthy();
    expect(r.getByText('Replace what they asked about. Everything else stays as it is.')).toBeTruthy();
  });

  it('C10 · approved: a link per deliverable, a screenshot for the story, and what is left', async () => {
    const r = her(content({
      stage: 'approved', approvedAt: D(22),
      rows: [reel([video], [{ slot: 1, url: null, screenshotFileId: null, filled: false }]), story([photo('p1'), photo('p2')], [{ slot: 1, filled: false }, { slot: 2, filled: false }])],
      proofsLeft: [{ rowKey: 'reel', slot: 1, isStory: false }, { rowKey: 'story', slot: 1, isStory: true }, { rowKey: 'story', slot: 2, isStory: true }],
      can: { addProof: true, markPosted: false },
    }));
    await waitFor(() => r.getByText('Approved on 22 Oct. Post it now — this is the version they approved.'));
    expect(r.getByText('Add a link for each one')).toBeTruthy();
    expect(r.getByTestId('link-reel:1')).toBeTruthy();
    expect(r.getByText('Stories disappear in a day, so a screenshot is the proof.')).toBeTruthy();
    expect(r.getByText('1 link and 2 screenshots to go.')).toBeTruthy();
  });

  it('C15 · waiting to be confirmed, with the date from which she may tell INFLX; the button once it is open', async () => {
    const r = her(content({ stage: 'posted', postedAt: D(23), reportFrom: '2026-10-29T18:30:00.000Z', can: { report: true } }));
    await waitFor(() => r.getByText('Waiting for them to confirm'));
    expect(r.getByText("You posted on 23 Oct. Urban Threads haven't confirmed yet. From 30 Oct you can ask INFLX to look at it.")).toBeTruthy();
    fireEvent.press(r.getByTestId('ask-inflx'));
    await waitFor(() => r.getByTestId('report-sheet'));
  });

  it('C12 · paid the second 25%, the last on a date', async () => {
    const r = her(content({
      stage: 'live', liveConfirmedAt: D(23), finalDueAt: '2026-10-29T21:30:00.000Z',
      money: { ...content().money, stillLocked: 6000, t2: { amount: 3000, paidAt: D(23), status: 'released' }, t3: { amount: 6000, paidAt: null, status: 'queued' } },
    }));
    await waitFor(() => r.getByText('Urban Threads confirmed your content is live on 23 Oct.'));
    expect(r.getByText('₹3,000 is in your wallet. The last ₹6,000 arrives on 30 Oct — nothing for you to do.')).toBeTruthy();
    expect(r.getByText('Her fee · ₹12,000')).toBeTruthy();
    expect(r.queryByText(/960/)).toBeNull();
  });

  it('C15 · they told INFLX, and delayed', async () => {
    const r = her(content({ stage: 'posted', frozen: true, reported: { brand: { at: D(25), kind: 'posted_wrong' }, creator: null } }));
    await waitFor(() => r.getByText('They told INFLX'));
    expect(r.getByText('Urban Threads reported a problem with what you posted. INFLX will contact you both. Your ₹3,000 from signing stays yours.')).toBeTruthy();
    const d = her(content({ delayed: { at: D(25), stage: 'content_not_submitted', label: 'Content not sent' } }));
    await waitFor(() => d.getByTestId('delayed-box'));
    expect(d.getByText('The 24 Oct posting date passed before your content went live. Nothing changes: carry on from wherever you are, and the money is untouched.')).toBeTruthy();
  });
});

/* ───────────────────────────── the brand's screen */

const sent = (over = {}) => content({
  stage: 'in_review', rows: [reel([video]), story([photo('p1'), photo('p2')])],
  rounds: [{ no: 1, verdict: null, submittedAt: D(20), rows: [], notes: [] }],
  can: { approve: true, askChanges: true, confirmLive: false, reportRoundsUsed: false, reportPostedWrong: false }, ...over,
});

describe('BrandContentScreen', () => {
  it('27 · couldn\'t load', async () => {
    api.brandApi.content.mockReturnValue(Promise.resolve({ success: false }));
    const r = render(<BrandContentScreen navigation={nav} route={BRAND} />);
    await waitFor(() => r.getByTestId('load-error'));
  });

  it('C2 · waiting for her, the fee card with the campaign fee line, the countdown', async () => {
    const r = brand(content());
    await waitFor(() => r.getByText('Tanvi is working on the content. You review it here before she posts anything.'));
    expect(r.getByText('Pay for Content · Store Visit')).toBeTruthy();
    expect(r.getByText('INFLX campaign fee ₹960 · charged to you at signing, never to her.')).toBeTruthy();
    expect(r.getByText('She goes live by 24 Oct · 5 days')).toBeTruthy();
  });

  it('C6 · 28 · reviewing: the round, the files, the two buttons; Approve honours busy', async () => {
    let resolve;
    api.brandApi.contentApprove.mockReturnValue(new Promise((x) => { resolve = x; }));
    const r = brand(sent());
    await waitFor(() => r.getByText('Your move. Tanvi sent her content on 20 Oct.'));
    expect(r.getByText('ROUND 1 OF 2')).toBeTruthy();
    expect(r.getByText('Approving locks this as the version she posts. Asking for changes sends it back with your reason.')).toBeTruthy();
    fireEvent.press(r.getByTestId('approve'));
    fireEvent.press(r.getByTestId('approve'));
    expect(api.brandApi.contentApprove).toHaveBeenCalledTimes(1);
    resolve({ success: true, data: { content: sent({ stage: 'approved' }) } });
    await waitFor(() => r.getByTestId('approved-posting'));
  });

  it('C7 · asking for changes: the reason is required; the sheet says the rounds; Send honours busy', async () => {
    let resolve;
    api.brandApi.contentChanges.mockReturnValue(new Promise((x) => { resolve = x; }));
    const r = brand(sent());
    await waitFor(() => r.getByTestId('ask-changes'));
    fireEvent.press(r.getByTestId('ask-changes'));
    await waitFor(() => r.getByTestId('changes-sheet'));
    expect(r.getByText('You have 2 rounds. After this one you can approve it or report it to INFLX.')).toBeTruthy();
    fireEvent.press(r.getByTestId('changes-send'));
    expect(r.getByText('Say what should change.')).toBeTruthy();
    expect(api.brandApi.contentChanges).not.toHaveBeenCalled();
    fireEvent.changeText(r.getByTestId('changes-reason'), 'The second reel is too dark at the end.');
    fireEvent.press(r.getByTestId('changes-send'));
    fireEvent.press(r.getByTestId('changes-send'));
    expect(api.brandApi.contentChanges).toHaveBeenCalledTimes(1);
    expect(api.brandApi.contentChanges.mock.calls[0][3]).toEqual({ round: 1, reason: 'The second reel is too dark at the end.', notes: [] });
    resolve({ success: true, data: { content: sent({ stage: 'changes' }) } });
  });

  it('C9 · the last round, warned before the decision, with the earlier round listed', async () => {
    const r = brand(sent({
      round: { current: 2, allowed: 2, isLast: true, used: false, stamped: true },
      rounds: [{ no: 1, verdict: 'changes', verdictAt: D(21), reason: 'too dark at the end', submittedAt: D(20), rows: [], notes: [] }, { no: 2, verdict: null, submittedAt: D(22), rows: [], notes: [] }],
    }));
    await waitFor(() => r.getByText('Your move. Tanvi sent her changes on 22 Oct.'));
    expect(r.getByText('ROUND 2 OF 2 · LAST')).toBeTruthy();
    expect(r.getByText("This is the last round. If this still isn't right, you can approve it or report it to INFLX — there is no third round.")).toBeTruthy();
    expect(r.getByText('Round 1 · 21 Oct — "too dark at the end"')).toBeTruthy();
  });

  it('C14 · rounds used: approve, or report — no third round', async () => {
    const r = brand(sent({
      round: { current: 3, allowed: 2, isLast: false, used: true, stamped: true },
      rounds: [{ no: 1, verdict: 'changes', verdictAt: D(21), reason: 'too dark' }, { no: 2, verdict: 'changes', verdictAt: D(24), reason: 'still not full length' }, { no: 3, verdict: null, submittedAt: D(25) }],
      can: { approve: true, askChanges: false, reportRoundsUsed: true },
    }));
    await waitFor(() => r.getByText('ROUNDS USED'));
    expect(r.getByText("You've used both rounds. There is no third — approve what she sent, or report it to INFLX.")).toBeTruthy();
    expect(r.queryByTestId('ask-changes')).toBeNull();
    expect(r.getByTestId('report-rounds')).toBeTruthy();
  });

  it('C11 · 28 · confirming live: the links open, the money is named, Confirm honours busy', async () => {
    let resolve;
    api.brandApi.contentConfirmLive.mockReturnValue(new Promise((x) => { resolve = x; }));
    const r = brand(content({
      stage: 'posted', postedAt: D(23),
      rows: [reel([video], [{ slot: 1, url: 'https://www.instagram.com/reel/C8xK2', filled: true }]), story([], [{ slot: 1, screenshotFileId: 's1', filled: true }, { slot: 2, screenshotFileId: 's2', filled: true }])],
      can: { confirmLive: true, reportPostedWrong: true },
    }));
    await waitFor(() => r.getByText('Your move. Tanvi posted everything on 23 Oct.'));
    expect(r.getByText('instagram.com/reel/C8xK2')).toBeTruthy();
    expect(r.getByText('Confirming releases ₹3,000')).toBeTruthy();
    expect(r.getByText('The second 25% of her ₹12,000 fee. The last ₹6,000 follows 7 days later.')).toBeTruthy();
    expect(r.getByText("Something's wrong — tell INFLX")).toBeTruthy();
    fireEvent.press(r.getByTestId('confirm-live'));
    fireEvent.press(r.getByTestId('confirm-live'));
    expect(api.brandApi.contentConfirmLive).toHaveBeenCalledTimes(1);
    expect(api.brandApi.contentConfirmLive.mock.calls[0][3]).toBe(3000);
    resolve({ success: true, data: { content: content({ stage: 'live', liveConfirmedAt: D(23), finalDueAt: D(30) }) } });
    await waitFor(() => r.getByTestId('you-confirmed'));
  });

  it('C13 · completed: three payments, the record, the usage rights', async () => {
    const paid = { amount: 0, paidAt: D(30), status: 'released' };
    const r = brand(content({
      stage: 'complete', completedAt: D(30), approvedAt: D(22), changesAsked: 1, postedAt: D(23), proofCount: 5, liveConfirmedAt: D(23),
      money: { ...content().money, stillLocked: 0, t2: { ...paid, amount: 3000, paidAt: D(23) }, t3: { ...paid, amount: 6000 } },
    }));
    await waitFor(() => r.getByText('Collaboration completed on 30 Oct.'));
    expect(r.getByText('INFLX campaign fee ₹960 · charged at signing.')).toBeTruthy();
    expect(r.getByText('22 Oct · 1 round of changes')).toBeTruthy();
    expect(r.getByText('23 Oct · 5 links')).toBeTruthy();
    expect(r.getByText('Her posts stay up under the usage rights you agreed: 90 days · social.')).toBeTruthy();
  });

  it('C16 · delayed with where it stopped; reported with her fee in escrow; nothing received', async () => {
    const d = brand(sent({ delayed: { at: D(25), stage: 'content_in_review', label: 'Content in review' } }));
    await waitFor(() => d.getByText('The 24 Oct posting date passed before the content went live. Where it stopped: in review with you.'));
    const rep = brand(sent({ stage: 'in_review', frozen: true, reported: { brand: { at: D(25), kind: 'rounds_used' }, creator: null } }));
    await waitFor(() => rep.getByText('You reported this on 25 Oct. INFLX has it. ₹9,000 of her fee stays in escrow until it is settled.'));
    expect(rep.queryByTestId('approve')).toBeNull();
    const n = brand(content({ shootDoneAt: '2026-09-01T06:00:00.000Z' }));
    await waitFor(() => n.getByText("Tanvi hasn't sent her content yet. She is being reminded every two days."));
  });
});

/* ───────────────────────────── item 17 · INFLX settled it by hand (features/item17-wallet) */

describe('item 17 · when INFLX settles a payment by hand, the content screens say what happened', () => {
  const live = (over = {}) => content({
    stage: 'live', liveConfirmedAt: D(23), liveConfirmedBy: 'inflx', finalDueAt: D(30),
    money: { ...content().money, stillLocked: 6000, returned: 0, t2: { amount: 3000, paidAt: D(23), status: 'released' }, t3: { amount: 6000, paidAt: null, status: 'queued' } },
    ...over,
  });

  it('INFLX stood in for a silent brand: neither side is told the brand confirmed', async () => {
    const r = her(live());
    await waitFor(() => r.getByText('INFLX confirmed your content is live on 23 Oct.'));
    expect(r.queryByText(/Urban Threads confirmed/)).toBeNull();
    expect(r.getByText('₹3,000 is in your wallet. The last ₹6,000 arrives on 30 Oct — nothing for you to do.')).toBeTruthy();
    const b = brand(live());
    await waitFor(() => b.getByText('INFLX confirmed the content is live on 23 Oct and released the second payment.'));
    expect(b.queryByText(/You confirmed/)).toBeNull();
  });

  it('INFLX returned the locked money: the card shows it as returned, and no date is promised', async () => {
    const back = { money: { ...content().money, stillLocked: 0, returned: 6000, t2: { amount: 3000, paidAt: D(23), status: 'released' }, t3: { amount: 6000, paidAt: null, status: 'refunded', dueAt: null } }, finalDueAt: null };
    const r = her(live({ liveConfirmedBy: 'brand', ...back }));
    await waitFor(() => r.getByTestId('returned-box'));
    expect(r.getByText('INFLX returned the locked ₹6,000 to the brand. No more payments are to come for this collaboration.')).toBeTruthy();
    expect(r.getByText('Returned to the brand by INFLX')).toBeTruthy();
    expect(r.queryByTestId('in-wallet')).toBeNull();
    expect(r.queryByTestId('fee-t3-next')).toBeNull();                    // a returned payment is never "next"
    const b = brand(live({ liveConfirmedBy: 'brand', ...back }));
    await waitFor(() => b.getByTestId('returned-box'));
    expect(b.getByText('INFLX returned the locked ₹6,000 to your wallet. No more payments will be made for this collaboration.')).toBeTruthy();
    expect(b.queryByTestId('last-follows')).toBeNull();
  });
});

describe('item 17 · she posted, and INFLX settled the payment before the brand confirmed', () => {
  const posted = (over = {}) => content({
    stage: 'posted', postedAt: D(22), settledByInflx: true, can: { confirmLive: false },
    money: { ...content().money, stillLocked: 6000, returned: 0, t2: { amount: 3000, paidAt: D(25), status: 'released' }, t3: { amount: 6000, paidAt: null, status: 'locked' } },
    ...over,
  });

  it("neither screen promises what the brand's Confirm would pay, and the brand is not offered the button", async () => {
    const r = her(posted());
    await waitFor(() => r.getByTestId('settled-box'));
    expect(r.getByText('INFLX has settled this payment and will settle the rest of this collaboration with you.')).toBeTruthy();
    expect(r.queryByTestId('waiting-confirm')).toBeNull();
    const b = brand(posted());
    await waitFor(() => b.getByTestId('settled-box'));
    expect(b.getByText('INFLX has settled this payment and will settle the rest of this collaboration.')).toBeTruthy();
    expect(b.queryByTestId('confirm-preview')).toBeNull();
    expect(b.queryByTestId('confirm-live')).toBeNull();
  });

  it('returned money says so at the posted stage too; a collaboration INFLX completed by hand never claims a confirmation', async () => {
    const back = { money: { ...content().money, stillLocked: 0, returned: 9000, t2: { amount: 3000, paidAt: null, status: 'refunded' }, t3: { amount: 6000, paidAt: null, status: 'refunded' } } };
    const b = brand(posted(back));
    await waitFor(() => b.getByText('INFLX returned the locked ₹9,000 to your wallet. No more payments will be made for this collaboration.'));
    const done = her(content({
      stage: 'complete', liveConfirmedAt: null, liveConfirmedBy: null, completedAt: D(28), frozen: true,
      money: { ...content().money, stillLocked: 0, returned: 0, t2: { amount: 3000, paidAt: D(25), status: 'released' }, t3: { amount: 6000, paidAt: D(28), status: 'released' } },
    }));
    await waitFor(() => done.getByText('INFLX settled this collaboration and released your payments.'));
    expect(done.queryByText(/confirmed your content is live on/)).toBeNull();
    expect(done.queryByTestId('told-inflx')).toBeNull();                  // the report card does not sit beside a completed collaboration
  });
});
