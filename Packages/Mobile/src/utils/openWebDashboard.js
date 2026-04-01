import { Linking, Alert } from 'react-native';

const BRAND_WEB_BASE_URL = 'https://brand.inflx.in';

/**
 * Opens the brand web dashboard at the given path.
 * @param {string} [path=''] - Path to append to the base URL (e.g. '/campaigns', '/wallet')
 */
export async function openWebDashboard(path = '') {
  const url = `${BRAND_WEB_BASE_URL}${path}`;
  try {
    const supported = await Linking.canOpenURL(url);
    if (supported) {
      await Linking.openURL(url);
    } else {
      Alert.alert(
        'Cannot Open Browser',
        'No browser is available to open the web dashboard. Please visit brand.inflx.in manually.',
      );
    }
  } catch (err) {
    Alert.alert(
      'Error',
      'Failed to open the web dashboard. Please visit brand.inflx.in manually.',
    );
  }
}
