/**
 * Item 6 — the Brand app: N7 the thread and Accept, N8 the counter back with its last-counter
 * label and the minimum warning, N9 the decline, N10/N11 a request to move and the confirm that
 * spells it out, N13 the pool row, N14 the pool, N18 the switch, N20 the set's groups, N21 the
 * endings.
 * Contract: features/item6-negotiation
 */
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';

jest.mock('../../../services/api', () => ({
  brandApi: {
    setSummary: jest.fn(), campaignsSummary: jest.fn(), campaignSummary: jest.fn(), createCampaign: jest.fn(), updateCampaign: jest.fn(),
    brandThread: jest.fn(), brandAcceptCounter: jest.fn(), brandCounter: jest.fn(), brandDeclineCounter: jest.fn(), answerMoveRequest: jest.fn(),
    getPool: jest.fn(), poolSetDefaults: jest.fn(), removeFromPool: jest.fn(),
    invitationDetail: jest.fn(), withdrawInvitation: jest.fn(), removeInvitation: jest.fn(),
    updateCampaignSet: jest.fn(), deleteCampaignSet: jest.fn(), duplicateSet: jest.fn(), listBranches: jest.fn(),
  },
  influencerApi: {}, referenceApi: {}, clearSession: jest.fn(), uploadFile: jest.fn(),
}));
jest.mock('../../../../App', () => ({ AuthContext: require('react').createContext({ setRole: () => {} }) }));
jest.mock('@react-navigation/native', () => ({ useFocusEffect: (cb) => { const React = require('react'); React.useEffect(() => cb(), [cb]); } }));

const { brandApi } = require('../../../services/api');
const BrandThreadScreen = require('../BrandThreadScreen').default;
const BrandPoolScreen = require('../BrandPoolScreen').default;
const BrandCampaignsScreen = require('../BrandCampaignsScreen').default;
const BrandCampaignNewScreen = require('../BrandCampaignNewScreen').default;
const BrandSetDetailScreen = require('../BrandSetDetailScreen').default;

const nav = () => ({ goBack: jest.fn(), navigate: jest.fn(), replace: jest.fn(), push: jest.fn(), setParams: jest.fn(), addListener: jest.fn(() => () => {}), dispatch: jest.fn() });
const ok = (data) => ({ success: true, data });
const yr = new Date().getFullYear();

