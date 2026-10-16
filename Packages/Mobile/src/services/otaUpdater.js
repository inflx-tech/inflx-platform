/**
 * otaUpdater.js
 *
 * Checks the backend for a newer JS bundle on app launch. If one is
 * published for this flavor (brand / influencer / follower), downloads it
 * to the app's private files directory and writes a `ready.marker` sidecar
 * so MainApplication.kt picks it up on the NEXT launch.
 *
 * Design intent
 *  - Never swap the bundle mid-session — avoids the "app suddenly behaves
 *    like a different version" problem. You open the app, we fetch the
 *    new bundle in the background, you keep using the current one, and
 *    the next time you open the app you see the new code.
 *  - Fail-safe: any network error / hash mismatch / invalid bundle is
 *    silent and leaves the existing cached bundle untouched.
 *  - Native-code-safe: the manifest carries a `nativeRuntime` string. If
 *    the APK's baked-in native runtime doesn't match, we skip — prevents
 *    loading a JS bundle that calls native code not present in this APK.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform, NativeModules } from 'react-native';
import { API_BASE_URL } from '../config/api';
import APP_ROLE from '../config/appRole';

// Bump this EVERY time we change native code (new library, gradle change,
// native module added/removed). OTA bundles published against a different
// runtime won't load — user will keep using the bundle baked into their APK.
// 4 = React Native 0.81 / Android 16 build (Play Store). Runtime-3 phones keep their
// own bundles; a bundle published from this code only reaches runtime-4 builds.
export const NATIVE_RUNTIME = '4';

const STORE_KEY_APPLIED_VERSION = 'inflx_ota_applied_version';
const STORE_KEY_PENDING_VERSION = 'inflx_ota_pending_version';

/**
 * Kick off the background update check. Safe to call multiple times —
 * the result always resolves silently, errors are swallowed.
 */
export async function checkForOtaUpdate() {
  if (Platform.OS !== 'android') return; // iOS not supported yet
  if (__DEV__) return;                    // Dev mode already uses Metro

  try {
    // 1. Fetch manifest for this flavor
    const flavor = APP_ROLE || 'influencer';
    const res = await fetch(
      `${API_BASE_URL}/ota/manifest?flavor=${flavor}&runtime=${NATIVE_RUNTIME}`,
      { method: 'GET' }
    );
    if (!res.ok) return;
    const json = await res.json().catch(() => null);
    const manifest = json?.data?.manifest;
    if (!manifest || !manifest.bundle_url || !manifest.version) return;

    // 2. Compare against what's already applied (loaded in this session)
    //    and what's already downloaded but pending a restart.
    const applied = parseInt(await AsyncStorage.getItem(STORE_KEY_APPLIED_VERSION) || '0', 10);
    const pending = parseInt(await AsyncStorage.getItem(STORE_KEY_PENDING_VERSION) || '0', 10);
    const manifestV = parseInt(manifest.version, 10);

    // Already have this version (or newer) locally — nothing to do
    if (manifestV <= applied) return;
    if (manifestV <= pending) return;

    // 3. Native runtime mismatch — this APK can't safely run that bundle
    if (manifest.native_runtime && String(manifest.native_runtime) !== NATIVE_RUNTIME) {
      console.log('[OTA] Skip — native runtime mismatch', manifest.native_runtime, 'vs', NATIVE_RUNTIME);
      return;
    }

    // 4. Download + verify + install. Delegates to the native OtaUpdater
    //    module, which writes the bundle file and the ready.marker sidecar
    //    atomically into the app's private files dir.
    const OtaUpdater = NativeModules.OtaUpdater;
    if (!OtaUpdater || !OtaUpdater.install) {
      console.log('[OTA] Native OtaUpdater module not present — skipping');
      return;
    }

    const result = await OtaUpdater.install({
      url:     manifest.bundle_url,
      hash:    manifest.bundle_hash || '',
      version: manifestV,
    });

    if (result && result.ok) {
      await AsyncStorage.setItem(STORE_KEY_PENDING_VERSION, String(manifestV));
      console.log(`[OTA] Bundle v${manifestV} ready — will activate on next launch`);
    }
  } catch (e) {
    // Deliberately swallow all errors — a broken update must never brick the app
    console.log('[OTA] check failed (non-fatal):', e?.message || e);
  }
}

/**
 * Call this AFTER the new bundle has actually booted, so we know it
 * works. Promotes `pending` → `applied` and clears the marker so we
 * don't try to redownload.
 */
export async function confirmAppliedVersion() {
  try {
    const pending = await AsyncStorage.getItem(STORE_KEY_PENDING_VERSION);
    if (pending) {
      await AsyncStorage.setItem(STORE_KEY_APPLIED_VERSION, pending);
      await AsyncStorage.removeItem(STORE_KEY_PENDING_VERSION);
    }
  } catch {}
}
