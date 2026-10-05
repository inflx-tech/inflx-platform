/**
 * shopper-app-fixes · F3 — the session is renewed BEFORE a request when it has run out.
 *
 * The fault: an access token lasts 15 minutes, and the pages a guest may also see (the feed, a post,
 * comments, a store) never answer 401 for an expired one — the server quietly treats her as a guest.
 * The refresh-on-401 never ran there, so after 15 minutes a signed-in shopper's likes, saves and
 * follows looked empty and Comments asked her to sign in.
 *
 * What is checked here, against the real client (services/api.js) with the server stood in for:
 *   · an expired token, or one about to expire, is renewed first and the request carries the NEW one
 *   · a renewal refused for good turns a SHOPPER into a guest quietly — no error, no "Session expired"
 *   · a renewal that fails for a passing reason sends the request as it would have gone
 *   · the brand and creator apps, which share this file, behave on a 401 exactly as before
 *   · a phone whose clock is wrong does not renew before every request
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const { api, tokenTimes, _resetClockForTests } = require('../api');

const b64url = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
const nowS = () => Math.floor(Date.now() / 1000);
/** An access token as the server signs it: header.payload.signature, with `iat` and `exp` in seconds. */
const jwt = (expInS, extra = {}) => `${b64url({ alg: 'HS256', typ: 'JWT' })}.${b64url({ sub: 'u1', role: 'follower', iat: nowS(), exp: nowS() + expInS, ...extra })}.c2lnbmF0dXJl`;

function jsonRes(status, body, date) {
  return Promise.resolve({
    status,
    ok: status >= 200 && status < 300,
    headers: { get: (k) => (String(k).toLowerCase() === 'date' && date ? date : null) },
    text: () => Promise.resolve(JSON.stringify(body)),
    json: () => Promise.resolve(body),
  });
}
const urls = () => global.fetch.mock.calls.map((c) => String(c[0]).replace(/^.*\/v1/, ''));
const bearer = (i) => global.fetch.mock.calls[i][1].headers.Authorization;

async function signedIn(token, role = 'follower') {
  await AsyncStorage.setItem('inflx_token', token);
  await AsyncStorage.setItem('inflx_refresh_token', 'refresh-old');
  await AsyncStorage.setItem('inflx_user', JSON.stringify({ id: 'u1', role }));
}

/** The server: `/auth/refresh` answers as told; everything else answers as a guest-allowed page does. */
function server({ refresh, page }) {
  global.fetch = jest.fn((url, init) => {
    if (String(url).includes('/auth/refresh')) return refresh(init);
    return page(init, String(url));
  });
}
const FRESH = jwt(900);
const refreshOk = () => jsonRes(200, { success: true, data: { access_token: FRESH, refresh_token: 'refresh-new' } });
const refreshRefused = () => jsonRes(401, { success: false, error: { code: 'UNAUTHORIZED', message: 'Invalid refresh token' } });
// A page a guest may also see: it never answers 401. It says who it took her for.
const guestAllowed = (init) => jsonRes(200, { success: true, data: { signed_in: !!(init.headers && init.headers.Authorization) } });

beforeEach(async () => {
  await AsyncStorage.clear();
  _resetClockForTests();
  jest.restoreAllMocks();
});

describe('reading the token', () => {
  it('tokenTimes: when a token runs out, from the token itself — no library', () => {
    const t = jwt(600);
    const times = tokenTimes(t);
    expect(times.exp - times.iat).toBe(600);
    // a name with letters outside ASCII in the payload does not break it
    expect(tokenTimes(jwt(60, { name: 'Anusha అనూష' })).exp).toBeGreaterThan(nowS());
  });

  it('anything that is not such a token is left alone (the 401 path handles it, as before)', () => {
    for (const not of ['t', 'access-abc', 'stale', '', null, undefined, 'a.b.c', `${b64url({ alg: 'x' })}.${b64url({ sub: 'u1' })}.sig`]) {
      expect(tokenTimes(not)).toBeNull();
    }
  });
});