const THREAD = {
  invitationId: 'ci1', goal: 'conversion', status: 'negotiating',
  brand: { name: 'Urban Threads' }, creator: { id: 'p', name: 'Priya Sharma' },
  campaignName: 'Diwali Edit 2026', setName: 'Set A · Ethnic wear', postingDate: `${yr}-10-20`, cutoff: `${yr}-10-17`, cutoffPassed: false,
  switchOn: true,
  negotiation: { id: 'n1', open: true, whoseMove: 'brand', roundLimit: 2, countersUsed: 1, isLastRound: true, noRoundsLeft: false, outcome: null, endedAt: null },
  current: { commissionPct: 13 }, currentLine: '13%',
  turns: [{ id: 't1', by: 'influencer', mine: false, at: `${yr}-09-13T10:00:00Z`, kind: 'counter', terms: { commissionPct: 13 }, changes: [{ term: 'commissionPct', from: '10%', to: '13%' }], note: 'Ethnic wear takes a full day to shoot. 13% works for me.' }],
  invitation: { terms: { commissionPct: 10 }, termsLine: '10%', sentAt: `${yr}-09-12T10:00:00Z`, scopeWords: 'whole store', offerName: 'Festive 15%' },
  moveRequest: null, pool: null, ending: null,
  warnings: ['BELOW_MIN_COMMISSION'], minimums: { fee: null, commissionPct: 12 },
  can: { counter: true, accept: true, decline: true, moveRequest: false, moveAnswer: false },
};
const MOVE = {
  ...THREAD, status: 'invited',
  negotiation: { id: null, open: false, whoseMove: null, roundLimit: 2, countersUsed: 0, isLastRound: false, noRoundsLeft: false, outcome: null, endedAt: null },
  current: { commissionPct: 12 }, currentLine: '12%',
  creator: { id: 'r', name: 'Ritu V.' },
  turns: [],
  invitation: { terms: { commissionPct: 12 }, termsLine: '12%', sentAt: `${yr}-09-12T10:00:00Z`, scopeWords: 'whole store', offerName: null },
  moveRequest: { goLiveDate: `${yr}-10-27`, shootMode: null, note: "I'm travelling that week.", requestedAt: `${yr}-09-13T10:00:00Z`, answer: null, answeredAt: null },
  can: { counter: false, accept: false, decline: false, moveRequest: false, moveAnswer: true },
};
const POOL = {
  total: 3,
  groups: [
    { key: `date:${yr}-10-27`, title: 'Want 27 Oct', count: 2, rows: [
      { entryId: 'e1', state: 'waiting', creator: { id: 'r', name: 'Ritu V.', avatarUrl: null }, goal: 'conversion', terms: { commissionPct: 12 }, termsLine: '12%', wantsGoLiveDate: `${yr}-10-27`, wantsShootMode: null, daysLeft: 22, closingSoon: false, noLongerPossible: false, selectable: true, agreedAt: `${yr}-09-13T10:00:00Z`, from: {} },
      { entryId: 'e2', state: 'waiting', creator: { id: 's', name: 'Sneha N.', avatarUrl: null }, goal: 'engagement', terms: { fee: 9000 }, termsLine: '₹9,000', wantsGoLiveDate: `${yr}-10-27`, wantsShootMode: null, daysLeft: 3, closingSoon: true, noLongerPossible: false, selectable: true, agreedAt: `${yr}-09-13T10:00:00Z`, from: {} },
    ] },
    { key: 'mode:shipment', title: 'Want Remote', count: 1, rows: [
      { entryId: 'e3', state: 'waiting', creator: { id: 'd', name: 'Divya R.', avatarUrl: null }, goal: 'conversion', terms: { commissionPct: 10 }, termsLine: '10%', wantsGoLiveDate: null, wantsShootMode: 'shipment', daysLeft: 25, closingSoon: false, noLongerPossible: false, selectable: true, agreedAt: `${yr}-09-13T10:00:00Z`, from: {} },
    ] },
  ],
};

beforeEach(() => {
  jest.clearAllMocks();
  brandApi.getPool.mockResolvedValue(ok(POOL));
  brandApi.campaignsSummary.mockResolvedValue(ok({ campaigns: [], tabs: { live: 0, draft: 0, past: 0 } }));
});

