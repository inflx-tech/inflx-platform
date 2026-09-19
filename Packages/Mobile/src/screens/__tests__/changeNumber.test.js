/**
 * features/change-login-number — the phone screens (expected outputs 13–15).
 *
 *   13  the four-step screen advances only on the server's success; the three refusals render
 *       the agreed words; the resend countdown starts at 30 seconds
 *   14  Business details and Profile info show "Change number" beside the locked phone
 *   15  on confirm the app stores the new tokens, patches the stored user, and hands the
 *       green line to the detail screen — which re-reads /me and shows the new number
 */
import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

jest.mock('../../services/api', () => ({
  api: { get: jest.fn(), post: jest.fn(), patch: jest.fn() },
  authApi: { changePhoneStart: jest.fn(), changePhoneVerifyOld: jest.fn(), changePhoneSendNew: jest.fn(), changePhoneConfirm: jest.fn(), sendOtp: jest.fn(), verifyOtp: jest.fn() },
  brandApi: { getMe: jest.fn(), updateMe: jest.fn(), getPitchSettings: jest.fn() },
  influencerApi: { getMe: jest.fn(), updateMe: jest.fn() },
  referenceApi: {
    offeredStates: jest.fn().mockResolvedValue({ success: true, data: { items: [{ id: 1, name: 'Telangana', cities: [{ id: 10, name: 'Hyderabad' }] }] } }),
    creatorNiches: jest.fn(), languages: jest.fn(), states: jest.fn(),
  },
  onAccountGate: () => () => {}, emitAccountGate: jest.fn(), clearSession: jest.fn(), uploadFile: jest.fn(),
}));
jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (cb) => { const R = require('react'); R.useEffect(() => cb(), [cb]); },
  createNavigationContainerRef: () => ({ isReady: () => false, navigate: jest.fn() }),
}));

const { authApi, brandApi, influencerApi } = require('../../services/api');
const ChangeNumberScreen = require('../shared/ChangeNumberScreen').default;
const { fmtIndian, maskIndian } = require('../shared/ChangeNumberScreen');
const BrandBusinessDetailsScreen = require('../brand/BrandBusinessDetailsScreen').default;
const ProfileInfoScreen = require('../influencer/ProfileInfoScreen').default;

const OLD = '+919876543210';
const NEW = '+919123456789';
const ok = (data) => ({ success: true, data });
const no = (code, message, status, field) => ({ success: false, error: { code, message, ...(field ? { field } : {}) }, status });
const nav = () => ({ goBack: jest.fn(), navigate: jest.fn(), setParams: jest.fn(), addListener: jest.fn(() => () => {}), dispatch: jest.fn() });
const route = (params) => ({ params });
const flush = () => act(async () => { await Promise.resolve(); await Promise.resolve(); });

const SAME = "That's already your number.";
const TAKEN = 'This number already has a brand account. Sign in with it instead.';
const EXPIRED = 'Time\'s up. Start again from "Change number" — you have 15 minutes end to end.';
const TOO_MANY = 'Too many wrong codes. Start again from "Change number".';

const disabled = (r, id) => r.getByTestId(id).props.accessibilityState.disabled;
const stepIs = (r, n) => { for (let i = 1; i <= 4; i += 1) r.getByTestId(`step-${i}-${i <= n ? 'on' : 'off'}`); };
const typeOtp = (r, prefix, code) => fireEvent.changeText(r.getByTestId(`${prefix}-0`), code);   // a six-digit paste fills every box

beforeEach(() => { jest.clearAllMocks(); AsyncStorage.clear(); });

describe('the two formats', () => {
  it('N1 masks the current number; N2/N4 show it whole', () => {
    expect(maskIndian(OLD)).toBe('+91 98••• ••210');
    expect(fmtIndian(OLD)).toBe('+91 98765 43210');
    expect(maskIndian(NEW)).toBe('+91 91••• ••789');
  });
});

