/**
 * creator-address-bank-save — the creator app: the delivery address she keeps in her profile, the
 * Remote address form that starts from it, and her bank account in full.
 * Contract: features/creator-address-bank-save · 03-expected-outputs.md · board P1–P3, R3, W1
 *
 * (Save leaving without "Discard changes?" has its own suite: hooks/__tests__/saveLeavesWithoutAsking.)
 */
import React from 'react';
import fs from 'fs';
import path from 'path';
import { render, fireEvent, waitFor } from '@testing-library/react-native';

jest.mock('../../../../App', () => ({ AuthContext: require('react').createContext({ setRole: () => {} }) }));
jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (cb) => { const R = require('react'); R.useEffect(() => { const c = cb(); return typeof c === 'function' ? c : undefined; }, [cb]); },
  createNavigationContainerRef: () => ({ isReady: () => false, navigate: jest.fn() }),
}));
jest.mock('../../../services/api', () => {
  const states = [
    { id: 2, name: 'Andhra Pradesh', cities: [{ id: 7, name: 'Guntur' }, { id: 8, name: 'Vijayawada' }] },
    { id: 1, name: 'Telangana', cities: [{ id: 10, name: 'Hyderabad' }] },
  ];
  return {
    influencerApi: {
      getMe: jest.fn(), updateMe: jest.fn(), getInvitationSettings: jest.fn(), getMySocial: jest.fn(), brandLink: jest.fn(), submitForReview: jest.fn(),
      getDeliveryAddress: jest.fn(), saveDeliveryAddress: jest.fn(), removeDeliveryAddress: jest.fn(),
      myRemote: jest.fn(), myRemoteCoverage: jest.fn(), myRemoteAddress: jest.fn(), myRemoteCorrect: jest.fn(),
    },
    brandApi: {},
    referenceApi: {
      offeredStates: jest.fn(() => Promise.resolve({ success: true, data: { states } })),
      states: jest.fn(() => Promise.resolve({ success: true, data: { items: states } })),
    },
    onAccountGate: () => () => {}, emitAccountGate: jest.fn(), clearSession: jest.fn(), uploadFile: jest.fn(),
  };
});

const { influencerApi } = require('../../../services/api');
const DeliveryAddressScreen = require('../DeliveryAddressScreen').default;
const { formOf } = require('../DeliveryAddressScreen');
const ProfileScreen = require('../ProfileScreen').default;
const RemoteAddressScreen = require('../RemoteAddressScreen').default;
const PayoutDetailScreen = require('../PayoutDetailScreen').default;
const { ADDR, BANK } = require('../../../components/profile/addressBankCopy');

const ok = (data) => ({ success: true, data });
const nav = () => ({ goBack: jest.fn(), navigate: jest.fn(), setParams: jest.fn(), addListener: jest.fn(() => () => {}), dispatch: jest.fn() });
const PREFILL = { name: 'Tanvi Suresh', phone: '9876511111', stateId: 2, cityId: 7, stateName: 'Andhra Pradesh', cityName: 'Guntur' };
const KEPT = { name: 'Tanvi Suresh', phone: '9876511111', street: 'Flat 302, Sai Residency, Road No 3', pincode: '522002', stateId: 2, cityId: 7, stateName: 'Andhra Pradesh', cityName: 'Guntur', note: 'Opposite the park gate' };
const disabled = (node) => node.props.accessibilityState && node.props.accessibilityState.disabled === true;

beforeEach(() => { jest.clearAllMocks(); });

/* ═══════════════════════════════════════════ P1 · the row on her Profile */

