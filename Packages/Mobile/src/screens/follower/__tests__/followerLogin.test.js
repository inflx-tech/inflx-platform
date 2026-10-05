/**
 * shopper-app-fixes — the shopper's sign-in screen (FollowerLoginScreen), rendered and driven as she
 * uses it: her number → the code → her name (only when she has never given one) → signed in.
 *
 *   F2   the ten digits she types are always sent as +91 and those ten digits
 *   F4   no name goes with the code; the server says whether one is still needed (`name_needed`);
 *        then "Your name" — one box, required — saved with PATCH /followers/me
 *   N2   the first line says why she is signing in; "Resend code" 30 seconds after the code was sent
 *   F15  the phone is registered for notifications as soon as she is signed in
 *
 * Contract: features/shopper-app-fixes · BUILD_API.md ("Profile, names, following", "Notifications")
 */
import React from 'react';
import { Alert } from 'react-native';
import { render, fireEvent, act } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

jest.mock('../../../services/api', () => ({
  api: { post: jest.fn(), get: jest.fn() },
  followerApi: {
    getMe: jest.fn(), updateMe: jest.fn(), merge: jest.fn(), setPreferences: jest.fn(), mergeBag: jest.fn(), getBag: jest.fn(), putBag: jest.fn(),
  },
  authApi: { registerOneSignalPlayerId: jest.fn() },
  setDeviceHeader: jest.fn(), clearSession: jest.fn(() => Promise.resolve()),
}));

const { api, followerApi, authApi } = require('../../../services/api');
const { shopStore } = require('../../../components/shop/shopStore');
const Login = require('../FollowerLoginScreen').default;
const { RESEND_AFTER_MS } = require('../FollowerLoginScreen');

const nav = () => ({ goBack: jest.fn(), navigate: jest.fn() });
const ok = (data) => ({ success: true, data });
const SESSION = { access_token: 'access-1', refresh_token: 'refresh-1', user: { id: 'u1', phone: '+919123456789', role: 'follower', name: 'Pending (6789)', status: 'approved' } };
const ME = (over = {}) => ok({ follower: { id: 'f1', name: 'Anusha', phone: '+919123456789' }, addresses: [], name_needed: false, ...over });

/** The body sent with a call to the given path. */
const sent = (path) => api.post.mock.calls.filter((c) => c[0] === path).map((c) => c[1]);
/** Press the button of the alert that is on screen ("Signed in" → Continue). */
function pressAlert(title) {
  const call = Alert.alert.mock.calls.find((c) => c[0] === title);
  expect(call).toBeTruthy();
  act(() => { call[2][0].onPress(); });
}

async function toCode(r, digits = '9123456789') {
  fireEvent.changeText(r.getByTestId('login-phone'), digits);
  await act(async () => { fireEvent.press(r.getByTestId('login-send')); });
  r.getByTestId('login-otp');                                     // she is on the code step
}
async function verify(r, code = '482913') {
  fireEvent.changeText(r.getByTestId('login-otp'), code);
  await act(async () => { fireEvent.press(r.getByTestId('login-verify')); });
}

beforeEach(async () => {
  jest.clearAllMocks();
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  await AsyncStorage.clear();
  shopStore._reset();
  api.post.mockImplementation((path) => Promise.resolve(path === '/auth/verify-otp' ? ok(SESSION) : ok({ message: 'OTP sent successfully' })));
  followerApi.getMe.mockResolvedValue(ME());
  followerApi.updateMe.mockResolvedValue(ok({ follower: { id: 'f1', name: 'Anusha' } }));
  followerApi.merge.mockResolvedValue(ok({ moved: {} }));
  followerApi.setPreferences.mockResolvedValue(ok({}));
  authApi.registerOneSignalPlayerId.mockResolvedValue(ok({}));
});
afterEach(() => { jest.useRealTimers(); });

/* ═══════════════════════════════════════════ F2 */

