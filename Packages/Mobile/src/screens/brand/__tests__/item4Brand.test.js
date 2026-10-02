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
    // Item 6 (N13): the Campaigns tab reads the pool for the row at the top.
    getPool: jest.fn(),
    // ui-walk-fixes board A: the pool door into New set (N14 → N15) is walked from the pool itself.
    poolSetDefaults: jest.fn(), removeFromPool: jest.fn(),
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
const BrandPoolScreen = require('../BrandPoolScreen').default;
const { C4, MSG4, countsLine4, shortDate4, longDate4 } = require('../../../components/campaigns/copy4');
const { earliestGoLiveDay, addDays, today } = require('../../../utils/setShape');

const nav = () => ({ goBack: jest.fn(), navigate: jest.fn(), replace: jest.fn(), push: jest.fn(), reset: jest.fn(), setParams: jest.fn(), addListener: jest.fn(() => () => {}), dispatch: jest.fn() });
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

beforeEach(() => {
  jest.clearAllMocks();
  // Item 6: no pool by default, so the row at the top of Campaigns stays hidden.
  brandApi.getPool.mockResolvedValue(ok({ total: 0, groups: [] }));
});

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
    // Item 6 (N18): the negotiation switch travels with the campaign, on by default.
    expect(brandApi.createCampaign).toHaveBeenCalledWith({ name: 'Diwali Edit 2026', brief: null, started_from_group_id: 'g1', allow_negotiation: true });
    // ui-walk-fixes board A: the first set is opened with NO name sent along. The exact params are
    // pinned (not objectContaining) so a pre-typed name can never ride in again unnoticed.
    expect(n.replace).toHaveBeenCalledWith('BrandSetEdit', { campaignId: 'c9', campaignName: 'Diwali Edit 2026', dateRules: RULES });
  });
});

