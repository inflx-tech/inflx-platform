/**
 * Item 4 — the Brand app's Campaigns tab: C1–C11 with the exact copy, states and messages.
 * Contract: features/item4-campaigns-sets
 */
import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';

jest.mock('../../../services/api', () => ({
  brandApi: {
    campaignsSummary: jest.fn(), campaignSummary: jest.fn(), setSummary: jest.fn(),
    createCampaign: jest.fn(), updateCampaign: jest.fn(), deleteCampaign: jest.fn(),
    createCampaignSet: jest.fn(), updateCampaignSet: jest.fn(), deleteCampaignSet: jest.fn(), duplicateSet: jest.fn(),
    listBranches: jest.fn(),
  },
  influencerApi: {}, referenceApi: {}, clearSession: jest.fn(), uploadFile: jest.fn(),
}));
jest.mock('../../../../App', () => ({ AuthContext: require('react').createContext({ setRole: () => {} }) }));
jest.mock('@react-navigation/native', () => ({ useFocusEffect: (cb) => { const React = require('react'); React.useEffect(() => cb(), [cb]); } }));

const { brandApi } = require('../../../services/api');
const BrandCampaignsScreen = require('../BrandCampaignsScreen').default;
const BrandCampaignNewScreen = require('../BrandCampaignNewScreen').default;
const BrandSetEditScreen = require('../BrandSetEditScreen').default;
const BrandCampaignDetailScreen = require('../BrandCampaignDetailScreen').default;
const BrandSetDetailScreen = require('../BrandSetDetailScreen').default;
const { MSG4, countsLine4, shortDate4, longDate4 } = require('../../../components/campaigns/copy4');
const { earliestGoLiveDay, addDays, today } = require('../../../utils/setShape');

const nav = () => ({ goBack: jest.fn(), navigate: jest.fn(), replace: jest.fn(), push: jest.fn(), setParams: jest.fn(), addListener: jest.fn(() => () => {}), dispatch: jest.fn() });
const ok = (data) => ({ success: true, data });
const yr = new Date().getFullYear();
const RULES = { today: today(), earliestPostingDate: earliestGoLiveDay(), minDaysAhead: 7, cutoffDaysBefore: 3 };
const COUNTS = { invited: 8, signed: 3, waiting: 2, declined: 3 };
const SET_A = { id: 'sA', campaignId: 'c1', name: 'Set A · Ethnic wear', state: 'live', datePassed: false, locked: true, lockedFields: ['goal', 'go_live_date', 'shoot_mode', 'branch_id'],
  goal: 'conversion', shootMode: 'visit', branch: { id: 'b1', name: 'Banjara Hills', cityName: 'Hyderabad' }, postingDate: `${yr}-10-20`, cutoff: `${yr}-10-17`, daysToCutoff: 4, cutoffPassed: false,
  expiredAt: null, counts: COUNTS, canInvite: { ok: true }, isPast: false, createdAt: `${yr}-09-09T00:00:00Z` };
const SET_B = { id: 'sB', campaignId: 'c1', name: 'Set B · Jewellery', state: 'draft', datePassed: false, locked: false, lockedFields: [], goal: 'engagement', shootMode: 'shipment', branch: null,
  postingDate: `${yr}-10-24`, cutoff: `${yr}-10-21`, daysToCutoff: 8, cutoffPassed: false, expiredAt: null, counts: { invited: 0, signed: 0, waiting: 0, declined: 0 }, canInvite: { ok: true }, isPast: false, canDelete: true };
const SET_D = { ...SET_B, id: 'sD', name: 'Set D · Kids wear', state: 'expired', isPast: true, postingDate: `${yr}-09-02`, cutoff: `${yr}-08-30`, counts: { invited: 4, signed: 0, waiting: 0, declined: 4 }, canInvite: { ok: false } };
const CAMPAIGN = { id: 'c1', name: 'Diwali Edit 2026', brief: 'Festive ethnic and jewellery push across Hyderabad and Vijayawada.', state: 'live', createdAt: `${yr}-09-09T00:00:00Z`, setCount: 2, counts: COUNTS, canDelete: false, startedFromGroup: null };

