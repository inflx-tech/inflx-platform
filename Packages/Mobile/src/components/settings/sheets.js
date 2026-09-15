/**
 * Item 2 — bottom sheets: the "Any or pick" list picker (B4), the confirm sheet
 * (B5 / C5 / X3 / X4) and the ⋯ action sheet. RN Modal only — nothing native.
 * Contract: features/item2-pitch-invitation-settings · prompt §5
 */

import React, { useMemo, useState } from 'react';
import { View, Text, Modal, TouchableOpacity, TextInput, FlatList, StyleSheet, Pressable } from 'react-native';
import { settingsTokens as T, fonts } from '../../theme/tokens';
import { PrimaryButton, SecondaryButton, DangerButton, InfoBox } from './primitives';
import { COPY } from './copy';

export function Sheet({ visible, onClose, children, testID }) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={sh.scrim} onPress={onClose} accessibilityLabel="Close" />
      <View style={sh.sheet} testID={testID}>{children}</View>
    </Modal>
  );
}

/**
 * B4 — Title · Clear · search · checkbox list · "Apply · N {noun}".
 * items: [{ code, label }]. value: array of codes or null (= Any).
 * Clear returns to Any. Apply hands back the chosen codes (or null when none).
 */
export function PickerSheet({ visible, title, hint, items, value, nounOne, nounMany, searchPlaceholder, onApply, onClose }) {
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(() => new Set(value || []));
  React.useEffect(() => { if (visible) { setSel(new Set(value || [])); setQ(''); } }, [visible]); // eslint-disable-line

  const shown = useMemo(() => {
    const n = q.trim().toLowerCase();
    return n ? items.filter(i => i.label.toLowerCase().includes(n)) : items;
  }, [items, q]);

  function toggle(code) {
    setSel(prev => { const s = new Set(prev); s.has(code) ? s.delete(code) : s.add(code); return s; });
  }
  const count = sel.size;
  const noun = count === 1 ? nounOne : nounMany;

  return (
    <Sheet visible={visible} onClose={onClose} testID="picker-sheet">
      <View style={sh.head}>
        <Text style={sh.title}>{title}</Text>
        <TouchableOpacity onPress={() => setSel(new Set())} accessibilityRole="button">
          <Text style={sh.clear}>{COPY.picker.clear}</Text>
        </TouchableOpacity>
      </View>
      <TextInput
        style={sh.search}
        value={q}
        onChangeText={setQ}
        placeholder={searchPlaceholder}
        placeholderTextColor={T.ink3}
        autoCorrect={false}
      />
      {hint ? <Text style={sh.hint}>{hint}</Text> : null}
      <FlatList
        data={shown}
        keyExtractor={i => i.code}
        style={{ maxHeight: 360 }}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => {
          const on = sel.has(item.code);
          return (
            <TouchableOpacity style={sh.optRow} onPress={() => toggle(item.code)} accessibilityRole="checkbox" accessibilityState={{ checked: !!on }}>
              <View style={[sh.box, on && sh.boxOn]}>{on ? <Text style={sh.tick}>✓</Text> : null}</View>
              <Text style={sh.optLabel}>{item.label}</Text>
            </TouchableOpacity>
          );
        }}
      />
      <View style={{ marginTop: 12 }}>
        <PrimaryButton
          label={COPY.picker.apply(count, noun)}
          onPress={() => onApply(count ? [...sel] : null)}
          testID="picker-apply"
        />
      </View>
    </Sheet>
  );
}

/**
 * Confirm sheet: title, body, optional info box, primary (or danger) + secondary.
 */
export function ConfirmSheet({ visible, title, body, info, confirmLabel, cancelLabel, danger, onConfirm, onCancel }) {
  return (
    <Sheet visible={visible} onClose={onCancel} testID="confirm-sheet">
      <Text style={sh.title}>{title}</Text>
      <Text style={sh.body}>{body}</Text>
      {info ? <InfoBox text={info} /> : null}
      <View style={{ height: 16 }} />
      {danger
        ? <DangerButton label={confirmLabel} onPress={onConfirm} testID="confirm-primary" />
        : <PrimaryButton label={confirmLabel} onPress={onConfirm} testID="confirm-primary" />}
      <SecondaryButton label={cancelLabel} onPress={onCancel} testID="confirm-secondary" />
    </Sheet>
  );
}

/** The ⋯ menu: a short list of actions, the last of which may be destructive. */
export function ActionSheet({ visible, actions, onClose }) {
  return (
    <Sheet visible={visible} onClose={onClose} testID="action-sheet">
      {actions.map(a => (
        <TouchableOpacity key={a.label} style={sh.action} onPress={() => { onClose(); a.onPress(); }} accessibilityRole="button">
          <Text style={[sh.actionText, a.destructive && { color: T.danger }]}>{a.label}</Text>
        </TouchableOpacity>
      ))}
      <SecondaryButton label="Cancel" onPress={onClose} />
    </Sheet>
  );
}

export const sh = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: 'rgba(26,26,23,0.45)' },
  sheet: { backgroundColor: T.bg, borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 18, paddingBottom: 28 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  title: { fontFamily: fonts.sansBold, fontSize: 17, color: T.ink },
  clear: { fontFamily: fonts.sansSemiBold, fontSize: 13, color: T.ink2 },
  body: { fontFamily: fonts.sansRegular, fontSize: 14, color: T.ink2, lineHeight: 20, marginTop: 8 },
  search: { fontFamily: fonts.sansRegular, borderWidth: 1, borderColor: T.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: T.ink, backgroundColor: T.surface },
  hint: { fontFamily: fonts.sansRegular, fontSize: 12, color: T.ink3, marginTop: 8, marginBottom: 4 },
  optRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: T.border },
  box: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: T.border, alignItems: 'center', justifyContent: 'center', marginRight: 12, backgroundColor: T.bg },
  boxOn: { backgroundColor: T.ink, borderColor: T.ink },
  tick: { color: '#FFFFFF', fontSize: 13, fontFamily: fonts.sansBold },
  optLabel: { fontFamily: fonts.sansMedium, fontSize: 14, color: T.ink, flex: 1 },
  action: { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: T.border },
  actionText: { fontFamily: fonts.sansSemiBold, fontSize: 15, color: T.ink },
});
