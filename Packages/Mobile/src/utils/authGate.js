/**
 * authGate — Path B/C fix. Follower transactional screens (Book Table,
 * Pay Bill, Place Order) require a logged-in follower. Browsing is
 * public; only money actions need auth.
 *
 * The legacy screens (PayAtStoreScreen, SlotPickerScreen, OrderCartScreen)
 * each inlined this check. The Wave-4 redesigned screens early-dispatch
 * to RestaurantBooking/Bill/Cart BEFORE the legacy screen's inline gate
 * is reachable, so the gate was being bypassed → unauthenticated taps
 * 401'd into "Session expired. Please log in again." with no way out.
 *
 * ensureFollowerAuth() reproduces the exact legacy pattern (token check
 * → Sign-In alert → FollowerLogin) in one place so all three new
 * screens behave identically to the old ones.
 *
 * Returns true if authed (caller proceeds); false if not (caller stops —
 * the alert / navigation has already been shown).
 */

import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export async function ensureFollowerAuth(navigation, opts = {}) {
  const token = await AsyncStorage.getItem('inflx_token');
  if (token) return true;

  Alert.alert(
    'Sign In Required',
    opts.message || 'You need to sign in to continue. It only takes 30 seconds!',
    [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign In', onPress: () => navigation.navigate('FollowerLogin') },
    ]
  );
  return false;
}
