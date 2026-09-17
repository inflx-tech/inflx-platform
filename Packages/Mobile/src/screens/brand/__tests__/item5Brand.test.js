/**
 * Item 5 — the Brand app: I1 picker states, I3–I5 terms with the exact §7 messages and the
 * minimum warning, I8 review and the all-or-nothing send, I9 the grouped set, I10 withdraw.
 * Contract: features/item5-invitations
 */
import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';

jest.mock('../../../services/api', () => ({
  brandApi: {
    setSummary: jest.fn(), pickable: jest.fn(), listGroups: jest.fn(), groupCheck: jest.fn(), checkEligibility: jest.fn(),
    sendInvitations: jest.fn(), invitationDetail: jest.fn(), withdrawInvitation: jest.fn(), removeInvitation: jest.fn(),
    getMe: jest.fn(), getBrandProducts: jest.fn(), getOffers: jest.fn(), previewBasket: jest.fn(),
    updateCampaignSet: jest.fn(), deleteCampaignSet: jest.fn(), duplicateSet: jest.fn(), listBranches: jest.fn(),
  },
  influencerApi: {},
  referenceApi: {
    brandCategories: jest.fn().mockResolvedValue({ success: true, data: { items: [] } }),
    creatorNiches: jest.fn().mockResolvedValue({ success: true, data: { items: [] } }),
    languages: jest.fn().mockResolvedValue({ success: true, data: { items: [] } }),
    states: jest.fn().mockResolvedValue({ success: true, data: { items: [] } }),
  },
  clearSession: jest.fn(), uploadFile: jest.fn(),
}));
jest.mock('../../../../App', () => ({ AuthContext: require('react').createContext({ setRole: () => {} }) }));
jest.mock('@react-navigation/native', () => ({ useFocusEffect: (cb) => { const React = require('react'); React.useEffect(() => cb(), [cb]); } }));

const { brandApi } = require('../../../services/api');
const BrandSetDetailScreen = require('../BrandSetDetailScreen').default;
const BrandSetPickCreatorsScreen = require('../BrandSetPickCreatorsScreen').default;
const BrandCreatorTermsScreen = require('../BrandCreatorTermsScreen').default;
const BrandReviewSendScreen = require('../BrandReviewSendScreen').default;
const BrandGroupInviteCheckScreen = require('../BrandGroupInviteCheckScreen').default;
const { MSG5, C5 } = require('../../../components/invitations/copy5');
const draft = require('../../../components/invitations/draft5');

const nav = () => ({ goBack: jest.fn(), navigate: jest.fn(), replace: jest.fn(), push: jest.fn(), setParams: jest.fn(), addListener: jest.fn(() => () => {}), dispatch: jest.fn() });
const ok = (data) => ({ success: true, data });
const yr = new Date().getFullYear();
const RULES = { today: `${yr}-09-12`, earliestPostingDate: `${yr}-09-19`, minDaysAhead: 7, cutoffDaysBefore: 3 };
const SET = { id: 'sA', campaignId: 'c1', name: 'Set A · Ethnic wear', state: 'live', datePassed: false, locked: true, lockedFields: ['goal'], goal: 'conversion', shootMode: 'visit',
  branch: { id: 'b1', name: 'Banjara Hills', cityName: 'Hyderabad' }, postingDate: `${yr}-10-20`, cutoff: `${yr}-10-17`, daysToCutoff: 4, cutoffPassed: false, expiredAt: null,
  counts: { invited: 8, signed: 3, waiting: 2, declined: 3 }, canInvite: { ok: true }, isPast: false };
const row = (o) => ({ id: o.id, influencerId: `i-${o.id}`, name: o.name, avatarUrl: null, status: o.status || 'invited', group: o.group || 'waiting', termsLine: o.termsLine || '10% · whole store · no offer',
  sentAt: `${yr}-09-12T10:00:00Z`, answeredAt: o.answeredAt || null, signedAt: null, declineReasonLabel: o.declineReasonLabel || null, deferredGoLiveDate: o.deferredGoLiveDate || null,
  actions: { withdraw: (o.status || 'invited') === 'invited', remove: !['withdrawn', 'removed', 'declined', 'expired'].includes(o.status || 'invited'), viewTerms: true, sendAgreement: o.group === 'yourMove' && (o.status || 'invited') === 'accepted' }, ...o });