beforeEach(() => jest.clearAllMocks());

describe('copy and counts (Q9)', () => {
  it('the counts line and the dates', () => {
    expect(countsLine4({ invited: 17, signed: 9, waiting: 5, declined: 3 })).toBe('17 invited · 9 signed · 5 waiting · 3 declined');
    expect(countsLine4({ invited: 7, signed: 7, waiting: 0, declined: 0 })).toBe('7 invited · 7 signed');
    expect(countsLine4({ invited: 8, signed: 3, waiting: 2, declined: 3 }, { detail: true })).toBe('8 invited · 3 signed · 2 waiting to answer · 3 declined');
    expect(countsLine4({ invited: 0 })).toBeNull();
    expect(shortDate4(`${yr}-10-20`)).toBe('20 Oct'); expect(shortDate4('2025-10-20')).toBe('20 Oct 2025'); expect(longDate4(`${yr}-10-20`)).toBe(`20 Oct ${yr}`);
  });
});

describe('C1 · C2 — the Campaigns tab', () => {
  it('cards with state, sets line, bar and counts; a draft shows "no invitations sent"; New campaign navigates (check 1, 21)', async () => {
    brandApi.campaignsSummary.mockResolvedValue(ok({ campaigns: [
      { id: 'c1', name: 'Diwali Edit 2026', state: 'live', setCount: 2, nextPostingDate: `${yr}-10-20`, counts: { invited: 17, signed: 9, waiting: 5, declined: 3 } },
      { id: 'c3', name: 'Festive Jewellery', state: 'draft', setCount: 1, nextPostingDate: null, counts: { invited: 0, signed: 0, waiting: 0, declined: 0 } },
    ], tabs: { live: 1, draft: 1, past: 0 } }));
    const n = nav();
    const { getByText, getAllByText, getByTestId, queryByTestId } = render(<BrandCampaignsScreen navigation={n} route={{ params: {} }} />);
    await waitFor(() => getByTestId('campaign-card-c1'));
    expect(getAllByText('Live').length).toBe(2); getByText('Drafts'); getByText('Past');
    getByText('2 sets · next posting 20 Oct'); getByText('17 invited · 9 signed · 5 waiting · 3 declined');
    getByText('1 set · no invitations sent'); getByText('Draft');
    expect(queryByTestId('progress-bar')).toBeTruthy();
    fireEvent.press(getByTestId('new-campaign'));
    expect(n.navigate).toHaveBeenCalledWith('BrandCampaignNew');
    fireEvent.press(getByTestId('campaign-card-c1'));
    expect(n.navigate).toHaveBeenCalledWith('BrandCampaignDetail', { campaignId: 'c1', name: 'Diwali Edit 2026' });
    expect(brandApi.campaignsSummary).toHaveBeenCalledWith({ state: 'live', limit: 50 });
  });

  it('empty, loading and couldn\'t load with Try again (check 1, 18)', async () => {
    brandApi.campaignsSummary.mockResolvedValue(ok({ campaigns: [], tabs: { live: 0, draft: 0, past: 0 } }));
    const { getByText, getByTestId } = render(<BrandCampaignsScreen navigation={nav()} route={{ params: {} }} />);
    await waitFor(() => getByTestId('campaigns-empty'));
    getByText('No campaigns yet'); getByText('A campaign holds your sets. Each set has one Aim, one posting date and one mode of work.');
    brandApi.campaignsSummary.mockResolvedValue({ success: false, error: { message: 'x' } });
    const r2 = render(<BrandCampaignsScreen navigation={nav()} route={{ params: {} }} />);
    expect(r2.getByTestId('skeleton')).toBeTruthy();
    await waitFor(() => r2.getByText("Couldn't load your campaigns"));
    r2.getByText('Check your connection and try again.');
    brandApi.campaignsSummary.mockResolvedValue(ok({ campaigns: [], tabs: {} }));
    fireEvent.press(r2.getByText('Try again'));
    await waitFor(() => r2.getByTestId('campaigns-empty'));
  });
});

