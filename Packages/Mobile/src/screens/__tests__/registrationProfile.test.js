/**
 * features/registration-and-profile — the phone screens.
 *
 * What these pin, in the order a new account meets them:
 *   C1/B1  registration refuses without a picked state + city; the city picker stays locked
 *          until a state is chosen; the payloads carry ids, never typed names
 *   OTP    a pending account enters the app; a rejected one goes to Rejected with the remarks
 *   B2b    a 403 ACCOUNT_PENDING from the API fires onAccountGate, and the sheet host shows the
 *          server's words once
 *   C4     "N things left", Submit for review disabled until complete, no Payment & tax row
 *   C7/B8  the wallets carry the payout / business-details rows
 *   B7     the second branch asks which one is main before anything is saved
 */
import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';

jest.mock('../../services/api', () => {
  const listeners = new Set();
  return {
    api: { get: jest.fn(), post: jest.fn(), patch: jest.fn() },
    authApi: { verifyOtp: jest.fn(), sendOtp: jest.fn() },
    influencerApi: { register: jest.fn(), getMe: jest.fn(), updateMe: jest.fn(), submitForReview: jest.fn(), getInvitationSettings: jest.fn(), getMySocial: jest.fn(), getEarnings: jest.fn() },
    brandApi: { register: jest.fn(), getMe: jest.fn(), updateMe: jest.fn(), submitForReview: jest.fn(), getPitchSettings: jest.fn(), listBranches: jest.fn(), createBranch: jest.fn(), updateBranch: jest.fn(), getWallet: jest.fn(), getWalletTransactions: jest.fn() },
    referenceApi: {
      offeredStates: jest.fn().mockResolvedValue({ success: true, data: { items: [
        { id: 1, name: 'Telangana', cities: [{ id: 10, name: 'Hyderabad' }, { id: 11, name: 'Warangal' }] },
        { id: 2, name: 'Kerala', cities: [{ id: 20, name: 'Kochi' }] },
      ] } }),
      brandCategories: jest.fn().mockResolvedValue({ success: true, data: { items: [{ code: 'WOMEN', label: 'Women' }, { code: 'MEN', label: 'Men' }] } }),
    },
    onAccountGate: (fn) => { listeners.add(fn); return () => listeners.delete(fn); },
    __emitGate: (e) => { for (const fn of [...listeners]) fn(e); },
    clearSession: jest.fn(), uploadFile: jest.fn(),
  };
});
const mockSetRole = jest.fn();
jest.mock('../../../App', () => ({ AuthContext: require('react').createContext({ setRole: mockSetRole }) }));
jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (cb) => { const React = require('react'); React.useEffect(() => cb(), [cb]); },
  createNavigationContainerRef: () => ({ isReady: () => false, navigate: jest.fn() }),
}));
jest.mock('@react-native-clipboard/clipboard', () => ({ getString: jest.fn().mockResolvedValue('') }));

const api = require('../../services/api');
const { influencerApi, brandApi, authApi } = api;
const InfluencerRegisterScreen = require('../auth/InfluencerRegisterScreen').default;
const BrandRegisterScreen = require('../auth/BrandRegisterScreen').default;
const OTPScreen = require('../auth/OTPScreen').default;
const PendingSheetHost = require('../../components/shell/PendingSheetHost').default;
const ProfileScreen = require('../influencer/ProfileScreen').default;
const CreatorWalletScreen = require('../influencer/CreatorWalletScreen').default;
const BrandWalletScreen = require('../brand/BrandWalletScreen').default;
const BrandBranchEditScreen = require('../brand/BrandBranchEditScreen').default;
const RejectedScreen = require('../auth/RejectedScreen').default;
const PendingHomeScreen = require('../../components/shell/PendingHomeScreen').default;
const { _resetFinishProfileSheet } = require('../../components/shell/PendingHomeScreen');
const ProfileInfoScreen = require('../influencer/ProfileInfoScreen').default;
const NicheLanguagesScreen = require('../influencer/NicheLanguagesScreen').default;

const nav = () => ({ goBack: jest.fn(), navigate: jest.fn(), setParams: jest.fn(), reset: jest.fn(), addListener: jest.fn(() => () => {}), dispatch: jest.fn() });
const ok = (data) => ({ success: true, data });

async function pickStateAndCity(r, prefix, stateId, cityId) {
  fireEvent.press(r.getByTestId(`${prefix}-state`));
  await waitFor(() => r.getByTestId(`${prefix}-state-option-${stateId}`));
  fireEvent.press(r.getByTestId(`${prefix}-state-option-${stateId}`));
  fireEvent.press(r.getByTestId(`${prefix}-city`));
  await waitFor(() => r.getByTestId(`${prefix}-city-option-${cityId}`));
  fireEvent.press(r.getByTestId(`${prefix}-city-option-${cityId}`));
}

beforeEach(() => { jest.clearAllMocks(); });

