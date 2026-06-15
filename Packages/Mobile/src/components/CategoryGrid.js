import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { creatorVibe as C, getBusinessAccentLight, fonts } from '../theme/tokens';

// Flow 52.1 — Creator Vibe recolor shim (see ProductCard). Visual only.
const P = {
  white: C.card, card: C.card, bg2: C.soft,
  border: C.line, ink: C.ink,
  muted: C.muted, muted2: C.muted, muted3: C.muted,
  yellow: C.star, yellowText: C.brown, yellowPale: C.soft,
  success: C.verify, danger: C.offer,
};

/**
 * CategoryGrid — grid of super-categories with icon, label, and deal count badge.
 *
 * Flow 38 (F0) restyle (2026-05-27): light brandPalette tiles. Each tile uses
 * a per-business pale tint (wayfinding only) mapped from its category key; the
 * label + count badge stay ink/yellow brand. Falls back to yellowPale for keys
 * without a focus-vertical accent.
 */

// Offline fallback ONLY — the real tiles come from /follower/categories (the
// admin follower_categories table; contract 2.5a). Kept in sync with the 5 launch
// tiles so a rare API-down render still matches reality.
const DEFAULT_CATEGORIES = [
  { key: 'fashion',    icon: '👗', label: 'Fashion' },
  { key: 'furniture',  icon: '🛋️', label: 'Furniture' },
  { key: 'food',       icon: '🍽️', label: 'Food' },
  { key: 'beauty',     icon: '✨', label: 'Beauty' },
  { key: 'car_rental', icon: '🚗', label: 'Car Rentals' },
];

// Map super-category keys → the focus-vertical accent key (for the pale tint).
// Includes the 5 launch-tile keys + legacy keys (back-compat during transition).
const SUPERCAT_ACCENT = {
  fashion: 'fashion',
  furniture: 'furniture',
  food: 'restaurant',
  beauty: 'salon',
  car_rental: 'car_rental',
  // legacy keys (still resolve if an old payload arrives)
  eat: 'restaurant',
  shop: 'fashion',
  groom: 'salon',
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