describe('C3 — New campaign', () => {
  it('name required with the exact message; the group banner; Next saves a draft and opens the first set (check 2, 15)', async () => {
    const n = nav();
    const { getByTestId, getByText } = render(<BrandCampaignNewScreen navigation={n} route={{ params: { groupId: 'g1', groupName: 'Diwali shortlist', groupCount: 12 } }} />);
    getByText('Started from Diwali shortlist. Its 12 creators are ready to pick from in your first set.');
    getByText('Only your team sees this. Creators never see it.');
    fireEvent.press(getByTestId('campaign-next'));
    getByText(MSG4.CAMPAIGN_NAME);
    expect(brandApi.createCampaign).not.toHaveBeenCalled();
    fireEvent.changeText(getByTestId('campaign-name'), 'Diwali Edit 2026');
    getByText('16 / 60'); // 'Diwali Edit 2026' is 16 characters; the mockup's 17 is example data
    brandApi.createCampaign.mockResolvedValue(ok({ campaign: { id: 'c9', name: 'Diwali Edit 2026' }, dateRules: RULES }));
    fireEvent.press(getByTestId('campaign-next'));
    await waitFor(() => expect(n.replace).toHaveBeenCalled());
    expect(brandApi.createCampaign).toHaveBeenCalledWith({ name: 'Diwali Edit 2026', brief: null, started_from_group_id: 'g1' });
    expect(n.replace).toHaveBeenCalledWith('BrandSetEdit', expect.objectContaining({ campaignId: 'c9', suggestedName: 'Set A', dateRules: RULES }));
  });
});

describe('C4 · C5 — New set and the date picker', () => {
  it('every field error under its field; the branch row only for Store Visit; the picker greys out early days and shows the cutoff (checks 3, 4)', async () => {
    brandApi.listBranches.mockResolvedValue(ok({ branches: [{ id: 'b1', name: 'Banjara Hills', cityName: 'Hyderabad', stateName: 'Telangana', isMain: true }] }));
    const n = nav();
    const { getByTestId, getByText, queryByTestId, getAllByText } = render(<BrandSetEditScreen navigation={n} route={{ params: { campaignId: 'c1', campaignName: 'Diwali Edit 2026', dateRules: RULES, suggestedName: 'Set A' } }} />);
    getByText('DIWALI EDIT 2026');
    expect(getByTestId('set-name').props.value).toBe('Set A');
    fireEvent.changeText(getByTestId('set-name'), '');
    fireEvent.press(getByTestId('save-set'));
    getByText(MSG4.SET_NAME); getByText(MSG4.AIM); getByText(MSG4.MODE); getByText(MSG4.DATE);
    expect(queryByTestId('branch-row')).toBeNull();
    fireEvent.changeText(getByTestId('set-name'), 'Set A · Ethnic wear');
    fireEvent.press(getByTestId('aim-conversion'));
    fireEvent.press(getByTestId('mode-visit'));
    await waitFor(() => getByTestId('branch-row'));
    getByText('Creators see the city, not the address. Your main branch is listed first.');
    fireEvent.press(getByTestId('save-set'));
    getByText(MSG4.BRANCH);
    fireEvent.press(getByTestId('branch-field'));
    await waitFor(() => getByTestId('branch-b1'));
    fireEvent.press(getByTestId('branch-b1'));
    getByText('Banjara Hills, Hyderabad');
    fireEvent.press(getByTestId('mode-shipment'));
    expect(queryByTestId('branch-row')).toBeNull();

    // the picker: earliest day allowed, the day before it is blocked, the cutoff line follows the pending day
    const earliest = RULES.earliestPostingDate;
    fireEvent.press(getByTestId('posting-date'));
    await waitFor(() => getByTestId('date-sheet'));
    getByText(`Dates before ${shortDate4(earliest)} are greyed out: a posting date must be at least seven days from today.`);
    const before = queryByTestId(`day-${addDays(earliest, -1)}`);
    if (before) expect(before.props.accessibilityState.disabled).toBe(true);
    fireEvent.press(getByTestId(`day-${earliest}`));
    getByText(`Invitations would close ${longDate4(addDays(earliest, -3))}.`);
    fireEvent.press(getByTestId('date-confirm'));
    await waitFor(() => getByTestId('cutoff-line'));
    getByText(`Invitations close ${longDate4(addDays(earliest, -3))}, three days before posting.`);
    getByText('Everyone in this set posts on this day.');

    brandApi.createCampaignSet.mockResolvedValue(ok({ set: { id: 'sN' }, cutoff: addDays(earliest, -3) }));
    fireEvent.press(getByTestId('save-set'));
    await waitFor(() => expect(brandApi.createCampaignSet).toHaveBeenCalled());
    expect(brandApi.createCampaignSet).toHaveBeenCalledWith('c1', { name: 'Set A · Ethnic wear', goal: 'conversion', shoot_mode: 'shipment', branch_id: null, go_live_date: earliest });
    expect(n.replace).toHaveBeenCalledWith('BrandCampaignDetail', expect.objectContaining({ campaignId: 'c1', toast: 'Set saved.' }));
    expect(getAllByText).toBeTruthy();
  });

  it('a server refusal lands under its field (the 7-day rule sent straight to the API)', async () => {
    brandApi.updateCampaignSet.mockResolvedValue({ success: false, error: { code: 'VALIDATION_ERROR', message: MSG4.DATE_TOO_SOON, field: 'go_live_date' } });
    const { getByTestId, getByText } = render(<BrandSetEditScreen navigation={nav()} route={{ params: { campaignId: 'c1', dateRules: RULES, set: { ...SET_B, locked: false, lockedFields: [] } } }} />);
    fireEvent.press(getByTestId('save-set'));
    await waitFor(() => getByText(MSG4.DATE_TOO_SOON));
  });
});

