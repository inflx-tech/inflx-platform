import { NativeModules, Platform } from 'react-native';

// Android: read from native module (set by product flavor)
// iOS: fallback to 'influencer'
const APP_ROLE = Platform.OS === 'android'
  ? NativeModules.AppRole?.role || 'influencer'
  : 'influencer';

export default APP_ROLE;
