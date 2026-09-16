import { Linking, Alert } from 'react-native';
import { BRAND_WEB_URL } from '../config/api';

/**
 * Opens the brand web dashboard at the given path.
 * All brand-web routes live under /dashboard/ in the Next.js app.
 * @param {string} [path=''] - Path to append to the base URL (e.g. '/dashboard/campaigns', '/dashboard/wallet')
 */
export async function openWebDashboard(path = '') {
  const url = `${BRAND_WEB_URL}${path}`;
  try {
    // ⚠️ NO canOpenURL. Since Android 11 an app must declare in <queries> that it intends to ASK
    // whether a browser exists; this app never declared it, so canOpenURL answered false on every
    // modern phone and this helper reported "no browser available" on a device with Chrome on it.
    // openURL itself needs no declaration. Found 2026-09-16 behind the agreement's add-money
    // button. Contract: features/brand-wallet-on-the-phone
    await Linking.openURL(url);
  } catch (err) {
    Alert.alert(
      'Could not open the browser',
      `Please visit ${BRAND_WEB_URL}${path} in your browser.`,
    );
  }
}
