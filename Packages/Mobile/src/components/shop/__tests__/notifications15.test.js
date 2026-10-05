/**
 * shopper-app-fixes · F15 — a tapped notification opens what it is about.
 *
 * The fault: App.js kept what a tapped notification carried under `inflx_pending_deeplink`, and
 * nothing read it, so the tap only opened Home.
 *
 *   notificationTarget          where each kind leads (BUILD_API · decision X5)
 *   openPendingNotification     read once, forgotten, opened — only for a signed-in shopper
 *   registerPushAfterSignIn     the cached push id goes with her new session
 *   App.js                      asks for it on start, when the app comes to the front, and when the
 *                               tap is heard — in the shopper app only
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import fs from 'fs';
import path from 'path';

jest.mock('../../../services/api', () => ({
  authApi: { registerOneSignalPlayerId: jest.fn() },
  followerApi: {},
  setDeviceHeader: jest.fn(),
}));
jest.mock('../../../navigation/navRef', () => ({ navigateWhenReady: jest.fn() }));

const { authApi } = require('../../../services/api');
const { navigateWhenReady } = require('../../../navigation/navRef');
const { notificationTarget, openPendingNotification, registerPushAfterSignIn, NOTIFICATIONS_ROUTE } = require('../notifications');
const { shopStore } = require('../shopStore');

const PENDING = 'inflx_pending_deeplink';
async function signedIn() {
  await AsyncStorage.setItem('inflx_token', 't');
  await AsyncStorage.setItem('inflx_user', JSON.stringify({ role: 'follower' }));
}

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  shopStore._reset();
});

describe('where a notification leads (X5)', () => {
  it('about an order → that order\'s details; about a placed order → My orders; any other → Profile › Notifications', () => {
    expect(notificationTarget({ screen: 'order', line_id: 'line-7' })).toEqual(['OrderDetail', { lineId: 'line-7' }]);
    expect(notificationTarget({ screen: 'orders', checkout_id: 'co-1' })).toEqual(['Orders', undefined]);
    expect(NOTIFICATIONS_ROUTE).toBe('ShopNotifications');
    for (const other of [{ screen: 'offer' }, { screen: 'order' }, {}, null, undefined, 'not json', 42, { type: 'collab_request' }]) {
      expect(notificationTarget(other)).toEqual(['ShopNotifications', undefined]);
    }
  });

  it('what it carries may arrive as text (a push, an older row): it is read the same', () => {
    expect(notificationTarget(JSON.stringify({ screen: 'order', line_id: 'line-7' }))).toEqual(['OrderDetail', { lineId: 'line-7' }]);
    expect(notificationTarget('{"screen":"orders","checkout_id":"co-1"}')).toEqual(['Orders', undefined]);
  });

  it('those three names are screens the shopper app registers, with the param the order page reads', () => {
    const navSrc = fs.readFileSync(path.resolve(__dirname, '../../../navigation/FollowerNavigator.js'), 'utf8');
    for (const name of ['OrderDetail', 'Orders', 'ShopNotifications']) expect(navSrc.match(new RegExp(`<Stack\\.Screen name="${name}" `, 'g'))).toHaveLength(1);
    // Order details is opened with `lineId` everywhere else too (My orders → an order):
    expect(fs.readFileSync(path.resolve(__dirname, '../../../screens/shop/order/OrderScreens.js'), 'utf8')).toMatch(/navigate\('OrderDetail', \{ lineId: /);
  });
});

describe('the notification she tapped', () => {
  it('is read, forgotten, and opened: an order notification opens that order', async () => {
    await signedIn();
    await AsyncStorage.setItem(PENDING, JSON.stringify({ screen: 'order', line_id: 'line-7' }));
    expect(await openPendingNotification()).toBe('OrderDetail');
    expect(navigateWhenReady).toHaveBeenCalledTimes(1);
    expect(navigateWhenReady.mock.calls[0].slice(0, 2)).toEqual(['OrderDetail', { lineId: 'line-7' }]);
    expect(await AsyncStorage.getItem(PENDING)).toBeNull();          // forgotten: it opens once
    expect(await openPendingNotification()).toBeNull();
    expect(navigateWhenReady).toHaveBeenCalledTimes(1);
  });

  it('a placed-order notification opens My orders; any other opens Profile › Notifications', async () => {
    await signedIn();
    await AsyncStorage.setItem(PENDING, JSON.stringify({ screen: 'orders', checkout_id: 'co-1' }));
    await openPendingNotification();
    expect(navigateWhenReady.mock.calls[0].slice(0, 2)).toEqual(['Orders', undefined]);
    await AsyncStorage.setItem(PENDING, JSON.stringify({ campaign: 'x' }));
    await openPendingNotification();
    expect(navigateWhenReady.mock.calls[1].slice(0, 2)).toEqual(['ShopNotifications', undefined]);
  });

  it('it waits for the app to be on screen (a cold start is still on the splash)', async () => {
    await signedIn();
    await AsyncStorage.setItem(PENDING, JSON.stringify({ screen: 'order', line_id: 'line-7' }));
    await openPendingNotification();
    expect(navigateWhenReady.mock.calls[0][2]).toBeGreaterThanOrEqual(25);    // tries, 150 ms apart: longer than the splash
  });

  it('heard twice at the same moment (the tap, and the app coming to the front): it opens once', async () => {
    await signedIn();
    await AsyncStorage.setItem(PENDING, JSON.stringify({ screen: 'order', line_id: 'line-7' }));
    await Promise.all([openPendingNotification(), openPendingNotification(), openPendingNotification()]);
    expect(navigateWhenReady).toHaveBeenCalledTimes(1);
  });

  it('nothing was tapped: nothing opens', async () => {
    await signedIn();
    expect(await openPendingNotification()).toBeNull();
    expect(navigateWhenReady).not.toHaveBeenCalled();
  });

  it('she is signed out: the tap is forgotten and the app opens as it always did — her orders are hers only when signed in', async () => {
    await AsyncStorage.setItem(PENDING, JSON.stringify({ screen: 'order', line_id: 'line-7' }));
    expect(await openPendingNotification()).toBeNull();
    expect(navigateWhenReady).not.toHaveBeenCalled();
    expect(await AsyncStorage.getItem(PENDING)).toBeNull();
  });
});

describe('the phone is registered at sign-in', () => {
  it('sends the push id App.js cached; resolves false, never throws, when there is none or it fails', async () => {
    expect(await registerPushAfterSignIn()).toBe(false);
    expect(authApi.registerOneSignalPlayerId).not.toHaveBeenCalled();
    await AsyncStorage.setItem('inflx_onesignal_player_id', 'player-123');
    authApi.registerOneSignalPlayerId.mockResolvedValue({ success: true, data: {} });
    expect(await registerPushAfterSignIn()).toBe(true);
    expect(authApi.registerOneSignalPlayerId).toHaveBeenCalledWith('player-123');
    authApi.registerOneSignalPlayerId.mockRejectedValue(new Error('down'));
    expect(await registerPushAfterSignIn()).toBe(false);
  });

  it('it is the route the server takes the id on', () => {
    const src = fs.readFileSync(path.resolve(__dirname, '../../../services/api.js'), 'utf8');
    expect(src).toMatch(/registerOneSignalPlayerId: \(playerId\) => api\.post\('\/auth\/onesignal-player-id', \{ player_id: playerId \}\)/);
  });
});

describe('App.js asks for it — in the shopper app only', () => {
  const app = fs.readFileSync(path.resolve(__dirname, '../../../../App.js'), 'utf8');

  it('keeps what the tap carried under the same name this file reads', () => {
    expect(app).toMatch(/AsyncStorage\.setItem\('inflx_pending_deeplink', JSON\.stringify\(data\)\)/);
    expect(fs.readFileSync(path.resolve(__dirname, '../notifications.js'), 'utf8')).toMatch(/const PENDING = 'inflx_pending_deeplink';/);
  });

  it('the moment the tap is heard: only when this is the shopper app', () => {
    expect(app).toMatch(/\.then\(\(\) => \{ if \(APP_ROLE === 'follower'\) openPendingNotification\(\); \}\)/);
  });

  it('on start and whenever the app comes to the front: inside the effect that runs for the shopper app alone', () => {
    const effect = app.slice(app.indexOf("if (APP_ROLE !== 'follower') return undefined;"));
    const end = effect.indexOf('}, []);');
    const body = effect.slice(0, end);
    expect(body).toMatch(/\n\s+openPendingNotification\(\);/);                                    // on start
    expect(body).toMatch(/AppState\.addEventListener\('change', \(state\) => \{ if \(state === 'active'\) openPendingNotification\(\); \}\)/);
    expect(body).toMatch(/front\.remove\(\)/);                                                    // and it stops listening when the app goes
    // nothing outside that effect and the guarded tap handler asks for it
    expect(app.match(/openPendingNotification\(\)/g)).toHaveLength(3);
    expect(app).toMatch(/import \{ openPendingNotification \} from '\.\/src\/components\/shop\/notifications';/);
  });
});
