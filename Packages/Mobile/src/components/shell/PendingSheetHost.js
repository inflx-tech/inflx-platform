/**
 * PendingSheetHost — B2b: when any request answers 403 ACCOUNT_PENDING / ACCOUNT_REJECTED,
 * the server's own words are shown in a bottom sheet instead of an error toast:
 * "Your account is under review" · the message · "A complete profile gets reviewed faster."
 * · Finish my profile / OK. Mounted once per navigator (brand and creator); subscribes to
 * api.onAccountGate. One sheet per event — duplicates while it is open are ignored.
 * Contract: features/registration-and-profile
 */
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { settingsTokens as T, fonts } from '../../theme/tokens';
import { onAccountGate } from '../../services/api';
import { Sheet, sh } from '../settings/sheets';
import { PrimaryButton, SecondaryButton } from '../settings/primitives';
import { navigationRef } from '../../navigation/navRef';

export const GATE_COPY = {
  pendingTitle: 'Your account is under review',
  rejectedTitle: 'Your account needs a fix',
  suspendedTitle: 'Your account is suspended',
  note: 'A complete profile gets reviewed faster.',
  finish: 'Finish my profile',
  ok: 'OK',
};

function titleFor(event) {
  const code = event && event.code;
  if (code === 'ACCOUNT_REJECTED') return GATE_COPY.rejectedTitle;
  if (code === 'ACCOUNT_SUSPENDED') return GATE_COPY.suspendedTitle;
  return GATE_COPY.pendingTitle;
}

export default function PendingSheetHost({ navigate }) {
  const [event, setEvent] = useState(null);
  const open = useRef(false);

  useEffect(() => onAccountGate((e) => {
    if (open.current) return;          // one sheet at a time — a burst of 403s is one message
    open.current = true;
    setEvent(e);
  }), []);

  function close() { open.current = false; setEvent(null); }
  function finish() {
    close();
    if (typeof navigate === 'function') { navigate('ProfileTab'); return; }
    if (navigationRef && navigationRef.isReady && navigationRef.isReady()) {
      try { navigationRef.navigate('ProfileTab'); } catch (_) { /* no ProfileTab in this flavor */ }
    }
  }

  return (
    <Sheet visible={!!event} onClose={close} testID="pending-sheet">
      <Text style={sh.title}>{titleFor(event)}</Text>
      <Text style={sh.body} testID="pending-sheet-message">{event ? event.message : ''}</Text>
      <View style={s.green}><Text style={s.greenText}>{GATE_COPY.note}</Text></View>
      <View style={{ height: 16 }} />
      <PrimaryButton label={GATE_COPY.finish} onPress={finish} testID="pending-sheet-finish" />
      <SecondaryButton label={GATE_COPY.ok} onPress={close} testID="pending-sheet-ok" />
    </Sheet>
  );
}

const s = StyleSheet.create({
  green: { backgroundColor: T.state.active.bg, borderRadius: 10, padding: 12, marginTop: 12 },
  greenText: { fontFamily: fonts.sansMedium, fontSize: 12.5, color: T.state.active.fg, lineHeight: 18 },
});