// ── C1 · B1 ──────────────────────────────────────────────────────────────────

describe('C1 — creator registration, step 1', () => {
  it('refuses to continue without a state and a city, then sends the ids', async () => {
    influencerApi.register.mockResolvedValue(ok({ influencer: { id: 'c1' }, user_status: 'pending', claim: {} }));
    const r = render(<InfluencerRegisterScreen navigation={nav()} />);
    // The load-bearing label and its helper line, verbatim (spec §1.3).
    r.getByText(/^Your nearest major city/);
    r.getByText('The closest big city to you — not your exact town or area.');
    fireEvent.changeText(r.getByTestId('reg-name'), 'Priya Sharma');
    fireEvent.press(r.getByTestId('reg-continue-1'));
    r.getByText('Pick your state.'); r.getByText('Pick your nearest major city.');
    expect(r.queryByTestId('reg-instagram')).toBeNull();
    // The city is locked until a state is chosen.
    expect(r.getByTestId('reg-city').props.accessibilityState.disabled).toBe(true);
    r.getByText('Pick a state first');
    await pickStateAndCity(r, 'reg', 1, 10);
    expect(r.getByTestId('reg-city').props.accessibilityState.disabled).toBe(false);
    r.getByText('Hyderabad');
    fireEvent.press(r.getByTestId('reg-continue-1'));
    fireEvent.changeText(r.getByTestId('reg-instagram'), 'priya.styles');
    fireEvent.press(r.getByTestId('reg-continue-2'));
    await waitFor(() => expect(influencerApi.register).toHaveBeenCalledWith({ name: 'Priya Sharma', state_id: 1, city_id: 10, instagram_handle: 'priya.styles' }));
    await waitFor(() => expect(mockSetRole).toHaveBeenCalledWith('influencer'));
  });

  it('changing the state clears the city', async () => {
    const r = render(<InfluencerRegisterScreen navigation={nav()} />);
    await pickStateAndCity(r, 'reg', 1, 10);
    r.getByText('Hyderabad');
    fireEvent.press(r.getByTestId('reg-state'));
    await waitFor(() => r.getByTestId('reg-state-option-2'));
    fireEvent.press(r.getByTestId('reg-state-option-2'));
    expect(r.queryByText('Hyderabad')).toBeNull();
    r.getByText('Kerala');
  });
});

describe('B1 — brand registration, seven fields', () => {
  const fill = (r, over = {}) => {
    const v = { name: 'Ravi Kumar', business: 'Label Fern', street: 'Shop 12, Road No. 4', pincode: '500034', ...over };
    if (v.name != null) fireEvent.changeText(r.getByTestId('reg-name'), v.name);
    if (v.business != null) fireEvent.changeText(r.getByTestId('reg-business'), v.business);
    if (v.street != null) fireEvent.changeText(r.getByTestId('reg-street'), v.street);
    if (v.pincode != null) fireEvent.changeText(r.getByTestId('reg-pincode'), v.pincode);
  };
  const disabled = (r) => r.getByTestId('reg-submit').props.accessibilityState.disabled;

  it('states Fashion, keeps the button off until all seven are valid, keeps the city locked until a state, and sends ids', async () => {
    brandApi.register.mockResolvedValue(ok({ brand: { id: 'b1' }, user_status: 'pending' }));
    const r = render(<BrandRegisterScreen navigation={nav()} />);
    r.getByText('Set up your business');
    r.getByText('Fashion — clothing, footwear, jewellery');
    r.getByText('Create business account');
    await waitFor(() => r.getByTestId('sub-WOMEN'));
    expect(disabled(r)).toBe(true);
    expect(r.getByTestId('reg-city').props.accessibilityState.disabled).toBe(true);

    // Each of the seven, missing in turn, keeps the button off.
    fill(r); fireEvent.press(r.getByTestId('sub-WOMEN')); await pickStateAndCity(r, 'reg', 1, 10);
    expect(disabled(r)).toBe(false);
    fill(r, { name: '' }); expect(disabled(r)).toBe(true); fill(r, { name: 'Ravi Kumar' });
    fill(r, { business: '' }); expect(disabled(r)).toBe(true); fill(r, { business: 'Label Fern' });
    fireEvent.press(r.getByTestId('sub-WOMEN')); expect(disabled(r)).toBe(true); fireEvent.press(r.getByTestId('sub-WOMEN'));
    fill(r, { street: '' }); expect(disabled(r)).toBe(true); fill(r, { street: 'Shop 12, Road No. 4' });
    fill(r, { pincode: '5000' }); expect(disabled(r)).toBe(true); fill(r, { pincode: '500034' });
    // A new state clears the city → off again until a city is picked.
    fireEvent.press(r.getByTestId('reg-state'));
    await waitFor(() => r.getByTestId('reg-state-option-2'));
    fireEvent.press(r.getByTestId('reg-state-option-2'));
    expect(disabled(r)).toBe(true);
    fireEvent.press(r.getByTestId('reg-city'));
    await waitFor(() => r.getByTestId('reg-city-option-20'));
    fireEvent.press(r.getByTestId('reg-city-option-20'));
    expect(disabled(r)).toBe(false);

    fireEvent.press(r.getByTestId('reg-submit'));
    await waitFor(() => expect(brandApi.register).toHaveBeenCalledWith({
      name: 'Ravi Kumar', business_name: 'Label Fern', sub_categories: ['WOMEN'], address_line: 'Shop 12, Road No. 4', pincode: '500034', state_id: 2, city_id: 20,
    }));
    const sent = brandApi.register.mock.calls[0][0];
    ['latitude', 'longitude', 'locality', 'formatted_address', 'google_maps_url', 'referral_code', 'city', 'state'].forEach(k => expect(sent[k]).toBeUndefined());
    await waitFor(() => expect(mockSetRole).toHaveBeenCalledWith('brand'));
  });

  it('a server refusal on a field lands under that field', async () => {
    brandApi.register.mockResolvedValue({ success: false, error: { code: 'VALIDATION_ERROR', field: 'city_id', message: 'Pick a city from the list.' } });
    const r = render(<BrandRegisterScreen navigation={nav()} />);
    await waitFor(() => r.getByTestId('sub-WOMEN'));
    fill(r); fireEvent.press(r.getByTestId('sub-WOMEN')); await pickStateAndCity(r, 'reg', 1, 10);
    fireEvent.press(r.getByTestId('reg-submit'));
    await waitFor(() => r.getByText('Pick a city from the list.'));
    expect(mockSetRole).not.toHaveBeenCalled();
  });
});

