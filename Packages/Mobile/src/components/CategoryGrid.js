import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { brandPalette as P, getBusinessAccentLight, fonts } from '../theme/tokens';

/**
 * CategoryGrid — grid of super-categories with icon, label, and deal count badge.
 *
 * Flow 38 (F0) restyle (2026-05-27): light brandPalette tiles. Each tile uses
 * a per-business pale tint (wayfinding only) mapped from its category key; the
 * label + count badge stay ink/yellow brand. Falls back to yellowPale for keys
 * without a focus-vertical accent.
 */

const DEFAULT_CATEGORIES = [
  { key: 'eat',     icon: '🍽️', label: 'Eat' },
  { key: 'shop',    icon: '🛍️', label: 'Shop' },
  { key: 'groom',   icon: '✨',  label: 'Groom' },
  { key: 'fitness', icon: '💪',  label: 'Fitness' },
  { key: 'travel',  icon: '✈️', label: 'Travel' },
  { key: 'home',    icon: '🏠',  label: 'Home' },
  { key: 'events',  icon: '🎉',  label: 'Events' },
  { key: 'all',     icon: '•••', label: 'All' },
];

// Map super-category keys → the focus-vertical accent key (for the pale tint).
const SUPERCAT_ACCENT = {
  eat: 'restaurant',
  shop: 'fashion',
  fashion: 'fashion',
  groom: 'salon',
  beauty: 'salon',
  cars: 'car_rental',
  car: 'car_rental',
  travel: 'car_rental',
};

export default function CategoryGrid({ categories, onPressCategory }) {
  const items = categories || DEFAULT_CATEGORIES;

  return (
    <View style={styles.grid}>
      {items.map(cat => {
        const accentKey = SUPERCAT_ACCENT[cat.key] || cat.key;
        const tint = getBusinessAccentLight(accentKey).pale;
        return (
          <TouchableOpacity
            key={cat.key}
            style={styles.item}
            onPress={() => onPressCategory?.(cat)}
            activeOpacity={0.8}
          >
            <View style={[styles.tile, { backgroundColor: tint }]}>
              <Text style={styles.icon}>{cat.icon}</Text>
            </View>
            <Text style={styles.label}>{cat.label}</Text>
            {cat.deal_count > 0 && (
              <View style={styles.countBadge}>
                <Text style={styles.countText}>{cat.deal_count}</Text>
              </View>
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 10,
  },
  item: {
    width: '22%',
    alignItems: 'center',
    gap: 6,
    position: 'relative',
  },
  tile: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: P.border,
  },
  icon: { fontSize: 26 },
  label: {
    fontSize: 9,
    fontWeight: '800',
    color: P.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.2,
    fontFamily: fonts.monoBold,
  },
  countBadge: {
    position: 'absolute',
    top: 4,
    right: '14%',
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: P.ink,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  countText: { fontSize: 8, fontWeight: '900', color: P.yellow, fontFamily: fonts.monoBold },
});
