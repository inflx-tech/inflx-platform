import { NativeModules, Platform } from 'react-native';

/**
 * Returns the app role from the native build flavor.
 * Android: read from AppConfig native module (set via productFlavors)
 * iOS / fallback: null (role chosen at login)
 *
 * Values: 'brand' | 'influencer' | 'follower' | null
 */
const APP_ROLE = Platform.OS === 'android'
  ? (NativeModules.AppConfig?.APP_ROLE || null)
  : null;

export default APP_ROLE;