// ── OTP gate ─────────────────────────────────────────────────────────────────

describe('OTP — the status gate', () => {
  const login = (role) => ok({ access_token: 't', refresh_token: 'r', user: { id: 'u1', role } });
  async function verify(role) {
    const n = nav();
    const r = render(<OTPScreen navigation={n} route={{ params: { phone: '+919876543210', role } }} />);
    fireEvent.changeText(r.getAllByDisplayValue('')[0], '123456');
    fireEvent.press(r.getByTestId('otp-verify'));
    return { n, r };
  }

  it('a pending creator enters the app — never the Waiting screen', async () => {
    authApi.verifyOtp.mockResolvedValue(login('influencer'));
    influencerApi.getMe.mockResolvedValue(ok({ influencer: { id: 'c1' }, user_status: 'pending', completeness: { total: 10, done: 5 } }));
    const { n } = await verify('influencer');
    await waitFor(() => expect(mockSetRole).toHaveBeenCalledWith('influencer'));
    expect(n.reset).not.toHaveBeenCalled();
  });

  it('a rejected creator goes to Rejected with the remarks', async () => {
    authApi.verifyOtp.mockResolvedValue(login('influencer'));
    influencerApi.getMe.mockResolvedValue(ok({ influencer: { id: 'c1' }, user_status: 'rejected', rejection_reason: 'Handle does not match.' }));
    const { n } = await verify('influencer');
    await waitFor(() => expect(n.reset).toHaveBeenCalledWith({ index: 0, routes: [{ name: 'Rejected', params: { reason: 'Handle does not match.' } }] }));
    expect(mockSetRole).not.toHaveBeenCalled();
  });

  it('a pending brand enters the app; a rejected brand goes to Rejected with the brand\'s remarks', async () => {
    authApi.verifyOtp.mockResolvedValue(login('brand'));
    brandApi.getMe.mockResolvedValue(ok({ brand: { id: 'b1' }, user_status: 'pending' }));
    let v = await verify('brand');
    await waitFor(() => expect(mockSetRole).toHaveBeenCalledWith('brand'));
    expect(v.n.reset).not.toHaveBeenCalled();
    v.r.unmount(); jest.clearAllMocks();

    authApi.verifyOtp.mockResolvedValue(login('brand'));
    brandApi.getMe.mockResolvedValue(ok({ brand: { id: 'b1', rejection_reason: 'Add the shop number.' }, user_status: 'rejected' }));
    v = await verify('brand');
    await waitFor(() => expect(v.n.reset).toHaveBeenCalledWith({ index: 0, routes: [{ name: 'Rejected', params: { reason: 'Add the shop number.' } }] }));
  });
});

// ── B2b — the gate event and the sheet ───────────────────────────────────────