describe('P1 · "Delivery address" on her Profile', () => {
  const ME = { id: 'c1', full_name: 'Tanvi Suresh', instagram_handle: 'tanvi', user_status: 'approved', niche: ['fashion'], language: ['en'], needsNiche: false, city_name: 'Guntur' };
  beforeEach(() => {
    influencerApi.getMe.mockResolvedValue(ok({ influencer: ME, user_status: 'approved', completeness: { missing: [], total: 0 } }));
    influencerApi.getInvitationSettings.mockResolvedValue({ success: false });
    influencerApi.getMySocial.mockResolvedValue({ success: false });
    influencerApi.brandLink.mockResolvedValue(ok({ link: null }));
  });

  it('with none kept, the row says what it is for, and opens the screen', async () => {
    influencerApi.getDeliveryAddress.mockResolvedValue(ok({ address: null, prefill: PREFILL }));
    const n = nav();
    const r = render(<ProfileScreen navigation={n} route={{ params: {} }} />);
    await waitFor(() => r.getByTestId('row-delivery-address'));
    r.getByText('Delivery address');
    r.getByText('Where brands send products for a Remote collab');
    fireEvent.press(r.getByTestId('row-delivery-address'));
    expect(n.navigate).toHaveBeenCalledWith('DeliveryAddress');
  });

  it('with one kept, the row shows the city and pincode — not the street', async () => {
    influencerApi.getDeliveryAddress.mockResolvedValue(ok({ address: KEPT, prefill: PREFILL }));
    const r = render(<ProfileScreen navigation={nav()} route={{ params: {} }} />);
    await waitFor(() => r.getByText('Guntur · 522002'));
    expect(r.queryByText(/Sai Residency/)).toBeNull();
  });

  it('it sits straight after Profile info, and is never one of the "things left"', async () => {
    influencerApi.getDeliveryAddress.mockResolvedValue(ok({ address: null, prefill: PREFILL }));
    const r = render(<ProfileScreen navigation={nav()} route={{ params: {} }} />);
    await waitFor(() => r.getByTestId('row-delivery-address'));
    const ids = [];
    const walk = (node) => { if (!node || typeof node === 'string') return; if (node.props && /^row-/.test(node.props.testID || '') && !/-dot$|-value$/.test(node.props.testID)) ids.push(node.props.testID); (node.children || []).forEach(walk); };
    walk(r.toJSON());
    expect(ids.slice(0, 3)).toEqual(['row-profile-info', 'row-delivery-address', 'row-your-numbers']);
    expect(r.queryByTestId('row-delivery-address-dot')).toBeNull();
  });

  it('a server that has no such address yet leaves the row asking, and the profile still loads', async () => {
    influencerApi.getDeliveryAddress.mockResolvedValue({ success: false, error: { code: 'NOT_FOUND' } });
    const r = render(<ProfileScreen navigation={nav()} route={{ params: {} }} />);
    await waitFor(() => r.getByTestId('row-delivery-address'));
    r.getByText('Where brands send products for a Remote collab');
  });
});

/* ═══════════════════════════════════════════ P2 · P3 · the screen */