const GROUPS = {
  // Item 7 (P1): an accepted creator with a draft agreement is the brand's move.
  order: ['yourMove', 'waiting', 'negotiating', 'accepted', 'signed', 'deferred', 'declined', 'expired', 'withdrawn'],
  groups: {
    waiting: { key: 'waiting', count: 2, more: 0, rows: [row({ id: 'r1', name: 'Priya Sharma' }), row({ id: 'r2', name: 'Tanvi S.', termsLine: '12% · whole store · no offer' })] },
    negotiating: { key: 'negotiating', count: 0, more: 0, rows: [] },
    yourMove: { key: 'yourMove', title: 'Your move', count: 1, more: 0, rows: [row({ id: 'r3', name: 'Sneha N.', status: 'accepted', group: 'yourMove', answeredAt: `${yr}-09-13T10:00:00Z` })] },
    accepted: { key: 'accepted', count: 0, more: 0, rows: [] },
    signed: { key: 'signed', count: 0, more: 0, rows: [] },
    deferred: { key: 'deferred', count: 1, more: 0, rows: [row({ id: 'r4', name: 'Ritu V.', status: 'deferred', group: 'deferred', deferredGoLiveDate: `${yr}-10-27` })] },
    declined: { key: 'declined', count: 1, more: 0, rows: [row({ id: 'r5', name: 'Divya R.', status: 'declined', group: 'declined', declineReasonLabel: 'Fee too low' })] },
    expired: { key: 'expired', count: 0, more: 0, rows: [] },
    withdrawn: { key: 'withdrawn', count: 0, more: 0, rows: [] },
  },
};
const SUMMARY = { set: SET, campaign: { id: 'c1', name: 'Diwali Edit 2026' }, creators: GROUPS, dateRules: RULES };
const CREATORS = [
  { id: 'p', name: 'Priya Sharma', nicheLabel: 'Fashion', cityName: 'Hyderabad', instagram: 48200, pick: { state: 'ok' } },
  { id: 'k', name: 'Kavya D.', nicheLabel: 'Fashion', cityName: 'Hyderabad', instagram: 12000, pick: { state: 'ineligible', label: 'Not open to this set' } },
  { id: 'a', name: 'Arjun Kumar', nicheLabel: 'Fashion', cityName: 'Hyderabad', instagram: 30000, pick: { state: 'invited', label: 'Already in this set' } },
];

beforeEach(() => {
  jest.clearAllMocks();
  // The basket lives in the draft5 module, so it survives a render. Empty it between tests.
  draft.clearBasket('sA');
  brandApi.setSummary.mockResolvedValue(ok(SUMMARY));
  brandApi.pickable.mockResolvedValue(ok({ total: 3, page: 1, rows: CREATORS }));
  brandApi.listGroups.mockResolvedValue(ok({ groups: [{ id: 'g1', name: 'Diwali shortlist', memberCount: 12 }] }));
  brandApi.checkEligibility.mockResolvedValue(ok({ results: [{ influencerId: 'p', ok: true, warnings: ['BELOW_MIN_COMMISSION'], minimums: { fee: null, commissionPct: 12 } }, { influencerId: 's', ok: true, warnings: [], minimums: { fee: 8000, commissionPct: null } }] }));
  brandApi.getMe.mockResolvedValue(ok({ brand: { id: 'b1' } }));
  brandApi.getBrandProducts.mockResolvedValue(ok({ total: 1, page: 1, rows: [{ id: 'pr1', name: 'Silk saree', price: 2400, categoryNodeId: 'cn1', categoryName: 'Sarees' }] }));
  brandApi.getOffers.mockResolvedValue(ok({ offers: [{ id: 'o1', name: 'Festive 15% off Sarees', offer_type: 'discount', offer_config_json: { sub_type: 'pct', value: 15, scope: 'category', category: 'Sarees' }, status: 'active' }] }));
  brandApi.previewBasket.mockResolvedValue(ok({ shopper_pays: 2040, creator_earns: 204, commission_pct: 10 }));
});

describe('I9 · I10 — the set after invitations go out', () => {
  it('groups creators in the D6 order with counts, "Asked for another date" as its own group; Add creators opens the picker (checks 21, 36)', async () => {
    const n = nav();
    const { getByText, getByTestId, queryByTestId, getAllByTestId } = render(<BrandSetDetailScreen navigation={n} route={{ params: { campaignId: 'c1', setId: 'sA' } }} />);
    await waitFor(() => getByTestId('creators-block'));
    getByText('8 invited · 3 signed · 2 waiting to answer · 3 declined');
    // Item 7 (P1): the accepted creator moved to "Your move" — the brand owes her an agreement.
    getByText('Waiting to answer'); getByText('Your move'); getByText('Asked for another date'); getByText('Declined');
    expect(queryByTestId('group-negotiating')).toBeNull(); expect(queryByTestId('group-signed')).toBeNull();
    getByText('10% · whole store · no offer · sent 12 Sep'); getByText('Accepted 13 Sep'); getByText('Fee too low');
    getByText('Wants 27 Oct'); getByText('Another set'); getByText('Send agreement');
    fireEvent.press(getAllByTestId('add-creators')[0]);
    expect(n.navigate).toHaveBeenCalledWith('BrandSetPickCreators', expect.objectContaining({ campaignId: 'c1', setId: 'sA' }));
  });

  it('hides Add creators once the cutoff has passed (check 19)', async () => {
    brandApi.setSummary.mockResolvedValue(ok({ ...SUMMARY, set: { ...SET, cutoffPassed: true, daysToCutoff: null, canInvite: { ok: false, reason: 'cutoff_passed', message: 'closed' } } }));
    const { getByTestId, queryByTestId } = render(<BrandSetDetailScreen navigation={nav()} route={{ params: { campaignId: 'c1', setId: 'sA' } }} />);
    await waitFor(() => getByTestId('creators-block'));
    expect(queryByTestId('add-creators')).toBeNull();
  });

  it('a waiting creator\'s ⋯ offers withdraw; the confirm wording; the API is called and the set reloads (check 22)', async () => {
    brandApi.withdrawInvitation.mockResolvedValue(ok({ id: 'r1', status: 'withdrawn' }));
    const { getByText, getByTestId, queryByText } = render(<BrandSetDetailScreen navigation={nav()} route={{ params: { campaignId: 'c1', setId: 'sA' } }} />);
    await waitFor(() => getByTestId('creators-block'));
    fireEvent.press(getByTestId('more-r1'));
    getByText('View terms sent'); getByText('Open profile'); getByText('Withdraw invitation'); getByText('Remove from set');
    fireEvent.press(getByText('Withdraw invitation'));
    getByText("Withdraw Priya's invitation?");
    getByText('She sees it as withdrawn. You can invite her again with new terms while there is still time.');
    fireEvent.press(getByText('Withdraw'));
    await waitFor(() => expect(brandApi.withdrawInvitation).toHaveBeenCalledWith('c1', 'sA', 'r1'));
    await waitFor(() => getByText('Invitation withdrawn.'));
    expect(brandApi.setSummary).toHaveBeenCalledTimes(2);
    // an accepted creator can be removed but not withdrawn
    fireEvent.press(getByTestId('more-r3'));
    expect(queryByText('Withdraw invitation')).toBeNull(); getByText('Remove from set');
  });
});

