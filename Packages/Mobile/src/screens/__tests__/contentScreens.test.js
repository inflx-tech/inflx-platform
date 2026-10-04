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
/** shopper-walk-fixes (frame B2): the viewer's title is two lines — the deliverable, then which file. */
const titled = (r, head, which) => {
  expect(r.getByTestId('viewer-title').props.children).toBe(head);
  expect(r.getByTestId('viewer-which').props.children).toBe(which);
  return true;
};
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

/* ───────────────────────────── ui-walk-fixes · board H · a file opens inside the app
 * Contract: features/ui-walk-fixes · checks 30, 31, 33 · frames H1–H8
 * (the viewer itself: components/content/__tests__/mediaViewer12.test.js) */

describe('ui-walk-fixes H · one tap on a tile opens the file in the viewer — never the browser, never a menu', () => {
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

  const viewerCalls = (fn, id) => fn.mock.calls.filter((args) => args[args.length - 1] === id).length;
  const approved = (over = {}) => content({
    stage: 'approved', approvedAt: D(22),
    rows: [reel([video], [{ slot: 1, url: null, screenshotFileId: null, filled: false }]), story([photo('p1'), photo('p2')], [{ slot: 1, screenshotFileId: 's1', filled: true }, { slot: 2, screenshotFileId: 's2', filled: true }])],
    proofsLeft: [{ rowKey: 'reel', slot: 1, isStory: false }], can: { addProof: true, markPosted: false }, ...over,
  });

  it('30 · her screen, editing: the tile opens the viewer on a link fetched at that moment; "Remove" is under the file', async () => {
    const r = her(content({ rows: [reel([video]), story([photo('p1'), photo('p2')])], missing: [], can: { submit: true, upload: true } }));
    await waitFor(() => r.getByTestId('edit-row-story'));
    await waitFor(() => expect(viewerCalls(api.influencerApi.contentFileUrl, 'p2')).toBe(1));   // the thumbnail's link
    expect(r.queryByTestId('media-viewer')).toBeNull();
    fireEvent.press(r.getByTestId('file-p2'));
    await waitFor(() => r.getByTestId('viewer-photo'));
    titled(r, 'Instagram story', '2 of 2'); // ASSERTION DRIFT — shopper-walk-fixes B2: the title is two lines (the deliverable, then which file)
    expect(viewerCalls(api.influencerApi.contentFileUrl, 'p2')).toBe(2);                          // a fresh one, not the thumbnail's
    expect(api.influencerApi.contentFileUrl).toHaveBeenLastCalledWith('ci1', 'p2');
    expect(r.queryByTestId('action-sheet')).toBeNull();                                           // no "View" menu in between
    expect(r.queryByText('View')).toBeNull();
    expect(r.getByTestId('viewer-remove')).toBeTruthy();
    expect(r.queryByTestId('viewer-add-note')).toBeNull();
    expect(openURL).not.toHaveBeenCalled();
    fireEvent.press(r.getByTestId('viewer-close'));
    expect(r.queryByTestId('media-viewer')).toBeNull();
    expect(api.influencerApi.contentRemoveFile).not.toHaveBeenCalled();
  });

  it('33 · H7 · U12 · "Remove" takes the file away and closes the viewer back to the row; the brand\'s pinned note shows above it', async () => {
    api.influencerApi.contentRemoveFile.mockReturnValue(Promise.resolve({ success: true, data: {} }));
    const r = her(content({
      stage: 'changes', round: { current: 2, allowed: 2, isLast: true, used: false, stamped: true },
      rounds: [{ no: 1, verdict: 'changes', verdictAt: D(21), reason: 'Too dark.', submittedAt: D(20), rows: [], notes: [] }],
      rows: [reel([{ ...video, pinnedNote: 'Full length, please.' }]), story([photo('p1'), photo('p2')])], missing: [], can: { submit: true, upload: true },
    }));
    await waitFor(() => r.getByTestId('edit-row-reel'));
    fireEvent.press(r.getByTestId('file-v1'));
    await waitFor(() => r.getByTestId('viewer-needs-update'));           // a video, on a build without the player (31)
    titled(r, 'Instagram reel', '1 of 1'); // ASSERTION DRIFT — shopper-walk-fixes B2: the title is two lines (the deliverable, then which file)
    expect(r.getByText('Update INFLX to play videos')).toBeTruthy();
    expect(r.getByTestId('viewer-note')).toBeTruthy();
    expect(openURL).not.toHaveBeenCalled();
    fireEvent.press(r.getByTestId('viewer-remove'));
    expect(r.queryByTestId('media-viewer')).toBeNull();
    await waitFor(() => expect(api.influencerApi.contentRemoveFile).toHaveBeenCalledWith('ci1', 'v1'));
    expect(api.influencerApi.contentRemoveFile).toHaveBeenCalledTimes(1);
  });

  it('33 · her screen, once the package is with the brand: she can only look', async () => {
    const r = her(content({ stage: 'in_review', rows: [reel([{ ...video, pinnedNote: 'An old note' }]), story([photo('p1'), photo('p2')])], rounds: [{ no: 1, verdict: null, submittedAt: D(20), rows: [], notes: [] }] }));
    await waitFor(() => r.getByTestId('with-them'));
    fireEvent.press(r.getByTestId('file-p1'));
    await waitFor(() => r.getByTestId('viewer-photo'));
    titled(r, 'Instagram story', '1 of 2'); // ASSERTION DRIFT — shopper-walk-fixes B2: the title is two lines (the deliverable, then which file)
    expect(r.queryByTestId('viewer-remove')).toBeNull();
    expect(r.queryByTestId('viewer-add-note')).toBeNull();
    expect(r.queryByTestId('viewer-actions')).toBeNull();
    expect(openURL).not.toHaveBeenCalled();
  });

  it('30 · H8 · her own Story screenshots, which could not be opened at all, open the same way with nothing under them', async () => {
    const r = her(approved());
    await waitFor(() => r.getByTestId('proof-row-story'));
    fireEvent.press(r.getByTestId('file-s2'));
    await waitFor(() => r.getByTestId('viewer-photo'));
    titled(r, 'Instagram story', '2 of 2'); // ASSERTION DRIFT — shopper-walk-fixes B2: the title is two lines (the deliverable, then which file)
    expect(api.influencerApi.contentFileUrl).toHaveBeenLastCalledWith('ci1', 's2');
    expect(r.queryByTestId('viewer-actions')).toBeNull();
    fireEvent.press(r.getByTestId('viewer-prev'));
    await waitFor(() => titled(r, 'Instagram story', '1 of 2')); // ASSERTION DRIFT — shopper-walk-fixes B2: the title is two lines (the deliverable, then which file)
    expect(api.influencerApi.contentFileUrl).toHaveBeenLastCalledWith('ci1', 's1');
    expect(openURL).not.toHaveBeenCalled();
  });

  it('30 · 33 · H6 · the brand\'s Pay for Content review: the tile opens the viewer; "Add a note" opens the note box, and the note shows under the file and goes with "Ask for changes"', async () => {
    api.brandApi.contentChanges.mockReturnValue(ok(sent({ stage: 'changes' })));
    const r = brand(sent());
    await waitFor(() => r.getByTestId('review-row-story'));
    fireEvent.press(r.getByTestId('file-p1'));
    await waitFor(() => r.getByTestId('viewer-photo'));
    titled(r, 'Instagram story', '1 of 2'); // ASSERTION DRIFT — shopper-walk-fixes B2: the title is two lines (the deliverable, then which file)
    expect(api.brandApi.contentFileUrl).toHaveBeenLastCalledWith('c1', 's1', 'ci1', 'p1');
    expect(r.queryByTestId('action-sheet')).toBeNull();
    expect(r.queryByTestId('viewer-remove')).toBeNull();
    expect(r.queryByTestId('viewer-note')).toBeNull();
    expect(openURL).not.toHaveBeenCalled();

    fireEvent.press(r.getByTestId('viewer-add-note'));
    await waitFor(() => r.getByTestId('note-sheet'));
    expect(r.getByTestId('media-viewer')).toBeTruthy();                   // the note box opens over the file
    fireEvent.changeText(r.getByTestId('note-input'), 'Brighten the first 3 seconds');
    fireEvent.press(r.getByTestId('note-save'));
    await waitFor(() => expect(r.queryByTestId('note-sheet')).toBeNull());
    expect(r.getByTestId('viewer-note')).toBeTruthy();
    expect(r.getAllByText('Brighten the first 3 seconds').length).toBeGreaterThanOrEqual(1);

    fireEvent.press(r.getByTestId('viewer-close'));
    expect(r.queryByTestId('media-viewer')).toBeNull();
    expect(r.getByTestId('note-dot')).toBeTruthy();                       // the row still marks the file, as before
    fireEvent.press(r.getByTestId('ask-changes'));
    await waitFor(() => r.getByTestId('changes-sheet'));
    fireEvent.changeText(r.getByTestId('changes-reason'), 'See the note.');
    fireEvent.press(r.getByTestId('changes-send'));
    await waitFor(() => expect(api.brandApi.contentChanges).toHaveBeenCalledTimes(1));
    expect(api.brandApi.contentChanges.mock.calls[0][3]).toEqual({ round: 1, reason: 'See the note.', notes: [{ fileId: 'p1', note: 'Brighten the first 3 seconds' }] });
  });

  it('33 · no "Add a note" once the brand can no longer ask for changes (rounds used)', async () => {
    const r = brand(sent({
      round: { current: 3, allowed: 2, isLast: false, used: true, stamped: true },
      rounds: [{ no: 1, verdict: 'changes', verdictAt: D(21), reason: 'too dark' }, { no: 2, verdict: 'changes', verdictAt: D(24), reason: 'still not full length' }, { no: 3, verdict: null, submittedAt: D(25) }],
      can: { approve: true, askChanges: false, reportRoundsUsed: true },
    }));
    await waitFor(() => r.getByText('ROUNDS USED'));
    fireEvent.press(r.getByTestId('file-p1'));
    await waitFor(() => r.getByTestId('viewer-photo'));
    expect(r.queryByTestId('viewer-add-note')).toBeNull();
    expect(r.queryByTestId('viewer-remove')).toBeNull();
    expect(openURL).not.toHaveBeenCalled();
  });

  it('30 · the Story screenshots the brand sees open in the viewer, read-only; her Instagram link still opens outside the app', async () => {
    const r = brand(content({
      stage: 'posted', postedAt: D(23),
      rows: [reel([video], [{ slot: 1, url: 'https://www.instagram.com/reel/C8xK2', filled: true }]), story([], [{ slot: 1, screenshotFileId: 's1', filled: true }, { slot: 2, screenshotFileId: 's2', filled: true }])],
      can: { confirmLive: true, reportPostedWrong: true, askChanges: true },
    }));
    await waitFor(() => r.getByTestId('posted-row-story'));
    fireEvent.press(r.getByTestId('file-s1'));
    await waitFor(() => r.getByTestId('viewer-photo'));
    titled(r, 'Instagram story', '1 of 2'); // ASSERTION DRIFT — shopper-walk-fixes B2: the title is two lines (the deliverable, then which file)
    expect(api.brandApi.contentFileUrl).toHaveBeenLastCalledWith('c1', 's1', 'ci1', 's1');
    expect(r.queryByTestId('viewer-actions')).toBeNull();                 // a proof is not a file under review
    expect(openURL).not.toHaveBeenCalled();
    fireEvent.press(r.getByTestId('viewer-close'));
    fireEvent.press(r.getByTestId('link-reel-1'));
    expect(openURL).toHaveBeenCalledWith('https://www.instagram.com/reel/C8xK2');
  });

  it('31 · on an app build WITH the player, the tile plays the video inside the app', async () => {
    const React2 = require('react');
    const { View } = require('react-native');
    let given = null;
    _setPlayerForTests(React2.forwardRef((props, ref) => { given = props; React2.useImperativeHandle(ref, () => ({ seek: jest.fn() })); return <View testID={props.testID} />; }));
    const r = brand(sent());
    await waitFor(() => r.getByTestId('review-row-reel'));
    fireEvent.press(r.getByTestId('file-v1'));
    await waitFor(() => r.getByTestId('viewer-video'));
    expect(given.source).toEqual({ uri: 'https://x/y' });
    expect(given.controls).toBe(true);
    expect(given.bufferConfig).toBeUndefined();
    expect(r.queryByTestId('viewer-needs-update')).toBeNull();
    expect(openURL).not.toHaveBeenCalled();
  });

  it('H6 · the brand\'s video waits while the note box is open over it, and plays on when the box closes — saved or not', async () => {
    const React2 = require('react');
    const { View } = require('react-native');
    let given = null;
    _setPlayerForTests(React2.forwardRef((props, ref) => { given = props; React2.useImperativeHandle(ref, () => ({ seek: jest.fn() })); return <View testID={props.testID} />; }));
    const r = brand(sent());
    await waitFor(() => r.getByTestId('review-row-reel'));
    fireEvent.press(r.getByTestId('file-v1'));
    await waitFor(() => r.getByTestId('viewer-video'));
    expect(given.paused).toBe(false);                                     // it plays

    fireEvent.press(r.getByTestId('viewer-add-note'));
    await waitFor(() => r.getByTestId('note-sheet'));
    expect(r.getByTestId('viewer-video')).toBeTruthy();                   // still there, under the box
    expect(given.paused).toBe(true);                                      // no sound running under what she is typing
    fireEvent.press(r.getByTestId('note-back'));                          // she backs out without a note
    await waitFor(() => expect(r.queryByTestId('note-sheet')).toBeNull());
    expect(given.paused).toBe(false);
    expect(r.queryByTestId('viewer-note')).toBeNull();

    fireEvent.press(r.getByTestId('viewer-add-note'));
    await waitFor(() => r.getByTestId('note-sheet'));
    expect(given.paused).toBe(true);
    fireEvent.changeText(r.getByTestId('note-input'), 'Brighten the first 3 seconds');
    fireEvent.press(r.getByTestId('note-save'));
    await waitFor(() => expect(r.queryByTestId('note-sheet')).toBeNull());
    expect(given.paused).toBe(false);
    expect(r.getByTestId('viewer-note')).toBeTruthy();                    // and her note is under the video
    expect(r.getByTestId('viewer-video')).toBeTruthy();
  });
});

