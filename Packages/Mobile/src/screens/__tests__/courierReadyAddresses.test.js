/**
 * features/courier-ready-addresses — the phone screens (checks 14, 15, 16).
 *
 * A courier has to find the store. What these pin:
 *   Edit branch   the street hint and its 140 counter, a Landmark, a Store phone that starts as
 *                 the login number, and the city field labelled "City"
 *                 — and that a street with no shop or door number never reaches the server
 *   Registration  the same refusal, and "City"
 *   Re-submit     the same refusal, and "City"
 *   The rule      the phone's mirror of the server's `streetProblem`, case by case
 *
 * (The booking screen's greyed branch and the creator's street box are in remoteScreens.test.js,
 * beside the screens' other tests.)
 */
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';

jest.mock('../../services/api', () => ({
  api: { get: jest.fn(), post: jest.fn(), patch: jest.fn() },
  authApi: { verifyOtp: jest.fn(), sendOtp: jest.fn() },
  influencerApi: { getMe: jest.fn(), updateMe: jest.fn(), submitForReview: jest.fn() },
  brandApi: { register: jest.fn(), getMe: jest.fn(), updateMe: jest.fn(), submitForReview: jest.fn(), listBranches: jest.fn(), createBranch: jest.fn(), updateBranch: jest.fn() },
  referenceApi: {
    offeredStates: jest.fn().mockResolvedValue({ success: true, data: { items: [
      { id: 1, name: 'Telangana', cities: [{ id: 10, name: 'Hyderabad' }, { id: 11, name: 'Warangal' }] },
      { id: 2, name: 'Andhra Pradesh', cities: [{ id: 20, name: 'Vijayawada' }] },
    ] } }),
    brandCategories: jest.fn().mockResolvedValue({ success: true, data: { items: [{ code: 'WOMEN', label: 'Women' }] } }),
  },
  onAccountGate: () => () => {},
  emitAccountGate: jest.fn(),
  clearSession: jest.fn(), uploadFile: jest.fn(),
}));
const mockSetRole = jest.fn();
jest.mock('../../../App', () => ({ AuthContext: require('react').createContext({ setRole: mockSetRole }) }));
jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (cb) => { const React = require('react'); React.useEffect(() => cb(), [cb]); },
  createNavigationContainerRef: () => ({ isReady: () => false, navigate: jest.fn() }),
}));
jest.mock('@react-native-clipboard/clipboard', () => ({ getString: jest.fn().mockResolvedValue('') }));

const { brandApi } = require('../../services/api');
const BrandBranchEditScreen = require('../brand/BrandBranchEditScreen').default;
const BrandRegisterScreen = require('../auth/BrandRegisterScreen').default;
const RejectedScreen = require('../auth/RejectedScreen').default;
const { streetError, landmarkError, storePhoneError, tenDigits, MSG_STORE, STREET_MAX } = require('../../utils/storeAddress');

const nav = () => ({ goBack: jest.fn(), navigate: jest.fn(), setParams: jest.fn(), reset: jest.fn(), addListener: jest.fn(() => () => {}), dispatch: jest.fn() });
const ok = (data) => ({ success: true, data });
const text = (r) => JSON.stringify(r.toJSON());

async function pickStateAndCity(r, prefix, stateId, cityId) {
  fireEvent.press(r.getByTestId(`${prefix}-state`));
  await waitFor(() => r.getByTestId(`${prefix}-state-option-${stateId}`));
  fireEvent.press(r.getByTestId(`${prefix}-state-option-${stateId}`));
  fireEvent.press(r.getByTestId(`${prefix}-city`));
  await waitFor(() => r.getByTestId(`${prefix}-city-option-${cityId}`));
  fireEvent.press(r.getByTestId(`${prefix}-city-option-${cityId}`));
}