describe('I1 — Add creators', () => {
  it('rows carry Invited / Can\'t invite and cannot be picked; Next counts the picked and opens the terms (checks 1–3)', async () => {
    const n = nav();
    const { getByText, getByTestId, getAllByText } = render(<BrandSetPickCreatorsScreen navigation={n} route={{ params: { campaignId: 'c1', setId: 'sA' } }} />);
    await waitFor(() => getByTestId('select-p'));
    getByText('DIWALI EDIT 2026 · SET A · ETHNIC WEAR');
    getByText("Creators whose own settings rule this set out can't be picked, and the reason is never shown to them.");
    getByText('Not open to this set'); getByText("Can't invite"); getByText('Already in this set'); getByText('Invited');
    expect(getByTestId('select-k').props.accessibilityState.disabled).toBe(true);
    expect(getByTestId('select-a').props.accessibilityState).toMatchObject({ checked: true, disabled: true });
    expect(brandApi.pickable).toHaveBeenCalledWith('c1', 'sA', expect.objectContaining({ tab: 'all' }));
    getByText('Next: terms for 0 creators');
    fireEvent.press(getByTestId('select-p'));
    getByText('Next: terms for 1 creator');
    fireEvent.press(getByTestId('pick-next'));
    expect(n.navigate).toHaveBeenCalledWith('BrandCreatorTerms', { campaignId: 'c1', setId: 'sA', index: 0 });
    expect(draft.getDraft('sA').creators.map(c => c.name)).toEqual(['Priya Sharma']);
    expect(getAllByText).toBeTruthy();
  });

  it('the Groups tab lists the brand\'s groups and opens the group check (I2)', async () => {
    const n = nav();
    const { getByText, getByTestId } = render(<BrandSetPickCreatorsScreen navigation={n} route={{ params: { campaignId: 'c1', setId: 'sA' } }} />);
    await waitFor(() => getByTestId('pick-tabs'));
    fireEvent.press(getByText('Groups'));
    await waitFor(() => getByTestId('group-g1'));
    getByText('12 creators');
    fireEvent.press(getByTestId('group-g1'));
    expect(n.navigate).toHaveBeenCalledWith('BrandGroupInviteCheck', { campaignId: 'c1', setId: 'sA', groupId: 'g1', groupName: 'Diwali shortlist' });
  });

  /**
   * features/one-basket-add-creators. Founder, 2026-09-17: "i can able to add pool creators,
   * from group and from list of creators selected manually ...but navigation to add creators is
   * not actually supporting this." The Groups tab used to leave the picker and start its own
   * send, throwing the basket away. These are the checks that it no longer can.
   */
  it('the footer follows you onto the Groups tab, where it used to vanish (one-basket check 1)', async () => {
    const n = nav();
    const { getByText, getByTestId, queryByTestId } = render(<BrandSetPickCreatorsScreen navigation={n} route={{ params: { campaignId: 'c1', setId: 'sA' } }} />);
    await waitFor(() => getByTestId('select-p'));
    fireEvent.press(getByTestId('select-p'));
    getByText('Next: terms for 1 creator');
    fireEvent.press(getByText('Groups'));
    await waitFor(() => getByTestId('group-g1'));
    // The bug was exactly this: no footer, no count, nothing saying the pick was still held.
    expect(queryByTestId('pick-footer')).not.toBeNull();
    getByText('1 selected');
    getByText('Next: terms for 1 creator');
  });

  it('the Review sheet groups the basket by source, and removing drops the count (one-basket check 9)', async () => {
    draft.addToBasket('sA', [{ id: 'p', name: 'Priya Sharma' }]);
    draft.addToBasket('sA', [{ id: 't', name: 'Tanvi S.', sourceGroupName: 'Diwali shortlist' }], 'g1');
    const n = nav();
    const { getByText, getByTestId, queryByText } = render(<BrandSetPickCreatorsScreen navigation={n} route={{ params: { campaignId: 'c1', setId: 'sA' } }} />);
    await waitFor(() => getByTestId('select-p'));
    getByText('2 selected');
    fireEvent.press(getByTestId('pick-basket'));
    getByText('Picked by hand · 1');
    getByText('From Diwali shortlist · 1');
    fireEvent.press(getByTestId('basket-remove-t'));
    expect(queryByText('From Diwali shortlist · 1')).toBeNull();
    // the footer's own count, not the sheet heading that happens to read the same
    expect(getByTestId('pick-count').props.children).toBe('1 selected');
  });
});