describe('C4 · C5 — New set and the date picker', () => {
  it('every field error under its field; the branch row only for Store Visit; the picker greys out early days and shows the cutoff (checks 3, 4)', async () => {
    brandApi.listBranches.mockResolvedValue(ok({ branches: [{ id: 'b1', name: 'Banjara Hills', cityName: 'Hyderabad', stateName: 'Telangana', isMain: true }] }));
    const n = nav();
    const { getByTestId, getByText, queryByTestId, getAllByText } = render(<BrandSetEditScreen navigation={n} route={{ params: { campaignId: 'c1', campaignName: 'Diwali Edit 2026', dateRules: RULES } }} />);
    getByText('DIWALI EDIT 2026');
    // ui-walk-fixes board A (A1): the box opens empty with the grey example — nothing is pre-typed,
    // so Save on the untouched screen already says the name is missing.
    expect(getByTestId('set-name').props.value).toBe('');
    expect(getByTestId('set-name').props.placeholder).toBe('e.g. Festive sarees');
    fireEvent.press(getByTestId('save-set'));
    getByText(MSG4.SET_NAME); getByText(MSG4.AIM); getByText(MSG4.MODE); getByText(MSG4.DATE);
    expect(brandApi.createCampaignSet).not.toHaveBeenCalled();
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
    getByText('The last day for everyone in this set to go live.');   // posting-date-last-day (1 Oct 2026): was "posts on this day"

    brandApi.createCampaignSet.mockResolvedValue(ok({ set: { id: 'sN' }, cutoff: addDays(earliest, -3) }));
    fireEvent.press(getByTestId('save-set'));
    await waitFor(() => expect(brandApi.createCampaignSet).toHaveBeenCalled());
    expect(brandApi.createCampaignSet).toHaveBeenCalledWith('c1', { name: 'Set A · Ethnic wear', goal: 'conversion', shoot_mode: 'shipment', branch_id: null, go_live_date: earliest });
    // Founder, 2026-09-16: a new set opens straight away and carries her on to the creators.
    // The stack under it is campaigns → this campaign → the new set, so Back is the campaign.
    expect(n.reset).toHaveBeenCalledWith({
      index: 2,
      routes: [
        { name: 'BrandCampaigns' },
        { name: 'BrandCampaignDetail', params: { campaignId: 'c1', name: 'Diwali Edit 2026' } },
        { name: 'BrandSetDetail', params: { campaignId: 'c1', setId: 'sN', toast: 'Set saved.', addCreators: true } },
      ],
    });
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
    // ui-walk-fixes board A: "Add another set" sends no name and no letter worked out from the
    // number of sets. Exact params, so nothing extra can ride along.
    expect(n.navigate).toHaveBeenCalledWith('BrandSetEdit', { campaignId: 'c1', campaignName: 'Diwali Edit 2026', dateRules: RULES });
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
    expect(n.navigate).toHaveBeenCalledWith('BrandSetPickCreators', { campaignId: 'c1', setId: 'sB', campaignName: 'Diwali Edit 2026', setName: 'Set B · Jewellery' });
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

/**
 * The silent save, 2026-09-16. Founder: "it is not adding any set" — Save did nothing at all.
 *
 * The set WAS refused, correctly: her practice brand is on the free plan, which allows one
 * set per campaign, and the server said so in a sentence. But the sentence carried
 * field: 'createSet' — the ACTION, not a form field — and the screen filed it under that key,
 * where nothing is drawn. The refusal existed and was invisible.
 */
describe('a refusal this form cannot draw is spoken out loud', () => {
  const QUOTA = {
    success: false,
    error: {
      code: 'QUOTA_EXCEEDED',
      message: 'Limit reached on the free plan: sets per campaign (1 / 1). Upgrade to continue.',
      field: 'createSet',
      details: { action: 'createSet', used: 1, limit: 1, current_tier: 'free', upgrade_to: ['growth', 'pro'] },
    },
  };

  const fillSet = async (r) => {
    fireEvent.changeText(r.getByTestId('set-name'), 'Set B · Jewellery');
    fireEvent.press(r.getByTestId('aim-engagement'));
    fireEvent.press(r.getByTestId('mode-shipment'));
    fireEvent.press(r.getByTestId('posting-date'));
    fireEvent.press(r.getByTestId(`day-${earliestGoLiveDay()}`));
    fireEvent.press(r.getByTestId('date-confirm'));
    await waitFor(() => r.getByTestId('cutoff-line'));
  };

  it('says the plan limit out loud when a set is refused, and does not navigate', async () => {
    brandApi.createCampaignSet.mockResolvedValue(QUOTA);
    const n = nav();
    const r = render(<BrandSetEditScreen navigation={n} route={{ params: { campaignId: 'c1', campaignName: 'Diwali Edit 2026', dateRules: RULES } }} />);
    await fillSet(r);
    fireEvent.press(r.getByTestId('save-set'));
    await waitFor(() => r.getByText(QUOTA.error.message));
    expect(n.reset).not.toHaveBeenCalled();
  });

  it('still puts a real field error under its own field', async () => {
    brandApi.createCampaignSet.mockResolvedValue({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Choose a posting date at least 7 days from today.', field: 'go_live_date' } });
    const r = render(<BrandSetEditScreen navigation={nav()} route={{ params: { campaignId: 'c1', dateRules: RULES } }} />);
    await fillSet(r);
    fireEvent.press(r.getByTestId('save-set'));
    await waitFor(() => r.getByText('Choose a posting date at least 7 days from today.'));
  });

  it('says it out loud on the campaign screen too', async () => {
    brandApi.createCampaign.mockResolvedValue({ success: false, error: { code: 'QUOTA_EXCEEDED', message: 'Limit reached on the free plan: active campaigns (5 / 5). Upgrade to continue.', field: 'createCampaign' } });
    const n = nav();
    const r = render(<BrandCampaignNewScreen navigation={n} route={{ params: {} }} />);
    fireEvent.changeText(r.getByTestId('campaign-name'), 'Diwali Edit 2026');
    fireEvent.press(r.getByTestId('campaign-next'));
    await waitFor(() => r.getByText('Limit reached on the free plan: active campaigns (5 / 5). Upgrade to continue.'));
    expect(n.replace).not.toHaveBeenCalled();
  });
});

/**
 * features/ui-walk-fixes · board A (frames A1–A4) — the set name box.
 *
 * Founder, 1 Oct 2026: "While creating set, it is automatically it is showing SET A… it should give
 * a suggestion text with some name". The app typed "Set A" / "Set B" into the box as real text, so
 * a set saved untouched really was called "Set A". Now the box opens EMPTY with a grey example on
 * all three doors, nothing is ever typed for the brand, and the name stays required.
 *
 * Each door is walked from the screen that opens it, and New set is then drawn with exactly the
 * params that screen sent — so a name smuggled in through any door would show here.
 */
describe('ui-walk-fixes board A — the set name box', () => {
  const { StyleSheet } = require('react-native');
  const { settingsTokens: T } = require('../../../theme/tokens');
  const { C6 } = require('../../../components/negotiation/copy6');
  const EXAMPLE = 'e.g. Festive sarees';
  const HINT = 'Creators see this name in their invitation.';
  const border = (node) => StyleSheet.flatten(node.props.style).borderColor;

  // React reports a clash of keys and similar tree mistakes only on console.error (wave 1 habit).
  let errSpy;
  // Fake timers: a press starts TouchableOpacity's fade, which with real timers lands whenever it
  // likes (often after the test) and warns about act() — noise that would make this guard flaky.
  beforeEach(() => {
    // Every test here brings its OWN server answers. The file's jest.clearAllMocks() forgets the
    // calls but keeps an answer an earlier test set, so a test could go green on someone else's
    // fixture and red when run alone (review, 2 Oct 2026: the edit test and the branch list).
    // Wipe every answer; only the file-wide "no pool" default is put back.
    Object.values(brandApi).forEach(fn => fn.mockReset());
    brandApi.getPool.mockResolvedValue(ok({ total: 0, groups: [] }));
    jest.useFakeTimers(); errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    const said = errSpy.mock.calls.map(args => args.map(String).join(' ').split('\n')[0]);
    errSpy.mockRestore(); jest.useRealTimers();
    expect(said).toEqual([]);
  });

  /** Frame A1: empty box, the grey example inside, 0 / 60, the hint, no error, keypad not asked for. */
  const expectEmptyNameBox = (r) => {
    const box = r.getByTestId('set-name');
    expect(box.props.value).toBe('');
    expect(box.props.placeholder).toBe(EXAMPLE);
    expect(box.props.placeholderTextColor).toBe(T.ink3);
    expect(box.props.autoFocus).toBeFalsy();
    expect(r.getByTestId('set-name-counter').props.children).toBe('0 / 60');
    r.getByText(HINT);
    expect(r.queryByText(MSG4.SET_NAME)).toBeNull();
    expect(border(box)).toBe(T.border);
    r.getByText('New set');
  };

  const pickDate = async (r, day) => {
    fireEvent.press(r.getByTestId('posting-date'));
    await waitFor(() => r.getByTestId(`day-${day}`));
    fireEvent.press(r.getByTestId(`day-${day}`));
    fireEvent.press(r.getByTestId('date-confirm'));
    await waitFor(() => r.getByTestId('cutoff-line'));
  };

  it('the grey example is a named copy string, and the old "Set A" suggestion is gone from the copy', () => {
    expect(C4.set.namePlaceholder).toBe(EXAMPLE);
    expect(C4.set.suggestedName).toBeUndefined();
    expect(C4.set.nameLabel).toBe('Set name'); expect(C4.set.nameHint).toBe(HINT); expect(C4.set.nameMax).toBe(60);
    expect(MSG4.SET_NAME).toBe('Enter a set name.');
  });

  it('A1 · door 1 — the first set of a new campaign opens with the box empty and the grey example (check 1)', async () => {
    brandApi.createCampaign.mockResolvedValue(ok({ campaign: { id: 'c9', name: 'Diwali Edit 2026' }, dateRules: RULES }));
    const n = nav();
    const first = render(<BrandCampaignNewScreen navigation={n} route={{ params: {} }} />);
    fireEvent.changeText(first.getByTestId('campaign-name'), 'Diwali Edit 2026');
    fireEvent.press(first.getByTestId('campaign-next'));
    await waitFor(() => expect(n.replace).toHaveBeenCalled());
    const [screen, params] = n.replace.mock.calls[0];
    expect(screen).toBe('BrandSetEdit');
    expect(Object.keys(params).sort()).toEqual(['campaignId', 'campaignName', 'dateRules']);
    first.unmount();

    const r = render(<BrandSetEditScreen navigation={nav()} route={{ params }} />);
    r.getByText('DIWALI EDIT 2026');
    expectEmptyNameBox(r);
    expect(r.queryByTestId('pool-banner')).toBeNull();
  });

  it('A1 · door 2 — "Add another set" opens the same empty box, however many sets the campaign has (check 1)', async () => {
    // Two sets today (and a past one): the old code would have typed "Set C".
    brandApi.campaignSummary.mockResolvedValue(ok({ campaign: CAMPAIGN, sets: { current: [SET_A, SET_B], past: [SET_D] }, dateRules: RULES }));
    const n = nav();
    const detail = render(<BrandCampaignDetailScreen navigation={n} route={{ params: { campaignId: 'c1' } }} />);
    await waitFor(() => detail.getByTestId('campaign-detail'));
    fireEvent.press(detail.getByTestId('add-set'));
    const [screen, params] = n.navigate.mock.calls[0];
    expect(screen).toBe('BrandSetEdit');
    expect(Object.keys(params).sort()).toEqual(['campaignId', 'campaignName', 'dateRules']);
    detail.unmount();

    const r = render(<BrandSetEditScreen navigation={nav()} route={{ params }} />);
    r.getByText('DIWALI EDIT 2026');
    expectEmptyNameBox(r);
    expect(r.queryByText(/^Set [A-Z]$/)).toBeNull();
  });

  it('A2 · A3 — Save with the box left empty saves nothing and says "Enter a set name."; a typed name is saved as typed (check 2)', async () => {
    const earliest = RULES.earliestPostingDate;
    const n = nav();
    const r = render(<BrandSetEditScreen navigation={n} route={{ params: { campaignId: 'c1', campaignName: 'Diwali Edit 2026', dateRules: RULES } }} />);
    // A3: everything else is filled in, the name is left alone.
    fireEvent.press(r.getByTestId('aim-conversion'));
    fireEvent.press(r.getByTestId('mode-shipment'));
    await pickDate(r, earliest);
    fireEvent.press(r.getByTestId('save-set'));
    r.getByText(MSG4.SET_NAME);
    expect(r.queryByText(MSG4.AIM)).toBeNull(); expect(r.queryByText(MSG4.MODE)).toBeNull(); expect(r.queryByText(MSG4.DATE)).toBeNull();
    expect(brandApi.createCampaignSet).not.toHaveBeenCalled();
    expect(n.reset).not.toHaveBeenCalled(); expect(n.replace).not.toHaveBeenCalled(); expect(n.navigate).not.toHaveBeenCalled();
    // red outline, the grey example still inside, the counter and the hint still there
    let box = r.getByTestId('set-name');
    expect(border(box)).toBe(T.danger);
    expect(box.props.value).toBe(''); expect(box.props.placeholder).toBe(EXAMPLE);
    expect(r.getByTestId('set-name-counter').props.children).toBe('0 / 60');
    r.getByText(HINT);

    // Spaces are not a name: the app makes nothing up for her.
    fireEvent.changeText(r.getByTestId('set-name'), '   ');
    expect(r.queryByText(MSG4.SET_NAME)).toBeNull();
    fireEvent.press(r.getByTestId('save-set'));
    r.getByText(MSG4.SET_NAME);
    expect(brandApi.createCampaignSet).not.toHaveBeenCalled();

    // A2: her own words, in the box and in the counter; the red line and outline go at the first letter.
    fireEvent.changeText(r.getByTestId('set-name'), 'Festive sarees');
    box = r.getByTestId('set-name');
    expect(box.props.value).toBe('Festive sarees');
    expect(r.getByTestId('set-name-counter').props.children).toBe('14 / 60');
    expect(r.queryByText(MSG4.SET_NAME)).toBeNull();
    expect(border(box)).toBe(T.border);

    brandApi.createCampaignSet.mockResolvedValue(ok({ set: { id: 'sN' }, cutoff: addDays(earliest, -3) }));
    fireEvent.press(r.getByTestId('save-set'));
    await waitFor(() => expect(n.reset).toHaveBeenCalled());
    expect(brandApi.createCampaignSet).toHaveBeenCalledTimes(1);
    expect(brandApi.createCampaignSet).toHaveBeenCalledWith('c1', { name: 'Festive sarees', goal: 'conversion', shoot_mode: 'shipment', branch_id: null, go_live_date: earliest });
  });

  it('A4 · door 3 — from the creator pool: the banner, Aim, mode and date arrive as today, the branch is still hers to choose, and only the name box is empty with the example (check 1, U16)', async () => {
    const wanted = addDays(earliestGoLiveDay(), 3);
    const row = (entryId, id, name, pct) => ({ entryId, state: 'waiting', creator: { id, name, avatarUrl: null }, goal: 'conversion', terms: { commissionPct: pct }, termsLine: `${pct}%`,
      wantsGoLiveDate: wanted, wantsShootMode: 'visit', daysLeft: 22, closingSoon: false, noLongerPossible: false, selectable: true, agreedAt: `${yr}-09-13T10:00:00Z`, from: {} });
    const rows = [row('e1', 't', 'Tanvi Suresh', 12), row('e2', 'p', 'Priya Sharma', 10), row('e3', 'd', 'Divya R.', 11)];
    brandApi.getPool.mockResolvedValue(ok({ total: 3, groups: [{ key: `date:${wanted}`, title: `Want ${shortDate4(wanted)}`, count: 3, rows }] }));
    // The server's answer (pool.service setDefaults): the branch is never pre-filled.
    const DEFAULTS = { goal: 'conversion', shoot_mode: 'visit', branch_id: null, go_live_date: wanted, wantedDate: wanted, dateNoLongerPossible: false,
      creators: rows.map(e => ({ entryId: e.entryId, influencerId: e.creator.id, name: e.creator.name, avatarUrl: null, terms: e.terms, termsLine: e.termsLine, agreedAt: e.agreedAt, wantsGoLiveDate: wanted, wantsShootMode: 'visit' })) };
    brandApi.poolSetDefaults.mockResolvedValue(ok(DEFAULTS));
    brandApi.campaignsSummary.mockResolvedValue(ok({ campaigns: [{ id: 'c1', name: 'Diwali Edit 2026', state: 'live', setCount: 2 }], tabs: {} }));

    // The door itself: pick the three in the pool, "Create a set for 3 creators", name the campaign.
    const n = nav();
    const pool = render(<BrandPoolScreen navigation={n} route={{ params: {} }} />);
    await waitFor(() => pool.getByTestId('pool-e1'));
    fireEvent.press(pool.getByTestId('pool-e1')); fireEvent.press(pool.getByTestId('pool-e2')); fireEvent.press(pool.getByTestId('pool-e3'));
    pool.getByText('Create a set for 3 creators');
    fireEvent.press(pool.getByTestId('pool-create-set'));
    await waitFor(() => pool.getByText('Diwali Edit 2026'));
    expect(brandApi.poolSetDefaults).toHaveBeenCalledWith(['e1', 'e2', 'e3']);
    fireEvent.press(pool.getByText('Diwali Edit 2026'));
    expect(n.navigate).toHaveBeenCalledWith('BrandSetEdit', { campaignId: 'c1', campaignName: 'Diwali Edit 2026', poolDefaults: DEFAULTS });
    const params = n.navigate.mock.calls[0][1];
    pool.unmount();

    // New set, drawn with exactly what the pool sent.
    brandApi.campaignSummary.mockResolvedValue(ok({ campaign: CAMPAIGN, sets: { current: [], past: [] }, dateRules: RULES }));
    brandApi.listBranches.mockResolvedValue(ok({ branches: [{ id: 'b1', name: 'Banjara Hills', cityName: 'Hyderabad', stateName: 'Telangana', isMain: true }] }));
    const n2 = nav();
    const r = render(<BrandSetEditScreen navigation={n2} route={{ params }} />);
    await waitFor(() => expect(brandApi.listBranches).toHaveBeenCalled());
    await waitFor(() => expect(brandApi.campaignSummary).toHaveBeenCalledWith('c1'));
    r.getByText('DIWALI EDIT 2026');
    // unchanged: the banner
    r.getByTestId('pool-banner');
    r.getByText('Building for 3 creators from your pool');
    r.getByText(`Tanvi Suresh, Priya Sharma, Divya R. · they all asked for ${shortDate4(wanted)}`);
    expect(r.queryByTestId('pool-date-gone')).toBeNull();
    // the ONLY change: the name box
    expectEmptyNameBox(r);
    // unchanged: Aim, mode and date filled in from the pool
    expect(r.getByTestId('aim-conversion').props.accessibilityState.selected).toBe(true);
    expect(r.getByTestId('aim-engagement').props.accessibilityState.selected).toBe(false);
    r.getByText('From the pool: all 3 agreed Pay for Sale terms.');
    expect(r.getByTestId('mode-visit').props.accessibilityState.selected).toBe(true);
    r.getByText(longDate4(wanted));
    r.getByText(C6.newSet.dateHint(addDays(wanted, -3)));
    // unchanged: the branch is NOT pre-filled
    r.getByTestId('branch-row'); r.getByText('Choose a branch');

    // The name is required here too: nothing is saved and nothing is made up.
    fireEvent.press(r.getByTestId('save-set'));
    r.getByText(MSG4.SET_NAME); r.getByText(MSG4.BRANCH);
    expect(r.queryByText(MSG4.AIM)).toBeNull(); expect(r.queryByText(MSG4.MODE)).toBeNull(); expect(r.queryByText(MSG4.DATE)).toBeNull();
    expect(brandApi.createCampaignSet).not.toHaveBeenCalled();
    expect(r.getByTestId('set-name').props.placeholder).toBe(EXAMPLE);

    // Her own name, a branch, Save: the typed name is what is sent, and she goes on to the terms as today.
    fireEvent.changeText(r.getByTestId('set-name'), 'Festive sarees');
    fireEvent.press(r.getByTestId('branch-field'));
    await waitFor(() => r.getByTestId('branch-b1'));
    fireEvent.press(r.getByTestId('branch-b1'));
    brandApi.createCampaignSet.mockResolvedValue(ok({ set: { id: 'sP', name: 'Festive sarees' }, cutoff: addDays(wanted, -3) }));
    fireEvent.press(r.getByTestId('save-set'));
    await waitFor(() => expect(n2.replace).toHaveBeenCalled());
    expect(brandApi.createCampaignSet).toHaveBeenCalledWith('c1', { name: 'Festive sarees', goal: 'conversion', shoot_mode: 'visit', branch_id: 'b1', go_live_date: wanted });
    expect(n2.replace).toHaveBeenCalledWith('BrandCreatorTerms', { campaignId: 'c1', setId: 'sP', index: 0 });
    expect(n2.reset).not.toHaveBeenCalled();
  });

  it('editing a set still opens with its stored name, and an emptied name is refused there too (check 3)', async () => {
    const n = nav();
    const r = render(<BrandSetEditScreen navigation={n} route={{ params: { campaignId: 'c1', campaignName: 'Diwali Edit 2026', dateRules: RULES, set: { ...SET_B, locked: false, lockedFields: [] } } }} />);
    r.getByText('Edit set');
    expect(r.getByTestId('set-name').props.value).toBe('Set B · Jewellery');
    expect(r.getByTestId('set-name-counter').props.children).toBe(`${'Set B · Jewellery'.length} / 60`);
    // a live, locked set: the name is the one thing still editable, and it is the stored one.
    // It is a Store Visit set, so the screen asks for the branch list — this test's own answer.
    brandApi.listBranches.mockResolvedValue(ok({ branches: [{ id: 'b1', name: 'Banjara Hills', cityName: 'Hyderabad', stateName: 'Telangana', isMain: true }] }));
    const live = render(<BrandSetEditScreen navigation={nav()} route={{ params: { campaignId: 'c1', campaignName: 'Diwali Edit 2026', dateRules: RULES, set: SET_A } }} />);
    await waitFor(() => expect(brandApi.listBranches).toHaveBeenCalledTimes(1));
    expect(live.getByTestId('set-name').props.value).toBe('Set A · Ethnic wear');
    expect(live.getByTestId('set-name').props.editable).not.toBe(false);
    live.getByText('Banjara Hills, Hyderabad');
    live.getByTestId('lock-note');
    live.unmount();

    fireEvent.changeText(r.getByTestId('set-name'), '');
    fireEvent.press(r.getByTestId('save-set'));
    r.getByText(MSG4.SET_NAME);
    expect(brandApi.updateCampaignSet).not.toHaveBeenCalled();

    brandApi.updateCampaignSet.mockResolvedValue(ok({ set: { id: 'sB' } }));
    fireEvent.changeText(r.getByTestId('set-name'), 'Festive jewellery');
    fireEvent.press(r.getByTestId('save-set'));
    await waitFor(() => expect(brandApi.updateCampaignSet).toHaveBeenCalledWith('c1', 'sB', { name: 'Festive jewellery', goal: 'engagement', shoot_mode: 'shipment', branch_id: null, go_live_date: SET_B.postingDate }));
    await waitFor(() => expect(n.navigate).toHaveBeenCalledWith('BrandSetDetail', { campaignId: 'c1', setId: 'sB', toast: 'Set saved.' }));
  });

  it('renaming a set opens with its stored name; the Duplicate sheet keeps "<name> (copy)" (check 3)', async () => {
    brandApi.setSummary.mockResolvedValue(ok({ set: SET_A, campaign: { id: 'c1', name: 'Diwali Edit 2026' }, dateRules: RULES }));
    const r = render(<BrandSetDetailScreen navigation={nav()} route={{ params: { campaignId: 'c1', setId: 'sA' } }} />);
    await waitFor(() => r.getByTestId('set-detail-live'));
    fireEvent.press(r.getByTestId('set-menu'));
    fireEvent.press(r.getByText('Rename set'));
    await waitFor(() => r.getByTestId('rename-set-input'));
    expect(r.getByTestId('rename-set-input').props.value).toBe('Set A · Ethnic wear');
    expect(C4.duplicate.copyName('Set A · Ethnic wear')).toBe('Set A · Ethnic wear (copy)');   // the sheet itself: C10 above
  });

  /**
   * Final review, finding A-1 (frame A3 + "a refusal must appear where the person is looking").
   *
   * The red line under the name box is in the right place — but New set is taller than a phone.
   * A brand who skipped the name (which, until this change, she never had to type), filled the rest
   * and is scrolled down to the date tapped "Save set" and saw nothing change: the name box, with
   * its red outline and red line, was above the top of the screen. Save now also scrolls the form
   * to the first box it refused. The check 2 test above proves the sentence is in the tree; these
   * prove it is brought into view.
   */
  describe('a refused Save is shown: the form scrolls to the first box it refused (frame A3)', () => {
    const { ScrollView, View } = require('react-native');
    const { within } = require('@testing-library/react-native');
    const earliest = RULES.earliestPostingDate;
    const NEW_SET = { params: { campaignId: 'c1', campaignName: 'Diwali Edit 2026', dateRules: RULES } };
    // New set for a Store Visit, as the styles lay it out: 18 of padding and the campaign line,
    // then each box { top, height } inside the form's content. The form is about 840 tall.
    const BLOCKS = {
      'set-name-field': { top: 45, height: 148 },
      'set-aim-field': { top: 193, height: 210 },
      'set-mode-field': { top: 425, height: 80 },
      'branch-row': { top: 527, height: 131 },
      'set-date-field': { top: 658, height: 137 },
    };
    /**
     * jest has no layout, so the phone's answers are supplied by hand: the form starts 80 down the
     * screen (status bar and title row), is `room` tall (what is left above the Save strip — and
     * above the keypad when it is open) and is scrolled to `scrolledTo`. Returns the form's scrollTo.
     */
    function onAPhone(r, { room, scrolledTo = 0 }) {
      const form = r.UNSAFE_getAllByType(ScrollView)[0].instance;
      form.getInnerViewRef = () => ({ _nativeTag: 7 });
      form.getNativeScrollRef = () => null;
      form.measureInWindow = (cb) => cb(0, 80, 360, room);
      form.scrollTo = jest.fn();
      for (const [id, { top, height }] of Object.entries(BLOCKS)) {
        const block = r.UNSAFE_getAllByType(View).find(v => v.props.testID === id);
        if (!block) continue;                       // the branch row is drawn only for a Store Visit
        block.instance.measureLayout = (relativeTo, done) => done(18, top, 324, height);
        block.instance.measureInWindow = (cb) => cb(18, 80 + top - scrolledTo, 324, height);
      }
      return form.scrollTo;
    }
    /** A Store Visit set with everything chosen except what the test leaves out. */
    async function fill(r, { name = 'Festive sarees', branch = true, date = true } = {}) {
      if (name) fireEvent.changeText(r.getByTestId('set-name'), name);
      fireEvent.press(r.getByTestId('aim-conversion'));
      fireEvent.press(r.getByTestId('mode-visit'));
      await waitFor(() => r.getByTestId('branch-row'));
      if (branch) {
        fireEvent.press(r.getByTestId('branch-field'));
        await waitFor(() => r.getByTestId('branch-b1'));
        fireEvent.press(r.getByTestId('branch-b1'));
      }
      if (date) await pickDate(r, earliest);
    }
    beforeEach(() => {
      brandApi.listBranches.mockResolvedValue(ok({ branches: [{ id: 'b1', name: 'Banjara Hills', cityName: 'Hyderabad', stateName: 'Telangana', isMain: true }] }));
    });

    it('the name skipped, the rest filled, scrolled down to the date: Save brings the name box and its red line back into view', async () => {
      const r = render(<BrandSetEditScreen navigation={nav()} route={NEW_SET} />);
      await fill(r, { name: null });
      // 600 of room on a 360 × 760 phone; scrolled to the end, the name box ends above the top edge.
      const scrollTo = onAPhone(r, { room: 600, scrolledTo: 240 });
      fireEvent.press(r.getByTestId('save-set'));
      expect(brandApi.createCampaignSet).not.toHaveBeenCalled();
      // The red line is still under its own box and said once (frame A3) …
      expect(within(r.getByTestId('set-name-field')).getByText(MSG4.SET_NAME)).toBeTruthy();
      expect(r.getAllByText(MSG4.SET_NAME)).toHaveLength(1);
      expect(within(r.getByTestId('set-edit-bar')).queryByText(MSG4.SET_NAME)).toBeNull();
      // … and the form goes to it: the name block's top, less 6 of air, on the form's top edge.
      expect(scrollTo).toHaveBeenCalledTimes(1);
      expect(scrollTo).toHaveBeenCalledWith({ x: 0, y: 39, animated: true });
      // No box is given the cursor: the keypad stays closed.
      expect(r.getByTestId('set-name').props.autoFocus).toBeFalsy();
    });

    it('from the pool door too (frame A4): she scrolls down to choose the branch, the name is still empty', async () => {
      const wanted = addDays(earliestGoLiveDay(), 3);
      const poolDefaults = { goal: 'conversion', shoot_mode: 'visit', branch_id: null, go_live_date: wanted, wantedDate: wanted, dateNoLongerPossible: false,
        creators: [{ entryId: 'e1', influencerId: 't', name: 'Tanvi Suresh', avatarUrl: null, terms: { commissionPct: 12 }, termsLine: '12%', agreedAt: `${yr}-09-13T10:00:00Z` }] };
      brandApi.campaignSummary.mockResolvedValue(ok({ campaign: CAMPAIGN, sets: { current: [], past: [] }, dateRules: RULES }));
      const r = render(<BrandSetEditScreen navigation={nav()} route={{ params: { campaignId: 'c1', campaignName: 'Diwali Edit 2026', poolDefaults } }} />);
      await waitFor(() => r.getByTestId('branch-row'));
      await waitFor(() => expect(brandApi.campaignSummary).toHaveBeenCalled());
      fireEvent.press(r.getByTestId('branch-field'));
      await waitFor(() => r.getByTestId('branch-b1'));
      fireEvent.press(r.getByTestId('branch-b1'));
      const scrollTo = onAPhone(r, { room: 600, scrolledTo: 240 });
      fireEvent.press(r.getByTestId('save-set'));
      expect(within(r.getByTestId('set-name-field')).getByText(MSG4.SET_NAME)).toBeTruthy();
      expect(scrollTo).toHaveBeenCalledTimes(1);
      expect(scrollTo).toHaveBeenCalledWith({ x: 0, y: 39, animated: true });
    });

    it('only the date missing, while she is still at the name with the keypad open: the form goes to the date box, not to the top', async () => {
      const r = render(<BrandSetEditScreen navigation={nav()} route={NEW_SET} />);
      await fill(r, { date: false });
      const scrollTo = onAPhone(r, { room: 290, scrolledTo: 0 });
      fireEvent.press(r.getByTestId('save-set'));
      expect(within(r.getByTestId('set-date-field')).getByText(MSG4.DATE)).toBeTruthy();
      expect(r.queryByText(MSG4.SET_NAME)).toBeNull();
      // The date block's bottom edge (and 6 of air) on the form's bottom edge: 658 + 137 + 6 - 290.
      expect(scrollTo).toHaveBeenCalledTimes(1);
      expect(scrollTo).toHaveBeenCalledWith({ x: 0, y: 511, animated: true });
    });

    it('several boxes refused: the uppermost is the one shown — the name before the branch, the branch before the date', async () => {
      const r = render(<BrandSetEditScreen navigation={nav()} route={NEW_SET} />);
      await fill(r, { name: null, branch: false, date: false });
      let scrollTo = onAPhone(r, { room: 600, scrolledTo: 240 });
      fireEvent.press(r.getByTestId('save-set'));
      r.getByText(MSG4.SET_NAME); r.getByText(MSG4.BRANCH); r.getByText(MSG4.DATE);
      expect(scrollTo).toHaveBeenCalledTimes(1);
      expect(scrollTo).toHaveBeenCalledWith({ x: 0, y: 39, animated: true });

      // The name typed: the next Save is refused for the branch and the date; the branch is upper.
      fireEvent.changeText(r.getByTestId('set-name'), 'Festive sarees');
      scrollTo = onAPhone(r, { room: 290, scrolledTo: 39 });
      fireEvent.press(r.getByTestId('save-set'));
      expect(within(r.getByTestId('branch-row')).getByText(MSG4.BRANCH)).toBeTruthy();
      expect(scrollTo).toHaveBeenCalledTimes(1);
      expect(scrollTo).toHaveBeenCalledWith({ x: 0, y: 374, animated: true });      // 527 + 131 + 6 - 290
    });

    it('the refused box already on show: the red line is where she is looking, and nothing moves', async () => {
      const r = render(<BrandSetEditScreen navigation={nav()} route={NEW_SET} />);
      await fill(r, { name: null });
      const scrollTo = onAPhone(r, { room: 600, scrolledTo: 0 });
      fireEvent.press(r.getByTestId('save-set'));
      expect(within(r.getByTestId('set-name-field')).getByText(MSG4.SET_NAME)).toBeTruthy();
      expect(scrollTo).not.toHaveBeenCalled();
    });

    it('a set with nothing wrong is saved and the form is left where she had it', async () => {
      brandApi.createCampaignSet.mockResolvedValue(ok({ set: { id: 'sN' }, cutoff: addDays(earliest, -3) }));
      const n = nav();
      const r = render(<BrandSetEditScreen navigation={n} route={NEW_SET} />);
      await fill(r);
      const scrollTo = onAPhone(r, { room: 600, scrolledTo: 240 });
      fireEvent.press(r.getByTestId('save-set'));
      await waitFor(() => expect(n.reset).toHaveBeenCalled());
      expect(brandApi.createCampaignSet).toHaveBeenCalledTimes(1);
      expect(scrollTo).not.toHaveBeenCalled();
    });

    it('the server refuses the date: said under the date box and shown; a refusal with no box here is spoken above the strip and nothing moves', async () => {
      const r = render(<BrandSetEditScreen navigation={nav()} route={NEW_SET} />);
      await fill(r);
      brandApi.createCampaignSet.mockResolvedValue({ success: false, error: { code: 'VALIDATION_ERROR', message: MSG4.DATE_TOO_SOON, field: 'go_live_date' } });
      let scrollTo = onAPhone(r, { room: 290, scrolledTo: 0 });
      await act(async () => { fireEvent.press(r.getByTestId('save-set')); });
      await waitFor(() => r.getByText(MSG4.DATE_TOO_SOON));
      expect(within(r.getByTestId('set-date-field')).getByText(MSG4.DATE_TOO_SOON)).toBeTruthy();
      expect(scrollTo).toHaveBeenCalledTimes(1);
      expect(scrollTo).toHaveBeenCalledWith({ x: 0, y: 511, animated: true });

      const QUOTA = 'Limit reached on the free plan: sets per campaign (1 / 1). Upgrade to continue.';
      brandApi.createCampaignSet.mockResolvedValue({ success: false, error: { code: 'QUOTA_EXCEEDED', message: QUOTA, field: 'createSet' } });
      await pickDate(r, earliest);                 // choosing a date again takes the red line away
      scrollTo = onAPhone(r, { room: 600, scrolledTo: 240 });
      await act(async () => { fireEvent.press(r.getByTestId('save-set')); });
      await waitFor(() => r.getByText(QUOTA));
      expect(scrollTo).not.toHaveBeenCalled();
    });

    it('the boxes are where they were: each marked box holds exactly its own field and adds no space of its own', async () => {
      const r = render(<BrandSetEditScreen navigation={nav()} route={NEW_SET} />);
      await fill(r, { name: null, branch: false, date: false });
      const style = (id) => StyleSheet.flatten(r.getByTestId(id).props.style) || {};
      expect(style('set-name-field')).toEqual({});
      expect(style('set-aim-field')).toEqual({});
      expect(style('set-mode-field')).toEqual({});
      expect(style('branch-row')).toEqual({ marginTop: 16 });
      expect(style('set-date-field')).toEqual({ marginTop: 16 });
      within(r.getByTestId('set-name-field')).getByTestId('set-name');
      for (const a of ['conversion', 'engagement', 'hybrid']) within(r.getByTestId('set-aim-field')).getByTestId(`aim-${a}`);
      within(r.getByTestId('set-mode-field')).getByTestId('mode-visit'); within(r.getByTestId('set-mode-field')).getByTestId('mode-shipment');
      within(r.getByTestId('branch-row')).getByTestId('branch-field');
      within(r.getByTestId('set-date-field')).getByTestId('posting-date');
      // The form's content, top to bottom: the same things in the same order.
      const order = ['set-name-field', 'set-aim-field', 'set-mode-field', 'branch-row', 'set-date-field'];
      const content = r.UNSAFE_getAllByType(ScrollView)[0];
      const seen = content.findAll(n => typeof n.type === 'string' && order.includes(n.props.testID)).map(n => n.props.testID);
      expect(seen).toEqual(order);
    });
  });
});