describe('P2 · the Delivery address screen', () => {
  it('opens with her name, login number and profile city filled in, and says who sees it', async () => {
    influencerApi.getDeliveryAddress.mockResolvedValue(ok({ address: null, prefill: PREFILL }));
    const r = render(<DeliveryAddressScreen navigation={nav()} />);
    await waitFor(() => r.getByTestId('addr-street'));
    expect(r.getByTestId('addr-name').props.value).toBe('Tanvi Suresh');
    expect(r.getByTestId('addr-phone').props.value).toBe('9876511111');
    expect(r.getByTestId('addr-street').props.value).toBe('');
    r.getByText('Guntur'); r.getByText('Andhra Pradesh');
    r.getByText(ADDR.lead); r.getByText(ADDR.onlyYou);
    expect(disabled(r.getByTestId('save-button'))).toBe(true);          // nothing typed yet
    expect(r.queryByTestId('addr-remove')).toBeNull();                   // nothing to remove
    expect(r.queryByText('Enter your street and house.')).toBeNull();    // an untouched form is not a page of red
  });

  it('she fills it in and saves: one call, then back to Profile with "Saved."', async () => {
    influencerApi.getDeliveryAddress.mockResolvedValue(ok({ address: null, prefill: PREFILL }));
    influencerApi.saveDeliveryAddress.mockResolvedValue(ok({ address: KEPT }));
    const n = nav();
    const r = render(<DeliveryAddressScreen navigation={n} />);
    await waitFor(() => r.getByTestId('addr-street'));
    fireEvent.changeText(r.getByTestId('addr-street'), '  Flat 302, Sai Residency, Road No 3 ');
    r.getByText('Enter a 6-digit pincode.');                             // started, so the gaps are named
    expect(disabled(r.getByTestId('save-button'))).toBe(true);
    fireEvent.changeText(r.getByTestId('addr-pincode'), '522002abc');
    expect(r.getByTestId('addr-pincode').props.value).toBe('522002');
    fireEvent.changeText(r.getByTestId('addr-note'), 'Opposite the park gate');
    expect(disabled(r.getByTestId('save-button'))).toBe(false);
    fireEvent.press(r.getByTestId('save-button'));
    await waitFor(() => expect(n.navigate).toHaveBeenCalledWith('ProfileMain', { toast: 'Saved.' }));
    expect(influencerApi.saveDeliveryAddress).toHaveBeenCalledTimes(1);
    expect(influencerApi.saveDeliveryAddress).toHaveBeenCalledWith({
      name: 'Tanvi Suresh', phone: '9876511111', street: 'Flat 302, Sai Residency, Road No 3', pincode: '522002',
      stateId: 2, cityId: 7, note: 'Opposite the park gate',
    });
  });

  it('each box has its own red line, in the Remote form\'s words', async () => {
    influencerApi.getDeliveryAddress.mockResolvedValue(ok({ address: KEPT, prefill: PREFILL }));
    const r = render(<DeliveryAddressScreen navigation={nav()} />);
    await waitFor(() => r.getByTestId('addr-street'));
    fireEvent.changeText(r.getByTestId('addr-name'), ' ');
    r.getByText('Enter your name.');
    fireEvent.changeText(r.getByTestId('addr-phone'), '12345');
    r.getByText('Enter a 10-digit mobile number.');
    fireEvent.changeText(r.getByTestId('addr-street'), '');
    r.getByText('Enter your street and house.');
    fireEvent.changeText(r.getByTestId('addr-pincode'), '5220');
    r.getByText('Enter a 6-digit pincode.');
    expect(disabled(r.getByTestId('save-button'))).toBe(true);
    expect(influencerApi.saveDeliveryAddress).not.toHaveBeenCalled();
  });

  it('a refusal from the server lands under the box it is about', async () => {
    influencerApi.getDeliveryAddress.mockResolvedValue(ok({ address: KEPT, prefill: PREFILL }));
    influencerApi.saveDeliveryAddress.mockResolvedValue({ success: false, error: { code: 'VALIDATION_ERROR', field: 'cityId', message: 'Choose your nearest major city.' } });
    const n = nav();
    const r = render(<DeliveryAddressScreen navigation={n} />);
    await waitFor(() => r.getByTestId('addr-street'));
    fireEvent.changeText(r.getByTestId('addr-note'), 'Ring twice');
    fireEvent.press(r.getByTestId('save-button'));
    await waitFor(() => r.getByText('Choose your nearest major city.'));
    expect(n.navigate).not.toHaveBeenCalled();
  });

  it('P3 · an address she keeps opens filled in; "Remove this address" asks first, then removes', async () => {
    influencerApi.getDeliveryAddress.mockResolvedValue(ok({ address: KEPT, prefill: { ...PREFILL, name: 'Someone Else', cityId: 10, stateId: 1 } }));
    influencerApi.removeDeliveryAddress.mockResolvedValue(ok({ address: null }));
    const n = nav();
    const r = render(<DeliveryAddressScreen navigation={n} />);
    await waitFor(() => r.getByTestId('addr-street'));
    expect(r.getByTestId('addr-name').props.value).toBe('Tanvi Suresh');   // her kept address, not the profile's start
    expect(r.getByTestId('addr-street').props.value).toBe('Flat 302, Sai Residency, Road No 3');
    expect(r.getByTestId('addr-pincode').props.value).toBe('522002');
    expect(r.getByTestId('addr-note').props.value).toBe('Opposite the park gate');
    expect(disabled(r.getByTestId('save-button'))).toBe(true);
    fireEvent.press(r.getByTestId('addr-remove'));
    r.getByText('Remove your delivery address?');
    expect(influencerApi.removeDeliveryAddress).not.toHaveBeenCalled();
    fireEvent.press(r.getByTestId('confirm-primary'));
    await waitFor(() => expect(n.navigate).toHaveBeenCalledWith('ProfileMain', { toast: 'Address removed.' }));
    expect(influencerApi.removeDeliveryAddress).toHaveBeenCalledTimes(1);
  });

  it('formOf: a kept address is never mixed with the profile start', () => {
    expect(formOf(KEPT, { name: 'X', phone: '9000000000', stateId: 1, cityId: 10 })).toMatchObject({ name: 'Tanvi Suresh', stateId: 2, cityId: 7, street: 'Flat 302, Sai Residency, Road No 3' });
    expect(formOf(null, { name: 'X', phone: '+91 90000 00000', stateId: 1, cityId: 10 })).toMatchObject({ name: 'X', phone: '9000000000', stateId: 1, cityId: 10, street: '', pincode: '' });
    expect(formOf(null, null)).toMatchObject({ name: '', phone: '', stateId: null, cityId: null });
  });
});

