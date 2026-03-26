import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { colors } from '../theme/tokens';

export default function ErrorBanner({ message, onRetry }) {
  if (!message) return null;
  return (
    <View style={{ backgroundColor: colors.redPale, borderRadius: 12, padding: 12, flexDirection: 'row', alignItems: 'center', margin: 16 }}>
      <Text style={{ flex: 1, fontSize: 13, color: colors.red }}>{message}</Text>
      {onRetry && (
        <TouchableOpacity onPress={onRetry}>
          <Text style={{ fontSize: 12, fontWeight: '700', color: colors.red, marginLeft: 8 }}>Retry</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}
