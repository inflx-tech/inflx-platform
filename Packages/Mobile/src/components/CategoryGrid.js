import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { darkColors } from '../theme/tokens';

/**
 * CategoryGrid — 2x4 grid of super-categories with icon, label, and deal count badge.
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

export default function CategoryGrid({ categories, onPressCategory }) {
  const items = categories || DEFAULT_CATEGORIES;

  return (
    <View style={styles.grid}>
      {items.map(cat => (
        <TouchableOpacity
          key={cat.key}
          style={styles.item}
          onPress={() => onPressCategory?.(cat)}
          activeOpacity={0.8}
        >
          <Text style={styles.icon}>{cat.icon}</Text>
          <Text style={styles.label}>{cat.label}</Text>
          {cat.deal_count > 0 && (
            <View style={styles.countBadge}>
              <Text style={styles.countText}>{cat.deal_count}</Text>
            </View>
          )}
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 20,
    paddingBottom: 14,
    gap: 7,
  },
  item: {
    width: '23%', // ~4 columns with gap
    alignItems: 'center',
    gap: 2,
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderRadius: 14,
    backgroundColor: darkColors.card,
    borderWidth: 1,
    borderColor: darkColors.border,
    position: 'relative',
  },
  icon: {
    fontSize: 22,
  },
  label: {
    fontSize: 9,
    fontWeight: '600',
    color: darkColors.textSecondary,
  },
  countBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    minWidth: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: darkColors.amber,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  countText: {
    fontSize: 7,
    fontWeight: '800',
    color: '#000',
  },
});
