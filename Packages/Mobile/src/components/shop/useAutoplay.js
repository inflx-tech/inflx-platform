/**
 * Which video plays (follower-app-v2 · rules v1.7 §4.7): the first video on screen, only while this
 * screen is in front. Feeds play muted; Play uses her sound setting.
 */
import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { useSeen } from './useSeen';

export function useAutoplay(surface, posts) {
  const [visible, setVisible] = useState(() => new Set());
  const [focused, setFocused] = useState(true);
  const seenProps = useSeen(surface, setVisible);
  useFocusEffect(useCallback(() => { setFocused(true); return () => setFocused(false); }, []));
  const first = focused ? (posts || []).find((p) => p.media_kind === 'video' && visible.has(p.id)) : null;
  return { seenProps, playingId: first ? first.id : null, focused };
}
