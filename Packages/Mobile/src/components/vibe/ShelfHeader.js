import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { creatorVibe as C, fonts } from '../../theme/tokens';

/**
 * ShelfHeader — the shelf title block above every rail: title + optional sub-line
 * and a "View all" link. Matches the `.sechead` block in the recolored mockups
 * (Phase 5b: the colored item-type tag + count pill were dropped for the cleaner
 * locked look). Renders nothing without a title (defensive).
 *
 * Props: title, sub, count (accepted but no longer rendered — kept for call-site
 *        compatibility), tag (likewise accepted/ignored), onSeeAll
 */

export default function ShelfHeader({ title, sub, onSeeAll }) {
  if (!title) return null;
  return (
    <View style={styles.row}>
      <View style={styles.left}>
        <Text style={styles.title} numberOfLines={1}>{title}</Text>
        {sub ? <Text style={styles.sub} numberOfLines={1}>{sub}</Text> : null}
      </View>
      {onSeeAll && (
        <TouchableOpacity onPress={onSeeAll} hitSlop={8}><Text style={styles.more}>View all</Text></TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between',
    paddingHorizontal: 18, paddingTop: 18, paddingBottom: 11, gap: 8,
  },
  left: { flex: 1, minWidth: 0 },
  title: { fontSize: 17, fontWeight: '800', color: C.ink, letterSpacing: -0.3, fontFamily: fonts.serifDisplay },
  sub: { fontSize: 10, color: C.muted, fontWeight: '600', marginTop: 2, fontFamily: fonts.sansSemiBold },
  more: { fontSize: 13, fontWeight: '700', color: C.goldDeep, flexShrink: 0, fontFamily: fonts.sansBold },
});
