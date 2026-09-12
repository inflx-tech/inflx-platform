/**
 * BrandCampaignsScreen — C1 (Live / Drafts / Past with campaign cards) and C2 (empty, loading,
 * couldn't load). Replaces the item 3 "coming soon" placeholder on the Campaigns tab.
 * Contract: features/item4-campaigns-sets · prompt §6.1
 */
import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { settingsTokens as T, fonts } from '../../theme/tokens';
import { brandApi } from '../../services/api';
import { PrimaryButton } from '../../components/settings/primitives';
import { useToast, Skeleton } from '../../components/settings/feedback';
import { LoadErrorList } from '../../components/discovery/DiscoverList';
import SegmentedControl from '../../components/shell/SegmentedControl';
import useRouteToast from '../../hooks/useRouteToast';
import { s as base } from './BrandPitchSettingsScreen';
import { CampaignCard4 } from '../../components/campaigns/bits4';
import { C4 } from '../../components/campaigns/copy4';

export default function BrandCampaignsScreen({ navigation, route }) {
  const [segment, setSegment] = useState(route?.params?.segment || 'Live');
  const [status, setStatus] = useState('loading');
  const [rows, setRows] = useState([]);
  const { toast, show } = useToast();
  useRouteToast(navigation, route, show);

  const load = useCallback(async (seg) => {
    setStatus(st => (st === 'ready' ? 'ready' : 'loading'));
    const r = await brandApi.campaignsSummary({ state: C4.tabParam[seg], limit: 50 });
    if (!r.success) { setStatus('error'); return; }
    setRows(r.data.campaigns || []);
    setStatus('ready');
  }, []);
  useFocusEffect(useCallback(() => { load(segment); }, [load, segment]));

  const goNew = () => navigation.navigate('BrandCampaignNew');
  const open = (c) => navigation.navigate('BrandCampaignDetail', { campaignId: c.id, name: c.name });

  return (
    <View style={base.screen} testID="brand-campaigns">
      <View style={{ paddingTop: 54, paddingHorizontal: 18, paddingBottom: 8 }}>
        <Text style={s.title}>{C4.list.title}</Text>
        <SegmentedControl segments={C4.tabs} value={segment} onChange={setSegment} testID="campaign-segments" />
      </View>
      {status === 'loading' ? <Skeleton rows={4} /> : null}
      {status === 'error' ? <LoadErrorList what={C4.list.loadWhat} onRetry={() => load(segment)} /> : null}
      {status === 'ready' ? (
        <FlatList
          data={rows}
          keyExtractor={c => c.id}
          contentContainerStyle={{ padding: 18, paddingBottom: 40 }}
          ListHeaderComponent={<View style={{ marginBottom: 12 }}><PrimaryButton label={`+ ${C4.list.newCampaign}`} onPress={goNew} testID="new-campaign" /></View>}
          ListEmptyComponent={
            <View style={s.empty} testID="campaigns-empty">
              <Text style={s.emptyTitle}>{C4.list.emptyTitle}</Text>
              <Text style={s.emptyBody}>{C4.list.emptyBody}</Text>
            </View>
          }
          renderItem={({ item }) => <CampaignCard4 c={item} onPress={() => open(item)} />}
        />
      ) : null}
      {toast}
    </View>
  );
}

const s = StyleSheet.create({
  title: { fontFamily: fonts.sansBold, fontSize: 20, color: T.ink, marginBottom: 10 },
  empty: { borderWidth: 1.5, borderStyle: 'dashed', borderColor: T.border, borderRadius: 14, padding: 18, alignItems: 'center' },
  emptyTitle: { fontFamily: fonts.sansBold, fontSize: 14.5, color: T.ink, textAlign: 'center' },
  emptyBody: { fontFamily: fonts.sansRegular, fontSize: 12.5, color: T.ink2, textAlign: 'center', marginTop: 6, lineHeight: 18 },
});
