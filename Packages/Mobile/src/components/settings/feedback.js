/**
 * Item 2 — the sticky Save bar, the toast (with optional Undo), the loading skeleton and
 * the "Couldn't load" state (B8). RN core only.
 * Contract: features/item2-pitch-invitation-settings · prompt §4, §5 B8
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { settingsTokens as T, fonts } from '../../theme/tokens';
import { PrimaryButton } from './primitives';
import { COPY, fixCount } from './copy';

/**
 * Sticky bottom bar. Grey when nothing changed or there are errors; the bar above it reads
 * "Fix N things above to save" while errors exist. Spinner + "Saving" while saving.
 */
export function SaveBar({ dirty, errorCount, saving, onSave, label }) {
  const disabled = !dirty || errorCount > 0;
  return (
    <View style={fb.bar} testID="save-bar">
      {errorCount > 0 ? <Text style={fb.fix} testID="save-bar-fix">{fixCount(errorCount)}</Text> : null}
      <PrimaryButton
        label={label || COPY.saveChanges}
        onPress={onSave}
        disabled={disabled}
        busy={saving}
        busyLabel={COPY.saving}
        testID="save-button"
      />
    </View>
  );
}

/** useToast() → { toast, show(message, { undo }) }. Render {toast} once near the root. */
export function useToast() {
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
    <Animated.View style={[fb.toast, { opacity }]} pointerEvents="box-none" testID="toast">
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
  bar: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: 14, paddingBottom: 22, backgroundColor: T.bg, borderTopWidth: 1, borderTopColor: T.border },
  fix: { fontFamily: fonts.sansSemiBold, fontSize: 12.5, color: T.danger, textAlign: 'center', marginBottom: 8 },
  toast: { position: 'absolute', left: 16, right: 16, bottom: 110, backgroundColor: T.ink, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  toastText: { color: '#FFFFFF', fontFamily: fonts.sansMedium, fontSize: 13.5, flex: 1 },
  toastUndo: { color: T.primary, fontFamily: fonts.sansBold, fontSize: 13.5, marginLeft: 14 },
  bone: { backgroundColor: T.surface, borderRadius: 10, marginBottom: 12 },
  err: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  errTitle: { fontFamily: fonts.sansBold, fontSize: 17, color: T.ink },
  errBody: { fontFamily: fonts.sansRegular, fontSize: 13.5, color: T.ink3, marginTop: 6, textAlign: 'center' },
});