describe('B2b — ACCOUNT_PENDING', () => {
  it('the real API client fires onAccountGate on a 403 ACCOUNT_PENDING (and not on other errors)', async () => {
    const real = jest.requireActual('../../services/api');
    const seen = [];
    const off = real.onAccountGate((e) => seen.push(e));
    const respond = (status, body) => Promise.resolve({ status, ok: status < 400, text: () => Promise.resolve(JSON.stringify(body)) });
    global.fetch = jest.fn()
      .mockImplementationOnce(() => respond(403, { success: false, error: { code: 'ACCOUNT_PENDING', message: 'Your account is under review by admin.' } }))
      .mockImplementationOnce(() => respond(422, { success: false, error: { code: 'VALIDATION_ERROR', message: 'nope' } }))
      .mockImplementationOnce(() => respond(200, { success: true, data: {} }));
    await real.api.post('/influencers/me/invitations/x/accept');
    await real.api.post('/anything');
    await real.api.get('/anything');
    expect(seen).toEqual([{ code: 'ACCOUNT_PENDING', message: 'Your account is under review by admin.' }]);
    off();
    delete global.fetch;
  });

  it('PendingSheetHost shows the server\'s words once per event, ignores a duplicate while open, and Finish my profile opens the Profile tab', async () => {
    const navigate = jest.fn();
    const r = render(<PendingSheetHost navigate={navigate} />);
    expect(r.queryByText('Your account is under review')).toBeNull();
    act(() => { api.__emitGate({ code: 'ACCOUNT_PENDING', message: 'Your account is under review by admin. This feature will be available once approved (usually within 24 hours).' }); });
    r.getByText('Your account is under review');
    r.getByText('Your account is under review by admin. This feature will be available once approved (usually within 24 hours).');
    r.getByText('A complete profile gets reviewed faster.');
    act(() => { api.__emitGate({ code: 'ACCOUNT_PENDING', message: 'A second message that must not replace the first.' }); });
    expect(r.queryByText('A second message that must not replace the first.')).toBeNull();
    expect(r.getAllByText('Your account is under review')).toHaveLength(1);
    fireEvent.press(r.getByTestId('pending-sheet-finish'));
    expect(navigate).toHaveBeenCalledWith('ProfileTab');
    expect(r.queryByText('Your account is under review')).toBeNull();
    // Closed → the next event shows again.
    act(() => { api.__emitGate({ code: 'ACCOUNT_PENDING', message: 'Again.' }); });
    r.getByText('Again.');
    fireEvent.press(r.getByTestId('pending-sheet-ok'));
    expect(r.queryByText('Again.')).toBeNull();
  });
});

// ── C4 — the creator's profile ───────────────────────────────────────────────

describe('C4 — Profile main', () => {
  const ME = { id: 'c1', full_name: 'Priya Sharma', instagram_handle: 'priya.styles', city_name: 'Hyderabad', niche: ['fashion'], language: ['Telugu'], needsNiche: false };
  beforeEach(() => {
    influencerApi.getInvitationSettings.mockResolvedValue(ok({ summary: { labelState: 'open', aims: ['conversion'], modes: ['shipment'] } }));
    influencerApi.getMySocial.mockResolvedValue(ok({ instagram: null, youtube: null, chip: null }));
  });

  it('"4 things left", red dots on the owning rows, Submit disabled with the hint, no Payment & tax', async () => {
    influencerApi.getMe.mockResolvedValue(ok({ influencer: ME, user_status: 'pending', submitted_for_review_at: null,
      completeness: { total: 10, done: 6, complete: false, missing: ['photo', 'bio', 'age', 'gender'], missing_labels: ['photo', 'bio', 'age', 'gender'] } }));
    const r = render(<ProfileScreen navigation={nav()} route={{ params: {} }} />);
    await waitFor(() => r.getByTestId('completeness-note'));
    r.getByText('Under review');
    r.getByText('4 things left');
    r.getByText('Photo, bio, age, gender');
    r.getByText('@priya.styles · Hyderabad');
    r.getByTestId('row-profile-info-dot');
    expect(r.queryByTestId('row-niche-dot')).toBeNull();
    expect(r.queryByTestId('row-payment-tax')).toBeNull();
    expect(r.queryByText('Payment & tax')).toBeNull();
    expect(r.getByTestId('submit-for-review').props.accessibilityState.disabled).toBe(true);
    r.getByText('Finish the 4 items above to submit');
    fireEvent.press(r.getByTestId('submit-for-review'));
    expect(influencerApi.submitForReview).not.toHaveBeenCalled();
  });

  it('complete → Submit enabled and it sends; the niche row carries the dot when niche or language is missing', async () => {
    influencerApi.getMe.mockResolvedValue(ok({ influencer: ME, user_status: 'pending', submitted_for_review_at: null,
      completeness: { total: 10, done: 10, complete: true, missing: [], missing_labels: [] } }));
    influencerApi.submitForReview.mockResolvedValue(ok({ user_status: 'pending', submitted: true, message: 'Sent for review.' }));
    const r = render(<ProfileScreen navigation={nav()} route={{ params: {} }} />);
    await waitFor(() => r.getByTestId('submit-for-review'));
    expect(r.queryByTestId('completeness-note')).toBeNull();
    expect(r.getByTestId('submit-for-review').props.accessibilityState.disabled).toBe(false);
    fireEvent.press(r.getByTestId('submit-for-review'));
    await waitFor(() => expect(influencerApi.submitForReview).toHaveBeenCalled());
    r.unmount();

    influencerApi.getMe.mockResolvedValue(ok({ influencer: ME, user_status: 'pending',
      completeness: { total: 10, done: 9, complete: false, missing: ['language'], missing_labels: ['languages'] } }));
    const r2 = render(<ProfileScreen navigation={nav()} route={{ params: {} }} />);
    await waitFor(() => r2.getByTestId('row-niche-dot'));
    r2.getByText('1 thing left');
  });

  it('sent and still pending → "Sent for review · date" instead of the button; approved → nothing at all', async () => {
    influencerApi.getMe.mockResolvedValue(ok({ influencer: ME, user_status: 'pending', submitted_for_review_at: '2026-09-18T10:00:00Z',
      completeness: { total: 10, done: 10, complete: true, missing: [], missing_labels: [] } }));
    let r = render(<ProfileScreen navigation={nav()} route={{ params: {} }} />);
    await waitFor(() => r.getByTestId('review-sent'));
    r.getByText('Sent for review · 18 Sep');
    expect(r.queryByTestId('submit-for-review')).toBeNull();
    r.unmount();

    influencerApi.getMe.mockResolvedValue(ok({ influencer: ME, user_status: 'approved', completeness: { total: 10, done: 8, complete: false, missing: ['bio', 'age'], missing_labels: ['bio', 'age'] } }));
    r = render(<ProfileScreen navigation={nav()} route={{ params: {} }} />);
    await waitFor(() => r.getByTestId('row-profile-info'));
    r.getByText('Approved');
    expect(r.queryByTestId('review-block')).toBeNull();
    expect(r.queryByTestId('review-sent')).toBeNull();
    expect(r.queryByTestId('completeness-note')).toBeNull();
    expect(r.queryByTestId('row-profile-info-dot')).toBeNull();
  });
});

