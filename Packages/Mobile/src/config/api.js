import { Platform } from 'react-native';

// Android emulator maps 10.0.2.2 to localhost on host machine
// iOS simulator can use localhost directly
// Physical device: use ngrok URL
const DEV_LAN_IP = '192.168.0.108';

const PRODUCTION_API_URL = 'https://inflx-platform.onrender.com/v1';

// Set to true to force all builds (including debug APKs) to use production API
const USE_PRODUCTION = true;

const getBaseUrl = () => {
  if (USE_PRODUCTION) {
    return PRODUCTION_API_URL;
  }
  if (__DEV__) {
    return `http://${DEV_LAN_IP}:3001/v1`;
  }
  return PRODUCTION_API_URL;
};

export const API_BASE_URL = getBaseUrl();

// Brand web dashboard URL — used by openWebDashboard utility
// In production, brand web is served at inflx.in with routes under /dashboard/
const PRODUCTION_BRAND_WEB_URL = 'https://inflx.in';

const getBrandWebUrl = () => {
  if (USE_PRODUCTION) {
    return PRODUCTION_BRAND_WEB_URL;
  }
  if (__DEV__) {
    return `http://${DEV_LAN_IP}:3002`;
  }
  return PRODUCTION_BRAND_WEB_URL;
};

export const BRAND_WEB_URL = getBrandWebUrl();
