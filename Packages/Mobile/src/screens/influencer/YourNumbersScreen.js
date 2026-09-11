/**
 * YourNumbersScreen — R4 (all good) and R5 (every state with its one action).
 * Contract: features/item3b-social-numbers · prompt §5.2
 */
import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { settingsTokens as T, fonts } from '../../theme/tokens';
import { influencerApi } from '../../services/api';
import { Skeleton, useToast } from '../../components/settings/feedback';
import { PrimaryButton } from '../../components/settings/primitives';
import { Header, s as base } from '../brand/BrandPitchSettingsScreen';
import PlatformCard from '../../components/social/PlatformCard';
import { C3B } from '../../components/social/copy3b';

export default function YourNumbersScreen({ navigation }) {
  const [status, setStatus] = useState('loading');
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(null);
  const { toast, show } = useToast();

  const load = useCallback(async () => {
    const r = await influencerApi.getMySocial();
    if (!r.success) { setStatus('error'); return; }
    setData(r.data);
    setStatus('ready');
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function checkAgain(platform) {
    setBusy(platform);
    const r = await influencerApi.checkSocialAgain(platform);
    setBusy(null);
    if (!r.success) { show(r.error?.message || C3B.states.loadTitle); return; }
    setData(r.data);
  }
  const goFix = (platform) => navigation.navigate('ProfileInfo', { focus: platform });
  const goDetail = (platform) => navigation.navigate('SocialDetail', { platform, viewer: 'creator' });

  if (status === 'loading') return <View style={base.screen}><Header title={C3B.r4.title} onBack={() => navigation.goBack()} /><Skeleton /></View>;
  if (status === 'error') {
    return (
      <View style={base.screen}><Header title={C3B.r4.title} onBack={() => navigation.goBack()} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }} testID="load-error">
          <Text style={s.errTitle}>{C3B.states.loadTitle}</Text><Text style={s.errBody}>{C3B.states.loadBody}</Text>
          <View style={{ width: 160, marginTop: 16 }}><PrimaryButton label={C3B.states.tryAgain} onPress={load} testID="try-again" /></View>
        </View>
      </View>
    );
  }

  return (
    <View style={base.screen} testID="your-numbers">
      <Header title={C3B.r4.title} onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={[base.body, { paddingBottom: 40 }]}>
        <View style={s.info}><Text style={s.infoText}>{C3B.r4.info}</Text></View>
        {['instagram', 'youtube'].map(p => (
          <PlatformCard key={p} platform={p} data={data[p]} mode="creator" onPress={() => goDetail(p)} onFix={() => goFix(p)} onAdd={() => goFix(p)}
            onCheckAgain={() => checkAgain(p)} checkBusy={busy === p} />
        ))}
        <Text style={base.hint}>{C3B.r4.hint}</Text>
      </ScrollView>
      {toast}
    </View>
  );
}

const s = StyleSheet.create({
  info: { backgroundColor: T.state.waiting.bg, borderRadius: 12, padding: 10, marginBottom: 12 },
  infoText: { fontFamily: fonts.sansSemiBold, fontSize: 12.5, color: T.state.waiting.fg },
  errTitle: { fontFamily: fonts.sansBold, fontSize: 17, color: T.ink },
  errBody: { fontFamily: fonts.sansRegular, fontSize: 13.5, color: T.ink3, marginTop: 6 },
});
