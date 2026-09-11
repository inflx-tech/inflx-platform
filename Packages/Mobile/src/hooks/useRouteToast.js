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
