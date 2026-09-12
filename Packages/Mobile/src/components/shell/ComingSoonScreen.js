/**
 * ComingSoonScreen — the A6 pattern for every tab that arrives in a later item.
 * Contract: features/item3-discovery-profiles-groups · prompt §6.1
 * Configured through route params { kind } (see C3.comingSoon) or direct props.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { settingsTokens as T, fonts } from '../../theme/tokens';
import { PrimaryButton } from '../settings/primitives';
import { C3 } from '../discovery/copy3';

const TARGETS = {
  brandHome: { tab: 'CreatorsTab' }, brandWallet: { tab: 'CreatorsTab' },
  creatorHome: { tab: 'CollabsTab', screen: 'FindBrands' }, creatorCreate: { tab: 'CollabsTab', screen: 'FindBrands' },
  creatorWallet: { tab: 'ProfileTab', screen: 'PaymentTax' },
};

export default function ComingSoonScreen({ navigation, route, kind: kindProp, title: titleProp }) {
  const kind = kindProp || route?.params?.kind || 'brandHome';
  const c = C3.comingSoon[kind] || C3.comingSoon.brandHome;
  const target = TARGETS[kind] || TARGETS.brandHome;
  function go() {
    if (target.screen) navigation.navigate(target.tab, { screen: target.screen });
    else navigation.navigate(target.tab);
  }
  return (
    <View style={s.screen} testID={`coming-soon-${kind}`}>
      <Text style={s.tabTitle}>{titleProp || route?.params?.tabTitle || ''}</Text>
      <View style={s.body}>
        <Text style={s.title}>{c.title}</Text>
        <Text style={s.text}>{c.body}</Text>
        <View style={{ width: 220, marginTop: 18 }}>
          <PrimaryButton label={c.button} onPress={go} testID="coming-soon-button" />
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: T.bg },
  tabTitle: { fontFamily: fonts.sansBold, fontSize: 20, color: T.ink, paddingTop: 54, paddingHorizontal: 18 },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28 },
  title: { fontFamily: fonts.sansBold, fontSize: 17, color: T.ink, textAlign: 'center' },
  text: { fontFamily: fonts.sansRegular, fontSize: 13.5, color: T.ink2, textAlign: 'center', marginTop: 8, lineHeight: 19 },
});
