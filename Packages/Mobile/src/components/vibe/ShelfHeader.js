import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { creatorVibe as C, fonts } from '../../theme/tokens';

/**
 * ShelfHeader — the shelf title block above every rail: serif title + sub-line,
 * a count badge, an optional item-type tag (BRANDS / PRODUCTS / OFFERS / MIXED),
 * and an optional "See all". Matches the `.sh` block in the comprehensive mockups.
 * Renders nothing without a title (defensive).
 *
 * Props: title, sub, count, tag ('brands'|'products'|'offers'|'mixed'|'creators'),
 *        onSeeAll
 */

const TAG_LABEL = {
  brands: 'BRANDS', products: 'PRODUCTS', offers: 'OFFERS',
  mixed: 'MIXED', creators: 'CREATORS', nav_tiles: 'CATEGORIES',
};
const TAG_COLOR = {
  brands: C.brown, products: '#3F8A57', offers: C.offer,
  mixed: '#3F8A57', creators: C.brown, nav_tiles: C.brown,
};

export default function ShelfHeader({ title, sub, count, tag, onSeeAll }) {
  if (!title) return null;
  const tagKey = tag && TAG_LABEL[tag] ? tag : null;
  return (
    <View style={styles.row}>
      <View style={styles.left}>
        <Text style={styles.title} numberOfLines={1}>{title}</Text>
        {sub ? <Text style={styles.sub} numberOfLines={1}>{sub}</Text> : null}
      </View>
      <View style={styles.right}>
        {tagKey && (
          <View style={[styles.tag, { backgroundColor: TAG_COLOR[tagKey] }]}>
            <Text style={styles.tagTxt}>{TAG_LABEL[tagKey]}</Text>
          </View>
        )}
        {count != null && Number(count) > 0 && (
          <View style={styles.count}><Text style={styles.countTxt}>{count}</Text></View>
        )}
        {onSeeAll && (
          <TouchableOpacity onPress={onSeeAll}><Text style={styles.more}>See all →</Text></TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between',
    paddingHorizontal: 18, paddingTop: 18, paddingBottom: 11, gap: 8,
  },
  left: { flex: 1, minWidth: 0 },
  title: { fontSize: 16, fontWeight: '800', color: C.ink, letterSpacing: -0.3, fontFamily: fonts.serifDisplay },
  sub: { fontSize: 10, color: C.muted, fontWeight: '600', marginTop: 2, fontFamily: fonts.sansSemiBold },
  right: { flexDirection: 'row', alignItems: 'center', gap: 5, flexShrink: 0 },
  tag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  tagTxt: { fontSize: 8, fontWeight: '800', color: '#fff', letterSpacing: 0.5, fontFamily: fonts.monoBold },
  count: {
    backgroundColor: C.soft, borderWidth: 1, borderColor: C.line,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20,
  },
  countTxt: { fontSize: 9, fontWeight: '800', color: C.brown, fontFamily: fonts.monoBold },
  more: { fontSize: 12, fontWeight: '800', color: C.brown, fontFamily: fonts.sansBold },
});
