import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { ig } from '../../theme/ig';
import { stageTrack } from '../../utils/campaignStages';

/* Campaign stage rail + primary action (features/brand-mobile-cc, A6).
   The mobile twin of the brand-web CommandRail — one obvious next step per
   stage, replacing the shifting conditional tile grid. */

export function StageRail({ current }) {
  const track = stageTrack(current);
  return (
    <View style={s.railWrap}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.railRow}>
        {track.map(st => (
          <View key={st.key} style={[s.chip, st.state === 'current' && s.chipCur]}>
            <Text style={[s.chipTxt, st.state === 'current' && s.chipTxtCur, st.state === 'done' && s.chipTxtDone]}>
              {st.label}{st.state === 'done' ? ' ✓' : ''}
            </Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

export function PrimeBar({ prime, onPress, busy, subtitle }) {
  const idle = !prime || prime.kind === 'none';
  if (idle) {
    return (
      <View style={s.calm}>
        <Text style={s.calmTxt}>{prime?.label || 'All caught up'}</Text>
      </View>
    );
  }
  return (
    <TouchableOpacity style={s.prime} onPress={onPress} disabled={busy} activeOpacity={0.85}>
      <View style={{ flex: 1 }}>
        <Text style={s.primeTitle}>{prime.label}</Text>
        {subtitle ? <Text style={s.primeSub}>{subtitle}</Text> : null}
      </View>
      {busy ? <ActivityIndicator color={ig.y} /> : <Text style={s.primeGo}>→</Text>}
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  railWrap: { borderWidth: 1, borderColor: ig.line, borderRadius: 11, padding: 4, marginBottom: 10 },
  railRow: { gap: 4 },
  chip: { paddingHorizontal: 11, paddingVertical: 7, borderRadius: 8 },
  chipCur: { backgroundColor: ig.text },
  chipTxt: { fontSize: 11.5, fontWeight: '700', color: ig.mut2 },
  chipTxtCur: { color: '#fff' },
  chipTxtDone: { color: ig.text },

  prime: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: ig.text, borderRadius: 12, padding: 14, marginBottom: 12 },
  primeTitle: { color: '#fff', fontSize: 14.5, fontWeight: '800' },
  primeSub: { color: 'rgba(255,255,255,0.65)', fontSize: 11.5, marginTop: 2 },
  primeGo: { color: ig.y, fontSize: 20, fontWeight: '800' },

  calm: { borderWidth: 1, borderColor: ig.line, borderRadius: 12, padding: 13, marginBottom: 12 },
  calmTxt: { fontSize: 13, fontWeight: '700', color: ig.mut, textAlign: 'center' },
});