describe('13 — four steps, advancing only on the server\'s success', () => {
  it('walks N1 → N4: each refusal keeps the step, each success moves it, the three refusals carry the agreed words', async () => {
    const n = nav();
    const r = render(<ChangeNumberScreen navigation={n} route={route({ role: 'brand', returnTo: 'BrandBusinessDetails', phone: OLD })} />);

    // N1 — masked current number and the both-phones note
    stepIs(r, 1);
    r.getByText("First, confirm it's you");
    expect(r.getByTestId('current-number').props.children).toBe('+91 98••• ••210');
    r.getByText("You'll need both phones: the old one to receive this code, the new one for the next.");

    // a failed send keeps N1
    authApi.changePhoneStart.mockResolvedValueOnce(no('INTERNAL_ERROR', 'Could not send OTP. Please try again.', 502));
    fireEvent.press(r.getByTestId('send-old'));
    await waitFor(() => r.getByText('Could not send OTP. Please try again.'));
    stepIs(r, 1);
    expect(r.queryByTestId('old-otp-0')).toBeNull();

    // a successful send opens N2
    authApi.changePhoneStart.mockResolvedValueOnce(ok({ sent_to: OLD, message: 'Code sent to your current number.' }));
    fireEvent.press(r.getByTestId('send-old'));
    await waitFor(() => r.getByTestId('old-otp-0'));
    stepIs(r, 2);
    r.getByText('Sent to +91 98765 43210');
    r.getByText('Resend in 0:30');
    expect(disabled(r, 'verify-old')).toBe(true);
    fireEvent.changeText(r.getByTestId('old-otp-0'), '4');
    fireEvent.changeText(r.getByTestId('old-otp-1'), '8');
    expect(disabled(r, 'verify-old')).toBe(true);

    // a wrong code keeps N2 with the server's line
    typeOtp(r, 'old-otp', '111111');
    expect(disabled(r, 'verify-old')).toBe(false);
    authApi.changePhoneVerifyOld.mockResolvedValueOnce(no('UNAUTHORIZED', 'Invalid or expired OTP', 401));
    fireEvent.press(r.getByTestId('verify-old'));
    await waitFor(() => r.getByText('Invalid or expired OTP'));
    stepIs(r, 2);
    expect(authApi.changePhoneVerifyOld).toHaveBeenCalledWith('111111');

    // the right code opens N3 with the change token in hand
    typeOtp(r, 'old-otp', '482913');
    authApi.changePhoneVerifyOld.mockResolvedValueOnce(ok({ change_token: 'tok-old', expires_in: 900 }));
    fireEvent.press(r.getByTestId('verify-old'));
    await waitFor(() => r.getByTestId('new-phone'));
    stepIs(r, 3);
    r.getByText('Your new number');
    r.getByText('This becomes your login number from now on.');
    r.getByText(/This changes the number for your brand account only\. If you also have a creator account on the old number, change it from the creator app\./);
    expect(disabled(r, 'send-new')).toBe(true);

    // N6 · the same number — under the field, still N3
    fireEvent.changeText(r.getByTestId('new-phone'), '9876543210');
    expect(disabled(r, 'send-new')).toBe(false);
    authApi.changePhoneSendNew.mockResolvedValueOnce(no('VALIDATION_ERROR', SAME, 422, 'new_phone'));
    fireEvent.press(r.getByTestId('send-new'));
    await waitFor(() => r.getByText(SAME));
    stepIs(r, 3);
    expect(authApi.changePhoneSendNew).toHaveBeenCalledWith('tok-old', OLD);
    expect(r.queryByTestId('new-otp-0')).toBeNull();

    // N6 · a number that already holds a brand account — the red note, still N3
    fireEvent.changeText(r.getByTestId('new-phone'), '9123456789');
    expect(r.queryByText(SAME)).toBeNull();
    authApi.changePhoneSendNew.mockResolvedValueOnce(no('PHONE_TAKEN', TAKEN, 409, 'new_phone'));
    fireEvent.press(r.getByTestId('send-new'));
    await waitFor(() => r.getByText(TAKEN));
    stepIs(r, 3);
    expect(r.queryByTestId('new-otp-0')).toBeNull();

    // a free number opens N4 with the new number whole and the signed-out note
    authApi.changePhoneSendNew.mockResolvedValueOnce(ok({ sent_to: NEW, change_token: 'tok-new', expires_in: 900 }));
    fireEvent.press(r.getByTestId('send-new'));
    await waitFor(() => r.getByTestId('new-otp-0'));
    stepIs(r, 4);
    expect(authApi.changePhoneSendNew).toHaveBeenLastCalledWith('tok-old', NEW);
    r.getByText('Sent to +91 91234 56789');
    r.getByText('When you confirm, the old number is signed out everywhere. This phone stays signed in.');
    expect(disabled(r, 'confirm-new')).toBe(true);

    // a wrong code keeps N4
    typeOtp(r, 'new-otp', '000000');
    authApi.changePhoneConfirm.mockResolvedValueOnce(no('UNAUTHORIZED', 'Invalid or expired OTP', 401));
    fireEvent.press(r.getByTestId('confirm-new'));
    await waitFor(() => r.getByText('Invalid or expired OTP'));
    stepIs(r, 4);
    expect(n.navigate).not.toHaveBeenCalled();
    expect(await AsyncStorage.getItem('inflx_token')).toBeNull();
  });

  it('CHANGE_EXPIRED anywhere ends the attempt with "Time\'s up" and Start again returns to N1', async () => {
    const r = render(<ChangeNumberScreen navigation={nav()} route={route({ role: 'brand', phone: OLD })} />);
    authApi.changePhoneStart.mockResolvedValueOnce(ok({ sent_to: OLD }));
    fireEvent.press(r.getByTestId('send-old'));
    await waitFor(() => r.getByTestId('old-otp-0'));
    typeOtp(r, 'old-otp', '482913');
    authApi.changePhoneVerifyOld.mockResolvedValueOnce(ok({ change_token: 'tok-old', expires_in: 900 }));
    fireEvent.press(r.getByTestId('verify-old'));
    await waitFor(() => r.getByTestId('new-phone'));
    fireEvent.changeText(r.getByTestId('new-phone'), '9123456789');
    authApi.changePhoneSendNew.mockResolvedValueOnce(no('CHANGE_EXPIRED', EXPIRED, 401));
    fireEvent.press(r.getByTestId('send-new'));
    await waitFor(() => r.getByText(EXPIRED));
    expect(r.queryByTestId('send-new')).toBeNull();
    fireEvent.press(r.getByTestId('start-again'));
    stepIs(r, 1);
    r.getByTestId('send-old');
    expect(r.queryByText(EXPIRED)).toBeNull();
  });

  it('five wrong codes — TOO_MANY_ATTEMPTS — end the attempt with the agreed words and Start again', async () => {
    const r = render(<ChangeNumberScreen navigation={nav()} route={route({ role: 'brand', phone: OLD })} />);
    authApi.changePhoneStart.mockResolvedValueOnce(ok({ sent_to: OLD }));
    fireEvent.press(r.getByTestId('send-old'));
    await waitFor(() => r.getByTestId('old-otp-0'));
    typeOtp(r, 'old-otp', '111111');
    authApi.changePhoneVerifyOld.mockResolvedValueOnce(no('TOO_MANY_ATTEMPTS', TOO_MANY, 429));
    fireEvent.press(r.getByTestId('verify-old'));
    await waitFor(() => r.getByText(TOO_MANY));
    expect(r.queryByTestId('verify-old')).toBeNull();
    fireEvent.press(r.getByTestId('start-again'));
    stepIs(r, 1);
    r.getByTestId('send-old');
  });

  it('the creator app says "creator" in the this-role-only note', async () => {
    const r = render(<ChangeNumberScreen navigation={nav()} route={route({ role: 'influencer', phone: OLD })} />);
    authApi.changePhoneStart.mockResolvedValueOnce(ok({ sent_to: OLD }));
    fireEvent.press(r.getByTestId('send-old'));
    await waitFor(() => r.getByTestId('old-otp-0'));
    typeOtp(r, 'old-otp', '482913');
    authApi.changePhoneVerifyOld.mockResolvedValueOnce(ok({ change_token: 'tok-old', expires_in: 900 }));
    fireEvent.press(r.getByTestId('verify-old'));
    await waitFor(() => r.getByTestId('new-phone'));
    r.getByText(/This changes the number for your creator account only\. If you also have a brand account on the old number, change it from the brand app\./);
  });

  it('the resend countdown starts at 30, counts down, then offers Resend which sends again and restarts it', async () => {
    jest.useFakeTimers();
    try {
      const r = render(<ChangeNumberScreen navigation={nav()} route={route({ role: 'brand', phone: OLD })} />);
      authApi.changePhoneStart.mockResolvedValue(ok({ sent_to: OLD }));
      fireEvent.press(r.getByTestId('send-old'));
      await flush();
      r.getByTestId('old-otp-0');
      r.getByText('Resend in 0:30');
      expect(r.queryByTestId('resend-old')).toBeNull();
      act(() => { jest.advanceTimersByTime(1000); });
      r.getByText('Resend in 0:29');
      act(() => { jest.advanceTimersByTime(29000); });
      expect(r.queryByText(/Resend in/)).toBeNull();
      r.getByText('Resend');
      fireEvent.press(r.getByTestId('resend-old'));
      await flush();
      expect(authApi.changePhoneStart).toHaveBeenCalledTimes(2);
      r.getByText('Resend in 0:30');
    } finally {
      jest.useRealTimers();
    }
  });
});