describe('N7 · N8 · N9 — the brand answers a counter', () => {
  it('your move: the thread, the hint, and Accept writes her number onto the invitation', async () => {
    brandApi.brandThread.mockResolvedValue(ok({ thread: THREAD }));
    brandApi.brandAcceptCounter.mockResolvedValue(ok({ thread: { ...THREAD, negotiation: { ...THREAD.negotiation, open: false, outcome: 'agreed' }, ending: { outcome: 'agreed', text: 'Agreed at 13% on 14 Sep. Send the agreement next.' }, can: {} } }));
    const { getByText, getByTestId } = render(<BrandThreadScreen navigation={nav()} route={{ params: { campaignId: 'c1', setId: 'sA', ciId: 'ci1' } }} />);
    await waitFor(() => getByTestId('brand-thread-actions'));
    getByText('Your move. Priya is waiting.');
    getByText('Priya countered'); getByText('You invited Priya');
    getByText('“Ethnic wear takes a full day to shoot. 13% works for me.”');
    getByText('Accepting writes 13% onto her invitation. The agreement is the next step.');
    getByTestId('brand-counter-back'); getByTestId('brand-decline');
    fireEvent.press(getByTestId('brand-accept'));
    await waitFor(() => expect(brandApi.brandAcceptCounter).toHaveBeenCalledWith('c1', 'sA', 'ci1'));
    await waitFor(() => getByTestId('ending-agreed'));
  });

  it('N8 — the counter back is labelled as the last one, shows the minimum warning, and sends', async () => {
    brandApi.brandThread.mockResolvedValue(ok({ thread: THREAD }));
    brandApi.brandCounter.mockResolvedValue(ok({ thread: THREAD }));
    const { getByText, getAllByText, getByTestId } = render(<BrandThreadScreen navigation={nav()} route={{ params: { campaignId: 'c1', setId: 'sA', ciId: 'ci1' } }} />);
    await waitFor(() => getByTestId('brand-counter-back'));
    fireEvent.press(getByTestId('brand-counter-back'));
    expect(getAllByText('Counter back').length).toBeGreaterThanOrEqual(2);  // the button and the sheet's own title
    getByText('ROUND 2 OF 2 · YOUR LAST');
    getByText('After this, Priya can only accept or decline.');
    fireEvent.changeText(getByTestId('brand-commission'), '11.5');
    getByText("Below Priya's minimum of 12%. She can still accept.");
    fireEvent.changeText(getByTestId('brand-counter-note'), 'We can do 11.5% for the first collaboration.');
    fireEvent.press(getByTestId('brand-send-counter'));
    await waitFor(() => expect(brandApi.brandCounter).toHaveBeenCalledWith('c1', 'sA', 'ci1',
      { terms: { commissionPct: 11.5, fee: null, deliverables: [], usageRights: null }, note: 'We can do 11.5% for the first collaboration.' }));
  });

  it('N9 — declining says what it ends and offers an optional reason she sees', async () => {
    brandApi.brandThread.mockResolvedValue(ok({ thread: THREAD }));
    brandApi.brandDeclineCounter.mockResolvedValue(ok({ thread: { ...THREAD, ending: { outcome: 'declined_by_brand', text: 'You declined on 14 Sep.' }, can: {} } }));
    const { getByText, getByTestId } = render(<BrandThreadScreen navigation={nav()} route={{ params: { campaignId: 'c1', setId: 'sA', ciId: 'ci1' } }} />);
    await waitFor(() => getByTestId('brand-decline'));
    fireEvent.press(getByTestId('brand-decline'));
    getByText("Decline Priya's counter?");
    getByText('This ends the invitation. Priya will see that you said no, and you can invite her again with new terms while there is still time.');
    getByText('She sees this.');
    fireEvent.changeText(getByTestId('decline-counter-note'), "We can't go above 11.5% on this campaign.");
    fireEvent.press(getByTestId('decline-counter-confirm'));
    await waitFor(() => expect(brandApi.brandDeclineCounter).toHaveBeenCalledWith('c1', 'sA', 'ci1', { note: "We can't go above 11.5% on this campaign." }));
  });
});

