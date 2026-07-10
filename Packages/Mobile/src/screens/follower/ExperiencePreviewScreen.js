import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, SafeAreaView } from 'react-native';
import { creatorVibe as C, fonts } from '../../theme/tokens';
import AdaptiveRenderer from '../../components/experience/AdaptiveRenderer';
import { SAMPLE_SPECS } from '../../components/experience/sampleSpecs';

/**
 * ExperiencePreviewScreen — Creator Experience Engine Phase 4b (dev/verification).
 * (contract: features/adaptive-renderer/).
 *
 * Proves the AdaptiveRenderer: one theme + one sample pack, drawn into each
 * layout the same engine (4a) resolved. Switch the layout → the same pack
 * re-draws, obeying each Layout Contract. No network — bundled sample specs.
 */
export default function ExperiencePreviewScreen({ navigation }) {
  const [idx, setIdx] = useState(0);
  const current = SAMPLE_SPECS[idx];
  const visible = current.spec.resolved.visible_slots;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation && navigation.goBack()} accessibilityLabel="Back">
          <Text style={styles.back}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.h1}>Experience Preview</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.sub}>One theme + one pack, drawn into any layout — obeying each Layout Contract.</Text>

        <Text style={styles.lbl}>THEME</Text>
        <View style={styles.themeChip}><Text style={styles.themeChipTxt}>👟 {current.spec.theme.title}</Text></View>

        <Text style={styles.lbl}>LAYOUT</Text>
        <View style={styles.switcher}>
          {SAMPLE_SPECS.map((s, i) => (
            <TouchableOpacity key={s.key} onPress={() => setIdx(i)} accessibilityLabel={`Layout ${s.label}`}
              style={[styles.tab, i === idx && styles.tabOn]}>
              <Text style={[styles.tabTxt, i === idx && styles.tabTxtOn]}>{s.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.stage}>
          <AdaptiveRenderer spec={current.spec} />
        </View>

        <Text style={styles.caption}>
          {current.label} · {current.spec.design.aspect_hint} · featured:{' '}
          {current.spec.resolved.featured_pick.aspect}
        </Text>
        <Text style={styles.slots}>shows: {visible.join(', ')}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.screenBg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.line, backgroundColor: C.card },
  back: { color: C.ink, fontSize: 15, fontWeight: '700' },
  h1: { color: C.ink, fontSize: 16, fontWeight: '800', fontFamily: fonts.serifDisplay },
  body: { padding: 16 },
  sub: { color: C.muted, fontSize: 12, marginBottom: 14, lineHeight: 17 },
  lbl: { color: C.muted, fontSize: 11, fontWeight: '800', letterSpacing: 0.4, marginTop: 8, marginBottom: 6 },
  themeChip: { alignSelf: 'flex-start', backgroundColor: C.ink, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  themeChipTxt: { color: '#fff', fontWeight: '800', fontSize: 12 },
  switcher: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tab: { borderWidth: 1, borderColor: C.line, backgroundColor: C.card, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7 },
  tabOn: { backgroundColor: C.gold, borderColor: C.gold },
  tabTxt: { color: C.muted, fontSize: 12, fontWeight: '700' },
  tabTxtOn: { color: C.onGold, fontWeight: '800' },
  stage: { marginTop: 16, marginBottom: 10 },
  caption: { color: C.muted, fontSize: 11, fontWeight: '700' },
  slots: { color: C.muted, fontSize: 11, marginTop: 3 },
});
