/**
 * SegmentedControl — surface background, the selected segment white (prompt §8).
 * Four segments must fit a 360-px phone without wrapping: equal flex, 11.5-px labels,
 * single line, no icons.
 */
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { settingsTokens as T, fonts } from '../../theme/tokens';

export default function SegmentedControl({ segments, value, onChange, testID }) {
  return (
    <View style={s.wrap} testID={testID}>
      {segments.map(seg => {
        const on = seg === value;
        return (
          <TouchableOpacity key={seg} style={[s.seg, on && s.segOn]} onPress={() => onChange(seg)} activeOpacity={0.8}
            accessibilityRole="tab" accessibilityState={{ selected: on }} testID={`segment-${seg}`}>
            <Text style={[s.label, on && s.labelOn]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>{seg}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flexDirection: 'row', backgroundColor: T.surface, borderRadius: 10, padding: 3 },
  seg: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  segOn: { backgroundColor: T.bg },
  label: { fontFamily: fonts.sansSemiBold, fontSize: 11.5, color: T.ink2 },
  labelOn: { color: T.ink },
});