describe('N10 · N11 — a request to move', () => {
  it('three answers, and the confirm lists the three things that happen', async () => {
    brandApi.brandThread.mockResolvedValue(ok({ thread: MOVE }));
    brandApi.answerMoveRequest.mockResolvedValue(ok({ answer: 'agreed', poolEntryId: 'e1', thread: { ...MOVE, moveRequest: { ...MOVE.moveRequest, answer: 'agreed' }, can: {} } }));
    const { getByText, getByTestId } = render(<BrandThreadScreen navigation={nav()} route={{ params: { campaignId: 'c1', setId: 'sA', ciId: 'ci1' } }} />);
    await waitFor(() => getByTestId('move-actions'));
    getByText('Your move. Ritu asked for a different date.');
    getByText('Ritu asked');
    getByText('20 Oct → 27 Oct');
    getByText('Your set keeps 20 Oct whatever you choose. Agreeing moves Ritu out of it, with her 12% kept, and you build a set for 27 Oct when you\'re ready.');
    getByTestId('move-keep'); getByTestId('move-decline');
    fireEvent.press(getByTestId('move-agree'));
    getByText('Move Ritu to your pool?');
    getByText('What happens');
    getByText('Her 12%'); getByText('Kept');
    getByText('This invitation'); getByText('Closes');
    getByText('She goes to'); getByText('Your pool · wants 27 Oct');
    getByText("When you create a set for 27 Oct, she'll be waiting there with these terms filled in. She gets a fresh invitation to accept.");
    fireEvent.press(getByTestId('move-confirm'));
    await waitFor(() => expect(brandApi.answerMoveRequest).toHaveBeenCalledWith('c1', 'sA', 'ci1', 'agreed'));
  });

  it('keeping the date is one tap and does not open a confirm', async () => {
    brandApi.brandThread.mockResolvedValue(ok({ thread: MOVE }));
    brandApi.answerMoveRequest.mockResolvedValue(ok({ answer: 'kept', poolEntryId: null, thread: { ...MOVE, moveRequest: { ...MOVE.moveRequest, answer: 'kept' }, can: {} } }));
    const { getByTestId, getByText } = render(<BrandThreadScreen navigation={nav()} route={{ params: { campaignId: 'c1', setId: 'sA', ciId: 'ci1' } }} />);
    await waitFor(() => getByTestId('move-keep'));
    getByText('Keep 20 Oct');
    fireEvent.press(getByTestId('move-keep'));
    await waitFor(() => expect(brandApi.answerMoveRequest).toHaveBeenCalledWith('c1', 'sA', 'ci1', 'kept'));
  });
});

describe('N13 · N14 — the pool', () => {
  it('the row at the top of Campaigns opens it', async () => {
    const n = nav();
    const { getByText, getByTestId } = render(<BrandCampaignsScreen navigation={n} route={{ params: {} }} />);
    await waitFor(() => getByTestId('pool-entry'));
    getByText('Agreed, needs a set · 3');
    getByText('Creators who agreed terms but need other dates');
    fireEvent.press(getByTestId('pool-entry'));
    expect(n.navigate).toHaveBeenCalledWith('BrandPool');
  });

  it('grouped by what they asked for, one Aim at a time, days left and the closing-soon chip', async () => {
    brandApi.poolSetDefaults.mockResolvedValue(ok({ goal: 'conversion', shoot_mode: null, branch_id: null, go_live_date: `${yr}-10-27`, wantedDate: `${yr}-10-27`, dateNoLongerPossible: false, creators: [] }));
    const { getByText, getByTestId } = render(<BrandPoolScreen navigation={nav()} route={{ params: {} }} />);
    await waitFor(() => getByTestId('pool-e1'));
    getByText('Creators who agreed your terms but asked for a different date or mode. Pick the ones that go together and build a set for them.');
    getByText('Want 27 Oct'); getByText('Want Remote');
    getByText('Pay for Sale · 12% · 22 days left');
    getByText('Pay for Content · ₹9,000 · 3 days left');
    getByText('Closing in 3 days');
    getByText('One set has one Aim, so only creators on the same Aim can go into it together.');
    getByText('Create a set for 0 creators');
    // picking one Aim locks the others out — a set has one Aim
    fireEvent.press(getByTestId('pool-e1'));
    getByText('Create a set for 1 creator');
    expect(getByTestId('pool-e2').props.accessibilityState.disabled).toBe(true);
    expect(getByTestId('pool-e3').props.accessibilityState.disabled).toBe(false);
    fireEvent.press(getByTestId('pool-e3'));
    getByText('Create a set for 2 creators');
    fireEvent.press(getByTestId('pool-create-set'));
    await waitFor(() => expect(brandApi.poolSetDefaults).toHaveBeenCalledWith(['e1', 'e3']));
  });
});