describe('F2 · the number she types is sent as +91 and her ten digits', () => {
  it('a number that starts with 91 signs in (it was sent as +9123456789 and refused)', async () => {
    const r = render(<Login navigation={nav()} route={{ params: {} }} />);
    await toCode(r, '9123456789');
    expect(sent('/auth/send-otp')).toEqual([{ phone: '+919123456789' }]);
    r.getByText('We sent a 6-digit code to +91 9123456789');
    await verify(r);
    expect(sent('/auth/verify-otp')[0].phone).toBe('+919123456789');
  });

  it.each([
    ['9876543210', '+919876543210'],
    ['98765 43210', '+919876543210'],
    ['98765-43210', '+919876543210'],
    ['9199887766', '+919199887766'],          // starts with 91 and is still ten digits of hers
    ['6000000001', '+916000000001'],
    ['+91 98765 43210', '+919876543210'],     // pasted whole, with the country code: its last ten digits
    ['919876543210', '+919876543210'],
  ])('"%s" is sent as %s', async (typed, phone) => {
    const r = render(<Login navigation={nav()} route={{ params: {} }} />);
    await toCode(r, typed);
    expect(sent('/auth/send-otp')).toEqual([{ phone }]);
  });

  it('fewer than ten digits cannot be sent', async () => {
    const r = render(<Login navigation={nav()} route={{ params: {} }} />);
    fireEvent.changeText(r.getByTestId('login-phone'), '91234567');
    await act(async () => { fireEvent.press(r.getByTestId('login-send')); });
    expect(api.post).not.toHaveBeenCalled();
    r.getByText('Sign in');                                          // still on the first step
  });
});

/* ═══════════════════════════════════════════ F4 */

