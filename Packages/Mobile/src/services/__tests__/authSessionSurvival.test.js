/**
 * Regression — a 401 from a session-ESTABLISHING endpoint must not be treated
 * as a dead session.
 *
 * The bug: the backend answers a wrong/expired/already-used OTP with HTTP 401
 * ("Invalid or expired OTP"). The API client's blanket 401 handler ran the
 * refresh-and-clear dance on it, wiped inflx_token/inflx_refresh_token, and
 * replaced the real message with "Please sign in to continue." A brand who
 * hit that mid-signup reached the registration form with no session left and
 * was rejected on submit — leaving a users row with no brands row.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const flush = () => new Promise((r) => setImmediate(r));

function jsonRes(status, body) {
  return Promise.resolve({
    status,
    ok: status >= 200 && status < 300,
    text: () => Promise.resolve(JSON.stringify(body)),
    json: () => Promise.resolve(body),
  });
}

describe('api client — 401 handling on session-establishing endpoints', () => {
  // No jest.resetModules() here on purpose: it would hand the api module a
  // fresh AsyncStorage mock with its own empty store, so the token assertions
  // below would pass without proving anything.
  const { api } = require('../api');

  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('a wrong OTP keeps the session and returns the real message', async () => {
    await AsyncStorage.setItem('inflx_token', 'access-abc');
    await AsyncStorage.setItem('inflx_refresh_token', 'refresh-abc');

    global.fetch = jest.fn(() =>
      jsonRes(401, { success: false, error: { code: 'UNAUTHORIZED', message: 'Invalid or expired OTP' } }));

    const res = await api.post('/auth/verify-otp', { phone: '+919999999999', otp: '000000', role: 'brand' });
    await flush();

    expect(res.error.message).toBe('Invalid or expired OTP');
    // Exactly one call: no /auth/refresh, no retry.
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch.mock.calls[0][0]).toContain('/auth/verify-otp');
    // The tokens the previous verify handed out are still there.
    expect(await AsyncStorage.getItem('inflx_token')).toBe('access-abc');
    expect(await AsyncStorage.getItem('inflx_refresh_token')).toBe('refresh-abc');
  });

  it('a 401 on a real protected endpoint still refreshes and retries', async () => {
    await AsyncStorage.setItem('inflx_token', 'stale');
    await AsyncStorage.setItem('inflx_refresh_token', 'refresh-abc');

    let protectedHits = 0;
    global.fetch = jest.fn((url) => {
      if (String(url).includes('/auth/refresh')) {
        return jsonRes(200, { success: true, data: { access_token: 'fresh', refresh_token: 'refresh-def' } });
      }
      protectedHits += 1;
      return protectedHits === 1
        ? jsonRes(401, { success: false, error: { code: 'UNAUTHORIZED' } })
        : jsonRes(200, { success: true, data: { brand: { id: 'b1' } } });
    });

    const res = await api.get('/brands/me');
    await flush();

    expect(res.success).toBe(true);
    expect(await AsyncStorage.getItem('inflx_token')).toBe('fresh');
  });

  // features/change-login-number — the four change-phone steps are protected (one refresh +
  // retry on a stale access token is right), but a 401 that survives the retry is the
  // server's answer to a wrong code or a 15-minute-old change token. Mistyping one code
  // must never sign the person out.
  it('a wrong code on change-phone/verify-old refreshes once, then keeps the session and returns the real message', async () => {
    await AsyncStorage.setItem('inflx_token', 'access-abc');
    await AsyncStorage.setItem('inflx_refresh_token', 'refresh-abc');
    await AsyncStorage.setItem('inflx_user', JSON.stringify({ id: 'u1', role: 'brand' }));

    global.fetch = jest.fn((url) => {
      if (String(url).includes('/auth/refresh')) {
        return jsonRes(200, { success: true, data: { access_token: 'fresh', refresh_token: 'refresh-def' } });
      }
      return jsonRes(401, { success: false, error: { code: 'UNAUTHORIZED', message: 'Invalid or expired OTP' } });
    });

    const res = await api.post('/auth/change-phone/verify-old', { otp: '000000' });
    await flush();

    expect(res.success).toBe(false);
    expect(res.error.message).toBe('Invalid or expired OTP');
    // verify-old → refresh → verify-old again: the retry happened, the wipe did not.
    expect(global.fetch).toHaveBeenCalledTimes(3);
    expect(await AsyncStorage.getItem('inflx_token')).toBe('fresh');
    expect(await AsyncStorage.getItem('inflx_refresh_token')).toBe('refresh-def');
    expect(await AsyncStorage.getItem('inflx_user')).not.toBeNull();
  });

  it('CHANGE_EXPIRED on change-phone/confirm reaches the screen with its words; the session stays', async () => {
    await AsyncStorage.setItem('inflx_token', 'access-abc');
    await AsyncStorage.setItem('inflx_refresh_token', 'refresh-abc');
    const words = 'Time\'s up. Start again from "Change number" — you have 15 minutes end to end.';

    global.fetch = jest.fn((url) => {
      if (String(url).includes('/auth/refresh')) {
        return jsonRes(200, { success: true, data: { access_token: 'fresh', refresh_token: 'refresh-def' } });
      }
      return jsonRes(401, { success: false, error: { code: 'CHANGE_EXPIRED', message: words } });
    });

    const res = await api.post('/auth/change-phone/confirm', { change_token: 'stale', otp: '482913' });
    await flush();

    expect(res.error.code).toBe('CHANGE_EXPIRED');
    expect(res.error.message).toBe(words);
    expect(await AsyncStorage.getItem('inflx_token')).toBe('fresh');
    expect(await AsyncStorage.getItem('inflx_refresh_token')).toBe('refresh-def');
  });
});
