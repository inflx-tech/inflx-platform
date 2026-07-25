import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { ig } from '../../theme/ig';

/* Horizontal stage-filter tabs (IG-clean underline-active).
   features/collabs-list. Reusable across list screens. */
export default function StageTabs({ tabs, active, counts, onChange }) {
  return (
    <View style={styles.wrap}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {tabs.map(t => {
          const on = active === t.key;
          const n = counts ? counts[t.key] : null;
          return (
            <TouchableOpacity key={t.key} onPress={() => onChange(t.key)} style={styles.tab} activeOpacity={0.7}>
              <Text style={[styles.txt, on && styles.txtOn]}>
                {t.label}{n != null && n > 0 ? `  ${n}` : ''}
              </Text>
              <View style={[styles.underline, on && styles.underlineOn]} />
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { backgroundColor: ig.bg, borderBottomWidth: 1, borderBottomColor: ig.line },
  row:  { paddingHorizontal: 16, gap: 18 },
  tab:  { paddingTop: 11, alignItems: 'center' },
  txt:  { fontSize: 13, fontWeight: '600', color: ig.mut, paddingBottom: 9 },
  txtOn:{ color: ig.text, fontWeight: '700' },
  underline:   { height: 2, alignSelf: 'stretch', backgroundColor: 'transparent', borderRadius: 2 },
  underlineOn: { backgroundColor: ig.text },
});
