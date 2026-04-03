import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { colors, spacing, radius } from '../theme/tokens';

const CATEGORIES = [
  { key: 'all', label: 'All', emoji: '✨' },
  { key: 'dining', label: 'Dining', emoji: '🍽️' },
  { key: 'shopping', label: 'Shopping', emoji: '🛍️' },
  { key: 'booking', label: 'Booking', emoji: '📅' },
  { key: 'restaurant', label: 'Restaurants', emoji: '🍛' },
  { key: 'salon', label: 'Salons', emoji: '💇' },
  { key: 'florist', label: 'Florists', emoji: '🌹' },
  { key: 'bakery', label: 'Bakery', emoji: '🎂' },
];

export default function CategoryPills({ selected = 'all', onSelect }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.container}>
      {CATEGORIES.map(cat => {
        const isActive = selected === cat.key;
        return (
          <TouchableOpacity
            key={cat.key}
            style={[s.pill, isActive && s.pillActive]}
            onPress={() => onSelect?.(cat.key)}
          >
            <Text style={{ fontSize: 14 }}>{cat.emoji}</Text>
            <Text style={[s.pillText, isActive && s.pillTextActive]}>{cat.label}</Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, gap: 8 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.full,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pillActive: {
    backgroundColor: colors.orangePale,
    borderColor: colors.orange,
  },
  pillText: { fontSize: 12, fontWeight: '600', color: colors.t2 },
  pillTextActive: { color: colors.orangeDeep, fontWeight: '700' },
});
