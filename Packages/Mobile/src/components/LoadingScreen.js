import React from 'react';
import { View, ActivityIndicator, Text } from 'react-native';
import { colors } from '../theme/tokens';

export default function LoadingScreen({ message = 'Loading...' }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
      <ActivityIndicator size="large" color={colors.navy} />
      <Text style={{ marginTop: 12, fontSize: 13, color: colors.t3, fontWeight: '500' }}>{message}</Text>
    </View>
  );
}