describe('I2 — the group check adds to the basket', () => {
  const CHECK = {
    group: { id: 'g1', name: 'Diwali shortlist', memberCount: 4 },
    set: { id: 'sA', name: 'Set A · Ethnic wear', goal: 'conversion', shootMode: 'visit', postingDate: `${yr}-10-20` },
    counts: { can: 3, cannot: 1, total: 4 },
    can: [{ id: 'p', name: 'Priya Sharma' }, { id: 's', name: 'Sneha N.' }, { id: 't', name: 'Tanvi S.' }],
    cannot: [{ id: 'k', name: 'Kavya D.', label: 'Not open to this set', pick: { state: 'ineligible' } }],
  };
  const open = (n) => render(<BrandGroupInviteCheckScreen navigation={n}
    route={{ params: { campaignId: 'c1', setId: 'sA', groupId: 'g1', groupName: 'Diwali shortlist' } }} />);
  beforeEach(() => { brandApi.groupCheck.mockResolvedValue(ok(CHECK)); });

  it('adds the group to the basket and goes back to the picker, saying so (one-basket checks 2, 3)', async () => {
    const n = nav();
    const { getByText, getByTestId } = open(n);
    await waitFor(() => getByTestId('group-summary'));
    getByText('3 of 4 can be invited');
    getByText('Will be added · 3');
    getByText('Not open to this set');
    getByText('0 already selected · 3 new from this group');
    fireEvent.press(getByTestId('group-next'));
    expect(draft.getBasket('sA').map(c => c.id).sort()).toEqual(['p', 's', 't']);
    expect(draft.getBasket('sA').every(c => c.sourceGroupId === 'g1')).toBe(true);
    expect(n.navigate).toHaveBeenCalledWith('BrandSetPickCreators', {
      campaignId: 'c1', setId: 'sA', toast: '3 creators added from Diwali shortlist.',
    });
  });

  it('names the overlap before the tap, and never adds anyone twice (one-basket checks 2, 4)', async () => {
    draft.addToBasket('sA', [{ id: 'p', name: 'Priya Sharma' }, { id: 's', name: 'Sneha N.' }]);
    const n = nav();
    const { getByText, getByTestId } = open(n);
    await waitFor(() => getByTestId('group-summary'));
    getByText('Priya Sharma and Sneha N. — you had already picked. They will not be added twice.');
    getByText('Add 1 creator to selection');
    getByText('2 already selected · 1 new from this group');
    fireEvent.press(getByTestId('group-next'));
    expect(draft.getBasket('sA').length).toBe(3);
    // the two she already had keep the source they arrived with — not overwritten by the group
    expect(draft.getBasket('sA').find(c => c.id === 'p').sourceGroupId).toBeFalsy();
    expect(draft.getBasket('sA').find(c => c.id === 't').sourceGroupId).toBe('g1');
    expect(n.navigate).toHaveBeenCalledWith('BrandSetPickCreators', expect.objectContaining({
      toast: '1 creator added from Diwali shortlist. 2 were already in your selection.',
    }));
  });

  it('a group already wholly in the basket cannot be added again (one-basket check 5)', async () => {
    draft.addToBasket('sA', CHECK.can.map(c => ({ ...c })));
    const n = nav();
    const { getByText, getByTestId } = open(n);
    await waitFor(() => getByTestId('group-summary'));
    getByText('Everyone here is already selected');
    expect(getByTestId('group-next').props.accessibilityState.disabled).toBe(true);
  });

  it('backing out adds nobody (one-basket check 6)', async () => {
    draft.addToBasket('sA', [{ id: 'x', name: 'Only her' }]);
    const n = nav();
    const { getByTestId } = open(n);
    await waitFor(() => getByTestId('group-summary'));
    expect(draft.getBasket('sA').map(c => c.id)).toEqual(['x']);
    expect(n.navigate).not.toHaveBeenCalled();
  });

  it('a group nobody can be invited from is still refused, as before (one-basket check 7)', async () => {
    brandApi.groupCheck.mockResolvedValue(ok({ ...CHECK, counts: { can: 0, cannot: 4, total: 4 }, can: [] }));
    const { getByText, getByTestId } = open(nav());
    await waitFor(() => getByTestId('group-summary'));
    getByText('Nobody in this group can be invited to this set.');
    expect(getByTestId('group-next').props.accessibilityState.disabled).toBe(true);
  });
});

