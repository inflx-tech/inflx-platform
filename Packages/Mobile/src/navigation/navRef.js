import { createNavigationContainerRef } from '@react-navigation/native';

// follower-creator-attribution Slice 3 (link door) — a navigation ref so the
// deep-link handler in App.js (which lives OUTSIDE the NavigationContainer) can
// route an incoming inflx.in link to the right screen once navigation is ready.
export const navigationRef = createNavigationContainerRef();

// Navigate as soon as the container is ready (a cold-start deep link fires before
// the tree mounts). Retries briefly, then gives up quietly.
export function navigateWhenReady(name, params, tries = 25) {
  if (navigationRef.isReady()) {
    try { navigationRef.navigate(name, params); } catch (_) { /* route absent in this flavor */ }
    return;
  }
  if (tries <= 0) return;
  setTimeout(() => navigateWhenReady(name, params, tries - 1), 150);
}
