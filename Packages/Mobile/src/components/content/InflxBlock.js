/**
 * post-engagement-stats — the "In INFLX" block on both Post stats screens (C4, B4) and the one line
 * on Post status and the brand's Set posts row (C3, B3). Eight boxes for a video, seven for a photo;
 * the comments box is the door to the Comments screen.
 * Contract: features/post-engagement-stats · rules §4.15 · board v1 (locked 26 Oct 2026)
 */
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { settingsTokens as T, fonts } from '../../theme/tokens';
import { indian } from './copyStats';
import { INFLX, inflxLine } from './copyInflx';

function Box({ value, label, onPress, testID }) {
  const inner = (
    <>
      <Text style={k.v}>{indian(value)}{onPress ? ' ›' : ''}</Text>
      <Text style={k.l}>{label}</Text>
    </>
  );
  if (onPress) return <TouchableOpacity style={[k.box, k.door]} onPress={onPress} testID={testID}>{inner}</TouchableOpacity>;
  return <View style={k.box} testID={testID}>{inner}</View>;
}

/** The block: header, two rows of boxes, the hint. `n` is the stats payload's `inflx`. */
export function InflxBlock({ n, onComments, testID = 'inflx-block' }) {
  if (!n) return null;
  const row2 = [[n.saves, INFLX.saves, 'saves'], [n.shop_taps, INFLX.shopTaps, 'shop-taps'], [n.bag_adds, INFLX.bagAdds, 'bag-adds']];
  if (n.finished != null) row2.push([n.finished, INFLX.finished, 'finished']);
  return (
    <View style={k.wrap} testID={testID}>
      <Text style={k.h}>{INFLX.header}</Text>
      <View style={k.row}>
        <Box value={n.views} label={INFLX.views} testID="inflx-views" />
        <Box value={n.likes} label={INFLX.likes} testID="inflx-likes" />
        <Box value={n.comments} label={INFLX.comments} onPress={onComments} testID="inflx-comments" />
        <Box value={n.shares} label={INFLX.shares} testID="inflx-shares" />
      </View>
      <View style={k.row}>
        {row2.map(([v, label, id]) => <Box key={id} value={v} label={label} testID={`inflx-${id}`} />)}
        {row2.length < 4 ? <View style={k.spacer} /> : null}
      </View>
      <Text style={k.hint} testID="inflx-hint">{INFLX.hint(n.since)}</Text>
    </View>
  );
}

/** The one line (C3, B3): bold "In INFLX" and the three numbers; grey "nothing yet" when there are none. */
export function InflxLine({ three, style, testID = 'inflx-line' }) {
  const line = inflxLine(three);
  if (!line) return null;
  return <Text style={[k.line, line.empty ? k.empty : null, style]} testID={testID}>{line.text}</Text>;
}

const k = StyleSheet.create({
  wrap: { marginTop: 14 },
  h: { fontFamily: fonts.sansBold, fontSize: 13, color: T.ink, marginBottom: 8 },
  row: { flexDirection: 'row', gap: 6, marginBottom: 6 },
  box: { flex: 1, backgroundColor: T.surface, borderRadius: 10, paddingVertical: 7, paddingHorizontal: 8, minHeight: 46 },
  door: { backgroundColor: T.bg, borderWidth: 1.5, borderColor: T.ink },
  spacer: { flex: 1 },
  v: { fontFamily: fonts.sansBold, fontSize: 14.5, color: T.ink },
  l: { fontFamily: fonts.sansRegular, fontSize: 10.5, color: T.ink2, marginTop: 1 },
  hint: { fontFamily: fonts.sansRegular, fontSize: 11.5, color: T.ink2, lineHeight: 16, marginTop: 2 },
  line: { fontFamily: fonts.sansRegular, fontSize: 12, color: T.ink, marginTop: 4 },
  empty: { color: T.ink3 },
});

export default InflxBlock;