describe('a signed-in shopper on a page a guest may also see', () => {
  it('her token ran out: it is renewed FIRST, and the page is asked with the new one — she stays herself', async () => {
    await signedIn(jwt(-60));                                          // ran out a minute ago
    server({ refresh: refreshOk, page: guestAllowed });

    const res = await api.post('/follower/feed', { mode: 'home' });

    expect(urls()).toEqual(['/auth/refresh', '/follower/feed']);       // renewed before asking, not after a refusal
    expect(bearer(1)).toBe(`Bearer ${FRESH}`);
    expect(res).toEqual({ success: true, data: { signed_in: true } });  // the server knows who she is
    expect(await AsyncStorage.getItem('inflx_token')).toBe(FRESH);
    expect(await AsyncStorage.getItem('inflx_refresh_token')).toBe('refresh-new');
  });

  it('the fault as it was: without renewing, the same page would have taken her for a guest', async () => {
    // What the old client did: sent the expired token; the page answers 200, so nothing ever refreshed.
    const expired = jwt(-60);
    await signedIn(expired);
    server({ refresh: refreshOk, page: (init) => jsonRes(200, { success: true, data: { signed_in: init.headers.Authorization === `Bearer ${FRESH}` } }) });
    const res = await api.get('/follower/posts/p1/comments');
    expect(res.data.signed_in).toBe(true);                             // true only because the NEW token went with it
    expect(global.fetch.mock.calls.some((c) => c[1].headers && c[1].headers.Authorization === `Bearer ${expired}`)).toBe(false);
  });

  it('a token about to run out (10 seconds left) is renewed too; one with minutes left is not', async () => {
    await signedIn(jwt(10));
    server({ refresh: refreshOk, page: guestAllowed });
    await api.get('/follower/circles');
    expect(urls()).toEqual(['/auth/refresh', '/follower/circles']);

    const good = jwt(300);
    await signedIn(good);
    server({ refresh: refreshOk, page: guestAllowed });
    await api.get('/follower/circles');
    expect(urls()).toEqual(['/follower/circles']);                     // no renewal: nothing has changed for her
    expect(bearer(0)).toBe(`Bearer ${good}`);
  });

  it('several pages asked at once share ONE renewal', async () => {
    await signedIn(jwt(-5));
    server({ refresh: refreshOk, page: guestAllowed });
    const all = await Promise.all([api.post('/follower/feed', {}), api.get('/follower/circles'), api.get('/follower/saved')]);
    expect(all.every((r) => r.data.signed_in)).toBe(true);
    expect(urls().filter((u) => u === '/auth/refresh')).toHaveLength(1);
    expect(urls()).toHaveLength(4);
  });
});

describe('the renewal is refused for good (she was signed out elsewhere)', () => {
  it('a shopper becomes a guest quietly: the page is asked without a token, and answers — no error, no "Session expired"', async () => {
    await signedIn(jwt(-60));
    server({ refresh: refreshRefused, page: guestAllowed });

    const res = await api.post('/follower/feed', { mode: 'home' });

    expect(res).toEqual({ success: true, data: { signed_in: false } });  // a guest's answer, not an error
    expect(JSON.stringify(res)).not.toMatch(/expired/i);
    expect(urls()).toEqual(['/auth/refresh', '/follower/feed']);
    expect(bearer(1)).toBeUndefined();                                   // nothing of the dead session goes with it
    // the session is gone from the phone, so every screen now sees a guest
    expect(await AsyncStorage.multiGet(['inflx_token', 'inflx_refresh_token', 'inflx_user'])).toEqual(
      [['inflx_token', null], ['inflx_refresh_token', null], ['inflx_user', null]]);
  });

  it('…and on something only a signed-in shopper may do, she is asked to sign in — never told "Session expired"', async () => {
    await signedIn(jwt(-60));
    server({ refresh: refreshRefused, page: () => jsonRes(401, { success: false, error: { code: 'UNAUTHORIZED', message: 'No token' } }) });
    const res = await api.get('/follower/orders');
    expect(res.success).toBe(false);
    expect(res.error).toEqual({ code: 'UNAUTHORIZED', message: 'Please sign in to continue.' });
    expect(res.error.message).not.toMatch(/expired/i);
  });

  it('a shopper with no refresh token on the phone (signed in before it was kept) is a guest the same quiet way', async () => {
    await AsyncStorage.setItem('inflx_token', jwt(-60));
    await AsyncStorage.setItem('inflx_user', JSON.stringify({ id: 'u1', role: 'follower' }));
    server({ refresh: refreshOk, page: guestAllowed });
    const res = await api.get('/follower/circles');
    expect(res.data.signed_in).toBe(false);
    expect(urls()).toEqual(['/follower/circles']);                       // there was nothing to renew with
    expect(await AsyncStorage.getItem('inflx_token')).toBeNull();
  });
});

describe('the renewal fails for a passing reason (no network, a busy server)', () => {
  it.each([
    ['the phone is offline for a moment', () => Promise.reject(new Error('Network request failed'))],
    ['the server is busy (503)', () => jsonRes(503, { success: false })],
  ])('%s: the request goes as it would have gone, and her session is kept', async (_label, refresh) => {
    const expired = jwt(-60);
    await signedIn(expired);
    server({ refresh, page: guestAllowed });

    const res = await api.get('/follower/circles');

    expect(urls()).toEqual(['/auth/refresh', '/follower/circles']);
    expect(bearer(1)).toBe(`Bearer ${expired}`);                         // exactly what the old client sent
    expect(res.success).toBe(true);
    expect(await AsyncStorage.getItem('inflx_token')).toBe(expired);     // nothing was wiped
    expect(await AsyncStorage.getItem('inflx_refresh_token')).toBe('refresh-old');
    expect(await AsyncStorage.getItem('inflx_user')).not.toBeNull();
  });
});

