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
    // creator-terms-v2
    offerChoices: jest.fn(), productsWithoutOffersForSet: jest.fn(), getListingTree: jest.fn(),
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
const row = (o) => ({ id: o.id, influencerId: `i-${o.id}`, name: o.name, avatarUrl: null, status: o.status || 'invited', group: o.group || 'waiting', termsLine: o.termsLine || '10% · 2 offers + 12 products',
  sentAt: `${yr}-09-12T10:00:00Z`, answeredAt: o.answeredAt || null, signedAt: null, declineReasonLabel: o.declineReasonLabel || null, deferredGoLiveDate: o.deferredGoLiveDate || null,
  actions: { withdraw: (o.status || 'invited') === 'invited', remove: !['withdrawn', 'removed', 'declined', 'expired'].includes(o.status || 'invited'), viewTerms: true, sendAgreement: o.group === 'yourMove' && (o.status || 'invited') === 'accepted' }, ...o });
const GROUPS = {
  // Item 7 (P1): an accepted creator with a draft agreement is the brand's move.
  order: ['yourMove', 'waiting', 'negotiating', 'accepted', 'signed', 'deferred', 'declined', 'expired', 'withdrawn'],
  groups: {
    waiting: { key: 'waiting', count: 2, more: 0, rows: [row({ id: 'r1', name: 'Priya Sharma' }), row({ id: 'r2', name: 'Tanvi S.', termsLine: '12% · 40 products at normal price' })] },
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
  // ui-walk-fixes D2: a creator who can't be invited arrives with the server's short reason and
  // its sentence (the set in these tests is Pay for Sale, so that is the Aim she has switched off).
  { id: 'k', name: 'Kavya D.', nicheLabel: 'Fashion', cityName: 'Hyderabad', instagram: 12000,
    pick: { state: 'ineligible', reason: 'NOT_MATCHING', detail: 'aim', label: 'Not taking Pay for Sale', message: "Kavya isn't taking Pay for Sale collaborations.", inSet: 'none' } },
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
  // creator-terms-v2 — posting 20 Oct: two valid offers (one ends 25 Oct), two left out; three products without offers.
  brandApi.offerChoices.mockResolvedValue(ok({ posting_date: `${yr}-10-20`,
    offers: [
      { id: 'o1', name: "20% off Levi's Jeans", type_label: 'Discount · %', products: 24, gifts: 0, starts_on: `${yr}-10-01`, ends_on: `${yr}-10-31`, ends_soon: null },
      { id: 'o2', name: 'Buy 2 T-shirts → 30%', type_label: 'Volume · Qty', products: 15, gifts: 0, starts_on: `${yr}-10-05`, ends_on: `${yr}-10-25`, ends_soon: { days_after_posting: 5 } },
    ],
    hidden: [{ name: 'Late', why: 'starts', date: `${yr}-10-30` }, { name: 'Gone', why: 'ended', date: `${yr}-10-05` }] }));
  brandApi.productsWithoutOffersForSet.mockResolvedValue(ok({ posting_date: `${yr}-10-20`, products: [
    { id: 'f1', name: 'Oxford white', price: 1299, leaf_name: 'Shirts', next_offer: null, last_offer: { name: 'Summer', until: `${yr}-10-05` } },
    { id: 'f2', name: 'Oxford blue', price: 1299, leaf_name: 'Shirts', next_offer: null, last_offer: null },
    { id: 'f3', name: 'Chino', price: 1499, leaf_name: 'Trousers', next_offer: null, last_offer: null },
  ] }));
  brandApi.getListingTree.mockResolvedValue(ok({ tree: [] }));
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
    getByText('10% · 2 offers + 12 products · sent 12 Sep'); getByText('Accepted 13 Sep'); getByText('Fee too low');
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
    const { getByText, getByTestId, getAllByText, queryByText } = render(<BrandSetPickCreatorsScreen navigation={n} route={{ params: { campaignId: 'c1', setId: 'sA' } }} />);
    await waitFor(() => getByTestId('select-p'));
    getByText('DIWALI EDIT 2026 · SET A · ETHNIC WEAR');
    // ui-walk-fixes D2 (2 Oct 2026): the grey sentence above the list is gone …
    expect(queryByText(/can't be picked/)).toBeNull();
    expect(queryByText(/never shown to them/)).toBeNull();
    // … and her row says why, in the server's short reason, instead of "Not open to this set".
    getByText('Not taking Pay for Sale'); expect(queryByText('Not open to this set')).toBeNull();
    getByText("Can't invite"); getByText('Already in this set'); getByText('Invited');
    // She still cannot be picked. Her row is no longer switched off — it has to take the tap that
    // says why (the board B tests below) — so "cannot be picked" is proved by tapping her: no
    // tick, nobody in the basket, Next still counts nobody.
    expect(getByTestId('select-k').props.accessibilityState).toMatchObject({ checked: false, disabled: false });
    fireEvent.press(getByTestId('select-k'));
    expect(getByTestId('select-k').props.accessibilityState.checked).toBe(false);
    expect(draft.getBasket('sA')).toEqual([]);
    // One already in the set is ticked and locked, and a tap on her changes nothing.
    expect(getByTestId('select-a').props.accessibilityState).toMatchObject({ checked: true, disabled: true });
    fireEvent.press(getByTestId('select-a'));
    expect(draft.getBasket('sA')).toEqual([]);
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

describe('I3 · I4 · I5 — terms, creator by creator (creator-terms-v2: offers + products without offers)', () => {
  const start = (goal, creators = [{ id: 'p', name: 'Priya Sharma' }, { id: 's', name: 'Sneha N.' }]) =>
    draft.startDraft('sA', { set: { ...SET, goal }, campaignName: 'Diwali Edit 2026', creators, sourceGroupId: null });

  it('Pay for Sale: the locked set card, commission required, the minimum warning that never blocks, something to sell required, shoppable posts read-only (checks 6, 10; T1, T2, T5)', async () => {
    start('conversion');
    const n = nav();
    const { getByText, getByTestId, queryByTestId } = render(<BrandCreatorTermsScreen navigation={n} route={{ params: { campaignId: 'c1', setId: 'sA', index: 0 } }} />);
    getByText('Creator 1 of 2'); getByText('🔒 Set terms, same for everyone'); getByText('Pay for Sale'); getByText(`20 Oct ${yr}`); getByText('Store Visit · Banjara Hills');
    getByText('1 post · set by INFLX', { exact: false });
    // the retired pieces are gone: no scope chips, no follower offer row
    expect(queryByTestId('scope-store')).toBeNull(); expect(queryByTestId('offer-row')).toBeNull();
    getByText('Offers'); getByText('None given'); getByText('Products without offers');
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
    // T5: nothing to sell yet → Next is refused in her name
    fireEvent.press(getByTestId('terms-next'));
    getByText(`⚠ ${MSG5.SELL_NOTHING('Priya')}`);
    expect(n.push).not.toHaveBeenCalled();
    // T2: the offers checklist — only offers valid on the posting day or the day after; the ends-soon warning; the ones left out
    fireEvent.press(getByTestId('sell-offers'));
    await waitFor(() => getByText('Offers for Priya'));
    getByText(`Your offers that start by 20 Oct and end after it.`);   // posting-date-last-day: was "valid on the posting day or the day after"
    getByText('⚠ Ends 25 Oct, 5 days after posting. Her posts using it leave the shop then.');
    getByText("2 offers aren't listed: one starts 30 Oct, one ended 5 Oct.");
    fireEvent.press(getByTestId('offer-o1'));
    fireEvent.press(getByTestId('offer-o2'));
    getByText('2 of 2 picked');
    fireEvent.press(getByTestId('offers-give'));
    getByText('2 offers · 39 products');
    getByText('She can sell: 2 offers (39 products)');
    getByText('Commission: 10% on every sale');
    fireEvent.press(getByTestId('terms-next'));
    expect(n.push).toHaveBeenCalledWith('BrandCreatorTerms', { campaignId: 'c1', setId: 'sA', index: 1 });
    const t = draft.getDraft('sA').terms.p;
    expect(t.commissionPct).toBe('10');
    expect(t.sellOffers.map(o => o.id)).toEqual(['o1', 'o2']);
    expect(draft.toServer('conversion', t)).toEqual({ commissionPct: 10, offers: ['o1', 'o2'], productsWithoutOffers: { mode: 'none' } });
  });

  it('above 50% asks once and is then accepted (check 41)', async () => {
    start('conversion');
    draft.setTerms('sA', 'p', { ...draft.defaultTerms('conversion'), sellMode: 'all', sellAllCount: 3 });
    const n = nav();
    const { getByText, getByTestId } = render(<BrandCreatorTermsScreen navigation={n} route={{ params: { campaignId: 'c1', setId: 'sA', index: 0 } }} />);
    fireEvent.changeText(getByTestId('commission'), '60');
    fireEvent.press(getByTestId('terms-next'));
    getByText("That's more than half of every sale. Are you sure?");
    fireEvent.press(getByText('Yes, keep it'));
    expect(n.push).toHaveBeenCalledWith('BrandCreatorTerms', { campaignId: 'c1', setId: 'sA', index: 1 });
    expect(draft.getDraft('sA').over50Confirmed).toBe(true);
  });

  // ui-walk-fixes (board D, frames D1–D5 · check 12). The deliverables part of this walk used to
  // reach "You've already added that" by tapping a second line's type pill and "Choose between 1
  // and 20" by typing 21. The locked board removes both controls: a type that has a line cannot be
  // chosen again and the number stops at 20, so neither sentence can be reached from the screen any
  // more. The walk now proves exactly that; the two sentences are asserted directly on the rule in
  // components/invitations/__tests__/draft5.test.js (check 13). Recorded in 06-diff/drift/D.md.
  it('Pay for Content: fee, deliverables (empty, one line each from the list that opens in place, minus / plus), usage rights need a place; "Use these terms for everyone" copies (checks 7, 9, 11 · board D)', async () => {
    const { within } = require('@testing-library/react-native');
    start('engagement');
    const n = nav();
    const { getByText, getByTestId, queryByText, queryByTestId } = render(<BrandCreatorTermsScreen navigation={n} route={{ params: { campaignId: 'c1', setId: 'sA', index: 0 } }} />);
    getByText('Paid 25% on signing, 25% when the content is live, 50% after it stays live — once her shoppable posts are approved.');
    // Item 21 (rules v1.34 §7A): Pay for Content now asks how many shoppable posts, and what she posts about (board T1).
    getByTestId('posts-field'); within(getByTestId('sell-field')).getAllByText('What she posts about', { exact: false }); getByTestId('sell-store');
    within(getByTestId('posts-field')).getByText(C5.terms.postsNHint);
    fireEvent.press(getByTestId('terms-next'));
    getByText(MSG5.FEE_REQUIRED);
    getByText(`⚠ ${MSG5.POST_ABOUT_NOTHING('Priya')}`);
    fireEvent.changeText(getByTestId('fee'), '8000');
    fireEvent.changeText(getByTestId('posts'), '3');
    fireEvent.press(getByTestId('sell-store'));                      // Entire store, in one tap
    getByText('She posts about: your entire store · 3 shoppable posts');
    getByText(C5.sell.noCommission);
    expect(queryByText(`⚠ ${MSG5.POST_ABOUT_NOTHING('Priya')}`)).toBeNull();
    // D1: a new invitation still starts with one line — Instagram reel, 1 — and the hint under it.
    within(getByTestId('deliverables-row-0-type')).getByText('Instagram reel');
    within(getByTestId('deliverables-row-0-count-value')).getByText('1');
    getByText(C5.terms.deliverHint);
    // D5: every line removed, then Next — only the button and the hint are left, with the red line.
    fireEvent.press(getByTestId('deliverables-row-0-remove'));
    fireEvent.press(getByTestId('terms-next'));
    getByText(MSG5.DELIVERABLES_EMPTY);
    expect(queryByTestId('deliverables-row-0')).toBeNull();
    getByText(C5.terms.deliverHint);
    expect(n.push).not.toHaveBeenCalled();
    // D2: "+ Add another" asks which type — the five open in place — and no line is added until one is chosen.
    fireEvent.press(getByTestId('deliverables-add'));
    getByTestId('deliverables-list');
    expect(queryByTestId('deliverables-row-0')).toBeNull();
    fireEvent.press(getByTestId('deliverables-add-reel'));
    within(getByTestId('deliverables-row-0-type')).getByText('Instagram reel');
    expect(queryByTestId('deliverables-list')).toBeNull();          // choosing closes it
    expect(queryByText(MSG5.DELIVERABLES_EMPTY)).toBeNull();        // the red line goes as soon as one is added
    // The old walk's duplicate: a second Instagram reel. It is grey with "Added" and takes no tap.
    fireEvent.press(getByTestId('deliverables-add'));
    within(getByTestId('deliverables-add-reel')).getByText('Added');
    expect(getByTestId('deliverables-add-reel').props.accessibilityState.disabled).toBe(true);
    fireEvent.press(getByTestId('deliverables-add-reel'));
    expect(queryByTestId('deliverables-row-1')).toBeNull();
    fireEvent.press(getByTestId('deliverables-add-story'));
    within(getByTestId('deliverables-row-1-type')).getByText('Instagram story');
    // D3: nor can line 2 be turned into a second reel from its own type box.
    fireEvent.press(getByTestId('deliverables-row-1-type'));
    within(getByTestId('deliverables-row-1-reel')).getByText('Added');
    fireEvent.press(getByTestId('deliverables-row-1-reel'));
    within(getByTestId('deliverables-row-1-type')).getByText('Instagram story');
    fireEvent.press(getByTestId('deliverables-row-1-type'));       // a second tap on the box closes the list (U12)
    expect(queryByTestId('deliverables-list')).toBeNull();
    // The old walk's count: the number is minus / plus now, with no box to type 21 into.
    expect(getByTestId('deliverables-row-1-count').type).not.toBe('TextInput');
    fireEvent.press(getByTestId('deliverables-row-1-count-plus'));
    within(getByTestId('deliverables-row-1-count-value')).getByText('2');
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
    // Item 21 (R10): the posts number and the Entire store are copied too, and sent as the server reads them.
    expect(d.terms.s.posts).toBe('3');
    expect(d.terms.s.sellMode).toBe('store');
    expect(draft.toServer('engagement', d.terms.p)).toMatchObject({ fee: 8000, shoppablePosts: 3, offers: [], productsWithoutOffers: { mode: 'store' } });
  });

  it('Hybrid refuses a ₹0 fixed fee; "All products without offers" and "Use these terms for everyone" copy the product list (checks 8, 11; T3, rules 2.5)', async () => {
    start('hybrid');
    const n = nav();
    const { getByText, getByTestId, queryByText } = render(<BrandCreatorTermsScreen navigation={n} route={{ params: { campaignId: 'c1', setId: 'sA', index: 0 } }} />);
    fireEvent.changeText(getByTestId('fee'), '0');
    fireEvent.changeText(getByTestId('commission'), '10');
    fireEvent.press(getByTestId('terms-next'));
    getByText(MSG5.HYBRID_FEE);
    expect(queryByText('What she delivers')).toBeNull();
    fireEvent.changeText(getByTestId('fee'), '5000');
    fireEvent.press(getByTestId('sell-products'));
    await waitFor(() => getByText('3 products, fixed when you send'));
    getByText('Sold at normal price. Only products not in any offer from today on are shown.');   // posting-date-last-day: was "on or after 20 Oct"
    getByText("To give a product that's in an offer, give its offer.");
    fireEvent.press(getByTestId('products-all'));
    fireEvent.press(getByTestId('products-done'));
    getByText('3 products · normal price');
    getByText('She can sell: 3 products at normal price');
    fireEvent(getByTestId('everyone-switch'), 'valueChange', true);
    fireEvent.press(getByTestId('terms-next'));
    const d = draft.getDraft('sA');
    expect(d.terms.p).toMatchObject({ sellMode: 'all', sellAllCount: 3 });
    expect(d.terms.s).toMatchObject({ sellMode: 'all', sellAllCount: 3, fee: '5000' });
    expect(draft.toServer('hybrid', d.terms.s)).toEqual({ commissionPct: 10, fee: 5000, offers: [], productsWithoutOffers: { mode: 'all' } });
  });

  it('choosing products (T4): search, tick, "Use N products"; the chosen list is sent as chosen', async () => {
    start('conversion');
    draft.setTerms('sA', 'p', { ...draft.defaultTerms('conversion'), commissionPct: '10' });
    const n = nav();
    const { getByText, getByTestId } = render(<BrandCreatorTermsScreen navigation={n} route={{ params: { campaignId: 'c1', setId: 'sA', index: 0 } }} />);
    fireEvent.press(getByTestId('sell-products'));
    await waitFor(() => getByTestId('products-choose'));
    fireEvent.press(getByTestId('products-choose'));
    await waitFor(() => getByTestId('choose-products'));
    fireEvent.press(getByTestId('choose-tab-1'));
    fireEvent.changeText(getByTestId('choose-search'), 'oxford');
    await waitFor(() => getByTestId('choose-product-f1'));
    getByText('₹1,299 · offer ended 5 Oct');
    fireEvent.press(getByTestId('choose-product-f1'));
    fireEvent.press(getByTestId('choose-use'));
    await waitFor(() => getByText('1 picked · Shirts'));
    fireEvent.press(getByTestId('products-done'));
    getByText('1 product · normal price');
    fireEvent.press(getByTestId('terms-next'));
    expect(draft.toServer('conversion', draft.getDraft('sA').terms.p)).toEqual({ commissionPct: 10, offers: [], productsWithoutOffers: { mode: 'chosen', productIds: ['f1'] } });
  });

  it('no offer valid on the posting day (T6): says so, points to the website, and products can still be given', async () => {
    start('conversion');
    brandApi.offerChoices.mockResolvedValue(ok({ posting_date: `${yr}-10-20`, offers: [], hidden: [] }));
    const n = nav();
    const { getByText, getByTestId } = render(<BrandCreatorTermsScreen navigation={n} route={{ params: { campaignId: 'c1', setId: 'sA', index: 0 } }} />);
    fireEvent.press(getByTestId('sell-offers'));
    await waitFor(() => getByTestId('offers-empty'));
    getByText('No offers valid on 20 Oct');
    getByText('Offers are built on the INFLX website. Build one that runs on 20 Oct or 21 Oct, or give her products without offers instead.');
    getByTestId('offers-build-web');
  });
});

describe('I8 — Review and send (creator-terms-v2)', () => {
  const ALL = { sellMode: 'all', sellAllCount: 40 };
  const O1 = { id: 'o1', name: '20% off Levi\'s Jeans', products: 24, ends_soon: null };
  const SOON = { id: 'o3', name: 'Buy 2 T-shirts → 30%', products: 10, ends_soon: { days_after_posting: 5 } };

  it('a sent basket is a spent basket (one-basket check 13)', async () => {
    draft.addToBasket('sA', [{ id: 'p', name: 'Priya Sharma' }]);
    draft.startDraft('sA', { set: SET, campaignName: 'Diwali Edit 2026', creators: [{ id: 'p', name: 'Priya Sharma' }], sourceGroupId: null });
    draft.setTerms('sA', 'p', { ...draft.defaultTerms('conversion'), commissionPct: '10', ...ALL });
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
    draft.setTerms('sA', 'p', { ...draft.defaultTerms('conversion'), commissionPct: '10', ...ALL });
    draft.setTerms('sA', 't', { ...draft.defaultTerms('conversion'), commissionPct: '10', ...ALL });
    brandApi.sendInvitations.mockResolvedValue(ok({ sent: 2, rows: [] }));
    const n = nav();
    const { getByText, getByTestId } = render(<BrandReviewSendScreen navigation={n} route={{ params: { campaignId: 'c1', setId: 'sA' } }} />);
    await waitFor(() => getByTestId('review-row-p'));
    getByText('from Diwali shortlist');
    fireEvent.press(getByTestId('send-invitations'));
    await waitFor(() => expect(brandApi.sendInvitations).toHaveBeenCalled());
    const body = brandApi.sendInvitations.mock.calls[0][2];
    const byId = Object.fromEntries(body.creators.map(c => [c.influencerId, c]));
    expect(byId.t.sourceGroupId).toBe('g1');
    expect(byId.p.sourceGroupId).toBeUndefined();
    expect(body.sourceGroupId).toBeUndefined();
  });

  it('rows read "commission · offers + products"; Below min, Ends soon and OK; the two warnings; Send carries offers + products (check 17, T7)', async () => {
    draft.startDraft('sA', { set: SET, campaignName: 'Diwali Edit 2026', creators: [{ id: 'p', name: 'Priya Sharma' }, { id: 's', name: 'Sneha N.' }, { id: 'd', name: 'Divya R.' }], sourceGroupId: null });
    draft.setTerms('sA', 'p', { ...draft.defaultTerms('conversion'), commissionPct: '10', sellOffers: [O1], sellMode: 'chosen', sellProductIds: ['f1'], sellProducts: [{ id: 'f1', name: 'Oxford white' }] });
    draft.setTerms('sA', 's', { ...draft.defaultTerms('conversion'), commissionPct: '12', sellOffers: [SOON] });
    draft.setTerms('sA', 'd', { ...draft.defaultTerms('conversion'), commissionPct: '10', ...ALL });
    brandApi.sendInvitations.mockResolvedValue(ok({ sent: 3, rows: [] }));
    const n = nav();
    const { getByText, getByTestId } = render(<BrandReviewSendScreen navigation={n} route={{ params: { campaignId: 'c1', setId: 'sA' } }} />);
    getByText('All 3 creators'); getByText(`Replies close`); getByText(`17 Oct ${yr}`);
    getByText('10% · 1 offer + 1 product'); getByText('12% · 1 offer · no other products'); getByText('10% · 40 products at normal price');
    await waitFor(() => getByText('Below min'));
    getByText('Ends soon'); getByText('OK');
    getByText('1 creator is below their own minimum. They can still be invited and can counter.');
    getByText('⚠ 1 creator was given an offer that ends 5 days after posting.');
    fireEvent.press(getByTestId('send-invitations'));
    await waitFor(() => expect(brandApi.sendInvitations).toHaveBeenCalledTimes(1));
    const body = brandApi.sendInvitations.mock.calls[0][2];
    expect(body.creators).toEqual([
      { influencerId: 'p', terms: { commissionPct: 10, offers: ['o1'], productsWithoutOffers: { mode: 'chosen', productIds: ['f1'] } } },
      { influencerId: 's', terms: { commissionPct: 12, offers: ['o3'], productsWithoutOffers: { mode: 'none' } } },
      { influencerId: 'd', terms: { commissionPct: 10, offers: [], productsWithoutOffers: { mode: 'all' } } },
    ]);
    expect(n.navigate).toHaveBeenCalledWith('BrandSetDetail', { campaignId: 'c1', setId: 'sA', toast: '3 invitations sent.' });
    expect(draft.getDraft('sA')).toBeNull();
  });

  it('a failed batch names the creators, writes nothing, and "Remove {n} and send the rest" sends the others (check 38)', async () => {
    draft.startDraft('sA', { set: SET, campaignName: 'Diwali Edit 2026', creators: [{ id: 'p', name: 'Priya Sharma' }, { id: 'k', name: 'Kavya D.' }], sourceGroupId: null });
    draft.setTerms('sA', 'p', { ...draft.defaultTerms('conversion'), commissionPct: '10', ...ALL });
    draft.setTerms('sA', 'k', { ...draft.defaultTerms('conversion'), commissionPct: '10', ...ALL });
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
    { id: 'p', name: 'Priya Sharma', nicheLabel: 'Fashion', cityName: 'Hyderabad', distance_km: 32, languages: ['Telugu', 'English'],
      instagram: 193200, youtube: 52000, engagement: 5.1,
      acceptedAims: ['conversion', 'engagement', 'hybrid'], acceptedModes: ['visit', 'shipment'], status: 'OK', pick: { state: 'ok' } },
  ];

  /**
   * REWRITTEN 2 Oct 2026 — ui-walk-fixes board B (frame B1), founder decisions D1 and D2.
   * On 16 Sep the founder asked for "the same card as the Creators tab" here, and this test
   * pinned that card: three labelled numbers and the five Aim/mode tags. On 2 Oct he replaced
   * it for the pickers: "remove this [Pay for Sale / Pay for Content / Hybrid / +] no need to
   * mention this" — a compact row of three lines. Every number he picks ON is still asserted;
   * what is asserted ABSENT is exactly what he asked to be removed. Recorded as drift (B.md).
   */
  it('shows the compact pick row — her name, niche · city · distance · languages and all three numbers; no tag line, no hint sentence (board B1, D1, D2)', async () => {
    brandApi.pickable.mockResolvedValue(ok({ total: 1, page: 1, rows: RICH }));
    const { getByText, getByTestId, queryByText } = render(<BrandSetPickCreatorsScreen navigation={nav()} route={{ params: { campaignId: 'c1', setId: 'sA' } }} />);
    await waitFor(() => getByTestId('select-p'));
    // Line 1: her name. Line 2: where and what. Line 3: the numbers she picks ON — all three.
    expect(getByTestId('pick-name-p').props.children).toBe('Priya Sharma');
    getByText('Fashion · Hyderabad · 32 km · Telugu, English');
    getByText('193.2K IG · 52.0K YT · 5.1% eng');
    // Each is ONE line, cut with … when it runs long — that is what keeps the row three lines tall.
    for (const id of ['pick-name-p', 'pick-line-p', 'pick-numbers-p']) expect(getByTestId(id).props.numberOfLines).toBe(1);
    // D1: no tag line …
    for (const t of ['Pay for Sale', 'Pay for Content', 'Hybrid', '📍 Store Visit', 'Store Visit', 'Remote']) expect(queryByText(t)).toBeNull();
    // … and not the full card's three labelled numbers either: this is a row, not the card.
    for (const t of ['Instagram', 'YouTube', 'Engagement', '193.2K', '52.0K', '5.1%']) expect(queryByText(t)).toBeNull();
    // D2: the grey sentence is gone from the screen.
    expect(queryByText(/can't be picked/)).toBeNull();
    expect(queryByText(/never shown to them/)).toBeNull();
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

/**
 * ui-walk-fixes board B — "Add creators: give the list the screen" (locked 2 Oct 2026).
 * Frames B1–B5 and B10, founder decisions D1 (the compact row) and D2 (say why she can't be
 * invited). Expected-outputs checks 5, 6, 6a and the Jest half of 7.
 * Contract: features/ui-walk-fixes
 */
describe('ui-walk-fixes board B — Add creators for a set', () => {
  const { Keyboard, StyleSheet } = require('react-native');
  const { settingsTokens: T } = require('../../../theme/tokens');
  const { pickStateOf } = require('../BrandSetPickCreatorsScreen');
  const SENTENCE = "Kavya isn't taking Pay for Sale collaborations.";
  const flat = (el) => StyleSheet.flatten(el.props.style) || {};
  // "this element reads exactly that" — throws when the text is not inside it.
  const says = (el, text) => require('@testing-library/react-native').within(el).getByText(text);
  const open = (n = nav(), params = {}) => render(<BrandSetPickCreatorsScreen navigation={n} route={{ params: { campaignId: 'c1', setId: 'sA', ...params } }} />);
  const lastAll = () => brandApi.pickable.mock.calls.filter(c => c[2].tab === 'all' && !c[2].countOnly).pop()[2];

  // jest has no keypad: the two events React Native sends are fired by hand.
  let pad, errorSpy;
  beforeEach(() => {
    const handlers = { keyboardDidShow: [], keyboardDidHide: [] };
    const spy = jest.spyOn(Keyboard, 'addListener').mockImplementation((event, fn) => {
      (handlers[event] = handlers[event] || []).push(fn);
      return { remove: () => { handlers[event] = handlers[event].filter(f => f !== fn); } };
    });
    pad = {
      show: () => act(() => { handlers.keyboardDidShow.forEach(f => f({ endCoordinates: { height: 280 } })); }),
      hide: () => act(() => { handlers.keyboardDidHide.forEach(f => f()); }),
      restore: () => spy.mockRestore(),
    };
    // React reports a clash of keys and similar tree mistakes only here.
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    const said = errorSpy.mock.calls.map(c => String(c[0]));
    errorSpy.mockRestore();
    pad.restore();
    expect(said).toEqual([]);
  });

  it('B1: the campaign / set line is the title bar\'s second line, and ONE control row holds the search box and a single Filters button', async () => {
    const { getByTestId, getByText, queryByTestId, queryByText } = open();
    await waitFor(() => getByTestId('select-p'));
    // One Text node, exactly as before — now inside the shared title bar.
    expect(getByTestId('pick-subline').props.children).toBe('DIWALI EDIT 2026 · SET A · ETHNIC WEAR');
    expect(getByTestId('pick-subline').props.numberOfLines).toBe(1);
    // The row: search + Filters, side by side.
    expect(flat(getByTestId('discover-controls')).flexDirection).toBe('row');
    getByTestId('discover-search');
    says(getByTestId('open-filters'), 'Filters');
    // The chips row is gone: no "Open to invitations" chip, no summary chip, no "Clear all" yet.
    expect(queryByTestId('quick-open')).toBeNull();
    expect(queryByText('Open to invitations')).toBeNull();
    expect(queryByText('Clear all')).toBeNull();
    // The count leads the list, with the sort beside it.
    getByText('3 creators'); getByText('Nearest first ▾');
    // "Open to invitations only" is still ON when you arrive from a set — it just lives in the sheet.
    expect(lastAll()).toMatchObject({ openOnly: true, sort: 'distance', within: 'any', page: 1 });
    fireEvent.press(getByTestId('open-filters'));
    await waitFor(() => getByTestId('filters-sheet'));
    getByText('Open to invitations only');
    expect(getByTestId('filter-openonly').props.value).toBe(true);
    await waitFor(() => expect(getByTestId('filters-apply').props.accessibilityState.disabled).toBe(false));
  });

  it('B3: the button reads "Filters · N" while filters are on, the count line gains "Clear all", and Clear all puts everything back', async () => {
    const { getByTestId, getByText, queryByText } = open();
    await waitFor(() => getByTestId('select-p'));
    fireEvent.press(getByTestId('open-filters'));
    await waitFor(() => getByTestId('filters-sheet'));
    // Two changes: "Open to invitations only" off, and a distance.
    fireEvent(getByTestId('filter-openonly'), 'valueChange', false);
    fireEvent.press(getByTestId('filter-within-50'));
    await waitFor(() => expect(getByTestId('filters-apply').props.accessibilityState.disabled).toBe(false));
    await act(async () => { fireEvent.press(getByTestId('filters-apply')); });
    await waitFor(() => expect(lastAll()).toMatchObject({ openOnly: false, within: '50', page: 1 }));
    await waitFor(() => getByTestId('select-p'));
    says(getByTestId('open-filters'), 'Filters · 2');
    // The button's outline turns ink while a filter is on.
    expect(flat(getByTestId('open-filters')).borderColor).toBe(T.ink);
    // "Clear all" sits on the count line, underlined; the old summary chip is not drawn.
    expect(flat(getByText('Clear all')).textDecorationLine).toBe('underline');
    expect(queryByText(/✕/)).toBeNull();
    await act(async () => { fireEvent.press(getByText('Clear all')); });
    await waitFor(() => expect(lastAll()).toMatchObject({ openOnly: true, within: 'any', page: 1 }));
    await waitFor(() => getByTestId('select-p'));
    says(getByTestId('open-filters'), 'Filters');
    expect(flat(getByTestId('open-filters')).borderColor).toBe(T.border);
    expect(queryByText('Clear all')).toBeNull();
  });

  it('U12: "Nearest first ▾" opens the Filters sheet — there is no second menu in the pinned area', async () => {
    const { getByTestId, getByText, queryByTestId } = open();
    await waitFor(() => getByTestId('select-p'));
    expect(queryByTestId('filters-sheet')).toBeNull();
    fireEvent.press(getByTestId('sort-toggle'));
    await waitFor(() => getByTestId('filters-sheet'));
    // The old drop-down's rows are not drawn anywhere; the sheet's Sort group is the one home.
    for (const k of ['distance', 'followers', 'engagement', 'newest']) expect(queryByTestId(`sort-${k}`)).toBeNull();
    expect(getByTestId('filter-sort-distance').props.accessibilityState.selected).toBe(true);
    fireEvent.press(getByTestId('filter-sort-followers'));
    await waitFor(() => expect(getByTestId('filters-apply').props.accessibilityState.disabled).toBe(false));
    await act(async () => { fireEvent.press(getByTestId('filters-apply')); });
    await waitFor(() => expect(lastAll()).toMatchObject({ sort: 'followers', page: 1 }));
    await waitFor(() => getByText('Most followers ▾'));
    // A sort orders, it never narrows: the button does not count it and there is nothing to clear.
    says(getByTestId('open-filters'), 'Filters');
  });

  it('B1: a creator who can\'t be invited is greyed on her face and name only — the chip and the line that says why stay readable, and she has no numbers line', async () => {
    const { getByTestId, getByText, queryByTestId } = open();
    await waitFor(() => getByTestId('select-k'));
    expect(flat(getByTestId('pick-name-k')).opacity).toBe(0.5);
    // The reason line: the server's short reason, not dimmed, in the readable grey.
    expect(getByTestId('pick-line-k').props.children).toBe('Not taking Pay for Sale');
    expect(flat(getByTestId('pick-line-k')).opacity).toBeUndefined();
    expect(flat(getByTestId('pick-line-k')).color).toBe(T.ink2);
    // The row as a whole is NOT faded (that is what made the old line unreadable).
    expect(flat(getByTestId('select-k')).opacity).toBe(1);
    expect(queryByTestId('pick-numbers-k')).toBeNull();
    getByText("Can't invite");
    // Her tick is the unusable one: grey fill, nothing in it.
    expect(flat(getByTestId('tick-k')).backgroundColor).toBe(T.surface);
    // "Already in this set" + "Invited" is unchanged in words; ticked, locked, greyed the same way.
    expect(getByTestId('pick-line-a').props.children).toBe('Already in this set');
    expect(flat(getByTestId('pick-name-a')).opacity).toBe(0.5);
    expect(flat(getByTestId('tick-a')).backgroundColor).toBe(T.surface);
    getByText('Invited');
    // A creator who can be picked is not dimmed and keeps all three lines.
    expect(flat(getByTestId('pick-name-p')).opacity).toBeUndefined();
    getByTestId('pick-line-p'); getByTestId('pick-numbers-p');
  });

  it('B2: tapping a creator who can\'t be invited shows the server\'s sentence in the screen\'s toast, and picks nobody', async () => {
    const { getByTestId, getByText, queryByTestId, queryByText } = open();
    await waitFor(() => getByTestId('select-k'));
    expect(queryByTestId('toast')).toBeNull();
    expect(queryByText(SENTENCE)).toBeNull();
    fireEvent.press(getByTestId('select-k'));
    says(getByTestId('toast'), SENTENCE);
    // She stays unticked and the button does not change.
    expect(getByTestId('select-k').props.accessibilityState.checked).toBe(false);
    expect(draft.getBasket('sA')).toEqual([]);
    getByText('Next: terms for 0 creators');
    expect(getByTestId('pick-next').props.accessibilityState.disabled).toBe(true);
    // A creator already in this set has nothing more to say: her row is dead, as before.
    fireEvent.press(getByTestId('select-a'));
    says(getByTestId('toast'), SENTENCE);
  });

  it('B10: the row and the toast are whatever the server composed — each of the five reasons is printed as sent, none is worded on the phone', async () => {
    const REASONS = [
      ['aim', 'Not taking Pay for Content', "Asha isn't taking Pay for Content collaborations."],
      ['mode', 'Not taking Store Visit', "Asha isn't taking Store Visit collaborations."],
      ['category', 'Not taking your category', "Asha isn't taking invitations from brands in your category."],
      ['visit_city', 'No store visits in Hyderabad', "Asha doesn't do store visits in Hyderabad."],
      ['not_accepting', 'Not taking invitations', "Asha isn't taking invitations right now."],
    ];
    brandApi.pickable.mockResolvedValue(ok({ total: REASONS.length, page: 1, rows: REASONS.map(([detail, label, message]) => (
      { id: detail, name: 'Asha K.', nicheLabel: 'Fashion', cityName: 'Guntur', instagram: 9000,
        pick: { state: 'ineligible', reason: detail === 'not_accepting' ? 'NOT_ACCEPTING' : 'NOT_MATCHING', detail, label, message, inSet: 'none' } }
    )) }));
    const { getByTestId } = open();
    await waitFor(() => getByTestId('select-aim'));
    for (const [detail, label, message] of REASONS) {
      expect(getByTestId(`pick-line-${detail}`).props.children).toBe(label);
      fireEvent.press(getByTestId(`select-${detail}`));
      says(getByTestId('toast'), message);
    }
    expect(draft.getBasket('sA')).toEqual([]);
  });

  it('an older server: no sentence falls back to its short reason; neither falls back to "Not open to this set"', async () => {
    expect(pickStateOf({ pick: { state: 'ineligible', label: 'Not taking Hybrid', message: 'Asha isn\'t taking Hybrid collaborations.' } }))
      .toEqual({ state: 'ineligible', label: 'Not taking Hybrid', chip: "Can't invite", message: 'Asha isn\'t taking Hybrid collaborations.' });
    expect(pickStateOf({ pick: { state: 'ineligible', label: 'Not open to this set' } }))
      .toEqual({ state: 'ineligible', label: 'Not open to this set', chip: "Can't invite", message: 'Not open to this set' });
    expect(pickStateOf({ pick: { state: 'ineligible' } }))
      .toEqual({ state: 'ineligible', label: 'Not open to this set', chip: "Can't invite", message: 'Not open to this set' });
    expect(pickStateOf({ pick: { state: 'invited', label: 'Already in this set' } })).toEqual({ state: 'invited', label: 'Already in this set', chip: 'Invited' });
    expect(pickStateOf({ pick: { state: 'ok' } })).toEqual({ state: 'ok' });
    expect(pickStateOf({})).toEqual({ state: 'ok' });

    brandApi.pickable.mockResolvedValue(ok({ total: 2, page: 1, rows: [
      { id: 'o1', name: 'Old One', pick: { state: 'ineligible', label: 'Not taking invitations' } },
      { id: 'o2', name: 'Older Two', pick: { state: 'ineligible' } },
    ] }));
    const { getByTestId } = open();
    await waitFor(() => getByTestId('select-o1'));
    expect(getByTestId('pick-line-o1').props.children).toBe('Not taking invitations');
    fireEvent.press(getByTestId('select-o1'));
    says(getByTestId('toast'), 'Not taking invitations');
    expect(getByTestId('pick-line-o2').props.children).toBe('Not open to this set');
    fireEvent.press(getByTestId('select-o2'));
    says(getByTestId('toast'), 'Not open to this set');
  });

  it('B5: the footer steps away while the keypad is open and comes back, with the selection intact, when it closes', async () => {
    const { getByTestId, getByText, queryByTestId, queryByText } = open();
    await waitFor(() => getByTestId('select-p'));
    fireEvent.press(getByTestId('select-p'));
    getByTestId('pick-footer'); getByText('1 selected'); getByText('Next: terms for 1 creator');
    pad.show();
    expect(queryByTestId('pick-footer')).toBeNull();
    expect(queryByTestId('pick-next')).toBeNull();
    expect(queryByText('1 selected')).toBeNull();
    // The title, the tabs, the control row and the list are all still there, and still usable.
    getByTestId('pick-subline'); getByTestId('pick-tabs'); getByTestId('discover-search'); getByTestId('open-filters');
    expect(getByTestId('select-p').props.accessibilityState.checked).toBe(true);
    pad.hide();
    getByTestId('pick-footer'); getByText('1 selected'); getByText('Next: terms for 1 creator');
    expect(draft.getBasket('sA').map(c => c.id)).toEqual(['p']);
  });

  it('D2 on the Worked with and Pool tabs: the row prints the short reason, only her face and name are greyed, and a tap says the sentence', async () => {
    brandApi.pickable.mockImplementation((cid, sid, params) => Promise.resolve(ok(
      params.tab === 'worked' ? { total: 2, page: 1, rows: [
        { id: 'p', name: 'Priya Sharma', collaborations: 2, pick: { state: 'ok' } },
        { ...CREATORS[1], collaborations: 1 },
      ] } : params.tab === 'pool' ? { total: 1, page: 1, rows: [
        { ...CREATORS[1], pool: { entryId: 'e1', goal: 'conversion', sameAim: true, termsLine: '10% commission', daysLeft: 9, closingSoon: false } },
      ] } : { total: 3, page: 1, rows: CREATORS }
    )));
    const { getByTestId, getByText, queryByTestId, getAllByText } = open();
    await waitFor(() => getByTestId('select-p'));
    for (const tab of ['Worked with', 'Pool']) {
      fireEvent.press(getByText(tab));
      await waitFor(() => getByTestId(tab === 'Pool' ? 'pool-pick' : 'worked-pick'));
      await waitFor(() => getByTestId('select-k'));
      getByText('Not taking Pay for Sale'); getByText("Can't invite");
      // Her name is greyed; the row as a whole is not, so the reason stays readable.
      expect(flat(getAllByText('Kavya D.')[0]).opacity).toBe(0.5);
      expect(flat(getByTestId('select-k')).opacity).toBe(1);
      expect(flat(getByText('Not taking Pay for Sale')).opacity).toBeUndefined();
      // Tapping the row — or her name inside it — says why, and picks nobody.
      fireEvent.press(getByTestId('select-k'));
      says(getByTestId('toast'), SENTENCE);
      fireEvent.press(getByTestId('member-k'));
      says(getByTestId('toast'), SENTENCE);
      expect(draft.getBasket('sA')).toEqual([]);
    }
    expect(queryByTestId('pick-footer')).not.toBeNull();
  });

  // Final review, finding F1 (frame B4 "Show 14 creators", check 5). Since board B the Filters
  // pop-up is the only way to the picker's filters, and its yellow button asks the SET'S OWN list
  // for a bare count. The server answered that question with an error since item 5 and the phone
  // printed "Show 0 creators" for every choice (fixed on the server: drift/FINAL-server.md, B-1).
  // Every other test here answers the count with a whole list. This one answers as the server now
  // does — { tab, total }, no rows, no set — so the phone is proved to ask the right question and
  // to print the number it is given.
  it('B4: the Filters button asks the set\'s own list for a count and prints the number it is given, for each choice', async () => {
    const asked = [];
    brandApi.pickable.mockImplementation((cid, sid, params) => {
      if (params.countOnly) { asked.push([cid, sid, params]); return Promise.resolve(ok({ tab: 'all', total: params.openOnly ? 14 : 1 })); }
      return Promise.resolve(ok({ total: 3, page: 1, rows: CREATORS }));
    });
    const { getByTestId } = open();
    await waitFor(() => getByTestId('select-p'));
    expect(asked).toEqual([]);                                             // no count is asked for until the pop-up opens
    fireEvent.press(getByTestId('open-filters'));
    await waitFor(() => getByTestId('filters-sheet'));
    await waitFor(() => says(getByTestId('filters-apply'), 'Show 14 creators'));
    expect(asked[asked.length - 1]).toEqual(['c1', 'sA', expect.objectContaining({ tab: 'all', countOnly: 1, openOnly: true })]);
    // A different choice asks again and the button follows — one creator, in the singular.
    fireEvent(getByTestId('filter-openonly'), 'valueChange', false);
    await waitFor(() => says(getByTestId('filters-apply'), 'Show 1 creator'));
    expect(asked[asked.length - 1]).toEqual(['c1', 'sA', expect.objectContaining({ tab: 'all', countOnly: 1, openOnly: false })]);
    expect(getByTestId('filters-apply').props.accessibilityState).toEqual({ disabled: false });
    // A count never stands in for the list: pressing the button loads the list for that choice.
    await act(async () => { fireEvent.press(getByTestId('filters-apply')); });
    await waitFor(() => expect(lastAll()).toMatchObject({ openOnly: false, page: 1 }));
    await waitFor(() => getByTestId('select-p'));
  });
});

describe('ui-walk-fixes board B — the same reason on "Invite a group" and after Review and send (D2)', () => {
  const SENTENCE = "Kavya isn't taking Pay for Sale collaborations.";
  const says = (el, text) => require('@testing-library/react-native').within(el).getByText(text);
  const CHECK = {
    group: { id: 'g1', name: 'Diwali shortlist', memberCount: 3 },
    set: { id: 'sA', name: 'Set A · Ethnic wear', goal: 'conversion', shootMode: 'visit', postingDate: `${yr}-10-20` },
    counts: { can: 1, cannot: 2, total: 3 },
    can: [{ id: 'p', name: 'Priya Sharma' }],
    cannot: [
      { id: 'k', name: 'Kavya D.', label: 'Not taking Pay for Sale', message: SENTENCE, detail: 'aim',
        pick: { state: 'ineligible', reason: 'NOT_MATCHING', detail: 'aim', label: 'Not taking Pay for Sale', message: SENTENCE, inSet: 'none' } },
      { id: 'a', name: 'Arjun Kumar', label: 'Already in this set', message: null, detail: null,
        pick: { state: 'invited', label: 'Already in this set', reason: null, inSet: 'live' } },
    ],
  };
  const route = { params: { campaignId: 'c1', setId: 'sA', groupId: 'g1', groupName: 'Diwali shortlist' } };

  let errorSpy;
  beforeEach(() => { errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {}); });
  afterEach(() => {
    const said = errorSpy.mock.calls.map(c => String(c[0]));
    errorSpy.mockRestore();
    expect(said).toEqual([]);
  });

  it('the group check prints the short reason under her name and says the sentence when she is tapped', async () => {
    brandApi.groupCheck.mockResolvedValue(ok(CHECK));
    const n = nav();
    const { getByTestId, getByText, queryByTestId } = render(<BrandGroupInviteCheckScreen navigation={n} route={route} />);
    await waitFor(() => getByTestId('group-summary'));
    getByText("Can't be invited · 2");
    getByText('Not taking Pay for Sale'); getByText("Can't invite");
    getByText('Already in this set'); getByText('Invited');
    // "Already in this set" has nothing more to say.
    fireEvent.press(getByTestId('member-a'));
    expect(queryByTestId('toast')).toBeNull();
    fireEvent.press(getByTestId('member-k'));
    says(getByTestId('toast'), SENTENCE);
    // Saying why adds nobody and goes nowhere.
    expect(draft.getBasket('sA')).toEqual([]);
    expect(n.navigate).not.toHaveBeenCalled();
  });

  it('the group check on an older server (a label, no sentence) says the label', async () => {
    brandApi.groupCheck.mockResolvedValue(ok({ ...CHECK, counts: { can: 1, cannot: 1, total: 2 },
      cannot: [{ id: 'k', name: 'Kavya D.', label: 'Not open to this set', pick: { state: 'ineligible' } }] }));
    const { getByTestId } = render(<BrandGroupInviteCheckScreen navigation={nav()} route={route} />);
    await waitFor(() => getByTestId('group-summary'));
    fireEvent.press(getByTestId('member-k'));
    says(getByTestId('toast'), 'Not open to this set');
  });

  it('after Review and send: a creator refused by her own rule shows the short reason, a tap says the sentence; any other refusal still opens her terms', async () => {
    const ALL = { sellMode: 'all', sellAllCount: 40 };
    draft.startDraft('sA', { set: SET, campaignName: 'Diwali Edit 2026', creators: [{ id: 'p', name: 'Priya Sharma' }, { id: 'k', name: 'Kavya D.' }, { id: 'd', name: 'Divya R.' }], sourceGroupId: null });
    for (const id of ['p', 'k', 'd']) draft.setTerms('sA', id, { ...draft.defaultTerms('conversion'), commissionPct: '10', ...ALL });
    brandApi.checkEligibility.mockResolvedValue(ok({ results: [] }));
    brandApi.sendInvitations.mockResolvedValueOnce({ success: false, error: { code: 'VALIDATION_ERROR', message: SENTENCE, details: { sent: 0, failures: [
      { influencerId: 'k', name: 'Kavya D.', code: 'NOT_MATCHING', field: 'influencer_id', message: SENTENCE, detail: 'aim', label: 'Not taking Pay for Sale' },
      { influencerId: 'd', name: null, code: 'CONFLICT', field: 'influencer_id', message: 'That creator is listed twice.', detail: null, label: null },
    ] } } });
    const n = nav();
    const { getByTestId, getByText, queryByText, queryByTestId, getAllByText } = render(<BrandReviewSendScreen navigation={n} route={{ params: { campaignId: 'c1', setId: 'sA' } }} />);
    fireEvent.press(getByTestId('send-invitations'));
    await waitFor(() => getByTestId('failed-banner'));
    getByText("2 creators can't be invited");
    expect(getAllByText("Can't invite")).toHaveLength(2);
    // Her row: the same short reason the picker printed; the sentence only when tapped.
    getByText('Not taking Pay for Sale');
    expect(queryByText(SENTENCE)).toBeNull();
    expect(queryByTestId('toast')).toBeNull();
    fireEvent.press(getByTestId('review-row-k'));
    says(getByTestId('toast'), SENTENCE);
    expect(n.navigate).not.toHaveBeenCalled();
    // A refusal that is not one of her rules prints its own message and opens her terms, as before.
    getByText('That creator is listed twice.');
    fireEvent.press(getByTestId('review-row-d'));
    expect(n.navigate).toHaveBeenCalledWith('BrandCreatorTerms', { campaignId: 'c1', setId: 'sA', index: 2 });
    // And a creator who was not refused opens her terms too.
    fireEvent.press(getByTestId('review-row-p'));
    expect(n.navigate).toHaveBeenCalledWith('BrandCreatorTerms', { campaignId: 'c1', setId: 'sA', index: 0 });
  });
});
