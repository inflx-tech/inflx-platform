import { Platform } from 'react-native';

// Optional local-dev overrides — see ./api-overrides.js.
//
// `api-overrides.js` is COMMITTED with `export default {};` (empty
// defaults) so the default behaviour matches the prior hardcoded
// `USE_PRODUCTION = true`: both debug AND release builds return
// PRODUCTION_* URLs.
//
// To redirect a debug build at a local backend, edit
// Packages/Mobile/src/config/api-overrides.js and then keep your
// edits out of commits with:
//   git update-index --skip-worktree Packages/Mobile/src/config/api-overrides.js
//
// Release builds (`__DEV__ === false`) ALWAYS use PRODUCTION_* URLs,
// regardless of any overrides.
//
// Contract: features/maestro-first-flow/ (Phase 2 sub-contract 4).
import overrides from './api-overrides';

const PRODUCTION_API_URL = 'https://inflx-platform.onrender.com/v1';
const PRODUCTION_BRAND_WEB_URL = 'https://inflx.in';

const getBaseUrl = () => {
  if (__DEV__ && overrides && overrides.API_BASE_URL) {
    return overrides.API_BASE_URL;
  }
  return PRODUCTION_API_URL;
};

const getBrandWebUrl = () => {
  if (__DEV__ && overrides && overrides.BRAND_WEB_URL) {
    return overrides.BRAND_WEB_URL;
  }
  return PRODUCTION_BRAND_WEB_URL;
};

export const API_BASE_URL = getBaseUrl();
export const BRAND_WEB_URL = getBrandWebUrl();

// ── OneSignal Push Notifications ─────────────────────────────────────────
// Get this from OneSignal Dashboard → Settings → Keys & IDs
export const ONESIGNAL_APP_ID = 'fe77ce76-e9c3-47ea-babd-ac3c23be4f62';