describe('I3 · I4 · I5 — terms, creator by creator', () => {
  const start = (goal, creators = [{ id: 'p', name: 'Priya Sharma' }, { id: 's', name: 'Sneha N.' }]) =>
    draft.startDraft('sA', { set: { ...SET, goal }, campaignName: 'Diwali Edit 2026', creators, sourceGroupId: null });

  it('Pay for Sale: the locked set card, commission required, the minimum warning that never blocks, shoppable posts read-only (checks 6, 10)', async () => {
    start('conversion');
    const n = nav();
    const { getByText, getByTestId, queryByTestId } = render(<BrandCreatorTermsScreen navigation={n} route={{ params: { campaignId: 'c1', setId: 'sA', index: 0 } }} />);
    getByText('Creator 1 of 2'); getByText('🔒 Set terms, same for everyone'); getByText('Pay for Sale'); getByText(`20 Oct ${yr}`); getByText('Store Visit · Banjara Hills');
    getByText('1 post · set by INFLX', { exact: false });
    fireEvent.press(getByTestId('terms-next'));
    getByText(MSG5.COMMISSION_REQUIRED);
    expect(n.push).not.toHaveBeenCalled();
    await waitFor(() => getByText("Priya's minimum is 12%."));
    fireEvent.changeText(getByTestId('commission'), '10');
    getByText(MSG5.BELOW_MIN('Priya', '12%'));
    fireEvent.changeText(getByTestId('commission'), '140');
    fireEvent.press(getByTestId('terms-next'));
    getByText(MSG5.COMMISSION_RANGE);
    fireEvent.changeText(getByTestId('commission'), '10');
    expect(queryByTestId('min-commission')).toBeTruthy();
    fireEvent.press(getByTestId('terms-next'));
    expect(n.push).toHaveBeenCalledWith('BrandCreatorTerms', { campaignId: 'c1', setId: 'sA', index: 1 });
    expect(draft.getDraft('sA').terms.p.commissionPct).toBe('10');
  });

  it('above 50% asks once and is then accepted (check 41)', async () => {
    start('conversion');
    const n = nav();
    const { getByText, getByTestId } = render(<BrandCreatorTermsScreen navigation={n} route={{ params: { campaignId: 'c1', setId: 'sA', index: 0 } }} />);
    fireEvent.changeText(getByTestId('commission'), '60');
    fireEvent.press(getByTestId('terms-next'));
    getByText("That's more than half of every sale. Are you sure?");
    fireEvent.press(getByText('Yes, keep it'));
    expect(n.push).toHaveBeenCalledWith('BrandCreatorTerms', { campaignId: 'c1', setId: 'sA', index: 1 });
    expect(draft.getDraft('sA').over50Confirmed).toBe(true);
  });

  it('Pay for Content: fee, deliverables (empty / duplicate / count), usage rights need a place; "Use these terms for everyone" copies (checks 7, 9, 11)', async () => {
    start('engagement');
    const n = nav();
    const { getByText, getByTestId, queryByText } = render(<BrandCreatorTermsScreen navigation={n} route={{ params: { campaignId: 'c1', setId: 'sA', index: 0 } }} />);
    getByText('Paid 25% on signing, 25% when the content is live, 50% after it stays live.');
    fireEvent.press(getByTestId('terms-next'));
    getByText(MSG5.FEE_REQUIRED);
    fireEvent.changeText(getByTestId('fee'), '8000');
    fireEvent.press(getByTestId('deliverables-row-0-remove'));
    fireEvent.press(getByTestId('terms-next'));
    getByText(MSG5.DELIVERABLES_EMPTY);
    fireEvent.press(getByTestId('deliverables-add'));
    fireEvent.press(getByTestId('deliverables-add'));
    fireEvent.press(getByTestId('deliverables-row-1-reel'));
    fireEvent.press(getByTestId('terms-next'));
    getByText(MSG5.DELIVERABLE_DUP);
    fireEvent.press(getByTestId('deliverables-row-1-story'));
    fireEvent.changeText(getByTestId('deliverables-row-1-count'), '21');
    fireEvent.press(getByTestId('terms-next'));
    getByText(MSG5.DELIVERABLE_COUNT);
    fireEvent.changeText(getByTestId('deliverables-row-1-count'), '2');
    fireEvent(getByTestId('usage-switch'), 'valueChange', true);
    fireEvent.press(getByTestId('terms-next'));
    getByText(MSG5.USAGE_PLACE);
    fireEvent.press(getByTestId('place-ads'));
    fireEvent.press(getByTestId('usage-60'));
    fireEvent(getByTestId('everyone-switch'), 'valueChange', true);
    fireEvent.press(getByTestId('terms-next'));
    expect(queryByText(MSG5.USAGE_PLACE)).toBeNull();
    const d = draft.getDraft('sA');
    expect(d.terms.p.deliverables).toEqual([{ type: 'reel', count: 1 }, { type: 'story', count: 2 }]);
    expect(d.terms.s.fee).toBe('8000');
    expect(d.terms.s.deliverables).toEqual([{ type: 'reel', count: 1 }, { type: 'story', count: 2 }]);
    expect(d.terms.s.usage).toEqual({ on: true, durationDays: 60, places: ['ads'] });
  });

  it('Hybrid refuses a ₹0 fixed fee; the follower offer sheet attaches a saved offer with a preview and never copies a special one (checks 8, 11, 12)', async () => {
    start('hybrid');
    const n = nav();
    const { getByText, getByTestId, queryByText } = render(<BrandCreatorTermsScreen navigation={n} route={{ params: { campaignId: 'c1', setId: 'sA', index: 0 } }} />);
    fireEvent.changeText(getByTestId('fee'), '0');
    fireEvent.changeText(getByTestId('commission'), '10');
    fireEvent.press(getByTestId('terms-next'));
    getByText(MSG5.HYBRID_FEE);
    expect(queryByText('What she delivers')).toBeNull();
    fireEvent.changeText(getByTestId('fee'), '5000');
    fireEvent.press(getByTestId('offer-row'));
    await waitFor(() => getByText('Follower offer for Priya'));
    getByText('Shoppers pay the normal price');
    fireEvent.press(getByTestId('offer-library'));
    await waitFor(() => getByTestId('saved-offer-o1'));
    fireEvent.press(getByTestId('saved-offer-o1'));
    await waitFor(() => getByTestId('offer-preview'));
    getByText('A ₹2,400 Silk saree costs ₹2,040');
    getByText('Priya earns ₹204 at 10% on what shoppers actually pay.');
    expect(brandApi.previewBasket).toHaveBeenCalledWith(expect.objectContaining({ brand_offer_id: 'o1', product_ids: ['pr1'] }));
    fireEvent.press(getByTestId('offer-use'));
    expect(draft.getDraft('sA').terms.p.offer).toBeNull(); // not saved until Next
    fireEvent(getByTestId('everyone-switch'), 'valueChange', true);
    fireEvent.press(getByTestId('terms-next'));
    const d = draft.getDraft('sA');
    expect(d.terms.p.offer).toMatchObject({ kind: 'library', brandOfferId: 'o1', name: 'Festive 15% off Sarees' });
    expect(d.terms.s.offer).toMatchObject({ kind: 'library', brandOfferId: 'o1' });
    // a special offer is never copied
    draft.setTerms('sA', 'p', { ...d.terms.p, offer: { kind: 'special', offerType: 'discount', offerConfigJson: { sub_type: 'pct', value: 12, scope: 'store' }, name: null, line: '12% off' } });
    draft.setTerms('sA', 's', { ...d.terms.s, offer: null });
    draft.copyTermsToAll('sA', 'p');
    expect(draft.getDraft('sA').terms.s.offer).toBeNull();
    expect(draft.getDraft('sA').terms.s.fee).toBe('5000');
  });
});

