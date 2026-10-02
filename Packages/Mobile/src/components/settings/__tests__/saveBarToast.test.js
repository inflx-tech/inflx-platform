import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { render, fireEvent, act } from '@testing-library/react-native';
import { SaveBar, useToast } from '../feedback';
import { FormArea, FormScroll } from '../../shell/FormScroll';
import { settingsTokens as T } from '../../../theme/tokens';

/**
 * ui-walk-fixes — board C, rule 1, for the eight "Save" screens, and the toast that goes with them.
 *
 * SaveBar was the shared floating bar: `position: 'absolute', bottom: 0`, riding up with the
 * keypad and sitting on the box being typed in. It is now a BottomBar — a strip in the layout.
 * The toast was parked 110 above the screen's bottom edge to clear that floating bar; a screen
 * with a strip in the layout asks for `useToast({ inFlow: true })` and draws the toast inside the
 * box above the strip. Every screen that does NOT ask keeps the old position exactly.
 */
let errorSpy;
beforeEach(() => {
  jest.useFakeTimers();
  errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  act(() => { jest.runOnlyPendingTimers(); });
  const said = errorSpy.mock.calls.map(args => args.map(String).join(' ').split('\n')[0]);
  errorSpy.mockRestore();
  jest.useRealTimers();
  expect(said).toEqual([]);
});

const flat = (node) => StyleSheet.flatten(node.props.style) || {};
const noop = () => {};

