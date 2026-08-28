import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Modal, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { ig } from '../../theme/ig';

/**
 * Saying no, with her own words.
 *
 * Contract: features/brief-straight-to-signing
 *
 * Founder, 2026-08-28, on replacing "accept the brief" with "sign or decline":
 *   *"your recommendations is fine...with clear remarks from creator"*
 *
 * WHY THIS IS A COMPONENT AND NOT COPIED INTO TWO SCREENS
 * She can now decline in two places — on the collab screen after reading the brief, and on the
 * contract screen at the moment she is asked to sign. Same decision, same five reasons, same
 * note, one API call.
 *
 * Copying it would be the fault this repo has already paid for three times: two offer
 * vocabularies, two offer-type normalisers, and the second step model deleted in Stage 3.
 * Two screens describing the same refusal in two ways is how they drift apart.
 */

/**
 * The five reasons the SERVER accepts. This list is not a suggestion — anything else is a 422.
 *
 * ⚠️ 'not_a_fit' was sent from the collab screen for months and was never one of them, so the
 * button failed every single time it was tapped. Keeping the list in one place is the only
 * reason that cannot happen twice.
 */
export const DECLINE_REASONS = ['not_relevant', 'fee_too_low', 'schedule_conflict', 'already_partnered', 'other'];

/**
 * Ask which of the reasons applies, then hand the key back so the caller can open the sheet.
 * @param {object}   o
 * @param {string}   o.payLabel  'Commission' or 'Fee' — she is told about the money she has
 * @param {string}   o.title     what the question is about
 * @param {function} o.onPick    called with one of DECLINE_REASONS
 */
export function askDeclineReason({ payLabel, title, onPick }) {
  Alert.alert(title || 'Pass on this?', 'This declines it. You can say why on the next screen.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Not a fit', style: 'destructive', onPress: () => onPick('not_relevant') },
    {
      text: payLabel === 'Commission' ? 'Commission too low' : 'Fee too low',
      style: 'destructive',
      onPress: () => onPick('fee_too_low'),
    },
    { text: 'Something else', style: 'destructive', onPress: () => onPick('other') },
  ]);
}

/**
 * @param {string|null} reason     the picked reason key; the sheet is open while it is set
 * @param {string}      brandName  she is told who reads this
 * @param {boolean}     busy
 * @param {function}    onCancel
 * @param {function}    onSubmit   (reason, note) — note may be ''
 * @param {string}      confirmLabel
 */
export default function DeclineSheet({ reason, brandName, busy, onCancel, onSubmit, confirmLabel }) {
  const [note, setNote] = useState('');

  function close() {
    setNote('');
    onCancel();
  }

  return (
    <Modal visible={!!reason} transparent animationType="slide" onRequestClose={close}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={s.scrim}
      >
        <View style={s.sheet}>
          <Text style={s.t}>Anything you want to add?</Text>
          {/* Optional on purpose. Making her explain herself before she may say no would be the
              platform taking the brand's side. */}
          <Text style={s.sub}>
            {brandName || 'The brand'} sees this. A line about what did not work helps them fix it
            and come back — or just leave it blank.
          </Text>
          <TextInput
            style={s.input}
            value={note}
            onChangeText={setNote}
            placeholder="e.g. the store is too far for me to travel"
            placeholderTextColor={ig.mut2}
            multiline
            maxLength={1000}
            autoFocus
          />
          <TouchableOpacity
            style={[s.btn, s.btnPri]}
            disabled={busy}
            onPress={() => onSubmit(reason, note.trim())}
          >
            <Text style={s.btnPriT}>{busy ? 'Sending…' : (confirmLabel || 'Pass on this')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.btn} disabled={busy} onPress={close}>
            <Text style={s.btnT}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// The exact values this sheet had while it lived inside CollabDetailScreen. Moving a component
// should change where the code is, never what the creator sees.
const s = StyleSheet.create({
  scrim:  { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet:  { backgroundColor: ig.bg, borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 16, paddingBottom: 26, gap: 8 },
  t:      { fontSize: 15.5, fontWeight: '800', color: ig.text },
  sub:    { fontSize: 12, fontWeight: '650', color: ig.mut, lineHeight: 17, marginBottom: 4 },
  input:  { borderWidth: 1, borderColor: ig.line, borderRadius: 10, padding: 12, fontSize: 13, color: ig.text, minHeight: 88, textAlignVertical: 'top' },
  btn:    { borderRadius: 10, paddingVertical: 12, alignItems: 'center', borderWidth: 1, borderColor: ig.line },
  btnT:   { fontSize: 12.5, fontWeight: '800', color: ig.mut },
  btnPri: { backgroundColor: ig.text, borderColor: ig.text },
  btnPriT:{ fontSize: 12.5, fontWeight: '800', color: ig.bg },
});
