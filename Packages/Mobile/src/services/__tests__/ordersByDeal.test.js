/**
 * shopper-deal-orders, part A — My orders is asked for "by deal" (A1).
 *
 * The real client (services/api.js) with the server stood in for: every way the app asks for her
 * orders carries `by=deal`, next to whatever filter, search and page it asked with. A server that
 * knows the word answers cards; one that does not answers every item on its own.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const { followerApi, _resetClockForTests } = require('../api');

const b64url = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
const nowS = () => Math.floor(Date.now() / 1000);
const jwt = (expInS) => `${b64url({ alg: 'HS256', typ: 'JWT' })}.${b64url({ sub: 'u1', role: 'follower', iat: nowS(), exp: nowS() + expInS })}.c2lnbmF0dXJl`;
function jsonRes(status, body) {
  const res = { status, ok: status >= 200 && status < 300, headers: { get: () => null }, text: () => Promise.resolve(JSON.stringify(body)), json: () => Promise.resolve(body) };
  res.clone = () => ({ text: () => Promise.resolve(JSON.stringify(body)) });
  return Promise.resolve(res);
}
const asked = () => global.fetch.mock.calls.map(([url]) => String(url)).filter((u) => u.includes('/follower/orders'));
const queryOf = (url) => Object.fromEntries(new URL(url).searchParams.entries());

beforeEach(async () => {
  await AsyncStorage.clear();
  _resetClockForTests();
  await AsyncStorage.setItem('inflx_token', jwt(900));
  await AsyncStorage.setItem('inflx_refresh_token', 'refresh');
  await AsyncStorage.setItem('inflx_user', JSON.stringify({ id: 'u1', role: 'follower' }));
  global.fetch = jest.fn(() => jsonRes(200, { success: true, data: { items: [], more: false } }));
});

describe('My orders is asked for by deal', () => {
  it('with no filter: only `by=deal`', async () => {
    await followerApi.orders({ status: undefined, q: undefined, page: undefined });
    expect(asked()).toHaveLength(1);
    expect(queryOf(asked()[0])).toEqual({ by: 'deal' });
  });

  it('with a filter, a search and a page: all of them, and `by=deal`', async () => {
    await followerApi.orders({ status: 'delivered', q: 'jeans', page: 2 });
    expect(queryOf(asked()[0])).toEqual({ status: 'delivered', q: 'jeans', page: '2', by: 'deal' });
  });

  it('asked with nothing at all', async () => {
    await followerApi.orders();
    expect(queryOf(asked()[0])).toEqual({ by: 'deal' });
  });

  it('one item\'s page, its cancel and its return are asked for as they always were', async () => {
    await followerApi.orderLine('l1');
    await followerApi.cancelPreview('l1');
    await followerApi.returnPreview('l1');
    const urls = global.fetch.mock.calls.map(([url]) => String(url));
    expect(urls.filter((u) => u.includes('by=deal'))).toEqual([]);
    expect(urls.some((u) => u.endsWith('/follower/orders/lines/l1'))).toBe(true);
  });
});
