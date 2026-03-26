import React from 'react';
import { colors } from '../theme/tokens.js';

export default function EmptyState({ icon = '📭', title = 'Nothing here yet', message = '', action, actionLabel = 'Get started', style, className }) {
  if (typeof document !== 'undefined') {
    return (
      <div
        className={className}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '40px 24px',
          textAlign: 'center',
          ...style,
        }}
      >
        <div style={{ fontSize: 40, marginBottom: 12 }}>{icon}</div>
        <div style={{ fontSize: 15, fontWeight: 700, color: colors.t1, marginBottom: 6 }}>{title}</div>
        {message && <div style={{ fontSize: 12, color: colors.t3, maxWidth: 280, lineHeight: 1.6 }}>{message}</div>}
        {action && (
          <button
            onClick={action}
            style={{
              marginTop: 16,
              padding: '8px 20px',
              background: `linear-gradient(135deg, #E8401A, #F47920)`,
              border: 'none',
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 700,
              color: 'white',
              cursor: 'pointer',
            }}
          >
            {actionLabel}
          </button>
        )}
      </div>
    );
  }

  const { View, Text, TouchableOpacity } = require('react-native');
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', padding: 40, ...style }}>
      <Text style={{ fontSize: 40, marginBottom: 12 }}>{icon}</Text>
      <Text style={{ fontSize: 15, fontWeight: '700', color: colors.t1, marginBottom: 6, textAlign: 'center' }}>{title}</Text>
      {message ? <Text style={{ fontSize: 12, color: colors.t3, textAlign: 'center', lineHeight: 20 }}>{message}</Text> : null}
      {action ? (
        <TouchableOpacity onPress={action} style={{ marginTop: 16, backgroundColor: colors.orange, paddingHorizontal: 20, paddingVertical: 8, borderRadius: 8 }}>
          <Text style={{ fontSize: 12, fontWeight: '700', color: 'white' }}>{actionLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}