const NO_NUMBER = 'Add the shop or door number. Couriers need it to find the store.';
const BRANCH = {
  id: 'b1', name: 'Main Branch', isMain: true, formattedAddress: 'Shop 12, Sri Sai Complex, Road No 3', pincode: '500072',
  stateId: 1, stateName: 'Telangana', cityId: 10, cityName: 'Hyderabad', landmark: null, phone: null,
};

beforeEach(() => {
  jest.clearAllMocks();
  brandApi.getMe.mockResolvedValue(ok({ brand: { login_phone: '+919876543210' } }));
});

/* ═════════════════════════════════════════ the rule, on the phone */

describe('the phone’s copy of the rule says what the server says', () => {
  it('a shop or door number makes an address; a pincode is not one', () => {
    expect(streetError('Shop 12, Sri Sai Complex, Road No 3, KPHB Phase 1')).toBe('');
    expect(streetError('5-38-62/A, Pandaripuram, Brodipet')).toBe('');
    expect(streetError('Benz Circle, Vijayawada')).toBe(NO_NUMBER);
    expect(streetError('MG Road, Vijayawada 520010')).toBe(NO_NUMBER);
    expect(streetError('12 MG Road, Vijayawada 520010')).toBe('');
  });

  it('10 to 140 characters, each with its own sentence', () => {
    expect(streetError('')).toBe('Enter the street address.');
    expect(streetError('Shop 4 MG')).toBe('Add the shop or door number, building and street. A courier has to find it.');
    expect(streetError('Shop 4, MG')).toBe('');
    expect(streetError(`Shop 12, ${'A'.repeat(131)}`)).toBe('');
    expect(streetError(`Shop 12, ${'A'.repeat(132)}`)).toBe('Keep the address under 140 characters.');
    expect(STREET_MAX).toBe(140);
  });

  it('the landmark and the store phone', () => {
    expect(landmarkError('L'.repeat(45))).toBe('');
    expect(landmarkError('L'.repeat(46))).toBe('Keep the landmark under 45 characters.');
    expect(tenDigits('+91 98765 43210')).toBe('9876543210');
    expect(storePhoneError('+919876543210')).toBe('');
    expect(storePhoneError('')).toBe(MSG_STORE.PHONE);
    expect(storePhoneError('1234567890')).toBe('Enter a 10-digit mobile number.');
  });
});

/* ═════════════════════════════════════════ Edit branch (checks 14, 15) */