/* ═══════════════════════════════════════════ R3 · the Remote address form */

describe('R3 · the Remote address form starts from it', () => {
  const HER = { params: { ciId: 'ci1' } };
  const shoot = (over = {}) => ({
    invitationId: 'ci1', shootId: 'pe1', stage: 'not_sent', brand: { name: 'Kanchi Silks' }, creator: { name: 'Tanvi Suresh' },
    address: null, prefill: { name: 'Tanvi Suresh', phone: '9876511111', stateId: 2, cityId: 7, fromProfile: false }, ...over,
  });
  const COVER = { pincode: '522002', delivers: true, returnPickup: true, message: 'Couriers deliver and collect returns at 522002.' };
  const fill = (r) => {
    fireEvent.changeText(r.getByTestId('f-street'), '11 Gandhi Road, Brodipet');
    fireEvent.changeText(r.getByTestId('f-pincode'), '522002');
  };

  it('she keeps an address: the whole of it arrives, with a line saying where it came from', async () => {
    influencerApi.myRemote.mockResolvedValue(ok({ shoot: shoot({ prefill: { ...KEPT, fromProfile: true } }) }));
    influencerApi.myRemoteCoverage.mockResolvedValue(ok(COVER));
    const r = render(<RemoteAddressScreen navigation={nav()} route={HER} />);
    await waitFor(() => r.getByTestId('remote-address'));
    expect(r.getByTestId('f-name').props.value).toBe('Tanvi Suresh');
    expect(r.getByTestId('f-street').props.value).toBe('Flat 302, Sai Residency, Road No 3');
    expect(r.getByTestId('f-pincode').props.value).toBe('522002');
    expect(r.getByTestId('f-note').props.value).toBe('Opposite the park gate');
    expect(r.getByTestId('f-sizes').props.value).toBe('');                // her sizes are asked each time, as before
    r.getByText(ADDR.fromProfile);
    expect(r.queryByTestId('keep-in-profile')).toBeNull();                // she already keeps one
    // the pincode that arrived is checked with the courier without her touching the box
    await waitFor(() => r.getByTestId('coverage-ok'));
    expect(influencerApi.myRemoteCoverage).toHaveBeenCalledWith('ci1', '522002');
  });

  it('her kept pincode cannot be reached from this store: the reason is under the pincode, not just a grey button', async () => {
    const NO = { pincode: '522002', delivers: false, returnPickup: false, message: "Couriers don't deliver to 522002 yet. Try an address at a pincode nearby, such as where you work or a friend's." };
    influencerApi.myRemote.mockResolvedValue(ok({ shoot: shoot({ prefill: { ...KEPT, fromProfile: true } }) }));
    influencerApi.myRemoteCoverage.mockResolvedValue(ok(NO));
    const r = render(<RemoteAddressScreen navigation={nav()} route={HER} />);
    await waitFor(() => r.getByTestId('remote-address'));
    await waitFor(() => expect(r.getByTestId('f-pincode-error').props.children).toBe(NO.message));
    expect(r.getByTestId('review-send').props.accessibilityState.disabled).toBe(true);
    // she types another pincode for this parcel, the courier reaches it, and the form opens up
    influencerApi.myRemoteCoverage.mockResolvedValue(ok({ ...COVER, pincode: '522006', message: 'Couriers deliver and collect returns at 522006.' }));
    fireEvent.changeText(r.getByTestId('f-pincode'), '522006');
    fireEvent(r.getByTestId('f-pincode'), 'blur');
    await waitFor(() => r.getByTestId('coverage-ok'));
    expect(r.queryByTestId('f-pincode-error')).toBeNull();
    expect(r.getByTestId('review-send').props.accessibilityState.disabled).toBe(false);
  });

  it('she changes it for this parcel and sends: the changed one goes, and nothing asks to overwrite her profile', async () => {
    influencerApi.myRemote.mockResolvedValue(ok({ shoot: shoot({ prefill: { ...KEPT, fromProfile: true } }) }));
    influencerApi.myRemoteCoverage.mockResolvedValue(ok(COVER));
    influencerApi.myRemoteAddress.mockResolvedValue(ok({ shoot: shoot() }));
    const n = nav();
    const r = render(<RemoteAddressScreen navigation={n} route={HER} />);
    await waitFor(() => r.getByTestId('remote-address'));
    fireEvent.changeText(r.getByTestId('f-street'), "C/o Lakshmi, 9 Mother's Lane");
    fireEvent.press(r.getByTestId('review-send'));
    fireEvent.press(r.getByTestId('sheet-send'));
    await waitFor(() => expect(influencerApi.myRemoteAddress).toHaveBeenCalledTimes(1));
    const body = influencerApi.myRemoteAddress.mock.calls[0][1];
    expect(body).toMatchObject({ street: "C/o Lakshmi, 9 Mother's Lane", pincode: '522002', stateId: 2, cityId: 7, note: 'Opposite the park gate' });
    expect(body.keepInProfile).toBeUndefined();
    await waitFor(() => expect(n.navigate).toHaveBeenCalledWith('MyRemote', { ciId: 'ci1', toast: 'Address sent.' }));
  });

  it('she keeps none: the form is as before, with "Keep this address in my profile" ticked', async () => {
    influencerApi.myRemote.mockResolvedValue(ok({ shoot: shoot() }));
    influencerApi.myRemoteAddress.mockResolvedValue(ok({ shoot: shoot() }));
    const r = render(<RemoteAddressScreen navigation={nav()} route={HER} />);
    await waitFor(() => r.getByTestId('remote-address'));
    expect(r.getByTestId('f-street').props.value).toBe('');
    expect(r.queryByTestId('from-profile')).toBeNull();
    expect(influencerApi.myRemoteCoverage).not.toHaveBeenCalled();
    r.getByText(ADDR.keep);
    expect(r.getByTestId('keep-in-profile').props.accessibilityState.checked).toBe(true);
    fill(r);
    fireEvent.press(r.getByTestId('review-send'));
    fireEvent.press(r.getByTestId('sheet-send'));
    await waitFor(() => expect(influencerApi.myRemoteAddress).toHaveBeenCalledTimes(1));
    expect(influencerApi.myRemoteAddress.mock.calls[0][1].keepInProfile).toBe(true);
  });

  it('she unticks it: the address goes to the brand and is not kept', async () => {
    influencerApi.myRemote.mockResolvedValue(ok({ shoot: shoot() }));
    influencerApi.myRemoteAddress.mockResolvedValue(ok({ shoot: shoot() }));
    const r = render(<RemoteAddressScreen navigation={nav()} route={HER} />);
    await waitFor(() => r.getByTestId('remote-address'));
    fireEvent.press(r.getByTestId('keep-in-profile'));
    expect(r.getByTestId('keep-in-profile').props.accessibilityState.checked).toBe(false);
    fill(r);
    fireEvent.press(r.getByTestId('review-send'));
    fireEvent.press(r.getByTestId('sheet-send'));
    await waitFor(() => expect(influencerApi.myRemoteAddress).toHaveBeenCalledTimes(1));
    expect(influencerApi.myRemoteAddress.mock.calls[0][1].keepInProfile).toBeUndefined();
  });

  it('a correction after a parcel came back is untouched: empty street and pincode, no tick, no profile line', async () => {
    influencerApi.myRemote.mockResolvedValue(ok({ shoot: shoot({ stage: 'returned', prefill: undefined, address: { name: 'Tanvi Suresh', phone: '9876511111', street: '11 Gandhi Road', pincode: '522002' } }) }));
    const r = render(<RemoteAddressScreen navigation={nav()} route={{ params: { ciId: 'ci1', correcting: true } }} />);
    await waitFor(() => r.getByTestId('remote-address'));
    expect(r.getByTestId('f-street').props.value).toBe('');
    expect(r.getByTestId('f-pincode').props.value).toBe('');
    expect(r.queryByTestId('keep-in-profile')).toBeNull();
    expect(r.queryByTestId('from-profile')).toBeNull();
  });

  it('a server from before this (no fromProfile on the prefill) shows the form exactly as it was', async () => {
    influencerApi.myRemote.mockResolvedValue(ok({ shoot: shoot({ prefill: { name: 'Tanvi Suresh', phone: '9876511111', stateId: 2, cityId: 7 } }) }));
    const r = render(<RemoteAddressScreen navigation={nav()} route={HER} />);
    await waitFor(() => r.getByTestId('remote-address'));
    expect(r.queryByTestId('keep-in-profile')).toBeNull();
    expect(r.queryByTestId('from-profile')).toBeNull();
  });
});