describe('I8 — Review and send', () => {
  /**
   * features/one-basket-add-creators check 8. This asserts the PAYLOAD, not the screen. The
   * source can render perfectly on the row and still be dropped before the request — that is a
   * bug that looks exactly like a pass.
   */
  /**
   * The basket outlives a single screen, which is the whole point of it — so it also has to be
   * emptied at the right moments, or Add creators greets her with a dozen people the server
   * would now refuse.
   */
  it('a sent basket is a spent basket (one-basket check 13)', async () => {
    draft.addToBasket('sA', [{ id: 'p', name: 'Priya Sharma' }]);
    draft.startDraft('sA', { set: SET, campaignName: 'Diwali Edit 2026', creators: [{ id: 'p', name: 'Priya Sharma' }], sourceGroupId: null });
    draft.setTerms('sA', 'p', { ...draft.defaultTerms('conversion'), commissionPct: '10' });
    brandApi.sendInvitations.mockResolvedValue(ok({ sent: 1, rows: [] }));
    const { getByTestId } = render(<BrandReviewSendScreen navigation={nav()} route={{ params: { campaignId: 'c1', setId: 'sA' } }} />);
    await waitFor(() => getByTestId('review-row-p'));
    fireEvent.press(getByTestId('send-invitations'));
    await waitFor(() => expect(brandApi.sendInvitations).toHaveBeenCalled());
    await waitFor(() => expect(draft.getBasket('sA')).toEqual([]));
  });

  it('removing a creator from the draft removes her from the basket too (one-basket check 14)', () => {
    draft.addToBasket('sA', [{ id: 'p', name: 'Priya Sharma' }, { id: 's', name: 'Sneha N.' }]);
    draft.startDraft('sA', { set: SET, campaignName: 'Diwali Edit 2026', creators: [{ id: 'p', name: 'Priya Sharma' }, { id: 's', name: 'Sneha N.' }], sourceGroupId: null });
    draft.removeCreators('sA', ['s']);
    expect(draft.getBasket('sA').map(c => c.id)).toEqual(['p']);
  });

  it('a mixed basket sends the group per creator, and none for the rest (one-basket check 8)', async () => {
    draft.startDraft('sA', {
      set: SET, campaignName: 'Diwali Edit 2026', sourceGroupId: null,
      creators: [
        { id: 'p', name: 'Priya Sharma' },
        { id: 't', name: 'Tanvi S.', sourceGroupId: 'g1', sourceGroupName: 'Diwali shortlist' },
      ],
    });
    draft.setTerms('sA', 'p', { ...draft.defaultTerms('conversion'), commissionPct: '10' });
    draft.setTerms('sA', 't', { ...draft.defaultTerms('conversion'), commissionPct: '10' });
    brandApi.sendInvitations.mockResolvedValue(ok({ sent: 2, rows: [] }));
    const n = nav();
    const { getByText, getByTestId } = render(<BrandReviewSendScreen navigation={n} route={{ params: { campaignId: 'c1', setId: 'sA' } }} />);
    await waitFor(() => getByTestId('review-row-p'));
    // where she came from, on her row
    getByText('from Diwali shortlist');
    fireEvent.press(getByTestId('send-invitations'));
    await waitFor(() => expect(brandApi.sendInvitations).toHaveBeenCalled());
    const body = brandApi.sendInvitations.mock.calls[0][2];
    const byId = Object.fromEntries(body.creators.map(c => [c.influencerId, c]));
    expect(byId.t.sourceGroupId).toBe('g1');
    expect(byId.p.sourceGroupId).toBeUndefined();
    // and no batch-level label claiming they all came from one place
    expect(body.sourceGroupId).toBeUndefined();
  });

  it('rows with the terms line and OK / Below min; the warning; Send calls the API once with every creator and goes back with a toast (check 17)', async () => {
    draft.startDraft('sA', { set: SET, campaignName: 'Diwali Edit 2026', creators: [{ id: 'p', name: 'Priya Sharma' }, { id: 's', name: 'Sneha N.' }], sourceGroupId: null });
    draft.setTerms('sA', 'p', { ...draft.defaultTerms('conversion'), commissionPct: '10', offer: { kind: 'library', brandOfferId: 'o1', name: 'Festive 15%' } });
    draft.setTerms('sA', 's', { ...draft.defaultTerms('conversion'), commissionPct: '12' });
    brandApi.sendInvitations.mockResolvedValue(ok({ sent: 2, rows: [] }));
    const n = nav();
    const { getByText, getByTestId } = render(<BrandReviewSendScreen navigation={n} route={{ params: { campaignId: 'c1', setId: 'sA' } }} />);
    getByText('All 2 creators'); getByText(`Replies close`); getByText(`17 Oct ${yr}`);
    getByText('10% · whole store · Festive 15%'); getByText('12% · whole store · no offer');
    await waitFor(() => getByText('Below min'));
    getByText('OK');
    getByText('1 creator is below their own minimum. They can still be invited and can counter.');
    getByText('Each creator gets their own invitation. They can accept, counter or decline until 17 Oct.');
    fireEvent.press(getByTestId('send-invitations'));
    await waitFor(() => expect(brandApi.sendInvitations).toHaveBeenCalledTimes(1));
    const body = brandApi.sendInvitations.mock.calls[0][2];
    expect(body.creators).toEqual([
      { influencerId: 'p', terms: { commissionPct: 10, scope: 'store', offer: { brandOfferId: 'o1' } } },
      { influencerId: 's', terms: { commissionPct: 12, scope: 'store' } },
    ]);
    expect(n.navigate).toHaveBeenCalledWith('BrandSetDetail', { campaignId: 'c1', setId: 'sA', toast: '2 invitations sent.' });
    expect(draft.getDraft('sA')).toBeNull();
  });

  it('a failed batch names the creators, writes nothing, and "Remove {n} and send the rest" sends the others (check 38)', async () => {
    draft.startDraft('sA', { set: SET, campaignName: 'Diwali Edit 2026', creators: [{ id: 'p', name: 'Priya Sharma' }, { id: 'k', name: 'Kavya D.' }], sourceGroupId: null });
    draft.setTerms('sA', 'p', { ...draft.defaultTerms('conversion'), commissionPct: '10' });
    draft.setTerms('sA', 'k', { ...draft.defaultTerms('conversion'), commissionPct: '10' });
    brandApi.checkEligibility.mockResolvedValue(ok({ results: [] }));
    brandApi.sendInvitations
      .mockResolvedValueOnce({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Kavya D. can no longer be invited to this set.', details: { sent: 0, failures: [{ influencerId: 'k', message: 'Kavya D. can no longer be invited to this set.' }] } } })
      .mockResolvedValueOnce(ok({ sent: 1, rows: [] }));
    const n = nav();
    const { getByText, getByTestId, queryByTestId } = render(<BrandReviewSendScreen navigation={n} route={{ params: { campaignId: 'c1', setId: 'sA' } }} />);
    fireEvent.press(getByTestId('send-invitations'));
    await waitFor(() => getByTestId('failed-banner'));
    getByText("1 creator can't be invited"); getByText('Kavya D. can no longer be invited to this set.');
    expect(n.navigate).not.toHaveBeenCalled();
    fireEvent.press(getByTestId('remove-and-send'));
    await waitFor(() => expect(brandApi.sendInvitations).toHaveBeenCalledTimes(2));
    expect(brandApi.sendInvitations.mock.calls[1][2].creators.map(c => c.influencerId)).toEqual(['p']);
    expect(n.navigate).toHaveBeenCalledWith('BrandSetDetail', { campaignId: 'c1', setId: 'sA', toast: '1 invitation sent.' });
    expect(queryByTestId('failed-banner')).toBeNull();
  });
});

/**
 * The founder's three notes from the walk, 2026-09-16 (screenshots in the thread).
 * Contract: features/item4-campaigns-sets · features/item5-invitations
 */
describe('Add creators — the founder\'s notes of 16 Sep', () => {
  const RICH = [
    { id: 'p', name: 'Priya Sharma', nicheLabel: 'Fashion', cityName: 'Hyderabad', instagram: 193200, youtube: 52000, engagement: 5.1,
      acceptedAims: ['conversion', 'engagement', 'hybrid'], acceptedModes: ['visit', 'shipment'], status: 'OK', pick: { state: 'ok' } },
  ];

  it('shows the same card as the Creators tab — followers, engagement and the Aim/mode tags', async () => {
    brandApi.pickable.mockResolvedValue(ok({ total: 1, page: 1, rows: RICH }));
    const { getByText, getByTestId } = render(<BrandSetPickCreatorsScreen navigation={nav()} route={{ params: { campaignId: 'c1', setId: 'sA' } }} />);
    await waitFor(() => getByTestId('select-p'));
    // The numbers she picks ON. The old compact row showed none of them.
    getByText('193.2K'); getByText('Instagram');
    getByText('52.0K'); getByText('YouTube');
    getByText('5.1%'); getByText('Engagement');
    getByText('Pay for Sale'); getByText('Pay for Content'); getByText('Hybrid'); getByText('📍 Store Visit'); getByText('Remote');
    // and the tick that makes it a pick rather than a browse
    getByTestId('tick-p');
    expect(getByTestId('select-p').props.accessibilityState).toMatchObject({ checked: false, disabled: false });
    fireEvent.press(getByTestId('select-p'));
    expect(getByTestId('select-p').props.accessibilityState.checked).toBe(true);
  });

  it('starts loading the creators without waiting for the set summary (the slow open)', async () => {
    let releaseSummary;
    brandApi.setSummary.mockReturnValue(new Promise(r => { releaseSummary = r; }));
    brandApi.pickable.mockResolvedValue(ok({ total: 1, page: 1, rows: RICH }));
    const { getByTestId, getByText } = render(
      <BrandSetPickCreatorsScreen navigation={nav()} route={{ params: { campaignId: 'c1', setId: 'sA', campaignName: 'Diwali Edit 2026', setName: 'Set A · Ethnic wear' } }} />
    );
    // The summary promise is still pending here, and the creators are already fetched and drawn.
    await waitFor(() => expect(brandApi.pickable).toHaveBeenCalled());
    await waitFor(() => getByTestId('select-p'));
    // The names the caller already knew are on screen too — no wait for them either.
    getByText('DIWALI EDIT 2026 · SET A · ETHNIC WEAR');
    // Next stays inert until the summary lands, because the draft is built from it.
    fireEvent.press(getByTestId('select-p'));
    expect(getByTestId('pick-next').props.accessibilityState.disabled).toBe(true);
    await act(async () => { releaseSummary(ok(SUMMARY)); });
    expect(getByTestId('pick-next').props.accessibilityState.disabled).toBe(false);
  });

  it('a set that arrives asking for creators opens the picker by itself, once', async () => {
    const n = nav();
    const route = { params: { campaignId: 'c1', setId: 'sA', addCreators: true } };
    render(<BrandSetDetailScreen navigation={n} route={route} />);
    await waitFor(() => expect(n.navigate).toHaveBeenCalledWith('BrandSetPickCreators',
      expect.objectContaining({ campaignId: 'c1', setId: 'sA', setName: 'Set A · Ethnic wear' })));
    expect(n.setParams).toHaveBeenCalledWith({ addCreators: undefined });
    expect(n.navigate.mock.calls.filter(c => c[0] === 'BrandSetPickCreators').length).toBe(1);
  });

  it('does not open the picker by itself once invitations have closed', async () => {
    brandApi.setSummary.mockResolvedValue(ok({ ...SUMMARY, set: { ...SET, cutoffPassed: true, canInvite: { ok: false, reason: 'cutoff_passed' } } }));
    const n = nav();
    render(<BrandSetDetailScreen navigation={n} route={{ params: { campaignId: 'c1', setId: 'sA', addCreators: true } }} />);
    await waitFor(() => expect(n.setParams).toHaveBeenCalled());
    expect(n.navigate.mock.calls.filter(c => c[0] === 'BrandSetPickCreators').length).toBe(0);
  });
});
