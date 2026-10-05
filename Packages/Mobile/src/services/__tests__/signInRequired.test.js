/**
 * shopper-app-fixes — small fault S6: "sign in" for something only a shopper profile has is the
 * server's answer about THAT request, not a dead session.
 *
 * The fault: a signed-in-only shopper page can answer 401 SIGN_IN_REQUIRED for an account that has
 * no shopper profile. The client renewed the session, asked again, got the same answer — and then
 * cleared the session, signing her out of everything.
 *
 * Against the real client (services/api.js), with the server stood in for.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const { api, _resetClockForTests } = require('../api');

const b64url = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
const nowS = () => Math.floor(Date.now() / 1000);
const jwt = (expInS) => `${b64url({ alg: 'HS256', typ: 'JWT' })}.${b64url({ sub: 'u1', role: 'follower', iat: nowS(), exp: nowS() + expInS })}.c2lnbmF0dXJl`;

function jsonRes(status, body) {
  const res = {
    status, ok: status >= 200 && status < 300,
    headers: { get: () => null },
    text: () => Promise.resolve(JSON.stringify(body)),
    json: () => Promise.resolve(body),
  };
  res.clone = () => ({ text: () => Promise.resolve(JSON.stringify(body)) });
  return Promise.resolve(res);
}
const SIGN_IN = { success: false, error: { code: 'SIGN_IN_REQUIRED', message: 'Sign in with your number to continue.' } };
const DEAD = { success: false, error: { code: 'UNAUTHORIZED', message: 'Invalid token' } };
const FRESH = jwt(900);

async function signedIn() {
  await AsyncStorage.setItem('inflx_token', jwt(900));
  await AsyncStorage.setItem('inflx_refresh_token', 'refresh-old');
  await AsyncStorage.setItem('inflx_user', JSON.stringify({ id: 'u1', role: 'follower' }));
}
function server(page, refresh = () => jsonRes(200, { success: true, data: { access_token: FRESH, refresh_token: 'refresh-new' } })) {
  global.fetch = jest.fn((url) => (String(url).includes('/auth/refresh') ? refresh() : page()));
}

beforeEach(async () => { await AsyncStorage.clear(); _resetClockForTests(); jest.restoreAllMocks(); });

describe('S6 · "sign in required" is an answer, not a dead session', () => {
  it('the session was renewed and the server still says SIGN_IN_REQUIRED: its answer is returned and she stays signed in', async () => {
    await signedIn();
    server(() => jsonRes(401, SIGN_IN));
    const r = await api.get('/follower/saved');
    expect(r).toEqual(SIGN_IN);
    expect(await AsyncStorage.getItem('inflx_token')).toBe(FRESH);              // the renewed session is kept
    expect(await AsyncStorage.getItem('inflx_refresh_token')).toBe('refresh-new');
    expect(await AsyncStorage.getItem('inflx_user')).not.toBeNull();
  });

  it('a session the server really refuses is still cleared, as before', async () => {
    await signedIn();
    server(() => jsonRes(401, DEAD));
    const r = await api.get('/follower/saved');
    expect(r.success).toBe(false);
    expect(r.error.code).toBe('UNAUTHORIZED');
    expect(await AsyncStorage.getItem('inflx_token')).toBeNull();
  });

  it('…and so is one whose renewal is refused, whatever the page then says', async () => {
    await signedIn();
    server(() => jsonRes(401, SIGN_IN), () => jsonRes(401, DEAD));
    const r = await api.get('/follower/saved');
    expect(r.success).toBe(false);
    expect(await AsyncStorage.getItem('inflx_token')).toBeNull();
  });

  it('a guest who is asked to sign in gets the sign-in sentence — never "Session expired"', async () => {
    server(() => jsonRes(401, SIGN_IN), () => jsonRes(401, DEAD));
    const r = await api.get('/follower/saved');
    expect(r.success).toBe(false);
    expect(String(r.error.message)).not.toMatch(/expired/i);
  });
});
