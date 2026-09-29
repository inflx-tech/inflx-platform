/**
 * What she has seen and for how long (follower-app-v2 · rules v1.7 §5.14).
 *
 *   seen    a post at least half on screen for one second → one 'impression' per screen visit
 *           (this is what "never repeat" counts, 5.12)
 *   time    when it leaves the screen, how long it stayed → 'dwell' with dwell_ms (10 s, 30 s…)
 *
 * Wire the returned props into a FlatList. Nothing here ever blocks or breaks the screen.
 */
import { useEffect, useRef } from 'react';
import { track } from '../../services/events';

export const SEEN_CONFIG = { itemVisiblePercentThreshold: 50, minimumViewTime: 1000 };

export function useSeen(surface) {
  const since = useRef(new Map());     // post id → when it became visible
  const seen = useRef(new Set());

  const onViewableItemsChanged = useRef(({ changed }) => {
    const now = Date.now();
    for (const c of changed || []) {
      const id = c.item && c.item.id;
      if (!id) continue;
      if (c.isViewable) {
        if (!seen.current.has(id)) { seen.current.add(id); track('impression', id, surface, { position: c.index }); }
        since.current.set(id, now);
      } else if (since.current.has(id)) {
        const ms = now - since.current.get(id);
        since.current.delete(id);
        if (ms >= 1000) track('dwell', id, surface, { dwell_ms: ms, position: c.index });
      }
    }
  }).current;

  useEffect(() => () => {
    const now = Date.now();
    for (const [id, at] of since.current) if (now - at >= 1000) track('dwell', id, surface, { dwell_ms: now - at });
    since.current.clear();
  }, [surface]);

  return { viewabilityConfig: SEEN_CONFIG, onViewableItemsChanged };
}