// ── C7 · B8 — the wallets ────────────────────────────────────────────────────

describe('C7 · B8 — payout and business details on the wallets', () => {
  it('the creator wallet shows UPI / Bank account / PAN with Added or Not added, and opens the detail screen', async () => {
    influencerApi.getEarnings.mockResolvedValue(ok({ wallet_balance: '8625.00', pending_amount: '2400.00', total_earned: '11025.00', locked_entries: [] }));
    influencerApi.getMe.mockResolvedValue(ok({ influencer: { has_upi: true, has_bank_account: false, has_pan: false } }));
    const n = nav();
    const r = render(<CreatorWalletScreen navigation={n} route={{ params: {} }} />);
    await waitFor(() => r.getByTestId('payment-details'));
    r.getByText('Payment details'); r.getByText('Add these to get paid'); r.getByText('Not needed for approval — only before your first withdrawal.');
    r.getByText('UPI'); r.getByText('Bank account'); r.getByText('Account number + IFSC'); r.getByText('PAN'); r.getByText('For your TDS certificate');
    expect(r.getByTestId('row-upi-value').props.children).toBe('Added');
    expect(r.getByTestId('row-bank-value').props.children).toBe('Not added');
    expect(r.getByTestId('row-pan-value').props.children).toBe('Not added');
    r.getByText('Our team checks these by hand, usually the same day.');
    fireEvent.press(r.getByTestId('row-bank'));
    expect(n.navigate).toHaveBeenCalledWith('PayoutDetail', { kind: 'bank' });
  });

  it('the brand wallet shows GST number / Bank account and opens the detail screen', async () => {
    brandApi.getWallet.mockResolvedValue(ok({ wallet: { available_balance: 0, reserved_balance: 25875, settled_balance: 0 } }));
    brandApi.getWalletTransactions.mockResolvedValue(ok({ transactions: [] }));
    brandApi.getMe.mockResolvedValue(ok({ brand: { gstin: '36ABCDE1234F1Z5', has_bank_account: false } }));
    const n = nav();
    const r = render(<BrandWalletScreen navigation={n} route={{ params: {} }} />);
    await waitFor(() => r.getByTestId('business-details'));
    r.getByText('Business & payment details'); r.getByText('Needed before money moves'); r.getByText('Not needed for approval. Our team verifies these by hand.');
    r.getByText('GST number'); r.getByText('Appears on your agreements'); r.getByText('Bank account');
    expect(r.getByTestId('row-gst-value').props.children).toBe('Added');
    expect(r.getByTestId('row-bank-value').props.children).toBe('Not added');
    fireEvent.press(r.getByTestId('row-gst'));
    expect(n.navigate).toHaveBeenCalledWith('BrandPayoutDetail', { kind: 'gst' });
  });
});

// ── C8 · B9 — Rejected ───────────────────────────────────────────────────────

