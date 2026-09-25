/**
 * Item 12 — the content pieces, and the copy held word for word against the server.
 * Contract: features/item12-content · checks 3, 27, 28, 30
 */
import React from 'react';
import { render } from '@testing-library/react-native';
import { FeeCard12, CountChip12, RoundPill12, FileTile12, QuoteBox12, History12, Record12 } from '../bits12';
import { C12, MSG12, duration12 } from '../copy12';

describe('the copy is the server\'s, word for word', () => {
  const server = require('../../../../../../backend/src/services/contentCopy').MSG;
  it('every sentence the app shows for a refusal is the server\'s own', () => {
    for (const k of Object.keys(MSG12)) {
      const mine = MSG12[k]; const theirs = server[k];
      expect(`${k}: ${typeof theirs}`).toBe(`${k}: ${typeof mine}`);
      if (typeof mine === 'function') {
        expect(mine('Urban Threads')).toBe(theirs('Urban Threads'));
        expect(mine(2)).toBe(theirs(2));
        expect(mine(3)).toBe(theirs(3));
      } else expect(mine).toBe(theirs);
    }
  });
  it('the rounds wording (Q8)', () => {
    expect(MSG12.ROUNDS_USED(2)).toBe("You've used both rounds. Approve this, or report it to INFLX.");
    expect(MSG12.ROUNDS_USED(3)).toBe("You've used all 3 rounds. Approve this, or report it to INFLX.");
    expect(C12.roundsInfo(2)).toBe('You have 2 rounds. After this one you can approve it or report it to INFLX.');
    expect(C12.roundsUsed(2)).toBe("You've used both rounds. There is no third — approve what she sent, or report it to INFLX.");
  });
  it('the mockups\' sentences', () => {
    expect(C12.nothingYetBody([{ type: 'reel', count: 2 }, { type: 'post', count: 1 }, { type: 'story', count: 2 }]))
      .toBe('Add the 2 reels, 1 post and 2 stories you agreed. Photos up to 10 MB, videos up to 200 MB.');
    expect(C12.moreToAdd([{ key: 'story', short: 1 }])).toBe('1 more story to add.');
    expect(C12.toGo(3, 2)).toBe('3 links and 2 screenshots to go.');
    expect(C12.confirmReleasesSub(12000, 6000, 7)).toBe('The second 25% of her ₹12,000 fee. The last ₹6,000 follows 7 days later.');
    expect(C12.fee.campaignFeeWaiting(960)).toBe('INFLX campaign fee ₹960 · charged to you at signing, never to her.');
    expect(C12.reportedBrand('2026-10-25T06:00:00Z', 9000)).toBe('You reported this on 25 Oct. INFLX has it. ₹9,000 of her fee stays in escrow until it is settled.');
    expect(duration12(28)).toBe('0:28');
    expect(duration12(95)).toBe('1:35');
  });
});

const money = (over = {}) => ({
  fee: 12000, waitDays: 7, stillLocked: 9000, campaignFee: 960,
  t1: { amount: 3000, paidAt: '2026-09-14T06:00:00Z', status: 'released' },
  t2: { amount: 3000, paidAt: null, status: 'locked' },
  t3: { amount: 6000, paidAt: null, status: 'locked' },
  ...over,
});

describe('the fee card (30)', () => {
  it('her fee alone: 3,000 / 3,000 / 6,000, paid · next · later; the campaign fee only on the brand\'s card', () => {
    const b = render(<FeeCard12 money={money()} side="brand" />);
    expect(b.getByText('Her fee · ₹12,000')).toBeTruthy();
    expect(b.getByTestId('fee-t1-paid')).toBeTruthy();
    expect(b.getByTestId('fee-t2-next')).toBeTruthy();
    expect(b.getByTestId('fee-t3-later')).toBeTruthy();
    expect(b.getAllByText('₹3,000')).toHaveLength(2);
    expect(b.getByText('₹6,000')).toBeTruthy();
    expect(b.getByTestId('campaign-fee-line')).toBeTruthy();
    const h = render(<FeeCard12 money={{ ...money(), campaignFee: undefined }} side="creator" />);
    expect(h.queryByTestId('campaign-fee-line')).toBeNull();
    expect(h.queryByText(/960/)).toBeNull();
  });
});

describe('the pieces', () => {
  it('counts turn green when met', () => {
    expect(render(<CountChip12 have={1} need={2} />).getByTestId('count-short')).toBeTruthy();
    expect(render(<CountChip12 have={2} need={2} />).getByTestId('count-met')).toBeTruthy();
  });
  it('the round pill: ROUND 1 OF 2, · LAST, ROUNDS USED', () => {
    expect(render(<RoundPill12 round={{ current: 1, allowed: 2 }} />).getByText('ROUND 1 OF 2')).toBeTruthy();
    expect(render(<RoundPill12 round={{ current: 2, allowed: 2, isLast: true }} />).getByText('ROUND 2 OF 2 · LAST')).toBeTruthy();
    expect(render(<RoundPill12 round={{ current: 3, allowed: 2, used: true }} />).getByText('ROUNDS USED')).toBeTruthy();
  });
  it('a video tile carries its duration badge; an upload in flight its percentage', () => {
    const v = render(<FileTile12 file={{ id: 'f1', kind: 'video', durationS: 28 }} />);
    expect(v.getByText('0:28')).toBeTruthy();
    expect(render(<FileTile12 progress={0.42} />).getByText('42%')).toBeTruthy();
  });
  it('the quoted reason, the history, the record', () => {
    expect(render(<QuoteBox12 text="Too dark at the end." />).getByText('"Too dark at the end."')).toBeTruthy();
    const h = render(<History12 rounds={[{ no: 1, verdict: 'changes', verdictAt: '2026-10-21T06:00:00Z', reason: 'too dark at the end' }, { no: 2, verdict: null }]} />);
    expect(h.getByText('Round 1 · 21 Oct — "too dark at the end"')).toBeTruthy();
    const r = render(<Record12 c={{ mode: 'visit', shootDoneAt: '2026-10-19T06:00:00Z', approvedAt: '2026-10-22T06:00:00Z', changesAsked: 1, postedAt: '2026-10-23T06:00:00Z', proofCount: 5, liveConfirmedAt: '2026-10-23T08:00:00Z', completedAt: '2026-10-30T06:00:00Z' }} />);
    expect(r.getByText('Visited 19 Oct')).toBeTruthy();
    expect(r.getByText('22 Oct · 1 round of changes')).toBeTruthy();
    expect(r.getByText('23 Oct · 5 links')).toBeTruthy();
  });
});
