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
    const supported = await Linking.canOpenURL(url);
    if (supported) {
      await Linking.openURL(url);
    } else {
      Alert.alert(
        'Cannot Open Browser',
        `No browser is available to open the web dashboard. Please visit ${BRAND_WEB_URL}/dashboard manually.`,
      );
    }
  } catch (err) {
    Alert.alert(
      'Error',
      `Failed to open the web dashboard. Please visit ${BRAND_WEB_URL}/dashboard manually.`,
    );
  }
}