describe('C8 · B9 — Rejected', () => {
  it('creator: the remarks, her form pre-filled, Send saves only what changed then submits, and the app opens', async () => {
    influencerApi.getMe.mockResolvedValue(ok({ influencer: { full_name: 'Priya Sharma', state_id: 1, city_id: 10, state_name: 'Telangana', city_name: 'Hyderabad', instagram_handle: 'priya.stylez', youtube_handle: '' }, user_status: 'rejected', rejection_reason: 'from the server' }));
    influencerApi.updateMe.mockResolvedValue(ok({ influencer: {} }));
    influencerApi.submitForReview.mockResolvedValue(ok({ user_status: 'pending', submitted: true }));
    const r = render(<RejectedScreen navigation={nav()} route={{ params: { role: 'influencer', reason: "The Instagram handle doesn't match the name on the account." } }} />);
    await waitFor(() => r.getByTestId('rejected-creator'));
    r.getByText('Needs a fix'); r.getByText('What the admin said');
    r.getByText("The Instagram handle doesn't match the name on the account.");
    r.getByText("Change what's wrong and send it back. Review usually takes under a day.");
    expect(r.getByTestId('rej-name').props.value).toBe('Priya Sharma');
    expect(r.getByTestId('rej-instagram').props.value).toBe('priya.stylez');
    r.getByText('Telangana'); r.getByText('Hyderabad');
    r.getByText('Send for review again'); r.getByText('Sign out');
    fireEvent.changeText(r.getByTestId('rej-instagram'), 'priya.styles');
    fireEvent.press(r.getByTestId('rejected-send'));
    await waitFor(() => expect(influencerApi.updateMe).toHaveBeenCalledWith({ instagram_handle: 'priya.styles' }));
    await waitFor(() => expect(influencerApi.submitForReview).toHaveBeenCalled());
    await waitFor(() => expect(mockSetRole).toHaveBeenCalledWith('influencer'));
  });

  it('brand: business name + the four-part address pre-filled from the main branch; PROFILE_INCOMPLETE shows the message and "Finish my profile" opens the app', async () => {
    brandApi.getMe.mockResolvedValue(ok({ brand: { business_name: 'Label Fern', address_line: 'Road No. 4', pincode: '500034', rejection_reason: 'Please add the shop number.' }, user_status: 'rejected',
      branches: [{ id: 'b1', isMain: true, formattedAddress: 'Road No. 4', pincode: '500034', stateId: 1, stateName: 'Telangana', cityId: 10, cityName: 'Hyderabad' }] }));
    brandApi.updateMe.mockResolvedValue(ok({ brand: {} }));
    brandApi.submitForReview.mockResolvedValue({ success: false, error: { code: 'PROFILE_INCOMPLETE', message: 'Add your logo, about and contact person first.', details: { missing_labels: ['logo', 'about', 'contact person'] } } });
    const r = render(<RejectedScreen navigation={nav()} route={{ params: { role: 'brand' } }} />);
    await waitFor(() => r.getByTestId('rejected-brand'));
    r.getByText('Please add the shop number.');
    expect(r.getByTestId('rej-business').props.value).toBe('Label Fern');
    expect(r.getByTestId('rej-street').props.value).toBe('Road No. 4');
    expect(r.getByTestId('rej-pincode').props.value).toBe('500034');
    r.getByText('Telangana'); r.getByText('Hyderabad');
    fireEvent.changeText(r.getByTestId('rej-street'), 'Shop 12, Road No. 4');
    fireEvent.press(r.getByTestId('rejected-send'));
    await waitFor(() => expect(brandApi.updateMe).toHaveBeenCalledWith({ address_line: 'Shop 12, Road No. 4' }));
    await waitFor(() => r.getByText('Add your logo, about and contact person first.'));
    expect(mockSetRole).not.toHaveBeenCalled();
    fireEvent.press(r.getByTestId('rejected-finish-profile'));
    expect(mockSetRole).toHaveBeenCalledWith('brand');
  });
});

// ── C3 · B2 — the pending home ───────────────────────────────────────────────

