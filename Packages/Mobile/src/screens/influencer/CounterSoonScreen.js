/**
 * CounterSoonScreen — the item 6 placeholder behind Counter. Writes nothing; says so.
 * Contract: features/item5-invitations · APPROVAL.md §3.4 · prompt §11 assumption 11
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { settingsTokens as T, fonts } from '../../theme/tokens';
import { PrimaryButton } from '../../components/settings/primitives';
import { Header, s as base } from '../brand/BrandPitchSettingsScreen';
import { C5 } from '../../components/invitations/copy5';

export default function CounterSoonScreen({ navigation }) {
  const c = C5.creator.counterSoon;
  return (
    <View style={base.screen} testID="counter-soon">
      <Header title={C5.creator.detail.counter} onBack={() => navigation.goBack()} />
      <View style={s.body}>
        <Text style={s.title}>{c.title}</Text>
        <Text style={s.text}>{c.body}</Text>
        <View style={{ width: 240, marginTop: 18 }}><PrimaryButton label={c.back} onPress={() => navigation.goBack()} testID="counter-back" /></View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28 },
  title: { fontFamily: fonts.sansBold, fontSize: 17, color: T.ink, textAlign: 'center' },
  text: { fontFamily: fonts.sansRegular, fontSize: 13.5, color: T.ink2, textAlign: 'center', marginTop: 8, lineHeight: 19 },
});
