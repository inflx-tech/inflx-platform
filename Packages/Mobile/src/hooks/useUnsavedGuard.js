import { useEffect } from 'react';
import { Alert } from 'react-native';
import { COPY } from '../components/settings/copy';

/**
 * Item 2 (B8) — leaving a settings screen with unsaved changes asks "Discard changes?"
 * with Discard / Keep editing. Hooks into React Navigation's beforeRemove, so it covers
 * the back button, the header back arrow and a swipe back alike.
 * Contract: features/item2-pitch-invitation-settings
 */
export default function useUnsavedGuard(navigation, dirty) {
  useEffect(() => {
    if (!navigation || typeof navigation.addListener !== 'function') return undefined;
    const unsub = navigation.addListener('beforeRemove', (e) => {
      if (!dirty) return;
      e.preventDefault();
      Alert.alert(COPY.discardTitle, undefined, [
        { text: COPY.keepEditing, style: 'cancel' },
        { text: COPY.discard, style: 'destructive', onPress: () => navigation.dispatch(e.data.action) },
      ]);
    });
    return unsub;
  }, [navigation, dirty]);
}