describe('15 — confirm stores the fresh session and hands the green line back', () => {
  it('stores inflx_token / inflx_refresh_token, patches inflx_user.phone, and navigates back with the toast', async () => {
    await AsyncStorage.setItem('inflx_user', JSON.stringify({ id: 'u1', role: 'brand', phone: OLD, status: 'approved' }));
    await AsyncStorage.setItem('inflx_token', 'old-access');
    await AsyncStorage.setItem('inflx_refresh_token', 'old-refresh');
    const n = nav();
    const r = render(<ChangeNumberScreen navigation={n} route={route({ role: 'brand', returnTo: 'BrandBusinessDetails', phone: OLD })} />);
    authApi.changePhoneStart.mockResolvedValueOnce(ok({ sent_to: OLD }));
    fireEvent.press(r.getByTestId('send-old'));
    await waitFor(() => r.getByTestId('old-otp-0'));
    typeOtp(r, 'old-otp', '482913');
    authApi.changePhoneVerifyOld.mockResolvedValueOnce(ok({ change_token: 'tok-old', expires_in: 900 }));
    fireEvent.press(r.getByTestId('verify-old'));
    await waitFor(() => r.getByTestId('new-phone'));
    fireEvent.changeText(r.getByTestId('new-phone'), '9123456789');
    authApi.changePhoneSendNew.mockResolvedValueOnce(ok({ sent_to: NEW, change_token: 'tok-new', expires_in: 900 }));
    fireEvent.press(r.getByTestId('send-new'));
    await waitFor(() => r.getByTestId('new-otp-0'));
    typeOtp(r, 'new-otp', '719035');
    authApi.changePhoneConfirm.mockResolvedValueOnce(ok({ phone: NEW, access_token: 'new-access', refresh_token: 'new-refresh', message: `Your login number is now ${NEW}.` }));
    fireEvent.press(r.getByTestId('confirm-new'));
    await waitFor(() => expect(n.navigate).toHaveBeenCalledWith('BrandBusinessDetails', { toast: 'Your login number is now +91 91234 56789.' }));
    expect(authApi.changePhoneConfirm).toHaveBeenCalledWith('tok-new', '719035');
    expect(await AsyncStorage.getItem('inflx_token')).toBe('new-access');
    expect(await AsyncStorage.getItem('inflx_refresh_token')).toBe('new-refresh');
    expect(JSON.parse(await AsyncStorage.getItem('inflx_user'))).toEqual({ id: 'u1', role: 'brand', phone: NEW, status: 'approved' });
  });

  it('Business details, returned to with the toast, re-reads /me, shows the new number and the green line once', async () => {
    brandApi.getMe
      .mockResolvedValueOnce(ok({ brand: { business_name: 'Anu Fashion World', contact_person: 'Anu', login_phone: OLD } }))
      .mockResolvedValue(ok({ brand: { business_name: 'Anu Fashion World', contact_person: 'Anu', login_phone: NEW } }));
    const n = nav();
    const r = render(<BrandBusinessDetailsScreen navigation={n} route={route({ toast: 'Your login number is now +91 91234 56789.' })} />);
    await waitFor(() => r.getByTestId('locked-phone'));
    await waitFor(() => expect(r.getByTestId('locked-phone').props.children.join('')).toBe('🔒 +91 91••• ••789'));
    expect(brandApi.getMe.mock.calls.length).toBeGreaterThanOrEqual(2);
    r.getByText('Your login number is now +91 91234 56789.');
    expect(n.setParams).toHaveBeenCalledWith({ toast: undefined });
  });
});

