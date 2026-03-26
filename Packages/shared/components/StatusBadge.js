import React from 'react';
import { statusColors, colors } from '../theme/tokens.js';

/**
 * StatusBadge — coloured pill for campaign/offer/order statuses
 * Works in both web and React Native
 */
export default function StatusBadge({ status, label, className, style }) {
  const config = statusColors[status] || statusColors['draft'];

  const displayLabel = label || (status ? status.replace(/_/g, ' ') : 'unknown');

  if (typeof document !== 'undefined') {
    // Web
    return (
      <span
        className={className}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          padding: '2px 8px',
          borderRadius: 9999,
          fontSize: 10,
          fontWeight: 700,
          backgroundColor: config.bg,
          color: config.text,
          border: `1px solid ${config.border}`,
          textTransform: 'capitalize',
          whiteSpace: 'nowrap',
          ...style,
        }}
      >
        {displayLabel}
      </span>
    );
  }

  // React Native
  const { View, Text } = require('react-native');
  return (
    <View style={{
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 9999,
      backgroundColor: config.bg,
      borderWidth: 1,
      borderColor: config.border,
      ...style,
    }}>
      <Text style={{
        fontSize: 10,
        fontWeight: '700',
        color: config.text,
        textTransform: 'capitalize',
      }}>
        {displayLabel}
      </Text>
    </View>
  );
}