describe('Edit branch', () => {
  const open = (branch = BRANCH) => render(<BrandBranchEditScreen navigation={nav()} route={{ params: { branch, branchCount: 1, mainBranch: branch } }} />);

  it('14 · shows the courier hint and its counter, a Landmark, a Store phone, and "City"', async () => {
    const r = open();
    r.getByText('Shop or door number, building, street and area. A courier has to find it.');
    expect(r.getByTestId('branch-street-count').props.children).toBe(`${BRANCH.formattedAddress.length}/140`);
    expect(r.getByTestId('branch-address-text').props.maxLength).toBe(140);

    r.getByText('Landmark');
    expect(r.getByTestId('branch-landmark').props.maxLength).toBe(45);
    expect(r.getByTestId('branch-landmark-count').props.children).toBe('0/45');

    r.getByText('Store phone *');
    r.getByText('The courier calls this number at pickup. Starts as your login number.');

    r.getByText('Not on the list? Pick the nearest city.');
    expect(text(r)).toMatch(/"City"/);
    expect(text(r)).not.toMatch(/earest major city/);
    r.getByText("A store visit or a courier pickup can't be planned to a branch with no street address — so this one is required.");
  });

  it('14 · the Store phone starts as the login number — and filling it in is not an unsaved change', async () => {
    const r = open();
    expect(r.getByTestId('branch-phone').props.value).toBe('');
    await waitFor(() => expect(r.getByTestId('branch-phone').props.value).toBe('9876543210'));
    expect(r.getByTestId('save-button').props.accessibilityState.disabled).toBe(true);     // nothing of the brand's own to save
  });

  it('14 · a branch that has its own phone keeps it', async () => {
    const r = open({ ...BRANCH, phone: '9000012345', landmark: 'Opposite JNTU metro station' });
    expect(r.getByTestId('branch-phone').props.value).toBe('9000012345');
    expect(r.getByTestId('branch-landmark').props.value).toBe('Opposite JNTU metro station');
    expect(r.getByTestId('branch-landmark-count').props.children).toBe('27/45');
    await waitFor(() => expect(brandApi.getMe).not.toHaveBeenCalled());
  });

  it('15 · saving sends the landmark and the store phone', async () => {
    brandApi.updateBranch.mockResolvedValue(ok({ branch: { id: 'b1' } }));
    const r = open();
    await waitFor(() => expect(r.getByTestId('branch-phone').props.value).toBe('9876543210'));
    fireEvent.changeText(r.getByTestId('branch-landmark'), 'Opposite JNTU metro station');
    fireEvent.changeText(r.getByTestId('branch-phone'), '90000 12345');
    expect(r.getByTestId('branch-phone').props.value).toBe('9000012345');
    fireEvent.press(r.getByTestId('save-button'));
    await waitFor(() => expect(brandApi.updateBranch).toHaveBeenCalledWith('b1', {
      name: 'Main Branch', address_text: 'Shop 12, Sri Sai Complex, Road No 3', landmark: 'Opposite JNTU metro station',
      phone: '9000012345', pincode: '500072', state_id: 1, city_id: 10,
    }));
  });

  it('15 · a street with no shop or door number shows the red line and never reaches the server', async () => {
    const r = open();
    await waitFor(() => expect(r.getByTestId('branch-phone').props.value).toBe('9876543210'));
    fireEvent.changeText(r.getByTestId('branch-address-text'), 'Benz Circle, Vijayawada');
    r.getByText(NO_NUMBER);
    expect(r.getByTestId('save-button').props.accessibilityState.disabled).toBe(true);
    fireEvent.press(r.getByTestId('save-button'));
    expect(brandApi.updateBranch).not.toHaveBeenCalled();

    fireEvent.changeText(r.getByTestId('branch-address-text'), 'D.No 40-1-52, MG Road, Benz Circle');
    expect(r.queryByText(NO_NUMBER)).toBeNull();
    expect(r.getByTestId('save-button').props.accessibilityState.disabled).toBe(false);
  });

  it('15 · an old branch with an incomplete address says so the moment anything is edited', async () => {
    const r = open({ ...BRANCH, formattedAddress: 'Guntur, Andhra Pradesh, India' });
    await waitFor(() => expect(r.getByTestId('branch-phone').props.value).toBe('9876543210'));
    expect(r.queryByText(NO_NUMBER)).toBeNull();                 // not shouted at on arrival
    fireEvent.changeText(r.getByTestId('branch-name'), 'Guntur store');
    r.getByText(NO_NUMBER);
    expect(r.getByTestId('save-button').props.accessibilityState.disabled).toBe(true);
  });

  it('14 · adding a branch: the city list is headed "City", and leaving it unpicked asks for the city', async () => {
    const r = render(<BrandBranchEditScreen navigation={nav()} route={{ params: { branchCount: 0, mainBranch: null } }} />);
    fireEvent.changeText(r.getByTestId('branch-name'), 'Guntur store');
    r.getByText('Pick your city.');
    expect(text(r)).not.toMatch(/earest major city/);
    await pickStateAndCity(r, 'branch', 2, 20);
    expect(r.queryByText('Pick your city.')).toBeNull();
  });

  it('15 · the server’s own refusal lands under the right box', async () => {
    brandApi.updateBranch.mockResolvedValue({ success: false, error: { code: 'VALIDATION_ERROR', field: 'phone', message: 'Enter a 10-digit mobile number.' } });
    const r = open();
    await waitFor(() => expect(r.getByTestId('branch-phone').props.value).toBe('9876543210'));
    fireEvent.changeText(r.getByTestId('branch-landmark'), 'Near the flyover');
    fireEvent.press(r.getByTestId('save-button'));
    await waitFor(() => r.getByText('Enter a 10-digit mobile number.'));
  });
});

