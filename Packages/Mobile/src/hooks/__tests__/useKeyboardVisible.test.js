import React from 'react';
import { Keyboard, Text } from 'react-native';
import { render, act } from '@testing-library/react-native';
import useKeyboardVisibleDefault, { useKeyboardVisible } from '../useKeyboardVisible';

/**
 * ui-walk-fixes — useKeyboardVisible(): true while the keypad is showing (boards B and C).
 * jest has no keypad, so the two events React Native sends are fired by hand.
 */
function Probe() {
  const visible = useKeyboardVisible();
  return <Text testID="probe">{visible ? 'typing' : 'at rest'}</Text>;
}

describe('useKeyboardVisible', () => {
  let handlers;
  let removed;
  let addSpy;

  beforeEach(() => {
    handlers = {};
    removed = [];
    addSpy = jest.spyOn(Keyboard, 'addListener').mockImplementation((event, fn) => {
      handlers[event] = fn;
      return { remove: () => removed.push(event) };
    });
  });
  afterEach(() => { jest.restoreAllMocks(); });

  const text = (r) => r.getByTestId('probe').props.children;

  it('starts false, turns true when the keypad has shown and false again when it has hidden', () => {
    const r = render(<Probe />);
    expect(text(r)).toBe('at rest');
    act(() => handlers.keyboardDidShow({ endCoordinates: { height: 280 } }));
    expect(text(r)).toBe('typing');
    act(() => handlers.keyboardDidHide());
    expect(text(r)).toBe('at rest');
  });

  it('listens to exactly the two "did" events, once each', () => {
    render(<Probe />);
    expect(addSpy.mock.calls.map(c => c[0]).sort()).toEqual(['keyboardDidHide', 'keyboardDidShow']);
  });

  it('removes both listeners when the screen goes away', () => {
    const r = render(<Probe />);
    expect(removed).toEqual([]);
    r.unmount();
    expect(removed.sort()).toEqual(['keyboardDidHide', 'keyboardDidShow']);
  });

  it('does not re-subscribe on every render', () => {
    const r = render(<Probe />);
    act(() => handlers.keyboardDidShow());
    r.rerender(<Probe />);
    expect(addSpy).toHaveBeenCalledTimes(2);
    expect(removed).toEqual([]);
  });

  it('a screen that mounts while the keypad is already up starts true', () => {
    jest.spyOn(Keyboard, 'isVisible').mockReturnValue(true);
    const r = render(<Probe />);
    expect(text(r)).toBe('typing');
  });

  it('survives a subscription with no remove(), and a Keyboard that cannot say whether it is visible', () => {
    addSpy.mockImplementation(() => undefined);
    jest.spyOn(Keyboard, 'isVisible').mockImplementation(() => { throw new Error('no native module'); });
    const r = render(<Probe />);
    expect(text(r)).toBe('at rest');
    expect(() => r.unmount()).not.toThrow();
  });

  it('is exported by name and as the default', () => {
    expect(useKeyboardVisibleDefault).toBe(useKeyboardVisible);
  });
});

describe('useKeyboardVisible with the real Keyboard module (safe under jest)', () => {
  it('mounts and unmounts without a native keypad', () => {
    const r = render(<Probe />);
    expect(r.getByTestId('probe').props.children).toBe('at rest');
    expect(() => r.unmount()).not.toThrow();
  });
});
