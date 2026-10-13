import { useCallback, useEffect, useRef } from 'react';
import { Alert } from 'react-native';
import { COPY } from '../components/settings/copy';

/**
 * Item 2 (B8) — leaving a settings screen with unsaved changes asks "Discard changes?"
 * with Discard / Keep editing. Hooks into React Navigation's beforeRemove, so it covers
 * the back button, the header back arrow and a swipe back alike.
 * Contract: features/item2-pitch-invitation-settings
 *
 * creator-address-bank-save — it returns `saved()`. A screen that leaves straight after a save
 * calls it first. Telling the guard through state (`dirty && !done`) was too late: the screen
 * left in the same breath as the save finished, before the guard had heard, so Save itself was
 * asked "Discard changes?". `saved()` and `dirty` are both read at the moment of leaving.
 */
export default function useUnsavedGuard(navigation, dirty) {
  const dirtyNow = useRef(dirty);
  dirtyNow.current = dirty;
  const wasSaved = useRef(false);
  useEffect(() => {
    if (!navigation || typeof navigation.addListener !== 'function') return undefined;
    const unsub = navigation.addListener('beforeRemove', (e) => {
      if (wasSaved.current || !dirtyNow.current) return;
      e.preventDefault();
      Alert.alert(COPY.discardTitle, undefined, [
        { text: COPY.keepEditing, style: 'cancel' },
        { text: COPY.discard, style: 'destructive', onPress: () => navigation.dispatch(e.data.action) },
      ]);
    });
    return unsub;
  }, [navigation]);
  return useCallback(() => { wasSaved.current = true; }, []);
}
