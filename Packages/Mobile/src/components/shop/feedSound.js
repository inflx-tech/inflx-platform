/**
 * The sound of the videos that play in a feed card (shopper-feed-sound-comments-sheet · board S1).
 *
 * Off when the app opens — a feed never starts talking. One button on the video turns it on or
 * off, and the choice then holds for every feed video until she changes it or closes the app: she
 * does not turn each video on in turn. It is kept in memory only, and it is NOT the sound setting
 * of the full-screen video feed (Play), which she sets there and which is remembered.
 */
import { useEffect, useState } from 'react';

let on = false;
const listeners = new Set();

export const feedSound = {
  isOn: () => on,
  set(next) {
    const value = !!next;
    if (value === on) return;
    on = value;
    for (const fn of [...listeners]) { try { fn(on); } catch { /* a closed screen */ } }
  },
  subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  /** Tests only: back to how the app opens. */
  _reset() { on = false; },
};

/** `[on, setOn]` — every card that is on a screen hears a change at once. */
export function useFeedSound() {
  const [value, setValue] = useState(on);
  useEffect(() => { setValue(on); return feedSound.subscribe(setValue); }, []);
  return [value, feedSound.set];
}
