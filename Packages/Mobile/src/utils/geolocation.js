import { Platform, PermissionsAndroid } from 'react-native';

/**
 * geolocation.js — OTA-SAFE device GPS accessor.
 *
 * `@react-native-community/geolocation` is a NATIVE module: it only exists once a
 * new APK that bundles it is installed. This wrapper loads it via a guarded
 * require so the JS is safe to ship over-the-air to the CURRENT app (where the
 * native side is absent): `isGpsAvailable()` returns false and callers fall back
 * to the default/selected location. When the next APK ships with the dep linked,
 * real GPS activates automatically — no further JS change.
 *
 * Contract: features/follower-location-gps (Contract 3 — native APK).
 */

let RNGeo = null;
try {
  const mod = require('@react-native-community/geolocation');
  RNGeo = mod && (mod.default || mod);
  // Some builds expose the module object but no native impl → treat as unavailable.
  if (RNGeo && typeof RNGeo.getCurrentPosition !== 'function') RNGeo = null;
} catch (e) {
  RNGeo = null; // not bundled in this build (OTA on the old APK) → graceful
}

export function isGpsAvailable() {
  return !!RNGeo;
}

// Ask for Android location permission (PermissionsAndroid is RN core → OTA-safe).
export async function ensureLocationPermission() {
  if (Platform.OS !== 'android') return true;
  try {
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      {
        title: 'Location permission',
        message: 'INFLX uses your location to show the nearest businesses and deals.',
        buttonPositive: 'Allow',
      }
    );
    return granted === PermissionsAndroid.RESULTS.GRANTED;
  } catch {
    return false;
  }
}

// Resolve to { latitude, longitude } or null (never rejects) — safe everywhere.
export function getCurrentPosition(opts = {}) {
  return new Promise((resolve) => {
    if (!RNGeo) return resolve(null);
    try {
      RNGeo.getCurrentPosition(
        (pos) => resolve(pos?.coords ? { latitude: pos.coords.latitude, longitude: pos.coords.longitude } : null),
        () => resolve(null),
        { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000, ...opts }
      );
    } catch {
      resolve(null);
    }
  });
}