describe('14 — "Change number" beside the locked phone', () => {
  it('Business details: the link sits with the Phone label and opens ChangeNumber with the brand\'s number', async () => {
    brandApi.getMe.mockResolvedValue(ok({ brand: { business_name: 'Anu Fashion World', contact_person: 'Anu', login_phone: OLD } }));
    const n = nav();
    const r = render(<BrandBusinessDetailsScreen navigation={n} route={route({})} />);
    await waitFor(() => r.getByTestId('locked-phone'));
    r.getByText('Phone');
    r.getByText('Change number');
    expect(r.getByTestId('locked-phone').props.children.join('')).toBe('🔒 +91 98••• ••210');
    r.getByText('Your login number. This is your business number too.');
    fireEvent.press(r.getByTestId('change-number-link'));
    expect(n.navigate).toHaveBeenCalledWith('ChangeNumber', { role: 'brand', returnTo: 'BrandBusinessDetails', phone: OLD });
  });

  it('Profile info: the same link beside the creator\'s locked phone, opening ChangeNumber as a creator', async () => {
    influencerApi.getMe.mockResolvedValue(ok({ influencer: { id: 'c1', full_name: 'Priya Sharma', phone: OLD, state_id: 1, city_id: 10, instagram_handle: 'priya', user_status: 'approved' } }));
    const n = nav();
    const r = render(<ProfileInfoScreen navigation={n} route={route({})} />);
    await waitFor(() => r.getByTestId('locked-phone'));
    r.getByText('Phone');
    r.getByText('Change number');
    expect(r.getByTestId('locked-phone').props.children.join('')).toBe('🔒 +91 98••• ••210');
    fireEvent.press(r.getByTestId('change-number-link'));
    expect(n.navigate).toHaveBeenCalledWith('ChangeNumber', { role: 'influencer', returnTo: 'ProfileInfo', phone: OLD });
  });
});