/* ═══════════════════════════════════════════ W1 · her bank account */

describe('W1 · her bank account, in full', () => {
  const BOX = (r, k) => r.getByTestId(`payout-${k}`);
  const fillAll = (r, over = {}) => {
    const v = { bank_holder_name: 'Tanvi Suresh K', bank_account_no: '50100234567891', bank_account_no_confirm: '50100234567891', bank_ifsc: 'HDFC0001234', bank_name: 'HDFC Bank', bank_branch: 'Brodipet, Guntur', ...over };
    for (const k of Object.keys(v)) fireEvent.changeText(BOX(r, k), v[k]);
  };
  const open = (n = nav()) => render(<PayoutDetailScreen navigation={n} route={{ params: { kind: 'bank', returnTo: 'CreatorWalletDetails' } }} />);

  it('six boxes in order: holder name, account number, the number again, IFSC, bank, branch', () => {
    const r = open();
    expect(BANK.fields.map((x) => x.label)).toEqual(['Account holder name', 'Account number', 'Re-enter account number', 'IFSC', 'Bank name', 'Branch']);
    for (const x of BANK.fields) { r.getByText(x.label); expect(BOX(r, x.key).props.value).toBe(''); }
    r.getByText(BANK.lead);
    // the first number box hides what is typed, so the second is really typed again — and cannot be pasted into
    expect(BOX(r, 'bank_account_no').props.secureTextEntry).toBe(true);
    expect(BOX(r, 'bank_account_no_confirm').props.secureTextEntry).toBe(false);
    expect(BOX(r, 'bank_account_no_confirm').props.contextMenuHidden).toBe(true);
    expect(BOX(r, 'bank_account_no').props.keyboardType).toBe('number-pad');
    expect(BOX(r, 'bank_account_no_confirm').props.keyboardType).toBe('number-pad');
  });

  it('Save with boxes empty: each one says what is missing, nothing is sent', () => {
    const r = open();
    fireEvent.press(r.getByTestId('payout-save'));
    for (const k of Object.keys(BANK.required)) r.getByText(BANK.required[k]);
    expect(influencerApi.updateMe).not.toHaveBeenCalled();
    fireEvent.changeText(BOX(r, 'bank_name'), 'HDFC Bank');               // typing in a box clears its line
    expect(r.queryByText('Enter the bank name.')).toBeNull();
  });

  it('the two account numbers differ: a red line under the second, nothing is sent', () => {
    const r = open();
    fillAll(r, { bank_account_no_confirm: '50100234567819' });
    fireEvent.press(r.getByTestId('payout-save'));
    r.getByText("The two account numbers don't match.");
    expect(influencerApi.updateMe).not.toHaveBeenCalled();
  });

  it('all six filled and the numbers agree: saved whole, then back where she came from', async () => {
    influencerApi.updateMe.mockResolvedValue(ok({ influencer: { has_bank_account: true } }));
    const n = nav();
    const r = open(n);
    fillAll(r, { bank_holder_name: '  Tanvi Suresh K ' });
    fireEvent.press(r.getByTestId('payout-save'));
    await waitFor(() => expect(influencerApi.updateMe).toHaveBeenCalledWith({
      bank_holder_name: 'Tanvi Suresh K', bank_account_no: '50100234567891', bank_account_no_confirm: '50100234567891',
      bank_ifsc: 'HDFC0001234', bank_name: 'HDFC Bank', bank_branch: 'Brodipet, Guntur',
    }));
    await waitFor(() => expect(n.navigate).toHaveBeenCalledWith({ name: 'CreatorWalletDetails', params: { toast: 'Saved.' }, merge: true }));
  });

  it('the server\'s own refusal of the second number lands under the second number', async () => {
    influencerApi.updateMe.mockResolvedValue({ success: false, error: { code: 'VALIDATION_ERROR', field: 'bank_account_no_confirm', message: "The two account numbers don't match." } });
    const r = open();
    fillAll(r);
    fireEvent.press(r.getByTestId('payout-save'));
    await waitFor(() => r.getByText("The two account numbers don't match."));
  });

  it('UPI and PAN are one box each, exactly as before', async () => {
    influencerApi.updateMe.mockResolvedValue(ok({ influencer: {} }));
    const u = render(<PayoutDetailScreen navigation={nav()} route={{ params: { kind: 'upi' } }} />);
    expect(u.queryByTestId('payout-lead')).toBeNull();
    fireEvent.press(u.getByTestId('payout-save'));
    u.getByText('Enter this to save.');
    fireEvent.changeText(u.getByTestId('payout-upi_id'), 'tanvi@okhdfc');
    fireEvent.press(u.getByTestId('payout-save'));
    await waitFor(() => expect(influencerApi.updateMe).toHaveBeenCalledWith({ upi_id: 'tanvi@okhdfc' }));
    const p = render(<PayoutDetailScreen navigation={nav()} route={{ params: { kind: 'pan' } }} />);
    expect(p.getByTestId('payout-pan_number').props.secureTextEntry).toBe(false);
  });
});

/* ═══════════════════════════════════════════ the brand app is not touched */

describe('the brand app\'s bank form is left as it is', () => {
  it('BrandPayoutDetailScreen does not read the creator\'s bank copy', () => {
    const src = fs.readFileSync(path.join(__dirname, '../../brand/BrandPayoutDetailScreen.js'), 'utf8');
    expect(src).not.toMatch(/addressBankCopy/);
  });
});
