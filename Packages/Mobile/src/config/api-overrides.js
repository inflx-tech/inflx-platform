// Local-dev overrides for Packages/Mobile/src/config/api.js.
//
// Default (committed): empty — debug AND release builds both hit
// PRODUCTION_* URLs in api.js. This matches the prior hardcoded
// USE_PRODUCTION=true behaviour exactly.
//
// To redirect in __DEV__ builds (debug APK with Metro running), set
// fields below to point at your local backend, then keep your edits
// out of commits:
//
//   git update-index --skip-worktree Packages/Mobile/src/config/api-overrides.js
//
// To start tracking changes again:
//
//   git update-index --no-skip-worktree Packages/Mobile/src/config/api-overrides.js
//
// Examples (uncomment + edit):
//
//   Android emulator → host laptop on the same machine:
//     API_BASE_URL: 'http://10.0.2.2:3001/v1',
//     BRAND_WEB_URL: 'http://10.0.2.2:3002',
//
//   Physical phone over LAN (replace IP with your laptop's LAN IP):
//     API_BASE_URL: 'http://192.168.x.y:3001/v1',
//     BRAND_WEB_URL: 'http://192.168.x.y:3002',
//
// Release builds (`__DEV__ === false`) IGNORE this file entirely
// and always use PRODUCTION_* URLs. Safe to leave edits here.
//
// Contract: features/maestro-first-flow/ (Phase 2 sub-contract 4).

export default {};
