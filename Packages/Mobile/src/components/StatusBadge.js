import React from 'react';
import { View, Text } from 'react-native';
import { colors } from '../theme/tokens';

const STATUS_COLORS = {
  draft:           { bg: colors.surface2, text: colors.t3 },
  pending_wallet:  { bg: colors.goldPale, text: '#7A5500' },
  published:       { bg: colors.navyPale, text: colors.navy },
  active:          { bg: colors.tealPale, text: colors.tealDeep },
  live:            { bg: colors.tealPale, text: colors.tealDeep },
  completed:       { bg: colors.navyPale, text: colors.navy },
  cancelled:       { bg: colors.redPale, text: colors.red },
  invited:         { bg: colors.goldPale, text: '#7A5500' },
  accepted:        { bg: colors.tealPale, text: colors.tealDeep },
  negotiating:     { bg: colors.orangePale, text: colors.orangeDeep },
  contracted:      { bg: colors.navyPale, text: colors.navy },
  declined:        { bg: colors.redPale, text: colors.red },
  expired:         { bg: colors.surface2, text: colors.t3 },
  pending:         { bg: colors.goldPale, text: '#7A5500' },
  submitted:       { bg: colors.navyPale, text: colors.navy },
  under_review:    { bg: colors.orangePale, text: colors.orangeDeep },
  revision_requested: { bg: colors.redPale, text: colors.red },
  approved:        { bg: colors.tealPale, text: colors.tealDeep },
  processing:      { bg: colors.orangePale, text: colors.orangeDeep },
  failed:          { bg: colors.redPale, text: colors.red },
  queued:          { bg: colors.goldPale, text: '#7A5500' },
  locked:          { bg: colors.navyPale, text: colors.navy },
  released:        { bg: colors.tealPale, text: colors.tealDeep },
  confirmed:       { bg: colors.tealPale, text: colors.tealDeep },
};

export default function StatusBadge({ status, size = 10 }) {
  const cfg = STATUS_COLORS[status] || { bg: colors.surface2, text: colors.t3 };
  return (
    <View style={{ backgroundColor: cfg.bg, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 }}>
      <Text style={{ fontSize: size, fontWeight: '700', color: cfg.text, textTransform: 'capitalize' }}>
        {(status || 'unknown').replace(/_/g, ' ')}
      </Text>
    </View>
  );
}