describe('N18 · N20 — the switch and the set', () => {
  it('the switch sits on the new-campaign screen, on by default', async () => {
    brandApi.createCampaign.mockResolvedValue(ok({ campaign: { id: 'c9', name: 'Diwali Edit 2026' }, dateRules: { today: `${yr}-09-14`, earliestPostingDate: `${yr}-09-21`, minDaysAhead: 7, cutoffDaysBefore: 3 } }));
    const { getByText, getByTestId } = render(<BrandCampaignNewScreen navigation={nav()} route={{ params: {} }} />);
    getByText('Allow creators to counter');
    getByText('If this is off, creators can only accept or decline.');
    getByText('You can change this later. Turning it off never stops a negotiation that has already started.');
    fireEvent.changeText(getByTestId('campaign-name'), 'Diwali Edit 2026');
    fireEvent(getByTestId('allow-negotiation'), 'valueChange', false);
    fireEvent.press(getByTestId('campaign-next'));
    await waitFor(() => expect(brandApi.createCampaign).toHaveBeenCalledWith({ name: 'Diwali Edit 2026', brief: null, started_from_group_id: undefined, allow_negotiation: false }));
  });

  it('N20 — "Your move" first, then Negotiating with a Waiting chip, then item 5\'s groups', async () => {
    const row = (o) => ({ id: o.id, influencerId: `i-${o.id}`, name: o.name, avatarUrl: null, status: o.status || 'negotiating', group: o.group,
      termsLine: '10% · whole store · no offer', sentAt: `${yr}-09-12T10:00:00Z`, answeredAt: null, signedAt: null,
      negotiation: o.negotiation || null, moveRequest: o.moveRequest || null,
      actions: { withdraw: false, remove: true, viewTerms: true, thread: !!(o.negotiation || o.moveRequest), sendAgreement: false }, ...o });
    brandApi.setSummary.mockResolvedValue(ok({
      set: { id: 'sA', campaignId: 'c1', name: 'Set A · Ethnic wear', state: 'live', datePassed: false, locked: true, lockedFields: [], goal: 'conversion', shootMode: 'shipment', branch: null,
        postingDate: `${yr}-10-20`, cutoff: `${yr}-10-17`, daysToCutoff: 4, cutoffPassed: false, expiredAt: null,
        counts: { invited: 8, signed: 3, waiting: 2, declined: 3 }, canInvite: { ok: true }, isPast: false },
      campaign: { id: 'c1', name: 'Diwali Edit 2026' },
      dateRules: { today: `${yr}-09-14`, earliestPostingDate: `${yr}-09-21`, minDaysAhead: 7, cutoffDaysBefore: 3 },
      creators: {
        order: ['yourMove', 'negotiating', 'accepted', 'signed', 'waiting', 'deferred', 'declined', 'expired', 'withdrawn'],
        groups: {
          yourMove: { key: 'yourMove', count: 2, more: 0, rows: [
            row({ id: 'r1', name: 'Priya Sharma', group: 'yourMove', negotiation: { id: 'n1', open: true, whoseMove: 'brand', countersUsed: 1, roundLimit: 2, lastCounter: { by: 'influencer', at: `${yr}-09-13T10:00:00Z`, line: '13%' } } }),
            row({ id: 'r2', name: 'Ritu V.', group: 'yourMove', status: 'invited', moveRequest: { goLiveDate: `${yr}-10-27`, answer: null, requestedAt: `${yr}-09-13T10:00:00Z` } }),
          ] },
          negotiating: { key: 'negotiating', count: 1, more: 0, rows: [
            row({ id: 'r3', name: 'Tanvi S.', group: 'negotiating', negotiation: { id: 'n2', open: true, whoseMove: 'influencer', countersUsed: 2, roundLimit: 2, lastCounter: { by: 'brand', at: `${yr}-09-14T10:00:00Z`, line: '₹9,000' } } }),
          ] },
          accepted: { key: 'accepted', count: 0, more: 0, rows: [] }, signed: { key: 'signed', count: 0, more: 0, rows: [] },
          waiting: { key: 'waiting', count: 1, more: 0, rows: [row({ id: 'r4', name: 'Divya R.', group: 'waiting', status: 'invited' })] },
          deferred: { key: 'deferred', count: 0, more: 0, rows: [] }, declined: { key: 'declined', count: 0, more: 0, rows: [] },
          expired: { key: 'expired', count: 0, more: 0, rows: [] }, withdrawn: { key: 'withdrawn', count: 0, more: 0, rows: [] },
        },
      },
    }));
    const n = nav();
    const { getByText, getAllByText, getByTestId, toJSON } = render(<BrandSetDetailScreen navigation={n} route={{ params: { campaignId: 'c1', setId: 'sA' } }} />);
    await waitFor(() => getByTestId('creators-block'));
    getByText('Negotiating'); getByText('Waiting to answer');
    getByText('Countered 13% · 13 Sep');
    getByText('Asked for 27 Oct · 13 Sep');
    getByText('You countered ₹9,000 · 14 Sep');
    // ASSERTION DRIFT — ui-walk-fixes board F, frame F1 (drift/F.md). This used to expect "Your
    // move" at least twice (the two rows' pills) and exactly one "Waiting" pill. The locked board
    // makes the brand's move a labelled BUTTON that names the step — "Reply" on a counter and on a
    // request to move — so "Your move" is the group's heading alone; and an invitation nobody has
    // answered now carries a "Waiting" tag too, beside the one on the brand's own counter.
    expect(getAllByText('Your move')).toHaveLength(1);                     // the heading
    expect(getAllByText('Reply')).toHaveLength(2);                         // she countered · she asked to move
    getByTestId('chip-r1'); getByTestId('chip-r2');                        // both are buttons
    expect(getAllByText('Waiting')).toHaveLength(2);                       // his counter is with her · no answer yet
    getByTestId('tag-r3'); getByTestId('tag-r4');                          // both are tags, not buttons
    const flat = JSON.stringify(toJSON());
    expect(flat.indexOf('Your move')).toBeLessThan(flat.indexOf('Negotiating'));
    // a row with a conversation opens the thread
    fireEvent.press(getByTestId('set-creator-r1'));
    expect(n.navigate).toHaveBeenCalledWith('BrandThread', { campaignId: 'c1', setId: 'sA', ciId: 'r1' });
    // …and its "Reply" button does exactly what the row does (board F: one door per row).
    fireEvent.press(getByTestId('chip-r2'));
    expect(n.navigate).toHaveBeenLastCalledWith('BrandThread', { campaignId: 'c1', setId: 'sA', ciId: 'r2' });
  });
});