describe('C6 · C11 — Campaign detail and menus', () => {
  it('sets newest first with meta, dates and counts; past sets behind a toggle; the ⋯ menu; delete hidden while invitations exist (check 12)', async () => {
    brandApi.campaignSummary.mockResolvedValue(ok({ campaign: CAMPAIGN, sets: { current: [SET_A, SET_B], past: [SET_D] }, dateRules: RULES }));
    const n = nav();
    const { getByText, getByTestId, queryByText, queryByTestId } = render(<BrandCampaignDetailScreen navigation={n} route={{ params: { campaignId: 'c1' } }} />);
    await waitFor(() => getByTestId('campaign-detail'));
    getByText('Created 9 Sep'); getByText(CAMPAIGN.brief); getByText('Sets'); getByText('2');
    getByText('Pay for Sale · Store Visit · Banjara Hills'); getByText('Posts 20 Oct · invites close 17 Oct');
    getByText('8 invited · 3 signed · 2 waiting · 3 declined');
    getByText('Pay for Content · Remote'); getByText('No creators yet');
    expect(queryByTestId('set-card-sD')).toBeNull();
    fireEvent.press(getByTestId('toggle-past'));
    getByTestId('set-card-sD'); getByText('Expired'); getByText('Nobody signed by 30 Aug'); getByText('The 4 open invitations were closed automatically at the cutoff.'); getByText('Duplicate with a new date');
    getByText('Hide past sets');
    fireEvent.press(getByTestId('campaign-menu'));
    getByText('Rename campaign'); getByText('Edit description'); expect(queryByText('Delete campaign')).toBeNull();
    fireEvent.press(getByTestId('add-set'));
    expect(n.navigate).toHaveBeenCalledWith('BrandSetEdit', expect.objectContaining({ campaignId: 'c1', suggestedName: 'Set C' }));
  });

  it('a draft campaign offers Delete with the confirm copy; deleting goes back to Drafts (check 6)', async () => {
    brandApi.campaignSummary.mockResolvedValue(ok({ campaign: { ...CAMPAIGN, state: 'draft', canDelete: true, brief: null }, sets: { current: [SET_B], past: [] }, dateRules: RULES }));
    brandApi.deleteCampaign.mockResolvedValue(ok({}));
    const n = nav();
    const { getByText, getByTestId } = render(<BrandCampaignDetailScreen navigation={n} route={{ params: { campaignId: 'c1' } }} />);
    await waitFor(() => getByTestId('campaign-detail'));
    fireEvent.press(getByTestId('campaign-menu'));
    fireEvent.press(getByText('Delete campaign'));
    getByText('Delete "Diwali Edit 2026"?'); getByText('Nothing has been sent for this campaign, so nothing is lost.'); getByText('Keep');
    fireEvent.press(getByTestId('confirm-primary'));
    await waitFor(() => expect(brandApi.deleteCampaign).toHaveBeenCalledWith('c1'));
    expect(n.navigate).toHaveBeenCalledWith('BrandCampaigns', { segment: 'Drafts', toast: 'Campaign deleted.' });
  });
});

