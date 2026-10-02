/**
 * Item 2 — the Save bar, the toast (with optional Undo), the loading skeleton and
 * the "Couldn't load" state (B8). RN core only.
 * Contract: features/item2-pitch-invitation-settings · prompt §4, §5 B8
 * ui-walk-fixes board C: the Save bar is a strip in the layout (BottomBar); the toast can be
 * asked to float just above such a strip (`useToast({ inFlow: true })`).
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { settingsTokens as T, fonts } from '../../theme/tokens';
import { PrimaryButton } from './primitives';
import { BottomBar } from '../shell/BottomBar';
import { COPY, fixCount } from './copy';

/**
 * The Save strip. Grey when nothing changed or there are errors; the line above the button reads
 * "Fix N things above to save" while errors exist. Spinner + "Saving" while saving.
 *
 * ui-walk-fixes board C (rule 1): it is a BottomBar — a strip IN the layout, under the form,
 * never floating over it. Put it as the last thing in the screen's column, after the box that
 * holds the scrolling form:
 *   <View style={base.screen}><Header …/><FormArea><FormScroll …>…</FormScroll>{toast}</FormArea><SaveBar …/></View>
 * The form needs no bottom padding to clear it any more.
 */
export function SaveBar({ dirty, errorCount, saving, onSave, label }) {
  const disabled = !dirty || errorCount > 0;
  return (
    <BottomBar testID="save-bar">
      {errorCount > 0 ? <Text style={fb.fix} testID="save-bar-fix">{fixCount(errorCount)}</Text> : null}
      <PrimaryButton
        label={label || COPY.saveChanges}
        onPress={onSave}
        disabled={disabled}
        busy={saving}
        busyLabel={COPY.saving}
        testID="save-button"
      />
    </BottomBar>
  );
}

/**
 * useToast() → { toast, show(message, { undo }) }. Render {toast} once near the root.
 *
 * Where it floats. By default 110 above the bottom of whatever it is drawn in — the height that
 * cleared the old floating button bar when {toast} sat at the screen's root. That is unchanged.
 *
 * ui-walk-fixes board C — a screen whose button strip is now in the layout (BottomBar / SaveBar)
 * asks for `useToast({ inFlow: true })` and draws {toast} INSIDE the box above the strip (the
 * FormArea that holds the scrolling form), not at the screen's root. The toast then floats 16
 * above that box's bottom edge — just above the strip, however tall the strip is.
 */
export function useToast(options) {
  const inFlow = !!(options && options.inFlow);
  const [state, setState] = useState(null);
  const timer = useRef(null);
  const opacity = useRef(new Animated.Value(0)).current;

  const hide = useCallback(() => {
    Animated.timing(opacity, { toValue: 0, duration: 160, useNativeDriver: true }).start(() => setState(null));
  }, [opacity]);

  const show = useCallback((message, opts = {}) => {
    if (timer.current) clearTimeout(timer.current);
    setState({ message, undo: opts.undo || null });
    Animated.timing(opacity, { toValue: 1, duration: 160, useNativeDriver: true }).start();
    timer.current = setTimeout(hide, opts.undo ? 5000 : 2600);
  }, [hide, opacity]);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const toast = state ? (
    <Animated.View style={[fb.toast, inFlow && fb.toastInFlow, { opacity }]} pointerEvents="box-none" testID="toast">
      <Text style={fb.toastText}>{state.message}</Text>
      {state.undo ? (
        <TouchableOpacity onPress={() => { hide(); state.undo(); }} accessibilityRole="button" testID="toast-undo">
          <Text style={fb.toastUndo}>Undo</Text>
        </TouchableOpacity>
      ) : null}
    </Animated.View>
  ) : null;

  return { toast, show };
}

export function Skeleton({ rows = 6 }) {
  return (
    <View style={{ padding: 18 }} testID="skeleton">
      {Array.from({ length: rows }).map((_, i) => (
        <View key={i} style={[fb.bone, { width: i % 3 === 0 ? '55%' : '100%', height: i % 3 === 0 ? 14 : 44 }]} />
      ))}
    </View>
  );
}

export function LoadError({ onRetry }) {
  return (
    <View style={fb.err} testID="load-error">
      <Text style={fb.errTitle}>{COPY.loadErrorTitle}</Text>
      <Text style={fb.errBody}>{COPY.loadErrorBody}</Text>
      <View style={{ marginTop: 16, width: 160 }}>
        <PrimaryButton label={COPY.tryAgain} onPress={onRetry} testID="try-again" />
      </View>
    </View>
  );
}

const fb = StyleSheet.create({
  // The strip itself (hairline, padding, white ground, the 8 between the line and the button) is BottomBar's.
  fix: { fontFamily: fonts.sansSemiBold, fontSize: 12.5, color: T.danger, textAlign: 'center' },
  toast: { position: 'absolute', left: 16, right: 16, bottom: 110, backgroundColor: T.ink, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  // useToast({ inFlow: true }): drawn inside the box above an in-layout button strip.
  toastInFlow: { bottom: 16 },
  toastText: { color: '#FFFFFF', fontFamily: fonts.sansMedium, fontSize: 13.5, flex: 1 },
  toastUndo: { color: T.primary, fontFamily: fonts.sansBold, fontSize: 13.5, marginLeft: 14 },
  bone: { backgroundColor: T.surface, borderRadius: 10, marginBottom: 12 },
  err: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  errTitle: { fontFamily: fonts.sansBold, fontSize: 17, color: T.ink },
  errBody: { fontFamily: fonts.sansRegular, fontSize: 13.5, color: T.ink3, marginTop: 6, textAlign: 'center' },
});