describe('N21 — every way a negotiation ends', () => {
  const ending = (outcome, text) => ({ ...THREAD, negotiation: { ...THREAD.negotiation, open: false, whoseMove: null, outcome }, ending: { outcome, text }, can: { counter: false, accept: false, decline: false } });
  it('each ending is a sentence with a date, and the thread stays readable underneath', async () => {
    for (const [outcome, text] of [
      ['agreed', 'Agreed at 11.5% on 14 Sep. Send the agreement next.'],
      ['declined_by_creator', 'Priya declined on 14 Sep: fee too low. You can invite her again with new terms until 17 Oct.'],
      ['declined_by_brand', 'You declined on 14 Sep. Priya was told: "We can\'t go above 11.5% on this campaign."'],
      ['expired', `Invitations for this set closed on 17 Oct ${yr}, so this negotiation ended unfinished.`],
      ['moved', 'Priya moved to your pool on 14 Sep.'],
    ]) {
      brandApi.brandThread.mockResolvedValue(ok({ thread: ending(outcome, text) }));
      const r = render(<BrandThreadScreen navigation={nav()} route={{ params: { campaignId: 'c1', setId: 'sA', ciId: 'ci1' } }} />);
      await waitFor(() => r.getByTestId(`ending-${outcome}`));
      r.getByText(text);
      r.getByText('Priya countered');           // the thread is still there
      expect(r.queryByTestId('brand-thread-actions')).toBeNull();
      r.unmount();
    }
  });
});