describe('SaveBar — a strip in the layout', () => {
  it('is never absolute and never pinned by left / right / bottom', () => {
    const { getByTestId } = render(<SaveBar dirty errorCount={0} saving={false} onSave={noop} />);
    const s = flat(getByTestId('save-bar'));
    expect(s.position).toBeUndefined();
    expect(s.bottom).toBeUndefined();
    expect(s.left).toBeUndefined();
    expect(s.right).toBeUndefined();
  });

  it('is the standard strip: hairline on top, 14 padding, white ground, children 8 apart', () => {
    const { getByTestId } = render(<SaveBar dirty errorCount={0} saving={false} onSave={noop} />);
    expect(flat(getByTestId('save-bar'))).toEqual({
      padding: 14, paddingBottom: 14, gap: 8, backgroundColor: T.bg, borderTopWidth: 1, borderTopColor: T.border,
    });
  });

  it('keeps its three testIDs, with the "Fix N things" line above the button', () => {
    const { getByTestId, toJSON } = render(<SaveBar dirty errorCount={2} saving={false} onSave={noop} />);
    expect(getByTestId('save-bar-fix').props.children).toBe('Fix 2 things above to save');
    expect(toJSON().props.testID).toBe('save-bar');
    expect(toJSON().children.map(c => c.props.testID)).toEqual(['save-bar-fix', 'save-button']);
    // The strip's own 8 gap separates the line from the button — the line adds none of its own.
    const line = flat(getByTestId('save-bar-fix'));
    expect(line.marginBottom).toBeUndefined();
    expect(line).toMatchObject({ color: T.danger, textAlign: 'center', fontSize: 12.5 });
  });

  it('one thing reads "Fix 1 thing above to save"; none draws no line at all', () => {
    const one = render(<SaveBar dirty errorCount={1} saving={false} onSave={noop} />);
    expect(one.getByTestId('save-bar-fix').props.children).toBe('Fix 1 thing above to save');
    const none = render(<SaveBar dirty errorCount={0} saving={false} onSave={noop} />);
    expect(none.queryByTestId('save-bar-fix')).toBeNull();
    expect(none.toJSON().children.map(c => c.props.testID)).toEqual(['save-button']);
  });

  it('the button is the plain full-width yellow main button, labelled "Save changes" unless told otherwise', () => {
    const { getByTestId, getByText, rerender } = render(<SaveBar dirty errorCount={0} saving={false} onSave={noop} />);
    getByText('Save changes');
    const { opacity, ...box } = flat(getByTestId('save-button'));
    expect(box).toEqual({ backgroundColor: T.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center' });
    rerender(<SaveBar dirty errorCount={0} saving={false} onSave={noop} label="Save branch" />);
    getByText('Save branch');
  });

  it('is off until something changed, off while anything needs fixing, on otherwise — and a press saves', () => {
    const onSave = jest.fn();
    const off = (r) => r.getByTestId('save-button').props.accessibilityState.disabled;
    const r = render(<SaveBar dirty={false} errorCount={0} saving={false} onSave={onSave} />);
    expect(off(r)).toBe(true);
    r.rerender(<SaveBar dirty errorCount={1} saving={false} onSave={onSave} />);
    expect(off(r)).toBe(true);
    r.rerender(<SaveBar dirty errorCount={0} saving={false} onSave={onSave} />);
    expect(off(r)).toBe(false);
    fireEvent.press(r.getByTestId('save-button'));
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it('reads "Saving" and cannot be pressed twice while it saves', () => {
    const onSave = jest.fn();
    const r = render(<SaveBar dirty errorCount={0} saving onSave={onSave} />);
    r.getByText(/Saving/);
    expect(r.getByTestId('save-button').props.accessibilityState.disabled).toBe(true);
    fireEvent.press(r.getByTestId('save-button'));
    expect(onSave).not.toHaveBeenCalled();
  });

  it('sits under the form in a screen\'s column: title, form, strip — in that order', () => {
    const { toJSON } = render(
      <View testID="screen" style={{ flex: 1 }}>
        <Text testID="title">Pitch settings</Text>
        <FormArea testID="area"><FormScroll testID="form"><Text>…</Text></FormScroll></FormArea>
        <SaveBar dirty errorCount={0} saving={false} onSave={noop} />
      </View>,
    );
    expect(toJSON().children.map(c => c.props.testID)).toEqual(['title', 'area', 'save-bar']);
  });
});

function Probe({ args = [], undo }) {
  const { toast, show } = useToast(...args);
  return (
    <View>
      <TouchableOpacity testID="go" onPress={() => show('Saved.', undo ? { undo } : undefined)}><Text>go</Text></TouchableOpacity>
      {toast}
    </View>
  );
}
const shown = (props) => {
  const r = render(<Probe {...props} />);
  expect(r.queryByTestId('toast')).toBeNull();
  fireEvent.press(r.getByTestId('go'));
  return r;
};

describe('useToast — where the toast floats', () => {
  it('by default: 110 above the bottom, exactly as before (every screen that was not converted)', () => {
    for (const args of [[], [undefined], [{}], [{ inFlow: false }], [null]]) {
      const r = shown({ args });
      const s = flat(r.getByTestId('toast'));
      expect(s).toMatchObject({ position: 'absolute', left: 16, right: 16, bottom: 110, backgroundColor: T.ink, borderRadius: 12 });
      r.unmount();
    }
  });

  it('`useToast({ inFlow: true })`: 16 above the bottom of the box it is drawn in — nothing else changes', () => {
    const r = shown({ args: [{ inFlow: true }] });
    const s = flat(r.getByTestId('toast'));
    expect(s).toMatchObject({ position: 'absolute', left: 16, right: 16, bottom: 16, backgroundColor: T.ink, borderRadius: 12 });
    r.getByText('Saved.');
  });

  it('still shows the message, goes away by itself, and offers Undo for longer', () => {
    const r = shown({ args: [{ inFlow: true }] });
    r.getByText('Saved.');
    expect(r.queryByTestId('toast-undo')).toBeNull();
    act(() => { jest.advanceTimersByTime(2600 + 400); });
    expect(r.queryByTestId('toast')).toBeNull();

    const undo = jest.fn();
    const u = shown({ args: [{ inFlow: true }], undo });
    act(() => { jest.advanceTimersByTime(3000); });
    expect(u.getByTestId('toast')).toBeTruthy();
    fireEvent.press(u.getByTestId('toast-undo'));
    expect(undo).toHaveBeenCalledTimes(1);
    act(() => { jest.advanceTimersByTime(400); });
    expect(u.queryByTestId('toast')).toBeNull();
  });

  it('drawn inside the FormArea it floats over the form, and the Save strip stays the last thing in the column', () => {
    function Screen() {
      const { toast, show } = useToast({ inFlow: true });
      return (
        <View testID="screen" style={{ flex: 1 }}>
          <FormArea testID="area">
            <FormScroll testID="form"><Text>…</Text></FormScroll>
            {toast}
          </FormArea>
          <SaveBar dirty errorCount={0} saving={false} onSave={() => show('Saved.')} />
        </View>
      );
    }
    const { getByTestId, toJSON } = render(<Screen />);
    fireEvent.press(getByTestId('save-button'));
    const [area, bar] = toJSON().children;
    expect(area.children.map(c => c.props.testID)).toEqual(['form', 'toast']);
    expect(bar.props.testID).toBe('save-bar');
    expect(flat(getByTestId('toast')).bottom).toBe(16);
  });
});