describe('C3 · B2 — pending home', () => {
  beforeEach(() => _resetFinishProfileSheet());

  it('creator: under review, two cards, the finish-profile sheet with the reason — once per session; Complete profile opens the Profile tab', async () => {
    influencerApi.getMe.mockResolvedValue(ok({ influencer: { id: 'c1' }, user_status: 'pending', completeness: { total: 10, done: 6, complete: false, missing_labels: ['photo', 'bio', 'niche', 'languages'] } }));
    const n = nav();
    const r = render(<PendingHomeScreen navigation={n} route={{ params: { kind: 'creatorHome', tabTitle: 'Home' } }} />);
    await waitFor(() => r.getByTestId('pending-home-creator'));
    r.getByText('Under review'); r.getByText('Usually within 24 hours. You can look around while you wait.');
    r.getByText('Brands on INFLX'); r.getByText('How collaborations work');
    r.getByText('Finish your profile');
    r.getByText('6 of 10 done. Add your photo, bio, niche and languages.');
    r.getByText("This gets you approved faster — an admin can only verify an account that's complete.");
    fireEvent.press(r.getByTestId('finish-profile-complete'));
    expect(n.navigate).toHaveBeenCalledWith('ProfileTab');
    expect(r.queryByText('Finish your profile')).toBeNull();
    r.unmount();
    // Same session → not again.
    const r2 = render(<PendingHomeScreen navigation={nav()} route={{ params: { kind: 'creatorHome', tabTitle: 'Home' } }} />);
    await waitFor(() => r2.getByTestId('pending-home-creator'));
    expect(r2.queryByText('Finish your profile')).toBeNull();
  });

  it('brand: locked tiles and the business wording; approved → the existing Coming soon screen', async () => {
    brandApi.getMe.mockResolvedValue(ok({ brand: { business_name: 'Label Fern' }, user_status: 'pending', completeness: { total: 10, done: 7, complete: false, missing_labels: ['logo', 'an about line', 'a contact person'] } }));
    let r = render(<PendingHomeScreen navigation={nav()} route={{ params: { kind: 'brandHome', tabTitle: 'Home' } }} />);
    await waitFor(() => r.getByTestId('pending-home-brand'));
    r.getByText('Label Fern'); r.getByText('Campaigns'); r.getByText('Find creators'); expect(r.getAllByText('Locked until approved')).toHaveLength(2);
    r.getByText('7 of 10 done. Add your logo, an about line and a contact person.');
    r.getByText("This gets you approved faster — an admin can only verify a business that's complete.");
    fireEvent.press(r.getByTestId('finish-profile-later'));
    r.unmount();

    brandApi.getMe.mockResolvedValue(ok({ brand: { business_name: 'Label Fern' }, user_status: 'approved', completeness: { total: 10, done: 10, complete: true } }));
    r = render(<PendingHomeScreen navigation={nav()} route={{ params: { kind: 'brandHome', tabTitle: 'Home' } }} />);
    await waitFor(() => r.getByTestId('coming-soon-brandHome'));
    r.getByText('Home is coming soon');
  });
});

// ── C5 · C6 — profile info, niche & languages ────────────────────────────────

describe('C5 · C6 — the creator profile forms', () => {
  const ME = { id: 'c1', full_name: 'Priya Sharma', instagram_handle: 'priya.styles', youtube_handle: '', user_status: 'pending', state_id: 1, city_id: 10, state_name: 'Telangana', city_name: 'Hyderabad', niche: ['fashion'], language: ['en'] };

  it('C5: age, gender and email save with the city ids only when they changed', async () => {
    influencerApi.getMe.mockResolvedValue(ok({ influencer: ME }));
    influencerApi.updateMe.mockResolvedValue(ok({ influencer: ME }));
    const n = nav();
    const r = render(<ProfileInfoScreen navigation={n} route={{ params: {} }} />);
    await waitFor(() => r.getByTestId('field-age'));
    r.getByText("We won't show this to brands.");
    r.getByText('Hyderabad');
    fireEvent.changeText(r.getByTestId('field-age'), '24');
    fireEvent.press(r.getByTestId('field-gender'));
    fireEvent.press(r.getByTestId('gender-option-female'));
    r.getByText('Female');
    fireEvent.changeText(r.getByTestId('field-email'), 'priya@example.com');
    fireEvent.press(r.getByTestId('save-button'));
    await waitFor(() => expect(influencerApi.updateMe).toHaveBeenCalledWith({ age: 24, gender: 'female', email: 'priya@example.com' }));
    expect(n.navigate).toHaveBeenCalledWith('ProfileMain', { toast: 'Saved.' });
    r.unmount(); jest.clearAllMocks();

    influencerApi.getMe.mockResolvedValue(ok({ influencer: ME }));
    influencerApi.updateMe.mockResolvedValue(ok({ influencer: ME }));
    const r2 = render(<ProfileInfoScreen navigation={nav()} route={{ params: {} }} />);
    await waitFor(() => r2.getByTestId('field-city'));
    await pickStateAndCity(r2, 'field', 2, 20);
    fireEvent.press(r2.getByTestId('save-button'));
    await waitFor(() => expect(influencerApi.updateMe).toHaveBeenCalledWith({ state_id: 2, city_id: 20 }));
  });

  it('C6: Other reveals the box and the honest note, requires the text, and saves niche_other; every language from the list is offered', async () => {
    influencerApi.getMe.mockResolvedValue(ok({ influencer: ME }));
    influencerApi.updateMe.mockResolvedValue(ok({ influencer: ME }));
    api.referenceApi.creatorNiches = jest.fn().mockResolvedValue(ok({ items: [{ code: 'fashion', label: 'Fashion' }, { code: 'beauty', label: 'Beauty' }, { code: 'other', label: 'Other' }] }));
    api.referenceApi.languages = jest.fn().mockResolvedValue(ok({ items: Array.from({ length: 30 }, (_, i) => ({ code: `l${i}`, label: `Lang ${i}` })) }));
    const n = nav();
    const r = render(<NicheLanguagesScreen navigation={n} />);
    await waitFor(() => r.getByTestId('niche-other'));
    r.getByText("Pick one — the thing you're known for.");
    expect(r.getAllByTestId(/^lang-/)).toHaveLength(30);
    expect(r.queryByTestId('niche-other-block')).toBeNull();
    fireEvent.press(r.getByTestId('niche-other'));
    r.getByText(/^What kind of content\?/);
    r.getByText("We'll add this to the list so brands can find you by it. Until then you're found every other way.");
    expect(r.getByTestId('save-button').props.accessibilityState.disabled).toBe(true);
    r.getByText('Tell us what kind of content you make.');
    fireEvent.changeText(r.getByTestId('niche-other-text'), 'Pet & dog training');
    fireEvent.press(r.getByTestId('lang-l3'));
    fireEvent.press(r.getByTestId('save-button'));
    await waitFor(() => expect(influencerApi.updateMe).toHaveBeenCalledWith({ niche: ['other'], niche_other: 'Pet & dog training', language: ['en', 'l3'] }));
  });
});

