/**
 * useKeyboardVisible() → true while the keypad is showing.
 * Contract: features/ui-walk-fixes · board B ("the footer hides while typing") and board C
 *
 * For the few places that must change WHAT they draw while someone is typing (a footer that
 * steps away, a list that takes the freed room). It is not needed to keep a field visible — an
 * in-flow BottomBar and a `fit` Sheet do that by layout alone.
 *
 * Android tells the app after the window has already resized, so anything keyed on this flips a
 * frame or two after the keypad starts to open. Whether the events also arrive while the keypad
 * belongs to a pop-up (a Modal is its own window) has not been proved on a phone — do not make a
 * Sheet's layout depend on it.
 *
 * Call it at the top of a component, above any early `return`.
 */
import { useEffect, useState } from 'react';
import { Keyboard } from 'react-native';

function showingNow() {
  try {
    return typeof Keyboard.isVisible === 'function' ? !!Keyboard.isVisible() : false;
  } catch (e) {
    return false;
  }
}

export function useKeyboardVisible() {
  const [visible, setVisible] = useState(showingNow);

  useEffect(() => {
    const subs = [
      Keyboard.addListener('keyboardDidShow', () => setVisible(true)),
      Keyboard.addListener('keyboardDidHide', () => setVisible(false)),
    ];
    return () => {
      subs.forEach((sub) => { if (sub && typeof sub.remove === 'function') sub.remove(); });
    };
  }, []);

  return visible;
}

export default useKeyboardVisible;