/* ───────────────────────────── ui-walk-fixes · board J · a pasted link turns the button on
 * Contract: features/ui-walk-fixes · checks 34–37 · frames J1–J5 · decisions U13, D5
 * (the box and the line of saves themselves: components/content/__tests__/linkBox12.test.js) */

describe('ui-walk-fixes J · her content screen: a link saves by itself, and "I\'ve posted everything" finishes the saving', () => {
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

  const IG = 'https://www.instagram.com/reel/C8xK2';
  const IG2 = 'https://www.instagram.com/reel/D4pQ9';
  const slot = (n, url = null) => ({ slot: n, url, screenshotFileId: null, filled: !!url });
  /** Approved, owing `links.length` reel links (null = not saved yet) and, optionally, Story screenshots. */
  const owing = (links, shots = null) => {
    const reelRow = { ...reel([video], links.map((u, i) => slot(i + 1, u))), count: links.length };
    const rows = [reelRow];
    const left = links.map((u, i) => (u ? null : { rowKey: 'reel', slot: i + 1, isStory: false })).filter(Boolean);
    if (shots) {
      rows.push({ ...story([photo('p1')], shots.map((id, i) => ({ slot: i + 1, url: null, screenshotFileId: id, filled: !!id }))), count: shots.length });
      shots.forEach((id, i) => { if (!id) left.push({ rowKey: 'story', slot: i + 1, isStory: true }); });
    }
    return content({ stage: 'approved', approvedAt: D(22), rows, proofsLeft: left, can: { addProof: true, markPosted: left.length === 0 } });
  };
  const refusal = { success: false, error: { code: 'LINK_INVALID', message: 'Paste the full link to the post.', field: 'url' } };
  const pending = () => { let resolve; const promise = new Promise((x) => { resolve = x; }); return { promise, resolve }; };
  /** Let every answer that has arrived be applied (the saves run on promises, not timers). */
  const settle = () => act(async () => { for (let i = 0; i < 25; i += 1) await Promise.resolve(); });   // eslint-disable-line no-await-in-loop
  const type = (box, text, from = '') => { for (let i = from.length + 1; i <= text.length; i += 1) fireEvent.changeText(box, text.slice(0, i)); };
  const off = (r) => r.getByTestId('posted').props.accessibilityState.disabled;

  it('J1 · nothing pasted: the empty box, a grey button and the counting line — as the locked board', async () => {
    const r = her(owing([null]));
    await waitFor(() => r.getByTestId('approved-box'));
    expect(r.getByTestId('link-reel:1').props.value).toBe('');
    expect(r.getByTestId('link-reel:1').props.placeholder).toBe('Paste the link');
    expect(r.queryByTestId('link-reel:1-saving')).toBeNull();
    expect(r.queryByTestId('link-reel:1-saved')).toBeNull();
    expect(off(r)).toBe(true);
    expect(r.getByTestId('to-go').props.children).toBe('1 link to go.');
    expect(r.queryByText('Save')).toBeNull();
    expect(api.influencerApi.contentSetProof).not.toHaveBeenCalled();
  });

  it('34 · J2 → J3 · a paste is sent at once, without leaving the box: "Saving…", the button on, then the tick', async () => {
    const save = pending();
    api.influencerApi.contentSetProof.mockReturnValue(save.promise);
    const r = her(owing([null]));
    await waitFor(() => r.getByTestId('approved-box'));

    fireEvent.changeText(r.getByTestId('link-reel:1'), IG);                // the text jumps in one change
    expect(api.influencerApi.contentSetProof).toHaveBeenCalledTimes(1);     // no blur, no Done key, no wait
    expect(api.influencerApi.contentSetProof).toHaveBeenCalledWith('ci1', 'reel', 1, { url: IG });
    expect(r.getByTestId('link-reel:1').props.value).toBe(IG);
    expect(r.getByTestId('link-reel:1-saving').props.children).toBe('Saving…');
    expect(r.queryByTestId('link-reel:1-saved')).toBeNull();
    expect(r.getByText('0 of 1')).toBeTruthy();                             // the count is INFLX's, not the phone's
    expect(off(r)).toBe(false);                                             // J2: already yellow
    expect(r.getByTestId('to-go').props.children).toBe('Saving your link…');

    await act(async () => { save.resolve({ success: true, data: { content: owing([IG]) } }); });
    await settle();
    expect(r.queryByTestId('link-reel:1-saving')).toBeNull();
    expect(r.getByTestId('link-reel:1-saved')).toBeTruthy();                // J3: the tick beside the box
    // ASSERTION DRIFT (drift/C1c.md): the short form is DRAWN over the box, it is no longer the
    // box's own text — that text stays the real link, so a stray edit can never save the short form.
    expect(r.getByTestId('link-reel:1-short').props.children).toBe('instagram.com/reel/C8xK2');
    expect(r.getByTestId('link-reel:1').props.value).toBe(IG);
    expect(r.getByText('1 of 1')).toBeTruthy();
    expect(off(r)).toBe(false);
    expect(r.queryByTestId('to-go')).toBeNull();                            // the line under the button goes away

    // Leaving the box and the Done key afterwards send nothing more: INFLX has exactly this.
    fireEvent(r.getByTestId('link-reel:1'), 'submitEditing');
    fireEvent(r.getByTestId('link-reel:1'), 'endEditing');
    fireEvent(r.getByTestId('link-reel:1'), 'blur');
    await settle();
    expect(api.influencerApi.contentSetProof).toHaveBeenCalledTimes(1);
    // In the box again she sees, and edits, the whole link — never the short form.
    fireEvent(r.getByTestId('link-reel:1'), 'focus');
    expect(r.getByTestId('link-reel:1').props.value).toBe(IG);
  });

  it('typing by hand: nothing is sent until she has stopped for 0.7 s; the Done key and leaving the box send at once', async () => {
    api.influencerApi.contentSetProof.mockImplementation((ci, rowKey, n, body) => ok(owing([body.url])));
    const r = her(owing([null]));
    await waitFor(() => r.getByTestId('approved-box'));
    const box = () => r.getByTestId('link-reel:1');

    type(box(), IG);
    expect(api.influencerApi.contentSetProof).not.toHaveBeenCalled();
    expect(off(r)).toBe(false);                                             // the box has text: the button is on
    expect(r.getByTestId('to-go').props.children).toBe('Saving your link…');
    act(() => { jest.advanceTimersByTime(699); });
    expect(api.influencerApi.contentSetProof).not.toHaveBeenCalled();
    act(() => { jest.advanceTimersByTime(1); });
    expect(api.influencerApi.contentSetProof).toHaveBeenCalledTimes(1);
    expect(api.influencerApi.contentSetProof).toHaveBeenLastCalledWith('ci1', 'reel', 1, { url: IG });
    await settle();
    expect(r.getByTestId('link-reel:1-saved')).toBeTruthy();

    // One more character, then the keypad's Done key — wired, not left to the box losing focus.
    fireEvent(box(), 'focus');
    fireEvent.changeText(box(), `${IG}x`);
    fireEvent(box(), 'submitEditing');
    expect(api.influencerApi.contentSetProof).toHaveBeenCalledTimes(2);
    expect(api.influencerApi.contentSetProof).toHaveBeenLastCalledWith('ci1', 'reel', 1, { url: `${IG}x` });
    await settle();
    act(() => { jest.advanceTimersByTime(2000); });                         // the pause it replaced never fires a second save
    expect(api.influencerApi.contentSetProof).toHaveBeenCalledTimes(2);

    // And leaving the box.
    fireEvent.changeText(box(), `${IG}xy`);
    fireEvent(box(), 'blur');
    fireEvent(box(), 'endEditing');                                         // Android sends both: still one save
    expect(api.influencerApi.contentSetProof).toHaveBeenCalledTimes(3);
    expect(api.influencerApi.contentSetProof).toHaveBeenLastCalledWith('ci1', 'reel', 1, { url: `${IG}xy` });
    await settle();
    expect(api.influencerApi.contentSetProof).toHaveBeenCalledTimes(3);
  });

  it('D5 · a link without "https://" in front gets it before it is sent; an emptied box clears the link', async () => {
    api.influencerApi.contentSetProof.mockImplementation((ci, rowKey, n, body) => ok(owing([body.url])));
    api.influencerApi.contentClearProof.mockReturnValue(ok(owing([null])));
    const r = her(owing([null]));
    await waitFor(() => r.getByTestId('approved-box'));
    fireEvent.changeText(r.getByTestId('link-reel:1'), '  instagram.com/reel/C8xK2 ');
    expect(api.influencerApi.contentSetProof).toHaveBeenCalledWith('ci1', 'reel', 1, { url: 'https://instagram.com/reel/C8xK2' });
    await settle();
    expect(r.getByTestId('link-reel:1-saved')).toBeTruthy();
    // ASSERTION DRIFT (drift/C1c.md): the short form is drawn over the box; the box holds the link.
    expect(r.getByTestId('link-reel:1-short').props.children).toBe('instagram.com/reel/C8xK2');
    expect(r.getByTestId('link-reel:1').props.value).toBe('https://instagram.com/reel/C8xK2');

    fireEvent(r.getByTestId('link-reel:1'), 'focus');
    fireEvent.changeText(r.getByTestId('link-reel:1'), '');
    expect(off(r)).toBe(true);                                              // an empty box is a link still to come
    expect(r.getByTestId('to-go').props.children).toBe('1 link to go.');
    fireEvent(r.getByTestId('link-reel:1'), 'blur');
    await settle();
    expect(api.influencerApi.contentClearProof).toHaveBeenCalledWith('ci1', 'reel', 1);
    expect(api.influencerApi.contentSetProof).toHaveBeenCalledTimes(1);
    expect(r.queryByTestId('link-reel:1-saved')).toBeNull();
  });

  it('34 · J4 · a refused link: the red line under the box, a grey button, and the line that points at it', async () => {
    api.influencerApi.contentSetProof.mockReturnValue(Promise.resolve(refusal));
    const r = her(owing([null]));
    await waitFor(() => r.getByTestId('approved-box'));
    fireEvent.changeText(r.getByTestId('link-reel:1'), 'https://youtu.be/dQ7vL2');
    await settle();
    expect(r.getByText('Paste the full link to the post.')).toBeTruthy();
    expect(r.getByTestId('link-reel:1').props.value).toBe('https://youtu.be/dQ7vL2');   // her text stays for her to fix
    expect(r.queryByTestId('link-reel:1-saved')).toBeNull();
    expect(r.getByText('0 of 1')).toBeTruthy();
    expect(off(r)).toBe(true);
    expect(r.getByTestId('to-go').props.children).toBe('One link needs fixing — see above.');

    // Leaving the box does not ask INFLX the same thing again.
    fireEvent(r.getByTestId('link-reel:1'), 'blur');
    await settle();
    expect(api.influencerApi.contentSetProof).toHaveBeenCalledTimes(1);
    expect(r.getByText('Paste the full link to the post.')).toBeTruthy();

    // While she is typing the fix the red line waits; a good link then saves and ticks.
    api.influencerApi.contentSetProof.mockImplementation((ci, rowKey, n, body) => ok(owing([body.url])));
    fireEvent.changeText(r.getByTestId('link-reel:1'), 'https://youtu.be/dQ7vL');
    expect(r.queryByText('Paste the full link to the post.')).toBeNull();
    expect(off(r)).toBe(false);
    fireEvent.changeText(r.getByTestId('link-reel:1'), '');
    fireEvent.changeText(r.getByTestId('link-reel:1'), IG);
    await settle();
    expect(r.queryByText('Paste the full link to the post.')).toBeNull();
    expect(r.getByTestId('link-reel:1-saved')).toBeTruthy();
    expect(off(r)).toBe(false);
    expect(r.queryByTestId('to-go')).toBeNull();
  });

  it('a refusal that arrives while she is still typing is held back — the answer to what is in the box now is the one shown', async () => {
    const first = pending();
    api.influencerApi.contentSetProof.mockReturnValueOnce(first.promise);
    api.influencerApi.contentSetProof.mockImplementation((ci, rowKey, n, body) => ok(owing([body.url])));
    const r = her(owing([null]));
    await waitFor(() => r.getByTestId('approved-box'));
    fireEvent.changeText(r.getByTestId('link-reel:1'), 'https://www.instagram.co');     // pasted half a link
    fireEvent.changeText(r.getByTestId('link-reel:1'), 'https://www.instagram.com');    // … and typing on
    await act(async () => { first.resolve(refusal); });
    await settle();
    expect(r.queryByText('Paste the full link to the post.')).toBeNull();
    expect(r.getByTestId('link-reel:1').props.value).toBe('https://www.instagram.com'); // nothing she typed is eaten
    fireEvent.changeText(r.getByTestId('link-reel:1'), '');
    fireEvent.changeText(r.getByTestId('link-reel:1'), IG);
    await settle();
    expect(api.influencerApi.contentSetProof).toHaveBeenLastCalledWith('ci1', 'reel', 1, { url: IG });
    expect(r.getByTestId('link-reel:1-saved')).toBeTruthy();
  });

  it('35 · pressing the button with a link not saved yet: the keypad closes, the link is saved, and only then is it marked posted', async () => {
    const save = pending();
    const order = [];
    api.influencerApi.contentSetProof.mockImplementation(() => { order.push('link'); return save.promise; });
    api.influencerApi.contentPosted.mockImplementation(() => { order.push('posted'); return ok(content({ stage: 'posted', postedAt: D(23), reportFrom: D(30), can: {} })); });
    const r = her(owing([null]));
    await waitFor(() => r.getByTestId('approved-box'));
    type(r.getByTestId('link-reel:1'), IG);                                 // typed, the 0.7 s not yet over
    expect(order).toEqual([]);

    fireEvent.press(r.getByTestId('posted'));
    expect(dismiss).toHaveBeenCalledTimes(1);
    expect(order).toEqual(['link']);                                        // saved first …
    await settle();
    expect(api.influencerApi.contentPosted).not.toHaveBeenCalled();         // … and nothing is posted before INFLX answers
    fireEvent.press(r.getByTestId('posted'));                               // a second tap while it works does nothing
    expect(order).toEqual(['link']);

    await act(async () => { save.resolve({ success: true, data: { content: owing([IG]) } }); });
    await waitFor(() => r.getByTestId('waiting-confirm'));
    expect(order).toEqual(['link', 'posted']);
    expect(api.influencerApi.contentPosted).toHaveBeenCalledWith('ci1');
    expect(api.influencerApi.contentPosted).toHaveBeenCalledTimes(1);
    act(() => { jest.advanceTimersByTime(2000); });
    expect(api.influencerApi.contentSetProof).toHaveBeenCalledTimes(1);     // the pause she cut short does not save again
  });

  it('35 · J4 · pressed with a link INFLX then refuses: it stops there — the red line on that row, nothing marked posted', async () => {
    api.influencerApi.contentSetProof.mockReturnValue(Promise.resolve(refusal));
    const r = her(owing([null]));
    await waitFor(() => r.getByTestId('approved-box'));
    type(r.getByTestId('link-reel:1'), 'https://youtu.be/dQ7vL2');
    fireEvent.press(r.getByTestId('posted'));
    await settle();
    expect(api.influencerApi.contentSetProof).toHaveBeenCalledTimes(1);
    expect(api.influencerApi.contentPosted).not.toHaveBeenCalled();
    expect(r.getByText('Paste the full link to the post.')).toBeTruthy();
    expect(off(r)).toBe(true);
    expect(r.getByTestId('to-go').props.children).toBe('One link needs fixing — see above.');
    expect(r.getByText("I've posted everything")).toBeTruthy();             // not left reading "Sending"
  });

  it('a save that never reached INFLX is not a refusal: the button stays on, and pressing it tries the link again', async () => {
    api.influencerApi.contentSetProof.mockReturnValueOnce(Promise.resolve({ success: false, error: { code: 'NETWORK_ERROR', message: 'Cannot connect to server. Check your connection.' } }));
    api.influencerApi.contentSetProof.mockImplementation((ci, rowKey, n, body) => ok(owing([body.url])));
    api.influencerApi.contentPosted.mockReturnValue(ok(content({ stage: 'posted', postedAt: D(23), reportFrom: D(30), can: {} })));
    const r = her(owing([null]));
    await waitFor(() => r.getByTestId('approved-box'));
    fireEvent.changeText(r.getByTestId('link-reel:1'), IG);
    await settle();
    expect(r.getByText('Cannot connect to server. Check your connection.')).toBeTruthy();
    expect(r.getByTestId('link-reel:1').props.value).toBe(IG);
    expect(r.queryByTestId('link-reel:1-saved')).toBeNull();
    expect(off(r)).toBe(false);
    fireEvent.press(r.getByTestId('posted'));
    await waitFor(() => r.getByTestId('waiting-confirm'));
    expect(api.influencerApi.contentSetProof).toHaveBeenCalledTimes(2);
    expect(api.influencerApi.contentPosted).toHaveBeenCalledTimes(1);
  });

  it('36 · two boxes pasted one after the other: saved one at a time and in order, and an answer that knows only the first never empties the second', async () => {
    const a = pending();
    const b = pending();
    api.influencerApi.contentSetProof.mockReturnValueOnce(a.promise).mockReturnValueOnce(b.promise);
    const r = her(owing([null, null]));
    await waitFor(() => r.getByTestId('approved-box'));
    fireEvent.changeText(r.getByTestId('link-reel:1'), IG);
    fireEvent.changeText(r.getByTestId('link-reel:2'), IG2);
    await settle();
    expect(api.influencerApi.contentSetProof).toHaveBeenCalledTimes(1);     // the second waits its turn
    expect(r.getByTestId('link-reel:1-saving')).toBeTruthy();
    expect(r.getByTestId('link-reel:2-saving')).toBeTruthy();
    expect(off(r)).toBe(false);                                             // both boxes have text

    // The first answer was read before the second link existed on the server.
    await act(async () => { a.resolve({ success: true, data: { content: owing([IG, null]) } }); });
    await settle();
    expect(r.getByTestId('link-reel:1-saved')).toBeTruthy();
    expect(r.getByTestId('link-reel:2').props.value).toBe(IG2);             // still filled
    expect(r.getByTestId('link-reel:2-saving')).toBeTruthy();
    expect(off(r)).toBe(false);
    expect(r.getByTestId('to-go').props.children).toBe('Saving your link…');
    expect(api.influencerApi.contentSetProof).toHaveBeenCalledTimes(2);
    expect(api.influencerApi.contentSetProof).toHaveBeenLastCalledWith('ci1', 'reel', 2, { url: IG2 });

    await act(async () => { b.resolve({ success: true, data: { content: owing([IG, IG2]) } }); });
    await settle();
    expect(r.getByTestId('link-reel:1-saved')).toBeTruthy();
    expect(r.getByTestId('link-reel:2-saved')).toBeTruthy();
    // ASSERTION DRIFT (drift/C1c.md): the short form is drawn over each box; the box holds the link.
    expect(r.getByTestId('link-reel:1-short').props.children).toBe('instagram.com/reel/C8xK2');
    expect(r.getByTestId('link-reel:2-short').props.children).toBe('instagram.com/reel/D4pQ9');
    expect(r.getByTestId('link-reel:1').props.value).toBe(IG);
    expect(r.getByTestId('link-reel:2').props.value).toBe(IG2);
    expect(r.getByText('2 of 2')).toBeTruthy();
    expect(r.queryByTestId('to-go')).toBeNull();
  });

  it('J5 · U13 · two reels and a Story owed: the line counts what is left, and the button waits for the Story\'s screenshot', async () => {
    const r = her(owing([IG, null], [null]));
    await waitFor(() => r.getByTestId('approved-box'));
    expect(r.getByTestId('link-reel:1-saved')).toBeTruthy();
    expect(r.queryByTestId('link-reel:2-saved')).toBeNull();
    expect(r.getByText('1 of 2')).toBeTruthy();
    expect(r.getByTestId('to-go').props.children).toBe('1 link and 1 screenshot to go.');
    expect(off(r)).toBe(true);

    // "… to go." comes before "needs fixing", which comes before "Saving your link…".
    api.influencerApi.contentSetProof.mockReturnValue(Promise.resolve(refusal));
    fireEvent.changeText(r.getByTestId('link-reel:2'), 'https://youtu.be/dQ7vL2');
    await settle();
    expect(r.getByText('Paste the full link to the post.')).toBeTruthy();
    expect(r.getByTestId('to-go').props.children).toBe('1 screenshot to go.');
    expect(off(r)).toBe(true);
    expect(r.getByTestId('add-shot-story')).toBeTruthy();                   // the Story row is as it was
  });

  it('leaving the screen inside the 0.7 s: the link she typed is still sent', async () => {
    api.influencerApi.contentSetProof.mockReturnValue(ok(owing([IG])));
    const r = her(owing([null]));
    await waitFor(() => r.getByTestId('approved-box'));
    type(r.getByTestId('link-reel:1'), 'instagram.com/reel/C8xK2');
    expect(api.influencerApi.contentSetProof).not.toHaveBeenCalled();
    r.unmount();
    expect(api.influencerApi.contentSetProof).toHaveBeenCalledTimes(1);
    expect(api.influencerApi.contentSetProof).toHaveBeenCalledWith('ci1', 'reel', 1, { url: 'https://instagram.com/reel/C8xK2' });
    await settle();
  });

  /* ── captions (check 37) ── */

  const full = (over = {}) => content({ rows: [reel([video]), story([photo('p1'), photo('p2')])], missing: [], can: { submit: true, upload: true }, ...over });

  it('37 · a caption typed just before "Send": it is saved first, and the sheet opens once INFLX has it', async () => {
    const save = pending();
    api.influencerApi.contentCaption.mockReturnValue(save.promise);
    const r = her(full());
    await waitFor(() => r.getByTestId('send'));
    fireEvent.changeText(r.getByTestId('caption-reel'), 'Festive drop, out now.');
    act(() => { jest.advanceTimersByTime(5000); });
    expect(api.influencerApi.contentCaption).not.toHaveBeenCalled();        // a caption never saves on a pause (as before)

    fireEvent.press(r.getByTestId('send'));                                 // she never left the caption box
    expect(dismiss).toHaveBeenCalledTimes(1);
    expect(api.influencerApi.contentCaption).toHaveBeenCalledTimes(1);
    expect(api.influencerApi.contentCaption).toHaveBeenCalledWith('ci1', 'reel', 'Festive drop, out now.');
    await settle();
    expect(r.queryByTestId('send-sheet')).toBeNull();                       // not before the caption is in

    const saved = full();
    saved.rows[0].caption = 'Festive drop, out now.';
    await act(async () => { save.resolve({ success: true, data: { content: saved } }); });
    await waitFor(() => r.getByTestId('send-sheet'));
    expect(r.getByTestId('caption-reel').props.value).toBe('Festive drop, out now.');
    expect(api.influencerApi.contentSubmit).not.toHaveBeenCalled();
  });

  it('37 · a caption INFLX refuses: the red line on its row, and the Send sheet does not open', async () => {
    api.influencerApi.contentCaption.mockReturnValue(Promise.resolve({ success: false, error: { code: 'CAPTION_TOO_LONG', message: 'Keep it under 500 characters.', field: 'caption' } }));
    const r = her(full());
    await waitFor(() => r.getByTestId('send'));
    fireEvent.changeText(r.getByTestId('caption-reel'), 'x'.repeat(501));
    fireEvent.press(r.getByTestId('send'));
    await settle();
    expect(r.getByText('Keep it under 500 characters.')).toBeTruthy();
    expect(r.queryByTestId('send-sheet')).toBeNull();
    expect(r.getByTestId('caption-reel').props.value).toHaveLength(501);    // her words stay for her to cut
    fireEvent.press(r.getByTestId('send'));                                 // again, unchanged: still shut, and not asked twice
    await settle();
    expect(r.queryByTestId('send-sheet')).toBeNull();
    expect(api.influencerApi.contentCaption).toHaveBeenCalledTimes(1);
  });

  it('a caption still saves when she leaves its box, and one she did not change sends nothing', async () => {
    const saved = full();
    saved.rows[0].caption = 'New words.';
    api.influencerApi.contentCaption.mockReturnValue(ok(saved));
    const r = her(full());
    await waitFor(() => r.getByTestId('send'));
    fireEvent(r.getByTestId('caption-reel'), 'endEditing');                 // in and out without typing
    fireEvent.changeText(r.getByTestId('caption-reel'), 'Diwali in the new linen co-ord');
    fireEvent.changeText(r.getByTestId('caption-reel'), 'Diwali in the new linen co-ord.');   // back to what INFLX has
    fireEvent(r.getByTestId('caption-reel'), 'endEditing');
    await settle();
    expect(api.influencerApi.contentCaption).not.toHaveBeenCalled();
    fireEvent.changeText(r.getByTestId('caption-reel'), 'New words.');
    fireEvent(r.getByTestId('caption-reel'), 'endEditing');
    expect(api.influencerApi.contentCaption).toHaveBeenCalledWith('ci1', 'reel', 'New words.');
    await settle();
    expect(r.getByTestId('caption-reel').props.value).toBe('New words.');
    fireEvent.press(r.getByTestId('send'));                                 // nothing left to save: the sheet opens
    await waitFor(() => r.getByTestId('send-sheet'));
    expect(api.influencerApi.contentCaption).toHaveBeenCalledTimes(1);
  });
});