// ── B6 · B7 — the second branch ──────────────────────────────────────────────

describe('B6 · B7 — adding a branch', () => {
  async function fillBranch(r) {
    fireEvent.changeText(r.getByTestId('branch-name'), 'Jubilee Hills');
    fireEvent.changeText(r.getByTestId('branch-address-text'), 'Plot 8, Road No. 36');
    fireEvent.changeText(r.getByTestId('branch-pin'), '500033');
    await pickStateAndCity(r, 'branch', 1, 10);
  }

  it('the second branch asks "Which is your main branch?" before saving, then saves both with is_main', async () => {
    brandApi.createBranch.mockResolvedValue(ok({ branch: { id: 'b2' } }));
    const n = nav();
    const r = render(<BrandBranchEditScreen navigation={n} route={{ params: { branchCount: 1, mainBranch: { id: 'b1', name: 'Banjara Hills', cityName: 'Hyderabad', isMain: true } } }} />);
    r.getByText("A store visit can't be planned to a branch with no street address — so this one is required.");
    expect(r.queryByTestId('branch-type-instead')).toBeNull();
    expect(r.queryByTestId('branch-search-instead')).toBeNull();
    await fillBranch(r);
    fireEvent.press(r.getByTestId('save-button'));
    await waitFor(() => r.getByText('Which is your main branch?'));
    expect(brandApi.createBranch).not.toHaveBeenCalled();
    r.getByText('Banjara Hills'); r.getByText('Hyderabad · your first branch');
    r.getByText('Jubilee Hills'); r.getByText('Hyderabad · new');
    expect(r.getByTestId('main-branch-save').props.accessibilityState.disabled).toBe(true);
    fireEvent.press(r.getByTestId('main-choice-new'));
    fireEvent.press(r.getByTestId('main-branch-save'));
    await waitFor(() => expect(brandApi.createBranch).toHaveBeenCalledWith({ name: 'Jubilee Hills', address_text: 'Plot 8, Road No. 36', pincode: '500033', state_id: 1, city_id: 10, is_main: true }));
    await waitFor(() => expect(n.navigate).toHaveBeenCalledWith('BrandBranches', { toast: 'Saved.' }));
  });

  it('the first branch saves straight away with no is_main; the server\'s MAIN_CHOICE_REQUIRED opens the sheet', async () => {
    brandApi.createBranch.mockResolvedValueOnce(ok({ branch: { id: 'b1' } }));
    const n = nav();
    let r = render(<BrandBranchEditScreen navigation={n} route={{ params: { branchCount: 0, mainBranch: null } }} />);
    await fillBranch(r);
    fireEvent.press(r.getByTestId('save-button'));
    await waitFor(() => expect(brandApi.createBranch).toHaveBeenCalledWith({ name: 'Jubilee Hills', address_text: 'Plot 8, Road No. 36', pincode: '500033', state_id: 1, city_id: 10 }));
    expect(r.queryByText('Which is your main branch?')).toBeNull();
    r.unmount(); jest.clearAllMocks();

    brandApi.createBranch.mockResolvedValueOnce({ success: false, error: { code: 'MAIN_CHOICE_REQUIRED', field: 'is_main', message: 'Say which is main.' } });
    r = render(<BrandBranchEditScreen navigation={nav()} route={{ params: { branchCount: 2, mainBranch: { id: 'b1', name: 'Banjara Hills', cityName: 'Hyderabad', isMain: true } } }} />);
    await fillBranch(r);
    fireEvent.press(r.getByTestId('save-button'));
    await waitFor(() => r.getByText('Which is your main branch?'));
  });
});
