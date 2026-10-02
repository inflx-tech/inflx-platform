import { useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';

/**
 * Item 3 — a screen that finishes an action and goes back hands the toast to the screen it
 * returns to: `navigation.navigate('BrandBranches', { toast: 'Saved.' })`. The receiving
 * screen calls `useRouteToast(navigation, route, show)` and the message shows once.
 * Contract: features/item3-discovery-profiles-groups
 */
export default function useRouteToast(navigation, route, show) {
  useFocusEffect(useCallback(() => {
    const msg = route?.params?.toast;
    if (msg) {
      show(msg);
      if (navigation && typeof navigation.setParams === 'function') navigation.setParams({ toast: undefined });
    }
  }, [route?.params?.toast])); // eslint-disable-line
}

/**
 * ui-walk-fixes (board F, frame F8) — "go back, and say what just happened".
 *
 * A bare `goBack()` after an action leaves the screen underneath with nothing to say. This goes
 * back to the very same screen and hands it `toast`, which it shows if it calls useRouteToast.
 * Its other params are kept (merge). When the screen underneath cannot be read — nothing is under
 * this one, or the navigation object has no state — it is a plain goBack, as before.
 */
export function goBackWithToast(navigation, toast) {
  const state = navigation && typeof navigation.getState === 'function' ? navigation.getState() : null;
  const under = state && Array.isArray(state.routes) && state.index > 0 ? state.routes[state.index - 1] : null;
  if (under && under.key) navigation.navigate({ key: under.key, params: { toast }, merge: true });
  else navigation.goBack();
}
