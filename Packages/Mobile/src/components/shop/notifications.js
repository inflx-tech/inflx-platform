/**
 * A shopper's notifications (shopper-app-fixes · F15 · decision X5).
 *
 *   what it carries                       where a tap leads
 *   { screen: 'order', line_id }          that order's details
 *   { screen: 'orders', checkout_id }     My orders
 *   anything else                         Profile › Notifications
 *
 * A push she taps: App.js keeps what it carried under `inflx_pending_deeplink`. Nothing used to
 * read it, so the tap only opened Home. It is read here — when the app starts, when it comes to the
 * front, and the moment the tap is heard — forgotten, and opened.
 *
 * The phone is registered for notifications as soon as she signs in (it used to wait for the next
 * launch): the push id App.js has already cached is sent with her new session.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authApi } from '../../services/api';
import { isSignedIn } from './shopStore';

const PENDING = 'inflx_pending_deeplink';
const PUSH_ID = 'inflx_onesignal_player_id';
export const NOTIFICATIONS_ROUTE = 'ShopNotifications';

/** What a notification carries: the server sends an object; an older row may hold it as text. */
function carried(data) {
  if (typeof data !== 'string') return data && typeof data === 'object' ? data : null;
  try { const d = JSON.parse(data); return d && typeof d === 'object' ? d : null; } catch { return null; }
}

/** Where a notification leads: `[route name, params]`. */
export function notificationTarget(data) {
  const d = carried(data);
  if (d && d.screen === 'order' && d.line_id) return ['OrderDetail', { lineId: d.line_id }];
  if (d && d.screen === 'orders') return ['Orders', undefined];
  return [NOTIFICATIONS_ROUTE, undefined];
}

let opening = false;

/**
 * Opens what the notification she tapped is about, once. Her orders and her notifications are hers
 * only while she is signed in; signed out, the tap is forgotten and the app opens as it always did.
 * Resolves to the route it opened, or null.
 */
export async function openPendingNotification() {
  if (opening) return null;
  opening = true;
  try {
    const raw = await AsyncStorage.getItem(PENDING);
    if (!raw) return null;
    await AsyncStorage.removeItem(PENDING);
    if (!(await isSignedIn())) return null;
    const [name, params] = notificationTarget(raw);
    // The navigation ref is asked for here, not at the top: the screens that only need
    // notificationTarget must not depend on it.
    const { navigateWhenReady } = require('../../navigation/navRef');
    navigateWhenReady(name, params, 40);        // a cold start: the splash is still on screen
    return name;
  } catch {
    return null;
  } finally {
    opening = false;
  }
}

/** Sign-in: tell INFLX which phone to notify. Never holds up, or fails, a sign-in. */
export async function registerPushAfterSignIn() {
  try {
    const id = await AsyncStorage.getItem(PUSH_ID);
    if (!id) return false;
    const res = await authApi.registerOneSignalPlayerId(id);
    return !!(res && res.success);
  } catch {
    return false;
  }
}