describe('F4 · she is asked her name once — and never signed up as "Follower"', () => {
  it('no name goes with the code', async () => {
    const r = render(<Login navigation={nav()} route={{ params: {} }} />);
    await toCode(r);
    await verify(r);
    expect(sent('/auth/verify-otp')).toEqual([{ phone: '+919123456789', otp: '482913', role: 'follower' }]);
    expect(sent('/auth/verify-otp')[0]).not.toHaveProperty('name');
    expect(JSON.stringify(api.post.mock.calls)).not.toMatch(/Follower/);
  });

  it('a new shopper (name_needed): "Your name" right after the code — one box, required — saved to her account, then she is in', async () => {
    followerApi.getMe.mockResolvedValue(ME({ follower: { id: 'f1', name: 'Pending (6789)' }, name_needed: true }));
    const n = nav();
    const onDone = jest.fn();
    const r = render(<Login navigation={n} route={{ params: { onDone } }} />);
    await toCode(r);
    await verify(r);
    expect(followerApi.getMe).toHaveBeenCalledTimes(1);
    r.getByText('Your name'); r.getByText('Last step — tell us your name');
    expect(r.getAllByTestId(/^login-(name|phone|otp)$/)).toHaveLength(1);        // one box
    expect(Alert.alert).not.toHaveBeenCalledWith('Signed in', expect.anything(), expect.anything());
    // required: nothing, or a single letter, does not go
    expect(r.getByTestId('login-name-continue').props.accessibilityState.disabled).toBe(true);
    fireEvent.changeText(r.getByTestId('login-name'), ' A ');
    expect(r.getByTestId('login-name-continue').props.accessibilityState.disabled).toBe(true);
    expect(r.queryByTestId('login-back')).toBeNull();                            // no way round it on this step
    fireEvent.changeText(r.getByTestId('login-name'), '  Anusha  ');
    jest.useFakeTimers();
    await act(async () => { fireEvent.press(r.getByTestId('login-name-continue')); });
    expect(followerApi.updateMe).toHaveBeenCalledWith({ name: 'Anusha' });
    expect(JSON.parse(await AsyncStorage.getItem('inflx_user')).name).toBe('Anusha');
    pressAlert('Signed in');
    expect(n.goBack).toHaveBeenCalledTimes(1);
    act(() => { jest.advanceTimersByTime(400); });
    expect(onDone).toHaveBeenCalledTimes(1);                                     // what she was doing carries on
  });

  it('a shopper the old app named "Follower" is asked at her next sign-in (the server says name_needed)', async () => {
    followerApi.getMe.mockResolvedValue(ME({ follower: { id: 'f1', name: 'Follower' }, name_needed: true }));
    const r = render(<Login navigation={nav()} route={{ params: {} }} />);
    await toCode(r);
    await verify(r);
    r.getByText('Your name');
    expect(r.getByTestId('login-name').props.value).toBe('');                    // "Follower" is not offered back to her
  });

  it('a shopper who has a name is not asked again', async () => {
    const n = nav();
    const r = render(<Login navigation={n} route={{ params: {} }} />);
    await toCode(r);
    await verify(r);
    expect(r.queryByText('Your name')).toBeNull();
    expect(followerApi.updateMe).not.toHaveBeenCalled();
    pressAlert('Signed in');
    expect(n.goBack).toHaveBeenCalledTimes(1);
  });

  it('the name could not be saved: the server\'s words, and she is still on the step', async () => {
    followerApi.getMe.mockResolvedValue(ME({ name_needed: true }));
    followerApi.updateMe.mockResolvedValue({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Name must be 2-100 characters', field: 'name' } });
    const n = nav();
    const r = render(<Login navigation={n} route={{ params: {} }} />);
    await toCode(r);
    await verify(r);
    fireEvent.changeText(r.getByTestId('login-name'), 'An');
    await act(async () => { fireEvent.press(r.getByTestId('login-name-continue')); });
    expect(Alert.alert).toHaveBeenCalledWith('Failed', 'Name must be 2-100 characters');
    r.getByText('Your name');
    expect(n.goBack).not.toHaveBeenCalled();
  });

  it('her account could not be read just now: she is signed in all the same (Profile offers "Add your name")', async () => {
    followerApi.getMe.mockResolvedValue({ success: false, error: { code: 'NETWORK_ERROR', message: 'Cannot connect to server. Check your connection.' } });
    const n = nav();
    const r = render(<Login navigation={n} route={{ params: {} }} />);
    await toCode(r);
    await verify(r);
    expect(await AsyncStorage.getItem('inflx_token')).toBe('access-1');
    expect(r.queryByText('Your name')).toBeNull();
    pressAlert('Signed in');
    expect(n.goBack).toHaveBeenCalled();
  });

  it('a wrong code: the server\'s words; nothing is kept and no name is asked', async () => {
    api.post.mockImplementation((path) => Promise.resolve(path === '/auth/verify-otp'
      ? { success: false, error: { code: 'UNAUTHORIZED', message: 'Invalid or expired OTP' } } : ok({})));
    const r = render(<Login navigation={nav()} route={{ params: {} }} />);
    await toCode(r);
    await verify(r, '000000');
    expect(Alert.alert).toHaveBeenCalledWith('Invalid OTP', 'Invalid or expired OTP');
    expect(await AsyncStorage.getItem('inflx_token')).toBeNull();
    expect(followerApi.getMe).not.toHaveBeenCalled();
    r.getByTestId('login-otp');                                    // still on the code step
  });

  it('signing in keeps the session exactly as before: both tokens and the user, as a follower', async () => {
    const r = render(<Login navigation={nav()} route={{ params: {} }} />);
    await toCode(r);
    await verify(r);
    expect(await AsyncStorage.getItem('inflx_token')).toBe('access-1');
    expect(await AsyncStorage.getItem('inflx_refresh_token')).toBe('refresh-1');
    expect(JSON.parse(await AsyncStorage.getItem('inflx_user'))).toMatchObject({ id: 'u1', role: 'follower' });
  });

  it('what she kept as a guest moves to her account as soon as she is signed in — before the name step, so leaving there loses nothing', async () => {
    await shopStore.set({ follows: ['c1'], savedPosts: ['p1'], savedProducts: [] });
    followerApi.getMe.mockResolvedValue(ME({ name_needed: true }));
    const r = render(<Login navigation={nav()} route={{ params: {} }} />);
    await toCode(r);
    await verify(r);
    r.getByText('Your name');
    expect(followerApi.merge).toHaveBeenCalledWith({ follows: ['c1'], saved_posts: ['p1'], saved_products: [] });
    expect((await shopStore.get()).follows).toEqual([]);
  });
});

/* ═══════════════════════════════════════════ N2 */

describe('N2 · the line says why she is signing in; "Resend code" after 30 seconds', () => {
  it.each([
    [undefined, 'Sign in with your number to like and comment'],     // as it always read
    ['comment', 'Sign in with your number to like and comment'],
    ['order', 'Sign in with your number to place your order'],
    ['save', 'Sign in with your number to keep your saves on your account'],
    ['follow', 'Sign in with your number to keep who you follow on your account'],
    ['something-else', 'Sign in with your number to like and comment'],
  ])('reason %s → "%s"', (reason, line) => {
    const r = render(<Login navigation={nav()} route={{ params: { reason } }} />);
    expect(r.getByTestId('login-why').props.children).toBe(line);
  });

  it('opened with no params at all: the line it always had', () => {
    const r = render(<Login navigation={nav()} route={{}} />);
    r.getByText('Sign in with your number to like and comment');
  });

  it('"Resend code" appears 30 seconds after the code was sent — not before — and sends it to the same number', async () => {
    expect(RESEND_AFTER_MS).toBe(30000);
    jest.useFakeTimers();
    const r = render(<Login navigation={nav()} route={{ params: {} }} />);
    await toCode(r);
    expect(r.queryByText('Resend code')).toBeNull();
    act(() => { jest.advanceTimersByTime(29999); });
    expect(r.queryByText('Resend code')).toBeNull();
    act(() => { jest.advanceTimersByTime(1); });
    r.getByText('Resend code');
    fireEvent.changeText(r.getByTestId('login-otp'), '1234');
    await act(async () => { fireEvent.press(r.getByTestId('login-resend')); });
    expect(sent('/auth/send-otp')).toEqual([{ phone: '+919123456789' }, { phone: '+919123456789' }]);
    expect(r.getByTestId('login-otp').props.value).toBe('');                  // the old code is cleared for the new one
    // it goes away again, for another 30 seconds
    expect(r.queryByText('Resend code')).toBeNull();
    act(() => { jest.advanceTimersByTime(30000); });
    r.getByText('Resend code');
  });

  it('the code could not be sent again: the server\'s words, and she can try once more', async () => {
    jest.useFakeTimers();
    const r = render(<Login navigation={nav()} route={{ params: {} }} />);
    await toCode(r);
    act(() => { jest.advanceTimersByTime(30000); });
    api.post.mockResolvedValueOnce({ success: false, error: { code: 'RATE_LIMITED', message: 'Too many codes. Try again in a minute.' } });
    await act(async () => { fireEvent.press(r.getByTestId('login-resend')); });
    expect(Alert.alert).toHaveBeenCalledWith('Failed', 'Too many codes. Try again in a minute.');
    r.getByText('Resend code');
  });

  it('the timer does not outlive the screen', async () => {
    jest.useFakeTimers();
    const r = render(<Login navigation={nav()} route={{ params: {} }} />);
    await toCode(r);
    r.unmount();
    act(() => { jest.advanceTimersByTime(500); });                            // (a button fade of React Native's may still be finishing)
    expect(jest.getTimerCount()).toBe(0);
  });
});

/* ═══════════════════════════════════════════ F15 */

describe('F15 · the phone is registered for notifications at sign-in', () => {
  it('the push id App.js cached is sent with her new session, right after the code', async () => {
    await AsyncStorage.setItem('inflx_onesignal_player_id', 'player-123');
    followerApi.getMe.mockResolvedValue(ME({ name_needed: true }));
    const r = render(<Login navigation={nav()} route={{ params: {} }} />);
    await toCode(r);
    expect(authApi.registerOneSignalPlayerId).not.toHaveBeenCalled();          // not before she is signed in
    await verify(r);
    expect(authApi.registerOneSignalPlayerId).toHaveBeenCalledTimes(1);
    expect(authApi.registerOneSignalPlayerId).toHaveBeenCalledWith('player-123');
  });

  it('no push id yet (notifications not allowed, or not assigned): nothing is sent, and sign-in is unaffected', async () => {
    const n = nav();
    const r = render(<Login navigation={n} route={{ params: {} }} />);
    await toCode(r);
    await verify(r);
    expect(authApi.registerOneSignalPlayerId).not.toHaveBeenCalled();
    pressAlert('Signed in');
    expect(n.goBack).toHaveBeenCalled();
  });

  it('registering fails: she is signed in all the same', async () => {
    await AsyncStorage.setItem('inflx_onesignal_player_id', 'player-123');
    authApi.registerOneSignalPlayerId.mockRejectedValue(new Error('down'));
    const n = nav();
    const r = render(<Login navigation={n} route={{ params: {} }} />);
    await toCode(r);
    await verify(r);
    pressAlert('Signed in');
    expect(n.goBack).toHaveBeenCalled();
  });
});
