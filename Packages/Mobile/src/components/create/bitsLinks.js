/**
 * The link screens' shared parts: a Copy button that says "Copied", a link row (Copy + the phone's
 * Share sheet), and the code box.
 * Contract: features/post-links-codes · boards L2, L5
 */
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, Share, StyleSheet } from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import { settingsTokens as T, fonts } from '../../theme/tokens';
import { CL } from './copyLinks';

export function CopyButton({ text, testID, big }) {
  const [done, setDone] = useState(false);
  const timer = useRef(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  function copy() {
    Clipboard.setString(String(text || ''));
    setDone(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setDone(false), 2000);
  }
  return (
    <TouchableOpacity onPress={copy} style={[k.cp, done && k.cpDone, big && { alignSelf: 'center' }]} testID={testID} accessibilityRole="button">
      <Text style={[k.cpText, done && k.cpTextDone]}>{done ? CL.copied : CL.copy}</Text>
    </TouchableOpacity>
  );
}

export function LinkRow({ label, display, url, note, testID }) {
  return (
    <View style={k.row} testID={testID}>
      <TouchableOpacity style={{ flex: 1, minWidth: 0 }} onLongPress={() => Share.share({ message: url })} onPress={() => Share.share({ message: url })} accessibilityHint="Opens the phone's share sheet">
        <Text style={k.label}>{label}</Text>
        <Text style={k.url} numberOfLines={1}>{display}</Text>
        {note ? <Text style={k.note}>{note}</Text> : null}
      </TouchableOpacity>
      <CopyButton text={url} testID={testID ? `${testID}-copy` : undefined} />
    </View>
  );
}

export function CodeBox({ code, hint, testID }) {
  return (
    <View style={k.codebox} testID={testID}>
      <Text style={k.eyebrow}>{CL.postCode}</Text>
      <Text style={k.code}>{code}</Text>
      <CopyButton text={code} big testID="copy-code" />
      {hint ? <Text style={k.hint}>{hint}</Text> : null}
    </View>
  );
}

export const k = StyleSheet.create({
  cp: { borderWidth: 1.5, borderColor: T.ink, borderRadius: 9, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: T.bg },
  cpDone: { backgroundColor: T.state.active.bg, borderColor: T.state.active.bg },
  cpText: { fontFamily: fonts.sansBold, fontSize: 11.5, color: T.ink },
  cpTextDone: { color: T.state.active.fg },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: T.border },
  label: { fontFamily: fonts.sansBold, fontSize: 12.5, color: T.ink },
  url: { fontFamily: fonts.mono || fonts.sansRegular, fontSize: 11, color: T.ink2, marginTop: 1 },
  note: { fontFamily: fonts.sansRegular, fontSize: 10.5, color: T.ink3, marginTop: 1 },
  codebox: { borderWidth: 1.5, borderColor: T.ink, borderRadius: 14, padding: 12, alignItems: 'center', marginBottom: 12 },
  eyebrow: { fontFamily: fonts.sansBold, fontSize: 11, color: T.ink2, letterSpacing: 0.8 },
  code: { fontFamily: fonts.mono || fonts.sansBold, fontSize: 30, fontWeight: '700', letterSpacing: 5, color: T.ink, marginVertical: 6 },
  hint: { fontFamily: fonts.sansRegular, fontSize: 11.5, color: T.ink2, textAlign: 'center', marginTop: 8, lineHeight: 16 },
  capline: { backgroundColor: T.surface, borderRadius: 12, padding: 10, marginBottom: 6 },
  caplineText: { fontFamily: fonts.sansRegular, fontSize: 12.5, color: T.ink },
});