describe('C7 · C8 · C9 · C10 — Set detail', () => {
  it('draft: rows, the draft lock line, Add creators opens the picker (item 5), Edit/Duplicate, the empty box; the ⋯ has Edit, Duplicate, Delete', async () => {
    brandApi.setSummary.mockResolvedValue(ok({ set: SET_B, campaign: { id: 'c1', name: 'Diwali Edit 2026' }, dateRules: RULES }));
    const n = nav();
    const { getByText, getAllByText, getByTestId } = render(<BrandSetDetailScreen navigation={n} route={{ params: { campaignId: 'c1', setId: 'sB' } }} />);
    await waitFor(() => getByTestId('set-detail-draft'));
    getByText('Pay for Content'); getByText('Remote'); getByText(`24 Oct ${yr}`); getByText(`21 Oct ${yr}`);
    getByText('🔒 Aim, posting date, mode and branch lock when you send the first invitation.');
    fireEvent.press(getByTestId('add-creators'));
    expect(n.navigate).toHaveBeenCalledWith('BrandSetPickCreators', { campaignId: 'c1', setId: 'sB' });
    getByText('No creators yet'); getByText('Add creators, agree their terms and send invitations.');
    fireEvent.press(getByTestId('set-menu'));
    expect(getAllByText('Edit set').length).toBe(2); getByText('Duplicate set'); getByText('Delete set');
    fireEvent.press(getByText('Delete set'));
    getByText('Delete "Set B · Jewellery"?'); getByText('Nothing has been sent for this set, so nothing is lost.');
  });

  it('live and locked: the cutoff strip, lock icons, "waiting to answer", and only Rename + Duplicate (checks 7, 9)', async () => {
    brandApi.setSummary.mockResolvedValue(ok({ set: SET_A, campaign: { id: 'c1', name: 'Diwali Edit 2026' }, dateRules: RULES }));
    const { getByText, getByTestId, queryByText, getAllByText } = render(<BrandSetDetailScreen navigation={nav()} route={{ params: { campaignId: 'c1', setId: 'sA' } }} />);
    await waitFor(() => getByTestId('set-detail-live'));
    getByText('Invitations close in 4 days · 17 Oct');
    getByText('🔒 Pay for Sale'); getByText('🔒 Store Visit'); getByText('🔒 Banjara Hills'); getByText(`🔒 20 Oct ${yr}`); getByText(`🔒 17 Oct ${yr}`);
    getByText('🔒 Locked because invitations have gone out. You can still rename the set.');
    getByText('Creators'); getByText('8'); getByText('8 invited · 3 signed · 2 waiting to answer · 3 declined');
    fireEvent.press(getByTestId('set-menu'));
    getByText('Rename set'); expect(getAllByText('Duplicate set').length).toBeGreaterThan(0); expect(queryByText('Delete set')).toBeNull(); expect(queryByText('Edit set')).toBeNull();
  });

  it('date passed, expired and completed (check 13, 12)', async () => {
    brandApi.setSummary.mockResolvedValue(ok({ set: { ...SET_B, datePassed: true, postingDate: `${yr}-09-01`, cutoff: `${yr}-08-29`, canInvite: { ok: false, reason: 'date_passed' } }, campaign: { id: 'c1', name: 'x' }, dateRules: RULES }));
    let r = render(<BrandSetDetailScreen navigation={nav()} route={{ params: { campaignId: 'c1', setId: 'sB' } }} />);
    await waitFor(() => r.getByTestId('set-detail-draft-datepassed'));
    r.getByText('Date passed'); r.getByText('Posting date has passed. Pick a new date before you invite anyone.'); r.getByTestId('choose-new-date');

    brandApi.setSummary.mockResolvedValue(ok({ set: SET_D, campaign: { id: 'c1', name: 'x' }, dateRules: RULES }));
    r = render(<BrandSetDetailScreen navigation={nav()} route={{ params: { campaignId: 'c1', setId: 'sD' } }} />);
    await waitFor(() => r.getByTestId('set-detail-expired'));
    r.getByText('Expired'); r.getByText('Nobody signed by 30 Aug'); r.getByText('The 4 open invitations were closed automatically at the cutoff.'); r.getByTestId('duplicate-new-date');

    brandApi.setSummary.mockResolvedValue(ok({ set: { ...SET_D, state: 'completed', counts: { invited: 6, signed: 6, waiting: 0, declined: 0 } }, campaign: { id: 'c1', name: 'x' }, dateRules: RULES }));
    r = render(<BrandSetDetailScreen navigation={nav()} route={{ params: { campaignId: 'c1', setId: 'sD' } }} />);
    await waitFor(() => r.getByTestId('set-detail-completed'));
    r.getByText('Completed'); r.getByText('6 collaborations');
  });

  it('C10 — Duplicate: the sheet copy, the prefilled name, a date is required, and creating opens the new set (check 14)', async () => {
    brandApi.setSummary.mockResolvedValue(ok({ set: SET_A, campaign: { id: 'c1', name: 'Diwali Edit 2026' }, dateRules: RULES }));
    brandApi.duplicateSet.mockResolvedValue(ok({ set: { id: 'sCopy' } }));
    const n = nav();
    const { getByText, getByTestId } = render(<BrandSetDetailScreen navigation={n} route={{ params: { campaignId: 'c1', setId: 'sA' } }} />);
    await waitFor(() => getByTestId('set-detail-live'));
    fireEvent.press(getByTestId('duplicate-set'));
    await waitFor(() => getByTestId('duplicate-sheet'));
    getByText('Duplicate Set A · Ethnic wear');
    expect(getByTestId('duplicate-name').props.value).toBe('Set A · Ethnic wear (copy)');
    getByText('Copied from Set A · Ethnic wear'); getByText('Pay for Sale · Store Visit · Banjara Hills');
    getByText("Creators and invitations aren't copied. The new set starts as a draft.");
    fireEvent.press(getByTestId('duplicate-create'));
    getByText(MSG4.DATE);
    const earliest = RULES.earliestPostingDate;
    fireEvent.press(getByTestId('duplicate-date'));
    await waitFor(() => getByTestId(`day-${earliest}`));
    fireEvent.press(getByTestId(`day-${earliest}`));
    fireEvent.press(getByTestId('date-confirm'));
    await act(async () => { fireEvent.press(getByTestId('duplicate-create')); });
    await waitFor(() => expect(brandApi.duplicateSet).toHaveBeenCalledWith('c1', 'sA', { name: 'Set A · Ethnic wear (copy)', go_live_date: earliest }));
    expect(n.push).toHaveBeenCalledWith('BrandSetDetail', { campaignId: 'c1', setId: 'sCopy', toast: 'Set created.' });
  });
});
