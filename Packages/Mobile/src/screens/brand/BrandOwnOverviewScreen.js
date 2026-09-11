/**
 * BrandOwnOverviewScreen — O4: "This is what creators see." The brand's own overview, the
 * same body creators get, with Edit details and Pitch settings shortcuts.
 * Contract: features/item3-discovery-profiles-groups · prompt §6.7 O4
 */
import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { settingsTokens as T, fonts } from '../../theme/tokens';
import { brandApi } from '../../services/api';
import { TagRow, Banner, SecondaryButton } from '../../components/settings/primitives';
import { Skeleton, LoadError } from '../../components/settings/feedback';
import { AIMS, MODES, aimLabel, modeLabel, COPY } from '../../components/settings/copy';
import { Header, s as base } from './BrandPitchSettingsScreen';
import { hx } from './BrandCreatorProfileScreen';
import BrandOverviewBody from '../../components/discovery/BrandOverviewBody';
import { C3 } from '../../components/discovery/copy3';

const O = C3.overview;

export default function BrandOwnOverviewScreen({ navigation, route }) {
  const brandId = route?.params?.brandId;
  const [status, setStatus] = useState('loading');
  const [data, setData] = useState(null);
  const [summary, setSummary] = useState(null);

  const load = useCallback(async () => {
    setStatus(s => (s === 'ready' ? 'ready' : 'loading'));
    const [r, p] = await Promise.all([brandApi.getOwnOverview(brandId), brandApi.getPitchSettings()]);
    if (!r.success) { setStatus('error'); return; }
    setData(r.data);
    setSummary(p.success ? p.data.summary : null);
    setStatus('ready');
  }, [brandId]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (status === 'loading') return <View style={base.screen}><Header title={O.ownTitle} onBack={() => navigation.goBack()} /><Skeleton /></View>;
  if (status === 'error') return <View style={base.screen}><Header title={O.ownTitle} onBack={() => navigation.goBack()} /><LoadError onRetry={load} /></View>;

  const paused = !summary || summary.labelState === 'paused';
  const tags = summary ? [...AIMS.filter(a => summary.aims.includes(a)).map(aimLabel), ...MODES.filter(m => summary.modes.includes(m)).map(modeLabel)] : [];
  const accepts = paused ? (
    <Banner testID="not-accepting-banner" title={COPY.creator.notAcceptingTitle} body={COPY.creator.notAcceptingBody} />
  ) : (
    <View style={hx.card} testID="accepts-card"><Text style={hx.cardTitle}>{O.accepts}</Text><TagRow items={tags} /></View>
  );

  return (
    <View style={base.screen} testID="own-overview">
      <Header title={O.ownTitle} onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={base.body}>
        <View style={s.info}><Text style={s.infoText}>{O.ownInfo}</Text></View>
        <BrandOverviewBody brand={data.brand} products={data.products} viewer="brand" navigation={navigation} acceptsNode={accepts} ownHint={O.ownProductsHint} />
        <View style={{ height: 20 }} />
        <SecondaryButton label={O.editDetails} onPress={() => navigation.navigate('BrandBusinessDetails')} testID="edit-details" />
        <SecondaryButton label={O.pitchSettings} onPress={() => navigation.navigate('BrandPitchSettings')} testID="pitch-settings" />
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  info: { backgroundColor: T.surface, borderRadius: 10, padding: 10, marginBottom: 16 },
  infoText: { fontFamily: fonts.sansMedium, fontSize: 12.5, color: T.ink2, textAlign: 'center' },
});
