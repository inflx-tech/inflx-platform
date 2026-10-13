/**
 * Which video plays (follower-app-v2 · rules v1.7 §4.7): the first video on screen, only while this
 * screen is in front. Feeds play muted; Play uses her sound setting. Only ever one.
 *
 * shopper-walk-fixes · V2 — the video that plays changes the moment a swipe lands. It used to hang
 * on the "seen" callback, whose one-second rule delays every change, so the old video sounded on
 * for a second or more. A list now carries TWO rules side by side:
 *
 *   seen   half on screen for one second → 'impression' and 'dwell' (useSeen, unchanged)
 *   play   half on screen, at once       → which video plays (here)
 *
 * FlatList refuses a new list of rules after it is drawn, so the pair is made once per screen.
 *
 * shopper-video-pauses-for-popup — `held`: something is open over the video on this same screen
 * (the products of a post, the sign-in prompt). Nothing plays while it is; the moment it closes the
 * same video carries on from where it stopped.
 *
 *   shownId    the video that is on screen and would play
 *   playingId  that video, or nothing while held — what a feed card needs
 *   held       for Play, which keeps the video "on" and holds it, so her own tap-pause is remembered
 */
import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { useSeen, SEEN_CONFIG } from './useSeen';

/** No waiting time: the answer is given the instant the item is half on screen. */
export const PLAY_CONFIG = { itemVisiblePercentThreshold: 50 };

const sameIds = (a, b) => a.size === b.size && [...a].every((id) => b.has(id));

export function useAutoplay(surface, posts, held = false) {
  const [visible, setVisible] = useState(() => new Set());
  const [focused, setFocused] = useState(true);
  const seen = useSeen(surface);
  const seenProps = useRef(null);
  if (!seenProps.current) {
    seenProps.current = {
      viewabilityConfigCallbackPairs: [
        { viewabilityConfig: SEEN_CONFIG, onViewableItemsChanged: seen.onViewableItemsChanged },
        {
          viewabilityConfig: PLAY_CONFIG,
          onViewableItemsChanged: ({ viewableItems }) => {
            const now = new Set((viewableItems || []).map((v) => v.item && v.item.id).filter(Boolean));
            setVisible((was) => (sameIds(was, now) ? was : now));
          },
        },
      ],
    };
  }
  useFocusEffect(useCallback(() => { setFocused(true); return () => setFocused(false); }, []));
  const first = focused ? (posts || []).find((p) => p.media_kind === 'video' && visible.has(p.id)) : null;
  const shownId = first ? first.id : null;
  return { seenProps: seenProps.current, shownId, held: !!held, playingId: held ? null : shownId, focused };
}