describe('the brand and creator apps share this file: a 401 means what it always meant', () => {
  it.each(['brand', 'influencer'])('%s — renewal refused: the request goes with the old token, the 401 clears the session and says "Session expired", as today', async (role) => {
    const expired = jwt(-60, { role });
    await signedIn(expired, role);
    server({ refresh: refreshRefused, page: () => jsonRes(401, { success: false, error: { code: 'UNAUTHORIZED' } }) });

    const res = await api.get(role === 'brand' ? '/brands/me' : '/influencers/me');

    // not turned into a guest: the request is the one the old client sent
    expect(global.fetch.mock.calls.filter((c) => !String(c[0]).includes('/auth/refresh'))[0][1].headers.Authorization).toBe(`Bearer ${expired}`);
    expect(res).toEqual({ success: false, error: { code: 'UNAUTHORIZED', message: 'Session expired. Please log in again.' } });
    expect(await AsyncStorage.getItem('inflx_token')).toBeNull();
  });

  it('brand — renewal works: one renewal, then the request with the new token (it used to cost a refused request first)', async () => {
    await signedIn(jwt(-60, { role: 'brand' }), 'brand');
    server({ refresh: refreshOk, page: (init) => jsonRes(200, { success: true, data: { brand: { id: 'b1' }, with: init.headers.Authorization } }) });
    const res = await api.get('/brands/me/wallet');
    expect(res.data.with).toBe(`Bearer ${FRESH}`);
    expect(urls()).toEqual(['/auth/refresh', '/brands/me/wallet']);
  });

  it('brand — the renewal cannot be reached: "Could not reach the server", session kept, as today', async () => {
    const expired = jwt(-60, { role: 'brand' });
    await signedIn(expired, 'brand');
    server({ refresh: () => Promise.reject(new Error('offline')), page: () => jsonRes(401, { success: false, error: { code: 'UNAUTHORIZED' } }) });
    const res = await api.get('/brands/me');
    expect(res.error.code).toBe('NETWORK_ERROR');
    expect(await AsyncStorage.getItem('inflx_token')).toBe(expired);
  });

  it('a token this client cannot read (not a JWT) is never renewed ahead: only a 401 renews it, as before', async () => {
    await AsyncStorage.setItem('inflx_token', 'stale');
    await AsyncStorage.setItem('inflx_refresh_token', 'refresh-old');
    let hits = 0;
    server({ refresh: refreshOk, page: () => { hits += 1; return hits === 1 ? jsonRes(401, { success: false, error: { code: 'UNAUTHORIZED' } }) : jsonRes(200, { success: true, data: {} }); } });
    const res = await api.get('/brands/me');
    expect(res.success).toBe(true);
    expect(urls()).toEqual(['/brands/me', '/auth/refresh', '/brands/me']);
  });
});

describe('what must not change', () => {
  it('signing in is never preceded by a renewal, whatever is left on the phone', async () => {
    await signedIn(jwt(-60));
    server({ refresh: refreshOk, page: () => jsonRes(200, { success: true, data: { access_token: 'a', refresh_token: 'r', user: {} } }) });
    await api.post('/auth/send-otp', { phone: '+919123456789' });
    await api.post('/auth/verify-otp', { phone: '+919123456789', otp: '000000', role: 'follower' });
    expect(urls()).toEqual(['/auth/send-otp', '/auth/verify-otp']);
  });

  it('a guest (no token at all) asks as a guest: no renewal, no token', async () => {
    server({ refresh: refreshOk, page: guestAllowed });
    const res = await api.post('/follower/feed', {});
    expect(res.data.signed_in).toBe(false);
    expect(urls()).toEqual(['/follower/feed']);
  });
});

describe('a phone whose clock is wrong', () => {
  it('twenty minutes fast: the first request renews once; after that the server\'s own time is used — not a renewal before every request', async () => {
    const real = Date.now();
    jest.spyOn(Date, 'now').mockImplementation(() => real + 20 * 60 * 1000);       // the phone says it is 20 minutes later
    const issued = Math.floor(real / 1000);                                        // …the server signs with the real time
    const fromServer = () => `${b64url({ alg: 'HS256' })}.${b64url({ sub: 'u1', role: 'follower', iat: issued, exp: issued + 900 })}.sig`;
    await signedIn(fromServer());                                                  // 15 minutes left, really
    server({ refresh: () => jsonRes(200, { success: true, data: { access_token: fromServer(), refresh_token: 'refresh-new' } }), page: guestAllowed });

    await api.get('/follower/circles');
    await api.get('/follower/circles');
    await api.post('/follower/feed', {});

    expect(urls()).toEqual(['/auth/refresh', '/follower/circles', '/follower/circles', '/follower/feed']);
  });

  it('the server\'s Date header alone corrects it too', async () => {
    const real = Date.now();
    jest.spyOn(Date, 'now').mockImplementation(() => real + 20 * 60 * 1000);
    const issued = Math.floor(real / 1000);
    const token = `${b64url({ alg: 'HS256' })}.${b64url({ sub: 'u1', role: 'follower', iat: issued, exp: issued + 900 })}.sig`;
    server({ refresh: refreshOk, page: (init) => jsonRes(200, { success: true, data: { signed_in: !!init.headers.Authorization } }, new Date(real).toUTCString()) });
    await api.get('/follower/app-config');                                         // any answer carries the server's time
    await signedIn(token);
    await api.get('/follower/circles');
    expect(urls()).toEqual(['/follower/app-config', '/follower/circles']);          // not taken for expired
  });
});
