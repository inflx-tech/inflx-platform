/**
 * Discover — "Coming soon" until the founder explains how admin designs it (rules v1.7 §5.13, O9).
 * Contract: features/follower-app-v2
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CS } from '../../components/shop/copyShop';
import { TopBar, C } from '../../components/shop/bitsShop';
import { fonts } from '../../theme/tokens';

export default function DiscoverScreen({ navigation }) {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }} edges={['top']}>
      <TopBar title={CS.discover} onSearch={() => navigation.navigate('Search')} />
      <View style={st.soon} testID="discover-soon">
        <View style={st.c}><Text style={{ fontSize: 22 }}>◎</Text></View>
        <Text style={st.t}>{CS.discoverSoon}</Text>
        <Text style={st.s}>{CS.discoverSoonSub}</Text>
      </View>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  soon: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 24 },
  c: { width: 56, height: 56, borderRadius: 28, backgroundColor: C.primarySoft, alignItems: 'center', justifyContent: 'center' },
  t: { fontFamily: fonts.sansBold, fontSize: 16, color: C.ink },
  s: { fontFamily: fonts.sansRegular, fontSize: 12.5, color: C.ink2, textAlign: 'center' },
});
