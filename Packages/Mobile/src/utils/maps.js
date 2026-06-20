import { UIManager } from 'react-native';

/**
 * maps.js — OTA-SAFE react-native-maps accessor.
 *
 * `react-native-maps` is a NATIVE module: the JS package must be present so
 * Metro can bundle (it's a static require), but the native map VIEW only exists
 * once a new APK that links it (+ the Maps SDK for Android key in
 * AndroidManifest) is installed. So `isMapsAvailable()` checks the NATIVE view
 * manager is registered — NOT merely that the JS require succeeded — because on
 * the current OTA build the require succeeds but rendering <MapView> would crash
 * (no native view). Old APK / web → false → callers render a fallback. Next APK
 * → true → the map activates automatically, no further JS change.
 *
 * Contract: features/follower-location-redesign (Wave B — native APK).
 */

let RNMaps = null;
try {
  const m = require('react-native-maps');
  RNMaps = m && m.default ? m : null;
} catch (e) {
  RNMaps = null;
}

// react-native-maps registers these Android view managers when linked natively.
function nativeMapRegistered() {
  try {
    const get = UIManager.getViewManagerConfig;
    if (typeof get !== 'function') return false;
    return !!(get('AIRMapView') || get('AIRMap') || get('AIRGoogleMap'));
  } catch {
    return false;
  }
}

export { RNMaps };
export function isMapsAvailable() {
  return !!(RNMaps && RNMaps.default) && nativeMapRegistered();
}