/* ═════════════════════════════════════════ registration and re-submit (check 16) */

describe('16 · brand registration', () => {
  it('says "City", shows the courier hint, and refuses a street with no shop or door number', async () => {
    brandApi.register.mockResolvedValue(ok({ brand: { id: 'b1' }, user_status: 'pending' }));
    const r = render(<BrandRegisterScreen navigation={nav()} />);
    r.getByText('Shop or door number, building, street and area. A courier has to find it.');
    r.getByText('Not on the list? Pick the nearest city.');
    expect(text(r)).not.toMatch(/earest major city/);
    expect(r.getByTestId('reg-street').props.maxLength).toBe(140);

    // Everything else is right; only the street has no shop or door number.
    fireEvent.changeText(r.getByTestId('reg-name'), 'Ravi Kumar');
    fireEvent.changeText(r.getByTestId('reg-business'), 'Label Fern');
    await waitFor(() => r.getByTestId('sub-WOMEN'));
    fireEvent.press(r.getByTestId('sub-WOMEN'));
    fireEvent.changeText(r.getByTestId('reg-pincode'), '520010');
    await pickStateAndCity(r, 'reg', 2, 20);
    fireEvent.changeText(r.getByTestId('reg-street'), 'Benz Circle, Vijayawada');
    const off = () => r.getByTestId('reg-submit').props.accessibilityState.disabled;
    expect(off()).toBe(true);

    // The button is off — so the reason is on the screen once she leaves the box.
    expect(r.queryByTestId('err-street')).toBeNull();
    fireEvent(r.getByTestId('reg-street'), 'blur');
    expect(r.getByTestId('err-street').props.children).toBe(NO_NUMBER);
    fireEvent.press(r.getByTestId('reg-submit'));
    expect(brandApi.register).not.toHaveBeenCalled();

    fireEvent.changeText(r.getByTestId('reg-street'), 'D.No 40-1-52, MG Road, Benz Circle');
    expect(r.queryByTestId('err-street')).toBeNull();
    expect(off()).toBe(false);
    fireEvent.press(r.getByTestId('reg-submit'));
    await waitFor(() => expect(brandApi.register).toHaveBeenCalledWith(expect.objectContaining({ address_line: 'D.No 40-1-52, MG Road, Benz Circle', state_id: 2, city_id: 20 })));
  });
});

describe('16 · re-submit after rejection (brand)', () => {
  it('says "City" and refuses a street with no shop or door number before anything is sent', async () => {
    brandApi.getMe.mockResolvedValue(ok({
      brand: { business_name: 'Label Fern', address_line: 'Benz Circle, Vijayawada', pincode: '520010', rejection_remarks: 'Please add the shop number.' },
      branches: [{ isMain: true, formattedAddress: 'Benz Circle, Vijayawada', pincode: '520010', stateId: 2, stateName: 'Andhra Pradesh', cityId: 20, cityName: 'Vijayawada' }],
    }));
    const r = render(<RejectedScreen navigation={nav()} route={{ params: { role: 'brand' } }} />);
    await waitFor(() => r.getByTestId('rejected-brand'));
    r.getByText('Not on the list? Pick the nearest city.');
    expect(text(r)).not.toMatch(/earest major city/);
    expect(r.getByTestId('rej-street').props.maxLength).toBe(140);

    fireEvent.press(r.getByTestId('rejected-send'));
    await waitFor(() => expect(r.getByTestId('rej-street-error').props.children).toBe(NO_NUMBER));
    expect(brandApi.updateMe).not.toHaveBeenCalled();
    expect(brandApi.submitForReview).not.toHaveBeenCalled();
  });
});
