import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { creatorVibe as C, fonts } from '../../theme/tokens';

/**
 * CategoryCircle / CategoryRail — the "Browse by Category" row: a rounded-square
 * white tile with the vertical's emoji + a label, in a horizontal scroll. Matches
 * `.cat`/`.ci` in the comprehensive mockups (replaces the old square grid-wrap
 * CategoryGrid). An optional count badge shows live deal/listing counts when given.
 *
 * Item shape (section-engine nav): { key, label, icon, deal_count? }.
 */

export function CategoryCircle({ category, active, onPress }) {
  if (!category) return null;
  return (
    <TouchableOpacity style={styles.cat} onPress={onPress} activeOpacity={0.8}>
      <View style={[styles.tile, active && styles.tileActive]}>
        <Text style={styles.icon}>{category.icon || '•'}</Text>
        {category.deal_count > 0 && (
          <View style={styles.count}><Text style={styles.countTxt}>{category.deal_count}</Text></View>
        )}
      </View>
      <Text style={[styles.label, active && styles.labelActive]} numberOfLines={1}>{category.label}</Text>
    </TouchableOpacity>
  );
}

export function CategoryRail({ items, onPressCategory }) {
  if (!items || items.length === 0) return null;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
      {items.map((cat, i) => (
        <CategoryCircle key={cat.key || i} category={cat} onPress={() => onPressCategory?.(cat)} />
      ))}
    </ScrollView>
  );
}

export default CategoryCircle;

const styles = StyleSheet.create({
  rail: { paddingHorizontal: 16, paddingBottom: 4, gap: 14 },
  cat: { width: 64, alignItems: 'center', gap: 8 },
  tile: {
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: '#F1F1F1',
    alignItems: 'center', justifyContent: 'center',
  },
  tileActive: { backgroundColor: C.brown },
  icon: { fontSize: 25 },
  label: { fontSize: 10.5, fontWeight: '700', color: C.ink, fontFamily: fonts.sansBold },
  labelActive: { color: C.brown },
  count: {
    position: 'absolute', top: -4, right: -4,
    minWidth: 16, height: 16, borderRadius: 8, paddingHorizontal: 4,
    backgroundColor: C.offer, alignItems: 'center', justifyContent: 'center',
  },
  countTxt: { fontSize: 8, fontWeight: '900', color: '#fff', fontFamily: fonts.monoBold },
});
