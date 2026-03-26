import React from 'react';
import { colors } from '../theme/tokens.js';

export default function ErrorMessage({ message, onRetry, className, style }) {
  if (!message) return null;

  if (typeof document !== 'undefined') {
    return (
      <div
        className={className}
        style={{
          backgroundColor: colors.redPale,
          border: `1px solid rgba(232,64,26,0.2)`,
          borderRadius: 8,
          padding: '10px 14px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          ...style,
        }}
      >
        <span style={{ fontSize: 12, color: colors.red, flex: 1 }}>{message}</span>
        {onRetry && (
          <button
            onClick={onRetry}
            style={{
              background: 'none', border: 'none',
              fontSize: 11, fontWeight: 700, color: colors.red,
              cursor: 'pointer', whiteSpace: 'nowrap',
            }}
          >
            Retry
          </button>
        )}
      </div>
    );
  }

  const { View, Text, TouchableOpacity } = require('react-native');
  return (
    <View style={{
      backgroundColor: colors.redPale,
      borderRadius: 8,
      padding: 12,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      ...style,
    }}>
      <Text style={{ fontSize: 12, color: colors.red, flex: 1 }}>{message}</Text>
      {onRetry && (
        <TouchableOpacity onPress={onRetry}>
          <Text style={{ fontSize: 11, fontWeight: '700', color: colors.red }}>Retry</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}
